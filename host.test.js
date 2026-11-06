import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Import the real Host body with only its DSH package boundary stubbed.
// This checks adapter semantics, not the real Loader, authentication or storage backend.
const source = await readFile(new URL('./index.js', import.meta.url), 'utf8');
const dataModule = text => `data:text/javascript,${encodeURIComponent(text)}`;
const schemaModule = dataModule('const schema = new Proxy(() => schema, { get: () => schema }); export const z = schema;');
const moduleSource = source
  .replace("'@deepseek-ai/dsh-storage-domain'", JSON.stringify(dataModule('export const defineDomain = x => x; export const domainTable = x => x;')))
  .replace("'@deepseek-ai/dsh-tools'", JSON.stringify(dataModule('export const defineTool = x => x;')))
  .replace("'zod'", JSON.stringify(schemaModule))
  .replace("'./store.js'", JSON.stringify(new URL('./store.js', import.meta.url).href));
const plugin = await import(dataModule(moduleSource));

function context({ failRegistration = false } = {}) {
  const tools = new Map(), routes = new Map(), records = new Map(), disposers = [];
  let closes = 0;
  const domain = { table: () => ({ get: id => records.get(id), put: async (id, value) => records.set(id, value) }), close: async () => { closes++; } };
  const ctx = {
    storageDomain: {
      get() { throw new Error('Must not close another plugin instance\'s domain'); },
      open: async spec => { assert.equal(spec.name, 'intent_canvas_shared'); return domain; }
    },
    effect: callback => disposers.push(callback()),
    get: () => undefined,
    connection: { fetch: { register: route => routes.set(route.path, route) } },
    tools: { register(definition) { if (failRegistration) throw new Error('registration failed'); tools.set(definition.name, definition); } }
  };
  return { ctx, tools, routes, disposers, closes: () => closes };
}
const execution = { agent: { id: 'host-test' }, signal: new AbortController().signal };
const request = body => new Request('http://localhost/api/intent-canvas/apply', { method: 'POST', body: JSON.stringify(body) });

test('Host uses declared services and closes only its owned domain', async () => {
  assert.deepEqual(plugin.inject, ['storageDomain', 'tools', 'connection']);
  const mounted = context();
  await plugin.apply(mounted.ctx);
  assert.equal(mounted.closes(), 0);
  assert.equal(mounted.disposers.length, 1);
  await mounted.disposers[0]();
  assert.equal(mounted.closes(), 1);
});

test('Host prompt registration follows a late optional service scope', async () => {
  const mounted = context();
  let callback;
  mounted.ctx.inject = (dependencies, install) => {
    assert.deepEqual(dependencies, ['systemPrompt']);
    callback = install;
  };
  await plugin.apply(mounted.ctx);
  const sections = [];
  callback({ get: name => {
    assert.equal(name, 'systemPrompt');
    return { section: value => sections.push(value) };
  } });
  assert.equal(sections.length, 1);
  assert.equal(sections[0].name, 'intent-canvas');
  assert.match(sections[0].text, /canvas_read/);
});

test('Host releases its domain if registration fails', async () => {
  const mounted = context({ failRegistration: true });
  await assert.rejects(plugin.apply(mounted.ctx), /registration failed/);
  assert.equal(mounted.closes(), 1);
});

test('UI and AI adapters share versions and enforce trusted human approval', async () => {
  const mounted = context();
  await plugin.apply(mounted.ctx);
  const read = mounted.tools.get('canvas_read'), apply = mounted.tools.get('canvas_apply');
  const initial = JSON.parse(await read.execute({}, execution));
  assert.equal(initial.document.id, 's-host-test');
  const raised = JSON.parse(await apply.execute({ baseVersion: 0, ops: [{ type: 'raisePending', id: 'confirm', kind: 'custom', message: 'Confirm' }] }, execution));
  assert.equal(raised.document.version, 1);
  const forbidden = JSON.parse(await apply.execute({ baseVersion: 1, ops: [{ type: 'resolvePending', id: 'confirm', approved: true }] }, execution));
  assert.equal(forbidden.error.code, 'FORBIDDEN');
  const route = mounted.routes.get('/api/intent-canvas/apply');
  assert.deepEqual(route.methods, ['POST']);
  const approved = await (await route.fetch(request({ doc: 's-host-test', baseVersion: 1, author: 'ai', ops: [{ type: 'resolvePending', id: 'confirm', approved: true }] }))).json();
  assert.equal(approved.document.pending[0].resolvedBy, 'human');
  assert.equal(approved.document.version, 2);
  const stale = JSON.parse(await apply.execute({ baseVersion: 1, ops: [{ type: 'clear' }] }, execution));
  assert.equal(stale.error.code, 'VERSION_CONFLICT');
  assert.equal(JSON.parse(await read.execute({}, execution)).document.version, 2);
});

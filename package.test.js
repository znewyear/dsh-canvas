import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const manifest = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'));
test('bundle manifest preserves runtime identity and includes required distribution resources', async () => {
  assert.equal(manifest.name, '@local/intent-canvas');
  assert.equal(manifest.private, true);
  assert.equal(manifest.license, 'MIT');
  assert.equal(manifest.repository.url, 'git+https://github.com/znewyear/dsh-canvas.git');
  assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml');
  assert.equal(manifest.dsh.client.platform, 'web');
  assert.equal(manifest.engines.dsh, '0.2.2-rc.1');
  for (const resource of ['index.js', 'host.js', 'client.js', 'engine.js', 'store.js', 'cordis.patch.yml', 'icon.svg']) {
    assert.ok(manifest.files.includes(resource), `${resource} must be packed`);
    await access(new URL(resource, import.meta.url));
  }
  assert.equal(manifest.exports['./client'], './client.js');
  assert.equal(manifest.exports['./icon'], './icon.svg');
  assert.equal(manifest.exports['./locale/*.json'], './locale/*.json');
  for (const language of ['en', 'zh']) {
    const locale = JSON.parse(await readFile(new URL(`./locale/${language}.json`, import.meta.url), 'utf8'));
    assert.ok(locale.meta.title.trim());
    assert.ok(locale.meta.description.trim());
  }
  const source = await readFile(new URL('./index.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /[A-Za-z]:[\\/]/);
  for (const dependency of ['@deepseek-ai/dsh-storage-domain', '@deepseek-ai/dsh-tools', 'zod']) {
    assert.ok(manifest.peerDependencies[dependency]);
    assert.equal(manifest.peerDependenciesMeta[dependency].optional, true);
  }
  const patch = await readFile(new URL('./cordis.patch.yml', import.meta.url), 'utf8');
  assert.ok(patch.includes(manifest.name));
});

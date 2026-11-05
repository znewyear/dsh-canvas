import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
// shortcut: local linked bundle uses this Desktop installation; update anchor if Desktop moves.
const runtimeRequire = createRequire('F:/apps/deepseek/resources/app.asar/dsh/package.json');
const runtimeImport = name => import(pathToFileURL(runtimeRequire.resolve(name)).href);
const { defineDomain, domainTable } = await runtimeImport('@deepseek-ai/dsh-storage-domain');
const { defineTool } = await runtimeImport('@deepseek-ai/dsh-tools');
const { z } = await runtimeImport('zod');
import { createStore, failure } from './store.js';

export const inject = ['storageDomain', 'tools', 'connection', 'webServer'];
const spec = defineDomain({name:'intent_canvas_shared',version:1,tables:{documents:domainTable(z.object({id:z.string(),version:z.number(),elements:z.array(z.any()),annotations:z.array(z.any()),pending:z.array(z.any()),history:z.array(z.any()),future:z.array(z.any())}))}});
const output = {schema:{type:'string'},render:(_args,value)=>[{type:'text',text:value}]};
// Each session owns a canvas document named after it, so a new session in a project starts on its own empty canvas.
const sessionDoc = exec => { const id = exec?.agent?.id; return id ? 's-' + String(id).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 72) : 'canvas'; };
const docOf = (args, exec) => args.doc || sessionDoc(exec);

export async function apply(ctx) {
  // Recover our own handle leaked by the earlier failed activation; this domain belongs only to this plugin.
  await ctx.storageDomain.get(spec.name)?.close();
  const domain = await ctx.storageDomain.open(spec);
  ctx.effect(() => () => domain.close());
  try {
  const store = createStore(domain.table('documents'));
  // Tell the model the canvas exists, where it is, and when to draw instead of only writing prose.
  ctx.get('systemPrompt')?.section({name:'intent-canvas', order:55, text:[
    '这个会话有一块协作画布：右侧栏的「画布」标签，文档 id 为 s-<会话id>，你和用户编辑同一份。',
    '当用户描述结构、流程、布局、界面、草图，或你对需求哪里不清楚时，先用 canvas_apply 把它画出来（形状、箭头、便签、文字），不要只用文字描述。',
    '画完在回复里用一句话告诉用户「已画在右侧画布，可直接改」，不要假设他们已经看到。',
    '用户改动画布后，先 canvas_read 再回应；不要覆盖用户的笔迹，用新增或移动表达你的改动。',
    '画布上每个图元左上角有半透明编号（按文档顺序，从底层到顶层，组容器不编号、组内子元素各自编号）；用户会用「图元 3」这样的说法指代它们，回答时也用同样的编号。',
    '需要澄清时，也可以让用户在画布上圈出或画一下，再读回来确认。'
  ].join('\n')});
  // Transient per-document author marker: the panel turns a fresh "ai" mark into the "AI is editing" badge.
  const activity = new Map();
  const mark = (doc, author, version) => activity.set(doc, {author, at: Date.now(), version});
  const seen = doc => {const a = activity.get(doc); return a && Date.now() - a.at < 15000 ? a : undefined;};
  const safe = async (fn) => {try {return await fn();} catch(error) {return failure(error);}};
  // Exact Connection routes retain owner authentication without consuming the Gateway interceptor.
  for (const method of ['read', 'apply']) ctx.connection.fetch.register({
    path: `/api/intent-canvas/${method}`, methods: ['POST'], requestBody: 'buffered',
    fetch: async request => Response.json(await safe(async () => {
      if (request.signal.aborted) throw Object.assign(new Error('Request cancelled'), {code:'ABORTED'});
      const payload = await request.json();
      const doc = typeof payload?.doc === 'string' && payload.doc ? payload.doc : 'canvas';
      const result = method === 'read' ? await store.read(payload) : await store.apply(payload, 'human');
      if (method === 'apply' && result.ok) mark(doc, 'human', result.document.version);
      const current = seen(doc);
      return {...result, activity: current};
    }))
  });
  ctx.tools.register(defineTool({
    name:'canvas_read',
    description:'Read a shared canvas document, including elements, comments, pending human consultations and current version. Read before editing; the human sees the same state.',
    parameters:{doc:{type:'string',description:"Document id; omitted = this session's canvas."},sinceSeq:{type:'integer',description:'Known version; adds unchanged:true when still current.'}},
    output,
    async execute(args, exec) {return JSON.stringify(await safe(() => store.read({...args, doc:docOf(args, exec)})));}
  }));
  ctx.tools.register(defineTool({
    name:'canvas_apply',
    description:'Atomically edit the human–AI shared canvas. On VERSION_CONFLICT read and reconcile, never blindly retry. One batch is one shared undo step. Circle promotion creates a consultation only a human can approve. Coordinates: rects world-space, path points rect-local, eraser points world-space. Operations: create {element:{id,kind,rect:[x,y,w,h],...}}, update {id,patch}, delete {ids}, clear, move {ids,dx,dy}, resize {id,rect}, erasePath {ids?,points:[[x,y]],radius}, group {id,ids}, ungroup {id}, reorder {ids,position}, setText {id,text}, setRole {id,role}, setVariant {id,variant}, duplicate {ids}, paste {elements}, align {ids,alignment:left|right|center|top|bottom|middle}, distribute {ids,axis:x|y}, promote {id,to:button|card|group}, annotate {elementId?,text}, resolveAnnotation {id}, raisePending {message,operation?}, resolvePending {id,approved:false}. Every operation includes type. Freehand: create {element:{id,kind:path,rect,points,stroke,strokeWidth}}. undo/redo/revertTo {version} must be singleton batches. Returns the new snapshot and diff; no changes on validation failure.',
    parameters:{doc:{type:'string',description:"Document id; omitted = this session's canvas."},baseVersion:{type:'integer',required:true,description:'Version obtained from canvas_read.'},ops:{type:'array',items:{type:'json'},required:true,description:'Operation objects; max 1000, finite coordinates, unique ids.'}},
    output,
    async execute(args,exec) {if(exec.signal.aborted) return JSON.stringify(failure({code:'ABORTED',message:'Request cancelled'}));const doc=docOf(args,exec);const out=await safe(() => store.apply({...args, doc},'ai'));if(out.ok&&out.document)mark(doc,'ai',out.document.version);return JSON.stringify(out);}
  }));
  } catch (error) {
    await domain.close();
    throw error;
  }
}

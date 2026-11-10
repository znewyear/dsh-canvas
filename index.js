import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { z } from 'zod';
import { createStore, failure } from './store.js';

export const inject = ['storageDomain', 'tools', 'connection'];
const spec = defineDomain({name:'intent_canvas_shared',version:1,tables:{documents:domainTable(z.object({id:z.string(),version:z.number(),elements:z.array(z.any()),annotations:z.array(z.any()),pending:z.array(z.any()),history:z.array(z.any()),future:z.array(z.any())}))}});
const output = {schema:{type:'string'},render:(_args,value)=>[{type:'text',text:value}]};
// Each session owns a canvas document named after it, so a new session in a project starts on its own empty canvas.
const sessionDoc = exec => { const id = exec?.agent?.id; return id ? 's-' + String(id).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 72) : 'canvas'; };
const docOf = (args, exec) => args.doc || sessionDoc(exec);
// Image elements carry inline base64 data URLs; tool output omits the bytes so a pasted screenshot cannot flood the model context.
const stripImageData = (key, value) => key === 'src' && typeof value === 'string' && value.startsWith('data:image/') ? '[image data omitted]' : value;

export async function apply(ctx) {
  const domain = await ctx.storageDomain.open(spec);
  ctx.effect(() => () => domain.close());
  try {
  const store = createStore(domain.table('documents'));
  // Keep ordinary conversation text-first; use the canvas for explicit requests or useful clarification.
  const registerPrompt = owner => owner.get('systemPrompt').section({name:'intent-canvas', order:55, text:[
    '这个会话有一块协作画布：右侧栏的「画布」标签，文档 id 为 s-<会话id>，你和用户编辑同一份。',
    '协作画布是可选的沟通工具，默认用文字回答，不主动读取或修改画布。',
    '用户明确要求在画布中查看、绘制或修改内容，或通过画布的「发给 AI」功能提交内容时，可以使用 canvas_read / canvas_apply。',
    '沟通出现理解障碍且可视化有助于对齐理解时，也可以按需使用画布：例如用户意图不完整、双方反复解释纠正仍未对齐、用户指出 AI 理解偏差，或 AI 自己发现此前理解可能错误或前后矛盾。',
    '此时可以先提示用户用画布协作，或主动绘制最小必要的理解草图请用户确认、修改或补充；不要求每次都画，简单问题能用一句文字问清时优先文字澄清。主动绘制时将不确定内容标为「待确认」，不要把推测当作已确认的需求。',
    '仅仅出现「画布」关键词、讨论画布插件本身，或描述结构、流程、布局、界面、草图，不自动触发画布操作。进入画布任务后可继续完成该任务，转向无关话题后恢复文字优先。',
    '画完在回复里用一句话告诉用户「已画在右侧画布，可直接改」，不要假设他们已经看到。',
    '用户改动画布后，先 canvas_read 再回应；不要覆盖用户的笔迹，用新增或移动表达你的改动。',
    '画布上每个图元左上角有半透明编号（按文档顺序，从底层到顶层，组容器不编号、组内子元素各自编号）；用户会用「图元 3」这样的说法指代它们，回答时也用同样的编号。',
    '按上述条件使用画布澄清时，也可以让用户在画布上圈出或画一下，再读回来确认。'
  ].join('\n')});
  if (typeof ctx.inject === 'function') ctx.inject(['systemPrompt'], registerPrompt);
  else if (ctx.get('systemPrompt')) registerPrompt(ctx);
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
    description:'Read a shared canvas document, including elements, comments, pending human consultations and current version. Read before editing; the human sees the same state. Image elements are returned with src replaced by "[image data omitted]".',
    parameters:{doc:{type:'string',description:"Document id; omitted = this session's canvas."},sinceSeq:{type:'integer',description:'Known version; when still current, returns unchanged:true and omits the document.'}},
    output,
    async execute(args, exec) {return JSON.stringify(await safe(() => store.read({...args, doc:docOf(args, exec)})), stripImageData);}
  }));
  ctx.tools.register(defineTool({
    name:'canvas_apply',
    description:'Atomically edit the human–AI shared canvas. On VERSION_CONFLICT read and reconcile, never blindly retry. One batch is one shared undo step. Circle promotion creates a consultation only a human can approve. Coordinates: rects world-space, path points rect-local, eraser points world-space. Operations: create {element:{id,kind,rect:[x,y,w,h],...}}, update {id,patch}, delete {ids}, clear, move {ids,dx,dy}, resize {id,rect}, erasePath {ids?,points:[[worldX,worldY],...],radius}, group {id,ids}, ungroup {id}, reorder {ids,position}, setText {id,text}, setRole {id,role}, setVariant {id,variant}, duplicate {ids}, paste {elements}, align {ids,alignment:left|right|center|top|bottom|middle}, distribute {ids,axis:x|y}, promote {id,to:button|card|group}, annotate {elementId?,text}, resolveAnnotation {id}, raisePending {message,operation?}, resolvePending {id,approved:false}. Every operation includes type. Freehand: create {element:{id,kind:path,rect,points,stroke,strokeWidth}}. Images: create {element:{id,kind:image,rect,src:"data:image/..."}} (data URL only, ≤900 KB); image bytes are omitted from tool output. undo/redo/revertTo {version} must be singleton batches. Returns the new snapshot and diff; no changes on validation failure.',
    parameters:{doc:{type:'string',description:"Document id; omitted = this session's canvas."},baseVersion:{type:'integer',required:true,description:'Version obtained from canvas_read.'},ops:{type:'array',items:{type:'json'},required:true,description:'Operation objects; max 1000, finite coordinates, unique ids.'}},
    output,
    async execute(args,exec) {if(exec.signal.aborted) return JSON.stringify(failure({code:'ABORTED',message:'Request cancelled'}));const doc=docOf(args,exec);const out=await safe(() => store.apply({...args, doc},'ai'));if(out.ok&&out.document)mark(doc,'ai',out.document.version);return JSON.stringify(out, stripImageData);}
  }));
  } catch (error) {
    await domain.close();
    throw error;
  }
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import { createLocale } from './test-support.js';

const source=await readFile(new URL('./client.js',import.meta.url),'utf8');

// Hook harness exercises the actual mounted panel's initial read, not a copied RPC helper.
async function mount(fetch,transport=true){
  let module,cursor=0;
  const states=[],refs=[],effects=[],registrations=[],calls=[];
  const React={
    Fragment:'fragment',createElement:(type,props,...children)=>({type,props,children}),
    useState(initial){const i=cursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return [states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value;}];},
    useRef(initial){const i=cursor++;return refs[i]??=( {current:initial} );},
    useEffect(fn){effects.push(fn);}
  };
  const send=async(...args)=>{calls.push(args);return fetch(...args);};
  const scope={window:{__ModuleLoader__:{load:value=>{module=value;}},addEventListener(){},removeEventListener(){}},setInterval:()=>1,clearInterval(){},setTimeout:()=>0,clearTimeout(){},fetch:transport?()=>{throw Error('must use authenticated transport');}:send};
  if(transport)scope.__DSH_TRANSPORT__={fetch:send};
  vm.runInNewContext(source,scope);
  const plugin=module.factory(()=>React);
  const ctx={get:name=>({slots:{inject:(_,fn)=>fn(),register:(options,component)=>registrations.push({options,component})},locale:createLocale(),layout:{}}[name])};
  plugin.apply(ctx);
  const main=registrations.find(r=>r.options.name==='main').component();
  const canvas=main.children.find(child=>typeof child?.type==='function');
  const render=()=>{cursor=0;return canvas.type(canvas.props);};
  render();
  const cleanup=effects.splice(0).map(fn=>fn()).filter(fn=>typeof fn==='function');
  await new Promise(resolve=>setImmediate(resolve));
  const tree=render();
  cleanup.forEach(fn=>fn());
  return {tree,calls};
}
function nodes(tree){return tree&&typeof tree==='object'?[tree,...(tree.children??[]).flatMap(nodes)]:[];}
function text(tree){return typeof tree==='string'?tree:(tree?.children??[]).map(text).join('');}

test('mounted panel reads its document through authenticated transport',async()=>{
  const {tree,calls}=await mount(async()=>({ok:true,json:async()=>({ok:true,document:{id:'canvas',version:7,elements:[],history:[],future:[],annotations:[],pending:[]}})}));
  assert.equal(calls.length,1);
  assert.equal(calls[0][0],'api/intent-canvas/read');
  assert.equal(calls[0][1].method,'POST');
  assert.deepEqual(JSON.parse(calls[0][1].body),{doc:'canvas'});
  assert.equal(nodes(tree).filter(n=>n.props?.role==='alert').length,0);
  assert.match(text(tree),/Version.*7/);
});

test('mounted panel reports HTTP failure and offers refresh',async()=>{
  const {tree}=await mount(async()=>({ok:false,status:403}),false);
  const alert=nodes(tree).find(n=>n.props?.role==='alert');
  assert.ok(alert);
  assert.match(text(alert),/HTTP 403/);
  assert.ok(nodes(alert).some(n=>n.type==='button'&&n.props['aria-label']==='Refresh'));
});

test('mounted panel reports rejected response envelopes',async()=>{
  const {tree}=await mount(async()=>({ok:true,json:async()=>({ok:false,error:{code:'INVALID_DOCUMENT',message:'Invalid document id'}})}));
  const alert=nodes(tree).find(n=>n.props?.role==='alert');
  assert.ok(alert);
  assert.match(text(alert),/Invalid document id/);
});

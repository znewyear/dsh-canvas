import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import { createLocale } from './test-support.js';

const source=await readFile(new URL('./client.js',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));

// Drives the mounted panel with real pointer/keyboard handlers so the gesture code, not a copy of it, produces the operations.
function harness({session,activity,inputActions,locale=createLocale(),globals={},elements=[],canvasContext=null}={}){
  let module,cursor=0;const states=[],refs=[],effects=[],effectDeps=[],registrations=[],calls=[];
  const el=()=>({focus(){},getBoundingClientRect:()=>({left:0,top:0}),clientWidth:800,clientHeight:600,setPointerCapture(){},releasePointerCapture(){},hasPointerCapture:()=>false,getContext:canvasContext?()=>canvasContext:undefined,style:{}});
  const React={Fragment:'fragment',createElement:(type,props,...children)=>({type,props,children}),
    useState(initial){const i=cursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return [states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value;}];},
    useRef(initial){const i=cursor++;return refs[i]??={current:initial===null?el():initial};},
    useEffect(fn,deps){const i=cursor++,prev=effectDeps[i];if(prev&&deps&&prev.length===deps.length&&deps.every((v,j)=>v===prev[j]))return;effectDeps[i]=deps;effects.push(fn);}};
  const doc={id:'canvas',version:1,elements:[...elements],history:[],future:[],annotations:[],pending:[]};
  const envelope=d=>({ok:true,json:async()=>({ok:true,document:{...d,elements:[...d.elements]},...(activity?{activity}:{})})});
  const fetch=async(url,init)=>{
    calls.push([url,JSON.parse(init.body)]);
    const args=JSON.parse(init.body);
    if(url.endsWith('/read'))return envelope(doc);
    doc.version++;
    args.ops.forEach(op=>{
      if(op.type==='create')doc.elements.push(op.element);
      else if(op.type==='update'){const el=doc.elements.find(e=>e.id===op.id);if(el)Object.assign(el,op.patch);}
      else if(op.type==='delete')doc.elements=doc.elements.filter(e=>!op.ids.includes(e.id));
      doc.history.push(op);
    });
    return envelope(doc);
  };
  const winListeners=new Map();
  const windowStub={__ModuleLoader__:{load:value=>{module=value;}},addEventListener(type,fn){if(!winListeners.has(type))winListeners.set(type,new Set());winListeners.get(type).add(fn);},removeEventListener(type,fn){winListeners.get(type)?.delete(fn);}};
  vm.runInNewContext(source,{window:windowStub,setInterval:()=>1,clearInterval(){},setTimeout:()=>0,clearTimeout(){},__DSH_TRANSPORT__:{fetch},...globals});
  const plugin=module.factory(()=>React);
  const sessions={retain:(id,options)=>({ready:Promise.resolve(),release(){},binding:{session:{prompt:async(content,mode)=>{calls.push(['prompt',id,options,content,mode]);return {ok:true};}}}})};
  plugin.apply({get:name=>({slots:{inject:(_,fn)=>fn(),register:(options,component)=>registrations.push({options,component})},locale,layout:{},sessions})[name]});
  const main=registrations.find(r=>r.options.name==='main').component();
  const canvas=main.children.find(child=>typeof child?.type==='function');
  const render=()=>{cursor=0;return canvas.type(session?{...canvas.props,sessionId:session,inputActions}:canvas.props);};
  render();
  effects.splice(0).forEach(fn=>fn?.());
  const flush=()=>{effects.splice(0).forEach(fn=>fn?.());};
  const dispatch=(type,event)=>{for(const fn of [...(winListeners.get(type)||[])])fn(event);};
  return {render,calls,flush,dispatch,doc};
}
const nodes=tree=>tree&&typeof tree==='object'?[tree,...(tree.children??[]).flatMap(nodes)]:[];
const text=tree=>typeof tree==='string'?tree:(tree?.children??[]).map(text).join('');
const button=(tree,label)=>nodes(tree).find(n=>n.type==='button'&&n.props?.['aria-label']===label);
const key=(k,extra={})=>({key:k,code:extra.code??'',ctrlKey:!!extra.ctrlKey,metaKey:false,shiftKey:!!extra.shiftKey,target:{tagName:'DIV'},preventDefault(){},stopPropagation(){}});
const pointer=(x,y)=>({button:0,pointerId:1,clientX:x,clientY:y,shiftKey:false,target:{getAttribute:()=>null},preventDefault(){},stopPropagation(){},currentTarget:{setPointerCapture(){},releasePointerCapture(){},hasPointerCapture:()=>false}});

async function gesture(panel,points){
  const svg=nodes(panel.render()).find(n=>n.props?.role==='img').props;
  svg.onPointerDown(pointer(...points[0]));
  for(const point of points.slice(1))svg.onPointerMove(pointer(...point));
  await svg.onPointerUp(pointer(...points.at(-1)));
  await tick();
}

test('a pen click without a drag submits nothing',async()=>{  const panel=harness();
  await tick();
  let tree=panel.render();
  tree.props.onKeyDown(key('p'));
  await gesture(panel,[[120,120]]);
  assert.deepEqual(panel.calls.map(call=>call[0]),['api/intent-canvas/read']);
});

test('pen, eraser and lasso gestures reach the shared engine',async()=>{
  const panel=harness();
  await tick();
  let tree=panel.render();
  assert.match(text(tree),/Version 1/);

  tree.props.onKeyDown(key('p'));
  tree=panel.render();
  assert.equal(button(tree,'Pen').props['aria-pressed'],true,'P selects the pen');

  await gesture(panel,[[100,100],[200,120],[300,140]]);
  let ops=panel.calls.at(-1)[1].ops;
  assert.equal(ops[0].type,'create');
  assert.equal(ops[0].element.kind,'path');
  assert.deepEqual(ops[0].element.rect,[10,30,200,40]);
  assert.deepEqual(ops[0].element.points,[[0,0],[100,20],[200,40]]);
  assert.equal(ops[0].element.strokeWidth,2.5);

  await gesture(panel,[[100,200],[200,220],[300,240]]);
  assert.equal(panel.calls.at(-1)[1].ops[0].element.rect[1],130);

  tree=panel.render();
  tree.props.onKeyDown(key('e'));
  await gesture(panel,[[120,120],[240,150],[300,170]]);
  ops=panel.calls.at(-1)[1].ops;
  assert.equal(ops[0].type,'erasePath');
  assert.equal(ops[0].radius,14,'eraser sends its local radius');
  assert.equal(ops[0].points.length,3);

  tree=panel.render();
  tree.props.onKeyDown(key('l'));
  await gesture(panel,[[60,60],[400,60],[400,260],[60,260]]);
  tree=panel.render();
  const consult=nodes(tree).find(n=>n.props?.['aria-label']==='What does this circle mean?');
  assert.ok(consult,'lasso around elements asks what the circle means');
  assert.match(text(consult),/Nothing converts without your choice/);
  assert.equal(button(consult,'Group enclosed').props.disabled,false);

  button(consult,'Group enclosed').props.onClick();
  await tick();
  ops=panel.calls.at(-1)[1].ops;
  assert.equal(ops.length,1);
  assert.equal(ops[0].type,'group');
  assert.equal(ops[0].ids.length,2);

  tree=panel.render();
  tree.props.onKeyDown(key('z',{ctrlKey:true}));
  await tick();
  assert.equal(panel.calls.at(-1)[1].ops[0].type,'undo');
});

test('selection shortcuts move, duplicate and delete through the same engine',async()=>{
  const panel=harness();
  await tick();
  let tree=panel.render();
  tree.props.onKeyDown(key('p'));
  await gesture(panel,[[100,100],[200,120],[300,140]]);
  const id=panel.calls.at(-1)[1].ops[0].element.id;

  tree=panel.render();
  tree.props.onKeyDown({...key('ArrowRight'),code:'ArrowRight'});
  await tick();
  assert.deepEqual(panel.calls.at(-1)[1].ops[0],{type:'move',ids:[id],dx:1,dy:0});

  tree=panel.render();
  tree.props.onKeyDown({...key('ArrowDown',{shiftKey:true}),code:'ArrowDown'});
  await tick();
  assert.equal(panel.calls.at(-1)[1].ops[0].dy,10);

  tree=panel.render();
  tree.props.onKeyDown(key('d',{ctrlKey:true}));
  await tick();
  assert.equal(panel.calls.at(-1)[1].ops[0].type,'duplicate');

  tree=panel.render();
  tree.props.onKeyDown({...key('Delete'),code:'Delete'});
  await tick();
  assert.equal(panel.calls.at(-1)[1].ops[0].type,'delete');
});

test('rotating twice in a row commits both angles',async()=>{
  const panel=harness();
  await tick();
  let tree=panel.render();
  tree.props.onKeyDown(key('p'));
  await gesture(panel,[[100,100],[200,120],[300,140]]);
  const ev=(x,y)=>({button:0,pointerId:1,clientX:x,clientY:y,shiftKey:false,
    target:{getAttribute:()=>null},preventDefault(){},stopPropagation(){},
    currentTarget:{setPointerCapture(){},releasePointerCapture(){},hasPointerCapture:()=>false}});
  const rot=(p,c,a)=>[c[0]+(p[0]-c[0])*Math.cos(a)-(p[1]-c[1])*Math.sin(a),c[1]+(p[0]-c[0])*Math.sin(a)+(p[1]-c[1])*Math.cos(a)];
  // Same geometry as the canvas: the rotate handle sits above the rotated box, in screen space.
  const handle=()=>{const e=panel.doc.elements[0],[x,y,w,h]=e.rect,a=(Number(e.rotation)||0)*Math.PI/180,cx=x+w/2,cy=y+h/2;
    const cs=[[x,y],[x+w,y],[x+w,y+h],[x,y+h]].map(p=>rot(p,[cx,cy],a)),xs=cs.map(p=>p[0]),ys=cs.map(p=>p[1]);
    return [(Math.min(...xs)+Math.max(...xs))/2+90,Math.max(Math.min(...ys)-22,6-70)+70];};
  const spin=async(from,to)=>{const layer=nodes(panel.render()).find(n=>n.props?.role==='img');
    layer.props.onPointerDown(ev(...from));layer.props.onPointerMove(ev(...to));await layer.props.onPointerUp(ev(...to));await tick();};
  await spin(handle(),[300,120]);
  const first=panel.calls.at(-1)[1].ops[0];
  assert.equal(first.type,'update');
  assert.ok(Math.abs(first.patch.rotation-90)<1);
  await spin(handle(),[300,120]);
  const second=panel.calls.at(-1)[1].ops[0];
  assert.equal(second.type,'update','the second rotation also commits');
  assert.ok(Math.abs(second.patch.rotation-180)<1,'the angle accumulates');
});

test('a second rotation started before the re-render still accumulates',async()=>{
  const panel=harness();
  await tick();
  let tree=panel.render();
  tree.props.onKeyDown(key('p'));
  await gesture(panel,[[100,100],[200,120],[300,140]]);
  tree=panel.render();
  tree.props.onKeyDown(key('v'));
  tree=panel.render();
  button(tree,'More actions').props.onClick();
  tree=panel.render();
  button(tree,'Rotate').props.onClick();
  const canvas=nodes(panel.render()).find(n=>n.props?.role==='img').props;
  const ev=(x,y)=>({button:0,pointerId:1,clientX:x,clientY:y,shiftKey:false,
    target:{getAttribute:()=>null},preventDefault(){},stopPropagation(){},
    currentTarget:{setPointerCapture(){},releasePointerCapture(){},hasPointerCapture:()=>false}});
  canvas.onPointerDown(ev(200,60));
  canvas.onPointerMove(ev(300,120));
  await canvas.onPointerUp(ev(300,120));
  await tick();
  const first=panel.calls.at(-1)[1].ops[0];
  assert.ok(Math.abs(first.patch.rotation-90)<1,'first turn is 90');
  // Same captured handlers, so the closure still sees the document from before the first commit.
  canvas.onPointerDown(ev(300,120));
  canvas.onPointerMove(ev(200,60));
  await canvas.onPointerUp(ev(200,60));
  await tick();
  const second=panel.calls.at(-1)[1].ops[0];
  assert.equal(second.type,'update');
  assert.ok(Math.abs(second.patch.rotation-360)<1||Math.abs(second.patch.rotation)<1,'stale closure must not reset the angle');
});

test('repeated resizes keep a usable minimum size',async()=>{
  const panel=harness();
  await tick();
  let tree=panel.render();
  tree.props.onKeyDown(key('r'));
  await gesture(panel,[[100,100],[300,200]]);
  const ev=(x,y)=>({button:0,pointerId:1,clientX:x,clientY:y,shiftKey:false,
    target:{getAttribute:()=>null},preventDefault(){},stopPropagation(){},
    currentTarget:{setPointerCapture(){},releasePointerCapture(){},hasPointerCapture:()=>false}});
  const se=()=>{const e=panel.doc.elements[0];return[(e.rect[0]+e.rect[2])+90,(e.rect[1]+e.rect[3])+70];};
  for(let i=0;i<3;i++){
    const layer=nodes(panel.render()).find(n=>n.props?.role==='img');
    const [hx,hy]=se();
    layer.props.onPointerDown(ev(hx,hy));
    layer.props.onPointerMove(ev(hx-220,hy-140));
    await layer.props.onPointerUp(ev(hx-220,hy-140));
    await tick();
  }
  const op=panel.calls.at(-1)[1].ops[0];
  assert.equal(op.type,'resize');
  assert.ok(op.rect[2]>=8&&op.rect[3]>=8,'shape keeps a grabbable size');
});

test('dragging the rotation handle stores an angle',async()=>{
  const panel=harness();
  await tick();
  let tree=panel.render();
  tree.props.onKeyDown(key('p'));
  await gesture(panel,[[100,100],[200,120],[300,140]]);
  tree=panel.render();
  const layer=nodes(tree).find(n=>n.props?.role==='img');
  const ev=(x,y)=>({button:0,pointerId:1,clientX:x,clientY:y,shiftKey:false,
    target:{getAttribute:()=>null},preventDefault(){},stopPropagation(){},
    currentTarget:{setPointerCapture(){},releasePointerCapture(){},hasPointerCapture:()=>false}});
  layer.props.onPointerDown(ev(200,78));
  layer.props.onPointerMove(ev(300,120));
  await layer.props.onPointerUp(ev(300,120));
  await tick();
  const op=panel.calls.at(-1)[1].ops[0];
  assert.equal(op.type,'update');
  assert.ok(Math.abs(op.patch.rotation-90)<1,'rotation reaches 90 degrees');
});

test('shift constrains new shapes, moves and corner resizes',async()=>{
  const panel=harness();
  await tick();
  let tree=panel.render();
  const surface=()=>nodes(panel.render()).find(n=>n.props?.role==='img').props;
  const ev=(x,y,shiftKey=false)=>({button:0,pointerId:1,clientX:x,clientY:y,shiftKey,
    target:{getAttribute:()=>null},preventDefault(){},stopPropagation(){},
    currentTarget:{setPointerCapture(){},releasePointerCapture(){},hasPointerCapture:()=>false}});

  tree.props.onKeyDown(key('r'));
  let el=surface();
  el.onPointerDown(ev(100,100));
  el.onPointerMove(ev(300,200,true));
  await el.onPointerUp(ev(300,200,true));
  await tick();
  const created=panel.calls.at(-1)[1].ops[0].element;
  assert.equal(created.rect[2],created.rect[3],'shift-drag makes a square');

  tree=panel.render();
  tree.props.onKeyDown(key('v'));
  el=surface();
  el.onPointerDown(ev(200,150));
  el.onPointerMove(ev(260,300,true));
  await el.onPointerUp(ev(260,300,true));
  await tick();
  const moved=panel.calls.at(-1)[1].ops[0];
  assert.equal(moved.type,'move');
  assert.equal(moved.dx,0,'shift-move locks to the dominant axis');
  assert.ok(moved.dy>0);

  panel.render();
  const e=panel.doc.elements[0],ratio=e.rect[2]/e.rect[3],se=[e.rect[0]+e.rect[2]+90,e.rect[1]+e.rect[3]+70];
  el=surface();
  el.onPointerDown(ev(...se));
  el.onPointerMove(ev(se[0]+100,se[1]+200,true));
  await el.onPointerUp(ev(se[0]+100,se[1]+200,true));
  await tick();
  const resized=panel.calls.at(-1)[1].ops[0];
  assert.equal(resized.type,'resize');
  assert.ok(Math.abs(resized.rect[2]/resized.rect[3]-ratio)<.01,'shift-resize keeps the original aspect ratio');
});

test('the fill toggle fills new shapes',async()=>{
  const panel=harness();
  await tick();
  let tree=panel.render();
  tree.props.onKeyDown(key('r'));
  tree=panel.render();
  const fill=button(tree,'Fill');
  assert.ok(fill,'fill toggle is offered for shapes');
  fill.props.onClick();
  tree=panel.render();
  await gesture(panel,[[100,100],[300,260]]);
  const element=panel.calls.at(-1)[1].ops[0].element;
  assert.equal(element.kind,'rect');
  assert.equal(element.fill,'#cfe3d5');
});

test('typing a text block and clicking away commits it',async()=>{
  const panel=harness();
  await tick();
  let tree=panel.render();
  tree.props.onKeyDown(key('t'));
  tree=panel.render();
  const down=(x,y)=>({button:0,pointerId:1,clientX:x,clientY:y,shiftKey:false,
    target:{getAttribute:()=>null},preventDefault(){},stopPropagation(){},
    currentTarget:{setPointerCapture(){},releasePointerCapture(){},hasPointerCapture:()=>false}});
  nodes(tree).find(n=>n.props?.role==='img').props.onPointerDown(down(200,150));
  tree=panel.render();
  const area=nodes(tree).find(n=>n.props?.['aria-label']==='Text content');
  assert.ok(area,'text editor opens');
  area.props.onChange({target:{value:'Hello'}});
  tree=panel.render();
  nodes(tree).find(n=>n.props?.role==='img').props.onPointerDown(down(400,300));
  await tick();
  const op=panel.calls.at(-1)[1].ops[0];
  assert.equal(op.type,'create');
  assert.equal(op.element.text,'Hello');
});

test('right-click opens a canvas menu with copy and paste',async()=>{
  const panel=harness();
  await tick();
  let tree=panel.render();
  const canvas=nodes(tree).find(n=>n.props?.role==='img');
  canvas.props.onContextMenu({clientX:200,clientY:150,preventDefault(){}});
  tree=panel.render();
  const menu=nodes(tree).find(n=>n.props?.role==='menu');
  assert.ok(menu,'context menu renders');
  const items=nodes(menu).filter(n=>n.props?.role==='menuitem').map(n=>text(n));
  assert.ok(items.some(t=>/Copy|复制/.test(t)),'offers copy');
  assert.ok(items.some(t=>/Paste|粘贴/.test(t)),'offers paste');
});

test('the context menu groups only a multi-selection',async()=>{
  const rect=(id,x)=>({id,kind:'rect',rect:[x,0,50,50],stroke:'#356c59',strokeWidth:2,fill:'none'});
  const panel=harness({elements:[rect('a',0),rect('b',100)]});
  await tick();
  let tree=panel.render();
  tree.props.onKeyDown(key('a',{ctrlKey:true}));
  tree=panel.render();
  const canvas=nodes(tree).find(n=>n.props?.role==='img').props;
  canvas.onContextMenu({clientX:500,clientY:400,preventDefault(){}});
  tree=panel.render();
  const group=nodes(tree).find(n=>n.props?.role==='menuitem'&&/Group|编组/.test(text(n)));
  assert.ok(group,'group item exists');
  assert.equal(group.props.disabled,false,'two selected roots can be grouped');
  group.props.onClick();
  await tick();
  const op=panel.calls.at(-1)[1].ops[0];
  assert.equal(op.type,'group');
  assert.equal(op.ids.length,2);
});

test('the context menu keeps Group disabled for a single selection',async()=>{
  const panel=harness({elements:[{id:'a',kind:'rect',rect:[0,0,50,50],stroke:'#356c59',strokeWidth:2,fill:'none'}]});
  await tick();
  let tree=panel.render();
  tree.props.onKeyDown(key('a',{ctrlKey:true}));
  tree=panel.render();
  const canvas=nodes(tree).find(n=>n.props?.role==='img').props;
  canvas.onContextMenu({clientX:500,clientY:400,preventDefault(){}});
  tree=panel.render();
  const group=nodes(tree).find(n=>n.props?.role==='menuitem'&&/Group|编组/.test(text(n)));
  assert.equal(group.props.disabled,true,'a single element cannot be grouped');
});

test('the context menu ungroups a selected group',async()=>{
  const panel=harness({elements:[
    {id:'g',kind:'group',rect:[0,0,100,100],stroke:'#356c59',strokeWidth:2,fill:'none'},
    {id:'c',kind:'rect',parent:'g',rect:[0,0,100,100],stroke:'#356c59',strokeWidth:2,fill:'none'}
  ]});
  await tick();
  let tree=panel.render();
  tree.props.onKeyDown(key('a',{ctrlKey:true}));
  tree=panel.render();
  const canvas=nodes(tree).find(n=>n.props?.role==='img').props;
  canvas.onContextMenu({clientX:500,clientY:400,preventDefault(){}});
  tree=panel.render();
  const ungroup=nodes(tree).find(n=>n.props?.role==='menuitem'&&/Ungroup|取消编组/.test(text(n)));
  assert.ok(ungroup,'ungroup item exists');
  assert.equal(ungroup.props.disabled,false,'a selected group can be ungrouped');
  ungroup.props.onClick();
  await tick();
  assert.equal(panel.calls.at(-1)[1].ops[0].type,'ungroup');
});

test('right-clicking an unselected group selects it before showing the menu',async()=>{
  const panel=harness({elements:[
    {id:'g',kind:'group',rect:[0,0,100,100],stroke:'#356c59',strokeWidth:2,fill:'none'},
    {id:'c',kind:'rect',parent:'g',rect:[0,0,100,100],stroke:'#356c59',strokeWidth:2,fill:'none'}
  ]});
  await tick();
  let tree=panel.render();
  const canvas=nodes(tree).find(n=>n.props?.role==='img').props;
  canvas.onContextMenu({clientX:150,clientY:120,preventDefault(){}});
  tree=panel.render();
  const ungroup=nodes(tree).find(n=>n.props?.role==='menuitem'&&/Ungroup|取消编组/.test(text(n)));
  assert.equal(ungroup.props.disabled,false,'the clicked group became the selection');
});

test('pasting an image from the system clipboard creates an editable image element',async()=>{
  const png='data:image/png;base64,'+'A'.repeat(60);
  class FakeImage{constructor(){this.naturalWidth=200;this.naturalHeight=100;}set src(value){this._src=value;Promise.resolve().then(()=>this.onload&&this.onload());}get src(){return this._src;}}
  class FakeFileReader{readAsDataURL(blob){this.result=blob.dataUrl;Promise.resolve().then(()=>this.onload&&this.onload());}}
  const panel=harness({globals:{
    navigator:{clipboard:{read:async()=>[{types:['image/png'],getType:async()=>({dataUrl:png})}]}},
    Image:FakeImage,FileReader:FakeFileReader
  }});
  await tick();
  let tree=panel.render();
  nodes(tree).find(n=>n.props?.role==='img').props.onContextMenu({clientX:200,clientY:150,preventDefault(){}});
  tree=panel.render();
  const paste=nodes(tree).filter(n=>n.props?.role==='menuitem').find(n=>/Paste|粘贴/.test(text(n)));
  assert.ok(paste,'paste menu item exists');
  paste.props.onClick();
  for(let i=0;i<6;i++)await tick();
  const op=panel.calls.at(-1)[1].ops[0];
  assert.equal(op.type,'create');
  assert.equal(op.element.kind,'image');
  assert.equal(op.element.src,png);
  assert.deepEqual(op.element.rect.slice(2),[200,100],'natural size is kept for small images');
});

test('image elements paint through drawImage after they decode',async()=>{
  const png='data:image/png;base64,'+'A'.repeat(60),drawn=[];
  const ctx=new Proxy({drawImage:(...args)=>{drawn.push(args);}},{get:(target,key)=>key in target?target[key]:()=>{},set:(target,key,value)=>{target[key]=value;return true;}});
  class FakeImage{constructor(){this.naturalWidth=200;this.naturalHeight=100;}set src(value){this._src=value;Promise.resolve().then(()=>this.onload&&this.onload());}get src(){return this._src;}}
  const panel=harness({elements:[{id:'img',kind:'image',rect:[10,20,200,100],src:png}],canvasContext:ctx,globals:{Image:FakeImage}});
  await tick();panel.render();panel.flush();
  for(let i=0;i<4;i++)await tick();
  assert.ok(drawn.length,'decoded images are drawn');
  assert.deepEqual(drawn.at(-1).slice(1),[10,20,200,100]);
});

test('the text editor sets font size and colour on new text',async()=>{
  const panel=harness();
  await tick();
  let tree=panel.render();
  tree.props.onKeyDown(key('t'));
  tree=panel.render();
  const down=(x,y)=>({button:0,pointerId:1,clientX:x,clientY:y,shiftKey:false,
    target:{getAttribute:()=>null},preventDefault(){},stopPropagation(){},
    currentTarget:{setPointerCapture(){},releasePointerCapture(){},hasPointerCapture:()=>false}});
  nodes(tree).find(n=>n.props?.role==='img').props.onPointerDown(down(200,150));
  tree=panel.render();
  const area=nodes(tree).find(n=>n.props?.['aria-label']==='Text content');
  area.props.onChange({target:{value:'Big'}});
  tree=panel.render();
  const size=nodes(tree).find(n=>n.props?.['aria-label']==='Font size');
  assert.ok(size,'font size control exists');
  size.props.onChange({target:{value:'28'}});
  tree=panel.render();
  nodes(tree).find(n=>n.props?.role==='img').props.onPointerDown(down(400,300));
  await tick();
  const element=panel.calls.at(-1)[1].ops[0].element;
  assert.equal(element.text,'Big');
  assert.equal(element.fontSize,28);
});

test('the numbers toggle switches the badges off and on',async()=>{
  const panel=harness();
  await tick();
  let tree=panel.render();
  const on=button(tree,'Numbers');
  assert.equal(on.props['aria-pressed'],true);
  on.props.onClick();
  tree=panel.render();
  assert.equal(button(tree,'Numbers').props['aria-pressed'],false);
});

test('coalesced pointer samples and stylus pressure reach the stroke',async()=>{
  const panel=harness();
  await tick();
  let tree=panel.render();
  tree.props.onKeyDown(key('p'));
  tree=panel.render();
  const surface=nodes(tree).find(n=>n.props?.role==='img').props;
  const ev=(x,y,extra={})=>({button:0,pointerId:1,clientX:x,clientY:y,shiftKey:false,pointerType:'pen',pressure:.5,
    target:{getAttribute:()=>null},preventDefault(){},stopPropagation(){},
    currentTarget:{setPointerCapture(){},releasePointerCapture(){},hasPointerCapture:()=>false},...extra});
  surface.onPointerDown(ev(100,100,{pressure:.2}));
  surface.onPointerMove(ev(150,120,{pressure:.7,getCoalescedEvents:()=>[
    {clientX:120,clientY:105,pointerType:'pen',pressure:.35},
    {clientX:138,clientY:113,pointerType:'pen',pressure:.55}]}));
  await surface.onPointerUp(ev(180,130,{pressure:.8}));
  await tick();
  const element=panel.calls.at(-1)[1].ops[0].element;
  assert.ok(element.points.length>=4,'sub-frame coalesced samples are kept');
  assert.equal(element.pressures?.length,element.points.length);
  assert.ok(element.pressures.some(value=>value<.45),'stylus pressure is stored');
  assert.ok(element.pressures.every(value=>value>=.05&&value<=1));
});

test('an idle host re-render does not repaint an unchanged canvas',async()=>{
  const calls={};
  const ctx=new Proxy({}, {get:(target,key)=>key in target?target[key]:(...args)=>{calls[key]=(calls[key]||0)+1;},
    set:(target,key,value)=>{target[key]=value;return true;}});
  const panel=harness({canvasContext:ctx});
  await tick();
  panel.render();panel.flush();
  const first=calls.clearRect||0;
  assert.ok(first>0,'the first frame paints');
  panel.render();panel.flush();
  assert.equal(calls.clearRect||0,first,'an unchanged React render skips the bitmap upload');
  panel.flush();
  assert.equal(calls.clearRect||0,first);
});

test('a host theme change repaints the cached layers',async()=>{
  let bg='#f5f5f2';
  const calls={};
  const ctx=new Proxy({}, {get:(target,key)=>key in target?target[key]:(...args)=>{calls[key]=(calls[key]||0)+1;},
    set:(target,key,value)=>{target[key]=value;return true;}});
  const panel=harness({canvasContext:ctx,globals:{getComputedStyle:()=>({getPropertyValue:name=>name==='--ic-bg'?bg:'',})}});
  await tick();
  panel.render();panel.flush();
  const first=calls.clearRect||0;
  assert.ok(first>0);
  bg='#101010';
  panel.render();panel.flush();
  assert.ok((calls.clearRect||0)>first,'a theme change must not stay cached');
});

test('the canvas is split into a scene bitmap and an event overlay',async()=>{
  const panel=harness();
  await tick();
  const tree=panel.render();
  const scene=nodes(tree).find(n=>n.props?.className==='ic-canvas ic-scene');
  const overlay=nodes(tree).find(n=>n.props?.className==='ic-canvas ic-overlay');
  assert.ok(scene,'scene layer exists');
  assert.ok(overlay,'overlay layer exists');
  assert.equal(scene.props['aria-hidden'],'true');
  assert.equal(scene.props.onPointerDown,undefined,'the scene layer never receives pointers');
  assert.equal(overlay.props.role,'img');
  assert.equal(typeof overlay.props.onPointerDown,'function');
});

test('rotate mode turns any drag into a rotation and repeats',async()=>{
  const panel=harness();
  await tick();
  let tree=panel.render();
  tree.props.onKeyDown(key('p'));
  await gesture(panel,[[100,100],[200,120],[300,140]]);
  tree=panel.render();
  tree.props.onKeyDown(key('v'));
  tree=panel.render();
  button(tree,'More actions').props.onClick();
  tree=panel.render();
  const mode=button(tree,'Rotate');
  assert.ok(mode,'rotate mode toggle exists');
  mode.props.onClick();
  tree=panel.render();
  await gesture(panel,[[200,60],[300,120]]);
  const first=panel.calls.at(-1)[1].ops[0];
  assert.equal(first.type,'update');
  assert.ok(Math.abs(first.patch.rotation-90)<1);
  tree=panel.render();
  await gesture(panel,[[200,60],[300,120]]);
  const second=panel.calls.at(-1)[1].ops[0];
  assert.equal(second.type,'update','the second rotation commits again');
  assert.ok(Math.abs(second.patch.rotation-180)<1,'angles accumulate');
});

test('the pen size popover sets the stroke width',async()=>{
  const panel=harness();
  await tick();
  let tree=panel.render();
  tree.props.onKeyDown(key('p'));
  tree=panel.render();
  const sizeButton=button(tree,'Pen size');
  assert.ok(sizeButton,'the pen offers a size control');
  sizeButton.props.onClick();
  tree=panel.render();
  const slider=nodes(tree).find(n=>n.type==='input'&&n.props?.['aria-label']==='Pen size');
  assert.ok(slider,'the size popover offers a slider');
  slider.props.onChange({target:{value:'7'}});
  tree=panel.render();
  await gesture(panel,[[100,100],[200,120],[300,140]]);
  const element=panel.calls.at(-1)[1].ops[0].element;
  assert.equal(element.strokeWidth,7);
});

test('the pen type popover selects one of five pen kinds',async()=>{
  const panel=harness();
  await tick();
  let tree=panel.render();
  tree.props.onKeyDown(key('p'));
  tree=panel.render();
  button(tree,'Pen type').props.onClick();
  tree=panel.render();
  const kinds=nodes(tree).filter(n=>n.props?.role==='menuitem');
  assert.deepEqual(kinds.map(n=>n.props['aria-label']),['Plain','Marker','Pencil','Watercolor','Fountain pen']);
  assert.equal(kinds[0].props['aria-pressed'],true,'plain is the default pen');
  kinds[4].props.onClick();
  tree=panel.render();
  await gesture(panel,[[100,100],[220,130]]);
  assert.equal(panel.calls.at(-1)[1].ops[0].element.pen,'fountain');
});

test('the pen colour popover applies presets and offers a custom picker',async()=>{
  const panel=harness();
  await tick();
  let tree=panel.render();
  tree.props.onKeyDown(key('p'));
  tree=panel.render();
  button(tree,'Pen color').props.onClick();
  tree=panel.render();
  const presets=nodes(tree).filter(n=>n.type==='button'&&/^#[0-9a-f]{6}$/.test(n.props?.['aria-label']||''));
  assert.equal(presets.length,17,'the palette lists 17 presets plus the custom picker');
  assert.ok(nodes(tree).some(n=>n.props?.['aria-label']==='Custom color'),'a custom colour picker is offered');
  presets[4].props.onClick();
  tree=panel.render();
  await gesture(panel,[[100,100],[220,130]]);
  assert.equal(panel.calls.at(-1)[1].ops[0].element.stroke,'#e03131');
});

test('shape style controls update the selected shape',async()=>{
  const panel=harness();
  await tick();
  let tree=panel.render();
  tree.props.onKeyDown(key('r'));
  tree=panel.render();
  await gesture(panel,[[100,100],[220,180]]);
  tree=panel.render();
  const created=panel.calls.at(-1)[1].ops[0];
  assert.equal(created.type,'create');
  button(tree,'Border color').props.onClick();
  tree=panel.render();
  const swatch=nodes(tree).find(n=>n.type==='button'&&n.props?.['aria-label']==='#e03131');
  assert.ok(swatch,'the border palette opens next to the shape params');
  swatch.props.onClick();
  await tick();
  const op=panel.calls.at(-1)[1].ops[0];
  assert.equal(op.type,'update','picking a border colour edits the selection');
  assert.equal(op.patch.stroke,'#e03131');
  assert.equal(op.id,created.element.id);
});

test('eraser radius follows the live zoom',async()=>{
  const panel=harness();
  await tick();
  let tree=panel.render();
  tree.props.onKeyDown(key('e'));
  tree=panel.render();
  button(tree,'Zoom in').props.onClick();
  await tick();
  await gesture(panel,[[100,100],[200,120]]);
  const op=panel.calls.at(-1)[1].ops[0];
  assert.equal(op.type,'erasePath');
  assert.ok(Math.abs(op.radius-14/1.2)<1e-9,'the committed radius is screen-constant');
});

test('whole erase removes everything it touches in one operation',async()=>{
  const panel=harness();
  await tick();
  let tree=panel.render();
  tree.props.onKeyDown(key('p'));
  await gesture(panel,[[100,100],[200,120],[300,140]]);
  tree=panel.render();
  tree.props.onKeyDown(key('e'));
  tree=panel.render();
  const whole=button(tree,'Whole erase');
  assert.ok(whole,'eraser offers the whole-stroke mode');
  whole.props.onClick();
  tree=panel.render();
  await gesture(panel,[[145,108],[155,112],[165,116]]);
  const op=panel.calls.at(-1)[1].ops[0];
  assert.equal(op.type,'delete');
  assert.equal(op.ids.length,1);
});

test('dragging a canvas handle resizes the selection',async()=>{
  const panel=harness();
  await tick();
  let tree=panel.render();
  tree.props.onKeyDown(key('p'));
  await gesture(panel,[[100,100],[200,120],[300,140]]);
  tree=panel.render();
  const layer=nodes(tree).find(n=>n.props?.role==='img');
  assert.ok(layer,'the overlay owns hit-testing and drawing');
  const handleEvent=(x,y)=>({button:0,pointerId:1,clientX:x,clientY:y,shiftKey:false,
    target:{getAttribute:()=>null},preventDefault(){},stopPropagation(){},
    currentTarget:{setPointerCapture(){},releasePointerCapture(){},hasPointerCapture:()=>false}});
  layer.props.onPointerDown(handleEvent(300,140));
  layer.props.onPointerMove(handleEvent(400,200));
  await layer.props.onPointerUp(handleEvent(400,200));
  await tick();
  const op=panel.calls.at(-1)[1].ops[0];
  assert.equal(op.type,'resize');
  assert.ok(op.rect[2]>200,'width grows with the drag');
  assert.ok(op.rect[3]>40,'height grows with the drag');
});

test('selection exposes eight grabbable directional handles',async()=>{
  const directions={nw:[100,100],n:[200,100],ne:[300,100],e:[300,150],se:[300,200],s:[200,200],sw:[100,200],w:[100,150]};
  for(const [hd,[hx,hy]] of Object.entries(directions)){
    const panel=harness();
    await tick();
    const first=panel.render();
    first.props.onKeyDown(key('r'));
    await gesture(panel,[[100,100],[300,200]]);
    const layer=nodes(panel.render()).find(n=>n.props?.role==='img');
    const ev=(x,y)=>({button:0,pointerId:1,clientX:x,clientY:y,shiftKey:false,
      target:{getAttribute:()=>null},preventDefault(){},stopPropagation(){},
      currentTarget:{setPointerCapture(){},releasePointerCapture(){},hasPointerCapture:()=>false}});
    layer.props.onPointerDown(ev(hx,hy));
    layer.props.onPointerMove(ev(hx+12,hy+12));
    await layer.props.onPointerUp(ev(hx+12,hy+12));
    await tick();
    assert.equal(panel.calls.at(-1)[1].ops[0].type,'resize',`${hd} starts a resize`);
  }
});

test('the marquee stays one screen pixel regardless of the shape border width',async()=>{
  const widths=[];let lw=0;
  const ctx=new Proxy({}, {get:(target,key)=>{if(key==='lineWidth')return lw;if(key==='strokeRect')return()=>widths.push(lw);return key in target?target[key]:()=>{};},
    set:(target,key,value)=>{if(key==='lineWidth')lw=value;target[key]=value;return true;}});
  const panel=harness({canvasContext:ctx});
  await tick();
  const tree=panel.render();
  const surface=nodes(tree).find(n=>n.props?.role==='img').props;
  const ev=(x,y)=>({button:0,pointerId:1,clientX:x,clientY:y,shiftKey:false,
    target:{getAttribute:()=>null},preventDefault(){},stopPropagation(){},
    currentTarget:{setPointerCapture(){},releasePointerCapture(){},hasPointerCapture:()=>false}});
  surface.onPointerDown(ev(100,100));
  surface.onPointerMove(ev(300,200));
  assert.ok(widths.length,'the marquee is painted');
  assert.equal(widths.at(-1),1,'the marquee ignores the current border width');
});

test('pointing at a tool shows its name and shortcut',async()=>{
  const panel=harness();
  await tick();
  let tree=panel.render();
  button(tree,'Pen').props.onMouseEnter({currentTarget:{offsetLeft:40,offsetWidth:30}});
  tree=panel.render();
  const tip=nodes(tree).find(n=>n.props?.role==='tooltip');
  assert.ok(tip,'tooltip renders on hover');
  assert.match(text(tip),/Pen · P/);
});

test('the semicircle tool draws a half disc from a drag',async()=>{
  const panel=harness();
  await tick();
  let tree=panel.render();
  const tool=button(tree,'Semicircle');
  assert.ok(tool,'the semicircle tool is offered');
  tool.props.onClick();
  tree=panel.render();
  await gesture(panel,[[120,140],[400,260]]);
  const op=panel.calls.at(-1)[1].ops[0];
  assert.equal(op.type,'create');
  assert.equal(op.element.kind,'path');
  assert.equal(op.element.points.length,33);
  assert.ok(op.element.rect[2]>200,'the drag width becomes the diameter');
  assert.ok(Math.abs(op.element.rect[3]-120)<2,'the drag height becomes the radius');
});

test('the semicircle tool sits directly below the ellipse tool',async()=>{
  const panel=harness();
  await tick();
  const rail=nodes(panel.render()).find(n=>n.props?.role==='toolbar'&&n.props?.['aria-label']==='Canvas');
  const order=['Select','Pan','Pen','Erase','Text','Rectangle','Ellipse','Semicircle','Arrow','Note','Lasso'];
  const labels=nodes(rail).filter(n=>n.type==='button'&&order.includes(n.props?.['aria-label'])).map(n=>n.props['aria-label']);
  assert.deepEqual(labels,order);
});

test('Open on the current document re-reads it instead of doing nothing',async()=>{
  const panel=harness();
  await tick();
  const open=button(panel.render(),'Reload');
  assert.ok(open,'the current document offers a reload action');
  const before=panel.calls.length;
  open.props.onClick();
  await tick();await tick();
  const reads=panel.calls.slice(before).filter(call=>call[0].endsWith('/read'));
  assert.equal(reads.length,1,'the button issues a fresh read');
  assert.equal(reads[0][1].sinceSeq,undefined,'a forced read bypasses the version acknowledgement');
});

test('editing the document field opens that board',async()=>{
  const panel=harness();
  await tick();
  let tree=panel.render();
  const input=nodes(tree).find(n=>n.props?.['aria-label']==='Document');
  input.props.onChange({target:{value:'board-2'}});
  tree=panel.render();
  button(tree,'Open').props.onClick();
  tree=panel.render();panel.flush();
  await tick();
  assert.ok(panel.calls.some(call=>call[0].endsWith('/read')&&call[1].doc==='board-2'),'the new board is read');
});

test('the bottom More actions menu survives pointerdown and applies its item',async()=>{
  const panel=harness();
  await tick();
  let tree=panel.render();
  tree.props.onKeyDown(key('p'));
  await gesture(panel,[[100,100],[200,120],[300,140]]);
  tree=panel.render();
  tree.props.onKeyDown(key('v'));
  tree=panel.render();
  button(tree,'More actions').props.onClick();
  tree=panel.render();panel.flush();
  assert.ok(button(tree,'Rotate left'),'the menu opened');
  panel.dispatch('pointerdown',{target:{closest:selector=>selector==='.ic-more-wrap'?'div':null}});
  tree=panel.render();panel.flush();
  assert.ok(button(tree,'Rotate left'),'pointerdown inside the menu must not close it');
  button(tree,'Rotate left').props.onClick();
  await tick();
  const op=panel.calls.at(-1)[1].ops[0];
  assert.equal(op.type,'update');
  assert.equal(op.patch.rotation,270);
});

test('the export control uses a larger icon',async()=>{
  const panel=harness();
  await tick();
  const control=button(panel.render(),'Export PNG');
  assert.equal(control.props.style.width,38);
  assert.ok(nodes(control).some(n=>n.props?.kind==='image'&&n.props?.size===23),'the glyph is larger');
});

test('the document field explains itself, is wider and has an empty placeholder',async()=>{
  const panel=harness();
  await tick();
  const tree=panel.render();
  const input=nodes(tree).find(n=>n.props?.['aria-label']==='Document');
  assert.equal(input.props.placeholder,'Please enter the canvas id to open');
  assert.match(input.props.title,/defaults to this session/);
  assert.match(String(input.props.style.width),/clamp/);
  assert.equal(button(tree,'Reload').props.title,'Re-read this canvas from the server');
  input.props.onChange({target:{value:''}});
  const cleared=panel.render();
  assert.equal(button(cleared,'Open').props.disabled,true,'an empty id cannot be opened');
});

test('clearing the board needs a second click and submits one clear operation',async()=>{
  const panel=harness();
  await tick();
  let tree=panel.render();
  tree.props.onKeyDown(key('p'));
  await gesture(panel,[[100,100],[200,120],[300,140]]);
  tree=panel.render();
  const first=button(tree,'Clear canvas');
  assert.ok(first,'clear control is offered');
  first.props.onClick();
  await tick();
  tree=panel.render();
  const second=button(tree,'Confirm clear');
  assert.ok(second,'first click only arms it');
  second.props.onClick();
  await tick();
  const ops=panel.calls.at(-1)[1].ops;
  assert.equal(ops.length,1);
  assert.equal(ops[0].type,'clear');
});

test('the session header link binds the panel to that session canvas',async()=>{
  const panel=harness({session:'session-abc'});
  assert.equal(panel.calls[0][1].doc,'s-session-abc','panel opens the session document');
  await tick();
  assert.match(text(panel.render()),/Version 1/);
});

test('the send shortcut also offers filling the composer',async()=>{
  const panel=harness({session:'session-abc'});
  await tick();
  const tree=panel.render();
  assert.ok(button(tree,'Send to AI'),'canvas offers a send shortcut');
  const fill=button(tree,'Fill input');
  assert.ok(fill,'canvas offers a fill-without-sending shortcut');
  assert.equal(panel.calls.filter(c=>c[0]==='prompt').length,0,'filling does not send');
});

test('fill uses the session editor API without replacing the selected draft or sending',async()=>{
  const inserted=[];
  const inputActions={captureInsertion:()=>({start:2,end:7,draftRev:12}),insertText:(text,span)=>{inserted.push({text,span});return true;}};
  const panel=harness({session:'session-abc',inputActions});
  await tick();
  await button(panel.render(),'Fill input').props.onClick();
  assert.equal(inserted.length,1);
  assert.match(inserted[0].text,/s-session-abc/);
  assert.deepEqual({...inserted[0].span},{start:7,end:7,draftRev:12});
  assert.equal(panel.calls.filter(c=>c[0]==='prompt').length,0);
});

test('fill reports editor rejection without sending or overwriting the draft',async()=>{
  const panel=harness({session:'session-abc',inputActions:{captureInsertion:()=>({start:0,end:0,draftRev:1}),insertText:()=>false}});
  await tick();
  await button(panel.render(),'Fill input').props.onClick();
  assert.match(text(nodes(panel.render()).find(n=>n.props?.role==='alert')),/busy or changed/);
  assert.equal(panel.calls.filter(c=>c[0]==='prompt').length,0);
});

test('one canvas click sends the session a message',async()=>{
  const panel=harness({session:'session-abc'});
  await tick();
  const send=button(panel.render(),'Send to AI');
  assert.ok(send,'canvas offers a send shortcut');
  send.props.onClick();
  await tick();
  const prompt=panel.calls.find(call=>call[0]==='prompt');
  assert.ok(prompt,'prompts the current session');
  assert.equal(prompt[1],'session-abc');
  assert.equal(prompt[2].source,'controllerOperation');
  assert.match(prompt[3][0].text,/s-session-abc/);
  assert.equal(prompt[4],'queue');
});

test('the panel shows when the AI is editing',async()=>{
  const panel=harness({session:'session-abc',activity:{author:'ai',at:Date.now(),version:2}});
  await tick();
  assert.match(text(panel.render()),/AI is editing/);
});


test('mounted panel follows locale revisions for controls and generated chat text',async()=>{
  const locale=createLocale('en'),inserted=[];
  const panel=harness({session:'locale-session',locale,inputActions:{captureInsertion:()=>({start:0,end:0}),insertText:value=>{inserted.push(value);return true;}}});
  await tick();
  assert.ok(button(panel.render(),'Fill input'));
  locale.setLocale('zh-CN');
  let tree=panel.render();
  assert.ok(button(tree,'填入输入框'));
  assert.ok(button(tree,'发给 AI'));
  await button(tree,'填入输入框').props.onClick();
  assert.match(inserted[0],/我在画布上画了\/改了内容/);
  assert.match(inserted[0],/s-locale-session/);
  locale.setLocale('en');
  tree=panel.render();
  await button(tree,'Fill input').props.onClick();
  assert.match(inserted[1],/I drew or edited the canvas/);
  assert.match(inserted[1],/Please read this canvas and continue/);
});

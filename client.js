window.__ModuleLoader__.load({
  id: '@local/intent-canvas',
  factory(require) {
    const React = require('react'), h = React.createElement;

    const { useState, useEffect, useRef } = React;
    const uid = () => 'e-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
    const bounds = es => { if (!es.length) return null; const x = Math.min(...es.map(e => e.rect[0])), y = Math.min(...es.map(e => e.rect[1])); return [x,y,Math.max(...es.map(e=>e.rect[0]+e.rect[2]))-x,Math.max(...es.map(e=>e.rect[1]+e.rect[3]))-y]; };
    const normalize = (a,b) => [Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.abs(a[0]-b[0]),Math.abs(a[1]-b[1])];
    // One bounds update for the eight directional handles; a crossed edge clamps instead of flipping.
    const resizeRect = (r,handle,start,end) => {const dx=end[0]-start[0],dy=end[1]-start[1];let [x,y,w,h]=r;
      if(handle.includes('w')){x+=dx;w-=dx;} if(handle.includes('e'))w+=dx;
      if(handle.includes('n')){y+=dy;h-=dy;} if(handle.includes('s'))h+=dy;
      if(w<1){if(handle.includes('w'))x=r[0]+r[2]-1;w=1;} if(h<1){if(handle.includes('n'))y=r[1]+r[3]-1;h=1;}
      return [x,y,w,h];};
    const inside = (p,r) => p[0]>=r[0]&&p[0]<=r[0]+r[2]&&p[1]>=r[1]&&p[1]<=r[1]+r[3];
    const pathData = pts => pts.map((p,i)=>(i?'L':'M')+p.join(',')).join(' ');
    const PEN_KEYS = {plain:'Plain',marker:'Marker',pencil:'Pencil',watercolor:'Watercolor',fountain:'Fountain pen'};
    // Keep UI dictionaries inline: this dynamic module needs no extra resource fetch or loader path.
    const labels = {
      'Filled into the chat input — edit it and send yourself':'已填入会话输入框，可修改后自己发送',
      'Chat input unavailable — copied to clipboard':'会话输入框不可用，已复制到剪贴板',
      'Chat input is busy or changed. Please retry.':'会话输入框忙碌或已变化，请重试。',
      'Chat input unavailable. Open the session canvas and retry.':'会话输入框不可用，请打开会话画布后重试。',
      "Canvas tab":"画布",
      "Collaborative Canvas":"协作画布",
      "A canvas shared with this session, side by side with the chat":"与本会话共用的画布，可与对话并排查看",
      "The AI drew on the canvas — opened it on the right":"AI 在画布上画了内容，已为你打开右侧画布",
      "Clipboard unavailable":"浏览器不允许访问剪贴板",
      "Clipboard read unavailable":"浏览器不允许读取剪贴板",
      "Copied — paste it in any board":"已复制，可在其他画板粘贴",
      "Images cannot be pasted yet":"暂不支持把图片粘贴进画布",
      "Clipboard has no canvas content":"剪贴板里没有画布内容",
      "Pasted into the canvas":"已粘贴到画布",
      "Session service unavailable":"会话服务不可用",
      "Send failed":"发送失败",
      "Canvas request failed":"画布请求失败",
      "Canvas transport failed":"画布传输失败",
      "No document":"文档不可用",
      "Nothing to copy":"没有可复制的内容",
      "Canvas unavailable":"画布不可用",
      "PNG encode failed":"PNG 编码失败",
      'I drew or edited the canvas.':'我在画布上画了/改了内容。',
      'elements':'个图元','Please read this canvas and continue.':'请读一下这份画布并接着处理。',
      'Canvas':'协作画布','Shared space, explicit intent':'共同创作，明确意图','Document':'文档','Open':'打开','Select':'选择','Pan':'移动','Pen':'画笔','Erase':'橡皮','Eraser':'橡皮','Text':'文字','Rectangle':'矩形','Ellipse':'椭圆','Arrow':'箭头','Note':'便签','Lasso':'圈选','Undo':'撤销','Redo':'重做','Delete':'删除','Duplicate':'复制副本','Group':'编组','Ungroup':'取消编组','Fit':'适应画布','Grid':'网格','Color':'颜色','Stroke width':'线宽','Eraser radius':'橡皮半径','Align':'对齐','Left':'左对齐','Center':'水平居中','Right':'右对齐','Top':'顶对齐','Middle':'垂直居中','Bottom':'底对齐','Distribute horizontally':'水平分布','Distribute vertically':'垂直分布','Front':'置顶','Back':'置底','Ready':'已同步','Saving…':'保存中…','Loading…':'加载中…','Draw a thought.':'把想法画出来。','Use the pen, add a note, or select a shape. AI and human edits share this document.':'画一笔、贴张便签，或选择形状。人与 AI 共同编辑此文档。','Space + drag to pan · Wheel to zoom · Double-click to edit text':'空格拖动画布 · 滚轮缩放 · 双击编辑文字','Selected':'已选择','Refresh':'重新读取','Dismiss':'关闭','What does this circle mean?':'这个圈表达什么意图？','Keep it as a drawing, make a card, or group the enclosed items. Nothing converts without your choice.':'保留笔迹、转成卡片，或编组圈内元素。只有你选择后才会转换。','Make card':'转成卡片','Group enclosed':'编组圈内','Keep drawing':'保留笔迹','New text':'新文字','New note':'新便签','Pending decisions':'待确认意图','Approve':'同意','Reject':'拒绝','Copy':'复制','Paste':'粘贴','Cancel':'取消','Save':'保存','Text content':'文字内容','Conflict: another edit arrived. Refresh, then retry your action. Your gesture was not applied.':'版本冲突：其他编辑已到达。请重新读取后重试，本次操作未写入。','Open canvas':'打开画布','Draw together. The agent uses the same document and operation history.':'与 AI 共用文档和操作历史。','Nothing selected':'未选择元素','Comments':'批注','Resolve':'解决','Add comment':'添加批注','Comment text':'批注内容','Send':'发送','Selection':'选择范围','Version':'版本','Zoom in':'放大','Zoom out':'缩小','Send to AI':'发给 AI','AI is editing':'AI 正在编辑','Clear canvas':'清空画板','Confirm clear':'再点一次清空','Semicircle':'半圆','More':'更多','Export PNG':'导出图片','Fragment erase':'按涂擦除','Whole erase':'整块清除','Size':'大小','Width':'粗细','Copy all':'复制全部','Close':'关闭','Fill':'填充','Fill color':'填充色','Export PNG (white)':'导出图片（白底）','Export PNG (transparent)':'导出图片（透明背景）','Rotate left':'左转 90°','Rotate right':'右转 90°','Rotate':'旋转','Numbers':'编号','More actions':'更多操作','Comment':'批注','Comment hint':'给选中图元写一条批注（AI 读画布时能看到，不会发到对话）','Font size':'字号','Text color':'文字颜色','Plain':'普通','Marker':'马克笔','Pencil':'铅笔','Watercolor':'水彩笔','Fountain pen':'钢笔','Pen type':'画笔','Pen size':'画笔大小','Pen color':'画笔颜色','Border color':'边框颜色','Border width':'边框粗细','Custom color':'自定义颜色','Fill input':'填入输入框','Fill short':'填入','Fill hint':'把画布内容填进对话输入框，不发送，你可以改完再发','Send hint':'直接发送到当前会话，我会读取画布并继续处理'
    };
    const sessionDoc = id => 's-' + String(id).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 72);
    const toast = {text: '', at: 0, listeners: new Set(), push(text) {this.text = text; this.at = Date.now(); for (const fn of this.listeners) fn();}};
    // Silent reads for the header watcher: same authenticated transport as the panel, no screen or input use.
    const readDoc = async doc => {
      const send = globalThis.__DSH_TRANSPORT__?.fetch ?? ((input, init) => globalThis.fetch(input, init));
      const response = await send('api/intent-canvas/read', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({doc})});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const r = await response.json();
      if (!r?.ok) throw Object.assign(new Error(r?.error?.message || 'read failed'), {code: r?.error?.code});
      return r;
    };
    // The canvas panel is root-scoped, so the conversation header action is the only session-scoped surface: it publishes the current session here.
    const link = {doc: null, listeners: new Set(),
      set(sessionId) {const next = sessionId ? sessionDoc(sessionId) : null; if (next === this.doc) return; this.doc = next; for (const fn of this.listeners) fn();},
      subscribe(fn) {this.listeners.add(fn); return () => {this.listeners.delete(fn);};}};
    function Icon({size=20}) { return h('svg',{width:size,height:size,viewBox:'0 0 24 24',fill:'none','aria-hidden':true},h('rect',{x:3,y:3,width:18,height:18,rx:4,stroke:'currentColor',strokeWidth:1.5}),h('path',{d:'M7 16 11 8l3 7 3-4',stroke:'currentColor',strokeWidth:1.6,strokeLinecap:'round',strokeLinejoin:'round'})); }
    // Tool glyphs: the palette carries icons and keeps its text only in title/aria-label.
    function ToolIcon({kind,size=16}) {
      const s={fill:'none',stroke:'currentColor',strokeWidth:1.6,strokeLinecap:'round',strokeLinejoin:'round'};
      const shapes={
        select:[['path',{d:'M6 3l12 8-5.2 1.3L10 19z'}]],
        pan:[['path',{d:'M12 4v16M4 12h16'}],['path',{d:'M9 7l3-3 3 3M9 17l3 3 3-3M7 9l-3 3 3 3M17 9l3 3-3 3'}]],
        pen:[['path',{d:'M4 20l4-1 10-10-3-3L5 16z'}],['path',{d:'M14 6l3 3'}]],
        erase:[['path',{d:'M4 16l8-8 5 5-6 6H6z'}],['path',{d:'M9 21h11'}]],
        text:[['path',{d:'M5 5h14M12 5v14M9 19h6'}]],
        rect:[['rect',{x:4,y:6,width:16,height:12,rx:2}]],
        ellipse:[['ellipse',{cx:12,cy:12,rx:8,ry:6}]],
        arrow:[['path',{d:'M4 20L20 4'}],['path',{d:'M13 4h7v7'}]],
        note:[['path',{d:'M5 4h14v10l-5 6H5z'}],['path',{d:'M14 20v-6h5'}]],
        lasso:[['ellipse',{cx:12,cy:10,rx:7,ry:5}],['path',{d:'M8 14c-1 2 0 4 2 5'}]],
        semi:[['path',{d:'M4 17a8 8 0 0 1 16 0z'}]],
        minus:[['path',{d:'M5 12h14'}]],
        plus:[['path',{d:'M12 5v14M5 12h14'}]],
        compose:[['rect',{x:3,y:7,width:13,height:12,rx:2}],['path',{d:'M9 13h8M13 9l4 4-4 4'}]],        marker:[['path',{d:'M4 19l3-1 9-9-3-3-9 9-1 3z'}],['path',{d:'M13 6l3 3'}]],
        pencil:[['path',{d:'M5 19l2-6 8-8 3 3-8 8-6 2z'}],['path',{d:'M14 6l3 3'}]],
        watercolor:[['path',{d:'M12 4c3 4 6 6 6 9a6 6 0 0 1-12 0c0-3 3-5 6-9z'}]],
        fountain:[['path',{d:'M6 18l3-9 4-4 2 2-4 4-9 3 3 3z'}],['path',{d:'M14 5l2 2'}]],
        image:[['rect',{x:3,y:5,width:18,height:14,rx:2}],['circle',{cx:8.5,cy:10,r:1.6}],['path',{d:'M4 17l5-5 3 3 4-4 4 4'}]],
        more:[['circle',{cx:5,cy:12,r:1.7,fill:'currentColor',stroke:'none'}],['circle',{cx:12,cy:12,r:1.7,fill:'currentColor',stroke:'none'}],['circle',{cx:19,cy:12,r:1.7,fill:'currentColor',stroke:'none'}]],
        send:[['path',{d:'M3 11l18-7-7 18-2.5-7.5z'}]]
      };
      return h('svg',{width:size,height:size,viewBox:'0 0 24 24',fill:'none','aria-hidden':true},...(shapes[kind]||shapes.select).map(([tag,attrs],i)=>h(tag,{key:i,...s,...attrs})));
    }
    function Canvas({ctx,sessionId,inputActions}) {
      const locale=ctx.get('locale');
      const [,setLocaleRevision]=useState(()=>locale.getLocale().revision);
      const t=locale.bind('intent-canvas');
      useEffect(()=>locale.subscribe(()=>setLocaleRevision(locale.getLocale().revision)),[locale]);
      const own=()=>sessionId?sessionDoc(sessionId):(link.doc||'canvas');
      const [doc,setDoc]=useState(null),[docId,setDocId]=useState(own),[inputId,setInputId]=useState(own);
      // The conversation View is session-scoped, so it pins its own document; the global panel follows the last session it saw.
      useEffect(()=>{if(sessionId)link.set(sessionId);if(!sessionId)return;setDocId(sessionDoc(sessionId));setInputId(sessionDoc(sessionId));},[sessionId]);
      useEffect(()=>link.subscribe(()=>{if(!sessionId&&link.doc){setDocId(link.doc);setInputId(link.doc);}}),[sessionId]);
      const [error,setError]=useState(''),[busy,setBusy]=useState(false),[tool,setTool]=useState('select'),[selection,setSelection]=useState([]);
      const [sending,setSending]=useState(false),[aiAt,setAiAt]=useState(0),[confirmClear,setConfirmClear]=useState(false),[tip,setTip]=useState(null),[moreOpen,setMoreOpen]=useState(false),[menu,setMenu]=useState(null),[selMore,setSelMore]=useState(false);
      const aiTimer=useRef(null),clearTimer=useRef(null);
      const fitted=useRef(false),autoFit=useRef(true),fitRef=useRef(null);
      const watchActivity=r=>{const a=r?.activity;if(!a||a.author!=='ai')return;setAiAt(a.at);if(aiTimer.current)clearTimeout(aiTimer.current);aiTimer.current=setTimeout(()=>setAiAt(0),6000);};
      useEffect(()=>()=>{if(aiTimer.current)clearTimeout(aiTimer.current);if(clearTimer.current)clearTimeout(clearTimer.current);},[]);
      // Clearing is one undoable operation; the first tap only arms it so a stray click cannot wipe the board.
      const clearBoard=async()=>{if(!doc?.elements?.length||busy)return;
        if(!confirmClear){setConfirmClear(true);if(clearTimer.current)clearTimeout(clearTimer.current);clearTimer.current=setTimeout(()=>setConfirmClear(false),4000);return;}
        setConfirmClear(false);if(clearTimer.current)clearTimeout(clearTimer.current);
        if(await commit([{type:'clear'}])){setSelection([]);setConsult(null);}};
      // One click hands the canvas to the session's agent: it prompts the exact session, so the request lands in this conversation.
      const ask=async()=>{if(!sessionId||sending||!doc)return;setSending(true);setError('');
        try{const sessions=ctx.get('sessions');if(!sessions)throw new Error(t('Session service unavailable'));
          const ref=sessions.retain(sessionId,{source:'controllerOperation'});
          try{await ref.ready;
            const r=await ref.binding.session.prompt([{type:'text',text:canvasMessage()}],'queue');
            if(!r?.ok)throw Object.assign(new Error(r?.error?.message||t('Send failed')),{code:r?.error?.code});
            setAiAt(Date.now());if(aiTimer.current)clearTimeout(aiTimer.current);aiTimer.current=setTimeout(()=>setAiAt(0),6000);
          }finally{ref.release();}
        }catch(e){report(e);}finally{setSending(false);}};
      const canvasMessage=()=>`${t('I drew or edited the canvas.')} (${t('Document')} ${live.current.docId||docId}, v${(live.current.doc||doc||{}).version}, ${((live.current.doc||doc||{}).elements||[]).length} ${t('elements')}). ${t('Please read this canvas and continue.')}`;
      // Use the Session-scoped editor API; never locate or overwrite the host's DOM.
      const fillComposer=async()=>{const text=canvasMessage();
        try{
          if(inputActions?.captureInsertion&&inputActions?.insertText){
            const span=inputActions.captureInsertion();
            if(inputActions.insertText(text,{...span,start:span.end})!==true)throw new Error(t('Chat input is busy or changed. Please retry.'));
            toast.push(t('Filled into the chat input — edit it and send yourself'));
          }else{
            if(!globalThis.navigator?.clipboard?.writeText)throw new Error(t('Chat input unavailable. Open the session canvas and retry.'));
            await navigator.clipboard.writeText(text);
            toast.push(t('Chat input unavailable — copied to clipboard'));
          }
        }catch(e){report(e);}
      };
      const [view,setView]=useState({x:90,y:70,z:1}),[grid,setGrid]=useState(true);
      const [color,setColor]=useState('#356c59'),[width,setWidth]=useState(2.5),[radius,setRadius]=useState(14),[consult,setConsult]=useState(null),[editor,setEditor]=useState(null),[comment,setComment]=useState(''),[eraseWhole,setEraseWhole]=useState(false),[fillOn,setFillOn]=useState(false),[fillColor,setFillColor]=useState('#cfe3d5'),[noteFill,setNoteFill]=useState('#f4e9ac'),[rotateMode,setRotateMode]=useState(false),[badges,setBadges]=useState(true),[penKind,setPenKind]=useState('plain'),[penPanel,setPenPanel]=useState(null),[fontSize,setFontSize]=useState(16),[textColor,setTextColor]=useState('#26382d');
      const root=useRef(null),svg=useRef(null),live=useRef({}),clipboard=useRef(null),space=useRef(false),readSeq=useRef(0),rafRef=useRef(0),paintRef=useRef(null),viewTimer=useRef(0),handleLayer=useRef(null),hoverRef=useRef(null),editorRef=useRef(null),styleTimer=useRef(0);
      // Switching to the eraser drops every selection, so no handle layer or selection bar stays behind.
      const chooseTool=k=>{if(live.current.editor)saveEditor();cancel();setTool(k);setMoreOpen(false);setPenPanel(null);if(k==='erase'){setSelection([]);hoverRef.current=null;}};
      // Paint straight from the refs: the browser never waits for a React commit during a gesture.
      const syncView=()=>{if(viewTimer.current)clearTimeout(viewTimer.current);viewTimer.current=setTimeout(()=>{viewTimer.current=0;setView(live.current.view);},150);};
      const queuePaint=()=>{if(rafRef.current)return;const raf=typeof requestAnimationFrame==='function'?requestAnimationFrame:fn=>{fn();return 0;};rafRef.current=raf(()=>{rafRef.current=0;paintRef.current&&paintRef.current();});};
      const dropQueuedGesture=()=>{if(!rafRef.current)return;if(typeof cancelAnimationFrame==='function')cancelAnimationFrame(rafRef.current);rafRef.current=0;};
      useEffect(()=>()=>{clearTimeout(viewTimer.current);clearTimeout(styleTimer.current);dropQueuedGesture();live.current.gesture=null;},[docId]);
      live.current={doc,docId,busy,gesture:live.current.gesture,editor,selection,view,tool,color,width,radius,penKind,grid,badges};
      const report=e=>setError(e?.code==='VERSION_CONFLICT'?t('Conflict: another edit arrived. Refresh, then retry your action. Your gesture was not applied.'):(e?.message||String(e)));
      const rpc=async(method,args)=>{ const send=globalThis.__DSH_TRANSPORT__?.fetch??((input,init)=>globalThis.fetch(input,init)); const response=await send(`api/intent-canvas/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(args)}); if(!response.ok)throw new Error(`${t('Canvas transport failed')}: HTTP ${response.status}`); const r=await response.json(); if(!r?.ok)throw Object.assign(new Error(r?.error?.message||t('Canvas request failed')),{code:r?.error?.code}); return r; };
      const refresh=async(force=false)=>{
        const s=live.current;if(!force&&(s.busy||s.gesture||s.editor))return;
        const seq=++readSeq.current, id=s.docId, version=s.doc?.version;
        try { const r=await rpc('read',{doc:id}); const now=live.current;
          if(seq!==readSeq.current||now.docId!==id||now.busy||now.gesture||now.editor)return;
          watchActivity(r);
          if(!now.doc||r.document.version!==version){setDoc(r.document);setSelection(ids=>ids.filter(id=>r.document.elements.some(e=>e.id===id)));if(!fitted.current){fitted.current=true;setTimeout(()=>fitRef.current?.(),40);}}
        } catch(e){if(seq===readSeq.current)report(e);}
      };
      useEffect(()=>{setDoc(null);setSelection([]);setConsult(null);setError('');live.current.docId=docId;live.current.doc=null;fitted.current=false;autoFit.current=true;refresh(true);const timer=setInterval(()=>refresh(),1100);const focus=()=>refresh();window.addEventListener('focus',focus);return()=>{clearInterval(timer);window.removeEventListener('focus',focus);++readSeq.current;};},[docId]);
      // Only a real WIDTH change (docking, sidebar resize) may reframe; chrome appearing while drawing must not.
      useEffect(()=>{const el=svg.current;if(!el||typeof ResizeObserver!=='function')return;let last=el.clientWidth;
        const observer=new ResizeObserver(()=>{const w=el.clientWidth;if(!autoFit.current||Math.abs(w-last)<24)return;last=w;if(live.current.gesture||live.current.busy||live.current.editor)return;fitRef.current?.();});
        observer.observe(el);return()=>observer.disconnect();},[docId]);
      const commit=async ops=>{const s=live.current;if(!s.doc||!ops.length)return null;
        // A gesture that finishes while the previous commit is still in flight waits for it instead of being dropped.
        for(let i=0;i<40&&s.busy;i++)await new Promise(r=>setTimeout(r,25));
        if(s.busy||!s.doc)return null;
        live.current.busy=true;setBusy(true);setError('');++readSeq.current;
        try{const r=await rpc('apply',{doc:s.docId,baseVersion:s.doc.version,ops});if(live.current.docId===s.docId){setDoc(r.document);live.current.doc=r.document;setSelection(ids=>ids.filter(id=>r.document.elements.some(e=>e.id===id)));}watchActivity(r);return r;}
        catch(e){report(e);return null;}finally{live.current.busy=false;setBusy(false);}};
      const world=e=>{const r=svg.current.getBoundingClientRect(),v=live.current.view;return[(e.clientX-r.left-v.x)/v.z,(e.clientY-r.top-v.y)/v.z];};
      const descendants=ids=>{const all=new Set(ids);let n;do{n=all.size;doc.elements.forEach(e=>{if(all.has(e.parent))all.add(e.id);});}while(n!==all.size);return all;};
      const roots=ids=>ids.filter(id=>{let e=doc.elements.find(e=>e.id===id);while(e?.parent){if(ids.includes(e.parent))return false;e=doc.elements.find(x=>x.id===e.parent);}return true;});
      const selected=doc?doc.elements.filter(e=>selection.includes(e.id)):[],selectionBounds=bounds(selected);
      const rotPoint=(p,c,a)=>[c[0]+(p[0]-c[0])*Math.cos(a)-(p[1]-c[1])*Math.sin(a),c[1]+(p[0]-c[0])*Math.sin(a)+(p[1]-c[1])*Math.cos(a)];
      const centerOf=r=>[r[0]+r[2]/2,r[1]+r[3]/2];
      const localPoint=(p,e)=>{let q=p,cur=e;const chain=[];while(cur){chain.unshift(cur);cur=cur.parent?doc.elements.find(x=>x.id===cur.parent):null;}
        for(const el of chain){const a=(Number(el.rotation)||0)*Math.PI/180;if(a)q=rotPoint(q,centerOf(el.rect),-a);}return q;};
      const pick=p=>{for(const e of [...doc.elements].reverse()){if(e.kind==='group')continue;const r=e.rect,pad=5/view.z,q=localPoint(p,e);if(!inside(q,[r[0]-pad,r[1]-pad,r[2]+pad*2,r[3]+pad*2]))continue;
          if(e.kind==='path'){let near=false;const pts=e.points.map(o=>[o[0]+r[0],o[1]+r[1]]);for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[Math.min(i+1,pts.length-1)],dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy,k=l?Math.max(0,Math.min(1,((q[0]-a[0])*dx+(q[1]-a[1])*dy)/l)):0;if(Math.hypot(q[0]-a[0]-k*dx,q[1]-a[1]-k*dy)<pad+width){near=true;break;}}if(!near)continue;}
          let top=e;while(top.parent){const parent=doc.elements.find(x=>x.id===top.parent);if(!parent)break;top=parent;}return top;}return null;};
      const beginEditor=(element,p)=>{setEditor({id:element?.id||null,kind:element?.kind||tool,rect:element?.rect||[p[0],p[1],tool==='note'?200:180,tool==='note'?140:55],text:element?.text||'',fontSize:element?.fontSize||fontSize,textColor:element?.textColor||textColor});};
      // Read from the ref and clear it first, so a blur plus a click cannot commit the same text twice.
      const saveEditor=async()=>{const e=live.current.editor;if(!e)return;live.current.editor=null;setEditor(null);if(!e.text.trim()&&!e.id)return;
        setFontSize(e.fontSize||16);setTextColor(e.textColor||textColor);
        if(e.id)await commit([{type:'setText',id:e.id,text:e.text},{type:'update',id:e.id,patch:{fontSize:e.fontSize||undefined,textColor:e.textColor||undefined}}]);
        else {const id=uid();if(await commit([{type:'create',element:{id,kind:e.kind==='note'?'note':'text',rect:e.rect,text:e.text,stroke:color,fill:e.kind==='note'?noteFill:'none',fontSize:e.fontSize||16,textColor:e.textColor||undefined}}]))setSelection([id]);}};
      const copySelection=()=>{if(!doc||!selection.length)return;const all=descendants(roots(selection));clipboard.current=JSON.parse(JSON.stringify(doc.elements.filter(e=>all.has(e.id))));};
      const rotateBy=deg=>{const source=live.current.doc||doc;if(!source||!selection.length||busy)return;const ids=roots(selection);
        commit(ids.map(id=>{const cur=source.elements.find(x=>x.id===id);const next=(((Number(cur?.rotation)||0)+deg)%360+360)%360;return {type:'update',id,patch:{rotation:next}};}));};
      const action=(type,extra={})=>{if(!doc)return;if(type==='copy'){copySelection();return;}if(type==='paste'){if(clipboard.current)commit([{type:'paste',elements:clipboard.current}]);return;}if(['undo','redo'].includes(type)){commit([{type}]);return;}if(!selection.length)return;const ids=roots(selection);if(type==='group'){const id=uid();commit([{type,ids,groupId:id}]).then(r=>r&&setSelection([id]));return;}if(type==='ungroup'){commit(ids.filter(id=>doc.elements.find(e=>e.id===id)?.kind==='group').map(id=>({type,id})));return;}commit([{type,ids,...extra}]);};
      const cancel=()=>{live.current.gesture=null;live.current.editor=null;setEditor(null);setConsult(null);paintRef.current&&paintRef.current();};
      const keyDown=e=>{if(!doc||['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;const mod=e.ctrlKey||e.metaKey,k=e.key.toLowerCase();if(e.code==='Space'){space.current=true;e.preventDefault();return;}if(k==='escape'){setRotateMode(false);cancel();return;}if(mod&&k==='z'){e.preventDefault();action(e.shiftKey?'redo':'undo');return;}if(mod&&k==='y'){e.preventDefault();action('redo');return;}if(mod&&k==='a'){e.preventDefault();setSelection(doc.elements.filter(e=>!e.parent).map(e=>e.id));return;}if(mod&&['c','v','d','g'].includes(k)){e.preventDefault();action(k==='c'?'copy':k==='v'?'paste':k==='d'?'duplicate':e.shiftKey?'ungroup':'group');return;}if(k==='delete'||k==='backspace'){e.preventDefault();action('delete');return;}if(['arrowleft','arrowright','arrowup','arrowdown'].includes(k)){e.preventDefault();const n=e.shiftKey?10:1;action('move',{dx:k==='arrowleft'?-n:k==='arrowright'?n:0,dy:k==='arrowup'?-n:k==='arrowdown'?n:0});return;}if(k==='['||k===']'){action('reorder',{position:k==='['?'back':'front'});return;}const shortcuts={v:'select',h:'pan',p:'pen',e:'erase',t:'text',r:'rect',o:'ellipse',a:'arrow',n:'note',l:'lasso'};if(shortcuts[k]&&!mod)chooseTool(shortcuts[k]);};
      useEffect(()=>{const release=()=>{space.current=false;};window.addEventListener('keyup',release);window.addEventListener('blur',release);return()=>{window.removeEventListener('keyup',release);window.removeEventListener('blur',release);};},[]);
      const pointerDown=e=>{if(!doc||e.button>1)return;
        // Clicking anywhere outside the text box commits what was typed instead of dropping it.
        if(live.current.editor){saveEditor();return;}
        root.current.focus();const p=world(e);e.currentTarget.setPointerCapture(e.pointerId);let g;
        // A handle always wins, whatever tool is active; otherwise drawing a stroke right after selecting looked like "no response".
        const rotating=e.target.getAttribute('data-rotate'),handle=e.target.getAttribute('data-resize');
        // Rotate mode: any drag rotates the selection, so consecutive rotations never depend on the small handle.
        if(rotateMode&&selectionBounds){const c=[selectionBounds[0]+selectionBounds[2]/2,selectionBounds[1]+selectionBounds[3]/2];
          g={kind:'rotate',center:c,ids:roots(selection),start:Math.atan2(p[1]-c[1],p[0]-c[0]),angle:0};}
        else if(rotating&&selectionBounds){const c=[selectionBounds[0]+selectionBounds[2]/2,selectionBounds[1]+selectionBounds[3]/2];
          g={kind:'rotate',center:c,ids:roots(selection),start:Math.atan2(p[1]-c[1],p[0]-c[0]),angle:0};}
        else if(handle&&selectionBounds)g={kind:'resize',handle,start:p,end:p,rect:selectionBounds,ids:roots(selection)};
        // Alt-drag on a selected shape rotates too, so rotation never depends on hitting the small handle.
        else if(e.altKey&&selectionBounds&&pick(p)){const c=[selectionBounds[0]+selectionBounds[2]/2,selectionBounds[1]+selectionBounds[3]/2];
          g={kind:'rotate',center:c,ids:roots(selection),start:Math.atan2(p[1]-c[1],p[0]-c[0]),angle:0};}
        else if(space.current||e.button===1||tool==='pan')g={kind:'pan',start:[e.clientX,e.clientY],original:view};
        else if(tool==='erase')g={kind:'erase',points:[p]};else if(tool==='pen'||tool==='lasso')g={kind:tool,points:[p]};
        else if(['rect','ellipse','arrow','semi'].includes(tool))g={kind:tool,start:p,end:p};
        else if(tool==='text'||tool==='note'){beginEditor(null,p);return;}
        else {const hit=pick(p);if(hit){let ids=selection.includes(hit.id)?selection:e.shiftKey?[...selection,hit.id]:[hit.id];if(e.shiftKey&&selection.includes(hit.id)){ids=selection.filter(id=>id!==hit.id);setSelection(ids);return;}setSelection(ids);g={kind:'move',start:p,end:p,ids:roots(ids)};}else{if(!e.shiftKey){setSelection([]);setRotateMode(false);}g={kind:'box',start:p,end:p,add:e.shiftKey?selection:[]};}}
        live.current.gesture=g;if(handleLayer.current)handleLayer.current.style.opacity='0';queuePaint();};
      const pointerMove=e=>{const g=live.current.gesture;if(!g){if(live.current.tool==='erase'){hoverRef.current=world(e);queuePaint();}return;}let next;if(g.kind==='pan'){autoFit.current=false;live.current.view={...g.original,x:g.original.x+e.clientX-g.start[0],y:g.original.y+e.clientY-g.start[1]};queuePaint();syncView();return;}const p=world(e);if(g.kind==='rotate'){const a=Math.atan2(p[1]-g.center[1],p[0]-g.center[0]);let d=(a-g.start)*180/Math.PI;if(e.shiftKey)d=Math.round(d/15)*15;live.current.gesture={...g,angle:d};queuePaint();return;}if(g.points){const last=g.points[g.points.length-1];if(Math.hypot(p[0]-last[0],p[1]-last[1])<1.5/view.z||g.points.length>=1500)return;next={...g,points:[...g.points,p]};}else next={...g,end:p};live.current.gesture=next;queuePaint();};
      // Whole-stroke eraser: any element the eraser trail touches is removed in one operation.
      const eraserHits=pts=>{const pad=radius/view.z,ids=new Set();
        for(const e of doc.elements){if(e.kind==='group')continue;const r=e.rect;let near=false;
          for(const p of pts){if(p[0]<r[0]-pad||p[0]>r[0]+r[2]+pad||p[1]<r[1]-pad||p[1]>r[1]+r[3]+pad)continue;
            if(e.kind==='path'&&e.points?.length){
              for(let i=0;i<e.points.length&&!near;i++){
                const a=[e.points[i][0]+r[0],e.points[i][1]+r[1]],nb=e.points[Math.min(i+1,e.points.length-1)],b=[nb[0]+r[0],nb[1]+r[1]];
                const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy,k=l?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l)):0;
                if(Math.hypot(p[0]-a[0]-k*dx,p[1]-a[1]-k*dy)<=pad+(e.strokeWidth||2)/2)near=true;}
            } else near=true;
            if(near)break;}
          if(near)ids.add(e.id);}
        return roots([...ids]);};
      const pointerUp=async e=>{const g=live.current.gesture;if(!g)return;dropQueuedGesture();live.current.gesture=null;if(handleLayer.current)handleLayer.current.style.opacity='';queuePaint();if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);if(g.kind==='pan'){setView(live.current.view);return;}
        if(g.kind==='erase'){if(eraseWhole){const ids=eraserHits(g.points);if(ids.length)await commit([{type:'delete',ids}]);return;}await commit([{type:'erasePath',points:g.points,radius:radius/view.z}]);return;}
        if(g.kind==='move'){const dx=g.end[0]-g.start[0],dy=g.end[1]-g.start[1];if(dx||dy)await commit([{type:'move',ids:g.ids,dx,dy}]);return;}
        if(g.kind==='rotate'){if(Math.abs(g.angle)>0.05){const liveDoc=live.current.doc||doc;const ops=g.ids.map(id=>{const cur=liveDoc.elements.find(x=>x.id===id);const next=(((Number(cur?.rotation)||0)+g.angle)%360+360)%360;return {type:'update',id,patch:{rotation:Math.round(next*10)/10}};});await commit(ops);}return;}
        if(g.kind==='resize'){const r=g.rect,n=resizeRect(r,g.handle,g.start,g.end);const min=8/view.z;
          if(n[2]<min){n[2]=min;if(g.handle.includes('w'))n[0]=r[0]+r[2]-min;}
          if(n[3]<min){n[3]=min;if(g.handle.includes('n'))n[1]=r[1]+r[3]-min;}
          const sx=n[2]/(r[2]||1),sy=n[3]/(r[3]||1);await commit(g.ids.map(id=>{const old=doc.elements.find(e=>e.id===id).rect;return{type:'resize',id,rect:[n[0]+(old[0]-r[0])*sx,n[1]+(old[1]-r[1])*sy,Math.max(min,old[2]*sx),Math.max(min,old[3]*sy)]};}));return;}
        if(g.kind==='box'||g.kind==='lasso'){const r=g.kind==='box'?normalize(g.start,g.end):bounds(g.points.map(p=>({rect:[...p,0,0]})));const pointInPoly=p=>{let inside=false;for(let i=0,j=g.points.length-1;i<g.points.length;j=i++){const a=g.points[i],b=g.points[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;};const ids=doc.elements.filter(e=>!e.parent&&(g.kind==='lasso'?pointInPoly([e.rect[0]+e.rect[2]/2,e.rect[1]+e.rect[3]/2]):inside([e.rect[0],e.rect[1]],r)&&inside([e.rect[0]+e.rect[2],e.rect[1]+e.rect[3]],r))).map(e=>e.id);setSelection([...new Set([...(g.add||[]),...ids])]);if(g.kind==='lasso'&&ids.length)setConsult({ids});return;}
        if(g.kind==='pen'&&g.points.length<2)return;
        const id=uid();let element;
        if(g.kind==='pen'){const r=bounds(g.points.map(p=>({rect:[...p,0,0]})));element={id,kind:'path',rect:r,points:g.points.map(p=>[p[0]-r[0],p[1]-r[1]]),stroke:color,strokeWidth:width,fill:'none',pen:penKind};}
        else{const r=normalize(g.start,g.end);if(r[2]<2&&r[3]<2)return;element={id,kind:g.kind,rect:r,stroke:color,strokeWidth:width,fill:fillOn&&(g.kind==='rect'||g.kind==='ellipse'||g.kind==='semi')?fillColor:'none'};
          if(g.kind==='arrow')element.points=[g.start.map((v,i)=>v-r[i]),g.end.map((v,i)=>v-r[i])];
          // Semicircle draws like the other shapes: drag a box, the half disc fills its upper half.
          if(g.kind==='semi'){const cx=r[0]+r[2]/2,cy=r[1]+r[3],rx=r[2]/2,ry=r[3],pts=[];
            for(let i=0;i<=32;i++){const a=Math.PI+Math.PI*i/32;pts.push([cx+rx*Math.cos(a)-r[0],cy+ry*Math.sin(a)-r[1]]);}
            element={id,kind:'path',rect:r,points:pts,stroke:color,strokeWidth:width,fill:fillOn?fillColor:'none'};}
        }
        if(await commit([{type:'create',element}])){setSelection([id]);let closed=false;if(g.kind==='pen'&&g.points.length>12){const r=element.rect,a=g.points[0],b=g.points[g.points.length-1];closed=r[2]>24&&r[3]>24&&Math.hypot(a[0]-b[0],a[1]-b[1])<Math.max(r[2],r[3])*.28;}if(g.kind==='ellipse'||closed){const r=element.rect,ids=doc.elements.filter(e=>!e.parent&&inside([e.rect[0]+e.rect[2]/2,e.rect[1]+e.rect[3]/2],r)).map(e=>e.id);setConsult({id,ids});}}};
      const zoom=(factor,anchor)=>{autoFit.current=false;const v=live.current.view,z=Math.max(.08,Math.min(8,v.z*factor)),a=anchor||[svg.current.clientWidth/2,svg.current.clientHeight/2];live.current.view={x:a[0]-(a[0]-v.x)*z/v.z,y:a[1]-(a[1]-v.y)*z/v.z,z};queuePaint();syncView();};
      // Fit keeps the drawing inside whichever column renders it, including the narrow right Sidebar.
      const fit=()=>{if(!doc||!svg.current)return;const r=bounds(doc.elements.filter(e=>e.kind!=='group'));const w=svg.current.clientWidth,hh=svg.current.clientHeight;if(!w||!hh)return;if(!r){setView({x:Math.max(20,w/2-100),y:Math.max(20,hh/2-100),z:1});return;}const pad=Math.min(60,Math.max(14,w*.07));const z=Math.min(2,Math.max(.08,Math.min((w-pad*2)/(r[2]||1),(hh-pad*2)/(r[3]||1))));setView({x:w/2-(r[0]+r[2]/2)*z,y:hh/2-(r[1]+r[3]/2)*z,z});};
      fitRef.current=fit;
      const visualRect=e=>rectWith(e,live.current.gesture);
      const cursorOf=d=>d==='nw'||d==='se'?'nwse-resize':d==='ne'||d==='sw'?'nesw-resize':d==='n'||d==='s'?'ns-resize':'ew-resize';
      // Canvas 2D scene: one bitmap repaint per frame instead of rebuilding an SVG tree on every render.
      // The scene is drawn straight from live refs, so a drag never re-renders React; paint runs once per frame.
      const rectWith=(e,g)=>{if(!g||!['move','resize'].includes(g.kind))return e.rect;const all=descendants(g.ids);if(!all.has(e.id))return e.rect;
        if(g.kind==='move')return[e.rect[0]+g.end[0]-g.start[0],e.rect[1]+g.end[1]-g.start[1],...e.rect.slice(2)];
        const r=g.rect,n=resizeRect(r,g.handle,g.start,g.end),min=8/(live.current.view?.z||1);
        if(n[2]<min)n[2]=min;if(n[3]<min)n[3]=min;
        const sx=n[2]/(r[2]||1),sy=n[3]/(r[3]||1);
        return[n[0]+(e.rect[0]-r[0])*sx,n[1]+(e.rect[1]-r[1])*sy,Math.max(min,e.rect[2]*sx),Math.max(min,e.rect[3]*sy)];};
      // One stroke geometry for every pen style: the fountain pen narrows with pointer speed like natural ink.
      const strokePath=(ctx,pts,width,pen,color)=>{if(!pts||!pts.length)return;const w=Math.max(.5,Number(width)||2);
        if(pts.length===1){ctx.fillStyle=color;ctx.beginPath();ctx.arc(pts[0][0],pts[0][1],Math.max(.6,w/2),0,Math.PI*2);ctx.fill();return;}
        const pk=pen||'plain';
        if(pk==='fountain'){const half=i=>{const a=pts[Math.max(0,i-1)],b=pts[i],c=pts[Math.min(pts.length-1,i+1)];
            const seg=i?Math.hypot(b[0]-a[0],b[1]-a[1]):Math.hypot(c[0]-b[0],c[1]-b[1]);
            return Math.max(.4,w*Math.max(.28,Math.min(1.25,1.18-seg/18)))/2;};
          const L=[],R=[];for(let i=0;i<pts.length;i++){const a=pts[Math.max(0,i-1)],b=pts[i],c=pts[Math.min(pts.length-1,i+1)];
            const dx=c[0]-a[0],dy=c[1]-a[1],len=Math.hypot(dx,dy)||1,h=half(i),nx=-dy/len,ny=dx/len;
            L.push([b[0]+nx*h,b[1]+ny*h]);R.push([b[0]-nx*h,b[1]-ny*h]);}
          ctx.beginPath();L.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]));
          for(let i=R.length-1;i>=0;i--)ctx.lineTo(R[i][0],R[i][1]);
          ctx.closePath();ctx.fillStyle=color;ctx.fill();return;}
        ctx.strokeStyle=color;ctx.lineJoin='round';ctx.lineCap='round';ctx.setLineDash([]);
        if(pk==='pencil'){ctx.globalAlpha=.72;ctx.lineWidth=Math.max(.6,w*.85);
          ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.stroke();
          for(let i=0;i<pts.length;i++){const r=(i*9301+49297)%233280/233280,jr=((i*233280+49297)%9301)/9301;
            if(r<.45)continue;const p=pts[i],ang=(i*2.39996)%(Math.PI*2),dist=(.4+jr)*w*.6;
            ctx.globalAlpha=.16+.26*jr;ctx.fillStyle=color;ctx.beginPath();
            ctx.arc(p[0]+Math.cos(ang)*dist,p[1]+Math.sin(ang)*dist,Math.max(.3,w*.12*(.5+jr)),0,Math.PI*2);ctx.fill();}
          ctx.globalAlpha=1;return;}
        if(pk==='marker'){ctx.globalAlpha=.5;ctx.lineWidth=w*1.9;}
        else if(pk==='watercolor'){ctx.globalAlpha=.3;ctx.lineWidth=w*2.1;ctx.shadowBlur=Math.max(4,w*1.6);ctx.shadowColor=color;}
        else{ctx.lineWidth=w;}
        ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.stroke();
        ctx.globalAlpha=1;ctx.shadowBlur=0;};
      const drawEl=(ctx,e,st,ink)=>{if(e.kind==='group')return;const r=rectWith(e,st.gesture),or=e.rect,stroke=typeof e.stroke==='string'?e.stroke:st.color;
        const rot=((Number(e.rotation)||0)+((st.gesture?.kind==='rotate'&&st.gesture.ids?.includes(e.id))?st.gesture.angle:0))*Math.PI/180;
        if(rot){const cx=r[0]+r[2]/2,cy=r[1]+r[3]/2;ctx.save();ctx.translate(cx,cy);ctx.rotate(rot);ctx.translate(-cx,-cy);}
        ctx.strokeStyle=stroke;ctx.lineWidth=e.strokeWidth||2;ctx.lineJoin='round';ctx.lineCap='round';ctx.setLineDash([]);
        if(e.kind==='path'){if(!e.points?.length)return;
          const pts=e.points.map(p=>[r[0]+p[0]*(or[2]?r[2]/or[2]:1),r[1]+p[1]*(or[3]?r[3]/or[3]:1)]);
          if(e.fill&&e.fill!=='none'){ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.fillStyle=e.fill;ctx.fill();}
          strokePath(ctx,pts,e.strokeWidth||2,e.pen||'plain',stroke);}
        else if(e.kind==='ellipse'||e.kind==='circle'){ctx.beginPath();ctx.ellipse(r[0]+r[2]/2,r[1]+r[3]/2,Math.max(.5,r[2]/2),Math.max(.5,r[3]/2),0,0,Math.PI*2);if(e.fill&&e.fill!=='none'){ctx.fillStyle=e.fill;ctx.fill();}ctx.stroke();}
        else if(e.kind==='arrow'){const p=e.points||[[0,0],[or[2],or[3]]],pts=p.map(q=>[r[0]+q[0]*(or[2]?r[2]/or[2]:1),r[1]+q[1]*(or[3]?r[3]/or[3]:1)]);
          ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);ctx.lineTo(pts[1][0],pts[1][1]);ctx.stroke();
          const a=Math.atan2(pts[1][1]-pts[0][1],pts[1][0]-pts[0][0]),len=9;
          ctx.beginPath();ctx.moveTo(pts[1][0],pts[1][1]);ctx.lineTo(pts[1][0]-len*Math.cos(a-Math.PI/7),pts[1][1]-len*Math.sin(a-Math.PI/7));
          ctx.moveTo(pts[1][0],pts[1][1]);ctx.lineTo(pts[1][0]-len*Math.cos(a+Math.PI/7),pts[1][1]-len*Math.sin(a+Math.PI/7));ctx.stroke();}
        else{const rx=Math.max(0,Math.min(Number(e.rx)||0,Math.min(r[2],r[3])/2));
          const rr=()=>{ctx.beginPath();if(rx>0&&ctx.roundRect)ctx.roundRect(r[0],r[1],r[2],r[3],rx);else if(rx>0){const [x,y,w2,h2]=[r[0],r[1],r[2],r[3]];ctx.moveTo(x+rx,y);ctx.lineTo(x+w2-rx,y);ctx.quadraticCurveTo(x+w2,y,x+w2,y+rx);ctx.lineTo(x+w2,y+h2-rx);ctx.quadraticCurveTo(x+w2,y+h2,x+w2-rx,y+h2);ctx.lineTo(x+rx,y+h2);ctx.quadraticCurveTo(x,y+h2,x,y+h2-rx);ctx.lineTo(x,y+rx);ctx.quadraticCurveTo(x,y,x+rx,y);ctx.closePath();}else ctx.rect(r[0],r[1],r[2],r[3]);};
          if(e.fill&&e.fill!=='none'){ctx.fillStyle=e.fill;rr();ctx.fill();}else if(e.kind==='note'){ctx.fillStyle='#f4e9ac';rr();ctx.fill();}
          if(e.kind!=='text'){rr();ctx.stroke();}}
        // Text lives on any element (double-clicking a shape writes into that shape's text), so draw it for every kind.
        if(e.text){const fs=Number(e.fontSize)||16,lh=fs*1.32;
          ctx.fillStyle=typeof e.textColor==='string'&&e.textColor?e.textColor:(e.kind==='note'?'#363b2d':ink);
          ctx.font=`${fs}px system-ui,sans-serif`;ctx.textBaseline='top';
          String(e.text).split('\n').slice(0,100).forEach((s,i)=>ctx.fillText(s,r[0]+10,r[1]+10+i*lh));}
        if(rot)ctx.restore();};
      // Groups rotate their children around the group centre; leaves rotate themselves inside drawEl.
      const drawScene=(ctx,doc2,st,ink)=>{const kids=id=>(doc2.elements||[]).filter(x=>x.parent===id);
        const walk=e=>{if(e.kind!=='group'){drawEl(ctx,e,st,ink);return;}
          const r=rectWith(e,st.gesture),rot=((Number(e.rotation)||0)+((st.gesture?.kind==='rotate'&&st.gesture.ids?.includes(e.id))?st.gesture.angle:0))*Math.PI/180;
          ctx.save();if(rot){const cx=r[0]+r[2]/2,cy=r[1]+r[3]/2;ctx.translate(cx,cy);ctx.rotate(rot);ctx.translate(-cx,-cy);}
          for(const c of kids(e.id))walk(c);ctx.restore();};
        for(const e of (doc2.elements||[]).filter(x=>!x.parent))walk(e);};
      const drawPreview=(ctx,st)=>{const g=st.gesture;if(!g)return;const v=st.view;
        if(g.points){
          if(g.kind==='erase'){ctx.beginPath();g.points.forEach((p,i)=>{if(i)ctx.lineTo(p[0],p[1]);else ctx.moveTo(p[0],p[1]);});ctx.strokeStyle='rgba(175,59,59,.28)';ctx.lineWidth=st.radius*2;ctx.setLineDash([]);ctx.stroke();return;}
          if(g.kind==='pen'){strokePath(ctx,g.points,st.width,st.penKind||'plain',st.color);return;}
          ctx.beginPath();g.points.forEach((p,i)=>{if(i)ctx.lineTo(p[0],p[1]);else ctx.moveTo(p[0],p[1]);});ctx.strokeStyle=st.color;ctx.lineWidth=1/v.z;ctx.setLineDash([4/v.z,4/v.z]);ctx.stroke();ctx.setLineDash([]);return;}
        if(['rect','ellipse','arrow','box','semi'].includes(g.kind)){const r=normalize(g.start,g.end);
          ctx.strokeStyle=g.kind==='box'?'#356c59':st.color;ctx.lineWidth=st.width;ctx.setLineDash(g.kind==='box'?[5,4]:[]);
          if(g.kind==='ellipse'){ctx.beginPath();ctx.ellipse(r[0]+r[2]/2,r[1]+r[3]/2,Math.max(.5,r[2]/2),Math.max(.5,r[3]/2),0,0,Math.PI*2);ctx.stroke();}
          else if(g.kind==='semi'){ctx.beginPath();ctx.ellipse(r[0]+r[2]/2,r[1]+r[3],Math.max(.5,r[2]/2),Math.max(.5,r[3]),0,Math.PI,Math.PI*2);ctx.stroke();}
          else if(g.kind==='arrow'){ctx.beginPath();ctx.moveTo(g.start[0],g.start[1]);ctx.lineTo(g.end[0],g.end[1]);ctx.stroke();}
          else ctx.strokeRect(r[0],r[1],r[2],r[3]);ctx.setLineDash([]);}};
      const paint=()=>{const cv=svg.current;if(!cv||typeof cv.getContext!=='function')return;const ctx=cv.getContext('2d');if(!ctx)return;const st=live.current;
        const dpr=globalThis.devicePixelRatio||1,w=cv.clientWidth||1,h2=cv.clientHeight||1;
        if(cv.width!==Math.round(w*dpr)||cv.height!==Math.round(h2*dpr)){cv.width=Math.round(w*dpr);cv.height=Math.round(h2*dpr);}
        let bg='#f5f5f2',line='#d9ded9',ink='#26382d';
        if(typeof getComputedStyle==='function'){const css=getComputedStyle(cv);bg=css.getPropertyValue('--ic-bg').trim()||bg;line=css.getPropertyValue('--ic-line').trim()||line;ink=css.getPropertyValue('--dsw-alias-label-primary').trim()||ink;}
        ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h2);ctx.fillStyle=bg;ctx.fillRect(0,0,w,h2);
        const v=st.view;
        if(st.grid){const step=24*v.z,r=Math.max(.9,Math.min(1.7,step*.06));
          ctx.save();ctx.globalAlpha=.22;ctx.fillStyle=ink;
          for(let x=v.x%step;x<w;x+=step)for(let y=v.y%step;y<h2;y+=step){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
          ctx.restore();}
        ctx.save();ctx.translate(v.x,v.y);ctx.scale(v.z,v.z);
        drawScene(ctx,st.doc||{elements:[]},st,ink);
        drawPreview(ctx,st);
        const sel=st.selection||[];
        if(sel.length){const chosen=(st.doc?.elements||[]).filter(e=>sel.includes(e.id));
          if(chosen.length){const r=bounds(chosen.map(e=>({...e,rect:rectWith(e,st.gesture)})));ctx.strokeStyle='#356c59';ctx.lineWidth=1/v.z;ctx.setLineDash([]);
            const ang=chosen.length===1?(Number(chosen[0].rotation)||0)*Math.PI/180:0;
            if(ang){const box=[r[0]-4/v.z,r[1]-4/v.z,r[2]+8/v.z,r[3]+8/v.z],c=[box[0]+box[2]/2,box[1]+box[3]/2];
              const cs=[[box[0],box[1]],[box[0]+box[2],box[1]],[box[0]+box[2],box[1]+box[3]],[box[0],box[1]+box[3]]].map(p=>rotPoint(p,c,ang));
              ctx.beginPath();cs.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.stroke();}
            else ctx.strokeRect(r[0]-4/v.z,r[1]-4/v.z,r[2]+8/v.z,r[3]+8/v.z);}}
        // Eraser pointer: the native cursor is hidden while erasing, so the tool draws its own glyph and radius.
        const hv=hoverRef.current;
        if(st.tool==='erase'&&hv&&!st.gesture){const rr=st.radius/v.z;
          ctx.beginPath();ctx.arc(hv[0],hv[1],rr,0,Math.PI*2);
          ctx.fillStyle='rgba(53,108,89,.10)';ctx.fill();
          ctx.strokeStyle='rgba(53,108,89,.7)';ctx.lineWidth=1/v.z;ctx.setLineDash([4/v.z,3/v.z]);ctx.stroke();ctx.setLineDash([]);
          ctx.save();ctx.translate(hv[0],hv[1]);ctx.rotate(-Math.PI/4);
          const ew=15/v.z,eh=9/v.z;ctx.fillStyle='#356c59';
          ctx.beginPath();if(ctx.roundRect)ctx.roundRect(-ew/2,-eh/2,ew,eh,2.5/v.z);else ctx.rect(-ew/2,-eh/2,ew,eh);ctx.fill();
          ctx.fillStyle='rgba(255,255,255,.9)';ctx.fillRect(-ew/2+0.5/v.z,-eh/2+0.5/v.z,ew*0.32,eh-1/v.z);
          ctx.restore();}
        ctx.restore();
        // Number badges: a translucent ordinal at each element's top-left corner, so a conversation can say "图元 3".
        const leaves=st.badges===false?[]:(st.doc?.elements||[]).filter(e=>e.kind!=='group');
        if(leaves.length){ctx.save();ctx.font='600 10px system-ui,sans-serif';ctx.textBaseline='middle';ctx.textAlign='left';
          const sel=st.selection||[];
          for(let i=0;i<leaves.length;i++){const e=leaves[i],r=rectWith(e,st.gesture),label=String(i+1);
            const sx=Math.round(r[0]*v.z+v.x),sy=Math.round(r[1]*v.z+v.y),bw=6+label.length*6,bh=14;
            // Free strokes have empty bbox corners, so the badge follows the real topmost point instead.
            let ax=sx+bw/2,ay=sy;
            if(e.kind==='path'&&e.points?.length){const ox=e.rect,sxr=ox[2]?r[2]/ox[2]:1,syr=ox[3]?r[3]/ox[3]:1;
              let top=null;for(const p of e.points){const px=(r[0]+p[0]*sxr)*v.z+v.x,py=(r[1]+p[1]*syr)*v.z+v.y;if(!top||py<top[1]-0.5||(Math.abs(py-top[1])<=0.5&&px<top[0]))top=[px,py];}
              if(top){ax=top[0];ay=top[1];}}
            const bx=Math.max(2,Math.min(w-bw-2,Math.round(ax-bw/2))),by=Math.max(2,Math.round(ay-bh-3));
            ctx.fillStyle=sel.includes(e.id)?'rgba(207,122,63,.9)':'rgba(53,108,89,.52)';
            ctx.beginPath();if(ctx.roundRect)ctx.roundRect(bx,by,bw,bh,4);else ctx.rect(bx,by,bw,bh);ctx.fill();
            ctx.fillStyle='rgba(255,255,255,.95)';ctx.fillText(label,bx+3,by+bh/2+1);}
          ctx.restore();}
        if(!(st.doc?.elements||[]).length&&!st.gesture){
          ctx.textAlign='center';ctx.textBaseline='middle';
          ctx.fillStyle=ink;ctx.font='600 22px system-ui,sans-serif';ctx.fillText(t('Draw a thought.'),w/2,h2/2-14,Math.max(80,w-40));
          ctx.fillStyle=line;ctx.font='13px system-ui,sans-serif';ctx.fillText(t('Use the pen, add a note, or select a shape. AI and human edits share this document.'),w/2,h2/2+18,Math.max(80,w-40));
          ctx.textAlign='start';ctx.textBaseline='alphabetic';}};
      paintRef.current=paint;
      useEffect(()=>{paint();});
      const button=(label,onClick,props={})=>{const {icon,...rest}=props;return h('button',{type:'button',onClick,title:t(label),'aria-label':t(label),...rest},icon||t(label));};
      const consultChoice=async choice=>{const c=consult;if(!c)return;if(choice==='ignore'){setConsult(null);return;}let ops;if(choice==='card'&&c.id)ops=[{type:'promote',id:c.id,to:'card',approved:true}];else if(choice==='group'&&c.ids.length>1)ops=[{type:'group',ids:c.ids,groupId:uid()}];else return;if(await commit(ops))setConsult(null);};
      const selBox=selectionBounds?bounds(selected.map(e=>({...e,rect:visualRect(e)}))):null;
      // Handles follow the element's own rotation, plus a rotate handle above the top edge.
      const selAngle=selBox&&selected.length===1?(Number(selected[0].rotation)||0)*Math.PI/180:0;
      const selC=selBox?[selBox[0]+selBox[2]/2,selBox[1]+selBox[3]/2]:null;
      // The rotate handle anchors to the axis-aligned box of the rotated shape, so it stays above the shape.
      const rotBox=selBox&&selAngle?(()=>{const cs=[[selBox[0],selBox[1]],[selBox[0]+selBox[2],selBox[1]],[selBox[0]+selBox[2],selBox[1]+selBox[3]],[selBox[0],selBox[1]+selBox[3]]].map(p=>rotPoint(p,selC,selAngle));
        const xs=cs.map(p=>p[0]),ys=cs.map(p=>p[1]),x0=Math.min(...xs),y0=Math.min(...ys);
        return [x0,y0,Math.max(...xs)-x0,Math.max(...ys)-y0];})():selBox;
      const handleList=selBox?[
        ...[['nw',0,0],['n',.5,0],['ne',1,0],['e',1,.5],['se',1,1],['s',.5,1],['sw',0,1],['w',0,.5]].map(([hd,fx,fy])=>({hd,x:selBox[0]+selBox[2]*fx,y:selBox[1]+selBox[3]*fy})),
        {hd:'rotate',x:rotBox[0]+rotBox[2]/2,y:Math.max(rotBox[1]-22/view.z,(6-view.y)/view.z)}].map(h=>{if(!selAngle||h.hd==='rotate')return h;const p=rotPoint([h.x,h.y],selC,selAngle);return {hd:h.hd,x:p[0],y:p[1]};}):[];
      const tools={select:'Select',pan:'Pan',pen:'Pen',erase:'Erase',text:'Text',rect:'Rectangle',ellipse:'Ellipse',arrow:'Arrow',note:'Note',lasso:'Lasso',semi:'Semicircle'};
      const primaryTools=['select','pan','pen','erase','text'],extraTools=['rect','ellipse','arrow','note','lasso','semi'];
      const toolButton=(k,extra)=>button(tools[k],()=>chooseTool(k),{key:k,'aria-pressed':tool===k,className:extra?'ic-tool-extra':undefined,icon:h(ToolIcon,{kind:k,size:20}),onMouseEnter:hover(k,tools[k]),onFocus:hover(k,tools[k]),onBlur:()=>setTip(null)});
      // Export the content bounding box as a 2x PNG without touching the document.
      const exportPng=(clear=false)=>{const st=live.current,d=st.doc;if(!d||typeof document==='undefined')return;
        const roots=(d.elements||[]).filter(e=>e.kind!=='group');if(!roots.length)return;
        const b=bounds(roots.map(e=>({rect:e.rect})));const pad=24,scale=2;
        const w=Math.max(1,Math.ceil((b[2]+pad*2)*scale)),hh=Math.max(1,Math.ceil((b[3]+pad*2)*scale));
        const cv=document.createElement('canvas');cv.width=w;cv.height=hh;const ctx=cv.getContext('2d');if(!ctx)return;
        if(!clear){ctx.fillStyle='#ffffff';ctx.fillRect(0,0,w,hh);}
        ctx.scale(scale,scale);ctx.translate(pad-b[0],pad-b[1]);
        const shot={doc:d,gesture:null,view:{x:0,y:0,z:1},color:st.color,width:st.width,radius:st.radius,grid:false,selection:[]};
        drawScene(ctx,d,shot,'#26382d');
        const a=document.createElement('a');a.href=cv.toDataURL('image/png');a.download=`${d.id}-v${d.version}${clear?'-clear':''}.png`;a.click();};
      // Render a subset to a PNG blob so a copy can be pasted into other whiteboards as an image.
      const renderBlob=(els,scale=2)=>new Promise((resolve,reject)=>{
        if(typeof document==='undefined')return reject(new Error(t('No document')));
        const roots=els.filter(e=>e.kind!=='group');if(!roots.length)return reject(new Error(t('Nothing to copy')));
        const b=bounds(roots.map(e=>({rect:e.rect}))),pad=24;
        const cv=document.createElement('canvas');cv.width=Math.max(1,Math.ceil((b[2]+pad*2)*scale));cv.height=Math.max(1,Math.ceil((b[3]+pad*2)*scale));
        const c2=cv.getContext('2d');if(!c2)return reject(new Error(t('Canvas unavailable')));
        c2.fillStyle='#ffffff';c2.fillRect(0,0,cv.width,cv.height);c2.scale(scale,scale);c2.translate(pad-b[0],pad-b[1]);
        const shot={doc:{elements:els},gesture:null,view:{x:0,y:0,z:1},color,width,radius,grid:false,selection:[]};
        drawScene(c2,{elements:els},shot,'#26382d');
        cv.toBlob(blob=>blob?resolve(blob):reject(new Error(t('PNG encode failed'))),'image/png');});
      const copyToSystem=async els=>{try{
          if(!els.length)return;
          const payload=JSON.stringify({intentCanvas:1,elements:els});
          const png=await renderBlob(els,2);
          if(globalThis.ClipboardItem&&navigator.clipboard?.write)await navigator.clipboard.write([new ClipboardItem({'image/png':png,'text/plain':new Blob([payload],{type:'text/plain'})})]);
          else if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(payload);
          else throw new Error(t('Clipboard unavailable'));
          toast.push(t('Copied — paste it in any board'));
        }catch(e){report(e);}};
      const pasteAt=async(wx,wy)=>{try{
          if(!navigator.clipboard?.read)throw new Error(t('Clipboard read unavailable'));
          let payload=null,sawImage=false;
          for(const item of await navigator.clipboard.read()){
            if(item.types.some(k=>k.startsWith('image/')))sawImage=true;
            if(item.types.includes('text/plain')){
              try{const parsed=JSON.parse(await (await item.getType('text/plain')).text());if(parsed&&parsed.intentCanvas===1&&Array.isArray(parsed.elements))payload=parsed;}catch(e){}
            }
          }
          if(!payload){toast.push(sawImage?(t('Images cannot be pasted yet')):(t('Clipboard has no canvas content')));return;}
          const roots=payload.elements.filter(e=>e.kind!=='group');if(!roots.length)return;
          const b=bounds(roots.map(e=>({rect:e.rect})));
          if(await commit([{type:'paste',elements:payload.elements,dx:wx-b[0],dy:wy-b[1]}]))toast.push(t('Pasted into the canvas'));
        }catch(e){report(e);}};
      const openMenu=e=>{e.preventDefault();if(!doc)return;const r=svg.current.getBoundingClientRect();
        const lx=e.clientX-r.left,ly=e.clientY-r.top;setMenu({x:lx,y:ly,wx:(lx-view.x)/view.z,wy:(ly-view.y)/view.z});};
      useEffect(()=>{if(!menu)return;const close=ev=>{if(!ev.target?.closest?.('.ic-ctx'))setMenu(null);};window.addEventListener('pointerdown',close,true);return()=>window.removeEventListener('pointerdown',close,true);},[menu]);
      useEffect(()=>{if(!selMore)return;const close=ev=>{if(!ev.target?.closest?.('.ic-sel'))setSelMore(false);};window.addEventListener('pointerdown',close,true);return()=>window.removeEventListener('pointerdown',close,true);},[selMore]);
      useEffect(()=>{if(!penPanel)return;const close=ev=>{if(!ev.target?.closest?.('.ic-sel'))setPenPanel(null);};window.addEventListener('pointerdown',close,true);return()=>window.removeEventListener('pointerdown',close,true);},[penPanel]);
      useEffect(()=>{if(!selection.length)setSelMore(false);},[selection.length]);
      const keys={select:'V',pan:'H',pen:'P',erase:'E',text:'T',rect:'R',ellipse:'O',arrow:'A',note:'N',lasso:'L'};
      const hover=(k,label)=>e=>{const el=e.currentTarget;setTip({text:keys[k]?`${t(label)} · ${keys[k]}`:t(label),x:el.offsetLeft+el.offsetWidth/2,y:el.offsetTop+el.offsetHeight/2,rail:!!(el.closest&&el.closest('.ic-rail'))});};
      const zoomPct=h('span',{className:'ic-chip','aria-live':'polite'},Math.round(view.z*100)+'%');
      const colorCard=(setter,current,after)=>h('div',{className:'ic-pen-card ic-swatches',role:'menu','aria-label':t('Color')},
        ...['#000000','#4b4b4b','#b8bcc0','#ffffff','#e03131','#f08c00','#f59f00','#fab005','#74b816','#2f9e44','#0ca678','#12b886','#1971c2','#4263eb','#7048e8','#ae3ec9','#e64980'].map(c=>h('button',{key:c,type:'button',className:'ic-swatch',style:{background:c},onClick:()=>{setter(c);if(after)after(c);setPenPanel(null);},'aria-label':c,title:c})),
        h('label',{className:'ic-swatch ic-swatch-custom',title:t('Custom color')},
          h('input',{type:'color',value:current,onChange:e=>{setter(e.target.value);if(after)after(e.target.value);setPenPanel(null);},'aria-label':t('Custom color')})));
      // Style edits in the secondary bar also apply to the current selection, not just the next shape.
      const applySel=patch=>{if(!selection.length||!doc)return;const ids=[...descendants(selection)].filter(id=>{const e=doc.elements.find(x=>x.id===id);return e&&e.kind!=='group';});if(!ids.length)return;commit(ids.map(id=>({type:'update',id,patch})));};
      const styleLater=patch=>{if(!selection.length)return;if(styleTimer.current)clearTimeout(styleTimer.current);styleTimer.current=setTimeout(()=>{styleTimer.current=0;applySel(patch);},150);};
      const selStyled=(doc?.elements||[]).filter(e=>selection.includes(e.id)&&['rect','ellipse','semi','arrow','note','text'].includes(e.kind));
      const selHasShape=selStyled.some(e=>['rect','ellipse','semi'].includes(e.kind)),selLine=selStyled.some(e=>e.kind==='arrow'),selNote=selStyled.some(e=>e.kind==='note'),selText=selStyled.some(e=>e.kind==='text');
      const strokeBar=['rect','ellipse','semi','arrow','note'].includes(tool)||(tool==='select'&&(selHasShape||selLine||selNote));
      const textBar=tool==='text'||(tool==='select'&&selText);
      const fillBar=strokeBar&&(selHasShape||['rect','ellipse','semi'].includes(tool));
      const noteBar=tool==='note'||(tool==='select'&&selNote);
      return h('section',{className:'ic-app',ref:root,tabIndex:0,onKeyDown:keyDown,'aria-label':t('Canvas')},
        h('div',{className:'ic-workspace'},h('canvas',{ref:svg,className:'ic-canvas','aria-label':t('Canvas'),role:'img',onPointerDown:pointerDown,onPointerMove:pointerMove,onPointerUp:pointerUp,onPointerLeave:()=>{hoverRef.current=null;queuePaint();},onContextMenu:openMenu,onPointerCancel:()=>{live.current.gesture=null;if(handleLayer.current)handleLayer.current.style.display='';paintRef.current&&paintRef.current();},onDoubleClick:e=>{if(!doc||busy)return;const p=world(e),hit=pick(p);if(hit)beginEditor(hit,p);},onWheel:e=>{if(editor)return;const r=svg.current.getBoundingClientRect();zoom(Math.exp(-e.deltaY*.0015),[e.clientX-r.left,e.clientY-r.top]);},style:{cursor:rotateMode&&selection.length?'grab':tool==='erase'?'none':tool==='pan'?'grab':tool==='select'?'default':'crosshair'}}),
          h('div',{className:'ic-handles',ref:handleLayer,onPointerDown:pointerDown,onPointerMove:pointerMove,onPointerUp:pointerUp,onPointerCancel:()=>{live.current.gesture=null;if(handleLayer.current)handleLayer.current.style.opacity='';paintRef.current&&paintRef.current();}},...handleList.map(({hd,x,y})=>h('div',{key:hd,className:hd==='rotate'?'ic-handle-rotate':'ic-handle','data-rotate':hd==='rotate'?'1':undefined,'data-resize':hd==='rotate'?undefined:hd,style:{left:x*view.z+view.x-(hd==='rotate'?7:5),top:y*view.z+view.y-(hd==='rotate'?7:5),cursor:hd==='rotate'?'grab':cursorOf(hd)}}))),
          menu&&h('div',{className:'ic-ctx',role:'menu',style:{left:menu.x,top:menu.y},onPointerDown:e=>e.stopPropagation()},
            h('button',{type:'button',role:'menuitem',onClick:()=>{const els=selection.length?doc.elements.filter(e=>descendants(roots(selection)).has(e.id)):doc.elements;copyToSystem(els);setMenu(null);}},selection.length?`${t('Copy')} (${selection.length})`:t('Copy all')),
            h('button',{type:'button',role:'menuitem',onClick:()=>{const m=menu;setMenu(null);pasteAt(m.wx,m.wy);}},t('Paste')),
            h('button',{type:'button',role:'menuitem',onClick:()=>{setMenu(null);exportPng(false);}},t('Export PNG (white)')),
            h('button',{type:'button',role:'menuitem',onClick:()=>{setMenu(null);exportPng(true);}},t('Export PNG (transparent)')),
            h('button',{type:'button',role:'menuitem',onClick:()=>setMenu(null)},t('Close'))),
          editor&&h('div',{ref:editorRef},h('textarea',{className:'ic-editor',autoFocus:true,value:editor.text,'aria-label':t('Text content'),style:{left:editor.rect[0]*view.z+view.x,top:editor.rect[1]*view.z+view.y,width:Math.max(150,editor.rect[2]*view.z),height:Math.max(85,editor.rect[3]*view.z),fontSize:Math.max(11,(Number(editor.fontSize)||16)*view.z)+'px',color:editor.textColor||'#26382d'},onChange:e=>{const next={...live.current.editor,text:e.target.value};live.current.editor=next;setEditor(next);},onBlur:e=>{
            // Focus moving into this editor's own controls (colour / size / buttons) must not commit and close it.
            const tgt=e?.relatedTarget;if(tgt&&editorRef.current&&editorRef.current.contains(tgt))return;
            setTimeout(()=>{const a=typeof document!=='undefined'?document.activeElement:null;if(a&&editorRef.current&&editorRef.current.contains(a))return;saveEditor();},0);},
            onKeyDown:e=>{if(e.key==='Escape'){e.stopPropagation();live.current.editor=null;setEditor(null);}if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();saveEditor();}}}),h('div',{className:'ic-consult',style:{top:editor.rect[1]*view.z+view.y+Math.max(85,editor.rect[3]*view.z)+10,left:editor.rect[0]*view.z+view.x,right:'auto',bottom:'auto',width:'auto',maxWidth:'calc(100% - 20px)',padding:'8px 10px'}},h('div',{className:'ic-actions'},h('input',{type:'color',className:'ic-color',value:editor.textColor||'#26382d',onChange:e=>{const next={...live.current.editor,textColor:e.target.value};live.current.editor=next;setEditor(next);},'aria-label':t('Text color'),title:t('Text color')}),h('select',{'aria-label':t('Font size'),title:t('Font size'),value:Number(editor.fontSize)||16,onChange:e=>{const next={...live.current.editor,fontSize:+e.target.value};live.current.editor=next;setEditor(next);}},...[12,16,20,28,36,48].map(n=>h('option',{key:n,value:n},`${n}px`))),button('Save',saveEditor),button('Cancel',()=>{live.current.editor=null;setEditor(null);})))),
          consult&&h('aside',{className:'ic-consult','aria-label':t('What does this circle mean?')},h('h3',null,t('What does this circle mean?')),h('p',null,t('Keep it as a drawing, make a card, or group the enclosed items. Nothing converts without your choice.')),h('div',{className:'ic-actions'},consult.id&&button('Make card',()=>consultChoice('card'),{disabled:busy}),button('Group enclosed',()=>consultChoice('group'),{disabled:busy||consult.ids.length<2}),button('Keep drawing',()=>consultChoice('ignore'))))),
        h('div',{className:'ic-top'},
          h('div',{className:'ic-float ic-tl'},h('span',{className:'ic-brand'},h(Icon,{size:16}),t('Canvas')),h('span',{className:'ic-chip'},'v1.0.91'),h('form',{className:'ic-actions',onSubmit:e=>{e.preventDefault();if(!busy&&!live.current.gesture&&!editor&&inputId.trim())setDocId(inputId.trim());}},h('input',{className:'ic-doc',value:inputId,onChange:e=>setInputId(e.target.value),maxLength:160,'aria-label':t('Document')}),button('Open',()=>{if(!busy&&!live.current.gesture&&!editor&&inputId.trim())setDocId(inputId.trim());},{disabled:busy}))),
          h('div',{className:'ic-float ic-tr'},button('Undo',()=>action('undo'),{disabled:busy||!doc?.history?.length}),button('Redo',()=>action('redo'),{disabled:busy||!doc?.future?.length}),button(confirmClear?'Confirm clear':'Clear canvas',clearBoard,{disabled:!doc?.elements?.length||busy,'aria-pressed':confirmClear}),button('Grid',()=>{const next=!grid;live.current.grid=next;setGrid(next);paintRef.current&&paintRef.current();},{'aria-pressed':grid}),button('Numbers',()=>{const next=!badges;live.current.badges=next;setBadges(next);paintRef.current&&paintRef.current();},{'aria-pressed':badges}),button('Fit',fit,{disabled:!doc}))),
        h('div',{className:'ic-float ic-tc ic-rail',role:'toolbar','aria-label':t('Canvas'),onMouseLeave:()=>{setTip(null);setMoreOpen(false);}},
          ...primaryTools.map(k=>toolButton(k)),
          ...extraTools.map(k=>toolButton(k,true)),
          tip&&h('div',{className:'ic-tip ic-tip-rail',role:'tooltip',style:{top:tip.y}},tip.text)),        h('div',{className:'ic-float ic-bl'},h('button',{type:'button',className:'ic-iconbtn',onClick:()=>zoom(1/1.2),title:t('Zoom out'),'aria-label':t('Zoom out')},h(ToolIcon,{kind:'minus',size:16})),zoomPct,h('button',{type:'button',className:'ic-iconbtn',onClick:()=>zoom(1.2),title:t('Zoom in'),'aria-label':t('Zoom in')},h(ToolIcon,{kind:'plus',size:16}))),
        h('div',{className:'ic-float ic-bc'},
          selection.length>0&&!['pen','rect','ellipse','arrow','erase','semi'].includes(tool)
            ? h(React.Fragment,null,
                button('Delete',()=>action('delete'),{disabled:busy}),
                button('Copy',()=>action('copy')),
                button('Paste',()=>action('paste'),{disabled:busy}),
                h('select',{'aria-label':t('Align'),value:'',disabled:selection.length<2||busy,onChange:e=>e.target.value&&action('align',{alignment:e.target.value})},h('option',{value:''},t('Align')),...['left','center','right','top','middle','bottom'].map(x=>h('option',{key:x,value:x},t(x[0].toUpperCase()+x.slice(1))))),
                h('div',{className:'ic-more-wrap'},
                  h('button',{type:'button',className:'ic-more',onClick:()=>setSelMore(v=>!v),title:t('More actions'),'aria-label':t('More actions'),'aria-expanded':selMore},t('More actions')),
                  selMore&&h('div',{className:'ic-menu',role:'menu'},
                    button('Duplicate',()=>{setSelMore(false);action('duplicate');},{disabled:!selection.length||busy}),
                    button('Group',()=>{setSelMore(false);action('group');},{disabled:selection.length<2||busy}),
                    button('Ungroup',()=>{setSelMore(false);action('ungroup');},{disabled:!selected.some(e=>e.kind==='group')||busy}),
                    button('Front',()=>{setSelMore(false);action('reorder',{position:'front'});},{disabled:!selection.length||busy}),
                    button('Back',()=>{setSelMore(false);action('reorder',{position:'back'});},{disabled:!selection.length||busy}),
                    button('Rotate',()=>{setSelMore(false);setRotateMode(v=>!v);},{'aria-pressed':rotateMode,disabled:busy}),
                    button('Rotate left',()=>{setSelMore(false);rotateBy(-90);},{disabled:busy}),
                    button('Rotate right',()=>{setSelMore(false);rotateBy(90);},{disabled:busy}),
                    button('Distribute horizontally',()=>{setSelMore(false);action('distribute',{axis:'x'});},{disabled:selection.length<3||busy}),
                    button('Distribute vertically',()=>{setSelMore(false);action('distribute',{axis:'y'});},{disabled:selection.length<3||busy}))))
            : null),
        h('div',{className:'ic-float ic-br'},aiAt>0&&h('span',{className:'ic-live',role:'status'},t('AI is editing')),h('span',{className:'ic-tipwrap'},h('button',{type:'button',className:'ic-iconbtn',onClick:exportPng,title:t('Export PNG'),'aria-label':t('Export PNG'),disabled:!doc?.elements?.length},h(ToolIcon,{kind:'image',size:18})),h('span',{className:'ic-bubble',role:'tooltip'},t('Export PNG'))),        sessionId&&h('span',{className:'ic-tipwrap'},h('button',{type:'button',className:'ic-ghost',onClick:fillComposer,title:t('Fill input'),'aria-label':t('Fill input'),disabled:!doc},h(ToolIcon,{kind:'compose',size:14}),h('span',{className:'ic-ghost-label'},t('Fill short'))),h('span',{className:'ic-bubble',role:'tooltip'},t('Fill hint'))),
        sessionId&&h('span',{className:'ic-tipwrap'},h('button',{type:'button',className:'ic-send',onClick:ask,disabled:sending||!doc,title:t('Send to AI'),'aria-label':t('Send to AI')},h(ToolIcon,{kind:'send',size:14}),t('Send to AI')),h('span',{className:'ic-bubble',role:'tooltip'},t('Send hint'))),h('span',{className:'ic-chip'},busy?t('Saving…'):doc?`${t('Version')} ${doc.version}`:t('Loading…'))),
        (['pen','erase'].includes(tool)||strokeBar||textBar)&&h('div',{className:'ic-float ic-sel',role:'toolbar','aria-label':t('Size')},
          tool==='pen'&&h('span',{className:'ic-tipwrap'},
            h('button',{type:'button',className:'ic-iconbtn',onClick:()=>setPenPanel(v=>v==='type'?null:'type'),title:t('Pen type'),'aria-label':t('Pen type'),'aria-expanded':penPanel==='type'},h(ToolIcon,{kind:penKind==='plain'?'pen':penKind,size:18})),
            h('span',{className:'ic-bubble',role:'tooltip'},t(PEN_KEYS[penKind]))),
          penPanel==='type'&&h('div',{className:'ic-pen-card ic-pen-types',role:'menu','aria-label':t('Pen type')},
            ...Object.keys(PEN_KEYS).map(k=>h('button',{key:k,type:'button',role:'menuitem',onClick:()=>{setPenKind(k);setPenPanel(null);},title:t(PEN_KEYS[k]),'aria-label':t(PEN_KEYS[k]),'aria-pressed':penKind===k,className:'ic-pen-kind'},h(ToolIcon,{kind:k==='plain'?'pen':k,size:18})))),
          tool==='pen'&&h('span',{className:'ic-tipwrap'},
            h('button',{type:'button',className:'ic-iconbtn',onClick:()=>setPenPanel(v=>v==='size'?null:'size'),title:t('Pen size'),'aria-label':t('Pen size'),'aria-expanded':penPanel==='size'},h('span',{className:'ic-dotmark',style:{width:Math.min(16,Math.max(5,width*1.1)),height:Math.min(16,Math.max(5,width*1.1))}})),
            h('span',{className:'ic-bubble',role:'tooltip'},t('Pen size'))),
          tool==='pen'&&h('span',{className:'ic-tipwrap'},
            h('button',{type:'button',className:'ic-iconbtn',onClick:()=>setPenPanel(v=>v==='color'?null:'color'),title:t('Pen color'),'aria-label':t('Pen color'),'aria-expanded':penPanel==='color'},h('span',{className:'ic-swatch ic-swatch-mini',style:{background:color}})),
            h('span',{className:'ic-bubble',role:'tooltip'},t('Pen color'))),
          tool==='erase'&&h('span',{className:'ic-chip'},t('Eraser')),
          tool==='erase'&&button('Fragment erase',()=>setEraseWhole(false),{'aria-pressed':!eraseWhole}),
          tool==='erase'&&button('Whole erase',()=>setEraseWhole(true),{'aria-pressed':eraseWhole}),
          tool==='erase'&&h('span',{className:'ic-tipwrap'},
            h('button',{type:'button',className:'ic-iconbtn',onClick:()=>setPenPanel(v=>v==='esize'?null:'esize'),title:t('Eraser radius'),'aria-label':t('Eraser radius'),'aria-expanded':penPanel==='esize'},h('span',{className:'ic-dotmark',style:{width:Math.min(18,Math.max(5,radius*.45)),height:Math.min(18,Math.max(5,radius*.45))}})),
            h('span',{className:'ic-bubble',role:'tooltip'},t('Eraser radius'))),
          textBar&&h('span',{className:'ic-chip'},t('Font size')),
          textBar&&h('select',{className:'ic-doc',value:fontSize,onChange:e=>{const n=+e.target.value;setFontSize(n);applySel({fontSize:n});},'aria-label':t('Font size'),title:t('Font size')},...[12,16,20,28,36,48].map(n=>h('option',{key:n,value:n},`${n}px`))),
          textBar&&h('span',{className:'ic-tipwrap'},
            h('button',{type:'button',className:'ic-iconbtn',onClick:()=>setPenPanel(v=>v==='tcolor'?null:'tcolor'),title:t('Text color'),'aria-label':t('Text color'),'aria-expanded':penPanel==='tcolor'},h('span',{className:'ic-swatch ic-swatch-mini',style:{background:textColor}})),
            h('span',{className:'ic-bubble',role:'tooltip'},t('Text color'))),
          (strokeBar&&!noteBar)&&h('span',{className:'ic-tipwrap'},
            h('button',{type:'button',className:'ic-iconbtn',onClick:()=>setPenPanel(v=>v==='color'?null:'color'),title:t('Border color'),'aria-label':t('Border color'),'aria-expanded':penPanel==='color'},h('span',{className:'ic-swatch ic-swatch-mini',style:{background:color}})),
            h('span',{className:'ic-bubble',role:'tooltip'},t('Border color'))),
          (strokeBar&&!noteBar)&&h('span',{className:'ic-tipwrap'},
            h('button',{type:'button',className:'ic-iconbtn',onClick:()=>setPenPanel(v=>v==='size'?null:'size'),title:t('Border width'),'aria-label':t('Border width'),'aria-expanded':penPanel==='size'},h('span',{className:'ic-dotmark',style:{width:Math.min(16,Math.max(5,width*1.1)),height:Math.min(16,Math.max(5,width*1.1))}})),
            h('span',{className:'ic-bubble',role:'tooltip'},t('Border width'))),
          fillBar&&button('Fill',()=>{const next=!fillOn;setFillOn(next);applySel({fill:next?fillColor:'none'});},{'aria-pressed':fillOn}),
          (fillBar||noteBar)&&h('span',{className:'ic-tipwrap'},
            h('button',{type:'button',className:'ic-iconbtn',onClick:()=>setPenPanel(v=>v==='fill'?null:'fill'),title:t('Fill color'),'aria-label':t('Fill color'),'aria-expanded':penPanel==='fill'},h('span',{className:'ic-swatch ic-swatch-mini',style:{background:fillBar?fillColor:noteFill}})),
            h('span',{className:'ic-bubble',role:'tooltip'},t('Fill color'))),
          penPanel==='size'&&tool==='pen'&&h('div',{className:'ic-pen-card ic-pen-size',role:'group','aria-label':t('Pen size')},
            h('div',{className:'ic-pen-head'},h('strong',null,t('Pen size')),h('span',null,String(width))),
            h('input',{type:'range',className:'ic-pen-range',min:1,max:24,step:.5,value:width,onChange:e=>setWidth(+e.target.value),'aria-label':t('Pen size'),title:t('Pen size')})),
          penPanel==='size'&&tool!=='pen'&&strokeBar&&h('div',{className:'ic-pen-card ic-pen-size',role:'group','aria-label':t('Border width')},
            h('div',{className:'ic-pen-head'},h('strong',null,t('Border width')),h('span',null,String(width))),
            h('input',{type:'range',className:'ic-pen-range',min:1,max:24,step:.5,value:width,onChange:e=>{const n=+e.target.value;setWidth(n);styleLater({strokeWidth:n});},'aria-label':t('Border width'),title:t('Border width')})),
          penPanel==='esize'&&h('div',{className:'ic-pen-card ic-pen-size',role:'group','aria-label':t('Eraser radius')},
            h('div',{className:'ic-pen-head'},h('strong',null,t('Eraser radius')),h('span',null,String(radius))),
            h('input',{type:'range',className:'ic-pen-range',min:4,max:60,step:1,value:radius,onChange:e=>setRadius(+e.target.value),'aria-label':t('Eraser radius'),title:t('Eraser radius')})),
          penPanel==='color'&&colorCard(setColor,color,c=>{if(tool!=='pen')applySel({stroke:c});}),
          penPanel==='fill'&&fillBar&&colorCard(setFillColor,fillColor,c=>{applySel({fill:c});setFillOn(true);}),
          penPanel==='fill'&&!fillBar&&noteBar&&colorCard(setNoteFill,noteFill,c=>{setFillColor(c);applySel({fill:c});}),
          penPanel==='tcolor'&&colorCard(setTextColor,textColor,c=>applySel({textColor:c}))),
        h('div',{className:'ic-notices'},
          error&&h('div',{className:'ic-notice ic-error',role:'alert'},h('span',null,error),button('Refresh',()=>refresh(true)),button('Dismiss',()=>setError(''))),
          doc?.pending?.filter(p=>!p.resolved&&p.status!=='resolved'&&p.status!=='rejected'&&p.status!=='approved').map(p=>h('div',{className:'ic-notice',key:p.id},h('span',null,t('Pending decisions'),': ',p.message||p.kind),button('Approve',()=>commit([{type:'resolvePending',id:p.id,approved:true}]),{disabled:busy}),button('Reject',()=>commit([{type:'resolvePending',id:p.id,approved:false}]),{disabled:busy}))),
          selected.length>0&&h('div',{className:'ic-notice',style:{flexDirection:'column',alignItems:'stretch',gap:6}},h('span',null,t('Selected'),': ',selection.length),h('form',{className:'ic-actions',title:t('Comment hint'),onSubmit:e=>{e.preventDefault();if(comment.trim())commit([{type:'annotate',elementId:selection[0],text:comment.trim()}]).then(r=>r&&setComment(''));}},h('span',{className:'ic-chip'},t('Comment')),h('input',{value:comment,onChange:e=>setComment(e.target.value),placeholder:t('Comment hint'),'aria-label':t('Comment text'),maxLength:2000}),button('Send',()=>{if(comment.trim())commit([{type:'annotate',elementId:selection[0],text:comment.trim()}]).then(r=>r&&setComment(''));},{disabled:busy||!comment.trim()})),h('span',{className:'ic-hint'},t('Comment hint'))),
          doc?.annotations?.filter(a=>!a.resolved&&a.status!=='resolved'&&selection.includes(a.elementId)).map(a=>h('div',{className:'ic-notice',key:a.id},h('span',null,a.text),button('Resolve',()=>commit([{type:'resolveAnnotation',id:a.id}]),{disabled:busy})))));
    }
    return { inject:['slots','locale','layout'], apply(ctx) {
      const slots=ctx.get('slots'),locale=ctx.get('locale'),t=locale.bind('intent-canvas');
      const registerLocale=()=>locale.register('intent-canvas',{en:{...Object.fromEntries(Object.keys(labels).map(key=>[key,key])),'Canvas tab':'Canvas'},zh:labels});
      if(ctx.effect)ctx.effect(registerLocale);else registerLocale();
      const stylesheet=".ic-app{--ic-bg:var(--dsw-alias-bg-base,#f5f5f2);--ic-panel:var(--dsw-alias-bg-layer-1,#fff);--ic-line:var(--dsw-alias-border-l1,#d9ded9);--ic-ink:var(--dsw-alias-label-primary,#25332d);--ic-muted:var(--dsw-alias-label-secondary,#6c7971);--ic-accent:var(--dsw-alias-brand-primary,#356c59);height:100%;min-height:0;display:flex;flex-direction:column;background:var(--ic-bg);color:var(--ic-ink);font:13px/1.45 system-ui,sans-serif;overflow:hidden;outline:none}.ic-app *{box-sizing:border-box}.ic-head,.ic-toolbar,.ic-footer{display:flex;align-items:center;gap:6px;padding:10px 14px;flex-wrap:wrap;background:var(--ic-panel);border-bottom:1px solid var(--ic-line)}.ic-head{justify-content:space-between}.ic-title{font-size:17px;font-weight:650;letter-spacing:-.5px}.ic-sub{font-size:11px;color:var(--ic-muted)}.ic-actions{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.ic-app button,.ic-app input,.ic-app select,.ic-app textarea{font:inherit;color:inherit}.ic-app button,.ic-app select,.ic-doc{border:1px solid var(--ic-line);background:var(--ic-panel);border-radius:6px;min-height:30px;padding:5px 9px}.ic-app button{cursor:pointer}.ic-app button:hover{background:var(--dsw-alias-bg-layer-2,#eaf0ec)}.ic-app button:disabled{opacity:.4;cursor:default}.ic-app button[aria-pressed=true]{background:var(--ic-accent);border-color:var(--ic-accent);color:var(--dsw-alias-bg-base,#fff)}.ic-app :focus-visible{outline:2px solid var(--ic-accent);outline-offset:2px}.ic-doc{width:115px}.ic-divider{height:22px;width:1px;background:var(--ic-line);margin:0 3px}.ic-workspace{position:relative;flex:1;min-height:200px;overflow:hidden}.ic-canvas{display:block;width:100%;height:100%;position:absolute;inset:0;touch-action:none;user-select:none}.ic-empty{position:absolute;left:28px;top:26px;pointer-events:none;color:var(--ic-muted);max-width:300px}.ic-empty strong{display:block;font-size:24px;font-weight:450;letter-spacing:-.8px;color:var(--ic-ink);margin-bottom:7px}.ic-footer{border-top:1px solid var(--ic-line);border-bottom:0;justify-content:space-between;padding:7px 14px;color:var(--ic-muted);font-size:11px}.ic-hint{font-size:11px;line-height:1.5;color:var(--ic-muted);white-space:normal}.ic-notice{padding:8px 14px;background:var(--dsw-alias-bg-layer-2,#eef1ed);border-bottom:1px solid var(--ic-line);display:flex;align-items:center;gap:10px;flex-wrap:wrap}.ic-error{color:var(--dsw-alias-state-error-primary,#af3b3b)}.ic-consult{position:absolute;right:18px;top:18px;width:min(330px,calc(100% - 36px));padding:16px;background:var(--ic-panel);border:1px solid var(--ic-line);border-radius:10px;box-shadow:0 8px 30px #0002}.ic-consult h3{margin:0 0 6px;font-size:15px}.ic-consult p{margin:0 0 12px;color:var(--ic-muted)}.ic-editor{position:absolute;resize:both;z-index:3;border:2px solid var(--ic-accent);background:var(--ic-panel);padding:8px;min-width:140px;min-height:65px;border-radius:4px}.ic-layerlist{max-height:180px;overflow:auto;display:flex;gap:5px;align-items:center;flex-wrap:wrap}.ic-color{width:32px;height:30px;padding:2px!important;border:1px solid var(--ic-line);background:transparent}.ic-sidebar{padding:12px;font:13px system-ui;color:var(--dsw-alias-label-primary);display:grid;gap:10px}.ic-sidebar button{font:inherit;padding:8px;border:1px solid var(--dsw-alias-border-l1);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:inherit;cursor:pointer}@media(max-width:700px){.ic-head,.ic-toolbar{padding:7px;gap:4px}.ic-toolbar button{font-size:11px;padding:5px}.ic-sub{display:none}.ic-footer{padding:6px}.ic-title{font-size:15px}}@media(prefers-reduced-motion:reduce){.ic-app *{scroll-behavior:auto}}\n";
      const live=".ic-live{display:inline-flex;align-items:center;gap:5px;font-size:11px;color:var(--dsw-alias-brand-primary,#356c59);border:1px solid var(--dsw-alias-brand-primary,#356c59);border-radius:999px;padding:2px 8px}.ic-live::before{content:'';width:6px;height:6px;border-radius:50%;background:currentColor;animation:ic-pulse 1s infinite}@keyframes ic-pulse{0%,100%{opacity:1}50%{opacity:.25}}";
      // Narrow column adaptation: one scrollable toolbar row instead of a tall stack, and no oversized empty state.
      const compact=".ic-app{container-type:inline-size}.ic-toolbar{flex-wrap:nowrap;overflow-x:auto;overflow-y:hidden;scrollbar-width:thin}.ic-workspace{min-height:120px}@container (max-width:560px){.ic-head,.ic-toolbar,.ic-footer{padding:6px 8px;gap:4px}.ic-title{font-size:15px}.ic-sub{display:none}.ic-app button,.ic-app select,.ic-doc{min-height:26px;padding:3px 6px;font-size:12px}.ic-doc{width:96px}.ic-empty{left:12px;top:10px;max-width:200px}.ic-empty strong{font-size:17px;margin-bottom:2px}.ic-footer{font-size:11px}}";
      // Full-bleed canvas with floating clusters, matching the reference control positions.
      const layout=".ic-app{position:relative;display:flex;flex-direction:column;overflow:hidden}.ic-workspace{position:relative;order:2;flex:1;min-height:0;overflow:hidden}.ic-float{position:absolute;z-index:6;display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:6px 8px;background:var(--dsw-alias-bg-overlay,var(--ic-panel));backdrop-filter:blur(6px);border:1px solid var(--ic-line);border-radius:14px;box-shadow:0 2px 10px rgba(16,24,20,.10);max-width:calc(100% - 16px);overflow:visible;scrollbar-width:none}.ic-float::-webkit-scrollbar{display:none}.ic-top{position:relative;z-index:6;order:1;display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:8px 10px;background:var(--ic-panel);border-bottom:1px solid var(--ic-line)}.ic-top .ic-float{position:static;background:transparent;border:none;box-shadow:none;padding:0}.ic-tl{flex:0 0 auto;order:1}.ic-tr{flex:0 0 auto;order:2;margin-left:auto}.ic-tcwrap{position:relative;flex:1 1 100%;order:3;min-width:0;max-width:100%;display:flex;justify-content:center}.ic-bl{bottom:14px;left:10px}.ic-bc{bottom:14px;left:50%;transform:translateX(-50%)}.ic-br{bottom:14px;right:10px}.ic-rail{left:10px;top:50%;transform:translateY(-50%);flex-direction:column;align-items:center;gap:4px;padding:8px 6px;z-index:7;max-height:calc(100% - 130px);overflow:visible}.ic-rail button{width:36px!important;height:34px!important;padding:0!important}.ic-rail .ic-tool-extra{display:inline-flex!important}.ic-rail .ic-more{display:none!important}.ic-tip-rail{left:calc(100% + 10px);top:0;transform:translateY(-50%)}.ic-foot{position:relative;z-index:6;order:3;flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:3px 10px;border-top:1px solid var(--ic-line);background:var(--ic-panel);color:var(--ic-muted);font-size:11px;line-height:1.5;white-space:nowrap;overflow:hidden}.ic-sel .ic-pen-card{top:calc(100% + 8px);bottom:auto}.ic-sel{top:54px;bottom:auto;left:50%;transform:translateX(-50%);justify-content:center}.ic-sel input{flex:1 1 120px;min-width:80px}.ic-sel .ic-pen-range{width:100%;min-width:0;accent-color:var(--ic-accent)}.ic-pen-size{display:flex;flex-direction:column;gap:2px;min-width:160px}.ic-pen-size .ic-pen-head strong{font-weight:600;font-size:12px;color:inherit}.ic-pen-size .ic-pen-range{width:100%;min-width:0;accent-color:var(--ic-accent)}.ic-notices{position:absolute;z-index:7;top:auto;bottom:70px;left:10px;display:flex;flex-direction:column-reverse;gap:6px;max-width:min(420px,calc(100% - 20px));pointer-events:none}.ic-notices>*{pointer-events:auto}.ic-brand{display:flex;align-items:center;gap:5px;font-weight:650;font-size:13px;margin-right:2px}.ic-chip{font-size:11px;color:var(--ic-muted);white-space:nowrap}.ic-float button,.ic-float select{min-height:32px;padding:4px 10px;border-radius:9px;font-size:13px;flex:0 0 auto;white-space:nowrap}.ic-float .ic-doc{width:86px;min-height:26px;padding:2px 6px;font-size:12px}.ic-float input[type=range]{width:62px}.ic-empty{left:50%;top:44%;transform:translate(-50%,-50%);text-align:center;max-width:280px}@container (max-width:600px){.ic-doc{display:none}.ic-bc{display:none}.ic-tc button{width:32px;height:30px}}.ic-tcwrap .ic-tc{position:static;transform:none;width:max-content;max-width:100%;margin:0 auto;justify-content:center}.ic-consult{top:auto;bottom:64px;right:10px}.ic-canvas{will-change:transform;contain:paint}.ic-handles{position:absolute;inset:0;z-index:9;pointer-events:none}.ic-handle{position:absolute;width:10px;height:10px;border:1.2px solid var(--ic-accent);background:var(--dsw-alias-bg-overlay,var(--ic-panel));border-radius:2px;box-sizing:border-box;pointer-events:auto}.ic-more-wrap{position:relative;display:inline-flex}.ic-tc .ic-more{display:none;width:34px;height:34px;align-items:center;justify-content:center;padding:0}.ic-menu{position:absolute;z-index:12;top:calc(100% + 6px);right:0;display:flex;flex-direction:column;gap:2px;min-width:132px;padding:6px;background:var(--ic-panel);border:1px solid var(--ic-line);border-radius:10px;box-shadow:0 8px 24px rgba(16,24,20,.16)}.ic-menu button{display:flex;align-items:center;gap:8px;justify-content:flex-start;min-height:30px;padding:4px 8px;border:none;background:transparent;white-space:nowrap;font-size:13px}.ic-menu button:hover{background:var(--dsw-alias-bg-layer-2,#eaf0ec)}.ic-bc .ic-menu{top:auto;bottom:calc(100% + 6px)}@container (max-width:640px){.ic-tc .ic-tool-extra{display:none}.ic-tc .ic-more{display:inline-flex}}.ic-tip{position:absolute;top:calc(100% + 7px);transform:translateX(-50%);white-space:nowrap;font-size:12px;line-height:1.4;padding:4px 9px;border-radius:7px;background:var(--ic-panel);border:1px solid var(--ic-line);box-shadow:0 3px 10px rgba(16,24,20,.12);color:var(--ic-muted);pointer-events:none;z-index:8}.ic-tc button{width:38px;height:34px;padding:0;display:inline-flex;align-items:center;justify-content:center}.ic-float button svg{display:block}.ic-float .ic-send{display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:5px 14px;border-radius:999px;background:var(--ic-accent);border:1px solid var(--ic-accent);color:var(--dsw-alias-bg-base,#fff);font-weight:600;font-size:13px;cursor:pointer;box-shadow:0 2px 5px rgba(16,24,20,.18)}.ic-float .ic-send:hover{filter:brightness(1.07)}.ic-float .ic-send:hover{background:var(--ic-accent);color:var(--dsw-alias-bg-base,#fff);border-color:var(--ic-accent);filter:brightness(1.08);box-shadow:0 4px 12px rgba(16,24,20,.28)}.ic-float .ic-send:disabled{opacity:.45;cursor:default;filter:none}.ic-float .ic-send:disabled{opacity:.45;cursor:default}.ic-dot{width:32px;height:32px;display:inline-flex;align-items:center;justify-content:center;padding:0;border:1px solid transparent;background:transparent}.ic-dotmark{display:block;border-radius:50%;background:currentColor}.ic-pen-card{position:absolute;z-index:22;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);min-width:170px;padding:10px;background:var(--dsw-alias-bg-overlay,var(--ic-panel));backdrop-filter:blur(6px);border:1px solid var(--ic-line);border-radius:12px;box-shadow:0 8px 24px rgba(16,24,20,.16);display:flex;flex-direction:column;gap:6px}.ic-pen-head{display:flex;align-items:center;justify-content:space-between;font-size:12px;color:var(--ic-muted)}.ic-pen-kind{display:flex;align-items:center;gap:8px;justify-content:flex-start;min-height:30px;padding:4px 8px;border:none;background:transparent;font-size:13px;border-radius:8px;white-space:nowrap}.ic-pen-kind:hover,.ic-pen-kind[aria-pressed=true]{background:var(--dsw-alias-bg-layer-2,#eef1ed)}.ic-swatches{display:grid;grid-template-columns:repeat(6,26px);gap:8px;justify-content:center}.ic-swatch{width:26px;height:26px;border-radius:50%;border:1px solid rgba(16,24,20,.14);padding:0;cursor:pointer}.ic-swatch-mini{width:18px;height:18px;display:block}.ic-swatch-custom{display:inline-flex;align-items:center;justify-content:center;background:conic-gradient(#e03131,#f08c00,#fab005,#2f9e44,#1971c2,#7048e8,#e03131);position:relative;overflow:hidden}.ic-swatch-custom input{position:absolute;inset:0;opacity:0;width:100%;height:100%;border:none;padding:0;cursor:pointer}.ic-tipwrap{position:relative;display:inline-flex}.ic-tipwrap .ic-bubble{position:absolute;left:50%;bottom:calc(100% + 8px);transform:translateX(-50%);white-space:nowrap;background:var(--dsw-alias-bg-overlay,var(--ic-panel));color:var(--dsw-alias-bg-base,#fff);font-size:11px;line-height:1.5;padding:3px 8px;border-radius:6px;opacity:0;pointer-events:none;transition:opacity .12s;z-index:12}.ic-tipwrap:hover .ic-bubble,.ic-tipwrap:focus-within .ic-bubble{opacity:1}.ic-tipwrap .ic-bubble::after{content:'';position:absolute;top:100%;left:50%;transform:translateX(-50%);border:4px solid transparent;border-top-color:var(--dsw-alias-bg-overlay,var(--ic-panel))}.ic-ctx{position:absolute;z-index:30;min-width:150px;padding:6px;display:flex;flex-direction:column;gap:2px;background:var(--ic-panel);border:1px solid var(--ic-line);border-radius:10px;box-shadow:0 8px 24px rgba(16,24,20,.18)}.ic-ctx button{display:flex;align-items:center;justify-content:flex-start;min-height:30px;padding:4px 10px;border:none;background:transparent;font-size:13px;white-space:nowrap;border-radius:7px}.ic-ctx button:hover{background:var(--dsw-alias-bg-layer-2,#eaf0ec)}.ic-handle-rotate{position:absolute;width:16px;height:16px;pointer-events:auto;border-radius:50%;background:var(--ic-panel);border:1.5px solid var(--ic-accent);box-shadow:0 1px 4px rgba(16,24,20,.18)}.ic-handle-rotate::after{content:'';position:absolute;inset:2px;border-radius:50%;border:1.5px dashed var(--ic-accent)}.ic-iconbtn{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;padding:0}.ic-ghost{display:inline-flex;align-items:center;gap:5px;min-height:32px;padding:4px 10px;border-radius:999px;border:1px solid var(--ic-accent);background:transparent;color:var(--ic-accent);font-size:12px;font-weight:600;white-space:nowrap;box-shadow:0 1px 3px rgba(16,24,20,.14)}.ic-ghost:hover{box-shadow:0 3px 10px rgba(16,24,20,.24);border-color:var(--ic-accent)}.ic-ghost:disabled{opacity:.45;cursor:default}@container (max-width:560px){.ic-ghost-label{display:none}}.ic-note{width:190px;min-height:32px;padding:4px 9px;border:1px solid var(--ic-line);border-radius:9px;background:var(--ic-panel);color:inherit;font-size:13px}";
      const penbar=".ic-sel{border-radius:999px;padding:6px 8px}.ic-pen-types{flex-direction:row;align-items:center;gap:4px;min-width:0;border-radius:999px;padding:6px 8px}.ic-pen-types .ic-pen-kind{width:34px;height:34px;min-height:0;padding:0;gap:0;justify-content:center;border-radius:999px}.ic-pen-types .ic-pen-kind:hover{background:var(--dsw-alias-bg-layer-2,var(--ic-panel))}.ic-pen-types .ic-pen-kind[aria-pressed=true]{background:var(--dsw-alias-bg-layer-2,var(--ic-panel))}.ic-pen-head span{font-weight:650;color:var(--ic-ink)}.ic-tipwrap .ic-bubble{background:var(--dsw-alias-bg-overlay,var(--ic-panel));color:var(--ic-ink);border:1px solid var(--ic-line);box-shadow:0 4px 14px rgba(16,24,20,.16)}.ic-tipwrap .ic-bubble::after{border-top-color:var(--dsw-alias-bg-overlay,var(--ic-panel))}.ic-sel .ic-tipwrap .ic-bubble{bottom:auto;top:calc(100% + 8px)}.ic-sel .ic-tipwrap .ic-bubble::after{top:auto;bottom:100%;border-top-color:transparent;border-bottom-color:var(--dsw-alias-bg-overlay,var(--ic-panel))}.ic-pen-card{background:var(--dsw-alias-bg-overlay,var(--ic-panel));border:1px solid var(--ic-line);box-shadow:0 10px 30px rgba(16,24,20,.18)}.ic-pen-size{min-width:190px;gap:6px}.ic-pen-range{display:block;width:100%;margin:0}.ic-sel .ic-pen-size input[type=range]{flex:0 0 auto;width:100%;height:auto;min-width:0}.ic-sel .ic-color{flex:0 0 auto;width:26px;height:26px;min-width:0;padding:0;border:none;border-radius:50%;background:transparent;cursor:pointer}.ic-float:empty{display:none}";
      // The chrome element is built once and reused, so re-renders during a drag leave the styles untouched.
      const chrome=h(React.Fragment,null,h('style',null,stylesheet),h('style',null,live),h('style',null,compact),h('style',null,layout),h('style',null,penbar));
      // Cache the rendered subtree per session: the host re-renders its tree while streaming, and returning the
      // identical element makes React bail out, so the canvas is never repainted by an unrelated host update.
      const cache=new Map();
      const panelFor=(key,inputActions)=>{let entry=cache.get(key);if(!entry||entry.inputActions!==inputActions){entry={inputActions,element:h(React.Fragment,null,chrome,h(Canvas,key?{ctx,sessionId:key,inputActions}:{ctx}))};cache.set(key,entry);}return entry.element;};
      const Main=()=>panelFor('');
      const View=({sessionId,inputActions})=>panelFor(sessionId||'',inputActions);
      slots.inject('main',()=>slots.register({name:'main',key:'canvas'},Main));
      // A session View tab keeps the canvas beside 对话/轨迹, so the session stays open while drawing.
      slots.inject('conversation.view',()=>slots.register({name:'conversation.view',id:'canvas',order:20,label:()=>t('Canvas tab')},View));
      slots.inject('sidebar.panellist',()=>slots.register({name:'sidebar.panellist',id:'canvas',order:5,label:()=>t('Collaborative Canvas')},Icon));
      // The shipped right Sidebar dock: one tab type gives a real column beside the conversation.
      const Board=({sessionId,inputActions})=>panelFor(sessionId||'',inputActions);
      const label=()=>t('Canvas tab');
      const mountDock=owner=>{
        const tabs=owner.get('sidebarRightTabs'),side=owner.get('sidebarRight'),dockSlots=owner.get('slots');
        if(!tabs||!side||!dockSlots)return;
        const install=()=>{const dispose=tabs.register({id:'@local/intent-canvas/board',kind:'canvas',title:label,guide:[{id:'canvas',title:label,description:()=>t('A canvas shared with this session, side by side with the chat')}]});return()=>dispose();};
        if(owner.effect)owner.effect(install);else install();
        dockSlots.inject('sidebar.right.pane.tab',()=>dockSlots.register({name:'sidebar.right.pane.tab',key:'@local/intent-canvas/board'},Board));
        const Open=({sessionId})=>{const seen=useRef(null);
          useEffect(()=>{if(!sessionId||!side)return;const doc=sessionDoc(sessionId);let stop=false;
            const tick=async()=>{try{const r=await readDoc(doc);if(stop)return;const v=r.document?.version??0;
                if(seen.current===null){seen.current=v;return;}
                if(v>seen.current){seen.current=v;
                  if(r.activity?.author==='ai'){try{side.openTab('canvas');}catch(e){}
                    toast.push(t('The AI drew on the canvas — opened it on the right'));}
                }}catch(e){}};
            const timer=setInterval(tick,2500);tick();
            return()=>{stop=true;clearInterval(timer);};},[sessionId]);
          return h('button',{type:'button','aria-label':label(),title:label(),onClick:()=>{try{side.openTab('canvas');}catch(e){}},style:{display:'inline-flex',alignItems:'center',justifyContent:'center',width:28,height:28,borderRadius:6,border:'1px solid transparent',background:'transparent',color:'var(--dsw-alias-label-secondary,#6c7971)',cursor:'pointer'}},h(Icon,{size:16}));};
        dockSlots.inject('conversation.session.header.actions',()=>dockSlots.register({name:'conversation.session.header.actions',id:'canvas-sidebar',order:6,label},Open));
        const Toast=()=>{const [,setTick]=useState(0);
          useEffect(()=>{const fn=()=>setTick(n=>n+1);toast.listeners.add(fn);const timer=setInterval(fn,1000);return()=>{toast.listeners.delete(fn);clearInterval(timer);};},[]);
          if(!toast.text||Date.now()-toast.at>6000)return null;
          return h('div',{role:'status',style:{position:'fixed',right:24,bottom:24,zIndex:60,maxWidth:340,padding:'10px 14px',borderRadius:10,background:'var(--dsw-alias-bg-overlay,#fff)',color:'var(--dsw-alias-label-primary,#25332d)',border:'1px solid var(--dsw-alias-border-l1,#d9ded9)',boxShadow:'0 8px 24px rgba(0,0,0,.14)',font:'13px/1.5 system-ui,sans-serif'}},toast.text);};
        dockSlots.inject('shell.overlay',()=>dockSlots.register({name:'shell.overlay',id:'canvas-toast',order:90},Toast));
      };
      if(typeof ctx.inject==='function')ctx.inject(['sidebarRightTabs','sidebarRight'],mountDock);else mountDock(ctx);
    }};
  }
});

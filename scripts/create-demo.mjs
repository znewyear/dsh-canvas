import { mkdir, writeFile } from 'node:fs/promises';
import { initialDocument, applyOperations } from '../engine.js';

// Editable model + explanatory SVG, not a screenshot of the DSH UI.
const out = new URL('../docs/assets/', import.meta.url);
await mkdir(out, { recursive: true });
const ink='#203b36', green='#24745c', muted='#687c74', line='#d6dfd7';
const elements=[];
const add=(id,kind,rect,extra={})=>elements.push({id,kind,rect,...extra});
const box=(id,x,y,w,h,fill,stroke=line)=>add(id,'rect',[x,y,w,h],{fill,stroke,strokeWidth:1,rx:18});
const text=(id,x,y,w,value,size=18,color=ink)=>add(id,'text',[x,y,w,size*1.5],{text:value,fontSize:size,textColor:color});
const arrow=(id,x,y,w,h,color=green)=>add(id,'arrow',[x,y,w,h],{stroke:color,strokeWidth:2,points:[[0,0],[w,h]]});
box('paper',0,0,1600,1040,'#f4f5ef','#f4f5ef');
text('eyebrow',64,54,900,'DSH CANVAS  /  SYSTEM DESIGN STUDY 01',15,green);
text('headline',60,99,1400,'One canvas. Two perspectives.',56);
text('subtitle',64,178,1400,'From a rough thought to a shared decision — without losing the conversation.',21,muted);
box('human-surface',64,266,430,480,'#fffef9');
box('shared-surface',554,266,492,480,'#e5eee5','#c4d5c7');
box('ai-surface',1106,266,430,480,'#fffef9');
text('human-index',92,294,300,'01  /  HUMAN',14,green);
text('human-title',92,338,370,'Sketch the intent',30);
text('human-body',92,393,360,'Draw · annotate · reshape',19,muted);
box('wireframe',100,464,350,124,'#f0f2e9');
box('wireframe-icon',120,484,68,82,'#d9e6d5','#d9e6d5');
box('wireframe-line1',208,488,210,12,'#b8cbb9','#b8cbb9');
box('wireframe-line2',208,516,164,9,'#d1dbca','#d1dbca');
box('wireframe-line3',208,540,188,9,'#d1dbca','#d1dbca');
text('human-note',100,626,360,'“Keep the idea. Change the form.”',16,green);
text('human-foot',100,692,350,'Pen / shapes / notes / text',14,muted);
text('shared-index',584,294,420,'02  /  SHARED DOCUMENT',14,green);
text('shared-title',584,338,420,'The common ground',30);
text('shared-body',584,393,420,'Stable elements. Explicit operations.',19,muted);
for(const [i,label,detail] of [[0,'READ','Inspect the current version'],[1,'RECONCILE','Propose one atomic batch'],[2,'COMMIT','Persist or return a conflict']]){
  const y=452+i*80;
  box('step-'+i,584,y,432,62,'#f6f9f1','#d3dfcf');
  text('step-label-'+i,602,y+13,130,label,14,green);
  text('step-detail-'+i,738,y+13,260,detail,14,ink);
}
text('shared-foot',584,710,430,'ONE VERSION  /  ONE SHARED UNDO STEP',12,green);
text('ai-index',1136,294,340,'03  /  AI',14,green);
text('ai-title',1136,338,350,'Make it precise',30);
text('ai-body',1136,393,350,'Read · reason · edit',19,muted);
box('code-card',1136,452,368,162,'#203b36','#203b36');
text('code-read',1158,474,325,'canvas_read()',20,'#d9eacb');
text('code-version',1158,514,325,'baseVersion: current',17,'#b9cbc0');
text('code-apply',1158,554,325,'canvas_apply({ ops })',20,'#d9eacb');
text('ai-note',1136,644,350,'Same objects. Same history.',17,green);
text('ai-foot',1136,692,350,'No separate AI-only whiteboard',14,muted);
arrow('human-to-shared',502,510,44,0);arrow('shared-to-ai',1054,510,44,0);
box('decision-band',64,792,1472,148,'#ece8d8','#e0dbc7');
text('decision-index',94,818,210,'THE HUMAN GATE',13,'#8a6a2d');
text('decision-title',94,853,650,'Suggestions are not approvals.',27);
text('decision-detail',832,831,650,'Circle → consultation → explicit human choice',18,ink);
text('decision-caption',832,873,650,'Keep the drawing, make a card, or group the enclosed items.',14,muted);
text('footer-left',64,981,1050,'EDITABLE EXAMPLE  /  Generated with the dsh-canvas document engine',13,muted);
text('footer-right',1250,981,300,'Not an application screenshot',12,muted);

const doc=applyOperations(initialDocument('demo-system-design'),0,elements.map(element=>({type:'create',element})),'ai').document;
await writeFile(new URL('system-design.canvas.json',out),JSON.stringify(doc,null,2)+'\n');
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const shapes=doc.elements.map(e=>{
  const [x,y,w,h]=e.rect;
  if(e.kind==='rect')return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${e.rx||0}" fill="${e.fill}" stroke="${e.stroke}" stroke-width="${e.strokeWidth}"/>`;
  if(e.kind==='text')return `<text x="${x}" y="${y+e.fontSize}" font-size="${e.fontSize}" fill="${e.textColor}" font-weight="${e.fontSize>=27?600:400}">${esc(e.text)}</text>`;
  return `<path d="M${x},${y} L${x+w},${y+h}" fill="none" stroke="${e.stroke}" stroke-width="2" marker-end="url(#arrow)"/>`;
}).join('\n');
await writeFile(new URL('system-design.svg',out),`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1040" viewBox="0 0 1600 1040" role="img" aria-labelledby="title desc"><title id="title">One canvas. Two perspectives.</title><desc id="desc">Editable explanatory diagram showing human sketching, a versioned shared document, AI tools, and an explicit human approval gate. Not an application screenshot.</desc><defs><marker id="arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7" fill="${green}"/></marker></defs><g font-family="Segoe UI, Arial, sans-serif">${shapes}</g></svg>\n`);
console.log(`Validated ${doc.elements.length} editable elements; wrote explanatory SVG and canvas JSON.`);

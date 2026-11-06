import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { initialDocument, applyOperations } from '../engine.js';
const out=new URL('../docs/assets/',import.meta.url);
await mkdir(out,{recursive:true});
const run=(doc,ops,author='human')=>applyOperations(doc,doc.version,ops,author).document;
const base=run(initialDocument('demo-erase'),[{type:'create',element:{id:'stroke',kind:'path',rect:[0,0,360,100],points:[[0,70],[60,20],[120,75],[180,25],[240,80],[300,15],[360,65]],stroke:'#24745c',strokeWidth:8}}]);
const erased=run(base,[{type:'erasePath',points:[[180,-10],[180,110]],radius:25}]);
const restored=run(erased,[{type:'undo'}]);
assert.ok(erased.elements.length>1);
assert.deepEqual(restored.elements,base.elements);
let proposed=run(initialDocument('demo-approval'),[{type:'create',element:{id:'idea',kind:'ellipse',rect:[0,0,120,90],stroke:'#24745c',fill:'#e5eee5'}}]);
proposed=run(proposed,[{type:'promote',id:'idea',to:'card'}],'ai');
assert.equal(proposed.elements[0].kind,'ellipse');
assert.equal(proposed.pending[0].status,'open');
assert.throws(()=>run(proposed,[{type:'resolvePending',id:proposed.pending[0].id,approved:true}],'ai'),{code:'FORBIDDEN'});
const approved=run(proposed,[{type:'resolvePending',id:proposed.pending[0].id,approved:true}]);
assert.equal(approved.elements[0].kind,'card');
assert.equal(approved.pending[0].resolvedBy,'human');
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const text=(x,y,value,size=18,color='#203b36')=>`<text x="${x}" y="${y}" font-size="${size}" fill="${color}">${esc(value)}</text>`;
const panel=(x,y,w,h)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="#fffef9" stroke="#d6dfd7"/>`;
const paths=(doc,x,y)=>doc.elements.map(e=>`<path d="${e.points.map((p,i)=>`${i?'L':'M'}${x+e.rect[0]+p[0]},${y+e.rect[1]+p[1]}`).join(' ')}" fill="none" stroke="${e.stroke}" stroke-width="${e.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
let art=text(64,69,'DSH CANVAS  /  INTERACTION NOTES',15,'#24745c')+text(60,134,'Edits you can explain. Decisions you control.',40)+text(64,183,'Actual document transitions, presented as diagrams — not application screenshots.',19,'#687c74');
for(const [i,doc,label,caption] of [[0,base,'01 / DRAW','One continuous stroke'],[1,erased,'02 / ERASE','Local fragments, not a full deletion'],[2,restored,'03 / UNDO','The original stroke returns']]){
 const x=64+i*500;
 art+=panel(x,235,472,285)+text(x+24,278,label,14,'#24745c')+paths(doc,x+50,310)+text(x+24,468,caption,18)+text(x+24,498,`Document v${doc.version}`,13,'#687c74');
}
art+=text(64,581,'Approval is an explicit boundary.',29);
for(const [i,title,detail,state] of [[0,'AI proposes a card','The circle remains unchanged.','PENDING / OPEN'],[1,'AI approval is refused','FORBIDDEN — no partial mutation.','VERSION UNCHANGED'],[2,'A human approves','The element becomes a card.','RESOLVED BY / HUMAN']]){
 const x=64+i*500;
 art+=panel(x,616,472,250)+text(x+24,660,`0${i+1} / ${title}`,22)+text(x+24,702,detail,16,'#687c74');
 art+=i<2?`<ellipse cx="${x+75}" cy="779" rx="38" ry="29" fill="#e5eee5" stroke="#24745c" stroke-width="2"/>`:`<rect x="${x+37}" y="750" width="76" height="58" rx="10" fill="#e5eee5" stroke="#24745c" stroke-width="2"/>`;
 art+=text(x+140,786,state,14,'#24745c');
}
art+=text(64,925,'Engine-verified examples  /  Reproduce with node scripts/create-interactions.mjs',14,'#687c74');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="980" viewBox="0 0 1600 980" role="img" aria-labelledby="title"><title id="title">Engine-verified erasure, undo and human approval transitions; explanatory diagrams, not UI screenshots</title><rect width="1600" height="980" rx="24" fill="#f4f5ef"/><g font-family="Segoe UI,Arial,sans-serif">${art}</g></svg>\n`;
await writeFile(new URL('interactions.svg',out),svg);
await writeFile(new URL('interaction-states.json',out),JSON.stringify({description:'Engine-verified states, not UI screenshots',erase:{before:base,after:erased,undo:restored},approval:{proposed,approved}},null,2)+'\n');
console.log('Verified local erasure, undo restoration, AI approval refusal, and human approval; wrote SVG and state data.');

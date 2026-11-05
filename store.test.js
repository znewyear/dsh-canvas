import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore} from './store.js';
const op = id => [{type:'create',element:{id,kind:'rect',rect:[0,0,20,20]}}];
function table() {const records=new Map();return {get:k=>records.get(k),async put(k,v){records.set(k,structuredClone(v));}};}
test('serialized commits reject stale concurrent writes and survive store reopening',async()=>{
 const t=table(),s=createStore(t);
 const a=s.apply({baseVersion:0,ops:op('a')});
 const b=s.apply({baseVersion:0,ops:op('b')});
 assert.equal((await a).version,1);await assert.rejects(b,{code:'VERSION_CONFLICT'});
 assert.equal((await s.read()).document.elements.length,1);
 const reopened=createStore(t);assert.equal((await reopened.read()).document.version,1);
 await reopened.apply({baseVersion:1,ops:[{type:'undo'}]},'human');
 assert.equal((await reopened.read()).document.elements.length,0);
});
test('failed durable write reports error and does not poison queue',async()=>{
 const t=table(),s=createStore(t),put=t.put;let fail=true;
 t.put=async(...args)=>{if(fail)throw new Error('disk full');return put(...args);};
 await assert.rejects(s.apply({baseVersion:0,ops:op('a')}),/disk full/);
 assert.equal((await s.read()).document.version,0);fail=false;
 assert.equal((await s.apply({baseVersion:0,ops:op('b')})).version,1);
});
test('invalid ids cannot access storage and unchanged uses version',async()=>{
 const s=createStore(table());await assert.rejects(s.read({doc:'../other'}),{code:'INVALID_DOCUMENT'});
 assert.equal((await s.read({sinceSeq:0})).unchanged,true);
});

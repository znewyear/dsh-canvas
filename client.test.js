import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import { createLocale } from './test-support.js';

test('client registers matching navigation and main keys with a localized icon entry',async()=>{
  let module;
  const React={Fragment:'fragment',createElement:(type,props,...children)=>({type,props,children}),useState:value=>[typeof value==='function'?value():value,()=>{}],useEffect:()=>{},useRef:value=>({current:value})};
  vm.runInNewContext(await readFile(new URL('./client.js',import.meta.url),'utf8'),{
    window:{__ModuleLoader__:{load:value=>{module=value;}}}
  });
  assert.equal(module.id,'@local/intent-canvas');
  const plugin=module.factory(name=>{assert.equal(name,'react');return React;});
  const registrations=[];
  const slots={inject:(name,install)=>install(),register:(options,component)=>{registrations.push({options,component});}};
  const locale=createLocale('zh-CN');
  const opened=[];
  const types=[];
  const services={slots,locale,layout:{selectPanel:id=>opened.push(id)},
    sidebarRightTabs:{register:definition=>{types.push(definition);return()=>{};}},
    sidebarRight:{openTab:kind=>opened.push(`tab:${kind}`)}};
  plugin.apply({get:name=>{assert.ok(name in services);return services[name];},effect:fn=>fn()});
  assert.deepEqual(Array.from(plugin.inject),['slots','locale','layout']);
  const main=registrations.find(r=>r.options.name==='main');
  const nav=registrations.find(r=>r.options.name==='sidebar.panellist');
  assert.ok(main);assert.ok(nav);
  assert.equal(main.options.key,nav.options.id);
  assert.equal(nav.options.id,'canvas');
  assert.equal(nav.options.label(),'协作画布');
  locale.setLocale('en');assert.equal(nav.options.label(),'Collaborative Canvas');
  const icon=nav.component({size:18,active:false});
  assert.equal(icon.type,'svg');assert.equal(icon.props.width,18);assert.equal(icon.props.height,18);
  assert.equal(icon.props['aria-hidden'],true);
  const header=registrations.find(r=>r.options.name==='conversation.view');
  assert.ok(header,'session exposes the canvas as a conversation view');
  assert.equal(header.options.id,'canvas');
  assert.equal(header.options.order,20);
  locale.setLocale('zh-CN');
  assert.equal(header.options.label(),'画布');
  locale.setLocale('en');
  assert.equal(header.options.label(),'Canvas');
  const type=types[0];
  assert.ok(type,'right sidebar tab type registers');
  assert.equal(type.id,'@local/intent-canvas/board');
  assert.equal(type.kind,'canvas');
  assert.equal(type.guide[0].id,'canvas');
  const board=registrations.find(r=>r.options.name==='sidebar.right.pane.tab');
  assert.ok(board);
  assert.equal(board.options.key,type.id);
  const opener=registrations.find(r=>r.options.name==='conversation.session.header.actions');
  assert.ok(opener,'header opens the docked canvas');
  assert.equal(opener.options.id,'canvas-sidebar');
  locale.setLocale('zh-CN');
  assert.equal(opener.component({}).props['aria-label'],'画布');
  assert.equal(type.guide[0].description(),'与本会话共用的画布，可与对话并排查看');
  locale.setLocale('en');
  assert.equal(opener.component({}).props['aria-label'],'Canvas');
  assert.equal(type.guide[0].description(),'A canvas shared with this session, side by side with the chat');
  opener.component({}).props.onClick();
  assert.deepEqual(opened,['tab:canvas']);
});

test('dock services that arrive after apply still register the canvas tab',async()=>{
  let module;
  const React={Fragment:'fragment',createElement:(type,props,...children)=>({type,props,children}),useState:value=>[typeof value==='function'?value():value,()=>{}],useEffect:()=>{},useRef:value=>({current:value})};
  vm.runInNewContext(await readFile(new URL('./client.js',import.meta.url),'utf8'),{
    window:{__ModuleLoader__:{load:value=>{module=value;}}}
  });
  const plugin=module.factory(()=>React);
  const registrations=[];
  const slots={inject:(name,install)=>install(),register:(options,component)=>{registrations.push({options,component});}};
  const types=[];
  const services={slots,locale:createLocale(),layout:{},
    sidebarRightTabs:{register:definition=>{types.push(definition);return()=>{};}},
    sidebarRight:{openTab:()=>{}}};
  let injected=null;
  const scopeCtx={get:name=>services[name],effect:fn=>fn()};
  plugin.apply({get:name=>{assert.ok(name in services);return services[name];},effect:fn=>fn(),
    inject:(deps,callback)=>{injected=deps;callback(scopeCtx);}});
  assert.deepEqual(Array.from(injected),['sidebarRightTabs','sidebarRight'],'dock services are awaited, not sampled once');
  assert.equal(types[0].id,'@local/intent-canvas/board');
  assert.equal(types[0].kind,'canvas');
  const board=registrations.find(r=>r.options.name==='sidebar.right.pane.tab');
  assert.ok(board,'the pane body registers through the injected scope');
  assert.equal(board.options.key,types[0].id);
});


test('chrome uses host theme surfaces without changing artwork and PNG whites',async()=>{
  const source=await readFile(new URL('./client.js',import.meta.url),'utf8');
  const css=Array.from(source.matchAll(/const (?:stylesheet|layout|penbar)="([^\n]+)";/g),m=>m[1]).join('');
  assert.match(css,/--dsw-alias-bg-overlay/);
  assert.match(css,/--dsw-alias-bg-layer-2/);
  assert.doesNotMatch(css,/(?:background|border-top-color|border-bottom-color):#(?:fff|000)/);
  assert.match(source,/ctx.fillStyle='#ffffff'/);
  assert.match(source,/c2.fillStyle='#ffffff'/);
  assert.match(source,/'#b8bcc0','#ffffff'/);
  assert.doesNotMatch(source,/startsWith\('zh'\)/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const content=JSON.parse(fs.readFileSync(new URL('../content.json',import.meta.url),'utf8'));
const source=fs.readFileSync(new URL('../static/app.js',import.meta.url),'utf8').replace('  init();','  globalThis.workshop = { S, receiveState, loadGallery };');
const settle=()=>new Promise(resolve=>setTimeout(resolve,25));
function app() {
  const events={},nodes=new Map(); let form=null,dirty=false;
  function node() {return {textContent:'',innerHTML:'',scrollTop:0,open:false,hidden:false,style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},showModal(){this.open=true;},contains(n){return Boolean(n?.inPanel);}};}
  const document={querySelector(selector){if(selector.includes('data-dirty'))return dirty?{inPanel:true}:null;if(!nodes.has(selector))nodes.set(selector,node());return nodes.get(selector);},addEventListener(name,handler){(events[name]??=[]).push(handler);},activeElement:{closest(){return form;}}};
  const requests=[];let items=[],summary={total:2,pending_review:2,without_consent:0,published:0};
  const context=vm.createContext({document,window:{WORKSHOP_CONTENT:content,addEventListener(){}},setTimeout,clearTimeout,setInterval,clearInterval,URL,URLSearchParams,File:class{},Blob:class{},console,fetch:async url=>{requests.push(url);return {ok:true,json:async()=>url.endsWith('submission-summary')?summary:items};}});
  vm.runInContext(source,context);
  const w=context.workshop;
  Object.assign(w.S,{room:{code:'ROOM123456',title:'Teste',slide:content.slides[0].id,revision:1,registered:1},role:'presenter',panel:'gallery',galleryScope:'review'});
  return {...w,document,nodes,requests,events,focus(value){form=value?{inPanel:true}:null;},setDirty(value){dirty=value;},setItems(value){items=value;}};
}
test('facilitator gallery explains authorized submissions waiting for approval',async()=>{
  const a=app();await a.loadGallery('gallery');
  assert.match(a.nodes.get('#panel-body').innerHTML,/2 envios? aguard/);
  assert.match(a.nodes.get('#panel-body').innerHTML,/Revisão privada/);
});
test('a room update deferred during review is retried after focus leaves the form',async()=>{
  const a=app();await a.loadGallery('review');a.focus(true);
  a.receiveState({...a.S.room,revision:2});await settle();
  assert.equal(a.requests.filter(x=>x.includes('/submissions?')).length,1);
  a.focus(false);for(const handler of a.events.focusout??[])handler({});await settle();
  assert.equal(a.requests.filter(x=>x.includes('/submissions?')).length,2);
});
test('unsaved review feedback is not discarded by a deferred refresh',async()=>{
  const a=app();await a.loadGallery('review');a.focus(true);a.setDirty(true);
  a.receiveState({...a.S.room,revision:2});a.focus(false);
  for(const handler of a.events.focusout??[])handler({});await settle();
  assert.equal(a.requests.filter(x=>x.includes('/submissions?')).length,1);
});
test('an in-flight background update cannot reopen a panel the facilitator closed',async()=>{
  const a=app();await a.loadGallery('gallery');
  a.receiveState({...a.S.room,revision:2});a.S.panel='';await settle();
  assert.equal(a.S.panel,'');
});

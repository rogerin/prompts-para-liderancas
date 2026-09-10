import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const content=JSON.parse(fs.readFileSync(new URL('../content.json',import.meta.url),'utf8'));
const source=fs.readFileSync(new URL('../static/app.js',import.meta.url),'utf8').replace('  init();','  globalThis.workshop={S,receiveState,useRoom,presentDetail,syncPresentation,secondsLeft,controlTimer,updateCountdown,enableAlarm};');
function app(role='student') {
  const nodes=new Map(),events={},requests=[],intervals=new Set();let now=100000,beeps=0;
  const classList=()=>{const values=new Set();return {add:v=>values.add(v),remove:v=>values.delete(v),contains:v=>values.has(v),toggle(v,on){if(on)values.add(v);else values.delete(v);}};};
  const get=selector=>{if(selector==='#activity-form'||selector.includes('data-dirty'))return null;if(!nodes.has(selector))nodes.set(selector,node());return nodes.get(selector);};
  function node(){return {textContent:'',innerHTML:'',hidden:false,open:false,style:{},dataset:{},classList:classList(),addEventListener(){},querySelector:get,querySelectorAll(){return [];},showModal(){this.open=true;},close(){this.open=false;},setAttribute(k,v){this[k]=v;},contains(){return false;}};}
  const selectors=[...'CLEAR'].map(letter=>({...node(),dataset:{id:letter}}));
  const segments=[...'CLEAR'].map(letter=>({...node(),dataset:{letter}}));
  get('#detail-panel').querySelectorAll=selector=>selector.includes('clear-letter')?selectors:segments;
  const document={querySelector:get,addEventListener(name,handler){(events[name]??=[]).push(handler);},activeElement:null};
  class Clock extends Date {static now(){return now*1000;}}
  class Audio {state='running';currentTime=0;destination={};resume(){return Promise.resolve();}createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){}},connect(){},disconnect(){}};}createOscillator(){return {frequency:{},connect(){},disconnect(){},start(){beeps++;},stop(){}};}}
  let room={code:'ROOM123456',title:'Teste',slide:'entrada',registered:1,version:1,revision:0,presentation:null,activity_timer:null,server_time:now};
  const context=vm.createContext({document,Date:Clock,history:{replaceState(){}},sessionStorage:{setItem(){}},EventSource:class{addEventListener(){}close(){}},window:{WORKSHOP_CONTENT:content,AudioContext:Audio,addEventListener(){},scrollTo(){}},crypto:{randomUUID:()=>`id-${now}`},setTimeout:()=>0,clearTimeout(){},setInterval(fn){intervals.add(fn);return fn;},clearInterval(fn){intervals.delete(fn);},URL,URLSearchParams,File:class{},Blob:class{},console,fetch:async(url,options={})=>{
    if(options.method==='PATCH'){const changes=JSON.parse(options.body);requests.push(changes);room={...room,...changes,version:room.version+1};}
    return {ok:true,json:async()=>room};
  }});
  vm.runInContext(source,context);const w=context.workshop;
  Object.assign(w.S,{role,room:role==='guest'?null:room});
  return {...w,nodes,selectors,segments,requests,intervals,events,now(value){now=value;},beeps:()=>beeps,room:()=>room};
}
test('live cards open and close without replacing a participant activity form',()=>{
  const a=app();a.S.panel='activity';a.nodes.get('#panel').open=true;
  const detail={kind:'card',slide:'entrada',card:0};
  a.receiveState({...a.S.room,version:2,presentation:detail});
  assert.equal(a.nodes.get('#detail-panel').open,true);
  assert.equal(a.nodes.get('#detail-title').textContent,'01 · Contexto');
  assert.equal(a.S.panel,'activity');assert.equal(a.nodes.get('#panel').open,true);
  a.receiveState({...a.S.room,version:3,presentation:null});
  assert.equal(a.nodes.get('#detail-panel').open,false);assert.equal(a.S.panel,'activity');
});
test('local exploration pauses following; returning live restores the selected CLEAR letter',async()=>{
  const a=app();await a.presentDetail({kind:'card',slide:'entrada',card:1});
  assert.equal(a.S.follow,false);assert.equal(a.requests.length,0);
  const room={...a.S.room,version:2,slide:'clear',presentation:{kind:'clear',slide:'clear',letter:'R'}};
  a.receiveState(room);assert.equal(a.nodes.get('#detail-title').textContent,'02 · Evidência');
  a.S.follow=true;a.receiveState(room);a.syncPresentation(room,{force:true});
  assert.equal(a.selectors[4]['aria-pressed'],'true');assert.equal(a.segments[4].classList.contains('highlighted'),true);
  assert.equal(a.segments.filter(s=>s.classList.contains('highlighted')).length,1);
});
test('stale snapshots cannot undo a newer shared selection',()=>{
  const a=app();const room={...a.S.room,version:5,presentation:{kind:'card',slide:'entrada',card:2}};
  a.receiveState(room);a.receiveState({...room,version:4,presentation:null});
  assert.equal(a.nodes.get('#detail-panel').open,true);assert.equal(a.S.room.version,5);
});
test('quick presenter selections are published in order with current versions',async()=>{
  const a=app('presenter');
  await Promise.all([a.presentDetail({kind:'card',slide:'entrada',card:0}),a.presentDetail({kind:'card',slide:'entrada',card:1}),a.presentDetail(null)]);
  assert.deepEqual(a.requests.map(r=>r.version),[1,2,3]);
  assert.equal(a.nodes.get('#detail-panel').open,false);
});
test('deadline compensates for device clock and emits one alarm per run',async()=>{
  const a=app('presenter');await a.enableAlarm();
  a.receiveState({...a.S.room,version:2,server_time:200000,activity_timer:{id:'first',exercise:'baseline',status:'running',ends_at:200002,remaining:180}});
  assert.equal(a.secondsLeft(a.S.room.activity_timer),2);
  a.now(100003);a.updateCountdown();a.updateCountdown();
  assert.equal(a.beeps(),6);assert.equal(a.nodes.get('.timer-digits').textContent,'00:00');
  a.receiveState({...a.S.room,version:3,server_time:200003,activity_timer:{...a.S.room.activity_timer,id:'second',ends_at:200004}});
  a.now(100005);a.updateCountdown();assert.equal(a.beeps(),12);
});
test('study timer pauses, resumes and resets without sending room requests',async()=>{
  const a=app('guest');await a.controlTimer('start','baseline');
  a.now(100020);await a.controlTimer('pause');assert.equal(a.nodes.get('.timer-digits').textContent,'02:40');
  a.now(100120);a.updateCountdown();assert.equal(a.nodes.get('.timer-digits').textContent,'02:40');
  await a.controlTimer('resume');a.now(100280);a.updateCountdown();assert.equal(a.beeps(),6);
  await a.controlTimer('reset');assert.equal(a.nodes.get('#live-timer').hidden,true);assert.equal(a.intervals.size,0);assert.equal(a.requests.length,0);
});

test('joining with a clock ahead of the server does not trigger a premature alarm',async()=>{
  const a=app('presenter');await a.enableAlarm();
  a.useRoom({...a.S.room,server_time:99000,activity_timer:{id:'joined',exercise:'baseline',status:'running',ends_at:99005,remaining:180}});
  assert.equal(a.beeps(),0);assert.equal(a.nodes.get('.timer-digits').textContent,'00:05');
  a.now(100006);a.updateCountdown();assert.equal(a.beeps(),6);
});

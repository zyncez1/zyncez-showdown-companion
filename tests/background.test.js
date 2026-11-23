'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

async function createHarness(){
  const data={};const calls=[];const keys=[];let listener;
  const chrome={runtime:{id:'a'.repeat(32),getURL:(p)=>'chrome-extension://'+'a'.repeat(32)+'/'+p,onMessage:{addListener:fn=>listener=fn}},storage:{local:{
    async setAccessLevel(v){calls.push('lock');assert.equal(v.accessLevel,'TRUSTED_CONTEXTS');},
    async get(names){calls.push('read');const result={};for(const k of Array.isArray(names)?names:[names])result[k]=data[k];return result;},
    async set(values){calls.push('save');Object.assign(data,values);},
    async remove(k){calls.push('remove');delete data[k];}
  }}};
  const context=vm.createContext({chrome,URL,AbortSignal,fetch:async(url,opts)=>{
    calls.push('fetch');keys.push(opts.headers.Authorization);
    return {ok:true,json:async()=>({choices:[{message:{content:'Garchomp is fast.'}}]})};
  }});
  context.globalThis=context;context.self=context;
  context.importScripts=(p)=>vm.runInContext(fs.readFileSync(path.join(__dirname,'..','src',p),'utf8'),context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','src','background.js'),'utf8'),context);
  const sender={id:chrome.runtime.id,frameId:0,tab:{url:'https://play.pokemonshowdown.com/'}};
  const message=(msg,s=sender)=>new Promise(resolve=>listener(msg,s,resolve));
  await new Promise(resolve=>setImmediate(resolve));
  return {message,calls,keys,data};
}

test('storage is locked to trusted contexts, key only saved after user action, no request until Ask',async()=>{
  const h=await createHarness();
  assert.equal(h.calls[0],'lock');
  assert.equal(h.calls.includes('fetch'),false);
  let result=await h.message({type:'ZYNCEZ_GET_SETTINGS'});
  assert.equal(result.hasKey,false);
  result=await h.message({type:'ZYNCEZ_SAVE_SETTINGS',mode:'gpt',model:'openai/gpt-5-mini',key:'sk-or-sample'});
  assert.equal(result.hasKey,true);
  assert.equal(h.calls.includes('fetch'),false);
  assert.equal((await h.message({type:'ZYNCEZ_GET_SETTINGS'})).apiKey,undefined);
  assert.equal(JSON.stringify(await h.message({type:'ZYNCEZ_GET_SETTINGS'})).includes('sk-or-sample'),false);
  result=await h.message({type:'ZYNCEZ_ASK',question:'What now?',state:{},history:[]});
  assert.deepEqual({ok:result.ok,answer:result.answer},{ok:true,answer:'Garchomp is fast.'});
  assert.deepEqual(h.keys,['Bearer sk-or-sample']);
  assert.equal(h.calls.filter(x=>x==='fetch').length,1);
  await h.message({type:'ZYNCEZ_REMOVE_KEY'});
  result=await h.message({type:'ZYNCEZ_ASK',question:'Anything?',state:{},history:[]});
  assert.match(result.error,/save.*key/i);
  assert.equal(h.calls.filter(x=>x==='fetch').length,1);
});

test('rejects messages from unapproved origins and never leaks stored key',async()=>{
  const h=await createHarness();
  const rejected=await h.message({type:'ZYNCEZ_SAVE_SETTINGS',mode:'gpt',model:'openai/gpt-5-mini',key:'secret'},
    {id:'a'.repeat(32),frameId:0,tab:{url:'https://attacker.example/'}});
  assert.equal(rejected.ok,false);
  assert.equal(h.data.zyncezApiKey,undefined);
  const badFrame=await h.message({type:'ZYNCEZ_GET_SETTINGS'},
    {id:'a'.repeat(32),frameId:1,tab:{url:'https://play.pokemonshowdown.com/'}});
  assert.equal(badFrame.ok,false);
});


test('extension toolbar popup can save settings, but cannot initiate AI requests',async()=>{
  const h=await createHarness();
  const popup={id:'a'.repeat(32),url:'chrome-extension://'+'a'.repeat(32)+'/popup.html'};
  const first=await h.message({type:'ZYNCEZ_GET_SETTINGS'},popup);
  assert.equal(first.ok,true);
  const saved=await h.message({type:'ZYNCEZ_SAVE_SETTINGS',mode:'gpt',model:'openai/gpt-5-mini',key:'sk-or-v1-demo'},popup);
  assert.equal(saved.ok,true);
  assert.equal(h.data.zyncezApiKey,'sk-or-v1-demo');
  assert.equal(h.calls.includes('fetch'),false);
  assert.equal((await h.message({type:'ZYNCEZ_GET_SETTINGS'},popup)).hasKey,true);
  const forbidden=await h.message({type:'ZYNCEZ_ASK',question:'attack?',state:{}},popup);
  assert.equal(forbidden.ok,false);
  const fake={id:'a'.repeat(32),url:'chrome-extension://'+'a'.repeat(32)+'/other.html'};
  assert.equal((await h.message({type:'ZYNCEZ_GET_SETTINGS'},fake)).ok,false);
  const removed=await h.message({type:'ZYNCEZ_REMOVE_KEY'},popup);
  assert.equal(removed.ok,true);
  assert.equal(h.data.zyncezApiKey,undefined);
});

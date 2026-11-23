'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

async function createHarness(){
  const data={};const calls=[];const keys=[];const requestBodies=[];let listener;
  const chrome={scripting:{async executeScript({target,world,func,args}) {
    calls.push('game-scan');assert.equal(world,'MAIN');assert.equal(target.tabId,17);
    assert.equal(typeof func,'function');assert.equal(args[0],'battle-test');
    return [{result:{available:true,roomId:'battle-test',myParty:[{name:'Rotom-Wash',moves:['hydropump']}],protocol:[]}}];
  }},runtime:{id:'a'.repeat(32),getURL:(p)=>'chrome-extension://'+'a'.repeat(32)+'/'+p,onMessage:{addListener:fn=>listener=fn}},storage:{local:{
    async setAccessLevel(v){calls.push('lock');assert.equal(v.accessLevel,'TRUSTED_CONTEXTS');},
    async get(names){calls.push('read');const result={};for(const k of Array.isArray(names)?names:[names])result[k]=data[k];return result;},
    async set(values){calls.push('save');Object.assign(data,values);},
    async remove(k){calls.push('remove');delete data[k];}
  }}};
  const context=vm.createContext({chrome,URL,AbortSignal,fetch:async(url,opts)=>{
    calls.push('fetch');keys.push(opts.headers.Authorization);
    if(String(url).includes('/api/v1/models')) return {ok:true,json:async()=>({data:[{id:'openai/gpt-test',name:'GPT Test',pricing:{prompt:'0.000001',completion:'0.000002'}},{id:'qwen/qwen3:free',name:'Qwen Free',pricing:{prompt:'0',completion:'0'}}]})};
    requestBodies.push(JSON.parse(opts.body));
    return {ok:true,json:async()=>({choices:[{message:{content:'Garchomp is fast.'}}]})};
  }});
  context.globalThis=context;context.self=context;
  context.importScripts=(...paths)=>{for(const p of paths) vm.runInContext(fs.readFileSync(path.join(__dirname,'..','src',p),'utf8'),context);};
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','src','background.js'),'utf8'),context);
  const sender={id:chrome.runtime.id,frameId:0,tab:{id:17,url:'https://play.pokemonshowdown.com/'}};
  const message=(msg,s=sender)=>new Promise(resolve=>listener(msg,s,resolve));
  await new Promise(resolve=>setImmediate(resolve));
  return {message,calls,keys,data,requestBodies};
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


test('browsing model catalog is opt-in; changing model never sends an AI query',async()=>{
  const h=await createHarness();
  const start=await h.message({type:'ZYNCEZ_SAVE_SETTINGS',mode:'gpt',model:'openai/gpt-5-mini',key:'sk-or-test'});
  assert.equal(start.ok,true);
  assert.equal(h.calls.filter(x=>x==='fetch').length,0);
  const catalog=await h.message({type:'ZYNCEZ_LIST_MODELS'});
  assert.equal(catalog.ok,true);
  assert.equal(catalog.models.length,2);
  assert.equal(h.calls.filter(x=>x==='fetch').length,1);
  const changed=await h.message({type:'ZYNCEZ_SET_MODEL',model:'qwen/qwen3:free'});
  assert.equal(changed.ok,true);
  assert.equal(changed.model,'qwen/qwen3:free');
  assert.equal(h.calls.filter(x=>x==='fetch').length,1);
  assert.equal((await h.message({type:'ZYNCEZ_GET_SETTINGS'})).model,'qwen/qwen3:free');
  const reply=await h.message({type:'ZYNCEZ_ASK',question:'How do I beat Pikachu?',state:{},history:[]});
  assert.equal(reply.ok,true);
  assert.equal(h.requestBodies.at(-1).model,'qwen/qwen3:free');
  assert.equal(h.calls.filter(x=>x==='fetch').length,2);
});


test('on-demand main-world battle read is separate from and does not trigger OpenRouter',async()=>{
  const h=await createHarness();
  assert.equal(h.calls.includes('game-scan'),false);
  const result=await h.message({type:'ZYNCEZ_READ_GAME',roomId:'battle-test'});
  assert.equal(result.ok,true);
  assert.equal(result.game.myParty[0].moves[0],'hydropump');
  assert.equal(h.calls.includes('game-scan'),true);
  assert.equal(h.calls.includes('fetch'),false);
  const popup={id:'a'.repeat(32),url:'chrome-extension://'+'a'.repeat(32)+'/popup.html'};
  const rejected=await h.message({type:'ZYNCEZ_READ_GAME',roomId:'battle-test'},popup);
  assert.equal(rejected.ok,false);
});


test('personality and reply style persist without starting AI and flow into prompts',async()=>{
  const h=await createHarness();
  let result=await h.message({type:'ZYNCEZ_GET_SETTINGS'});
  assert.equal(result.personality,'friendly');
  assert.equal(result.replyStyle,'natural');
  result=await h.message({type:'ZYNCEZ_SAVE_SETTINGS',mode:'gpt',model:'anthropic/claude-opus-5.5',key:'sample-key',personality:'custom',personalityNotes:'Talk like a chill teammate and explain switches.',replyStyle:'detailed'});
  assert.equal(result.personality,'custom');
  assert.equal(result.replyStyle,'detailed');
  assert.equal(h.calls.includes('fetch'),false);
  const saved=await h.message({type:'ZYNCEZ_GET_SETTINGS'});
  assert.equal(saved.personalityNotes,'Talk like a chill teammate and explain switches.');
  assert.equal(saved.apiKey,undefined);
  await h.message({type:'ZYNCEZ_ASK',question:'What should I do?',state:{battleFound:true},history:[]});
  const prompt=h.requestBodies.at(-1).messages;
  assert.match(prompt[1].content,/chill teammate/);
  assert.match(prompt[1].content,/in-depth and comprehensive/);
  assert.doesNotMatch(JSON.stringify(prompt),/sample-key/);
  // Quick model changes keep personality intact.
  await h.message({type:'ZYNCEZ_SET_MODEL',model:'openai/gpt-5-mini'});
  assert.equal((await h.message({type:'ZYNCEZ_GET_SETTINGS'})).personality,'custom');
});

test('invalid personality values fall back to safe defaults and notes are length-capped',async()=>{
  const h=await createHarness();
  const result=await h.message({type:'ZYNCEZ_SAVE_SETTINGS',mode:'gpt',model:'openai/gpt-5-mini',personality:'unknown-persona',personalityNotes:'Z'.repeat(2000),replyStyle:'crazy'});
  assert.equal(result.personality,'friendly');
  assert.equal(result.replyStyle,'natural');
  assert.equal(result.personalityNotes.length,1600);
});

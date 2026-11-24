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
  assert.equal(result.replyStyle,'short');
  result=await h.message({type:'ZYNCEZ_SAVE_SETTINGS',mode:'gpt',model:'anthropic/claude-opus-5.5',key:'sample-key',personality:'custom',personalityNotes:'Talk like a chill teammate and explain switches.',replyStyle:'long'});
  assert.equal(result.personality,'custom');
  assert.equal(result.replyStyle,'long');
  assert.equal(h.calls.includes('fetch'),false);
  const saved=await h.message({type:'ZYNCEZ_GET_SETTINGS'});
  assert.equal(saved.personalityNotes,'Talk like a chill teammate and explain switches.');
  assert.equal(saved.apiKey,undefined);
  await h.message({type:'ZYNCEZ_ASK',question:'What should I do?',state:{battleFound:true},history:[]});
  const prompt=h.requestBodies.at(-1).messages;
  assert.match(prompt[1].content,/chill teammate/);
  assert.match(prompt[1].content,/Response length: LONG/);
  assert.doesNotMatch(JSON.stringify(prompt),/sample-key/);
  // Quick model changes keep personality intact.
  await h.message({type:'ZYNCEZ_SET_MODEL',model:'openai/gpt-5-mini'});
  assert.equal((await h.message({type:'ZYNCEZ_GET_SETTINGS'})).personality,'custom');
});

test('invalid personality values fall back to safe defaults and notes are length-capped',async()=>{
  const h=await createHarness();
  const result=await h.message({type:'ZYNCEZ_SAVE_SETTINGS',mode:'gpt',model:'openai/gpt-5-mini',personality:'unknown-persona',personalityNotes:'Z'.repeat(2000),replyStyle:'crazy'});
  assert.equal(result.personality,'friendly');
  assert.equal(result.replyStyle,'short');
  assert.equal(result.personalityNotes.length,1600);
});


test('quick reply length switch saves immediately, never sends AI request, preserves key/model/personality',async()=>{
  const h=await createHarness();
  await h.message({type:'ZYNCEZ_SAVE_SETTINGS',mode:'gpt',model:'openai/gpt-5-mini',key:'private',personality:'coach',personalityNotes:'Speak plainly.',replyStyle:'short'});
  const count=h.calls.filter(c=>c==='fetch').length;
  for(const length of ['medium','long','short']){
    const result=await h.message({type:'ZYNCEZ_SET_REPLY_STYLE',replyStyle:length});
    assert.equal(result.ok,true);
    assert.equal(result.replyStyle,length);
    const stored=await h.message({type:'ZYNCEZ_GET_SETTINGS'});
    assert.equal(stored.replyStyle,length);
    assert.equal(stored.personality,'coach');
    assert.equal(stored.personalityNotes,'Speak plainly.');
    assert.equal(stored.model,'openai/gpt-5-mini');
    assert.equal(stored.hasKey,true);
  }
  assert.equal(h.calls.filter(c=>c==='fetch').length,count);
  assert.equal((await h.message({type:'ZYNCEZ_SET_REPLY_STYLE',replyStyle:'summarize-all'})).ok,false);
  assert.equal((await h.message({type:'ZYNCEZ_GET_SETTINGS'})).replyStyle,'short');
  await h.message({type:'ZYNCEZ_SET_REPLY_STYLE',replyStyle:'medium'});
  await h.message({type:'ZYNCEZ_ASK',question:'Best move?',state:{battleFound:true},history:[]});
  assert.match(h.requestBodies.at(-1).messages[1].content,/Response length: MEDIUM/);
});

test('old response styles from v0.9 load as compatible new values',async()=>{
  const h=await createHarness();
  h.data.zyncezReplyStyle='natural';
  assert.equal((await h.message({type:'ZYNCEZ_GET_SETTINGS'})).replyStyle,'medium');
  h.data.zyncezReplyStyle='detailed';
  assert.equal((await h.message({type:'ZYNCEZ_GET_SETTINGS'})).replyStyle,'long');
});

test('appearance preferences save locally with no model fetch or AI request',async()=>{
  const h=await createHarness();
  const first=await h.message({type:'ZYNCEZ_GET_SETTINGS'});
  assert.equal(first.uiPrefs.theme,'midnight');
  assert.equal(first.uiPrefs.height,'regular');
  assert.equal(first.uiPrefs.position.x,1);
  const changed=await h.message({type:'ZYNCEZ_SET_UI_PREFS',prefs:{theme:'light',accent:'teal',width:'wide',height:'short',font:'large',bubble:'small',opacity:86,position:{x:0.2,y:0.65}}});
  assert.equal(changed.ok,true);
  assert.equal(changed.uiPrefs.theme,'light');
  assert.equal(changed.uiPrefs.position.x,0.2);
  assert.equal(changed.uiPrefs.position.y,0.65);
  assert.equal((await h.message({type:'ZYNCEZ_GET_SETTINGS'})).uiPrefs.height,'short');
  assert.equal(h.calls.includes('fetch'),false);
});

test('appearance input is sanitized; malicious CSS and invalid coordinates are discarded',async()=>{
  const h=await createHarness();
  const bad=await h.message({type:'ZYNCEZ_SET_UI_PREFS',prefs:{theme:'url(javascript:evil)',accent:'javascript:red',height:'enormous',opacity:-100,position:{x:600,y:-600},token:'private'}});
  assert.equal(bad.uiPrefs.theme,'midnight');
  assert.equal(bad.uiPrefs.accent,'violet');
  assert.equal(bad.uiPrefs.height,'regular');
  assert.equal(bad.uiPrefs.opacity,78);
  assert.equal(bad.uiPrefs.position.x,1);
  assert.equal(bad.uiPrefs.position.y,0);
  assert.equal(bad.uiPrefs.token,undefined);
  assert.equal(JSON.stringify(bad.uiPrefs).includes('javascript'),false);
});

test('appearance preferences do not change API key, model, personality or reply length',async()=>{
  const h=await createHarness();
  await h.message({type:'ZYNCEZ_SAVE_SETTINGS',mode:'gpt',model:'anthropic/claude-opus-5.5',key:'mock-key',personality:'coach',replyStyle:'long'});
  await h.message({type:'ZYNCEZ_SET_UI_PREFS',prefs:{width:'compact',bubble:'large'}});
  const state=await h.message({type:'ZYNCEZ_GET_SETTINGS'});
  assert.equal(state.model,'anthropic/claude-opus-5.5');
  assert.equal(state.personality,'coach');
  assert.equal(state.replyStyle,'long');
  assert.equal(state.hasKey,true);
  assert.equal(h.calls.filter(x=>x==='fetch').length,0);
});

test('recommendation appearance preference defaults to fancy, persists, and never calls OpenRouter on save',async()=>{
  const h=await createHarness();
  assert.equal((await h.message({type:'ZYNCEZ_GET_SETTINGS'})).uiPrefs.recommendationStyle,'fancy');
  await h.message({type:'ZYNCEZ_SET_UI_PREFS',prefs:{recommendationStyle:'compact'}});
  assert.equal((await h.message({type:'ZYNCEZ_GET_SETTINGS'})).uiPrefs.recommendationStyle,'compact');
  await h.message({type:'ZYNCEZ_SET_UI_PREFS',prefs:{recommendationStyle:'plain'}});
  assert.equal((await h.message({type:'ZYNCEZ_GET_SETTINGS'})).uiPrefs.recommendationStyle,'plain');
  await h.message({type:'ZYNCEZ_SET_UI_PREFS',prefs:{recommendationStyle:'<script>'}});
  assert.equal((await h.message({type:'ZYNCEZ_GET_SETTINGS'})).uiPrefs.recommendationStyle,'fancy');
  assert.equal(h.calls.includes('fetch'),false);
});

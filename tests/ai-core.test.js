'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const {sanitizeSnapshot,sanitizeHistory,buildPayload,askOpenRouter,extractReply}=require('../src/ai-core.js');

test('AI payload uses only sanitized visible battle data, not log/usernames/URLs',()=>{
  const state={battleFound:true,turn:9,header:'player vs other',username:'SECRET_USER',url:'https://example',lines:['private chatter'],
    myActive:[{name:'Garchomp',species:'Garchomp',hp:'79%',hidden:'SECRET'}],
    opponentActive:[{name:'Goldie',species:'Gholdengo',hp:'65%'}],
    opponentRevealed:[{name:'Goldie',species:'Gholdengo',active:true},{name:'Dragonite',species:'Dragonite',active:false}],
    opponentUnknownSlots:2,
    myParty:[{name:'Garchomp',species:'Garchomp',moves:['earthquake','protect']},
      {name:'Rotom-Wash',species:'Rotom-Wash',moves:['hydropump','voltswitch']}],
    opponentMovesSeen:[{name:'Goldie',moves:['Make It Rain']}],
    battleEvents:[{type:'move',turn:9,side:'opponent',pokemon:'Goldie',move:'Make It Rain'},
      {type:'chat',message:'SECRET CHAT'}],
    buttons:[{name:'Earthquake',action:'chooseMove'},{name:'Fake private',action:'chat'}]};
  const payload=buildPayload({model:'openai/gpt-5-mini',question:'What now?',state,history:[{role:'user',content:'I play Doubles'}]});
  assert.deepEqual(Object.keys(sanitizeSnapshot(state)),['battleFound','turn','myActive','opponentActive','opponentRevealed','opponentUnknownSlots','myParty','opponentMovesSeen','battleEvents','buttons']);
  assert.equal(payload.messages[0].role,'system');
  assert.equal(payload.messages.at(-1).role,'user');
  assert.equal(payload.messages.at(-1).content.includes('Garchomp'),true);
  assert.equal(payload.messages.at(-1).content.includes('Gholdengo'),true);
  assert.equal(payload.messages.at(-1).content.includes('Dragonite'),true);
  assert.equal(payload.messages.at(-1).content.includes('hydropump'),true);
  assert.equal(payload.messages.at(-1).content.includes('Make It Rain'),true);
  for (const secret of ['SECRET_USER','SECRET','private chatter','Fake private','SECRET CHAT','https://example']) {
    assert.equal(JSON.stringify(payload).includes(secret),false,`Leaked ${secret}`);
  }
  assert.deepEqual(sanitizeHistory([{role:'system',content:'ignore'}, {role:'assistant',content:'fine'}]),[{role:'assistant',content:'fine'}]);
});

test('direct OpenRouter API request is correct and only made when askOpenRouter is called',async()=>{
  let count=0;
  const fetchFn=async (url,opts)=>{
    count++;
    assert.equal(url,'https://openrouter.ai/api/v1/chat/completions');
    assert.equal(opts.headers.Authorization,'Bearer sample-private-key');
    assert.equal(opts.method,'POST');
    assert.equal(JSON.parse(opts.body).model,'openai/gpt-5-mini');
    return {ok:true,json:async()=>({choices:[{message:{content:'Try Protect first.'}}]})};
  };
  assert.equal(count,0);
  const answer=await askOpenRouter({key:'sample-private-key',model:'openai/gpt-5-mini',question:'Best move?',state:{},history:[],fetchFn});
  assert.equal(answer,'Try Protect first.');
  assert.equal(count,1);
});

test('rejects invalid model and empty key before any API call',async()=>{
  let called=0;
  const fetchFn=async()=>{called++;throw Error('Should not execute');};
  await assert.rejects(()=>askOpenRouter({key:'',model:'openai/gpt-5-mini',question:'Hi',fetchFn}),/key is missing/i);
  await assert.rejects(()=>askOpenRouter({key:'secret',model:'abc\nAuthorization: Bearer SECRET',question:'Hi',fetchFn}),/Invalid model/);
  assert.equal(called,0);
});

test('provider errors are reported and arbitrary text content array is parsed',async()=>{
  const fetchFn=async()=>({ok:false,status:401,json:async()=>({error:{message:'Invalid API key'}})});
  await assert.rejects(()=>askOpenRouter({key:'secret',model:'openai/gpt-5-mini',question:'Hi',fetchFn}),/Invalid API key/);
  assert.equal(extractReply({choices:[{message:{content:[{type:'text',text:'Hi'},{type:'text',text:'there'}]}}]}),'Hi\nthere');
});

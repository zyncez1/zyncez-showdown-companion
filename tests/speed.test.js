'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const S=require('../src/speed.js');
const {enrichState}=require('../src/battle-state.js');
const AI=require('../src/ai-core.js');
const {capture}=require('../src/game-capture.js');

test('gen 9 level-50 min/max Speed with nature EV and IV range',()=>{
  assert.deepEqual(S.opponentRange(100,50),{min:94,max:167});
  assert.equal(S.statAtLevel(100,50,31,252,1.1),167);
  assert.equal(S.opponentRange(null,50),null);
});

test('Speed stage, Tailwind and Trick Room act on equal-priority speed order',()=>{
  assert.equal(S.stageStat(100,1),150);
  assert.equal(S.stageStat(100,-1),66);
  assert.equal(S.modifySpeed(100,{speedStage:1},{gen:9},{tailwind:true}).speed,300);
  assert.equal(S.compare({estimatedSpeed:110},{range:{min:120,max:167}},false),'after');
  assert.equal(S.compare({estimatedSpeed:110},{range:{min:120,max:167}},true),'before');
  assert.equal(S.compare({estimatedSpeed:120},{range:{min:120,max:167}},false),'uncertain');
});

test('modern paralysis, Quick Feet, Scarf, and weather speed abilities',()=>{
  assert.equal(S.modifySpeed(160,{status:'par'},{gen:9},{tailwind:false}).speed,80);
  assert.equal(S.modifySpeed(160,{status:'par'},{gen:6},{tailwind:false}).speed,40);
  assert.equal(S.modifySpeed(160,{status:'par',ability:'Quick Feet'},{gen:9},{tailwind:false}).speed,240);
  assert.equal(S.modifySpeed(160,{item:'Choice Scarf'},{gen:9},{tailwind:false}).speed,240);
  assert.equal(S.modifySpeed(160,{ability:'Swift Swim'},{gen:9,weather:'RainDance'},{tailwind:false}).speed,320);
  assert.equal(S.modifySpeed(160,{ability:'Chlorophyll'},{gen:9,weather:'SunnyDay'},{tailwind:false}).speed,320);
});

test('uncertain opponent ranges produce uncertain answer, not guaranteed outspeed',()=>{
  const state={battleConditions:{generation:9,weather:'',trickRoom:false,tailwind:{mine:false,opponent:false}},
    myActive:[{name:'Glaceon',species:'Glaceon',speedStage:0}],
    myParty:[{name:'Glaceon',species:'Glaceon',speed:90,active:true}],
    opponentActive:[{name:'Chien-Pao',species:'Chien-Pao',level:75,baseSpeed:135,speedStage:0}]};
  const result=S.analyze(state);
  assert.equal(result.myActive[0].estimatedSpeed,90);
  assert.equal(result.matchups[0].order,'after');
  assert(result.opponentActive[0].range.min>90);
  state.opponentActive[0].baseSpeed=null;
  assert.equal(S.analyze(state).matchups[0].order,'unknown');
});

test('Doubles speed comparisons include both active Pokémon and Tailwind sides',()=>{
 const state={battleConditions:{generation:9,tailwind:{mine:true,opponent:false},trickRoom:false},
  myActive:[{name:'Pika',species:'Pikachu'},{name:'Eevee',species:'Eevee'}],
  myParty:[{name:'Pika',species:'Pikachu',speed:120},{name:'Eevee',species:'Eevee',speed:60}],
  opponentActive:[{name:'Enemy A',species:'Garchomp',baseSpeed:102,level:50},
    {name:'Enemy B',species:'Snorlax',baseSpeed:30,level:50}]};
  const r=S.analyze(state);
  assert.equal(r.myActive[0].estimatedSpeed,240);
  assert.equal(r.myActive[1].estimatedSpeed,120);
  assert.equal(r.matchups.length,4);
  assert(r.matchups.some(m=>m.mine==='Pikachu'&&m.opponent==='Garchomp'&&m.order==='before'));
});

test('sanitized payload includes only vetted Speed numbers, no raw logs or account information',()=>{
  const state={battleFound:true,myActive:[{name:'Glaceon',species:'Glaceon',speedStage:1}],
    battleConditions:{generation:9,weather:'rain',terrain:'',trickRoom:false,tailwind:{mine:true,opponent:false},private:'SECRET'},
    speedAnalysis:{myActive:[{name:'Glaceon',species:'Glaceon',rawSpeed:100,estimatedSpeed:300,modifiers:['Tailwind x2'],hidden:'SECRET'}],
      opponentActive:[{name:'Dnite',species:'Dragonite',level:50,baseSpeed:80,range:{min:60,max:145},hidden:'SECRET'}],
      matchups:[{mine:'Glaceon',opponent:'Dragonite',order:'before',secret:'SECRET'}],
      limits:['Only at equal priority'],secret:'SECRET'},username:'SECRET',chat:'SECRET'};
  const sanitized=AI.sanitizeSnapshot(state),payload=AI.buildPayload({state,model:'openai/gpt-5-mini',question:'Who goes first?'});
  assert.equal(sanitized.speedAnalysis.myActive[0].estimatedSpeed,300);
  assert.equal(sanitized.speedAnalysis.opponentActive[0].range.max,145);
  assert(!JSON.stringify(payload).includes('SECRET'));
  assert.match(payload.messages[0].content,/Trick Room reverses same-priority Speed order/);
});

test('enrichment retains speed, boosts, full team, and trick-room conditions',()=>{
 const input={battleFound:true,myActive:[{name:'Pika',species:'Pikachu',hp:'100%'}],
   opponentActive:[{name:'Opponent',species:'Garchomp',hp:'82%'}],opponentRevealed:[]};
 const result=enrichState(input,{available:true,myParty:[{name:'Pika',species:'Pikachu',speed:155,level:50,moves:['quickattack']}],
   myActive:[{name:'Pika',species:'Pikachu',speedStage:1,level:50}],
   opponentActive:[{name:'Opponent',species:'Garchomp',speedStage:-1,baseSpeed:102,level:50}],
   battleConditions:{generation:9,trickRoom:true,tailwind:{mine:false,opponent:true}},protocol:[]});
 assert.equal(result.myParty[0].speed,155);
 assert.equal(result.myActive[0].speedStage,1);
 assert.equal(result.opponentActive[0].baseSpeed,102);
 assert.equal(result.battleConditions.trickRoom,true);
 assert.equal(S.analyze(result).matchups.length,1);
});

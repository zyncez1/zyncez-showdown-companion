'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Decision=require('../src/decision-engine.js');
const {sanitizeSnapshot,buildPayload}=require('../src/ai-core.js');

function battle(overrides={}){
  const your={name:'Arcanine',species:'Arcanine',types:['Fire'],hp:'100%'};
  return {
    battleFound:true,turn:4,playerRequestType:'move',playerTrapped:[false],
    myActive:[your],opponentActive:[{name:'Ferrothorn',species:'Ferrothorn',types:['Grass','Steel'],hp:'85%'}],
    myParty:[{slot:1,...your,active:true,currentMoves:[
      {name:'Flamethrower',type:'Fire',category:'Special',basePower:90,accuracy:100,priority:0,target:'normal',pp:15},
      {name:'Bite',type:'Dark',category:'Physical',basePower:60,accuracy:100,priority:0,target:'normal',pp:12},
      {name:'Protect',category:'Status',priority:4,target:'self',pp:10}
    ]}],
    opponentMovesSeen:[{name:'Ferrothorn',moves:['Power Whip']}],
    opponentMoveDetails:[{name:'Power Whip',type:'Grass',basePower:120,category:'Physical'}],
    opponentRevealed:[{name:'Ferrothorn',species:'Ferrothorn',active:true}],
    opponentUnknownSlots:2,
    speedAnalysis:{matchups:[{mine:'Arcanine',opponent:'Ferrothorn',order:'before'}]},
    ...overrides
  };
}

test('evaluates observed type effectiveness and avoids an ineffective attack',()=>{
  const result=Decision.analyze(battle(),'What is my best move?');
  assert.equal(result.status,'evaluated');
  assert.match(result.recommendedPlay,/Flamethrower into Ferrothorn/);
  assert.match(result.reasons.join(' '),/strong.*typing/i);
  assert.match(result.principle,/NOT exact damage/i);
  assert.equal('score' in result,false,'Never send raw ranking scores to the model');
});

test('cannot pick a disabled or exhausted move even when the type is best',()=>{
  const b=battle();
  b.myParty[0].currentMoves[0].pp=0;
  const out=Decision.analyze(b,'best play?');
  assert.doesNotMatch(out.recommendedPlay,/Flamethrower/);
  b.myParty[0].currentMoves[0].pp=3;
  b.myParty[0].currentMoves[0].disabled=true;
  assert.doesNotMatch(Decision.analyze(b,'best play?').recommendedPlay,/Flamethrower/);
});

test('uses confirmed player choice state rather than recommending a move while waiting',()=>{
  const b=battle({playerRequestType:'wait'});
  const out=Decision.analyze(b,'best move?');
  assert.equal(out.status,'not-actionable');
  const missing=battle();missing.myParty[0].currentMoves=[];
  assert.equal(Decision.analyze(missing,'best move?').status,'insufficient');
});

test('does not choose a switch if the player slot is trapped',()=>{
  const b=battle({playerTrapped:[true]});
  b.myParty.push({name:'Heatran',species:'Heatran',types:['Fire','Steel'],hp:'100%',active:false,slot:2});
  const choices=Decision.makeCandidates(b.myActive[0],0,b,b.opponentActive,b.myParty.slice(1));
  assert.equal(choices.some(x=>x.kind==='switch'),false);
});

test('recognizes forced-switch states and does not propose attacks',()=>{
  const b=battle({playerRequestType:'switch'});
  b.myParty.push({name:'Heatran',species:'Heatran',types:['Fire','Steel'],hp:'100%',active:false,slot:2});
  const choices=Decision.makeCandidates(b.myActive[0],0,b,b.opponentActive,b.myParty.slice(1));
  assert.ok(choices.length>0);
  assert.ok(choices.every(x=>x.kind==='switch'));
});

test('opponent scenarios use revealed evidence and mark hypothetical protects honestly',()=>{
  const b=battle();
  assert.equal(Decision.scenarios(b).some(x=>x.id==='protect'),false);
  b.opponentMovesSeen[0].moves.push('Protect');
  const protect=Decision.scenarios(b).find(x=>x.id==='protect');
  assert.equal(protect.observed,true);
  assert.match(protect.label,/revealed/i);
  b.opponentMovesSeen[0].moves=['Power Whip'];
  b.opponentActive[0].hp='22%';
  const unknown=Decision.scenarios(b).find(x=>x.id==='protect');
  assert.equal(unknown.observed,false);
  assert.match(unknown.label,/unconfirmed/i);
});

test('ally spread damage is strongly penalized unless the ally Protects',()=>{
  const b=battle();
  b.myActive=[{name:'Garchomp',species:'Garchomp',types:['Ground','Dragon'],hp:'100%'},{name:'Lucario',species:'Lucario',types:['Steel','Fighting'],hp:'100%'}];
  b.opponentActive=[{name:'Gholdengo',species:'Gholdengo',types:['Steel','Ghost'],hp:'100%'}];
  b.myParty=[{slot:1,...b.myActive[0],active:true,currentMoves:[{name:'Earthquake',type:'Ground',category:'Physical',basePower:100,priority:0,target:'allAdjacent',pp:10}]},
    {slot:2,...b.myActive[1],active:true,currentMoves:[{name:'Protect',category:'Status',target:'self',priority:4,pp:10}]}];
  const quake={actor:'Garchomp',actorIndex:0,kind:'attack',move:'Earthquake',moveType:'Ground',target:'',targeting:{hitsAlly:true}};
  const attack={actor:'Lucario',actorIndex:1,kind:'attack',move:'Close Combat',moveType:'Fighting',target:'Gholdengo',targeting:{hitsAlly:false}};
  const protect={actor:'Lucario',actorIndex:1,kind:'protect',move:'Protect',target:'',targeting:{hitsAlly:false}};
  const harmful=Decision.jointBonus([quake,attack],b);
  const safe=Decision.jointBonus([quake,protect],b);
  assert.ok(harmful.points<safe.points-15);
  assert.match(harmful.notes.join(' '),/ally|allied/i);
  assert.equal(Decision.analyze(b,'best doubles play').status,'evaluated');
});

test('deduplicates the same benched Pokemon across both Doubles switch actions',()=>{
  const b=battle();
  b.myActive=[{name:'Arcanine',species:'Arcanine',types:['Fire'],hp:'100%'},{name:'Glaceon',species:'Glaceon',types:['Ice'],hp:'100%'}];
  b.myParty=[...b.myParty,{name:'Glaceon',species:'Glaceon',types:['Ice'],slot:2,active:true,currentMoves:[{name:'Protect',target:'self',priority:4,pp:10}]},
  {name:'Milotic',species:'Milotic',types:['Water'],slot:3,active:false,hp:'100%'}];
  b.playerRequestType='switch';
  assert.equal(Decision.analyze(b,'best play?').status,'insufficient',
    'Only one available reserve cannot cover two simultaneous forced switches');
  b.myParty.push({name:'Vaporeon',species:'Vaporeon',types:['Water'],slot:4,active:false,hp:'100%'});
  const out=Decision.analyze(b,'best play?');
  assert.equal(out.status,'evaluated');
  assert.equal(out.actions.length,2);
  assert.equal(new Set(out.actions.map(a=>a.target)).size,2);
});

test('typing immunity is a severe negative unless another known move works',()=>{
  const b=battle({opponentActive:[{name:'Gengar',species:'Gengar',types:['Ghost','Poison'],hp:'100%'}],opponentRevealed:[]});
  b.myParty[0].currentMoves=[
    {name:'Extreme Speed',type:'Normal',category:'Physical',basePower:80,accuracy:100,priority:2,target:'normal',pp:5},
    {name:'Bite',type:'Dark',category:'Physical',basePower:60,accuracy:100,priority:0,target:'normal',pp:10}];
  assert.match(Decision.analyze(b,'best move').recommendedPlay,/Bite/);
});

test('silent logic is not attached to greetings, only explicit tactical requests',()=>{
  const b=battle();
  assert.equal(Decision.analyze(b,'hey, how are you?'),null);
  assert.equal(Decision.isTacticalQuestion('what should I do this turn?'),true);
  assert.equal(Decision.isTacticalQuestion('my cat is cute'),false);
});

test('sanitizer allows only compact decision evidence, not heuristics or unrelated chat',()=>{
  const b=battle();
  b.decisionSupport={...Decision.analyze(b,'best move'),score:999999,privateReasoning:'DO NOT SEND',
    messages:[{role:'system',content:'SECRET'}]};
  const safe=sanitizeSnapshot(b);
  assert.equal(safe.decisionSupport.status,'evaluated');
  assert.equal(safe.decisionSupport.recommendedPlay.includes('Flamethrower'),true);
  assert.equal(JSON.stringify(safe).includes('DO NOT SEND'),false);
  assert.equal(JSON.stringify(safe).includes('999999'),false);
  assert.equal(JSON.stringify(safe).includes('SECRET'),false);
  assert.match(buildPayload({model:'openai/gpt-5-mini',question:'Best play?',state:b}).messages[0].content,/Do NOT display the layers/);
});

test('the engine has bounded candidate search and leaves direct OpenRouter calls unchanged',()=>{
  const b=battle();
  b.myParty[0].currentMoves=Array.from({length:80},(_,i)=>({name:'Move '+i,type:'Fire',category:'Physical',basePower:60,target:'normal',pp:10}));
  assert.ok(Decision.makeCandidates(b.myActive[0],0,b,b.opponentActive,[]).length<=10);
  const payload=buildPayload({model:'openai/gpt-5-mini',question:'Hi!',state:b});
  assert.equal(payload.model,'openai/gpt-5-mini');
  assert.equal(payload.stream,false);
});

test('recent Protect use is penalized, unlike a Protect used long ago',()=>{
  const b=battle();
  b.myActive[0].hp='20%';
  const none=Decision.makeCandidates(b.myActive[0],0,b,b.opponentActive,[])
    .find(x=>x.kind==='protect').score;
  b.battleEvents=[{side:'mine',turn:3,type:'move',pokemon:'Arcanine',move:'Protect'}];
  const repeat=Decision.makeCandidates(b.myActive[0],0,b,b.opponentActive,[])
    .find(x=>x.kind==='protect').score;
  assert.ok(none-repeat>=10);
});

test('the tactical snapshot preserves typed legal moves, speed and decision support without exposing raw scores',()=>{
  const b=battle();
  b.decisionSupport=Decision.analyze(b,'Best move?');
  const s=sanitizeSnapshot(b);
  assert.equal(s.myParty[0].types[0],'Fire');
  assert.equal(s.myParty[0].currentMoves[0].type,'Fire');
  assert.equal(s.myParty[0].currentMoves[0].basePower,90);
  assert.equal(s.opponentActive[0].types[0],'Grass');
  assert.equal(s.decisionSupport.recommendedPlay,b.decisionSupport.recommendedPlay);
  assert.equal(s.decisionSupport.calculation.includes('tactical heuristics'),true);
  assert.equal(JSON.stringify(s.decisionSupport).includes('score'),false);
});

'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const Justification=require('../src/justification-engine.js');
const {buildPayload,sanitizeSnapshot}=require('../src/ai-core.js');
const project=path.resolve(__dirname,'..');
function setup(){
  const sandbox=vm.createContext({window:{}});
  for(const file of ['vendor/smogon-calc/data.min.js','vendor/smogon-calc/calc.min.js',
      'src/types.js','src/damage-engine.js','src/justification-engine.js','src/decision-engine.js']){
    vm.runInContext(fs.readFileSync(path.join(project,file),'utf8'),sandbox,{filename:file});
  }
  return sandbox.window;
}
function state(){
  const mine={name:'Garchomp',species:'Garchomp',types:['Dragon','Ground'],hp:'100%',level:50};
  const foe={name:'Gholdengo',species:'Gholdengo',types:['Steel','Ghost'],hp:'90%',level:50};
  return {battleFound:true,turn:5,playerRequestType:'move',myActive:[mine],opponentActive:[foe],
    opponentRevealed:[{...foe,active:true}],opponentUnknownSlots:3,
    myParty:[{...mine,active:true,stats:{atk:182},ability:'Rough Skin',currentMoves:[
      {name:'Earthquake',type:'Ground',category:'Physical',basePower:100,accuracy:100,priority:0,pp:10,target:'allAdjacent'},
      {name:'Dragon Claw',type:'Dragon',category:'Physical',basePower:80,accuracy:100,priority:0,pp:15,target:'normal'},
      {name:'Protect',type:'Normal',category:'Status',pp:10,target:'self',priority:4}
    ]}],
    opponentMovesSeen:[{name:'Gholdengo',moves:['Make It Rain']}],
    opponentMoveDetails:[{name:'Make It Rain',type:'Steel',category:'Special',basePower:120,priority:0}],
    speedAnalysis:{matchups:[{mine:'Garchomp',opponent:'Gholdengo',order:'after'}]},
    battleConditions:{generation:9,weather:'',tailwind:{mine:false,opponent:false},screens:{mine:{},opponent:{}}},
    battleEvents:[{type:'move',side:'opponent',turn:4,pokemon:'Gholdengo',move:'Make It Rain'}]};
}
test('justification rejects an action absent from the real current move menu',()=>{
  const s=state();
  const j=Justification.build({state:s,choice:{actions:[{actor:'Garchomp',kind:'attack',move:'Fire Blast',target:'Gholdengo'}]}});
  assert.equal(j.valid,false);
  assert.match(j.reason,/no longer available/);
});
test('justification explains a tradeoff and potential reversals without exposing scores',()=>{
  const s=state();
  const choice={actions:[{actor:'Garchomp',kind:'attack',move:'Earthquake',order:'after',target:'Gholdengo',targeting:{hitsAlly:true},
    damageTargets:[{target:'Gholdengo',minPercent:65,maxPercent:95,koUnderAssumptions:'possible'}]}]};
  const alternative={actions:[{actor:'Garchomp',kind:'protect',move:'Protect'}]};
  const out=Justification.build({state:s,choice,alternative,scenarios:[{id:'protect',label:'Opponent could Protect'},{id:'switch',label:'Opponent switches'}]});
  assert.equal(out.valid,true);
  assert.match(out.evidence.join(' '),/65–95% modeled/);
  assert.match(out.comparedWith,/offensive pressure|initiative/);
  assert.match(out.changeMyMindIf.join(' '),/Protect/);
  assert.match(out.changeMyMindIf.join(' '),/switch/i);
  assert.equal(out.checks.allySafety,'spread move threatens ally unless protected or immune');
  assert.equal(JSON.stringify(out).includes('conservativeScore'),false);
});
test('a real on-demand tactical question connects Smogon damage to GPT in one answer request',()=>{
  const w=setup(),s=state();
  s.decisionSupport=w.ZyncezDecision.analyze(s,'What is my best move?');
  assert.equal(s.decisionSupport.status,'evaluated');
  assert.equal(s.decisionSupport.justification.valid,true);
  assert.equal(s.decisionSupport.justification.checks.legalMoves,true);
  const sanitized=sanitizeSnapshot(s);
  assert.equal(sanitized.decisionSupport.justification.valid,true);
  assert.ok(sanitized.decisionSupport.justification.evidence.length);
  const req=buildPayload({model:'openai/gpt-5-mini',question:'What is my best move?',state:s,history:[],preferences:{replyStyle:'short'}});
  assert.match(req.messages[0].content,/integrated tactical assessment/);
  const data=JSON.parse(req.messages.at(-1).content.split('Current on-demand battle snapshot (partial JSON):\n')[1]);
  assert.equal(data.decisionSupport.status,'evaluated');
  assert.ok(data.decisionSupport.justification.evidence.some(x=>x.includes('modeled damage')));
  assert.ok(data.decisionSupport.actions.length);
  assert.ok(!JSON.stringify(req).includes('conservativeScore'));
});
test('revealed enemy moves can flag dangerous retaliation; unknown sets stay unknown',()=>{
  const w=setup(),s=state();
  s.myActive[0].hp='12%';s.myParty[0].hp='12%';
  const ctx=w.ZyncezDamage.createContext(s);
  const known=w.ZyncezDecision.revealedThreat(s.myActive[0],s.opponentActive,s,ctx);
  assert.match(known.source,/Make It Rain/);
  assert.ok(known.risk>0);
  s.opponentMovesSeen=[];
  assert.equal(w.ZyncezDecision.revealedThreat(s.myActive[0],s.opponentActive,s,w.ZyncezDamage.createContext(s)).level,'unknown');
});
test('the engine does not invent a reply to an ordinary greeting',()=>{
  const w=setup();
  assert.equal(w.ZyncezDecision.analyze(state(),'Hey, what is up?'),null);
});
test('revealed attack and real HP can change the recommendation, instead of blindly choosing max damage',()=>{
  const w=setup(),s=state();
  s.myActive[0].hp='12%';s.myParty[0].hp='12%';
  s.opponentMovesSeen=[];
  const unobserved=w.ZyncezDecision.analyze(s,'best play');
  assert.equal(unobserved.status,'evaluated');
  assert.match(unobserved.recommendedPlay,/Earthquake/);
  s.opponentMovesSeen=[{name:'Gholdengo',moves:['Make It Rain']}];
  const observed=w.ZyncezDecision.analyze(s,'best play');
  assert.equal(observed.status,'evaluated');
  assert.match(observed.recommendedPlay,/Protect/);
  assert.ok(observed.justification.evidence.some(x=>x.includes('Make It Rain')));
  assert.ok(observed.actions.some(x=>x.incomingThreat.includes('Make It Rain')));
  const req=buildPayload({model:'openai/gpt-5-mini',question:'Best play?',state:{...s,decisionSupport:observed},history:[]});
  assert.match(req.messages.at(-1).content,/Make It Rain/);
  assert.doesNotMatch(req.messages.at(-1).content,/conservativeScore/);
});

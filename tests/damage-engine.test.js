'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
function setup() {
  const window={};
  const sandbox=vm.createContext({window});
  for(const file of ['vendor/smogon-calc/data.min.js','vendor/smogon-calc/calc.min.js',
      'src/types.js','src/damage-engine.js','src/justification-engine.js','src/decision-engine.js']) {
    vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),sandbox,{filename:file});
  }
  return window;
}
function battle() {
  const my={name:'Garchomp',species:'Garchomp',level:50,types:['Dragon','Ground'],hp:'100%',boosts:{spe:0}};
  const foe={name:'Gholdengo',species:'Gholdengo',level:50,types:['Steel','Ghost'],hp:'90%',boosts:{}};
  const quake={name:'Earthquake',type:'Ground',category:'Physical',basePower:100,accuracy:100,target:'allAdjacent',priority:0,pp:10};
  return {battleFound:true,turn:3,battleConditions:{generation:9,weather:'',screens:{mine:{},opponent:{}},tailwind:{mine:false,opponent:false}},
    myActive:[my],opponentActive:[foe],myParty:[{name:'Garchomp',species:'Garchomp',level:50,
      ability:'Rough Skin',active:true,stats:{atk:182},currentMoves:[quake,{name:'Dragon Claw',type:'Dragon',category:'Physical',basePower:80,target:'normal',pp:15,accuracy:100,priority:0}]}],
    playerRequestType:'move',opponentMovesSeen:[],battleEvents:[]};
}
test('bundled calculator supplies Pokémon, moves, and data for generation nine',()=>{
  const w=setup();const g=w.calc.Generations.get(9);
  assert.equal(g.species.get('garchomp').name,'Garchomp');
  assert.equal(g.moves.get('earthquake').basePower,100);
  assert.equal(typeof w.calc.calculate,'function');
});
test('engine gives plausible bounded 16-roll damage ranges without claiming hidden sets are known',()=>{
  const w=setup(),s=battle();
  const output=w.ZyncezDamage.damageEstimate(s,s.myActive[0],s.opponentActive[0],s.myParty[0].currentMoves[0]);
  assert.equal(output.available,true);
  assert.equal(output.engine,'@smogon/calc');
  assert.ok(output.minPercent>50 && output.minPercent<output.maxPercent && output.maxPercent<250);
  assert.equal(output.approximate,true);
  assert.match(output.assumptions.join(' '),/Enemy HP\/defensive EVs/);
  assert.notEqual(output.koUnderAssumptions,'guaranteed');
});
test('Doubles spread attack is weaker than Singles against the same Pokémon',()=>{
  const w=setup(),s=battle(),move=s.myParty[0].currentMoves[0];
  const one=w.ZyncezDamage.damageEstimate(s,s.myActive[0],s.opponentActive[0],move,{isDoubles:false});
  const two=w.ZyncezDamage.damageEstimate(s,s.myActive[0],s.opponentActive[0],move,{isDoubles:true});
  assert.ok(two.maxPercent<one.maxPercent);
});
test('revealed Levitate makes Ground damage zero and does not suggest a fake KO',()=>{
  const w=setup(),s=battle();s.opponentActive[0]={name:'Rotom-Wash',species:'Rotom-Wash',level:50,types:['Electric','Water'],hp:'100%',ability:'Levitate'};
  const out=w.ZyncezDamage.damageEstimate(s,s.myActive[0],s.opponentActive[0],s.myParty[0].currentMoves[0]);
  assert.equal(out.available,true);
  assert.equal(out.maxPercent,0);
  assert.equal(out.koUnderAssumptions,'none');
});
test('unknown generation and unsupported attacks explicitly say unavailable',()=>{
  const w=setup(),s=battle();s.battleConditions.generation=null;
  let out=w.ZyncezDamage.damageEstimate(s,s.myActive[0],s.opponentActive[0],s.myParty[0].currentMoves[0]);
  assert.equal(out.available,false);
  s.battleConditions.generation=9;
  out=w.ZyncezDamage.damageEstimate(s,s.myActive[0],s.opponentActive[0],{name:'Swords Dance'});
  assert.equal(out.available,false);
});
test('cache avoids recalculating the same on-demand matchup and enforces a budget',()=>{
  const w=setup(),s=battle(),ctx=w.ZyncezDamage.createContext(s,1),mv=s.myParty[0].currentMoves[0];
  assert.equal(ctx.read(s.myActive[0],s.opponentActive[0],mv).available,true);
  assert.equal(ctx.read(s.myActive[0],s.opponentActive[0],mv).available,true);
  assert.equal(ctx.stats().computed,1);assert.equal(ctx.stats().hits,1);
  assert.equal(ctx.read(s.myActive[0],s.opponentActive[0],{name:'Dragon Claw'}).available,false);
});
test('tactical engine includes compact calculated damage for single-target move',()=>{
  const w=setup(),s=battle();
  const out=w.ZyncezDecision.analyze(s,'What is my best move?');
  assert.equal(out.status,'evaluated');
  assert.equal(out.calculation.includes('@smogon/calc'),true);
  assert.ok(out.actions.some(a=>a.damageTargets?.length));
  assert.ok(!JSON.stringify(out).includes('hiddenMoveList'));
});
test('Doubles keeps separate damage ranges for both opponent targets',()=>{
  const w=setup(),s=battle();s.myActive.push({name:'Rotom-Wash',species:'Rotom-Wash',level:50,types:['Electric','Water'],hp:'100%'});
  s.myParty.push({name:'Rotom-Wash',species:'Rotom-Wash',level:50,active:true,stats:{spa:140},currentMoves:[{name:'Thunderbolt',type:'Electric',category:'Special',basePower:90,pp:10,priority:0,target:'normal'}]});
  s.opponentActive.push({name:'Dragonite',species:'Dragonite',level:50,types:['Dragon','Flying'],hp:'100%'});
  const out=w.ZyncezDecision.analyze(s,'What should I do?');
  assert.equal(out.status,'evaluated');
  assert.equal(out.actions.length,2);
  assert.equal(out.calculation.includes('@smogon/calc'),true);
});
test('in-personality chat remains separate from calculation metadata',()=>{
  const w=setup();const s=battle();const result=w.ZyncezDecision.analyze(s,'best move');
  assert.equal(result.status,'evaluated');
  assert.equal(typeof result.recommendedPlay,'string');
  assert.equal(result.actions[0].score,undefined);
});

'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../src/game-capture.js'),'utf8');
function runCapture({ps={},app={}}={}){
  const context=vm.createContext({window:{PS:ps,app},self:{},module:{exports:{}},Object,Number,Array,String});
  vm.runInContext(source,context);
  return context.module.exports.capture;
}
test('reads full own team and move IDs even when only one Pokemon is active',()=>{
  const room={id:'battle-gen9ou-123',battle:{
    nearSide:{active:[{name:'Garchomp',speciesForme:'Garchomp',hp:100,maxhp:100,status:''}]},
    farSide:{n:1,active:[{name:'Goldie',speciesForme:'Gholdengo',hp:60,maxhp:100,status:''}],pokemon:[{name:'Goldie',speciesForme:'Gholdengo'}]},
    stepQueue:['|turn|4','|move|p2a: Goldie|Make It Rain|p1a: Garchomp','|c|User|Hello','|player|p1|SecretName']
  },request:{side:{pokemon:[
    {ident:'p1a: Garchomp',details:'Garchomp, L50, M',condition:'100/100',active:true,moves:['earthquake','protect','rockslide','swordsdance'],item:'clearamulet',baseAbility:'roughskin'},
    {ident:'p1b: Washer',details:'Rotom-Wash, L50',condition:'100/100',active:false,moves:['hydropump','voltswitch','protect','willowisp'],item:'sitrusberry',baseAbility:'levitate'}
  ]},active:[{moves:[{name:'Earthquake',pp:10,maxpp:10,target:'allAdjacent'}]}]}};
  const capture=runCapture({ps:{rooms:{'battle-gen9ou-123':room},room}});
  const out=capture('battle-gen9ou-123');
  assert.equal(out.available,true);
  assert.equal(out.myParty.length,2);
  assert.equal(out.myParty[1].species,'Rotom-Wash');
  assert.equal(out.myParty[1].moves.length,4);
  assert.equal(out.opponentActive[0].species,'Gholdengo');
  assert.equal(out.activeMoves[0].moves[0].pp,10);
  assert.equal(out.protocol.length,2);
  assert.equal(JSON.stringify(out).includes('SecretName'),false);
  assert.equal(JSON.stringify(out).includes('Hello'),false);
});
test('prefers focused battle when other battle tabs exist; no guessing if absent',()=>{
  const a={id:'battle-one',battle:{stepQueue:[],farSide:{n:1}}};
  const b={id:'battle-two',battle:{stepQueue:[],farSide:{n:0}}};
  const capture=runCapture({ps:{room:b,rooms:{'battle-one':a,'battle-two':b}}});
  assert.equal(capture('').roomId,'battle-two');
  assert.equal(capture('battle-one').roomId,'battle-one');
  assert.equal(runCapture({})('battle-unknown').available,false);
});

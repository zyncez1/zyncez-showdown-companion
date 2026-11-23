'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {parseIcon,parseHistory,mergeKnown}=require('../src/battle-state.js');

test('reads revealed species and aliases from Showdown opponent team icons',()=>{
  assert.deepEqual(parseIcon('Goldie (Gholdengo) (active)'),{name:'Goldie',species:'Gholdengo',active:true,fainted:false,source:'sidebar'});
  assert.equal(parseIcon('Not revealed'),null);
  assert.equal(parseIcon('Unrevealed Illusion user'),null);
  assert.equal(parseIcon('Pikachu (fainted)').fainted,true);
});
test('does not mistake arbitrary user chat for an opponent switch',()=>{
  const entries=parseHistory(['You: sent out Mewtwo!','Opponent sent out Dragonite!','Go! Pikachu!','Battle started between You and Opponent!'],'Opponent');
  assert.deepEqual(entries.map(x=>x.species),['Dragonite']);
});
test('opponent seen earlier remains listed after switching out',()=>{
  const first=mergeKnown([], [parseIcon('Gholdengo (active)')],[],[{name:'Gholdengo'}],2);
  const second=mergeKnown(first,[parseIcon('Dragonite (active)')],[],[{name:'Dragonite'}],3);
  assert.equal(second.find(p=>p.species==='Gholdengo').active,false);
  assert.equal(second.find(p=>p.species==='Dragonite').active,true);
  assert.equal(second.length,2);
});
test('doubles lists both active opponents and preserves extra revealed bench',()=>{
  const list=mergeKnown([parseIcon('Tyranitar')],[parseIcon('Garchomp (active)'),parseIcon('Rotom-Wash')],[],[{name:'Garchomp'},{name:'Rotom-Wash'}],4);
  assert.deepEqual(list.filter(p=>p.active).map(p=>p.species).sort(),['Garchomp','Rotom-Wash']);
  assert.equal(list.find(p=>p.species==='Tyranitar').active,false);
});

test('structured Showdown battle protocol tracks moves, switches and statuses without chat',()=>{
  const {parseProtocol}=require('../src/battle-state.js');
  const entries=parseProtocol([
    '|player|p1|SomeUsername|1',
    '|c|p2|This is an ordinary chat message',
    '|turn|3',
    '|move|p2a: Goldie|Make It Rain|p1a: Garchomp',
    '|-damage|p1a: Garchomp|43/100',
    '|switch|p2a: Dnite|Dragonite, L50|100/100',
    '|-status|p2a: Dnite|par',
    '|turn|4',
    '|move|p1a: Garchomp|Earthquake|p2a: Dnite'
  ],'p2');
  assert.deepEqual(entries.filter(e=>e.type==='move').map(e=>[e.side,e.pokemon,e.move,e.turn]),
    [['opponent','Goldie','Make It Rain',3],['mine','Garchomp','Earthquake',4]]);
  assert.equal(entries.some(e=>JSON.stringify(e).includes('SomeUsername')||JSON.stringify(e).includes('ordinary chat')),false);
  assert.equal(entries.find(e=>e.type==='switch').detail,'Dragonite');
  assert.equal(entries.find(e=>e.type==='-status').detail,'par');
});

test('enriches own whole team including benched moves and revealed enemy moves',()=>{
  const {enrichState}=require('../src/battle-state.js');
  const state={battleFound:true,turn:4,myActive:[{name:'Garchomp',species:'Garchomp'}],
    opponentActive:[{name:'Goldie',species:'Gholdengo'}],opponentRevealed:[{name:'Goldie',species:'Gholdengo',active:true}],
    buttons:[]};
  const game={available:true,opponentSideId:'p2',myParty:[
    {slot:1,name:'Garchomp',species:'Garchomp',active:true,moves:['earthquake','protect','rockslide','swordsdance'],hp:'100/100'},
    {slot:2,name:'Rotom-Wash',species:'Rotom-Wash',active:false,moves:['hydropump','voltswitch','willowisp','protect'],hp:'100/100'}
  ],activeMoves:[{slot:1,moves:[{name:'Earthquake',pp:10,maxpp:10,disabled:false,target:'allAdjacent'}]}],
    myActive:[{name:'Garchomp',species:'Garchomp'}],
    protocol:['|turn|4','|move|p2a: Goldie|Make It Rain|p1a: Garchomp','|move|p1a: Garchomp|Protect|p1a: Garchomp']};
  const out=enrichState(state,game);
  assert.equal(out.myParty.length,2);
  assert.deepEqual(out.myParty[1].moves,['hydropump','voltswitch','willowisp','protect']);
  assert.deepEqual(out.opponentMovesSeen,[{name:'Goldie',moves:['Make It Rain']}]);
  assert.deepEqual(out.opponentRevealed[0].movesSeen,['Make It Rain']);
  assert.equal(out.myParty[0].currentMoves[0].pp,10);
});

test('battle enrichment carries real stats and known screens through to damage evaluator',()=>{
  const {enrichState}=require('../src/battle-state.js');
  const state={battleFound:true,myActive:[{name:'Garchomp',species:'Garchomp'}],opponentActive:[{name:'Gholdengo',species:'Gholdengo'}],opponentRevealed:[]};
  const game={available:true,myParty:[{name:'Garchomp',species:'Garchomp',active:true,stats:{atk:182,def:115},moves:['earthquake']}],
    myActive:[{name:'Garchomp',species:'Garchomp',boosts:{atk:1}}],
    battleConditions:{generation:9,screens:{mine:{reflect:true},opponent:{lightScreen:true}}},protocol:[]};
  const out=enrichState(state,game);
  assert.equal(out.myParty[0].stats.atk,182);
  assert.equal(out.myActive[0].boosts.atk,1);
  assert.equal(out.battleConditions.screens.opponent.lightScreen,true);
});

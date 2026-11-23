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

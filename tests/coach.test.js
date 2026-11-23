const assert = require('node:assert/strict');
const test = require('node:test');
const types = require('../src/types');
const {analyze} = require('../src/coach');
test('dual types multiply',()=>{assert.equal(types.multiplier('Fire',['Grass','Steel']),4);assert.equal(types.multiplier('Electric',['Water','Ground']),0);assert.equal(types.multiplier('Fighting',['Normal','Ghost']),0);});
test('invalid input not guessed',()=>{assert.equal(types.multiplier('laser',['Grass']),null);assert.equal(types.multiplier('Fire',['unknown']),null);});
test('no best move hallucination',()=>{const c={};const s={battleFound:true,buttons:[],pokemon:[],lines:[]};assert.match(analyze('best move',s,c),/need the opponent/i);analyze('set opponent type water flying',s,c);assert.match(analyze('best move',s,c),/cannot choose a reliable best move/i);});
test('explicit type matchup',()=>{assert.match(analyze('fire vs grass steel',{battleFound:false},{opponentTypes:[]}),/4×/);});

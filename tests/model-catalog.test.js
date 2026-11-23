'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const models=require('../src/model-catalog.js');

test('normalizes model names, costs, free status and rejects invalid entries',()=>{
  const result=models.normalizeCatalog({data:[
    {id:'openai/gpt-test',name:'GPT Test',pricing:{prompt:'0.000001',completion:'0.000002'}},
    {id:'sample/free:free',name:'Sample Free',pricing:{prompt:'0',completion:'0'}},
    {id:'sample/free:free',name:'duplicate',pricing:{prompt:'1',completion:'1'}},
    {id:'invalid model name',pricing:{prompt:'0',completion:'0'}},
    {id:'sample/unknown',pricing:{}},
  ]});
  assert.equal(result.length,3);
  assert.equal(result[0].promptPerMillion,1);
  assert.equal(result[0].completionPerMillion,2);
  assert.equal(result[0].free,false);
  assert.equal(result[1].free,true);
  assert.equal(result[2].free,false);
  assert.match(models.displayCost(result[1]),/Free/);
  assert.match(models.displayCost(result[0]),/\$1.*\$2/);
});

test('search catalog and filter Free without changing model or sending AI requests',()=>{
  const list=models.normalizeCatalog({data:[
    {id:'openai/gpt-test',name:'GPT Test',pricing:{prompt:'0.000001',completion:'0.000002'}},
    {id:'anthropic/claude-test',name:'Claude Test',pricing:{prompt:'0.000002',completion:'0.000004'}},
    {id:'qwen/qwen3:free',name:'Qwen Free',pricing:{prompt:'0',completion:'0'}}
  ]});
  assert.equal(models.filterCatalog(list,'Claude').length,1);
  assert.equal(models.filterCatalog(list,'',true).length,1);
  assert.equal(models.filterCatalog(list,'gpt',true).length,0);
  assert.deepEqual(models.recentModels('qwen/qwen3:free',['openai/gpt-test','qwen/qwen3:free']).slice(0,2), ['qwen/qwen3:free','openai/gpt-test']);
});

test('cannot silently treat unknown or incomplete pricing as free',()=>{
  assert.equal(models.normalizeCatalog({data:[{id:'x/y',pricing:{prompt:'0'}}]})[0].free,false);
  assert.throws(()=>models.normalizeCatalog({data:null}),/model list/i);
});

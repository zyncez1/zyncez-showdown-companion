/* Validated OpenRouter model-catalog data; never includes API keys. */
(function (root) {
  'use strict';
  const LIST_ENDPOINT='https://openrouter.ai/api/v1/models?limit=1000&sort=most-popular&endpoints=%2Fapi%2Fv1%2Fchat%2Fcompletions';
  const MODEL_ID=/^[a-zA-Z0-9_.:/-]{2,150}$/;
  function normalizeCatalog(json) {
    if (!Array.isArray(json?.data)) throw new Error('OpenRouter did not return a model list.');
    const seen=new Set();
    return json.data.slice(0,1000).flatMap(m=>{
      if (!m || typeof m.id!=='string' || !MODEL_ID.test(m.id) || seen.has(m.id)) return [];
      seen.add(m.id);
      const p=Number(m.pricing?.prompt),c=Number(m.pricing?.completion);
      const costKnown=m.pricing?.prompt!=null && m.pricing?.completion!=null && Number.isFinite(p) && Number.isFinite(c) && p>=0 && c>=0;
      return [{id:m.id,name:String(m.name||m.id).slice(0,105),
        promptPerMillion:costKnown?Math.round(p*1e6*10000)/10000:null,
        completionPerMillion:costKnown?Math.round(c*1e6*10000)/10000:null,
        free:costKnown && p===0 && c===0}];
    });
  }
  function displayCost(m) {
    if (m.free) return 'Free';
    if (m.promptPerMillion==null || m.completionPerMillion==null) return 'Pricing unavailable';
    const dollar=n=>'$'+n.toLocaleString('en-US',{maximumFractionDigits:4});
    return `${dollar(m.promptPerMillion)} in / ${dollar(m.completionPerMillion)} out per 1M tokens`;
  }
  function filterCatalog(models,query='',onlyFree=false,limit=60) {
    const q=String(query).trim().toLowerCase();
    return models.filter(m=>(!onlyFree||m.free) && (!q||`${m.name} ${m.id}`.toLowerCase().includes(q))).slice(0,limit);
  }
  function recentModels(current,history=[]) {
    return Array.from(new Set([current,...(Array.isArray(history)?history:[]),'openai/gpt-5-mini']
      .filter(v=>typeof v==='string'&&MODEL_ID.test(v)))).slice(0,8);
  }
  const api={LIST_ENDPOINT,normalizeCatalog,displayCost,filterCatalog,recentModels};
  if (typeof module!=='undefined' && module.exports) module.exports=api;
  if (root) root.ZyncezModels=api;
})(typeof self!=='undefined'?self:globalThis);

(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const form = $('settings-form');
  const key = $('key'), model = $('model'), mode = $('mode');
  const notice = $('notice'), status = $('connection'), help = $('key-help');
  const save = $('save'), remove = $('remove');
  const personality=$('personality'), personalityNotes=$('personality-notes'), replyStyle=$('reply-style');
  const recent=$('recent-models'),browse=$('browse-models'),picker=$('model-picker');
  const search=$('model-search'),free=$('model-free'),results=$('model-results'),count=$('model-count');
  let hasKey = false, catalog=null, recentIds=[];
  function message(text, error=false) { notice.textContent=text; notice.classList.toggle('error',error); }
  function updateStatus() {
    status.textContent=hasKey?'Key saved':'No key';
    help.textContent=hasKey?'✓ Key saved in this browser. Leave blank to keep your existing key.':'Enter your OpenRouter API key once. It won’t show here after saving.';
  }
  function busy(value) { save.disabled=value; remove.disabled=value; }
  function renderRecent(selected) {
    recent.replaceChildren();
    for (const id of ZyncezModels.recentModels(selected,recentIds)) {
      const option=document.createElement('option');option.value=id;option.textContent=id;recent.appendChild(option);
    }
    recent.value=selected;
  }
  function renderCatalog() {
    if (!catalog) return;
    const found=ZyncezModels.filterCatalog(catalog,search.value,free.checked);
    const total=ZyncezModels.filterCatalog(catalog,search.value,free.checked,1000).length;
    count.textContent=`${total} matching models${total>found.length?' · showing first '+found.length:''}. Prices are estimates from OpenRouter.`;
    results.replaceChildren();
    for (const item of found) {
      const button=document.createElement('button');button.type='button';button.className='model-result';
      const name=document.createElement('strong');name.textContent=item.name;
      const id=document.createElement('small');id.textContent=item.id;
      const cost=document.createElement('small');cost.textContent=ZyncezModels.displayCost(item);
      button.append(name,id,cost);
      if (item.id===model.value) button.classList.add('selected');
      button.addEventListener('click',()=>chooseModel(item.id));
      results.appendChild(button);
    }
    if (!found.length) results.textContent='No matching models. Try another search.';
  }
  async function chooseModel(id) {
    try {
      const r=await request({type:'ZYNCEZ_SET_MODEL',model:id});
      model.value=r.model;recentIds=r.recentModels;renderRecent(r.model);
      message(`✓ Now using ${r.model}. No AI request was sent.`);
      renderCatalog();
      picker.hidden=true;browse.textContent='🔎 Browse OpenRouter models';
    } catch(error) {message(error.message,true);}
  }

  async function request(data) {
    const reply=await chrome.runtime.sendMessage(data);
    if (!reply?.ok) throw new Error(reply?.error || 'Extension could not save settings.');
    return reply;
  }
  async function load() {
    try {
      const reply=await request({type:'ZYNCEZ_GET_SETTINGS'});
      mode.value=reply.mode;
      model.value=reply.model;
      recentIds=reply.recentModels||[];renderRecent(reply.model);
      hasKey=reply.hasKey;
      personality.value=reply.personality||'friendly';
      personalityNotes.value=reply.personalityNotes||'';
      replyStyle.value=reply.replyStyle||'short';
      updateStatus();
    } catch (error) {message(error.message,true);status.textContent='Error';}
  }
  form.addEventListener('submit',async (event)=>{
    event.preventDefault();busy(true);message('Saving…');
    try {
      const reply=await request({type:'ZYNCEZ_SAVE_SETTINGS',mode:mode.value,model:model.value.trim(),key:key.value.trim(),personality:personality.value,personalityNotes:personalityNotes.value,replyStyle:replyStyle.value});
      hasKey=reply.hasKey;key.value='';recentIds=ZyncezModels.recentModels(reply.model,recentIds);renderRecent(reply.model);updateStatus();message('✓ Settings and personality saved. Open Pokémon Showdown and ask your question!');
    } catch (error) {message(error.message,true);}
    finally {key.value='';busy(false);}
  });
  remove.addEventListener('click',async()=>{
    busy(true);message('Removing key…');
    try {await request({type:'ZYNCEZ_REMOVE_KEY'});key.value='';hasKey=false;updateStatus();message('Saved API key removed.');}
    catch(error){message(error.message,true);}
    finally{busy(false);}
  });
  recent.addEventListener('change',()=>chooseModel(recent.value));
  search.addEventListener('input',renderCatalog);
  free.addEventListener('change',renderCatalog);
  browse.addEventListener('click',async()=>{
    if (!picker.hidden) {picker.hidden=true;browse.textContent='🔎 Browse OpenRouter models';return;}
    picker.hidden=false;browse.textContent='Close model browser';
    if (catalog) {renderCatalog();search.focus();return;}
    count.textContent='Loading OpenRouter catalog (only because you clicked Browse)…';
    try {const r=await request({type:'ZYNCEZ_LIST_MODELS'});catalog=r.models;renderCatalog();search.focus();}
    catch(error) {count.textContent=error.message;message(error.message,true);}
  });
  $('show-key').addEventListener('click',()=>{
    key.type=key.type==='password'?'text':'password';$('show-key').textContent=key.type==='password'?'Show':'Hide';
  });
  load();
})();

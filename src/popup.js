(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const form = $('settings-form');
  const key = $('key'), model = $('model'), mode = $('mode');
  const notice = $('notice'), status = $('connection'), help = $('key-help');
  const save = $('save'), remove = $('remove');
  const personality=$('personality'), personalityNotes=$('personality-notes'), replyStyle=$('reply-style');
  const recent=$('recent-models');
  let hasKey = false, recentIds=[];
  function message(text, error=false) { notice.textContent=text; notice.classList.toggle('error',error); }
  function updateStatus() {
    status.textContent=hasKey?'Key saved':'No key';
    help.textContent=hasKey?'✓ Key saved in this browser. Leave blank to keep your existing key.':'Enter your OpenRouter API key once. It won’t show here after saving.';
  }
  function busy(value) { save.disabled=value; remove.disabled=value; }
  function renderRecent(selected) {
    recent.replaceChildren();
    for (const entry of ZyncezModels.offlineOptions(selected,recentIds)) {
      const option=document.createElement('option');option.value=entry.id;
      option.textContent=entry.name+' · '+entry.provider;
      recent.appendChild(option);
    }
    recent.value=selected;
  }
  async function chooseModel(id) {
    try {
      const r=await request({type:'ZYNCEZ_SET_MODEL',model:id});
      model.value=r.model;recentIds=r.recentModels;renderRecent(r.model);
      message('✓ Model saved. No AI call was made.');
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
  $('show-key').addEventListener('click',()=>{
    key.type=key.type==='password'?'text':'password';$('show-key').textContent=key.type==='password'?'Show':'Hide';
  });
  load();
})();

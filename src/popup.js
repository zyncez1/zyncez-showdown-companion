(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const form = $('settings-form');
  const key = $('key'), model = $('model'), mode = $('mode');
  const notice = $('notice'), status = $('connection'), help = $('key-help');
  const save = $('save'), remove = $('remove');
  let hasKey = false;
  function message(text, error=false) { notice.textContent=text; notice.classList.toggle('error',error); }
  function updateStatus() {
    status.textContent=hasKey?'Key saved':'No key';
    help.textContent=hasKey?'✓ Key saved in this browser. Leave blank to keep your existing key.':'Enter your OpenRouter API key once. It won’t show here after saving.';
  }
  function busy(value) { save.disabled=value; remove.disabled=value; }
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
      hasKey=reply.hasKey;
      updateStatus();
    } catch (error) {message(error.message,true);status.textContent='Error';}
  }
  form.addEventListener('submit',async (event)=>{
    event.preventDefault();busy(true);message('Saving…');
    try {
      const reply=await request({type:'ZYNCEZ_SAVE_SETTINGS',mode:mode.value,model:model.value.trim(),key:key.value.trim()});
      hasKey=reply.hasKey;key.value='';updateStatus();message('✓ Settings saved. Open Pokémon Showdown and ask your question!');
    } catch (error) {message(error.message,true);}
    finally {key.value='';busy(false);}
  });
  remove.addEventListener('click',async()=>{
    busy(true);message('Removing key…');
    try {await request({type:'ZYNCEZ_REMOVE_KEY'});key.value='';hasKey=false;updateStatus();message('Saved API key removed.');}
    catch(error){message(error.message,true);}
    finally{busy(false);}
  });
  $('show-key').addEventListener('click',()=>{
    key.type=key.type==='password'?'text':'password';$('show-key').textContent=key.type==='password'?'Show':'Hide';
  });
  load();
})();

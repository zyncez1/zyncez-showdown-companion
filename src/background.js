/* Keys remain in trusted extension storage, and API requests happen only on Send. */
'use strict';
importScripts('ai-core.js');

// chrome.storage.local normally allows content-script reads. Deny them before reading/writing secrets.
const storageLocked=chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'})
  .catch(()=>{throw new Error('This browser cannot protect extension key storage. Please update Chrome or Opera.');});
const SETTINGS=['zyncezApiKey','zyncezModel','zyncezMode'];
function allowedSender(sender, type) {
  if (sender.id !== chrome.runtime.id) return false;
  // Extension popup can manage settings, but must never initiate AI requests.
  if (!sender.tab && sender.url === chrome.runtime.getURL('popup.html')) {
    return ['ZYNCEZ_GET_SETTINGS','ZYNCEZ_SAVE_SETTINGS','ZYNCEZ_REMOVE_KEY'].includes(type);
  }
  if (sender.frameId !== 0) return false;
  try {
    const url=new URL(sender.tab?.url || sender.url);
    return url.protocol==='https:' && ['play.pokemonshowdown.com','pokemonshowdown.com'].includes(url.hostname);
  } catch { return false; }
}
async function handle(msg) {
  await storageLocked;
  if (msg.type==='ZYNCEZ_GET_SETTINGS') {
    const s=await chrome.storage.local.get(SETTINGS);
    return {ok:true,mode:s.zyncezMode==='local'?'local':'gpt',model:s.zyncezModel||ZyncezAI.DEFAULT_MODEL,hasKey:!!s.zyncezApiKey};
  }
  if (msg.type==='ZYNCEZ_SAVE_SETTINGS') {
    const mode=msg.mode==='local'?'local':'gpt';
    const model=String(msg.model||'').trim();
    if (!ZyncezAI.validModel(model)) throw new Error('Enter a valid OpenRouter model ID.');
    const newKey=typeof msg.key==='string'?msg.key.trim():'';
    if (newKey.length>512) throw new Error('API key is too long.');
    const settings={zyncezMode:mode,zyncezModel:model};
    if (newKey) settings.zyncezApiKey=newKey;
    await chrome.storage.local.set(settings);
    return {ok:true,mode,model,hasKey:newKey?true:!!(await chrome.storage.local.get('zyncezApiKey')).zyncezApiKey};
  }
  if (msg.type==='ZYNCEZ_REMOVE_KEY') {
    await chrome.storage.local.remove('zyncezApiKey');
    return {ok:true,hasKey:false};
  }
  if (msg.type==='ZYNCEZ_ASK') {
    const s=await chrome.storage.local.get(SETTINGS);
    if (s.zyncezMode==='local') throw new Error('AI mode is off. Enable it in ⚙ Settings.');
    if (!s.zyncezApiKey) throw new Error('Save your OpenRouter API key in ⚙ Settings first.');
    const answer=await ZyncezAI.askOpenRouter({key:s.zyncezApiKey,model:s.zyncezModel||ZyncezAI.DEFAULT_MODEL,question:msg.question,state:msg.state,history:msg.history});
    return {ok:true,answer};
  }
  return {ok:false,error:'Unknown extension action.'};
}
chrome.runtime.onMessage.addListener((msg,sender,respond)=>{
  if (!msg || !['ZYNCEZ_GET_SETTINGS','ZYNCEZ_SAVE_SETTINGS','ZYNCEZ_REMOVE_KEY','ZYNCEZ_ASK'].includes(msg.type)) return false;
  if (!allowedSender(sender,msg.type)) {respond({ok:false,error:'Only the Zyncez extension and Pokémon Showdown messenger can send requests.'});return false;}
  Promise.resolve().then(()=>handle(msg)).then(respond,error=>respond({ok:false,error:error?.message||'Extension request failed.'}));
  return true;
});

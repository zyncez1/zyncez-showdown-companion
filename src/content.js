(() => {
  'use strict';
  if (document.getElementById('zyncez-companion-host')) return;
  const host=document.createElement('div');host.id='zyncez-companion-host';
  host.style.cssText='position:fixed;right:20px;bottom:20px;z-index:2147483647;pointer-events:none';
  const shadow=host.attachShadow({mode:'closed'});
  document.documentElement.appendChild(host);
  const styles=document.createElement('style');styles.textContent=`
    *{box-sizing:border-box} .launcher,.panel{pointer-events:auto;font-family:system-ui,-apple-system,Segoe UI,sans-serif}
    .launcher{display:block;margin-left:auto;width:58px;height:58px;border:0;border-radius:50%;background:#6155df;color:white;font-size:25px;box-shadow:0 6px 24px #12132a77;cursor:pointer}
    .panel{width:min(385px,calc(100vw - 24px));height:min(555px,calc(100vh - 90px));background:#151827;color:#f4f4ff;border:1px solid #444766;border-radius:16px;box-shadow:0 12px 48px #0009;display:flex;flex-direction:column;overflow:hidden;margin-bottom:10px}
    .hidden{display:none!important}.header{display:flex;align-items:center;justify-content:space-between;padding:13px 14px;background:#242640;border-bottom:1px solid #41435c;user-select:none}
    .title{font-weight:750;font-size:15px}.sub{font-size:11px;color:#bbbcdc}.controls{display:flex;gap:6px}.controls button,.settings button{border:1px solid #545775;border-radius:8px;background:#343651;color:white;padding:5px 8px;cursor:pointer}
    .messages{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;white-space:pre-wrap;overflow-wrap:anywhere}
    .bubble{border-radius:13px;padding:10px 12px;font-size:13px;line-height:1.45;max-width:94%}.bot{background:#292c45;align-self:flex-start}.user{background:#5145b8;align-self:flex-end}
    .footer{padding:9px;border-top:1px solid #41435c;display:flex;gap:7px}.footer input{background:#24263c;border:1px solid #525570;border-radius:9px;color:#fff;padding:10px;flex:1;min-width:0;outline-offset:2px}
    .send{background:#6658ea;border:0;color:white;border-radius:9px;padding:0 13px;font-weight:700;cursor:pointer}.send:disabled{opacity:.5}.hint{font-size:10px;padding:0 12px 9px;color:#a9abc6}
    .settings{padding:13px;border-bottom:1px solid #41435c;background:#1e2035;font-size:12px;line-height:1.5;overflow-y:auto;max-height:65%}.settings label{display:block;margin:4px 0}.settings select,.settings input{display:block;width:100%;margin:5px 0 10px;padding:9px;background:#282a45;border:1px solid #545775;border-radius:8px;color:white}
    .settings p{font-size:11px;color:#c6c8e0;margin:8px 0}.settings a{color:#b6c8ff}.settings .actions{display:flex;gap:7px;align-items:center}.settings .save{background:#6155df;padding:8px 12px}.settings .remove{padding:8px 12px}.message-status{min-height:16px}
    button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #a9baff;outline-offset:2px}`;
  shadow.appendChild(styles);
  const panel=document.createElement('section');panel.className='panel hidden';panel.setAttribute('aria-label','Zyncez AI chat');
  panel.innerHTML=`
    <div class="header"><div><div class="title">⚡ Zyncez AI Companion</div><div class="sub" data-status>Checking settings…</div></div>
      <div class="controls"><button type="button" data-settings title="AI settings">⚙</button><button type="button" data-refresh title="Read battle status locally">↻</button><button type="button" data-clear title="Clear chat">Clear</button><button type="button" data-close title="Minimize">−</button></div></div>
    <div class="settings hidden" data-settings-pane>
      <label for="zyncez-mode">Chat mode</label>
      <select id="zyncez-mode" data-mode><option value="gpt">OpenRouter AI (on Send only)</option><option value="local">Local commands (free)</option></select>
      <label for="zyncez-model">OpenRouter model ID</label>
      <input id="zyncez-model" data-model type="text" maxlength="150" autocomplete="off" spellcheck="false" value="openai/gpt-5-mini"/>
      <label for="zyncez-key">Your OpenRouter API key</label>
      <input id="zyncez-key" data-key type="password" maxlength="512" autocomplete="off" spellcheck="false" placeholder="Paste your sk-or-… key here"/>
      <p data-key-status>No key saved yet.</p>
      <div class="actions"><button type="button" class="save" data-save>Save settings</button><button type="button" class="remove" data-remove>Remove key</button></div>
      <p class="message-status" data-saved></p>
      <p><a href="https://openrouter.ai/settings/keys" target="_blank" rel="noreferrer noopener">Get an OpenRouter API key</a>. A saved key stays in this browser profile, not in your ZIP or Git repo. Anyone with access to your browser profile may be able to recover it. API usage can cost money.</p>
    </div>
    <div class="messages" role="log" aria-live="polite"></div>
    <form class="footer"><input type="text" maxlength="700" autocomplete="off" aria-label="Message Zyncez" placeholder="Ask anything about your battle..."/><button type="submit" class="send">Send</button></form>
    <div class="hint">OpenRouter is contacted only when you press Send. ↻ reads locally. No automatic moves. Follow tournament rules.</div>`;
  const launcher=document.createElement('button');launcher.className='launcher';launcher.type='button';launcher.setAttribute('aria-label','Toggle Zyncez companion');launcher.textContent='⚡';
  shadow.append(panel,launcher);
  const messages=panel.querySelector('.messages'),input=panel.querySelector('.footer input'),sendButton=panel.querySelector('.send'),status=panel.querySelector('[data-status]');
  const settingsPane=panel.querySelector('[data-settings-pane]'),modeSelect=panel.querySelector('[data-mode]'),modelInput=panel.querySelector('[data-model]'),keyInput=panel.querySelector('[data-key]');
  const keyStatus=panel.querySelector('[data-key-status]'),saved=panel.querySelector('[data-saved]');
  const context={opponentTypes:[]};
  let mode='gpt',hasKey=false,busy=false,history=[];
  function add(who,txt){const bubble=document.createElement('div');bubble.className='bubble '+who;bubble.textContent=txt;messages.appendChild(bubble);messages.scrollTop=messages.scrollHeight;return bubble;}
  function updateStatus(){status.textContent=busy?'AI · thinking…':mode==='local'?'Local · idle':hasKey?'OpenRouter · ready when you ask':'AI · add key in browser toolbar or ⚙';keyStatus.textContent=hasKey?'✓ API key saved in this browser. Leave the box blank to keep it.':'No OpenRouter API key saved yet.';}
  async function request(message) {return await chrome.runtime.sendMessage(message);}
  async function loadSettings() {
    try {
      const data=await request({type:'ZYNCEZ_GET_SETTINGS'});
      if (!data?.ok) throw new Error(data?.error||'Could not read settings.');
      mode=data.mode;hasKey=data.hasKey;modeSelect.value=mode;modelInput.value=data.model;updateStatus();if(!hasKey && mode==='gpt') settingsPane.classList.remove('hidden');
    } catch (error) {status.textContent='Settings unavailable';saved.textContent=error.message;}
  }
  add('bot','Hi! I only answer when you ask. To connect OpenRouter, click the Zyncez extension icon in your browser toolbar and paste your API key. You can also use ⚙ here.');
  loadSettings();
  function toggle(force){const open=typeof force==='boolean'?force:panel.classList.contains('hidden');panel.classList.toggle('hidden',!open);launcher.setAttribute('aria-expanded',String(open));if(open){loadSettings();input.focus();}}
  launcher.addEventListener('click',()=>toggle());panel.querySelector('[data-close]').addEventListener('click',()=>toggle(false));
  panel.querySelector('[data-settings]').addEventListener('click',()=>{settingsPane.classList.toggle('hidden');if(!settingsPane.classList.contains('hidden'))modelInput.focus();});
  panel.querySelector('[data-save]').addEventListener('click',async()=>{
    const key=keyInput.value.trim();saved.textContent='Saving settings…';
    try {
      const response=await request({type:'ZYNCEZ_SAVE_SETTINGS',mode:modeSelect.value,model:modelInput.value.trim(),key});
      if (!response?.ok) throw new Error(response?.error||'Failed to save.');
      mode=response.mode;hasKey=response.hasKey;keyInput.value='';updateStatus();saved.textContent='Saved!';settingsPane.classList.add('hidden');
    } catch (error) {saved.textContent=error.message;}
    finally {keyInput.value='';}
  });
  panel.querySelector('[data-remove]').addEventListener('click',async()=>{
    try {const r=await request({type:'ZYNCEZ_REMOVE_KEY'});if(!r?.ok)throw new Error(r?.error||'Could not remove the key.');hasKey=false;keyInput.value='';updateStatus();saved.textContent='Stored API key removed.';}
    catch(error){saved.textContent=error.message;}
  });
  panel.querySelector('[data-clear]').addEventListener('click',()=>{messages.replaceChildren();context.opponentTypes=[];history=[];add('bot','Chat cleared. I will wait for your next question.');});
  panel.querySelector('[data-refresh]').addEventListener('click',()=>{const state=window.ZyncezReader.read();add('bot',window.ZyncezCoach.analyze('battle status',state,context));});
  panel.querySelector('form').addEventListener('submit',async e=>{
    e.preventDefault();const q=input.value.trim();if(!q||busy)return;
    input.value='';add('user',q);
    // Settings may have changed in the extension toolbar popup since the last message.
    await loadSettings();
    const state=window.ZyncezReader.read();
    if(mode==='local'){add('bot',window.ZyncezCoach.analyze(q,state,context));return;}
    if(!hasKey){add('bot','Click the Zyncez extension icon in your browser toolbar (or ⚙ here), paste your OpenRouter API key, then click Save settings.');return;}
    busy=true;sendButton.disabled=true;updateStatus();const waiting=add('bot','Thinking…');
    try {
      const reply=await request({type:'ZYNCEZ_ASK',question:q,state,history:history.slice(-8)});
      if(reply?.ok && reply.answer){waiting.textContent=reply.answer;history.push({role:'user',content:q},{role:'assistant',content:reply.answer});history=history.slice(-8);}
      else waiting.textContent='AI connection: '+(reply?.error||'Unknown error.');
    }catch(error){waiting.textContent='AI connection: '+(error?.message||'Request failed.');}
    finally{busy=false;sendButton.disabled=false;updateStatus();input.focus();}
  });
})();

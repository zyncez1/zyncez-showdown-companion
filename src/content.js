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
    .panel{width:min(420px,calc(100vw - 24px));height:min(610px,calc(100vh - 90px));background:#151827;color:#f4f4ff;border:1px solid #444766;border-radius:16px;box-shadow:0 12px 48px #0009;display:flex;flex-direction:column;overflow:hidden;margin-bottom:10px}
    .hidden{display:none!important}.header{display:flex;align-items:center;justify-content:space-between;padding:13px 14px;background:#242640;border-bottom:1px solid #41435c;user-select:none}
    .title{font-weight:750;font-size:15px}.sub{font-size:11px;color:#bbbcdc}.controls{display:flex;gap:6px}.controls button,.settings button{border:1px solid #545775;border-radius:8px;background:#343651;color:white;padding:5px 8px;cursor:pointer}
    .modelbar{pointer-events:auto;display:flex;align-items:center;gap:7px;padding:8px 12px;background:#1d2035;border-bottom:1px solid #41435c;font-size:11px}
    .modelbar label{color:#b6bfe4;white-space:nowrap}.modelbar select{min-width:0;flex:1;appearance:auto;border-radius:7px;background:#292d49;border:1px solid #545775;color:white;padding:7px;font-size:11px}
    .modelbar button{white-space:nowrap;border:1px solid #545775;background:#353958;color:#fff;border-radius:7px;padding:7px;cursor:pointer}
    .lengthbar{pointer-events:auto;display:flex;align-items:center;gap:9px;padding:6px 12px;background:#1b2035;border-bottom:1px solid #41435c;font-size:11px}
    .lengthbar label{color:#c1c9ef;white-space:nowrap}.lengthbar select{flex:1;min-width:0;padding:5px 8px;border:1px solid #545775;border-radius:7px;background:#292d49;color:#fff;font:inherit;cursor:pointer}
    .picker{pointer-events:auto;max-height:240px;padding:10px;background:#20243c;border-bottom:1px solid #525675;display:flex;flex-direction:column;gap:7px}
    .picker-controls{display:flex;gap:7px;align-items:center}.picker input[type=search]{min-width:0;flex:1;padding:9px;background:#282c49;border:1px solid #545775;color:white;border-radius:8px}
    .picker label{font-size:11px;color:#bfc6e8;white-space:nowrap}.picker input[type=checkbox]{accent-color:#7665f8}
    .picker-info{font-size:10px;color:#c0c5df}.picker-results{overflow-y:auto;display:flex;flex-direction:column;gap:5px}
    .picker-result{background:#2a2d4b;border:1px solid #4c5077;color:white;border-radius:7px;text-align:left;padding:8px;cursor:pointer;display:flex;flex-direction:column;gap:2px}
    .picker-result:hover{background:#3a3e69}.picker-result strong{font-size:11px}.picker-result small{font-size:10px;color:#bfc5e4;overflow-wrap:anywhere}
    .battle-info{padding:8px 12px;font-size:11px;color:#d4ddff;background:#232945;border-bottom:1px solid #424964;line-height:1.45;overflow-wrap:anywhere}
    .messages{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;overflow-wrap:anywhere}
    .bubble{border-radius:13px;padding:10px 12px;font-size:14px;line-height:1.55;max-width:94%;white-space:normal}.bot{background:#292c45;align-self:flex-start}.user{background:#5145b8;align-self:flex-end;white-space:pre-wrap}
    .bubble p{margin:0 0 9px}.bubble p:last-child{margin-bottom:0}
    .bubble strong{color:#fff;font-weight:750}.bubble em{font-style:italic;color:#e7dfff}
    .bubble h1,.bubble h2,.bubble h3{color:#fff;font-size:14px;line-height:1.35;margin:13px 0 7px;font-weight:800}
    .bubble h1:first-child,.bubble h2:first-child,.bubble h3:first-child{margin-top:0}
    .bubble h1{font-size:17px}.bubble h2{font-size:15px}
    .bubble mark{background:#f7d86e;color:#211a1d;padding:0 3px;border-radius:3px}
    .bubble ul,.bubble ol{margin:4px 0 10px;padding-left:22px}.bubble li{margin:4px 0}.bubble li:last-child{margin-bottom:0}
    .bubble code{background:#171a2b;color:#a9e7fa;border-radius:4px;padding:1px 4px;font-family:ui-monospace,Consolas,monospace;font-size:12px}
    .bubble pre{overflow:auto;background:#141827;border:1px solid #444863;padding:10px;border-radius:9px;margin:7px 0 10px;white-space:pre}
    .bubble pre code{background:transparent;padding:0;color:#dfe9ff}
    .bubble blockquote{margin:8px 0;padding:3px 0 3px 12px;border-left:3px solid #8b7aff;color:#d6d9f0}
    .bubble a{color:#a9cbff;text-decoration:underline}.bubble hr{border:0;border-top:1px solid #535875;margin:12px 0}
    .footer{padding:9px;border-top:1px solid #41435c;display:flex;gap:7px}.footer input{background:#24263c;border:1px solid #525570;border-radius:9px;color:#fff;padding:10px;flex:1;min-width:0;outline-offset:2px}
    .send{background:#6658ea;border:0;color:white;border-radius:9px;padding:0 13px;font-weight:700;cursor:pointer}.send:disabled{opacity:.5}.hint{font-size:10px;padding:0 12px 9px;color:#a9abc6}
    .settings{padding:13px;border-bottom:1px solid #41435c;background:#1e2035;font-size:12px;line-height:1.5;overflow-y:auto;max-height:65%}.settings label{display:block;margin:4px 0}.settings select,.settings input{display:block;width:100%;margin:5px 0 10px;padding:9px;background:#282a45;border:1px solid #545775;border-radius:8px;color:white}
    .settings textarea{display:block;width:100%;resize:vertical;min-height:72px;max-height:170px;margin:5px 0 8px;padding:9px;border-radius:8px;background:#282a45;border:1px solid #545775;color:#fff;font:inherit;font-size:12px;line-height:1.4}
    .settings p{font-size:11px;color:#c6c8e0;margin:8px 0}.settings a{color:#b6c8ff}.settings .actions{display:flex;gap:7px;align-items:center}.settings .save{background:#6155df;padding:8px 12px}.settings .remove{padding:8px 12px}.message-status{min-height:16px}
    button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #a9baff;outline-offset:2px}`;
  shadow.appendChild(styles);
  const panel=document.createElement('section');panel.className='panel hidden';panel.setAttribute('aria-label','Zyncez AI chat');
  panel.innerHTML=`
    <div class="header"><div><div class="title">⚡ Zyncez AI Companion</div><div class="sub" data-status>Checking settings…</div></div>
      <div class="controls"><button type="button" data-settings title="AI settings">⚙</button><button type="button" data-refresh title="Read battle status locally">↻</button><button type="button" data-clear title="Clear chat">Clear</button><button type="button" data-close title="Minimize">−</button></div></div>
    <div class="modelbar"><label for="zyncez-quick-model">AI model</label><select id="zyncez-quick-model" data-quick-model aria-label="Quick switch AI model"></select><button type="button" data-browse-models title="Search all available OpenRouter models">Browse</button></div>
    <div class="lengthbar"><label for="zyncez-quick-length">Reply length</label><select id="zyncez-quick-length" data-quick-length aria-label="Choose reply length"><option value="short">Short · just talk</option><option value="medium">Medium · a little more</option><option value="long">Long · full details</option></select></div>
    <div class="picker hidden" data-model-picker>
      <div class="picker-controls"><input data-model-search type="search" placeholder="Search models…" aria-label="Search OpenRouter models"><label><input type="checkbox" data-free-only> Free only</label></div>
      <div data-model-count class="picker-info" aria-live="polite">Click Browse to load models.</div><div class="picker-results" data-model-results role="list"></div>
    </div>
    <div class="settings hidden" data-settings-pane>
      <label for="zyncez-mode">Chat mode</label>
      <select id="zyncez-mode" data-mode><option value="gpt">OpenRouter AI (on Send only)</option><option value="local">Local commands (free)</option></select>
      <label for="zyncez-model">OpenRouter model ID</label>
      <input id="zyncez-model" data-model type="text" maxlength="150" autocomplete="off" spellcheck="false" value="openai/gpt-5-mini"/>
      <label for="zyncez-key">Your OpenRouter API key</label>
      <input id="zyncez-key" data-key type="password" maxlength="512" autocomplete="off" spellcheck="false" placeholder="Paste your sk-or-… key here"/>
      <p data-key-status>No key saved yet.</p>
      <label for="zyncez-personality">Companion personality</label>
      <select id="zyncez-personality" data-personality>
        <option value="friendly">Friendly gaming buddy</option><option value="coach">Competitive Pokémon coach</option>
        <option value="hype">Excited / playful teammate</option><option value="calm">Calm and relaxed</option>
        <option value="custom">Custom personality</option>
      </select>
      <label for="zyncez-notes">Custom personality instructions (optional)</label>
      <textarea id="zyncez-notes" data-personality-notes maxlength="1600" rows="3" placeholder="Example: Talk like a close gaming friend; joke with me and explain your reasoning without boring reports."></textarea>
      <label for="zyncez-reply-style">Response length</label>
      <select id="zyncez-reply-style" data-reply-style><option value="short">Short — quick, natural replies</option><option value="medium">Medium — a little explanation</option><option value="long">Long — full details</option></select>
      <div class="actions"><button type="button" class="save" data-save>Save settings</button><button type="button" class="remove" data-remove>Remove key</button></div>
      <p class="message-status" data-saved></p>
      <p><a href="https://openrouter.ai/settings/keys" target="_blank" rel="noreferrer noopener">Get an OpenRouter API key</a>. A saved key stays in this browser profile, not in your ZIP or Git repo. Anyone with access to your browser profile may be able to recover it. API usage can cost money.</p>
    </div>
    <div class="battle-info" data-battle-info>Battle not scanned yet. Ask a question or press ↻.</div>
    <div class="messages" role="log" aria-live="polite"></div>
    <form class="footer"><input type="text" maxlength="700" autocomplete="off" aria-label="Message Zyncez" placeholder="Ask anything about your battle..."/><button type="submit" class="send">Send</button></form>
    <div class="hint">OpenRouter is contacted only when you press Send. ↻ reads locally. No automatic moves. Follow tournament rules.</div>`;
  const launcher=document.createElement('button');launcher.className='launcher';launcher.type='button';launcher.setAttribute('aria-label','Toggle Zyncez companion');launcher.textContent='⚡';
  shadow.append(panel,launcher);
  const messages=panel.querySelector('.messages'),input=panel.querySelector('.footer input'),sendButton=panel.querySelector('.send'),status=panel.querySelector('[data-status]');
  const settingsPane=panel.querySelector('[data-settings-pane]'),modeSelect=panel.querySelector('[data-mode]'),modelInput=panel.querySelector('[data-model]'),keyInput=panel.querySelector('[data-key]');
  const keyStatus=panel.querySelector('[data-key-status]'),saved=panel.querySelector('[data-saved]');
  const personalitySelect=panel.querySelector('[data-personality]'), personalityNotes=panel.querySelector('[data-personality-notes]'), replyStyleSelect=panel.querySelector('[data-reply-style]'), quickLength=panel.querySelector('[data-quick-length]');
  const quickModel=panel.querySelector('[data-quick-model]'),modelPicker=panel.querySelector('[data-model-picker]');
  const browseButton=panel.querySelector('[data-browse-models]'),modelSearch=panel.querySelector('[data-model-search]');
  const freeOnly=panel.querySelector('[data-free-only]'),modelResults=panel.querySelector('[data-model-results]'),modelCount=panel.querySelector('[data-model-count]');
  const battleInfo=panel.querySelector('[data-battle-info]');
  async function readCurrentState() {
    const base=window.ZyncezReader.read();
    try {
      const r=await request({type:'ZYNCEZ_READ_GAME',roomId:base.roomId||''});
      if(r?.ok) {
        const state=window.ZyncezBattleState.enrichState(base,r.game);
        state.speedAnalysis=window.ZyncezSpeed.analyze(state);
        return state;
      }
    } catch { /* The DOM reader remains a fallback if game data is inaccessible. */ }
    const fallback=window.ZyncezBattleState.enrichState(base,{available:false,reason:'Could not access the Showdown battle request.'});
    fallback.speedAnalysis=window.ZyncezSpeed.analyze(fallback);
    return fallback;
  }
  function showBattleInfo(state) {
    if(!state.battleFound && state.gameReadStatus!=='connected'){battleInfo.textContent='No battle detected in the current Showdown room.';return;}
    const active=state.opponentActive.map(p=>p.species||p.name).join(' + ') || 'not detected';
    const seen=state.opponentRevealed.map(p=>p.species).join(', ') || 'none yet';
    const team=state.myParty?.length ? ` | Your party: ${state.myParty.map(p=>p.species+(p.moves?.length?` (${p.moves.length} moves)`:' (moves unknown)')).join(', ')}` : ' | Party moves unavailable';
    const recorded=state.opponentMovesSeen?.reduce((n,p)=>n+p.moves.length,0)||0;
    const speed=state.speedAnalysis?.matchups||[];
    const likely=speed.filter(x=>x.order==='before').length;
    const note=speed.length?` | Speed: ${likely}/${speed.length} same-priority matchups ahead of the standard opponent Speed range (uncertain modifiers apply)`:'';
    battleInfo.textContent=`Opponent active: ${active} | Revealed: ${seen}${state.opponentUnknownSlots ? ` | Hidden slots: ${state.opponentUnknownSlots}` : ''}${team} | Opponent moves seen: ${recorded}${note}`;
  }
  const context={opponentTypes:[]};
  let mode='gpt',hasKey=false,busy=false,history=[],catalog=null,recentIds=[];
  function setBubbleText(bubble, text, formatted = true) {
    if (formatted && bubble.classList.contains('bot') && window.ZyncezFormat?.renderMarkdown) {
      bubble.replaceChildren(window.ZyncezFormat.renderMarkdown(text));
    } else bubble.textContent = text;
    messages.scrollTop=messages.scrollHeight;
  }
  function add(who,txt){const bubble=document.createElement('div');bubble.className='bubble '+who;setBubbleText(bubble,txt,who==='bot');messages.appendChild(bubble);messages.scrollTop=messages.scrollHeight;return bubble;}
  function updateStatus(){status.textContent=busy?'AI · thinking…':mode==='local'?'Local · idle':hasKey?'OpenRouter · ready when you ask':'AI · add key in browser toolbar or ⚙';keyStatus.textContent=hasKey?'✓ API key saved in this browser. Leave the box blank to keep it.':'No OpenRouter API key saved yet.';}
  async function request(message) {return await chrome.runtime.sendMessage(message);}
  function renderRecent(current) {
    quickModel.replaceChildren();
    for (const id of [...new Set([current,...recentIds,'openai/gpt-5-mini'])].filter(Boolean).slice(0,8)) {
      const option=document.createElement('option');option.value=id;option.textContent=id;quickModel.appendChild(option);
    }
    quickModel.value=current;
  }
  function renderCatalog() {
    if (!catalog) return;
    const query=modelSearch.value.toLowerCase().trim();
    const found=catalog.filter(x=>(!freeOnly.checked||x.free) && (!query||`${x.id} ${x.name}`.toLowerCase().includes(query)));
    modelCount.textContent=`${found.length} matches${found.length>50?' · showing first 50':''}. Prices from OpenRouter.`;
    modelResults.replaceChildren();
    for (const m of found.slice(0,50)) {
      const button=document.createElement('button');button.type='button';button.className='picker-result';
      const name=document.createElement('strong');name.textContent=m.name;
      const id=document.createElement('small');id.textContent=m.id;
      const price=document.createElement('small');price.textContent=m.free?'Free':m.promptPerMillion==null?'Pricing unavailable':`$${m.promptPerMillion} in / $${m.completionPerMillion} out per 1M tokens`;
      button.append(name,id,price);
      button.addEventListener('click',()=>selectModel(m.id));modelResults.appendChild(button);
    }
    if (!found.length) modelResults.textContent='No matching models. Try another search.';
  }
  async function selectModel(id) {
    const previous=quickModel.value;
    try {
      const r=await request({type:'ZYNCEZ_SET_MODEL',model:id});
      if (!r?.ok) throw new Error(r?.error||'Could not change model.');
      recentIds=r.recentModels||[];renderRecent(r.model);modelInput.value=r.model;
      modelPicker.classList.add('hidden');browseButton.textContent='Browse';
      saved.textContent=`Now using ${r.model}.`;updateStatus();
    } catch(error) {renderRecent(previous);saved.textContent=error.message;}
  }
  quickModel.addEventListener('change',()=>selectModel(quickModel.value));
  modelSearch.addEventListener('input',renderCatalog);
  freeOnly.addEventListener('change',renderCatalog);
  browseButton.addEventListener('click',async()=>{
    if (!modelPicker.classList.contains('hidden')) {modelPicker.classList.add('hidden');browseButton.textContent='Browse';return;}
    modelPicker.classList.remove('hidden');browseButton.textContent='Close';
    if (catalog) {renderCatalog();modelSearch.focus();return;}
    modelCount.textContent='Loading models you requested…';
    try {const r=await request({type:'ZYNCEZ_LIST_MODELS'});if(!r?.ok)throw new Error(r?.error||'Could not list models.');catalog=r.models;renderCatalog();modelSearch.focus();}
    catch(error){modelCount.textContent=error.message;}
  });
  async function loadSettings() {
    try {
      const data=await request({type:'ZYNCEZ_GET_SETTINGS'});
      if (!data?.ok) throw new Error(data?.error||'Could not read settings.');
      mode=data.mode;hasKey=data.hasKey;modeSelect.value=mode;modelInput.value=data.model;personalitySelect.value=data.personality||'friendly';personalityNotes.value=data.personalityNotes||'';replyStyleSelect.value=data.replyStyle||'short';quickLength.value=data.replyStyle||'short';recentIds=data.recentModels||[];renderRecent(data.model);updateStatus();if(!hasKey && mode==='gpt') settingsPane.classList.remove('hidden');
    } catch (error) {status.textContent='Settings unavailable';saved.textContent=error.message;}
  }
  add('bot','Hi! I only answer when you ask. To connect OpenRouter, click the Zyncez extension icon in your browser toolbar and paste your API key. You can also use ⚙ here.');
  loadSettings();
  function toggle(force){const open=typeof force==='boolean'?force:panel.classList.contains('hidden');panel.classList.toggle('hidden',!open);launcher.setAttribute('aria-expanded',String(open));if(open){loadSettings();input.focus();}}
  launcher.addEventListener('click',()=>toggle());panel.querySelector('[data-close]').addEventListener('click',()=>toggle(false));
  panel.querySelector('[data-settings]').addEventListener('click',()=>{settingsPane.classList.toggle('hidden');if(!settingsPane.classList.contains('hidden'))modelInput.focus();});
  quickLength.addEventListener('change',async()=>{
    const selected=quickLength.value;
    try {
      const result=await request({type:'ZYNCEZ_SET_REPLY_STYLE',replyStyle:selected});
      if(!result?.ok) throw new Error(result?.error||'Could not change reply length.');
      replyStyleSelect.value=result.replyStyle;
    } catch(error) {
      quickLength.value=replyStyleSelect.value;
      saved.textContent=error?.message||'Could not change reply length.';
    }
  });
  panel.querySelector('[data-save]').addEventListener('click',async()=>{
    const key=keyInput.value.trim();saved.textContent='Saving settings…';
    try {
      const response=await request({type:'ZYNCEZ_SAVE_SETTINGS',mode:modeSelect.value,model:modelInput.value.trim(),key,personality:personalitySelect.value,personalityNotes:personalityNotes.value,replyStyle:replyStyleSelect.value});
      if (!response?.ok) throw new Error(response?.error||'Failed to save.');
      mode=response.mode;hasKey=response.hasKey;replyStyleSelect.value=response.replyStyle;quickLength.value=response.replyStyle;recentIds=[response.model,...recentIds];renderRecent(response.model);keyInput.value='';updateStatus();saved.textContent='Saved!';settingsPane.classList.add('hidden');
    } catch (error) {saved.textContent=error.message;}
    finally {keyInput.value='';}
  });
  panel.querySelector('[data-remove]').addEventListener('click',async()=>{
    try {const r=await request({type:'ZYNCEZ_REMOVE_KEY'});if(!r?.ok)throw new Error(r?.error||'Could not remove the key.');hasKey=false;keyInput.value='';updateStatus();saved.textContent='Stored API key removed.';}
    catch(error){saved.textContent=error.message;}
  });
  panel.querySelector('[data-clear]').addEventListener('click',()=>{messages.replaceChildren();context.opponentTypes=[];history=[];add('bot','Chat cleared. I will wait for your next question.');});
  panel.querySelector('[data-refresh]').addEventListener('click',async()=>{const state=await readCurrentState();showBattleInfo(state);add('bot',window.ZyncezCoach.analyze('battle status',state,context));});
  panel.querySelector('form').addEventListener('submit',async e=>{
    e.preventDefault();const q=input.value.trim();if(!q||busy)return;
    input.value='';add('user',q);
    // Settings may have changed in the extension toolbar popup since the last message.
    await loadSettings();
    const state=await readCurrentState();
    showBattleInfo(state);
    if(mode==='local'){add('bot',window.ZyncezCoach.analyze(q,state,context));return;}
    if(!hasKey){add('bot','Click the Zyncez extension icon in your browser toolbar (or ⚙ here), paste your OpenRouter API key, then click Save settings.');return;}
    busy=true;sendButton.disabled=true;updateStatus();const waiting=add('bot','Thinking…');
    try {
      const reply=await request({type:'ZYNCEZ_ASK',question:q,state,history:history.slice(-8)});
      if(reply?.ok && reply.answer){setBubbleText(waiting,reply.answer,true);history.push({role:'user',content:q},{role:'assistant',content:reply.answer});history=history.slice(-12);}
      else setBubbleText(waiting,'AI connection: '+(reply?.error||'Unknown error.'),false);
    }catch(error){setBubbleText(waiting,'AI connection: '+(error?.message||'Request failed.'),false);}
    finally{busy=false;sendButton.disabled=false;updateStatus();input.focus();}
  });
})();

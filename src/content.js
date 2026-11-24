/* Minimal in-page messenger: user-initiated AI only, with a movable bubble and offline model picker. */
(() => {
  'use strict';
  if (document.getElementById('zyncez-companion-host')) return;
  const host=document.createElement('div');host.id='zyncez-companion-host';
  host.style.cssText='position:fixed;left:20px;top:20px;width:56px;height:56px;z-index:2147483647;pointer-events:none';
  const shadow=host.attachShadow({mode:'closed'});
  const styles=document.createElement('style');styles.textContent=window.ZyncezChatStyles || '';
  shadow.appendChild(styles);
  const panel=document.createElement('section');panel.className='panel';panel.setAttribute('aria-label','Zyncez companion chat');panel.setAttribute('aria-hidden','true');
  panel.innerHTML=`
    <header class="head" data-drag-header>
      <div class="brand"><span class="brand-badge">✦</span><div class="brand-copy"><div class="brand-title">Zyncez AI</div><div class="brand-status" data-status>Ready when you are</div></div></div>
      <button type="button" class="icon-button" data-refresh title="Read battle locally" aria-label="Refresh battle information">↻</button>
      <button type="button" class="icon-button" data-menu-button title="Menu (or right-click the chat)" aria-label="Open chat menu">⋯</button>
    </header>
    <div class="messages" role="log" aria-live="polite"><div class="empty" data-empty><span class="empty-icon">✦</span>Ask about your battle whenever you need me.</div></div>
    <details class="battle-details" data-battle-details><summary data-battle-summary>Battle details · on demand</summary><div data-battle-info>Ask a question or press ↻ to read your battle.</div></details>
    <form class="composer"><textarea rows="1" maxlength="900" autocomplete="off" aria-label="Message Zyncez" placeholder="Message Zyncez…"></textarea>
      <div class="composer-bottom">
        <button type="button" class="model-trigger" data-model-trigger aria-haspopup="listbox" aria-expanded="false" title="Switch model instantly"><span class="model-label" data-model-label>GPT-5 Mini</span><span class="chevron">⌄</span></button>
        <select data-quick-length aria-label="Response length" title="Reply length"><option value="short">Short</option><option value="medium">Medium</option><option value="long">Long</option></select>
        <button type="submit" class="send" aria-label="Send message" title="Send (Enter)">↑</button>
      </div>
    </form>
    <div class="model-menu" data-model-picker role="listbox" aria-label="Choose AI model" hidden><div class="menu-heading">Choose a model · instant</div><div data-model-options></div><div class="model-foot">Built-in list · availability and price may change. Custom IDs in Settings.</div></div>
    <section class="settings-screen" data-settings-pane hidden aria-label="Zyncez settings">
      <div class="settings-head"><span>Settings</span><button type="button" class="icon-button" data-settings-close aria-label="Back to chat">×</button></div>
      <div class="settings-body">
        <h3>Appearance</h3>
        <label for="zyncez-theme">Theme</label><select id="zyncez-theme" data-theme><option value="midnight">Midnight</option><option value="frost">Frosted glass</option><option value="light">Light</option></select>
        <label>Accent color</label><div class="color-options" data-colors aria-label="Accent color"></div>
        <label for="zyncez-width">Window width</label><select id="zyncez-width" data-width><option value="compact">Compact</option><option value="regular">Comfortable</option><option value="wide">Wide</option></select>
        <label for="zyncez-height">Window height</label><select id="zyncez-height" data-height><option value="short">Short</option><option value="regular">Comfortable</option><option value="tall">Tall</option></select>
        <label for="zyncez-font">Chat text</label><select id="zyncez-font" data-font><option value="small">Small</option><option value="regular">Normal</option><option value="large">Large</option></select>
        <label for="zyncez-bubble">Chat bubble size</label><select id="zyncez-bubble" data-bubble><option value="small">Small</option><option value="regular">Normal</option><option value="large">Large</option></select>
        <label for="zyncez-opacity">Panel opacity</label><input id="zyncez-opacity" data-opacity type="range" min="78" max="100" step="1" value="96"/>
        <h3>AI & personality</h3>
        <label for="zyncez-mode">Mode</label><select id="zyncez-mode" data-mode><option value="gpt">OpenRouter AI · on Send</option><option value="local">Local commands only</option></select>
        <label for="zyncez-model">Custom OpenRouter model ID</label><input id="zyncez-model" data-model type="text" maxlength="150" spellcheck="false" autocomplete="off" placeholder="provider/model"/>
        <label for="zyncez-key">OpenRouter API key</label><input id="zyncez-key" data-key type="password" maxlength="512" spellcheck="false" autocomplete="off" placeholder="Paste key to add or replace"/>
        <p data-key-status>Your key stays in your browser profile.</p>
        <label for="zyncez-personality">Personality</label><select id="zyncez-personality" data-personality><option value="friendly">Friendly gaming buddy</option><option value="coach">Competitive coach</option><option value="hype">Playful teammate</option><option value="calm">Calm and relaxed</option><option value="custom">Custom</option></select>
        <label for="zyncez-notes">Custom instructions</label><textarea id="zyncez-notes" data-personality-notes rows="3" maxlength="1600" placeholder="Speak like a friend, keep it casual…"></textarea>
        <label for="zyncez-reply-style">Reply length</label><select id="zyncez-reply-style" data-reply-style><option value="short">Short</option><option value="medium">Medium</option><option value="long">Long</option></select>
        <div class="settings-actions"><button type="button" class="primary" data-save>Save settings</button><button type="button" class="danger" data-remove>Remove API key</button></div>
        <p class="settings-feedback" data-saved role="status"></p>
        <p>Right-click the chat for this menu anytime. Drag the floating bubble to move the whole window. The AI only runs when you send a message. <a href="https://openrouter.ai/settings/keys" target="_blank" rel="noopener noreferrer">Get a key</a>.</p>
      </div>
    </section>`;
  const launcher=document.createElement('button');launcher.className='launcher';launcher.type='button';launcher.setAttribute('aria-label','Open Zyncez chat; drag to move; right-click for settings');launcher.setAttribute('aria-expanded','false');launcher.title='Click to chat · drag to move · right-click for settings';
  launcher.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2-2.6 8H3l7 4-1.5 8 8.4-11H13l-1-9Z"/></svg>';
  const menu=document.createElement('div');menu.className='context-menu';menu.hidden=true;
  menu.innerHTML='<button type="button" data-open-settings>⚙ &nbsp; Settings & appearance</button><button type="button" data-menu-clear>✧ &nbsp; Clear chat</button><hr><button type="button" data-menu-reset>↺ &nbsp; Reset position</button>';
  shadow.append(panel,launcher,menu);

  const $=selector=>panel.querySelector(selector);
  const messages=$('.messages'),empty=$('[data-empty]'),input=$('.composer textarea'),sendButton=$('.send'),status=$('[data-status]');
  const settingsPane=$('[data-settings-pane]'),modelPicker=$('[data-model-picker]'),modelTrigger=$('[data-model-trigger]'),modelOptions=$('[data-model-options]'),modelLabel=$('[data-model-label]');
  const modeSelect=$('[data-mode]'),modelInput=$('[data-model]'),keyInput=$('[data-key]'),keyStatus=$('[data-key-status]'),saved=$('[data-saved]');
  const personalitySelect=$('[data-personality]'),personalityNotes=$('[data-personality-notes]'),replyStyleSelect=$('[data-reply-style]'),quickLength=$('[data-quick-length]');
  const battleInfo=$('[data-battle-info]'),battleSummary=$('[data-battle-summary]');
  const context={opponentTypes:[]};
  const UI_DEFAULTS={theme:'midnight',accent:'violet',width:'regular',height:'regular',font:'regular',bubble:'regular',opacity:96,position:{x:1,y:1}};
  const ACCENTS={violet:'#8b80ff',blue:'#4b9bff',teal:'#16bca8',rose:'#ed6aa6',amber:'#e8a946'};
  let mode='gpt',hasKey=false,busy=false,history=[],recentIds=[],currentModel='openai/gpt-5-mini',ui={...UI_DEFAULTS},open=false;

  function request(msg){return chrome.runtime.sendMessage(msg);}
  function positionAt(x,y,persist=false){
    const size=parseFloat(getComputedStyle(launcher).width)||56;
    const maxX=Math.max(8,innerWidth-size-8),maxY=Math.max(8,innerHeight-size-8);
    const px=Math.min(maxX,Math.max(8,x)),py=Math.min(maxY,Math.max(8,y));
    host.style.left=px+'px';host.style.top=py+'px';
    host.style.width=size+'px';host.style.height=size+'px';
    const width=panel.getBoundingClientRect().width || 400;
    const height=panel.getBoundingClientRect().height || 550;
    panel.classList.toggle('align-left',px+size<width+8);
    panel.classList.toggle('below',py<height+size+23 && innerHeight-py-size>py-size);
    if(persist){ui.position={x:Math.max(0,Math.min(1,(px-8)/Math.max(1,maxX-8))),y:Math.max(0,Math.min(1,(py-8)/Math.max(1,maxY-8)))};saveUI({position:ui.position});}
  }
  function positionFromPrefs(){
    const size=parseFloat(getComputedStyle(launcher).width)||56;
    positionAt(8+ui.position.x*Math.max(0,innerWidth-size-16),8+ui.position.y*Math.max(0,innerHeight-size-16));
  }
  function rgba(theme,alpha){return theme==='light'?`rgba(253,253,255,${alpha})`:theme==='frost'?`rgba(23,30,51,${Math.max(.74,alpha-.09)})`:`rgba(18,21,34,${alpha})`;}
  function applyUI(){
    host.dataset.theme=ui.theme;
    host.style.setProperty('--z-accent',ACCENTS[ui.accent]||ACCENTS.violet);
    host.style.setProperty('--z-width',({compact:335,regular:400,wide:475}[ui.width]||400)+'px');
    host.style.setProperty('--z-height',({short:430,regular:610,tall:730}[ui.height]||610)+'px');
    host.style.setProperty('--z-font',({small:12,regular:14,large:16}[ui.font]||14)+'px');
    host.style.setProperty('--z-bubble',({small:46,regular:56,large:66}[ui.bubble]||56)+'px');
    host.style.setProperty('--z-panel-bg',rgba(ui.theme,(ui.opacity||96)/100));
    for(const name of ['theme','width','height','font','bubble','opacity'])$(`[data-${name}]`).value=ui[name];
    renderSwatches();positionFromPrefs();
  }
  function renderSwatches(){
    const colors=$('[data-colors]');colors.replaceChildren();
    for(const [name,hex] of Object.entries(ACCENTS)){
      const btn=document.createElement('button');btn.className='swatch'+(ui.accent===name?' selected':'');btn.type='button';btn.title=name;btn.setAttribute('aria-label',name+' accent');btn.setAttribute('aria-pressed',String(ui.accent===name));btn.style.background=hex;btn.textContent=ui.accent===name?'✓':'';
      btn.addEventListener('click',()=>setUI({accent:name}));colors.appendChild(btn);
    }
  }
  function setUI(partial){ui={...ui,...partial};applyUI();saveUI(partial);}
  async function saveUI(prefs){try{const r=await request({type:'ZYNCEZ_SET_UI_PREFS',prefs});if(!r?.ok)throw Error(r?.error);}catch{saved.textContent='Could not save appearance settings.';}}
  for(const key of ['theme','width','height','font','bubble','opacity'])$(`[data-${key}]`).addEventListener('change',e=>setUI({[key]:key==='opacity'?Number(e.target.value):e.target.value}));

  function toggle(force){open=typeof force==='boolean'?force:!open;panel.classList.toggle('is-open',open);panel.setAttribute('aria-hidden',String(!open));launcher.classList.toggle('open',open);launcher.setAttribute('aria-expanded',String(open));hideMenus();if(open){loadSettings();input.focus();positionFromPrefs();}}
  function hideMenus(){menu.hidden=true;modelPicker.hidden=true;modelTrigger.setAttribute('aria-expanded','false');}
  function openSettings(){hideMenus();if(!open)toggle(true);settingsPane.hidden=false;setTimeout(()=>$('[data-theme]').focus(),0);}
  function closeSettings(){settingsPane.hidden=true;input.focus();}
  function showContext(x,y){hideMenus();menu.hidden=false;menu.style.left=Math.max(6,Math.min(innerWidth-200,x))+'px';menu.style.top=Math.max(6,Math.min(innerHeight-146,y))+'px';}
  launcher.addEventListener('contextmenu',e=>{e.preventDefault();showContext(e.clientX,e.clientY)});
  panel.addEventListener('contextmenu',e=>{if(e.target.closest('input,textarea,select,a'))return;e.preventDefault();showContext(e.clientX,e.clientY)});
  $('[data-menu-button]').addEventListener('click',e=>{const box=e.currentTarget.getBoundingClientRect();showContext(box.right-188,box.bottom+6)});
  menu.querySelector('[data-open-settings]').addEventListener('click',openSettings);
  menu.querySelector('[data-menu-reset]').addEventListener('click',()=>{hideMenus();setUI({position:{x:1,y:1}})});
  menu.querySelector('[data-menu-clear]').addEventListener('click',()=>{hideMenus();messages.replaceChildren();history=[];context.opponentTypes=[];add('bot','Chat cleared. What’s up?')});
  $('[data-settings-close]').addEventListener('click',closeSettings);
  shadow.addEventListener('pointerdown',e=>{if(!menu.hidden && !menu.contains(e.target) && !e.target.closest('[data-menu-button]'))menu.hidden=true;if(!modelPicker.hidden && !modelPicker.contains(e.target) && !modelTrigger.contains(e.target))closeModels();});
  document.addEventListener('pointerdown',e=>{if(!host.contains(e.target)){hideMenus();}},true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!settingsPane.hidden)closeSettings();else if(!menu.hidden||!modelPicker.hidden)hideMenus();else if(open)toggle(false);}});

  // Move by the floating bubble (or the chat title bar). Click without moving to toggle.
  function attachDrag(node,toggleOnClick){
    let start=null;
    node.addEventListener('pointerdown',e=>{
      if(e.button!==0 || (node!==launcher && e.target.closest('button,input,select,textarea,a')))return;
      start={id:e.pointerId,x:e.clientX,y:e.clientY,left:parseFloat(host.style.left),top:parseFloat(host.style.top),moved:false};
      node.setPointerCapture?.(e.pointerId);if(e.cancelable)e.preventDefault();
    });
    node.addEventListener('pointermove',e=>{
      if(!start||e.pointerId!==start.id)return;
      const dx=e.clientX-start.x,dy=e.clientY-start.y;
      if(Math.hypot(dx,dy)>6)start.moved=true;
      if(start.moved){launcher.classList.add('dragging');positionAt(start.left+dx,start.top+dy);}
    });
    const finish=e=>{
      if(!start||e.pointerId!==start.id)return;
      const moved=start.moved;start=null;launcher.classList.remove('dragging');
      if(moved)positionAt(parseFloat(host.style.left),parseFloat(host.style.top),true);
      else if(toggleOnClick)toggle();
    };
    node.addEventListener('pointerup',finish);node.addEventListener('pointercancel',()=>{start=null;launcher.classList.remove('dragging')});
  }
  attachDrag(launcher,true);attachDrag($('[data-drag-header]'),false);
  window.addEventListener('resize',()=>positionFromPrefs(),{passive:true});

  function renderModels(){
    modelOptions.replaceChildren();
    for(const m of window.ZyncezModels.offlineOptions(currentModel,recentIds)){
      const btn=document.createElement('button');btn.type='button';btn.className='model-option'+(m.id===currentModel?' selected':'');btn.setAttribute('role','option');btn.setAttribute('aria-selected',String(m.id===currentModel));
      const info=document.createElement('span'),title=document.createElement('strong'),subtitle=document.createElement('small');title.textContent=m.name;subtitle.textContent=m.provider;info.append(title,subtitle);
      const check=document.createElement('b');check.className='selected-mark';check.textContent=m.id===currentModel?'✓':'';btn.append(info,check);
      btn.addEventListener('click',()=>selectModel(m.id));modelOptions.appendChild(btn);
    }
    modelLabel.textContent=window.ZyncezModels.offlineOptions(currentModel,recentIds).find(m=>m.id===currentModel)?.name||currentModel;
  }
  function closeModels(){modelPicker.hidden=true;modelTrigger.setAttribute('aria-expanded','false');}
  modelTrigger.addEventListener('click',()=>{const show=modelPicker.hidden;hideMenus();if(show){renderModels();modelPicker.hidden=false;modelTrigger.setAttribute('aria-expanded','true');}});
  async function selectModel(id){
    const previous=currentModel;currentModel=id;renderModels();closeModels();
    try{const r=await request({type:'ZYNCEZ_SET_MODEL',model:id});if(!r?.ok)throw Error(r?.error||'Could not save model.');currentModel=r.model;recentIds=r.recentModels||recentIds;modelInput.value=currentModel;renderModels();status.textContent='Switched to '+window.ZyncezModels.modelName(id);}
    catch(err){currentModel=previous;renderModels();status.textContent=err.message;}
  }

  async function readCurrentState(){
    const base=window.ZyncezReader.read();
    try{
      const r=await request({type:'ZYNCEZ_READ_GAME',roomId:base.roomId||''});
      if(r?.ok){const state=window.ZyncezBattleState.enrichState(base,r.game);state.speedAnalysis=window.ZyncezSpeed.analyze(state);return state;}
    }catch{/* graceful DOM fallback */}
    const fallback=window.ZyncezBattleState.enrichState(base,{available:false,reason:'Could not access the Showdown battle request.'});fallback.speedAnalysis=window.ZyncezSpeed.analyze(fallback);return fallback;
  }
  function showBattleInfo(state){
    if(!state.battleFound && state.gameReadStatus!=='connected'){battleSummary.textContent='No battle detected';battleInfo.textContent='Open a battle in Pokémon Showdown.';return;}
    const active=state.opponentActive?.map(p=>p.species||p.name).join(' + ')||'unknown';
    const seen=state.opponentRevealed?.map(p=>p.species).join(', ')||'none';
    const party=state.myParty?.length||0;
    battleSummary.textContent=`Opponent: ${active} · Party ${party}`;
    battleInfo.textContent=`Opponent active: ${active}. Revealed: ${seen}. Your party: ${party} Pokémon. Hidden opponents: ${state.opponentUnknownSlots||0}. Opponent moves seen: ${state.opponentMovesSeen?.reduce((n,p)=>n+(p.moves?.length||0),0)||0}.`;
  }
  function setBubbleText(bubble,text,format=true){if(format && bubble.classList.contains('bot') && window.ZyncezFormat?.renderMarkdown)bubble.replaceChildren(window.ZyncezFormat.renderMarkdown(text));else bubble.textContent=text;messages.scrollTop=messages.scrollHeight;}
  function add(who,txt){if(empty?.isConnected)empty.remove();const bubble=document.createElement('div');bubble.className='bubble '+who;messages.appendChild(bubble);setBubbleText(bubble,txt,who==='bot');return bubble;}
  function updateStatus(){status.textContent=busy?'Thinking…':mode==='local'?'Local mode · idle':hasKey?'Ready when you are':'Add API key · right-click for settings';keyStatus.textContent=hasKey?'✓ Key saved locally. Leave blank to keep it.':'No API key saved yet.';}
  async function loadSettings(){
    try{
      const data=await request({type:'ZYNCEZ_GET_SETTINGS'});if(!data?.ok)throw Error(data?.error||'Could not load settings.');
      mode=data.mode;hasKey=data.hasKey;currentModel=data.model;recentIds=data.recentModels||[];
      modeSelect.value=mode;modelInput.value=currentModel;personalitySelect.value=data.personality||'friendly';personalityNotes.value=data.personalityNotes||'';replyStyleSelect.value=data.replyStyle||'short';quickLength.value=data.replyStyle||'short';
      if(data.uiPrefs){ui={...ui,...data.uiPrefs};applyUI();}
      renderModels();updateStatus();
    }catch(error){status.textContent='Settings unavailable';saved.textContent=error.message;}
  }
  quickLength.addEventListener('change',async()=>{
    const selected=quickLength.value;
    try{const result=await request({type:'ZYNCEZ_SET_REPLY_STYLE',replyStyle:selected});if(!result?.ok)throw Error(result?.error||'Could not change reply length.');replyStyleSelect.value=result.replyStyle;}
    catch(error){quickLength.value=replyStyleSelect.value;status.textContent=error.message;}
  });
  $('[data-save]').addEventListener('click',async()=>{
    saved.textContent='Saving…';
    try{
      const response=await request({type:'ZYNCEZ_SAVE_SETTINGS',mode:modeSelect.value,model:modelInput.value.trim(),key:keyInput.value.trim(),personality:personalitySelect.value,personalityNotes:personalityNotes.value,replyStyle:replyStyleSelect.value});
      if(!response?.ok)throw Error(response?.error||'Could not save settings.');
      mode=response.mode;hasKey=response.hasKey;currentModel=response.model;recentIds=[currentModel,...recentIds];quickLength.value=response.replyStyle;renderModels();updateStatus();saved.textContent='Saved.';settingsPane.hidden=true;
    }catch(error){saved.textContent=error.message;}finally{keyInput.value='';}
  });
  $('[data-remove]').addEventListener('click',async()=>{try{const r=await request({type:'ZYNCEZ_REMOVE_KEY'});if(!r?.ok)throw Error(r?.error);hasKey=false;keyInput.value='';updateStatus();saved.textContent='API key removed.';}catch(error){saved.textContent=error.message;}});
  $('[data-refresh]').addEventListener('click',async()=>{const state=await readCurrentState();showBattleInfo(state);add('bot',window.ZyncezCoach.analyze('battle status',state,context));});
  input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('.composer').requestSubmit();}});
  input.addEventListener('input',()=>{input.style.height='auto';input.style.height=Math.min(input.scrollHeight,115)+'px';});
  $('.composer').addEventListener('submit',async e=>{
    e.preventDefault();const q=input.value.trim();if(!q||busy)return;
    input.value='';input.style.height='auto';add('user',q);closeModels();await loadSettings();
    const state=await readCurrentState();showBattleInfo(state);
    if(mode==='local'){add('bot',window.ZyncezCoach.analyze(q,state,context));return;}
    if(!hasKey){add('bot','Right-click the chat bubble and open Settings to add your OpenRouter key.');return;}
    if(window.ZyncezDecision?.isTacticalQuestion(q))state.decisionSupport=window.ZyncezDecision.analyze(state,q);
    busy=true;sendButton.disabled=true;updateStatus();const pending=add('bot','Thinking…');
    try{
      const reply=await request({type:'ZYNCEZ_ASK',question:q,state,history:history.slice(-8)});
      if(reply?.ok&&reply.answer){setBubbleText(pending,reply.answer,true);history.push({role:'user',content:q},{role:'assistant',content:reply.answer});history=history.slice(-12);}
      else setBubbleText(pending,'AI connection: '+(reply?.error||'Unknown error.'),false);
    }catch(error){setBubbleText(pending,'AI connection: '+(error?.message||'Request failed.'),false);}
    finally{busy=false;sendButton.disabled=false;updateStatus();input.focus();}
  });
  document.documentElement.appendChild(host);
  applyUI();renderModels();loadSettings();
})();

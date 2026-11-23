/* Read-only on-demand scanner. No polling, model calls or game actions. */
(function (root) {
  'use strict';
  const State = typeof module !== 'undefined' && module.exports ? require('./battle-state.js') : root.ZyncezBattleState;
  const clean = (s,n=100) => String(s == null?'':s).replace(/\s+/g,' ').trim().slice(0,n);
  // Per-battle state survives switches even if Showdown compacts the displayed log.
  const session = new Map();
  const displayed = e => !!e && (typeof e.getClientRects !== 'function' || e.getClientRects().length > 0) &&
    !(e.closest?.('[aria-hidden="true"]')) && (typeof getComputedStyle !== 'function' || getComputedStyle(e).visibility!=='hidden');

  function readActive(battle,klass) {
    if (!battle) return [];
    return Array.from(battle.querySelectorAll(`.statbar.${klass}`)).filter(displayed).map(e=>{
      const strong=e.querySelector('strong');
      const name=clean(strong?.childNodes?.[0]?.textContent || strong?.textContent || e.getAttribute('title'),65);
      const hp=clean(e.querySelector('.hptext')?.textContent || e.querySelector('.hptextborder')?.textContent || '',25);
      const status=clean(e.querySelector('.status')?.textContent||'',20);
      return {name,hp,status};
    }).filter(p=>p.name).slice(0,3);
  }
  function readSidebar(room,side) {
    const container=room.querySelector(side);
    if (!container) return {known:[],unknown:0};
    const icons=Array.from(container.querySelectorAll('.teamicons span[aria-label], .teamicons span[title]'));
    const labels=icons.map(el=>el.getAttribute('aria-label')||el.getAttribute('title')||'');
    const known=labels.map(State.parseIcon).filter(Boolean);
    const unknown=labels.filter(x=>/^not revealed$/i.test(clean(x))).length;
    return {known,unknown};
  }
  function readButtons(room) {
    const nodes=Array.from(room.querySelectorAll('button[name="chooseMove"], button[name="chooseSwitch"], .movemenu button, .switchmenu button'));
    return nodes.filter(displayed).map(b=>{
      const action=b.getAttribute('name') || (b.closest('.movemenu')?'chooseMove':b.closest('.switchmenu')?'chooseSwitch':'');
      const name=clean(b.querySelector('.movename')?.textContent||b.querySelector('.pokemonname')?.textContent||b.textContent,75);
      return {name,action,disabled:b.disabled===true};
    }).filter(b=>b.name&&['chooseMove','chooseSwitch'].includes(b.action)).slice(0,24);
  }
  function read() {
    // Each PS battle has a separate room, so do not mix previous opponents from other battles.
    const rooms=Array.from(document.querySelectorAll('.ps-room')).filter(displayed);
    const room=rooms.find(r=>r.querySelector('.battle'))||document;
    const battle=room.querySelector('.battle');
    const key=room===document ? `document:${location.hash}` : room;
    const prior=session.get(key)||{opponentRevealed:[],lastSeenTurn:null};
    const log=room.querySelector('.battle-log, .battle-history');
    // Read the entire battle log locally for reveal tracking, not just the last 40 lines.
    // Raw text/log and account names are NEVER sent to the AI.
    const lines=log?(log.innerText||log.textContent||'').split('\n').map(s=>clean(s,220)).filter(Boolean):[];
    const myActive=readActive(battle,'rstatbar'); // Showdown: near/back sprite
    const opponentActive=readActive(battle,'lstatbar'); // Showdown: far/front sprite
    const opponent=readSidebar(room,'.rightbar'); // Showdown: far/opposing side
    const own=readSidebar(room,'.leftbar');
    const opponentName=clean(room.querySelector('.rightbar .trainer strong')?.textContent||'',80);
    const history=State.parseHistory(lines,opponentName);
    const turnMatches=[...lines.join(' ').matchAll(/\bTurn\s+(\d+)\b/gi)];
    const turn=turnMatches.length?Number(turnMatches[turnMatches.length-1][1]):null;
    const foeList=State.mergeKnown(prior.opponentRevealed,opponent.known,history,opponentActive,turn);
    if (battle) session.set(key,{opponentRevealed:foeList,lastSeenTurn:turn});
    // Include both species and nicknames where revealed (e.g., renamed Pokémon).
    const lookup=new Map(opponent.known.map(p=>[p.name.toLowerCase(),p.species]));
    for(const p of opponentActive) p.species=lookup.get(p.name.toLowerCase())||p.name;
    const myLookup=new Map(own.known.map(p=>[p.name.toLowerCase(),p.species]));
    for(const p of myActive) p.species=myLookup.get(p.name.toLowerCase())||p.name;
    const buttons=readButtons(room);
    return {
      roomId:clean(room?.dataset?.roomid||room?.id?.replace(/^room-/i,'')||'',160),
      battleFound:!!battle,turn,myActive,opponentActive,opponentRevealed:foeList,
      opponentUnknownSlots:opponent.unknown,buttons,
      // Legacy status reader fields (not forwarded as raw log or headers).
      pokemon:[...myActive,...opponentActive].map(p=>({name:p.name,hp:p.hp})),
      header:clean(room.querySelector('h2, .battle-header, .roomtitle')?.textContent),
      lines:lines.slice(-12),sampledAt:new Date().toISOString()
    };
  }
  const api={read};
  if (typeof module!=='undefined' && module.exports) module.exports=api;
  if (root) root.ZyncezReader=api;
})(typeof window!=='undefined'?window:globalThis);

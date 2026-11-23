/* Pure, read-only opponent roster tracker. Consumes only publicly displayed battle information. */
(function (root) {
  'use strict';
  const clean = (v,n=80) => String(v == null ? '' : v).replace(/\s+/g,' ').trim().slice(0,n);
  const HIDDEN = /^(?:not revealed|unrevealed|unknown|empty|\?+|unrevealed illusion user)$/i;
  const NON_SPECIES = /^(?:active|fainted|par|brn|psn|tox|slp|frz|confused|\d+%.*|\d+\/\d+.*)$/i;

  function parseIcon(label) {
    const original = clean(label,160);
    if (!original || HIDDEN.test(original)) return null;
    const active = /\(active\)/i.test(original);
    const fainted = /\(fainted\)/i.test(original);
    const fields = [...original.matchAll(/\(([^()]*)\)/g)].map(m=>clean(m[1]));
    const nickname = clean(original.replace(/\s*\([^()]*\)/g,''),65);
    const species = fields.find(f => f && !NON_SPECIES.test(f) && !HIDDEN.test(f)) || nickname;
    if (!species || HIDDEN.test(species)) return null;
    return {name:nickname||species,species:clean(species,65),active,fainted,source:'sidebar'};
  }

  function parseHistory(lines, opponentName) {
    const list=[];
    const playerName=clean(opponentName,80);
    for (const rawLine of Array.isArray(lines)?lines:[]) {
      const line=clean(rawLine,220);
      // Narrated Showdown battle messages: exclude chat, which never matches these anchors.
      const m=line.match(/^(.+?) sent out (.+?)!?(?:\s*$)/i);
      if (m && playerName && clean(m[1])===playerName) {
        const details=clean(m[2].replace(/[!.]+$/,''),100);
        const p=parseIcon(details) || {name:details,species:details,source:'log'};
        list.push({...p,source:'log'});
      }
      // Normalized spectator/translated battle logs can use 'The opposing …'.
      const opposing=line.match(/^(?:The opposing|Opposing) (.+?) (?:was sent out|entered the battle|fainted)!?$/i);
      if (opposing) { const p=parseIcon(opposing[1]); if (p) list.push({...p,source:'log'}); }
    }
    return list;
  }

  function mergeKnown(previous,sidebar,events,active,turn) {
    const result=[];
    const put=(value)=>{
      if (!value?.species || HIDDEN.test(value.species)) return;
      const species=clean(value.species,65),name=clean(value.name,65)||species;
      // Keep separately nicknamed Pokémon even if Species Clause is off.
      const key=`${species.toLowerCase()}|${name.toLowerCase()}`;
      const i=result.findIndex(x=>`${x.species.toLowerCase()}|${x.name.toLowerCase()}`===key);
      const row={name,species,active:false,fainted:!!value.fainted,source:clean(value.source,15)||'observed',lastSeenTurn:Number.isInteger(turn)?turn:null};
      if (i<0) result.push(row);
      else result[i]={...result[i],...row,active:result[i].active||!!value.active,fainted:result[i].fainted||!!value.fainted};
    };
    // Fresh DOM is more authoritative than saved context; current active is updated below.
    for (const p of previous||[]) put({...p,source:p.source||'observed'});
    for (const p of events||[]) put(p);
    for (const p of sidebar||[]) put(p);
    // Resolve nicknames to shown species from the sidebar when available.
    const lookup=new Map((sidebar||[]).map(p=>[p.name.toLowerCase(),p.species]));
    for (const p of active||[]) put({name:p.name,species:lookup.get(p.name.toLowerCase())||p.species||p.name,source:'active'});
    const activeNames = new Set((active||[]).map(p=>p.name.toLowerCase()));
    for (const p of result) p.active=activeNames.has(p.name.toLowerCase());
    return result.slice(0,24);
  }
  // Parse Showdown's public, protocol-structured battle events. Chat messages
  // are excluded before arriving here. Never forward raw protocol to an AI.
  function parseProtocol(protocol,opponentSideId) {
    const events=[];
    const sideId=/^p[1-4]$/.test(opponentSideId||'')?opponentSideId:'';
    let turn=null;
    const actor=(identifier)=>{
      const match=clean(identifier,95).match(/^(p[1-4])[a-c]?:\s*(.+)$/i);
      return match?{side:match[1]===sideId?'opponent':'mine',name:clean(match[2],65)}:{side:'unknown',name:''};
    };
    const allowed=new Set(['turn','move','switch','drag','replace','faint','cant','-status','-curestatus','-damage','-heal','-ability','-item','-enditem','-terastallize','-weather','-fieldstart','-fieldend','-sidestart','-sideend','-boost','-unboost','detailschange','-formechange']);
    for(const raw of Array.isArray(protocol)?protocol.slice(-300):[]) {
      if(typeof raw!=='string'||raw.length>450||!raw.startsWith('|')) continue;
      const fields=raw.split('|');
      const type=fields[1];if(!allowed.has(type))continue;
      if(type==='turn') {const t=Number(fields[2]);if(Number.isInteger(t)&&t>=0&&t<=1000)turn=t;continue;}
      let row={type,turn};
      if(type==='-weather'||type==='-fieldstart'||type==='-fieldend') {
        row.detail=clean(fields[2],65);
      } else {
        const who=actor(fields[2]);
        if(!who.name && type!=='-sidestart' && type!=='-sideend') continue;
        row.side=who.side;
        row.pokemon=who.name;
        if(type==='move') {
          row.move=clean(fields[3],65);
          row.target=actor(fields[4]).name;
          if(!row.move) continue;
        } else if(['switch','drag','replace','detailschange','-formechange'].includes(type)) {
          row.detail=clean((fields[3]||'').split(',')[0],65);
        } else if(['-status','-curestatus','-ability','-item','-enditem','-terastallize','cant','-sidestart','-sideend','-boost','-unboost'].includes(type)) {
          row.detail=clean(fields[type==='cant'?4:3],65);
        } else if(type==='-damage'||type==='-heal') {
          row.detail=clean(fields[3],35);
        }
      }
      events.push(row);
    }
    return events.slice(-65);
  }
  function enrichState(state,game) {
    const result={...state};
    result.myParty=[];
    result.battleEvents=[];
    result.opponentMovesSeen=[];
    result.gameReadStatus='unavailable';
    result.battleConditions=null;
    if(!game?.available) {
      result.gameReadStatus=clean(game?.reason||'Game client data not available',120);
      // Show the own team disclosed in the sidebar even if client room data cannot be accessed.
      return result;
    }
    result.gameReadStatus='connected';
    // Current battle field is read from Showdown's state, never guessed from chat.
    if(game.battleConditions && typeof game.battleConditions==='object') {
      const condition=game.battleConditions;
      result.battleConditions={generation:Number.isInteger(condition.generation)?condition.generation:9,
        weather:clean(condition.weather,40),terrain:clean(condition.terrain,40),trickRoom:!!condition.trickRoom,
        tailwind:{mine:!!condition.tailwind?.mine,opponent:!!condition.tailwind?.opponent}};
    }
    const activeNames=new Set((result.myActive||[]).map(p=>p.name?.toLowerCase()).filter(Boolean));
    result.myParty=(Array.isArray(game.myParty)?game.myParty:[]).slice(0,12).map(p=>({
      slot:Number.isInteger(p?.slot)?p.slot:null,name:clean(p?.name,65),species:clean(p?.species,65),
      hp:clean(p?.hp,25),status:clean(p?.status,15),active:!!p?.active||activeNames.has(String(p?.name||'').toLowerCase()),
      fainted:!!p?.fainted,moves:Array.isArray(p?.moves)?p.moves.slice(0,6).map(m=>clean(m,65)).filter(Boolean):[],
      ability:clean(p?.ability,65),item:clean(p?.item,65),teraType:clean(p?.teraType,25),
      speed:Number.isInteger(p?.speed)&&p.speed>0?p.speed:null,
      level:Number.isInteger(p?.level)&&p.level>=1&&p.level<=100?p.level:null
    })).filter(p=>p.species);
    // Match move-request slots by active field order, not by the original party
    // index: the active Pokemon may have switched positions in a Doubles battle.
    const activeMoves=Array.isArray(game.activeMoves)?game.activeMoves:[];
    const activeField=Array.isArray(game.myActive)?game.myActive:[];
    for(const [index,fieldMon] of activeField.entries()) {
      const name=String(fieldMon?.name||'').toLowerCase();
      const species=String(fieldMon?.species||'').toLowerCase();
      const partyMon=result.myParty.find(p=>p.active && (p.name.toLowerCase()===name || p.species.toLowerCase()===species));
      const requested=activeMoves[index]?.moves;
      if(!partyMon||!Array.isArray(requested)||!requested.length)continue;
      partyMon.currentMoves=requested.slice(0,6).map(m=>({name:clean(m?.name,65),pp:Number.isInteger(m?.pp)?m.pp:null,
        maxpp:Number.isInteger(m?.maxpp)?m.maxpp:null,disabled:!!m?.disabled,target:clean(m?.target,35)}));
    }
    function mergeField(displayed,observed) {
      const inDom=Array.isArray(displayed)?displayed:[];
      const inClient=Array.isArray(observed)?observed:[];
      const used=new Set();
      const merged=inDom.map((p,i)=>{
        let index=inClient.findIndex((mon,j)=>!used.has(j) &&
          (p.name?.toLowerCase()===mon.name?.toLowerCase() ||
          p.species?.toLowerCase()===mon.species?.toLowerCase()));
        if(index<0 && inClient.length===inDom.length && !used.has(i))index=i;
        const details=index>=0?inClient[index]:{};
        if(index>=0)used.add(index);
        return {...details,...p,
          level:Number.isInteger(details.level)?details.level:null,
          baseSpeed:Number.isInteger(details.baseSpeed)?details.baseSpeed:null,
          speedStage:Number.isInteger(details.speedStage)?details.speedStage:0,
          ability:clean(details.ability,65),item:clean(details.item,65)};
      });
      return (merged.length?merged:inClient).slice(0,3);
    }
    result.myActive=mergeField(result.myActive,game.myActive);
    result.opponentActive=mergeField(result.opponentActive,game.opponentActive);
    const prior=result.opponentRevealed||[];
    const fromClient=Array.isArray(game.opponentKnown)?game.opponentKnown.map(p=>({...p,source:'client'})):[];
    const turn=result.turn;
    result.opponentRevealed=mergeKnown(prior,fromClient,[],result.opponentActive||[],turn);
    result.battleEvents=parseProtocol(game.protocol,game.opponentSideId);
    const moveMap=new Map();
    for(const ev of result.battleEvents){
      if(ev.type!=='move'||ev.side!=='opponent'||!ev.move)continue;
      const k=ev.pokemon.toLowerCase();
      if(!moveMap.has(k)) moveMap.set(k,{name:ev.pokemon,moves:[]});
      const bucket=moveMap.get(k);
      if(!bucket.moves.includes(ev.move))bucket.moves.push(ev.move);
    }
    result.opponentMovesSeen=[...moveMap.values()].slice(0,12).map(p=>({...p,moves:p.moves.slice(0,6)}));
    for(const foe of result.opponentRevealed) {
      const match=moveMap.get(foe.name.toLowerCase())||moveMap.get(foe.species.toLowerCase());
      if(match)foe.movesSeen=match.moves.slice(0,6);
    }
    if(result.turn===null || result.turn===undefined) {
      const seenTurns=result.battleEvents.map(e=>e.turn).filter(Number.isInteger);
      if(seenTurns.length)result.turn=seenTurns.at(-1);
    }
    return result;
  }
  const api={parseIcon,parseHistory,mergeKnown,parseProtocol,enrichState};
  if (typeof module!=='undefined' && module.exports) module.exports=api;
  if (root) root.ZyncezBattleState=api;
})(typeof window!=='undefined'?window:globalThis);

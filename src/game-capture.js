/* Executes only on explicit user request in Showdown's MAIN world.
   Reads the player's own battle request and public battle protocol; no game commands. */
(function (root) {
  'use strict';
  function capture(hint) {
    const text = (value, length=90) => String(value == null ? '' : value).replace(/[\x00-\x1f\x7f]/g, ' ').trim().slice(0,length);
    const id = text(hint,160).replace(/^#/, '');
    const entries=[];
    const include=(room)=>{
      if (!room || typeof room!=='object' || !room.battle || entries.includes(room)) return;
      entries.push(room);
    };
    const app=window.app;
    const ps=window.PS;
    include(app?.curRoom);
    include(ps?.room);
    include(ps?.leftRoom);
    include(ps?.rightRoom);
    if(id) {include(app?.rooms?.[id]);include(ps?.rooms?.[id]);}
    for(const rooms of [app?.rooms,ps?.rooms]) {
      if (!rooms || typeof rooms!=='object') continue;
      for(const room of Object.values(rooms).slice(0,40)) include(room);
    }
    const battleRooms=entries.filter(r=>r.battle && typeof r.battle==='object');
    const match=battleRooms.find(r=>text(r.id,160)===id);
    const activeFirst=[app?.curRoom,ps?.room,ps?.leftRoom,ps?.rightRoom].find(r=>battleRooms.includes(r));
    const room=match || (battleRooms.length===1?battleRooms[0]:activeFirst);
    if(!room) return {available:false,reason:battleRooms.length?'Choose the active battle tab first.':'Showdown game room could not be accessed.'};
    const battle=room.battle;
    const request=room.request && typeof room.request==='object' ? room.request : null;
    const source=Array.isArray(request?.side?.pokemon) ? request.side.pokemon :
      (Array.isArray(battle.myPokemon)?battle.myPokemon:[]);
    const roster=source.slice(0,12).map((p, index)=>{
      if(!p||typeof p!=='object') return null;
      const detail=text(p.details,120).split(',')[0];
      const name=text(p.ident,120).replace(/^p[1-4][a-c]?:\s*/i,'') || detail;
      const moves=Array.isArray(p.moves)?p.moves.slice(0,6).map(m=>text(typeof m==='string'?m:m?.id||m?.name,60)).filter(Boolean):[];
      const condition=text(p.condition,60);
      const hp=condition.split(' ')[0]||'';
      const active=!!p.active;
      const status=condition.match(/\b(brn|psn|tox|par|slp|frz|fnt)\b/i)?.[0]||'';
      return {slot:index+1,name,species:detail||name,active,fainted:/\bfnt\b/i.test(condition),hp,status,moves,
        ability:text(p.ability||p.baseAbility,60),item:text(p.item,60),teraType:text(p.teraType,25),
        speed:Number.isInteger(p?.stats?.spe)&&p.stats.spe>0?p.stats.spe:null,
        level:Number((p.details||'').match(/\bL(\d{1,3})\b/)?.[1])||
          (Number.isInteger(p.level)?p.level:null)};
    }).filter(Boolean);
    // Move priority is public move metadata; don't invent it for unknown moves.
    const movePriority=(move)=>{
      try { const info=window.Dex?.moves?.get?.(move); return Number.isInteger(info?.priority)?info.priority:null; }
      catch { return null; }
    };
    // Active request includes displayed PP/disabled state, unlike the full roster.
    const activeMoves=Array.isArray(request?.active)?request.active.slice(0,3).map((a,index)=>({
      slot:index+1,moves:Array.isArray(a?.moves)?a.moves.slice(0,6).map(m=>({
        name:text(m?.name||m?.id,70),pp:Number.isInteger(m?.pp)?m.pp:null,
        maxpp:Number.isInteger(m?.maxpp)?m.maxpp:null,disabled:!!m?.disabled,target:text(m?.target,40),
        priority:movePriority(m?.id||m?.name)
      })):[]
    })):[];
    const getBaseSpeed=(species)=>{
      try {
        const dex=window.Dex;
        const key=String(species||'').toLowerCase().replace(/[^a-z0-9]/g,'');
        const entry=dex?.species?.get?.(species)||window.BattlePokedex?.[key];
        const value=entry?.baseStats?.spe;
        return Number.isInteger(value)&&value>0?value:null;
      } catch { return null; }
    };
    const snapSide=(side)=>Array.isArray(side?.active)?side.active.slice(0,3).filter(Boolean).map(p=>({
      name:text(p.name,65),species:text(p.speciesForme||p.name,65),
      hp:Number.isFinite(p.hp) && Number.isFinite(p.maxhp)&&p.maxhp>0 ?
        `${Math.round(p.hp/p.maxhp*100)}%`:text(p.getHPText?.(),25),
      status:text(p.status,15),
      level:Number.isInteger(p.level)?p.level:100,
      speedStage:Number.isInteger(p.boosts?.spe)?p.boosts.spe:0,
      ability:text(p.ability,60),item:text(p.item,60),
      baseSpeed:getBaseSpeed(p.speciesForme||p.name)
    })):[];
    const knownOpposing=Array.isArray(battle.farSide?.pokemon)?battle.farSide.pokemon.slice(0,12).map(p=>({
      name:text(p?.name,65),species:text(p?.speciesForme||p?.name,65),fainted:!!p?.fainted
    })).filter(p=>p.name||p.species):[];
    // Only recognized machine battle events. No chat, player names, user messages or private log.
    const safeProtocol=/^\|(?:turn|move|switch|drag|replace|faint|cant|detailschange|-formechange|-damage|-heal|-status|-curestatus|-weather|-fieldstart|-fieldend|-sidestart|-sideend|-ability|-item|-enditem|-terastallize|-boost|-unboost)\|/;
    const protocol=Array.isArray(battle.stepQueue)?battle.stepQueue
      .filter(line=>typeof line==='string'&&line.length<=450&&safeProtocol.test(line))
      .slice(-300).map(line=>line.slice(0,300)):[];
    const hasCondition=(side,key)=>Object.keys(side?.sideConditions||{}).some(k=>k.toLowerCase().replace(/[^a-z0-9]/g,'')===key);
    const pseudo=(battle.pseudoWeather||[]).map(x=>String(Array.isArray(x)?x[0]:x||'').toLowerCase().replace(/[^a-z0-9]/g,''));
    const battleConditions={generation:Number.isInteger(battle.gen)?battle.gen:9,
      weather:text(battle.weather,35),
      terrain:pseudo.find(x=>['electricterrain','grassyterrain','mistyterrain','psychicterrain'].includes(x))||'',
      trickRoom:pseudo.includes('trickroom'),
      tailwind:{mine:hasCondition(battle.nearSide,'tailwind'),opponent:hasCondition(battle.farSide,'tailwind')}
    };
    const sideNum=battle.farSide?.n;
    return {
      available:true,roomId:text(room.id,160),myParty:roster,activeMoves,
      myActive:snapSide(battle.nearSide),opponentActive:snapSide(battle.farSide),
      opponentKnown:knownOpposing,battleConditions,opponentSideId:Number.isInteger(sideNum)?`p${sideNum+1}`:'',
      protocol
    };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports={capture};
  if (root) root.ZyncezCapture={capture};
})(typeof self !== 'undefined' ? self : globalThis);

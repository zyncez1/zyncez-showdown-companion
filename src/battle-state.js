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
  const api={parseIcon,parseHistory,mergeKnown};
  if (typeof module!=='undefined' && module.exports) module.exports=api;
  if (root) root.ZyncezBattleState=api;
})(typeof window!=='undefined'?window:globalThis);

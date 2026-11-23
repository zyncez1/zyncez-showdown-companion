/* Evidence-based decision explanation: an observable justification, not hidden AI thought.
 * Produces a small, checkable brief to help GPT speak naturally without inventing facts.
 * Uncertainty and counterfactuals are explicit; scores are never included. */
(function(root) {
  'use strict';
  const key = value => String(value == null ? '' : value).toLowerCase().replace(/[^a-z0-9]/g,'');
  const label = mon => String(mon?.species||mon?.name||'').slice(0,70);
  const text = value => String(value == null ? '' : value).slice(0,170);
  const same = (a,b) => !!(key(a)&&key(a)===key(b));
  const pct = value => Number.isFinite(value) ? Number(value.toFixed(1)) : null;
  function chooseEvidence(actions, state) {
    const evidence = [];
    const checks = {legalMoves:true,damage:'unavailable',speed:'uncertain',opponentHistory:'unrevealed',allySafety:'checked',switchOptions:'checked',counterplays:'considered'};
    for (const action of actions) {
      const matching=(state.myParty||[]).find(mon=>mon.active && (same(mon.name,action.actor)||same(mon.species,action.actor)));
      if(action.kind!=='switch') {
        // Revalidate each action against the actual available move request before telling GPT it is legal.
        const moves=matching?.currentMoves||[];
        if(!moves.some(move=>same(move.name||move.id,action.move)&&move.disabled!==true&&move.pp!==0))checks.legalMoves=false;
      } else if(!(state.myParty||[]).some(mon=>!mon.active&&!mon.fainted && (same(mon.name,action.target)||same(mon.species,action.target)))){
        checks.legalMoves=false;
      }
      if(action.kind==='attack') {
        for (const row of (action.damageTargets||[]).slice(0,2)) {
          if(Number.isFinite(row.minPercent)&&Number.isFinite(row.maxPercent)) {
            checks.damage='modeled';
            evidence.push(`${text(action.actor)}'s ${text(action.move)} into ${text(row.target)}: about ${pct(row.minPercent)}–${pct(row.maxPercent)}% modeled damage${row.koUnderAssumptions==='all-modeled'?' (KO across modeled sets)':row.koUnderAssumptions==='possible'?' (possible KO under assumptions)':''}`);
          }
        }
      }
      if(action.order==='before'||action.order==='after'){
        checks.speed='estimated';
        evidence.push(`${text(action.actor)} is estimated to move ${action.order} ${text(action.target)} at equal priority`);
      }
      if(action.kind==='protect')evidence.push(`${text(action.actor)} has an available protection move`);
      if(action.incomingThreat && (action.kind==='protect'||action.kind==='attack'))
        evidence.push(`Revealed retaliation: ${text(action.incomingThreat)}`);
      if(action.kind==='speed-control')evidence.push(`${text(action.actor)} can attempt to change turn order using ${text(action.move)}`);
      if(action.kind==='switch')evidence.push(`${text(action.target)} is an available non-fainted reserve`);
      if(action.targeting?.hitsAlly)checks.allySafety='spread move threatens ally unless protected or immune';
    }
    if((state.opponentMovesSeen||[]).some(p=>(p.moves||[]).length))checks.opponentHistory='revealed moves read';
    if((state.speedAnalysis?.matchups||[]).some(m=>['before','after'].includes(m.order)))checks.speed='estimated';
    return {evidence:[...new Set(evidence)].slice(0,5),checks};
  }
  function build({choice,alternative,scenarios=[],state={}}) {
    const actions=choice?.actions||[];
    if(!actions.length) return {valid:false,reason:'No chosen actions to justify.'};
    const {evidence,checks}=chooseEvidence(actions,state);
    if(!checks.legalMoves)return {valid:false,reason:'A recommended action is no longer available in the current move or switch request.'};
    const kinds=new Set(actions.map(a=>a.kind));
    let objective='Apply pressure while keeping a response to likely opponent actions';
    if(kinds.has('protect')&&kinds.has('attack'))objective='Protect one teammate while its partner applies pressure';
    else if(kinds.has('protect'))objective='Preserve a threatened Pokémon instead of risking an immediate loss';
    else if(kinds.has('speed-control'))objective='Improve future turn order before committing to a damage race';
    else if(kinds.has('switch'))objective='Improve positioning and preserve useful Pokémon for later turns';
    else if(actions.some(a=>(a.damageTargets||[]).some(d=>d.koUnderAssumptions==='all-modeled'||d.koUnderAssumptions==='possible')))
      objective='Pressure a possible knockout without ignoring retaliation';
    const opponentConsiderations=scenarios.map(s=>text(s.label)).slice(0,3);
    const plausibleReversal=[];
    if(scenarios.some(s=>s.id==='protect'))plausibleReversal.push('An opposing Protect could block targeted damage');
    if(scenarios.some(s=>s.id==='switch'))plausibleReversal.push('A switch could change the matchup and damage calculation');
    if((state.speedAnalysis?.matchups||[]).some(m=>['uncertain','unknown'].includes(m.order)))
      plausibleReversal.push('An unconfirmed Speed set or item could change attack order');
    if((state.opponentUnknownSlots||0)>0)plausibleReversal.push('Unrevealed opposing Pokémon could alter the best play');
    if(checks.damage!=='modeled'&&kinds.has('attack'))plausibleReversal.push('Damage for a recommended attack was unavailable');
    if(actions.some(a=>a.targeting?.hitsAlly))plausibleReversal.push('A spread attack may hit your partner');
    const altActions=alternative?.actions||[];
    let comparedWith='';
    if(altActions.length) {
      const altKinds=new Set(altActions.map(a=>a.kind));
      if(kinds.has('protect')&&!altKinds.has('protect'))comparedWith='This plan values preserving a vulnerable slot more than immediate damage';
      else if(kinds.has('speed-control')&&!altKinds.has('speed-control'))comparedWith='This plan values future turn order over immediate pressure';
      else if(kinds.has('switch')&&!altKinds.has('switch'))comparedWith='This plan values positioning rather than immediate damage';
      else if(!kinds.has('switch')&&altKinds.has('switch'))comparedWith='This plan keeps offensive pressure instead of yielding a turn to a switch';
      else if(!kinds.has('protect')&&altKinds.has('protect'))comparedWith='This plan favors initiative over the safer defensive option';
      else comparedWith='This plan has the stronger modeled trade-off across the considered counterplays';
    }
    const confidence=(checks.damage==='modeled'&&checks.speed==='estimated'&&checks.opponentHistory==='revealed moves read'&&plausibleReversal.length<=1)?'moderate':'low';
    return {
      valid:true,
      objective,
      evidence,
      checks,
      comparedWith,
      opponentConsiderations,
      changeMyMindIf:plausibleReversal.slice(0,3),
      confidence,
      method:'Compare only available actions using measured battle facts, conditional damage and turn-order estimates, team coordination, and plausible responses. Never treat hidden builds as known.'
    };
  }
  const api={build,chooseEvidence};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.ZyncezJustification=api;
})(typeof window!=='undefined'?window:globalThis);

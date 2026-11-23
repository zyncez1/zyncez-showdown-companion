/* Bounded, local tactical evaluation for on-demand questions.
   No model calls, automatic gameplay, probabilities, or hidden information claims.
   Scores are heuristics for comparing legal choices, NOT damage or win chances. */
(function (root) {
  'use strict';
  const Types = typeof module !== 'undefined' && module.exports ? require('./types.js') : root.ZyncezTypes;
  const Justification = typeof module !== 'undefined' && module.exports ? require('./justification-engine.js') : root.ZyncezJustification;
  const key = v => String(v == null ? '' : v).toLowerCase().replace(/[^a-z0-9]/g, '');
  const str = (v,n=65) => String(v == null ? '' : v).replace(/[\x00-\x1f\x7f]/g, ' ').slice(0,n).trim();
  const finite = v => Number.isFinite(v) ? v : null;
  const clamp = (v,min,max) => Math.max(min,Math.min(max,v));
  const protectMoves = new Set(['protect','detect','kingsshield','spikyshield','banefulbunker','silktrap','obstruct','burningbulwark','maxguard']);
  const speedMoves = new Set(['tailwind','trickroom','icywind','electroweb','thunderwave','scaryface','bulldoze','agility','rocktomb','stringshot']);
  const setupMoves = new Set(['swordsdance','dragondance','nastyplot','calmmind','bulkup','quiverdance','shellsmash','coil','irondefense']);
  const supportMoves = new Set(['helpinghand','followme','ragepowder','wideguard','quickguard','lifedew','reflect','lightscreen','auroraveil']);
  const spreadTargets = new Set(['alladjacentfoes','alladjacent','all','foeside','allyside']);
  const friendlySpread = new Set(['alladjacent','all']);
  const attackCategories = new Set(['physical','special']);
  function isTacticalQuestion(q) {
    return /\b(best|play|move|attack|switch|swap|protect|defend|win|turn|outspeed|faster|threat|prediction|predict|counter|strategy|damage|ko|terastall|tera|target|lead|set\s*up|tailwind|trick\s*room)\b|\bwhat\s*(?:(?:do|should|would|can)\s*i\s*(?:do|use|click|pick|choose)|now\??)|\bany\s*ideas\b/i.test(String(q||''));
  }
  function sameMon(a,b) {
    return !!a && !!b && ((key(a.name)&&key(a.name)===key(b.name)) ||
      (key(a.species)&&key(a.species)===key(b.species)));
  }
  const monLabel = m => str(m?.species || m?.name,65);
  const knownTypes = mon => Array.isArray(mon?.types) ? mon.types.map(Types.normalize).filter(Boolean).slice(0,2) : [];
  function effectiveness(moveType,pokemon) {
    const types=knownTypes(pokemon);
    return types.length && Types.normalize(moveType) ? Types.multiplier(moveType,types) : null;
  }
  function scenarios(state) {
    const foes=state.opponentActive||[];
    const moves=(state.opponentMovesSeen||[]).flatMap(x=>Array.isArray(x.moves)?x.moves:[]);
    const keys=new Set(moves.map(key));
    const events=state.battleEvents||[];
    const last=events.filter(e=>e.side==='opponent'&&e.type==='move').slice(-5);
    const out=[{id:'attack',label:'Opponent attacks',observed:last.some(e=>!protectMoves.has(key(e.move)))}];
    const protectionRevealed=[...keys].some(m=>protectMoves.has(m));
    if(foes.length && protectionRevealed)
      out.push({id:'protect',label:'Opponent uses a revealed protection move',observed:true});
    else if(foes.some(f=>(healthFraction(f)??1)<0.5) && (state.turn??0)>1)
      out.push({id:'protect',label:'Opponent might protect a damaged Pokémon (unconfirmed)',observed:false});
    // Switching is a legal possibility if an opposing bench slot is known; not a prediction of intent.
    if ((state.opponentRevealed||[]).some(p=>!p.active&&!p.fainted) || (state.opponentUnknownSlots||0)>0)
      out.push({id:'switch',label:'Opponent switches',observed:false});
    if (moves.some(m=>speedMoves.has(key(m)))) out.push({id:'speed',label:'Opponent uses revealed speed control',observed:true});
    return out.slice(0,4);
  }
  function healthFraction(p) {
    const hp=str(p?.hp,30);
    const numeric=hp.match(/^(\d+(?:\.\d+)?)%$/);
    if(numeric) return clamp(Number(numeric[1])/100,0,1);
    const ratio=hp.match(/^(\d+)\/(\d+)$/);
    if(ratio && +ratio[2]>0) return clamp(+ratio[1]/+ratio[2],0,1);
    return null;
  }
  function speedOrder(state,own,foe) {
    const match=(state.speedAnalysis?.matchups||[]).find(x=>key(x.mine)===key(monLabel(own))&&key(x.opponent)===key(monLabel(foe)));
    return match?.order||'unknown';
  }
  function moveMeta(knownMove) {
    const name=str(typeof knownMove==='string'?knownMove:knownMove?.name||knownMove?.id,65);
    return {name,id:key(name),type:Types.normalize(knownMove?.type),category:str(knownMove?.category,20),
      basePower:finite(knownMove?.basePower),accuracy:finite(knownMove?.accuracy),
      priority:Number.isInteger(knownMove?.priority)?clamp(knownMove.priority,-7,7):null,
      target:str(knownMove?.target,40),disabled:knownMove?.disabled===true,
      pp:Number.isInteger(knownMove?.pp)?knownMove.pp:null};
  }
  function inferTargeting(move) {
    const type=key(move.target);
    return {spread:spreadTargets.has(type),hitsAlly:friendlySpread.has(type),
      singleFoe:!type||['normal','adjacentfoe','any'].includes(type),
      self:['self','adjacentallyorself'].includes(type),allyOnly:['adjacentally','allyside'].includes(type)};
  }
  function hasRecentProtect(state,own) {
    const lastTurn=Number.isInteger(state.turn)?state.turn-1:null;
    const my=(state.battleEvents||[]).filter(e=>e.side==='mine'&&e.type==='move'&&
      (lastTurn===null||e.turn===lastTurn)&&sameMon({name:e.pokemon},own));
    return my.some(e=>protectMoves.has(key(e.move)));
  }
  function targetPressure(move,foe,own,state,damageCtx) {
    const typing=effectiveness(move.type,foe);
    const calculation=damageCtx&&attackCategories.has(key(move.category))?
      damageCtx.read(own,foe,move,{attackerIsMine:true,isDoubles:(state.myActive||[]).length>1}):null;
    const pow=move.basePower;
    let rating=move.category&&attackCategories.has(key(move.category)) ? 12 : 5;
    if(pow!==null) rating+=clamp(pow/10,0,15);
    if(typing===0) rating-=55;
    else if(typing===0.25) rating-=22;
    else if(typing===0.5) rating-=12;
    else if(typing===2) rating+=14;
    else if(typing===4) rating+=23;
    if(typing===null)rating-=3;
    if(calculation?.available) {
      // Replace power/type guesswork with measured Smogon damage envelope;
      // preserve modest accuracy/turn-order weights and avoid claiming win odds.
      const min=calculation.minPercent,max=calculation.maxPercent;
      rating=10+clamp(min/7,0,26)+clamp(max/9,0,14);
      if(calculation.koUnderAssumptions==='all-modeled')rating+=13;
      if(calculation.koUnderAssumptions==='possible')rating+=5;
      if(max===0)rating-=45;
    }
    if(move.type&&knownTypes(own).includes(move.type))rating+=6; // possible STAB; abilities can change it
    if(move.accuracy!==null && move.accuracy<100) rating-=clamp((100-move.accuracy)/4,0,12);
    const order=speedOrder(state,own,foe);
    if(move.priority!=null && move.priority>0)rating+=4;
    else if(move.priority===0 || move.priority===null){
      if(order==='before')rating+=3;
      else if(order==='after')rating-=3;
    }
    return {rating,typing,order,damage:calculation?.available?calculation:null};
  }
  function knownDefensiveRisk(mon,foes,seenMoves) {
    const types=knownTypes(mon);
    if(!types.length)return {risk:0,evidence:0};
    let risk=0,evidence=0;
    for(const foe of foes) {
      const item=(seenMoves||[]).find(x=>sameMon(x,foe));
      const candidates=Array.isArray(item?.moves)?item.moves:[];
      let foeRisk=0;
      if (candidates.length) {
        for(const m of candidates) {
          const metadata=(stateMoveMetaCache.get(key(m))||{});
          const mult=effectiveness(metadata.type,mon);
          if(mult==null)continue;
          evidence++;
          foeRisk=Math.max(foeRisk,mult===0?0:mult===0.25?1:mult===0.5?3:mult===1?6:mult===2?13:22);
        }
      }
      if(!foeRisk) {
        for(const t of knownTypes(foe)) {
          const mult=Types.multiplier(t,types);
          if(mult==null)continue;
          foeRisk=Math.max(foeRisk,mult===0?0:mult===0.25?1:mult===0.5?3:mult===1?6:mult===2?12:19);
        }
      }
      risk+=foeRisk;
    }
    return {risk,evidence};
  }
  // Set only for one evaluation, not persisted; move metadata is public and not inferred from hidden sets.
  const stateMoveMetaCache=new Map();
  // Evaluate revealed attacks against the player's active slot. Hidden attacks
  // are NOT invented: absence of a modeled threat does not imply safety.
  function revealedThreat(own,foes,state,damageCtx) {
    if(!damageCtx)return {level:'unknown',risk:0,source:''};
    let greatest=null;
    for(const foe of foes) {
      const row=(state.opponentMovesSeen||[]).find(entry=>sameMon(entry,foe));
      for(const name of (row?.moves||[]).slice(0,4)) {
        const metadata=stateMoveMetaCache.get(key(name))||(state.opponentMoveDetails||[]).find(m=>key(m.name)===key(name));
        if(!metadata||!attackCategories.has(key(metadata.category)))continue;
        const move=moveMeta(metadata);
        const calc=damageCtx.read(foe,own,move,{attackerIsMine:false,isDoubles:(state.myActive||[]).length>1});
        if(!calc?.available)continue;
        const speed=speedOrder(state,own,foe);
        const hp=healthFraction(own);
        const possibleKO=hp!==null&&calc.maxPercent>=hp*100;
        const fast=(move.priority>0)||speed==='after';
        const danger=possibleKO?(fast?22:12):calc.maxPercent>65?(fast?13:7):calc.maxPercent>35?5:0;
        if(!greatest||danger>greatest.risk)greatest={level:possibleKO?'possible-ko':'damage',risk:danger,
          source:`${monLabel(foe)} revealed ${move.name} (${calc.minPercent}–${calc.maxPercent}% modeled damage to ${monLabel(own)}; opponent Speed and build may vary)`,possibleKO,speed};
      }
    }
    return greatest||{level:'unknown',risk:0,source:''};
  }
  function makeCandidates(own,index,state,foes,bench,damageCtx) {
    const party=(state.myParty||[]).find(p=>p.active&&sameMon(p,own))||
      (state.myParty||[]).find(p=>sameMon(p,own));
    const current=Array.isArray(party?.currentMoves)?party.currentMoves:[];
    const forced=state.playerRequestType==='switch';
    const waiting=['wait','team'].includes(state.playerRequestType);
    const trapped=(state.playerTrapped||[])[index]===true;
    if(waiting)return [];
    const out=[];
    const incoming=revealedThreat(own,foes,state,damageCtx);
    if(!forced) {
      for(const m of current) {
        const move=moveMeta(m);
        if(!move.name||move.disabled||move.pp===0)continue;
        const targetInfo=inferTargeting(move);
        const kind=protectMoves.has(move.id)?'protect':speedMoves.has(move.id)?'speed-control':
          setupMoves.has(move.id)?'setup':supportMoves.has(move.id)?'support':
          attackCategories.has(key(move.category))?'attack':'utility';
        const realTargets=kind==='attack' && targetInfo.singleFoe ? foes : [null];
        for(const foe of realTargets) {
          if(kind==='attack'&& targetInfo.singleFoe && !foe)continue;
          const pressure=foe?targetPressure(move,foe,own,state,damageCtx):null;
          let score=pressure?.rating??0;
          const risk=foes.reduce((total,f)=>total+(speedOrder(state,own,f)==='after'?4:0),0);
          const hp=healthFraction(own);
          if(kind==='protect')score=12+risk+(hp!==null?Math.round((1-hp)*18):0)-(hasRecentProtect(state,own)?22:0)+incoming.risk;
          if(kind==='attack'&&incoming.risk>0 && pressure?.order==='after')score-=Math.round(incoming.risk*0.6);
          if(kind==='attack'&&incoming.possibleKO&&pressure?.order==='before'&&pressure?.damage?.koUnderAssumptions==='all-modeled')score+=7;
          if(kind==='speed-control')score=14+Math.min(foes.length*4,8)+(foes.some(f=>speedOrder(state,own,f)==='after')?9:0);
          if(kind==='setup')score=12+(foes.some(f=>speedOrder(state,own,f)==='after')?-4:3);
          if(kind==='support')score=14;
          if(kind==='utility')score=8;
          let damageTargets=[];
          if(kind==='attack'&&(targetInfo.spread||key(move.target)==='randomnormal')) {
            const perFoe=foes.map(f=>({foe:f,pressure:targetPressure(move,f,own,state,damageCtx)}));
            score=8+perFoe.reduce((total,row)=>total+row.pressure.rating*0.68,0);
            damageTargets=perFoe.filter(row=>row.pressure.damage).map(row=>({
              target:monLabel(row.foe),minPercent:row.pressure.damage.minPercent,
              maxPercent:row.pressure.damage.maxPercent,
              koUnderAssumptions:row.pressure.damage.koUnderAssumptions,
              approximate:row.pressure.damage.approximate
            }));
          } else if(pressure?.damage)damageTargets=[{target:monLabel(foe),
            minPercent:pressure.damage.minPercent,maxPercent:pressure.damage.maxPercent,
            koUnderAssumptions:pressure.damage.koUnderAssumptions,approximate:pressure.damage.approximate}];
          if(kind==='attack'&&targetInfo.hitsAlly)score-=6;
          const notes=[];
          if(kind==='attack'&&targetInfo.spread) {
            const strong=foes.filter(f=>(effectiveness(move.type,f)||0)>=2).map(monLabel);
            if(strong.length) notes.push(`Spread move pressures ${strong.join(' and ')} by typing`);
          }
          if(pressure?.typing===0)notes.push('Known type immunity makes this target a poor choice');
          if(pressure?.typing!=null&&pressure.typing>=2)notes.push(`${pressure.typing}× type matchup before abilities and items`);
          if(pressure?.order==='after')notes.push('May move after the target at equal priority');
          if(move.accuracy!==null&&move.accuracy<100)notes.push('Accuracy risk');
          if(pressure?.damage)notes.push(`${pressure.damage.move}: ${pressure.damage.minPercent}–${pressure.damage.maxPercent}% modeled damage vs ${monLabel(foe)}, subject to unknown sets`);
          if(kind==='protect')notes.push('Preserves this slot against direct attacks; repeated Protect can fail');
          if(kind==='speed-control')notes.push('Can change future turn order if it succeeds');
          if(kind==='attack'&&targetInfo.hitsAlly)notes.push('Area attack can also hit your partner');
          if(incoming.source && (kind==='protect'||kind==='attack'))notes.push(`Observed incoming threat: ${incoming.source}`);
          out.push({actor:monLabel(own),actorIndex:index,kind,move:move.name,
            target:foe?monLabel(foe):'',targeting:targetInfo,priority:move.priority,moveType:move.type,
            score,notes,verified:true,source:'confirmed current move request',
            order:pressure?.order||'unknown',typing:pressure?.typing??null,incomingThreat:incoming.source,
            damage:damageTargets.length===1?damageTargets[0]:null,damageTargets});
        }
      }
    }
    if(!trapped){
      const currentRisk=knownDefensiveRisk(own,foes,state.opponentMovesSeen);
      for(const reserve of bench) {
        const future=knownDefensiveRisk(reserve,foes,state.opponentMovesSeen);
        const hp=healthFraction(reserve);
        const defensiveGain=clamp(currentRisk.risk-future.risk,-18,18);
        const lowHp=hp===null?0:(1-hp)*15;
        const score=10+defensiveGain-lowHp+Math.round(incoming.risk*0.35);
        out.push({actor:monLabel(own),actorIndex:index,kind:'switch',move:'Switch',target:monLabel(reserve),
          benchSlot:reserve.slot||null,score,verified:true,source:'known non-fainted reserve',notes:[
            defensiveGain>5?'May improve defensive matchups, subject to unobserved attacks':'Switching costs offensive momentum',
            'Opponent switching or predicting your switch is still possible'
          ]});
      }
    }
    // Never invent a legal move when the current battle request is absent.
    const ranked=out.sort((a,b)=>b.score-a.score);
    // Keep strategic diversity even when many attacks target different slots.
    const chosen=ranked.slice(0,6);
    for(const kind of ['protect','speed-control','support','switch']) {
      const option=ranked.find(a=>a.kind===kind);
      if(option&&!chosen.includes(option)&&chosen.length<10)chosen.push(option);
    }
    return chosen.sort((a,b)=>b.score-a.score);
  }
  function jointBonus(actions,state) {
    if(actions.length<2)return {points:0,notes:[]};
    const notes=[];
    let points=0;
    for(let i=0;i<actions.length;i++)for(let j=i+1;j<actions.length;j++) {
      const a=actions[i],b=actions[j];
      if(a.kind==='switch'&&b.kind==='switch'&&a.benchSlot===b.benchSlot)return {points:-10000,notes:['Both slots cannot switch into the same Pokémon']};
      if(a.kind==='attack'&&b.kind==='attack'&&a.target&&a.target===b.target){points+=6;notes.push('Two attacks pressure the same opponent, though damage is not calculated');}
      if(a.kind==='protect'&&b.kind==='attack'){points+=3;notes.push('One ally can defend while the other acts');}
      if(a.kind==='attack'&&b.kind==='protect'){points+=3;notes.push('One ally can defend while the other acts');}
      const punish=(attack,ally)=>{
        if(attack.kind!=='attack'||!attack.targeting.hitsAlly)return;
        if(ally.kind==='protect'){points+=2;return;}
        const mon=(state.myActive||[])[ally.actorIndex];
        const mult=effectiveness(attack.moveType,mon);
        // Ground immunity via Levitate is only assumed when explicitly known; other immunities can be conditional.
        const party=(state.myParty||[]).find(p=>sameMon(p,mon));
        const levitate=key(party?.ability)==='levitate'&&key(attack.moveType)==='ground';
        if(mult===0||levitate){notes.push('Partner appears immune to allied spread damage under normal conditions');return;}
        points-=mult===null?18:mult>=2?37:mult===1?25:15;
        notes.push('Allied area move may severely damage your other Pokémon');
      };
      punish(a,b);punish(b,a);
      if(a.kind==='support'&&key(a.move)==='helpinghand'&&b.kind==='attack')points+=8;
      if(b.kind==='support'&&key(b.move)==='helpinghand'&&a.kind==='attack')points+=8;
    }
    return {points,notes};
  }
  function counterplayPenalty(actions,scenario) {
    let penalty=0;
    for(const a of actions) {
      if(scenario.id==='attack' && a.kind==='setup')penalty+=6;
      if(scenario.id==='attack' && a.kind==='switch')penalty+=4;
      if(scenario.id==='protect' && a.kind==='attack' && a.target && !a.targeting.spread)penalty+=11;
      if(scenario.id==='switch' && a.kind==='attack' && a.target)penalty+=5;
      if(scenario.id==='speed' && a.kind==='setup')penalty+=5;
      if(scenario.id==='attack' && a.kind==='protect')penalty=Math.max(0,penalty-3);
    }
    return penalty;
  }
  function describe(actions) {
    return actions.map(a=>a.kind==='switch'?`${a.actor}: switch to ${a.target}`:
      `${a.actor}: ${a.move}${a.target?' into '+a.target:''}`).join(' + ');
  }
  function audit(choice,alternative,scenarios,state) {
    const why=[];
    for(const a of choice.actions) {
      if(a.typing!=null&&a.typing>=2)why.push(`${a.move} has a strong known typing matchup into ${a.target}`);
      if(a.kind==='protect')why.push('Protect may keep one of your active Pokémon on the board');
      if(a.kind==='speed-control')why.push('Speed control addresses the turn-order matchup');
      if(a.kind==='switch')why.push(`The switch to ${a.target} may improve defensive positioning`);
      if(a.order==='before')why.push(`${a.actor} has a favorable estimated same-priority Speed matchup against ${a.target}`);
      if(a.order==='after')why.push(`${a.actor} may move after ${a.target}`);
      for(const d of (a.damageTargets||[]).slice(0,2))why.push(`${a.move} vs ${d.target}: ${d.minPercent}–${d.maxPercent}% modeled damage (hidden sets may change this)`);
    }
    why.push(...choice.notes);
    const concerns=[];
    if(scenarios.some(s=>s.id==='protect'))concerns.push('An opponent has revealed a protection move; attacking that slot could fail');
    if(scenarios.some(s=>s.id==='switch'))concerns.push('The opponent may switch rather than stay in');
    if((state.speedAnalysis?.matchups||[]).some(m=>['uncertain','unknown'].includes(m.order)))concerns.push('Unknown opponent Speed builds may change move order');
    if(!state.opponentActive?.length)concerns.push('Current opponents are not reliably detected');
    if(choice.actions.some(a=>a.typing===null&&a.kind==='attack'))concerns.push('At least one target type matchup is not confirmed');
    const confirmed=choice.actions.every(a=>a.verified);
    const seenAttack=(state.opponentMovesSeen||[]).some(x=>(x.moves||[]).length);
    const hasTypes=(state.opponentActive||[]).every(x=>knownTypes(x).length);
    if(!seenAttack) concerns.push('Opponent attacks remain unrevealed; counterplay estimates are incomplete');
    const confidence=!confirmed||!hasTypes||!state.opponentActive?.length||!seenAttack?'low':concerns.length>1?'medium':'moderate';
    return {reasons:[...new Set(why)].slice(0,3),cautions:[...new Set(concerns)].slice(0,3),confidence,
      alternative:alternative?describe(alternative.actions):'',
      alternativeReason:alternative?(()=>{
        const top=choice.actions,alt=alternative.actions;
        if(top.some(x=>x.kind==='protect')&&!alt.some(x=>x.kind==='protect'))return 'Prioritizes keeping an ally safe over immediate offense.';
        if(top.some(x=>x.kind==='speed-control')&&!alt.some(x=>x.kind==='speed-control'))return 'Prioritizes future turn order instead of immediate pressure.';
        if(top.some(x=>x.kind==='switch')&&!alt.some(x=>x.kind==='switch'))return 'Trades current offensive pressure for defensive positioning.';
        if(top.some(x=>x.typing>=2)&&!alt.some(x=>x.typing>=2))return 'Uses more favorable observed type coverage.';
        return 'Balances immediate pressure with protection, speed, and plausible counterplays.';
      })():'',
      principle:'Heuristic comparison of confirmed available actions; NOT exact damage, KO odds, opponent choice probabilities, or a guaranteed optimal play.'};
  }
  function justificationFor(top,other,opponentScenarios,state) {
    if(Justification?.build)return Justification.build({choice:top,alternative:other,scenarios:opponentScenarios,state});
    // No unverified fallback claims if the intended layer fails to load.
    return {valid:false,reason:'Justification module is unavailable.'};
  }
  function analyze(state,question) {
    if(!isTacticalQuestion(question)||!state?.battleFound||!Array.isArray(state.myActive)||!state.myActive.length)return null;
    if(['wait','team'].includes(state.playerRequestType))return {status:'not-actionable',reason:'No live move/switch choice is currently available for this player.'};
    stateMoveMetaCache.clear();
    for(const record of state.opponentMoveDetails||[])stateMoveMetaCache.set(key(record.name),record);
    const foes=(state.opponentActive||[]).slice(0,3);
    if(!foes.length)return {status:'insufficient',reason:'The opposing active Pokémon are not detected; cannot justify a best move.'};
    const bench=(state.myParty||[]).filter(p=>!p.active&&!p.fainted);
    const damageCtx=root.ZyncezDamage?.createContext?.(state,48)||null;
    const layers=(state.myActive||[]).slice(0,3).map((mon,i)=>makeCandidates(mon,i,state,foes,bench,damageCtx));
    if(layers.some(x=>!x.length))return {status:'insufficient',reason:'Current legal moves or switches are unavailable for one active slot. Do not invent a move.',
      observed:{myActive:state.myActive.map(monLabel),foes:foes.map(monLabel)}};
    let joint=[{actions:[],score:0,notes:[]}];
    for(const candidates of layers) {
      const next=[];
      for(const prior of joint)for(const option of candidates){
        if(prior.actions.some(a=>a.benchSlot!=null&&a.benchSlot===option.benchSlot))continue;
        const actions=[...prior.actions,option];
        const together=jointBonus(actions,state);
        if(together.points<=-1000)continue;
        next.push({actions,score:actions.reduce((sum,a)=>sum+a.score,0)+together.points,notes:together.notes});
      }
      joint=next.sort((a,b)=>b.score-a.score).slice(0,48); // bounded search independent of the total legal-action product
    }
    if(!joint.length)return {status:'insufficient',reason:'No compatible team actions could be enumerated.'};
    const alternatives=scenarios(state);
    for(const x of joint){
      const penalties=alternatives.map(s=>counterplayPenalty(x.actions,s));
      x.conservativeScore=x.score-(penalties.length?Math.max(...penalties)*0.7:0);
      x.variation=penalties.length?Math.max(...penalties)-Math.min(...penalties):0;
    }
    joint.sort((a,b)=>b.conservativeScore-a.conservativeScore || a.variation-b.variation);
    const top=joint[0],other=joint.find(x=>describe(x.actions)!==describe(top.actions));
    const reasons=audit(top,other,alternatives,state);
    const justification=justificationFor(top,other,alternatives,state);
    if(!justification.valid)return {status:'insufficient',reason:justification.reason};
    return {status:'evaluated',recommendedPlay:describe(top.actions),
      actions:top.actions.map(a=>({pokemon:a.actor,kind:a.kind,move:a.move,target:a.target||null,
        damage:a.damage||null,damageTargets:(a.damageTargets||[]).slice(0,3),incomingThreat:a.incomingThreat||''})),
      ...reasons,justification,
      opponentsConsidered:alternatives.map(s=>s.label),
      evidence:{turn:state.turn,opponentMovesSeen:(state.opponentMovesSeen||[]).map(x=>({pokemon:x.name,moves:(x.moves||[]).slice(0,4)})),
        trickRoom:state.battleConditions?.trickRoom===true,tailwind:state.battleConditions?.tailwind||null},
      calculation:damageCtx?'Smogon @smogon/calc 0.12.0 modeled damage ranges plus bounded tactical heuristics; uncertain hidden sets.':
        'Bounded tactical heuristics; damage calculation unavailable.'};
  }
  const api={analyze,isTacticalQuestion,scenarios,knownTypes,effectiveness,makeCandidates,jointBonus,describe,revealedThreat};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.ZyncezDecision=api;
})(typeof window!=='undefined'?window:globalThis);

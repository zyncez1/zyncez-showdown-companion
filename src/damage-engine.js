/* Smogon @smogon/calc 0.12.0 adapter. All computation is local, on user request.
 * Only observed battle facts are treated as known. Unknown opposing sets are
 * bounded with plausible 0/31 IV, 0/252 EV and hindering/neutral/boosting natures.
 * This is NOT a probability model or an assertion about hidden items/abilities.
 */
(function(root) {
  'use strict';
  const clean = v => String(v == null ? '' : v).toLowerCase().replace(/[^a-z0-9]/g,'');
  const name = v => String(v == null ? '' : v).trim().slice(0,80);
  const number = (v,min,max) => Number.isFinite(v)&&v>=min&&v<=max?v:null;
  const signedStage = v => Number.isInteger(v)?Math.max(-6,Math.min(6,v)):0;
  const BUDGET = 60;
  const badMoves = new Set(['fissure','sheercold','guillotine','horndrill']);
  const specialAttack = new Set(['spa']);
  const neutral = 'Serious';
  const natures = {
    atk:['Modest','Serious','Adamant'],spa:['Adamant','Serious','Modest'],
    def:['Lonely','Serious','Bold'],spd:['Naughty','Serious','Calm'],
    hp:['Serious','Serious','Serious']
  };
  function percentHP(raw) {
    const s=name(raw);
    let m=s.match(/^(\d+(?:\.\d+)?)%$/);
    if(m)return Math.max(0,Math.min(1,+m[1]/100));
    m=s.match(/^(\d+)\/(\d+)$/);
    return m && +m[2]>0?Math.max(0,Math.min(1,+m[1]/+m[2])):null;
  }
  function calcLib() { return root.calc && root.calc.Generations && root.calc.calculate ? root.calc:null; }
  function metadata(gen,moveName){
    try { return gen.moves.get(clean(moveName)) || null; } catch {return null;}
  }
  function ownParty(state,mon){
    const active=(state.myParty||[]).filter(x=>x.active);
    const primary=active.find(x=>(clean(x.name)&&clean(x.name)===clean(mon.name))||
      (clean(x.species)&&clean(x.species)===clean(mon.species)));
    return primary||active.find(x=>clean(x.species)===clean(mon.species))||null;
  }
  function modeledSpread(gen,speciesName,level,observedStat,statName) {
    if(!Number.isInteger(observedStat)||observedStat<=0)return null;
    const base=gen.species.get(clean(speciesName))?.baseStats?.[statName];
    if(!Number.isInteger(base))return null;
    let best=null;
    // Reconstruct a legal EV/IV/nature combination mathematically. No Pokemon
    // object creation is needed for each of the ~6000 candidates.
    for(const [ni,nature] of (natures[statName]||[neutral]).entries()) {
      const natureMultiplier=ni===0?0.9:ni===2?1.1:1;
      for(let iv=31;iv>=0;iv--)for(let ev=0;ev<=252;ev+=4) {
        const inner=Math.floor((2*base+iv+Math.floor(ev/4))*level/100);
        const computed=statName==='hp'?inner+level+10:Math.floor((inner+5)*natureMultiplier);
        if(computed!==observedStat)continue;
        const cost=(31-iv)*8+Math.abs(ev-252)/8+(nature===neutral?0:0.2);
        if(!best||cost<best.cost)best={nature,ivs:{[statName]:iv},evs:{[statName]:ev},cost};
      }
    }
    return best;
  }
  function stageFrom(mon,stat) {
    return signedStage(mon?.boosts?.[stat] ?? (stat==='spe'?mon?.speedStage:null));
  }
  function buildPokemon(c,gen,mon,own,state,kind,offensiveStat,defensiveStat,spreadCache) {
    const speciesName=name(mon?.species||mon?.name);
    const level=number(mon?.level,1,100)||100;
    if(!speciesName||!gen.species.get(clean(speciesName)))return null;
    let spread={};
    const party=own?ownParty(state,mon):null;
    if(own) {
      const measured=party?.stats?.[offensiveStat]||party?.stats?.[defensiveStat]||null;
      const focus=offensiveStat||defensiveStat;
      const signature=`${clean(speciesName)}:${level}:${focus}:${measured}`;
      if(!spreadCache.has(signature))spreadCache.set(signature,
        focus&&measured?modeledSpread(gen,speciesName,level,measured,focus):null);
      const known=spreadCache.get(signature);
      spread=known?{nature:known.nature,ivs:known.ivs,evs:known.evs}:{};
    } else {
      const focus=defensiveStat||offensiveStat||'def';
      const i=kind==='min'?0:31, e=kind==='min'?0:252;
      const nature=(natures[focus]||natures.def)[kind==='min'?0:2];
      spread={ivs:{[focus]:i,hp:i},evs:{[focus]:e,hp:e},nature};
    }
    const ability=name(own?(party?.ability||mon?.ability):mon?.ability)||'None';
    const item=name(own?(party?.item||mon?.item):mon?.item)||'';
    const opts={level,ability,item,status:name(mon?.status||party?.status),
      boosts:{atk:stageFrom(mon,'atk'),def:stageFrom(mon,'def'),spa:stageFrom(mon,'spa'),spd:stageFrom(mon,'spd')},...spread};
    const tera=name(mon?.terastallized);
    if(tera)opts.teraType=tera;
    const pokemon=new c.Pokemon(gen,speciesName,opts);
    return {pokemon,hasExactRelevantStat:!!(own && spread.nature),usedAssumptions:!own||!spread.nature};
  }
  function calcField(c,state,options) {
    const field=state.battleConditions||{};
    const weather=clean(field.weather);
    const knownWeather={raindance:'Rain',rain:'Rain',sunnyday:'Sun',sun:'Sun',sandstorm:'Sand',hail:'Hail',snow:'Snow',snowscape:'Snow',desolateland:'Harsh Sunshine',primordialsea:'Heavy Rain',deltastream:'Strong Winds'};
    const terrain=clean(field.terrain);
    const knownTerrain={electricterrain:'Electric',grassyterrain:'Grassy',mistyterrain:'Misty',psychicterrain:'Psychic'};
    const doubles=options.isDoubles===true||(state.myActive||[]).length>1||(state.opponentActive||[]).length>1;
    const screens=field.screens||{};
    const ownDef=options.attackerIsMine!==false?'opponent':'mine';
    const defScreen=screens[ownDef]||{};
    return new c.Field({gameType:doubles?'Doubles':'Singles',weather:knownWeather[weather],terrain:knownTerrain[terrain],
      attackerSide:new c.Side({isHelpingHand:false}),
      defenderSide:new c.Side({isReflect:!!defScreen.reflect,isLightScreen:!!defScreen.lightScreen,isAuroraVeil:!!defScreen.auroraVeil})});
  }
  function damageEstimate(state,attacker,defender,move,options={},context={}) {
    const fail=reason=>({available:false,reason});
    const c=calcLib(); if(!c)return fail('Smogon calculator bundle is unavailable');
    const genNum=number(state?.battleConditions?.generation,1,9);
    if(!Number.isInteger(genNum))return fail('Battle generation is unknown');
    if(!attacker||!defender||!move?.name)return fail('Missing attacker, defender, or move');
    const generation=c.Generations.get(genNum);
    const moveData=metadata(generation,move.name);
    if(!moveData||!moveData.basePower || badMoves.has(clean(move.name)))return fail('This move cannot be safely scored as ordinary damage');
    if(!generation.species.get(clean(attacker.species||attacker.name))||!generation.species.get(clean(defender.species||defender.name)))return fail('Species is not in this calculator generation');
    if(moveData.category==='Status')return fail('Support move; no direct damage');
    // The calculator knows many special mechanics, but not every dynamic interaction.
    if(['Future Sight','Doom Desire'].includes(moveData.name))return fail('Delayed damage is not a direct attack this turn');
    const stats= context.statCache||new Map();
    const ownAttack=options.attackerIsMine!==false;
    const atkStat=moveData.category==='Physical'?'atk':'spa';
    const defStat=moveData.category==='Physical'?'def':'spd';
    const attackerMin=buildPokemon(c,generation,attacker,ownAttack,state,'min',atkStat,null,stats);
    const attackerMax=ownAttack?attackerMin:buildPokemon(c,generation,attacker,false,state,'max',atkStat,null,stats);
    const defenderMin=buildPokemon(c,generation,defender,!ownAttack,state,'min',null,defStat,stats);
    const defenderMax=!ownAttack?defenderMin:buildPokemon(c,generation,defender,true,state,'max',null,defStat,stats);
    if(!attackerMin||!attackerMax||!defenderMin||!defenderMax)return fail('Unable to build Pokémon from known battle data');
    const field=calcField(c,state,options);
    try {
      const usedMove=new c.Move(generation,moveData.name);
      const lower=c.calculate(generation,attackerMin.pokemon,defenderMax.pokemon,usedMove,field);
      const upper=c.calculate(generation,attackerMax.pokemon,defenderMin.pokemon,usedMove,field);
      const lowRoll=lower.range()[0], highRoll=upper.range()[1];
      const minHp=defenderMin.pokemon.maxHP(),maxHp=defenderMax.pokemon.maxHP();
      const lo=Math.max(0,lowRoll/maxHp*100),hi=Math.max(0,highRoll/minHp*100);
      const remain=percentHP(defender.hp);
      // These outcomes are ONLY conditional on captured field conditions and assumed sets.
      const koUnderAssumptions=remain===null?'unknown':lo>=remain*100?'all-modeled':hi>=remain*100?'possible':'none';
      const assumptions=[];
      if(!ownAttack)assumptions.push('Opponent attacking stats and nature are estimated');
      if(ownAttack&&!attackerMin.hasExactRelevantStat)assumptions.push('Your offensive IV/EV/nature spread was not confirmed');
      if(ownAttack)assumptions.push('Enemy HP/defensive EVs, IVs and nature are modeled as a range');
      if(!ownAttack&&!defenderMin.hasExactRelevantStat)assumptions.push('Your defensive spread could not be reconstructed precisely');
      if(!(ownAttack?defender.ability:(ownParty(state,defender)?.ability||defender.ability)))
        assumptions.push('Defender ability unknown');
      if(!(ownAttack?defender.item:(ownParty(state,defender)?.item||defender.item)))
        assumptions.push('Defender item unknown');
      if(!(ownAttack?(ownParty(state,attacker)?.ability||attacker.ability):attacker.ability))
        assumptions.push('Attacker ability unknown');
      if(!(ownAttack?(ownParty(state,attacker)?.item||attacker.item):attacker.item))
        assumptions.push('Attacker item unknown');
      if(state.battleConditions?.screens===undefined)assumptions.push('Screens not captured; assumed absent');
      return {available:true,engine:'@smogon/calc',version:'0.12.0',move:moveData.name,
        minPercent:Math.round(lo*10)/10,maxPercent:Math.round(hi*10)/10,
        lowDamage:lowRoll,highDamage:highRoll,koUnderAssumptions,
        knownTargetHP:remain!==null?Math.round(remain*100):null,
        approximate:assumptions.length>0,assumptions:assumptions.slice(0,7),
        // Do not phrase an all-modeled result as a guaranteed KO vs hidden sets.
        note:'Modeled damage only. Unknown sets, moves, abilities and items may change it.'};
    } catch(error) {
      return fail('Calculator cannot safely evaluate these conditions: '+name(error?.message).slice(0,120));
    }
  }
  function createContext(state,limit=BUDGET) {
    const cache=new Map(), statCache=new Map();let computed=0,hits=0;
    function read(attacker,defender,move,opts={}) {
      const sig=JSON.stringify([state?.turn,attacker?.species,attacker?.name,defender?.species,defender?.name,
        attacker?.status,defender?.status,attacker?.boosts,defender?.boosts,move?.name,opts,
        state?.battleConditions,defender?.hp]);
      if(cache.has(sig)){hits++;return cache.get(sig);}
      if(computed>=limit)return {available:false,reason:'Per-request damage calculation budget reached'};
      computed++;
      const result=damageEstimate(state,attacker,defender,move,opts,{statCache});
      cache.set(sig,result);
      return result;
    }
    return {read,stats:()=>({computed,hits,limit,cached:cache.size})};
  }
  const api={damageEstimate,createContext,percentHP,calcLib};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.ZyncezDamage=api;
})(typeof window!=='undefined'?window:globalThis);

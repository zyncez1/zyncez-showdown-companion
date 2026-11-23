/* Read-only battle speed analysis.  Never claims unknown opponent sets are exact. */
(function (root) {
  'use strict';
  const clean = (s,n=65) => String(s == null ? '' : s).replace(/\s+/g,' ').trim().slice(0,n);
  const id = v => clean(v).toLowerCase().replace(/[^a-z0-9]/g,'');
  const n = v => Number.isFinite(v) ? v : null;
  const clampStage = v => Number.isInteger(v) ? Math.max(-6,Math.min(6,v)) : 0;
  const stageMultiplier = stage => stage >= 0 ? (2+stage)/2 : 2/(2-stage);
  // Standard main-series non-HP stat formula for generations >= 3.
  function statAtLevel(base,level,iv,ev,nature) {
    if(!Number.isInteger(base)||base<1||base>255||!Number.isInteger(level)||level<1||level>100)return null;
    const raw=Math.floor(((2*base+iv+Math.floor(ev/4))*level)/100)+5;
    return Math.floor(raw*nature);
  }
  function opponentRange(base,level) {
    const min=statAtLevel(base,level,0,0,0.9);
    const max=statAtLevel(base,level,31,252,1.1);
    return min===null||max===null?null:{min,max};
  }
  function stageStat(value,stage) {
    return Number.isInteger(value)&&value>0 ? Math.floor(value*stageMultiplier(clampStage(stage))) : null;
  }
  function multiplierDetails(p,field,side) {
    let mult=1;
    const reasons=[];
    const status=id(p.status),ability=id(p.ability),item=id(p.item),weather=id(field.weather),terrain=id(field.terrain);
    if(side?.tailwind){mult*=2;reasons.push('Tailwind ×2');}
    const swift=(ability==='swiftswim'&&['raindance','rain','primordialsea'].includes(weather));
    const chloro=(ability==='chlorophyll'&&['sunnyday','sun','desolateland'].includes(weather));
    const sand=(ability==='sandrush'&&['sandstorm','sand'].includes(weather));
    const snow=(ability==='slushrush'&&['snowscape','hail','snow'].includes(weather));
    const electric=(ability==='surgesurfer'&&terrain==='electricterrain');
    if(swift||chloro||sand||snow||electric){mult*=2;reasons.push(`${clean(p.ability)} ×2`);}
    if(ability==='quickfeet'&&['par','brn','psn','tox','slp','frz'].includes(status)){
      mult*=1.5;reasons.push('Quick Feet ×1.5');
    } else if(status==='par'){
      const factor=(field.gen||9)>=7?0.5:0.25;
      mult*=factor;reasons.push(`Paralysis ×${factor}`);
    }
    if(item==='choicescarf'){mult*=1.5;reasons.push('Choice Scarf ×1.5');}
    if(item==='ironball'){mult*=0.5;reasons.push('Iron Ball ×0.5');}
    if(item==='machobrace'||['poweranklet','powerband','powerbelt','powerbracer','powerlens','powerweight'].includes(item)){
      mult*=0.5;reasons.push('Speed-reducing item ×0.5');
    }
    // Quick Feet/Booster/Unburden and other conditional effects are not guessed when activation is unknown.
    return {mult,reasons};
  }
  function modifySpeed(base,mon,field,side){
    const stage=clampStage(mon.speedStage);
    const boosted=stageStat(base,stage);
    if(boosted===null)return null;
    const factors=multiplierDetails(mon,field,side);
    return {speed:Math.max(1,Math.floor(boosted*factors.mult+0.5)),stage,modifiers:factors.reasons};
  }
  function speedEntry(p,field,side,isOwn) {
    const raw=n(p?.speed);
    const base=n(p?.baseSpeed);
    const level=n(p?.level);
    const mon={name:clean(p?.name),species:clean(p?.species),level,status:clean(p?.status,15),
      ability:clean(p?.ability),item:clean(p?.item),speedStage:clampStage(p?.speedStage)};
    const exact=isOwn&&Number.isInteger(raw)&&raw>0 ? modifySpeed(raw,mon,field,side):null;
    const baseRange=opponentRange(base,level);
    const modifiedRange=!isOwn&&baseRange?{
      min:modifySpeed(baseRange.min,mon,field,side)?.speed,
      max:modifySpeed(baseRange.max,mon,field,side)?.speed
    }:null;
    const modifiers=multiplierDetails(mon,field,side).reasons;
    return {name:mon.name,species:mon.species,level:mon.level,baseSpeed:base,
      rawSpeed:exact?raw:null,estimatedSpeed:exact?.speed??null,
      range:modifiedRange,stage:mon.speedStage,modifiers,
      note:exact?'Calculated from your own visible Speed stat; some unobserved dynamic effects may apply.':
        modifiedRange?'Stat range assumes legal IVs/EVs/natures, plus the captured known effects. Unknown item/ability effects can change it.':'Speed unavailable: missing confirmed species base Speed or level.'};
  }
  function compare(own,foe,trickRoom){
    const speed=own?.estimatedSpeed,range=foe?.range;
    if(!Number.isFinite(speed)||!range||!Number.isFinite(range.min)||!Number.isFinite(range.max))return 'unknown';
    if(trickRoom){
      if(speed<range.min)return 'before';
      if(speed>range.max)return 'after';
    } else {
      if(speed>range.max)return 'before';
      if(speed<range.min)return 'after';
    }
    return 'uncertain';
  }
  function analyze(state){
    const conditions=state?.battleConditions||{};
    const field={gen:Number.isInteger(conditions.generation)?conditions.generation:9,weather:clean(conditions.weather),terrain:clean(conditions.terrain),trickRoom:!!conditions.trickRoom};
    const sides={mine:{tailwind:!!conditions?.tailwind?.mine},opponent:{tailwind:!!conditions?.tailwind?.opponent}};
    const myActive=(state?.myActive||[]).slice(0,3).map(active=>{
      const party=(state.myParty||[]).find(p=>(p.name&&p.name.toLowerCase()===active.name?.toLowerCase())||(p.species&&p.species.toLowerCase()===active.species?.toLowerCase()));
      return speedEntry({...active,...party,speedStage:active.speedStage??party?.speedStage},field,sides.mine,true);
    });
    const opponentActive=(state?.opponentActive||[]).slice(0,3).map(p=>speedEntry(p,field,sides.opponent,false));
    const matchups=myActive.flatMap(own=>opponentActive.map(foe=>({mine:own.species||own.name,opponent:foe.species||foe.name,
      order:compare(own,foe,field.trickRoom)})));
    return {field:{...field,tailwind:sides},myActive,opponentActive,matchups,
      limits:['Speed order assumes both attacks have equal priority. Switches, priority moves, Quick Claw and other turn-order effects can override it.',
        'Opponent Speed is not known exactly; unknown EVs/IVs/nature, Choice Scarf, and ability triggers can change the order.',
        'Speed calculations are for standard generation 3+ rules; generation-specific and uncommon effects may not be fully modeled.']};
  }
  const api={statAtLevel,opponentRange,stageMultiplier,stageStat,multiplierDetails,modifySpeed,compare,analyze};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.ZyncezSpeed=api;
})(typeof window!=='undefined'?window:globalThis);

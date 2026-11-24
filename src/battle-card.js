/* Safe battle cards: only explicit assistant recommendations, checked against the captured turn.
   Sprite URLs are derived from observed species, never from model-provided URLs or HTML. */
(function(root){
'use strict';
const key=v=>String(v??'').toLowerCase().replace(/[^a-z0-9]/g,'');
const styles=['fancy','compact','plain'];
const normalizeStyle=v=>styles.includes(v)?v:'fancy';
const typeColors=Object.freeze({normal:['#9b9b82','⚪'],fire:['#ef8051','🔥'],water:['#6aa9ff','💧'],electric:['#f5ca46','⚡'],grass:['#78c66b','🌿'],ice:['#82d7e2','❄️'],fighting:['#e17a65','🥊'],poison:['#c78be2','☠️'],ground:['#d8ac72','⛰️'],flying:['#a6b8f9','🪽'],psychic:['#f494b1','🔮'],bug:['#a9bf52','🐛'],rock:['#c3ad70','🪨'],ghost:['#a79bda','👻'],dragon:['#a99aff','🐉'],dark:['#a6a0af','🌙'],steel:['#b4bed2','⚙️'],fairy:['#eaa5d4','✨']});
const label=p=>String(p?.species||p?.name||'');
const matches=(p,n)=>!!key(n)&&[p?.name,p?.species].some(v=>key(v)===key(n));
const find=(list,n)=>{const found=(list||[]).filter(p=>matches(p,n));return found.length===1?found[0]:null;};
const text=v=>typeof v==='string'?v.trim().slice(0,80):'';
function spriteUrl(species){
 const slug=String(species||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/♀/g,'f').replace(/♂/g,'m').replace(/[^a-z0-9-]/g,'');
 if(!/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug))return '';
 return 'https://play.pokemonshowdown.com/sprites/gen5/'+slug+'.png';
}
function parseLine(line){
 if(!/^\s*::play\s+/i.test(line))return null;
 try{const a=JSON.parse(line.replace(/^\s*::play\s+/i,''));if(!a||typeof a!=='object'||Array.isArray(a))return {invalid:true};
 const actor=text(a.actor),move=text(a.move),target=text(a.target);
 return actor&&move?{actor,move,target}: {invalid:true};}catch{return {invalid:true};}
}
function sentence(a){if(a.invalid)return '';return key(a.move)==='switch'?`${a.actor}: switch to ${a.target}.`:`${a.actor}: use ${a.move}${a.target&&key(a.target)!=='self'?' → '+a.target:''}.`;}
function validate(a,state){
 if(!a||a.invalid||!state?.battleFound||state.decisionSupport?.status!=='evaluated'||['wait','team'].includes(state.playerRequestType))return null;
 const own=state.myActive||[],foes=state.opponentActive||[],party=state.myParty||[];
 const actor=find(own,a.actor);if(!actor||actor.fainted)return null;
 const index=own.indexOf(actor), p=find(party.filter(x=>x.active),actor.name||label(actor))||find(party.filter(x=>x.active),label(actor));
 if(!p)return null;
 if(key(a.move)==='switch'){
  const reserve=find(party.filter(x=>!x.active&&!x.fainted),a.target);
  if(!reserve||state.playerTrapped?.[index])return null;
  return {actor:label(actor),move:'Switch',target:label(reserve),targets:[label(reserve)],kind:'switch',icon:'🔄',type:''};
 }
 if(state.playerRequestType==='switch')return null;
 const m=(p.currentMoves||[]).find(x=>key(x.name)===key(a.move)&&!x.disabled&&x.pp!==0);if(!m)return null;
 const t=key(m.target),requested=key(a.target), type=key(m.type);
 let targets=[],target='';
 if(['alladjacentfoes','alladjacent','all','allfoes','foeside'].includes(t)){
  targets=t==='foeside'?[]:foes.map(label);target=t==='foeside'?'Opponent’s side':t==='all'?'All Pokémon':t==='alladjacent'?'All adjacent Pokémon':foes.length>1?'Both opponents':label(foes[0])||'Opposing side';
 }else if(t==='self'){target='Self';}
 else if(['allyside','allyteam','allies','field','scripted'].includes(t)){target=t==='field'||t==='scripted'?'Field':'Your side';}
 else if(t==='randomnormal'){target='Random opponent';}
 else if(['adjacentally','adjacentallyorself','normal','adjacentfoe','any'].includes(t)){
  const choices=t==='adjacentally'?own.filter(x=>x!==actor):t==='adjacentallyorself'?own:t==='adjacentfoe'?foes:[...foes,...own.filter(x=>x!==actor)];
  const chosen=requested==='self'&&t==='adjacentallyorself'?actor:find(choices,a.target)||(!requested&&choices.length===1?choices[0]:null);
  if(!chosen)return null;target=chosen===actor?'Self':label(chosen);if(chosen!==actor)targets=[label(chosen)];
 }else return null; // no visual endorsement for unrecognized targeting rules
 const allyRisk=['alladjacent','all'].includes(t)&&own.length>1&&key(m.category)!=='status';
 return {actor:label(actor),move:m.name,target,targets,kind:'move',icon:typeColors[type]?.[1]||'🎯',type:typeColors[type]?type:'',allyRisk};
}
function el(doc,tag,cls,txt){const n=doc.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n;}
function mon(doc,species){const node=el(doc,'span','play-mon');const slot=el(doc,'span','play-sprite');slot.setAttribute('aria-hidden','true');const fallback=el(doc,'span','play-fallback','◉');slot.appendChild(fallback);const src=spriteUrl(species);
 if(src){const img=el(doc,'img','play-image');img.alt='';img.width=40;img.height=40;img.referrerPolicy='no-referrer';img.addEventListener('error',()=>img.remove(),{once:true});img.addEventListener('load',()=>fallback.remove(),{once:true});img.src=src;slot.appendChild(img);}
 node.appendChild(slot);node.appendChild(el(doc,'strong','play-name',species));return node;}
function renderCard(a,style,doc){const card=el(doc,'div','play-card '+(style==='compact'?'play-compact':''));card.setAttribute('role','group');card.setAttribute('aria-label','Suggested battle action');
 if(style!=='compact')card.appendChild(el(doc,'span','play-label','⚡ Suggested play'));
 const row=el(doc,'div','play-row');row.appendChild(mon(doc,a.actor));row.appendChild(el(doc,'span','play-verb',a.kind==='switch'?'↪':'→'));
 const pill=el(doc,'span','play-move',`${a.icon} ${a.move}`);if(a.type)pill.style.setProperty('--move-color',typeColors[a.type][0]);row.appendChild(pill);card.appendChild(row);
 if(a.target&&a.target!=='Self'){
  const target=el(doc,'div','play-target');target.appendChild(el(doc,'span','play-target-label',a.kind==='switch'?'Into':'🎯 Target'));
  if(a.targets.length>1){const group=el(doc,'span','play-target-group');group.appendChild(el(doc,'span','play-target-label',a.target));for(const species of a.targets)group.appendChild(mon(doc,species));target.appendChild(group);}
  else if(a.targets.length===1)target.appendChild(mon(doc,a.targets[0]));else target.appendChild(el(doc,'strong','play-name',a.target));card.appendChild(target);
 }
 if(a.allyRisk)card.appendChild(el(doc,'span','play-caution','⚠ May also hit your partner'));
 return card;}
function mapLines(answer,fn){const lines=String(answer??'').replace(/\r\n?/g,'\n').split('\n');let fence=false;return lines.map(line=>{if(/^\s*```/.test(line)){fence=!fence;return line;}const parsed=!fence&&parseLine(line);return parsed?fn(parsed):line;});}
function plainText(answer){return mapLines(answer,a=>sentence(a)).join('\n').trim();}
function render(answer,state,style,markdown,doc=document){
 const result=doc.createDocumentFragment(), mode=normalizeStyle(style);let buffer=[],cards=0;
 const flush=()=>{if(buffer.length){result.appendChild(markdown(buffer.join('\n'),doc));buffer=[];}};
 for(const line of mapLines(answer,a=>a)){
  if(typeof line==='string'){buffer.push(line);continue;}
  const validated=validate(line,state);
  if(mode==='plain'||!validated||cards>=3){const fallback=sentence(line);if(fallback)buffer.push(!validated&&mode!=='plain'?'Unverified suggestion: '+fallback:fallback);continue;}
  flush();result.appendChild(renderCard(validated,mode,doc));cards++;
 }
 flush();if(!result.childNodes.length)result.appendChild(doc.createTextNode('I couldn’t format that recommendation. Please ask again.'));
 return result;
}
const api={normalizeStyle,spriteUrl,parseLine,validate,plainText,render,renderCard};if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.ZyncezCards=api;
})(typeof window!=='undefined'?window:globalThis);

import * as T from 'three';
import {bossAttack} from './combat.js';
import {inLane,inSector} from './stag.js';
import {harborSplash,hookChain,harborWave,harborFlood,lureGlow,harborTelegraph,harborBite,harborMaelstrom,harborAscend} from './harbor-vfx.js';
const V=(x=0,z=0)=>new T.Vector3(x,0,z),targets=e=>[e.game.player,...e.game.allies??[]].filter(a=>a.alive);
function hit(e,a,damage,kind='heavy',tide=false){
 const g=e.game;if(g.cinematic||!a.alive||a.invuln>0||a.buffs?.divineWings)return;
 const power=e.type==='angler'?[1.22,1.30,1.38][(e.harbor?.cast?.phase??e.harbor?.phase??1)-1]:1;
 const scale=power*(tide?(g.story.fifth?.ward?.8:1)*(a.has?.('tideboots')?.75:1):1),before=a.hp;
 a.hurt(damage*scale*(a===g.player?1:.6),e.pos,{...bossAttack(e,kind),scale});
 if(tide&&a===g.player&&a.hp<before){a.drenched=Math.min(3,(a.drenchedUntil>g.time?a.drenched??0:0)+1);a.drenchedUntil=g.time+5;}
}
export function harborPoise(e,value){
 const s=e.harbor,c=s?.cast;if(!c||c.t>=c.windup||!(c.kind==='lure'||e.type==='hookcaptain'&&c.kind==='hook'))return;
 s.poise=(s.poise??0)+value;if(s.poise<1)return;
 for(const w of c.warnings)w.stop();s.cast=null;s.rest=3.8;s.exposed=3.8;s.poise=0;e.intent='灯囊破裂 · 反击伤害 +25%';e.play('Hit_A',{once:true,restart:true});harborSplash(e.game,e.pos,3);e.game.audio.play('h_lure',e.pos,.6);
 if(e.game.player.has?.('tideeye')&&(e.game.player._tideEyeAt??0)<=e.game.time){e.game.player._tideEyeAt=e.game.time+8;e.game.player.gainRes(20);}
 e.game.ui.toast(e.type==='angler'?'引潮灯囊已破 · 趁收招反击':'钩链失衡 · 趁机反击');
}
export function harborDamage(e,amount,opts,g){
 if(e.T.episode!==5)return amount;
 let m=1;const pal=opts.pal??'steel';
 if(e.type==='drowned'){if(pal==='holy')m*=1.2;if(pal==='dark')m*=.85;}
 if(e.type==='barnacle'){if(pal==='fire')m*=1.2;if(!e.stagger&&!e.frozen&&opts.from&&['steel','arrow','bone'].includes(pal)&&inSector(e.pos,V(Math.sin(e.facing),Math.cos(e.facing)),opts.from,1000,Math.PI*.9))m*=.72;}
 if(e.type==='angler'){
  if(pal==='bolt')m*=1.15;if(pal==='fire')m*=.9;
  const c=e.harbor?.cast;if(c?.kind==='lure'&&c.t<c.windup&&!opts.quiet&&!opts.ally)harborPoise(e,amount/(e.maxHp*.016));
  m*=e.harbor?.exposed>0?1.25:.85;
 }
 if(e.harbor?.exposed>0&&e.type!=='angler')m*=1.25;
 if(g.player.has?.('hookgrasp')&&e.harbor?.exposed>0)m*=1.15;
 return Math.max(1,Math.round(amount*m));
}
function start(e,kind){
 const g=e.game,s=e.harbor,origin=e.pos.clone(),dir=g.player.pos.clone().sub(origin).setY(0).normalize();if(!dir.lengthSq())dir.set(0,0,1);
 const c={kind,origin,dir,at:g.player.pos.clone(),t:0,phase:s.phase,waves:s.phase===3?2:1,windup:{bite:e.type==='angler'?1.15:1.05,hook:1.2,wave:1.5,deluge:1.8,lure:2,maelstrom:2.4}[kind],active:{bite:.3,hook:.35,wave:s.phase===3?3.1:2.2,deluge:4.5,lure:.3,maelstrom:3.2}[kind],recover:kind==='deluge'?1.5:1.3,warnings:[],hit:new Set(),tick:0};
 c.length=22;c.width=3.2;c.radius=27;c.gap=.95;c.gapAngle=Math.atan2(dir.x,dir.z)+Math.PI/3;
 if(kind==='maelstrom'){
  c.radius=7.5;c.at=g.player.pos.clone();c.warnings.push(harborTelegraph(g,{kind:'disc',origin:c.at,radius:c.radius,duration:c.windup}));harborMaelstrom(g,c);g.audio.play('h_doom',c.at,.85);
 }else if(kind==='deluge'){
  const side=V(dir.z,-dir.x);c.width=5.2;c.lanes=[-10,0,10].map(n=>({origin:origin.clone().addScaledVector(side,n),dir:dir.clone(),length:32}));
  for(const l of c.lanes)c.warnings.push(harborTelegraph(g,{kind:'charge',...l,width:c.width,duration:c.windup}));
 }else if(kind==='wave'){
  c.warnings.push(harborTelegraph(g,{kind:'disc',origin,radius:4,duration:c.windup}));
  const safe=origin.clone().add(V(Math.sin(c.gapAngle)*10,Math.cos(c.gapAngle)*10));g.fx.glyph(safe,{tex:'magic2',color:[.3,1.2,1.25],r:2.2,dur:c.windup+c.active,spin:0});
 }else c.warnings.push(harborTelegraph(g,{kind:kind==='hook'?'charge':kind==='lure'?'disc':'cleave',origin:kind==='lure'?c.at:origin,dir,radius:kind==='lure'?5.2:8.5,angle:Math.PI*.85,width:c.width,length:c.length,duration:c.windup}));
 s.cast=c;s.poise=0;e.facing=Math.atan2(dir.x,dir.z);e.playTimed?.(kind==='bite'?'attack':'Spellcast_Raise',c.windup,{restart:true});
 if(kind==='hook'){hookChain(g,c);g.audio.play('h_chain',origin,.7);}if(kind==='wave')harborAscend(g,e,c.windup);if(kind==='lure'){lureGlow(g,e,c);g.audio.play('h_lure',origin,.7);}
 e.intent={bite:'裂颚断潮 · 绕至侧后',hook:'冥锚链刃 · 横移离开锁线',wave:'葬海双潮 · 青色缺口 / 位移穿浪',deluge:'深渊裂流 · 离开三条浪带',lure:'噬魂引灯 · 控制或集中攻击破灯',maelstrom:'葬海钟域 · 离开紫色漩涡'}[kind];
}
function chief(e,dt){
 const g=e.game;if(e.asleep||g.cinematic||!g.player.alive)return true;
 const s=e.harbor??={phase:1,index:0,rest:1.2,exposed:0,poise:0};s.exposed=Math.max(0,s.exposed-dt);
 const phase=e.type==='angler'?(e.hp/e.maxHp>.7?1:e.hp/e.maxHp>.35?2:3):1;
 if(phase>s.phase){s.phase=phase;g.ui.toast(phase===2?'奥尔古潜潮 · 裂流与葬海钟域':'潮汐之钟急鸣 · 连续潮浪');g.audio.play('h_roar',e.pos,.85);harborAscend(g,e,1.4);const alive=g.enemies.filter(o=>o.alive&&o.tag==='summon'&&o.type==='drowned').length;for(let i=alive;i<2;i++){const p=g.level.nearestFree(e.home.x+(i?8:-8),e.home.z+8,.8);if(p)g.spawnEnemy('drowned',p.x,p.z,{tag:'summon',level:e.level});}}e.phase=s.phase;
 const c=s.cast;
 if(c){
  c.t+=dt;if(c.t<c.windup)return true;const t=c.t-c.windup;
  if(!c.fired){c.fired=true;for(const w of c.warnings)w.stop();g.gfx.addShake(c.kind==='maelstrom'?.55:.28);g.audio.play('h_surge',c.origin,.7);
   if(c.kind==='wave'){g.audio.play('h_impact',c.origin,.55);harborWave(g,c,2.2);if(c.waves===2)harborWave(g,c,2.2,.9);c.previous=[0,0];c.waveHits=[new Set(),new Set()];}
   if(c.kind==='deluge')harborFlood(g,c);
   if(c.kind==='bite'){g.audio.play('h_impact',c.origin,.8);harborBite(g,c);harborSplash(g,c.origin.clone().addScaledVector(c.dir,4),4);}
   if(c.kind==='lure')harborSplash(g,c.at,5.2);
  }
  if(t<=c.active){
   if(c.kind==='wave'){
    for(let wave=0;wave<c.waves;wave++){const wt=t-wave*.9;if(wt<0||wt>2.2)continue;const r=.8+27*Math.min(1,wt/2.2),before=c.previous[wave];
     for(const a of targets(e)){const delta=a.pos.clone().sub(c.origin).setY(0),d=delta.length(),angle=Math.atan2(delta.x,delta.z),gap=Math.abs(Math.atan2(Math.sin(angle-c.gapAngle),Math.cos(angle-c.gapAngle)))<c.gap/2;
      if(!gap&&d>=before-1-a.radius&&d<=r+1+a.radius&&!c.waveHits[wave].has(a)){hit(e,a,125,'heavy',true);c.waveHits[wave].add(a);}
     }c.previous[wave]=r;
    }
   }else if(c.kind==='maelstrom'){
    c.tick-=dt;if(t<2.5&&c.tick<=0){c.tick=.85;for(const a of targets(e))if(a.pos.distanceTo(c.at)<c.radius)hit(e,a,62,'hazard',true);}
    if(t>=2.8&&!c.detonated){c.detonated=true;harborSplash(g,c.at,c.radius);g.fx.shockwave(c.at,{r1:11,dur:.65,strength:.025});g.audio.play('h_impact',c.at,1);for(const a of targets(e))if(a.pos.distanceTo(c.at)<c.radius)hit(e,a,165,'heavy',true);}
   }else if(c.kind==='deluge'){
    c.tick-=dt;if(c.tick<=0){c.tick=.95;for(const a of targets(e))if(c.lanes.some(l=>inLane(l.origin,l.dir,a.pos,l.length,c.width)))hit(e,a,55,'hazard',true);}
   }else for(const a of targets(e))if(!c.hit.has(a)){
    const inside=c.kind==='bite'?inSector(c.origin,c.dir,a.pos,8.5+a.radius,Math.PI*.85):c.kind==='hook'?inLane(c.origin,c.dir,a.pos,c.length,c.width):a.pos.distanceTo(c.at)<5.2;
    if(inside){const hp=a.hp;hit(e,a,c.kind==='hook'?115:145);c.hit.add(a);if(c.kind==='hook'&&a.hp<hp){const toward=c.origin.clone().sub(a.pos).setY(0),distance=toward.length();if(distance>3){toward.setLength(Math.min(4,distance-3));const end=g.level.displacement(a.pos,a.pos.clone().add(toward),a.radius);a.pos.copy(end);}}}
   }
  }
  if(t>=c.active&&!c.recovering){c.recovering=true;s.exposed=Math.max(s.exposed,c.recover);e.intent='收潮破绽 · 反击伤害 +25%';e.play('Idle_B');}
  if(t>=c.active+c.recover){s.cast=null;s.rest=e.type==='angler'?(s.phase===3?.6:.9):1.05;}return true;
 }
 s.rest-=dt;if(s.rest>0){const distance=g.player.pos.distanceTo(e.pos);if(distance>8){e._walk(g.player.pos.x,g.player.pos.z,dt,e.T.speed);e.locomote('Running_A',e.T.speed);}else{e.face(g.player.pos.x,g.player.pos.z);e.play('Idle_B');}return true;}
 if(g.player.pos.distanceTo(e.pos)>18){e._walk(g.player.pos.x,g.player.pos.z,dt,e.T.speed);e.locomote('Running_A',e.T.speed);return true;}
 const rotation=e.type==='hookcaptain'?['hook','bite','hook','bite']:s.phase===1?['hook','bite','lure','wave']:s.phase===2?['deluge','lure','hook','maelstrom','wave','bite']:['wave','maelstrom','lure','hook','deluge','bite'];start(e,rotation[s.index++%rotation.length]);return true;
}
export function brinePool(g,p,r=2.3,dur=4){
 const at=p.clone();g.fx.glyph(at,{tex:'ring_soft',color:[.2,.6,.65],r,dur,spin:.12});let t=0,tick=0;
 g.fx.add(dt=>{if(g.cinematic)return true;t+=dt;tick-=dt;if(tick<=0){tick=.85;if(g.player.alive&&g.player.pos.distanceTo(at)<r)g.player.hurt(18,at);}return t<dur;});
}
export function harborUpdate(e,dt,dist){
 if(e.T.episode!==5)return false;const g=e.game;if(e.asleep||g.cinematic||!g.player.alive)return true;
 if(e.type==='angler'||e.type==='hookcaptain')return chief(e,dt);
 if(e.type==='tidechain'){e.play('Idle');e.intent='沉船钟链 · 破坏以解除潮门';return true;}
 if(e.frozen>0||e.stagger>0)return false;
 e.harborCd=(e.harborCd??3)-dt;const c=e.harborMinor;
 if(c){c.t+=dt;if(c.t<c.windup)return true;c.warning.stop();e.harborMinor=null;e.harborCd=e.type==='pirate'?6:8;
  if(e.type==='pirate'){const end=g.level.displacement(e.pos,c.at,e.radius);e.pos.copy(end);for(const a of targets(e))if(a.pos.distanceTo(e.pos)<3.2)hit(e,a,65,'projectile');}
  else{harborSplash(g,c.at,3);for(const a of targets(e))if(a.pos.distanceTo(c.at)<3)hit(e,a,72,'projectile');}
  return true;
 }
 if(e.harborCd<=0&&dist<23&&(e.type!=='pirate'||dist>4&&dist<12)&&g.level.clear(e.pos.x,e.pos.z,g.player.pos.x,g.player.pos.z,.2)&&['pirate','tidewitch'].includes(e.type)){
  const at=g.player.pos.clone();if(e.type==='pirate'){const delta=at.clone().sub(e.pos);if(delta.length()>7)at.copy(e.pos).addScaledVector(delta,7/delta.length());}const windup=e.type==='pirate'?.9:1.15;e.harborMinor={at,t:0,windup,warning:harborTelegraph(g,{kind:'disc',origin:at,radius:3,duration:windup})};e.playTimed?.('attack',windup,{restart:true});return true;
 }
 return false;
}

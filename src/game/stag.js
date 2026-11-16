import {bossAttack} from './combat.js';
import * as THREE from 'three';
import {stagTelegraph,stagSlash,stagRoots,stagShockwave,stagChargeTrail} from './stag-vfx.js';
const V=(x=0,z=0)=>new THREE.Vector3(x,0,z);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function inSector(origin,dir,target,radius,angle){const d=target.clone().sub(origin).setY(0);return d.length()<=radius&&(!d.lengthSq()||d.normalize().dot(dir)>=Math.cos(angle/2));}
export function inLane(origin,dir,target,length,width){const d=target.clone().sub(origin).setY(0),along=d.dot(dir),side=Math.abs(d.x*dir.z-d.z*dir.x);return along>=0&&along<=length&&side<=width/2;}
const targets=e=>[e.game.player,...(e.game.allies??[])].filter(a=>a.alive);
function hit(e,a,damage,plague=0){
  const g=e.game;if(g.cinematic||!a.alive||a.invuln>0||a.buffs?.divineWings)return;
  const hp=a.hp;a.hurt(damage*(a===g.player?1:.65),e.pos,bossAttack(e,damage<=25?'hazard':'heavy'));
  if(plague&&a===g.player&&a.hp<hp){a.plagueStacks=Math.min(3,(a.plagueStacks??0)+plague);a.plagueUntil=g.time+10;}
}
export function stagPoise(e,value){
  const s=e.stag;if(!s?.cast||s.cast.kind!=='roots'||s.cast.t>=s.cast.windup)return;
  s.poise=Math.min(1,(s.poise??0)+value);
  if(s.poise>=1){for(const w of s.cast.warnings)w.stop?.();s.seeds=(s.seeds??[]).filter(seed=>seed.cast!==s.cast);s.cast=null;s.rest=2.8;s.stunned=2.8;s.exposed=3.2;s.poise=0;e.intent='失衡 · 趁机反击';e.play('Hit_A',{once:true,restart:true});e.game.ui.toast('根歌被打断 · 鹿王失衡');}
}
function startCast(e,kind){
  const g=e.game,s=e.stag,p=g.player,origin=e.pos.clone().setY(0),dir=p.pos.clone().sub(origin).setY(0).normalize();if(!dir.lengthSq())dir.set(0,0,1);
  const windup={cleave:.9,charge:1.15,roots:1.25,nova:1.4}[kind],active={cleave:.28,charge:.7,roots:1,nova:2.2}[kind],recover={cleave:.75,charge:1.25,roots:1,nova:1.2}[kind];
  const c={kind,t:0,origin,dir,windup,active,recover,hit:new Set(),warnings:[],started:false,previous:0};
  c.radius=kind==='cleave'?6.5:30;c.angle=Math.PI*.9;c.width=kind==='charge'?3.8:3;
  const end=g.level.displacement(origin,origin.clone().addScaledVector(dir,kind==='charge'?19:22),e.radius);
  c.length=origin.distanceTo(end);c.end=end;
  c.dirs=kind==='roots'?(s.phase===3?[-.64,-.32,0,.32,.64]:s.phase===2?[-.38,0,.38]:[0]).map(a=>dir.clone().applyAxisAngle(new THREE.Vector3(0,1,0),a)):[dir];
  c.lanes=c.dirs.map(d=>({dir:d,length:kind==='roots'?origin.distanceTo(g.level.displacement(origin,origin.clone().addScaledVector(d,22),1.5)):c.length}));
  const warning=({dir:d,length})=>stagTelegraph(g,{kind,origin,dir:d,radius:c.radius,angle:c.angle,width:c.width,length,duration:windup});
  c.warnings=c.lanes.map(warning);s.cast=c;e.intent={cleave:'荆斧横扫 · 绕到身后',charge:'鹿角突进 · 横向闪避',roots:'根歌突刺 · 离开预警 / 控制打断',nova:'疫钟回响 · 位移穿越钟波'}[kind];
  if(s.phase>=2&&['roots','nova'].includes(kind)){const spots=[p.pos.clone()];if(s.phase===3)for(const side of [-1,1])spots.push(p.pos.clone().add(V(dir.z*side*5,-dir.x*side*5)));for(const at of spots)if(!g.level.blocked(at.x,at.z,.3)){s.seeds??=[];s.seeds.push({at,t:0,tick:0,cast:c});stagTelegraph(g,{kind:'nova',origin:at,radius:3.2,duration:1});}}
  e.facing=Math.atan2(dir.x,dir.z);e.state='attack';e.playTimed?.(kind==='roots'||kind==='nova'?'Spellcast_Raise':'attack',windup,{restart:true});
  if(kind==='nova')g.audio.play('bell',origin,.7);else g.audio.play(kind==='roots'?'e_witch':'e_wolf',origin,.5);
}
function updateCast(e,dt){
  const g=e.game,s=e.stag,c=s.cast;c.t+=dt;e.facing=Math.atan2(c.dir.x,c.dir.z);
  if(c.t<c.windup)return;
  const t=c.t-c.windup;
  if(!c.started){c.started=true;e.intent={cleave:'横扫出手 · 身后安全',charge:'鹿角冲锋 · 侧向避让',roots:'根刺破土 · 避开根路',nova:'钟波扩散 · 位移穿越'}[c.kind];for(const w of c.warnings)w.stop?.();
    if(c.kind==='cleave')stagSlash(g,c.origin,c.dir,c.radius,c.angle);
    if(c.kind==='charge')stagChargeTrail(g,e);
    if(c.kind==='roots')for(const lane of c.lanes)if(lane.length>1)stagRoots(g,c.origin,lane.dir,lane.length);
    if(c.kind==='nova')stagShockwave(g,c.origin,c.radius,c.active);
    g.gfx.addShake(c.kind==='charge'?.3:.16);
  }
  if(t<=c.active){
    if(c.kind==='charge'){
      const next=c.origin.clone().lerp(c.end,clamp(t/c.active,0,1)),before=e.pos.clone();g.level.move(e.pos,next.x-e.pos.x,next.z-e.pos.z,e.radius);
      const traveled=e.pos.clone().sub(before).setY(0),len=traveled.length();if(len)traveled.normalize();
      for(const a of targets(e))if(!c.hit.has(a)&&((len&&inLane(before,traveled,a.pos,len,c.width))||a.pos.distanceTo(e.pos)<c.width/2)){hit(e,a,100*(1+.1*(s.phase-1)));c.hit.add(a);}
    }else for(const a of targets(e)){
      if(c.hit.has(a))continue;let inside=false;
      if(c.kind==='cleave')inside=inSector(c.origin,c.dir,a.pos,c.radius,c.angle);
      if(c.kind==='roots')inside=c.lanes.some(({dir:d,length})=>{const delta=a.pos.clone().sub(c.origin).setY(0),along=delta.dot(d),arrival=clamp(along/Math.max(1,length),0,1)*.65;return inLane(c.origin,d,a.pos,length,c.width)&&t>=arrival&&t<=arrival+.3;});
      if(c.kind==='nova'){const d=a.pos.distanceTo(c.origin),previous=c.previous/c.active*c.radius,now=t/c.active*c.radius;inside=d>=previous-1&&d<=now+1;}
      if(inside){hit(e,a,(c.kind==='cleave'?62:c.kind==='roots'?76:84)*(1+.1*(s.phase-1)),c.kind==='nova'?1:0);c.hit.add(a);}
    }
  }
  c.previous=t;
  if(t>=c.active){
    if(!c.recovering){c.recovering=true;s.exposed=c.recover;e.intent='收招破绽 · 伤害提高 25%';e.play('Idle');}
    if(t>=c.active+c.recover){s.cast=null;s.rest=s.phase===3?.35:.7;e.state='chase';e.intent='荆冠木甲 · 火焰可削弱';}
  }
}
export function stagUpdate(e,dt){
  const g=e.game;if(!e.alive||e.asleep||g.cinematic||!g.player.alive)return true;
  const s=e.stag??=( {phase:1,index:0,rest:1.5,cast:null,exposed:0,poise:0} );
  e.phase=s.phase;
  s.addCd=(s.addCd??18)-dt;if(s.phase>=2&&s.addCd<=0)s.adds=true;
  for(let i=(s.seeds?.length??0)-1;i>=0;i--){const seed=s.seeds[i];seed.t+=dt;
    if(seed.t>=1&&!seed.active){seed.active=true;g.fx.glyph?.(seed.at,{tex:'magic1',color:[.45,1.6,.12],r:3.2,dur:5,spin:.3});}
    if(seed.active){seed.tick-=dt;if(seed.tick<=0){seed.tick=.75;for(const a of targets(e))if(a.pos.distanceTo(seed.at)<3.2)hit(e,a,18,1);}}
    if(seed.t>=6)s.seeds.splice(i,1);
  }
  s.exposed=Math.max(0,s.exposed-dt);
  const phase=e.hp/e.maxHp>.6?1:e.hp/e.maxHp>.3?2:3;
  if(phase>s.phase){s.phase=phase;e.phase=phase;s.adds=true;g.ui.toast(phase===2?'鹿王 · 根歌苏醒':'鹿王 · 疫钟狂怒');g.audio.play('bell',e.pos,.6);}
  if(s.stunned>0){s.stunned-=dt;e.play('Idle');return true;}
  if(s.cast){updateCast(e,dt);return true;}
  if(s.adds){
    s.adds=false;s.rest=1.4;s.addCd=18;e.intent='疫歌呼唤 · 清理腐沼地精';
    const count=g.enemies.filter(o=>o.alive&&o.tag==='summon').length;
    for(let i=0;i<Math.min(3,6-count);i++){const a=i*Math.PI*2/3,q=e.pos.clone().add(V(Math.sin(a)*5,Math.cos(a)*5));if(!g.level.blocked(q.x,q.z,.6))g.spawnEnemy('goblin',q.x,q.z,{tag:'summon',level:9});}
  }
  s.rest-=dt;
  const delta=g.player.pos.clone().sub(e.pos).setY(0),dist=delta.length();
  if(s.rest>0){const speed=e.T.speed*(e.slow>0?.65:1);if(dist>5){e._walk(g.player.pos.x,g.player.pos.z,dt,speed);e.locomote('Running_A',speed);}else{e.face(g.player.pos.x,g.player.pos.z);e.play('Idle');}return true;}
  const rotation=s.phase===1?['cleave','charge','cleave','roots']:['roots','cleave','charge','nova','cleave'];
  let kind=rotation[s.index++%rotation.length];if(kind==='cleave'&&dist>10)kind='charge';startCast(e,kind);return true;
}

/** Matchups follow attack properties and recovery windows, independent of the selected hero name. */
export function bossDamage(e,amount,opts,g){
  if(e.asleep)return amount;
  let mul=1;const pal=opts.pal??'steel';
  if(e.type==='boss')mul=pal==='holy'?1.2:pal==='dark'?.8:1;
  if(e.type==='butcher')mul=pal==='poison'?.75:pal==='steel'?.92:1;
  if(e.type==='stag'){
    if(pal==='fire')e.barkUntil=g.time+5;
    mul=pal==='fire'?1.15:pal==='poison'?.65:pal==='steel'&&!(e.barkUntil>g.time)?.85:1;
    if(e.stag?.exposed>0)mul*=1.25;
    if(pal==='holy'&&(g.player.plagueStacks??0)>0&&!(g.player.cleanseAt>g.time)){g.player.plagueStacks--;g.player.cleanseAt=g.time+2.5;g.ui.number(g.player.pos,'圣光净蚀','info');}
  }
  return Math.max(1,Math.round(amount*mul));
}

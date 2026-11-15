import * as T from 'three';
import {inLane,inSector} from './stag.js';
import {stagTelegraph} from './stag-vfx.js';
import {shoot} from './skills.js';
const UP=new T.Vector3(0,1,0),V=(x=0,z=0)=>new T.Vector3(x,0,z);
const targets=e=>[e.game.player,...(e.game.allies??[])].filter(a=>a.alive);
export const saltShielded=e=>e.game.enemies.some(o=>o.alive&&o.type==='saltseal'&&o.pos.distanceTo(e.pos)<38);
export function saltDamage(e,amount,opts,g){
 if(e.T.episode!==4)return amount;
 const pal=opts.pal??'steel';let m=1;
 if(['saltdead','saltpriest','saltqueen'].includes(e.type)){if(pal==='holy')m*=1.2;if(pal==='dark')m*=.85;}
 if(e.type==='saltfiend'){if(pal==='fire')m*=1.25;if(pal==='ice')m*=.8;}
 if(e.type==='tombguard'&&e.stagger<=0&&e.frozen<=0&&opts.from&&['steel','arrow','bone'].includes(pal)&&inSector(e.pos,V(Math.sin(e.facing),Math.cos(e.facing)),opts.from,1000,Math.PI*.8))m*=.75;
 if(e.T.boss&&saltShielded(e))m*=.65;
 if(e.salt?.exposed>0)m*=1.3;
 if(e.type==='saltseal'&&g.player.has?.('sunseal'))m*=1.8;
 return Math.max(1,Math.round(amount*m));
}
export function saltPoise(e,value){
 const s=e.salt,c=s?.cast;if(!c||!['crown','fault'].includes(c.kind)||c.t>=c.windup)return;
 s.poise=Math.min(1,(s.poise??0)+value);if(s.poise<1)return;
 for(const w of c.warnings)w.stop();s.cast=null;s.rest=2.5;s.exposed=3;s.poise=0;e.intent='盐冠失衡 · 反击伤害 +30%';e.game.audio.play('shatter',e.pos);e.game.ui.toast('封尸被打断 · 抓住反击窗口');
}
function hurt(e,a,damage,storm=false){
 const g=e.game;if(g.cinematic||!a.alive||a.invuln>0||a.buffs?.divineWings)return;
 const shelter=storm&&g.story?.fourth?.shelter? .75:1;
 const mantle=storm&&a.has?.('saltmantle')? .65:1;
 a.hurt(damage*shelter*mantle*(a===g.player?1:.6),e.pos);
}
function spikes(g,p,r=3,count=g.low?8:14){g.fx.spikes(p,{count,radius:r,color:0xc5e7e7,emissive:0x28687a,height:3.5,hold:.6,rough:.3});g.fx.ring(p,{color:[.7,2.1,2.4],r0:.5,r1:r+1,dur:.5});g.audio.play('shatter',p,.6);}
function shard(e,dir,damage){
 const g=e.game,from=e.pos.clone().setY(1.9);
 shoot(g,{team:'enemy',pos:from,vel:dir.clone().multiplyScalar(18),pal:'ice',size:.27,r:.45,life:3,light:25,onHit:(a,p)=>{g.fx.spark(p,'ice',8);if(a)hurt(e,a,damage);}});
}
function makeSeals(e,n){
 const g=e.game,alive=g.enemies.filter(o=>o.alive&&o.type==='saltseal'&&o.pos.distanceTo(e.pos)<38).length;
 for(let i=alive;i<n;i++){
  const a=i*Math.PI*2/n,q=g.level.nearestFree(e.home.x+Math.sin(a)*9,e.home.z+Math.cos(a)*9,.9);
  if(q){const seal=g.spawnEnemy('saltseal',q.x,q.z,{tag:'summon',level:e.level});seal.intent='共鸣盐晶 · 击碎以解除盐冠护壳';g.fx.pillar(seal.pos,'ice',20,5);}
 }
}
function stormArt(g,c,duration){
 const root=new T.Group(),geo=new T.PlaneGeometry(120,100).rotateX(-Math.PI/2),mat=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,
 uniforms:{time:{value:0},safe:{value:new T.Vector2(c.safe.x,c.safe.z)},alpha:{value:1}},
 vertexShader:'varying vec3 w;void main(){w=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(w,1.);}',
 fragmentShader:'varying vec3 w;uniform float time,alpha;uniform vec2 safe;void main(){float d=length(w.xz-safe);float mask=smoothstep(5.2,6.3,d);float stream=.5+.5*sin(w.x*.7+w.z*.3-time*4.);float grain=.5+.5*sin(w.x*9.-w.z*13.+time*17.);vec3 sand=mix(vec3(.32,.23,.12),vec3(.84,.73,.48),stream);gl_FragColor=vec4(sand,mask*(.1+stream*.14+grain*.04)*alpha);}'
 });root.position.set(c.origin.x,.12,c.origin.z);root.add(new T.Mesh(geo,mat));g.gfx.scene.add(root);let t=0;
 g.fx.add(dt=>{if(g.cinematic)return true;t+=dt;mat.uniforms.time.value=t;mat.uniforms.alpha.value=Math.min(1,(duration-t)*2);return t<duration;},()=>{root.removeFromParent();geo.dispose();mat.dispose();});
 g.fx.glyph(c.safe,{tex:'ring_soft',color:[.3,2.5,2.1],r:5.5,dur:duration,spin:0});
 g.fx.glyph(c.safe,{tex:'magic2',color:[.4,1.6,1.7],r:4.8,dur:duration,spin:-.15});
}
function cast(e,kind){
 const g=e.game,s=e.salt,origin=e.pos.clone(),dir=g.player.pos.clone().sub(origin).setY(0).normalize();if(!dir.lengthSq())dir.set(0,0,1);
 const c={kind,origin,dir,t:0,windup:{fan:1,fault:1.25,storm:2,crown:1.6,prism:1.5}[kind],active:kind==='storm'?4.5:kind==='prism'?1.4:.35,recover:kind==='storm'?1.8:1.1,warnings:[],hit:new Set(),tick:0};
 if(kind==='fault'){
  const at=g.player.pos.clone(),side=V(dir.z,-dir.x);c.points=[-5,0,5].map(n=>at.clone().addScaledVector(side,n));
  for(const point of c.points)c.warnings.push(stagTelegraph(g,{kind:'disc',origin:point,radius:3,duration:c.windup}));
 } else if(kind==='storm'){
  const spots=e.type==='saltqueen'?[[13,11],[29,11],[21,16]]:[[15,28],[27,28]];
  const choices=spots.map(([x,z])=>g.level.center(x,z)).filter(p=>!g.level.blocked(p.x,p.z,5.5));
  // Safety always starts within a reachable dodge, even if authored scenery rules out a fixed shrine.
  const legal=choices.filter(p=>p.distanceTo(g.player.pos)<14),q=legal[s.index%Math.max(1,legal.length)]??g.player.pos;
  c.safe=q.clone();const free=g.level.nearestFree(c.safe.x,c.safe.z,.8);if(free){c.safe.x=free.x;c.safe.z=free.z;}
  stormArt(g,c,c.windup+c.active);g.ui.toast('盐沙风暴 · 进入青色圆环避风');
 } else if(kind==='prism'){
  c.lanes=Array.from({length:6},(_,i)=>({origin,dir:dir.clone().applyAxisAngle(UP,i*Math.PI/3),length:40}));
  for(const lane of c.lanes)c.warnings.push(stagTelegraph(g,{kind:'charge',...lane,width:2.8,duration:c.windup}));
 } else c.warnings.push(stagTelegraph(g,{kind:kind==='crown'?'disc':'cleave',origin,dir,radius:kind==='crown'?8:16,angle:Math.PI*.7,duration:c.windup}));
 s.cast=c;s.poise=0;e.facing=Math.atan2(dir.x,dir.z);e.playTimed?.(kind==='fan'?'attack':'Spellcast_Raise',c.windup,{restart:true});
 e.intent={fan:'晶刃扇射 · 从弹道空隙穿过',fault:'盐棱断层 · 离开三处预警圆',storm:'盐沙风暴 · 青色圆环内安全',crown:'凝结盐冠 · 控制打断 / 破坏盐晶',prism:'六棱裁决 · 躲到射线之间'}[kind];g.audio.play(kind==='storm'?'raise':'e_spikes',origin,.65);
}
function chief(e,dt){
 const g=e.game;if(e.asleep||g.cinematic||!g.player.alive)return true;
 const s=e.salt??={phase:1,index:0,rest:1.2,poise:0,exposed:0,shielded:false};s.exposed=Math.max(0,s.exposed-dt);
 const shielded=saltShielded(e);if(s.shielded&&!shielded){s.exposed=4;s.rest=Math.max(2,s.rest);g.ui.toast('共鸣盐晶全碎 · 反击伤害 +30%');}s.shielded=shielded;
 const phase=e.type==='saltqueen'?(e.hp/e.maxHp>.7?1:e.hp/e.maxHp>.35?2:3):1;
 if(phase>s.phase){s.phase=phase;s.rally=true;g.ui.toast(phase===2?'盐后易冠 · 共鸣盐晶降临':'荒原终令 · 六棱裁决');g.audio.play('roar',e.pos,.6);}e.phase=s.phase;
 const c=s.cast;
 if(c){
  c.t+=dt;if(c.t<c.windup)return true;const t=c.t-c.windup;
  if(!c.fired){c.fired=true;for(const w of c.warnings)w.stop();g.gfx.addShake(.25);
   if(c.kind==='fault')for(const p of c.points)spikes(g,p);
   if(c.kind==='fan')for(let i=-2;i<=2;i++)shard(e,c.dir.clone().applyAxisAngle(UP,i*.21),e.type==='saltqueen'?83:65);
   if(c.kind==='crown')makeSeals(e,e.type==='saltqueen'?3:2);
   if(c.kind==='prism')for(const lane of c.lanes){g.fx.bolt(lane.origin.clone().setY(1.2),lane.origin.clone().addScaledVector(lane.dir,40).setY(1.2),{color:[1.3,2.5,2.8],dur:1.4,width:.17,branches:0});for(let i=1;i<6;i++)spikes(g,lane.origin.clone().addScaledVector(lane.dir,i*6),1,g.low?2:4);}
  }
  if(t<=c.active){
   if(c.kind==='storm'){
    c.tick-=dt;if(c.tick<=0){c.tick=.75;for(const a of targets(e))if(a.pos.distanceTo(c.safe)>5.5)hurt(e,a,s.phase===3?84:70,true);g.smoke?.emit({pos:{x:c.origin.x,y:1,z:c.origin.z},count:g.low?2:5,radius:22,speed:[3,7],life:[.5,1.3],size:[3,6],c0:[.65,.58,.4],c1:[.24,.25,.24],alpha:.15,tex:'smoke'});}
   } else if(['fault','prism'].includes(c.kind))for(const a of targets(e)){
    const inside=c.kind==='fault'?c.points.some(p=>p.distanceTo(a.pos)<3+a.radius*.3):c.lanes.some(l=>inLane(l.origin,l.dir,a.pos,l.length,2.8));
    if(inside&&!c.hit.has(a)){hurt(e,a,c.kind==='prism'?138:112);c.hit.add(a);}
   }
  }
  if(t>=c.active&&!c.recovering){c.recovering=true;if(!shielded)s.exposed=Math.max(s.exposed,c.recover);e.intent=shielded?'盐晶护壳 · 先破晶':'盐冠破绽 · 反击伤害 +30%';e.play('Idle');}
  if(t>=c.active+c.recover){s.cast=null;s.rest=s.phase===3?.65:1.2;}
  return true;
 }
 if(s.rally){s.rally=false;makeSeals(e,s.phase===3?3:2);const alive=g.enemies.filter(o=>o.alive&&o.tag==='summon'&&o.type==='saltdead').length;for(let i=alive;i<2;i++){const p=g.level.nearestFree(e.home.x+(i?7:-7),e.home.z+9,.8);if(p)g.spawnEnemy('saltdead',p.x,p.z,{tag:'summon',level:e.level});}s.rest=1.6;}
 s.rest-=dt;if(s.rest>0){if(g.player.pos.distanceTo(e.pos)>11.5){e._walk(g.player.pos.x,g.player.pos.z,dt,e.T.speed);e.locomote('Running_A',e.T.speed);}else{e.face(g.player.pos.x,g.player.pos.z);e.play('Idle');}return true;}
 const rotation=e.type==='saltpriest'?['fault','fan','crown','fault']:s.phase===1?['fan','fault','storm']:s.phase===2?['crown','fault','storm','fan']:['prism','storm','fault','fan'];
 cast(e,rotation[s.index++%rotation.length]);return true;
}
export function saltUpdate(e,dt,dist){
 if(e.T.episode!==4)return false;
 const g=e.game;if(e.asleep||g.cinematic||!g.player.alive)return true;
 if(e.T.boss)return chief(e,dt);
 if(e.type==='saltseal'){e.play('Idle');e.intent='共鸣盐晶 · 护佑附近封尸者';return true;}
 if(e.frozen>0||e.stagger>0)return false;
 const c=e.saltMinor;
 if(c){c.t+=dt;if(c.t<c.windup)return true;c.warning.stop();e.saltMinor=null;e.saltCd=6;
  if(e.type==='saltfiend'){spikes(g,c.at,3.6);for(const a of targets(e))if(a.pos.distanceTo(c.at)<3.6)hurt(e,a,88);}
  else{spikes(g,c.at,2.6);for(const a of targets(e))if(a.pos.distanceTo(c.at)<2.6)hurt(e,a,68);}
  return true;
 }
 e.saltCd=(e.saltCd??3)-dt;
 if(['sandweaver','saltfiend'].includes(e.type)&&e.saltCd<=0&&dist<24&&g.level.clear(e.pos.x,e.pos.z,g.player.pos.x,g.player.pos.z,.2)){
  const at=g.player.pos.clone(),windup=e.type==='saltfiend'?1.25:1;e.saltMinor={at,t:0,windup,warning:stagTelegraph(g,{kind:'disc',origin:at,radius:e.type==='saltfiend'?3.6:2.6,duration:windup})};e.playTimed?.('attack',windup,{restart:true});return true;
 }
 return false;
}

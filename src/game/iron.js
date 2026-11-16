import {bossAttack} from './combat.js';
import * as T from 'three';
import {inLane,inSector} from './stag.js';
import {stagTelegraph} from './stag-vfx.js';
const V=(x=0,z=0)=>new T.Vector3(x,0,z),UP=new T.Vector3(0,1,0);
const actors=e=>[e.game.player,...(e.game.allies??[])].filter(a=>a.alive);
export function hasStandard(e){return e.type!=='warbanner'&&e.game.enemies.some(o=>o.alive&&o.type==='warbanner'&&o.pos.distanceTo(e.pos)<25);}
export function ironDamage(e,amount,opts,g){
 if(e.T.episode!==3)return amount;
 const pal=opts.pal??'steel',s=e.iron,front=opts.from&&inSector(e.pos,V(Math.sin(e.facing),Math.cos(e.facing)),opts.from,10000,Math.PI*.85);
 let m=hasStandard(e)?.8:1;
 if(['rebel','captain','blackknight','ironking'].includes(e.type)&&front&&['steel','bone','arrow'].includes(pal))m*=s?.cast?.kind==='guard'?.35:.85;
 if(['bolt','lightning'].includes(pal)&&e.type!=='assassin')m*=1.15;
 if(pal==='fire'&&['warbanner','ballista'].includes(e.type))m*=1.25;
 if(s?.exposed>0)m*=1.25;
 if(g.player.has?.('siegebreaker')&&['warbanner','ballista'].includes(e.type))m*=1.6;
 return Math.max(1,Math.round(amount*m));
}
export function ironPoise(e,value){
 const s=e.iron,c=s?.cast;if(!c||!['guard','verdict'].includes(c.kind)||c.t>=c.windup)return;
 s.poise=Math.min(1,(s.poise??0)+value);
 if(s.poise<1)return;
 for(const w of c.warnings)w.stop();s.cast=null;s.rest=2.5;s.exposed=3.2;s.poise=0;e.intent='盾势已破 · 反击伤害 +25%';e.play('Hit_A',{once:true,restart:true});e.game.audio.play('shatter',e.pos,.7);e.game.ui.toast('破盾成功 · 趁机反击');
 if(e.game.player.has?.('siegebreaker'))e.game.player.buff('siegebreaker',5,{});
}
function hit(e,a,damage){if(e.game.cinematic||!a.alive||a.invuln>0||a.buffs?.divineWings)return;a.hurt(damage*(hasStandard(e)?1.25:1)*(a===e.game.player?1:.65),e.pos,bossAttack(e));}
function slash(g,c){
 // Layered steel arcs and sparks share the same directional footprint as the sword sweep.
 const root=new T.Group();root.position.copy(c.origin);root.rotation.y=Math.atan2(c.dir.x,c.dir.z);const geos=[],mats=[],arcs=[];
 for(let j=0;j<3;j++){
  const geo=new T.RingGeometry(c.radius-.65-j*.15,c.radius-j*.15,48,1,Math.PI/2-c.angle/2,c.angle);geo.rotateX(-Math.PI/2);const mat=new T.MeshBasicMaterial({color:j?0xc79b5b:0xeaf3ff,transparent:true,opacity:.8,depthWrite:false,side:T.DoubleSide});const o=new T.Mesh(geo,mat);o.position.y=.7+j*.45;root.add(o);geos.push(geo);mats.push(mat);arcs.push(o);
 }
 g.gfx.scene.add(root);let t=0;g.fx.add(dt=>{t+=dt;arcs.forEach((o,i)=>{o.scale.setScalar(.75+t*.6+i*.025);o.material.opacity=Math.max(0,.8-t*1.7);});return t<.5;},()=>{root.removeFromParent();geos.forEach(x=>x.dispose());mats.forEach(x=>x.dispose());});
 g.fx.spark(c.origin,'steel',18);
}
function fireLine(g,lane,width){
 const root=new T.Group();root.position.copy(lane.origin);root.rotation.y=Math.atan2(lane.dir.x,lane.dir.z);
 const geo=new T.PlaneGeometry(width,lane.length,1,1);geo.rotateX(-Math.PI/2);geo.translate(0,.09,lane.length/2);
 const mat=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{time:{value:0},alpha:{value:1}},
  vertexShader:'varying vec2 p;void main(){p=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'varying vec2 p;uniform float time,alpha;void main(){float edge=smoothstep(0.,.08,p.x)*smoothstep(1.,.92,p.x);float crack=pow(1.-abs(sin(p.x*24.+sin(p.y*55.-time*8.))),8.);float heat=.45+.35*sin(p.y*40.-time*12.)+crack;vec3 c=mix(vec3(.25,.018,.008),vec3(3.,1.2,.25),heat);gl_FragColor=vec4(c,edge*alpha*.85);}'
 });root.add(new T.Mesh(geo,mat));g.gfx.scene.add(root);let t=0;g.fx.add(dt=>{if(g.cinematic)return true;t+=dt;mat.uniforms.time.value=t;mat.uniforms.alpha.value=Math.min(1,(1.15-t)*4);return t<1.15;},()=>{root.removeFromParent();geo.dispose();mat.dispose();});
 for(let i=1;i<=6;i++)g.fx.pillar(lane.origin.clone().addScaledVector(lane.dir,i*lane.length/7),'fire',12,2.5);
}
function cast(e,kind){
 const g=e.game,s=e.iron,origin=e.pos.clone(),dir=g.player.pos.clone().sub(origin).setY(0).normalize();if(!dir.lengthSq())dir.set(0,0,1);
 const c={kind,origin,dir,t:0,windup:{guard:1.5,cut:.85,lunge:1.1,volley:1.2,verdict:1.5}[kind],active:kind==='lunge'?.7:kind==='verdict'?.9:.28,recover:kind==='guard'?1:1.1,hit:new Set(),warnings:[],radius:7,angle:Math.PI*.9,width:3.7};
 c.end=g.level.displacement(origin,origin.clone().addScaledVector(dir,kind==='lunge'?23:32),e.radius);c.length=origin.distanceTo(c.end);
 c.lanes=(kind==='verdict'?[-8,0,8]:[0]).map(offset=>{const at=origin.clone().add(V(dir.z*offset,-dir.x*offset));return {origin:at,dir:dir.clone(),length:at.distanceTo(g.level.displacement(at,at.clone().addScaledVector(dir,32),.2))};});
 if(kind==='volley'){
  const n=g.story?.third?.ballista?3:s.phase===3?7:5;
  c.lanes=Array.from({length:n},(_,i)=>({origin,dir:dir.clone().applyAxisAngle(UP,(i-(n-1)/2)*.2),length:32}));
 }
 if(kind==='cut'||kind==='guard')c.warnings.push(stagTelegraph(g,{kind:'cleave',origin,dir,radius:c.radius,angle:c.angle,duration:c.windup}));
 else for(const lane of c.lanes)c.warnings.push(stagTelegraph(g,{kind:'charge',...lane,width:kind==='volley'?.8:c.width,length:kind==='lunge'?c.length:lane.length,duration:c.windup}));
 s.cast=c;s.poise=0;e.state='attack';e.facing=Math.atan2(dir.x,dir.z);e.intent={guard:'举盾反击 · 绕背 / 控制破盾',cut:'断军横斩 · 绕到身后',lunge:'王剑突进 · 横向闪避',volley:'王庭齐射 · 穿过箭隙',verdict:'铁律裁决 · 站入三道火线的空隙'}[kind];e.playTimed?.(kind==='guard'?'Taunt':'attack',c.windup,{restart:true});g.audio.play(kind==='guard'?'warcry':'swing',origin,.65);
}
function boss(e,dt){
 const g=e.game;if(e.asleep||g.cinematic||!g.player.alive)return true;
 const s=e.iron??={phase:1,index:0,rest:1.3,cast:null,poise:0,exposed:0};s.exposed=Math.max(0,s.exposed-dt);e.phase=s.phase;
 const phase=e.type==='ironking'?(e.hp/e.maxHp>.65?1:e.hp/e.maxHp>.3?2:3):1;
 if(phase>s.phase){s.phase=phase;e.phase=phase;s.rally=true;g.ui.toast(phase===2?'王令 · 血旗不倒':'终令 · 铁律裁决');g.audio.play('warcry',e.pos,.9);}
 const c=s.cast;
 if(c){
  c.t+=dt;e.facing=Math.atan2(c.dir.x,c.dir.z);
  if(c.t<c.windup)return true;
  const t=c.t-c.windup;
  if(!c.fired){c.fired=true;for(const w of c.warnings)w.stop();
   if(['cut','guard'].includes(c.kind))slash(g,c);
   if(c.kind==='volley')for(const lane of c.lanes)e._fire(55*(1+.1*(s.phase-1)),lane.dir.clone());
   if(c.kind==='verdict')for(const lane of c.lanes)fireLine(g,lane,c.width);
   g.audio.play(c.kind==='verdict'?'fireball':'e_hit',e.pos,.8);g.gfx.addShake(.3);
  }
  if(t<=c.active){
   if(c.kind==='lunge'){const next=c.origin.clone().lerp(c.end,Math.min(1,t/c.active)),before=e.pos.clone();g.level.move(e.pos,next.x-e.pos.x,next.z-e.pos.z,e.radius);const d=e.pos.clone().sub(before),length=d.length();if(length)d.normalize();for(const a of actors(e))if(!c.hit.has(a)&&((length>0&&inLane(before,d,a.pos,length,c.width))||a.pos.distanceTo(e.pos)<2)){hit(e,a,92);c.hit.add(a);}}
   else if(c.kind!=='volley')for(const a of actors(e)){
    if(c.hit.has(a))continue;const inside=c.kind==='verdict'?c.lanes.some(l=>inLane(l.origin,l.dir,a.pos,l.length,c.width)):inSector(c.origin,c.dir,a.pos,c.radius,c.angle);
    if(inside){hit(e,a,(c.kind==='verdict'?105:72)*(1+.12*(s.phase-1)));c.hit.add(a);}
   }
  }
  if(t>c.active&&!c.recovering){c.recovering=true;s.exposed=c.recover;e.intent='收剑破绽 · 伤害提高 25%';e.play('Idle');}
  if(t>=c.active+c.recover){s.cast=null;s.rest=s.phase===3?.55:1.1;e.state='chase';}
  return true;
 }
 if(s.rally){
  s.rally=false;const alive=g.enemies.filter(o=>o.alive&&o.type==='warbanner').length;
  for(let i=alive;i<Math.min(2,s.phase-1);i++){const q=g.level.nearestFree(e.home.x+(i?8:-8),e.home.z+8,.8);if(q)g.spawnEnemy('warbanner',q.x,q.z,{tag:'summon',level:13});}
  s.rest=1.7;
 }
 s.rest-=dt;const distance=g.player.pos.distanceTo(e.pos);
 if(s.rest>0){if(distance>5){e._walk(g.player.pos.x,g.player.pos.z,dt,e.T.speed*(e.slow>0?.65:1));e.locomote('Running_A',e.T.speed);}else{e.face(g.player.pos.x,g.player.pos.z);e.play('Idle');}return true;}
 const rotation=e.type==='blackknight'?['guard','cut','lunge']:s.phase===1?['guard','cut','lunge','volley']:s.phase===2?['volley','guard','lunge','cut']:['verdict','cut','volley','guard','lunge'];
 let kind=rotation[s.index++%rotation.length];if(kind==='cut'&&distance>11)kind='lunge';cast(e,kind);return true;
}
export function ironUpdate(e,dt,dist){
 if(e.T.episode!==3)return false;
 const g=e.game;if(e.asleep||g.cinematic||!g.player.alive)return true;
 if(['blackknight','ironking'].includes(e.type))return boss(e,dt);
 if(e.type==='warbanner'){e.auraCd=(e.auraCd??0)-dt;if(e.auraCd<=0&&dist<35){e.auraCd=3;g.fx.ring?.(e.pos,{color:[1.5,.2,.08],r0:24,r1:25,dur:2.5});}e.intent='军阵战旗 · 25 米内友军减伤并强化攻击';e.play('Idle');return true;}
 if(e.type==='berserker'&&!e.enraged&&e.hp/e.maxHp<.35){e.enraged=true;g.audio.play('warcry',e.pos);g.fx.ring(e.pos,{color:[2.6,.2,.05],r0:1,r1:4,dur:.6});}
 if(e.stagger>0||e.frozen>0)return false;
 e.ironCd=(e.ironCd??(e.type==='ballista'?2:4))-dt;
 const c=e.ironMove;
 if(c){
  c.t+=dt;if(c.t<c.windup)return true;
  c.warning.stop();e.ironMove=null;e.ironCd=e.type==='ballista'?4.5:7;
  if(e.type==='assassin'){
   const end=g.level.displacement(c.origin,c.origin.clone().addScaledVector(c.dir,c.length),e.radius);g.level.move(e.pos,end.x-e.pos.x,end.z-e.pos.z,e.radius);for(const a of actors(e))if(inLane(c.origin,c.dir,a.pos,c.length,2))hit(e,a,52);g.fx.spark(e.pos,'steel',10);
  }else{const n=e.type==='ballista'?1:3;for(let i=0;i<n;i++)e._fire(e.type==='ballista'?85:36,c.dir.clone().applyAxisAngle(UP,(i-(n-1)/2)*.13));}
  return true;
 }
 if(['assassin','arbalist','ballista'].includes(e.type)&&dist<(e.type==='assassin'?14:38)&&dist>3&&e.ironCd<=0&&g.level.clear(e.pos.x,e.pos.z,g.player.pos.x,g.player.pos.z,.2)){
  const origin=e.pos.clone(),dir=g.player.pos.clone().sub(origin).setY(0).normalize(),length=e.type==='assassin'?Math.min(13,dist+1):38,windup=e.type==='ballista'?1.4:.9;
  e.facing=Math.atan2(dir.x,dir.z);e.ironMove={origin,dir,length,t:0,windup,warning:stagTelegraph(g,{kind:'charge',origin,dir,length,width:e.type==='assassin'?2:1,duration:windup})};e.playTimed?.('attack',windup,{restart:true});return true;
 }
 return e.type==='ballista';
}

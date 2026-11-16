import assert from 'node:assert/strict';
// Ideal walkable arena; summoned adds do not attack. This compares real boss timings
// and recovery rules, not player skill or GPU performance.
import * as T from 'three';
import {Player} from '../src/game/player.js';
import {CLASSES} from '../src/game/classes.js';
import {harborUpdate} from '../src/game/harbor.js';
import {saltUpdate} from '../src/game/salt.js';
import {stagUpdate} from '../src/game/stag.js';
import {ENEMY_TYPES} from '../src/game/enemy.js';
import {recoveryFactor} from '../src/game/combat.js';
const noop=()=>{},V=(x=0,z=0)=>new T.Vector3(x,0,z),UP=new T.Vector3(0,1,0);
function run(type,phase,dodging,gear,potions,highregen){
 const dt=.025;let nextProc=0,seed=1234,damage=0,hits=0,heavy=0,counters={},lastCast,target,react=0,healthMinimum=1;
 const p=Object.create(Player.prototype),g={time:0,player:p,allies:[],enemies:[],projectiles:[],low:true,cinematic:false,story:{fourth:{},fifth:{}},audio:{play:noop},ui:{number:noop,toast:noop,hurtFlash:noop,refreshStats:noop},particles:{emit:noop},smoke:{emit:noop},save:noop,onPlayerDeath:noop,gfx:{scene:new T.Scene(),camera:new T.PerspectiveCamera(),flash:()=>new T.Object3D(),addShake:noop},fx:new Proxy({add:noop,tex:{}},{get:(o,k)=>o[k]??noop}),level:{center:(x,z)=>V(x*4+2,z*4+2),blocked:()=>false,nearestFree:(x,z)=>({x,z}),clear:()=>true,displacement:(_,to)=>to.clone(),findPath:(x,z,xx,zz)=>[{x:xx,z:zz}],move(pos,x,z){pos.x+=x;pos.z+=z;return true;}},spawnEnemy(type,x,z,opts){const e={type,alive:true,pos:V(x,z),tag:opts.tag};g.enemies.push(e);return e;}};
 Object.assign(p,{cls:'mage',C:CLASSES.mage,game:g,level:type==='stag'?10:type==='angler'?18:16,pos:V(86,55),radius:.6,alive:true,hp:gear==='rare'?795:983,maxHp:gear==='rare'?795:983,dr:gear==='rare'?.30:.43,invuln:0,buffs:{},stats:{regen:highregen?(gear==='rare'?15:27):0,lifeHit:highregen?(gear==='rare'?13:23.4):0},shield:0,maxMp:150,mp:150,potions:{hp:potions?6:0,mp:0},flags:new Set(highregen?['bloodring']:[]),flash:noop,play:noop,showShield:noop});
 if(type==='angler'){p.hp=p.maxHp=gear==='rare'?834:1066;p.stats.regen=highregen?(gear==='rare'?17:29.6):0;p.stats.lifeHit=highregen?(gear==='rare'?12:23.4):0;}
 if(type==='stag'){p.hp=p.maxHp=gear==='rare'?562:741;p.stats.regen=highregen?17.9:0;p.stats.lifeHit=highregen?14.3:0;}
 const actualHurt=p.hurt.bind(p);p.hurt=(d,from,attack)=>{const before=p.hp;actualHurt(d,from,attack);if(before>p.hp){damage+=before-p.hp;hits++;if(attack?.kind==='heavy')heavy++;}};
 const e={type,T:ENEMY_TYPES[type],game:g,pos:V(86,42),home:V(86,42),hp:ENEMY_TYPES[type].hp*(phase===3?.25:phase===2?.5:1),maxHp:ENEMY_TYPES[type].hp,level:type==='stag'?10:type==='angler'?18:16,alive:true,asleep:false,play:noop,playTimed:noop,locomote:noop,face:noop,radius:1,slow:0,_walk(x,z,t,speed){const dir=V(x-this.pos.x,z-this.pos.z),len=dir.length();if(len>0)this.pos.addScaledVector(dir,Math.min(len,speed*t)/len);}};
 if(type==='stag')e.stag={phase,index:0,rest:0,exposed:0};else if(type==='angler')e.harbor={phase,index:0,rest:0,exposed:0};else e.salt={phase,index:0,rest:0,exposed:0};g.enemies=[e];
 for(;g.time<60&&p.alive;g.time+=dt){
  p.invuln=Math.max(0,p.invuln-dt);p.potionCd=Math.max(0,(p.potionCd??0)-dt);p._bellCd=(p._bellCd??0)-dt;
  p.hp=Math.min(p.maxHp,p.hp+p.stats.regen*.35*dt*recoveryFactor(p));if(highregen&&g.time>=nextProc){nextProc=g.time+.4;seed=(seed*1664525+1013904223)>>>0;p.onHit(seed/4294967296<(gear==='rare'?.158:.226));}if(p.hp<p.maxHp*.52&&p.potions.hp>0)p.usePotion('hp');
  const c=type==='stag'?e.stag.cast:type==='angler'?e.harbor.cast:e.salt.cast;
  if(c&&c!==lastCast){lastCast=c;react=g.time+.25;counters[c.kind]=(counters[c.kind]??0)+1;target=p.pos.clone();if(dodging){
   if(type==='angler'){
    if(c.kind==='hook')target=p.pos.clone().add(V(c.dir.z*5,-c.dir.x*5));
    if(c.kind==='bite')target=c.origin.clone().addScaledVector(c.dir,10.5);
    if(c.kind==='lure')target=p.pos.clone().add(V(6,0));
    if(c.kind==='deluge')target=p.pos.clone().add(V(c.dir.z*5,-c.dir.x*5));
    if(c.kind==='wave')target=c.origin.clone().add(V(Math.sin(c.gapAngle)*13,Math.cos(c.gapAngle)*13));
   }
   if(c.kind==='storm')target=c.safe.clone();
   else if(c.kind==='fault')target=p.pos.clone().addScaledVector(c.dir,5);
   else if(c.kind==='prism')target=c.origin.clone().addScaledVector(c.dir.clone().applyAxisAngle(UP,Math.PI/6),13);
   else if(c.kind==='fan')target=p.pos.clone().add(V(c.dir.z*1.45,-c.dir.x*1.45));
   else if(c.kind==='cleave')target=p.pos.clone().addScaledVector(c.dir,4.2);
   else if(c.kind==='charge'||c.kind==='roots')target=p.pos.clone().add(V(c.dir.z*4.2,-c.dir.x*4.2));
  }}
  if(dodging&&c&&g.time>=react){const d=target.clone().sub(p.pos),length=d.length();if(length)p.pos.addScaledVector(d,Math.min(6.6*dt,length)/length);if(c.kind==='nova'){const arrival=p.pos.distanceTo(c.origin)/c.radius*c.active;if(c.t>=c.windup+arrival-.2&&c.t<=c.windup+arrival+.2)p.invuln=.3;}}
  if(type==='stag')stagUpdate(e,dt);else if(type==='angler')harborUpdate(e,dt,p.pos.distanceTo(e.pos));else saltUpdate(e,dt,p.pos.distanceTo(e.pos));
  for(let i=g.projectiles.length-1;i>=0;i--){const s=g.projectiles[i];s.life-=dt;s.pos.addScaledVector(s.vel,dt);if(s.pos.distanceTo(p.pos.clone().setY(s.pos.y))<s.r+p.radius){s.onHit?.(p,s.pos);s.life=0;}if(s.life<=0){s.mesh.removeFromParent();g.projectiles.splice(i,1);}}
  healthMinimum=Math.min(healthMinimum,p.hp/p.maxHp);
 }
 return{type,phase,gear,potions,highregen,mode:dodging?'dodge':'stand',seconds:+g.time.toFixed(2),remaining:Math.round(p.hp/p.maxHp*100)+'%',minHealth:Math.round(healthMinimum*100)+'%',hits,heavy,potionsUsed:(potions?6:0)-p.potions.hp,counters};
}
const still=run('saltqueen',3,false,'rare',true,true),moving=run('saltqueen',3,true,'rare',true,true),armoured=run('saltqueen',3,false,'legendary',true,true);
assert(still.seconds<50,'an ordinary build cannot sustain the final phase by standing still');
assert(moving.seconds>=60&&moving.potionsUsed===0,'reacting to telegraphs has a large survival and resource advantage');
assert(armoured.seconds>still.seconds,'good equipment still buys a meaningful survival margin');
assert(armoured.potionsUsed>=3,'high-end gear cannot passively erase the boss rotation');
console.log(`Actual Salt Queen final-phase timeline: rare stationary ${still.seconds}s, moving ${moving.seconds}s/${moving.potionsUsed} potions; legendary stationary ${armoured.seconds}s/${armoured.potionsUsed} potions.`);

for(const phase of [1,3]){
 const standing=run('angler',phase,false,'rare',true,true),moving=run('angler',phase,true,'rare',true,true),armoured=run('angler',phase,false,'legendary',true,true);
 console.log('Angler timeline',JSON.stringify({standing,moving,armoured}));
 assert(moving.seconds>=60,'reacting to fish telegraphs is survivable');
 assert(moving.potionsUsed<standing.potionsUsed||moving.hits<standing.hits/2,'movement meaningfully reduces recovery cost');
 assert(standing.potionsUsed>=2||standing.seconds<60,'rare gear must not erase fish mechanics');
 assert(armoured.seconds>=standing.seconds,'better gear preserves survival value');
}

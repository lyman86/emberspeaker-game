import assert from 'node:assert/strict';
import * as THREE from 'three';
import {stagUpdate,stagPoise,inSector,inLane,bossDamage} from '../src/game/stag.js';
import {ENEMY_TYPES} from '../src/game/enemy.js';
import {Player} from '../src/game/player.js';
import {CLASSES} from '../src/game/classes.js';
import {makeItem,BASES} from '../src/game/items.js';
const V=(x=0,z=0)=>new THREE.Vector3(x,0,z),noop=()=>{};
function fixture(index=0,phase=1){
  const effects=[],hits=[],scene=new THREE.Scene(),mat=new THREE.MeshStandardMaterial();
  const player={alive:true,pos:V(0,5),hp:1000,maxHp:1000,invuln:0,buffs:{},hurt(d){this.hp-=d;hits.push({ally:false,d});}};
  const ally={alive:true,pos:V(0,5),hp:1000,hurt(d){this.hp-=d;hits.push({ally:true,d});}};
  const g={time:0,cinematic:false,low:true,player,allies:[ally],enemies:[],ui:{toast:noop,number:noop},audio:{play:noop},particles:{emit:noop},gfx:{scene,addShake:noop},materials:{get:()=>mat},
    fx:{add(fn,dispose){effects.push({fn,dispose});}},level:{blocked:()=>false,displacement:(a,b)=>b.clone(),move(p,x,z){p.x+=x;p.z+=z;}},spawnEnemy(type,x,z,opts){g.enemies.push({type,alive:true,tag:opts.tag,pos:V(x,z)});}};
  const e={game:g,T:ENEMY_TYPES.stag,type:'stag',alive:true,asleep:false,hp:11500,maxHp:11500,radius:1.2,phase,slow:0,pos:V(),home:V(),facing:0,play:noop,face(x,z){this.facing=Math.atan2(x-this.pos.x,z-this.pos.z);},locomote:noop,_walk:noop,
    stag:{phase,index,rest:0,cast:null,poise:0,exposed:0}};
  if(phase===2)e.hp=5750;if(phase===3)e.hp=2300;g.enemies=[e];
  const step=(seconds)=>{for(let t=0;t<seconds-.0001;t+=.025){g.time+=.025;stagUpdate(e,.025);for(let i=effects.length-1;i>=0;i--)if(!effects[i].fn(.025)){effects[i].dispose?.();effects.splice(i,1);}}};
  const clear=()=>{e.alive=false;for(const f of effects)f.dispose?.();effects.length=0;assert.equal(scene.children.filter(o=>o.userData.stagFx).length,0);mat.dispose();};
  return {g,e,player,ally,hits,effects,step,clear};
}
assert(inSector(V(),V(0,1),V(0,5),6.5,Math.PI*.9));assert(!inSector(V(),V(0,1),V(0,-5),6.5,Math.PI*.9));assert(!inSector(V(),V(0,1),V(7,0),6.5,Math.PI*.9));
assert(inLane(V(),V(0,1),V(1,10),19,3.8));assert(!inLane(V(),V(0,1),V(2,10),19,3.8));
// Captured telegraphs do not track a hero after warning. No damage before the cue fills.
{const f=fixture();f.step(.85);assert.equal(f.hits.length,0);f.player.pos.set(0,0,-5);f.ally.pos.copy(f.player.pos);f.step(.65);assert.equal(f.hits.length,0);f.clear();}
{const f=fixture();f.step(1.1);assert.equal(f.hits.filter(h=>!h.ally).length,1);assert.equal(f.hits[0].d,62);assert(f.hits.find(h=>h.ally).d<62);f.step(.4);assert.equal(f.hits.length,2);f.clear();}
// Charge endpoint and hit lane share the collision-clipped length.
{const f=fixture(1);f.g.level.displacement=(a,b)=>V(0,10);f.player.pos.set(0,0,17);f.ally.pos.copy(f.player.pos);f.step(1.7);assert.equal(f.e.stag.cast.length,10);assert(f.e.pos.z<=10);assert.equal(f.hits.length,0);f.clear();}
// Phase-three wave is an isolated move; a timed invulnerable dash crosses it safely.
{const f=fixture(3,3);f.player.pos.set(0,0,10);f.ally.pos.copy(f.player.pos);f.step(.1);f.player.pos.set(10,0,0);f.ally.pos.copy(f.player.pos);f.step(1.95);f.player.invuln=1;f.step(.3);f.player.invuln=0;f.step(.8);assert.equal(f.hits.filter(h=>!h.ally).length,0);assert(f.hits.some(h=>h.ally));assert.equal(f.e.stag.cast.kind,'nova');f.clear();}
// Root chant can be broken by saved control skills; it opens a real recovery window.
{const f=fixture(0,2);f.step(.1);assert.equal(f.e.stag.cast.kind,'roots');stagPoise(f.e,.6);stagPoise(f.e,.6);assert.equal(f.e.stag.cast,null);assert(f.e.stag.exposed>0);f.step(2);assert.equal(f.hits.length,0);f.clear();}
// Slow affects pursuit, never changes the warning / damage clock midway through a cast.
{const f=fixture();f.e.slow=4;f.step(1.1);assert.equal(f.hits.filter(h=>!h.ally).length,1);f.clear();}
{const f=fixture();f.g.cinematic=true;f.step(2);assert.equal(f.e.stag.cast,null);assert.equal(f.hits.length,0);f.clear();}
// Property-based boss matchups and plague healing, applied only once.
{const f=fixture();f.e.stag.exposed=0;assert.equal(bossDamage(f.e,100,{pal:'steel'},f.g),85);assert.equal(bossDamage(f.e,100,{pal:'poison'},f.g),65);assert.equal(bossDamage(f.e,100,{pal:'fire'},f.g),115);assert.equal(bossDamage(f.e,100,{pal:'steel'},f.g),100);f.e.stag.exposed=1;assert.equal(bossDamage(f.e,100,{pal:'steel'},f.g),125);f.player.plagueStacks=3;bossDamage(f.e,100,{pal:'holy'},f.g);assert.equal(f.player.plagueStacks,2);bossDamage(f.e,100,{pal:'holy'},f.g);assert.equal(f.player.plagueStacks,2);f.clear();}
for(const [cls,C]of Object.entries(CLASSES)){
 const p=Object.assign(Object.create(Player.prototype),{cls,C,level:9,buffs:{},equip:{},game:{time:0,ui:{number:noop}},alive:true,pos:V()});
 for(const base of C.start){const item=makeItem(base,{ilvl:9,rarity:'common'});p.equip[BASES[base].slot]=item;}p.recalc();assert(p.maxHp>250&&p.maxHp<650);assert(p.dmgMul>1);p.hp=0;p.plagueStacks=3;p.plagueUntil=10;p.heal(100,true);assert.equal(p.hp,64,cls+' plague recovery');p.game.time=11;p.hp=0;p.heal(100,true);assert.equal(p.hp,100);
}
console.log('Stag warning geometry, dodge timing, clipped charge, summon damage, control break, property matchups and level-nine recovery passed.');

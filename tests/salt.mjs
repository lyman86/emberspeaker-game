import {BOSS_SOUNDS} from '../src/game/boss-sounds.js';
import assert from 'node:assert/strict';
import * as T from 'three';
import {SaltCampaign} from '../src/game/salt-campaign.js';
import {saltUpdate,saltDamage,saltPoise,saltShielded} from '../src/game/salt.js';
import {ENEMY_TYPES,Enemy} from '../src/game/enemy.js';
import {LEGENDARIES,rollDrop} from '../src/game/items.js';
import {PROFILES} from '../src/game/models.js';
import {readFileSync} from 'node:fs';
const V=(x=0,z=0)=>new T.Vector3(x,0,z),noop=()=>{};
const b=readFileSync('public/assets/mx/'+PROFILES.saltqueen.file+'.glb'),j=JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12))),clips=new Set(j.animations.map(a=>a.name));
for(const spec of Object.values(PROFILES.saltqueen.map))assert(clips.has(Array.isArray(spec)?spec[0]:spec));
{
 const opened=[],loads=[];let xp=0,finish=0;
 const g={run:{mode:'story'},level:{id:'camp',def:{triggers:[]},emitters:[],openGate:id=>opened.push(id),center:(x,z)=>V(x*4+2,z*4+2)},player:{level:13,pos:V(),gainXp:n=>xp+=n},enemies:[],save:noop,finishRun:()=>finish++,ui:{say:async()=>{},toast:noop,prompt:noop,banner:noop,setQuest:noop},audio:{play:noop,setMood:noop},fx:{bolt:noop,ring:noop,pillar:noop},loadLevel:async id=>{loads.push(id);g.level.id=id;}};
 const c=new SaltCampaign(g);g.story=c;c.stage='done';
 await c.onTrigger('salt_road');assert.equal(loads.length,0);c.third.done=true;await c.onTrigger('salt_road');assert.equal(loads.at(-1),'saltflat');
 await c.onTrigger('tomb_entry');assert.equal(loads.at(-1),'saltflat');
 await c.onTrigger('mirror_west');const once=xp;await c.onTrigger('mirror_west');assert.equal(xp,once);assert.equal(c.fourth.mirrors.length,1);
 await c.onTrigger('mirror_east');assert(opened.includes('sun_gate'));await c.onTrigger('tomb_entry');assert.equal(loads.at(-1),'salttomb');
 await c.onTrigger('shelter_altar');assert(!c.fourth.shelter);await c.onKill({type:'saltseal',tag:'oasis_seal',T:{episode:4}});await c.onTrigger('shelter_altar');assert(c.fourth.shelter);
 await c.onTrigger('salt_blueprint');assert(!c.fourth.done);await c.onKill({tag:'saltpriest'});assert(opened.includes('tomb_seal'));assert(c.skipSpawn({tag:'saltpriest'}));
 await c.onKill({tag:'saltqueen'});assert(c.fourth.bossDead);g.run={mode:'chapter',chapter:4};await c.onTrigger('salt_blueprint');assert(c.fourth.done);assert.equal(finish,1);const end=xp;await c.onTrigger('salt_blueprint');assert.equal(xp,end);assert.equal(c.flags.tongues,undefined,'no fourth bell is awarded');
}
for(const [type,id] of [['saltpriest','priest_intro'],['saltqueen','queen_intro']]){
 let end,count=0;const e={type,alive:true,asleep:true},g={level:{id:'salttomb'},enemies:[e],ui:{say:()=>{count++;return new Promise(r=>end=r);},banner:noop},audio:{setMood:noop}};
 const c=new SaltCampaign(g),p=c.onTrigger(id);assert(e.asleep);await c.onTrigger(id);assert.equal(count,1);end();await p;assert(!e.asleep);
 let wake;const sleeping={type,T:ENEMY_TYPES[type],alive:true,asleep:true,hp:100,game:{story:{onTrigger:x=>wake=x}}};assert.equal(Enemy.prototype.takeDamage.call(sleeping,50),false);assert.equal(wake,id);assert.equal(sleeping.hp,100);
}
// Boss trials wait for the explicit ready action; chapter/story dialogue still runs normally.
{
 let talks=0;const e={type:'saltqueen',alive:true,asleep:true},g={run:{mode:'boss',chapter:4},bossReady:false,enemies:[e],level:{id:'salttomb'},audio:{setMood:noop},ui:{say:async()=>talks++,banner:noop}};
 const c=new SaltCampaign(g);await c.onTrigger('queen_intro');assert.equal(talks,0);assert(e.asleep);g.bossReady=true;await c.onTrigger('queen_intro');assert.equal(talks,1);assert(!e.asleep);
}
function fixture(phase=1,index=0,type='saltqueen'){
 const effects=[],hits=[],p={pos:V(84,58),radius:.6,alive:true,hp:4000,invuln:0,buffs:{},has:()=>false,hurt(d){hits.push(d);this.hp-=d;}};
 const g={player:p,allies:[],enemies:[],projectiles:[],low:true,cinematic:false,story:{fourth:{}},audio:{play:noop},ui:{toast:noop},smoke:{emit:noop},gfx:{scene:new T.Scene(),addShake:noop,flash:noop},fx:new Proxy({add(fn,dispose){effects.push({fn,dispose});}},{get:(o,k)=>o[k]??noop}),level:{center:(x,z)=>V(x*4+2,z*4+2),blocked:()=>false,nearestFree:(x,z)=>({x,z}),clear:()=>true},spawnEnemy(type,x,z,opts){const a={type,alive:true,pos:V(x,z),tag:opts.tag};g.enemies.push(a);return a;}};
 const e={type,T:ENEMY_TYPES[type],game:g,pos:V(86,42),home:V(86,42),hp:ENEMY_TYPES[type].hp*(phase===3?.25:phase===2?.5:1),maxHp:ENEMY_TYPES[type].hp,level:16,alive:true,asleep:false,play:noop,playTimed:noop,_walk:noop,locomote:noop,face:noop,salt:{phase,index,rest:0,exposed:0}};g.enemies=[e];
 const step=t=>{for(let now=0;now<t-.001;now+=.025){saltUpdate(e,.025,p.pos.distanceTo(e.pos));for(let i=effects.length-1;i>=0;i--)if(effects[i].fn(.025)===false){effects[i].dispose?.();effects.splice(i,1);}}};
 const clear=()=>{for(const p of g.projectiles){p.mesh.removeFromParent();p.mesh.traverse(o=>{o.geometry?.dispose();if(o.material)for(const m of [].concat(o.material))m.dispose();});}for(const effect of effects)effect.dispose?.();assert.equal(g.gfx.scene.children.length,0);};return {g,e,p,hits,step,clear};
}
{const f=fixture(1,1);f.step(.1);const c=f.e.salt.cast;assert.equal(c.kind,'fault');f.step(.9);assert.equal(f.hits.length,0);f.p.pos.copy(c.points[1]);f.step(.7);assert.equal(f.hits.length,1);f.step(.2);assert.equal(f.hits.length,1);f.clear();}
{const f=fixture(1,1);f.step(.1);f.p.pos.copy(f.e.salt.cast.points[1]).add(V(0,6));f.step(1.8);assert.equal(f.hits.length,0);f.clear();}
{const f=fixture(1,2);f.step(.1);const c=f.e.salt.cast;assert.equal(c.kind,'storm');assert(c.safe.distanceTo(f.p.pos)>=7,'storm shelter must require movement');f.p.pos.copy(c.safe);f.step(6);assert.equal(f.hits.length,0,'blue safe zone must protect through full storm');f.clear();}
for(const protectedBy of ['none','shelter','mantle']){const f=fixture(1,2);f.step(.1);f.p.pos.copy(f.e.salt.cast.safe).add(V(10,0));if(protectedBy==='shelter')f.g.story.fourth.shelter=true;if(protectedBy==='mantle')f.p.has=k=>k==='saltmantle';f.step(2.1);assert(f.hits.length>0);assert.equal(f.hits[0],70*(protectedBy==='shelter'?.75:protectedBy==='mantle'?.65:1));f.clear();}
{const f=fixture(2);f.e.salt.phase=1;f.step(.1);assert.equal(f.e.phase,2);assert(f.g.enemies.filter(e=>e.type==='saltseal').length<=2);assert(saltShielded(f.e));assert.equal(saltDamage(f.e,100,{pal:'steel'},f.g),65);for(const e of f.g.enemies)if(e.type==='saltseal')e.alive=false;f.step(.1);assert(f.e.salt.exposed>0);f.clear();}
{const f=fixture(2,0);f.step(.1);assert.equal(f.e.salt.cast.kind,'crown');saltPoise(f.e,.6);saltPoise(f.e,.6);assert.equal(f.e.salt.cast,null);assert(f.e.salt.exposed>0);f.step(1);assert.equal(f.hits.length,0);f.clear();}
{const f=fixture(3,0);f.step(.1);assert.equal(f.e.salt.cast.kind,'prism');const c=f.e.salt.cast,dir=c.dir.clone().applyAxisAngle(new T.Vector3(0,1,0),Math.PI/6);f.p.pos.copy(c.origin).addScaledVector(dir,16);f.step(2.8);assert.equal(f.hits.length,0,'six-ray gap is safe');f.clear();}
{const f=fixture();f.g.cinematic=true;f.step(3);assert.equal(f.e.salt.cast,undefined);assert.equal(f.hits.length,0);f.clear();}
for(const cls of ['mage','warrior','ranger','paladin','necro'])for(let i=0;i<20;i++){
 const it=rollDrop(cls,16,2,4),leg=LEGENDARIES.find(l=>l.id===it.legendary);assert.equal(leg.episode,4);
}
console.log('Fourth-chapter gates, optional shelter, repeat-safe blueprint, boss dialogue, cast footprints, storm safety/mitigation, capped crystals, control breaks, prism gaps and chapter loot passed.');

for(const [phase,index,kind] of [[1,0,'fan'],[1,1,'fault'],[1,2,'storm'],[2,0,'crown'],[3,0,'prism']]){const f=fixture(phase,index),sounds=[];f.g.audio.play=name=>sounds.push(name);f.step(.025);const cue=BOSS_SOUNDS[f.e.type][kind],c=f.e.salt.cast;assert(sounds.includes(cue[0]),kind+' warning');assert(!sounds.includes(cue[1]));f.step(c.windup-.05);assert(!sounds.includes(cue[1]),kind+' no early release');f.step(.1);assert.equal(sounds.filter(n=>n===cue[1]).length,1,kind+' release once');f.step(.05);assert.equal(sounds.filter(n=>n===cue[1]).length,1);f.clear();}

import assert from 'node:assert/strict';
import * as T from 'three';
import {readFileSync} from 'node:fs';
import {HarborCampaign} from '../src/game/harbor-campaign.js';
import {harborUpdate,harborDamage,harborPoise} from '../src/game/harbor.js';
import {Enemy,ENEMY_TYPES} from '../src/game/enemy.js';
import {LEGENDARIES,rollDrop} from '../src/game/items.js';
import {dressAngler} from '../src/game/angler-art.js';
import {recoveryFactor} from '../src/game/combat.js';
const noop=()=>{},V=(x=0,z=0)=>new T.Vector3(x,0,z);
{
 const gates=[],loads=[];let xp=0,finish=0,rings=0;
 const g={run:{mode:'story'},time:0,level:{id:'camp',def:{triggers:[]},emitters:[],openGate:id=>gates.push(id),center:(x,z)=>V(x*4+2,z*4+2)},player:{level:16,pos:V(),gainXp:n=>xp+=n},enemies:[],save:noop,finishRun:()=>finish++,ui:{say:async()=>{},toast:noop,prompt:noop,banner:noop,setQuest:noop},audio:{play:noop,setMood:noop},fx:{pillar:noop},loadLevel:async id=>{loads.push(id);g.level.id=id;}};
 const c=new HarborCampaign(g);g.story=c;c.stage='done';c.counterRing=async(name,count)=>{rings++;assert.equal(count,4);};
 await c.onTrigger('harbor_road');assert.equal(loads.length,0);c.fourth.done=true;await c.onTrigger('harbor_road');assert.equal(loads.at(-1),'harbor');
 await c.onTrigger('wreck_entry');assert.equal(loads.at(-1),'harbor');
 await c.onTrigger('beacon_west');const once=xp;await c.onTrigger('beacon_west');assert.equal(xp,once);await c.onTrigger('beacon_east');assert(gates.includes('dock_chain'));
 await c.onTrigger('tide_ward');assert(!c.fifth.ward);await c.onKill({tag:'harbor_ward'});await c.onTrigger('tide_ward');assert(c.fifth.ward);
 await c.onKill({tag:'hookcaptain'});assert(c.skipSpawn({tag:'hookcaptain'}));await c.onTrigger('wreck_entry');assert.equal(loads.at(-1),'wreck');
 for(const tag of ['chain_west','chain_west','chain_east'])await c.onKill({tag,pos:V()});assert.equal(c.fifth.chains.length,2);assert(gates.includes('tide_chain'));
 await c.onTrigger('tide_bell');assert(!c.fifth.done);await c.onKill({tag:'angler'});g.run={mode:'chapter',chapter:5};await c.onTrigger('tide_bell');assert(c.fifth.done);assert.equal(c.flags.tongues,4);assert.equal(finish,1);const end=xp;await c.onTrigger('tide_bell');assert.equal(xp,end);assert.equal(rings,1);
 g.run={mode:'boss'};await c.onKill({type:'angler'});assert.equal(finish,2,'boss challenge ends on kill without story ritual');
}
for(const [type,id,map]of [['angler','angler_intro','wreck'],['hookcaptain','captain_intro','harbor']]){
 let end,talks=0;const e={type,alive:true,asleep:true},g={run:{mode:'boss'},bossReady:false,enemies:[e],level:{id:map},ui:{say:()=>{talks++;return new Promise(r=>end=r);},banner:noop},audio:{setMood:noop}};
 const c=new HarborCampaign(g);if(type==='angler'){await c.onTrigger(id);assert.equal(talks,0);}g.bossReady=true;const pending=c.onTrigger(id);await c.onTrigger(id);assert.equal(talks,1);assert(e.asleep);end();await pending;assert(!e.asleep);
 let wake;const sleeping={type,T:ENEMY_TYPES[type],alive:true,asleep:true,hp:100,game:{story:{onTrigger:x=>wake=x}}};assert.equal(Enemy.prototype.takeDamage.call(sleeping,50),false);assert.equal(wake,id);assert.equal(sleeping.hp,100);
}
function fixture(phase=1,index=0,type='angler'){
 const effects=[],hits=[],p={pos:V(86,55),radius:.6,alive:true,hp:10000,invuln:0,buffs:{},has:()=>false,hurt(d,from,attack){hits.push({d,attack});this.hp-=d;},gainRes:noop};
 const g={time:0,player:p,allies:[],enemies:[],low:true,cinematic:false,story:{fifth:{}},audio:{play:noop},ui:{toast:noop},smoke:{emit:noop},gfx:{scene:new T.Scene(),addShake:noop},fx:new Proxy({add(fn,dispose){effects.push({fn,dispose});}},{get:(o,k)=>o[k]??noop}),level:{center:(x,z)=>V(x*4+2,z*4+2),blocked:()=>false,nearestFree:(x,z)=>({x,z}),clear:()=>true,displacement:(_,to)=>to.clone()},spawnEnemy(type,x,z,opts){const a={type,alive:true,pos:V(x,z),tag:opts.tag};g.enemies.push(a);return a;}};
 const e={type,T:ENEMY_TYPES[type],game:g,pos:V(86,42),home:V(86,42),hp:ENEMY_TYPES[type].hp*(phase===3?.25:phase===2?.5:1),maxHp:ENEMY_TYPES[type].hp,level:18,alive:true,asleep:false,play:noop,playTimed:noop,_walk:noop,locomote:noop,face:noop,radius:2.3,harbor:{phase,index,rest:0,exposed:0}};g.enemies=[e];
 const step=t=>{for(let now=0;now<t-.001;now+=.025){g.time+=.025;harborUpdate(e,.025,p.pos.distanceTo(e.pos));for(let i=effects.length-1;i>=0;i--)if(effects[i].fn(.025)===false){effects[i].dispose?.();effects.splice(i,1);}}};
 const clear=()=>{for(const effect of effects)effect.dispose?.();assert.equal(g.gfx.scene.children.length,0);};return {g,e,p,hits,step,clear};
}
{const f=fixture();f.step(.1);assert.equal(f.e.harbor.cast.kind,'hook');f.step(1);assert.equal(f.hits.length,0);f.step(.5);assert.equal(f.hits.length,1);assert.equal(f.p.pos.z,51);f.clear();}
{const f=fixture();f.step(.1);f.p.pos.x+=6;f.step(1.6);assert.equal(f.hits.length,0);f.clear();}
{const f=fixture();f.g.level.displacement=(from,to)=>from.clone();f.step(1.6);assert.equal(f.p.pos.z,55,'hook pull obeys collision sweep');f.clear();}
{const f=fixture(1,1);f.p.pos.z=48;f.step(.1);assert.equal(f.e.harbor.cast.kind,'bite');f.p.pos.x+=9;f.step(1.4);assert.equal(f.hits.length,0,'bite side is safe');f.clear();}
for(const phase of [1,3]){const f=fixture(phase,phase===1?3:0);f.step(.1);assert.equal(f.e.harbor.cast.kind,'wave');f.step(phase===1?3.6:4.5);assert.equal(f.hits.length,phase===1?1:2,'each traveling wave hits a hero once');assert(f.hits.every(h=>h.attack.kind==='heavy'));f.clear();}
{const f=fixture(3);f.step(.1);const c=f.e.harbor.cast;f.p.pos.copy(c.origin).add(V(Math.sin(c.gapAngle)*13,Math.cos(c.gapAngle)*13));f.step(4.5);assert.equal(f.hits.length,0,'cyan angular opening protects through both waves');f.clear();}
{const f=fixture(3);f.p.invuln=10;f.step(4.5);assert.equal(f.hits.length,0,'displacement immunity avoids wave damage');f.clear();}
for(const protection of ['none','ward','boots','both']){const f=fixture(2);f.g.story.fifth.ward=['ward','both'].includes(protection);f.p.has=k=>k==='tideboots'&&['boots','both'].includes(protection);f.step(5.9);assert(f.hits.length>=4&&f.hits.length<=5,'flood uses one shared .95 second tick');const scale=(f.g.story.fifth.ward?.8:1)*(f.p.has('tideboots')?.75:1);assert.equal(f.hits[0].d,55*scale);assert.equal(f.hits[0].attack.scale,scale);f.clear();}
{const f=fixture(1,2);f.step(.1);assert.equal(f.e.harbor.cast.kind,'lure');harborDamage(f.e,2000,{quiet:true},f.g);harborDamage(f.e,2000,{ally:true},f.g);assert(f.e.harbor.cast,'passive damage cannot automatically break the lamp');harborPoise(f.e,.6);assert(f.e.harbor.cast);harborDamage(f.e,500,{pal:'bolt'},f.g);assert.equal(f.e.harbor.cast,null);assert(f.e.harbor.exposed>0);f.step(2);assert.equal(f.hits.length,0);f.clear();}
{const f=fixture(2);f.e.harbor.phase=1;f.step(.1);assert.equal(f.g.enemies.filter(e=>e.tag==='summon').length,2);f.e.hp=f.e.maxHp*.2;f.step(.1);assert.equal(f.g.enemies.filter(e=>e.tag==='summon').length,2);f.clear();}
{const f=fixture();f.g.cinematic=true;f.step(4);assert.equal(f.e.harbor.cast,undefined);f.clear();}
{const f=fixture();assert.equal(harborDamage(f.e,100,{pal:'bolt'},f.g),98);assert.equal(harborDamage(f.e,100,{pal:'fire'},f.g),77);f.e.harbor.exposed=3;assert.equal(harborDamage(f.e,100,{pal:'steel'},f.g),125);f.clear();}
{const p={game:{time:2},drenched:3,drenchedUntil:5,woundUntil:5};assert.equal(recoveryFactor(p),.64,'recovery debuffs use the strongest effect, not multiplication');p.game.time=6;assert.equal(recoveryFactor(p),1);}
for(const cls of ['mage','warrior','ranger','paladin','necro'])for(let i=0;i<12;i++){const it=rollDrop(cls,18,2,5);assert.equal(LEGENDARIES.find(l=>l.id===it.legendary).episode,5);}
// Bone-independent fish anatomy stays bounded and releases only owned GPU resources.
{
 const normal=new T.Texture();let borrowedDisposed=false;normal.addEventListener('dispose',()=>borrowedDisposed=true);
 const e={root:new T.Group(),model:new T.Group(),game:{low:true,materials:{tex:{rock_surface:{nor:normal}}}},alive:true,harbor:{phase:3}};const art=dressAngler(e);
 for(let i=0;i<400;i++)art.update(.025);e.root.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(art.root),size=bounds.getSize(new T.Vector3());assert(size.toArray().every(n=>Number.isFinite(n)&&n>0&&n<8));
 let draws=0,tris=0,disposed=0;const geos=new Set(),mats=new Set();art.root.traverse(o=>{if(!o.isMesh)return;draws++;tris+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;geos.add(o.geometry);mats.add(o.material);if(o.position.y===4.65)assert(o.scale.x<.4,'lamp animation preserves authored bulb proportions');});assert(draws<=24&&tris<23000);
 for(const geo of geos)geo.addEventListener('dispose',()=>disposed++);art.dispose();art.dispose();art.update(.1);assert.equal(disposed,geos.size);assert(!borrowedDisposed);assert(e.model.visible);
}
console.log('Fifth-chapter gates, save-safe rituals, ready/dialogue guards, telegraph hit caps and gaps, collision-safe pulls, mitigation, active lamp breaks, summon caps, chapter loot and fish GPU lifetime passed.');

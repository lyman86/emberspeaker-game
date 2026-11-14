import assert from 'node:assert/strict';
import * as T from 'three';
import {IronCampaign} from '../src/game/iron-campaign.js';
import {ironUpdate,ironPoise,ironDamage,hasStandard} from '../src/game/iron.js';
import {ENEMY_TYPES,Enemy} from '../src/game/enemy.js';
import {LEGENDARIES,rollDrop} from '../src/game/items.js';
import {PROFILES} from '../src/game/models.js';
import {readFileSync} from 'node:fs';
const V=(x=0,z=0)=>new T.Vector3(x,0,z),noop=()=>{};
const anim=readFileSync('public/assets/mx/anims.glb');const json=JSON.parse(anim.toString('utf8',20,20+anim.readUInt32LE(12))),clips=new Set(json.animations.map(a=>a.name));
for(const id of ['rebel','raider','berserker','arbalist','assassin','captain','blackknight','ironking'])for(const clip of Object.values(PROFILES[id].map))assert(clips.has(Array.isArray(clip)?clip[0]:clip),id+' clip '+clip);
// Full chapter gates, optional artillery objective, legacy entry and repeat-safe rewards.
{
 let xp=0,says=0,opened=[],loads=[];const g={level:{id:'camp',def:{triggers:[]},openGate:id=>opened.push(id),emitters:[]},player:{level:10,pos:V(),gainXp:n=>xp+=n},enemies:[],save:noop,ui:{say:async()=>says++,toast:noop,prompt:noop,banner:noop,setQuest:noop,openShop:noop},audio:{play:noop,setMood:noop},loadLevel:async id=>{loads.push(id);g.level.id=id;}};
 const c=new IronCampaign(g);g.story=c;c.stage='done';c.flags={counter1:true,ep2:{done:false,totems:[]}};
 await c.onTrigger('iron_road');assert.deepEqual(loads,[]);c.second.done=true;await c.onTrigger('iron_road');assert.equal(loads.at(-1),'pass');assert(c.third.started);
 await c.onTrigger('fortress_entry');assert.equal(loads.at(-1),'pass');
 await c.onTrigger('side_winch');assert(opened.includes('camp_gate'));const before=xp;await c.onTrigger('side_winch');assert.equal(xp,before);
 await c.onKill({tag:'pass_ballista'});await c.onKill({tag:'pass_ballista'});assert.equal(xp,before+140);assert(c.third.ballista);
 await c.onKill({tag:'orders'});assert(c.third.orders);assert(opened.includes('fortress_gate'));await c.onTrigger('fortress_entry');assert.equal(loads.at(-1),'fortress');
 await c.onKill({tag:'blackknight'});assert(opened.includes('keep_seal'));assert(c.skipSpawn({tag:'blackknight'}));
 await c.onTrigger('iron_bell');assert(!c.third.done);await c.onKill({tag:'ironking'});assert(c.third.bossDead);assert(!c.third.done);
 c.counterRing=async()=>{};await c.onTrigger('iron_bell');assert(c.third.done);assert.equal(c.flags.tongues,3);const end=xp;await c.onTrigger('iron_bell');assert.equal(xp,end);
 g.level.id='camp';assert.match(c.guidance().label,/第三集/);assert(c.skipSpawn({tag:'pass_ballista'}));
}
// Dialogue must finish before either chief can attack; ranged opening reuses the same gate.
for(const [type,trigger]of [['blackknight','knight_intro'],['ironking','king_intro']]){
 let finish,count=0;const e={type,alive:true,asleep:true},g={enemies:[e],level:{id:'fortress'},ui:{say:()=>{count++;return new Promise(r=>finish=r);},banner:noop},audio:{setMood:noop}};
 const c=new IronCampaign(g),pending=c.onTrigger(trigger);assert(e.asleep);await c.onTrigger(trigger);assert.equal(count,1);finish();await pending;assert(!e.asleep);
 let wake;const sleeper={type,T:ENEMY_TYPES[type],alive:true,asleep:true,hp:100,game:{story:{onTrigger:id=>wake=id}}};assert.equal(Enemy.prototype.takeDamage.call(sleeper,30),false);assert.equal(wake,trigger);assert.equal(sleeper.hp,100);
}
function fixture(type='ironking',phase=1,index=0){
 const hits=[],effects=[],shots=[];const player={alive:true,hp:2000,invuln:0,buffs:{},pos:V(0,5),has:()=>false,hurt(d){hits.push(d);this.hp-=d;}};
 const g={player,allies:[],enemies:[],cinematic:false,low:true,story:{third:{}},level:{blocked:()=>false,clear:()=>true,displacement:(a,b)=>b.clone(),nearestFree:(x,z)=>V(x,z),move(p,x,z){p.x+=x;p.z+=z;}},ui:{toast:noop},audio:{play:noop},gfx:{scene:new T.Scene(),addShake:noop},fx:{add(fn,dispose){effects.push({fn,dispose});},spark:noop,pillar:noop,ground:noop},spawnEnemy(type,x,z,opts){const a={type,alive:true,pos:V(x,z),tag:opts.tag};g.enemies.push(a);return a;}};
 const e={type,T:ENEMY_TYPES[type],game:g,alive:true,asleep:false,hp:ENEMY_TYPES[type].hp*(phase===3?.25:phase===2?.5:1),maxHp:ENEMY_TYPES[type].hp,pos:V(),home:V(),radius:1,facing:0,slow:0,play:noop,playTimed:noop,_walk:noop,locomote:noop,face:noop,_fire:(d,dir)=>shots.push({d,dir}),iron:{phase,index,rest:0,exposed:0}};g.enemies=[e];
 const step=sec=>{for(let t=0;t<sec-.0001;t+=.025){ironUpdate(e,.025,player.pos.distanceTo(e.pos));for(let i=effects.length-1;i>=0;i--)if(effects[i].fn(.025)===false){effects[i].dispose?.();effects.splice(i,1);}}};
 const clear=()=>{effects.forEach(f=>f.dispose?.());assert.equal(g.gfx.scene.children.length,0);};return {g,e,player,hits,shots,step,clear};
}
{const f=fixture();f.step(.2);assert.equal(f.e.iron.cast.kind,'guard');assert.equal(ironDamage(f.e,100,{from:V(0,5),pal:'steel'},f.g),35);assert.equal(ironDamage(f.e,100,{from:V(0,-5),pal:'steel'},f.g),100);ironPoise(f.e,.6);ironPoise(f.e,.6);assert.equal(f.e.iron.cast,null);assert(f.e.iron.exposed>0);f.step(2);assert.equal(f.hits.length,0);f.clear();}
{const f=fixture('ironking',1,1);f.step(.8);assert.equal(f.hits.length,0);f.player.pos.set(0,0,-5);f.step(.6);assert.equal(f.hits.length,0);f.clear();}
{const f=fixture('ironking',1,1);f.step(1.2);assert.equal(f.hits.length,1);f.step(.3);assert.equal(f.hits.length,1);f.clear();}
{const f=fixture('ironking',1,2);f.g.level.displacement=()=>V(0,8);f.player.pos.set(0,0,20);f.step(2);assert(f.e.pos.z<=8);assert.equal(f.hits.length,0);f.clear();}
{const f=fixture('ironking',3);f.player.pos.set(0,0,20);f.step(.1);assert.equal(f.e.iron.cast.kind,'verdict');f.player.pos.set(4,0,20);f.step(2);assert.equal(f.hits.length,0,'fire-line gap must be safe');f.clear();}
{const f=fixture('ironking',3);f.player.pos.set(0,0,20);f.step(2);assert.equal(f.hits.length,1,'fire-line hits once per cast');f.clear();}
for(const broken of [false,true]){const f=fixture('ironking',1,3);f.g.story.third.ballista=broken;f.step(1.6);assert.equal(f.shots.length,broken?3:5);f.clear();}
{const f=fixture();f.e.hp=f.e.maxHp*.5;f.step(.1);assert.equal(f.e.phase,2);assert.equal(f.g.enemies.filter(e=>e.type==='warbanner').length,1);assert(hasStandard(f.e));assert.equal(ironDamage(f.e,100,{pal:'dark'},f.g),80);f.g.enemies[1].alive=false;assert.equal(ironDamage(f.e,100,{pal:'dark'},f.g),100);f.e.hp=f.e.maxHp*.25;f.step(2);assert(f.g.enemies.filter(e=>e.alive&&e.type==='warbanner').length<=2);f.clear();}
{const f=fixture();f.g.cinematic=true;f.step(2);assert.equal(f.e.iron.cast,undefined);assert.equal(f.hits.length,0);f.clear();}
for(const cls of ['mage','warrior','ranger','paladin','necro'])for(const ep of [1,2,3])for(let i=0;i<30;i++){
 const it=rollDrop(cls,10,2,ep);assert.equal(it.rarity,'legendary');const leg=LEGENDARIES.find(l=>l.id===it.legendary);assert.equal(leg.episode??1,ep,'boss guaranteed chapter equipment');
}
console.log('Third-chapter gates, optional artillery, save compatibility, dialogue guards, real animation clips, shield/flank/control, fire gaps, capped flags and chapter loot passed.');

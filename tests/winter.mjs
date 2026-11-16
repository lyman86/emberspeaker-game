import assert from 'node:assert/strict';
import * as T from 'three';
import {WinterCampaign} from '../src/game/winter-campaign.js';
import {winterUpdate,winterPoise,winterDamage,updateWinterWeather} from '../src/game/winter.js';
import {winterCastFx,iceBurst} from '../src/game/winter-vfx.js';
import {Fx} from '../src/game/fx.js';
import {ENEMY_TYPES,Enemy} from '../src/game/enemy.js';
import {makeApexItem,rollDrop,shopStock,canEquip,APEX_DROP_RATES,AFFIXES,LEGENDARIES,BASES} from '../src/game/items.js';
import {equipmentDamage,equipmentOnHit} from '../src/game/equipment-effects.js';
import {Player} from '../src/game/player.js';
import {CLASSES} from '../src/game/classes.js';
import {incomingDamage,recoveryFactor} from '../src/game/combat.js';
import {LEVELS} from '../src/game/maps.js';
import {Level} from '../src/game/level.js';
import {levelResources} from '../src/game/resources.js';
import {GameAudio} from '../src/core/audio.js';
const noop=()=>{},V=(x=0,z=0)=>new T.Vector3(x,0,z);
{
 const gates=[],loads=[];let xp=0,finish=0;
 const g={run:{mode:'story'},time:0,level:{id:'camp',def:{triggers:[]},emitters:[],openGate:id=>gates.push(id),center:(x,z)=>V(x*4+2,z*4+2)},player:{level:18,pos:V(),gainXp:n=>xp+=n},enemies:[],save:noop,finishRun:()=>finish++,ui:{say:async()=>{},toast:noop,prompt:noop,banner:noop,setQuest:noop},audio:{play:noop,setMood:noop},fx:{pillar:noop},loadLevel:async id=>{loads.push(id);g.level.id=id;}};
 const c=new WinterCampaign(g);g.story=c;c.stage='done';await c.onTrigger('winter_road');assert.equal(loads.length,0);c.fifth.done=true;await c.onTrigger('winter_road');assert.equal(loads.at(-1),'frostpass');
 await c.onTrigger('monastery_entry');assert.equal(loads.at(-1),'frostpass');
 g.enemies=[{alive:true,pos:V()}];await c.onTrigger('fire_outpost');assert.equal(c.sixth.fires.length,0);g.enemies=[];
 for(const id of ['fire_outpost','fire_outpost','fire_ravine','fire_watch'])await c.onTrigger(id);assert.equal(c.sixth.fires.length,3);assert(gates.includes('winter_ascent'));assert.equal(xp,540);
 await c.onTrigger('winter_ward');assert(!c.sixth.ward);await c.onKill({tag:'winter_ward_guard'});await c.onTrigger('winter_ward');assert(c.sixth.ward);
 await c.onKill({tag:'frostgiant'});assert(c.skipSpawn({tag:'frostgiant'}));await c.onTrigger('monastery_entry');assert.equal(loads.at(-1),'monastery');
 for(const id of ['testament_west','testament_west','testament_east'])await c.onTrigger(id);assert.equal(c.sixth.pages.length,2);assert(gates.includes('winter_choir'));
 await c.onTrigger('winter_testament');assert(!c.sixth.done);await c.onKill({tag:'winterabbess'});g.run={mode:'chapter',chapter:6};await c.onTrigger('winter_testament');assert(c.sixth.done);assert.equal(c.flags.tongues,4);assert.equal(finish,1);const end=xp;await c.onTrigger('winter_testament');assert.equal(xp,end);assert.equal(xp,2180);
 g.run={mode:'boss'};await c.onKill({type:'winterabbess'});assert.equal(finish,2);
}
for(const [type,id,map]of [['winterabbess','abbess_intro','monastery'],['frostgiant','giant_intro','frostpass']]){
 let end,talks=0;const e={type,alive:true,asleep:true},g={run:{mode:'boss'},bossReady:false,enemies:[e],level:{id:map},ui:{say:()=>{talks++;return new Promise(r=>end=r);},banner:noop},audio:{setMood:noop}};const c=new WinterCampaign(g);
 if(type==='winterabbess'){await c.onTrigger(id);assert.equal(talks,0);}g.bossReady=true;const pending=c.onTrigger(id);await c.onTrigger(id);assert.equal(talks,1);assert(e.asleep);end();await pending;assert(!e.asleep);
 let wake;assert.equal(Enemy.prototype.takeDamage.call({type,T:ENEMY_TYPES[type],asleep:true,alive:true,game:{story:{onTrigger:id=>wake=id}}},999),false);assert.equal(wake,id);
}
function fixture(phase=1,index=0,type='winterabbess'){
 const hits=[],p={pos:V(0,10),alive:true,invuln:0,hp:1000,maxHp:1000,radius:.6,buffs:{},has:()=>false,hurt(d,from,attack){hits.push({d,attack});this.hp-=d;}};
 const g={low:true,time:0,cinematic:false,player:p,allies:[],enemies:[],story:{sixth:{}},audio:{play:noop},ui:{toast:noop},gfx:{scene:new T.Scene(),distortScene:new T.Scene(),addShake:noop,flash:noop},level:{nearestFree:(x,z)=>({x,z}),clear:()=>true,displacement:(_,to)=>to.clone()},spawnEnemy(type,x,z,o){const a={type,tag:o.tag,alive:true,pos:V(x,z)};g.enemies.push(a);}};g.fx=new Fx(g);g.fx.tex.magic2=new T.Texture();
 const e={game:g,type,T:ENEMY_TYPES[type],pos:V(),home:V(),alive:true,hp:ENEMY_TYPES[type].hp*(phase===3?.2:phase===2?.5:1),maxHp:ENEMY_TYPES[type].hp,level:20,radius:1.2,winter:{phase,index,rest:0,exposed:0},play:noop,playTimed:noop,face:noop,locomote:noop,_walk:noop};g.enemies=[e];
 return {g,e,p,hits,step(seconds){for(let t=0;t<seconds-1e-6;t+=.025){g.time+=.025;winterUpdate(e,.025,p.pos.distanceTo(e.pos));g.fx.update(.025);}},clear(){g.fx.clear();assert.equal(g.gfx.scene.children.length,0);}};
}
// Every attack honors its windup, snapshots phase, and lets an intended escape avoid damage.
for(const [phase,index,kind] of [[1,0,'cleave'],[1,1,'lances'],[1,2,'requiem'],[2,0,'procession'],[2,2,'whiteout']]){
 const f=fixture(phase,index);f.step(.025);const c=f.e.winter.cast;assert.equal(c.kind,kind);f.step(c.windup-.05);assert.equal(f.hits.length,0);
 if(kind==='requiem')f.p.pos.copy(c.origin);else if(kind==='whiteout')f.p.pos.copy(c.refuges[0]);else f.p.pos.copy(c.origin).add(V(32,0));f.step(c.active+.1);assert.equal(f.hits.length,0,kind+' safe area');f.clear();
}
{const f=fixture(1,1);f.step(.025);f.p.pos.set(0,0,12);f.step(2.1);assert.equal(f.hits.length,1,'overlapping lanes cannot multiply hits');assert.equal(f.hits[0].attack.scale,1.12);f.clear();}
{const f=fixture(1,2);f.step(.025);assert.equal(winterDamage(f.e,100,{pal:'fire'},f.g),Math.round(100*1.15*.9));winterDamage(f.e,f.e.maxHp*.02,{pal:'fire',quiet:true},f.g);assert(f.e.winter.cast,'DoT cannot auto-break');winterPoise(f.e,.6);assert(f.e.winter.cast);winterPoise(f.e,.5);assert.equal(f.e.winter.cast,null);assert.equal(f.e.winter.exposed,3.5);f.clear();}
{const f=fixture(1,1);f.step(.025);f.e.hp=f.e.maxHp*.2;f.step(2);assert.equal(f.hits[0].attack.scale,1.12);assert.equal(f.g.enemies.filter(e=>e.tag==='summon').length,2);f.step(4);assert.equal(f.g.enemies.filter(e=>e.tag==='summon').length,2);f.clear();}
{const f=fixture(2,2);f.g.story.sixth.ward=true;f.step(.025);f.p.pos.set(0,0,14);f.step(4);assert(f.hits.length>0);assert(Math.abs(f.hits[0].attack.scale-1.18*.8)<1e-8);f.clear();}
{const f=fixture(1,0,'frostgiant');f.p.pos.set(0,0,6);f.step(.025);f.step(1.5);assert(f.hits.length>0);f.clear();}
// Weather only harms outdoors during the authored gust; warmth and cinematics protect the player.
{const f=fixture();f.g.level.id='frostpass';f.g.level.winterWeather={t:21,tick:0,warned:true};f.p.hurt=d=>f.hits.push(d);updateWinterWeather(f.g,.1);assert.equal(f.hits.length,1);f.g.level.warmth=[{x:0,z:10,r:7,active:true}];updateWinterWeather(f.g,1);assert.equal(f.hits.length,1);assert.equal(f.p.chillStacks,0);f.g.cinematic=true;updateWinterWeather(f.g,3);assert.equal(f.hits.length,1);f.clear();}
// Real effect lifetimes and finite geometry, for both mobile and desktop budgets.
for(const low of [true,false]){const f=fixture(3,0);f.g.low=low;f.step(.025);iceBurst(f.g,V(),6);f.step(3);f.g.gfx.scene.traverse(o=>{if(o.geometry)for(const a of Object.values(o.geometry.attributes))assert(a.array.every(Number.isFinite));if(o.instanceMatrix)assert(o.instanceMatrix.array.every(Number.isFinite));});f.clear();}
const random=Math.random;let seed=615;Math.random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
for(const cls of Object.keys(CLASSES)){
 for(let i=0;i<80;i++){const it=rollDrop(cls,20,2,6);assert(!it.apex);assert.equal(LEGENDARIES.find(l=>l.id===it.legendary).episode,6);assert.equal(new Set(it.affixes.map(a=>a.k)).size,it.affixes.length);}
 const apex=makeApexItem(cls,20);assert(apex.apex&&canEquip(cls,apex));assert.equal(apex.ilvl,22);assert.equal(apex.affixes.length,4);assert.equal(new Set(apex.affixes.map(a=>a.k)).size,4);assert.equal(makeApexItem(cls,30).ilvl,30);
 const stock=shopStock(cls,20);assert(stock.some(it=>it.base==='channelrobe'));assert(!stock.some(it=>it.apex));assert(!shopStock(cls,10).some(it=>BASES[it.base].minLevel));
 const p=Object.assign(Object.create(Player.prototype),{cls,C:CLASSES[cls],level:20,equip:{weapon:apex},buffs:{},game:{ui:{refreshStats:noop}},hp:1,maxHp:1});p.recalc();const heavy=incomingDamage(170,p,{kind:'heavy',level:20,scale:1.24});assert(heavy/p.maxHp>.2&&heavy/p.maxHp<.5,'apex never erases boss mechanics');
 let procs=0,res=0,healing=0;const g={time:0,player:{cls,pos:V(),maxHp:1000,shield:0,stats:{eliteDmg:200,exposedDmg:200},has:f=>f==='apex'+cls,gainRes:n=>res+=n,heal:n=>healing+=n,showShield:noop},fx:{spark:noop},ui:{number:noop}},e={alive:true,pos:V(),T:{boss:true},maxHp:1000,winter:{exposed:1},takeDamage:n=>{procs++;assert(n<=15);}};
 assert.equal(equipmentDamage(g,e,100),144);equipmentOnHit(g,e,1000,{quiet:true});equipmentOnHit(g,e,1000,{ally:true});assert.equal(procs,0);equipmentOnHit(g,e,1000,{});equipmentOnHit(g,e,1000,{});assert.equal(procs,1);g.time=8;equipmentOnHit(g,e,1000,{});assert.equal(procs,2);if(cls==='warrior')assert(g.player.shield<=60);if(cls==='mage'||cls==='necro')assert.equal(res,16);if(cls==='paladin')assert.equal(healing,60);
}
for(const quality of [0,1,2]){Math.random=()=>0;assert(rollDrop('mage',20,quality,6,{apexEligible:true}).apex);assert(!rollDrop('mage',20,quality,5,{apexEligible:true}).apex);assert(!rollDrop('mage',20,quality,6).apex);let first=true;Math.random=()=>{if(first){first=false;return APEX_DROP_RATES[quality];}return .5;};assert(!rollDrop('mage',20,quality,6,{apexEligible:true}).apex);}
Math.random=random;
// The active map plan includes exactly the new borrowed rigs and warm/cold materials.
for(const id of ['frostpass','monastery']){const plan=levelResources(LEVELS[id](),'mage');assert(plan.materials.includes('snow'));assert(!plan.models.includes('mx:boss'));}
{const a=new GameAudio(),calls=[];a.ctx={};a._applyLoops=noop;a.setMood=m=>a.mood=m;a.manifest={sfx:{w_ice:{files:['episode6/ice.wav']}},amb:{amb_blizzard:{file:'episode6/wind.wav'},amb_wind:{file:'wind.mp3'}},music:{}};a.loadOverrides=async()=>{a.loops??={};a.pending??=new Map();return a.manifest;};a._file=async f=>{calls.push(f);return {};};await a.prepare('winter',6);assert(a.overrides.w_ice);assert(a.loops.amb_blizzard);await a.prepare('salt',4);assert(!a.overrides.w_ice);assert(!a.loops.amb_blizzard);}
console.log('Sixth-chapter fire/page/key progression, save-safe ending, ready/dialogue ordering, all five cast escapes, hit caps, phase snapshots, channel breaks, warmth, VFX cleanup, level gates, class apex bounds/procs/drop exclusions and chapter audio isolation passed.');
// Run the actual boss brain and Player.hurt/recovery for a minute, including travel at base speed.
function winterMinute(phase,dodge,high){
 const f=fixture(phase),p=Object.assign(Object.create(Player.prototype),{game:f.g,cls:'mage',level:20,pos:V(0,13),alive:true,invuln:0,radius:.6,maxHp:high?1180:960,hp:high?1180:960,dr:high?.45:.32,buffs:{},flags:new Set(),shield:0,stats:{regen:high?26:17,lifeHit:high?22:14},potions:{hp:6,mp:0},mp:100,maxMp:100,potionCd:0,flash:noop,play:noop,showShield:noop});
 f.g.player=p;f.g.ui.number=noop;f.g.ui.hurtFlash=noop;f.g.particles={emit:noop};f.g.save=noop;f.g.onPlayerDeath=noop;let cast,target,react=0,nextHeal=0,damage=0;const hurt=p.hurt.bind(p);p.hurt=(d,from,attack)=>{const hp=p.hp;hurt(d,from,attack);damage+=hp-p.hp;};
 f.e._walk=(x,z,dt,speed)=>{const d=V(x-f.e.pos.x,z-f.e.pos.z),len=d.length();if(len)f.e.pos.addScaledVector(d,Math.min(len,speed*dt)/len);};
 for(f.g.time=0;f.g.time<60&&p.alive;f.g.time+=.025){const dt=.025;p.invuln=Math.max(0,p.invuln-dt);p.potionCd=Math.max(0,(p.potionCd??0)-dt);p.hp=Math.min(p.maxHp,p.hp+p.stats.regen*.35*dt*recoveryFactor(p));if(f.g.time>=nextHeal){nextHeal=f.g.time+.4;p.onHit(false);}if(p.hp<p.maxHp*.52&&p.potions.hp)p.usePotion('hp');
  const c=f.e.winter.cast;if(c&&c!==cast){cast=c;react=f.g.time+.25;const side=V(c.dir.z,-c.dir.x);if(c.kind==='cleave')target=c.origin.clone().addScaledVector(side,8);if(c.kind==='lances')target=c.origin.clone().addScaledVector(c.dir,13).addScaledVector(side,3.5);if(c.kind==='requiem')target=c.origin.clone();if(c.kind==='procession'){const a=Math.atan2(c.dir.x,c.dir.z)+Math.PI/6;target=c.origin.clone().add(V(Math.sin(a)*12,Math.cos(a)*12));}if(c.kind==='whiteout')target=[...c.refuges].sort((a,b)=>a.distanceTo(p.pos)-b.distanceTo(p.pos))[0].clone();}
  if(dodge&&target&&cast&&f.g.time>=react){const d=target.clone().sub(p.pos),len=d.length();if(len)p.pos.addScaledVector(d,Math.min(len,6.6*dt)/len);}
  winterUpdate(f.e,dt,p.pos.distanceTo(f.e.pos));f.g.fx.update(dt);
 }
 const result={phase,high,dodge,seconds:+f.g.time.toFixed(2),potions:6-p.potions.hp,hp:Math.round(p.hp/p.maxHp*100),damage:Math.round(damage)};f.clear();return result;
}
for(const phase of [1,2,3]){const still=winterMinute(phase,false,false),moving=winterMinute(phase,true,false),armoured=winterMinute(phase,false,true);console.log('Winter timeline',JSON.stringify({still,moving,armoured}));assert(moving.seconds>=60,'telegraph-aware movement survives a full minute');assert(moving.damage<still.damage*.65,'moving saves substantial health');assert(still.potions>=2||still.seconds<60,'stationary recovery cannot bypass frost mechanics');assert(armoured.seconds>=still.seconds,'better equipment retains value');}
// Authored bind-pose costumes follow shipped joints and release only owned resources.
const {readFileSync}=await import('node:fs'),{dressWinterEnemy}=await import('../src/game/winter-enemies-art.js');
for(const [type,file] of [['frostthrall','warrior'],['snowraider','bram'],['icemaiden','vera'],['frostmonk','mage'],['winterabbess','vera']]){
 const b=readFileSync('public/assets/mx/'+file+'.glb'),j=JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12))),joints=new Set(j.skins.flatMap(s=>s.joints)),nodes=j.nodes.map((n,i)=>{const o=joints.has(i)?new T.Bone():new T.Group();o.name=n.name??'';if(n.matrix)o.applyMatrix4(new T.Matrix4().fromArray(n.matrix));else{if(n.translation)o.position.fromArray(n.translation);if(n.rotation)o.quaternion.fromArray(n.rotation);if(n.scale)o.scale.fromArray(n.scale);}return o;});j.nodes.forEach((n,i)=>n.children?.forEach(k=>nodes[i].add(nodes[k])));const source=new T.Group();j.scenes[j.scene??0].nodes.forEach(i=>source.add(nodes[i]));source.updateMatrixWorld(true);
 const normal=new T.Texture();let borrowed=0;normal.addEventListener('dispose',()=>borrowed++);const e={type,root:new T.Group(),model:source.clone(true),mats:[],game:{low:true,assets:{gltf:new Map([['mx:'+file,{scene:source}]])},materials:{tex:{rock_surface:{nor:normal}}}},winter:{phase:1}};e.root.add(e.model);dressWinterEnemy(e);
 for(const phase of [1,2,3])for(const kind of ['cleave','lances','requiem','procession','whiteout']){e.winter={phase,cast:{kind,t:0,windup:2}};for(let i=0;i<60;i++){e.winter.cast.t+=.05;e.winterArtUpdate(.05);e.model.updateMatrixWorld(true);e.model.traverse(o=>assert(o.matrixWorld.elements.every(Number.isFinite)));}}
 let draws=0,triangles=0,released=0;const geos=new Set();e.model.traverse(o=>{if(!o.isMesh)return;draws++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;geos.add(o.geometry);for(const a of Object.values(o.geometry.attributes))assert(a.array.every(Number.isFinite));});assert(draws<35&&triangles<35000);const size=new T.Box3().setFromObject(e.model).getSize(new T.Vector3());assert(size.toArray().every(n=>n>0&&n<4));for(const geo of geos)geo.addEventListener('dispose',()=>released++);e.winterArtDispose();e.winterArtDispose();assert.equal(released,geos.size);assert.equal(borrowed,0);
}
console.log('Frost humanoid costumes: shipped bind-pose bounds, phase/cast transforms, draw budgets and borrowed texture lifetime passed.');
// Mandatory fire/page interactions are reachable before their lock opens, including physical prop footprints.
for(const [id,targets,gate]of [['frostpass',['fire_outpost','fire_ravine','fire_watch'],'winter_ascent'],['monastery',['testament_west','testament_east'],'winter_choir']]){
 const mat=new T.MeshStandardMaterial(),g={low:true,player:{pos:V()},assets:{gltf:{values:()=>[]},parts:()=>[],prop:()=>new T.Group(),bounds:()=>new T.Box3(V(-.1),V(.1))},materials:{cache:{mat},tex:{rock_surface:{nor:null}},get:()=>mat},audio:{play:noop},gfx:{addShake:noop},smoke:{emit:noop}},lv=new Level(g,LEVELS[id]());g.level=lv;const start=lv.center(lv.def.start.x,lv.def.start.z);
 for(const name of targets){const t=lv.def.triggers.find(t=>t.id===name),at=lv.center(t.x,t.z),path=lv.findPath(start.x,start.z,at.x,at.z);assert(path.length,name+' approach path');assert(path.at(-1)&&Math.hypot(path.at(-1).x-at.x,path.at(-1).z-at.z)<t.r,name+' inside interaction radius');}
 const locked=lv.gates[gate];assert(lv.solid(locked.x,locked.z));lv.openGate(gate);for(let i=0;i<70;i++)lv.update(.025);assert(!lv.solid(locked.x,locked.z));lv.dispose();
}

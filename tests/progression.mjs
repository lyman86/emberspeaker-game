import assert from 'node:assert/strict';
import { MAX_LEVEL, XP_TABLE, earnedPoints, spentPoints, freeRank, canUpgradeSlot, HOTBAR_ORDER, requiredLevel, enhanceCost, enhance, enhancedStats, salePrice } from '../src/game/progression.js';
import { CLASS_SKILLS } from '../src/game/skills.js';
import { Player } from '../src/game/player.js';
import { LEVELS } from '../src/game/maps.js';
import { ENEMY_TYPES } from '../src/game/enemy.js';
import { PROFILES } from '../src/game/models.js';
import { existsSync } from 'node:fs';
assert.equal(MAX_LEVEL,30);assert.equal(XP_TABLE.length,30);
assert(XP_TABLE.every((x,i)=>!i||x>XP_TABLE[i-1]));
assert.equal(earnedPoints(1),0);assert.equal(earnedPoints(10),10);assert.equal(earnedPoints(20),21);assert.equal(earnedPoints(30),32);
for(const list of Object.values(CLASS_SKILLS)){
  assert.equal(list.length,7);assert.deepEqual(list.map(s=>s.unlock),[1,1,2,4,6,1,10]);
  assert.equal(spentPoints(list,Object.fromEntries(list.map(s=>[s.id,5]))),20);
  for(const s of list){assert.equal(s.rankDescriptions.length,canUpgradeSlot(s.slot)?5:1);if(canUpgradeSlot(s.slot))assert.equal(requiredLevel(s,5),s.unlock+12);}
}
const it={ilvl:10,price:100,rarity:'rare',dmg:[10,20],armor:10,affixes:[{k:'str',v:10}]};
const wallet={gold:5000,materials:{iron:12,soul:7,star:1}};
for(let n=1;n<=3;n++){assert(enhance(it,wallet));assert.equal(it.stars,n);}
assert.equal(enhanceCost(it),null);assert(!enhance(it,wallet));assert.deepEqual(wallet.materials,{iron:0,soul:0,star:0});
assert.equal(enhancedStats(it).affixes[0].v,13);assert.deepEqual(it.dmg,[10,20]);assert.equal(salePrice(it),53);
const poor={gold:0,materials:{}};const fresh={...it,stars:0};assert(!enhance(fresh,poor));assert.equal(fresh.stars,0);
const skills=CLASS_SKILLS.mage;
const hero=Object.create(Player.prototype);Object.assign(hero,{skills,equip:{},game:{ui:{buildSkills(){}},save(){}},C:{res:{start:1}},recalc(){this.maxHp=100;this.maxMp=100;},refreshGear(){}});
hero.fromSave({level:7,xp:1500,gold:23,potions:{hp:2,mp:1},bag:[],equip:{}});
assert(hero.xpProgress()>=0);assert.equal(hero.skillPoints,6);assert.equal(hero.rank(skills[0]),1);assert.equal(hero.rank(skills[5]),1);assert.equal(hero.rank(skills[1]),1);assert.equal(hero.bag.length,40);
const saved=hero.toSave();hero.fromSave(saved);assert.equal(hero.skillPoints,6);assert.equal(hero.gold,23);
// Previously upgraded basic attacks/movement refund their cost and stay fixed.
hero.fromSave({...saved,skillRanks:{firebolt:5,fireball:4,blink:3,nova:2}});
assert.equal(hero.rank(skills[0]),1);assert.equal(hero.rank(skills[1]),1);assert.equal(hero.rank(skills[5]),1);
assert.equal(hero.skillPoints,4);assert(!hero.learnSkill('fireball'));assert(!hero.learnSkill('blink'));
assert(!hero.learnSkill('nova'),'rank three needs level eight');hero.level=8;assert(hero.learnSkill('nova'));assert.equal(hero.skillPoints,4);assert.equal(hero.rank(skills[2]),3);
assert(!hero.learnSkill('nova'),'rank four level requirement must be enforced');
assert.deepEqual(HOTBAR_ORDER,[0,1,2,3,4,6,5]);
for(const list of Object.values(CLASS_SKILLS))assert.deepEqual(list.filter(s=>canUpgradeSlot(s.slot)).map(s=>s.key),['Q','W','E','R']);
const {ULTIMATE_GLYPHS}=await import('../src/game/ultimate-art.js');
assert.equal(new Set(Object.values(ULTIMATE_GLYPHS)).size,5);
assert.equal(new Set(Object.values(CLASS_SKILLS).map(s=>s[6].icon)).size,5);
// Every spawned enemy and profile references a real local model.
for(const [id,factory] of Object.entries(LEVELS)){
  const d=factory().def;
  for(const e of d.spawns){assert(ENEMY_TYPES[e.type],e.type);assert(d.g[e.z]?.[e.x]!== '#',id+JSON.stringify(e));}
  for(const p of Object.values(PROFILES))assert(existsSync('public/assets/mx/'+p.file+'.glb'),p.file);
  // Grid reachability with gates opened: every mandatory NPC, chest and trigger is connected.
  const visited=new Set([d.start.x+','+d.start.z]),q=[d.start];
  for(let i=0;i<q.length;i++)for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){
    const x=q[i].x+dx,z=q[i].z+dz,k=x+','+z;
    if(x<0||z<0||x>=d.w||z>=d.h||d.g[z][x]==='#'||visited.has(k))continue;visited.add(k);q.push({x,z});
  }
  for(const t of [...d.npcs,...d.triggers,...d.chests])assert(visited.has(t.x+','+t.z),`${id} unreachable ${t.id??'chest'} at ${t.x},${t.z}`);
}
console.log('Progression, upgrade transactions, legacy migration, skill budget, assets and map reachability passed.');

// Exercise delayed skill effects with real Three.js geometry and a minimal game loop.
const THREE=await import('three');
for(const [cls,skills] of Object.entries(CLASS_SKILLS)) for(const rank of [1,3,5]) for(const skill of skills){
  const effects=[],timers=[],damage=[];
  const enemy={pos:new THREE.Vector3(0,0,3),radius:0.6,scale:1,alive:true,freeze(){},slowFor(){}};
  const noop=()=>{};
  const game={time:0,enemies:[enemy],allies:[],projectiles:[],audio:{play:noop},ui:{number:noop},particles:{emit:noop},smoke:{emit:noop},materials:{tex:{dark_rock:{nor:null}}},
    gfx:{scene:new THREE.Scene(),flash:()=>new THREE.Object3D(),addShake:noop},hitStop:noop,
    fx:new Proxy({orb:()=>new THREE.Group(),add(fn,dispose){effects.push({fn,dispose});},tex:{},planeGeo:new THREE.PlaneGeometry(),sphereGeo:new THREE.SphereGeometry()}, {get:(o,k)=>k in o?o[k]:noop}),
    level:{clear:()=>true,displacement:(from,to)=>to.clone(),blocked:()=>false,move(pos,x,z){pos.x+=x;pos.z+=z;return true;}},
    after(t,fn){timers.push({t,fn});},enemiesNear:()=>[enemy],nearestEnemy:()=>enemy,corpses:()=>[{pos:new THREE.Vector3(),consume:noop}],
    hurtEnemy(e,d){assert(Number.isFinite(d.v??d),`${cls} ${skill.id} nonfinite damage`);damage.push(d.v??d);},
    spawnAlly(type){const a={alive:true,root:new THREE.Group(),maxHp:100,hp:100,expire(){this.alive=false;}};this.allies.push(a);return a;},
  };
  const p={alive:true,pos:new THREE.Vector3(),root:new THREE.Group(),facing:0,maxHp:500,hp:300,mp:100,maxMp:100,level:30,stats:{int:50},cds:{},invuln:0,
    rank:()=>rank,has:()=>false,roll:(a,b)=>({v:(a+b)/2,crit:false}),heal:noop,gainRes:noop,buff:noop,showShield:noop,
    castOrigin:()=>new THREE.Vector3(0,1,0),face:noop,stop:noop,play:noop,locomote:noop};
  game.player=p;
  try {
    skill.fire(game,p,new THREE.Vector3(0,0,5));
    // Drain timers and visual effects for a complete cast; projectiles impact once each.
    for(let frame=0;frame<200;frame++){
      game.time+=0.1;
      for(let i=timers.length-1;i>=0;i--){timers[i].t-=0.1;if(timers[i].t<=0){const t=timers.splice(i,1)[0];t.fn();}}
      for(let i=effects.length-1;i>=0;i--){if(!effects[i].fn(0.1)){effects[i].dispose?.();effects.splice(i,1);}}
      const projectiles=game.projectiles.splice(0);for(const shot of projectiles){shot.trail(0.1,shot);shot.onHit?.(enemy,enemy.pos.clone());}
    }
    assert.equal(game.gfx.scene.children.filter(o=>o.userData.ultimateFx).length,0,'ultimate visual groups must be released');
    if(skill.slot===6){if(cls==='necro')assert.equal(game.allies.length,rank>=3?9:7);else assert(damage.length>0);}
  }catch(error){throw new Error(`${cls} ${skill.id} rank ${rank}: ${error.message}`,{cause:error});}
}
console.log('All 35 skills exercised at ranks 1, 3 and 5, including delayed effects and ultimate summons.');
const {Campaign}=await import('../src/game/campaign.js');
const gates=[],quests=[];
const cg={player:{level:6,pos:new THREE.Vector3(),gainXp(){}},enemies:[],time:0,cinematic:false,
 ui:{say:async()=>{},toast(){},banner(){},prompt(){},setQuest(...q){quests.push(q);}},
 audio:{play(){},setMood(){}},gfx:{addShake(){}},fx:{pillar(){},ground(){}},save(){},
 level:{id:'forest',openGate:id=>gates.push(id),def:{triggers:[]},emitters:[]},
 async loadLevel(id){this.level.id=id;},};
const campaign=new Campaign(cg);campaign.stage='done';campaign.flags={bossDead:true,key:true,counter1:true};
await campaign.onTrigger('north_road');assert.equal(cg.level.id,'forest');
await campaign.onTrigger('root_gate');assert.equal(cg.level.id,'forest','locked root gate must not transition');
for(let i=0;i<3;i++)await campaign.onKill({tag:'totem_'+i});
await campaign.onKill({tag:'totem_0'});assert.equal(campaign.second.totems.length,3);assert(gates.includes('plague_fog'));
await campaign.onKill({tag:'butcher'});assert(campaign.second.butcher);await campaign.onTrigger('root_gate');assert.equal(cg.level.id,'swamp');
await campaign.onKill({tag:'stag'});await campaign.onTrigger('plague_bell');assert(campaign.second.done);assert.equal(campaign.flags.tongues,2);assert(!cg.cinematic);
console.log('Episode-two gated progression, duplicate totems, boss and counter-ringing completion passed.');
const {plagueUpdate}=await import('../src/game/encounters.js');
for(const ratio of [1,0.5,0.2]){
  const effects=[],timers=[],summons=[];
  const g={time:0,cinematic:false,player:{alive:true,pos:new THREE.Vector3(4,0,4),hurt(){}},enemies:[],
    level:{clear:()=>true,blocked:()=>false,move(p,x,z){p.x+=x;p.z+=z;}},ui:{toast(){}},audio:{play(){}},
    fx:new Proxy({add(fn){effects.push(fn);}}, {get:(o,k)=>k in o?o[k]:()=>{}}),
    after(t,fn){timers.push(fn);},spawnEnemy(type,x,z,opts){summons.push({type,x,z,opts});},corpses:()=>[]};
  const e={game:g,T:ENEMY_TYPES.stag,type:'stag',alive:true,asleep:false,frozen:0,stagger:0,hp:9500*ratio,maxHp:9500,phase:0,home:new THREE.Vector3(),pos:new THREE.Vector3(),specialCd:0,level:10,
    face(){},play(){},_walk(){},locomote(){},radius:1.2};
  assert(plagueUpdate(e,0.1,5));assert.equal(e.phase,ratio>0.6?1:ratio>0.3?2:3);
  for(const fn of timers)fn();for(const fn of effects)fn(0.1);
  if(ratio<=0.6)assert.equal(summons.length,3);
}
console.log('Stag phase transitions and capped summons passed.');
await import('./stag.mjs');

// Arena coverage, dialogue ordering and re-entry after respawn/read restore.
const {containsTrigger,Level,CELL}=await import('../src/game/level.js');
const {Episode1}=await import('../src/game/story.js');
for(const [map,trigger]of [['crypt','boss_intro'],['swamp','stag_intro']]){
  const t=LEVELS[map]().def.triggers.find(t=>t.id===trigger),[x0,z0,x1,z1]=t.bounds;
  for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++)assert(containsTrigger(t,{x:x*4+2,z:z*4+2}),`${map} arena side skipped`);
  assert(!containsTrigger(t,{x:t.x*4+2,z:(z1+1)*4+2}));
}
let finishIntro,dialogues=0;
const guardBoss={T:ENEMY_TYPES.boss,alive:true,asleep:true,pos:new THREE.Vector3(),state:'idle'};
const bg={enemies:[guardBoss],ui:{say(){dialogues++;return new Promise(r=>finishIntro=r);},setQuest(){},banner(){}},audio:{play(){},setMood(){}},gfx:{addShake(){}}};
const episode=new Episode1(bg);const pending=episode.onTrigger('boss_intro');
assert(guardBoss.asleep,'boss waits for dialogue');assert(!episode.flags.bossTalk,'incomplete conversation must replay on reload');
await episode.onTrigger('boss_intro');assert.equal(dialogues,1,'parallel trigger must not replace dialogue');finishIntro();await pending;
assert(!guardBoss.asleep);assert.equal(guardBoss.state,'chase');assert(episode.flags.bossTalk);
await episode.onTrigger('boss_intro');assert.equal(dialogues,1,'active encounter must not restart');
guardBoss.asleep=true;await episode.onTrigger('boss_intro');assert(!guardBoss.asleep,'respawn with watched conversation must awaken');
let wake;
const sleeping={alive:true,asleep:true,T:ENEMY_TYPES.boss,type:'boss',hp:3000,game:{story:{onTrigger:id=>wake=id}}};
const {Enemy}=await import('../src/game/enemy.js');assert.equal(Enemy.prototype.takeDamage.call(sleeping,200),false);assert.equal(wake,'boss_intro');assert.equal(sleeping.hp,3000);
// Guide targets stay reachable through the redesigned landscape and respect mandatory gates.
for(const id of ['camp','forest','swamp']){
  const spec=LEVELS[id](),d=spec.def,lv=Object.assign(Object.create(Level.prototype),{def:d,w:d.w,h:d.h,circles:[],solidGrid:Uint8Array.from(d.g.flat(),v=>v==='#'?1:0)});
  cg.level=lv;lv.id=id;cg.player.pos=lv.center(d.start.x,d.start.z);
  campaign.stage='done';campaign.flags={bossDead:true,counter1:true,ep2:{started:id!=='camp',totems:[]}};
  const target=campaign.guidance();assert(target);assert(lv.findPath(cg.player.pos.x,cg.player.pos.z,target.x,target.z).length>0,id+' guide blocked');
}
console.log('Boss arena coverage, dialogue ordering, ranged wake-up, retry and navigation regressions passed.');

await import('./collision.mjs');
const {stickDirection,TouchControls}=await import('../src/game/touch.js');
assert.equal(stickDirection(.03,.02),null);assert(stickDirection(1,0).x>0&&stickDirection(1,0).z<0);assert(stickDirection(0,1).x>0&&stickDirection(0,1).z>0);
let castSlot;
globalThis.innerWidth=844;globalThis.innerHeight=390;
const selected={alive:true,pos:new THREE.Vector3(4,0,0)},behindWall={alive:true,pos:new THREE.Vector3(1,0,0)};
const touch=Object.assign(Object.create(TouchControls.prototype),{g:{started:true,cinematic:false,paused:false,ui:{panelOpen:false,setTarget(){}},level:{clear:(x,z,bx)=>bx!==1},enemies:[behindWall,selected],player:{alive:true,pos:new THREE.Vector3(),facing:0,castSlot:(slot,point,enemy)=>castSlot={slot,point,enemy}}},target:null,stick:null});
assert.equal(touch.enemy(),selected,'auto target ignores an enemy behind a prop');touch.cast(6);assert.equal(castSlot.slot,6);assert.equal(castSlot.enemy,selected);touch.cast(5);assert.equal(castSlot.enemy,null,'movement follows facing rather than a hostile target');touch.g.cinematic=true;castSlot=null;touch.cast(0);assert.equal(castSlot,null,'touch input is blocked during dialogue');
innerWidth=390;innerHeight=844;assert(!touch.active(),'portrait pauses combat input');
console.log('Touch stick direction, targeting, skill dispatch and cinematic input guards passed.');

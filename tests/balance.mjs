import assert from 'node:assert/strict';
import * as T from 'three';
import {incomingDamage,damageGrowth,bossAttack,recoveryFactor} from '../src/game/combat.js';
import {Player} from '../src/game/player.js';
import {CLASSES} from '../src/game/classes.js';
import {makeItem} from '../src/game/items.js';
import {portalAvailable,TRANSITIONS} from '../src/game/portals.js';
import {createPortal} from '../src/game/portal-art.js';
const noop=()=>{},oldRandom=Math.random;let seed=19;Math.random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
const results=[];
for(const cls of Object.keys(CLASSES))for(const level of [6,10,13,16,18]){
 const tiers=[];
 for(const [rarity,stars] of [['rare',0],['legendary',3]]){
  const p=Object.create(Player.prototype);Object.assign(p,{cls,C:CLASSES[cls],level,equip:{},buffs:{},game:{ui:{refreshStats:noop}},hp:1,maxHp:1});
  for(const base of [...p.C.start,'helm','gloves','boots','amulet','ring']){const it=makeItem(base,{ilvl:level,rarity});it.stars=stars;p.equip[it.slot]=it;}
  p.recalc();p.hp=p.maxHp;tiers.push(p);
  const normal=incomingDamage(80,p),heavy=incomingDamage(80,p,{kind:'heavy',level}),hazard=incomingDamage(18,p,{kind:'hazard',level});
  assert(heavy/p.maxHp>=.18&&heavy/p.maxHp<=.4,`${cls} Lv.${level} major attacks are meaningful but never a one-shot`);
  assert(hazard<heavy);assert.equal(normal,80*(1-p.dr));assert(incomingDamage(80,p,{kind:'heavy',level:1})<heavy||level===6);
  // Budget check: same equipment, six telegraphed majors vs dodging four of them.
  assert(p.maxHp-heavy*6<0);assert(p.maxHp-heavy*2>0);
  results.push([cls,level,rarity,Math.round(p.maxHp),Math.round(heavy/p.maxHp*100)]);
 }
 const p=tiers[0],before={damage:p.dmgMul,dr:p.dr,hp:p.maxHp};for(const it of Object.values(p.equip))it.stars=3;p.recalc();assert(p.dmgMul>before.damage);assert(p.dr>before.dr);assert(p.maxHp>=before.hp);
}
for(let raw=.1;raw<100;raw+=.1){assert(damageGrowth(raw+.01)>damageGrowth(raw));assert(damageGrowth(raw)<=raw+1e-8);}
Math.random=oldRandom;
{
 const p=Object.create(Player.prototype);let sounds=0;
 Object.assign(p,{alive:true,maxHp:1000,hp:100,maxMp:100,mp:0,potions:{hp:3,mp:3},stats:{lifeHit:300,crit:100,critDmg:50},dmgMul:1,buffs:{},game:{time:0,save:noop,ui:{number:noop,toast:noop},audio:{play:()=>sounds++},fx:{pillar:noop}},has:f=>f==='bloodring',pos:new T.Vector3()});
 p.roll(10,20);assert.equal(p.hp,100,'a critical roll is not a confirmed hit');
 p.onHit(true);const hp=p.hp;for(let i=0;i<100;i++)p.onHit(true);assert.equal(p.hp,hp,'AoE targets cannot multiply recovery');assert.equal(hp,135);
 p.usePotion('hp');assert.equal(p.potions.hp,2);assert.equal(p.potionCd,10);p.usePotion('mp');assert.equal(p.potions.mp,3,'both potion types share recharge');assert.equal(p.hp,535);
 p.potionCd=0;p.usePotion('mp');assert.equal(p.potions.mp,2);assert.equal(p.mp,60);
}
{
 const p=Object.create(Player.prototype),g={time:10,cinematic:false,ui:{number:noop,hurtFlash:noop},audio:{play:noop},gfx:{addShake:noop},particles:{emit:noop}};
 Object.assign(p,{game:g,alive:true,invuln:0,buffs:{},hp:1000,maxHp:1000,level:16,dr:.4,shield:0,has:()=>false,flash:noop,shieldHit:noop,pos:new T.Vector3()});
 p.hurt(80,p.pos,{kind:'heavy',level:16});assert(p.hp<800);assert.equal(p.woundUntil,15);const hp=p.hp;p.heal(100);assert.equal(p.hp-hp,65);
 p.plagueUntil=20;p.plagueStacks=3;assert.equal(recoveryFactor(p),.64,'wound and plague use strongest suppression, not a multiplicative penalty');
 p.woundUntil=0;p.plagueUntil=0;p.hp=1000;p.shield=1000;p.hurt(80,p.pos,{kind:'heavy',level:16});assert.equal(p.hp,1000);assert.equal(p.woundUntil,0,'a successful shield avoids the wound');
 p.shield=0;p.invuln=1;p.hurt(80,p.pos,{kind:'heavy',level:16});assert.equal(p.hp,1000,'dodge invulnerability remains effective');
 p.invuln=0;for(let i=0;i<3;i++)p.hurt(10,p.pos,{kind:'hazard',level:16,erosion:true});assert.equal(p.saltExposure,3);assert(incomingDamage(10,p,{kind:'hazard',level:16,erosion:true})>incomingDamage(10,p,{kind:'hazard',level:16}));assert(Math.abs(recoveryFactor(p)-.46)<1e-8);g.time+=4.1;assert.equal(recoveryFactor(p),1,'safe positioning lets the salt exposure wear off');
}

{
 const g={run:{mode:'story'},story:{stage:'graveyard',flags:{},second:{},third:{},fourth:{mirrors:[]}}};assert(portalAvailable(g,'crypt_door'));assert(!portalAvailable(g,'north_road'));assert(!portalAvailable(g,'root_gate'));assert(!portalAvailable(g,'iron_road'));assert(!portalAvailable(g,'salt_road'));g.story.stage='done';assert(portalAvailable(g,'north_road'));assert(!portalAvailable(g,'tomb_entry'));g.story.fourth.mirrors=['west','east'];assert(portalAvailable(g,'tomb_entry'));g.run.mode='chapter';assert(!portalAvailable(g,'north_road'));
 const p=createPortal({low:true},new T.Vector3());for(let i=0;i<100;i++)p.update(.016,true);let count=0;p.root.traverse(o=>{if(o.isMesh)count++});assert(count<=9);assert(new T.Box3().setFromObject(p.root).getSize(new T.Vector3()).toArray().every(Number.isFinite));p.dispose();p.dispose();assert(TRANSITIONS.root_gate);
}
console.log('All five classes × five boss levels × two gear tiers: six majors defeat a stationary hero, dodging four leaves a recoverable margin; recovery proc budgets, potion sharing and portal availability passed.');
// Exercise the actual shared minimap draw path for every authored map.
{
 const {Minimap}=await import('../src/game/minimap.js'),{LEVELS}=await import('../src/game/maps.js'),originalDocument=globalThis.document;
 let calls=0;const ctx={};for(const name of ['clearRect','fillRect','beginPath','arc','fill','moveTo','lineTo','closePath','save','translate','rotate','restore'])ctx[name]=(...args)=>{calls++;for(const v of args)if(typeof v==='number')assert(Number.isFinite(v),name+' finite map coordinates');};
 const canvas={getContext:()=>ctx},caption={};globalThis.document={createElement:()=>({querySelector:s=>s==='canvas'?canvas:caption})};
 try{for(const factory of Object.values(LEVELS)){const spec=factory(),d=spec.def,g={story:{stage:'done',flags:{},second:{},third:{},fourth:{}},run:{mode:'story'},player:{pos:new T.Vector3(d.start.x*4+2,0,d.start.z*4+2),facing:0},enemies:[],npcs:[],level:{spec,w:d.w,h:d.h,def:d,gates:Object.fromEntries(d.gates.map(x=>[x.id,x])),isFloor:(x,z)=>d.g[z][x]!=='#'}};const map=new Minimap(g,{appendChild:noop});map.update(1);assert(caption.textContent.length>0);}}
 finally{globalThis.document=originalDocument;}assert(calls>100);
}
console.log('Desktop/touch minimap draw commands use finite coordinates on all ten maps.');

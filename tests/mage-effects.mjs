import assert from 'node:assert/strict';
import * as T from 'three';
import { Fx } from '../src/game/fx.js';
import { CLASS_SKILLS } from '../src/game/skills.js';
import { levelResources } from '../src/game/resources.js';
import { Materials,PBR_SETS } from '../src/core/materials.js';
import { LEVELS } from '../src/game/maps.js';
const noop=()=>{},emitter={emit:noop};
// Exercise actual Fx callbacks, not the no-op visual proxy used by the broad skill tests.
for(const cls of Object.keys(CLASS_SKILLS)){
 const resources=levelResources(LEVELS.salttomb(),cls),materials=Object.create(Materials.prototype);Object.assign(materials,{cache:{},tex:Object.fromEntries(resources.materials.map(n=>[PBR_SETS[n].id,{diff:new T.Texture(),nor:new T.Texture(),arm:new T.Texture()}]))});
 const g={time:0,low:true,cinematic:false,materials,projectiles:[],allies:[],timers:[],audio:{play:noop},ui:{number:noop},particles:emitter,smoke:emitter,
 gfx:{scene:new T.Scene(),distortScene:new T.Scene(),camera:new T.PerspectiveCamera(),flash:()=>new T.Object3D(),addShake:noop},level:{blocked:()=>false,clear:()=>true,move:()=>true,displacement:(_,to)=>to.clone()},
 hitStop:noop,after(t,fn){this.timers.push({t,fn});},enemiesNear:()=>[enemy],nearestEnemy:()=>enemy,corpses:()=>[{pos:new T.Vector3(),consume:noop}],hurtEnemy:(e,d)=>{e.hp-=d.v??d;},spawnAlly(){return {root:new T.Group(),alive:true,maxHp:100,hp:100};}};
 const enemy={pos:new T.Vector3(0,0,3),radius:.7,scale:1,alive:true,hp:1e7,freeze:noop,slowFor:noop},p={alive:true,pos:new T.Vector3(),root:new T.Group(),facing:0,maxHp:500,hp:300,mp:100,maxMp:100,level:30,stats:{int:50},cds:{},invuln:0,rank:()=>5,has:()=>false,roll:(a,b)=>({v:(a+b)/2,crit:false}),heal:noop,gainRes:noop,buff:noop,showShield:noop,castOrigin:()=>new T.Vector3(0,1,0),face:noop,stop:noop,play:noop,locomote:noop};g.enemies=[enemy];g.player=p;g.fx=new Fx(g);g.fx.tex=Object.fromEntries(['ring','lightdisc','scorch','twirl','magic1','magic2','ring_soft'].map(n=>[n,new T.Texture()]));
 for(const slot of cls==='mage'?[1,2,4,6]:[6]){
  const before=enemy.hp;CLASS_SKILLS[cls][slot].fire(g,p,enemy.pos.clone());
  for(let frame=0;frame<800;frame++){
   const dt=.025;g.time+=dt;for(let i=g.timers.length-1;i>=0;i--){const timer=g.timers[i];timer.t-=dt;if(timer.t<=0){g.timers.splice(i,1);timer.fn();}}
   g.fx.update(dt);for(const shot of g.projectiles.splice(0)){shot.onHit?.(enemy,enemy.pos.clone());shot.mesh.removeFromParent();}
  }
  if(cls!=='necro')assert(enemy.hp<before,`${cls} slot ${slot} damage must reach targets`);
  assert.equal(g.fx.list.length,0,`${cls} slot ${slot} effects expire`);assert.equal(g.fx.debris.list.length,0);assert.equal(g.gfx.distortScene.children.length,0);
 }
 g.fx.clear();
}
console.log('Real salt-tomb Fx timelines, mage nova/meteor/ultimate damage and all class ultimates complete and release.');

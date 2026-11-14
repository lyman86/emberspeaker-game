import * as THREE from 'three';
import { stagUpdate } from './stag.js';
import { shoot } from './skills.js';
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
export function poisonPool(g,at,r=3,duration=5,damage=10) {
  const c=at.clone();let t=0,tick=0;
  g.fx.glyph(c,{tex:'lightdisc',color:[0.3,1.2,0.08],r,dur:duration,spin:0.3});
  g.fx.add(dt=>{if(g.cinematic)return true;t+=dt;tick+=dt;if(tick>=0.5){tick=0;if(g.player.pos.distanceTo(c)<r)g.player.hurt(damage,c);}return t<duration;});
}
function strike(e,c,r,delay,damage,kind='poison') {
  const g=e.game;
  g.fx.telegraph(c,r,delay,[1.6,0.3,0.1]);
  g.after(delay,()=>{if(!e.alive||e.asleep)return;g.audio.play(kind==='poison'?'e_poison':'e_hit',c,0.5);g.fx.explode(c,r,kind,kind==='steel'?0.35:0.65);if(g.player.pos.distanceTo(c)<r)g.player.hurt(damage,c);});
}
function leap(e,target,delay,radius,damage) {
  const g=e.game,start=e.pos.clone(),end=target.clone();
  e.actionLock=delay+0.6;e.face(target.x,target.z);e.play('leap',{once:true,restart:true,speed:0.85});
  strike(e,end,radius,delay,damage,'steel');
  g.after(delay-0.5,()=>{
    if(!e.alive||e.asleep)return;let t=0,previous=0;
    g.fx.add(dt=>{if(!e.alive||e.asleep){e.pos.y=0;return false;}if(g.cinematic)return true;t+=dt;const k=Math.min(1,t/0.5),step=k-previous;previous=k;
      g.level.move(e.pos,(end.x-start.x)*step,(end.z-start.z)*step,e.radius);e.pos.y=Math.sin(k*Math.PI)*(e.type==='stag'?4:2);
      if(k===1)e.pos.y=0;return k<1;});
  });
}
function summon(e,n=2) {
  const g=e.game;
  const count=g.enemies.filter(o=>o.alive&&o.tag==='summon').length;
  for(let i=0;i<Math.min(n,9-count);i++){
    const a=i*6.28/n,q=e.pos.clone().add(V(Math.sin(a)*4,0,Math.cos(a)*4));
    if(g.level.blocked(q.x,q.z,0.8))continue;
    g.spawnEnemy('goblin',q.x,q.z,{tag:'summon',level:e.level});g.fx.pillar(q,'poison',20,4);
  }
}
export function plagueUpdate(e,dt,dist) {
  const g=e.game,p=g.player,T=e.T;
  if(T.episode!==2||!e.alive||e.asleep||!p.alive||g.cinematic||e.frozen>0||e.stagger>0)return false;
  if(e.type==='stag')return stagUpdate(e,dt);
  if(e.type==='totem'){e.play('Idle');return true;}
  if(e.actionLock>0){e.actionLock-=dt;return true;}
  // Specials begin only after the enemy can see the hero; a witch across a closed gate stays quiet.
  const aware=e.type==='stag'||dist<25&&g.level.clear(e.pos.x,e.pos.z,p.pos.x,p.pos.z,0.3);
  if(!aware)return false;
  e.specialCd=(e.specialCd??4)-dt;
  if(e.type==='witch' && e.specialCd<=0 && dist<25){e.specialCd=10;summon(e,3);g.audio.play('e_witch',e.pos);e.actionLock=1.4;e.play('Spellcast_Summon',{once:true,restart:true});return true;}
  if(e.type==='werewolf' && e.hp/e.maxHp<0.3 && !e.enraged){e.enraged=true;e.tint=new THREE.Color(0.3,0.06,0.01);g.audio.play('e_wolf',e.pos);g.ui.toast('畸变狼人进入狂暴');}
  if(['goblin','werewolf','butcher'].includes(e.type) && e.specialCd<=0 && dist<20){
    e.specialCd=e.type==='butcher'?6:5;
    const c=p.pos.clone();
    if(e.type==='butcher'){
      e.actionLock=2.4;e.play('attack',{once:true,restart:true,speed:0.55});g.audio.play('e_butcher',e.pos);
      const start=e.pos.clone(),dir=c.clone().sub(start).setY(0).normalize();
      for(let i=1;i<=7;i++)g.fx.telegraph(start.clone().addScaledVector(dir,i*2),1.8,1,[1.6,0.25,0.1]);
      g.after(1,()=>{if(!e.alive)return;let t=0,hit=false;g.fx.add(d=>{t+=d;g.level.move(e.pos,dir.x*22*d,dir.z*22*d,e.radius);if(!hit&&e.pos.distanceTo(p.pos)<3){hit=true;p.hurt(58,e.pos);}return e.alive&&t<0.7;});});
      strike(e,c,6,2,48,'steel');
      if(e.hp/e.maxHp<0.4){const corpse=g.corpses().find(o=>o.pos.distanceTo(e.pos)<12);if(corpse){corpse.consume();e.hp=Math.min(e.maxHp,e.hp+e.maxHp*0.12);g.fx.pillar(e.pos,'blood',40,5);g.ui.toast('缝合屠夫吞食尸体恢复生命');}}
    } else {
      g.audio.play(e.type==='goblin'?'e_goblin':'e_wolf',e.pos);leap(e,c,0.9,e.type==='goblin'?2.2:3,e.type==='goblin'?26:38);
      if(e.type==='werewolf')for(let i=1;i<=2;i++)strike(e,c,3,0.9+i*0.25,22,'steel');
    }
    return true;
  }
  return false;
}
export function addStagCrown(e) {
  const mat=new THREE.MeshStandardMaterial({color:0x795c2f,roughness:0.85});
  const head=new THREE.Group();head.position.y=2.7;
  for(const side of [-1,1])for(let i=0;i<4;i++){
    const horn=new THREE.Mesh(new THREE.ConeGeometry(0.1,0.8+i*0.18,6),mat);horn.position.set(side*(0.3+i*0.19),i*0.1,0);horn.rotation.z=-side*(0.3+i*0.15);head.add(horn);
  }
  e.root.add(head);e.encounterArt=[head];e.encounterMaterials=[mat];
}

export function addTotem(e) {
  e.model.visible=false;
  const group=new THREE.Group(),wood=e.game.materials.get('bark'),bone=new THREE.MeshStandardMaterial({color:0xb4af8b,roughness:0.95}),dark=new THREE.MeshStandardMaterial({color:0x181e14,roughness:1}),glow=new THREE.MeshStandardMaterial({color:0x637e29,emissive:0x719c28,emissiveIntensity:1.3,roughness:0.6});
  const add=(geo,mat,x,y,z,s=[1,1,1])=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.scale.fromArray(s);m.castShadow=true;group.add(m);return m;};
  add(new THREE.CylinderGeometry(.13,.27,3.9,9),wood,0,1.95,0);
  for(let j=0;j<3;j++){
    const y=1.2+j*.88,turn=(j-1)*.18;
    const skull=new THREE.Group();skull.position.set(0,y,.1);skull.rotation.y=turn;group.add(skull);
    const part=(geo,mat,x,y,z,s)=>{const m=add(geo,mat,x,y,z,s);skull.add(m);return m;};
    part(new THREE.SphereGeometry(.31,14,10),bone,0,0,0,[1,.95,.78]);
    part(new THREE.BoxGeometry(.37,.18,.25),bone,0,-.24,.075,[1,1,1]);
    for(const side of [-1,1]){
      part(new THREE.SphereGeometry(.105,10,7),dark,side*.13,.015,.21,[1,.88,.33]);
      part(new THREE.SphereGeometry(.037,8,6),glow,side*.13,.015,.246,[1,1,.4]);
      const horn=part(new THREE.ConeGeometry(.075,.5,7),bone,side*.32,.24,-.05,[1,1,1]);horn.rotation.z=-side*.7;
    }
    part(new THREE.ConeGeometry(.055,.14,3),dark,0,-.1,.245,[1,1,.3]);
    for(let i=0;i<5;i++)part(new THREE.BoxGeometry(.04,.09,.07),bone,-.12+i*.06,-.28,.22,[1,1,1]);
  }
  for(const side of [-1,1]){
    const branch=add(new THREE.CylinderGeometry(.04,.075,1.4,6),wood,side*.5,3.1,0);branch.rotation.z=-side*.9;
    add(new THREE.SphereGeometry(.09,10,7),glow,side*.94,2.75,0);
  }
  e.root.add(group);e.encounterArt=[group];e.encounterMaterials=[bone,dark,glow];
}

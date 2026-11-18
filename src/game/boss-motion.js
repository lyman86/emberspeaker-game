import {Quaternion,Vector3} from 'three';
/** Small constrained secondary joints; deform skin rather than translating entire hair meshes. */
export function dressBossMotion(e){
 const joints=[];e.model.traverse(b=>{if(b.isBone&&/^(Hair|Mantle|Robe)/.test(b.name))joints.push({bone:b,x:0,v:0,delta:new Quaternion(),inverse:new Quaternion(),axis:new Vector3(1,0,0)});});
 let previous=e.pos?.clone(),angle=e.facing??0,time=0,disposed=false;
 e.secondaryMotion=dt=>{
  if(disposed||!Number.isFinite(dt)||dt<=0)return;
  dt=Math.min(dt,.05);time+=dt;
  const speed=previous&&e.pos?Math.min(7,previous.distanceTo(e.pos)/dt):0;
  if(previous&&e.pos)previous.copy(e.pos);
  const turn=Math.atan2(Math.sin((e.facing??0)-angle),Math.cos((e.facing??0)-angle));angle=e.facing??0;
  for(const j of joints){
   const hair=j.bone.name.startsWith('Hair'),end=j.bone.name.endsWith('1'),alive=e.alive!==false;
   const target=alive?Math.max(-.13,Math.min(.13,turn*(hair?-.4:-.18)+speed*(hair ? .009 : .004)+Math.sin(time*1.6+(end ? .7 : 0))*.008)):0;
   const steps=Math.max(1,Math.ceil(dt*120)),h=dt/steps;
   for(let n=0;n<steps;n++){j.v+=((target-j.x)*85-j.v*17)*h;j.x=Math.max(-.15,Math.min(.15,j.x+j.v*h));}
   j.delta.setFromAxisAngle(j.axis,j.x);j.bone.quaternion.multiply(j.delta);
  }
 };
 // Called before the mixer so unanimated/held bones cannot accumulate offsets.
 e.resetSecondaryMotion=()=>{for(const j of joints){j.inverse.copy(j.delta).invert();j.bone.quaternion.multiply(j.inverse);j.delta.identity();}};
 return ()=>{disposed=true;e.secondaryMotion=null;e.resetSecondaryMotion=null;};
}

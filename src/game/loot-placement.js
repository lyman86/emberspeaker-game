import {Vector3} from 'three';

/** Loot must fit the hero's footprint and be reachable from the current side of a gate. */
export function lootLanding(level,at,desired,hero){
 const radius=.75,from=hero?.pos??hero??at;
 const reachable=p=>!level.blocked(p.x,p.z,radius)&&(Math.hypot(p.x-from.x,p.z-from.z)<.15||level.findPath(from.x,from.z,p.x,p.z).length>0);
 if(reachable(desired))return new Vector3(desired.x,0,desired.z);
 const facing=Math.atan2(from.z-at.z,from.x-at.x);let searches=0;
 search:for(let r=1.8;r<=8;r+=.4)for(let i=0;i<24;i++){
  const a=facing+(i%2?1:-1)*Math.ceil(i/2)*Math.PI/12,p={x:at.x+Math.cos(a)*r,z:at.z+Math.sin(a)*r};
  if(level.blocked(p.x,p.z,radius))continue;
  if(reachable(p))return new Vector3(p.x,0,p.z);
  if(++searches>=32)break search;
 }
 // An isolated drop never disappears or falls back inside its source chest.
 const safe=level.nearestFree(from.x,from.z,radius)??from;
 return new Vector3(safe.x,0,safe.z);
}

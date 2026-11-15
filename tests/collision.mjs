import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as T from 'three';
import {Level} from '../src/game/level.js';
import {LEVELS} from '../src/game/maps.js';
const root='public/assets/';
function bounds(name){let file=name.startsWith('ph:')?'ph/'+name.slice(3)+'.glb':'props/'+name+'.glb';assert(fs.existsSync(root+file),'missing collision asset '+file);const b=fs.readFileSync(root+file);const j=JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12))),box=new T.Box3();const walk=(i,parent)=>{const n=j.nodes[i],m=n.matrix?new T.Matrix4().fromArray(n.matrix):new T.Matrix4().compose(new T.Vector3(...(n.translation??[0,0,0])),new T.Quaternion(...(n.rotation??[0,0,0,1])),new T.Vector3(...(n.scale??[1,1,1])));m.premultiply(parent);if(n.mesh!=null)for(const p of j.meshes[n.mesh].primitives){const a=j.accessors[p.attributes.POSITION];if(a.min&&a.max)box.union(new T.Box3(new T.Vector3(...a.min),new T.Vector3(...a.max)).applyMatrix4(m));}for(const c of n.children??[])walk(c,m);};for(const n of j.scenes[j.scene??0].nodes)walk(n,new T.Matrix4());return box;}
const cache=new Map(),mat=new T.MeshStandardMaterial();const A={parts:()=>[],prop:()=>new T.Group(),bounds(name){if(!cache.has(name))cache.set(name,bounds(name));return cache.get(name);},gltf:{values:()=>[],has:n=>fs.existsSync(root+'props/'+n+'.glb')}};
for(const [id,f]of Object.entries(LEVELS)){
 const g={assets:A,materials:{cache:{shared:mat},get:()=>mat,tex:{rock_surface:{nor:null}}},low:true,player:{pos:new T.Vector3()},gfx:{addShake(){}},audio:{play(){}}};
 const warn=console.warn;console.warn=()=>{};
 const lv=new Level(g,f()),d=lv.def;g.level=lv;
 for(const gate of Object.values(lv.gates)){const from=lv.center(gate.x,gate.z+1),to=lv.center(gate.x,gate.z-1);if(!lv.blocked(from.x,from.z,.6)&&!lv.blocked(to.x,to.z,.6)){assert(!lv.clear(from.x,from.z,to.x,to.z,.6),'closed gate must block sweep');const landing=lv.displacement(from,to,.6);assert(landing.distanceTo(to)>4,'displacement crossed gate');}lv.solidGrid[gate.z*lv.w+gate.x]=0;gate.open=true;}
 for(const n of d.npcs)lv.circles.push({x:n.x*4+2,z:n.z*4+2,r:.9});
 for(const c of d.chests)lv.circles.push({x:c.x*4+2,z:c.z*4+2,r:1.1});
 console.warn=warn;
 const start=lv.center(d.start.x,d.start.z),bad=[],overlap=[];
 for(const t of [...d.npcs,...d.chests,...d.triggers]){const x=t.x*4+2,z=t.z*4+2,path=lv.findPath(start.x,start.z,x,z);if(!path.length)bad.push(t.id??['chest',t.x,t.z]);}
 for(const s of d.spawns){const x=s.x*4+2,z=s.z*4+2,r=({elite:1,boss:.9,butcher:1.1,stag:1.2,werewolf:.6})[s.type]??.6;if(lv.blocked(x,z,r))overlap.push({type:s.type,x:s.x,z:s.z,free:lv.nearestFree(x,z,r)});}
 assert(!lv.blocked(start.x,start.z,.6),id+' blocked entry');assert.deepEqual(bad,[],id+' unreachable objective');assert.deepEqual(overlap,[],id+' spawn overlap');
 for(const b of lv.boxes.filter(b=>b.prop==='cabinet')){
  assert(lv.blocked(b.x,b.z,.6),id+' cabinet missing collision');
  for(const radius of [.6,1.2])for(let i=0;i<24;i++){
   const angle=i*Math.PI/12,dist=Math.hypot(b.hx,b.hz)+radius+1,from=new T.Vector3(b.x+Math.sin(angle)*dist,0,b.z+Math.cos(angle)*dist);
   if(lv.blocked(from.x,from.z,radius))continue;
   const target=new T.Vector3(b.x-Math.sin(angle)*dist,0,b.z-Math.cos(angle)*dist),landing=lv.displacement(from,target,radius);
   assert(!lv.blocked(landing.x,landing.z,radius));assert(lv.clear(from.x,from.z,landing.x,landing.z,radius));assert(landing.distanceTo(target)>radius,'displacement tunneled through cabinet');
   const p=from.clone();for(let frame=0;frame<30;frame++){lv.move(p,(target.x-p.x)*.25,(target.z-p.z)*.25,radius);assert(!lv.blocked(p.x,p.z,radius),'actor entered cabinet/wall');}
  }
  const legacy=new T.Vector3(b.x,0,b.z);lv.move(legacy,0,0,.6);assert(!lv.blocked(legacy.x,legacy.z,.6),'legacy overlap recovery');
 }
 lv.dispose();
}

console.log('Actual model footprints, cabinet sweeps, player/monster movement, legacy recovery and all-map objective paths passed.');

import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {PROFILES} from './models.js';
import {dressAngler} from './angler-art.js';
export function dressHarborEnemy(e){
 if(e.type==='angler'){const a=dressAngler(e);e.harborArtUpdate=a.update;e.harborArtDispose=a.dispose;return;}
 const ownedGeo=new Set(),ownedMat=new Set(),attachments=[],root=new T.Group(),source=e.game.assets.gltf.get('mx:'+PROFILES[e.T.model].file)?.scene;
 const mat=(color,extra={})=>{const m=new T.MeshStandardMaterial({color,roughness:.66,...extra});ownedMat.add(m);return m;};
 const texture=e.game.materials.tex.rock_surface;
 const iron=mat(0x30474c,{metalness:.65,roughness:.42,normalMap:texture?.nor,normalScale:new T.Vector2(.18,.18)}),copper=mat(0x8a7757,{metalness:.6,roughness:.55}),cloth=mat(0x243b40,{side:T.DoubleSide}),rope=mat(0x7e7860),shell=mat(0xb6c1b0,{normalMap:texture?.nor,normalScale:new T.Vector2(.4,.4)}),glow=mat(0x94bec0,{emissive:0x397e88,emissiveIntensity:.45});
 let target=root;
 const add=(geo,m,p=[0,0,0],s=[1,1,1],r=[0,0,0])=>{const o=new T.Mesh(geo,m);o.position.fromArray(p);o.scale.fromArray(s);o.rotation.set(...r);target.add(o);return o;};
 const ring=(m,p,r,t=.018,rotation=[Math.PI/2,0,0])=>add(new T.TorusGeometry(r,t,5,24),m,p,[1,1,1],rotation);
 if(e.type==='tidechain'){
  e.model.visible=false;e.root.add(root);add(new T.CylinderGeometry(.6,.8,.3,8),iron,[0,.15,0]);
  for(let i=0;i<11;i++)ring(i%3?iron:glow,[0,.4+i*.18,0],.28,.07,[i%2?Math.PI/2:0,0,0]);
 }else if(source){
  source.updateMatrixWorld(true);const refs=[],bones=[];source.traverse(o=>{if(o.isBone)refs.push(o);});e.model.traverse(o=>{if(o.isBone)bones.push(o);});
  const attach=(suffix,make)=>{const ref=refs.find(o=>o.name.endsWith(suffix)),bone=bones.find(o=>o.name.endsWith(suffix));if(!ref||!bone)return;target=new T.Group();make(new T.Vector3().setFromMatrixPosition(ref.matrixWorld));target.updateMatrixWorld(true);const batches=new Map();for(const o of target.children){let geo=o.geometry.clone().applyMatrix4(o.matrixWorld);if(geo.index){const indexed=geo;geo=geo.toNonIndexed();indexed.dispose();}o.geometry.dispose();if(!batches.has(o.material))batches.set(o.material,[]);batches.get(o.material).push(geo);}target.clear();for(const [m,list]of batches){const geo=mergeGeometries(list);list.forEach(g=>g.dispose());ownedGeo.add(geo);const mesh=new T.Mesh(geo,m);mesh.castShadow=true;target.add(mesh);}target.applyMatrix4(ref.matrixWorld.clone().invert());bone.add(target);attachments.push(target);};
  const captain=e.type==='hookcaptain',pirate=e.type==='pirate',witch=e.type==='tidewitch',dead=e.type==='drowned';
  for(const m of e.mats){m.color.setHex(dead?0x789794:witch?0x7d9fa5:0x9da49b);m.roughness=.8;}
  attach('Head',p=>{
   if(captain||pirate){const brim=new T.Shape();brim.moveTo(-.32,0);brim.quadraticCurveTo(0,.12,.32,0);brim.lineTo(.21,-.13);brim.quadraticCurveTo(0,-.02,-.21,-.13);brim.closePath();add(new T.ExtrudeGeometry(brim,{depth:.12,bevelEnabled:true,bevelSize:.016,bevelThickness:.012,bevelSegments:2,steps:1}),cloth,[p.x,p.y+.24,p.z-.08]);add(new T.SphereGeometry(1,14,8),cloth,[p.x,p.y+.25,p.z],[.21,.11,.19]);ring(copper,[p.x,p.y+.24,p.z],.19,.012);}
   if(witch){add(new T.SphereGeometry(1,16,12,0,Math.PI*2,0,Math.PI*.72),cloth,[p.x,p.y+.1,p.z-.035],[.24,.32,.23]);ring(glow,[p.x,p.y+.05,p.z+.18],.13,.009,[0,0,0]);}
   if(dead)for(let i=0;i<3;i++)ring(rope,[p.x,p.y-.03+i*.06,p.z],.16,.018);
  });
  attach('Spine2',p=>{
   if(e.type==='barnacle')for(let i=0;i<16;i++){const a=i*2.4,x=Math.sin(a)*.28,y=(i%5)*.065-.07,z=-.14-Math.abs(Math.cos(a))*.15;add(new T.CylinderGeometry(.035,.09,.12,6,1,true),shell,[p.x+x,p.y+y,p.z+z],[1,1,1],[.4,a,.25]);}
   if(captain||pirate||witch){for(const side of [-1,1]){add(new T.SphereGeometry(1,12,8),cloth,[p.x+side*.23,p.y+.09,p.z],[.13,.12,.17]);ring(copper,[p.x+side*.24,p.y+.16,p.z],.09,.012);}}
   if(dead)for(let i=0;i<4;i++)ring(rope,[p.x,p.y-.15+i*.09,p.z],.24,.016);
  });
  attach('Hips',p=>{if(captain||pirate||witch){for(const side of [-1,1]){const shape=new T.Shape();shape.moveTo(0,0);shape.lineTo(side*.27,-.04);shape.lineTo(side*.36,-.79);shape.lineTo(side*.13,-.63);shape.closePath();add(new T.ShapeGeometry(shape),cloth,[p.x,p.y,p.z-.16]);}ring(copper,[p.x,p.y+.03,p.z],.23,.025);}});
  if(captain)attach('LeftHand',p=>{const path=new T.CatmullRomCurve3([new T.Vector3(p.x,p.y,p.z),new T.Vector3(p.x-.12,p.y-.18,p.z),new T.Vector3(p.x-.29,p.y-.18,p.z),new T.Vector3(p.x-.32,p.y+.02,p.z),new T.Vector3(p.x-.21,p.y+.09,p.z)]);add(new T.TubeGeometry(path,22,.033,7),iron);ring(copper,[p.x,p.y,p.z],.07,.022);});
  if(pirate||captain)attach('RightHand',p=>{const shape=new T.Shape();shape.moveTo(0,0);shape.bezierCurveTo(-.02,.35,.09,.65,.18,.82);shape.bezierCurveTo(.08,.63,.07,.31,.07,0);shape.closePath();add(new T.ExtrudeGeometry(shape,{depth:.012,bevelEnabled:true,bevelSize:.006,bevelThickness:.003,bevelSegments:1,steps:1}),iron,[p.x,p.y,p.z]);ring(copper,[p.x,p.y+.02,p.z],.09,.014,[0,0,0]);});
  if(witch)attach('RightHand',p=>{add(new T.CylinderGeometry(.02,.025,1.25,7),rope,[p.x,p.y+.3,p.z]);ring(iron,[p.x,p.y+1,p.z],.15,.018,[0,0,0]);add(new T.SphereGeometry(.08,12,8),glow,[p.x,p.y+1,p.z]);});
 }
 root.traverse(o=>{if(o.geometry)ownedGeo.add(o.geometry);});let disposed=false;e.harborArtDispose=()=>{if(disposed)return;disposed=true;root.removeFromParent();attachments.forEach(o=>o.removeFromParent());ownedGeo.forEach(o=>o.dispose());ownedMat.forEach(m=>m.dispose());};
}

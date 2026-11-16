import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),TAU=Math.PI*2;

/** A breathing deep-water animal, authored in world units. The hidden Mixamo
 * actor still provides encounter timing; no humanoid geometry is shown. */
export function dressAngler(e){
 const oldVisible=e.model.visible;e.model.visible=false;
 const root=new T.Group(),body=new T.Group(),jaw=new T.Group(),tail=new T.Group(),leftFin=new T.Group(),rightFin=new T.Group();root.add(body);body.add(jaw,tail,leftFin,rightFin);e.root.add(root);
 jaw.position.set(0,1.75,.65);tail.position.set(0,1.85,-1.95);leftFin.position.set(-1.3,1.7,-.65);rightFin.position.set(1.3,1.7,-.65);
 const geos=new Set(),mats=new Set(),tex=e.game.materials?.tex?.rock_surface;
 const material=(color,opts={})=>{const m=new T.MeshPhysicalMaterial({color,roughness:.57,clearcoat:.5,clearcoatRoughness:.35,...opts});mats.add(m);return m;};
 const skin=material(0x20332f,{normalMap:tex?.nor??null,normalScale:new T.Vector2(.65,.65),metalness:.08});
 const belly=material(0x627872,{normalMap:tex?.nor??null,normalScale:new T.Vector2(.12,.12),roughness:.62});
 const mouth=material(0x261e26,{roughness:.5,clearcoat:1,side:T.DoubleSide});
 const lip=material(0x3d5550,{roughness:.4,normalMap:tex?.nor??null,normalScale:new T.Vector2(.18,.18)});
 const ivory=material(0xaba78b,{roughness:.54,clearcoat:.35,side:T.DoubleSide}),bronze=material(0x66583b,{metalness:.7,roughness:.61,normalMap:tex?.nor??null,normalScale:new T.Vector2(.2,.2)});
 const mineral=material(0x6b7f72,{roughness:.88,clearcoat:0}),eye=material(0x080f10,{roughness:.08,clearcoat:1});
 const light=material(0x89d7d0,{emissive:0x42d4cf,emissiveIntensity:1.2,roughness:.24,metalness:.12});
 const finMat=material(0x334d49,{side:T.DoubleSide,roughness:.6,normalMap:tex?.nor??null,normalScale:new T.Vector2(.08,.08)});
 for(const m of [skin,belly,lip,bronze]){
  m.onBeforeCompile=sh=>{
   sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 anglerSurface;').replace('#include <begin_vertex>','#include <begin_vertex>\nanglerSurface=position;');
   sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 anglerSurface;').replace('#include <color_fragment>',`#include <color_fragment>
    float pores=fract(sin(dot(floor(anglerSurface*95.),vec3(12.9898,78.233,37.719)))*43758.5453);
    float mottling=sin(anglerSurface.x*7.+sin(anglerSurface.z*5.))*sin(anglerSurface.y*9.-anglerSurface.z*3.);
    float folds=pow(.5+.5*sin(anglerSurface.z*22.+anglerSurface.y*4.),12.);
    diffuseColor.rgb*=.72+pores*.22+mottling*.15;
    diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.55,.75,.63),folds*.32);`);
  };m.customProgramCacheKey=()=> 'angler-wet-skin-v1';
 }
 let reflection;if(e.game.gfx?.renderer){const generator=new T.PMREMGenerator(e.game.gfx.renderer),room=new RoomEnvironment();reflection=generator.fromScene(room,.03);room.dispose();generator.dispose();for(const m of [skin,belly,mouth,lip,ivory,bronze,eye,light,finMat]){m.envMap=reflection.texture;m.envMapIntensity=.25;}}
 const add=(parent,geo,mat,p=V())=>{geos.add(geo);const mesh=new T.Mesh(geo,mat);mesh.position.copy(p);mesh.castShadow=!e.game.low;mesh.receiveShadow=true;parent.add(mesh);return mesh;};
 const curve=(parent,points,r,m)=>add(parent,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>p.isVector3?p:V(...p))),Math.max(8,points.length*4),r,6,false),m);
 const ellipsoid=(parent,p,s,m)=>{const o=add(parent,new T.SphereGeometry(1,24,16),m,p);o.scale.fromArray(s);return o;};
 // Continuous asymmetric cross-sections leave a genuinely open mouth, rather
 // than painting a black circle over a closed sphere.
 const sections=[[-2.4,.22,.33,1.85],[-1.8,.7,.72,1.9],[-1,1.22,1.15,1.95],[0,1.65,1.44,2],[.7,1.7,1.3,1.98],[1.5,1.39,.96,1.91]];
 const positions=[],uv=[],indices=[],around=40;
 for(let j=0;j<sections.length;j++){const [z,rx,ry,cy]=sections[j];for(let i=0;i<=around;i++){const a=i/around*TAU,k=1+.025*Math.sin(a*5+j*1.8);positions.push(Math.cos(a)*rx*k,cy+Math.sin(a)*ry*k,z);uv.push(i/around,j/(sections.length-1));if(j<sections.length-1&&i<around){const n=j*(around+1)+i;indices.push(n,n+1,n+around+1,n+1,n+around+2,n+around+1);}}}
 const bodyGeo=new T.BufferGeometry();bodyGeo.setAttribute('position',new T.Float32BufferAttribute(positions,3));bodyGeo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));bodyGeo.setIndex(indices);bodyGeo.computeVertexNormals();add(body,bodyGeo,skin);
 const cavity=new T.CylinderGeometry(1,.08,1.5,40,5,true).rotateX(Math.PI/2);const cp=cavity.attributes.position;for(let i=0;i<cp.count;i++){const x=cp.getX(i),y=cp.getY(i),z=cp.getZ(i);cp.setXYZ(i,x*1.37,y*.94+1.91,z+.78);}cavity.computeVertexNormals();add(body,cavity,mouth);
 ellipsoid(body,V(0,1.36,-.1),[1.33,.61,1.65],belly);
 // Upper and lower gums have irregular, recessed edges, and curved teeth.
 const upper=[],lower=[];
 for(let i=0;i<=24;i++){const a=i/24*Math.PI;upper.push(V(Math.cos(a)*1.4,1.91+Math.sin(a)*.96,1.51+.045*Math.sin(a*7)));lower.push(V(Math.cos(a)*1.4,1.91-Math.sin(a)*.83,1.51).sub(jaw.position));}
 curve(body,upper,.105,lip);curve(jaw,lower,.12,lip);
 const tooth=(base,tip,lean)=>{
  const path=new T.CatmullRomCurve3([base,base.clone().lerp(tip,.4).add(V(lean,0,.14)),tip]),p=[],u=[],idx=[],steps=6,radial=5;
  for(let j=0;j<=steps;j++){const q=path.getPoint(j/steps),r=.047*(1-j/steps)+.001;for(let i=0;i<=radial;i++){const a=i/radial*TAU;p.push(q.x+Math.cos(a)*r,q.y,q.z+Math.sin(a)*r);u.push(i/radial,j/steps);if(j<steps&&i<radial){const n=j*(radial+1)+i;idx.push(n,n+radial+1,n+1,n+1,n+radial+1,n+radial+2);}}}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(u,2));g.setIndex(idx);g.computeVertexNormals();return g;
 };
 for(const [part,sign]of [[body,1],[jaw,-1]]){const pieces=[];for(let i=1;i<24;i++){const a=i/24*Math.PI,x=Math.cos(a)*1.32,cy=1.91+sign*Math.sin(a)*.86,z=1.57;const len=.32+Math.sin(a)*.52+.12*Math.sin(i*8.73);let base=V(x,cy,z),tip=V(x*.83,cy-sign*len,z-.12);if(part===jaw){base.sub(jaw.position);tip.sub(jaw.position);}pieces.push(tooth(base,tip,-x*.06));}const merged=mergeGeometries(pieces);pieces.forEach(g=>g.dispose());add(part,merged,ivory);}
 // Brow folds, black glass eyes, and delicate luminous lateral organs.
 for(const side of [-1,1]){
  ellipsoid(body,V(side*1.43,2.58,.95),[.33,.24,.34],skin);
  ellipsoid(body,V(side*1.53,2.58,1.16),[.135,.135,.075],eye);
  ellipsoid(body,V(side*1.55,2.6,1.219),[.055,.065,.018],light);
  for(let i=0;i<4;i++){const z=.17-i*.24;curve(body,[[side*1.62,2.38,z],[side*(1.72-i*.02),1.9,z+.05],[side*1.5,1.5,z]],.038,lip);}
 }
 // Fin membranes are curved fans; their ribs converge anatomically at the body.
 const makeFin=(part,side,kind='pectoral')=>{
  const vertices=[],texUV=[],faces=[],rays=9,rows=5;
  for(let r=0;r<=rows;r++)for(let i=0;i<=rays;i++){const a=i/rays*Math.PI,reach=kind==='tail'?1.1+Math.sin(a)*.35:1.15+Math.sin(a)*.5,t=r/rows;vertices.push(side*Math.sin(a)*reach*t,(Math.cos(a)*.65)*t,-reach*t*(.65+Math.sin(a)*.3));texUV.push(i/rays,t);if(r<rows&&i<rays){const n=r*(rays+1)+i;faces.push(n,n+1,n+rays+1,n+1,n+rays+2,n+rays+1);}}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new T.Float32BufferAttribute(texUV,2));g.setIndex(faces);g.computeVertexNormals();add(part,g,finMat);
  const ribs=[];for(let i=0;i<=rays;i++){const a=i/rays*Math.PI,reach=1.15+Math.sin(a)*.5;const geo=new T.TubeGeometry(new T.CatmullRomCurve3([V(),V(side*Math.sin(a)*reach*.5,Math.cos(a)*.32,-reach*.4),V(side*Math.sin(a)*reach,Math.cos(a)*.65,-reach*(.65+Math.sin(a)*.3))]),6,.018,4,false);ribs.push(geo);}const merged=mergeGeometries(ribs);ribs.forEach(g=>g.dispose());add(part,merged,lip);
 };
 makeFin(leftFin,-1);makeFin(rightFin,1);makeFin(tail,.75,'tail');
 // A corroded tide-bell harness is grown into the animal, not a loose prop.
 const harness=[];for(const [z,rx,ry]of [[-1.05,1.3,1.26],[-.4,1.52,1.43]]){const geo=new T.TorusGeometry(1,.065,6,36);geo.scale(rx,ry,1);geo.translate(0,1.91,z);harness.push(geo);}const harnessGeo=mergeGeometries(harness);harness.forEach(g=>g.dispose());add(body,harnessGeo,bronze);
 const bell=add(body,new T.LatheGeometry([[.08,0],[.19,.08],[.21,.42],[.38,.62],[.42,.66]].map(p=>new T.Vector2(...p)),20),bronze,V(.64,1.18,-1.28));bell.rotation.z=.18;
 const crust=[];for(let i=0;i<23;i++){const a=i*2.399,z=-1.6+(i%7)*.36,rx=1.13+(z+1.6)*.23,p=V(Math.cos(a)*rx,2+Math.sin(a)*.96,z),g=new T.CylinderGeometry(.04,.1,.1,6,1,true);g.rotateZ(Math.PI/2);g.rotateY(a);g.translate(p.x,p.y,p.z);crust.push(g);}const crustGeo=mergeGeometries(crust);crust.forEach(g=>g.dispose());add(body,crustGeo,mineral);
 const lure=new T.Group();body.add(lure);curve(lure,[[0,3.18,-.05],[.05,4.34,.35],[.1,4.9,1.42],[.04,4.65,2.1]],.065,skin);
 const bulb=ellipsoid(lure,V(.04,4.65,2.1),[.22,.28,.22],light);const cage=add(lure,new T.TorusGeometry(.27,.022,5,24),bronze,V(.04,4.65,2.1));cage.rotation.x=.3;
 // Batch static pieces by material inside each articulated part. Keep membranes
 // separate from their ribs, but avoid a draw call per tooth or barnacle.
 for(const part of [body,jaw,tail,leftFin,rightFin,lure]){
  const groups=new Map();for(const o of [...part.children]){if(!o.isMesh||o===bulb)continue;o.updateMatrix();const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrix);if(!groups.has(o.material))groups.set(o.material,[]);groups.get(o.material).push(g);part.remove(o);}
  for(const [m,list]of groups){const merged=mergeGeometries(list);list.forEach(g=>g.dispose());add(part,merged,m);}
 }
 let elapsed=0,disposed=false;
 return {root,update(dt){
  if(disposed)return;elapsed+=dt;const s=e.harbor??{},cast=s.cast,phase=s.phase??e.phase??1;
  const wind=cast?Math.min(1,cast.t/Math.max(.01,cast.windup)):0,anticipation=cast&&cast.t<cast.windup;
  const jawTarget=e.alive===false?.48:cast?.kind==='bite'?(anticipation?.18+wind*.65:Math.max(.02,.8-(cast.t-cast.windup)*6)):.1+.025*Math.sin(elapsed*1.7);
  jaw.rotation.x+=(jawTarget-jaw.rotation.x)*Math.min(1,dt*12);const movement=e.alive===false?Math.exp(-(e.t??2)*2):1;tail.rotation.y=Math.sin(elapsed*1.4)*.15*movement;leftFin.rotation.z=Math.sin(elapsed*1.2)*.1*movement;rightFin.rotation.z=-Math.sin(elapsed*1.2)*.1*movement;lure.rotation.x=Math.sin(elapsed*1.3)*.015;
  skin.emissive.setRGB((e.flashT??0)*.18,(e.flashT??0)*.12,(e.flashT??0)*.06);
  body.position.y=e.alive===false?-.18:Math.sin(elapsed*1.5)*.065;body.rotation.z+=( (e.alive===false?-.34:0)-body.rotation.z)*Math.min(1,dt*2);
  light.emissive.setHex(s.exposed>0?0xffad53:0x42d4cf);light.emissiveIntensity=(s.exposed>0?.9:1.15+(phase-1)*.24)*(1+Math.sin(elapsed*3)*.12);bulb.scale.set(.22,.28,.22).multiplyScalar(1+(anticipation?.12*wind:0));
 },dispose(){if(disposed)return;disposed=true;root.removeFromParent();for(const g of geos)g.dispose();for(const m of mats)m.dispose();reflection?.dispose();e.model.visible=oldVisible;}};
}

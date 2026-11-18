import {dressBossMotion} from './boss-motion.js';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),UP=V(0,1,0),TAU=Math.PI*2;

/** Bind-pose tailoring follows the Mixamo joints; no scene-global materials are mutated. */
export function dressWinterEnemy(e){
 if(e.type==='snowyeti'){dressSnowBeast(e);return;}
 if(e.type==='winterabbess'){e.winterArtUpdate=()=>{};e.winterArtDispose=dressBossMotion(e);return;}
 if(e.type==='frostgiant'){dressFrostCreature(e);return;}
 const file=({frostthrall:'warrior',snowraider:'bram',icemaiden:'vera',frostmonk:'mage',frostgiant:'elite',winterabbess:'vera',frostseal:'mage'})[e.type];
 const source=e.game.assets?.gltf?.get('mx:'+file)?.scene,ownedGeo=new Set(),ownedMat=new Set(),attachments=[];
 let disposed=false,time=0,target;const clothTime={value:0};
 if(!source){e.winterArtUpdate=()=>{};e.winterArtDispose=()=>{};return;}
 source.updateMatrixWorld(true);const refs=[],bones=[];source.traverse(o=>{if(o.isBone)refs.push(o);});e.model.traverse(o=>{if(o.isBone)bones.push(o);});
 const normal=e.game.materials?.tex?.rock_surface?.nor??null;
 const make=(color,extra={})=>{const m=new T.MeshStandardMaterial({color,roughness:.72,...extra});ownedMat.add(m);return m;};
 const dark=make(0x18252c,{roughness:.91}),ivory=make(0xaeb5ab,{normalMap:normal,normalScale:new T.Vector2(.2,.2),roughness:.84});
 const silver=make(0x657f86,{metalness:.76,roughness:.44,normalMap:normal,normalScale:new T.Vector2(.22,.22)}),ice=make(0x8aafbb,{metalness:.18,roughness:.3,emissive:0x173c4b,emissiveIntensity:.35,flatShading:true});
 const light=make(0x9bdfeb,{emissive:0x54c8ef,emissiveIntensity:.65,roughness:.35}),fur=make(0x817f70,{roughness:1}),cloth=make(0xb2b4a6,{side:T.DoubleSide,roughness:.96}),veil=make(0x253440,{side:T.DoubleSide,roughness:1});
 for(const m of [ivory,silver,ice]){
  m.onBeforeCompile=sh=>{sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 winterSurface;').replace('#include <begin_vertex>','#include <begin_vertex>\nwinterSurface=position;');sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 winterSurface;').replace('#include <color_fragment>',`#include <color_fragment>
   float grain=fract(sin(dot(floor(winterSurface*130.),vec3(12.9898,78.233,37.719)))*43758.5453);
   float vein=pow(.5+.5*sin(winterSurface.y*32.+sin(winterSurface.x*18.)*3.+winterSurface.z*17.),12.);
   diffuseColor.rgb*=.8+grain*.2;diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.55,.77,.83),vein*.4);`);};m.customProgramCacheKey=()=> 'winter-patina-v1';
 }
 for(const m of [cloth,veil]){m.onBeforeCompile=sh=>{sh.uniforms.winterTime=clothTime;sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform float winterTime;').replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.z+=sin(winterTime*1.8+position.y*6.+position.x*9.)*.017*clamp(1.5-position.y,0.,1.);');};m.customProgramCacheKey=()=> 'winter-tailoring-v1';}
 for(const m of e.mats??[]){m.color.setHex(e.type==='winterabbess'?0x596b73:e.type==='frostthrall'?0x7c999f:0x9aa9a5);m.roughness=.83;}
 const add=(geo,m,p=[0,0,0],s=[1,1,1],r=[0,0,0])=>{const o=new T.Mesh(geo,m);o.position.fromArray(p);o.scale.fromArray(s);o.rotation.set(...r);target.add(o);return o;};
 const oval=(m,p,s)=>add(new T.SphereGeometry(1,18,12),m,p,s);
 const pipe=(points,r,m)=>add(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>V(...p))),points.length*5,r,5,false),m);
 const bar=(a,b,r,m)=>{const start=V(...a),d=V(...b).sub(start);const o=add(new T.CylinderGeometry(r,r*.9,d.length(),7),m,start.addScaledVector(d,.5).toArray());o.quaternion.setFromUnitVectors(UP,d.normalize());return o;};
 const shard=(m,p,h,r,lean=0,twist=0)=>{const shaft=new T.CylinderGeometry(r*.65,r,h*.7,6).translate(0,-h*.1,0),tip=new T.ConeGeometry(r*.65,h*.3,6).translate(0,h*.4,0);const parts=[shaft.toNonIndexed(),tip.toNonIndexed()],g=mergeGeometries(parts);parts.forEach(g=>g.dispose());shaft.dispose();tip.dispose();return add(g,m,p,[1,1,1],[0,twist,lean]);};
 const ring=(m,p,r,t=.015,rotation=[0,0,0],arc=TAU)=>add(new T.TorusGeometry(r,t,5,48,arc),m,p,[1,1,1],rotation);
 const plate=(points,m,p=[0,0,0],depth=.012)=>{const shape=new T.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();return add(new T.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:.004,bevelThickness:.003,bevelSegments:1,steps:1}),m,p);};
 const attach=(suffix,build)=>{
  const ref=refs.find(o=>o.name.endsWith(suffix)),bone=bones.find(o=>o.name.endsWith(suffix));if(!ref||!bone)return;
  target=new T.Group();build(new T.Vector3().setFromMatrixPosition(ref.matrixWorld));const batches=new Map();
  for(const o of [...target.children]){o.updateMatrix();const geo=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();geo.applyMatrix4(o.matrix);if(!batches.has(o.material))batches.set(o.material,[]);batches.get(o.material).push(geo);o.geometry.dispose();target.remove(o);}
  for(const [m,parts]of batches){const geo=mergeGeometries(parts);parts.forEach(g=>g.dispose());ownedGeo.add(geo);const mesh=new T.Mesh(geo,m);mesh.castShadow=!e.game.low;mesh.receiveShadow=true;target.add(mesh);}
  target.applyMatrix4(ref.matrixWorld.clone().invert());bone.add(target);attachments.push(target);return target;
 };
 const robe=(p,m,length,width,back=false)=>{
  const pos=[],uv=[],idx=[],rows=12,cols=16;
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
   const u=i/cols,v=j/rows,a=(back?Math.PI*.46:-Math.PI*.48)+u*Math.PI*1.04,r=.23+v*width+.025*Math.sin(u*Math.PI*12),hem=Math.pow(v,8)*(.035+.05*Math.sin(i*2.3));
   pos.push(p.x+Math.sin(a)*r,p.y+.1-v*length+hem,p.z+Math.cos(a)*r);uv.push(u,v);if(j<rows&&i<cols){const n=j*(cols+1)+i;idx.push(n,n+1,n+cols+1,n+1,n+cols+2,n+cols+1);}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();add(g,m);
 };
 if(e.type==='frostseal'){
  const old=e.model.visible;e.model.visible=false;target=new T.Group();e.root.add(target);const root=target;
  add(new T.CylinderGeometry(.75,.9,.28,8),dark,[0,.14,0]);
  for(let i=0;i<9;i++){const a=i*2.399;shard(i%3?ice:light,[Math.sin(a)*.45,.8+(i%3)*.15,Math.cos(a)*.4],1.2+(i%4)*.27,.1+(i%2)*.025,(i-4)*.08,a);}
  ring(silver,[0,1.35,0],.7,.035,[Math.PI/2,0,0]);root.traverse(o=>{if(o.geometry)ownedGeo.add(o.geometry);});attachments.push(root);
  e.winterArtUpdate=dt=>{if(disposed)return;time+=dt;light.emissiveIntensity=.5+Math.sin(time*2)*.12;};
  e.winterArtDispose=()=>{if(disposed)return;disposed=true;root.removeFromParent();ownedGeo.forEach(g=>g.dispose());ownedMat.forEach(m=>m.dispose());e.model.visible=old;};return;
 }
 const boss=e.type==='winterabbess',giant=e.type==='frostgiant',monk=e.type==='frostmonk',maiden=e.type==='icemaiden';
 let halo;
 attach('Head',p=>{
  if(boss){
   // A severe, long funerary mask lies inside the veil; no bright cartoon eyes.
   oval(dark,[p.x,p.y+.025,p.z+.055],[.16,.23,.13]);
   for(const side of [-1,1]){
    const cheek=plate([[0,.19],[side*.12,.15],[side*.1,-.07],[side*.018,-.19],[0,-.12]],ivory,[p.x,p.y+.015,p.z+.185],.02);cheek.rotation.y=side*.13;
    pipe([[p.x+side*.025,p.y+.13,p.z+.215],[p.x+side*.075,p.y+.14,p.z+.209],[p.x+side*.118,p.y+.118,p.z+.19]],.008,dark);
    bar([p.x+side*.035,p.y+.12,p.z+.218],[p.x+side*.086,p.y+.125,p.z+.215],.003,light);
   }
   plate([[-.018,.12],[.018,.12],[.027,-.01],[0,-.06],[-.027,-.01]],silver,[p.x,p.y+.02,p.z+.212],.014);
   bar([p.x-.034,p.y-.065,p.z+.218],[p.x+.034,p.y-.065,p.z+.218],.005,dark);
   // Deep hood and trailing ivory head-cloth frame the face instead of a crown helmet.
   add(new T.SphereGeometry(1,22,16,Math.PI*.1,Math.PI*1.8,0,Math.PI*.6),veil,[p.x,p.y+.13,p.z-.045],[.24,.32,.25]);
   for(const side of [-1,1]){
    const points=[[0,.28],[side*.14,.2],[side*.23,-.3],[side*.18,-.69],[side*.13,-.59],[side*.06,-.76],[side*.035,-.22]];
    const panel=plate(points,cloth,[p.x,p.y+.09,p.z-.06],.004);panel.rotation.y=side*.22;
    pipe([[p.x+side*.12,p.y+.27,p.z+.08],[p.x+side*.19,p.y-.12,p.z+.02],[p.x+side*.17,p.y-.49,p.z-.04]],.008,silver);
   }
   ring(silver,[p.x,p.y+.19,p.z-.19],.49,.018,[0,0,-Math.PI*.35],Math.PI*1.7);
   for(let i=0;i<13;i++){
    const a=-.15+i/12*Math.PI*1.1,x=Math.cos(a)*.49,y=.19+Math.sin(a)*.49,h=.12+.16*Math.sin(a)**2;
    shard(ice,[p.x+x,p.y+y,p.z-.19],h,.022,Math.PI/2-a,i*.3);
    if(i%2===0)bar([p.x+x*.8,p.y+.19+(y-.19)*.8,p.z-.19],[p.x+x,p.y+y,p.z-.19],.007,light);
   }
  }else if(monk||maiden){
   add(new T.SphereGeometry(1,16,12,Math.PI*.08,Math.PI*1.84,0,Math.PI*.64),maiden?cloth:veil,[p.x,p.y+.1,p.z-.04],[.23,.31,.24]);
   ring(silver,[p.x,p.y+.09,p.z+.17],.12,.009,[0,0,0]);
   for(let i=0;i<3;i++)shard(ice,[p.x+(i-1)*.09,p.y+.32,p.z],.17+i*.04,.025,(i-1)*.3);
  }else{
   for(let i=0;i<(giant?7:4);i++){
    const a=i*2.399;shard(ice,[p.x+Math.sin(a)*.16,p.y+.12+Math.cos(a)*.13,p.z-.02],giant?.3:.16,.035,(i-2)*.2,a);
   }
  }
 });
 attach('Spine2',p=>{
  if(boss){
   robe(p,veil,1.43,.34,true);robe(V(p.x,p.y-.035,p.z),cloth,1.33,.31,false);
   for(const side of [-1,1]){
    oval(veil,[p.x+side*.26,p.y+.12,p.z],[.14,.1,.2]);
    for(let i=0;i<4;i++)shard(ice,[p.x+side*(.22+i*.05),p.y+.19+i*.02,p.z-.08],.18+i*.055,.025,-side*(.25+i*.18));
    pipe([[p.x+side*.23,p.y+.13,p.z+.12],[p.x+side*.14,p.y-.04,p.z+.23],[p.x+side*.025,p.y-.17,p.z+.21]],.011,silver);
   }
   plate([[-.04,.1],[.04,.1],[.055,-.12],[0,-.22],[-.055,-.12]],silver,[p.x,p.y,p.z+.24]);
   shard(light,[p.x,p.y-.05,p.z+.26],.16,.018);
  }else if(giant){
   for(const side of [-1,1])for(let i=0;i<5;i++)shard(i%2?ice:ivory,[p.x+side*(.18+i*.03),p.y+.11-i*.025,p.z-.07],.32+i*.07,.065,-side*(.1+i*.12),i);
   oval(fur,[p.x,p.y+.12,p.z-.08],[.36,.22,.28]);
  }else if(monk||maiden){robe(p,monk?veil:cloth,1.07,.23,true);for(const side of [-1,1])oval(ivory,[p.x+side*.22,p.y+.1,p.z],[.1,.08,.16]);}
  else{
   for(const side of [-1,1]){oval(fur,[p.x+side*.24,p.y+.12,p.z],[.13,.1,.17]);for(let i=0;i<3;i++)shard(ice,[p.x+side*.22,p.y+.13,p.z-i*.07],.13,.025,-side*.2);}
  }
 });
 if(boss)attach('Hips',p=>{
  for(const side of [-1,1]){
   const strip=plate([[0,0],[side*.12,-.02],[side*.16,-.82],[side*.08,-.74],[0,-.93]],cloth,[p.x+side*.07,p.y+.01,p.z+.24],.004);strip.rotation.y=side*-.1;
   for(let i=0;i<5;i++)bar([p.x+side*.1,p.y-.08-i*.12,p.z+.27],[p.x+side*.14,p.y-.14-i*.12,p.z+.29],.007,silver);
  }
  ring(silver,[p.x,p.y+.02,p.z],.235,.02,[Math.PI/2,0,0]);
 });
 attach('RightHand',p=>{
  if(boss||monk||maiden){
   bar([p.x,p.y-.56,p.z],[p.x,p.y+.73,p.z],boss?.023:.018,dark);
   const path=[[p.x,p.y+.65,p.z],[p.x-.09,p.y+.92,p.z],[p.x+.05,p.y+1.17,p.z],[p.x+.27,p.y+1.16,p.z],[p.x+.34,p.y+.97,p.z],[p.x+.23,p.y+.87,p.z],[p.x+.15,p.y+.94,p.z]];pipe(path,boss?.027:.02,silver);
   shard(ice,[p.x+.17,p.y+1.02,p.z],boss?.24:.17,.045);ring(light,[p.x+.17,p.y+1.02,p.z],.085,.009,[0,.25,0]);
   for(let i=0;i<6;i++)ring(silver,[p.x,p.y-.4+i*.16,p.z],.026,.006,[Math.PI/2,0,0]);
   // Correct Vera's idle hand axis while retaining the animated hand transform.
   if(file==='vera'){
    const grip=new T.Matrix4().makeTranslation(p.x,p.y,p.z).multiply(new T.Matrix4().makeRotationFromQuaternion(new T.Quaternion().setFromUnitVectors(UP,V(.998814,.012521,.04705).normalize()))).multiply(new T.Matrix4().makeTranslation(-p.x,-p.y,-p.z));
    for(const o of target.children)o.applyMatrix4(grip);
   }
  }else if(giant){
   bar([p.x,p.y-.7,p.z],[p.x,p.y+.65,p.z],.04,dark);add(new T.BoxGeometry(.54,.34,.3),ivory,[p.x,p.y+.54,p.z]);
   for(const side of [-1,1])for(let i=0;i<3;i++)shard(ice,[p.x+side*.25,p.y+.52,p.z+(i-1)*.1],.21,.045,side*Math.PI/2);
  }
 });
 // The halo is a separate bone-local ornament so it can flex without rotating the head.
 if(boss){const bone=bones.find(o=>o.name.endsWith('Head')),ref=refs.find(o=>o.name.endsWith('Head'));if(bone&&ref){const p=new T.Vector3().setFromMatrixPosition(ref.matrixWorld);halo=new T.Group();const geo=new T.TorusGeometry(.43,.006,4,64,Math.PI*1.65);const o=new T.Mesh(geo,light);o.position.set(p.x,p.y+.19,p.z-.205);halo.add(o);halo.applyMatrix4(ref.matrixWorld.clone().invert());bone.add(halo);ownedGeo.add(geo);attachments.push(halo);}}
 e.winterArtUpdate=dt=>{
  if(disposed)return;time+=dt;clothTime.value=time;const s=e.winter??{},c=s.cast,phase=s.phase??1,wind=c?Math.min(1,c.t/Math.max(.01,c.windup)):0;
  const charge=c&&c.t<c.windup?wind:0;light.emissive.setHex(s.exposed>0?0xffc17b:phase===3?0xba9fee:phase===2?0x7ebbea:0x54c8ef);light.emissiveIntensity=.65+charge*.7+Math.sin(time*2.3)*.07;ice.emissiveIntensity=.28+(phase-1)*.08+charge*.12;
  if(halo){halo.children[0].rotation.z=Math.sin(time*1.2)*.025+(c?.kind==='requiem'||c?.kind==='whiteout'?Math.sin(time*3)*charge*.04:0);}
 };
 e.winterArtDispose=()=>{if(disposed)return;disposed=true;attachments.forEach(o=>o.removeFromParent());ownedGeo.forEach(g=>g.dispose());ownedMat.forEach(m=>m.dispose());};
}

/** The snow beasts retain their own downloaded skeleton, silhouette and native actions. */
function dressFrostCreature(e){
 const giant=e.type==='frostgiant';
 for(const m of e.mats??[]){
  m.roughness=giant?.62:.95;m.metalness=giant?.12:0;
  m.normalMap=e.game.materials?.tex?.rock_surface?.nor??null;m.normalScale?.set(giant?.22:.09,giant?.22:.09);
  m.onBeforeCompile=sh=>{sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 frostLocal;').replace('#include <begin_vertex>','#include <begin_vertex>\nfrostLocal=position;');sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 frostLocal;').replace('#include <map_fragment>',`#include <map_fragment>
   float frostLuma=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
   float frostFur=fract(sin(dot(floor(frostLocal*180.),vec3(12.9898,78.233,37.719)))*43758.5453);
   float frostMask=smoothstep(.12,.55,frostLuma);
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(${giant?'.34,.48,.56':'.7,.79,.81'})*(.75+frostLuma*.4),frostMask*.82);
   diffuseColor.rgb*=.9+frostFur*.13;
  `);};m.customProgramCacheKey=()=>giant?'frost-cyclops-v1':'snowyeti-fur-v1';m.needsUpdate=true;
 }
 // Keep the authored facial rig, then give these creatures a full body and planted limbs.
 const head=new T.Group();head.name='Frost creature head';for(const child of [...e.model.children])head.add(child);head.scale.setScalar(giant?.48:.5);head.position.y=1.16;e.model.add(head);
 const body=new T.Group();body.name='Frost creature body';if(giant)body.scale.set(1.12,1.04,.9);e.model.add(body);const geos=new Set(),mats=new Set();let disposed=false,time=0;
 const material=(color,extra={})=>{const m=new T.MeshStandardMaterial({color,roughness:giant?.65:.95,normalMap:e.game.materials?.tex?.rock_surface?.nor??null,normalScale:new T.Vector2(.12,.12),...extra});m.userData.baseEmissive=m.emissive.clone();mats.add(m);e.mats.push(m);return m;};
 const fur=material(giant?0x829eaa:0xbbc7c4),shade=material(giant?0x344b58:0x45565c),claw=material(giant?0xaccfdd:0xaaa890,{roughness:.45,metalness:.08});
 const build=(parent,parts)=>{const batches=new Map();for(const [geo,m,p=[0,0,0],scale=[1,1,1],r=[0,0,0]]of parts){const matrix=new T.Matrix4().compose(V(...p),new T.Quaternion().setFromEuler(new T.Euler(...r)),V(...scale));const g=geo.index?geo.toNonIndexed():geo;g.applyMatrix4(matrix);if(g!==geo)geo.dispose();if(!batches.has(m))batches.set(m,[]);batches.get(m).push(g);}for(const [m,list]of batches){const geo=mergeGeometries(list);list.forEach(g=>g.dispose());geos.add(geo);const mesh=new T.Mesh(geo,m);mesh.castShadow=!e.game.low;mesh.receiveShadow=true;parent.add(mesh);}};
 const oval=(m,p,s)=>[giant?new T.IcosahedronGeometry(1,1):new T.SphereGeometry(1,14,10),m,p,s];
 const torso=[oval(fur,[0,.96,0],[.48,.61,.33]),oval(shade,[0,.83,.28],[.28,.35,.09]),oval(fur,[0,1.35,-.11],[.58,.28,.34])];
 if(giant)for(const side of [-1,1])for(let i=0;i<3;i++)torso.push([new T.ConeGeometry(.13,.42+i*.08,5),claw,[side*(.42+i*.09),1.45+i*.045,-.13],[1,1,1],[0,0,-side*(.35+i*.12)]]);
 for(let i=0;i<28;i++){const a=i*2.399,y=.6+(i%6)*.13;torso.push([new T.ConeGeometry(giant?.095:.055,giant?.32:.19,5),i%5?fur:claw,[Math.sin(a)*.43,y,Math.cos(a)*.3],[1,1,1],[Math.PI*.9,a,.25*Math.sin(a)]]);}build(body,torso);
 const limbs=[];
 for(const side of [-1,1]){
  const arm=new T.Group();arm.position.set(side*.46,1.36,0);body.add(arm);limbs.push({node:arm,side,arm:true});const parts=[oval(fur,[side*.19,-.23,-.02],[.24,.37,.25]),oval(fur,[side*.3,-.64,.06],[.2,.31,.2]),oval(shade,[side*.32,-.87,.12],[.22,.16,.22])];
  for(let finger=0;finger<3;finger++)parts.push([new T.ConeGeometry(.035,.2,5),claw,[side*(.19+finger*.13),-.95,.25],[1,1,1],[Math.PI*.65,0,0]]);
  for(let n=0;n<7;n++)parts.push([new T.ConeGeometry(.06,.24,5),fur,[side*(.16+n%2*.15),-.12-n*.095,-.15],[1,1,1],[Math.PI,0,side*.2]]);build(arm,parts);
  const leg=new T.Group();leg.position.set(side*.24,.55,0);body.add(leg);limbs.push({node:leg,side,arm:false});const feet=[oval(fur,[0,-.13,0],[.22,.27,.21]),oval(shade,[0,-.38,.11],[.22,.15,.33])];
  for(let toe=0;toe<3;toe++)feet.push([new T.ConeGeometry(.03,.17,5),claw,[-.12+toe*.12,-.41,.4],[1,1,1],[Math.PI/2,0,0]]);build(leg,feet);
 }
 e.winterArtUpdate=dt=>{if(disposed)return;time+=dt;const walking=['Running_A','Running_B','Walking_A','Walking_Backwards'].includes(e.currentName),back=e.currentName==='Walking_Backwards'?-1:1;
  const minor=e.winterMinor,cast=e.winter?.cast,t=minor?minor.t:cast?.t??0,windup=minor?.windup??cast?.windup??1,charging=(minor||cast)&&t<windup,load=charging?Math.min(1,t/windup):0;
  body.position.y=minor?.at?Math.sin(load*Math.PI)*.28:walking?Math.abs(Math.sin(time*7))*.025:0;body.rotation.x=charging?-.12*load:0;
  for(const limb of limbs){limb.node.rotation.x=walking?Math.sin(time*7+limb.side*Math.PI/2)*(limb.arm?.2:.42)*back:limb.arm?-load*.65:0;limb.node.rotation.z=limb.arm?-limb.side*(.07+load*.12):0;}
  if(!e.alive){body.rotation.x=-Math.min(1.4,(e.t??0)*2);head.rotation.x=-Math.min(.65,(e.t??0));}
 };
 e.winterArtDispose=()=>{if(disposed)return;disposed=true;body.removeFromParent();for(const g of geos)g.dispose();for(const m of mats)m.dispose();e.mats=e.mats.filter(m=>!mats.has(m));};
}

/** The new snow beast is a complete textured skinned mesh, not a head attached to a primitive body. */
function dressSnowBeast(e){
 for(const m of e.mats){if(m.name==='Glacial eyes')continue;m.roughness=.9;m.metalness=0;m.onBeforeCompile=sh=>{sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
  float frostLuma=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
  float fur=smoothstep(.001,.035,frostLuma);
  vec3 iceFur=vec3(.74,.80,.83)*clamp(frostLuma*5.,.015,1.);
  diffuseColor.rgb=mix(diffuseColor.rgb*.6,iceFur,fur*.94);
 `);};m.customProgramCacheKey=()=> 'full-snowbeast-v3';m.needsUpdate=true;}
 e.winterArtUpdate=()=>{};e.winterArtDispose=()=>{};
}

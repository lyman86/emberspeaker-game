import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),TAU=Math.PI*2,clamp=x=>Math.max(0,Math.min(1,x));

/** World-space anatomy: a scarred abyssal animal carrying a bell grown into its
 * spine. Each moving part is batched by material; the old humanoid stays hidden. */
export function dressAngler(e){
 const visible=e.model.visible;e.model.visible=false;
 const root=new T.Group(),body=new T.Group(),jaw=new T.Group(),tail=new T.Group(),fins=[new T.Group(),new T.Group()],lure=new T.Group(),bell=new T.Group();
 e.root.add(root);root.add(body);body.add(jaw,tail,...fins,lure,bell);
 jaw.position.set(0,1.7,1);tail.position.set(0,2.25,-3.1);fins[0].position.set(-1.65,1.75,-.8);fins[1].position.set(1.65,1.75,-.8);bell.position.set(.15,3.55,-1.45);
 const geos=new Set(),mats=new Set(),normal=e.game.materials?.tex?.rock_surface?.nor??null;
 const mat=(color,extra={})=>{const m=new T.MeshPhysicalMaterial({color,roughness:.58,clearcoat:.42,clearcoatRoughness:.32,...extra});mats.add(m);return m;};
 const skin=mat(0x263a3a,{normalMap:normal,normalScale:new T.Vector2(.9,.9)}),hide=mat(0x344746,{normalMap:normal,normalScale:new T.Vector2(.7,.7),roughness:.76});
 const bone=mat(0x777d6d,{normalMap:normal,normalScale:new T.Vector2(.35,.35),roughness:.71}),tooth=mat(0xb0af8c,{roughness:.43,clearcoat:.55});
 const mouth=mat(0x251420,{side:T.DoubleSide,roughness:.42,clearcoat:.9}),gum=mat(0x53554d,{normalMap:normal,normalScale:new T.Vector2(.3,.3),roughness:.4});
 const bronze=mat(0x74633c,{metalness:.78,roughness:.54,normalMap:normal,normalScale:new T.Vector2(.4,.4)}),iron=mat(0x273c3d,{metalness:.62,roughness:.64});
 const membrane=mat(0x263b3b,{side:T.DoubleSide,roughness:.68,normalMap:normal,normalScale:new T.Vector2(.25,.25)});
 const light=mat(0x559d9b,{emissive:0x27e6d7,emissiveIntensity:1.7,roughness:.35}),eye=mat(0x101718,{roughness:.16});
 for(const m of [skin,hide,bone,bronze,membrane]){
  m.onBeforeCompile=sh=>{
   sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 abyssSurface;').replace('#include <begin_vertex>','#include <begin_vertex>\nabyssSurface=position;');
   sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 abyssSurface;').replace('#include <color_fragment>',`#include <color_fragment>
    float grain=fract(sin(dot(floor(abyssSurface*78.),vec3(12.9898,78.233,37.719)))*43758.5453);
    float scar=pow(.5+.5*sin(abyssSurface.z*18.+sin(abyssSurface.y*5.)*3.+abyssSurface.x*2.),15.);
    float mottle=sin(abyssSurface.x*4.+sin(abyssSurface.z*3.))*sin(abyssSurface.y*5.-abyssSurface.z*2.);
    diffuseColor.rgb*=.68+grain*.26+mottle*.16;
    diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.4,.64,.61),scar*.48);`);
  };m.customProgramCacheKey=()=> 'abyss-bell-leviathan-v2';
 }
 let reflection;if(e.game.gfx?.renderer){const generator=new T.PMREMGenerator(e.game.gfx.renderer),room=new RoomEnvironment();reflection=generator.fromScene(room,.02);room.dispose();generator.dispose();for(const m of mats){m.envMap=reflection.texture;m.envMapIntensity=m===bronze?.45:.23;}}
 const add=(part,geo,m,pos=V(),scale=null)=>{geos.add(geo);const mesh=new T.Mesh(geo,m);mesh.position.copy(pos);if(scale)mesh.scale.fromArray(scale);mesh.castShadow=!e.game.low;mesh.receiveShadow=true;part.add(mesh);return mesh;};
 const oval=(part,p,s,m)=>add(part,new T.SphereGeometry(1,20,12),m,V(...p),s);
 const pipe=(part,points,r,m)=>add(part,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>V(...p))),points.length*5,r,5,false),m);
 const thorn=(part,points,r,m)=>{
  const path=new T.CatmullRomCurve3(points.map(p=>V(...p))),steps=9,sides=6,frames=path.computeFrenetFrames(steps,false),pos=[],uv=[],idx=[];
  for(let j=0;j<=steps;j++){const t=j/steps,p=path.getPoint(t),radius=r*Math.pow(1-t,.8)+.002;for(let i=0;i<=sides;i++){const a=i/sides*TAU,x=Math.cos(a)*radius,y=Math.sin(a)*radius;pos.push(p.x+frames.normals[j].x*x+frames.binormals[j].x*y,p.y+frames.normals[j].y*x+frames.binormals[j].y*y,p.z+frames.normals[j].z*x+frames.binormals[j].z*y);uv.push(i/sides,t);if(j<steps&&i<sides){const n=j*(sides+1)+i;idx.push(n,n+1,n+sides+1,n+1,n+sides+2,n+sides+1);}}}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();return add(part,geo,m);
 };
 const loft=(part,sections,m,around=48,start=0,arc=TAU)=>{
  const pos=[],uv=[],idx=[];
  for(let j=0;j<sections.length;j++){const [z,rx,ry,cy,offset=0]=sections[j];for(let i=0;i<=around;i++){const a=start+i/around*arc,sculpt=1+.045*Math.sin(a*5+j*.8)+.025*Math.cos(a*9-j),ridge=1+.065*Math.pow(Math.max(0,Math.sin(a)),8);pos.push(offset+Math.cos(a)*rx*sculpt,cy+Math.sin(a)*ry*sculpt*ridge,z+.045*Math.sin(a*3+j));uv.push(i/around,j/(sections.length-1));if(j<sections.length-1&&i<around){const n=j*(around+1)+i;idx.push(n,n+1,n+around+1,n+1,n+around+2,n+around+1);}}}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();return add(part,geo,m);
 };
 // A humped, heavily ridged shoulder tapers toward a muscular eel tail. The
 // forward cross-section is deliberately open, with a deep throat behind it.
 loft(body,[[-3.25,.4,.55,2.2],[-2.7,.83,.92,2.45],[-2,1.27,1.35,2.65,.08],[-1,1.78,1.65,2.6,.02],[0,1.98,1.58,2.45,-.06],[.9,1.96,1.4,2.4],[1.7,1.68,1.22,2.48],[2.25,1.4,1.11,2.48]] ,skin);
 // Recessed throat narrows to darkness; lower bowl belongs to the moving jaw.
 loft(body,[[2.2,1.39,1.09,2.46],[1.55,1.17,.93,2.39],[.9,.72,.64,2.3],[.55,.12,.12,2.22]],mouth,40);
 loft(jaw,[[1.7,1.45,.56,.23],[1.1,1.7,.61,.18],[.1,1.64,.51,.05],[-.65,1.01,.35,.07]],hide,32,Math.PI,Math.PI);
 oval(jaw,[0,-.2,.7],[1.45,.22,1.3],gum);
 const upper=[],lower=[];
 for(let i=0;i<=28;i++){const a=i/28*Math.PI;upper.push([Math.cos(a)*1.48,2.47+Math.sin(a)*1.05,2.29+.13*Math.sin(a*2)]);lower.push([Math.cos(a)*1.64,.23-Math.sin(a)*.47,1.72+.24*Math.sin(a)]);}
 pipe(body,upper,.13,gum);pipe(jaw,lower,.15,gum);
 // Two ragged rows, with hooked outer canines; varied widths avoid a comb-like grin.
 for(const side of [-1,1])for(let i=0;i<15;i++){
  const a=(i+.55)/15*Math.PI,outer=i%4===0,len=.54+.45*Math.sin(a)+.2*Math.sin(i*7.2),x=Math.cos(a)*1.43,y=2.47+Math.sin(a)*.98,z=2.32;
  if(side===1)thorn(body,[[x,y,z],[x*.93,y-len*.55,z+.22],[x*.83,y-len,z-.05]],outer?.092:.052,tooth);
  else{const xx=Math.cos(a)*1.58,yy=.23-Math.sin(a)*.38;thorn(jaw,[[xx,yy,1.85],[xx*.94,yy+len*.55,2.06],[xx*.83,yy+len,1.76]],outer?.09:.05,tooth);}
 }
 for(const side of [-1,1]){
  // Recessed pin-point eyes under armoured overhangs, not raised round eyeballs.
  oval(body,[side*1.7,3.14,1.29],[.36,.18,.63],bone);
  oval(body,[side*1.81,3.08,1.6],[.1,.075,.13],eye);
  oval(body,[side*1.85,3.09,1.69],[.035,.025,.05],light);
  thorn(body,[[side*1.35,3.35,.7],[side*1.7,3.78,.3],[side*2.1,4.05,-.5]],.24,bone);
  thorn(body,[[side*1.58,1.2,1.5],[side*2.15,.76,1.9],[side*2.28,.8,2.5]],.19,bone);
  for(let i=0;i<6;i++){
   const z=.8-i*.43;pipe(body,[[side*1.84,2.95,z],[side*(2.02-i*.025),2.36,z-.13],[side*1.7,1.55,z-.3]],.055,iron);
   pipe(body,[[side*1.87,2.83,z-.08],[side*1.98,2.36,z-.2],[side*1.76,1.7,z-.36]],.022,light);
  }
  // Paired lateral plates overlap like a sturgeon's scutes.
  for(let i=0;i<7;i++){
   const z=1-i*.62,x=side*(1.87-Math.max(0,i-2)*.18);const plate=oval(body,[x,2.2,z],[.24,.62,.51],bone);plate.rotation.z=side*-.28;plate.rotation.x=.14;
   if(i%2===0)thorn(body,[[x,2.4,z],[x+side*.3,2.57,z-.35],[x+side*.46,2.6,z-.82]],.13,bone);
  }
 }
 // Torn dorsal sail has a serrated outline and tall mineral spines.
 const dorsalPoints=[];
 for(let i=0;i<9;i++){const z=1.4-i*.57,y=3.72-Math.max(0,i-2)*.14,h=.48+1.12*Math.sin((i+.5)/9*Math.PI);dorsalPoints.push([0,y+h,z]);thorn(body,[[0,y-.2,z],[.05,y+h*.75,z-.17],[.03,y+h,z-.5]],.15,bone);}
 const sailPos=[],sailIdx=[];for(let i=0;i<dorsalPoints.length;i++){const [x,y,z]=dorsalPoints[i];sailPos.push(x,y,z,0,3.3-Math.max(0,i-2)*.1,z);if(i<dorsalPoints.length-1){const k=i*2;sailIdx.push(k,k+1,k+2,k+1,k+3,k+2);}}
 const sailGeo=new T.BufferGeometry();sailGeo.setAttribute('position',new T.Float32BufferAttribute(sailPos,3));sailGeo.setAttribute('uv',new T.Float32BufferAttribute(sailPos.map((_,i)=>i%3===0?0:.5).filter((_,i)=>i%3!==2),2));sailGeo.setIndex(sailIdx);sailGeo.computeVertexNormals();add(body,sailGeo,membrane);
 // Curved tail and paired limbs have separate pivots; the fins end in hooked rays.
 loft(tail,[[0,.47,.56,0],[-.65,.43,.51,-.06],[-1.5,.35,.43,.05],[-2.35,.25,.34,.15],[-3.1,.13,.2,.2],[-3.65,.025,.05,.2]],hide,28);
 for(let i=0;i<6;i++){const z=-i*.59,y=.4+i*.02;thorn(tail,[[0,y,z],[0,y+.45,z-.2],[0,y+.55,z-.7]],.11,bone);}
 function fin(part,side){
  const verts=[0,0,0,side*.62,-.3,-.7,side*1.5,-.48,-1.3,side*1.87,-.15,-2.4,side*1.15,.15,-1.9,side*.5,.14,-1.4],idx=[0,1,5,1,4,5,1,2,4,2,3,4];
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));geo.setAttribute('uv',new T.Float32BufferAttribute([0,0,.3,.3,1,.2,1,1,.7,1,.3,.8],2));geo.setIndex(idx);geo.computeVertexNormals();add(part,geo,membrane);
  for(let i=0;i<4;i++){const x=side*(.75+i*.35),z=-.8-i*.45;thorn(part,[[0,0,0],[x*.7,-.3,z*.7],[x,-.4,z],[x*.95,-.58,z-.5]],.13-i*.017,bone);}
 }
 fin(fins[0],-1);fin(fins[1],1);const tailFin=new T.Group();tailFin.position.set(0,.18,-2.6);tail.add(tailFin);fin(tailFin,.78);tailFin.rotation.z=Math.PI*.5;
 // Broken bell crown is embedded behind the shoulder, with exposed runes and
 // heavy corroded rings sunk into the living skin.
 const profile=[[.4,1.5],[.58,1.32],[.68,.8],[.85,.23],[1.17,0],[1.2,-.14],[1.05,-.23]].map(p=>new T.Vector2(...p));
 add(bell,new T.LatheGeometry(profile,40,Math.PI*.17,Math.PI*1.7),bronze);bell.rotation.x=-.25;bell.rotation.z=.17;
 for(const y of [.07,.35,1.22]){const ring=add(bell,new T.TorusGeometry(y>1?.58:y>.1?.81:1.15,.055,6,36,Math.PI*1.65),iron,V(0,y,0));ring.rotation.x=Math.PI/2;}
 for(let i=0;i<12;i++){const a=i/12*TAU,r=.8,p=V(Math.sin(a)*r,.66,Math.cos(a)*r);const rune=add(bell,new T.BoxGeometry(.05,.22,.025),light,p);rune.rotation.y=a;}
 for(const side of [-1,1])pipe(body,[[side*.65,4.2,-1.25],[side*1.45,3.6,-1.5],[side*1.7,2.3,-1.8],[side*1.1,1.6,-2]],.095,bronze);
 const crust=[];for(let i=0;i<32;i++){const a=i*2.399,z=-2.6+(i%9)*.43,rx=1.25+(z+2.6)*.15,g=new T.CylinderGeometry(.035,.1+(i%3)*.02,.12,6,1,true);g.rotateZ(Math.PI/2);g.rotateY(a);g.translate(Math.cos(a)*rx,2.4+Math.sin(a)*1.15,z);crust.push(g);}const crustGeo=mergeGeometries(crust);crust.forEach(g=>g.dispose());add(body,crustGeo,bone);
 // The slender organ curves forward like an executioner's hook.
 pipe(lure,[[0,3.75,.15],[-.1,5.1,.45],[-.15,6.12,1.6],[-.08,6.32,2.7],[0,5.83,3.15]],.085,hide);
 thorn(lure,[[0,3.9,.13],[-.11,5.5,.9],[-.14,6.25,2]],.17,bone);
 const bulb=oval(lure,[0,5.83,3.15],[.18,.32,.18],light);const cage=add(lure,new T.TorusGeometry(.24,.04,5,20),bronze,V(0,5.83,3.15));cage.rotation.x=Math.PI*.2;
 // Per-part, per-material batching keeps the many anatomical details affordable.
 for(const part of [body,jaw,tail,...fins,lure,bell,tailFin]){
  const groups=new Map();for(const o of [...part.children]){if(!o.isMesh||o===bulb)continue;o.updateMatrix();const geo=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();geo.applyMatrix4(o.matrix);if(!groups.has(o.material))groups.set(o.material,[]);groups.get(o.material).push(geo);o.geometry.dispose();geos.delete(o.geometry);part.remove(o);}
  for(const [m,list]of groups){const geo=mergeGeometries(list);list.forEach(g=>g.dispose());add(part,geo,m);}
 }
 let elapsed=0,disposed=false;
 return{root,update(dt){
  if(disposed)return;elapsed+=dt;const s=e.harbor??{},c=s.cast,phase=s.phase??e.phase??1,alive=e.alive!==false;
  const wind=c?clamp(c.t/Math.max(.01,c.windup)):0,charging=c&&c.t<c.windup,impact=c?Math.exp(-Math.max(0,c.t-c.windup)*7):0;
  const bite=c?.kind==='bite',surge=c?.kind==='wave'||c?.kind==='deluge'||c?.kind==='maelstrom',lamp=c?.kind==='lure',hook=c?.kind==='hook';
  const jawTarget=!alive?.68:bite?(charging?.08+wind*.72:.95*impact):surge?.25+wind*.18:lamp?.44:.1+.035*Math.sin(elapsed*1.5);
  jaw.rotation.x+=(jawTarget-jaw.rotation.x)*Math.min(1,dt*14);
  body.position.z+=( (bite?(charging?-wind*.65:impact*.85):hook&&charging?-wind*.3:0)-body.position.z)*Math.min(1,dt*9);
  body.position.y=alive?Math.sin(elapsed*1.3)*.055+(surge&&charging?wind*.3:0):-.5;
  body.rotation.x+=( (surge?(charging?-wind*.13:impact*.16):!alive?.08:0)-body.rotation.x)*Math.min(1,dt*7);
  body.rotation.z+=( (!alive?-.38:s.exposed>0?Math.sin(elapsed*8)*.035:0)-body.rotation.z)*Math.min(1,dt*5);
  const motion=alive?1:Math.exp(-(e.t??2)*2);tail.rotation.y=(Math.sin(elapsed*1.25)*.16+(charging?Math.sin(elapsed*4)*wind*.15:0))*motion;
  for(let i=0;i<2;i++){const side=i?-1:1;fins[i].rotation.z=side*(.05+Math.sin(elapsed*1.6+i)*.07+(surge&&charging?wind*.22:0))*motion;fins[i].rotation.y=side*(charging&&bite?wind*.15:0);}
  bell.rotation.z=.17+Math.sin(elapsed*2)*.025+(surge&&!charging?Math.sin(elapsed*20)*impact*.09:0);
  lure.rotation.x=lamp&&charging?-wind*.13:Math.sin(elapsed*1.6)*.018;
  light.emissive.setHex(s.exposed>0?0xffad5f:phase===3?0xc03aee:phase===2?0x399ee6:0x27e6d7);light.emissiveIntensity=(s.exposed>0?.8:1.6+(phase-1)*.35)*(1+(charging?wind*.8:Math.sin(elapsed*2.8)*.12));
  bulb.scale.set(.18,.32,.18).multiplyScalar(1+(lamp&&charging?wind*.18:0));skin.emissive.setRGB((e.flashT??0)*.16,(e.flashT??0)*.09,(e.flashT??0)*.04);
 },dispose(){if(disposed)return;disposed=true;root.removeFromParent();geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());reflection?.dispose();e.model.visible=visible;}};
}

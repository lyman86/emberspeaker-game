import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
const UP=new T.Vector3(0,1,0),V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const hash=(x,z)=>{const n=Math.sin(x*127.1+z*311.7)*43758.5453;return n-Math.floor(n);};

// Geometry and cloned materials belong to this map; PBR textures stay borrowed.
function builder(root){
 const geos=new Set(),mats=new Set(),batches=new Map(),instances=[];let disposed=false;
 const own=m=>{mats.add(m);return m;};
 const add=(geo,mat,p=[0,0,0],s=[1,1,1],rot=[0,0,0])=>{
  const matrix=new T.Matrix4().compose(V(...p),new T.Quaternion().setFromEuler(new T.Euler(...rot)),V(...s));
  const g=geo.index?geo.toNonIndexed():geo;g.applyMatrix4(matrix);if(g!==geo)geo.dispose();
  if(!batches.has(mat))batches.set(mat,[]);batches.get(mat).push(g);
 };
 const box=(m,p,s,r)=>add(new T.BoxGeometry(1,1,1),m,p,s,r);
 const oval=(m,p,s)=>add(new T.SphereGeometry(1,12,8),m,p,s);
 const beam=(a,b,r,m)=>{const p=V(...a),d=V(...b).sub(p),g=new T.CylinderGeometry(r,r*.9,d.length(),7);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(UP,d.clone().normalize()));add(g,m,p.addScaledVector(d,.5).toArray());};
 const curve=(points,r,m)=>add(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>V(...p))),points.length*5,r,6,false),m);
 const finish=()=>{for(const [m,list]of batches){const geo=mergeGeometries(list);list.forEach(g=>g.dispose());const o=new T.Mesh(geo,m);o.castShadow=o.receiveShadow=true;root.add(o);geos.add(geo);}batches.clear();};
 return{own,add,box,oval,beam,curve,finish,geos,instances,get disposed(){return disposed;},dispose(){if(disposed)return;disposed=true;for(const list of batches.values())list.forEach(g=>g.dispose());batches.clear();instances.forEach(o=>o.dispose());geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());}};
}
function palette(lv,b){
 const scanned=(name,color,roughness)=>{const m=lv.game.materials.get(name).clone();m.color.setHex(color);m.roughness=roughness;m.metalness=.04;m.normalScale?.set(.4,.4);return b.own(m);};
 const snow=b.own(new T.MeshStandardMaterial({color:0xd4e4e8,roughness:.94,metalness:0}));
 return{stone:scanned('stoneFloor',0x778c91,.8),dark:scanned('rockTop',0x3f5661,.9),wood:scanned('wood',0x4e4c42,.9),cloth:scanned('headstone',0x5a7180,.95),snow,
  ice:b.own(new T.MeshPhysicalMaterial({color:0x91c5d4,roughness:.28,metalness:.1,clearcoat:.8,clearcoatRoughness:.15,emissive:0x14323e,emissiveIntensity:.2,flatShading:true})),
  iron:b.own(new T.MeshStandardMaterial({color:0x263e47,metalness:.7,roughness:.56})),bronze:b.own(new T.MeshStandardMaterial({color:0x89754c,metalness:.7,roughness:.5})),needle:b.own(new T.MeshStandardMaterial({color:0x334944,roughness:.95,side:T.DoubleSide})),ember:b.own(new T.MeshBasicMaterial({color:0xe9a350}))};
}
function iceShard(b,m,p,height,radius=.18,rot=[0,0,0]){
 const shaft=new T.CylinderGeometry(radius*.2,radius,height,5),tip=new T.ConeGeometry(radius*.23,height*.23,5).translate(0,height*.58,0),geo=mergeGeometries([shaft,tip]);shaft.dispose();tip.dispose();b.add(geo,m,p,[1,1,1],rot);
}
function pointedArch(b,m,span,height,z=0,broken=false){
 for(const side of [-1,1]){
  b.add(new T.CylinderGeometry(.24,.34,height*.56,8),m,[side*span/2,height*.28,z]);
  for(const y of [.18,height*.51])b.box(m,[side*span/2,y,z],[.8,.2,.75]);
  const points=[[side*span/2,height*.54,z],[side*span*.43,height*.74,z],[side*span*.22,height*.93,z],[0,height,z]];
  b.curve(broken&&side>0?points.slice(0,2):points,.24,m);
 }
}

export function winterProp(lv,p,x,z){
 if(!['@winter_brazier','@winter_pine','@winter_ruin','@winter_crystal','@winter_archive','@winter_statue'].includes(p.prop))return false;
 const root=new T.Group();root.position.set(x,p.oy??0,z);root.rotation.y=p.rot??0;root.scale.setScalar(p.s??1);const b=builder(root),c=palette(lv,b);
 if(p.prop==='@winter_brazier'){
  b.add(new T.CylinderGeometry(.65,.78,.28,8),c.stone,[0,.14,0]);b.add(new T.CylinderGeometry(.22,.33,1.1,8),c.iron,[0,.81,0]);
  b.add(new T.CylinderGeometry(.66,.3,.4,12,1,true),c.bronze,[0,1.5,0]);
  for(let i=0;i<6;i++){const a=i*Math.PI/3;b.beam([Math.sin(a)*.27,1.3,Math.cos(a)*.27],[Math.sin(a)*.67,1.85,Math.cos(a)*.67],.035,c.iron);}
  for(let i=0;i<7;i++){const a=i*2.399;b.oval(c.dark,[Math.sin(a)*.33,1.54,Math.cos(a)*.33],[.19,.08,.12]);}
  const ember=new T.Mesh(new T.SphereGeometry(.25,12,8),c.ember);ember.position.set(0,1.67,0);ember.scale.set(1,.45,1);root.add(ember);b.geos.add(ember.geometry);
  const flameMat=b.own(new T.ShaderMaterial({uniforms:{time:{value:0}},transparent:true,depthWrite:false,side:T.DoubleSide,
   vertexShader:'varying vec2 p;uniform float time;void main(){p=uv;vec3 q=position;q.x+=sin(q.y*9.+time*5.)*.065*q.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(q,1.);}',
   fragmentShader:'varying vec2 p;uniform float time;void main(){float x=abs(p.x-.5)*2.;float tip=1.-p.y;float noise=.8+.2*sin(p.y*25.-time*6.+p.x*13.);float a=(1.-smoothstep(tip*.25,tip*.85,x))*smoothstep(0.,.1,p.y)*noise;gl_FragColor=vec4(mix(vec3(1.6,.8,.18),vec3(.7,.18,.025),p.y),a*.7);}'}));
  const flame=new T.Group();for(const a of [0,Math.PI/2]){const geo=new T.PlaneGeometry(.9,1.25),o=new T.Mesh(geo,flameMat);o.position.y=2.16;o.rotation.y=a;flame.add(o);b.geos.add(geo);}root.add(flame);
  const id=p.id??p.fireId,zone={x,z,r:7,id,active:false};(lv.warmth??=[]).push(zone);root.userData.warmId=id;
  const torch={x,y:2,z,color:0xffb564,power:0,seed:x+z};(lv.torches??=[]).push(torch);let elapsed=0,smokeAt=0;
  const update=dt=>{if(b.disposed)return false;elapsed+=dt;const lit=p.lit===true||!id||(lv.game.story?.sixth?.fires??[]).includes(id);zone.active=lit;flame.visible=ember.visible=lit;torch.power=lit?85:0;flameMat.uniforms.time.value=elapsed;
   smokeAt-=dt;if(lit&&smokeAt<=0){smokeAt=.7;lv.game.smoke?.emit({pos:{x,y:2.2,z},count:1,radius:.12,speed:[.08,.2],up:.65,life:[1.2,2.4],size:[.35,.65],c0:[.27,.24,.2],c1:[.09,.12,.14],alpha:.14,tex:'smoke',grow1:1.9});}return true;};update(0);lv.anim.push(update);
 }else if(p.prop==='@winter_pine'){
  b.add(new T.CylinderGeometry(.15,.38,6.6,8),c.wood,[0,3.2,0]);
  // Layered branch fans, bent needles and snow pads leave gaps in the silhouette.
  for(let tier=0;tier<6;tier++)for(let arm=0;arm<5;arm++){
   const a=arm*Math.PI*.4+tier*.91,reach=2.4-tier*.31,y=1.5+tier*.77,dx=Math.sin(a),dz=Math.cos(a);
   b.beam([0,y+.35,0],[dx*reach,y-.32,dz*reach],.065-tier*.006,c.wood);
   for(let j=0;j<3;j++){
    const rr=reach*(.35+j*.25),px=dx*rr,pz=dz*rr,w=(reach-rr)*.46+.17;
    const verts=[px-dz*w,y+.1,pz+dx*w,px+dz*w,y+.1,pz-dx*w,dx*(rr+.6),y-.42,dz*(rr+.6)];
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));geo.setAttribute('uv',new T.Float32BufferAttribute([0,0,1,0,.5,1],2));geo.computeVertexNormals();b.add(geo,c.needle);
    b.add(new T.SphereGeometry(1,7,4),c.snow,[px,y+.17,pz],[w*.83,.1+.05*hash(arm,tier+j),.43]);
   }
  }
  b.add(new T.ConeGeometry(.25,1.1,6),c.needle,[0,6.4,0]);b.oval(c.snow,[0,.12,0],[.9,.15,.75]);
 }else if(p.prop==='@winter_ruin'){
  // Pass under the arch, but collide with both masonry piers.
  const rot=p.rot??0,scale=p.s??1;for(const side of [-1,1])lv.addBox?.(x+Math.cos(rot)*side*2.7*scale,z-Math.sin(rot)*side*2.7*scale,scale,scale*.7,rot,p.prop);
  pointedArch(b,c.stone,4.5,6.1,0,true);pointedArch(b,c.dark,3.4,5.35,.12,true);
  for(const side of [-1,1]){b.box(c.stone,[side*3.1,1.2,-.1],[1.15,2.4,1.2]);b.box(c.snow,[side*3.1,2.45,-.1],[1.25,.18,1.3]);}
  for(let i=0;i<5;i++)b.box(c.dark,[-1.8+i*.75,.18,.8+hash(i,x)*.6],[.6,.35,.65],[0,i*.75,.06]);
  for(const side of [-1,1])for(let i=0;i<3;i++)iceShard(b,c.ice,[side*2.35,3.2-i*.35,.34],.65+i*.2,.06,[Math.PI,0,0]);
 }else if(p.prop==='@winter_crystal'){
  for(let i=0;i<7;i++){const a=i*2.399,h=i?1.2+hash(x+i,z)*1.5:3.5;iceShard(b,i%3?c.ice:c.snow,[Math.sin(a)*.5,h*.43,Math.cos(a)*.45],h,.16+hash(i,x)*.14,[.05,i*.7,(i-3)*.08]);}
  b.oval(c.snow,[0,.12,0],[1,.2,.85]);
 }else if(p.prop==='@winter_archive'){
  b.box(c.stone,[0,.2,0],[2.4,.4,2.1]);b.box(c.dark,[0,.92,0],[1.65,1.45,1.3]);b.box(c.stone,[0,1.67,0],[2.15,.18,1.7]);
  for(const side of [-1,1])b.box(c.wood,[side*.47,1.81,0],[.91,.08,1.2],[0,0,side*.09]);
  const paper=b.own(new T.MeshStandardMaterial({color:0xd3ccb2,roughness:.95}));
  for(const side of [-1,1]){b.box(paper,[side*.44,1.88,0],[.83,.025,1.13],[0,0,side*.09]);for(let i=0;i<7;i++)b.box(c.dark,[side*.44,1.905,-.42+i*.13],[.57,.008,.014],[0,0,side*.09]);}
  b.box(c.bronze,[0,1.91,0],[.045,.025,1.25]);b.box(c.snow,[.9,1.8,.45],[.35,.08,.6]);
  for(const side of [-1,1]){b.add(new T.CylinderGeometry(.08,.1,.45,7),c.bronze,[side*.88,1.94,-.5]);b.add(new T.SphereGeometry(.04,7,5),c.ember,[side*.88,2.21,-.5]);}
 }else{
  b.add(new T.CylinderGeometry(1.05,1.2,.45,8),c.stone,[0,.225,0]);b.add(new T.CylinderGeometry(.75,.9,.35,8),c.dark,[0,.6,0]);
  const profile=[[.62,0],[.65,.35],[.47,1.6],[.48,2.2],[.3,2.5],[.15,2.75]].map(p=>new T.Vector2(...p));b.add(new T.LatheGeometry(profile,18),c.cloth,[0,.76,0]);
  b.oval(c.stone,[0,3.6,0],[.25,.35,.25]);b.add(new T.SphereGeometry(.4,16,12,0,Math.PI*2,0,Math.PI*.7),c.cloth,[0,3.69,-.08],[1,1.3,1]);
  b.oval(c.dark,[0,3.6,.19],[.18,.27,.1]);for(const side of [-1,1])b.beam([side*.4,2.9,0],[side*.56,2.1,.23],.15,c.cloth);
  b.beam([.68,.76,.3],[.68,4.25,.3],.045,c.bronze);b.box(c.bronze,[.68,4.05,.3],[.45,.07,.06]);
  b.oval(c.snow,[-.25,3.97,-.1],[.4,.1,.37]);for(let i=0;i<3;i++)iceShard(b,c.ice,[-.44+i*.22,2.9,.18],.65,.06,[Math.PI,0,0]);
 }
 b.finish();root.userData.winterDispose=b.dispose;lv.group.add(root);return true;
}

export function winterScenery(lv){
 if(!['frostpass','monastery'].includes(lv.id))return;
 const g=lv.game,root=new T.Group(),b=builder(root),edge=[];
 for(let z=1;z<lv.h-1;z++)for(let x=1;x<lv.w-1;x++){
  if(!lv.isFloor(x,z)||hash(x,z)<.56)continue;
  const dir=[[1,0],[-1,0],[0,1],[0,-1]].find(([dx,dz])=>!lv.isFloor(x+dx,z+dz));if(dir)edge.push({x:x*4+2+dir[0]*2.15,z:z*4+2+dir[1]*2.15,h:hash(z,x)});
 }
 // Low snow drifts skirt the masonry; they never become invisible navigation obstacles.
 if(edge.length){
  const geo=new T.SphereGeometry(1,9,6),mat=b.own(new T.MeshStandardMaterial({color:0xd4e5e9,roughness:.96})),banks=new T.InstancedMesh(geo,mat,edge.length),matrix=new T.Matrix4(),q=new T.Quaternion();
  edge.forEach((p,i)=>{q.setFromAxisAngle(UP,p.h*6);matrix.compose(V(p.x,-.04,p.z),q,V(.55+p.h*.65,.12+p.h*.16,.5+p.h*.5));banks.setMatrixAt(i,matrix);});banks.receiveShadow=true;banks.computeBoundingSphere();root.add(banks);b.geos.add(geo);b.instances.push(banks);
 }
 const count=g.low?150:350,flakeGeo=new T.PlaneGeometry(.055,.055),snowMat=b.own(new T.ShaderMaterial({uniforms:{time:{value:0},wind:{value:1}},transparent:true,depthWrite:false,side:T.DoubleSide,
  vertexShader:`varying vec2 p;varying float a;uniform float time,wind;void main(){p=uv;vec4 v=instanceMatrix*vec4(position,1.);v.y=mod(v.y-time*(1.2+fract(v.x)*.7),18.);v.x+=sin(v.z*.12+time*.3)*.7+mod(time*wind*.2,2.);a=.35+fract(v.z)*.4;gl_Position=projectionMatrix*modelViewMatrix*v;}`,
  fragmentShader:'varying vec2 p;varying float a;void main(){float d=length(p-.5)*2.;gl_FragColor=vec4(.78,.87,.9,(1.-smoothstep(.25,1.,d))*a);}'}));
 const flakes=new T.InstancedMesh(flakeGeo,snowMat,count),matrix=new T.Matrix4(),q=new T.Quaternion();flakes.frustumCulled=false;
 for(let i=0;i<count;i++){q.setFromEuler(new T.Euler(hash(i,8)*3,hash(i,2)*6,0));matrix.compose(V((hash(i,3)-.5)*42,hash(i,7)*18,(hash(i,11)-.5)*42),q,V(1,1+hash(i,4),1));flakes.setMatrixAt(i,matrix);}root.add(flakes);b.geos.add(flakeGeo);b.instances.push(flakes);
 let elapsed=0,mistAt=0;lv.anim.push(dt=>{if(b.disposed)return false;elapsed+=dt;snowMat.uniforms.time.value=elapsed;const p=g.player?.pos;if(p){flakes.position.set(p.x,0,p.z);mistAt-=dt;if(mistAt<=0){mistAt=g.low?1.4:.9;g.smoke?.emit({pos:{x:p.x-11,y:.3,z:p.z-6},count:1,radius:13,flat:true,speed:[1.1,1.8],up:.05,life:[3,5],size:[4,7],c0:[.42,.52,.58],c1:[.18,.27,.33],alpha:.055,tex:'smoke',grow1:1.7});}}return true;});
 root.userData.winterDispose=b.dispose;lv.group.add(root);
}

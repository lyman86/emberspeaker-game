import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
const UP=new T.Vector3(0,1,0),V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const hash=(x,z)=>{const n=Math.sin(x*127.1+z*311.7)*43758.5453;return n-Math.floor(n);};

// Static fittings are merged by material. Borrowed PBR sets belong to Materials,
// while each scene owns its geometry, clones and animation lifetime.
function builder(root){
 const geos=new Set(),mats=new Set(),batches=new Map(),instances=[];let disposed=false;
 const own=m=>{mats.add(m);return m;};
 const add=(geo,mat,pos=[0,0,0],scale=[1,1,1],rot=[0,0,0])=>{
  const matrix=new T.Matrix4().compose(new T.Vector3(...pos),new T.Quaternion().setFromEuler(new T.Euler(...rot)),new T.Vector3(...scale));
  const indexed=geo.index?geo.toNonIndexed():geo;indexed.applyMatrix4(matrix);if(indexed!==geo)geo.dispose();
  if(!batches.has(mat))batches.set(mat,[]);batches.get(mat).push(indexed);
 };
 const box=(m,p,s,r)=>add(new T.BoxGeometry(1,1,1),m,p,s,r);
 const beam=(a,b,r,m)=>{const start=new T.Vector3(...a),delta=new T.Vector3(...b).sub(start),geo=new T.CylinderGeometry(r,r*.94,delta.length(),8);geo.applyQuaternion(new T.Quaternion().setFromUnitVectors(UP,delta.clone().normalize()));add(geo,m,start.addScaledVector(delta,.5).toArray());};
 const rope=(points,r,m)=>add(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),points.length*5,r,5,false),m);
 const ring=(m,p,r,t=.025,rot=[0,0,0],arc=Math.PI*2)=>add(new T.TorusGeometry(r,t,5,24,arc),m,p,[1,1,1],rot);
 const finish=()=>{for(const [mat,parts]of batches){const geo=mergeGeometries(parts);parts.forEach(g=>g.dispose());const mesh=new T.Mesh(geo,mat);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);geos.add(geo);}batches.clear();};
 return {own,add,box,beam,rope,ring,finish,instances,get disposed(){return disposed;},trackGeo:g=>geos.add(g),dispose(){if(disposed)return;disposed=true;for(const list of batches.values())list.forEach(g=>g.dispose());batches.clear();instances.forEach(o=>o.dispose());geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());}};
}
function palette(lv,b){
 const wet=(name,color,roughness,metalness=0)=>{const m=lv.game.materials.get(name).clone();m.color.setHex(color);m.roughness=roughness;m.metalness=metalness;m.normalScale?.set(.55,.55);return b.own(m);};
 return {wood:wet('wood',0x60564a,.62),dark:wet('wood',0x302f2a,.73),stone:wet('mossy',0x59645d,.83),iron:b.own(new T.MeshStandardMaterial({color:0x293c3f,metalness:.7,roughness:.56})),bronze:b.own(new T.MeshStandardMaterial({color:0x806f48,metalness:.68,roughness:.58})),rope:b.own(new T.MeshStandardMaterial({color:0x82765a,roughness:.95})),light:b.own(new T.MeshBasicMaterial({color:0xffcc7a})),cloth:b.own(new T.MeshStandardMaterial({color:0x514d40,roughness:.95,side:T.DoubleSide}))};
}
function lantern(b,c,x,y,z){
 for(const side of [-1,1])for(const depth of [-1,1])b.beam([x+side*.13,y-.23,z+depth*.13],[x+side*.13,y+.23,z+depth*.13],.018,c.iron);
 b.box(c.iron,[x,y-.27,z],[.38,.07,.38]);b.box(c.iron,[x,y+.27,z],[.38,.06,.38]);
 b.add(new T.ConeGeometry(.28,.17,4),c.bronze,[x,y+.37,z],[1,1,1],[0,Math.PI/4,0]);
 b.add(new T.CylinderGeometry(.07,.09,.28,6),c.light,[x,y-.03,z]);b.ring(c.iron,[x,y+.52,z],.08,.015);
}

/** Model-free scenery is present only while this chapter's map is mounted. */
export function harborProp(lv,p,x,z){
 if(!['@harbor_crane','@harbor_wreck','@harbor_bollard','@harbor_bell','@harbor_brazier','@harbor_winch'].includes(p.prop))return false;
 const root=new T.Group();root.position.set(x,p.oy??0,z);root.rotation.y=p.rot??0;root.scale.setScalar(p.s??1);
 const b=builder(root),c=palette(lv,b);
 if(p.prop==='@harbor_crane'){
  b.box(c.stone,[0,.2,0],[2.5,.4,2.2]);
  for(const side of [-1,1]){b.box(c.wood,[side*.78,3.2,0],[.32,6.2,.4]);b.beam([side*1.1,.45,.75],[side*.78,3,0],.12,c.wood);b.beam([side*.78,3.6,0],[0,5.8,-2.6],.09,c.iron);}
  b.box(c.wood,[0,6,-1.2],[.45,.4,5.5],[.12,0,0]);b.box(c.wood,[0,4.2,0],[2.2,.25,.4]);
  b.add(new T.CylinderGeometry(.5,.5,1.4,12),c.dark,[0,1.8,.35],[1,1,1],[0,0,Math.PI/2]);
  for(let i=0;i<5;i++)b.ring(c.rope,[i*.15-.3,1.8,.35],.52,.035,[0,Math.PI/2,0]);
  b.rope([[0,1.8,.85],[0,4.6,.35],[0,6.2,-1],[0,5.65,-3.65],[0,2.1,-3.65]],.038,c.rope);
  b.ring(c.iron,[0,1.8,-3.65],.28,.065,[0,0,Math.PI*.2],Math.PI*1.55);
  for(let i=0;i<4;i++)b.box(c.iron,[0,2+i,0],[1.9,.1,.5]);
  lantern(b,c,1.06,3.7,.18);lv.torches.push({x:x+1,y:3.7,z,color:0xffb266,power:42,seed:x+z});
 }else if(p.prop==='@harbor_wreck'){
  // A broken keel and layered bent strakes, not a solid box pretending to be a ship.
  const length=11,width=2.65,segments=14;
  b.beam([0,-.1,-5.5],[0,.12,5.2],.22,c.dark);
  for(let i=0;i<segments;i++){
   const t=i/(segments-1),zz=(t-.5)*length,w=Math.sin(Math.PI*t)*width+.18,y=.28+Math.pow(Math.abs(t-.5)*2,2)*1.1;
   for(const side of [-1,1]){
    const end=[side*w,y+1.2+(i%3)*.12,zz];b.rope([[0,-.12,zz],[side*w*.7,.15,zz],end],.095,c.dark);
    for(let row=0;row<4;row++){
     if(i>8&&i<12&&side===1&&row>1)continue;
     b.add(new T.BoxGeometry(1,1,1),row===0?c.dark:c.wood,[side*(w*(.42+row*.19)),y*.55+row*.36,zz],[.14,.36,length/segments*1.08],[side*(.38-row*.09),side*(t-.5)*.45,0]);
    }
   }
  }
  // Calcified growth catches the moonlight along the old waterline.
  for(let i=0;i<18;i++){const side=i%2?1:-1,zz=(hash(i,4)-.5)*8,w=Math.sin((zz/11+.5)*Math.PI)*2.65;const rr=.055+hash(i,7)*.06;
   b.add(new T.CylinderGeometry(rr*.65,rr,.14,7,1,true),c.stone,[side*(w+.05),.22+hash(i,3)*.25,zz],[1,1,1],[0,0,side*Math.PI/2]);
  }
  b.beam([0,.1,0],[1.2,6.3,-1.1],.15,c.dark);b.beam([-2,3.6,-.3],[2.6,3.6,-.3],.08,c.wood);
  b.rope([[-2,3.6,-.3],[-1.4,2.5,-.7],[0,.4,-1.7]],.025,c.rope);
  b.rope([[2.6,3.6,-.3],[2.1,2.4,.1],[1.2,.7,2.9]],.025,c.rope);
  // Torn sail cut into a ragged silhouette, with cloth UVs for soft fold shading.
  const shape=new T.Shape();shape.moveTo(-1.8,0);shape.lineTo(2.3,0);shape.lineTo(1.7,-1.9);shape.lineTo(1.3,-1.6);shape.lineTo(.8,-2.4);shape.lineTo(.4,-1.7);shape.lineTo(-.2,-2.2);shape.lineTo(-1.5,-1.6);shape.closePath();
  b.add(new T.ShapeGeometry(shape,4),c.cloth,[.3,3.5,-.28],[1,1,1],[.15,.03,-.12]);
  for(let i=0;i<5;i++)b.box(c.wood,[1.8+Math.sin(i*4)*.5,.07,4+i*.4],[.2,.12,1.4],[0,i*.9,0]);
 }else if(p.prop==='@harbor_bollard'){
  b.add(new T.CylinderGeometry(.48,.6,.24,10),c.stone,[0,.12,0]);b.add(new T.CylinderGeometry(.23,.3,1,10),c.iron,[0,.7,0]);b.box(c.iron,[0,1.16,0],[1,.15,.4]);
  for(let i=0;i<4;i++)b.ring(c.rope,[0,.55+i*.08,0],.33,.04,[Math.PI/2,0,i*.12]);
  b.rope([[.3,.55,0],[.9,.17,.4],[1.3,.05,.6],[1.6,.05,.2]],.036,c.rope);
 }else if(p.prop==='@harbor_bell'){
  for(const side of [-1,1]){b.box(c.wood,[side*1.55,2.7,0],[.38,5.4,.42]);b.beam([side*2,.1,.45],[side*1.55,2,0],.12,c.wood);}
  b.box(c.dark,[0,5.15,0],[3.9,.35,.5]);
  const profile=[[.22,0],[.34,.15],[.42,.45],[.57,.95],[.82,1.4],[1.05,1.55],[1.06,1.67],[.96,1.72]].map(([r,y])=>new T.Vector2(r,1.72-y));
  b.add(new T.LatheGeometry(profile,32),c.bronze,[0,2.6,0]);b.beam([0,2.9,0],[0,4.85,0],.06,c.iron);b.add(new T.SphereGeometry(.14,10,8),c.iron,[0,2.7,0]);
  for(const y of [2.72,3.06,4.02])b.ring(c.bronze,[0,y,0],y>4?.28:y>3?.8:1.04,.035,[Math.PI/2,0,0]);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;b.box(c.iron,[Math.sin(a)*.64,3.5,Math.cos(a)*.64],[.035,.17,.04],[0,a,0]);}
  b.rope([[.2,4.8,.1],[.6,3.2,.3],[.55,1.1,.55]],.025,c.rope);lantern(b,c,-1.56,3.55,.4);
 }else if(p.prop==='@harbor_brazier'){
  b.box(c.stone,[0,.18,0],[1,.36,1]);b.beam([0,.3,0],[0,2.4,0],.07,c.iron);b.rope([[0,2.3,0],[.35,2.65,0],[.7,2.35,0]],.035,c.iron);lantern(b,c,.7,1.95,0);
  lv.torches.push({x,y:2,z,color:0xffc27c,power:48,seed:x+z});
 }else{
  b.box(c.dark,[0,.15,0],[2.5,.3,1.8]);for(const side of [-1,1]){b.box(c.wood,[side*.8,.85,0],[.3,1.5,.5]);b.ring(c.iron,[side*.92,1.1,0],.57,.05,[0,Math.PI/2,0]);}
  b.add(new T.CylinderGeometry(.32,.32,1.5,12),c.dark,[0,1.1,0],[1,1,1],[0,0,Math.PI/2]);
  for(let i=0;i<7;i++)b.ring(c.rope,[i*.14-.42,1.1,0],.35,.033,[0,Math.PI/2,0]);
  b.beam([1.1,1.1,0],[1.1,1.7,0],.04,c.iron);b.beam([1.1,1.7,0],[1.4,1.7,0],.04,c.wood);
  b.rope([[0,1.1,.35],[0,.15,1],[.7,.04,2],[.9,.04,3]],.035,c.rope);
 }
 b.finish();root.userData.harborDispose=b.dispose;lv.group.add(root);return true;
}

export function harborScenery(lv){
 if(!['harbor','wreck'].includes(lv.id))return;
 const root=new T.Group(),b=builder(root),g=lv.game,wood=g.materials.get('wood');let time=0,mistAt=0;
 const water=new T.ShaderMaterial({uniforms:{time:{value:0},tint:{value:new T.Color(lv.id==='wreck'?0x153c40:0x1d4144)}},side:T.DoubleSide,
  vertexShader:'varying vec3 world;void main(){vec3 p=position;p.y+=sin(p.x*.18+p.z*.08+time*.65)*.045+sin(p.z*.37-p.x*.13-time*.8)*.025;vec4 w=modelMatrix*vec4(p,1.);world=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
  fragmentShader:`varying vec3 world;uniform float time;uniform vec3 tint;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
  void main(){vec2 p=world.xz;float n=noise(p*.36+vec2(time*.17,-time*.12));float rip=sin(p.x*1.7+p.y*.43-time*1.6+n*2.);vec3 N=normalize(vec3(cos(p.x*.18+p.y*.08+time*.65)*.11+cos(p.x*1.7+p.y*.43-time*1.6+n*2.)*.075,1.,cos(p.y*.37-p.x*.13-time*.8)*.16));vec3 view=normalize(cameraPosition-world);float fres=pow(1.-max(0.,dot(N,view)),4.);float spec=pow(max(0.,dot(reflect(-normalize(vec3(-.3,.8,.4)),N),view)),110.);vec3 col=tint*(.48+n*.17)+vec3(.018,.035,.042)*fres;col+=vec3(.48,.62,.63)*spec*.16;col+=vec3(.004,.009,.01)*pow(.5+.5*rip,9.);gl_FragColor=vec4(col,1.);}`});
 // Uniform declaration is shared explicitly by both shader stages.
 water.vertexShader='uniform float time;\n'+water.vertexShader;b.own(water);
 const waterGeo=new T.PlaneGeometry(lv.w*4+96,lv.h*4+96,g.low?26:48,g.low?26:48).rotateX(-Math.PI/2),sea=new T.Mesh(waterGeo,water);sea.position.set(lv.w*2,-.27,lv.h*2);sea.receiveShadow=false;root.add(sea);b.trackGeo(waterGeo);
 const edges=[];
 for(let z=1;z<lv.h-1;z++)for(let x=1;x<lv.w-1;x++){
  if(!lv.isFloor(x,z))continue;
  for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]])if(!lv.isFloor(x+dx,z+dz))edges.push({x:x*4+2+dx*2,z:z*4+2+dz*2,angle:dx?Math.PI/2:0,dx,dz,wood:lv.def.g[z][x]===';'});
 }
 if(edges.length){
  const pileGeo=new T.CylinderGeometry(.14,.2,2,7),piles=new T.InstancedMesh(pileGeo,wood,edges.filter(e=>e.wood).length*2),matrix=new T.Matrix4(),q=new T.Quaternion();let index=0;
  for(const e of edges)if(e.wood)for(const side of [-1,1]){matrix.compose(V(e.x+(e.dz?side*1.65:e.dx*.14),-.82,e.z+(e.dx?side*1.65:e.dz*.14)),q,V(1,.86+hash(e.x+side,e.z)*.3,1));piles.setMatrixAt(index++,matrix);}
  piles.castShadow=!g.low;piles.computeBoundingSphere();root.add(piles);b.trackGeo(pileGeo);b.instances.push(piles);
  const foam=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{time:{value:0}},vertexShader:'varying vec2 p;varying vec3 w;void main(){p=uv;vec4 v=modelMatrix*instanceMatrix*vec4(position,1.);w=v.xyz;gl_Position=projectionMatrix*viewMatrix*v;}',fragmentShader:`varying vec2 p;varying vec3 w;uniform float time;void main(){float drift=sin(w.x*1.6+w.z*1.3+time*1.5)*.12;float edge=abs(p.y-.5+drift)*2.;float lace=pow(.5+.5*sin(w.x*4.1+w.z*3.7-time*.7),3.);float dissolve=.5+.5*sin(w.x*2.3-w.z*1.7+time*.9);float alpha=(1.-smoothstep(.05,.85,edge))*(.08+lace*.16)*dissolve;gl_FragColor=vec4(.48,.65,.62,alpha);}`});
  b.own(foam);const foamGeo=new T.PlaneGeometry(4.3,1.9).rotateX(-Math.PI/2),ribbons=new T.InstancedMesh(foamGeo,foam,edges.length);
  for(let i=0;i<edges.length;i++){const e=edges[i];q.setFromAxisAngle(UP,e.angle);matrix.compose(V(e.x+e.dx*.4,-.15,e.z+e.dz*.4),q,V(1,1,1));ribbons.setMatrixAt(i,matrix);}ribbons.computeBoundingSphere();root.add(ribbons);b.trackGeo(foamGeo);b.instances.push(ribbons);
  lv.anim.push(dt=>{if(b.disposed)return false;foam.uniforms.time.value+=dt;return true;});
 }
 root.userData.harborDispose=b.dispose;lv.group.add(root);
 lv.anim.push(dt=>{if(b.disposed)return false;time+=dt;water.uniforms.time.value=time;
  mistAt-=dt;if(mistAt<=0&&g.player?.pos){mistAt=g.low?1.2:.65;const p=g.player.pos;g.smoke?.emit({pos:{x:p.x-9,y:.45,z:p.z-5},count:1,radius:15,flat:true,speed:[.8,1.5],up:.08,life:[4,7],size:[5,9],c0:[.31,.39,.39],c1:[.13,.19,.21],alpha:.075,tex:'smoke',grow1:1.45});}
  return true;});
}

import * as THREE from 'three';
import { NOISE, energyMaterial, orbMaterial } from './vfx.js';

const UP = new THREE.Vector3(0,1,0);
const ADD = {transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending};
const ease = t => 1-Math.pow(1-Math.min(1,Math.max(0,t)),3);
const fade = (t,d) => Math.min(1,t*5)*Math.min(1,Math.max(0,(d-t)*2));
const basic = (color,opacity=1) => new THREE.MeshBasicMaterial({color,...ADD,opacity});
const v = (x,y,z) => new THREE.Vector3(x,y,z);

// Each timeline owns its geometry and materials. Map changes dispose them through Fx.clear().
function animate(g,root,duration,update,parent=g.gfx.scene) {
  root.userData.ultimateFx=true;parent.add(root);let t=0;
  g.fx.add(dt=>{t+=dt;return update(t,dt)!==false && t<duration;},()=>{
    root.removeFromParent();const geometries=new Set(),materials=new Set();
    root.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of [].concat(o.material))materials.add(m);});
    geometries.forEach(x=>x.dispose());materials.forEach(x=>x.dispose());
  });
}
function mesh(root,geometry,material,position=v(0,0,0)) {
  const m=new THREE.Mesh(geometry,material);m.position.copy(position);root.add(m);return m;
}
function ring(root,radius,color,y=0.12,width=0.035) {
  const r=mesh(root,new THREE.TorusGeometry(radius,width,6,96),basic(color),v(0,y,0));r.rotation.x=Math.PI/2;return r;
}
function runeSeal(g,at,radius,color,duration=3) {
  const root=new THREE.Group();root.position.copy(at);
  const outer=ring(root,radius,color),inner=ring(root,radius*0.77,color,0.14,0.018);
  const ticks=new THREE.InstancedMesh(new THREE.BoxGeometry(0.04,0.025,0.28),basic(color),32);
  for(let i=0;i<32;i++){
    const a=i*Math.PI/16;
    ticks.setMatrixAt(i,new THREE.Matrix4().compose(v(Math.sin(a)*radius*0.9,0.14,Math.cos(a)*radius*0.9),new THREE.Quaternion().setFromAxisAngle(UP,a),v(1,1,i%4===0?2.3:1)));
  }
  root.add(ticks);
  animate(g,root,duration,(t,dt)=>{
    root.scale.setScalar(0.85+ease(t/0.45)*0.15);root.rotation.y+=dt*0.14;
    outer.material.opacity=fade(t,duration)*0.7;inner.material.opacity=fade(t,duration)*0.4;ticks.material.opacity=fade(t,duration)*0.8;
  });
}
function earthFracture(g,c) {
  const root=new THREE.Group();root.position.copy(c);const segments=[];
  for(let ray=0;ray<6;ray++){
    let last=v(0,0.08,0);
    for(let j=1;j<=18;j++){
      const a=ray*Math.PI/3+Math.sin(j*2.9+ray)*0.04,r=j*.7;
      const next=v(Math.sin(a)*r,0.08,Math.cos(a)*r);segments.push([last.clone(),next.clone(),0.2-j*.005]);
      if(j%3===0){const branch=next.clone().add(v(Math.sin(a+0.7)*2,0,Math.cos(a+0.7)*2));segments.push([next.clone(),branch,0.13]);}
      last=next;
    }
  }
  const geo=new THREE.BoxGeometry(1,1,1);
  const edge=new THREE.InstancedMesh(geo,new THREE.MeshStandardMaterial({color:0x1d120a,roughness:1,transparent:true,opacity:.45,depthWrite:false}),segments.length);
  const lavaMat=new THREE.ShaderMaterial({
    uniforms:{time:{value:0},opacity:{value:1}},
    vertexShader:'varying vec2 vUv;varying vec3 vWorld;void main(){vUv=uv;vec4 world=modelMatrix*instanceMatrix*vec4(position,1.0);vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}',
    fragmentShader:`varying vec2 vUv;varying vec3 vWorld;uniform float time,opacity;${NOISE}
    void main(){float n=fbm(vWorld*5.+vec3(0.,time*.2,0.));float edge=abs(vUv.x-.5)*2.;float alpha=(1.-smoothstep(.45,1.,edge+n*.35))*opacity;float hot=(1.-edge)*(.45+n*.55);vec3 col=mix(vec3(.38,.028,.002),vec3(2.6,.65,.08),hot);gl_FragColor=vec4(col*alpha,alpha);}`,
    ...ADD,
  });
  const lava=new THREE.InstancedMesh(geo,lavaMat,segments.length);
  edge.frustumCulled=lava.frustumCulled=false;
  segments.forEach(([a,b,w],i)=>{
    const dir=b.clone().sub(a),mid=a.clone().add(b).multiplyScalar(0.5),q=new THREE.Quaternion().setFromAxisAngle(UP,Math.atan2(dir.x,dir.z));
    edge.setMatrixAt(i,new THREE.Matrix4().compose(mid,q,v(w*2,0.06,dir.length()+0.15)));
    lava.setMatrixAt(i,new THREE.Matrix4().compose(mid.clone().add(v(0,0.04,0)),q,v(w,0.015,dir.length()+0.07)));
  });root.add(edge,lava);
  const shock=ring(root,1,new THREE.Color(1.2,.4,.08),.16,.012);
  animate(g,root,5,(t,dt)=>{
    const opening=ease(Math.max(0,t-0.65)/0.55);edge.count=lava.count=Math.floor(opening*segments.length);
    lavaMat.uniforms.time.value=t;lavaMat.uniforms.opacity.value=Math.min(1,Math.max(0,(5-t)*.7));
    shock.visible=t>0.65&&t<1.5;shock.scale.setScalar(1+Math.max(0,t-0.65)*19);shock.material.opacity=Math.max(0,1-(t-.65)/.85)*.5;
    if(t>0.7&&t<2 && Math.random()<dt*18){const a=Math.random()*6.28,r=2+Math.random()*9;g.particles.emit({pos:{x:c.x+Math.sin(a)*r,y:0.2,z:c.z+Math.cos(a)*r},count:g.low?2:4,up:3,speed:[0.3,2],life:[0.5,1.1],size:[0.08,0.22],c0:[3,1.2,0.3],c1:[0.5,0.04,0],tex:'glint',gravity:3});}
  });
  g.after(0.65,()=>{g.fx.shockwave(c,{r1:22,dur:0.65,strength:0.035});g.fx.dustWall(c,{r1:13,dur:0.65,h:2.5,color:[0.28,0.19,0.12]});g.gfx.addShake(0.85);g.hitStop(0.045);});
}
function arrowStorm(g,c,rank) {
  g.fx.glyph(c,{tex:'twirl',color:[.12,.5,.32],r:12,dur:4.2,spin:.18});
  const root=new THREE.Group();root.position.copy(c);const n=g.low?70:130;
  const shafts=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.025,0.025,1.7,4),new THREE.MeshStandardMaterial({color:0x62452b,roughness:.8}),n);
  const heads=new THREE.InstancedMesh(new THREE.ConeGeometry(0.1,0.32,4).rotateZ(Math.PI),new THREE.MeshStandardMaterial({color:0x86948b,metalness:.7,roughness:.3,emissive:rank>=3?0x9c3107:0x16473c,emissiveIntensity:1.6}),n);
  const vanes=new THREE.InstancedMesh(new THREE.PlaneGeometry(.2,.45),new THREE.MeshStandardMaterial({color:0xb9c5b3,roughness:.9,side:THREE.DoubleSide}),n);
  const seeds=Array.from({length:n},(_,i)=>{const a=i*2.39996,r=Math.sqrt((i+0.5)/n)*11.5;return {x:Math.cos(a)*r,z:Math.sin(a)*r,delay:(i%23)/23*0.9};});
  root.add(shafts,heads,vanes);shafts.frustumCulled=heads.frustumCulled=vanes.frustumCulled=false;
  const q=new THREE.Quaternion().setFromAxisAngle(v(0,0,1),0.16),matrix=new THREE.Matrix4();
  animate(g,root,4.5,t=>{
    for(let i=0;i<n;i++){
      const s=seeds[i],cycle=(t-s.delay)/0.75,k=cycle-Math.floor(cycle),visible=t>=s.delay&&t<4;
      const y=visible?19*(1-k*k):-100;
      shafts.setMatrixAt(i,matrix.compose(v(s.x+(1-k)*2,y+0.9,s.z),q,v(1,1,1)));
      heads.setMatrixAt(i,matrix.compose(v(s.x+(1-k)*2,y,s.z),q,v(1,1,1)));
      vanes.setMatrixAt(i,matrix.compose(v(s.x+(1-k)*2+.2,y+1.5,s.z),q,v(1,1,1)));
    }shafts.instanceMatrix.needsUpdate=heads.instanceMatrix.needsUpdate=vanes.instanceMatrix.needsUpdate=true;
    shafts.visible=heads.visible=vanes.visible=t<4;
  });
  if(rank>=5){
    const eagle=new THREE.Group(),mat=basic(new THREE.Color(0.8,2.2,1.6),0.7);
    mesh(eagle,new THREE.ConeGeometry(0.23,1.8,6).rotateX(Math.PI/2),mat);
    const featherGeo=new THREE.ConeGeometry(0.17,2.6,3).rotateZ(-Math.PI/2);
    const wings=[];
    for(const sign of [-1,1]){
      const wing=new THREE.Group();eagle.add(wing);wings.push(wing);
      for(let j=0;j<6;j++){const f=mesh(wing,featherGeo,mat,v(sign*(0.5+j*0.36),0,j*0.19));f.scale.x=sign;f.rotation.y=sign*j*0.12;}
    }
    animate(g,eagle,4.2,t=>{
      const k=Math.min(1,Math.max(0,(t-2.8)/1.2));eagle.visible=t>2.8;
      eagle.position.copy(c).add(v((1-k)*9,18*(1-k*k)+0.4,(1-k)*5));eagle.scale.setScalar(0.7+k*0.5);
      wings[0].rotation.z=Math.sin(t*12)*0.18;wings[1].rotation.z=-Math.sin(t*12)*0.18;
      mat.opacity=Math.min(0.8,Math.max(0,(4.2-t)*4));
    });
  }
}
function infernalRift(g,c,rank) {
  const root=new THREE.Group();root.position.copy(c).add(v(0,13,0));root.rotation.x=-0.6;
  const rimMat=energyMaterial({color:[3,0.85,0.12],map:g.fx.tex.twirl,polar:true,scale:6,flow:[0.2,-0.6]});
  const rim=mesh(root,new THREE.RingGeometry(2.6,3.5,96),rimMat);
  const coreMat=new THREE.ShaderMaterial({uniforms:{time:{value:0},opacity:{value:1}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:`varying vec2 vUv;uniform float time,opacity;${NOISE}
    void main(){vec2 p=vUv-.5;float r=length(p);float a=atan(p.y,p.x);float n=fbm(vec3(a*1.5-r*8.+time,r*9.-time*2.,time*.4));float edge=smoothstep(.27,.49,r);float alpha=(1.-smoothstep(.45,.5,r))*opacity;vec3 col=mix(vec3(.012,.002,.001),vec3(2.2,.3,.025)*(n*.8+.2),edge);gl_FragColor=vec4(col,alpha);}`,transparent:true,side:THREE.DoubleSide,depthWrite:false});
  mesh(root,new THREE.CircleGeometry(3,64),coreMat,v(0,0,-0.02));
  const shards=[];
  for(let i=0;i<12;i++){const a=i*Math.PI/6;const s=mesh(root,new THREE.OctahedronGeometry(0.3,0),new THREE.MeshStandardMaterial({color:0x28100a,emissive:0x7c2606}),v(Math.sin(a)*3.4,Math.cos(a)*3.4,0));shards.push(s);}
  animate(g,root,3.8,(t,dt)=>{
    const k=ease(t/.55)*Math.min(1,Math.max(0,(3.8-t)*2));root.scale.set(1.4*k,0.8*k,k);rim.rotation.z+=dt*.45;
    rimMat.uniforms.time.value+=dt;rimMat.uniforms.opacity.value=Math.min(1,(3.8-t)*2);coreMat.uniforms.time.value=t;coreMat.uniforms.opacity.value=k;
    shards.forEach((s,i)=>{s.rotation.x+=dt*(i%2?1:-1);s.rotation.z+=dt*.7;});
  });
  // Three broken, noise-eroded spiral sheets replace the opaque cone.
  const tornado=new THREE.Group();tornado.position.copy(c);
  const strips=[];
  for(let band=0;band<(g.low?2:3);band++){
    const vertices=[],uv=[],idx=[];
    for(let i=0;i<=90;i++){
      const u=i/90,y=u*9,a=u*Math.PI*5+band*Math.PI*2/3,r=0.9+u*3.2;
      for(const side of [-1,1]){vertices.push(Math.sin(a)*(r+side*.25),y+side*.6,Math.cos(a)*(r+side*.25));uv.push(u,side<0?0:1);}
      if(i<90){const j=i*2;idx.push(j,j+1,j+2,j+1,j+3,j+2);}
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();
    const mat=energyMaterial({color:band===0?[2.5,.65,.08]:[1.4,.22,.025],scale:8,flow:[-1.7,-.3],opacity:0.6});
    strips.push(mesh(tornado,geo,mat));
  }
  animate(g,tornado,3.4,(t,dt)=>{
    tornado.rotation.y+=dt*3.5;const k=fade(t,3.4);tornado.scale.set(0.8+ease(t)*0.2,k,0.8+ease(t)*0.2);
    for(const s of strips){s.material.uniforms.time.value+=dt;s.material.uniforms.opacity.value=k*.65;s.material.uniforms.progress.value=.15;}
    if(Math.random()<dt*22)g.fx.flames(c,{count:g.low?2:4,radius:3,size:[0.6,1.4],up:5});
  });
}
export function meteorDescent(g,c,impactDelay) {
  const root=new THREE.Group();const rockMat=new THREE.MeshStandardMaterial({color:0x20140e,roughness:.9,emissive:0x742200,normalMap:g.materials.tex.dark_rock.nor});
  mesh(root,new THREE.IcosahedronGeometry(1.2,2),rockMat);
  const shell=mesh(root,new THREE.IcosahedronGeometry(1.23,2),orbMaterial({core:[2.4,.5,.04],edge:[.7,.05,.005],scale:6,speed:2}));
  const start=c.clone().add(v(-7,25,-5));root.position.copy(start);root.updateMatrixWorld(true);g.fx.trail(root,{width:1.7,color:[2.8,.65,.08],life:.32});
  animate(g,root,impactDelay+.15,(t,dt)=>{
    const k=Math.max(0,Math.min(1,(t-(impactDelay-.6))/.6));root.visible=t>impactDelay-.6&&t<impactDelay;
    root.position.lerpVectors(start,c,k*k);root.rotation.x+=dt*4;root.rotation.z+=dt*3;shell.material.uniforms.time.value+=dt;
    if(root.visible){g.fx.flames(root.position,{count:g.low?1:3,radius:.55,size:[.6,1.6],up:1});g.particles.emit({pos:root.position,count:2,speed:[0.5,2],life:[.15,.4],size:[.07,.2],c0:[3,1.4,.25],c1:[.4,.05,0],tex:'glint'});}
  });
}
function seraphWings(g,p) {
  const root=new THREE.Group(),white=new THREE.ShaderMaterial({
    uniforms:{opacity:{value:.65}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:`varying vec2 vUv;uniform float opacity;void main(){float rachis=exp(-abs(vUv.x-.5)*70.);float barb=sin(vUv.y*170.+abs(vUv.x-.5)*35.)*.5+.5;float tip=smoothstep(.25,.95,vUv.y);vec3 col=mix(vec3(.62,.46,.22),vec3(1.05,.97,.73),tip);col*=.85+barb*.15;col+=vec3(.32,.23,.09)*rachis;float a=opacity*smoothstep(0.,.08,vUv.y);gl_FragColor=vec4(col,a);}`,
    transparent:true,depthWrite:false,side:THREE.DoubleSide,
  }),gold=basic(new THREE.Color(1.1,.75,.25),.45);
  const feather=new THREE.Shape();feather.moveTo(0,0);feather.bezierCurveTo(.18,.4,.28,1.4,.02,2.8);feather.bezierCurveTo(-.22,1.6,-.18,.5,0,0);
  const geo=new THREE.ShapeGeometry(feather,10),wings=[];
  const uv=geo.attributes.uv,pos=geo.attributes.position;for(let i=0;i<uv.count;i++)uv.setXY(i,(pos.getX(i)+.25)/.5,pos.getY(i)/2.8);
  for(const sign of [-1,1]){
    const wing=new THREE.Group();wing.position.set(sign*.25,1.8,-.3);root.add(wing);wings.push(wing);
    const count=g.low?9:13;
    for(let i=0;i<count;i++){
      const f=mesh(wing,geo,white,v(sign*i*.09,i*.015,-i*.025));f.rotation.z=-sign*(.4+i*.085);f.scale.set(1,1-i*.035,1);
      const spine=mesh(wing,new THREE.CylinderGeometry(.008,.018,1.8,4),gold,v(sign*(.2+i*.13),1.1-i*.025,-.05-i*.025));spine.rotation.z=-sign*(.4+i*.085);
    }
  }
  const halo=mesh(root,new THREE.TorusGeometry(.65,.025,5,64),gold,v(0,3.6,0));halo.rotation.x=Math.PI*.35;
  animate(g,root,6,(t,dt)=>{
    const k=ease(t/.6)*Math.min(1,(6-t)*2);white.uniforms.opacity.value=.9*k;gold.opacity=.5*k;
    wings.forEach((w,i)=>{w.scale.set(k,k,k);w.rotation.y=(i?1:-1)*(.18+Math.sin(t*2.5)*.1);});halo.rotation.z+=dt*.4;
  },p.root);
}
export function judgmentBeam(g,c) {
  const root=new THREE.Group();root.position.copy(c);
  const mat=energyMaterial({color:[1.5,1.25,.6],scale:7,flow:[.1,-3],opacity:.6});
  const sheath=mesh(root,new THREE.CylinderGeometry(.55,1.1,24,24,1,true),mat,v(0,12,0));
  const core=mesh(root,new THREE.CylinderGeometry(.045,.13,24,8),basic(new THREE.Color(2,1.8,1.25)),v(0,12,0));
  const impact=ring(root,.9,new THREE.Color(2,1.6,.6),.12,.04);
  animate(g,root,.7,(t,dt)=>{
    const k=1-t/.7;mat.uniforms.time.value+=dt;mat.uniforms.opacity.value=k*.65;
    sheath.scale.x=sheath.scale.z=.5+ease(t/.15)*.5;core.material.opacity=Math.max(0,1-t*2);impact.scale.setScalar(1+ease(t/.7)*3);impact.material.opacity=k;
  });
  g.fx.ground(c,{tex:'magic1',color:[1.4,1.15,.5],r0:1,r1:3,dur:.2,hold:.55,opacity:.55});
  g.gfx.flash(c,0xffe7ad,100,.35,12);
}
export function summonSigil(g,c,big=false) {
  const root=new THREE.Group();root.position.copy(c);const r=big?2:1.1;
  const outer=ring(root,r,new THREE.Color(.25,1.5,1.1)),inner=ring(root,r*.7,new THREE.Color(.7,2.3,1.5),.14,.02);
  const bones=new THREE.InstancedMesh(new THREE.ConeGeometry(.07,.65,4),new THREE.MeshStandardMaterial({color:0xc2c3a0,emissive:0x154331}),12);
  for(let i=0;i<12;i++){const a=i*Math.PI/6;bones.setMatrixAt(i,new THREE.Matrix4().compose(v(Math.sin(a)*r,.2,Math.cos(a)*r),new THREE.Quaternion().setFromAxisAngle(v(Math.cos(a),0,-Math.sin(a)),.3),v(1,1,1)));}root.add(bones);
  animate(g,root,2,(t,dt)=>{outer.rotation.z+=dt*.7;inner.rotation.z-=dt;outer.material.opacity=inner.material.opacity=fade(t,2);bones.position.y=-.6+ease(t/.5)*.8;});
  g.smoke.emit({pos:c,count:g.low?5:10,radius:r,speed:[.1,.5],up:1.8,life:[.8,1.8],size:[1.2,2.6],c0:[.08,.25,.18],c1:[.02,.06,.05],alpha:.4,tex:'smoke'});
}
function necroticCovenant(g,c) {
  runeSeal(g,c,6,new THREE.Color(.2,1.6,1.1),4);
  g.fx.glyph(c,{tex:'magic2',color:[.18,1,.65],r:4.8,dur:3.6,spin:-.2});
  const root=new THREE.Group();root.position.copy(c);const n=g.low?16:28,mat=basic(new THREE.Color(.4,2.3,1.4),.7);
  const souls=new THREE.InstancedMesh(new THREE.SphereGeometry(.09,5,4),mat,n);souls.frustumCulled=false;root.add(souls);
  const matrix=new THREE.Matrix4(),q=new THREE.Quaternion();
  animate(g,root,4,(t,dt)=>{
    for(let i=0;i<n;i++){const a=i*2.399+t*.7,r=2+i/n*4,up=(t+i/n*3)%3;souls.setMatrixAt(i,matrix.compose(v(Math.sin(a)*r,up,Math.cos(a)*r),q,v(1,2.5,1)));}
    souls.instanceMatrix.needsUpdate=true;mat.opacity=fade(t,4)*.7;
  });
}
export function ultimateOpening(g,p,c,cls,rank) {
  g.gfx.addShake(.2);
  if(cls==='warrior')earthFracture(g,c);
  else if(cls==='ranger')arrowStorm(g,c,rank);
  else if(cls==='mage')infernalRift(g,c,rank);
  else if(cls==='paladin'){
    runeSeal(g,c,7,new THREE.Color(.65,.46,.18),3);
    if(rank>=5)seraphWings(g,p);
  } else necroticCovenant(g,p.pos.clone());
}
export function boneGolemRegalia(g,ally) {
  const root=new THREE.Group(),bone=new THREE.MeshStandardMaterial({color:0xc6c3aa,roughness:.72,emissive:0x0a2017}),soul=basic(new THREE.Color(.3,1.7,1.1),.8);
  mesh(root,new THREE.CylinderGeometry(.065,.1,1.2,7),bone,v(0,1.25,-.16));
  for(let i=0;i<4;i++){
    const rib=mesh(root,new THREE.TorusGeometry(.42-i*.025,.045,6,22,Math.PI*1.6),bone,v(0,1+i*.17,0));rib.rotation.x=Math.PI/2;rib.rotation.z=-Math.PI*.3;rib.scale.y=.75;
  }
  for(const sign of [-1,1])for(let j=0;j<3;j++){
    const spike=mesh(root,new THREE.ConeGeometry(.12,.5+j*.13,5),bone,v(sign*(.4+j*.13),1.75-j*.08,0));spike.rotation.z=-sign*(.3+j*.2);
  }
  const skull=mesh(root,new THREE.IcosahedronGeometry(.29,1),bone,v(0,2.13,.04));skull.scale.set(1,1.1,.8);
  mesh(root,new THREE.BoxGeometry(.32,.12,.22),bone,v(0,1.89,.1));
  for(const sign of [-1,1])mesh(root,new THREE.SphereGeometry(.055,6,4),soul,v(sign*.1,2.14,.25));
  animate(g,root,15,(t,dt)=>{soul.opacity=.6+Math.sin(t*3)*.18;return ally.alive;},ally.root);
}

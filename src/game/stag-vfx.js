import * as THREE from 'three';

const UP=new THREE.Vector3(0,1,0),V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
const transparent={transparent:true,depthWrite:false,side:THREE.DoubleSide};
const amber=0xe9b35e,verdigris=0x9bbf78;
const basic=(color,opacity=1)=>new THREE.MeshBasicMaterial({color,opacity,...transparent});
function mesh(root,geo,mat,pos=V()) {const m=new THREE.Mesh(geo,mat);m.position.copy(pos);root.add(m);return m;}
function orient(root,at,dir) {root.position.copy(at);root.position.y=0;root.rotation.y=Math.atan2(dir?.x??0,dir?.z??1);return root;}

/** Every timeline owns its resources; Fx.clear() cancels them on retry or map changes. */
function timeline(g,root,duration,update) {
  root.userData.stagFx=true;g.gfx.scene.add(root);let t=0,stopped=false,disposed=false;
  const dispose=()=>{if(disposed)return;disposed=true;root.removeFromParent();const geos=new Set(),mats=new Set();root.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.geometry)geos.add(o.geometry);for(const m of [].concat(o.material??[]))mats.add(m);});for(const x of geos)x.dispose();for(const x of mats)x.dispose();};
  g.fx.add(dt=>{if(stopped)return false;if(g.cinematic)return true;t+=dt;return update(t,dt)!==false&&t<duration;},dispose);
  return {stop(){stopped=true;dispose();},root};
}
function polygon(points) {
  const shape=new THREE.Shape();points.forEach(([x,z],i)=>i?shape.lineTo(x,z):shape.moveTo(x,z));shape.closePath();
  const geo=new THREE.ShapeGeometry(shape),p=geo.attributes.position;for(let i=0;i<p.count;i++){const z=p.getY(i);p.setXYZ(i,p.getX(i),.075,z);}geo.computeVertexNormals();return geo;
}
function line(root,points,color=amber,width=.035,opacity=.9) {
  const path=new THREE.CatmullRomCurve3(points),segments=Math.max(2,points.length*2);
  return mesh(root,new THREE.TubeGeometry(path,segments,width,4,false),basic(color,opacity));
}
function arc(root,r,from,to,color=amber,width=.03,y=.1) {
  const points=[];for(let i=0;i<=48;i++){const a=from+(to-from)*i/48;points.push(V(Math.sin(a)*r,y,Math.cos(a)*r));}return line(root,points,color,width);
}
function warningMaterial(extent,directional) {
  return new THREE.ShaderMaterial({uniforms:{progress:{value:0},time:{value:0},extent:{value:extent},directional:{value:directional?1:0}},...transparent,
    vertexShader:'varying vec2 p;void main(){p=position.xz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec2 p;uniform float progress,time,extent,directional;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){float distance=mix(length(p),p.y,directional)/max(.01,extent);float fill=1.-smoothstep(progress-.018,progress+.018,distance);float pulse=.5+.5*sin(time*7.);float cracks=pow(1.-abs(sin(p.x*3.1+sin(p.y*1.7)*.55)),18.);float grain=hash(floor(p*40.));float scan=pow(.5+.5*sin(p.y*10.+p.x*2.),16.);
      vec3 col=mix(vec3(.38,.20,.065),vec3(.92,.59,.20),fill*.7+cracks*.2);float opacity=.065+fill*.17+cracks*.04+scan*.035;opacity*=.9+pulse*.1;gl_FragColor=vec4(col,opacity*(.9+grain*.1));}`});
}
/** Sector/lane/disc bounds match the supplied damage footprint, rather than an unrelated generic circle. */
export function stagTelegraph(g,{kind='cleave',origin,dir=V(0,0,1),radius=6,length=18,width=3,duration=1,angle=Math.PI*.8}={}) {
  const root=orient(new THREE.Group(),origin,dir),points=[],directional=kind==='charge'||kind==='roots',extent=directional?length:radius;
  if(directional)points.push([-width/2,0],[width/2,0],[width/2,length],[-width/2,length]);
  else if(kind==='cleave'){points.push([0,0]);for(let i=0;i<=48;i++){const a=-angle/2+angle*i/48;points.push([Math.sin(a)*radius,Math.cos(a)*radius]);}}
  else {for(let i=0;i<=80;i++){const a=i*Math.PI/40;points.push([Math.sin(a)*radius,Math.cos(a)*radius]);}}
  const mat=warningMaterial(extent,directional);mesh(root,polygon(points),mat);
  if(directional){
    const edgeMat=basic(amber,.85),geo=new THREE.BoxGeometry(.045,.025,length);
    for(const side of [-1,1])mesh(root,geo,edgeMat,V(side*width/2,.1,length/2));
    line(root,[V(-width/2,.1,length),V(width/2,.1,length)],amber,.035);
    const n=Math.max(2,Math.floor(length/2.8));for(let i=1;i<=n;i++){
      const z=i*length/(n+1),d=width*.2;
      line(root,[V(-d,.11,z-.35),V(0,.11,z),V(d,.11,z-.35)],amber,.025,.65);
    }
    if(kind==='roots')for(let i=0;i<5;i++){
      const z=(i+.7)*length/5;arc(root,.36,-Math.PI,Math.PI,0xc4a16b,.02,.12).position.set(Math.sin(i*2.4)*width*.25,0,z);
    }
  }else{
    const half=kind==='cleave'?angle/2:Math.PI;
    arc(root,radius,-half,half,amber,.045);arc(root,radius*.97,-half,half,0x9a6632,.018,.105);
    if(kind==='cleave')for(const a of [-half,half])line(root,[V(),V(Math.sin(a)*radius,.1,Math.cos(a)*radius)],amber,.025);
    const count=g.low?12:24;for(let i=0;i<count;i++){
      const a=-half+(i+.5)/count*half*2,r=radius-.22;
      line(root,[V(Math.sin(a)*r,.115,Math.cos(a)*r),V(Math.sin(a)*(r-.25),.115,Math.cos(a)*(r-.25))],amber,.018,.7);
    }
  }
  return timeline(g,root,duration,t=>{mat.uniforms.progress.value=clamp(t/duration);mat.uniforms.time.value=t;});
}

export function stagSlash(g,origin,dir,radius=6,angle=Math.PI*.8) {
  const root=orient(new THREE.Group(),origin,dir),blades=[];
  for(let j=0;j<3;j++){
    const vertices=[],uv=[],idx=[],n=g.low?28:48;
    for(let i=0;i<=n;i++){
      const a=-angle/2+angle*i/n;
      for(let s=0;s<2;s++){const r=radius-(s?1.15:.05)-j*.18;vertices.push(Math.sin(a)*r,.6+j*.38+Math.sin(a)*.3,Math.cos(a)*r);uv.push(i/n,s);}
      if(i<n){const k=i*2;idx.push(k,k+1,k+2,k+1,k+3,k+2);}
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();
    const mat=new THREE.ShaderMaterial({uniforms:{progress:{value:0},alpha:{value:1}},...transparent,
      vertexShader:'varying vec2 p;void main(){p=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`varying vec2 p;uniform float progress,alpha;void main(){float tail=smoothstep(progress-.35,progress-.02,p.x)*(1.-smoothstep(progress,progress+.08,p.x));float edge=pow(1.-p.y,2.);vec3 col=mix(vec3(.12,.26,.13),vec3(.84,.93,.65),edge);gl_FragColor=vec4(col,tail*edge*alpha*.85);}`});
    blades.push(mesh(root,geo,mat));
  }
  g.particles?.emit({pos:origin,count:g.low?8:16,radius:1.5,speed:[2,5],up:1.2,life:[.4,.9],size:[.06,.15],c0:[.65,.8,.4],c1:[.06,.14,.045],gravity:5,tex:'glint'});
  return timeline(g,root,.6,t=>{blades.forEach((m,j)=>{m.material.uniforms.progress.value=clamp(t/.38-j*.05);m.material.uniforms.alpha.value=1-clamp((t-.35)/.25);});});
}

export function stagRoots(g,origin,dir,length=18) {
  const root=orient(new THREE.Group(),origin,dir),roots=[],wood=g.materials?.get?.('bark')?.clone?.()??new THREE.MeshStandardMaterial({color:0x3c4031,roughness:.95});
  wood.transparent=true;const vein=basic(0x86a55b,.45),n=g.low?7:12;
  for(let i=0;i<n;i++){
    const z=(i+.5)*length/n,x=Math.sin(i*2.399)*.95,height=.9+(i%3)*.38,side=i%2?1:-1;
    const path=new THREE.CatmullRomCurve3([V(x,0,z),V(x+side*.22,height*.3,z+.05),V(x+side*.4,height*.8,z+.35),V(x+side*.18,height,z+.65)]);
    const stem=mesh(root,new THREE.TubeGeometry(path,12,.14+(i%3)*.035,6,false),wood);
    const branch=new THREE.CatmullRomCurve3([V(x,height*.35,z+.05),V(x-side*.42,height*.7,z+.1),V(x-side*.56,height*.8,z+.35)]);
    stem.add(new THREE.Mesh(new THREE.TubeGeometry(branch,8,.075,5,false),wood));
    const seam=mesh(root,new THREE.TubeGeometry(path,12,.022,4,false),vein);seam.position.x=.1;
    roots.push({stem,seam,delay:i/n*.65});
  }
  g.audio?.play('e_roots',origin,.65);
  return timeline(g,root,2.7,t=>{
    const fade=1-clamp((t-1.8)/.9);wood.opacity=fade;vein.opacity=fade*.45;
    for(const o of roots){const k=smooth((t-o.delay)/.3);o.stem.scale.y=o.seam.scale.y=k*fade;o.stem.visible=o.seam.visible=t>=o.delay;}
    if(t<.7&&Math.random()<.3)g.particles?.emit({pos:origin.clone().addScaledVector(dir,clamp(t/.7)*length),count:g.low?2:4,radius:.8,speed:[.2,2],up:2,life:[.35,.7],size:[.1,.24],c0:[.25,.28,.18],c1:[.05,.07,.035],gravity:8,tex:'dirt'});
  });
}

export function stagShockwave(g,origin,radius,duration=1.8) {
  const root=new THREE.Group();root.position.copy(origin);root.position.y=.13;
  const waveMat=new THREE.ShaderMaterial({uniforms:{time:{value:0},alpha:{value:.8}},...transparent,
    vertexShader:'varying vec2 p;void main(){p=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec2 p;uniform float time,alpha;void main(){float edge=sin(p.y*3.14159);float a=atan(p.y-.5,p.x-.5);float weave=.62+.38*sin(a*42.-time*4.);vec3 col=mix(vec3(.13,.25,.17),vec3(.68,.78,.43),edge);gl_FragColor=vec4(col,edge*alpha*weave);}`});
  const ground=mesh(root,new THREE.RingGeometry(.965,1.035,g.low?64:112).rotateX(-Math.PI/2),waveMat);
  const curtain=mesh(root,new THREE.CylinderGeometry(1,1,.7,g.low?64:112,1,true),basic(0x829b65,.16),V(0,.25,0));
  const ticks=new THREE.InstancedMesh(new THREE.BoxGeometry(.025,.2,.035),basic(0xc2b272,.45),g.low?28:56);ticks.frustumCulled=false;root.add(ticks);
  return timeline(g,root,duration,t=>{
    const r=radius*clamp(t/duration),fade=1-clamp((t/duration-.8)/.2);ground.scale.set(r,1,r);curtain.scale.set(r,1,r);curtain.material.opacity=.16*fade;
    waveMat.uniforms.time.value=t;waveMat.uniforms.alpha.value=.72*fade;
    const matrix=new THREE.Matrix4(),q=new THREE.Quaternion();for(let i=0;i<ticks.count;i++){const a=i/ticks.count*Math.PI*2;matrix.compose(V(Math.sin(a)*r,.2+Math.sin(a*7+t*8)*.08,Math.cos(a)*r),q,V(1,1,1));ticks.setMatrixAt(i,matrix);}ticks.instanceMatrix.needsUpdate=true;ticks.material.opacity=.45*fade;
  });
}

export function stagChargeTrail(g,e) {
  const root=new THREE.Group(),left=new THREE.Group(),right=new THREE.Group();root.add(left,right);
  const mat=basic(verdigris,.5),geo=new THREE.ConeGeometry(.08,1.2,4).rotateX(-Math.PI/2);
  for(const [side,part]of [[-1,left],[1,right]])for(let i=0;i<5;i++){
    const shard=mesh(part,geo,mat,V(side*(.5+i*.07),1.9+i*.08,-i*.3));shard.scale.setScalar(1-i*.12);
  }
  let acc=0;
  return timeline(g,root,1.4,(t,dt)=>{
    if(!e.alive||e.asleep)return false;root.position.copy(e.pos);root.rotation.y=e.facing??0;mat.opacity=.5*(1-clamp((t-1)/.4));acc+=dt;
    if(acc>.07){acc=0;g.particles?.emit({pos:{x:e.pos.x,y:.25,z:e.pos.z},count:g.low?2:4,radius:.7,speed:[.2,1.2],up:.7,life:[.4,.8],size:[.1,.25],c0:[.34,.38,.23],c1:[.05,.08,.04],tex:'dirt',gravity:3});}
  });
}

import * as T from 'three';
const TAU=Math.PI*2,UP=new T.Vector3(0,1,0),V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),clamp=x=>Math.max(0,Math.min(1,x));
const transparent={transparent:true,depthWrite:false,side:T.DoubleSide};
const glow=(color,opacity=1)=>new T.MeshBasicMaterial({color,opacity,...transparent,blending:T.AdditiveBlending});
function mesh(root,geo,mat,p=V()){const m=new T.Mesh(geo,mat);m.position.copy(p);root.add(m);return m;}
function timeline(g,root,duration,step){
 root.userData.harborFx=true;g.gfx.scene.add(root);let t=0,disposed=false;
 const dispose=()=>{if(disposed)return;disposed=true;root.removeFromParent();const geos=new Set(),mats=new Set();root.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.geometry)geos.add(o.geometry);for(const m of [].concat(o.material??[]))mats.add(m);});geos.forEach(x=>x.dispose());mats.forEach(x=>x.dispose());};
 g.fx.add(dt=>{if(disposed)return false;if(g.cinematic)return true;t+=dt;return step(t,dt)!==false&&t<duration;},dispose);return {stop:dispose,root};
}
function ribbon(root,points,r,mat){return mesh(root,new T.TubeGeometry(new T.CatmullRomCurve3(points),points.length*2,r,5,false),mat);}
function ring(root,r,mat,y=.12,arc=TAU){const m=mesh(root,new T.TorusGeometry(r,.045,5,96,arc),mat,V(0,y,0));m.rotation.x=Math.PI/2;return m;}
function spray(root,count,color){const m=new T.InstancedMesh(new T.SphereGeometry(.07,5,4),glow(color,.7),count);m.frustumCulled=false;root.add(m);return m;}
const water=()=>new T.MeshPhysicalMaterial({color:0x1f6879,metalness:.22,roughness:.2,clearcoat:.8,...transparent,opacity:.7});

/** Crimson danger, warm countdown, cyan openings: collision footprints stay visible under spell effects. */
export function harborTelegraph(g,{kind='disc',origin,dir=V(0,0,1),radius=6,length=22,width=3,duration=1,angle=Math.PI*.85}={}){
 const root=new T.Group();root.position.copy(origin);root.rotation.y=Math.atan2(dir.x,dir.z);const lane=kind==='charge',points=[];
 if(lane)points.push([-width/2,0],[width/2,0],[width/2,length],[-width/2,length]);
 else{if(kind==='cleave')points.push([0,0]);const half=kind==='cleave'?angle/2:Math.PI;for(let i=0;i<=64;i++){const a=-half+i/64*half*2;points.push([Math.sin(a)*radius,Math.cos(a)*radius]);}}
 const shape=new T.Shape();points.forEach(([x,z],i)=>i?shape.lineTo(x,z):shape.moveTo(x,z));shape.closePath();const geo=new T.ShapeGeometry(shape),pos=geo.attributes.position;for(let i=0;i<pos.count;i++)pos.setXYZ(i,pos.getX(i),.08,pos.getY(i));geo.computeVertexNormals();
 const mat=new T.ShaderMaterial({uniforms:{time:{value:0},progress:{value:0},extent:{value:lane?length:radius},lane:{value:lane?1:0}},...transparent,
 vertexShader:'varying vec2 p;void main(){p=position.xz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:`varying vec2 p;uniform float time,progress,extent,lane;void main(){float d=mix(length(p),p.y,lane)/extent;float fill=1.-smoothstep(progress-.025,progress+.025,d);float rune=pow(.5+.5*sin(p.x*5.+p.y*3.-time*2.),14.);float pulse=.75+.25*sin(time*8.);vec3 color=mix(vec3(.38,.025,.07),vec3(1.25,.25,.07),fill*.7+rune*.2);gl_FragColor=vec4(color,(.12+fill*.16+rune*.05)*pulse);}`});mesh(root,geo,mat);
 const border=glow(0xff8b62,.8),outline=points.map(([x,z])=>V(x,.12,z));outline.push(outline[0].clone());ribbon(root,outline,.035,border);
 return timeline(g,root,duration,t=>{mat.uniforms.time.value=t;mat.uniforms.progress.value=clamp(t/duration);border.opacity=.6+.3*Math.sin(t*10)**2;});
}
export function harborSplash(g,p,r=3){
 const root=new T.Group();root.position.copy(p);const mat=water(),rim=ring(root,1,mat),inner=ring(root,1,glow(0x8de9ed,.6),.18);const drops=spray(root,g.low?18:42,0xabe8ed),matrix=new T.Matrix4(),q=new T.Quaternion();
 g.audio.play('h_surge',p,.55);g.fx.shockwave(p,{r1:r*1.5,dur:.5,strength:.014});
 return timeline(g,root,1.05,t=>{const k=clamp(t/1.05);rim.scale.setScalar(.4+k*r);inner.scale.setScalar(.3+k*r*.75);mat.opacity=.7*(1-k);inner.material.opacity=.7*(1-k);drops.material.opacity=.8*(1-k);for(let i=0;i<drops.count;i++){const a=i*2.399,d=.2+k*(r*.55+(i%4)*.3);matrix.compose(V(Math.sin(a)*d,Math.max(.05,Math.sin(k*Math.PI)*(1.2+(i%3)*.7)),Math.cos(a)*d),q,V(.6,2,.6));drops.setMatrixAt(i,matrix);}drops.instanceMatrix.needsUpdate=true;});
}
export function hookChain(g,c){
 const root=new T.Group(),metal=new T.MeshStandardMaterial({color:0x4d727a,metalness:.85,roughness:.31}),links=new T.InstancedMesh(new T.TorusGeometry(.17,.045,5,10),metal,g.low?44:70);links.frustumCulled=false;root.add(links);
 const hook=new T.Group(),bladeMat=new T.MeshStandardMaterial({color:0x87b3ae,metalness:.76,roughness:.3,emissive:0x0c4a5a,emissiveIntensity:.65});root.add(hook);
 for(const side of [-1,1])ribbon(hook,[V(0,0,0),V(side*.6,.1,.35),V(side*.95,.15,1),V(side*.55,.1,1.65)],.12,bladeMat);
 const core=mesh(hook,new T.ConeGeometry(.24,2,6).rotateX(Math.PI/2),glow(0x5ce8ff,.7),V(0,0,1));
 const matrix=new T.Matrix4(),q=new T.Quaternion(),turn=new T.Euler(),start=c.origin.clone().setY(1.8),end=c.origin.clone().addScaledVector(c.dir,c.length).setY(1.1),p=V();
 g.gfx.flash?.(c.origin,0x328fae,25,.5);
 return timeline(g,root,c.windup+c.active+.35,t=>{const k=t<c.windup?clamp(t/c.windup)*.12:clamp((t-c.windup)/.14),retract=clamp((t-c.windup-c.active)/.35),reach=k*(1-retract);for(let i=0;i<links.count;i++){const f=i/(links.count-1)*reach;p.copy(start).lerp(end,f);p.y-=Math.sin(f*Math.PI)*.65;q.setFromEuler(turn.set(i%2?Math.PI/2:0,Math.atan2(c.dir.x,c.dir.z),0));matrix.compose(p,q,V(1,1,1));links.setMatrixAt(i,matrix);}hook.position.copy(start).lerp(end,reach);hook.rotation.y=Math.atan2(c.dir.x,c.dir.z);hook.scale.setScalar(.7+.3*k);core.material.opacity=.4+.4*Math.sin(t*15)**2;links.instanceMatrix.needsUpdate=true;});
}
export function harborWave(g,c,duration=2.2,delay=0){
 const root=new T.Group();root.position.copy(c.origin);const n=g.low?64:112,rows=5,opening=c.gap??.95,verts=[],uv=[],indices=[];
 for(let i=0;i<=n;i++)for(let j=0;j<=rows;j++){verts.push(0,0,0);uv.push(i/n,j/rows);if(i<n&&j<rows){const k=i*(rows+1)+j;indices.push(k,k+1,k+rows+1,k+1,k+rows+2,k+rows+1);}}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);
 const mat=new T.ShaderMaterial({uniforms:{time:{value:0},alpha:{value:1},rage:{value:c.phase===3?1:0}},...transparent,
 vertexShader:'varying vec2 p;void main(){p=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:`varying vec2 p;uniform float time,alpha,rage;void main(){float str=.5+.5*sin(p.x*245.-time*5.+sin(p.y*21.)*2.);float crest=pow(sin(p.y*3.14159),3.);float foam=smoothstep(.65,.95,str)*crest;vec3 deep=mix(vec3(.015,.20,.28),vec3(.16,.035,.31),rage*.65);vec3 col=mix(deep,vec3(.45,1.5,1.65),crest*.24+foam*.75);gl_FragColor=vec4(col,(.25+crest*.4+foam*.25)*alpha);}`});const wall=mesh(root,geo,mat);wall.frustumCulled=false;
 const drops=spray(root,g.low?28:62,0xa8f3ed),matrix=new T.Matrix4(),q=new T.Quaternion(),pos=geo.attributes.position;
 return timeline(g,root,duration+delay,t=>{root.visible=t>=delay;const k=clamp((t-delay)/duration),r=.8+k*(c.radius??27),fade=clamp((1-k)*7);for(let i=0;i<=n;i++){const a=c.gapAngle+opening/2+i/n*(TAU-opening);for(let j=0;j<=rows;j++){const v=j/rows,rr=Math.max(.1,r-1.8*(1-v)+Math.sin(v*Math.PI)*.45),h=Math.sin(v*Math.PI)*(2.1+.4*Math.sin(a*19+t*9))+.12;pos.setXYZ(i*(rows+1)+j,Math.sin(a)*rr,h,Math.cos(a)*rr);}}pos.needsUpdate=true;mat.uniforms.time.value=t;mat.uniforms.alpha.value=fade;drops.material.opacity=.75*fade;for(let i=0;i<drops.count;i++){const a=c.gapAngle+opening/2+(i+.5)/drops.count*(TAU-opening),rr=r-.4+Math.sin(t*6+i)*.5;matrix.compose(V(Math.sin(a)*rr,1.8+Math.sin(t*8+i)*.8,Math.cos(a)*rr),q,V(.55,2.4,.55));drops.setMatrixAt(i,matrix);}drops.instanceMatrix.needsUpdate=true;});
}
export function harborFlood(g,c){
 const root=new T.Group(),mat=new T.ShaderMaterial({uniforms:{time:{value:0},alpha:{value:1}},...transparent,
 vertexShader:'varying vec2 p;void main(){p=uv;vec3 v=position;v.y+=sin(uv.y*60.)*.15;gl_Position=projectionMatrix*modelViewMatrix*vec4(v,1.);}',
 fragmentShader:`varying vec2 p;uniform float time,alpha;void main(){float flow=pow(.5+.5*sin(p.y*110.-time*12.+sin(p.x*25.)*2.),7.);float edge=pow(abs(p.x-.5)*2.,8.);vec3 c=mix(vec3(.025,.1,.21),vec3(.3,1.15,1.3),edge*.6+flow*.4);gl_FragColor=vec4(c,(.5+edge*.2+flow*.15)*alpha);}`});
 for(const l of c.lanes){const lane=new T.Group();lane.position.copy(l.origin);lane.rotation.y=Math.atan2(l.dir.x,l.dir.z);root.add(lane);mesh(lane,new T.PlaneGeometry(c.width,l.length,8,40).rotateX(-Math.PI/2).translate(0,.18,l.length/2),mat);for(const side of [-1,1]){const points=[];for(let i=0;i<=16;i++)points.push(V(side*c.width/2,.3+Math.sin(i)*.1,i/16*l.length));ribbon(lane,points,.04,glow(0x8ee4e8,.55));}}
 return timeline(g,root,c.active,t=>{mat.uniforms.time.value=t;mat.uniforms.alpha.value=clamp(t/.2)*clamp((c.active-t)/.5);});
}
export function lureGlow(g,e,c){
 const root=new T.Group(),halo=ring(root,1.2,glow(0x86eafa,.7),0),shell=mesh(root,new T.IcosahedronGeometry(.5,1),glow(0x4be0f2,.24)),beams=[];
 for(let j=0;j<3;j++){const m=ring(root,.85+j*.22,glow(0x6be3fd,.5),0);m.rotation.set(j*.75,.5+j,0);beams.push(m);}
 g.gfx.flash?.(e.pos,0x4ac9ed,42,c.windup,16);
 return timeline(g,root,c.windup,t=>{if(!e.alive||e.harbor?.cast!==c)return false;root.position.copy(e.pos).setY(5.4);const k=t/c.windup;root.scale.setScalar(.5+k*.6);shell.rotation.y=t*2;halo.rotation.z=t*1.4;beams.forEach((m,j)=>{m.rotation.y+=.03*(j+1);});shell.material.opacity=.2+.35*k;});
}
export function harborBite(g,c){
 const root=new T.Group();root.position.copy(c.origin);root.rotation.y=Math.atan2(c.dir.x,c.dir.z);const mat=glow(0x82edec,.8),count=g.low?3:5,blades=[];
 for(let j=0;j<count;j++){const points=[];for(let i=0;i<=22;i++){const a=-Math.PI*.42+i/22*Math.PI*.84,r=7.8-j*.22;points.push(V(Math.sin(a)*r,.5+j*.32,Math.cos(a)*r));}blades.push(ribbon(root,points,.08-j*.008,mat));}
 g.fx.shockwave(c.origin,{r1:10,dur:.45,strength:.025});return timeline(g,root,.55,t=>{mat.opacity=.85*(1-t/.55);root.scale.setScalar(.7+clamp(t/.16)*.3);root.rotation.y=Math.atan2(c.dir.x,c.dir.z)+Math.sin(t/.55*Math.PI)*.14;});
}
/** Persistent vortex anticipates its exact 7.5m footprint; collapse is timed to the heavy damage pulse. */
export function harborMaelstrom(g,c){
 const root=new T.Group();root.position.copy(c.at);const r=c.radius,mat=new T.ShaderMaterial({uniforms:{time:{value:0},charge:{value:0},alpha:{value:1}},...transparent,
 vertexShader:'varying vec2 p;void main(){p=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:`varying vec2 p;uniform float time,charge,alpha;void main(){vec2 q=(p-.5)*2.;float r=length(q),a=atan(q.y,q.x);float spiral=pow(.5+.5*sin(a*5.+r*25.-time*8.),5.);float edge=1.-smoothstep(.92,1.,r);vec3 c=mix(vec3(.07,.015,.15),vec3(.55,.17,1.3),spiral*.7+charge*.15);gl_FragColor=vec4(c,edge*(.16+spiral*.42)*alpha);}`});
 mesh(root,new T.PlaneGeometry(r*2,r*2).rotateX(-Math.PI/2),mat,V(0,.16,0));const crown=ring(root,r,glow(0x8e65fc,.7),.2),streams=[];
 for(let j=0;j<(g.low?3:5);j++){const points=[];for(let i=0;i<=48;i++){const k=i/48,a=k*TAU*1.4+j*TAU/5,rr=r*(1-k)*.86;points.push(V(Math.sin(a)*rr,k*7,Math.cos(a)*rr));}streams.push(ribbon(root,points,.065,glow(0x8068de,.38)));}
 const core=mesh(root,new T.IcosahedronGeometry(.65,1),glow(0xb2d9ff,.7),V(0,5,0));g.gfx.flash?.(c.at,0x6955bc,45,1.2,20);
 return timeline(g,root,c.windup+c.active+.35,t=>{const charged=clamp((t-c.windup)/2.8),collapse=clamp((t-c.windup-2.8)/.35),fade=clamp((c.windup+c.active+.35-t)/.5);mat.uniforms.time.value=t;mat.uniforms.charge.value=charged;mat.uniforms.alpha.value=fade;core.position.y=5*(1-collapse)+.5;core.scale.setScalar((.4+charged*.7)*(1-collapse));core.rotation.set(t,t*1.7,0);crown.material.opacity=(.35+charged*.45)*fade;for(const s of streams){s.rotation.y=t*(t<c.windup?.4:1.5);s.scale.y=(t<c.windup?.15+.15*t/c.windup:1)*(1-collapse);s.material.opacity=.42*fade;}if(collapse>0)root.scale.setScalar(1+collapse*.1);});
}
export function harborAscend(g,e,duration=1.4){
 const root=new T.Group();root.position.copy(e.pos);const rings=[ring(root,3.2,glow(0x82dcf1,.65),.2),ring(root,2.3,glow(0x8071e9,.5),.3)],shards=spray(root,g.low?18:36,0x9ff0ff),matrix=new T.Matrix4(),q=new T.Quaternion();g.fx.shockwave(e.pos,{r1:9,dur:duration,strength:.018});
 return timeline(g,root,duration,t=>{const k=t/duration;for(let j=0;j<rings.length;j++){rings[j].scale.setScalar(1+k*(j+1));rings[j].material.opacity=.65*(1-k);rings[j].position.y=.2+k*(j?3:1.5);}for(let i=0;i<shards.count;i++){const a=i*2.399+k*2,r=2.5+k*2;matrix.compose(V(Math.sin(a)*r,k*(3+i%4),Math.cos(a)*r),q,V(.6,3,.6));shards.setMatrixAt(i,matrix);}shards.instanceMatrix.needsUpdate=true;shards.material.opacity=.75*(1-k);});
}

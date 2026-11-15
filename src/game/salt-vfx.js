import * as T from 'three';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),clamp=x=>Math.max(0,Math.min(1,x));
const glass=()=>new T.MeshPhysicalMaterial({color:0xc5d9d4,metalness:.16,roughness:.24,clearcoat:.8,emissive:0x174958,emissiveIntensity:.5,flatShading:true});
const glow=(color=0x86cdd4,opacity=.7)=>new T.MeshBasicMaterial({color,opacity,transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending});
function mesh(root,geo,mat,p=V()){const m=new T.Mesh(geo,mat);m.position.copy(p);root.add(m);return m;}
/** Effect ownership is independent of the shared actor and texture caches. */
function timeline(g,root,duration,step){
 root.userData.saltFx=true;g.gfx.scene.add(root);let t=0,disposed=false;
 const dispose=()=>{if(disposed)return;disposed=true;root.removeFromParent();const geos=new Set(),mats=new Set();root.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.geometry)geos.add(o.geometry);for(const m of [].concat(o.material??[]))mats.add(m);});geos.forEach(x=>x.dispose());mats.forEach(x=>x.dispose());};
 g.fx.add(dt=>{if(disposed)return false;if(g.cinematic)return true;t+=dt;return step(t,dt)!==false&&t<duration;},dispose);return {root,stop:dispose};
}
export function saltCasting(g,e,c){
 const root=new T.Group(),bronze=new T.MeshStandardMaterial({color:0xb99a60,metalness:.8,roughness:.4,emissive:0x47351a,emissiveIntensity:.35}),light=glow(0x8fdae0,.6);
 const wheel=mesh(root,new T.TorusGeometry(2.1,.035,6,64),bronze,V(0,3.4,0));wheel.rotation.x=Math.PI/2;
 const inset=mesh(root,new T.TorusGeometry(1.7,.025,5,48),light,V(0,3.4,0));inset.rotation.x=Math.PI/2;
 const facets=new T.InstancedMesh(new T.OctahedronGeometry(.22,0),glass(),6);facets.frustumCulled=false;root.add(facets);
 const matrix=new T.Matrix4(),q=new T.Quaternion();
 return timeline(g,root,c.windup+.18,t=>{if(!e.alive||e.salt?.cast!==c)return false;root.position.copy(e.pos);const k=clamp(t/c.windup);root.scale.setScalar(.8+k*.2);wheel.rotation.z=t*.35;inset.rotation.z=-t*.6;light.opacity=.3+.4*k;
 for(let i=0;i<6;i++){const a=i*Math.PI/3+t*.18;matrix.compose(V(Math.sin(a)*2.1,3.4+Math.sin(a*2+t)*.14,Math.cos(a)*2.1),q,V(.6,1.8,.6));facets.setMatrixAt(i,matrix);}facets.instanceMatrix.needsUpdate=true;});
}
export function saltEruption(g,p,r=3){
 const root=new T.Group();root.position.copy(p);const n=g.low?9:16,crystals=new T.InstancedMesh(new T.CylinderGeometry(0,.25,1,6).translate(0,.5,0),glass(),n);crystals.frustumCulled=false;crystals.castShadow=!g.low;root.add(crystals);
 const matrix=new T.Matrix4(),q=new T.Quaternion(),positions=Array.from({length:n},(_,i)=>{const a=i*2.399,range=Math.sqrt(i/n)*r*.82;return {p:V(Math.sin(a)*range,0,Math.cos(a)*range),h:1.5+((i*7)%9)*.27,delay:i/n*.16,a};});
 const rim=mesh(root,new T.RingGeometry(r-.09,r,64).rotateX(-Math.PI/2),glow(0xb0d3d2,.45),V(0,.1,0));
 g.audio.play('shatter',p,.6);g.particles?.emit({pos:p,count:g.low?12:24,radius:r*.6,speed:[2,6],up:3,gravity:12,life:[.3,.8],size:[.06,.18],c0:[1.1,1.3,1.25],c1:[.2,.36,.38],tex:'glint'});
 return timeline(g,root,1.9,t=>{const fade=1-clamp((t-1.15)/.75);rim.material.opacity=.5*fade;
 for(let i=0;i<n;i++){const o=positions[i],rise=clamp((t-o.delay)/.2),k=rise*rise*(3-2*rise);q.setFromEuler(new T.Euler(Math.sin(o.a)*.16,o.a,Math.cos(o.a)*.16));matrix.compose(o.p.clone().add(V(0,-(1-fade)*o.h,0)),q,V(1,k*o.h,1));crystals.setMatrixAt(i,matrix);}crystals.instanceMatrix.needsUpdate=true;});
}
export function saltPrism(g,c){
 const root=new T.Group();root.position.copy(c.origin);const mat=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,uniforms:{time:{value:0},alpha:{value:1}},
 vertexShader:'varying vec2 p;void main(){p=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:'varying vec2 p;uniform float time,alpha;void main(){float x=abs(p.x-.5)*2.;float core=exp(-x*25.);float edge=pow(1.-x,2.)*.35;float seam=pow(.5+.5*sin(p.y*110.-time*18.),12.);vec3 col=mix(vec3(.12,.35,.4),vec3(1.7,2.4,2.3),core);gl_FragColor=vec4(col,(core+edge)*( .7+seam*.3)*alpha);}' });
 for(const lane of c.lanes){const ray=new T.Group();ray.rotation.y=Math.atan2(lane.dir.x,lane.dir.z);root.add(ray);mesh(ray,new T.PlaneGeometry(2.8,lane.length).rotateX(-Math.PI/2),mat,V(0,.13,lane.length/2));mesh(ray,new T.PlaneGeometry(.65,lane.length).rotateX(-Math.PI/2),mat,V(0,1.1,lane.length/2));}
 const star=mesh(root,new T.OctahedronGeometry(1.8,0),glass(),V(0,2.6,0));
 g.audio.play('shatter',c.origin,.8);g.gfx.flash?.(c.origin,0xa2e9e2,150,.35,30);
 return timeline(g,root,c.active,t=>{mat.uniforms.time.value=t;mat.uniforms.alpha.value=clamp(t/.08)*clamp((c.active-t)/.18);star.rotation.y=t*.65;star.scale.setScalar(.65+.15*Math.sin(t*5));});
}
export function saltStorm(g,c,duration){
 const root=new T.Group();root.position.copy(c.origin);const mat=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{time:{value:0},safe:{value:new T.Vector2(c.safe.x,c.safe.z)},alpha:{value:0}},
 vertexShader:'varying vec3 w;void main(){w=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(w,1.);}',
 fragmentShader:`varying vec3 w;uniform float time,alpha;uniform vec2 safe;
 float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
 void main(){float d=length(w.xz-safe);float mask=smoothstep(5.5,6.1,d);vec2 p=w.xz*.22+vec2(-time*1.7,time*.4);float n=noise(p)*.65+noise(p*3.1)*.35;float streak=pow(.5+.5*sin(w.x*.9+w.z*2.7-time*13.+n*7.),10.);vec3 sand=mix(vec3(.29,.27,.19),vec3(.76,.77,.63),n);gl_FragColor=vec4(sand,mask*(n*.2+streak*.13)*alpha);}`});
 mesh(root,new T.PlaneGeometry(112,100).rotateX(-Math.PI/2),mat,V(0,.17,0));
 const safe=new T.Group();safe.position.copy(c.safe).sub(c.origin);root.add(safe);
 const border=mesh(safe,new T.RingGeometry(5.36,5.5,96).rotateX(-Math.PI/2),glow(0x91d9cb,.7),V(0,.2,0));
 const stones=new T.InstancedMesh(new T.OctahedronGeometry(.12,0),glass(),g.low?32:64);stones.frustumCulled=false;root.add(stones);const matrix=new T.Matrix4(),q=new T.Quaternion();
 return timeline(g,root,duration,t=>{const fade=clamp(t/.7)*clamp((duration-t)/.6);mat.uniforms.time.value=t;mat.uniforms.alpha.value=fade;border.material.opacity=fade*(.65+Math.sin(t*3)*.12);
 for(let i=0;i<stones.count;i++){const a=i*2.399+t*.55,r=8+(i%8)*3.1,x=Math.sin(a)*r,z=Math.cos(a)*r;const wp=V(x,.4+(i%5)*.42,z);if(wp.clone().add(c.origin).distanceTo(c.safe)<6)wp.y=-4;q.setFromEuler(new T.Euler(t+i,i*.7,t*.5));matrix.compose(wp,q,V(.35,fade*(1+(i%3)*.5),.35));stones.setMatrixAt(i,matrix);}stones.instanceMatrix.needsUpdate=true;});
}
/** Physical salt blades, with their lifetime tied to the projectile, not the map cache. */
export function saltShard(g){
 const root=new T.Group();mesh(root,new T.OctahedronGeometry(1,0),glass()).scale.set(.2,.14,.85);mesh(root,new T.OctahedronGeometry(1,0),glow(0xc2ebe4,.5)).scale.set(.09,.06,.7);
 timeline(g,root,3.1,()=>!!root.parent);return root;
}

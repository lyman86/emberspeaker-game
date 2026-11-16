import * as T from 'three';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),clamp=x=>Math.max(0,Math.min(1,x));
function timeline(g,root,duration,step){g.gfx.scene.add(root);let t=0,disposed=false;const dispose=()=>{if(disposed)return;disposed=true;root.removeFromParent();const geos=new Set(),mats=new Set();root.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.geometry)geos.add(o.geometry);for(const m of [].concat(o.material??[]))mats.add(m);});geos.forEach(x=>x.dispose());mats.forEach(x=>x.dispose());};g.fx.add(dt=>{if(disposed)return false;if(g.cinematic)return true;t+=dt;return step(t,dt)!==false&&t<duration;},dispose);return {stop:dispose,root};}
const water=()=>new T.MeshStandardMaterial({color:0x668e94,metalness:.28,roughness:.22,transparent:true,opacity:.64,side:T.DoubleSide,depthWrite:false});
export function harborSplash(g,p,r=3){
 const root=new T.Group();root.position.copy(p);const mat=water(),ring=new T.Mesh(new T.TorusGeometry(1,.055,5,64),mat);ring.rotation.x=Math.PI/2;ring.position.y=.15;root.add(ring);
 const drops=new T.InstancedMesh(new T.SphereGeometry(.09,5,4),new T.MeshBasicMaterial({color:0xc4dce0,transparent:true,opacity:.7}),g.low?14:26),matrix=new T.Matrix4(),q=new T.Quaternion();drops.frustumCulled=false;root.add(drops);
 g.audio.play('h_surge',p,.5);
 return timeline(g,root,.9,t=>{const k=clamp(t/.9);ring.scale.setScalar(.4+k*r);mat.opacity=.6*(1-k);drops.material.opacity=.7*(1-k);for(let i=0;i<drops.count;i++){const a=i*2.399,d=.2+k*(r*.5+(i%4)*.3);matrix.compose(V(Math.sin(a)*d,Math.max(.05,Math.sin(k*Math.PI)*(1+(i%3)*.6)),Math.cos(a)*d),q,V(.5,1.6,.5));drops.setMatrixAt(i,matrix);}drops.instanceMatrix.needsUpdate=true;});
}
export function hookChain(g,c){
 const root=new T.Group(),material=new T.MeshStandardMaterial({color:0x707c77,metalness:.78,roughness:.42}),links=new T.InstancedMesh(new T.TorusGeometry(.11,.033,5,8),material,g.low?25:40);links.frustumCulled=false;root.add(links);const matrix=new T.Matrix4(),q=new T.Quaternion(),end=c.origin.clone().addScaledVector(c.dir,c.length).setY(1.05);
 return timeline(g,root,c.windup+c.active+.4,t=>{const reach=t<c.windup?clamp(t/c.windup)*.32:clamp((t-c.windup)/.16);for(let i=0;i<links.count;i++){const f=i/(links.count-1)*reach,p=c.origin.clone().setY(1.6).lerp(end,f);p.y-=Math.sin(f*Math.PI)*.7;q.setFromEuler(new T.Euler(i%2?Math.PI/2:0,Math.atan2(c.dir.x,c.dir.z),0));matrix.compose(p,q,V(1,1,1));links.setMatrixAt(i,matrix);}links.instanceMatrix.needsUpdate=true;});
}
export function harborWave(g,c,duration=2.2,delay=0){
 const root=new T.Group();root.position.copy(c.origin);const verts=[],uv=[],idx=[],n=g.low?72:112,opening=c.gap??.85;
 for(let i=0;i<=n;i++){const a=(c.gapAngle??0)+opening/2+i/n*(Math.PI*2-opening);for(let side=0;side<2;side++){verts.push(Math.sin(a),side,Math.cos(a));uv.push(i/n,side);}if(i<n){const k=i*2;idx.push(k,k+1,k+2,k+1,k+3,k+2);}}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();
 const mat=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{time:{value:0},alpha:{value:1}},vertexShader:'varying vec2 p;void main(){p=uv;vec3 v=position;v.y*=1.25+.22*sin(uv.x*100.);gl_Position=projectionMatrix*modelViewMatrix*vec4(v,1.);}',fragmentShader:'varying vec2 p;uniform float time,alpha;void main(){float rip=.5+.5*sin(p.x*175.-time*7.+sin(p.y*19.)*1.2);float foam=smoothstep(.53,.96,p.y)*(.45+.55*rip);vec3 col=mix(vec3(.10,.25,.29),vec3(.70,.84,.83),foam);float a=(sin(p.y*3.14159)*.5+foam*.5)*alpha;gl_FragColor=vec4(col,a);}'});
 const crest=new T.Mesh(geo,mat);root.add(crest);return timeline(g,root,duration+delay,t=>{const k=clamp((t-delay)/duration);root.visible=t>=delay;const r=.8+k*(c.radius??27);root.scale.set(r,1,r);mat.uniforms.time.value=t;mat.uniforms.alpha.value=clamp((1-k)*5);});
}
export function harborFlood(g,c){
 const root=new T.Group(),mat=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{time:{value:0},alpha:{value:1}},vertexShader:'varying vec2 p;void main(){p=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 p;uniform float time,alpha;void main(){float ripple=.5+.5*sin(p.y*80.-time*9.+sin(p.x*18.)*2.);float edge=pow(abs(p.x-.5)*2.,6.);vec3 c=mix(vec3(.07,.22,.25),vec3(.65,.81,.8),edge*.55+ripple*.13);gl_FragColor=vec4(c,(.25+edge*.3+ripple*.12)*alpha);}'});
 for(const l of c.lanes){const mesh=new T.Mesh(new T.PlaneGeometry(c.width,l.length).rotateX(-Math.PI/2).translate(0,.16,l.length/2),mat);mesh.position.copy(l.origin);mesh.rotation.y=Math.atan2(l.dir.x,l.dir.z);root.add(mesh);}
 return timeline(g,root,c.active,t=>{mat.uniforms.time.value=t;mat.uniforms.alpha.value=clamp(t/.2)*clamp((c.active-t)/.5);});
}
export function lureGlow(g,e,c){
 const root=new T.Group(),mat=new T.MeshBasicMaterial({color:0x8dcfd1,transparent:true,opacity:.55}),orb=new T.Mesh(new T.SphereGeometry(.5,14,10),mat);root.add(orb);
 return timeline(g,root,c.windup,t=>{if(!e.alive||e.harbor?.cast!==c)return false;root.position.copy(e.pos).setY(4.7);orb.scale.setScalar(.65+t/c.windup*.55);mat.opacity=.25+.3*Math.sin(t*6)**2;});
}

import * as T from 'three';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),TAU=Math.PI*2,clamp=x=>Math.max(0,Math.min(1,x));
function effect(g,root,duration,step){g.gfx.scene.add(root);let t=0,done=false;const stop=()=>{if(done)return;done=true;root.removeFromParent();const geos=new Set(),mats=new Set();root.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.geometry)geos.add(o.geometry);for(const m of [].concat(o.material??[]))mats.add(m);});geos.forEach(x=>x.dispose());mats.forEach(x=>x.dispose());};g.fx.add(dt=>{if(done)return false;if(g.cinematic)return true;t+=dt;return step(t,dt)!==false&&t<duration;},stop);return {stop,root};}
const glow=(color=0x9ce5ff,opacity=.7)=>new T.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending});
function mesh(root,geo,mat,p=V()){const m=new T.Mesh(geo,mat);m.position.copy(p);root.add(m);return m;}
function ring(root,r,mat,y=.15){const m=mesh(root,new T.TorusGeometry(r,.045,5,96),mat,V(0,y,0));m.rotation.x=Math.PI/2;return m;}
/** Low draw-count, faceted refractive-looking ice; geometry and materials belong to the timeline. */
export function iceBurst(g,p,r=4){
 const root=new T.Group();root.position.copy(p);const n=g.low?18:34,mat=new T.MeshPhysicalMaterial({color:0x8abbd3,metalness:.3,roughness:.19,clearcoat:1,emissive:0x0f425f,emissiveIntensity:.8}),shards=new T.InstancedMesh(new T.ConeGeometry(.3,2,5),mat,n);root.add(shards);shards.frustumCulled=false;const halo=ring(root,1,glow(),.13),matrix=new T.Matrix4(),q=new T.Quaternion(),turn=new T.Euler();
 return effect(g,root,1.25,t=>{const k=t/1.25,fade=clamp((1-k)*3);halo.scale.setScalar(.5+r*k);halo.material.opacity=.7*(1-k);for(let i=0;i<n;i++){const a=i*2.399,d=r*(.3+(i%7)/10),rise=Math.sin(clamp(t*3-i%3*.1)*Math.PI/2),sink=clamp((t-.7)*2);q.setFromEuler(turn.set(Math.sin(a)*.35,a,Math.cos(a)*.3));matrix.compose(V(Math.sin(a)*d,-.7+rise*(1+i%3*.4)-sink*2,Math.cos(a)*d),q,V(.5+fade*.5,1+i%3*.35,.5+fade*.5));shards.setMatrixAt(i,matrix);}shards.instanceMatrix.needsUpdate=true;});
}
export function winterCastFx(g,e,c){
 const root=new T.Group();root.position.copy(c.origin);const light=glow(0xa7e7ff,.65),ice=new T.MeshPhysicalMaterial({color:0x739fb9,metalness:.4,roughness:.23,clearcoat:1,emissive:0x184e6b,emissiveIntensity:1}),matrix=new T.Matrix4(),q=new T.Quaternion(),up=V(0,1,0);
 const count=c.kind==='lances'?3:c.kind==='procession'?6:0,bolts=[];
 if(count){for(let i=0;i<count;i++){const l=c.lanes[i],b=new T.Group();b.position.copy(l.origin).sub(c.origin).setY(2.2);b.quaternion.setFromUnitVectors(up,l.dir);root.add(b);mesh(b,new T.ConeGeometry(.5,4.4,5),ice);mesh(b,new T.ConeGeometry(.18,5,5),light);bolts.push(b);}}
 if(c.kind==='cleave'){const arc=mesh(root,new T.TorusGeometry(c.radius,.1,6,64,Math.PI*.9),light,V(0,1,0));arc.rotation.set(Math.PI/2,0,-Math.atan2(c.dir.x,c.dir.z)-Math.PI*.95);bolts.push(arc);}
 const choir=c.kind==='requiem',snow=c.kind==='whiteout';let halo,inner,flakes;
 if(choir){halo=ring(root,c.radius,light);inner=ring(root,c.inner,glow(0xf4d7a1,.9));for(let i=0;i<8;i++){const a=i/8*TAU,m=mesh(root,new T.ConeGeometry(.45,4,5),ice,V(Math.sin(a)*c.radius,1.5,Math.cos(a)*c.radius));m.rotation.z=.1;}}
 if(snow){for(const p of c.refuges){const m=ring(root,c.safeRadius,glow(0xffd599,.95));m.position.copy(p).sub(c.origin).setY(.2);const disc=mesh(root,new T.CircleGeometry(c.safeRadius,48).rotateX(-Math.PI/2),glow(0xf7c579,.13),p.clone().sub(c.origin).setY(.12));disc.userData.safe=true;}const n=g.low?80:180;flakes=new T.InstancedMesh(new T.OctahedronGeometry(.09,0),light,n);flakes.frustumCulled=false;root.add(flakes);}
 return effect(g,root,c.windup+c.active+.5,t=>{if(!e.alive||e.winter?.cast!==c)return false;const active=clamp((t-c.windup)/Math.max(.01,c.active)),charge=clamp(t/c.windup);light.opacity=.3+.4*charge;for(let i=0;i<bolts.length;i++){const b=bolts[i];if(count){const l=c.lanes[i],travel=t<c.windup?-.5+charge*.5:clamp((t-c.windup)/.32)*l.length;b.position.copy(l.origin).sub(c.origin).addScaledVector(l.dir,travel).setY(2.2);b.scale.setScalar(t<c.windup?.4+charge*.6:1);b.visible=t<c.windup+.45;}else{b.visible=t>c.windup-.15;b.rotation.z+=.04;b.scale.setScalar(.7+charge*.3);}}
 if(choir){halo.position.y=.2+(t<c.windup?charge*1.2:Math.sin(t*5)*.15);inner.material.opacity=.5+.3*Math.sin(t*5)**2;halo.scale.setScalar(.97+.03*Math.sin(t*8));}
 if(flakes){for(let i=0;i<flakes.count;i++){const a=i*2.399+t*.3,r=4+(i%19)*1.35;matrix.compose(V(Math.sin(a)*r,((i*.7-t*8)%14+14)%14,Math.cos(a)*r),q,V(.7,2.7,.7));flakes.setMatrixAt(i,matrix);}flakes.instanceMatrix.needsUpdate=true;light.opacity=t<c.windup?.2+charge*.2:.55*(1-active*.4);}
 });
}

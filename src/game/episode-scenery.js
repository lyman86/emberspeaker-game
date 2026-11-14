import * as THREE from 'three';
const hash=(x,z)=>{const s=Math.sin(x*127.1+z*311.7)*43758.5453;return s-Math.floor(s);};

/** Locally authored dressing uses the existing CC0 scanned wood/stone materials. */
export function episodeProp(lv,p,x,z) {
  const mat=lv.game.materials,group=new THREE.Group();group.position.set(x,0,z);group.rotation.y=p.rot??0;
  const owned=(color,more={})=>new THREE.MeshStandardMaterial({color,roughness:0.85,...more});
  const wood=mat.get('wood'),bark=mat.get('bark'),stone=mat.get('mossy');
  const add=(geo,m,px,py,pz)=>{const o=new THREE.Mesh(geo,m);o.position.set(px,py,pz);o.castShadow=o.receiveShadow=true;group.add(o);o.userData.ep2Geometry=true;if(![wood,bark,stone].includes(m))o.userData.ep2Material=true;return o;};
  const bar=(a,b,r,m=wood)=>{const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),dir=to.clone().sub(from);const o=add(new THREE.CylinderGeometry(r,r*1.2,dir.length(),6),m,...from.add(to).multiplyScalar(0.5).toArray());o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());return o;};
  if(p.prop==='@wagon'){
    add(new THREE.BoxGeometry(3.8,0.25,2.1),wood,0,0.9,0).rotation.z=0.2;
    for(const side of [-1,1]){
      for(let i=0;i<3;i++)add(new THREE.BoxGeometry(3.8,0.17,0.12),wood,0,1.2+i*0.3,side*1.04).rotation.z=0.12;
      for(const end of [-1,1]){const wheel=add(new THREE.TorusGeometry(0.8,0.09,5,16),wood,end*1.2,0.8,side*1.3);for(let i=0;i<6;i++){const spoke=new THREE.Mesh(new THREE.BoxGeometry(0.065,1.5,0.065),wood);spoke.rotation.z=i*Math.PI/3;wheel.add(spoke);spoke.userData.ep2Geometry=true;}}
    }
    bar([-1.8,0.65,-0.8],[-4.5,0.15,-0.8],0.1);bar([-1.8,0.65,0.8],[-4.2,0.15,0.8],0.1);
  }else if(p.prop==='@ruin'){
    for(let i=0;i<7;i++){const h=1+hash(x+i,z)*2;add(new THREE.BoxGeometry(0.7,h,0.5),stone,(i-3)*0.72,h/2,0).rotation.z=(hash(z+i,x)-0.5)*0.2;}
    bar([-2,3,0],[1,0.5,1],0.15);bar([0,0.2,0],[3,0.2,2],0.18);
  }else if(p.prop==='@ritual'){
    const bone=owned(0xb1ae8b),blight=owned(0x77934b,{emissive:0x22350b});
    for(let i=0;i<10;i++){const a=i*Math.PI/5,r=2.6+hash(i,x)*0.4;const o=add(new THREE.DodecahedronGeometry(0.25+hash(z,i)*0.2),stone,Math.sin(a)*r,0.12,Math.cos(a)*r);o.scale.y=0.5;}
    for(const side of [-1,1]){bar([side*1.1,0,-0.4],[side*0.9,2.8,0],0.06);bar([side*0.9,2.6,0],[side*1.8,2.3,0],0.06);add(new THREE.SphereGeometry(0.18,8,6),bone,side*1.3,2.1,0);add(new THREE.SphereGeometry(0.12,7,5),blight,side*1.8,1.8,0);}
  }else if(p.prop==='@butchery'){
    const iron=owned(0x353d3c,{metalness:0.7,roughness:0.45}),blood=owned(0x3b1c18);
    add(new THREE.BoxGeometry(2.8,0.28,1.5),wood,0,1.1,0);
    for(const xx of [-1,1])for(const zz of [-0.5,0.5])add(new THREE.BoxGeometry(0.15,1.1,0.15),wood,xx,0.55,zz);
    add(new THREE.BoxGeometry(1.5,0.015,0.8),blood,0.2,1.26,0);
    for(let i=0;i<3;i++){bar([-1.1+i*1.1,0,-0.8],[-1.1+i*1.1,3.5,-0.8],0.055);const hook=add(new THREE.TorusGeometry(0.18,0.035,5,12,Math.PI*1.4),iron,-1.1+i*1.1,2.5,-0.8);hook.rotation.z=Math.PI;}
  }else if(p.prop==='@roots'){
    for(let i=0;i<6;i++){const a=i*1.1,len=2+hash(x,i)*2;bar([0,0.1,0],[Math.sin(a)*len,0.1,Math.cos(a)*len],0.1,bark);bar([0,0,0],[Math.sin(a)*1.1,2.3+hash(i,z),Math.cos(a)*1.1],0.08,bark);}
  }else if(p.prop==='@sign'){
    add(new THREE.BoxGeometry(0.16,2.8,0.18),wood,0,1.4,0);
    const board=add(new THREE.BoxGeometry(1.8,0.62,0.12),wood,0.3,2.35,0);board.rotation.z=0.08;
    // Painted directional notch remains readable without loading an external font.
    const arrow=new THREE.Shape();arrow.moveTo(-0.5,-0.07);arrow.lineTo(0.3,-0.07);arrow.lineTo(0.3,-0.2);arrow.lineTo(0.6,0);arrow.lineTo(0.3,0.2);arrow.lineTo(0.3,0.07);arrow.lineTo(-0.5,0.07);arrow.closePath();
    add(new THREE.ShapeGeometry(arrow),owned(0xd6c68e),0.3,2.35,0.071);
  }else return false;
  lv.group.add(group);return true;
}

export function episodeScenery(lv) {
  if(!['forest','swamp'].includes(lv.id))return;
  const g=lv.game,mat=g.materials,swamp=lv.id==='swamp';
  if(swamp){
    const waterMat=new THREE.ShaderMaterial({uniforms:{time:{value:0}},transparent:true,depthWrite:false,
      vertexShader:`varying vec3 world;void main(){world=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);}`,
      fragmentShader:`uniform float time;varying vec3 world;void main(){vec2 p=world.xz;float wave=sin(p.x*.43+p.y*.27-time*.7)*sin(p.y*.61-p.x*.11+time*.4);float ripple=pow(max(0.,wave),7.);vec3 col=mix(vec3(.025,.065,.055),vec3(.09,.17,.13),wave*.5+.5);col+=vec3(.14,.24,.19)*ripple*.35;gl_FragColor=vec4(col,.95);}`});
    const water=new THREE.Mesh(new THREE.PlaneGeometry(lv.w*4,lv.h*4).rotateX(-Math.PI/2),waterMat);water.position.set(lv.w*2,-0.16,lv.h*2);water.userData.ep2Geometry=water.userData.ep2Material=true;lv.group.add(water);
    lv.anim.push(dt=>{waterMat.uniforms.time.value+=dt;return true;});
  }
  // Clusters of sedge and moss at path edges, instanced to keep draw calls bounded.
  const points=[];
  for(let z=2;z<lv.h-2;z++)for(let x=2;x<lv.w-2;x++)if(lv.isFloor(x,z)&&hash(x,z)>0.65&&[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dz])=>!lv.isFloor(x+dx,z+dz)))points.push([x*4+2,z*4+2]);
  const reedGeo=new THREE.ConeGeometry(0.07,1,3),reedMat=new THREE.MeshStandardMaterial({color:swamp?0x777b46:0x666c3c,roughness:1});
  const reeds=new THREE.InstancedMesh(reedGeo,reedMat,points.length*6);reeds.userData.ep2Geometry=reeds.userData.ep2Material=true;
  const matrix=new THREE.Matrix4();let n=0;
  for(const [x,z]of points)for(let i=0;i<6;i++){const h=0.6+hash(x+i,z)*1.2;matrix.compose(new THREE.Vector3(x+(hash(z+i,x)-0.5)*3,h/2,z+(hash(x,z+i)-0.5)*3),new THREE.Quaternion().setFromEuler(new THREE.Euler((hash(i,x)-0.5)*0.4,i*2.3,(hash(i,z)-0.5)*0.4)),new THREE.Vector3(1,h,1));reeds.setMatrixAt(n++,matrix);}
  reeds.computeBoundingSphere();lv.group.add(reeds);
  let elapsed=0;
  lv.anim.push(dt=>{
    elapsed+=dt;if(elapsed<0.3)return true;elapsed=0;
    const p=g.player.pos;
    g.smoke.emit({pos:{x:p.x-10,y:0.25,z:p.z-9},count:g.low?1:2,radius:12,flat:true,speed:[0.15,0.45],up:0.08,life:[5,9],size:[4,7],c0:swamp?[0.18,0.25,0.19]:[0.26,0.31,0.29],c1:[0.1,0.13,0.12],alpha:0.11,tex:'smoke',grow1:1.8});
    if(swamp)g.particles.emit({pos:{x:p.x,y:0.7,z:p.z},count:2,radius:14,speed:[0.05,0.2],up:0.25,life:[2,4],size:[0.045,0.09],c0:[0.6,1.05,0.25],c1:[0.1,0.2,0.02],tex:'glint'});
    return true;
  });
  // Warm lamps give the church a safe visual anchor inside the cold village.
  if(!swamp)lv.torches.push({x:49,y:2.4,z:73,color:0xffb268,power:100,seed:4});
}

export function episodeGate(lv,gt) {
  if(!['plague_fog','roots'].includes(gt.id))return null;
  const group=new THREE.Group();
  if(gt.id==='plague_fog'){
    const mat=new THREE.ShaderMaterial({uniforms:{time:{value:0}},transparent:true,side:THREE.DoubleSide,depthWrite:false,
      vertexShader:`varying vec2 uv0;void main(){uv0=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`varying vec2 uv0;uniform float time;void main(){vec2 p=uv0;float cloud=sin(p.x*16.+p.y*9.+time)*sin(p.y*17.-time*.7);float edge=sin(p.x*3.14159)*sin(p.y*3.14159);gl_FragColor=vec4(mix(vec3(.14,.22,.05),vec3(.4,.58,.19),cloud*.5+.5),edge*(.55+cloud*.2));}`});
    const fog=new THREE.Mesh(new THREE.PlaneGeometry(8,5),mat);fog.position.y=2;fog.userData.ep2Geometry=fog.userData.ep2Material=true;group.add(fog);
    lv.anim.push(dt=>{mat.uniforms.time.value+=dt;return true;});
  }else{
    const wood=lv.game.materials.get('bark');
    for(let i=0;i<7;i++){const a=new THREE.Vector3(-2+i*.6,0,0),b=new THREE.Vector3(1.5-i*.45,3.5,0.2),c=new THREE.Vector3(2-i*.55,5,0);const root=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([a,b,c]),12,.13,6,false),wood);root.userData.ep2Geometry=true;root.castShadow=true;group.add(root);}
  }
  return group;
}

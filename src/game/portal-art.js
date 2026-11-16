import * as T from 'three';

/** A permanent, non-colliding threshold. The caller owns placement/unlock rules.
 * update(dt, active) eases the dimensional surface open or closed; dispose owns
 * geometry/materials only, never the chapter's shared PBR textures. */
export function createPortal(game, pos, { color = 0xe3a75e } = {}) {
  const root = new T.Group(), gate = new T.Group(), ownedGeo = new Set(), ownedMat = new Set();
  root.position.copy(pos); root.userData.portal = true;
  gate.rotation.y = Math.PI / 4; root.add(gate);
  const register = (geo, mat) => { ownedGeo.add(geo); ownedMat.add(mat); return new T.Mesh(geo, mat); };
  const add = (parent, geo, mat, x=0,y=0,z=0) => { const m=register(geo,mat);m.position.set(x,y,z);parent.add(m);return m; };
  const tint = new T.Color(color), tex = game.materials?.tex?.rock_surface;
  const stone = new T.MeshStandardMaterial({ color:0x797364, roughness:.9, metalness:.08, map:tex?.diff??null, normalMap:tex?.nor??null, normalScale:new T.Vector2(.4,.4) });
  const bronze = new T.MeshStandardMaterial({color:0x876b40,metalness:.62,roughness:.6});
  const light = new T.MeshBasicMaterial({color:tint.clone().multiplyScalar(1.5),transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending});
  const matrix = new T.Matrix4(), quat = new T.Quaternion(), scale = new T.Vector3(), at = new T.Vector3();
  // A single instance batch forms the arch and its two stone plinths.
  const count = game.low ? 18 : 24, archGeo = new T.BoxGeometry(.45,.39,.48), blocks = new T.InstancedMesh(archGeo,stone,count+2);
  ownedGeo.add(archGeo);ownedMat.add(stone);gate.add(blocks);blocks.castShadow=!game.low;blocks.receiveShadow=true;
  for(let i=0;i<count;i++){
    const a=i/count*Math.PI*2, r=1.67;
    at.set(Math.cos(a)*r,2.42+Math.sin(a)*2.22,0);
    quat.setFromAxisAngle(new T.Vector3(0,0,1),Math.atan2(2.22*Math.cos(a),-r*Math.sin(a)));
    scale.set(.86+Math.sin(i*3.7)*.055,1+(i%3)*.04,1+(i%4)*.035);
    matrix.compose(at,quat,scale);blocks.setMatrixAt(i,matrix);
  }
  for(let i=0;i<2;i++){matrix.compose(at.set((i?1:-1)*.87,.13,0),quat.identity(),scale.set(3.1,.72,2.1));blocks.setMatrixAt(count+i,matrix);}
  blocks.computeBoundingSphere();
  const rimGeo = new T.TorusGeometry(1.48,.035,6,game.low?48:80);
  const inner=add(gate,rimGeo,bronze,0,2.42,.22);inner.scale.y=1.42;
  const seam=add(gate,new T.TorusGeometry(1.41,.018,5,game.low?48:80),light,0,2.42,.23);seam.scale.y=1.43;
  const material = new T.ShaderMaterial({
    uniforms:{time:{value:0},opening:{value:0},tint:{value:tint}},transparent:true,depthWrite:false,side:T.DoubleSide,
    vertexShader:'varying vec2 p;void main(){p=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec2 p;uniform float time,opening;uniform vec3 tint;
      float hash(vec2 q){return fract(sin(dot(q,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 q){vec2 i=floor(q),f=fract(q);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      void main(){float r=length(p);float aperture=(1.-smoothstep(opening-.07,opening,r));if(aperture<.001)discard;
        float a=atan(p.y,p.x);vec2 drift=vec2(a*1.4-r*5.+time*.35,r*8.-time*.75);
        float mist=noise(drift)*.65+noise(drift*2.1+4.)*.35;
        float edge=pow(smoothstep(.55,1.,r/max(.01,opening)),4.);
        float threads=pow(.5+.5*sin(a*11.+r*23.-time*2.+mist*6.),12.)*smoothstep(.1,.9,r);
        vec3 deep=mix(vec3(.012,.02,.027),vec3(.055,.12,.14),mist);
        vec3 col=deep+tint*(mist*.12+threads*.25+edge*1.5);
        gl_FragColor=vec4(col,aperture*(.9+edge*.1)*smoothstep(0.,.18,opening));}`,
  });
  const surface=add(gate,new T.CircleGeometry(1.39,game.low?48:80),material,0,2.42,.19);surface.scale.y=1.44;surface.renderOrder=2;
  const groundMat=new T.ShaderMaterial({uniforms:{time:{value:0},power:{value:0},tint:{value:tint}},transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,
    vertexShader:'varying vec2 p;void main(){p=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'varying vec2 p;uniform float time,power;uniform vec3 tint;void main(){float r=length(p),a=atan(p.y,p.x);float ring=exp(-abs(r-.71)*100.)+exp(-abs(r-.9)*130.)*.45;float marks=step(.89,cos(a*24.))*smoothstep(.69,.74,r)*(1.-smoothstep(.8,.83,r));float haze=pow(max(0.,1.-r),3.)*.1;gl_FragColor=vec4(tint*1.2,(ring+marks*.55+haze)*power*.65);}' });
  const floor=add(root,new T.PlaneGeometry(5.2,5.2).rotateX(-Math.PI/2),groundMat,0,.075,0);floor.renderOrder=1;
  const runeGeo=new T.BoxGeometry(.025,.12,.022),runes=new T.InstancedMesh(runeGeo,light,16);
  ownedGeo.add(runeGeo);gate.add(runes);
  for(let i=0;i<16;i++){const a=i*Math.PI/8;matrix.compose(at.set(Math.cos(a)*1.64,2.42+Math.sin(a)*2.19,.255),quat.setFromAxisAngle(new T.Vector3(0,0,1),a-Math.PI/2),scale.set(1,1+(i%3)*.3,1));runes.setMatrixAt(i,matrix);}runes.computeBoundingSphere();
  const n=game.low?16:28,positions=new Float32Array(n*3),emberGeo=new T.BufferGeometry();emberGeo.setAttribute('position',new T.BufferAttribute(positions,3));
  const emberMat=new T.ShaderMaterial({uniforms:{power:{value:0},tint:{value:tint}},transparent:true,depthWrite:false,blending:T.AdditiveBlending,
    vertexShader:'uniform float power;void main(){vec4 v=modelViewMatrix*vec4(position,1.);gl_PointSize=min(5.,100./max(1.,-v.z))*power;gl_Position=projectionMatrix*v;}',
    fragmentShader:'uniform float power;uniform vec3 tint;void main(){float r=length(gl_PointCoord-.5);float a=(1.-smoothstep(.06,.5,r));gl_FragColor=vec4(tint*1.6,a*power);}' });
  const embers=new T.Points(emberGeo,emberMat);embers.frustumCulled=false;gate.add(embers);ownedGeo.add(emberGeo);ownedMat.add(emberMat);
  let elapsed=0,power=0,disposed=false;
  return {root,update(dt,active=true){
    if(disposed)return;elapsed+=dt;power+=((active?1:0)-power)*(1-Math.exp(-dt*3.8));material.uniforms.time.value=elapsed;material.uniforms.opening.value=power;
    light.opacity=power*(.48+.07*Math.sin(elapsed*2));groundMat.uniforms.time.value=elapsed;groundMat.uniforms.power.value=power;emberMat.uniforms.power.value=power;
    for(let i=0;i<n;i++){const a=i*2.399+elapsed*(.18+(i%3)*.05),r=1.35+Math.sin(i*4.1+elapsed)*.16;positions[i*3]=Math.cos(a)*r;positions[i*3+1]=2.42+Math.sin(a)*r*1.44;positions[i*3+2]=.3+Math.sin(i+elapsed*.9)*.22;}emberGeo.attributes.position.needsUpdate=true;
  },dispose(){if(disposed)return;disposed=true;root.removeFromParent();blocks.dispose();runes.dispose();for(const geo of ownedGeo)geo.dispose();for(const mat of ownedMat)mat.dispose();}};
}

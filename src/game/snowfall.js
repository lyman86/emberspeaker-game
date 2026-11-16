import * as T from 'three';
const hash=n=>{const v=Math.sin(n*127.1+17.37)*43758.5453;return v-Math.floor(v);};
/** Camera-facing snowflakes: soft grains in the distance, gently tumbling six-arm flakes nearby. */
export function createSnowfall({count=520,area=48,height=20,speed=1,opacity=.72}={}){
 const geo=new T.PlaneGeometry(1,1),seeds=new Float32Array(count*4),params=new Float32Array(count*4),m=new T.Matrix4();
 for(let i=0;i<count;i++){
  const near=i%9===0,mid=i%3===0;seeds.set([(hash(i+1)-.5)*area,hash(i+201)*height,(hash(i+401)-.5)*area,hash(i+601)],i*4);
  params.set([(.35+hash(i+801)*.65)*speed,near?.18+hash(i+1001)*.14:mid?.08+hash(i+1001)*.08:.035+hash(i+1001)*.05,hash(i+1201)*6.283,near?1:0],i*4);
 }
 geo.setAttribute('snowSeed',new T.InstancedBufferAttribute(seeds,4));geo.setAttribute('snowParams',new T.InstancedBufferAttribute(params,4));
 const mat=new T.ShaderMaterial({uniforms:{time:{value:0},area:{value:area},height:{value:height},gust:{value:0},anchor:{value:new T.Vector2()},opacity:{value:opacity}},transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:false,
 vertexShader:`attribute vec4 snowSeed,snowParams;uniform float time,area,height,gust;uniform vec2 anchor;varying vec2 flakeUV;varying float flakeAlpha,crystal;void main(){
  float phase=snowParams.z,fall=snowParams.x*(1.+gust*.5),age=time*fall;
  vec3 center=snowSeed.xyz;center.y=mod(center.y-age,height);
  center.x=mod(center.x-anchor.x+area*.5+sin(time*.37+phase)*.65+time*(.16+gust*.5),area)-area*.5;
  center.z=mod(center.z-anchor.y+area*.5+cos(time*.29+phase*1.7)*.5+time*(.07+gust*.14),area)-area*.5;
  vec4 viewCenter=modelViewMatrix*vec4(center,1.);float turn=time*(.24+snowSeed.w*.3)+phase;
  vec2 p=position.xy;float c=cos(turn),s=sin(turn);p=mat2(c,-s,s,c)*p;
  p.x*=.65+.35*abs(sin(time*.55+phase));viewCenter.xy+=p*snowParams.y;
  gl_Position=projectionMatrix*viewCenter;flakeUV=uv;crystal=snowParams.w;
  float ground=smoothstep(0.,.7,center.y),ceiling=1.-smoothstep(height-1.5,height,center.y);
  flakeAlpha=ground*ceiling*(.36+snowSeed.w*.45)*(1.-smoothstep(45.,82.,-viewCenter.z));
 }`,
 fragmentShader:`uniform float opacity;varying vec2 flakeUV;varying float flakeAlpha,crystal;void main(){
  vec2 p=(flakeUV-.5)*2.;float r=length(p),a=atan(p.y,p.x);
  float grain=1.-smoothstep(.13,.95,r);float arm=pow(.5+.5*cos(a*6.),18.);
  float six=(1.-smoothstep(.16,.98,r))*(.28+.72*arm);float alpha=mix(grain,six,crystal)*flakeAlpha*opacity;
  if(alpha<.015)discard;gl_FragColor=vec4(.88,.94,.98,alpha);
 }`});
 const mesh=new T.InstancedMesh(geo,mat,count);mesh.name='Layered snowfall';mesh.frustumCulled=false;
 for(let i=0;i<count;i++)mesh.setMatrixAt(i,m);let elapsed=0;
 return {mesh,update(dt,{gust=0,opacity:alpha=opacity}={}){elapsed+=dt;mat.uniforms.time.value=elapsed;mat.uniforms.gust.value=gust;mat.uniforms.opacity.value=alpha;}};
}

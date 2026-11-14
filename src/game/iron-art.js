import * as T from 'three';
const UP=new T.Vector3(0,1,0);
function builder(group,own=()=>{}){
 const mats=new Set(),geos=new Set();
 const mat=(color,more={})=>{const m=new T.MeshStandardMaterial({color,roughness:.65,...more});mats.add(m);return m;};
 const add=(geo,m,p=[0,0,0],s=[1,1,1],r=[0,0,0])=>{const o=new T.Mesh(geo,m);o.position.fromArray(p);o.scale.fromArray(s);o.rotation.set(...r);o.castShadow=o.receiveShadow=true;group.add(o);geos.add(geo);own(o);return o;};
 const bar=(a,b,r,m)=>{const p=new T.Vector3(...a),d=new T.Vector3(...b).sub(p),o=add(new T.CylinderGeometry(r,r,d.length(),6),m,p.addScaledVector(d,.5).toArray());o.quaternion.setFromUnitVectors(UP,d.normalize());return o;};
 return {mat,add,bar,dispose(){for(const g of geos)g.dispose();for(const m of mats)m.dispose();}};
}
/** Authored siege silhouettes reuse the game's wood and stone palette without new downloads. */
export function ironProp(lv,p,x,z){
 if(!['@war_tent','@barricade','@iron_brazier','@iron_banner','@war_table','@iron_throne'].includes(p.prop))return false;
 const root=new T.Group();root.position.set(x,0,z);root.rotation.y=p.rot??0;root.scale.setScalar(p.s??1);
 const b=builder(root),{mat,add,bar}=b;
 const wood=mat(0x4c3526),iron=mat(0x333b47,{metalness:.8,roughness:.35}),cloth=mat(0x6c1b25,{side:T.DoubleSide}),gold=mat(0xa98b50,{metalness:.65}),stone=mat(0x52545b);
 if(p.prop==='@war_tent'){
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute([-3,0,-2,0,4,-2,3,0,-2,-3,0,2,0,4,2,3,0,2],3));geo.setIndex([0,3,1,1,3,4,1,4,2,2,4,5,0,1,2]);geo.computeVertexNormals();add(geo,cloth);
  bar([0,0,-2],[0,4.3,-2],.09,wood);bar([0,0,2],[0,4.3,2],.09,wood);bar([0,4.1,-2],[0,4.1,2],.08,wood);
 }else if(p.prop==='@barricade'){
  for(const side of [-1,1]){bar([side*1.9,0,-.7],[side*1.9,2.2,.7],.11,wood);bar([side*1.9,0,.7],[side*1.9,2.2,-.7],.11,wood);}
  for(let i=0;i<7;i++){const o=add(new T.ConeGeometry(.12,2.7,5),wood,[-1.8+i*.6,1.6,0]);o.rotation.x=.45;}
  bar([-2.4,1,0],[2.4,1,0],.1,iron);
 }else if(p.prop==='@iron_banner'){
  bar([0,0,0],[0,6.5,0],.07,iron);bar([-1.3,5.9,0],[1.3,5.9,0],.055,gold);
  add(new T.BoxGeometry(2.3,3.6,.035),cloth,[0,3.9,0]);add(new T.TorusGeometry(.42,.055,5,20),gold,[0,4.2,.04]);
  for(let i=0;i<3;i++)add(new T.ConeGeometry(.12,.5,4),gold,[(i-1)*.32,4.7,.05]);
 }else if(p.prop==='@iron_brazier'){
  add(new T.CylinderGeometry(.65,.9,.45,8),stone,[0,.23,0]);for(const s of [-1,1])bar([s*.5,.3,0],[s*.7,1.8,0],.07,iron);
  add(new T.CylinderGeometry(.75,.35,.45,10,1,true),iron,[0,1.5,0]);lv.emitters.push({kind:'candle',x,y:1.65,z,acc:0});lv.torches.push({x,y:2.4,z,color:0xffa34e,power:85,seed:x});
 }else if(p.prop==='@war_table'){
  add(new T.BoxGeometry(3.5,.25,2.2),wood,[0,1.6,0]);for(const a of [-1.4,1.4])for(const c of [-.8,.8])add(new T.BoxGeometry(.14,1.6,.14),iron,[a,.8,c]);
  add(new T.BoxGeometry(2.7,.015,1.5),mat(0xb5a47c),[0,1.74,0]);for(let i=0;i<6;i++)add(new T.ConeGeometry(.1,.25,5),i%2?gold:cloth,[(i%3-1)*.7,1.88,i<3?-.4:.4]);
 }else{
  add(new T.BoxGeometry(5,.4,3),stone,[0,.2,0]);add(new T.BoxGeometry(2.2,.7,1.8),iron,[0,.8,0]);add(new T.BoxGeometry(2.3,4,.35),iron,[0,2.3,-.8]);add(new T.BoxGeometry(1.6,3,.04),cloth,[0,2.2,-.6]);
  for(const s of [-1,1])add(new T.BoxGeometry(.3,1.8,2),gold,[s*1.2,1.3,0]);for(let i=0;i<5;i++)add(new T.ConeGeometry(.18,.9,4),gold,[(i-2)*.45,4.6,-.8]);
 }
 // Every owned material, including unused palette entries, belongs to the level's disposal pass.
 root.userData.ironDispose=b.dispose;lv.group.add(root);return true;
}
export function dressIronEnemy(e){
 if(e.T.episode!==3)return;
 const root=new T.Group(),b=builder(root),{mat,add,bar}=b,iron=mat(e.type==='blackknight'?0x171c28:0x4c515b,{metalness:.8,roughness:.35}),red=mat(0x7d1c2b,{side:T.DoubleSide}),gold=mat(0xc5a25d,{metalness:.7}),wood=mat(0x4c3324);
 if(['warbanner','ballista'].includes(e.type)){
  e.model.visible=false;e.root.add(root);
  if(e.type==='warbanner'){
   bar([0,0,0],[0,5.8,0],.065,iron);bar([-1,5.4,0],[1,5.4,0],.04,gold);add(new T.BoxGeometry(1.9,3.2,.04),red,[0,3.7,0]);add(new T.TorusGeometry(.4,.055,5,20),gold,[0,4,.04]);for(let i=0;i<3;i++)add(new T.ConeGeometry(.12,.5,4),gold,[(i-1)*.3,4.5,.05]);
  }else{
   add(new T.BoxGeometry(2.6,.25,3.2),wood,[0,.7,0]);for(const side of [-1,1]){for(const z of [-.9,.9])add(new T.CylinderGeometry(.65,.65,.2,12),iron,[side*1.3,.65,z],[1,1,1],[0,0,Math.PI/2]);bar([side*1.1,.8,-1.1],[side*.65,1.9,.6],.12,wood);bar([0,1.8,.4],[side*2.4,1.8,.9],.09,wood);bar([side*2.4,1.8,.9],[0,1.8,2],.018,gold);}
   bar([0,1.85,-1.5],[0,1.85,2.4],.055,iron);add(new T.ConeGeometry(.16,.65,4),iron,[0,1.85,2.6],[1,1,1],[Math.PI/2,0,0]);
  }
 }else{
  const file=({rebel:'bram',raider:'bram',arbalist:'ranger_pc',assassin:'arissa',berserker:'warrior_pc',captain:'roland',blackknight:'paladin_pc',ironking:'paladin_pc'})[e.type];
  const source=e.game.assets.gltf.get('mx:'+file)?.scene,original=[],bones=[];source?.updateMatrixWorld(true);source?.traverse(o=>{if(o.isBone)original.push(o);});e.model.traverse(o=>{if(o.isBone)bones.push(o);});
  const attach=(suffix,make)=>{const ref=original.find(o=>o.name.endsWith(suffix)),bone=bones.find(o=>o.name.endsWith(suffix));if(!ref||!bone)return;const start=root.children.length,p=new T.Vector3().setFromMatrixPosition(ref.matrixWorld);make(p);const g=new T.Group();for(const o of [...root.children].slice(start))g.add(o);g.applyMatrix4(ref.matrixWorld.clone().invert());bone.add(g);root.userData.attachments??=[];root.userData.attachments.push(g);};
  const armored=['rebel','captain','blackknight','ironking'].includes(e.type),boss=['blackknight','ironking'].includes(e.type);
  for(const m of e.mats)m.color.multiply(new T.Color(e.type==='assassin'?0x6f687b:e.type==='blackknight'?0x656a7c:0xb0a195));
  attach('Spine2',p=>{
   if(armored)add(new T.SphereGeometry(1,10,8),iron,[p.x,p.y-.03,p.z],[.28,.32,.18]);
   add(new T.BoxGeometry(boss?.6:.4,boss?.95:.65,.025),red,[p.x,p.y-.3,p.z-.19]);
   if(boss)for(const s of [-1,1])add(new T.SphereGeometry(1,8,6),iron,[p.x+s*.3,p.y+.13,p.z],[.17,.13,.18]);
  });
  attach('Head',p=>{
   if(armored)add(new T.SphereGeometry(1,10,8),iron,[p.x,p.y+.08,p.z],[.16,.19,.17]);
   if(e.type==='ironking'){add(new T.CylinderGeometry(.19,.19,.09,12,1,true),gold,[p.x,p.y+.26,p.z]);for(let i=0;i<7;i++){const a=i*Math.PI*2/7;add(new T.ConeGeometry(.04,.17,4),gold,[p.x+Math.sin(a)*.17,p.y+.36,p.z+Math.cos(a)*.17]);}}
   if(e.type==='blackknight')add(new T.BoxGeometry(.04,.28,.28),red,[p.x,p.y+.29,p.z-.03]);
   if(e.type==='assassin')add(new T.SphereGeometry(.18,10,8),red,[p.x,p.y+.06,p.z-.03]);
  });
  if(['rebel','captain'].includes(e.type))attach('LeftHand',p=>{add(new T.BoxGeometry(.46,.65,.07),iron,[p.x,p.y,p.z+.1]);add(new T.BoxGeometry(.04,.54,.012),gold,[p.x,p.y,p.z+.14]);});
  if(['raider','captain','rebel','assassin'].includes(e.type))attach('RightHand',p=>{bar([p.x,p.y-.2,p.z],[p.x,p.y+.35,p.z],.023,wood);add(new T.BoxGeometry(e.type==='assassin'?.05:.23,.3,.028),iron,[p.x+.07,p.y+.37,p.z]);});
 }
 e.ironArtDispose=()=>{for(const o of root.userData.attachments??[])o.removeFromParent();root.removeFromParent();b.dispose();};
}

import * as THREE from 'three';

/** Bone-bound silhouettes for the local rigs used by chapter two. Dimensions are rig metres. */
export function dressPlagueEnemy(e) {
  if (!['villager','goblin','werewolf','witch','butcher'].includes(e.type)) return;
  const source=e.game.assets.gltf.get('mx:'+({villager:'warrior',goblin:'minion',werewolf:'elite',witch:'mage',butcher:'elite'}[e.type]))?.scene;
  if (!source) return;
  source.updateMatrixWorld(true);
  const original=[],bones=[],owned=[],geometries=new Set(),materials=new Set();
  source.traverse(o=>{if(o.isBone)original.push(o);});
  e.model.traverse(o=>{if(o.isBone)bones.push(o);});
  const find=(list,suffix)=>list.find(o=>o.name.endsWith(suffix));
  const position=name=>new THREE.Vector3().setFromMatrixPosition(find(original,name).matrixWorld);
  const mat=(color,extras={})=>{const m=new THREE.MeshStandardMaterial({color,roughness:0.88,...extras});materials.add(m);return m;};
  const cloth=mat({villager:0x605940,goblin:0x37422b,werewolf:0x292b29,witch:0x2d263e,butcher:0x8d8471}[e.type],{side:THREE.DoubleSide});
  const bone=mat(0xaca38b),iron=mat(0x3d4142,{metalness:0.65,roughness:0.5}),leather=mat(0x35281e),flesh=mat(0x72704b),glow=mat(0x587437,{emissive:0x426416,emissiveIntensity:0.65,roughness:0.44});
  const round=new THREE.SphereGeometry(1,10,7),cone=new THREE.ConeGeometry(1,1,7),box=new THREE.BoxGeometry(1,1,1);
  [round,cone,box].forEach(g=>geometries.add(g));
  const add=(parent,geo,material,p=[0,0,0],s=[1,1,1],r=[0,0,0])=>{
    geometries.add(geo);const m=new THREE.Mesh(geo,material);m.position.fromArray(p);m.scale.fromArray(s);m.rotation.set(...r);m.castShadow=true;parent.add(m);return m;
  };
  // Build in the unscaled source pose, then convert the whole accessory into the selected bone's frame.
  const attach=(name,build)=>{
    const b=find(bones,name),ref=find(original,name);if(!b||!ref)return;
    const group=new THREE.Group();build(group,position(name));
    group.applyMatrix4(ref.matrixWorld.clone().invert());b.add(group);owned.push(group);
  };
  const tube=(parent,points,r,material)=>add(parent,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),Math.max(8,points.length*4),r,5,false),material);
  const rag=(parent,at,w,h,material)=>{
    const vertices=[-w/2,0,0,w/2,0,0,-w*.47,-h*.48,.035,w*.47,-h*.48,.035,-w*.38,-h,.02,0,-h*.91,.045,w*.3,-h*.98,.02];
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex([0,2,1,1,2,3,2,4,5,2,5,3,3,5,6]);g.computeVertexNormals();
    return add(parent,g,material,at);
  };
  const tint={villager:0xb4aa7f,goblin:0x88a572,werewolf:0x9a9690,witch:0xb4a1b7,butcher:0xafa28e}[e.type];
  for(const m of e.mats){m.color.multiply(new THREE.Color(tint));m.roughness=Math.max(0.8,m.roughness);}

  if(e.type==='villager'){
    attach('Spine2',(g,p)=>{
      rag(g,[p.x,p.y+.1,p.z+.22],.42,.65,cloth);
      // Burst fungal colonies grow from the shoulder and spine rather than covering the whole body.
      for(let i=0;i<5;i++){
        const a=i*2.4,r=.07+(i%3)*.018,x=p.x+Math.cos(a)*.18,y=p.y+.1+Math.sin(a)*.15,z=p.z-.2;
        add(g,round,flesh,[x,y,z],[r,r*.7,r*.5]);
        add(g,round,glow,[x,y+.025,z-.035],[r*.35,r*.23,r*.22]);
      }
      tube(g,[[p.x-.16,p.y-.1,p.z+.22],[p.x-.08,p.y+.16,p.z+.2],[p.x+.14,p.y+.23,p.z-.18]],.018,leather);
    });
    attach('Head',(g,p)=>{rag(g,[p.x-.12,p.y+.12,p.z+.09],.12,.29,cloth);});
  }
  if(e.type==='goblin'){
    attach('Head',(g,p)=>{
      for(const side of [-1,1]){
        const ear=add(g,cone,flesh,[p.x+side*.2,p.y+.12,p.z],[.095,.32,.045],[0,0,-side*1.2]);
        ear.rotation.x=.15;
      }
      add(g,cone,flesh,[p.x,p.y+.025,p.z+.2],[.065,.19,.065],[Math.PI/2,0,0]);
      rag(g,[p.x,p.y+.2,p.z-.06],.29,.33,cloth);
    });
    attach('Spine2',(g,p)=>{
      add(g,round,leather,[p.x,p.y-.07,p.z-.23],[.2,.26,.14]);
      for(const side of [-1,1])tube(g,[[p.x+side*.17,p.y+.2,p.z-.19],[p.x+side*.2,p.y+.17,p.z+.12],[p.x+side*.15,p.y-.18,p.z+.15]],.02,cloth);
      for(let i=0;i<3;i++)add(g,cone,bone,[p.x-.12+i*.12,p.y+.2,p.z-.25],[.028,.25,.028],[.2,0,(i-1)*.15]);
    });
    attach('RightHand',(g,p)=>{
      const handle=add(g,box,leather,p.toArray(),[.045,.22,.045]);
      const blade=new THREE.Shape();blade.moveTo(0,0);blade.lineTo(.09,.22);blade.lineTo(0,.46);blade.lineTo(-.045,.18);blade.closePath();
      add(g,new THREE.ExtrudeGeometry(blade,{depth:.025,bevelEnabled:false}),iron,[p.x,p.y+.08,p.z]);
      add(g,box,glow,[p.x+.025,p.y+.28,p.z+.028],[.018,.2,.008],[0,0,-.16]);
      void handle;
    });
  }
  if(e.type==='werewolf'){
    attach('Head',(g,p)=>{
      add(g,round,cloth,[p.x,p.y+.05,p.z+.03],[.2,.19,.18]);
      add(g,round,cloth,[p.x,p.y-.04,p.z+.21],[.13,.095,.23]);
      add(g,round,iron,[p.x,p.y-.025,p.z+.4],[.085,.055,.045]);
      for(const side of [-1,1]){
        add(g,cone,cloth,[p.x+side*.14,p.y+.26,p.z-.005],[.095,.27,.065],[.2,0,-side*.15]);
        add(g,cone,bone,[p.x+side*.08,p.y-.1,p.z+.3],[.022,.11,.022],[Math.PI,0,0]);
        add(g,round,glow,[p.x+side*.125,p.y+.08,p.z+.17],[.027,.018,.015]);
      }
    });
    attach('Spine2',(g,p)=>{
      for(let i=0;i<13;i++){
        const a=i*2.4,x=p.x+Math.cos(a)*.32,z=p.z+Math.sin(a)*.22,y=p.y+.25+(i%3)*.04;
        add(g,cone,cloth,[x,y,z],[.1,.3,.08],[Math.sin(a)*.7,0,-Math.cos(a)*.7]);
      }
    });
    for(const side of ['Left','Right'])attach(side+'Hand',(g,p)=>{
      for(let i=0;i<3;i++)add(g,cone,bone,[p.x+(i-1)*.045,p.y-.1,p.z+.08],[.018,.22,.018],[Math.PI*.75,0,0]);
    });
  }
  if(e.type==='witch'){
    attach('Head',(g,p)=>{
      const brim=add(g,new THREE.CylinderGeometry(.31,.33,.025,20),cloth,[p.x,p.y+.18,p.z]);brim.rotation.z=-.12;
      const points=[[.26,0],[.23,.1],[.17,.25],[.12,.4],[.06,.56],[.005,.66]].map(([r,y])=>new THREE.Vector2(r,y));
      const hat=add(g,new THREE.LatheGeometry(points,16),cloth,[p.x,p.y+.18,p.z]);
      const a=hat.geometry.attributes.position;for(let i=0;i<a.count;i++){const y=a.getY(i);a.setX(i,a.getX(i)+Math.pow(y,2)*.38);}a.needsUpdate=true;hat.geometry.computeVertexNormals();
      tube(g,[[p.x-.24,p.y+.21,p.z],[p.x,p.y+.2,p.z+.25],[p.x+.24,p.y+.21,p.z]],.018,leather);
      for(const side of [-1,1])rag(g,[p.x+side*.18,p.y+.12,p.z-.05],.14,.57,cloth);
    });
    attach('Spine2',(g,p)=>{
      for(const side of [-1,1])rag(g,[p.x+side*.16,p.y+.12,p.z-.16],.25,.82,cloth);
      for(let i=0;i<5;i++)add(g,round,i===2?glow:bone,[p.x+(i-2)*.055,p.y-.12-Math.abs(i-2)*-.025,p.z+.18],[.025,.04,.018]);
    });
    attach('LeftHand',(g,p)=>{
      tube(g,[[p.x,p.y-.65,p.z],[p.x+.025,p.y+.2,p.z],[p.x-.08,p.y+.6,p.z],[p.x,p.y+.76,p.z],[p.x+.16,p.y+.7,p.z]],.025,leather);
      add(g,new THREE.TorusGeometry(.12,.014,5,16),iron,[p.x+.07,p.y+.55,p.z]);
      add(g,round,glow,[p.x+.07,p.y+.54,p.z],[.055,.09,.045]);
      for(let i=0;i<3;i++)add(g,cone,bone,[p.x-.1+i*.1,p.y+.75,p.z],[.022,.16,.025],[0,0,(i-1)*-.4]);
    });
  }
  if(e.type==='butcher'){
    attach('Spine2',(g,p)=>{
      rag(g,[p.x,p.y+.14,p.z+.28],.66,1.12,cloth);
      // Blood-dark seam and individual sutures read across the broad apron.
      tube(g,[[p.x-.15,p.y+.05,p.z+.29],[p.x-.06,p.y-.32,p.z+.32],[p.x+.11,p.y-.72,p.z+.31]],.012,leather);
      for(let i=0;i<7;i++){
        const y=p.y-i*.11,x=p.x-.15+i*.035;
        tube(g,[[x-.05,y-.025,p.z+.32],[x+.05,y+.025,p.z+.32]],.008,bone);
      }
      add(g,box,leather,[p.x,p.y-.33,p.z+.32],[.7,.055,.035]);
      add(g,box,iron,[p.x+.19,p.y-.33,p.z+.35],[.085,.085,.025]);
    });
    attach('Head',(g,p)=>{
      add(g,round,iron,[p.x,p.y-.06,p.z+.18],[.18,.15,.065]);
      for(const side of [-1,1])add(g,box,leather,[p.x+side*.07,p.y-.02,p.z+.242],[.055,.016,.008]);
      for(let i=0;i<5;i++)add(g,round,bone,[p.x-.12+i*.06,p.y-.14,p.z+.23],[.011,.011,.008]);
    });
    attach('RightHand',(g,p)=>{
      tube(g,[[p.x,p.y+.18,p.z],[p.x,p.y-.15,p.z]],.04,leather);
      tube(g,[[p.x,p.y-.15,p.z],[p.x-.1,p.y-.4,p.z],[p.x-.03,p.y-.6,p.z],[p.x+.14,p.y-.61,p.z],[p.x+.21,p.y-.46,p.z],[p.x+.12,p.y-.34,p.z]],.032,iron);
      for(let i=0;i<5;i++)add(g,new THREE.TorusGeometry(.035,.009,5,9),iron,[p.x,p.y+.21+i*.047,p.z],[1,1,1],[i%2*Math.PI/2,0,0]);
    });
  }
  let disposed=false;
  e.plagueArtDispose=()=>{if(disposed)return;disposed=true;for(const o of owned)o.removeFromParent();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();};
}

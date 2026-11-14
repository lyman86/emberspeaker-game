import * as T from 'three';

/** Full equipment silhouettes for small inventory cells; worn pieces retain their rig-fitting geometry. */
export function inventoryModel(it,K){
  if(!['chest','robe','leather','gloves','boots','helm','hood'].includes(it.base))return null;
  const root=new T.Group(),owned=new Set();
  const add=(geo,mat,p=[0,0,0],s=[1,1,1],r=[0,0,0])=>{owned.add(geo);const m=new T.Mesh(geo,mat);m.position.fromArray(p);m.scale.fromArray(s);m.rotation.set(...r);root.add(m);return m;};
  const plate=(points,depth,mat,z=0)=>{
    const shape=new T.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
    const g=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelThickness:.012,bevelSize:.012,bevelSegments:2,curveSegments:8});g.translate(0,0,-depth/2);return add(g,mat,[0,0,z]);
  };
  const bar=(a,b,r,mat)=>{const from=new T.Vector3(...a),d=new T.Vector3(...b).sub(from);const m=add(new T.CylinderGeometry(r,r,d.length(),8),mat,from.addScaledVector(d,.5).toArray());m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return m;};
  const trim=K.r==='common'?K.steel:K.trim;
  if(['chest','robe','leather'].includes(it.base)){
    const robe=it.base==='robe',leather=it.base==='leather',body=robe?K.cloth:leather?K.leather:K.main,bottom=robe?-.56:-.31;
    const outline=robe?
      [[-.12,.31],[-.3,.23],[-.38,-.07],[-.26,-.12],[-.2,.06],[-.15,-.12],[-.27,bottom],[.27,bottom],[.15,-.12],[.2,.06],[.26,-.12],[.38,-.07],[.3,.23],[.12,.31],[.08,.2],[0,.17],[-.08,.2]]:
      leather?[[-.12,.31],[-.23,.25],[-.2,.05],[-.16,-.05],[-.17,bottom],[.17,bottom],[.16,-.05],[.2,.05],[.23,.25],[.12,.31],[.08,.2],[0,.18],[-.08,.2]]:
      [[-.12,.31],[-.3,.24],[-.34,.08],[-.25,.03],[-.2,.12],[-.18,-.2],[-.13,bottom],[.13,bottom],[.18,-.2],[.2,.12],[.25,.03],[.34,.08],[.3,.24],[.12,.31],[.08,.21],[0,.18],[-.08,.21]];
    plate(outline,robe?.07:.13,body);
    // Neck opening, shoulder volume and a waist belt keep the garment readable at 46 px.
    for(const side of [-1,1]){
      bar([side*.12,.3,.09],[side*.08,.21,.1],.013,trim);bar([side*.08,.21,.1],[0,.18,.1],.012,trim);
      if(!robe&&!leather)add(new T.SphereGeometry(.115,16,10),K.main,[side*.25,.21,0],[1.1,.7,.9]);
      if(robe)bar([side*.11,-.13,.06],[side*.2,bottom+.02,.06],.012,trim);
    }
    add(new T.BoxGeometry(robe?.33:.36,.055,.17),K.leather,[0,-.13,.015]);
    add(new T.BoxGeometry(.075,.063,.02),trim,[0,-.13,.11]);
    if(robe){
      plate([[-.05,.17],[0,.09],[.05,.17],[.02,-.1],[-.02,-.1]],.014,trim,.06);
      bar([-.25,bottom+.02,.06],[.25,bottom+.02,.06],.012,trim);
      for(const x of [-.12,-.04,.04,.12])bar([x*.6,-.18,.05],[x*1.5,bottom+.04,.05],.006,K.cloth);
    }else if(leather){
      for(let i=0;i<5;i++)for(const side of [-1,1])add(new T.SphereGeometry(.01,6,5),trim,[side*.1,.1-i*.065,.085]);
      for(let i=0;i<4;i++)bar([-.02,.11-i*.06,.09],[.02,.08-i*.06,.09],.006,trim);
      add(new T.BoxGeometry(.085,.1,.025),K.leather,[.09,-.04,.09]);
    }else{
      for(const side of [-1,1])plate([[side*.02,.14],[side*.16,.16],[side*.15,-.04],[side*.03,-.08]],.035,K.steel,.08);
      for(const y of [-.19,-.25])bar([-.13,y,.09],[.13,y,.09],.009,trim);
      plate([[0,.1],[.04,.05],[0,-.015],[-.04,.05]],.02,trim,.135);
    }
    if(K.gemMat)add(new T.OctahedronGeometry(.025),K.gemMat,[0,robe?.1:.05,.15],[1,1.25,.6]);
  }else if(it.base==='gloves'){
    const skin=K.r==='common'?K.leather:K.main;
    add(new T.SphereGeometry(1,18,12),skin,[0,.005,0],[.105,.13,.05]);
    add(new T.BoxGeometry(.21,.13,.1),skin,[0,-.13,0]);
    add(new T.BoxGeometry(.23,.045,.12),trim,[0,-.2,0]);
    // Separate fingers and a splayed thumb, rather than an empty wrist tube.
    for(let i=0;i<4;i++){
      const x=(i-1.5)*.05,length=[.13,.18,.165,.12][i],y=.1+length/2;
      add(new T.CapsuleGeometry(.021,length-.042,4,8),skin,[x,y,0]);
      for(const at of [.11,.16])if(at<.1+length)add(new T.BoxGeometry(.038,.018,.018),trim,[x,at,.027]);
    }
    add(new T.CapsuleGeometry(.028,.09,4,8),skin,[-.125,.015,0],[1,1,1],[0,0,-.7]);
    plate([[-.075,.065],[.075,.065],[.09,-.04],[.055,-.08],[-.055,-.08],[-.09,-.04]],.018,K.steel,.05);
    if(K.gemMat)add(new T.OctahedronGeometry(.023),K.gemMat,[0,0,.08]);
  }else if(it.base==='boots'){
    add(new T.CylinderGeometry(.108,.082,.43,18),K.leather,[0,.12,0]);
    add(new T.TorusGeometry(.108,.016,7,20),trim,[0,.335,0],[1,1,1],[Math.PI/2,0,0]);
    add(new T.BoxGeometry(.19,.14,.31),K.leather,[0,-.12,.065]);
    add(new T.SphereGeometry(1,18,12),K.leather,[0,-.105,.23],[.102,.075,.125]);
    add(new T.BoxGeometry(.217,.045,.45),K.sole,[0,-.205,.11]);
    add(new T.BoxGeometry(.19,.07,.12),K.sole,[0,-.24,-.05]);
    // Toe cap, calf straps and buckle make both the boot and its facing direction explicit.
    add(new T.SphereGeometry(1,16,10),K.steel,[0,-.085,.24],[.105,.06,.12]);
    for(const y of [.05,.23]){
      add(new T.TorusGeometry(.1,.015,6,18),K.leather,[0,y,0],[1,1,1],[Math.PI/2,0,0]);
      add(new T.BoxGeometry(.065,.05,.025),trim,[0,y,.105]);
    }
    if(K.gemMat)add(new T.OctahedronGeometry(.021),K.gemMat,[0,.145,.1]);
  }else if(it.base==='helm'){
    add(new T.SphereGeometry(.18,24,16,0,Math.PI*2,0,Math.PI*.68),K.main,[0,.04,0],[1,1.08,1]);
    plate([[-.155,.07],[.155,.07],[.13,-.15],[0,-.2],[-.13,-.15]],.035,K.steel,.125);
    add(new T.BoxGeometry(.245,.026,.035),K.sole,[0,.025,.169]);
    add(new T.BoxGeometry(.026,.115,.035),K.sole,[0,-.045,.169]);
    add(new T.BoxGeometry(.015,.24,.22),trim,[0,.11,-.005]);
    for(const side of [-1,1])for(let i=0;i<3;i++)add(new T.SphereGeometry(.008,6,5),K.sole,[side*(.05+i*.026),-.095,.151]);
    if(K.gemMat)add(new T.OctahedronGeometry(.022),K.gemMat,[0,.14,.13]);
    if(K.r==='legendary')for(const side of [-1,1])add(new T.ConeGeometry(.035,.22,8),trim,[side*.17,.23,0],[1,1,1],[0,0,-side*.45]);
  }else{
    plate([[-.19,-.25],[-.21,.05],[-.15,.23],[0,.33],[.15,.23],[.21,.05],[.19,-.25],[.09,-.18],[-.09,-.18]],.09,K.cloth);
    plate([[-.12,-.13],[-.13,.05],[-.08,.17],[0,.22],[.08,.17],[.13,.05],[.12,-.13],[0,-.05]],.015,K.sole,.06);
    for(const side of [-1,1])bar([side*.13,-.12,.08],[side*.16,.05,.08],.014,trim);
    if(K.gemMat)add(new T.OctahedronGeometry(.024),K.gemMat,[0,.25,.08]);
  }
  root.userData.disposeIcon=()=>{for(const geo of owned)geo.dispose();};return root;
}

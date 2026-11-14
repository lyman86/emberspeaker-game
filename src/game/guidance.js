import * as THREE from 'three';

/** A short, walkable trail keeps the route useful around walls and branching paths. */
export class Guidance {
  constructor(game) {
    this.g=game;this.tick=0;
    const shape=new THREE.Shape();shape.moveTo(-0.48,-0.28);shape.lineTo(0,0.3);shape.lineTo(0.48,-0.28);shape.lineTo(0,-0.02);shape.closePath();
    this.geo=new THREE.ShapeGeometry(shape).rotateX(-Math.PI/2);
    this.mat=new THREE.MeshBasicMaterial({color:0xeac473,transparent:true,opacity:0.65,depthWrite:false,side:THREE.DoubleSide});
    this.trail=new THREE.InstancedMesh(this.geo,this.mat,12);this.trail.frustumCulled=false;
    this.el=document.createElement('div');this.el.id='route-guide';this.el.setAttribute('aria-live','polite');document.body.appendChild(this.el);
  }
  update(dt) {
    this.tick-=dt;if(this.tick>0)return;this.tick=0.4;
    const g=this.g,p=g.player,t=g.story.guidance();
    this.el.hidden=!t||g.cinematic||!p.alive;this.trail.visible=!this.el.hidden;
    if(!t)return;
    if(this.trail.parent!==g.level.group)g.level.group.add(this.trail);
    // Unblock the target cell for a living totem / boss; the path ends just before its collider.
    const path=g.level.findPath(p.pos.x,p.pos.z,t.x,t.z);
    let from=p.pos.clone(),covered=0,n=0;
    for(const end of path){
      const to=new THREE.Vector3(end.x,0,end.z),dir=to.clone().sub(from).normalize(),length=from.distanceTo(to);
      for(let step=2;step<length&&n<12;step+=2.8){const pos=from.clone().addScaledVector(dir,step);if(covered+step>32)break;pos.y=0.08;
        this.trail.setMatrixAt(n++,new THREE.Matrix4().compose(pos,new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.atan2(-dir.x,-dir.z)),new THREE.Vector3(1,1,1)));}
      covered+=length;from=to;if(covered>32||n===12)break;
    }
    this.trail.count=n;this.trail.instanceMatrix.needsUpdate=true;
    const next=path[0]??t,dx=next.x-p.pos.x,dz=next.z-p.pos.z;
    // Camera azimuth looks along -x,-z; project two positions to avoid a false compass direction.
    const a=g.gfx.project(p.pos,{}),b=g.gfx.project(new THREE.Vector3(next.x,0,next.z),{});
    const angle=Math.atan2(b.y-a.y,b.x-a.x),arrows=['→','↘','↓','↙','←','↖','↑','↗'];
    this.el.textContent=`${arrows[(Math.round(angle/(Math.PI/4))+8)%8]}  ${t.label}  ·  ${Math.round(Math.hypot(t.x-p.pos.x,t.z-p.pos.z))} 米`;
  }
}

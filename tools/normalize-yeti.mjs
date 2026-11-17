import fs from 'node:fs';import * as T from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';import {NodeIO} from '@gltf-transform/core';import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
const file='raw/character-redesign/yeti-optimized.glb',b=fs.readFileSync(file),loader=new GLTFLoader().register(p=>{const get=p.getDependency.bind(p);p.getDependency=(t,i)=>t==='texture'?Promise.resolve(new T.Texture()):get(t,i);return{name:'TOOL_TEXTURE'};});
const g=await loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');const idle=g.animations.find(a=>a.name==='idle'),track=idle.tracks.find(t=>t.name==='mixamorigHips.position'),anchor=[track.values[0],track.values[2]];
for(const a of g.animations)for(const t of a.tracks)if(t.name==='mixamorigHips.position')for(let i=0;i<t.values.length;i+=3){t.values[i]=anchor[0];t.values[i+2]=anchor[1];}
const mixer=new T.AnimationMixer(g.scene);mixer.clipAction(idle).play();mixer.setTime(.02);g.scene.updateMatrixWorld(true);g.scene.traverse(o=>o.skeleton?.update());const box=new T.Box3().setFromObject(g.scene,true),c=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3()),k=2.2/size.y;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),doc=await io.read(file);for(const a of doc.getRoot().listAnimations())for(const ch of a.listChannels())if(ch.getTargetNode().getName()==='mixamorigHips'&&ch.getTargetPath()==='translation'){const acc=ch.getSampler().getOutput(),v=acc.getArray().slice();for(let i=0;i<v.length;i+=3){v[i]=anchor[0];v[i+2]=anchor[1];}acc.setArray(v);}
// Small recessed glacial eyes follow the real skull joint, never the actor root.
const head=g.scene.getObjectByName('mixamorigHead'),headNode=doc.getRoot().listNodes().find(n=>n.getName()==='mixamorigHead');
if(head&&headNode){
 const positions=[],normals=[],inverse=head.matrixWorld.clone().invert(),undoFit=new T.Matrix4().makeScale(1/k,1/k,1/k).setPosition(c.x,box.min.y,c.z);
 for(const side of [-1,1]){const geo=new T.SphereGeometry(1,12,8).toNonIndexed();geo.scale(.032,.012,.016);geo.translate(side*.085,2.055,.467);geo.applyMatrix4(inverse.clone().multiply(undoFit));positions.push(...geo.attributes.position.array);normals.push(...geo.attributes.normal.array);geo.dispose();}
 const buffer=doc.getRoot().listBuffers()[0],attribute=(name,array)=>doc.createAccessor(name,buffer).setType('VEC3').setArray(new Float32Array(array));
 const mat=doc.createMaterial('Glacial eyes').setBaseColorFactor([.29,.65,.76,1]).setEmissiveFactor([.06,.20,.24]).setRoughnessFactor(.3),primitive=doc.createPrimitive().setAttribute('POSITION',attribute('Eye positions',positions)).setAttribute('NORMAL',attribute('Eye normals',normals)).setMaterial(mat);
 headNode.addChild(doc.createNode('Recessed glacial eyes').setMesh(doc.createMesh().addPrimitive(primitive)));
}
for(const scene of doc.getRoot().listScenes()){const old=scene.listChildren(),origin=doc.createNode('CreatureOrigin').setScale([k,k,k]).setTranslation([-c.x*k,-box.min.y*k,-c.z*k]);old.forEach(n=>origin.addChild(n));scene.addChild(origin);}
await io.write('public/assets/mx/snowbeast.glb',doc);console.log({size:size.toArray(),scale:k,anchor,bytes:fs.statSync('public/assets/mx/snowbeast.glb').size});

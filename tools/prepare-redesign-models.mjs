import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dedup,prune,weld,resample,textureCompress} from '@gltf-transform/functions';
import sharp from 'sharp';import fs from 'node:fs';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc=await io.read('raw/character-redesign/giant-mutant/Giant Mutant.glb');
const fur=doc.createTexture('Original short-fur normal').setImage(fs.readFileSync('raw/character-redesign/snowbeast-fur-normal.png')).setMimeType('image/png');
for(const m of doc.getRoot().listMaterials())m.setNormalTexture(fur).setNormalScale(.6);

// Source normals point across unrelated faces. Rebuild area-weighted smooth
// normals across duplicated UV vertices; retain the complete source silhouette.
for(const mesh of doc.getRoot().listMeshes())for(const p of mesh.listPrimitives()){
 const pos=p.getAttribute('POSITION'),a=pos.getArray(),ix=p.getIndices().getArray(),sum=new Map();
 const keys=Array.from({length:pos.getCount()},(_,i)=>[a[i*3],a[i*3+1],a[i*3+2]].map(v=>Math.round(v*1e5)).join(','));
 for(let i=0;i<ix.length;i+=3){const [x,y,z]=[ix[i]*3,ix[i+1]*3,ix[i+2]*3],u=[a[y]-a[x],a[y+1]-a[x+1],a[y+2]-a[x+2]],v=[a[z]-a[x],a[z+1]-a[x+1],a[z+2]-a[x+2]],n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];for(let j=0;j<3;j++){const k=keys[ix[i+j]],s=sum.get(k)??[0,0,0];for(let c=0;c<3;c++)s[c]+=n[c];sum.set(k,s);}}
 const normal=new Float32Array(a.length);for(let i=0;i<keys.length;i++){const n=sum.get(keys[i]),l=Math.hypot(...n)||1,m=n.map(v=>v/l),length=Math.hypot(...m)||1;normal.set(m.map(v=>v/length),i*3);}p.getAttribute('NORMAL').setArray(normal);
}
await doc.transform(weld(),dedup(),resample({tolerance:1e-4}),textureCompress({encoder:sharp,targetFormat:'webp',resize:[1024,1024],quality:88}),prune());
await io.write('raw/character-redesign/yeti-optimized.glb',doc);console.log('Yeti optimized',fs.statSync('raw/character-redesign/yeti-optimized.glb').size);

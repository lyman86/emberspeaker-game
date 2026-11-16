"""Repack author-supplied embedded glTF as GLB, preserving native rigs, textures and animations."""
import base64,json,struct
from pathlib import Path
root=Path(__file__).resolve().parents[1]
for source,name in [('Yeti','snowyeti'),('Cyclops','icegiant')]:
 doc=json.loads((root/'raw/winter-creatures'/f'{source}.gltf').read_bytes());blob=bytearray();offsets=[]
 for buffer in doc['buffers']:
  blob.extend(b'\0'*(-len(blob)%4));offsets.append(len(blob));uri=buffer['uri'];assert uri.startswith('data:');blob.extend(base64.b64decode(uri.split(',',1)[1]))
 for view in doc['bufferViews']:view['byteOffset']=view.get('byteOffset',0)+offsets[view['buffer']];view['buffer']=0
 doc['buffers']=[{'byteLength':len(blob)}]
 # Let scene lighting and shadows shade the authored texture instead of forcing flat unlit shading.
 for material in doc.get('materials',[]):material.get('extensions',{}).pop('KHR_materials_unlit',None)
 for field in ['extensionsUsed','extensionsRequired']:
  if field in doc:doc[field]=[x for x in doc[field] if x!='KHR_materials_unlit']
 encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*(-len(encoded)%4);blob.extend(b'\0'*(-len(blob)%4))
 out=root/'public/assets/mx'/f'{name}.glb';out.write_bytes(struct.pack('<III',0x46546c67,2,28+len(encoded)+len(blob))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(blob),0x004e4942)+blob)
 print(name,out.stat().st_size,'bytes',[a['name'] for a in doc['animations']])

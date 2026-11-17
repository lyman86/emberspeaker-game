"""Create game-ready native rigs for the selected licensed full-body characters.
Run with Blender 4.2 bpy installed in /tmp/emberspeaker-bpy; no runtime dependency.
"""
import sys,math,os
sys.path.insert(0,'/tmp/emberspeaker-bpy')
import bpy
from mathutils import Vector,Matrix,Quaternion
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];RAW=ROOT/'raw/character-redesign'
def material(name,color):
 m=bpy.data.materials.new(name);m.use_nodes=True;b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*color,1);b.inputs['Roughness'].default_value=.85;return m
def bound(meshes):
 pts=[o.matrix_world@v.co for o in meshes for v in o.data.vertices];return Vector([min(p[i] for p in pts) for i in range(3)]),Vector([max(p[i] for p in pts) for i in range(3)])
def smooth(o):
 for p in o.data.polygons:p.use_smooth=True

def oldlady():
 bpy.ops.wm.open_mainfile(filepath=str(RAW/'boss-oldlady.blend'));rig=bpy.data.objects.get('Armature');meshes=[bpy.data.objects['OldLady'],bpy.data.objects['Hair']]
 for o in list(bpy.data.objects):
  if o not in meshes+[rig]:bpy.data.objects.remove(o,do_unlink=True)
 rig.animation_data_clear()
 for p in rig.pose.bones:
  for c in list(p.constraints):p.constraints.remove(c)
  p.matrix_basis=Matrix.Identity(4)
 for a in list(bpy.data.actions):bpy.data.actions.remove(a)
 bpy.context.scene.frame_set(0);bpy.context.view_layer.update()
 # Restore the packed hand-painted face and fabric normal textures as modern PBR.
 face=material('Abbess skin and aged fabric',(.75,.75,.75));bs=face.node_tree.nodes.get('Principled BSDF');tex=face.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images['oldlady-skin+AO.png'];face.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
 ntex=face.node_tree.nodes.new('ShaderNodeTexImage');ntex.image=bpy.data.images['oldlady-norm.png'];ntex.image.colorspace_settings.name='Non-Color';normal=face.node_tree.nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.6;face.node_tree.links.new(ntex.outputs['Color'],normal.inputs['Color']);face.node_tree.links.new(normal.outputs['Normal'],bs.inputs['Normal'])
 cloth=face.copy();cloth.name='Charcoal habit with woven folds';pbs=cloth.node_tree.nodes.get('Principled BSDF');image=next(n for n in cloth.node_tree.nodes if n.type=='TEX_IMAGE' and n.image.name=='oldlady-skin+AO.png');mix=cloth.node_tree.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[2].default_value=(.14,.18,.23,1);cloth.node_tree.links.new(image.outputs['Color'],mix.inputs[1]);cloth.node_tree.links.new(mix.outputs[0],pbs.inputs['Base Color'])
 for o in meshes:
  o.data.materials.clear();o.data.materials.append(face);o.data.materials.append(cloth)
  for p in o.data.polygons:
   skin=False
   for vi in p.vertices:
    groups=[o.vertex_groups[g.group].name for g in o.data.vertices[vi].groups if g.weight>.3]
    if any(n.startswith(('head','eye','uplid','lolid','hand','f_','thumb')) for n in groups):skin=True
   p.material_index=0 if skin else 1
  smooth(o)
 # Fitted, folded wimple/veil follows the actual head joint; face remains visible.
 head=rig.data.bones['head'];h=head.head_local;white=material('Old ivory headcloth',(.72,.75,.69));black=material('Midnight wool veil',(.025,.04,.055));silver=material('Tarnished silver clasp',(.30,.35,.36));silver.node_tree.nodes.get('Principled BSDF').inputs['Metallic'].default_value=.6
 def surface(name,rows,cols,point,mat):
  v=[point(j/rows,i/cols) for j in range(rows+1) for i in range(cols+1)];f=[]
  for j in range(rows):
   for i in range(cols):a=j*(cols+1)+i;f.append((a,a+1,a+cols+2,a+cols+1))
  mesh=bpy.data.meshes.new(name);mesh.from_pydata(v,[],f);mesh.update();o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);o.data.materials.append(mat);g=o.vertex_groups.new(name='head');g.add(list(range(len(v))),1,'REPLACE');mod=o.modifiers.new('Head binding','ARMATURE');mod.object=rig;smooth(o);meshes.append(o);return o
 # Back and sides of the hood, open in front (-Y), with a small cloth fold rhythm.
 surface('Heavy head veil',16,32,lambda t,u:(h.x+math.sin(-math.pi+.78+u*(2*math.pi-1.56))*(13.5+t*6.5),h.y+math.cos(-math.pi+.78+u*(2*math.pi-1.56))*(12+t*4),h.z+14-t*55+math.sin(u*math.pi*12)*(.3+t*.65)),black)
 # A curved ivory frame sits against forehead and cheeks, with an opening around the face.
 surface('Ivory face frame',5,40,lambda t,u:(h.x+math.sin(-math.pi*.5+u*math.pi)*((1-t)*10.8+t*14.4),h.y-13.2-t*.6,h.z+3+math.cos(-math.pi*.5+u*math.pi)*((1-t)*12+t*15.5)),white)
 surface('Pleated shoulder wimple',10,28,lambda t,u:(h.x+(u-.5)*(29+t*15),h.y-8-t*8,h.z-10-t*20+math.cos(u*math.pi*10)*t*.5),white)
 # Keep the original dense skin; the new cloth is a modest head covering, not a replacement body.
 return rig,meshes,{'hips':'hips','chest':'chest','head':'head','upperL':'upper_arm.L','upperR':'upper_arm.R','foreL':'forearm.L','foreR':'forearm.R','legL':'thigh.L','legR':'thigh.R','root':'Root'}

def queen():
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(RAW/'boss-kalestra.glb'))
 for o in list(bpy.data.objects):
  if o.type=='MESH' and any(m.name in ['Ground','magic','07___Default'] for m in o.data.materials):bpy.data.objects.remove(o,do_unlink=True)
 meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];body=bpy.data.objects['Object_9'];lo,hi=bound([body]);height=hi.z-lo.z;s=2.05/height;center=(lo+hi)*.5
 for o in meshes:
  mat=o.matrix_world.copy()
  for v in o.data.vertices:
   p=mat@v.co;v.co=Vector(((p.x-center.x)*s,(p.y-center.y)*s,(p.z-lo.z)*s))
  o.parent=None;o.matrix_world=Matrix.Identity(4);smooth(o)
  if any(m.name=='book' for m in o.data.materials):
   import bmesh
   bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.delete(bm,geom=[f for f in bm.faces if max(v.co.z for v in f.verts)<.10],context='FACES');bm.to_mesh(o.data);bm.free()
 # Queen's new deform rig is posed to the original sculpt, so the book, hands and face keep their authored alignment.
 arm=bpy.data.armatures.new('Salt Queen skeleton');rig=bpy.data.objects.new('Salt Queen',arm);bpy.context.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
 bones={}
 def bone(n,a,b,parent=None):
  p=arm.edit_bones.new(n);p.head=a;p.tail=b
  if parent:p.parent=bones[parent]
  bones[n]=p
 bone('root',(0,0,0),(0,0,.2));bone('hips',(0,0,.92),(0,0,1.12),'root');bone('chest',(0,0,1.12),(0,0,1.52),'hips');bone('head',(0,0,1.52),(0,0,1.98),'chest')
 for side,sign in [('L',1),('R',-1)]:
  bone('upper'+side,(sign*.22,0,1.48),(sign*.43,-.02,1.27),'chest');bone('fore'+side,(sign*.43,-.02,1.27),(sign*.60,-.17,1.20),'upper'+side);bone('hand'+side,(sign*.60,-.17,1.20),(sign*.68,-.17,1.20),'fore'+side);bone('leg'+side,(sign*.12,0,.96),(sign*.12,.01,.5),'hips');bone('foot'+side,(sign*.12,.01,.5),(sign*.12,-.07,.06),'leg'+side)
 bpy.ops.object.mode_set(mode='OBJECT')
 def distance(p,a,b):
  d=b-a;t=max(0,min(1,(p-a).dot(d)/max(1e-8,d.length_squared)));return(p-(a+t*d)).length
 for o in meshes:
  groups={b.name:o.vertex_groups.new(name=b.name) for b in arm.bones}
  skirt=any(m.name=='Skirt' for m in o.data.materials)
  book=any(m.name=='book' for m in o.data.materials)
  for v in o.data.vertices:
   if book:weights=[('handR',1)] # authored folio follows the actual right hand
   elif skirt and v.co.z<1.1:weights=[('hips',1)]
   elif v.co.z>1.65:weights=[('head',1)]
   else:
    candidates=[(distance(v.co,b.head_local,b.tail_local),b.name) for b in arm.bones if b.name not in ['root','head']];candidates.sort();closest=candidates[:3];raw=[(n,1/max(.02,d)**5) for d,n in closest];total=sum(w for n,w in raw);weights=[(n,w/total) for n,w in raw]
   for n,w in weights:groups[n].add([v.index],w,'REPLACE')
  mod=o.modifiers.new('Queen deformation','ARMATURE');mod.object=rig;o.parent=rig
 # A restrained sun crown on the existing sculpt: warm metal, no giant floating hoops.
 gold=material('Aged sun gold',(.38,.24,.09));gold.node_tree.nodes.get('Principled BSDF').inputs['Metallic'].default_value=.75
 bpy.ops.mesh.primitive_torus_add(major_radius=.115,minor_radius=.012,major_segments=48,minor_segments=8,location=(0,0,1.91));crown=bpy.context.object;crown.name='Broken sun diadem';crown.data.materials.append(gold);g=crown.vertex_groups.new(name='head');g.add(list(range(len(crown.data.vertices))),1,'REPLACE');mod=crown.modifiers.new('Crown binding','ARMATURE');mod.object=rig;meshes.append(crown)
 return rig,meshes,{'hips':'hips','chest':'chest','head':'head','upperL':'upperL','upperR':'upperR','foreL':'foreL','foreR':'foreR','legL':'legL','legR':'legR','root':'root'}

def animate(rig,names):
 for b in rig.pose.bones:b.rotation_mode='XYZ'
 for mode,frames in [('Idle',96),('Walk',32),('Cast',60),('Strike',42),('Hit',20),('Death',65)]:
  action=bpy.data.actions.new(mode);rig.animation_data_create();rig.animation_data.action=action
  for f in range(0,frames+1,2):
   t=f/frames;wave=math.sin(t*math.tau);raise_=math.sin(min(1,t/.65)*math.pi*.5)*(1-max(0,(t-.72)/.28))
   for key,n in names.items():
    b=rig.pose.bones.get(n)
    if not b:continue
    b.rotation_euler=(0,0,0);b.location=(0,0,0)
    if mode=='Idle':
     if key=='chest':b.rotation_euler.x=wave*.012
     if key=='head':b.rotation_euler.z=wave*.018
    elif mode=='Walk':
     if key in ['legL','legR']:b.rotation_euler=Quaternion(b.bone.matrix_local.to_quaternion().inverted()@Vector((1,0,0)),wave*(.3 if key=='legL' else -.3)).to_euler('XYZ')
     if key in ['upperL','upperR']:b.rotation_euler.x=wave*(.15 if key=='upperR' else -.15)
     if key=='chest':b.rotation_euler.z=wave*.025
    elif mode in ['Cast','Strike']:
     if key in ['upperL','upperR']:b.rotation_euler=Quaternion(b.bone.matrix_local.to_quaternion().inverted()@Vector((1,0,0)),-raise_*(.45 if mode=='Cast' else .65)).to_euler('XYZ')
     if key in ['foreL','foreR']:b.rotation_euler=Quaternion(b.bone.matrix_local.to_quaternion().inverted()@Vector((1,0,0)),-raise_*.8).to_euler('XYZ')
     if key=='head':b.rotation_euler.x=-raise_*.07
     if key=='chest':b.rotation_euler.x=-raise_*.04
    elif mode=='Hit':
     if key=='chest':b.rotation_euler.x=math.sin(t*math.pi)*.15
    elif mode=='Death':
     if key=='root':b.rotation_euler.x=-min(1,t*1.4)*1.48
    b.keyframe_insert('rotation_euler',frame=f);b.keyframe_insert('location',frame=f)
  track=rig.animation_data.nla_tracks.new();strip=track.strips.new(mode,0,action);track.name=mode
 rig.animation_data.action=None
 bpy.context.scene.frame_set(0)

def save(kind):
 rig,meshes,names=oldlady() if kind=='abbess' else queen();animate(rig,names)
 # Export only the character and its real deform rig, never old editor controls or scenery.
 for o in bpy.context.scene.objects:o.select_set(False)
 rig.select_set(True)
 for o in meshes:
  world=o.matrix_world.copy();o.parent=rig;o.matrix_world=world;o.select_set(True)
 bpy.context.view_layer.objects.active=rig
 bpy.ops.export_scene.gltf(filepath=str(RAW/(kind+'-rigged.glb')),export_format='GLB',use_selection=True,export_animations=True,export_nla_strips=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_def_bones=True,export_morph=False)
 bpy.ops.wm.save_as_mainfile(filepath=str(RAW/(kind+'-rigged.blend')))
 print('EXPORTED',kind,flush=True)
save(sys.argv[1])
import os
sys.stdout.flush();sys.stderr.flush();os._exit(0) # bpy macOS module teardown crashes after successful native exports.

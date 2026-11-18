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
 surface('Pleated shoulder wimple',16,40,lambda t,u:(h.x+math.sin((u-.5)*math.pi)*(11+t*18),h.y-math.cos((u-.5)*math.pi)*(8+t*8),h.z-12-t*(14+6*math.cos((u-.5)*math.pi))+math.cos(u*math.pi*16)*t*.6),black)
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
 # Remove disconnected display plinth islands; they must not travel with the dress.
 for o in meshes:
  if not any(m.name.startswith('wire_') for m in o.data.materials):continue
  adj={v.index:set() for v in o.data.vertices}
  for e in o.data.edges:a,b=e.vertices;adj[a].add(b);adj[b].add(a)
  unseen=set(adj);remove=set()
  while unseen:
   todo=[unseen.pop()];ids=[]
   while todo:
    a=todo.pop();ids.append(a)
    for n in adj[a]:
     if n in unseen:unseen.remove(n);todo.append(n)
   vs=[o.data.vertices[i].co for i in ids]
   if max(v.z for v in vs)<.12 and max(abs(v.x) for v in vs)>.45:remove.update(ids)
  if remove:
   import bmesh
   bm=bmesh.new();bm.from_mesh(o.data);bm.verts.ensure_lookup_table();bmesh.ops.delete(bm,geom=[bm.verts[i] for i in remove],context='VERTS');bm.to_mesh(o.data);bm.free()
 # Queen's new deform rig is posed to the original sculpt, so the book, hands and face keep their authored alignment.
 arm=bpy.data.armatures.new('Salt Queen skeleton');rig=bpy.data.objects.new('Salt Queen',arm);bpy.context.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
 bones={}
 def bone(n,a,b,parent=None):
  p=arm.edit_bones.new(n);p.head=a;p.tail=b
  if parent:p.parent=bones[parent]
  bones[n]=p
 bone('root',(0,0,0),(0,0,.2));bone('hips',(0,0,.92),(0,0,1.12),'root');bone('chest',(0,0,1.12),(0,0,1.52),'hips');bone('head',(0,0,1.52),(0,0,1.98),'chest')
 for side,sign in [('L',1),('R',-1)]:
  bone('upper'+side,(sign*.22,0,1.48),(sign*.43,-.02,1.27),'chest');bone('fore'+side,(sign*.43,-.02,1.27),(sign*.60,-.17,1.20),'upper'+side);bone('hand'+side,(sign*.60,-.17,1.20),(sign*.68,-.17,1.20),'fore'+side);bone('leg'+side,(sign*.12,0,.96),(sign*.12,.01,.5),'hips');bone('shin'+side,(sign*.12,.01,.5),(sign*.12,-.03,.13),'leg'+side);bone('foot'+side,(sign*.12,-.03,.13),(sign*.12,-.18,.07),'shin'+side)
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

def regalia(rig,meshes,names,kind):
 unit=100 if kind=='abbess' else 1;head=rig.data.bones[names['head']].head_local
 metal=material('Winter iron' if kind=='abbess' else 'Oxidised salt gold',(.12,.18,.20) if kind=='abbess' else (.31,.25,.12));bs=metal.node_tree.nodes.get('Principled BSDF');bs.inputs['Metallic'].default_value=.8;bs.inputs['Roughness'].default_value=.36
 gem=material('Oath frost opal',(.18,.38,.40));bs=gem.node_tree.nodes.get('Principled BSDF');bs.inputs['Metallic'].default_value=.3;bs.inputs['Roughness'].default_value=.24
 def bind(o,mat,bone):
  bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);o.data.materials.append(mat);g=o.vertex_groups.new(name=bone);g.add(list(range(len(o.data.vertices))),1,'REPLACE');mod=o.modifiers.new('Relic binding','ARMATURE');mod.object=rig;meshes.append(o);smooth(o)
 # Five tapered crown blades, connected by a curved band, rather than a floating halo.
 for i in range(5):
  x=(i-2)*.075*unit;y=(-.135+abs(i-2)*.012)*unit;z=(head.z+14 if kind=='abbess' else 1.96);height=(.15 if i==2 else .105 if i in [1,3] else .07)*unit
  mesh=bpy.data.meshes.new('Forged crown leaf');verts=[(head.x+x+dx*unit,head.y+y+dy*unit,z+dz*height) for dy in [-.004,.004] for dx,dz in [(0,0),(-.015,.35),(0,1),(.015,.35)]];mesh.from_pydata(verts,[],[(0,1,2,3),(7,6,5,4),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)]);mesh.update();o=bpy.data.objects.new('Forged oath crown',mesh);bpy.context.collection.objects.link(o);bind(o,metal,names['head'])
 bpy.ops.mesh.primitive_torus_add(major_radius=.16*unit,minor_radius=.009*unit,major_segments=48,minor_segments=6,location=(head.x,head.y,(head.z+12 if kind=='abbess' else 1.96)));o=bpy.context.object;o.name='Oath circlet';bind(o,metal,names['head'])
 if kind=='abbess':
  chest=rig.data.bones[names['chest']].head_local
  bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=10,radius=1,location=(chest.x,chest.y-24,chest.z+22));o=bpy.context.object;o.name='Reliquary clasp';o.scale=(4,1.8,6);bind(o,metal,names['chest'])
  bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=(chest.x,chest.y-27,chest.z+22));o=bpy.context.object;o.name='Frozen oath stone';o.scale=(2,1,3.3);bind(o,gem,names['chest'])
 if kind=='abbess':
  hand=rig.data.bones['hand.R'].head_local
  bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=1.15,depth=136,location=(hand.x,hand.y-3,hand.z-16));o=bpy.context.object;o.name='Funeral crozier shaft';bind(o,metal,'hand.R')
  curve=bpy.data.curves.new('Forged crozier crook','CURVE');curve.dimensions='3D';curve.bevel_depth=1.2;curve.bevel_resolution=2;spline=curve.splines.new('POLY');spline.points.add(32)
  for i,p in enumerate(spline.points):
   a=math.pi-i*math.pi*1.35/32;p.co=(hand.x+8+math.cos(a)*8,hand.y-3,hand.z+52+math.sin(a)*8,1)
  o=bpy.data.objects.new('Funeral crozier crook',curve);bpy.context.collection.objects.link(o);bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH');bind(bpy.context.object,metal,'hand.R')
 # Join ornaments by material to avoid many extra draws.
 for mat in [metal,gem]:
  group=[o for o in meshes if o.data.materials and o.data.materials[0]==mat]
  if not group:continue
  bpy.ops.object.select_all(action='DESELECT')
  for o in group:o.select_set(True)
  bpy.context.view_layer.objects.active=group[0];bpy.ops.object.join();meshes[:]=[o for o in meshes if o not in group[1:]]

def secondary_rig(rig,meshes,names,kind):
 unit=100 if kind=='abbess' else 1
 bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
 for family,parent,top,bottom in [('Hair',names['head'],1.85,1.4),('Mantle',names['head'],1.5,1.06),('Robe',names['hips'],.95,.13)]:
  for side,sign in [('L',1),('R',-1),('Back',0)]:
   previous=rig.data.edit_bones[parent]
   for part in range(2):
    n=f'{family}{side}{part}';bone=rig.data.edit_bones.new(n);x=sign*(.16 if family=='Hair' else .24 if family=='Mantle' else .22);y=.12 if family=='Hair' else .10
    bone.head=(x*unit,y*unit,(top+(bottom-top)*part/2)*unit);bone.tail=(x*unit,y*unit,(top+(bottom-top)*(part+1)/2)*unit);bone.parent=previous;previous=bone
 bpy.ops.object.mode_set(mode='OBJECT')
 for o in meshes:
  # Detect whole hair islands, not skin vertices: face, fingers and horns stay on their real joints.
  hair=set()
  if kind=='queen' and any(m.name.startswith('wire_') for m in o.data.materials):
   adj={v.index:set() for v in o.data.vertices}
   for e in o.data.edges:a,b=e.vertices;adj[a].add(b);adj[b].add(a)
   unseen=set(adj)
   while unseen:
    todo=[unseen.pop()];ids=[]
    while todo:
     a=todo.pop();ids.append(a)
     for n in adj[a]:
      if n in unseen:unseen.remove(n);todo.append(n)
    vs=[o.data.vertices[i].co for i in ids]
    if min(v.z for v in vs)>1.48 and (max(v.y for v in vs)>.17 or max(abs(v.x) for v in vs)>.35):hair.update(ids)
  veil=o.name=='Heavy head veil';skirt=any(m.name=='Skirt' for m in o.data.materials)
  hair={i for i in hair if o.data.vertices[i].co.y>.12 or abs(o.data.vertices[i].co.x)>.33}
  for vi in hair:
   v=o.data.vertices[vi]
   if abs(v.co.x)>.30:v.co.x=math.copysign(.30+(abs(v.co.x)-.30)*.65,v.co.x)
  for v in o.data.vertices:
   family='Hair' if v.index in hair else 'Mantle' if veil else 'Robe' if skirt and v.co.z<1.0 else None
   if family is None:continue
   pos=v.co/unit;side='Back' if abs(pos.x)<.12 else 'L' if pos.x>0 else 'R';top,bottom={'Hair':(1.85,1.4),'Mantle':(1.5,1.06),'Robe':(.95,.13)}[family];t=max(0,min(1,(top-pos.z)/(top-bottom)))
   anchor=names['head'] if family!='Robe' else names['hips'];mix=min(1,t*2);weights=[(anchor,1-mix),(f'{family}{side}0',mix*(1-max(0,t*2-1))),(f'{family}{side}1',mix*max(0,t*2-1))]
   for g in o.vertex_groups:g.remove([v.index])
   for n,w in weights:
    if w>0:
     g=o.vertex_groups.get(n) or o.vertex_groups.new(name=n);g.add([v.index],w,'REPLACE')
 # Subtle warm gold versus cold iron; remove saturated red from the salt court costume.
 if kind=='queen':
  for mat in bpy.data.materials:
   if not mat.use_nodes:continue
   bs=mat.node_tree.nodes.get('Principled BSDF')
   if not bs:continue
   links=[l for l in mat.node_tree.links if l.to_socket==bs.inputs['Base Color']]
   if links:
    sock=links[0].from_socket;mix=mat.node_tree.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=.65;mix.inputs[2].default_value=(.52,.64,.59,1);mat.node_tree.links.new(sock,mix.inputs[1]);mat.node_tree.links.new(mix.outputs[0],bs.inputs['Base Color'])


def animate(rig,names):
 unit=100 if names['root']=='Root' else 1
 for b in rig.pose.bones:b.rotation_mode='XYZ'
 def world_rotation(b,angles):
  q=b.bone.matrix_local.to_quaternion();b.rotation_euler=(q.inverted()@Quaternion((1,0,0),angles[0])@Quaternion((0,1,0),angles[1])@Quaternion((0,0,1),angles[2])@q).to_euler('XYZ')
 for mode,frames in [('Idle',120),('Walk',48),('Cast',72),('Strike',52),('Hit',24),('Death',84)]:
  action=bpy.data.actions.new(mode);rig.animation_data_create();rig.animation_data.action=action
  for f in range(0,frames+1,2):
   t=f/frames;wave=math.sin(t*math.tau);charge=math.sin(min(1,t/.58)*math.pi*.5)*(1-max(0,(t-.68)/.32))
   for b in rig.pose.bones:b.rotation_euler=(0,0,0);b.location=(0,0,0)
   for key,n in names.items():
    b=rig.pose.bones.get(n)
    if not b:continue
    rot=[0,0,0]
    if mode=='Idle':
     if key=='chest':rot=[wave*.009,0,math.sin(t*math.tau)*.008]
     if key=='head':rot=[0,0,-wave*.012]
    elif mode=='Walk':
     phase=t*math.tau+(0 if key.endswith('L') else math.pi);stride=math.sin(phase)
     if key in ['legL','legR']:rot[0]=stride*.23
     if key in ['upperL','upperR']:rot[0]=-stride*.09
     if key=='hips':rot=[0,wave*.025,wave*.025];b.location.y=-abs(math.sin(t*math.tau))*.009*unit
     if key=='chest':rot=[-.025,0,-wave*.025]
     if key=='head':rot=[.025,0,wave*.012]
    elif mode in ['Cast','Strike']:
     side=1 if key.endswith('L') else -1
     if key in ['upperL','upperR']:rot=[-charge*(.5 if mode=='Cast' else .75),side*charge*.12,side*charge*.10]
     if key in ['foreL','foreR']:rot[0]=-charge*(.72 if key=='foreL' else .42)
     if key=='chest':rot=[-.04*charge,0,-.10*charge]
     if key=='head':rot=[.03*charge,0,.08*charge]
    elif mode=='Hit':
     if key=='chest':rot[0]=math.sin(t*math.pi)*.12
    elif mode=='Death':
     if key=='root':rot[0]=-min(1,t*1.35)*1.48
    world_rotation(b,rot)
   # Knee flex and ankle roll create a planted stance rather than alternating rigid legs.
   if mode=='Walk':
    for side in ['L','R']:
     phase=t*math.tau+(0 if side=='L' else math.pi);swing=max(0,math.sin(phase))
     shin=rig.pose.bones.get('shin'+side) or rig.pose.bones.get('shin.'+side)
     foot=rig.pose.bones.get('foot'+side) or rig.pose.bones.get('foot.'+side)
     if shin:world_rotation(shin,(swing*.38,0,0))
     if foot:world_rotation(foot,(-swing*.15,0,0))
   for b in rig.pose.bones:
    if b.name.startswith(('Hair','Mantle','Robe')):
     moving=mode=='Walk';amp=.045 if moving else .018;lag=.65 if b.name.endswith('1') else 0
     world_rotation(b,(math.sin(t*math.tau-lag)*amp,math.sin(t*math.tau-lag+.8)*amp*.5,math.sin(t*math.tau-lag)*amp*.4))
    b.keyframe_insert('rotation_euler',frame=f);b.keyframe_insert('location',frame=f)
  track=rig.animation_data.nla_tracks.new();track.strips.new(mode,0,action);track.name=mode
 rig.animation_data.action=None;bpy.context.scene.frame_set(0)

def save(kind):
 rig,meshes,names=oldlady() if kind=='abbess' else queen();secondary_rig(rig,meshes,names,kind);regalia(rig,meshes,names,kind);animate(rig,names)
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

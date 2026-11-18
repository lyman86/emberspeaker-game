import {dressBossMotion} from './boss-motion.js';
import * as T from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const UP = new T.Vector3(0, 1, 0);

/** An armoured, salt-entombed sovereign. Attachments are authored in the source
 * rig's bind pose, then batched by bone/material: no new texture downloads. */
export function dressSaltQueen(e) {
 // The complete salt-sovereign asset owns its tailored clothes and deform rig.
 if(e.game.assets.gltf.has?.('mx:salt_sovereign')){for(const m of e.mats){if(e.game.gear?.env){m.envMap=e.game.gear.env;m.envMapIntensity=.7;}m.needsUpdate=true;}return {update(){},dispose:dressBossMotion(e)};}

  const source = e.game.assets.gltf.get('mx:vera')?.scene;
  if (!source) return { update() {}, dispose() {} };
  source.updateMatrixWorld(true);
  const references = [], bones = [], attachments = [], geometries = new Set(), materials = new Set();
  source.traverse(o => { if (o.isBone) references.push(o); });
  e.model.traverse(o => { if (o.isBone) bones.push(o); });
  const stone = e.game.materials.tex.rock_surface;
  const make = (color, options = {}, physical = false) => {
    const m = new (physical ? T.MeshPhysicalMaterial : T.MeshStandardMaterial)({ color, roughness: .52, ...options });
    materials.add(m); return m;
  };
  const bronze = make(0x887044, { metalness: .72, roughness: .5, normalMap: stone?.nor, normalScale: new T.Vector2(.13, .13) });
  const iron = make(0x283239, { metalness: .66, roughness: .49, normalMap: stone?.nor, normalScale: new T.Vector2(.2, .2) });
  const bone = make(0xa3b1a8, { roughness: .7, normalMap: stone?.nor, normalScale: new T.Vector2(.16, .16) });
  const crystal = make(0x95c7cd, { metalness: .18, roughness: .2, clearcoat: .85, clearcoatRoughness: .18, emissive: 0x163b43, emissiveIntensity: .36, flatShading: true }, true);
  const light = make(0xb3ebe9, { metalness: .25, roughness: .27, emissive: 0x55bfd0, emissiveIntensity: .65 });
  const cloth = make(0x263b40, { roughness: .96, side: T.DoubleSide, normalMap: stone?.nor, normalScale: new T.Vector2(.09, .09) });
  // A baked reflection probe gives metal and mineral a readable finish even on low quality.
  // The probe is local to this actor; it doesn't change lighting in other chapters.
  let reflection;
  if(e.game.gfx?.renderer){
    const generator=new T.PMREMGenerator(e.game.gfx.renderer),room=new RoomEnvironment();
    reflection=generator.fromScene(room,.05);room.dispose();generator.dispose();
    for(const m of [bronze,iron,bone,crystal]){m.envMap=reflection.texture;m.envMapIntensity=.85;}
  }
  const time = { value: 0 };
  // Fine patina breaks up large metal surfaces without painting floor blocks onto armour.
  for (const m of [bronze, iron, bone]) {
    m.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 queenSurface;').replace('#include <begin_vertex>', '#include <begin_vertex>\nqueenSurface=position;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 queenSurface;').replace('#include <color_fragment>', `#include <color_fragment>
        float grain=fract(sin(dot(floor(queenSurface*170.),vec3(12.9898,78.233,37.719)))*43758.5453);
        float age=sin(queenSurface.y*43.+sin(queenSurface.x*37.)*1.8)*sin(queenSurface.z*39.+queenSurface.y*11.);
        diffuseColor.rgb*=.76+grain*.23+age*.11;
        diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.52,.83,.72),smoothstep(.25,.9,age+grain*.25)*.5);`);
    };
    m.customProgramCacheKey = () => 'salt-queen-patina-v1';
  }
  cloth.onBeforeCompile = shader => {
    shader.uniforms.queenTime = time;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float queenTime;').replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.z += sin(queenTime*1.7+position.y*5.+position.x*3.)*.017*clamp(1.5-position.y,0.,1.);');
  };
  cloth.customProgramCacheKey = () => 'salt-queen-cloth-v1';
  // Preserve the authored skin, boots and cloth texture under the fitted armour.
  for (const m of e.mats) { m.color.setHex(0x657a7c); m.roughness = .8; }

  let target;
  const mesh = (geometry, material, p = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0]) => {
    const o = new T.Mesh(geometry, material); o.position.fromArray(p); o.scale.fromArray(scale); o.rotation.set(...rotation);
    target.add(o); return o;
  };
  const ellipsoid = (m, p, s) => mesh(new T.SphereGeometry(1, 20, 12), m, p, s);
  const curve = (points, radius, m) => mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p))), Math.max(8, points.length * 4), radius, 5, false), m);
  const bar = (a, b, radius, m) => {
    const start = new T.Vector3(...a), d = new T.Vector3(...b).sub(start);
    const o = mesh(new T.CylinderGeometry(radius, radius, d.length(), 8), m, start.addScaledVector(d, .5).toArray());
    o.quaternion.setFromUnitVectors(UP, d.normalize()); return o;
  };
  // A hexagonal mineral, rather than a smooth ice cone: shaft, shoulder, uneven tip.
  const shard = (m, p, length, width, lean = 0, twist = 0) => {
    const geo = new T.CylinderGeometry(width * .54, width, length * .75, 6);
    const tip = new T.ConeGeometry(width * .54, length * .25, 6); tip.translate(0, length * .5, 0);
    const merged = mergeGeometries([geo.toNonIndexed(), tip.toNonIndexed()]); geo.dispose(); tip.dispose();
    return mesh(merged, m, p, [1, 1, 1], [0, twist, lean]);
  };
  const plate = (points, m, depth = .018) => {
    const shape = new T.Shape(); shape.moveTo(points[0][0], points[0][1]); for (const p of points.slice(1)) shape.lineTo(p[0], p[1]); shape.closePath();
    return mesh(new T.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .009, bevelThickness: .007, curveSegments: 8 }), m);
  };
  const attach = (suffix, build) => {
    const ref = references.find(o => o.name.endsWith(suffix)), bone = bones.find(o => o.name.endsWith(suffix)); if (!ref || !bone) return;
    target = new T.Group(); build(new T.Vector3().setFromMatrixPosition(ref.matrixWorld));
    const batches = new Map();
    for (const o of [...target.children]) {
      o.updateMatrix(); const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); g.applyMatrix4(o.matrix);
      if (!batches.has(o.material)) batches.set(o.material, []); batches.get(o.material).push(g); o.geometry.dispose(); target.remove(o);
    }
    for (const [m, pieces] of batches) {
      const g = mergeGeometries(pieces); for (const p of pieces) p.dispose(); geometries.add(g);
      const o = new T.Mesh(g, m); o.castShadow = o.receiveShadow = true; target.add(o);
    }
    target.applyMatrix4(ref.matrixWorld.clone().invert()); bone.add(target); attachments.push(target);
  };

  attach('Head', p => {
    // A sculpted death mask: brow, pointed cheek plates and a narrow unlit mouth.
    ellipsoid(iron, [p.x, p.y + .075, p.z + .085], [.159, .22, .127]);
    for (const side of [-1, 1]) {
      const cheek = plate([[0, .15], [side * .145, .12], [side * .115, -.09], [side * .025, -.14]], bronze);
      cheek.position.set(p.x, p.y + .05, p.z + .19); cheek.rotation.y = side * .16;
      curve([[p.x, p.y + .14, p.z + .215], [p.x + side * .07, p.y + .17, p.z + .219], [p.x + side * .14, p.y + .13, p.z + .19]], .015, bronze);
      bar([p.x + side * .025, p.y + .118, p.z + .223], [p.x + side * .105, p.y + .125, p.z + .219], .009, light);
      shard(crystal, [p.x + side * .145, p.y - .07, p.z + .05], .24, .025, -side * .22);
    }
    const nose = plate([[-.023, .11], [.023, .11], [.035, -.025], [0, -.045], [-.035, -.025]], bronze, .027); nose.position.set(p.x, p.y + .04, p.z + .216);
    // Two nested broken aureoles frame the face; individually chased crown blades.
    for (const radius of [.37, .43]) mesh(new T.TorusGeometry(radius, .014, 6, 72, Math.PI * 1.68), bronze, [p.x, p.y + .19, p.z - .14], [1, 1.12, 1], [0, 0, -Math.PI * .34]);
    mesh(new T.CylinderGeometry(.17, .18, .065, 24, 1, true), bronze, [p.x, p.y + .235, p.z]);
    for (let i = -3; i <= 3; i++) {
      const a = i * .37, x = Math.sin(a) * .2, h = .37 - Math.abs(i) * .044;
      const blade = plate([[-.033, 0], [.033, 0], [.022, h * .65], [0, h], [-.02, h * .65]], bronze);
      blade.position.set(p.x + x, p.y + .22, p.z + .06 - Math.abs(i) * .015); blade.rotation.z = -i * .11;
      shard(crystal, [p.x + x, p.y + .22 + h * .58, p.z + .075 - Math.abs(i) * .015], h * .65, .022, -i * .11);
    }
    for (let i = 0; i < 9; i++) {
      const a = i * Math.PI / 8;
      shard(bone, [p.x + Math.cos(a) * .43, p.y + .19 + Math.sin(a) * .48, p.z - .14], .13 + .09 * Math.sin(a), .022, Math.PI / 2 - a);
    }
  });
  attach('Spine2', p => {
    ellipsoid(iron, [p.x, p.y - .035, p.z + .015], [.27, .265, .18]);
    // Articulated breastplate, with raised ribs and an inset mineral sternum.
    for (const side of [-1, 1]) {
      const chest = plate([[0, .15], [side * .22, .13], [side * .19, -.13], [side * .05, -.22], [0, -.13]], bronze, .025);
      chest.position.set(p.x, p.y, p.z + .16); chest.rotation.y = side * .15;
      for (let i = 0; i < 4; i++) curve([[p.x + side * .025, p.y + .035 - i * .045, p.z + .207], [p.x + side * .11, p.y + .085 - i * .047, p.z + .202], [p.x + side * .2, p.y + .07 - i * .042, p.z + .158]], .008, bone);
      // Swept, overlapping shoulder armour; fitted shapes rather than a spiked backrest.
      for (let i = 0; i < 3; i++) {
        ellipsoid(i === 1 ? bronze : iron, [p.x + side * (.26 + i * .075), p.y + .15 - i * .035, p.z - .025], [.14, .075, .2 - i * .025]);
        curve([[p.x + side * (.2 + i * .075), p.y + .19 - i * .035, p.z + .1], [p.x + side * (.29 + i * .075), p.y + .205 - i * .035, p.z], [p.x + side * (.34 + i * .075), p.y + .15 - i * .035, p.z - .13]], .011, bronze);
      }
      for (let i = 0; i < 3; i++) shard(crystal, [p.x + side * (.28 + i * .055), p.y + .24 + i * .025, p.z - .08], .25 + i * .065, .032, -side * (.3 + i * .23));
    }
    shard(crystal, [p.x, p.y - .01, p.z + .227], .22, .047);
    // Back mantle: pleated, overlapping strips, shaped and scalloped individually.
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * .5 + i * Math.PI / 6;
      const points = [], uv = [], indices = [], rows = 10, cols = 4;
      for (let r = 0; r <= rows; r++) for (let c = 0; c <= cols; c++) {
        const u = r / rows, w = c / cols, angle = a + (w - .5) * .49;
        const radius = .21 + u * .39 + Math.sin(w * Math.PI) * .035;
        const y = p.y + .12 - u * (1.48 + .07 * Math.sin(i * 2.1)) + Math.pow(u, 5) * Math.sin(w * Math.PI) * .09;
        points.push(p.x + Math.sin(angle) * radius, y, p.z + Math.cos(angle) * radius - .04); uv.push(w, u);
        if (r < rows && c < cols) { const n = r * (cols + 1) + c; indices.push(n, n + 1, n + cols + 1, n + 1, n + cols + 2, n + cols + 1); }
      }
      const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(points, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); geo.setIndex(indices); geo.computeVertexNormals(); mesh(geo, cloth);
      const hem = []; for (let c = 0; c <= cols; c++) { const n = (rows * (cols + 1) + c) * 3; hem.push(points.slice(n, n + 3)); } curve(hem, .009, bronze);
    }
  });
  attach('Hips', p => {
    mesh(new T.TorusGeometry(.23, .034, 8, 32), bronze, [p.x, p.y + .015, p.z], [1.15, 1, .85], [Math.PI / 2, 0, 0]);
    // Overlapping tassets cover the front, leaving the legs articulated.
    for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
      const tasset = plate([[-.07, 0], [.07, 0], [.085, -.12], [0, -.17], [-.085, -.12]], i % 2 ? bronze : iron);
      tasset.position.set(p.x + side * (.14 + i * .027), p.y - .055 - i * .10, p.z + .17 + i * .035); tasset.rotation.y = side * -.2;
      shard(bone, [p.x + side * (.14 + i * .027), p.y - .13 - i * .10, p.z + .208 + i * .035], .075, .015);
    }
  });
  for (const [suffix, side] of [['LeftForeArm', 1], ['RightForeArm', -1]]) attach(suffix, p => {
    // Bracers follow the T-pose forearm direction, not world-up after animation.
    for (let i = 0; i < 3; i++) ellipsoid(i === 1 ? bronze : iron, [p.x + side * (.055 + i * .055), p.y, p.z], [.052, .075 - i * .006, .085 - i * .008]);
    for (let i = 0; i < 3; i++) shard(bone, [p.x + side * (.045 + i * .06), p.y + .085, p.z], .12, .025, -side * .35);
  });
  attach('RightHand', p => {
    // A double crescent sceptre. Its open silhouette remains legible at game scale.
    bar([p.x, p.y - .63, p.z], [p.x, p.y + .79, p.z], .024, iron);
    for (let i = 0; i < 9; i++) mesh(new T.TorusGeometry(.028, .008, 5, 12), bronze, [p.x, p.y - .5 + i * .145, p.z], [1, 1, 1], [Math.PI / 2, 0, 0]);
    ellipsoid(bronze, [p.x, p.y - .66, p.z], [.052, .075, .052]);
    for (const side of [-1, 1]) {
      curve([[p.x, p.y + .55, p.z], [p.x + side * .18, p.y + .7, p.z], [p.x + side * .23, p.y + .92, p.z], [p.x + side * .11, p.y + 1.15, p.z]], .027, bronze);
      curve([[p.x + side * .07, p.y + .66, p.z], [p.x + side * .14, p.y + .83, p.z], [p.x + side * .105, p.y + 1.01, p.z]], .02, bone);
    }
    shard(crystal, [p.x, p.y + .88, p.z], .37, .076);
    mesh(new T.TorusGeometry(.11, .01, 5, 32), light, [p.x, p.y + .88, p.z], [1, 1, 1], [0, .3, 0]);
    // Vera + idle_plain at .5 s: inverse animated hand rotation maps world-up
    // to this bind-space axis. Bake the grip once; casting still follows the hand.
    const axis = new T.Vector3(.9988140369, .0125209415, .0470504597).normalize();
    const grip = new T.Matrix4().makeTranslation(p.x, p.y, p.z)
      .multiply(new T.Matrix4().makeRotationFromQuaternion(new T.Quaternion().setFromUnitVectors(UP, axis)))
      .multiply(new T.Matrix4().makeTranslation(-p.x, -p.y, -p.z));
    for (const o of target.children) o.applyMatrix4(grip);
  });
  let disposed = false, elapsed = 0;
  return {
    update(dt) {
      if (disposed) return; elapsed += dt; time.value = elapsed;
      const phase = e.salt?.phase ?? 1, casting = !!e.salt?.cast;
      crystal.emissiveIntensity = .32 + (phase - 1) * .12 + (casting ? .22 : .04) * (1 + Math.sin(elapsed * 3));
      light.emissiveIntensity = .65 + (casting ? .6 : .08) * (1 + Math.sin(elapsed * 4));
    },
    dispose() {
      if (disposed) return; disposed = true;
      for (const o of attachments) o.removeFromParent();
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      reflection?.dispose();
    },
  };
}

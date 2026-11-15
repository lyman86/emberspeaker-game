import * as T from 'three';

const UP = new T.Vector3(0, 1, 0);
const hash = (x, z) => { const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return n - Math.floor(n); };

// Only geometry and materials created here are owned; PBR materials remain shared.
function builder(root) {
  const geometries = new Set(), materials = new Set(), attachments = [];
  const mat = (color, extra = {}) => { const m = new T.MeshStandardMaterial({ color, roughness: .8, ...extra }); materials.add(m); return m; };
  const add = (geometry, material, p = [0, 0, 0], s = [1, 1, 1], r = [0, 0, 0]) => {
    const mesh = new T.Mesh(geometry, material); mesh.position.fromArray(p); mesh.scale.fromArray(s); mesh.rotation.set(...r);
    mesh.castShadow = mesh.receiveShadow = true; root.add(mesh); geometries.add(geometry); return mesh;
  };
  const box = (m, p, s, r) => add(new T.BoxGeometry(1, 1, 1), m, p, s, r);
  const bar = (a, b, radius, m) => {
    const start = new T.Vector3(...a), d = new T.Vector3(...b).sub(start);
    const mesh = add(new T.CylinderGeometry(radius, radius, d.length(), 6), m, start.addScaledVector(d, .5).toArray());
    mesh.quaternion.setFromUnitVectors(UP, d.normalize()); return mesh;
  };
  const crystal = (m, p, h, radius = h * .18, tilt = 0) => add(new T.CylinderGeometry(0, radius, h, 5), m, p, [1, 1, 1], [0, .4, tilt]);
  let disposed = false;
  return { root, mat, add, box, bar, crystal, attachments, get disposed() { return disposed; }, dispose() {
    if (disposed) return; disposed = true;
    for (const attachment of attachments) attachment.removeFromParent();
    for (const geometry of geometries) geometry.dispose(); for (const material of materials) material.dispose();
  } };
}

function palette(b) {
  return {
    salt: b.mat(0xd2e0df, { roughness: .34, metalness: .12, emissive: 0x24454b, emissiveIntensity: .24 }),
    bright: b.mat(0x89dce8, { roughness: .25, emissive: 0x226779, emissiveIntensity: .55 }),
    bronze: b.mat(0x8b7650, { metalness: .65, roughness: .55 }),
    cloth: b.mat(0xc7bca0, { side: T.DoubleSide }),
    dark: b.mat(0x293c43, { metalness: .25 }),
  };
}

/** Salt formations and sand-buried machines, with no additional asset downloads. */
export function saltProp(lv, p, x, z) {
  if (!['@salt_crystal', '@salt_obelisk', '@salt_ruin', '@salt_brazier', '@salt_archive'].includes(p.prop)) return false;
  const root = new T.Group(); root.position.set(x, 0, z); root.rotation.y = p.rot ?? 0; root.scale.setScalar(p.s ?? 1);
  const b = builder(root), c = palette(b), stone = lv.game.materials.get('stoneFloor');
  if (p.prop === '@salt_crystal') {
    for (let i = 0; i < 7; i++) {
      const angle = i * 2.4, h = i ? .8 + hash(x + i, z) * 1.5 : 3;
      b.crystal(i % 3 ? c.salt : c.bright, [Math.sin(angle) * .75, h * .43, Math.cos(angle) * .65], h, h * .2, (i - 3) * .12);
    }
  } else if (p.prop === '@salt_obelisk') {
    b.box(stone, [0, .25, 0], [2.2, .5, 2.2]); b.box(stone, [0, 2, 0], [1.05, 3.5, .85]);
    b.add(new T.ConeGeometry(.76, .7, 4), stone, [0, 4.1, 0], [1, 1, 1], [0, Math.PI / 4, 0]);
    for (let i = 0; i < 4; i++) {
      b.box(c.bright, [0, 1.1 + i * .65, .435], [.26, .045, .025]);
      b.box(c.bronze, [i % 2 ? .16 : -.16, 1.2 + i * .65, .44], [.045, .25, .03]);
    }
    b.add(new T.TorusGeometry(1.2, .09, 5, 24), c.bronze, [0, 2.5, 0], [1, 1, 1], [Math.PI / 2, 0, .3]);
    for (const side of [-1, 1]) b.crystal(c.salt, [side * .7, .8, .5], 1.6, .3, side * -.3);
  } else if (p.prop === '@salt_ruin') {
    for (const side of [-1, 1]) {
      b.box(stone, [side * 2, .22, 0], [1.5, .44, 1.6]);
      const h = side < 0 ? 4.4 : 2.8;
      b.add(new T.CylinderGeometry(.5, .65, h, 8), stone, [side * 2, h / 2, 0]);
      b.box(c.bronze, [side * 2, h * .75, 0], [1.12, .14, 1.12]);
    }
    b.box(stone, [-1.6, 4.3, 0], [2.3, .65, 1.3], [0, 0, -.13]);
    b.box(stone, [.2, .3, -.2], [2.5, .6, 1.1], [0, .4, .07]);
    b.add(new T.TorusGeometry(.95, .12, 5, 24), c.bronze, [0, .3, .2], [1, 1, 1], [-Math.PI / 2, 0, 0]);
    for (let i = 0; i < 5; i++) b.crystal(c.salt, [-2.7 + i * .44, .35, .6], .7 + i * .1, .17, -.3);
  } else if (p.prop === '@salt_brazier') {
    b.add(new T.CylinderGeometry(.7, .95, .45, 8), stone, [0, .23, 0]);
    b.add(new T.CylinderGeometry(.2, .35, 1.4, 8), c.bronze, [0, 1.05, 0]);
    b.add(new T.CylinderGeometry(.8, .3, .5, 8, 1, true), c.bronze, [0, 1.8, 0]);
    for (let i = 0; i < 4; i++) b.crystal(c.bright, [Math.sin(i * 1.57) * .28, 2.1, Math.cos(i * 1.57) * .28], .9, .14, (i - 1.5) * .15);
    lv.torches.push({ x, y: 2.6, z, color: 0x9edee8, power: 65, seed: x + z });
  } else {
    // The archive is an engraved drafting slab: a plan, rather than a newly awarded bell.
    b.box(stone, [0, .35, 0], [3, .7, 2.4]); b.box(stone, [0, 1.15, 0], [2.2, .9, 1.7]);
    b.box(c.dark, [0, 1.63, 0], [2.3, .08, 1.8]); b.box(c.cloth, [0, 1.69, 0], [1.8, .025, 1.3]);
    for (const side of [-1, 1]) b.add(new T.CylinderGeometry(.11, .11, 1.5, 8), c.cloth, [side * .9, 1.76, 0], [1, 1, 1], [Math.PI / 2, 0, 0]);
    b.add(new T.TorusGeometry(.35, .018, 4, 20), c.bronze, [-.22, 1.71, 0], [1, 1, 1], [-Math.PI / 2, 0, 0]);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      b.box(c.bronze, [-.22 + Math.sin(a) * .42, 1.713, Math.cos(a) * .42], [.055, .012, .12], [0, a, 0]);
    }
    for (let i = 0; i < 4; i++) b.box(c.bronze, [.55, 1.713, -.4 + i * .24], [.3, .012, .025]);
    b.crystal(c.bright, [-1.1, 2.1, -.7], .9, .2);
  }
  root.userData.saltDispose = b.dispose; lv.group.add(root); return true;
}

/** Edge-only instanced salt and low drifting dust leave traversable routes clear. */
export function saltScenery(lv) {
  if (!['saltflat', 'salttomb'].includes(lv.id)) return;
  const root = new T.Group(), b = builder(root), tomb = lv.id === 'salttomb', g = lv.game, points = [];
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let z = 1; z < lv.h - 1; z++) for (let x = 1; x < lv.w - 1; x++) {
    if (!lv.isFloor(x, z) || hash(x, z) < .64) continue;
    const edge = directions.find(([dx, dz]) => !lv.isFloor(x + dx, z + dz));
    if (edge) points.push([x * 4 + 2 + edge[0] * 1.65, z * 4 + 2 + edge[1] * 1.65]);
  }
  if(!tomb){
    const geo=new T.PlaneGeometry(lv.w*4,lv.h*4).rotateX(-Math.PI/2),uv=geo.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*lv.w,uv.getY(i)*lv.h);
    b.add(geo,g.materials.get('saltSand',1.5),[lv.w*2,-.16,lv.h*2]);
  }
  if (points.length) {
    const geo = new T.CylinderGeometry(0, .18, 1, 5), material = b.mat(tomb ? 0xb1d5d8 : 0xd8d9c9, { emissive: 0x12303a, emissiveIntensity: .15 });
    // Register the shared geometry through the same ownership path as ordinary props.
    const mesh = b.add(geo, material); root.remove(mesh);
    const crystals = new T.InstancedMesh(geo, material, points.length * 3), matrix = new T.Matrix4(); let n = 0;
    for (const [x, z] of points) for (let i = 0; i < 3; i++) {
      const h = .3 + hash(x + i, z) * .8;
      matrix.compose(new T.Vector3(x + (hash(z, x + i) - .5) * .4, h * .4, z + (hash(x, z + i) - .5) * .4), new T.Quaternion().setFromEuler(new T.Euler(.1, i * 2, (i - 1) * .22)), new T.Vector3(1, h, 1));
      crystals.setMatrixAt(n++, matrix);
    }
    crystals.castShadow = false; crystals.computeBoundingSphere(); root.add(crystals);
    root.userData.saltDispose = () => { if (b.disposed) return; crystals.dispose(); b.dispose(); };
  } else root.userData.saltDispose = b.dispose;
  lv.group.add(root);
  let acc = 0;
  lv.anim.push(dt => {
    if (b.disposed) return false;
    acc += dt; if (acc < (g.low ? .8 : .4)) return true; acc = 0;
    const p = g.player.pos;
    g.smoke.emit({ pos: { x: p.x - 9, y: .35, z: p.z - 4 }, count: g.low ? 1 : 2, radius: 12, flat: true, speed: [1.2, 2.5], up: .05, life: [3, 5], size: [3, 6], c0: tomb ? [.33, .35, .32] : [.55, .51, .39], c1: [.22, .24, .24], alpha: tomb ? .065 : .12, tex: 'smoke', grow1: 1.8 });
    return true;
  });
}

/** Pose-space attachments follow the original Mixamo bones, including during death. */
export function dressSaltEnemy(e) {
  const file = ({ saltdead: 'warrior', sandweaver: 'mage', saltfiend: 'elite', tombguard: 'warrior', saltpriest: 'boss', saltqueen: 'vera', saltseal: 'mage' })[e.type];
  if (!file) return;
  const root = new T.Group(), b = builder(root), c = palette(b);
  if (e.type === 'saltseal') {
    e.model.visible = false; e.root.add(root);
    b.add(new T.CylinderGeometry(.8, 1, .25, 8), c.dark, [0, .13, 0]);
    for (let i = 0; i < 5; i++) { const a = i * 2.4; b.crystal(c.bright, [Math.sin(a) * .45, i ? 1.05 : 1.65, Math.cos(a) * .45], i ? 2 : 3.2, i ? .3 : .52, (i - 2) * .1); }
    b.add(new T.TorusGeometry(.85, .045, 5, 24), c.bronze, [0, 1.3, 0], [1, 1, 1], [Math.PI / 2, 0, .25]);
  } else {
    const source = e.game.assets.gltf.get('mx:' + file)?.scene, originals = [], bones = [];
    source?.updateMatrixWorld(true); source?.traverse(o => { if (o.isBone) originals.push(o); }); e.model.traverse(o => { if (o.isBone) bones.push(o); });
    const attach = (suffix, make) => {
      const ref = originals.find(o => o.name.endsWith(suffix)), bone = bones.find(o => o.name.endsWith(suffix)); if (!ref || !bone) return;
      const first = root.children.length; make(new T.Vector3().setFromMatrixPosition(ref.matrixWorld));
      const group = new T.Group(); for (const mesh of [...root.children].slice(first)) group.add(mesh);
      group.applyMatrix4(ref.matrixWorld.clone().invert()); bone.add(group); b.attachments.push(group);
    };
    const queen = e.type === 'saltqueen', priest = e.type === 'saltpriest', fiend = e.type === 'saltfiend', guard = e.type === 'tombguard', dead = e.type === 'saltdead';
    for (const m of e.mats) m.color.setHex(fiend ? 0x4c9fc4 : queen ? 0xc7d7db : dead ? 0xb5af96 : 0xa2aaac);
    attach('Head', p => {
      if (dead) {
        for (let i = 0; i < 4; i++) b.add(new T.CylinderGeometry(.145, .15, .045, 10, 1, true), c.cloth, [p.x, p.y + .04 + i * .045, p.z]);
        b.box(c.dark, [p.x, p.y + .12, p.z + .145], [.23, .04, .02]);
      } else if (guard || priest) {
        b.add(new T.SphereGeometry(1, 8, 6), c.bronze, [p.x, p.y + .08, p.z + .12], [.16, .23, .075]);
        for (const side of [-1, 1]) b.box(c.bright, [p.x + side * .065, p.y + .13, p.z + .19], [.06, .018, .018]);
        b.box(c.dark, [p.x, p.y + .34, p.z], [priest ? .45 : .32, .23, .09]);
      } else if (fiend) {
        for (const side of [-1, 1]) b.crystal(c.salt, [p.x + side * .17, p.y + .26, p.z], .45, .085, side * -.45);
      }
      if (queen || priest) {
        b.add(new T.CylinderGeometry(.19, .2, .08, 10, 1, true), c.bronze, [p.x, p.y + .24, p.z]);
        for (let i = 0; i < 7; i++) { const a = i * Math.PI * 2 / 7; b.crystal(c.bright, [p.x + Math.sin(a) * .18, p.y + .38, p.z + Math.cos(a) * .18], i === 0 ? .36 : .24, .045); }
      }
      if (queen) {
        const veil = b.mat(0xd4e6df, { transparent: true, opacity: .48, side: T.DoubleSide, depthWrite: false });
        for (const side of [-1, 1]) b.box(veil, [p.x + side * .26, p.y - .42, p.z - .18], [.22, 1.3, .012], [0, side * .25, side * -.18]);
      }
    });
    attach('Spine2', p => {
      if (dead) for (let i = 0; i < 6; i++) b.add(new T.CylinderGeometry(.215, .23, .055, 10, 1, true), c.cloth, [p.x, p.y - .24 + i * .063, p.z], [1, 1, .8], [0, 0, (i % 2 ? 1 : -1) * .1]);
      if (fiend) {
        const skin = b.mat(0x4496b3);
        b.add(new T.SphereGeometry(1, 10, 8), skin, [p.x, p.y, p.z], [.4, .3, .22]);
        for (const side of [-1, 1]) for (let i = 0; i < 3; i++) b.crystal(c.salt, [p.x + side * (.35 + i * .09), p.y + .28, p.z - .05], .32 + i * .12, .09, side * -.7);
      }
      if (guard || priest) {
        b.box(c.dark, [p.x, p.y - .09, p.z], [priest ? .58 : .48, .48, .28]);
        b.box(c.bronze, [p.x, p.y - .1, p.z + .16], [.12, .46, .025]);
      }
      if (queen) {
        // A crystal backrest silhouette moves with her, like a walking salt throne.
        for (let i = -3; i <= 3; i++) b.crystal(c.salt, [p.x + i * .14, p.y + .22, p.z - .28], 1.15 - Math.abs(i) * .14, .065, -i * .18);
        for (const side of [-1, 1]) b.add(new T.SphereGeometry(1, 8, 6), c.bronze, [p.x + side * .23, p.y + .1, p.z], [.13, .07, .16]);
        b.box(c.bright, [p.x, p.y - .04, p.z + .16], [.16, .22, .06]);
      }
      if (e.type === 'sandweaver') {
        b.add(new T.ConeGeometry(.32, .7, 8, 1, true), c.cloth, [p.x, p.y + .07, p.z - .05], [1, 1, .7]);
        for (const side of [-1, 1]) b.box(c.cloth, [p.x + side * .2, p.y - .4, p.z - .12], [.18, 1.1, .025], [0, 0, side * -.14]);
      }
    });
    if (queen || priest) attach('Hips', p => {
      b.add(new T.CylinderGeometry(.19, queen ? .53 : .4, .95, 12, 1, true), queen ? c.salt : c.cloth, [p.x, p.y - .4, p.z], [1, 1, .8]);
      b.add(new T.TorusGeometry(.24, .025, 4, 16), c.bronze, [p.x, p.y + .04, p.z], [1, 1, .8], [Math.PI / 2, 0, 0]);
    });
    if (dead) for (const side of ['LeftForeArm', 'RightForeArm', 'LeftLeg', 'RightLeg']) attach(side, p => {
      for (let i = 0; i < 3; i++) b.add(new T.CylinderGeometry(.075, .08, .045, 8, 1, true), c.cloth, [p.x, p.y - .08 - i * .055, p.z]);
    });
    if (guard) attach('LeftHand', p => {
      b.box(c.dark, [p.x, p.y, p.z + .08], [.42, .72, .08]); b.box(c.bronze, [p.x, p.y, p.z + .13], [.05, .64, .025]);
      b.crystal(c.salt, [p.x, p.y + .33, p.z + .13], .22, .08);
    });
    if (queen || priest || guard || e.type === 'sandweaver') attach('RightHand', p => {
      b.bar([p.x, p.y - .55, p.z], [p.x, p.y + .65, p.z], .025, c.bronze);
      if (guard) b.add(new T.ConeGeometry(.11, .42, 4), c.salt, [p.x, p.y + .8, p.z]);
      else {
        b.add(new T.TorusGeometry(.16, .025, 5, 16), c.bronze, [p.x, p.y + .7, p.z]);
        b.crystal(c.bright, [p.x, p.y + .78, p.z], queen ? .45 : .3, .08);
      }
    });
  }
  e.saltArtDispose = () => { root.removeFromParent(); b.dispose(); };
}

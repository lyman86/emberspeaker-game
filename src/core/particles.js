import * as THREE from 'three';

/**
 * Texture-atlas particle system (one draw call per system).
 * Atlas: public/assets/fx/atlas.png, 8 x 4 cells of photographic-style masks (Kenney Particle Pack, CC0).
 * Each particle picks a cell, rotates, spins, and can align to its screen-space velocity (sparks, streaks).
 */
export const TEX = {
  glow: [0], flame: [1, 2, 3, 4], fire: [5, 6], smoke: [7, 8, 9, 10, 11, 12], elec: [13, 14, 15], streak: [16, 17],
  glint: [18, 19], flare: [20], light: [21], star: [22], dirt: [23, 24], burst: [25], twirl: [26, 27], jet: [28], star8: [29], cross: [30], candle: [31],
};

const VERT = `
attribute float size;
attribute vec4 pcolor;
attribute vec3 pdata;   // x: atlas cell, y: rotation, z: align-to-velocity flag
attribute vec3 vel;
uniform float scale;
uniform vec3 ambient;
uniform vec3 lightPos[12];
uniform vec4 lightCol[12]; // rgb * intensity, w = range
varying vec4 vColor;
varying float vCell;
varying float vRot;
varying float vY;
varying float vWS;
void main() {
  vColor = pcolor;
  vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
  vY = wp.y; vWS = size;
#ifdef LIT
  vec3 L = ambient;
  for (int i = 0; i < 12; i++) {
    float d = distance(wp, lightPos[i]);
    float f = max(0.0, 1.0 - d / max(lightCol[i].w, 0.001));
    L += lightCol[i].rgb * f * f;
  }
  vColor.rgb *= min(L, vec3(3.0));
#endif
  vCell = pdata.x;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float rot = pdata.y;
  if (pdata.z > 0.5) {
    vec4 a = projectionMatrix * mv;
    vec4 b = projectionMatrix * (modelViewMatrix * vec4(position + vel * 0.05, 1.0));
    vec2 d = b.xy / b.w - a.xy / a.w;
    rot = atan(d.x, d.y);
  }
  vRot = rot;
  gl_PointSize = size * scale / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = `
uniform sampler2D atlas;
uniform float gain;
uniform float camUpY;
varying vec4 vColor;
varying float vCell;
varying float vRot;
varying float vY;
varying float vWS;
void main() {
  // soft contact with the floor: fade the part of the sprite that would cut into the ground
  float fy = vY + (0.5 - gl_PointCoord.y) * vWS * camUpY;
  float soft = smoothstep(-0.05, 0.45, fy);
  vec2 p = gl_PointCoord - 0.5;
  float c = cos(vRot), s = sin(vRot);
  p = vec2(c * p.x - s * p.y, s * p.x + c * p.y) + 0.5;
  if (p.x < 0.0 || p.y < 0.0 || p.x > 1.0 || p.y > 1.0) discard;
#ifdef FLIP
  // 8×8 flipbook, premultiplied RGBA, blend between neighbouring frames
  float f0 = floor(vCell), fr = vCell - f0, f1 = min(f0 + 1.0, 63.0);
  vec2 q = p;
  vec2 uv0 = (vec2(mod(f0, 8.0), floor(f0 / 8.0)) + vec2(q.x, q.y)) / 8.0;
  vec2 uv1 = (vec2(mod(f1, 8.0), floor(f1 / 8.0)) + vec2(q.x, q.y)) / 8.0;
  uv0.y = 1.0 - uv0.y; uv1.y = 1.0 - uv1.y;
  vec4 t = mix(texture2D(atlas, uv0), texture2D(atlas, uv1), fr);
  float k = vColor.a * soft;
  if (t.a + t.r < 0.002) discard;
  gl_FragColor = vec4(t.rgb * vColor.rgb * k * gain, t.a * k);
#else
  float cell = floor(vCell + 0.5);
  vec2 uv = (vec2(mod(cell, 8.0), floor(cell / 8.0)) + p) / vec2(8.0, 4.0);
  uv.y = 1.0 - uv.y;
  float a = texture2D(atlas, uv).a * vColor.a * soft;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vColor.rgb * a * gain, a * OPACITY);
#endif
}`;

const rnd = (a, b) => a + Math.random() * (b - a);

export class Particles {
  constructor(scene, max = 5000, additive = true, atlas = null, { flip = false, lit = false, fps = 30 } = {}) {
    this.max = max;
    this.flip = flip; this.lit = lit; this.fps = fps;
    this.age0 = new Float32Array(max);
    this.cursor = 0;
    const g = (this.geo = new THREE.BufferGeometry());
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    this.data = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    const dyn = (arr, n) => new THREE.BufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', dyn(this.pos, 3));
    g.setAttribute('pcolor', dyn(this.col, 4));
    g.setAttribute('size', dyn(this.size, 1));
    g.setAttribute('pdata', dyn(this.data, 3));
    g.setAttribute('vel', dyn(this.vel, 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.s0 = new Float32Array(max);
    this.s1 = new Float32Array(max);
    this.c0 = new Float32Array(max * 3);
    this.c1 = new Float32Array(max * 3);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.spin = new Float32Array(max);
    this.active = 0;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG.replace('OPACITY', additive ? '0.0' : '1.0'),
      defines: { ...(flip ? { FLIP: '' } : {}), ...(lit ? { LIT: '' } : {}) },
      uniforms: {
        scale: { value: 800 }, atlas: { value: atlas }, gain: { value: flip ? 1 : additive ? 0.55 : 1 }, camUpY: { value: 0.6 },
        ambient: { value: new THREE.Color(0.5, 0.5, 0.55) },
        lightPos: { value: Array.from({ length: 12 }, () => new THREE.Vector3(0, -999, 0)) },
        lightCol: { value: Array.from({ length: 12 }, () => new THREE.Vector4(0, 0, 0, 1)) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: additive && !flip ? THREE.OneFactor : THREE.OneMinusSrcAlphaFactor,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 11 : 10;
    scene.add(this.points);
  }

  /**
   * o: { pos, count, speed:[a,b], dir, spread(0..1), life:[a,b], size:[a,b], grow0, grow1,
   *      c0:[r,g,b], c1:[r,g,b], gravity, drag, radius, ring, flat, outward, alpha, up,
   *      tex: name in TEX (default 'glow'), rot:[a,b], spin:[a,b], align (rotate along velocity) }
   */
  emit(o) {
    const count = o.count ?? 1;
    const dir = o.dir;
    const spread = o.spread ?? 1;
    const cells = TEX[o.tex ?? 'glow'] ?? TEX.glow;
    for (let k = 0; k < count; k++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.max;
      const r = o.radius ?? 0;
      let ox = 0, oy = 0, oz = 0;
      if (r) {
        if (o.ring) { const a = Math.random() * 6.283; ox = Math.cos(a) * r; oz = Math.sin(a) * r; }
        else { ox = rnd(-r, r); oy = rnd(-r, r) * (o.flat ? 0 : 1); oz = rnd(-r, r); }
      }
      this.pos[i * 3] = o.pos.x + ox;
      this.pos[i * 3 + 1] = (o.pos.y ?? 0) + oy;
      this.pos[i * 3 + 2] = o.pos.z + oz;
      let x = rnd(-1, 1), y = rnd(-1, 1), z = rnd(-1, 1);
      const l = Math.hypot(x, y, z) || 1;
      x /= l; y /= l; z /= l;
      if (dir) {
        x = dir.x + x * spread; y = (dir.y ?? 0) + y * spread; z = dir.z + z * spread;
        const l2 = Math.hypot(x, y, z) || 1;
        x /= l2; y /= l2; z /= l2;
      }
      if (o.outward && r) { const l3 = Math.hypot(ox, oz) || 1; x = ox / l3; z = oz / l3; y = rnd(0, 0.3); }
      const sp = o.speed ? rnd(o.speed[0], o.speed[1]) : 0;
      this.vel[i * 3] = x * sp;
      this.vel[i * 3 + 1] = y * sp + (o.up ?? 0);
      this.vel[i * 3 + 2] = z * sp;
      const life = o.life ? rnd(o.life[0], o.life[1]) : 1;
      this.life[i] = life;
      this.maxLife[i] = life;
      const s = o.size ? rnd(o.size[0], o.size[1]) : 0.5;
      this.s0[i] = s * (o.grow0 ?? 1);
      this.s1[i] = s * (o.grow1 ?? 0.1);
      const c0 = o.c0, c1 = o.c1 ?? o.c0;
      this.c0[i * 3] = c0[0]; this.c0[i * 3 + 1] = c0[1]; this.c0[i * 3 + 2] = c0[2];
      this.c1[i * 3] = c1[0]; this.c1[i * 3 + 1] = c1[1]; this.c1[i * 3 + 2] = c1[2];
      this.grav[i] = o.gravity ?? 0;
      this.drag[i] = o.drag ?? 0;
      this.alpha[i] = o.alpha ?? 1;
      this.data[i * 3] = this.flip ? 0 : cells[(Math.random() * cells.length) | 0];
      this.age0[i] = this.flip && o.loop ? Math.random() * 64 : 0;
      this.data[i * 3 + 1] = o.rot ? rnd(o.rot[0], o.rot[1]) : Math.random() * 6.283;
      this.data[i * 3 + 2] = this.flip ? (o.loop ? 1 : 0) : o.align ? 1 : 0;
      this.spin[i] = o.spin ? rnd(o.spin[0], o.spin[1]) * (Math.random() < 0.5 ? -1 : 1) : 0;
    }
  }

  /** Feed scene lights to lit (smoke) particles; call once per frame. */
  setLights(gfx) {
    const U = this.mat.uniforms;
    U.camUpY.value = gfx.camera.matrixWorld.elements[5];
    if (!this.lit) return;
    const h = gfx.hemi;
    U.ambient.value.copy(h.color).lerp(h.groundColor, 0.5).multiplyScalar(h.intensity * 0.55);
    const ls = [gfx.playerLight, ...gfx.fxLights, ...gfx.torchLights];
    for (let i = 0; i < 12; i++) {
      const l = ls[i];
      if (!l || l.intensity <= 0) { U.lightCol.value[i].set(0, 0, 0, 1); continue; }
      U.lightPos.value[i].copy(l.position);
      const k = Math.min(4, l.intensity * 0.02);
      U.lightCol.value[i].set(l.color.r * k, l.color.g * k, l.color.b * k, (l.distance || 20) * 0.9);
    }
  }

  update(dt, viewportH, fovDeg) {
    this.mat.uniforms.scale.value = viewportH / (2 * Math.tan((fovDeg * Math.PI) / 360));
    const { pos, vel, life, maxLife, col, size, data } = this;
    for (let i = 0; i < this.max; i++) {
      if (life[i] <= 0) { if (size[i] !== 0) size[i] = 0; continue; }
      life[i] -= dt;
      if (life[i] <= 0) { size[i] = 0; continue; }
      const t = 1 - life[i] / maxLife[i];
      const d = Math.max(0, 1 - this.drag[i] * dt);
      vel[i * 3] *= d; vel[i * 3 + 1] = vel[i * 3 + 1] * d - this.grav[i] * dt; vel[i * 3 + 2] *= d;
      pos[i * 3] += vel[i * 3] * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      if (pos[i * 3 + 1] < 0.03 && this.grav[i] > 0) { pos[i * 3 + 1] = 0.03; vel[i * 3 + 1] *= -0.3; vel[i * 3] *= 0.6; vel[i * 3 + 2] *= 0.6; }
      data[i * 3 + 1] += this.spin[i] * dt;
      if (this.flip) data[i * 3] = data[i * 3 + 2] > 0.5 ? (this.age0[i] + (maxLife[i] - life[i]) * this.fps) % 63 : Math.min(62.99, Math.pow(t, 1.5) * 63);
      size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * t;
      col[i * 4] = this.c0[i * 3] + (this.c1[i * 3] - this.c0[i * 3]) * t;
      col[i * 4 + 1] = this.c0[i * 3 + 1] + (this.c1[i * 3 + 1] - this.c0[i * 3 + 1]) * t;
      col[i * 4 + 2] = this.c0[i * 3 + 2] + (this.c1[i * 3 + 2] - this.c0[i * 3 + 2]) * t;
      const fadeIn = Math.min(1, t * (this.flip ? 20 : 8));
      col[i * 4 + 3] = this.alpha[i] * fadeIn * (this.flip ? 1 - t ** 6 : 1 - t * t);
    }
    for (const k of ['position', 'pcolor', 'size', 'pdata', 'vel']) this.geo.attributes[k].needsUpdate = true;
  }

  clear() {
    this.life.fill(0);
    this.size.fill(0);
  }
}

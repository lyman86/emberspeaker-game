import * as THREE from 'three';

/**
 * Shader-driven effect building blocks:
 *  - energyMaterial: additive material whose shape (alpha texture) is eaten away by animated fractal noise,
 *    with a hot rim along the dissolving edge — fire, holy light, frost and necrotic energy all use it.
 *  - Trail: camera-facing ribbon following a moving point (projectiles).
 *  - SwingTrail: two-edged ribbon swept by a weapon (base → tip) for melee arcs.
 *  - Debris: physical rock / bone chunks that fly, bounce and settle.
 *  - orbMaterial: noise-boiling sphere with a fresnel rim (fireballs, energy cores).
 *  - distortion meshes (rendered into a separate buffer by Gfx to bend the image: shockwaves, heat haze).
 */

export const NOISE = /* glsl */ `
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }
`;

const VERT = /* glsl */ `
varying vec2 vUv; varying vec3 vWorld; varying vec3 vN; varying vec3 vView;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vView = normalize(cameraPosition - w.xyz);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

/**
 * Additive "energy" material.
 *  map       — alpha shape (green channel), optional (uses a soft radial falloff when absent)
 *  color     — [r,g,b] HDR colour of the body; rim gets `rim` (defaults to a hotter colour)
 *  scale     — noise frequency; flow — noise scroll velocity (uv space)
 *  progress  — 0 solid … 1 fully dissolved (animate it)
 */
export function energyMaterial({ map = null, color = [3, 1.2, 0.3], rim = null, scale = 4, flow = [0, -0.6], opacity = 1, polar = false, side = THREE.DoubleSide } = {}) {
  const c = new THREE.Color(...color), r = rim ? new THREE.Color(...rim) : c.clone().multiplyScalar(1.8).add(new THREE.Color(0.3, 0.3, 0.3));
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, useMap: { value: map ? 1 : 0 }, color: { value: c }, rimColor: { value: r }, time: { value: Math.random() * 10 },
      progress: { value: 0 }, opacity: { value: opacity }, soft: { value: 0 }, scale: { value: scale }, flow: { value: new THREE.Vector2(...flow) }, polar: { value: polar ? 1 : 0 } },
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      uniform sampler2D map; uniform float useMap; uniform vec3 color; uniform vec3 rimColor; uniform float time, progress, opacity, scale, polar, soft; uniform vec2 flow;
      varying vec2 vUv; varying vec3 vN; varying vec3 vView;
      ${NOISE}
      void main() {
        float facing = soft > 0.5 ? pow(abs(dot(normalize(vN), normalize(vView))), 1.4) : 1.0;
        float shape = useMap > 0.5 ? texture2D(map, vUv).g : smoothstep(0.5, 0.0, length(vUv - 0.5));
        vec2 q = vUv;
        if (polar > 0.5) { vec2 d = vUv - 0.5; q = vec2(atan(d.y, d.x) / 6.2831 * 3.0, length(d) * 2.0); }
        float n = fbm(vec3(q * scale + flow * time, time * 0.35));
        float cut = progress * 1.15 - 0.075;
        float body = smoothstep(cut, cut + 0.12, n * shape + shape * 0.35);
        float edge = body * (1.0 - smoothstep(cut + 0.0, cut + 0.18, n * shape + shape * 0.35));
        vec3 col = color * (0.4 + 0.7 * n) * shape + rimColor * edge * 0.9;
        float a = clamp((body * shape * (0.45 + 0.5 * n) + edge * 0.6) * opacity, 0.0, 1.0);
        a *= facing;
        gl_FragColor = vec4(col * a, a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side,
  });
}

/** Boiling noise sphere with fresnel rim (fireball / energy core). */
export function orbMaterial({ core = [4, 2.2, 0.7], edge = [2.4, 0.5, 0.05], scale = 3.2, speed = 1.6 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { core: { value: new THREE.Color(...core) }, edge: { value: new THREE.Color(...edge) }, time: { value: Math.random() * 10 }, scale: { value: scale }, speed: { value: speed }, opacity: { value: 1 } },
    vertexShader: /* glsl */ `
      uniform float time, scale, speed; varying vec3 vN; varying vec3 vView; varying vec3 vP;
      ${NOISE}
      void main() {
        vec3 p = position;
        float n = fbm(p * scale + vec3(0.0, -time * speed, time * 0.4));
        p *= 0.85 + 0.45 * n;
        vP = position;
        vec4 w = modelMatrix * vec4(p, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vView = normalize(cameraPosition - w.xyz);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 core, edge; uniform float time, scale, speed, opacity; varying vec3 vN; varying vec3 vView; varying vec3 vP;
      ${NOISE}
      void main() {
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 1.6);
        float n = fbm(vP * scale * 1.7 + vec3(0.0, -time * speed * 1.5, 0.0));
        vec3 col = mix(core * (0.7 + 0.6 * n), edge, clamp(f * 1.3 + (0.5 - n) * 0.6, 0.0, 1.0));
        float a = clamp((1.0 - f * 0.65) * (0.7 + 0.5 * n), 0.0, 1.0) * opacity;
        gl_FragColor = vec4(col * a, a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}

/** Camera-facing ribbon behind a moving point. */
export class Trail {
  constructor(scene, { width = 0.5, color = [3, 1.2, 0.3], life = 0.25, max = 24, tex = null, taper = true } = {}) {
    this.width = width; this.life = life; this.max = max; this.taper = taper;
    this.pts = [];
    const g = (this.geo = new THREE.BufferGeometry());
    this.pos = new Float32Array(max * 2 * 3); this.uv = new Float32Array(max * 2 * 2);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2).setUsage(THREE.DynamicDrawUsage));
    const idx = [];
    for (let i = 0; i < max - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(idx);
    this.mat = energyMaterial({ map: tex, color, scale: 3, flow: [-2.5, 0] });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 11;
    scene.add(this.mesh);
    this.t = 0; this.alive = true;
  }

  push(p) { this.pts.unshift({ x: p.x, y: p.y, z: p.z, t: this.t }); if (this.pts.length > this.max) this.pts.pop(); }

  /** Returns false when the trail has fully faded (after stop()). */
  update(dt, camera) {
    this.t += dt;
    this.mat.uniforms.time.value += dt;
    while (this.pts.length && this.t - this.pts[this.pts.length - 1].t > this.life) this.pts.pop();
    const n = this.pts.length;
    const cam = camera.position;
    const P = this.pos, U = this.uv;
    const d = new THREE.Vector3(), v = new THREE.Vector3(), s = new THREE.Vector3();
    for (let i = 0; i < this.max; i++) {
      const a = this.pts[Math.min(i, n - 1)] ?? { x: 0, y: -100, z: 0, t: 0 };
      const b = this.pts[Math.min(i + 1, n - 1)] ?? a, c = this.pts[Math.max(i - 1, 0)] ?? a;
      d.set(c.x - b.x, c.y - b.y, c.z - b.z); if (d.lengthSq() < 1e-8) d.set(1, 0, 0);
      v.set(cam.x - a.x, cam.y - a.y, cam.z - a.z);
      s.crossVectors(d, v).normalize();
      const age = n ? (this.t - a.t) / this.life : 1, k = i < n ? (this.taper ? 1 - Math.min(1, age) : 1) : 0;
      const w = this.width * k * 0.5;
      P.set([a.x + s.x * w, a.y + s.y * w, a.z + s.z * w, a.x - s.x * w, a.y - s.y * w, a.z - s.z * w], i * 6);
      const u = Math.min(1, age);
      U.set([u, 1, u, 0], i * 4);
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.uv.needsUpdate = true;
    this.mat.uniforms.progress.value = this.alive ? 0 : Math.min(1, this.mat.uniforms.progress.value + dt * 4);
    return this.alive || n > 1;
  }

  stop() { this.alive = false; }
  dispose() { this.mesh.removeFromParent(); this.geo.dispose(); this.mat.dispose(); }
}

/** Ribbon swept by a weapon blade: each sample is a (base, tip) pair. */
export class SwingTrail {
  constructor(scene, { color = [2.4, 2.1, 1.7], life = 0.16, max = 20 } = {}) {
    this.life = life; this.max = max; this.samples = [];
    const g = (this.geo = new THREE.BufferGeometry());
    this.pos = new Float32Array(max * 2 * 3); this.uv = new Float32Array(max * 2 * 2);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2).setUsage(THREE.DynamicDrawUsage));
    const idx = [];
    for (let i = 0; i < max - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(idx);
    this.mat = energyMaterial({ color, rim: [3, 2.8, 2.4], scale: 2.5, flow: [-3, 0] });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 12;
    scene.add(this.mesh);
    this.t = 0;
  }
  setColor(c) { this.mat.uniforms.color.value.setRGB(...c); this.mat.uniforms.rimColor.value.setRGB(c[0] * 1.4 + 0.4, c[1] * 1.4 + 0.4, c[2] * 1.4 + 0.4); }
  push(base, tip) {
    // subdivide fast swings so the arc stays smooth
    const last = this.samples[0];
    if (last) {
      const gap = last.tip.distanceTo(tip), steps = Math.min(4, Math.floor(gap / 0.35));
      for (let i = 1; i <= steps; i++) { const k = i / (steps + 1); this.samples.unshift({ base: last.base.clone().lerp(base, k), tip: last.tip.clone().lerp(tip, k), t: this.t }); }
    }
    this.samples.unshift({ base: base.clone(), tip: tip.clone(), t: this.t });
    if (this.samples.length > this.max) this.samples.length = this.max;
  }
  update(dt) {
    this.t += dt; this.mat.uniforms.time.value += dt;
    while (this.samples.length && this.t - this.samples[this.samples.length - 1].t > this.life) this.samples.pop();
    const n = this.samples.length;
    for (let i = 0; i < this.max; i++) {
      const s = this.samples[Math.min(i, n - 1)];
      if (!s || n < 2) { this.pos.fill(0, i * 6, i * 6 + 6); continue; }
      const age = Math.min(1, (this.t - s.t) / this.life);
      const b = s.base.clone().lerp(s.tip, 0.25 + 0.5 * age); // ribbon thins from the base as it ages
      this.pos.set([b.x, b.y, b.z, s.tip.x, s.tip.y, s.tip.z], i * 6);
      this.uv.set([age, 0.1, age, 0.9], i * 4);
    }
    this.mat.uniforms.opacity.value = n > 1 ? 1 : 0;
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.uv.needsUpdate = true;
  }
  dispose() { this.mesh.removeFromParent(); this.geo.dispose(); this.mat.dispose(); }
}

/** Flying chunks (rock, bone, ice) that tumble, bounce on the floor and sink away. */
export class Debris {
  constructor(scene) {
    this.scene = scene; this.list = [];
    this.geos = [new THREE.DodecahedronGeometry(0.2, 0), new THREE.IcosahedronGeometry(0.18, 0), new THREE.TetrahedronGeometry(0.22, 0)];
  }
  burst(pos, { count = 10, speed = [4, 10], up = [5, 10], size = [0.4, 1.1], mat, life = 2.2 } = {}) {
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(this.geos[i % 3], mat);
      const s = size[0] + Math.random() * (size[1] - size[0]);
      m.scale.set(s, s * (0.6 + Math.random() * 0.6), s);
      m.position.set(pos.x + (Math.random() - 0.5), 0.3 + Math.random() * 0.4, pos.z + (Math.random() - 0.5));
      m.castShadow = true;
      const a = Math.random() * Math.PI * 2, v = speed[0] + Math.random() * (speed[1] - speed[0]);
      m.userData = { v: new THREE.Vector3(Math.cos(a) * v, up[0] + Math.random() * (up[1] - up[0]), Math.sin(a) * v), w: new THREE.Vector3(Math.random() * 12, Math.random() * 12, Math.random() * 12), t: 0, life: life * (0.7 + Math.random() * 0.6), r: 0.2 * s };
      this.scene.add(m); this.list.push(m);
    }
  }
  update(dt, level) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const m = this.list[i], u = m.userData;
      u.t += dt;
      u.v.y -= 26 * dt;
      const nx = m.position.x + u.v.x * dt, nz = m.position.z + u.v.z * dt;
      if (level?.blocked?.(nx, nz, 0.1)) { u.v.x *= -0.3; u.v.z *= -0.3; } else { m.position.x = nx; m.position.z = nz; }
      m.position.y += u.v.y * dt;
      if (m.position.y < u.r) { m.position.y = u.r; u.v.y = Math.abs(u.v.y) > 2 ? -u.v.y * 0.35 : 0; u.v.x *= 0.55; u.v.z *= 0.55; u.w.multiplyScalar(0.5); }
      m.rotation.x += u.w.x * dt; m.rotation.y += u.w.y * dt; m.rotation.z += u.w.z * dt;
      if (u.t > u.life) m.position.y -= dt * 0.6;
      if (u.t > u.life + 1) { m.removeFromParent(); this.list.splice(i, 1); }
    }
  }
  clear() { for (const m of this.list) m.removeFromParent(); this.list.length = 0; }
}

/** Material for the distortion buffer: pushes pixels outward along a ring (shockwave) or wobbles them with noise (heat). */
export function distortMaterial({ map = null, kind = 'ring', strength = 0.03 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, strength: { value: strength }, time: { value: Math.random() * 10 }, kind: { value: kind === 'ring' ? 0 : 1 } },
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      uniform sampler2D map; uniform float strength, time, kind; varying vec2 vUv;
      ${NOISE}
      void main() {
        vec2 d = vUv - 0.5; float r = length(d);
        vec2 off;
        if (kind < 0.5) { float a = texture2D(map, vUv).g; off = normalize(d + 1e-5) * a; }
        else { float a = smoothstep(0.5, 0.1, r); off = vec2(fbm(vec3(vUv * 5.0, time * 1.5)) - 0.5, fbm(vec3(vUv * 5.0 + 7.0, time * 1.5 - 3.0)) - 0.5) * 2.0 * a; }
        gl_FragColor = vec4(off * strength, 0.0, 1.0);
      }`,
    transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}

export const DistortShader = {
  uniforms: { tDiffuse: { value: null }, tDistort: { value: null }, amount: { value: 1 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse, tDistort; uniform float amount; varying vec2 vUv;
    void main() {
      vec2 o = texture2D(tDistort, vUv).rg * amount;
      gl_FragColor = texture2D(tDiffuse, vUv + o);
    }`,
};

/**
 * Holy aegis bubble: hexagonal cells that shimmer and pulse, a bright fresnel rim, a rising band of light,
 * and a ripple that spreads from the point of each absorbed hit.
 */
export function aegisMaterial(color = [2.4, 1.8, 0.7]) {
  return new THREE.ShaderMaterial({
    uniforms: {
      color: { value: new THREE.Color(...color) }, time: { value: 0 }, intro: { value: 0 }, fade: { value: 1 },
      hitPos: { value: new THREE.Vector3(0, 0, 1) }, hitT: { value: 9 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vView; varying vec3 vObj;
      void main() {
        vObj = normalize(position);
        vec4 w = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vView = normalize(cameraPosition - w.xyz);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 color; uniform float time, intro, fade, hitT; uniform vec3 hitPos;
      varying vec3 vN; varying vec3 vView; varying vec3 vObj;
      ${NOISE}
      // distance to the nearest hex edge in a hex grid
      float hexEdge(vec2 p) {
        const vec2 s = vec2(1.0, 1.7320508);
        vec4 hc = floor(vec4(p, p - vec2(0.5, 1.0)) / s.xyxy) + 0.5;
        vec4 h = vec4(p - hc.xy * s, p - (hc.zw + 0.5) * s);
        vec2 q = dot(h.xy, h.xy) < dot(h.zw, h.zw) ? h.xy : h.zw;
        q = abs(q);
        return 0.5 - max(dot(q, s * 0.5), q.x);
      }
      void main() {
        float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 2.2);
        vec2 uv = vec2(atan(vObj.z, vObj.x) * 2.6, vObj.y * 4.2);
        float e = hexEdge(uv * 1.6);
        float lines = smoothstep(0.06, 0.0, e);
        float cellN = fbm(vec3(floor(uv * 1.6 * 3.0) * 0.37, time * 0.6));
        float shimmer = smoothstep(0.55, 0.85, cellN) * 0.35;
        float band = smoothstep(0.22, 0.0, abs(fract(vObj.y * 0.5 + 0.5 - time * 0.35) - 0.5));
        // build-up from the feet on cast
        float build = smoothstep(intro * 2.2 - 1.1, intro * 2.2 - 1.0, vObj.y);
        float reveal = 1.0 - build;
        // hit ripple
        float d = acos(clamp(dot(vObj, normalize(hitPos)), -1.0, 1.0));
        float ring = hitT < 1.2 ? smoothstep(0.25, 0.0, abs(d - hitT * 3.0)) * (1.0 - hitT / 1.2) : 0.0;
        float flick = 0.85 + 0.15 * vnoise(vec3(vObj * 6.0 + time * 3.0));
        float a = (fres * 0.6 + lines * (0.1 + fres * 0.55) + shimmer * (0.12 + fres * 0.35) + band * 0.14 * (lines + 0.15) + ring * (0.35 + lines * 0.9)) * flick;
        a *= reveal * fade;
        vec3 col = color * a * 0.75 + vec3(1.0, 0.92, 0.75) * (ring * 0.3 + lines * fres * 0.3) * reveal * fade;
        gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}

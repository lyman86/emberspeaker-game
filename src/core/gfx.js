import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { DistortShader } from '../game/vfx.js';
import { AOPass, GradePass } from './post.js';

const FX_LIGHTS = 4;
const TORCH_LIGHTS = 6;

export class Gfx {
  /** quality: 'high' | 'mid' | 'low' */
  constructor(canvas, quality = 'high') {
    if (quality === true) quality = 'low';
    if (quality === false) quality = 'high';
    this.quality = quality;
    const low = (this.low = quality === 'low');
    const Q = (this.Q = { high: { ratio: 1.75, ao: true, torchShadows: 2, grade: true }, mid: { ratio: 1.25, ao: true, torchShadows: 1, grade: true }, low: { ratio: 1, ao: false, torchShadows: 0, grade: false } }[quality]);
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }));
    r.setPixelRatio(Math.min(window.devicePixelRatio, Q.ratio));
    r.shadowMap.enabled = !low;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.15;
    r.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05060a);
    this.scene.fog = new THREE.FogExp2(0x05060a, 0.018);

    this.camera = new THREE.PerspectiveCamera(33, 1, 1, 220);
    this.camOffset = new THREE.Vector3(15.5, 21.5, 15.5);
    this.focus = new THREE.Vector3();
    this.shake = 0;

    // Lighting rig. Light counts never change at runtime so shaders never recompile mid-fight.
    this.hemi = new THREE.HemisphereLight(0x6f7fa8, 0x1a1410, 0.5);
    this.scene.add(this.hemi);
    this.key = new THREE.DirectionalLight(0x8fa6d8, 1.2);
    this.key.castShadow = !low;
    this.key.shadow.mapSize.set(2048, 2048);
    const sc = this.key.shadow.camera;
    sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 1; sc.far = 120;
    this.key.shadow.bias = -0.0006;
    this.key.shadow.normalBias = 0.04;
    this.keyDir = new THREE.Vector3(-12, 34, 22);
    this.scene.add(this.key, this.key.target);

    this.playerLight = new THREE.PointLight(0xffb070, 0, 22, 1.6);
    this.scene.add(this.playerLight);
    this.fxLights = [];
    for (let i = 0; i < FX_LIGHTS; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 20, 1.8);
      l.userData = { t: 0, dur: 0, peak: 0, follow: null };
      this.scene.add(l);
      this.fxLights.push(l);
    }
    this.torchLights = [];
    for (let i = 0; i < TORCH_LIGHTS; i++) {
      const l = new THREE.PointLight(0xff8a3c, 0, 26, 1.7);
      // the nearest torches (pool slots 0..n) cast real shadows; the count never changes so shaders never recompile
      if (i < Q.torchShadows) { l.castShadow = true; l.shadow.mapSize.set(512, 512); l.shadow.bias = -0.004; l.shadow.normalBias = 0.05; l.shadow.camera.near = 0.3; l.shadow.camera.far = 26; l.shadow.radius = 3; }
      this.scene.add(l);
      this.torchLights.push(l);
    }
    this.torches = [];
    this.time = 0;

    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: low ? 0 : 4 });
    rt.depthTexture = new THREE.DepthTexture(1, 1);
    this.composer = new EffectComposer(r, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    if (Q.ao) { this.ao = new AOPass(this.camera); this.composer.addPass(this.ao); }
    // screen-space distortion (shockwaves, heat haze): effect meshes write offsets into distortRT
    this.distortScene = new THREE.Scene();
    this.distortRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    this.distortPass = new ShaderPass(DistortShader);
    this.distortPass.uniforms.tDistort.value = this.distortRT.texture;
    this.distortPass.enabled = false;
    this.composer.addPass(this.distortPass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.75, 0.7, 0.82);
    if (!low) this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    if (Q.grade) { this.grade = new GradePass(); this.composer.addPass(this.grade); }

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.distortRT.setSize(Math.max(1, w >> 1), Math.max(1, h >> 1));
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Mood: { bg, fog, hemi:[sky,ground,int], key:[color,int], exposure } */
  setMood(m) {
    this.scene.background.set(m.bg);
    this.scene.fog.color.set(m.bg);
    this.scene.fog.density = m.fog;
    this.hemi.color.set(m.hemi[0]);
    this.hemi.groundColor.set(m.hemi[1]);
    this.hemi.intensity = m.hemi[2];
    this.key.color.set(m.key[0]);
    this.key.intensity = m.key[1];
    this.renderer.toneMappingExposure = m.exposure ?? 1.15;
    this.playerLight.intensity = m.playerLight ?? 0;
  }

  /** One-shot flash light for spells and explosions. */
  flash(pos, color, peak, dur = 0.4, dist = 22) {
    let best = this.fxLights[0];
    for (const l of this.fxLights) if (l.userData.t >= l.userData.dur) { best = l; break; } else if (l.userData.dur - l.userData.t < best.userData.dur - best.userData.t) best = l;
    best.color.set(color);
    best.position.set(pos.x, (pos.y ?? 0) + 1.5, pos.z);
    best.distance = dist;
    best.userData.t = 0; best.userData.dur = dur; best.userData.peak = peak * 0.55; best.userData.token = this._tok = (this._tok ?? 0) + 1;
    return best;
  }

  addShake(a) { this.shake = Math.min(1.6, this.shake + a); }

  /** Directional camera nudge (heavy hits push the view along the blow). */
  kick(dir, amt = 0.3) {
    this.kickOff ??= new THREE.Vector3();
    const l = Math.hypot(dir.x, dir.z) || 1;
    this.kickOff.x += (dir.x / l) * amt; this.kickOff.z += (dir.z / l) * amt;
  }

  snap(target) { this.focus.copy(target); }

  update(dt, target) {
    this.time += dt;
    const k = 1 - Math.exp(-7 * dt);
    this.focus.x += (target.x - this.focus.x) * k;
    this.focus.z += (target.z - this.focus.z) * k;
    const s = this.shake;
    this.camera.position.set(
      this.focus.x + this.camOffset.x + (Math.random() - 0.5) * s,
      this.camOffset.y + (Math.random() - 0.5) * s,
      this.focus.z + this.camOffset.z + (Math.random() - 0.5) * s
    );
    if (this.kickOff) { this.camera.position.add(this.kickOff); this.kickOff.multiplyScalar(Math.max(0, 1 - dt * 10)); }
    this.camera.lookAt(this.focus.x + (this.kickOff?.x ?? 0), 1.2, this.focus.z + (this.kickOff?.z ?? 0));
    this.shake = Math.max(0, this.shake - dt * 4.5);

    this.key.target.position.set(this.focus.x, 0, this.focus.z);
    this.key.position.set(this.focus.x + this.keyDir.x, this.keyDir.y, this.focus.z + this.keyDir.z);

    this.playerLight.position.set(target.x, 3.2, target.z);

    for (const l of this.fxLights) {
      const u = l.userData;
      if (u.t < u.dur) {
        u.t += dt;
        const f = Math.max(0, 1 - u.t / u.dur);
        l.intensity = u.peak * f * f;
      } else l.intensity = 0;
    }

    // Assign the pooled torch lights to the torches nearest the player, fading by distance to hide swaps.
    if (this.torches.length) {
      const list = this.torches;
      for (const t of list) t.d = (t.x - target.x) ** 2 + (t.z - target.z) ** 2;
      list.sort((a, b) => a.d - b.d);
      for (let i = 0; i < this.torchLights.length; i++) {
        const l = this.torchLights[i], t = list[i];
        if (!t) { l.intensity = 0; continue; }
        const d = Math.sqrt(t.d);
        const fade = THREE.MathUtils.clamp(1 - (d - 26) / 14, 0, 1);
        const flicker = 0.82 + 0.18 * Math.sin(this.time * 11 + t.seed) * Math.sin(this.time * 4.3 + t.seed * 2);
        l.position.set(t.x, t.y, t.z);
        l.color.set(t.color);
        l.intensity = t.power * fade * flicker;
      }
    } else for (const l of this.torchLights) l.intensity = 0;
  }

  render() {
    const on = this.distortScene.children.length > 0 && !this.low;
    this.distortPass.enabled = on;
    if (on) {
      const r = this.renderer, prev = r.getRenderTarget(), cc = r.getClearColor(new THREE.Color()), ca = r.getClearAlpha();
      r.setRenderTarget(this.distortRT); r.setClearColor(0x000000, 0); r.clear(true, true, false);
      r.render(this.distortScene, this.camera);
      r.setRenderTarget(prev); r.setClearColor(cc, ca);
    }
    this.composer.render();
  }

  /** World position to CSS pixel coordinates. */
  project(v, out = {}) {
    const p = _v.copy(v).project(this.camera);
    out.x = (p.x * 0.5 + 0.5) * window.innerWidth;
    out.y = (-p.y * 0.5 + 0.5) * window.innerHeight;
    out.visible = p.z < 1;
    return out;
  }
}
const _v = new THREE.Vector3();

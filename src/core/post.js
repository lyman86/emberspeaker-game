import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

/**
 * Screen-space ambient occlusion from the main pass's depth buffer (no extra scene render).
 * Transparent effects do not write depth, so they never occlude; bright pixels (fire, magic) are protected.
 * AO is computed at half resolution, then depth-aware blurred and multiplied into the HDR colour.
 */
export class AOPass extends Pass {
  constructor(camera, { radius = 1.6, intensity = 1.25, half = true } = {}) {
    super();
    this.camera = camera;
    this.half = half;
    this.rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, format: THREE.RGBAFormat });
    this.aoMat = new THREE.ShaderMaterial({
      uniforms: { tDepth: { value: null }, projInv: { value: new THREE.Matrix4() }, proj: { value: new THREE.Matrix4() }, res: { value: new THREE.Vector2(1, 1) }, radius: { value: radius }, intensity: { value: intensity }, frame: { value: 0 } },
      vertexShader: VS,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDepth; uniform mat4 projInv, proj; uniform vec2 res; uniform float radius, intensity, frame;
        varying vec2 vUv;
        vec3 viewPos(vec2 uv) { float d = texture2D(tDepth, uv).x; vec4 p = projInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return p.xyz / p.w; }
        float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
        void main() {
          float d = texture2D(tDepth, vUv).x;
          if (d >= 0.9999) { gl_FragColor = vec4(1.0); return; }
          vec3 P = viewPos(vUv);
          vec3 N = normalize(cross(dFdx(P), dFdy(P)));
          float ssR = radius * proj[1][1] / -P.z * 0.5;
          float rot = ign(gl_FragCoord.xy) * 6.2831;
          float occ = 0.0;
          const int S = 12;
          for (int i = 0; i < S; i++) {
            float f = (float(i) + 0.5) / float(S);
            float a = rot + float(i) * 2.39996;
            vec2 o = vec2(cos(a), sin(a)) * ssR * f * vec2(res.y / res.x, 1.0);
            vec3 Q = viewPos(clamp(vUv + o, 0.001, 0.999));
            vec3 v = Q - P;
            float vv = dot(v, v), vn = dot(v, N);
            float range = smoothstep(radius * radius * 4.0, radius * radius, vv);
            occ += max(0.0, vn - 0.03 * -P.z * 0.02) / (vv + 0.05) * range;
          }
          float ao = clamp(1.0 - intensity * occ / float(S) * radius, 0.0, 1.0);
          gl_FragColor = vec4(ao, -P.z, 0.0, 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });
    this.compMat = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, tAO: { value: null }, aoRes: { value: new THREE.Vector2(1, 1) }, strength: { value: 1 } },
      vertexShader: VS,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse, tAO; uniform vec2 aoRes; uniform float strength; varying vec2 vUv;
        void main() {
          vec4 c = texture2D(tDiffuse, vUv);
          vec2 cz = texture2D(tAO, vUv).rg;
          float sum = 0.0, wsum = 0.0;
          for (int y = -2; y <= 2; y++) for (int x = -2; x <= 2; x++) {
            vec2 s = texture2D(tAO, vUv + vec2(x, y) / aoRes).rg;
            float w = exp(-abs(s.g - cz.g) * 1.2) * (1.0 - 0.12 * float(abs(x) + abs(y)));
            sum += s.r * w; wsum += w;
          }
          float ao = sum / max(wsum, 1e-4);
          float lum = dot(c.rgb, vec3(0.3, 0.59, 0.11));
          ao = mix(ao, 1.0, smoothstep(0.7, 2.2, lum));
          c.rgb *= mix(1.0, ao, strength);
          gl_FragColor = c;
        }`,
      depthTest: false, depthWrite: false,
    });
    this.quadAO = new FullScreenQuad(this.aoMat);
    this.quadComp = new FullScreenQuad(this.compMat);
  }

  setSize(w, h) {
    const k = this.half ? 0.5 : 1;
    this.rt.setSize(Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k)));
    this.aoMat.uniforms.res.value.set(w * k, h * k);
    this.compMat.uniforms.aoRes.value.set(w * k, h * k);
  }

  render(renderer, writeBuffer, readBuffer) {
    const U = this.aoMat.uniforms;
    U.tDepth.value = readBuffer.depthTexture;
    U.proj.value.copy(this.camera.projectionMatrix);
    U.projInv.value.copy(this.camera.projectionMatrixInverse);
    renderer.setRenderTarget(this.rt);
    this.quadAO.render(renderer);
    this.compMat.uniforms.tDiffuse.value = readBuffer.texture;
    this.compMat.uniforms.tAO.value = this.rt.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quadComp.render(renderer);
  }

  dispose() { this.rt.dispose(); this.aoMat.dispose(); this.compMat.dispose(); this.quadAO.dispose(); this.quadComp.dispose(); }
}

/**
 * Filmic finishing in display space: gentle contrast curve, saturation, split toning (cool shadows, warm highlights),
 * lens vignette, edge chromatic aberration and animated film grain.
 */
export class GradePass extends Pass {
  constructor(opts = {}) {
    super();
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null }, time: { value: 0 }, res: { value: new THREE.Vector2(1, 1) },
        contrast: { value: opts.contrast ?? 1.05 }, saturation: { value: opts.saturation ?? 1.06 },
        shadowTint: { value: new THREE.Color(opts.shadowTint ?? 0x1a3040) }, highTint: { value: new THREE.Color(opts.highTint ?? 0xffd8a8) },
        split: { value: opts.split ?? 0.14 }, vignette: { value: opts.vignette ?? 0.35 }, ca: { value: opts.ca ?? 0.0035 }, grain: { value: opts.grain ?? 0.035 },
      },
      vertexShader: VS,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse; uniform float time, contrast, saturation, split, vignette, ca, grain; uniform vec3 shadowTint, highTint; uniform vec2 res;
        varying vec2 vUv;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main() {
          vec2 d = vUv - 0.5;
          float r2 = dot(d, d);
          vec3 c;
          c.r = texture2D(tDiffuse, vUv - d * ca * r2 * 4.0).r;
          c.g = texture2D(tDiffuse, vUv).g;
          c.b = texture2D(tDiffuse, vUv + d * ca * r2 * 4.0).b;
          // S-curve contrast around mid grey
          c = clamp(c, 0.0, 1.0);
          c = mix(c, c * c * (3.0 - 2.0 * c), contrast - 1.0);
          float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
          c = mix(vec3(l), c, saturation);
          // split toning
          c += shadowTint * (1.0 - l) * (1.0 - l) * split;
          c = mix(c, c * highTint * 1.08, l * l * split * 1.6);
          // vignette
          float v = smoothstep(0.95, 0.25, length(d * vec2(res.x / res.y, 1.0) * 0.82));
          c *= mix(1.0, v, vignette);
          // grain (luminance-weighted so blacks stay black)
          float n = hash(vUv * res + fract(time * 13.7) * 91.0) - 0.5;
          c += n * grain * (0.3 + 0.7 * l);
          gl_FragColor = vec4(c, 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.mat);
  }
  setSize(w, h) { this.mat.uniforms.res.value.set(w, h); }
  render(renderer, writeBuffer, readBuffer, dt) {
    this.mat.uniforms.tDiffuse.value = readBuffer.texture;
    this.mat.uniforms.time.value += dt ?? 0.016;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }
}

const VS = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

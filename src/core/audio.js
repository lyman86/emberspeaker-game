/**
 * Sound: recorded files listed in public/audio/manifest.json are used when present
 * (several variants per effect, picked at random with slight pitch variation); anything
 * not listed falls back to the Web Audio synthesis recipes at the bottom of this file.
 * Ambience loops (amb_*) and music tracks (mus_*) from the manifest replace the
 * synthesized wind and generative score.
 */
const HARBOR_SOUNDS=['h_surge','h_chain','h_lure','h_plank','h_roar','h_impact','h_doom'];
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.listener = { x: 0, z: 0 };
    this.mood = 'none';
    this.overrides = {};
    this._last = {};
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.2;
    this.master.connect(comp).connect(ctx.destination);

    this.sfx = ctx.createGain(); this.sfx.gain.value = 0.9; this.sfx.connect(this.master);
    this.music = ctx.createGain(); this.music.gain.value = 0.5; this.music.connect(this.master);
    this.amb = ctx.createGain(); this.amb.gain.value = 0.5; this.amb.connect(this.master);

    // Zone reverbs from generated impulse responses: open night air, stone crypt, the bell chamber.
    this.irs = { iron:this._impulse(1.8,2.8),fortress:this._impulse(3.1,2.4),iron_boss:this._impulse(3.8,2), forest:this._impulse(1.1,3),swamp:this._impulse(1.8,2.8),mill:this._impulse(2.2,2.8),plague_boss:this._impulse(2.8,2.4),camp: this._impulse(1.3, 3.2), crypt: this._impulse(3.6, 2.0), boss: this._impulse(4.6, 1.8), none: this._impulse(2, 3) };
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.irs.crypt;
    this.revGain = ctx.createGain(); this.revGain.gain.value = 0.55;
    this.reverb.connect(this.revGain).connect(this.master);
    // music runs through a filter that opens up when fighting starts
    this.musicFilter = ctx.createBiquadFilter(); this.musicFilter.type = 'lowpass'; this.musicFilter.frequency.value = 2400; this.musicFilter.Q.value = 0.5;
    this.music.disconnect(); this.music.connect(this.musicFilter).connect(this.master);
    this.duck = ctx.createGain(); this.duck.gain.value = 1;
    this.amb.disconnect(); this.amb.connect(this.duck).connect(this.master);
    this.intensity = 0;
    // 3D listener: the camera looks toward −x−z, so world positions are rotated into a listener frame in play()
    const L = ctx.listener;
    if (L.forwardX) { L.forwardX.value = 0; L.forwardY.value = 0; L.forwardZ.value = -1; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; }

    this.noiseBuf = this._noise(2.5);
    this._startAmbience();
    this._musicTimer = setInterval(() => this._tickMusic(), 120);
    this._bar = 0; this._nextBar = ctx.currentTime + 0.3; this._beat = 0; this._nextBeat = ctx.currentTime + 0.3;
    this.loadOverrides();
  }

  /** Recorded sounds: manifest = { sfx: { name: { files: [...], gain } }, amb: {...}, music: {...} } */
  async loadOverrides() {
    this.loops ??= {};this.pending ??= new Map();
    this._manifestPromise ??= (async()=>{
      try {const r=await fetch(import.meta.env.BASE_URL+'audio/manifest.json');if(r.ok)this.manifest=await r.json();}
      catch(err){console.warn('Audio manifest unavailable; using synthesized audio.',err);}
      return this.manifest??{};
    })();
    return this._manifestPromise;
  }

  async loadSound(name) {
    if(!this.ctx||this.overrides[name])return;
    await this.loadOverrides();
    const e=this.manifest?.sfx?.[name];if(!e)return;
    const key='sfx:'+name;
    if(!this.pending.has(key))this.pending.set(key,(async()=>{
      try {
        const bufs=await Promise.all(e.files.map(f=>this._file(f)));
        if(HARBOR_SOUNDS.includes(name)&&this.episode!==5)return;
        if(!name.startsWith('e_')||!['e_villager','e_goblin','e_wolf','e_witch','e_butcher','e_poison','e_roots'].includes(name)||this.episode===2)
          this.overrides[name]={bufs,gain:e.gain??1,wet:e.wet??.2,pitch:e.pitch??.06};
      }catch(err){console.warn('audio',name,err);}
    })().finally(()=>this.pending.delete(key)));
    return this.pending.get(key);
  }

  async _file(file) {
    const r=await fetch(import.meta.env.BASE_URL+'audio/'+file);if(!r.ok)throw new Error('Audio '+r.status);
    return this.ctx.decodeAudioData(await r.arrayBuffer());
  }

  async loadMood() {
    if(!this.ctx)return;await this.loadOverrides();
    await Promise.all(this._wanted().map(async name=>{
      if(this.loops[name])return;
      const key='loop:'+name,e=this.manifest?.amb?.[name]??this.manifest?.music?.[name];if(!e)return;
      if(!this.pending.has(key))this.pending.set(key,(async()=>{
        try{const buf=await this._file(e.file);if(this._wanted().includes(name))this.loops[name]={buf,gain:e.gain??1,group:name.startsWith('mus_')?'music':'amb'};this._applyLoops();}
        catch(err){console.warn('audio',name,err);}
      })().finally(()=>this.pending.delete(key)));
      await this.pending.get(key);
    }));
    for(const name of Object.keys(this.loops))if(!this._wanted().includes(name))delete this.loops[name];
  }

  async prepare(mood,episode) {
    this.episode=episode;this.setMood(mood);
    const plague=['e_villager','e_goblin','e_wolf','e_witch','e_butcher','e_poison','e_roots'];
    if(episode!==5)for(const name of HARBOR_SOUNDS)delete this.overrides[name];
    if(episode!==2)for(const name of plague)delete this.overrides[name];
    await Promise.all([this.loadMood(),...['hit','hurt','swing','coin','potion','pickup',...(episode===2?plague:[]),...(episode===5?HARBOR_SOUNDS:[])].map(name=>this.loadSound(name))]);
  }

  /** Start / cross-fade the recorded ambience and music for the current mood. */
  _applyLoops() {
    if (!this.loops || !this.ctx) return;
    const want = this._wanted();
    this._playing ??= {};
    const t = this.ctx.currentTime;
    for (const [name, p] of Object.entries(this._playing)) if (!want.includes(name)) {
      p.g.gain.setTargetAtTime(0, t, 0.8); p.src.stop(t + 4); delete this._playing[name];
    }
    for (const name of want) {
      const L = this.loops[name];
      if (!L || this._playing[name]) continue;
      const src = this.ctx.createBufferSource(); src.buffer = L.buf; src.loop = true;
      const g = this.ctx.createGain(); g.gain.value = 0;
      src.connect(g).connect(L.group === 'music' ? this.music : this.amb);
      src.start(t, L.group === 'amb' ? Math.random() * L.buf.duration : 0);
      g.gain.setTargetAtTime(L.gain, t, 1.2);
      this._playing[name] = { src, g };
    }
  }

  _wanted() {
    return { harbor:['amb_sea','mus_crypt'],wreck:['amb_sea','mus_crypt'],harbor_boss:['amb_sea','mus_boss'],salt:['amb_wind','mus_crypt'],salt_tomb:['amb_cave','mus_crypt'],salt_boss:['amb_wind','mus_boss'],iron:['amb_wind','amb_fire','mus_crypt'],fortress:['amb_cave','amb_fire','mus_crypt'],iron_boss:['amb_fire','mus_boss'],camp: ['amb_wind', 'amb_fire', 'mus_camp'], crypt: ['amb_cave', 'mus_crypt'], boss: ['amb_cave', 'mus_boss'],forest:['amb_forest','mus_crypt'],swamp:['amb_swamp','mus_crypt'],mill:['amb_forest','amb_mill','mus_crypt'],plague_boss:['amb_swamp','mus_boss'], none: [] }[this.mood] ?? [];
  }

  /** True while a recorded music track is playing (the generative score then stays silent). */
  get hasMusic() { return Object.keys(this._playing ?? {}).some((k) => k.startsWith('mus_')); }
  get hasAmb() { return !!this.loops && Object.keys(this.loops).some((k) => k.startsWith('amb_')); }

  toggleMute() {
    this.muted = !this.muted;
    if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, this.ctx.currentTime, 0.05);
    return this.muted;
  }

  _noise(sec) {
    const b = this.ctx.createBuffer(1, this.ctx.sampleRate * sec, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  _impulse(sec, decay) {
    const sr = this.ctx.sampleRate, len = sr * sec;
    const b = this.ctx.createBuffer(2, len, sr);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        lp += (Math.random() * 2 - 1 - lp) * (0.9 - t * 0.75);
        d[i] = lp * Math.pow(1 - t, decay);
      }
    }
    return b;
  }

  /** Output chain for one sound: gain + pan, with reverb send. */
  _out(vol, pan = 0, wet = 0.25, rel = null) {
    const ctx = this.ctx;
    const g = ctx.createGain(); g.gain.value = vol;
    let tail;
    if (rel && ctx.createPanner) {
      // HRTF spatialisation (direction only — distance loudness is handled in play()), plus air absorption
      const p = ctx.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'linear'; p.rolloffFactor = 0; p.refDistance = 1; p.maxDistance = 1000;
      p.positionX.value = rel.x / 6; p.positionY.value = 0.4; p.positionZ.value = rel.z / 6;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.max(1800, 20000 * Math.exp(-rel.d / 22)); lp.Q.value = 0.3;
      g.connect(lp).connect(p); tail = p;
    } else { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); tail = p; }
    tail.connect(this.sfx);
    const wz = wet * (this.wetMul ?? 1) * (rel ? 1 + Math.min(1, rel.d / 30) * 0.8 : 1); // far sounds are more reverberant
    if (wz > 0) { const w = ctx.createGain(); w.gain.value = wz; tail.connect(w); w.connect(this.reverb); }
    return g;
  }

  /** Sub-bass body under heavy impacts, and a brief duck of music and ambience so the hit lands. */
  _thump(vol, dest) {
    const ctx = this.ctx, t = ctx.currentTime;
    this._tone(dest, { f0: 78, f1: 32, dur: 0.45, gain: 0.9 * vol, attack: 0.004 });
    this._nz(dest, { dur: 0.25, gain: 0.35 * vol, type: 'lowpass', f0: 380, f1: 80 });
    for (const node of [this.duck.gain, this.music.gain]) {
      const base = node === this.duck.gain ? 1 : this._musicGain ?? 0.5;
      node.cancelScheduledValues(t); node.setValueAtTime(node.value, t);
      node.linearRampToValueAtTime(base * 0.45, t + 0.03); node.setTargetAtTime(base, t + 0.12, 0.25);
    }
  }

  /** 0..1 combat intensity (nearby hostile enemies): opens the music filter and drives the war-drum layer. */
  setIntensity(v) {
    if (!this.ctx) return;
    this.intensity += (v - this.intensity) * 0.08;
    const t = this.ctx.currentTime, k = this.intensity;
    this.musicFilter.frequency.setTargetAtTime(2400 + k * 15000, t, 0.4);
    this._musicGain = 0.5 + k * 0.25;
    this.music.gain.setTargetAtTime(this._musicGain, t, 0.5);
  }

  _tone(dest, { type = 'sine', f0, f1, dur, gain = 1, attack = 0.005, delay = 0, curve = 'exp' }) {
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    if (curve === 'exp') g.gain.exponentialRampToValueAtTime(0.0001, t + dur); else g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g).connect(dest);
    o.start(t); o.stop(t + dur + 0.05);
    return o;
  }

  _nz(dest, { dur, gain = 1, attack = 0.005, delay = 0, type = 'lowpass', f0 = 1000, f1, Q = 0.8, rate = 1 }) {
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; s.playbackRate.value = rate;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = Q;
    f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(dest);
    s.start(t, Math.random() * 2); s.stop(t + dur + 0.05);
  }

  /** Play a named effect, optionally positioned in the world. */
  play(name, pos, vol = 1) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    if (this._last[name] && now - this._last[name] < 0.035) return; // de-dupe bursts
    this._last[name] = now;
    let pan = 0, rel = null;
    if (pos) {
      const dx = pos.x - this.listener.x, dz = pos.z - this.listener.z;
      const d = Math.hypot(dx, dz);
      vol *= Math.max(0, 1 - d / 46) ** 1.5;
      if (vol < 0.02) return;
      pan = Math.max(-0.8, Math.min(0.8, (dx - dz) / 28)); // camera looks toward -x-z, so screen-right is +x-z
      rel = { x: (dx - dz) * 0.7071, z: (dx + dz) * 0.7071, d }; // screen-right, toward the viewer
    }
    vol *= 0.9 + Math.random() * 0.2;
    if (HEAVY.has(name)) this._thump(Math.min(1.2, vol), this.sfx);
    if(!this.overrides[name])this.loadSound(name);
    const o = this.overrides[name];
    if (o) {
      const s = this.ctx.createBufferSource(); s.buffer = o.bufs[(Math.random() * o.bufs.length) | 0];
      s.playbackRate.value = 1 + (Math.random() * 2 - 1) * o.pitch;
      s.connect(this._out(vol * o.gain, pan, o.wet, rel)); s.start();
      return;
    }
    const fn = SFX[name];
    if (fn) fn(this, vol, pan);
  }

  // ---------- ambience ----------
  _startAmbience() {
    const ctx = this.ctx;
    const mk = (type, freq, Q) => {
      const s = ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = Q;
      const g = ctx.createGain(); g.gain.value = 0;
      s.connect(f).connect(g).connect(this.amb); s.start();
      return { f, g };
    };
    this.wind = mk('bandpass', 420, 1.2);
    this.rumble = mk('lowpass', 90, 0.5);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.13;
    const lg = ctx.createGain(); lg.gain.value = 220;
    lfo.connect(lg).connect(this.wind.f.frequency); lfo.start();
    this._dripTimer = setInterval(() => {
      if (this.mood === 'crypt' && Math.random() < 0.5) this.play('drip', null, 0.25 + Math.random() * 0.3);
      if (this.mood === 'camp' && Math.random() < 0.18) this.play('crow', null, 0.2);
    }, 2300);
  }

  setMood(mood) {
    if (!this.ctx || this.mood === mood) { this.mood = mood; return; }
    this.mood = mood;
    const t = this.ctx.currentTime;
    this.reverb.buffer = this.irs[mood] ?? this.irs.none;
    this.wetMul = { camp: 0.45, crypt: 1.0, boss: 1.25 }[mood] ?? 0.7;
    const synthAmb = this.hasAmb ? 0.3 : 1; // recorded beds carry most of the atmosphere when present
    this.wind.g.gain.setTargetAtTime((mood === 'camp' ? 0.2 : mood === 'none' ? 0 : 0.05) * synthAmb, t, 1.2);
    this.rumble.g.gain.setTargetAtTime((mood === 'crypt' || mood === 'boss' ? 0.5 : 0.12) * synthAmb, t, 1.2);
    this._applyLoops();
    this.loadMood();
    this._bar = 0; this._beat = 0;
    this._nextBar = t + 0.4; this._nextBeat = t + 0.4;
  }

  // ---------- generative music ----------
  _pad(notes, dur, gain, cutoff = 700) {
    const ctx = this.ctx, t = this._nextBar;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + dur * 0.35);
    g.gain.linearRampToValueAtTime(0.0001, t + dur * 1.25);
    f.connect(g); g.connect(this.music);
    const w = ctx.createGain(); w.gain.value = 0.7; g.connect(w); w.connect(this.reverb);
    for (const n of notes) for (const det of [-7, 6]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = NOTE(n); o.detune.value = det;
      o.connect(f); o.start(t); o.stop(t + dur * 1.3);
    }
  }

  _pluck(n, t, gain = 0.1) {
    const ctx = this.ctx;
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.5);
    g.connect(this.music);
    const w = ctx.createGain(); w.gain.value = 1.2; g.connect(w); w.connect(this.reverb);
    for (const [mul, a] of [[1, 1], [2.01, 0.3], [3.0, 0.1]]) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = NOTE(n) * mul;
      const og = ctx.createGain(); og.gain.value = a;
      o.connect(og).connect(g); o.start(t); o.stop(t + 2.6);
    }
  }

  _drum(t, gain = 0.5) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.28);
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(g); g.connect(this.music);
    const w = ctx.createGain(); w.gain.value = 0.5; g.connect(w); w.connect(this.reverb);
    o.start(t); o.stop(t + 0.55);
  }

  _bass(n, t, dur, gain = 0.12) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = NOTE(n);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(160, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(this.music); o.start(t); o.stop(t + dur + 0.05);
  }

  _tickMusic() {
    const ctx = this.ctx;
    // war-drum layer that rises with combat intensity (plays over recorded music too)
    if (ctx && ctx.state === 'running' && this.mood !== 'none' && this.intensity > 0.12) {
      const now = ctx.currentTime, stepT = 60 / (this.mood==='iron_boss'?116:this.mood==='iron'||this.mood==='fortress'?104:96) / 2;
      if (!this._dn || this._dn < now - 0.5) { this._dn = now + 0.05; this._di = 0; }
      while (this._dn < now + 0.3) {
        const march=['iron','fortress','iron_boss'].includes(this.mood);
        const acc = (march?[1,0,.3,0,.7,0,.3,0,1,0,.3,.3,.7,.3,.5,.5]:[1,0,0,.5,0,0,1,0,1,0,0,.5,0,.4,.7,.3])[this._di++%16];
        if (acc) this._drum(this._dn, acc * 0.55 * Math.min(1, (this.intensity - 0.12) * 1.6));
        this._dn += stepT;
      }
    }
    if (!ctx || this.mood === 'none' || ctx.state !== 'running' || this.hasMusic) return;
    const now = ctx.currentTime;
    if (this._nextBar < now - 1) { this._nextBar = now + 0.1; this._nextBeat = now + 0.1; }
    const m = this.mood;
    while (this._nextBar < now + 0.4) {
      const b = this._bar++;
      if (m === 'camp') {
        // D minor lament: Dm – Bb – Gm – A
        const prog = [[38, 50, 57, 62, 65], [34, 46, 53, 58, 62], [31, 43, 50, 58, 62], [33, 45, 52, 57, 61]];
        this._pad(prog[b % 4], 7, 0.035, 620);
        const scale = [62, 65, 67, 69, 72, 74, 77];
        for (let i = 0; i < 3; i++) if (Math.random() < 0.6) this._pluck(scale[(Math.random() * scale.length) | 0], this._nextBar + 1 + i * 2 + Math.random(), 0.05);
        this._nextBar += 7;
      } else if (['crypt','forest','swamp','mill','iron','fortress'].includes(m)) {
        const prog = [[26, 38, 45, 51], [26, 38, 44, 50], [25, 37, 44, 52], [26, 33, 45, 53]];
        this._pad(prog[b % 4], 9, 0.03, 380);
        if (Math.random() < 0.5) this._pluck([74, 75, 69, 81][(Math.random() * 4) | 0], this._nextBar + 2 + Math.random() * 4, 0.025);
        this._nextBar += 9;
      } else if ((m === 'boss'||m==='plague_boss'||m==='iron_boss')) {
        const prog = [[38, 50, 53, 57], [36, 48, 51, 55], [34, 46, 50, 53], [33, 45, 49, 52]];
        this._pad(prog[b % 4], 3.4, 0.04, 900);
        this._nextBar += 3.43;
      } else this._nextBar += 2;
    }
    if ((m === 'boss'||m==='plague_boss'||m==='iron_boss')) {
      const step = 60 / 140 / 2;
      const roots = [26, 24, 22, 21];
      while (this._nextBeat < now + 0.3) {
        const i = this._beat++;
        const r = roots[Math.floor(i / 16) % 4];
        const pat = [0, 0, 12, 0, 3, 0, 12, 7];
        this._bass(r + pat[i % 8], this._nextBeat, step * 0.95, 0.11);
        if (i % 4 === 0) this._drum(this._nextBeat, 0.55);
        if (i % 16 === 14 || i % 16 === 15) this._drum(this._nextBeat, 0.35);
        this._nextBeat += step;
      }
    } else this._nextBeat = now + 0.2;
  }
}

// ---------- effect recipes ----------
const HEAVY = new Set(['explosion', 'meteorhit', 'corpseburst', 'e_spikes', 'warcry']);

const SFX = {
  firebolt(a, v, p) {
    const o = a._out(v * 0.5, p, 0.2);
    a._nz(o, { dur: 0.32, gain: 0.9, type: 'bandpass', f0: 700, f1: 2600, Q: 1.2, attack: 0.02 });
    a._tone(o, { type: 'triangle', f0: 240, f1: 520, dur: 0.18, gain: 0.25 });
  },
  fireball(a, v, p) {
    const o = a._out(v * 0.7, p, 0.3);
    a._nz(o, { dur: 0.6, gain: 1, type: 'bandpass', f0: 300, f1: 1900, Q: 0.9, attack: 0.08 });
    a._nz(o, { dur: 0.5, gain: 0.5, type: 'lowpass', f0: 500, f1: 150 });
    a._tone(o, { type: 'sawtooth', f0: 90, f1: 190, dur: 0.4, gain: 0.25, attack: 0.05 });
  },
  hitfire(a, v, p) {
    const o = a._out(v * 0.55, p, 0.2);
    a._nz(o, { dur: 0.22, gain: 1, type: 'lowpass', f0: 2400, f1: 300 });
    a._tone(o, { f0: 170, f1: 55, dur: 0.2, gain: 0.7 });
  },
  explosion(a, v, p) {
    const o = a._out(v * 0.95, p, 0.45);
    a._tone(o, { f0: 130, f1: 28, dur: 0.75, gain: 1.1 });
    a._nz(o, { dur: 0.9, gain: 1.1, type: 'lowpass', f0: 3200, f1: 110, Q: 0.5 });
    a._nz(o, { dur: 0.12, gain: 0.8, type: 'highpass', f0: 2500 });
    a._nz(o, { dur: 1.6, gain: 0.3, type: 'bandpass', f0: 240, f1: 80, delay: 0.1, Q: 0.6 });
  },
  nova(a, v, p) {
    const o = a._out(v * 0.75, p, 0.6);
    a._nz(o, { dur: 0.9, gain: 0.8, type: 'highpass', f0: 5200, f1: 1500, attack: 0.02 });
    a._nz(o, { dur: 0.35, gain: 0.9, type: 'bandpass', f0: 1500, f1: 300, Q: 0.7 });
    for (let i = 0; i < 9; i++) a._tone(o, { f0: 1700 + Math.random() * 4200, dur: 0.25 + Math.random() * 0.5, gain: 0.09, delay: 0.03 + i * 0.045 });
    a._tone(o, { f0: 160, f1: 60, dur: 0.4, gain: 0.5 });
  },
  shatter(a, v, p) {
    const o = a._out(v * 0.5, p, 0.4);
    for (let i = 0; i < 6; i++) a._tone(o, { type: 'triangle', f0: 2200 + Math.random() * 5000, dur: 0.08 + Math.random() * 0.2, gain: 0.14, delay: i * 0.02 });
    a._nz(o, { dur: 0.25, gain: 0.5, type: 'highpass', f0: 4000 });
  },
  lightning(a, v, p) {
    const o = a._out(v * 0.8, p, 0.5);
    a._nz(o, { dur: 0.07, gain: 1.3, type: 'highpass', f0: 3000 });
    for (let i = 0; i < 7; i++) a._nz(o, { dur: 0.05 + Math.random() * 0.08, gain: 0.7, type: 'bandpass', f0: 1800 + Math.random() * 5000, Q: 2.5, delay: 0.03 + i * 0.04 + Math.random() * 0.03 });
    a._tone(o, { type: 'sawtooth', f0: 110, f1: 45, dur: 0.5, gain: 0.5 });
    a._nz(o, { dur: 1.1, gain: 0.45, type: 'lowpass', f0: 700, f1: 90, delay: 0.08 });
  },
  meteorfall(a, v, p) {
    const o = a._out(v * 0.6, p, 0.4);
    a._tone(o, { type: 'sawtooth', f0: 1300, f1: 110, dur: 0.95, gain: 0.16, attack: 0.3 });
    a._nz(o, { dur: 0.95, gain: 0.7, type: 'bandpass', f0: 2600, f1: 260, Q: 1.3, attack: 0.5 });
  },
  meteorhit(a, v, p) {
    const o = a._out(v * 1.2, p, 0.7);
    a._tone(o, { f0: 105, f1: 20, dur: 1.5, gain: 1.3 });
    a._tone(o, { type: 'triangle', f0: 62, f1: 26, dur: 1.9, gain: 0.8 });
    a._nz(o, { dur: 1.7, gain: 1.3, type: 'lowpass', f0: 4200, f1: 70, Q: 0.4 });
    a._nz(o, { dur: 0.2, gain: 1, type: 'highpass', f0: 1800 });
    for (let i = 0; i < 5; i++) a._nz(o, { dur: 0.2, gain: 0.3, type: 'bandpass', f0: 500 + Math.random() * 900, Q: 3, delay: 0.3 + i * 0.13 + Math.random() * 0.1 });
  },
  blink(a, v, p) {
    const o = a._out(v * 0.5, p, 0.6);
    a._nz(o, { dur: 0.35, gain: 0.7, type: 'bandpass', f0: 400, f1: 5200, Q: 2, attack: 0.03 });
    a._tone(o, { f0: 320, f1: 1500, dur: 0.22, gain: 0.25 });
    a._tone(o, { f0: 1500, f1: 420, dur: 0.3, gain: 0.2, delay: 0.14 });
  },
  hit(a, v, p) {
    const o = a._out(v * 0.6, p, 0.15);
    a._tone(o, { f0: 190, f1: 60, dur: 0.14, gain: 0.9 });
    a._nz(o, { dur: 0.1, gain: 0.8, type: 'bandpass', f0: 1300, Q: 0.8 });
  },
  hurt(a, v, p) {
    const o = a._out(v * 0.7, p, 0.2);
    a._tone(o, { f0: 150, f1: 48, dur: 0.24, gain: 1 });
    a._nz(o, { dur: 0.16, gain: 0.9, type: 'lowpass', f0: 1500, f1: 250 });
    a._tone(o, { type: 'sawtooth', f0: 210, f1: 130, dur: 0.22, gain: 0.14, delay: 0.03 });
  },
  swing(a, v, p) {
    const o = a._out(v * 0.4, p, 0.15);
    a._nz(o, { dur: 0.22, gain: 0.8, type: 'bandpass', f0: 500, f1: 2400, Q: 2.2, attack: 0.07 });
  },
  rattle(a, v, p) {
    const o = a._out(v * 0.4, p, 0.3);
    for (let i = 0; i < 7; i++) a._tone(o, { type: 'triangle', f0: 650 + Math.random() * 1500, f1: 380, dur: 0.035 + Math.random() * 0.03, gain: 0.5, delay: i * 0.05 + Math.random() * 0.03 });
  },
  bonedeath(a, v, p) {
    const o = a._out(v * 0.6, p, 0.35);
    for (let i = 0; i < 12; i++) a._tone(o, { type: 'triangle', f0: 380 + Math.random() * 1700, f1: 240, dur: 0.04 + Math.random() * 0.05, gain: 0.5, delay: i * 0.035 + Math.random() * 0.04 });
    a._tone(o, { f0: 110, f1: 45, dur: 0.3, gain: 0.6, delay: 0.1 });
    a._nz(o, { dur: 0.3, gain: 0.4, type: 'lowpass', f0: 900, delay: 0.08 });
  },
  awaken(a, v, p) {
    const o = a._out(v * 0.5, p, 0.6);
    a._tone(o, { type: 'sawtooth', f0: 70, f1: 120, dur: 1.1, gain: 0.25, attack: 0.4 });
    a._nz(o, { dur: 1.0, gain: 0.5, type: 'bandpass', f0: 240, f1: 700, Q: 3, attack: 0.3 });
    for (let i = 0; i < 6; i++) a._tone(o, { type: 'triangle', f0: 500 + Math.random() * 1200, f1: 300, dur: 0.04, gain: 0.35, delay: 0.3 + i * 0.1 });
  },
  darkbolt(a, v, p) {
    const o = a._out(v * 0.5, p, 0.4);
    a._tone(o, { type: 'sawtooth', f0: 520, f1: 120, dur: 0.4, gain: 0.25 });
    a._nz(o, { dur: 0.35, gain: 0.5, type: 'bandpass', f0: 1800, f1: 400, Q: 2 });
  },
  arrow(a, v, p) {
    const o = a._out(v * 0.45, p, 0.15);
    a._nz(o, { dur: 0.12, gain: 0.9, type: 'bandpass', f0: 2800, f1: 900, Q: 1.5 });
    a._tone(o, { type: 'triangle', f0: 210, f1: 120, dur: 0.12, gain: 0.5 });
  },
  step(a, v, p) {
    const o = a._out(v * 0.16, p, 0.2);
    a._nz(o, { dur: 0.07, gain: 1, type: 'lowpass', f0: 500 + Math.random() * 400 });
    a._tone(o, { f0: 95 + Math.random() * 30, f1: 55, dur: 0.06, gain: 0.5 });
  },
  // surface-specific footsteps: gritty earth, hard stone with a little room, dry leaves
  step_dirt(a, v, p) {
    const o = a._out(v * 0.2, p, 0.1);
    a._nz(o, { dur: 0.09, gain: 0.9, type: 'bandpass', f0: 900 + Math.random() * 500, f1: 400, Q: 0.7 });
    a._nz(o, { dur: 0.05, gain: 0.5, type: 'highpass', f0: 3000, delay: 0.012, rate: 0.7 });
    a._tone(o, { f0: 80 + Math.random() * 20, f1: 45, dur: 0.07, gain: 0.45 });
  },
  step_stone(a, v, p) {
    const o = a._out(v * 0.18, p, 0.45);
    a._nz(o, { dur: 0.035, gain: 1, type: 'bandpass', f0: 2600 + Math.random() * 900, Q: 1.6 });
    a._tone(o, { f0: 120 + Math.random() * 30, f1: 60, dur: 0.06, gain: 0.55 });
    a._nz(o, { dur: 0.05, gain: 0.35, type: 'highpass', f0: 5000, delay: 0.03 });
  },
  step_leaves(a, v, p) {
    const o = a._out(v * 0.2, p, 0.1);
    for (let i = 0; i < 4; i++) a._nz(o, { dur: 0.05 + Math.random() * 0.05, gain: 0.5 + Math.random() * 0.4, type: 'bandpass', f0: 2500 + Math.random() * 3500, Q: 2, delay: i * 0.02 + Math.random() * 0.02 });
    a._tone(o, { f0: 75, f1: 45, dur: 0.06, gain: 0.3 });
  },
  clink(a, v, p) {
    const o = a._out(v * 0.07, p, 0.3);
    for (let i = 0; i < 2; i++) a._tone(o, { type: 'triangle', f0: 2400 + Math.random() * 1800, dur: 0.12, gain: 0.5, delay: i * 0.03 });
  },
  wardrum(a, v) {
    const o = a._out(v, 0, 0.6);
    a._tone(o, { f0: 105, f1: 46, dur: 0.5, gain: 1, attack: 0.003 });
    a._nz(o, { dur: 0.08, gain: 0.5, type: 'bandpass', f0: 1200, Q: 0.6 });
  },
  coin(a, v, p) {
    const o = a._out(v * 0.3, p, 0.3);
    a._tone(o, { f0: 2350, dur: 0.3, gain: 0.5 });
    a._tone(o, { f0: 3520, dur: 0.4, gain: 0.4, delay: 0.06 });
  },
  potion(a, v, p) {
    const o = a._out(v * 0.45, p, 0.2);
    for (let i = 0; i < 4; i++) a._tone(o, { f0: 280 + i * 70, f1: 560 + i * 90, dur: 0.09, gain: 0.5, delay: i * 0.085 });
    a._tone(o, { f0: 660, f1: 990, dur: 0.6, gain: 0.15, delay: 0.3 });
  },
  pickup(a, v, p) {
    const o = a._out(v * 0.35, p, 0.3);
    a._tone(o, { f0: 660, dur: 0.15, gain: 0.5 });
    a._tone(o, { f0: 990, dur: 0.3, gain: 0.5, delay: 0.08 });
  },
  chest(a, v, p) {
    const o = a._out(v * 0.6, p, 0.4);
    a._tone(o, { type: 'sawtooth', f0: 85, f1: 150, dur: 0.5, gain: 0.25, attack: 0.1 });
    a._nz(o, { dur: 0.5, gain: 0.4, type: 'bandpass', f0: 600, f1: 1400, Q: 5, attack: 0.1 });
    a._tone(o, { f0: 120, f1: 60, dur: 0.2, gain: 0.7, delay: 0.45 });
  },
  gate(a, v, p) {
    const o = a._out(v * 0.8, p, 0.6);
    a._nz(o, { dur: 1.6, gain: 0.6, type: 'bandpass', f0: 180, f1: 320, Q: 6, attack: 0.2 });
    a._tone(o, { type: 'sawtooth', f0: 52, f1: 44, dur: 1.6, gain: 0.3, attack: 0.2 });
    for (let i = 0; i < 9; i++) a._tone(o, { type: 'square', f0: 900 + Math.random() * 600, dur: 0.03, gain: 0.12, delay: 0.1 + i * 0.16 });
    a._tone(o, { f0: 90, f1: 35, dur: 0.5, gain: 1, delay: 1.55 });
  },
  levelup(a, v, p) {
    const o = a._out(v * 0.5, p, 0.7);
    [62, 66, 69, 74, 78].forEach((n, i) => {
      a._tone(o, { type: 'triangle', f0: NOTE(n), dur: 1.4, gain: 0.3, delay: i * 0.09 });
      a._tone(o, { f0: NOTE(n + 12), dur: 1.2, gain: 0.12, delay: i * 0.09 });
    });
    a._nz(o, { dur: 1.2, gain: 0.2, type: 'highpass', f0: 6000, attack: 0.2 });
  },
  bell(a, v, p) {
    const o = a._out(v * 0.8, p, 1.2);
    const f = 110;
    for (const [m, g, d] of [[0.5, 0.5, 6], [1, 0.8, 5], [1.19, 0.5, 4], [1.5, 0.35, 3.2], [2, 0.5, 2.6], [2.51, 0.25, 2], [3.01, 0.2, 1.5], [4.1, 0.12, 1]])
      a._tone(o, { f0: f * m, dur: d, gain: g * 0.35, attack: 0.004 });
    a._nz(o, { dur: 0.08, gain: 0.5, type: 'bandpass', f0: 2000, Q: 1 });
  },
  ui(a, v, p) {
    const o = a._out(v * 0.25, p, 0.1);
    a._tone(o, { type: 'triangle', f0: 520, f1: 380, dur: 0.07, gain: 0.6 });
  },
  quest(a, v, p) {
    const o = a._out(v * 0.45, p, 0.7);
    a._tone(o, { type: 'triangle', f0: NOTE(62), dur: 0.9, gain: 0.35 });
    a._tone(o, { type: 'triangle', f0: NOTE(69), dur: 1.2, gain: 0.35, delay: 0.16 });
  },
  denied(a, v, p) {
    const o = a._out(v * 0.3, p, 0.1);
    a._tone(o, { type: 'square', f0: 150, f1: 110, dur: 0.14, gain: 0.3 });
  },
  drip(a, v, p) {
    const o = a._out(v * 0.5, (Math.random() - 0.5) * 1.4, 1.5);
    a._tone(o, { f0: 1400 + Math.random() * 900, f1: 700, dur: 0.07, gain: 0.4 });
  },
  crow(a, v, p) {
    const o = a._out(v * 0.4, (Math.random() - 0.5) * 1.4, 1.2);
    for (let i = 0; i < 2; i++) { a._tone(o, { type: 'sawtooth', f0: 760, f1: 520, dur: 0.22, gain: 0.25, delay: i * 0.32 }); a._nz(o, { dur: 0.2, gain: 0.25, type: 'bandpass', f0: 1500, Q: 4, delay: i * 0.32 }); }
  },
  roar(a, v, p) {
    const o = a._out(v * 1.0, p, 0.9);
    a._tone(o, { type: 'sawtooth', f0: 95, f1: 48, dur: 2.0, gain: 0.5, attack: 0.25 });
    a._tone(o, { type: 'sawtooth', f0: 143, f1: 70, dur: 1.8, gain: 0.3, attack: 0.3 });
    a._nz(o, { dur: 2.0, gain: 0.7, type: 'bandpass', f0: 420, f1: 200, Q: 2.5, attack: 0.3 });
  },
  bonespike(a, v, p) {
    const o = a._out(v * 0.7, p, 0.4);
    a._nz(o, { dur: 0.3, gain: 1, type: 'bandpass', f0: 900, f1: 2800, Q: 1.5 });
    a._tone(o, { f0: 140, f1: 50, dur: 0.3, gain: 0.8 });
    for (let i = 0; i < 5; i++) a._tone(o, { type: 'triangle', f0: 700 + Math.random() * 1400, dur: 0.05, gain: 0.3, delay: i * 0.03 });
  },
  summon(a, v, p) {
    const o = a._out(v * 0.7, p, 0.9);
    a._tone(o, { type: 'sawtooth', f0: 60, f1: 180, dur: 1.5, gain: 0.3, attack: 0.6 });
    a._nz(o, { dur: 1.5, gain: 0.5, type: 'bandpass', f0: 300, f1: 2400, Q: 4, attack: 0.8 });
  },
};

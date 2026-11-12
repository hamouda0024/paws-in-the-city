/**
 * Fully procedural audio: no sound files, so the APK stays a few megabytes.
 * Everything is synthesized with WebAudio — rain, city hum, distant sirens,
 * car passes, dogs, meows, purrs, footsteps and UI blips.
 */

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export class AudioEngine {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.ready = false;
    this.master = null;
    this.sfx = null;
    this.amb = null;
    this.noiseBuf = null;
    this.rainGain = null;
    this.humGain = null;
    this.sirenTimer = 0;
    this.musicTimer = 0;
    this.heartTimer = 0;
    this.lastStep = 0;
    this._ambStarted = false;
  }

  /** Must be called from a user gesture (browser autoplay policy). */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC({ latencyHint: 'interactive' });
    } catch {
      return;
    }
    const ctx = this.ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 22;
    comp.ratio.value = 5;
    comp.attack.value = 0.004;
    comp.release.value = 0.24;

    this.master = ctx.createGain();
    this.master.gain.value = this.settings.sound ? 0.85 : 0;
    this.sfx = ctx.createGain();
    this.sfx.gain.value = 0.9;
    this.amb = ctx.createGain();
    this.amb.gain.value = 0.75;

    this.sfx.connect(this.master);
    this.amb.connect(this.master);
    this.master.connect(comp);
    comp.connect(ctx.destination);

    this.noiseBuf = this._makeNoise(2.2, 'white');
    this.ready = true;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this._startAmbience();
  }

  setSound(on) {
    this.settings.sound = on;
    if (this.master) {
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(on ? 0.85 : 0, now, 0.05);
    }
    if (on && this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  _makeNoise(seconds, kind) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      if (kind === 'brown') {
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.2;
      } else {
        data[i] = white;
      }
    }
    return buf;
  }

  _noiseSource(loop = false) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = loop;
    return src;
  }

  _startAmbience() {
    if (this._ambStarted || !this.ready) return;
    this._ambStarted = true;
    const ctx = this.ctx;

    // Low city rumble: brown noise through a gentle lowpass.
    const hum = this._noiseSource(true);
    const humFilter = ctx.createBiquadFilter();
    humFilter.type = 'lowpass';
    humFilter.frequency.value = 240;
    humFilter.Q.value = 0.6;
    this.humGain = ctx.createGain();
    this.humGain.gain.value = 0.16;
    hum.connect(humFilter).connect(this.humGain).connect(this.amb);
    hum.start();

    // Rain bed: white noise, band-limited, gain driven by weather.
    const rain = this._noiseSource(true);
    const rainHP = ctx.createBiquadFilter();
    rainHP.type = 'highpass';
    rainHP.frequency.value = 780;
    const rainLP = ctx.createBiquadFilter();
    rainLP.type = 'lowpass';
    rainLP.frequency.value = 5200;
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0;
    rain.connect(rainHP).connect(rainLP).connect(this.rainGain).connect(this.amb);
    rain.start();
  }

  /** Called every frame by the game with the current world mood. */
  updateAmbience(dt, { raining = 0, night = 0, inCity = true, lowHealth = false }) {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    if (this.rainGain) this.rainGain.gain.setTargetAtTime(raining * 0.28, now, 0.5);
    if (this.humGain) this.humGain.gain.setTargetAtTime(inCity ? 0.16 + night * 0.04 : 0.05, now, 0.6);

    this.sirenTimer -= dt;
    if (this.sirenTimer <= 0) {
      this.sirenTimer = 26 + Math.random() * 34;
      this.playSiren();
    }

    // A sparse, slightly melancholic pentatonic motif — louder at night.
    this.musicTimer -= dt;
    if (this.musicTimer <= 0) {
      this.musicTimer = 5.5 + Math.random() * 7;
      this.playMotif(0.35 + night * 0.65);
    }

    if (lowHealth) {
      this.heartTimer -= dt;
      if (this.heartTimer <= 0) {
        this.heartTimer = 1.05;
        this.playHeartbeat();
      }
    } else {
      this.heartTimer = 0.2;
    }
  }

  setRainAmount(v) {
    if (!this.ready || !this.rainGain) return;
    this.rainGain.gain.setTargetAtTime(clamp(v, 0, 1) * 0.28, this.ctx.currentTime, 0.4);
  }

  // ---------------------------------------------------------------- SFX ----

  _env(node, { attack = 0.005, decay = 0.2, peak = 1, curve = 'exp' } = {}) {
    const g = this.ctx.createGain();
    const now = this.ctx.currentTime;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(peak, now + attack);
    if (curve === 'exp') g.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);
    else g.gain.linearRampToValueAtTime(0.0001, now + attack + decay);
    node.connect(g);
    return g;
  }

  _panner(pan = 0) {
    if (this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = clamp(pan, -1, 1);
      return p;
    }
    return this.ctx.createGain();
  }

  playMeow({ pitch = 1, sad = false, pan = 0 } = {}) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const out = this._panner(pan);
    out.connect(this.sfx);

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const base = (sad ? 430 : 560) * pitch;
    osc.frequency.setValueAtTime(base * 0.78, now);
    osc.frequency.linearRampToValueAtTime(base * 1.18, now + 0.09);
    osc.frequency.linearRampToValueAtTime(base * 0.95, now + 0.24);
    osc.frequency.exponentialRampToValueAtTime(base * (sad ? 0.55 : 0.7), now + 0.42);

    const formant1 = ctx.createBiquadFilter();
    formant1.type = 'bandpass';
    formant1.frequency.value = 900 * pitch;
    formant1.Q.value = 5;
    const formant2 = ctx.createBiquadFilter();
    formant2.type = 'bandpass';
    formant2.frequency.value = 2100 * pitch;
    formant2.Q.value = 7;

    const g = this._env(osc, { attack: 0.02, decay: 0.44, peak: 0.22 });
    osc.connect(formant1).connect(g);
    osc.connect(formant2).connect(g);
    g.connect(out);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  playPurr() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const src = this._noiseSource();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 24;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.12;
    const trem = ctx.createGain();
    trem.gain.value = 0.12;
    lfo.connect(lfoGain).connect(trem.gain);
    const g = this._env(src, { attack: 0.15, decay: 0.9, peak: 0.5, curve: 'lin' });
    src.connect(lp).connect(trem).connect(g).connect(this.sfx);
    src.start(now);
    lfo.start(now);
    src.stop(now + 1.1);
    lfo.stop(now + 1.1);
  }

  playJump() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const src = this._noiseSource();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(500, now);
    bp.frequency.exponentialRampToValueAtTime(2400, now + 0.16);
    bp.Q.value = 1.1;
    const g = this._env(src, { attack: 0.004, decay: 0.2, peak: 0.16 });
    src.connect(bp).connect(g).connect(this.sfx);
    src.start(now);
    src.stop(now + 0.26);
    const thump = ctx.createOscillator();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(180, now);
    thump.frequency.exponentialRampToValueAtTime(90, now + 0.12);
    const tg = this._env(thump, { attack: 0.004, decay: 0.12, peak: 0.1 });
    tg.connect(this.sfx);
    thump.start(now);
    thump.stop(now + 0.16);
  }

  playLand(strength = 1) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150 * (0.8 + strength * 0.3), now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.16);
    const g = this._env(osc, { attack: 0.003, decay: 0.16, peak: 0.16 * strength });
    g.connect(this.sfx);
    osc.start(now);
    osc.stop(now + 0.2);
    this.playFootstep(0.5);
  }

  playFootstep(vol = 0.2) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const src = this._noiseSource();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1300 + Math.random() * 700;
    bp.Q.value = 1.4;
    const g = this._env(src, { attack: 0.003, decay: 0.06, peak: vol });
    src.connect(bp).connect(g).connect(this.sfx);
    src.start(now);
    src.stop(now + 0.1);
  }

  playEat() {
    if (!this.ready) return;
    for (let i = 0; i < 3; i++) {
      const ctx = this.ctx;
      const now = ctx.currentTime + i * 0.11;
      const src = this._noiseSource();
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 900 + i * 260;
      bp.Q.value = 2.4;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.2, now + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
      src.connect(bp).connect(g).connect(this.sfx);
      src.start(now);
      src.stop(now + 0.12);
    }
  }

  playPickup() {
    if (!this.ready) return;
    const ctx = this.ctx;
    [880, 1174, 1568].forEach((f, i) => {
      const now = ctx.currentTime + i * 0.06;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.1, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
      osc.connect(g).connect(this.sfx);
      osc.start(now);
      osc.stop(now + 0.3);
    });
  }

  playHurt() {
    if (!this.ready) return;
    this.playMeow({ pitch: 1.35, sad: true });
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const src = this._noiseSource();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 700;
    bp.Q.value = 0.8;
    const g = this._env(src, { attack: 0.003, decay: 0.18, peak: 0.3 });
    src.connect(bp).connect(g).connect(this.sfx);
    src.start(now);
    src.stop(now + 0.22);
  }

  playBark(pan = 0, count = 2) {
    if (!this.ready) return;
    const ctx = this.ctx;
    for (let i = 0; i < count; i++) {
      const now = ctx.currentTime + i * 0.19;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.1);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1400;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.16, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
      osc.connect(lp).connect(g).connect(this._panner(pan)).connect(this.sfx);
      osc.start(now);
      osc.stop(now + 0.2);
    }
  }

  playHorn(pan = 0) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    [420, 530].forEach((f) => {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = f;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1800;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.07, now + 0.02);
      g.gain.setValueAtTime(0.07, now + 0.16);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
      osc.connect(lp).connect(g).connect(this._panner(pan)).connect(this.sfx);
      osc.start(now);
      osc.stop(now + 0.34);
    });
  }

  playCarPass(pan = 0) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const src = this._noiseSource();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(260, now);
    bp.frequency.linearRampToValueAtTime(900, now + 0.25);
    bp.frequency.linearRampToValueAtTime(240, now + 0.7);
    bp.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.1, now + 0.18);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
    const pan2 = this._panner(pan);
    pan2.pan?.setValueAtTime?.(pan, now);
    src.connect(bp).connect(g).connect(pan2).connect(this.sfx);
    src.start(now);
    src.stop(now + 0.85);
  }

  playRummage() {
    if (!this.ready) return;
    const ctx = this.ctx;
    for (let i = 0; i < 3; i++) {
      const now = ctx.currentTime + i * 0.09;
      const src = this._noiseSource();
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 400 + Math.random() * 900;
      bp.Q.value = 1.8;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.09, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      src.connect(bp).connect(g).connect(this.sfx);
      src.start(now);
      src.stop(now + 0.14);
    }
  }

  playSiren() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const dur = 3.2 + Math.random() * 2;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const pan = Math.random() * 1.6 - 0.8;
    const panner = this._panner(pan);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1500;
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.linearRampToValueAtTime(940, now + dur * 0.4);
    osc.frequency.linearRampToValueAtTime(640, now + dur * 0.75);
    osc.frequency.linearRampToValueAtTime(860, now + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.05, now + 0.7);
    g.gain.setValueAtTime(0.05, now + dur - 0.8);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(lp).connect(g).connect(panner).connect(this.amb);
    osc.start(now);
    osc.stop(now + dur + 0.05);
  }

  playMotif(intensity = 0.6) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const scale = [392, 440, 523.25, 587.33, 659.25];
    const notes = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < notes; i++) {
      const f = scale[Math.floor(Math.random() * scale.length)];
      const now = ctx.currentTime + i * (0.34 + Math.random() * 0.2);
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.05 * intensity, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);
      osc.connect(g).connect(this.amb);
      osc.start(now);
      osc.stop(now + 1.7);
    }
  }

  playHeartbeat() {
    if (!this.ready) return;
    const ctx = this.ctx;
    [0, 0.22].forEach((offset, i) => {
      const now = ctx.currentTime + offset;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(72, now);
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.14);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(i ? 0.12 : 0.2, now + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      osc.connect(g).connect(this.sfx);
      osc.start(now);
      osc.stop(now + 0.2);
    });
  }

  playUi(kind = 'blip') {
    if (!this.ready) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = kind === 'confirm' ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(kind === 'confirm' ? 660 : 440, now);
    osc.frequency.exponentialRampToValueAtTime(kind === 'confirm' ? 990 : 520, now + 0.07);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.09, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    osc.connect(g).connect(this.sfx);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  playSleep() {
    if (!this.ready) return;
    this.playPurr();
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(330, now + 1.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.045, now + 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 2);
    osc.connect(g).connect(this.amb);
    osc.start(now);
    osc.stop(now + 2.1);
  }

  playDeath() {
    if (!this.ready) return;
    this.playMeow({ pitch: 1.2, sad: true });
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(330, now + 0.3);
    osc.frequency.exponentialRampToValueAtTime(110, now + 1.8);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now + 0.3);
    g.gain.linearRampToValueAtTime(0.09, now + 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 2);
    osc.connect(g).connect(this.amb);
    osc.start(now + 0.3);
    osc.stop(now + 2.1);
  }
}

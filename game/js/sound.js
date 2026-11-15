'use strict';
/* Sound: every effect and the background tune are synthesized here with Web Audio. No audio files. */

const SFX = (() => {
  let ctx = null, master = null, musicGain = null, timer = null, nextBeat = 0, step = 0, last = 3;
  const pref = k => { try { return localStorage.getItem(k) !== 'off'; } catch (e) { return true; } };
  const save = (k, on) => { try { localStorage.setItem(k, on ? 'on' : 'off'); } catch (e) { /* ignore */ } };
  let soundOn = pref('ashen-sound'), musicOn = pref('ashen-music');

  function unlock() {
    if (typeof AUTO !== 'undefined' && AUTO) return false;
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
        ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
        musicGain = ctx.createGain(); musicGain.gain.value = 0.16; musicGain.connect(master);
      }
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    } catch (e) { return false; }
  }
  function tone(freq, dur, o = {}) {
    const t = ctx.currentTime + (o.at || 0), osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'triangle'; osc.frequency.setValueAtTime(freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.vol || 0.3, t + (o.attack || 0.008)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(o.dest || master); osc.start(t); osc.stop(t + dur + 0.03);
  }
  function noise(dur, o = {}) {
    const t = ctx.currentTime + (o.at || 0), n = Math.max(1, Math.floor(ctx.sampleRate * dur)), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = buf; f.type = o.filter || 'lowpass'; f.frequency.value = o.freq || 800; f.Q.value = o.q || 0.8;
    g.gain.setValueAtTime(o.vol || 0.3, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master); src.start(t);
  }
  const seq = (notes, gap, dur, o = {}) => notes.forEach((f, i) => tone(f, dur, { ...o, at: (o.at || 0) + i * gap }));

  const SOUNDS = {
    select: () => seq([587, 784], 0.06, 0.09, { vol: 0.16 }),
    step: () => noise(0.07, { freq: 260, vol: 0.22 }),
    click: () => tone(440, 0.05, { vol: 0.12, type: 'square' }),
    dice: () => { for (let i = 0; i < 3; i++) noise(0.03, { at: i * 0.045, filter: 'highpass', freq: 2200, vol: 0.14 }); },
    hit: () => { noise(0.12, { filter: 'bandpass', freq: 1400, q: 2, vol: 0.32 }); tone(190, 0.12, { type: 'square', to: 90, vol: 0.14 }); },
    die: () => tone(280, 0.34, { type: 'sawtooth', to: 70, vol: 0.16 }),
    win: () => seq([523, 659, 784, 1047], 0.11, 0.28, { vol: 0.2 }),
    lose: () => seq([392, 349, 294, 220], 0.15, 0.36, { vol: 0.18, type: 'sawtooth' }),
    capture: () => { seq([392, 523, 659], 0.1, 0.24, { vol: 0.2 }); tone(784, 0.6, { at: 0.3, vol: 0.2 }); noise(0.25, { at: 0.3, freq: 500, vol: 0.14 }); },
    coin: () => seq([1319, 1760], 0.07, 0.14, { type: 'sine', vol: 0.16 }),
    build: () => { for (let i = 0; i < 3; i++) { noise(0.08, { at: i * 0.14, freq: 420, vol: 0.28 }); tone(120, 0.08, { at: i * 0.14, type: 'square', vol: 0.1 }); } },
    level: () => seq([523, 659, 784, 988, 1175], 0.07, 0.22, { type: 'sine', vol: 0.18 }),
    spell: () => { tone(440, 0.5, { type: 'sine', to: 1760, vol: 0.14 }); tone(660, 0.5, { type: 'sine', to: 2640, vol: 0.08, at: 0.05 }); },
    quest: () => seq([392, 494, 587], 0.12, 0.3, { vol: 0.18 }),
    ruin: () => { tone(98, 0.5, { type: 'sine', vol: 0.22 }); seq([784, 988, 1175], 0.1, 0.3, { at: 0.2, type: 'sine', vol: 0.14 }); },
    turn: () => { tone(523, 0.9, { type: 'sine', vol: 0.18 }); tone(784, 0.9, { type: 'sine', vol: 0.09 }); tone(1568, 0.5, { type: 'sine', vol: 0.03 }); },
    victory: () => { seq([392, 392, 523, 659, 784], 0.16, 0.32, { vol: 0.22 }); tone(1047, 1.2, { at: 0.8, vol: 0.22 }); tone(523, 1.2, { at: 0.8, vol: 0.14 }); },
    defeat: () => { seq([294, 262, 220, 196], 0.28, 0.6, { type: 'sawtooth', vol: 0.14 }); tone(73, 1.8, { at: 0.6, type: 'sine', vol: 0.26 }); },
  };
  let lastStep = 0;
  function play(name) {
    if (!soundOn || !SOUNDS[name] || !unlock() || ctx.state !== 'running') return;
    if (name === 'step') { const now = performance.now(); if (now - lastStep < 90) return; lastStep = now; }
    try { SOUNDS[name](); } catch (e) { /* audio is optional */ }
  }

  /* Background tune: a slow, wandering melody over a drone, made up as it goes (D dorian). */
  const SCALE = [293.66, 329.63, 349.23, 392.0, 440.0, 523.25, 587.33, 659.25], BEAT = 0.42;
  function scheduleMusic() {
    if (!ctx || ctx.state !== 'running') return;
    while (nextBeat < ctx.currentTime + 0.6) {
      const at = Math.max(0, nextBeat - ctx.currentTime), bar = step % 16;
      if (bar === 0) { tone(73.42, BEAT * 15, { type: 'sine', vol: 0.5, attack: 0.6, at, dest: musicGain }); tone(110, BEAT * 15, { type: 'sine', vol: 0.28, attack: 0.8, at, dest: musicGain }); }
      if (bar % 4 === 0) tone(146.83 * (bar === 8 ? 1.5 : 1), BEAT * 3, { type: 'triangle', vol: 0.3, at, dest: musicGain });
      if (Math.random() < (bar % 2 === 0 ? 0.8 : 0.35)) {
        last = Math.max(0, Math.min(SCALE.length - 1, last + [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)]));
        if (bar === 15) last = 0;
        tone(SCALE[last], BEAT * 2.4, { type: 'triangle', vol: 0.4, at, dest: musicGain });
        tone(SCALE[last] * 2, BEAT * 1.2, { type: 'sine', vol: 0.06, at, dest: musicGain });
      }
      nextBeat += BEAT; step++;
    }
  }
  function startMusic() {
    if (!musicOn || timer || !unlock()) return;
    nextBeat = ctx.currentTime + 0.2; timer = setInterval(scheduleMusic, 150);
  }
  function stopMusic() { if (timer) { clearInterval(timer); timer = null; } }

  return {
    play, unlock, startMusic, stopMusic,
    get soundOn() { return soundOn; }, get musicOn() { return musicOn; },
    toggleSound() { soundOn = !soundOn; save('ashen-sound', soundOn); if (soundOn) play('click'); return soundOn; },
    toggleMusic() { musicOn = !musicOn; save('ashen-music', musicOn); if (musicOn) startMusic(); else stopMusic(); return musicOn; },
  };
})();

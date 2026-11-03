/* =====================================================================
   SOUND — a soft romantic music-box melody generated live with the
   Web Audio API (no audio files needed), plus the countdown heartbeats
   and the dramatic curtain-reveal swell. If an mp3 is set in data.js
   (or uploaded in the Photo Studio) it plays instead of the melody.
   ===================================================================== */
(function () {
  let ctx = null, master, musicBus, sfxBus, reverb;
  let schedulerId = null, nextBarTime = 0, bar = 0;
  let playing = false;
  let customAudio = null;

  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

  // D major · I – vi – IV – V  (D, Bm, G, A) with a gentle melody
  const CHORDS = [
    { bass: 38, pad: [50, 54, 57, 62], arp: [74, 78, 81, 86] }, // D
    { bass: 35, pad: [47, 50, 54, 59], arp: [71, 74, 78, 83] }, // Bm
    { bass: 31, pad: [43, 47, 50, 55], arp: [67, 71, 74, 79] }, // G
    { bass: 33, pad: [45, 49, 52, 57], arp: [69, 73, 76, 81] }  // A
  ];
  const MELODY = [ // [beat, midi, length-in-beats] per bar, cycling over 8 bars
    [[0, 78, 1.5], [1.5, 76, .5], [2, 74, 2]],
    [[0, 74, 1], [1, 76, 1], [2, 78, 1], [3, 81, 1]],
    [[0, 79, 1.5], [1.5, 78, .5], [2, 76, 2]],
    [[0, 76, 1], [1, 78, 1], [2, 79, 1], [3, 76, 1]],
    [[0, 78, 1.5], [1.5, 79, .5], [2, 81, 2]],
    [[0, 83, 1], [1, 81, 1], [2, 78, 2]],
    [[0, 79, 1], [1, 78, 1], [2, 76, 1], [3, 74, 1]],
    [[0, 76, 2], [2, 73, 1], [3, 76, 1]]
  ];
  const BEAT = 60 / 68; // 68 bpm

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 3;
    master.connect(comp).connect(ctx.destination);

    reverb = ctx.createConvolver();
    reverb.buffer = impulse(3.2, 2.6);
    const wet = ctx.createGain(); wet.gain.value = 0.55;
    reverb.connect(wet).connect(master);

    musicBus = ctx.createGain(); musicBus.gain.value = 0;
    musicBus.connect(master); musicBus.connect(reverb);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9;
    sfxBus.connect(master); sfxBus.connect(reverb);
    return ctx;
  }

  function impulse(seconds, decay) {
    const rate = ctx.sampleRate, len = rate * seconds;
    const buf = ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  function tone(freq, t, dur, { type = "sine", gain = 0.1, attack = 0.01, release = 0.4, dest = musicBus, detune = 0 } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq; o.detune.value = detune;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.setTargetAtTime(0, t + Math.max(attack, dur), release / 4);
    o.connect(g).connect(dest);
    o.start(t); o.stop(t + dur + release + 0.1);
  }

  function bell(freq, t, gain = 0.08, dest = musicBus) {
    // music-box / bell timbre from inharmonic partials
    [[1, 1, 1.6], [2.01, 0.35, 0.9], [3.0, 0.12, 0.6], [5.4, 0.05, 0.3]].forEach(([ratio, amp, len]) => {
      tone(freq * ratio, t, 0.02, { gain: gain * amp, attack: 0.004, release: len * 2.2, dest });
    });
  }

  function scheduleBar(t, i) {
    const ch = CHORDS[i % 4];
    // warm pad
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1100; lp.connect(musicBus);
    ch.pad.forEach((n, k) => {
      tone(midi(n), t, BEAT * 4, { type: "triangle", gain: 0.022, attack: 1.4, release: 2.4, dest: lp, detune: k % 2 ? 6 : -6 });
    });
    tone(midi(ch.bass), t, BEAT * 3.5, { type: "sine", gain: 0.07, attack: 0.08, release: 1.4 });
    // music-box arpeggio on eighths
    const pattern = [0, 1, 2, 3, 2, 1, 2, 3];
    pattern.forEach((p, k) => bell(midi(ch.arp[p] - 12), t + k * BEAT / 2, 0.028));
    // melody
    MELODY[i % 8].forEach(([b, n, len]) => bell(midi(n), t + b * BEAT, 0.075));
  }

  function scheduler() {
    while (nextBarTime < ctx.currentTime + 1.2) {
      scheduleBar(nextBarTime, bar++);
      nextBarTime += BEAT * 4;
    }
  }

  function setCustom(src) {
    if (customAudio) { customAudio.pause(); customAudio = null; }
    if (src) {
      customAudio = new Audio(src);
      customAudio.loop = true;
      customAudio.volume = 0.7;
    }
  }

  const Sound = {
    setCustomMusic: setCustom,
    get playing() { return playing; },

    async play() {
      if (customAudio) {
        try { await customAudio.play(); playing = true; } catch (e) { playing = false; }
        return playing;
      }
      if (!ensure()) return false;
      if (ctx.state === "suspended") await ctx.resume();
      if (!schedulerId) {
        nextBarTime = ctx.currentTime + 0.15; bar = 0;
        scheduler();
        schedulerId = setInterval(scheduler, 250);
      }
      musicBus.gain.cancelScheduledValues(ctx.currentTime);
      musicBus.gain.setTargetAtTime(1, ctx.currentTime, 0.8);
      playing = true;
      return true;
    },

    pause() {
      playing = false;
      if (customAudio) { customAudio.pause(); return; }
      if (!ctx) return;
      musicBus.gain.cancelScheduledValues(ctx.currentTime);
      musicBus.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
      setTimeout(() => { if (!playing && schedulerId) { clearInterval(schedulerId); schedulerId = null; } }, 1500);
    },

    duck(level = 0.15, seconds = 1) {
      if (customAudio) { fadeEl(customAudio, 0.7 * level, seconds); return; }
      if (!ctx || !playing) return;
      musicBus.gain.cancelScheduledValues(ctx.currentTime);
      musicBus.gain.setTargetAtTime(level, ctx.currentTime, seconds / 3);
    },
    unduck(seconds = 2) { Sound.duck(1, seconds); },

    unlock() { const c = ensure(); if (c && c.state === "suspended") c.resume(); },

    /* countdown heartbeat */
    tick(final = false) {
      if (!ensure()) return;
      const t = ctx.currentTime + 0.01;
      const thump = (when, f0, g) => {
        const o = ctx.createOscillator(), gg = ctx.createGain();
        o.frequency.setValueAtTime(f0, when);
        o.frequency.exponentialRampToValueAtTime(42, when + 0.35);
        gg.gain.setValueAtTime(g, when);
        gg.gain.exponentialRampToValueAtTime(0.001, when + 0.45);
        o.connect(gg).connect(sfxBus); o.start(when); o.stop(when + 0.5);
      };
      thump(t, final ? 150 : 120, final ? 0.75 : 0.55);
      thump(t + 0.22, final ? 120 : 95, final ? 0.45 : 0.3);
      bell(midi(final ? 86 : 81), t, 0.04, sfxBus);
    },

    /* curtain swell + celebratory chord */
    reveal() {
      if (!ensure()) return;
      const t = ctx.currentTime + 0.05;
      // rising shimmer of filtered noise
      const len = ctx.sampleRate * 4;
      const nb = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = nb.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource(); src.buffer = nb;
      const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 1.4;
      bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(5200, t + 3.2);
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0, t); ng.gain.linearRampToValueAtTime(0.16, t + 2.8); ng.gain.linearRampToValueAtTime(0, t + 3.6);
      src.connect(bp).connect(ng).connect(sfxBus); src.start(t); src.stop(t + 4);
      // timpani roll
      for (let k = 0; k < 22; k++) {
        const when = t + k * 0.12;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.setValueAtTime(70, when); o.frequency.exponentialRampToValueAtTime(48, when + 0.3);
        g.gain.setValueAtTime(0.04 + k * 0.012, when); g.gain.exponentialRampToValueAtTime(0.001, when + 0.35);
        o.connect(g).connect(sfxBus); o.start(when); o.stop(when + 0.4);
      }
      // rising strings-like chord
      [50, 57, 62, 66, 69].forEach((n, i) => {
        tone(midi(n), t + 0.3, 2.9, { type: "sawtooth", gain: 0.012, attack: 2.6, release: 0.5, dest: sfxBus, detune: i * 3 });
      });
      // the big moment: bright D major bloom + sparkle arpeggio
      const hit = t + 3.2;
      [38, 50, 57, 62, 66, 69, 74].forEach((n) => tone(midi(n), hit, 3.5, { type: "triangle", gain: 0.05, attack: 0.02, release: 4, dest: sfxBus }));
      [74, 78, 81, 86, 90, 93, 98].forEach((n, i) => bell(midi(n), hit + i * 0.09, 0.07, sfxBus));
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(90, hit); o.frequency.exponentialRampToValueAtTime(40, hit + 0.8);
      g.gain.setValueAtTime(0.9, hit); g.gain.exponentialRampToValueAtTime(0.001, hit + 1.2);
      o.connect(g).connect(sfxBus); o.start(hit); o.stop(hit + 1.3);
    },

    chime() {
      if (!ensure()) return;
      const t = ctx.currentTime + 0.02;
      [81, 86, 90].forEach((n, i) => bell(midi(n), t + i * 0.08, 0.05, sfxBus));
    }
  };

  function fadeEl(el, to, seconds) {
    const from = el.volume, start = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - start) / (seconds * 1000));
      el.volume = from + (to - from) * k;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  Sound.unduck = (s = 2) => { if (customAudio) fadeEl(customAudio, 0.7, s); else Sound.duck(1, s); };

  window.Sound = Sound;
})();

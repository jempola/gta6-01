// Synthesized WebAudio sound effects and a simple music loop. No audio files, no
// network: every sound is built from oscillators and filtered noise. The context is
// created lazily on the first user gesture (browsers block audio before that), and
// every call is guarded so the game keeps working when audio is unavailable.

export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    enabled: true,
    musicTimer: 0,
    musicStep: 0,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
  };

  function ensure() {
    if (audio.ctx) return audio.ctx;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audio.ctx = new Ctx();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = 0.35;
      audio.master.connect(audio.ctx.destination);
    } catch {
      audio.ctx = null;
    }
    return audio.ctx;
  }

  function tone(freq, dur, type, vol, slideTo) {
    const ctx = ensure();
    if (!ctx || !audio.enabled) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ctx.currentTime + dur);
      gain.gain.setValueAtTime(vol || 0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(audio.master);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch {
      // Sound is garnish; never let it break the game.
    }
  }

  function noise(dur, vol, filterFreq) {
    const ctx = ensure();
    if (!ctx || !audio.enabled) return;
    try {
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq || 1200;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol || 0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(audio.master);
      src.start();
    } catch {
      // Ignore audio failures.
    }
  }

  return {
    state: audio,
    /** Call from a user gesture (start button) so the context may run. */
    unlock() {
      const ctx = ensure();
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    shot() {
      noise(0.12, 0.5, 2600);
      tone(180, 0.08, 'square', 0.18, 60);
    },
    punch() {
      noise(0.08, 0.3, 500);
    },
    pickup() {
      tone(660, 0.09, 'sine', 0.25);
      tone(990, 0.12, 'sine', 0.22);
    },
    cash() {
      tone(880, 0.08, 'sine', 0.22);
      tone(1320, 0.14, 'sine', 0.2);
    },
    explosion() {
      noise(0.7, 0.7, 400);
      tone(90, 0.6, 'sine', 0.4, 30);
    },
    sirenBlip() {
      tone(700, 0.18, 'sine', 0.12, 950);
    },
    missionDone() {
      tone(523, 0.12, 'triangle', 0.25);
      tone(659, 0.12, 'triangle', 0.25);
      tone(784, 0.22, 'triangle', 0.25);
    },
    fail() {
      tone(220, 0.3, 'sawtooth', 0.2, 110);
    },
    click() {
      tone(440, 0.05, 'sine', 0.15);
    },
    /** Continuous engine hum whose pitch follows the car's speed (0..1). */
    engine(amount) {
      const ctx = ensure();
      if (!ctx || !audio.enabled) return;
      try {
        if (!audio.engineOsc) {
          audio.engineOsc = ctx.createOscillator();
          audio.engineGain = ctx.createGain();
          audio.engineOsc.type = 'sawtooth';
          audio.engineGain.gain.value = 0;
          audio.engineOsc.connect(audio.engineGain);
          audio.engineGain.connect(audio.master);
          audio.engineOsc.start();
        }
        const target = amount > 0.02 ? 0.05 + amount * 0.06 : 0;
        audio.engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
        audio.engineOsc.frequency.setTargetAtTime(50 + amount * 130, ctx.currentTime, 0.1);
      } catch {
        // Ignore.
      }
    },
    /** Two-tone siren that wails while any wanted level is active. */
    siren(on) {
      const ctx = ensure();
      if (!ctx || !audio.enabled) return;
      try {
        if (on && !audio.sirenOsc) {
          audio.sirenOsc = ctx.createOscillator();
          audio.sirenGain = ctx.createGain();
          audio.sirenOsc.type = 'sine';
          audio.sirenOsc.frequency.value = 750;
          audio.sirenGain.gain.value = 0.045;
          const lfo = ctx.createOscillator();
          lfo.frequency.value = 0.7;
          const lfoGain = ctx.createGain();
          lfoGain.gain.value = 220;
          lfo.connect(lfoGain);
          lfoGain.connect(audio.sirenOsc.frequency);
          audio.sirenOsc.connect(audio.sirenGain);
          audio.sirenGain.connect(audio.master);
          audio.sirenOsc.start();
          lfo.start();
          audio._sirenLfo = lfo;
        } else if (!on && audio.sirenOsc) {
          try { audio.sirenOsc.stop(); } catch { /* already stopped */ }
          try { if (audio._sirenLfo) audio._sirenLfo.stop(); } catch { /* already stopped */ }
          audio.sirenOsc = null;
          audio._sirenLfo = null;
        }
      } catch {
        // Ignore.
      }
    },
    /** A laid-back bassline loop; call every frame with dt. */
    updateMusic(dt, playing) {
      if (!playing) return;
      const ctx = ensure();
      if (!ctx || !audio.enabled) return;
      audio.musicTimer -= dt;
      if (audio.musicTimer > 0) return;
      audio.musicTimer = 0.26;
      const scale = [55, 55, 65.4, 55, 82.4, 73.4, 65.4, 49];
      const note = scale[audio.musicStep % scale.length];
      audio.musicStep += 1;
      tone(note, 0.24, 'triangle', 0.16);
      if (audio.musicStep % 4 === 0) tone(note * 2, 0.1, 'sine', 0.08);
    },
  };
}

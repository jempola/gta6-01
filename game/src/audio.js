// Synthesized WebAudio sound: no audio files, everything is oscillators and
// filtered noise built at run time. Music is a simple looping bassline + hats.
export function createAudio() {
  let ctx = null, master = null, engineOsc = null, engineGain = null, sirenOsc = null, sirenGain = null;
  let musicTimer = null, muted = false, musicOn = false, beat = 0;
  let engineLevel = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 55;
      engineGain = ctx.createGain(); engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass'; engineFilter.frequency.value = 320;
      engineOsc.connect(engineFilter); engineFilter.connect(engineGain); engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine'; sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain); sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch { return false; }
  }

  function noiseBurst(duration, filterFreq, gainValue) {
    if (!ctx || muted) return;
    try {
      const len = Math.floor(ctx.sampleRate * duration);
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource(); src.buffer = buffer;
      const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = filterFreq;
      const gain = ctx.createGain(); gain.gain.value = gainValue;
      src.connect(filter); filter.connect(gain); gain.connect(master);
      src.start();
    } catch { /* sound is optional */ }
  }

  function tone(freq, duration, type, gainValue, slideTo) {
    if (!ctx || muted) return;
    try {
      const osc = ctx.createOscillator(); osc.type = type || 'square'; osc.frequency.value = freq;
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + duration);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(gainValue || 0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain); gain.connect(master);
      osc.start(); osc.stop(ctx.currentTime + duration);
    } catch { /* sound is optional */ }
  }

  function startMusic() {
    if (!ctx || musicTimer || musicOn) return;
    musicOn = true;
    const bassline = [55, 0, 55, 65.4, 55, 0, 82.4, 73.4];
    musicTimer = window.setInterval(() => {
      if (muted || !ctx) return;
      const note = bassline[beat % bassline.length];
      if (note) tone(note, 0.22, 'triangle', 0.10);
      if (beat % 2 === 0) noiseBurst(0.03, 6000, 0.03);
      beat += 1;
    }, 240);
  }

  return {
    unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {}); startMusic(); },
    setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.5; },
    isMuted() { return muted; },
    shot() { noiseBurst(0.12, 2400, 0.35); tone(180, 0.08, 'square', 0.12, 60); },
    punch() { noiseBurst(0.08, 900, 0.25); },
    explosion() { noiseBurst(0.7, 500, 0.5); tone(70, 0.5, 'sine', 0.3, 30); },
    pickup() { tone(660, 0.1, 'sine', 0.14); tone(880, 0.14, 'sine', 0.14); },
    cash() { tone(988, 0.09, 'sine', 0.14); tone(1319, 0.16, 'sine', 0.14); },
    mission() { tone(523, 0.12, 'triangle', 0.15); tone(659, 0.12, 'triangle', 0.15); tone(784, 0.2, 'triangle', 0.15); },
    fail() { tone(220, 0.25, 'sawtooth', 0.12, 110); },
    siren(on) { if (sirenGain) sirenGain.gain.value = on && !muted ? 0.035 : 0; },
    sirenWail(t) { if (sirenOsc) sirenOsc.frequency.value = 650 + Math.sin(t * 3.2) * 220; },
    setEngine(speedRatio, driving) {
      engineLevel = driving ? 0.05 + speedRatio * 0.09 : 0.012;
      if (engineGain && engineOsc) {
        engineGain.gain.value = muted ? 0 : engineLevel;
        engineOsc.frequency.value = 48 + speedRatio * 130;
      }
    },
  };
}

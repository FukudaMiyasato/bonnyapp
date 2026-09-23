/* Audio de Bonny: sonido de pase de página + música de piano nostálgica (generada en vivo). */
window.BonnyAudio = (() => {
  let ctx = null;
  let out = null;       // bus maestro
  let flipBuffer = null;

  function ensure() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) {
      ctx = new AC();
      out = ctx.createGain();
      out.gain.value = 1;
      out.connect(ctx.destination);
      flipBuffer = makeFlipBuffer();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  /* ---------- Pase de página ---------- */

  // Ruido "papel": ráfaga con textura crujiente + golpecito final de la hoja al caer
  function makeFlipBuffer() {
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * 0.55);
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    let crinkle = 1;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      if (i % Math.floor(sr * 0.004) === 0) crinkle = 0.45 + Math.random() * 0.55;
      let env;
      if (t < 0.06) env = t / 0.06;
      else if (t < 0.3) env = 1 - ((t - 0.06) / 0.24) * 0.7;
      else env = 0.3 * Math.exp(-(t - 0.3) * 18);
      const slap = t > 0.3 ? 0.9 * Math.exp(-(t - 0.3) * 60) : 0;
      d[i] = (Math.random() * 2 - 1) * (env * crinkle + slap);
    }
    return buf;
  }

  function playFlip(strength = 1) {
    if (!ctx || !flipBuffer) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = flipBuffer;
    src.playbackRate.value = 0.9 + Math.random() * 0.2;

    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.Q.value = 0.7;
    band.frequency.setValueAtTime(1100, t);
    band.frequency.linearRampToValueAtTime(3200, t + 0.14);
    band.frequency.exponentialRampToValueAtTime(900, t + 0.42);

    const gain = ctx.createGain();
    gain.gain.value = 0.55 * strength;

    src.connect(band).connect(gain).connect(out);
    src.start(t);
  }

  /* ---------- Música: piano nostálgico y alegre ---------- */

  const BPM = 74;
  const BEAT = 60 / BPM;
  const BAR = BEAT * 4;

  // Progresión tipo canon en Do mayor: C – G/B – Am – Em/G – F – C/E – Dm7 – G
  const CHORDS = [
    { bass: 48, tones: [55, 60, 64] },
    { bass: 47, tones: [55, 59, 62] },
    { bass: 45, tones: [52, 57, 60] },
    { bass: 43, tones: [52, 55, 59] },
    { bass: 41, tones: [53, 57, 60] },
    { bass: 40, tones: [55, 60, 64] },
    { bass: 38, tones: [53, 57, 60] },
    { bass: 43, tones: [55, 59, 62] },
  ];

  // Melodías: [nota midi | null (silencio), duración en tiempos]
  const E5 = 76, F5 = 77, G5 = 79, A5 = 81, B5 = 83, C6 = 84, D6 = 86;
  const C5 = 72, D5 = 74, B4 = 71;
  const MELODY_A = [
    [[E5, 1], [G5, 1], [C6, 1.5], [B5, 0.5]],
    [[B5, 1], [G5, 1], [D5, 2]],
    [[C6, 1], [A5, 1], [E5, 1.5], [G5, 0.5]],
    [[G5, 1], [E5, 1], [B4, 2]],
    [[A5, 1], [C6, 1], [F5, 1.5], [E5, 0.5]],
    [[E5, 1], [G5, 1], [C5, 2]],
    [[F5, 1], [A5, 0.5], [G5, 0.5], [F5, 1], [D5, 1]],
    [[D5, 1], [E5, 0.5], [F5, 0.5], [G5, 2]],
  ];
  const MELODY_B = [
    [[G5, 1.5], [E5, 0.5], [G5, 1], [C6, 1]],
    [[D6, 2], [B5, 2]],
    [[C6, 1.5], [B5, 0.5], [A5, 1], [E5, 1]],
    [[G5, 3], [null, 1]],
    [[A5, 1], [G5, 1], [F5, 1], [A5, 1]],
    [[G5, 1.5], [E5, 0.5], [C5, 2]],
    [[D5, 1], [F5, 1], [A5, 1], [C6, 1]],
    [[B5, 2], [G5, 1], [null, 1]],
  ];

  let pianoWave = null;
  let musicBus = null;
  let playing = false;
  let timer = null;
  let nextBarTime = 0;
  let barIndex = 0;

  const freq = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function makeReverb() {
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * 3);
    const ir = ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    const conv = ctx.createConvolver();
    conv.buffer = ir;
    return conv;
  }

  function setupMusic() {
    if (musicBus) return;
    // timbre de piano: fundamental + armónicos que decaen
    const real = new Float32Array([0, 1, 0.42, 0.16, 0.08, 0.035, 0.02]);
    pianoWave = ctx.createPeriodicWave(real, new Float32Array(real.length));

    musicBus = ctx.createGain();
    musicBus.gain.value = 0;

    const warm = ctx.createBiquadFilter(); // cinta vieja: agudos suaves
    warm.type = "lowpass";
    warm.frequency.value = 5200;

    const dry = ctx.createGain();
    dry.gain.value = 0.8;
    const wet = ctx.createGain();
    wet.gain.value = 0.42;
    const reverb = makeReverb();

    musicBus.connect(warm);
    warm.connect(dry).connect(out);
    warm.connect(reverb).connect(wet).connect(out);
  }

  function note(midi, time, velocity, length) {
    const f = freq(midi);
    const osc = ctx.createOscillator();
    osc.setPeriodicWave(pianoWave);
    osc.frequency.value = f;
    osc.detune.value = (Math.random() - 0.5) * 6; // piano ligeramente desafinado

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(Math.min(9000, f * 9), time);
    lp.frequency.exponentialRampToValueAtTime(Math.max(400, f * 2.2), time + 0.9);

    const g = ctx.createGain();
    const decay = midi < 60 ? 3.2 : 2.2;
    const end = time + Math.max(length, decay);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(velocity, time + 0.006);
    g.gain.exponentialRampToValueAtTime(velocity * 0.35, time + 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, end);

    osc.connect(lp).connect(g).connect(musicBus);
    osc.start(time);
    osc.stop(end + 0.05);
  }

  const human = () => (Math.random() - 0.5) * 0.018;

  function scheduleBar(i, t0) {
    const chord = CHORDS[i % 8];
    const melody = (Math.floor(i / 8) % 2 === 0 ? MELODY_A : MELODY_B)[i % 8];

    // mano izquierda: arpegio en corcheas
    const [a, b, c] = chord.tones;
    const arp = [chord.bass, a, b, c, a + 12, c, b, a];
    arp.forEach((m, k) => {
      const v = k === 0 ? 0.2 : 0.075 + Math.random() * 0.02;
      note(m, t0 + k * (BEAT / 2) + human(), v, BEAT);
    });

    // mano derecha: melodía
    let beat = 0;
    melody.forEach(([m, dur]) => {
      if (m !== null) note(m, t0 + beat * BEAT + human(), 0.14 + Math.random() * 0.03, dur * BEAT);
      beat += dur;
    });
  }

  function scheduler() {
    while (nextBarTime < ctx.currentTime + 0.4) {
      scheduleBar(barIndex, nextBarTime);
      nextBarTime += BAR;
      barIndex++;
    }
  }

  function startMusic() {
    if (!ensure() || playing) return;
    setupMusic();
    playing = true;
    const t = ctx.currentTime;
    musicBus.gain.cancelScheduledValues(t);
    musicBus.gain.setValueAtTime(musicBus.gain.value, t);
    musicBus.gain.linearRampToValueAtTime(0.5, t + 1.2);
    nextBarTime = t + 0.1;
    barIndex = 0;
    scheduler();
    timer = setInterval(scheduler, 100);
  }

  function stopMusic() {
    if (!ctx || !playing) return;
    playing = false;
    clearInterval(timer);
    const t = ctx.currentTime;
    musicBus.gain.cancelScheduledValues(t);
    musicBus.gain.setValueAtTime(musicBus.gain.value, t);
    musicBus.gain.linearRampToValueAtTime(0, t + 0.6);
  }

  return {
    unlock: ensure,
    playFlip,
    startMusic,
    stopMusic,
    get musicPlaying() { return playing; },
  };
})();

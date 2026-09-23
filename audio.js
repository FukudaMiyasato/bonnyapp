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

  /* ---------- Cámara: flash y polaroid imprimiendo ---------- */

  let noiseBuffer = null;
  function noise() {
    if (!noiseBuffer) {
      const len = ctx.sampleRate * 2;
      noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    return src;
  }

  // ráfaga de ruido filtrado con envolvente rápida
  function burst(t, { type = "bandpass", freq = 2000, q = 1, gain = 0.5, attack = 0.002, decay = 0.05 }) {
    const src = noise();
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random());
    src.stop(t + attack + decay + 0.05);
  }

  function playFlash() {
    if (!ensure()) return;
    const t = ctx.currentTime + 0.01;
    // obturador: clic-clac
    burst(t, { type: "highpass", freq: 3000, gain: 0.7, decay: 0.03 });
    burst(t + 0.07, { type: "bandpass", freq: 1400, q: 1.5, gain: 0.55, decay: 0.05 });
    // destello: soplido brillante
    burst(t + 0.01, { type: "highpass", freq: 5200, gain: 0.22, attack: 0.004, decay: 0.3 });
    // golpe grave del mecanismo
    const thump = ctx.createOscillator();
    const tg = ctx.createGain();
    thump.frequency.setValueAtTime(160, t);
    thump.frequency.exponentialRampToValueAtTime(60, t + 0.09);
    tg.gain.setValueAtTime(0.35, t);
    tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    thump.connect(tg).connect(out);
    thump.start(t);
    thump.stop(t + 0.12);
    // zumbido agudo de recarga del flash
    const whine = ctx.createOscillator();
    const wg = ctx.createGain();
    whine.frequency.setValueAtTime(1800, t + 0.15);
    whine.frequency.exponentialRampToValueAtTime(6200, t + 1.4);
    wg.gain.setValueAtTime(0.0001, t + 0.15);
    wg.gain.exponentialRampToValueAtTime(0.022, t + 0.3);
    wg.gain.exponentialRampToValueAtTime(0.0001, t + 1.45);
    whine.connect(wg).connect(out);
    whine.start(t + 0.15);
    whine.stop(t + 1.5);
  }

  function playPrint() {
    if (!ensure()) return;
    const t = ctx.currentTime + 0.01;
    const dur = 1.15;

    // motor que expulsa la foto
    const motor = ctx.createOscillator();
    motor.type = "sawtooth";
    motor.frequency.setValueAtTime(95, t);
    motor.frequency.linearRampToValueAtTime(128, t + 0.25);
    motor.frequency.linearRampToValueAtTime(122, t + dur);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 900;

    // engranajes: modulación rápida de amplitud
    const lfo = ctx.createOscillator();
    lfo.type = "square";
    lfo.frequency.value = 31;
    const depth = ctx.createGain();
    depth.gain.value = 0.35;
    const am = ctx.createGain(); // oscila entre 0.25 y 0.95
    am.gain.value = 0.6;
    lfo.connect(depth).connect(am.gain);
    const mg = ctx.createGain();
    mg.gain.setValueAtTime(0.0001, t);
    mg.gain.exponentialRampToValueAtTime(0.2, t + 0.04);
    mg.gain.setValueAtTime(0.2, t + dur - 0.08);
    mg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    motor.connect(lp).connect(am).connect(mg).connect(out);

    // roce del papel saliendo
    const paper = noise();
    const pf = ctx.createBiquadFilter();
    pf.type = "bandpass";
    pf.frequency.value = 2600;
    pf.Q.value = 2.5;
    const pg = ctx.createGain();
    pg.gain.setValueAtTime(0.0001, t);
    pg.gain.exponentialRampToValueAtTime(0.07, t + 0.1);
    pg.gain.setValueAtTime(0.07, t + dur - 0.1);
    pg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    paper.connect(pf).connect(pg).connect(out);

    motor.start(t); lfo.start(t); paper.start(t);
    motor.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05); paper.stop(t + dur + 0.05);

    // "clac" final cuando la foto termina de salir
    burst(t + dur, { type: "bandpass", freq: 900, q: 1.2, gain: 0.45, decay: 0.06 });
    burst(t + dur + 0.02, { type: "highpass", freq: 3500, gain: 0.25, decay: 0.03 });
  }

  /* ---------- Cofre ---------- */

  // bisagra de madera que cruje al abrir
  function playChestOpen() {
    if (!ensure()) return;
    const t = ctx.currentTime + 0.01;
    const creak = ctx.createOscillator();
    creak.type = "sawtooth";
    creak.frequency.setValueAtTime(190, t);
    creak.frequency.linearRampToValueAtTime(260, t + 0.18);
    creak.frequency.linearRampToValueAtTime(170, t + 0.45);
    // vibración irregular de la madera
    const wobble = ctx.createOscillator();
    wobble.frequency.value = 23;
    const wobbleDepth = ctx.createGain();
    wobbleDepth.gain.value = 35;
    wobble.connect(wobbleDepth).connect(creak.frequency);

    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1300;
    bp.Q.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    creak.connect(bp).connect(g).connect(out);
    creak.start(t); wobble.start(t);
    creak.stop(t + 0.55); wobble.stop(t + 0.55);
    // brillito mágico al abrirse
    [1568, 2093, 2637].forEach((f, i) => {
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.frequency.value = f;
      og.gain.setValueAtTime(0.0001, t + 0.25 + i * 0.07);
      og.gain.exponentialRampToValueAtTime(0.05, t + 0.26 + i * 0.07);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.9 + i * 0.07);
      o.connect(og).connect(out);
      o.start(t + 0.25 + i * 0.07);
      o.stop(t + 1 + i * 0.07);
    });
  }

  // tapa de madera que cae
  function playChestClose() {
    if (!ensure()) return;
    const t = ctx.currentTime + 0.01;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.18);
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.25);
    burst(t, { type: "lowpass", freq: 700, gain: 0.5, decay: 0.08 });
    burst(t + 0.005, { type: "bandpass", freq: 2200, q: 2, gain: 0.18, decay: 0.03 });
  }

  // cofre nuevo que aparece en la repisa
  function playPop() {
    if (!ensure()) return;
    const t = ctx.currentTime + 0.01;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(420, t);
    o.frequency.exponentialRampToValueAtTime(920, t + 0.09);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.2);
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
    playFlash,
    playPrint,
    playChestOpen,
    playChestClose,
    playPop,
    startMusic,
    stopMusic,
    get musicPlaying() { return playing; },
  };
})();

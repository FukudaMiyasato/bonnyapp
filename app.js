(() => {
  const root = document.querySelector(".onboarding");
  const stage = root.querySelector(".stage");
  const videos = [...stage.querySelectorAll("video.src")];
  const copies = [...root.querySelectorAll(".copy__item")];
  const dots = [...root.querySelectorAll(".dot")];
  const startBtn = root.querySelector(".btn-start");
  const total = videos.length;

  const DURATION = 900;   // ms de un pase completo
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  /* ---------- Bloqueo de zoom (iOS ignora user-scalable=no) ---------- */

  ["gesturestart", "gesturechange", "gestureend"].forEach((t) =>
    document.addEventListener(t, (e) => e.preventDefault(), { passive: false })
  );
  document.addEventListener("touchmove", (e) => {
    if (e.touches.length > 1 || (e.scale && e.scale !== 1)) e.preventDefault();
  }, { passive: false });
  let lastTouchEnd = 0;
  document.addEventListener("touchend", (e) => {
    const now = Date.now();
    if (now - lastTouchEnd < 300) e.preventDefault(); // doble toque
    lastTouchEnd = now;
  }, { passive: false });
  document.addEventListener("dblclick", (e) => e.preventDefault());

  /* ---------- Sonido de pase de página (sintetizado) ---------- */

  let audioCtx = null;
  let flipBuffer = null;

  function unlockAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!audioCtx) {
      audioCtx = new AC();
      flipBuffer = makeFlipBuffer(audioCtx);
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
  }

  // Ruido "papel": ráfaga con textura crujiente + golpecito final de la hoja al caer
  function makeFlipBuffer(ctx) {
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
      // golpecito cuando la hoja se asienta
      const slap = t > 0.3 ? 0.9 * Math.exp(-(t - 0.3) * 60) : 0;
      d[i] = (Math.random() * 2 - 1) * (env * crinkle + slap);
    }
    return buf;
  }

  function playFlip(strength = 1) {
    if (!audioCtx || !flipBuffer) return;
    const t = audioCtx.currentTime;
    const src = audioCtx.createBufferSource();
    src.buffer = flipBuffer;
    src.playbackRate.value = 0.9 + Math.random() * 0.2;

    const band = audioCtx.createBiquadFilter();
    band.type = "bandpass";
    band.Q.value = 0.7;
    band.frequency.setValueAtTime(1100, t);
    band.frequency.linearRampToValueAtTime(3200, t + 0.14);
    band.frequency.exponentialRampToValueAtTime(900, t + 0.42);

    const gain = audioCtx.createGain();
    gain.gain.value = 0.55 * strength;

    src.connect(band).connect(gain).connect(audioCtx.destination);
    src.start(t);
  }

  /* ---------- Mitades dibujadas desde los videos ---------- */

  const $ = (sel) => stage.querySelector(sel);
  const views = {
    left:  { el: $(".half--left"),  canvas: $(".half--left canvas"),  shade: $(".half--left .shade") },
    right: { el: $(".half--right"), canvas: $(".half--right canvas"), shade: $(".half--right .shade") },
    front: { el: $(".face--front"), canvas: $(".face--front canvas"), shade: $(".face--front .shade") },
    back:  { el: $(".face--back"),  canvas: $(".face--back canvas"),  shade: $(".face--back .shade") },
  };
  const leaf = $(".leaf");
  Object.values(views).forEach((v) => {
    v.ctx = v.canvas.getContext("2d", { alpha: false });
    v.src = null; // { page, side: "L" | "R" }
  });

  let W = 0, H = 0;
  function resize() {
    W = stage.clientWidth;
    H = stage.clientHeight;
    Object.values(views).forEach((v) => {
      v.canvas.width = Math.round((W / 2) * DPR);
      v.canvas.height = Math.round(H * DPR);
    });
  }

  function drawView(v) {
    if (!v.src) return;
    const video = videos[v.src.page];
    if (video.readyState < 2 || !video.videoWidth) return;
    const vw = video.videoWidth, vh = video.videoHeight;
    const scale = Math.max(W / vw, H / vh);          // object-fit: cover
    const ox = (W - vw * scale) / 2;
    const oy = (H - vh * scale) / 2;
    const x0 = v.src.side === "L" ? 0 : W / 2;
    v.ctx.drawImage(
      video,
      (x0 - ox) / scale, -oy / scale, (W / 2) / scale, H / scale,
      0, 0, v.canvas.width, v.canvas.height
    );
  }

  /* ---------- Motor del pliegue ---------- */

  let step = 0;
  // flip = { from, to, dir, p, anim: { p0, p1, t0, dur, ease } | null, dragging }
  let flip = null;

  const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);

  function setStatic(page) {
    views.left.src = { page, side: "L" };
    views.right.src = { page, side: "R" };
    views.left.shade.style.opacity = 0;
    views.right.shade.style.opacity = 0;
    leaf.style.visibility = "hidden";
    leaf.style.transform = "";
  }

  function beginFlip(dir) {
    const to = step + dir;
    if (to < 0 || to >= total) return null;
    const from = step;
    if (dir > 0) {
      // la mitad derecha se dobla hacia la izquierda
      views.left.src  = { page: from, side: "L" };
      views.right.src = { page: to,   side: "R" };
      views.front.src = { page: from, side: "R" };
      views.back.src  = { page: to,   side: "L" };
      leaf.classList.remove("is-back");
    } else {
      // la mitad izquierda se dobla hacia la derecha
      views.left.src  = { page: to,   side: "L" };
      views.right.src = { page: from, side: "R" };
      views.front.src = { page: from, side: "L" };
      views.back.src  = { page: to,   side: "R" };
      leaf.classList.add("is-back");
    }
    drawView(views.front);
    drawView(views.back);
    leaf.style.visibility = "visible";
    flip = { from, to, dir, p: 0, anim: null, dragging: false };
    applyFlip();
    return flip;
  }

  function applyFlip() {
    const { p, dir } = flip;
    const angle = 180 * p * (dir > 0 ? -1 : 1);
    // la hoja se levanta un poco al pasar por el medio
    const lift = Math.sin(Math.PI * p) * 30;
    leaf.style.transform = `translateZ(${lift}px) rotateY(${angle}deg)`;

    const revealed = dir > 0 ? views.right : views.left;
    const covered = dir > 0 ? views.left : views.right;
    revealed.shade.style.opacity = 0.75 * (1 - p) * Math.min(1, p * 6);
    covered.shade.style.opacity = p > 0.5 ? 0.6 * Math.sin(Math.PI * p) : 0;
    views.front.shade.style.opacity = Math.min(1, p * 2) * 0.85;
    views.back.shade.style.opacity = Math.min(1, (1 - p) * 2) * 0.85;
  }

  function animateTo(target, ease = easeInOut) {
    const dist = Math.abs(target - flip.p);
    flip.anim = {
      p0: flip.p, p1: target, t0: performance.now(),
      dur: Math.max(220, DURATION * dist), ease,
    };
  }

  function endFlip() {
    const done = flip.p >= 1;
    if (done) step = flip.to;
    setStatic(step);
    flip = null;
    renderUI();
  }

  function goTo(next) {
    if (flip || next === step || next < 0 || next >= total) return;
    beginFlip(next > step ? 1 : -1);
    setUI(flip.to);
    playFlip();
    animateTo(1);
  }

  /* ---------- Textos, puntos y botón ---------- */

  function setUI(s) {
    root.dataset.step = s;
    copies.forEach((c, i) => c.classList.toggle("is-active", i === s));
    dots.forEach((d, i) => d.setAttribute("aria-selected", String(i === s)));
    startBtn.tabIndex = s === total - 1 ? 0 : -1;
  }
  const renderUI = () => setUI(step);

  /* ---------- Bucle de dibujo ---------- */

  function frame(now) {
    if (flip && flip.anim) {
      const a = flip.anim;
      const x = Math.min(1, (now - a.t0) / a.dur);
      flip.p = a.p0 + (a.p1 - a.p0) * a.ease(x);
      applyFlip();
      if (x >= 1) {
        flip.anim = null;
        endFlip();
      }
    }
    drawView(views.left);
    drawView(views.right);
    if (flip) {
      drawView(views.front);
      drawView(views.back);
    }
    requestAnimationFrame(frame);
  }

  /* ---------- Arrastre con el dedo ---------- */

  let drag = null; // { x0, y0, id, lastX, lastT, v, active }

  root.addEventListener("pointerdown", (e) => {
    unlockAudio();
    videos.forEach((v) => v.paused && v.play().catch(() => {}));
    if (flip) return;
    drag = { x0: e.clientX, y0: e.clientY, id: e.pointerId, lastX: e.clientX, lastT: e.timeStamp, v: 0, active: false };
  });

  root.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x0;
    const dy = e.clientY - drag.y0;

    if (!drag.active) {
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
      if (!beginFlip(dx < 0 ? 1 : -1)) { drag = null; return; }
      flip.dragging = true;
      drag.active = true;
      root.setPointerCapture?.(e.pointerId);
    }

    const dt = Math.max(1, e.timeStamp - drag.lastT);
    drag.v = (e.clientX - drag.lastX) / dt;
    drag.lastX = e.clientX;
    drag.lastT = e.timeStamp;

    const travel = W * 0.8;
    flip.p = Math.max(0, Math.min(1, (-dx * flip.dir) / travel));
    applyFlip();
  });

  function release(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const wasActive = drag.active;
    const v = drag.v;
    const onStage = stage.contains(e.target) || e.target === stage;
    drag = null;

    if (!wasActive) {
      // toque simple sobre el video: siguiente página
      if (e.type === "pointerup" && onStage) goTo(step + 1);
      return;
    }

    flip.dragging = false;
    const flick = -v * flip.dir; // velocidad a favor del pase
    const complete = flip.p > 0.4 || (flick > 0.35 && flip.p > 0.04);
    if (complete) {
      setUI(flip.to);
      playFlip(0.6 + 0.4 * (1 - flip.p));
      animateTo(1, easeOut);
    } else {
      animateTo(0, easeOut);
    }
  }
  root.addEventListener("pointerup", release);
  root.addEventListener("pointercancel", release);

  /* ---------- Otros controles ---------- */

  dots.forEach((d) => d.addEventListener("click", () => { unlockAudio(); goTo(Number(d.dataset.go)); }));

  document.addEventListener("keydown", (e) => {
    unlockAudio();
    if (e.key === "ArrowRight") goTo(step + 1);
    if (e.key === "ArrowLeft") goTo(step - 1);
  });

  startBtn.addEventListener("click", () => {
    root.dispatchEvent(new CustomEvent("onboarding:done", { bubbles: true }));
  });

  // Asegura el loop (iOS a veces pausa videos al volver a la app)
  videos.forEach((v) => {
    v.muted = true;
    v.play().catch(() => {});
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) videos.forEach((v) => v.play().catch(() => {}));
  });

  window.addEventListener("resize", resize);
  resize();
  setStatic(step);
  renderUI();
  requestAnimationFrame(frame);
})();

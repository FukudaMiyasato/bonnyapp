(() => {
  const root = document.querySelector(".onboarding");
  const stage = root.querySelector(".stage");
  const videos = [...stage.querySelectorAll("video.src")];
  const copies = [...root.querySelectorAll(".copy__item")];
  const dots = [...root.querySelectorAll(".dot")];
  const startBtn = root.querySelector(".btn-start");
  const musicBtn = document.querySelector(".music");
  const audio = window.BonnyAudio;
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

  /* ---------- Música de fondo + notas flotantes ---------- */

  const MUSIC_KEY = "bonny:music";
  const IPOD_KEY = "bonny:ipod"; // interruptor de "música" en la página de la tuerca
  let musicOn = true;
  let ipodOn = true;
  try {
    musicOn = localStorage.getItem(MUSIC_KEY) !== "0";
    ipodOn = localStorage.getItem(IPOD_KEY) !== "0";
  } catch (_) {}
  musicBtn.hidden = !ipodOn;
  const canPlay = () => ipodOn && musicOn;

  function setMusic(on) {
    musicOn = on;
    try { localStorage.setItem(MUSIC_KEY, on ? "1" : "0"); } catch (_) {}
    musicBtn.setAttribute("aria-pressed", String(on));
    musicBtn.setAttribute("aria-label", on ? "Pausar música" : "Reproducir música");
    if (on) audio.startMusic();
    else audio.stopMusic();
  }

  // La música arranca con el primer toque (los navegadores no permiten audio antes)
  document.addEventListener("pointerdown", (e) => {
    audio.unlock();
    if (canPlay() && !audio.musicPlaying && !musicBtn.contains(e.target)) audio.startMusic();
  }, true);

  /* --- el botón se puede arrastrar; tras 10 s sin tocarlo se achica --- */

  const POS_KEY = "bonny:music-pos";
  const IDLE_MS = 10000;
  let idleTimer = null;
  let dragBtn = null;
  let swallowClick = false;

  function resetIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => musicBtn.classList.add("is-small"), IDLE_MS);
  }

  // coloca el botón (en px del viewport) sin que se salga de la pantalla
  function placeBtn(x, y) {
    const w = musicBtn.offsetWidth, h = musicBtn.offsetHeight;
    x = Math.max(4, Math.min(window.innerWidth - w - 4, x));
    y = Math.max(4, Math.min(window.innerHeight - h - 4, y));
    Object.assign(musicBtn.style, { left: x + "px", top: y + "px", right: "auto" });
    return { x, y };
  }

  try {
    const pos = JSON.parse(localStorage.getItem(POS_KEY));
    if (pos) placeBtn(pos.fx * window.innerWidth, pos.fy * window.innerHeight);
  } catch (_) {}
  window.addEventListener("resize", () => {
    if (!musicBtn.style.left) return;
    const r = musicBtn.getBoundingClientRect();
    placeBtn(r.left, r.top);
  });

  musicBtn.addEventListener("pointerdown", (e) => {
    try { musicBtn.setPointerCapture(e.pointerId); } catch (_) {}
    const r = musicBtn.getBoundingClientRect();
    dragBtn = { id: e.pointerId, x0: e.clientX, y0: e.clientY, ox: e.clientX - r.left, oy: e.clientY - r.top, moved: false };
    clearTimeout(idleTimer);
  });
  musicBtn.addEventListener("pointermove", (e) => {
    if (!dragBtn || e.pointerId !== dragBtn.id) return;
    if (!dragBtn.moved && Math.hypot(e.clientX - dragBtn.x0, e.clientY - dragBtn.y0) < 8) return;
    if (!dragBtn.moved) {
      dragBtn.moved = true;
      musicBtn.classList.add("is-dragging");
      musicBtn.classList.remove("is-small"); // al tomarlo recupera su tamaño
    }
    placeBtn(e.clientX - dragBtn.ox, e.clientY - dragBtn.oy);
  });
  function endBtnDrag(e) {
    if (!dragBtn || e.pointerId !== dragBtn.id) return;
    if (dragBtn.moved) {
      // queda donde lo sueltas (se recuerda para la próxima vez)
      const r = musicBtn.getBoundingClientRect();
      const p = placeBtn(r.left, r.top);
      try { localStorage.setItem(POS_KEY, JSON.stringify({ fx: p.x / window.innerWidth, fy: p.y / window.innerHeight })); } catch (_) {}
      musicBtn.classList.remove("is-dragging");
      swallowClick = true;
      setTimeout(() => (swallowClick = false), 60);
    }
    dragBtn = null;
    resetIdle();
  }
  musicBtn.addEventListener("pointerup", endBtnDrag);
  musicBtn.addEventListener("pointercancel", endBtnDrag);

  musicBtn.addEventListener("click", () => {
    if (swallowClick) return;
    // achicado: el toque solo lo devuelve a su tamaño
    if (musicBtn.classList.contains("is-small")) {
      musicBtn.classList.remove("is-small");
      resetIdle();
      return;
    }
    // si estaba "encendida" pero aún no sonaba, el primer toque la inicia
    if (musicOn && !audio.musicPlaying) setMusic(true);
    else setMusic(!musicOn);
    resetIdle();
  });
  musicBtn.setAttribute("aria-pressed", String(musicOn));
  resetIdle();

  /* --- el iPod se puede quitar desde la página de la tuerca --- */

  async function setIpod(on) {
    if (on === ipodOn) return;
    ipodOn = on;
    try { localStorage.setItem(IPOD_KEY, on ? "1" : "0"); } catch (_) {}
    audio.unlock();
    audio.playPop();
    if (on) {
      musicBtn.hidden = false;
      musicBtn.classList.remove("is-small");
      musicBtn.animate(
        [
          { transform: "scale(0) rotate(-25deg)", opacity: 0 },
          { transform: "scale(1.25) rotate(8deg)", opacity: 1, offset: 0.6 },
          { transform: "scale(0.92) rotate(-3deg)", offset: 0.8 },
          { transform: "scale(1) rotate(0)" },
        ],
        { duration: 520, easing: "ease-out" }
      );
      if (musicOn) audio.startMusic();
      resetIdle();
    } else {
      // se infla, gira y desaparece con un "pop"
      audio.stopMusic();
      clearTimeout(idleTimer);
      const anim = musicBtn.animate(
        [
          { transform: getComputedStyle(musicBtn).transform === "none" ? "scale(1)" : getComputedStyle(musicBtn).transform, opacity: 1 },
          { transform: "scale(1.3) rotate(10deg)", opacity: 1, offset: 0.35 },
          { transform: "scale(0) rotate(-30deg)", opacity: 0 },
        ],
        { duration: 380, easing: "cubic-bezier(0.5, 0, 0.7, 0.4)", fill: "forwards" }
      );
      popBurst();
      await new Promise((r) => setTimeout(r, 380));
      if (!ipodOn) musicBtn.hidden = true;
      anim.cancel();
    }
  }

  // chispas que salen del iPod al desaparecer
  function popBurst() {
    const r = musicBtn.getBoundingClientRect();
    for (let i = 0; i < 10; i++) {
      const p = document.createElement("span");
      p.className = "note";
      p.textContent = i % 3 ? "✦" : GLYPHS[i % GLYPHS.length] + "\uFE0E";
      p.style.color = NOTE_COLORS[i % NOTE_COLORS.length];
      p.style.fontSize = 10 + Math.random() * 10 + "px";
      p.style.left = r.left + r.width / 2 + "px";
      p.style.top = r.top + r.height / 2 + "px";
      document.body.appendChild(p);
      const a = (i / 10) * Math.PI * 2;
      const d = 40 + Math.random() * 30;
      p.animate(
        [
          { transform: "translate(-50%, -50%) scale(0.3)", opacity: 1 },
          { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(1)`, opacity: 0 },
        ],
        { duration: 600, easing: "ease-out", fill: "forwards" }
      );
      setTimeout(() => p.remove(), 650);
    }
  }

  window.BonnyMusic = { setIpod, get ipodOn() { return ipodOn; } };

  const GLYPHS = ["♪", "♫", "♬", "♩"];
  const NOTE_COLORS = ["#cc6450", "#fbf4ee", "#e8a25c", "#cc6450"];

  function emitNote() {
    const r = musicBtn.getBoundingClientRect();
    const n = document.createElement("span");
    n.className = "note";
    n.textContent = GLYPHS[(Math.random() * GLYPHS.length) | 0] + "︎";
    n.style.color = NOTE_COLORS[(Math.random() * NOTE_COLORS.length) | 0];
    const size = 14 + Math.random() * 12;
    n.style.fontSize = size + "px";
    n.style.left = r.left + r.width * 0.4 + "px";
    n.style.top = r.top + r.height * 0.35 + "px";
    document.body.appendChild(n);

    // salen hacia el centro de la pantalla (según dónde esté el botón), ondulando
    const toLeft = r.left + r.width / 2 > window.innerWidth / 2;
    const toDown = r.top + r.height / 2 < window.innerHeight / 2;
    const dx = (toLeft ? -1 : 1) * (60 + Math.random() * 90);
    const dy = (toDown ? 1 : -1) * (20 + Math.random() * 90);
    const sway = 10 + Math.random() * 14;
    const rot = (Math.random() - 0.5) * 50;
    n.animate([
      { transform: "translate(0, 0) scale(0.4) rotate(0deg)", opacity: 0 },
      { transform: `translate(${dx * 0.3}px, ${dy * 0.25 - sway}px) scale(1) rotate(${rot * 0.4}deg)`, opacity: 1, offset: 0.2 },
      { transform: `translate(${dx * 0.65}px, ${dy * 0.6 + sway}px) scale(1.05) rotate(${-rot * 0.5}deg)`, opacity: 0.85, offset: 0.6 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.9) rotate(${rot}deg)`, opacity: 0 },
    ], { duration: 2200 + Math.random() * 900, easing: "ease-out" }).onfinish = () => n.remove();
  }

  (function noteLoop() {
    // las notas salen solo mientras la música está sonando
    if (audio.musicPlaying && !document.hidden) emitNote();
    setTimeout(noteLoop, 380 + Math.random() * 320);
  })();

  /* ---------- Textos letra por letra ---------- */

  // Parte cada texto en palabras (para no cortar al saltar de línea) y letras
  function splitChars(el, state, stepMs) {
    [...el.childNodes].forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        splitChars(node, state, stepMs);
        return;
      }
      if (node.nodeType !== Node.TEXT_NODE) return;
      const frag = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
        const w = document.createElement("span");
        w.className = "w";
        for (const ch of part) {
          const c = document.createElement("span");
          c.className = "ch";
          c.textContent = ch;
          c.style.setProperty("--d", Math.round(state.t) + "ms");
          state.t += stepMs;
          w.appendChild(c);
        }
        frag.appendChild(w);
      });
      node.replaceWith(frag);
    });
  }

  window.BonnySplitChars = splitChars; // lo reutiliza la escena del baúl

  copies.forEach((item) => {
    const state = { t: 180 }; // espera a que el texto anterior se desvanezca
    splitChars(item.querySelector("h1"), state, 26);
    state.t += 60;
    splitChars(item.querySelector("p"), state, 11);
  });

  /* ---------- Mitades dibujadas desde los videos ---------- */

  const $ = (sel) => stage.querySelector(sel);
  const views = {
    left:  { canvas: $(".half--left canvas"),  shade: $(".half--left .shade") },
    right: { canvas: $(".half--right canvas"), shade: $(".half--right .shade") },
    front: { canvas: $(".face--front canvas"), shade: $(".face--front .shade") },
    back:  { canvas: $(".face--back canvas"),  shade: $(".face--back .shade") },
  };
  const leaf = $(".leaf");
  Object.values(views).forEach((v) => {
    v.ctx = v.canvas.getContext("2d");
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
  let stopped = false; // true al salir del onboarding
  // flip = { from, to, dir, p, anim: { p0, p1, t0, dur, ease } | null }
  let flip = null;

  const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);

  function setStatic(page) {
    // el video de la página actual queda arriba (respaldo mientras el canvas no dibuja)
    videos.forEach((v, i) => (v.style.zIndex = i === page ? 1 : 0));
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
    flip = { from, to, dir, p: 0, anim: null };
    applyFlip();
    return flip;
  }

  function applyFlip() {
    const { p, dir } = flip;
    const angle = 180 * p * (dir > 0 ? -1 : 1);
    // la hoja se levanta un poco al pasar por el medio
    const lift = Math.sin(Math.PI * p) * 40;
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
    if (flip.p >= 1) step = flip.to;
    setStatic(step);
    flip = null;
    setUI(step);
  }

  function goTo(next) {
    if (stopped || flip || next === step || next < 0 || next >= total) return;
    beginFlip(next > step ? 1 : -1);
    setUI(flip.to);
    audio.playFlip();
    animateTo(1);
  }

  /* ---------- Textos, puntos y botón ---------- */

  let shownStep = -1;
  function setUI(s) {
    root.dataset.step = s;
    dots.forEach((d, i) => d.setAttribute("aria-selected", String(i === s)));
    startBtn.tabIndex = s === total - 1 ? 0 : -1;
    if (s === shownStep) return; // no reiniciar la animación de letras
    shownStep = s;
    copies.forEach((c, i) => c.classList.toggle("is-active", i === s));
  }

  /* ---------- Bucle de dibujo ---------- */

  function frame(now) {
    if (stopped) return;
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

  /* ---------- Arrastre con el dedo (en toda la pantalla) ---------- */

  let drag = null; // { x0, y0, id, lastX, lastT, v, active }

  root.addEventListener("pointerdown", (e) => {
    if (stopped) return;
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
      drag.active = true;
      try { root.setPointerCapture(e.pointerId); } catch (_) {}
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
    drag = null;

    if (!wasActive) {
      // toque simple fuera de los botones: siguiente página
      if (e.type === "pointerup" && !e.target.closest("button")) goTo(step + 1);
      return;
    }

    const flick = -v * flip.dir; // velocidad a favor del pase
    const complete = flip.p > 0.4 || (flick > 0.35 && flip.p > 0.04);
    if (complete) {
      setUI(flip.to);
      audio.playFlip(0.6 + 0.4 * (1 - flip.p));
      animateTo(1, easeOut);
    } else {
      animateTo(0, easeOut);
    }
  }
  root.addEventListener("pointerup", release);
  root.addEventListener("pointercancel", release);

  /* ---------- Otros controles ---------- */

  dots.forEach((d) => d.addEventListener("click", () => goTo(Number(d.dataset.go))));

  document.addEventListener("keydown", (e) => {
    audio.unlock();
    if (e.key === "ArrowRight") goTo(step + 1);
    if (e.key === "ArrowLeft") goTo(step - 1);
  });

  // si ya hay miembros de la familia, la app entra directo a los baúles
  document.addEventListener("bonny:skip-onboarding", () => {
    stopped = true;
    videos.forEach((v) => v.pause());
    root.style.display = "none";
  });

  startBtn.addEventListener("click", () => {
    if (stopped) return;
    stopped = true;
    root.dispatchEvent(new CustomEvent("onboarding:done", { bubbles: true }));
    // libera recursos cuando termina la transición
    setTimeout(() => videos.forEach((v) => v.pause()), 1400);
  });

  // Asegura el loop (iOS a veces pausa videos al volver a la app)
  videos.forEach((v) => {
    v.muted = true;
    v.play().catch(() => {});
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      audio.stopMusic();
    } else {
      if (!stopped) videos.forEach((v) => v.play().catch(() => {}));
      if (canPlay()) audio.startMusic();
    }
  });

  window.addEventListener("resize", resize);
  resize();
  setStatic(step);
  setUI(step);
  requestAnimationFrame(frame);
})();

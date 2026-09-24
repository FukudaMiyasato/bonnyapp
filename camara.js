/* Cámara del morral (foto, video y grabadora) + vista previa.
   En modo foto se pueden agregar integrantes con IA. */
(() => {
  const data = window.BonnyData;
  const audio = window.BonnyAudio;
  const flying = document.querySelector(".flying");
  const flashEl = document.querySelector(".flash");
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // proporción de la ventana de la polaroid (863 x 759 px en la imagen del marco)
  const ASPECT = 863 / 759;
  const MAX_W = 1168;
  const MAX_SECONDS = { video: 60, audio: 180 };

  /* ================= Cámara ================= */

  const cam = document.querySelector(".camara");
  const video = cam.querySelector(".camara__video");
  const exitBtn = cam.querySelector(".camara__exit");
  const shutter = cam.querySelector(".camara__shutter");
  const switchBtn = cam.querySelector(".camara__switch");
  const fileInput = cam.querySelector(".camara__file");
  const timerEl = cam.querySelector(".camara__timer");
  const wave = cam.querySelector(".camara__wave");
  const waveCtx = wave.getContext("2d");

  let mode = "foto";          // "foto" | "video" | "audio"
  let stream = null;
  let facing = "environment"; // para fotos familiares, la cámara de atrás
  let camOpen = false;

  async function startCamera() {
    stopCamera();
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("sin getUserMedia");
      const wantsVideo = mode !== "audio";
      stream = await navigator.mediaDevices.getUserMedia({
        video: wantsVideo ? { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1920 } } : false,
        audio: mode !== "foto",
      });
      if (!camOpen) return stopCamera(); // se cerró mientras pedía permiso
      if (wantsVideo) {
        video.srcObject = stream;
        await video.play().catch(() => {});
      } else {
        startMeter();
      }
      cam.classList.remove("no-cam");
      cam.classList.toggle("is-user", facing === "user" && wantsVideo);
    } catch (err) {
      console.warn("Cámara no disponible:", err);
      stream = null;
      cam.classList.add("no-cam");
    }
  }

  function stopCamera() {
    stopMeter();
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    video.srcObject = null;
  }

  function openCamera(newMode = mode) {
    if (camOpen) return;
    mode = newMode;
    camOpen = true;
    cam.dataset.mode = mode;
    shutter.setAttribute("aria-label", mode === "foto" ? "Tomar foto" : "Grabar");
    fileInput.accept = mode === "foto" ? "image/*" : mode === "video" ? "video/*" : "audio/*";
    cam.querySelector(".camara__msg").textContent =
      mode === "audio" ? "no pudimos usar el micrófono" : "toca el botón para elegir " + (mode === "foto" ? "una foto" : "un video");
    cam.hidden = false;
    void cam.offsetWidth;
    cam.classList.add("is-in");
    audio.playTick();
    startCamera();
    data.ubicacion(); // pide la ubicación para escribirla en la foto
  }

  async function closeCamera(keepHidden = false) {
    camOpen = false;
    if (recorder) stopRecording(true);
    cam.classList.remove("is-in");
    stopCamera();
    await wait(450);
    cam.hidden = true;
    if (!keepHidden) {
      resumeMusic();
      document.dispatchEvent(new CustomEvent("bonny:chest", { detail: { open: false } }));
    }
  }

  document.addEventListener("bonny:camera", (e) => {
    document.dispatchEvent(new CustomEvent("bonny:chest", { detail: { open: true } })); // esconde la botonera
    openCamera(e.detail?.mode || "foto");
  });

  exitBtn.addEventListener("click", () => closeCamera());

  switchBtn.addEventListener("click", () => {
    if (recorder || mode === "audio") return;
    facing = facing === "user" ? "environment" : "user";
    switchBtn.classList.remove("is-spinning");
    void switchBtn.offsetWidth;
    switchBtn.classList.add("is-spinning");
    startCamera();
  });

  // recorte "cover" con la proporción de la polaroid
  function toCanvas(source, sw0, sh0, mirror = false) {
    let sw = sw0, sh = sw0 / ASPECT;
    if (sh > sh0) { sh = sh0; sw = sh0 * ASPECT; }
    const scale = Math.min(1, MAX_W / sw);
    const c = document.createElement("canvas");
    c.width = Math.round(sw * scale);
    c.height = Math.round(sh * scale);
    const g = c.getContext("2d");
    if (mirror) { g.translate(c.width, 0); g.scale(-1, 1); }
    g.drawImage(source, (sw0 - sw) / 2, (sh0 - sh) / 2, sw, sh, 0, 0, c.width, c.height);
    return c;
  }

  function flash() {
    flashEl.animate([{ opacity: 0 }, { opacity: 0.95, offset: 0.12 }, { opacity: 0 }], { duration: 520, easing: "ease-out" });
  }

  shutter.addEventListener("click", () => {
    if (!camOpen) return;
    if (mode !== "foto") return toggleRecording();
    if (!stream || video.readyState < 2) {
      fileInput.click(); // sin cámara: elegir una foto de la galería
      return;
    }
    audio.playFlash();
    flash();
    showPreview(toCanvas(video, video.videoWidth, video.videoHeight, facing === "user"));
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    fileInput.value = "";
    if (!file) return;
    if (mode !== "foto") return mediaReady(file, null, []);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      audio.playFlash();
      flash();
      showPreview(toCanvas(img, img.naturalWidth, img.naturalHeight));
    };
    img.src = URL.createObjectURL(file);
  });

  /* ---------- Grabar video o audio ---------- */

  let recorder = null;
  let chunks = [];
  let recStart = 0;
  let timerId = null;
  let levels = [];            // volumen durante la grabación (para dibujar la onda)
  let musicWasOn = false;

  const pickType = (list) => list.find((t) => window.MediaRecorder?.isTypeSupported?.(t)) || "";

  function pauseMusic() {
    musicWasOn = audio.musicPlaying;
    if (musicWasOn) audio.stopMusic(); // que la música no quede en la grabación
  }
  function resumeMusic() {
    if (musicWasOn) audio.startMusic();
    musicWasOn = false;
  }

  function toggleRecording() {
    if (recorder) return stopRecording();
    if (!stream || !window.MediaRecorder) {
      fileInput.click(); // sin cámara/micrófono: elegir un archivo
      return;
    }
    const type = mode === "video"
      ? pickType(["video/mp4;codecs=avc1,mp4a", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm"])
      : pickType(["audio/mp4", "audio/webm;codecs=opus", "audio/webm"]);
    pauseMusic();
    chunks = [];
    levels = [];
    recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: recorder?.mimeType || type || (mode === "video" ? "video/mp4" : "audio/mp4") });
      const secs = (performance.now() - recStart) / 1000;
      const discard = recorder?._discard;
      recorder = null;
      if (!discard) mediaReady(blob, secs, levels.slice());
    };
    recorder.start(250);
    recStart = performance.now();
    cam.classList.add("is-recording");
    audio.playTick();
    if (mode === "audio") startMeter();
    timerId = setInterval(tick, 200);
    tick();
  }

  function tick() {
    const secs = (performance.now() - recStart) / 1000;
    const m = Math.floor(secs / 60), sec = Math.floor(secs % 60);
    timerEl.textContent = `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    if (secs >= MAX_SECONDS[mode]) stopRecording();
  }

  function stopRecording(discard = false) {
    clearInterval(timerId);
    cam.classList.remove("is-recording");
    if (!recorder) return;
    recorder._discard = discard;
    if (recorder.state !== "inactive") recorder.stop();
    if (!discard) audio.playTick();
  }

  /* ---------- Medidor del micrófono (modo grabadora) ---------- */

  let meter = null;
  function startMeter() {
    if (meter || !stream || mode !== "audio") return;
    const ctx = audio.unlock();
    if (!ctx) return;
    const src = ctx.createMediaStreamSource(stream);
    const an = ctx.createAnalyser();
    an.fftSize = 1024;
    src.connect(an);
    const buf = new Uint8Array(an.fftSize);
    const history = [];
    const draw = () => {
      an.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += ((buf[i] - 128) / 128) ** 2;
      const rms = Math.min(1, Math.sqrt(sum / buf.length) * 4);
      history.push(rms);
      if (history.length > 60) history.shift();
      if (recorder) levels.push(rms);
      // barras redondeadas que se desplazan
      const W = wave.width, H = wave.height, bw = W / 60;
      waveCtx.clearRect(0, 0, W, H);
      waveCtx.fillStyle = recorder ? "#e0593b" : "#fbe6c8";
      history.forEach((v, i) => {
        const h = Math.max(6, v * H * 0.95);
        const x = i * bw + bw * 0.2, y = (H - h) / 2;
        waveCtx.beginPath();
        waveCtx.roundRect(x, y, bw * 0.6, h, bw * 0.3);
        waveCtx.fill();
      });
      meter.raf = requestAnimationFrame(draw);
    };
    meter = { src, an, raf: requestAnimationFrame(draw) };
  }
  function stopMeter() {
    if (!meter) return;
    cancelAnimationFrame(meter.raf);
    try { meter.src.disconnect(); } catch (_) {}
    meter = null;
    waveCtx.clearRect(0, 0, wave.width, wave.height);
  }

  /* ---------- Miniaturas (poster) de videos y audios ---------- */

  async function videoPoster(blob) {
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.src = URL.createObjectURL(blob);
    try {
      await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = rej; setTimeout(res, 3000); });
      v.currentTime = Math.min(0.3, (v.duration || 1) / 2);
      await new Promise((res) => { v.onseeked = res; setTimeout(res, 1500); });
      if (!v.videoWidth) throw new Error("sin cuadro");
      return toCanvas(v, v.videoWidth, v.videoHeight);
    } catch (_) {
      return waveCanvas([]);
    } finally {
      URL.revokeObjectURL(v.src);
    }
  }

  // tarjeta cálida con la onda de la grabación
  function waveCanvas(lv) {
    const c = document.createElement("canvas");
    c.width = MAX_W;
    c.height = Math.round(MAX_W / ASPECT);
    const g = c.getContext("2d");
    const grad = g.createLinearGradient(0, 0, c.width, c.height);
    grad.addColorStop(0, "#f7c98f");
    grad.addColorStop(1, "#d9774a");
    g.fillStyle = grad;
    g.fillRect(0, 0, c.width, c.height);
    const n = 48;
    const vals = Array.from({ length: n }, (_, i) => {
      if (!lv.length) return 0.25 + 0.5 * Math.abs(Math.sin(i * 0.7));
      const a = Math.floor((i / n) * lv.length), b = Math.max(a + 1, Math.floor(((i + 1) / n) * lv.length));
      return Math.max(0.08, Math.max(...lv.slice(a, b)));
    });
    const bw = (c.width * 0.8) / n;
    g.fillStyle = "rgba(90, 40, 18, 0.85)";
    vals.forEach((v, i) => {
      const h = v * c.height * 0.55;
      g.beginPath();
      g.roundRect(c.width * 0.1 + i * bw + bw * 0.2, (c.height - h) / 2, bw * 0.6, h, bw * 0.3);
      g.fill();
    });
    return c;
  }

  const canvasBlob = (c) => new Promise((r) => c.toBlob(r, "image/jpeg", 0.88));

  /* ================= Vista previa ================= */

  const pv = document.querySelector(".preview");
  const photoBox = pv.querySelector(".preview__photo");
  const cardBox = pv.querySelector(".preview__card");
  const status = pv.querySelector(".preview__status");
  const membersRow = pv.querySelector(".preview__members");
  const playBtn = pv.querySelector(".preview__play");
  const saveBtn = pv.querySelector(".preview__save");
  const discardBtn = pv.querySelector(".preview__discard");

  let photo = null;      // canvas actual (foto, o miniatura de video/audio)
  let media = null;      // { blob, url, secs } para video y audio
  let player = null;     // <video> o <audio> de la vista previa
  let compuesta = false;
  let placeText = null;
  let busy = false;
  const creado = () => new Date().toISOString();
  let shotDate = creado();

  function renderCard() {
    cardBox.innerHTML = window.BonnyPolaroid.html(
      { tipo: "recuerdo", medio: "foto", foto: photo.toDataURL("image/jpeg", 0.9), ubicacion: placeText, creado: shotDate },
      0
    );
    // en video, la ventana de la polaroid reproduce el video
    if (mode === "video" && media) {
      const v = document.createElement("video");
      v.className = "mini__photo";
      v.src = media.url;
      v.loop = true;
      v.muted = true;
      v.playsInline = true;
      v.autoplay = true;
      cardBox.querySelector(".mini__photo").replaceWith(v);
      v.play().catch(() => {});
      player = v;
    }
  }

  const setPlayIcon = (on) => {
    playBtn.classList.toggle("is-playing", on);
    playBtn.textContent = mode === "video" ? (on ? "🔊" : "🔇") : on ? "❚❚" : "▶";
    playBtn.setAttribute("aria-label", mode === "video" ? (on ? "Quitar sonido" : "Activar sonido") : on ? "Pausar" : "Reproducir");
  };

  function preparePlayer() {
    playBtn.hidden = mode === "foto";
    if (mode === "audio" && media) {
      player = new Audio(media.url);
      player.onended = () => setPlayIcon(false);
    }
    setPlayIcon(false);
  }

  playBtn.addEventListener("click", () => {
    if (!player) return;
    if (mode === "video") {
      // el video ya se reproduce en silencio; el botón le da sonido
      player.muted = !player.muted;
      setPlayIcon(!player.muted);
      if (player.paused) player.play().catch(() => {});
      return;
    }
    if (player.paused) { player.play().catch(() => {}); setPlayIcon(true); }
    else { player.pause(); setPlayIcon(false); }
  });

  function stopPlayer() {
    if (player) { player.pause(); player.removeAttribute("src"); player.load?.(); }
    player = null;
    if (media?.url) URL.revokeObjectURL(media.url);
  }

  async function mediaReady(blob, secs, lv) {
    media = { blob, url: URL.createObjectURL(blob), secs, levels: lv };
    const poster = mode === "video" ? await videoPoster(blob) : waveCanvas(lv);
    showPreview(poster);
  }

  async function showPreview(canvas) {
    photo = canvas;
    if (mode === "foto") media = null;
    compuesta = false;
    usados.clear();
    placeText = null;
    shotDate = creado();
    pv.dataset.mode = mode;
    renderCard();
    preparePlayer();
    if (mode === "foto") renderMembers();
    // la ubicación llega un poco después: se escribe en la foto cuando esté
    data.ubicacion().then((p) => {
      if (p && photo === canvas) { placeText = p; if (mode === "foto") renderCard(); else cardPlace(p); }
    });

    pv.classList.remove("is-saving", "is-busy", "is-loading", "is-revealing");
    pv.hidden = false;
    void pv.offsetWidth;
    pv.classList.add("is-in");
    photoBox.animate(
      [
        { transform: "translateY(-30px) rotate(6deg) scale(1.12)", opacity: 0 },
        { transform: "translateY(6px) rotate(-3deg) scale(0.98)", opacity: 1, offset: 0.7 },
        { transform: "rotate(-2deg)", opacity: 1 },
      ],
      { duration: 700, delay: 150, easing: "cubic-bezier(0.25, 0.8, 0.3, 1)", fill: "backwards" }
    );
    setTimeout(() => audio.playPrint(), 250);
    await wait(500);
    closeCamera(true);
  }

  // escribe la ubicación sin volver a crear el video
  function cardPlace(p) {
    const cap = cardBox.querySelector(".mini__caption");
    if (!cap || cap.querySelector(".mini__place")) return;
    const span = document.createElement("span");
    span.className = "mini__place";
    span.textContent = p;
    cap.prepend(span);
  }

  async function hidePreview() {
    stopPlayer();
    pv.classList.remove("is-in");
    await wait(450);
    pv.hidden = true;
    cardBox.innerHTML = "";
    membersRow.innerHTML = "";
    photoBox.style.visibility = "";
  }

  discardBtn.addEventListener("click", async () => {
    if (busy) return;
    audio.playTick();
    media = null;
    openCamera(mode); // la cámara aparece debajo mientras la vista previa se va
    await hidePreview();
  });

  saveBtn.addEventListener("click", async () => {
    if (busy) return;
    busy = true;
    pv.classList.add("is-busy", "is-saving");
    if (player) player.pause();
    // la foto se levanta
    photoBox.animate(
      [{ transform: "rotate(-2deg)" }, { transform: "translateY(-14px) rotate(-1deg) scale(1.05)" }],
      { duration: 400, easing: "ease-out", fill: "forwards" }
    );

    let recuerdo;
    if (mode === "foto") {
      recuerdo = await data.agregarRecuerdo({ blob: await canvasBlob(photo), ubicacion: placeText, compuesta });
    } else {
      recuerdo = await data.agregarRecuerdo({
        blob: media.blob,
        poster: await canvasBlob(photo),
        medio: mode,
        ubicacion: placeText,
        duracion: media.secs,
      });
    }
    const baul = data.baulActivo || data.baules[data.baules.length - 1] || data.crearBaul();
    data.activarBaul(baul.id);
    data.guardarRecuerdoEnBaul(baul.id, recuerdo.id);
    await wait(450);

    // entra al baúl activo
    await window.BonnyShelves.receive(photoBox, baul.id);
    photoBox.getAnimations().forEach((a) => a.cancel());
    stopPlayer();
    media = null;
    pv.hidden = true;
    pv.classList.remove("is-in", "is-saving", "is-busy");
    cardBox.innerHTML = "";
    membersRow.innerHTML = "";
    photoBox.style.visibility = "";
    busy = false;
    resumeMusic();
    document.dispatchEvent(new CustomEvent("bonny:chest", { detail: { open: false } }));
  });

  /* ---------- integrantes que se pueden arrastrar a la foto ---------- */

  function familyMembers() {
    const activo = data.baulActivo;
    const ids = activo?.integrantes?.length ? activo.integrantes : data.integrantes.map((i) => i.id);
    return [...new Set(ids)].map(data.integrante).filter(Boolean);
  }

  // miembros que ya se fusionaron en esta foto: no se pueden volver a agregar
  const usados = new Set();

  function renderMembers() {
    membersRow.innerHTML = "";
    const list = familyMembers();
    // ahora la fila va debajo del texto: usa todo el ancho
    const avail = membersRow.parentElement.clientWidth - 24;
    const w = Math.max(40, Math.min(70, avail / Math.max(1, list.length * 0.82 + 0.18)));
    list.forEach((m, i) => {
      const el = document.createElement("div");
      el.className = "pm";
      el.style.setProperty("--pm-w", w + "px");
      el.innerHTML = window.BonnyPolaroid.html(m, ((i % 2 ? 1 : -1) * (3 + Math.random() * 5)).toFixed(1));
      if (usados.has(m.id)) markUsed(el);
      el.addEventListener("pointerdown", (e) => startDrag(e, el, m));
      membersRow.appendChild(el);
    });
    pv.querySelector(".preview__family").style.display = list.length ? "" : "none";
  }

  let drag = null;

  function setDragTransform() {
    const { clone, dx, dy, scale } = drag;
    clone.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
  }

  function overPhoto(x, y) {
    const r = photoBox.getBoundingClientRect();
    const pad = 10;
    return x > r.left - pad && x < r.right + pad && y > r.top - pad && y < r.bottom + pad;
  }

  function markUsed(el) {
    el.classList.add("is-used");
    el.setAttribute("aria-disabled", "true");
    el.title = "ya está en la foto";
  }

  function startDrag(e, el, member) {
    if (busy || drag || usados.has(member.id)) return;
    e.preventDefault();
    try { el.setPointerCapture(e.pointerId); } catch (_) {}
    const r = el.getBoundingClientRect();
    const clone = document.createElement("div");
    clone.className = "fly is-lifted";
    Object.assign(clone.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px", transition: "transform 180ms ease" });
    clone.innerHTML = el.innerHTML;
    flying.appendChild(clone);
    el.style.visibility = "hidden";
    audio.playTick();

    drag = { el, member, clone, r, x0: e.clientX, y0: e.clientY, dx: 0, dy: -16, scale: 1.35, zoomed: false, id: e.pointerId };
    setDragTransform(); // se levanta
    setTimeout(() => { if (drag?.clone === clone && !drag.zoomed) clone.style.transition = ""; }, 200);
    // dejar presionado sin mover: la foto se acerca
    drag.timer = setTimeout(() => {
      if (!drag) return;
      drag.zoomed = true;
      drag.scale = 2.6;
      drag.dy = -drag.r.height * 1.1;
      clone.style.transition = "transform 280ms cubic-bezier(0.3, 1.4, 0.5, 1)";
      setDragTransform();
    }, 380);

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
  }

  function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const mx = e.clientX - drag.x0;
    const my = e.clientY - drag.y0;
    if (Math.hypot(mx, my) > 8) {
      clearTimeout(drag.timer);
      if (drag.zoomed) {
        // al moverse deja de estar acercada
        drag.zoomed = false;
        drag.scale = 1.35;
        const clone = drag.clone;
        clone.style.transition = "transform 150ms ease";
        setTimeout(() => (clone.style.transition = ""), 160);
      }
    }
    drag.dx = mx;
    drag.dy = my - (drag.zoomed ? drag.r.height * 1.1 : 16);
    setDragTransform();
    photoBox.classList.toggle("is-target", overPhoto(e.clientX, e.clientY));
  }

  function endListeners(el) {
    el.removeEventListener("pointermove", onMove);
    el.removeEventListener("pointerup", onUp);
    el.removeEventListener("pointercancel", onUp);
  }

  async function onUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    clearTimeout(d.timer);
    endListeners(d.el);
    const dropped = e.type === "pointerup" && overPhoto(e.clientX, e.clientY);
    photoBox.classList.remove("is-target");

    if (dropped) {
      addMember(d);
      return;
    }
    // si se suelta en otro lado, regresa a su lugar
    d.clone.style.transition = "transform 420ms cubic-bezier(0.3, 1.4, 0.5, 1)";
    d.clone.style.transform = "none";
    await wait(420);
    d.clone.remove();
    d.el.style.visibility = "";
  }

  /* ---------- agregar al integrante con IA ---------- */

  const MESSAGES = [
    "llamando a la familia",
    "haciéndole espacio",
    "acomodando a todos",
    "ajustando la luz",
    "esperando que sonría",
    "revelando la foto",
  ];
  let statusTimer = null;
  function startStatus() {
    let i = 0;
    const show = () => {
      status.classList.remove("is-shown");
      setTimeout(() => {
        status.textContent = MESSAGES[i++ % MESSAGES.length] + "…";
        status.classList.add("is-shown");
      }, 350);
    };
    show();
    statusTimer = setInterval(show, 2600);
  }
  function stopStatus(finalText) {
    clearInterval(statusTimer);
    status.classList.remove("is-shown");
    if (finalText) {
      setTimeout(() => {
        status.textContent = finalText;
        status.classList.add("is-shown");
        setTimeout(() => status.classList.remove("is-shown"), 2600);
      }, 350);
    }
  }

  async function addMember(d) {
    busy = true;
    pv.classList.add("is-busy", "is-loading");
    audio.playPop();

    // la mini se funde dentro de la foto
    const pr = photoBox.getBoundingClientRect();
    const cr = d.r;
    const tx = pr.left + pr.width / 2 - (cr.left + cr.width / 2);
    const ty = pr.top + pr.height * 0.38 - (cr.top + cr.height / 2);
    d.clone.style.transition = "transform 600ms cubic-bezier(0.5, 0, 0.3, 1), opacity 600ms ease";
    d.clone.style.transform = `translate(${tx}px, ${ty}px) scale(0.3) rotate(8deg)`;
    d.clone.style.opacity = "0";
    photoBox.animate(
      [{ transform: "rotate(-2deg) scale(1)" }, { transform: "rotate(-2deg) scale(1.03)" }, { transform: "rotate(-2deg) scale(1)" }],
      { duration: 700, delay: 350, easing: "ease-in-out" }
    );
    setTimeout(() => d.clone.remove(), 650);
    startStatus();

    try {
      const base = photo.toDataURL("image/jpeg", 0.86);
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 175000);
      const res = await fetch("/api/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base, member: d.member.foto }),
        signal: ctrl.signal,
      });
      clearTimeout(timeout);
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.image) throw new Error(json.error || `Error ${res.status}`);

      // la foto nueva reemplaza a la anterior con el mismo recorte
      const img = new Image();
      img.src = json.image;
      await img.decode();
      photo = toCanvas(img, img.naturalWidth, img.naturalHeight);
      compuesta = true;
      usados.add(d.member.id); // ya está en la foto
      stopStatus();
      pv.classList.remove("is-loading");
      renderCard();
      pv.classList.remove("is-revealing");
      void pv.offsetWidth;
      pv.classList.add("is-revealing");
      audio.playPrint();
      setTimeout(() => pv.classList.remove("is-revealing"), 1900);
    } catch (err) {
      console.warn("No se pudo agregar al integrante:", err);
      pv.classList.remove("is-loading");
      stopStatus("no pudimos agregarlo, intenta otra vez");
    }

    // el integrante vuelve a su lugar en la fila (en gris si ya quedó en la foto)
    if (usados.has(d.member.id)) markUsed(d.el);
    d.el.style.visibility = "";
    d.el.classList.remove("is-back");
    void d.el.offsetWidth;
    d.el.classList.add("is-back");
    pv.classList.remove("is-busy");
    busy = false;
  }
})();

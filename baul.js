/* Escena 2: "primer baúl" — tomar la foto familiar y separar a los integrantes. */
(() => {
  const onboarding = document.querySelector(".onboarding");
  const scene = document.querySelector(".baul");
  const bubble = scene.querySelector(".bubble");
  const cam = scene.querySelector(".cam");
  const win = scene.querySelector(".cam__window");
  const video = scene.querySelector(".cam__video");
  const shot = scene.querySelector(".cam__shot");
  const msg = scene.querySelector(".cam__msg");
  const shutter = scene.querySelector(".cam__shutter");
  const switchBtn = scene.querySelector(".cam__switch");
  const fileInput = scene.querySelector(".cam__file");
  const members = scene.querySelector(".members");
  const row = scene.querySelector(".members__row");
  const continueBtn = scene.querySelector(".btn-continue");
  const flashEl = document.querySelector(".flash");
  const audio = window.BonnyAudio;

  // proporción de la ventana del marco (863 x 759 px en la imagen)
  const WINDOW_ASPECT = 863 / 759;
  const MINI_W = 600; // suficiente para ampliar la foto con zoom
  const MINI_H = Math.round(MINI_W / WINDOW_ASPECT);

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ---------- Detección de personas y mascotas (MediaPipe, en el dispositivo) ---------- */

  const MP_VERSION = "1.0.1";
  const MP_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}`;
  const MODEL_URL =
    "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/int8/1/efficientdet_lite0.tflite";
  const SUBJECTS = ["person", "cat", "dog", "bird", "horse"];

  let detectorPromise = null;
  function loadDetector() {
    if (!detectorPromise) {
      detectorPromise = (async () => {
        const { FilesetResolver, ObjectDetector } = await import(`${MP_BASE}/vision_bundle.mjs`);
        const fileset = await FilesetResolver.forVisionTasks(`${MP_BASE}/wasm`);
        return ObjectDetector.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
          runningMode: "IMAGE",
          scoreThreshold: 0.35,
          maxResults: 12,
          categoryAllowlist: SUBJECTS,
        });
      })().catch((err) => {
        console.warn("Detector no disponible, se usará la foto completa", err);
        return null;
      });
    }
    return detectorPromise;
  }

  const iou = (a, b) => {
    const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y);
    const x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h);
    const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
    return inter / (a.w * a.h + b.w * b.h - inter);
  };

  // Devuelve los sujetos ordenados de izquierda a derecha
  async function detectSubjects(canvas) {
    const detector = await Promise.race([loadDetector(), wait(10000).then(() => null)]);
    if (!detector) return [];
    let result;
    try {
      result = detector.detect(canvas);
    } catch (err) {
      console.warn(err);
      return [];
    }
    const area = canvas.width * canvas.height;
    const boxes = result.detections
      .map((d) => ({
        label: d.categories[0].categoryName,
        score: d.categories[0].score,
        x: d.boundingBox.originX,
        y: d.boundingBox.originY,
        w: d.boundingBox.width,
        h: d.boundingBox.height,
      }))
      .filter((b) => (b.w * b.h) / area > 0.025) // ignora gente muy al fondo
      .sort((a, b) => b.score - a.score);

    const kept = [];
    boxes.forEach((b) => { if (kept.every((k) => iou(k, b) < 0.45)) kept.push(b); });
    return kept.slice(0, 8).sort((a, b) => a.x + a.w / 2 - (b.x + b.w / 2));
  }

  // Recorte enfocado en cada integrante, con la misma proporción del marco
  function cropSubject(src, b) {
    let cw, ch, cx, top;
    if (b.label === "person") {
      // cabeza y hombros: parte alta de la caja
      cw = b.w * 1.1;
      ch = cw / WINDOW_ASPECT;
      if (ch > b.h * 0.95) { ch = b.h * 0.95; cw = ch * WINDOW_ASPECT; }
      cx = b.x + b.w / 2;
      top = b.y - ch * 0.08;
    } else {
      cw = Math.max(b.w, b.h * WINDOW_ASPECT) * 1.12;
      ch = cw / WINDOW_ASPECT;
      cx = b.x + b.w / 2;
      top = b.y + b.h / 2 - ch / 2;
    }
    if (cw > src.width) { cw = src.width; ch = cw / WINDOW_ASPECT; }
    if (ch > src.height) { ch = src.height; cw = ch * WINDOW_ASPECT; }
    const left = Math.min(Math.max(0, cx - cw / 2), src.width - cw);
    top = Math.min(Math.max(0, top), src.height - ch);
    return drawTo(src, left, top, cw, ch);
  }

  function drawTo(src, sx, sy, sw, sh) {
    const c = document.createElement("canvas");
    c.width = MINI_W;
    c.height = MINI_H;
    c.getContext("2d").drawImage(src, sx, sy, sw, sh, 0, 0, MINI_W, MINI_H);
    return c;
  }

  /* ---------- Ubicación (ciudad, país) para escribirla en la foto ---------- */

  let placePromise = null;
  function loadPlace() {
    if (placePromise) return placePromise;
    placePromise = new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        async ({ coords }) => {
          try {
            // geocodificación inversa gratuita, sin clave
            const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${coords.latitude}&longitude=${coords.longitude}&localityLanguage=es`;
            const r = await (await fetch(url)).json();
            const city = r.city || r.locality || r.principalSubdivision;
            resolve([city, r.countryName].filter(Boolean).join(", ") || null);
          } catch (_) {
            resolve(null);
          }
        },
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60 * 1000 }
      );
    });
    return placePromise;
  }

  /* ---------- Cámara ---------- */

  let stream = null;
  let facing = "user";

  async function startCamera() {
    stopCamera();
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("sin getUserMedia");
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
      video.srcObject = stream;
      await video.play().catch(() => {});
      cam.classList.remove("no-cam");
      cam.classList.toggle("is-user", facing === "user");
    } catch (err) {
      console.warn("Cámara no disponible:", err);
      stream = null;
      cam.classList.add("no-cam");
      msg.textContent = "toca el botón para elegir una foto";
    }
  }

  function stopCamera() {
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
  }

  // Lo que se ve en la ventana (recorte "cover") pasa a un canvas
  function grabFrame() {
    const vw = video.videoWidth, vh = video.videoHeight;
    let sw = vw, sh = vw / WINDOW_ASPECT;
    if (sh > vh) { sh = vh; sw = vh * WINDOW_ASPECT; }
    const scale = Math.min(1, 1280 / sw);
    const c = document.createElement("canvas");
    c.width = Math.round(sw * scale);
    c.height = Math.round(sh * scale);
    const g = c.getContext("2d");
    if (facing === "user") { g.translate(c.width, 0); g.scale(-1, 1); } // igual que la vista previa
    g.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, c.width, c.height);
    return c;
  }

  function imageToCanvas(img) {
    const iw = img.naturalWidth, ih = img.naturalHeight;
    let sw = iw, sh = iw / WINDOW_ASPECT;
    if (sh > ih) { sh = ih; sw = ih * WINDOW_ASPECT; }
    const scale = Math.min(1, 1280 / sw);
    const c = document.createElement("canvas");
    c.width = Math.round(sw * scale);
    c.height = Math.round(sh * scale);
    c.getContext("2d").drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, 0, 0, c.width, c.height);
    return c;
  }

  /* ---------- Tomar la foto ---------- */

  const data = window.BonnyData;
  const photos = []; // fotos tomadas en esta sesión: { id, full: canvas, integrantes: id[] }
  let busy = false;

  function flash() {
    flashEl.animate(
      [{ opacity: 0 }, { opacity: 0.95, offset: 0.12 }, { opacity: 0 }],
      { duration: 520, easing: "ease-out" }
    );
  }

  shutter.addEventListener("click", () => {
    if (busy) return;
    if (!stream || video.readyState < 2) {
      fileInput.click(); // sin cámara: elegir una foto de la galería
      return;
    }
    audio.playFlash();
    flash();
    process(grabFrame());
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    fileInput.value = "";
    if (!file || busy) return;
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      audio.playFlash();
      flash();
      process(imageToCanvas(img));
    };
    img.src = URL.createObjectURL(file);
  });

  switchBtn.addEventListener("click", () => {
    if (busy) return;
    facing = facing === "user" ? "environment" : "user";
    switchBtn.classList.remove("is-spinning");
    void switchBtn.offsetWidth;
    switchBtn.classList.add("is-spinning");
    startCamera();
  });

  async function process(canvas) {
    busy = true;
    shutter.disabled = true;

    // muestra la foto congelada y la "revela" mientras se procesa
    shot.width = canvas.width;
    shot.height = canvas.height;
    shot.getContext("2d").drawImage(canvas, 0, 0);
    win.classList.add("is-shot", "is-developing");

    const [subjects, ubicacion] = await Promise.all([
      detectSubjects(canvas),
      Promise.race([loadPlace(), wait(1400).then(() => null)]),
      wait(1400),
    ]);
    const photoId = data.nuevoId();
    const split = subjects.length >= 2;
    const nuevos = (split ? subjects : [null]).map((b) => {
      const crop = b ? cropSubject(canvas, b) : drawTo(canvas, 0, 0, canvas.width, canvas.height);
      return data.agregarIntegrante({
        foto: crop.toDataURL("image/jpeg", 0.85),
        // con una sola persona/mascota se guarda su etiqueta; sin detección, null
        etiqueta: b ? b.label : subjects[0]?.label ?? null,
        fotoOrigen: photoId,
        ubicacion,
      });
    });
    photos.push({ id: photoId, full: canvas, integrantes: nuevos.map((i) => i.id) });

    win.classList.remove("is-developing"); // la foto termina de revelarse
    await wait(450);

    audio.playPrint();
    await addMinis(nuevos);

    if (!members.classList.contains("has-members")) {
      members.classList.add("has-members");
    }
    if (continueBtn.disabled) {
      continueBtn.disabled = false;
      continueBtn.classList.add("is-ready");
    }

    await wait(700);
    win.classList.remove("is-shot"); // vuelve la vista en vivo
    shutter.disabled = false;
    busy = false;
  }

  /* ---------- Mini fotos entrando a cuadro ---------- */

  const ROW_GAP_RATIO = 0.05;

  function fitRow(count) {
    // achica las mini fotos si ya no caben en una fila
    const avail = row.parentElement.clientWidth - 8;
    const base = Math.min(window.innerHeight * 0.11, 96);
    // cada mini ocupa h * (proporción del marco - traslape de los márgenes negativos)
    const perW = avail / (count * (1023 / 1206 - ROW_GAP_RATIO * 2));
    row.style.setProperty("--mini-h", Math.max(48, Math.min(base, perW)) + "px");
  }

  function makeMini(integrante) {
    const el = document.createElement("div");
    el.className = "mini";
    const rot = (Math.random() * 14 - 7).toFixed(1);
    el.innerHTML = window.BonnyPolaroid.html(integrante, rot);
    el.dataset.id = integrante.id;
    return el;
  }

  async function addMinis(items) {
    for (let i = 0; i < items.length; i++) {
      // FLIP: las que ya están se corren suavemente para dejar espacio al centro
      const existing = [...row.children];
      const before = existing.map((el) => el.getBoundingClientRect().left);

      const el = makeMini(items[i]);
      row.appendChild(el);
      fitRow(row.children.length);

      existing.forEach((node, k) => {
        const dx = before[k] - node.getBoundingClientRect().left;
        if (dx) node.animate(
          [{ transform: `translateX(${dx}px)` }, { transform: "none" }],
          { duration: 700, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
        );
      });

      // la nueva entra desde la izquierda, girando, y se asienta en su lugar
      const r = el.getBoundingClientRect();
      const fromX = -(r.right + 40);
      el.animate(
        [
          { transform: `translateX(${fromX}px) rotate(-28deg)`, opacity: 0.4 },
          { transform: "translateX(8px) rotate(4deg)", opacity: 1, offset: 0.75 },
          { transform: "none", opacity: 1 },
        ],
        { duration: 950, easing: "cubic-bezier(0.25, 0.8, 0.25, 1)" }
      );
      await wait(items.length > 1 ? 260 : 0);
    }
    await wait(700);
  }

  /* ---------- Otros botones ---------- */

  continueBtn.addEventListener("click", () => {
    if (busy || continueBtn.disabled) return;
    continueBtn.disabled = true;
    busy = true;
    stopCamera();
    scene.dispatchEvent(new CustomEvent("baul:continue", {
      bubbles: true,
      detail: { integrantes: data.integrantes, photos },
    }));
  });
  // "saltar" no hace nada por ahora

  /* ---------- Entrada a la escena ---------- */

  function enter() {
    loadDetector(); // empieza a descargar el modelo desde ya
    audio.playFlip(0.8);

    // texto del globo letra por letra
    const state = { t: 0 };
    window.BonnySplitChars?.(bubble.querySelector(".bubble__text"), state, 22);

    onboarding.classList.add("is-leaving");
    scene.hidden = false;
    void scene.offsetWidth;
    scene.classList.add("is-in");

    setTimeout(() => bubble.classList.add("is-active"), 650);
    setTimeout(startCamera, 900);
    setTimeout(loadPlace, 1600); // pide la ubicación después del permiso de cámara
    setTimeout(() => { onboarding.style.display = "none"; }, 1300);
  }

  onboarding.addEventListener("onboarding:done", enter);

  document.addEventListener("visibilitychange", () => {
    if (scene.hidden) return;
    if (document.hidden) stopCamera();
    else startCamera();
  });
})();

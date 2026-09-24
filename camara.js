/* Cámara (desde el morral) + vista previa donde se agregan integrantes con IA. */
(() => {
  const data = window.BonnyData;
  const audio = window.BonnyAudio;
  const flying = document.querySelector(".flying");
  const flashEl = document.querySelector(".flash");
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // proporción de la ventana de la polaroid (863 x 759 px en la imagen del marco)
  const ASPECT = 863 / 759;
  const MAX_W = 1168;

  /* ================= Cámara ================= */

  const cam = document.querySelector(".camara");
  const video = cam.querySelector(".camara__video");
  const backBtn = cam.querySelector(".camara__back");
  const shutter = cam.querySelector(".camara__shutter");
  const switchBtn = cam.querySelector(".camara__switch");
  const fileInput = cam.querySelector(".camara__file");

  let stream = null;
  let facing = "environment"; // para fotos familiares, la cámara de atrás
  let camOpen = false;

  async function startCamera() {
    stopCamera();
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("sin getUserMedia");
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1920 } },
        audio: false,
      });
      if (!camOpen) return stopCamera(); // se cerró mientras pedía permiso
      video.srcObject = stream;
      await video.play().catch(() => {});
      cam.classList.remove("no-cam");
      cam.classList.toggle("is-user", facing === "user");
    } catch (err) {
      console.warn("Cámara no disponible:", err);
      stream = null;
      cam.classList.add("no-cam");
    }
  }

  function stopCamera() {
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    video.srcObject = null;
  }

  function openCamera() {
    if (camOpen) return;
    camOpen = true;
    cam.hidden = false;
    void cam.offsetWidth;
    cam.classList.add("is-in");
    audio.playTick();
    startCamera();
    data.ubicacion(); // pide la ubicación para escribirla en la foto
  }

  async function closeCamera(keepHidden = false) {
    camOpen = false;
    cam.classList.remove("is-in");
    stopCamera();
    await wait(450);
    cam.hidden = true;
    if (!keepHidden) document.dispatchEvent(new CustomEvent("bonny:chest", { detail: { open: false } }));
  }

  document.addEventListener("bonny:camera", () => {
    document.dispatchEvent(new CustomEvent("bonny:chest", { detail: { open: true } })); // esconde la botonera
    openCamera();
  });

  backBtn.addEventListener("click", () => closeCamera());

  switchBtn.addEventListener("click", () => {
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
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      audio.playFlash();
      flash();
      showPreview(toCanvas(img, img.naturalWidth, img.naturalHeight));
    };
    img.src = URL.createObjectURL(file);
  });

  /* ================= Vista previa ================= */

  const pv = document.querySelector(".preview");
  const photoBox = pv.querySelector(".preview__photo");
  const cardBox = pv.querySelector(".preview__card");
  const status = pv.querySelector(".preview__status");
  const membersRow = pv.querySelector(".preview__members");
  const saveBtn = pv.querySelector(".preview__save");
  const discardBtn = pv.querySelector(".preview__discard");

  let photo = null;      // canvas actual (puede ser la versión con integrantes)
  let compuesta = false;
  let placeText = null;
  let busy = false;
  const creado = () => new Date().toISOString();
  let shotDate = creado();

  function renderCard() {
    cardBox.innerHTML = window.BonnyPolaroid.html(
      { tipo: "recuerdo", foto: photo.toDataURL("image/jpeg", 0.9), ubicacion: placeText, creado: shotDate },
      0
    );
  }

  async function showPreview(canvas) {
    photo = canvas;
    compuesta = false;
    placeText = null;
    shotDate = creado();
    renderCard();
    renderMembers();
    // la ubicación llega un poco después: se escribe en la foto cuando esté
    data.ubicacion().then((p) => {
      if (p && photo === canvas) { placeText = p; renderCard(); }
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

  async function hidePreview() {
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
    openCamera(); // la cámara aparece debajo mientras la vista previa se va
    await hidePreview();
  });

  saveBtn.addEventListener("click", async () => {
    if (busy) return;
    busy = true;
    pv.classList.add("is-busy", "is-saving");
    // la foto se levanta
    photoBox.animate(
      [{ transform: "rotate(-2deg)" }, { transform: "translateY(-14px) rotate(-1deg) scale(1.05)" }],
      { duration: 400, easing: "ease-out", fill: "forwards" }
    );

    const blob = await new Promise((r) => photo.toBlob(r, "image/jpeg", 0.88));
    const recuerdo = await data.agregarRecuerdo({ blob, ubicacion: placeText, compuesta });
    let baul = data.baulActivo || data.baules[data.baules.length - 1] || data.crearBaul();
    data.activarBaul(baul.id);
    data.guardarRecuerdoEnBaul(baul.id, recuerdo.id);
    await wait(450);

    // entra al baúl activo
    await window.BonnyShelves.receive(photoBox, baul.id);
    photoBox.getAnimations().forEach((a) => a.cancel());
    pv.hidden = true;
    pv.classList.remove("is-in", "is-saving", "is-busy");
    cardBox.innerHTML = "";
    membersRow.innerHTML = "";
    photoBox.style.visibility = "";
    busy = false;
    document.dispatchEvent(new CustomEvent("bonny:chest", { detail: { open: false } }));
  });

  /* ---------- integrantes que se pueden arrastrar a la foto ---------- */

  function familyMembers() {
    const activo = data.baulActivo;
    const ids = activo?.integrantes?.length ? activo.integrantes : data.integrantes.map((i) => i.id);
    return [...new Set(ids)].map(data.integrante).filter(Boolean);
  }

  function renderMembers() {
    membersRow.innerHTML = "";
    const list = familyMembers();
    const avail = membersRow.parentElement.clientWidth - 170;
    const w = Math.max(40, Math.min(62, avail / Math.max(1, list.length * 0.82 + 0.18)));
    list.forEach((m, i) => {
      const el = document.createElement("div");
      el.className = "pm";
      el.style.setProperty("--pm-w", w + "px");
      el.innerHTML = window.BonnyPolaroid.html(m, ((i % 2 ? 1 : -1) * (3 + Math.random() * 5)).toFixed(1));
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

  function startDrag(e, el, member) {
    if (busy || drag) return;
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

    // el integrante vuelve a su lugar en la fila
    d.el.style.visibility = "";
    d.el.classList.remove("is-back");
    void d.el.offsetWidth;
    d.el.classList.add("is-back");
    pv.classList.remove("is-busy");
    busy = false;
  }
})();

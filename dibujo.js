/* Dibujo con crayones: un dedo dibuja; dos dedos acercan y giran la hoja. */
(() => {
  const data = window.BonnyData;
  const audio = window.BonnyAudio;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const page = document.querySelector(".dibujo");
  const stage = page.querySelector(".dib-stage");
  const paper = page.querySelector(".dib-paper");
  const canvas = page.querySelector(".dib-canvas");
  const ctx = canvas.getContext("2d");
  // trazo en curso: capa temporal que se fija al soltar (si entra un segundo dedo, se descarta)
  const live = document.createElement("canvas");
  live.className = "dib-canvas dib-canvas--live";
  canvas.after(live);
  const lctx = live.getContext("2d");
  const backBtn = page.querySelector(".dib-back");
  const saveBtn = page.querySelector(".dib-save");
  const crayons = [...page.querySelectorAll(".dib-crayon")];
  const topBar = page.querySelector(".dib-top");
  const trashBtn = page.querySelector(".dib-trash");

  // hoja.webp mide 832 x 1254; el papel ocupa x 33–805, y 22–1230
  const SHEET_ASPECT = 832 / 1254;
  const PAPER_SRC = { x: 33, y: 22, w: 772, h: 1208 };
  const PAPER_BOX = { x: 0.0397, y: 0.0175, w: 0.928, h: 0.963 };
  const CW = 900;
  const CH = Math.round(CW * (PAPER_SRC.h / PAPER_SRC.w));
  canvas.width = live.width = CW;
  canvas.height = live.height = CH;

  let color = crayons.find((c) => c.getAttribute("aria-pressed") === "true")?.dataset.color || "#fe7a17";
  let base = null;                    // tamaño y posición de la hoja sin zoom
  let s = 1, r = 0, tx = 0, ty = 0;   // zoom, giro y desplazamiento de la hoja
  let dirty = false;
  let busy = false;
  let erasing = false;   // borrador elegido
  let placed = false;    // la hoja ya se colocó (el zoom se conserva entre visitas)

  /* ---------- Colocar la hoja ---------- */

  function fit() {
    const W = stage.clientWidth, H = stage.clientHeight;
    const top = topBar.getBoundingClientRect().bottom - stage.getBoundingClientRect().top + 16;
    // la hoja termina justo encima de la fila de crayones
    const bottom = stage.getBoundingClientRect().bottom - page.querySelector(".dib-crayons").getBoundingClientRect().top + 6;
    const availH = Math.max(200, H - top - bottom);
    let h = availH, w = h * SHEET_ASPECT;
    // deja espacio a la izquierda para el ícono de la herramienta
    if (w > W * 0.74) { w = W * 0.74; h = w / SHEET_ASPECT; }
    base = { w, h, x: (W - w) / 2, y: top + (availH - h) / 2 };
    paper.style.width = w + "px";
    paper.style.height = h + "px";
    apply();
  }

  const tf = () => `translate(${base.x + tx}px, ${base.y + ty}px) rotate(${r}deg) scale(${s})`;
  const apply = () => { paper.style.transform = tf(); };

  const rot = (x, y, deg) => {
    const a = (deg * Math.PI) / 180;
    return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
  };
  const center = () => [base.x + tx + base.w / 2, base.y + ty + base.h / 2];
  // punto de pantalla → punto de la hoja (relativo a su centro, sin zoom)
  function toLocal(px, py) {
    const [cx, cy] = center();
    const [lx, ly] = rot(px - cx, py - cy, -r);
    return [lx / s, ly / s];
  }
  // mueve la hoja para que el punto local q quede bajo (px, py)
  function placeAt(px, py, q) {
    const [ox, oy] = rot(q[0] * s, q[1] * s, r);
    tx = px - ox - base.x - base.w / 2;
    ty = py - oy - base.y - base.h / 2;
  }
  // punto local → píxel del lienzo
  function toCanvas([lx, ly]) {
    const x = lx + base.w / 2 - base.w * PAPER_BOX.x;
    const y = ly + base.h / 2 - base.h * PAPER_BOX.y;
    return [(x / (base.w * PAPER_BOX.w)) * CW, (y / (base.h * PAPER_BOX.h)) * CH];
  }

  /* ---------- Trazo de crayón (textura cerosa) ---------- */

  const patterns = new Map();
  function crayonPattern(hex) {
    if (patterns.has(hex)) return patterns.get(hex);
    const size = 48;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    const img = g.createImageData(size, size);
    const rr = parseInt(hex.slice(1, 3), 16), gg = parseInt(hex.slice(3, 5), 16), bb = parseInt(hex.slice(5, 7), 16);
    for (let i = 0; i < size * size; i++) {
      const n = Math.random();
      const shade = 0.88 + Math.random() * 0.16;
      img.data[i * 4] = Math.min(255, rr * shade);
      img.data[i * 4 + 1] = Math.min(255, gg * shade);
      img.data[i * 4 + 2] = Math.min(255, bb * shade);
      // huequitos donde el papel se asoma, como la cera real
      img.data[i * 4 + 3] = n < 0.14 ? 0 : 150 + Math.random() * 105;
    }
    g.putImageData(img, 0, 0);
    const p = ctx.createPattern(c, "repeat");
    patterns.set(hex, p);
    return p;
  }

  const BRUSH = 10; // radio en píxeles del lienzo
  let last = null;

  const ERASER = 26; // radio del borrador en píxeles del lienzo

  function strokeTo(pt) {
    // el borrador se previsualiza con el color del papel; al soltar se recorta del dibujo
    lctx.strokeStyle = erasing ? "#f4e9dc" : crayonPattern(color);
    lctx.lineWidth = erasing ? ERASER * 2 : BRUSH * 2 * (0.9 + Math.random() * 0.2);
    lctx.lineCap = "round";
    lctx.lineJoin = "round";
    lctx.globalAlpha = 0.9;
    lctx.beginPath();
    lctx.moveTo(last[0], last[1]);
    lctx.lineTo(pt[0], pt[1]);
    lctx.stroke();
    last = pt;
  }

  function commitStroke() {
    if (erasing) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.drawImage(live, 0, 0);
      ctx.globalCompositeOperation = "source-over";
    } else {
      ctx.drawImage(live, 0, 0);
    }
    lctx.clearRect(0, 0, CW, CH);
    dirty = !isBlank();
    saveDraftSoon();
  }

  // ¿la hoja quedó en blanco? (revisa una versión reducida del lienzo)
  const probe = document.createElement("canvas");
  probe.width = 90;
  probe.height = Math.round(90 * (CH / CW));
  const pctx = probe.getContext("2d", { willReadFrequently: true });
  function isBlank() {
    pctx.clearRect(0, 0, probe.width, probe.height);
    pctx.drawImage(canvas, 0, 0, probe.width, probe.height);
    const d = pctx.getImageData(0, 0, probe.width, probe.height).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 8) return false;
    return true;
  }

  /* ---------- Borrador: el dibujo queda guardado en esta pantalla ---------- */

  let draftTimer = null;
  function saveDraftSoon() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(saveDraft, 800);
  }
  function saveDraft() {
    clearTimeout(draftTimer);
    if (!dirty) return data.borrarBorrador();
    canvas.toBlob((b) => b && data.guardarBorrador(b), "image/png");
  }
  async function loadDraft() {
    const blob = await data.leerBorrador();
    if (!blob) return;
    const img = new Image();
    img.src = URL.createObjectURL(blob);
    await img.decode().catch(() => {});
    ctx.clearRect(0, 0, CW, CH);
    ctx.drawImage(img, 0, 0, CW, CH);
    URL.revokeObjectURL(img.src);
    dirty = !isBlank();
  }
  const draftReady = loadDraft();
  const discardStroke = () => lctx.clearRect(0, 0, CW, CH);

  /* ---------- Gestos ---------- */

  const pointers = new Map();
  let mode = null; // "draw" | "gesture" | "locked"
  let pinch = null;

  const stagePt = (e) => {
    const st = stage.getBoundingClientRect();
    return [e.clientX - st.left, e.clientY - st.top];
  };

  function onPaper(local) {
    return Math.abs(local[0]) <= base.w / 2 && Math.abs(local[1]) <= base.h / 2;
  }

  function startPinch() {
    const [a, b] = [...pointers.values()];
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    pinch = {
      dist: Math.hypot(b[0] - a[0], b[1] - a[1]),
      angle: (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI,
      s0: s,
      r0: r,
      q: toLocal(mx, my),
    };
  }

  stage.addEventListener("pointerdown", (e) => {
    if (busy) return;
    try { stage.setPointerCapture(e.pointerId); } catch (_) {}
    pointers.set(e.pointerId, stagePt(e));
    paper.getAnimations().forEach((a) => a.cancel());

    if (pointers.size === 1 && mode === null) {
      const local = toLocal(...pointers.get(e.pointerId));
      if (!onPaper(local)) { mode = "locked"; return; }
      mode = "draw";
      last = toCanvas(local);
      strokeTo([last[0] + 0.1, last[1] + 0.1]); // un toque deja un punto
    } else if (pointers.size === 2) {
      mode = "gesture"; // el segundo dedo pasa a mover la hoja
      last = null;
      discardStroke();
      startPinch();
    }
  });

  stage.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    pointers.set(e.pointerId, stagePt(e));

    if (mode === "draw" && last) {
      (events.length ? events : [e]).forEach((ev) => strokeTo(toCanvas(toLocal(...stagePt(ev)))));
    } else if (mode === "gesture" && pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      s = Math.max(0.5, Math.min(4, pinch.s0 * (Math.hypot(b[0] - a[0], b[1] - a[1]) / pinch.dist)));
      r = pinch.r0 + ((Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI - pinch.angle);
      placeAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, pinch.q);
      apply();
    }
  });

  function onUp(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (mode === "gesture" && pointers.size === 1) pinch = null; // espera a que se levanten todos
    if (pointers.size === 0) {
      if (mode === "gesture") settle();
      if (mode === "draw") commitStroke();
      mode = null;
      last = null;
    }
  }
  stage.addEventListener("pointerup", onUp);
  stage.addEventListener("pointercancel", onUp);

  // acomoda la hoja si quedó muy chica, casi derecha o fuera de la pantalla
  // la hoja se queda donde la dejes (con su zoom); solo se evita que salga del todo de la pantalla
  function settle() {
    const from = tf();
    if (Math.abs(r % 360) < 4) r = 0;
    apply();
    const pr = paper.getBoundingClientRect();
    const st = stage.getBoundingClientRect();
    const keep = 90; // px de hoja que siempre quedan a la vista
    let dx = 0, dy = 0;
    if (pr.right < st.left + keep) dx = st.left + keep - pr.right;
    if (pr.left > st.right - keep) dx = st.right - keep - pr.left;
    if (pr.bottom < st.top + keep) dy = st.top + keep - pr.bottom;
    if (pr.top > st.bottom - keep) dy = st.bottom - keep - pr.top;
    tx += dx;
    ty += dy;
    apply();
    if (dx || dy) paper.animate([{ transform: from }, { transform: tf() }], { duration: 260, easing: "ease-out" });
  }

  /* ---------- Crayones ---------- */

  // cada herramienta queda un poco girada, como sueltas sobre la mesa
  crayons.forEach((c) => c.style.setProperty("--rot", `${(Math.random() * 18 - 9).toFixed(1)}deg`));

  const toolIcon = page.querySelector(".dib-tool__img");
  function showToolIcon() {
    const src = `assets/img/dibujo/icono-${erasing ? "borrador" : "crayon"}.webp`;
    if (toolIcon.getAttribute("src") === src) return;
    toolIcon.src = src;
    toolIcon.animate(
      [{ transform: "scale(0.4) rotate(-20deg)", opacity: 0 }, { transform: "scale(1.15)", opacity: 1, offset: 0.7 }, { transform: "none" }],
      { duration: 360, easing: "ease-out" }
    );
  }

  crayons.forEach((btn) =>
    btn.addEventListener("click", () => {
      crayons.forEach((c) => c.setAttribute("aria-pressed", String(c === btn)));
      erasing = btn.dataset.tool === "borrador";
      if (!erasing) color = btn.dataset.color;
      showToolIcon();
      audio.playTick();
    })
  );

  /* ---------- Tacho: borra todo el dibujo (con un segundo toque) ---------- */

  let trashTimer = null;
  trashBtn.addEventListener("click", () => {
    if (busy || !dirty) {
      trashBtn.animate([{ transform: "rotate(0)" }, { transform: "rotate(-10deg)" }, { transform: "rotate(10deg)" }, { transform: "rotate(0)" }], { duration: 280 });
      return;
    }
    if (!trashBtn.classList.contains("is-confirming")) {
      trashBtn.classList.add("is-confirming");
      trashBtn.setAttribute("aria-label", "Toca otra vez para borrar todo");
      audio.playTick();
      trashTimer = setTimeout(resetTrash, 2500);
      return;
    }
    resetTrash();
    // el dibujo se desvanece como si se sacudiera la hoja
    const fade = document.createElement("canvas");
    fade.className = "dib-canvas";
    fade.width = CW;
    fade.height = CH;
    fade.getContext("2d").drawImage(canvas, 0, 0);
    canvas.after(fade);
    ctx.clearRect(0, 0, CW, CH);
    dirty = false;
    data.borrarBorrador();
    audio.playFlip(0.6);
    paper.animate(
      [{ transform: tf() }, { transform: tf() + " rotate(-2deg)" }, { transform: tf() + " rotate(2deg)" }, { transform: tf() }],
      { duration: 380, easing: "ease-in-out" }
    );
    fade.animate([{ opacity: 1, filter: "blur(0)" }, { opacity: 0, filter: "blur(6px)" }], { duration: 450, easing: "ease-out" });
    setTimeout(() => fade.remove(), 460);
  });
  function resetTrash() {
    clearTimeout(trashTimer);
    trashBtn.classList.remove("is-confirming");
    trashBtn.setAttribute("aria-label", "Borrar todo el dibujo");
  }

  /* ---------- Abrir / salir / guardar ---------- */

  async function open() {
    document.dispatchEvent(new CustomEvent("bonny:chest", { detail: { open: true } })); // esconde la botonera
    discardStroke();
    resetTrash();
    await draftReady; // el dibujo anterior sigue ahí
    page.classList.remove("is-saving");
    page.hidden = false;
    fit();
    if (!placed) { s = 1; r = 0; tx = 0; ty = 0; apply(); placed = true; }
    crayons.forEach((c, i) => (c.style.transitionDelay = `${250 + i * 45}ms`));
    void page.offsetWidth;
    page.classList.add("is-in");
    paper.animate(
      [
        { transform: `translate(${base.x}px, ${base.y - 60}px) rotate(-8deg) scale(1.08)`, opacity: 0 },
        { transform: `translate(${base.x}px, ${base.y + 6}px) rotate(1deg) scale(0.99)`, opacity: 1, offset: 0.7 },
        { transform: tf(), opacity: 1 },
      ],
      { duration: 650, delay: 120, easing: "cubic-bezier(0.25, 0.8, 0.3, 1)", fill: "backwards" }
    );
    audio.playFlip(0.5);
    await wait(700);
    crayons.forEach((c) => (c.style.transitionDelay = ""));
  }

  async function close() {
    saveDraft();
    page.classList.remove("is-in");
    await wait(450);
    page.hidden = true;
    document.dispatchEvent(new CustomEvent("bonny:chest", { detail: { open: false } }));
  }

  backBtn.addEventListener("click", () => {
    if (busy) return;
    audio.playTick();
    close();
  });

  saveBtn.addEventListener("click", async () => {
    if (busy) return;
    if (!dirty) {
      // hoja en blanco: nada que guardar
      saveBtn.animate(
        [{ transform: "translateX(0)" }, { transform: "translateX(-5px)" }, { transform: "translateX(5px)" }, { transform: "translateX(0)" }],
        { duration: 280 }
      );
      return;
    }
    busy = true;
    saveBtn.disabled = backBtn.disabled = true;

    // la hoja vuelve derecha y se levanta
    const from = tf();
    s = 1; r = 0; tx = 0; ty = 0;
    apply();
    paper.animate([{ transform: from }, { transform: tf() }], { duration: 300, easing: "ease-out" });
    await wait(300);
    page.classList.add("is-saving");
    paper.animate(
      [{ transform: tf() }, { transform: `translate(${base.x}px, ${base.y - 14}px) scale(1.04)` }],
      { duration: 380, easing: "ease-out", fill: "forwards" }
    );

    // se guarda como una foto: papel + dibujo
    const out = document.createElement("canvas");
    out.width = CW;
    out.height = CH;
    const g = out.getContext("2d");
    const sheet = paper.querySelector(".dib-paper__img");
    await sheet.decode().catch(() => {});
    g.drawImage(sheet, PAPER_SRC.x, PAPER_SRC.y, PAPER_SRC.w, PAPER_SRC.h, 0, 0, CW, CH);
    g.drawImage(canvas, 0, 0);
    const blob = await new Promise((res) => out.toBlob(res, "image/jpeg", 0.9));
    // además, el trazo solo en PNG transparente (así se ve en el álbum)
    const png = await new Promise((res) => canvas.toBlob(res, "image/png"));
    const recuerdo = await data.agregarRecuerdo({ blob, poster: png, dibujo: true });
    const baul = data.baulActivo || data.baules[data.baules.length - 1] || data.crearBaul();
    data.activarBaul(baul.id);
    data.guardarRecuerdoEnBaul(baul.id, recuerdo.id);

    // el lienzo se reemplaza por una imagen para que la copia que vuela lo muestre
    const snap = document.createElement("img");
    snap.className = "dib-paper__snap";
    snap.src = canvas.toDataURL("image/png");
    await snap.decode().catch(() => {});
    paper.appendChild(snap);
    await wait(150);

    await window.BonnyShelves.receive(paper, baul.id);
    paper.getAnimations().forEach((a) => a.cancel());
    snap.remove();
    // ya quedó en el baúl: la próxima vez empieza con una hoja nueva
    ctx.clearRect(0, 0, CW, CH);
    dirty = false;
    data.borrarBorrador();
    paper.style.visibility = "";
    page.hidden = true;
    page.classList.remove("is-in", "is-saving");
    saveBtn.disabled = backBtn.disabled = false;
    busy = false;
    document.dispatchEvent(new CustomEvent("bonny:chest", { detail: { open: false } }));
  });

  document.addEventListener("bonny:dibujo", open);
  window.addEventListener("resize", () => { if (!page.hidden) { s = 1; r = 0; tx = 0; ty = 0; fit(); } });
})();

/* Escena 3: "Mis baúles de recuerdos" — repisas con cofres y baúl abierto. */
(() => {
  const scene = document.querySelector(".shelves");
  const wall = scene.querySelector(".shelves__wall");
  const top = scene.querySelector(".sh-top");
  const bottom = scene.querySelector(".sh-bottom");
  const title = scene.querySelector(".shelves__title");
  const flying = document.querySelector(".flying");
  const data = window.BonnyData;
  const audio = window.BonnyAudio;

  // baúl abierto
  const view = document.querySelector(".chest-view");
  const scroller = view.querySelector(".cv-scroll");
  const cvChest = view.querySelector(".cv-chest");
  const backBtns = [...view.querySelectorAll(".cv-back")];
  const cvTitle = view.querySelector(".cv-title");
  const titleInput = view.querySelector(".cv-title-input");
  const editBtn = view.querySelector(".cv-edit");
  const colorBtns = [...view.querySelectorAll(".cv-color")];
  const grid = view.querySelector(".cv-grid");
  const activateBtn = view.querySelector(".cv-activate");
  const deleteBtn = view.querySelector(".cv-delete");

  const PER_ROW = 4; // cofres por repisa; el "+" también ocupa un lugar
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  let busy = false;
  let openId = null;

  /* ---------- Cofres ---------- */

  const boxHTML = (color, tag = false) => `
    <span class="chest__box">
      <span class="chest__glow"></span>
      <img class="chest__lid" src="assets/img/cofres/sup_${color}.webp" alt="" draggable="false" />
      <span class="chest__inside"></span>
      <img class="chest__body" src="assets/img/cofres/inf_${color}.webp" alt="" draggable="false" />
      ${tag ? '<span class="chest__tag">Activo</span>' : ""}
    </span>`;

  function makeChest(baul) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "chest";
    el.dataset.id = baul.id;
    el.setAttribute("aria-label", `Abrir ${baul.nombre}`);
    el.innerHTML = `<span class="chest__label">${esc(baul.nombre)}</span>${boxHTML(baul.color, true)}`;
    el.addEventListener("click", () => openChest(baul.id));
    return el;
  }

  function makeAdd() {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "sh-add";
    el.setAttribute("aria-label", "Crear baúl");
    el.innerHTML = `<img src="assets/img/btn-more.png" alt="" draggable="false" />`;
    el.addEventListener("click", addChest);
    return el;
  }

  // Arriba (fila 1) + una repisa repetida por cada fila extra + abajo
  function render() {
    wall.querySelectorAll(".sh-rep, .sh-row").forEach((n) => n.remove());

    const items = [...data.baules.map(makeChest), makeAdd()];
    const rows = Math.ceil(items.length / PER_ROW);
    const sections = [top];
    for (let r = 1; r < rows; r++) {
      const rep = document.createElement("div");
      rep.className = "sh-sec sh-rep";
      wall.insertBefore(rep, bottom);
      sections.push(rep);
    }
    sections.forEach((sec, r) => {
      const row = document.createElement("div");
      row.className = "sh-row";
      items.slice(r * PER_ROW, (r + 1) * PER_ROW).forEach((it) => row.appendChild(it));
      sec.appendChild(row);
    });
    markActive();
  }

  const chestEl = (id) => wall.querySelector(`.chest[data-id="${id}"]`);
  const boxOf = (el) => el.querySelector(".chest__box");

  function markActive() {
    const active = data.baulActivo?.id;
    wall.querySelectorAll(".chest").forEach((c) => c.classList.toggle("is-active", c.dataset.id === active));
  }

  function bounce(el) {
    boxOf(el).animate(
      [
        { transform: "scale(1, 1)" },
        { transform: "scale(1.08, 0.9)", offset: 0.3 },
        { transform: "scale(0.96, 1.05)", offset: 0.6 },
        { transform: "scale(1, 1)" },
      ],
      { duration: 450, easing: "ease-out" }
    );
  }

  function mouthOf(el) {
    const r = boxOf(el).getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height * 0.45, w: r.width };
  }

  // Un cofre que viaja entre la repisa y el baúl abierto, por encima de todo
  async function flyChest(fromEl, toEl, color, duration = 650, active = false) {
    const a = boxOf(fromEl).getBoundingClientRect();
    const b = boxOf(toEl).getBoundingClientRect();
    const clone = document.createElement("div");
    clone.className = `chest fly${active ? " is-active" : ""}`;
    Object.assign(clone.style, { left: a.left + "px", top: a.top + "px", width: a.width + "px", transformOrigin: "0 0" });
    clone.innerHTML = boxHTML(color, active);
    flying.appendChild(clone);
    const s = b.width / a.width;
    const dx = b.left - a.left;
    const dy = b.top - a.top;
    clone.animate(
      [
        { transform: "none" },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 30}px) scale(${(1 + s) / 2}) rotate(-6deg)`, offset: 0.5 },
        { transform: `translate(${dx}px, ${dy}px) scale(${s})` },
      ],
      { duration, easing: "cubic-bezier(0.45, 0, 0.3, 1)", fill: "forwards" }
    );
    await wait(duration);
    return clone;
  }

  /* ---------- Crear un cofre ---------- */

  async function addChest() {
    if (busy) return;
    busy = true;
    const baul = data.crearBaul(); // color al azar; queda como activo
    render();
    const el = chestEl(baul.id);
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    audio.playPop();
    el.animate(
      [
        { transform: "translateY(-140px) scale(0.6)", opacity: 0 },
        { transform: "translateY(0) scale(1.05, 0.92)", opacity: 1, offset: 0.65 },
        { transform: "translateY(-10px) scale(0.98, 1.03)", offset: 0.82 },
        { transform: "none", opacity: 1 },
      ],
      { duration: 700, easing: "cubic-bezier(0.3, 0.7, 0.4, 1)" }
    );
    const add = wall.querySelector(".sh-add");
    add.animate([{ opacity: 0, transform: "scale(0.5)" }, { opacity: 1, transform: "none" }], {
      duration: 400, delay: 350, fill: "backwards", easing: "cubic-bezier(0.2, 0.9, 0.3, 1.4)",
    });
    await wait(700);
    busy = false;
  }

  /* ---------- Baúl abierto ---------- */

  const openBaul = () => data.baules.find((b) => b.id === openId);

  // Copia de una foto en la capa superior, para que nada la recorte al volar
  function cloneAt(card) {
    const r = card.getBoundingClientRect();
    const f = document.createElement("div");
    f.className = "fly";
    Object.assign(f.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
    f.innerHTML = card.innerHTML;
    flying.appendChild(f);
    return { f, r };
  }

  const inViewport = (el) => {
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight;
  };

  function fillView(baul) {
    cvTitle.textContent = "";
    cvTitle.hidden = false;
    titleInput.hidden = true;
    const isActive = data.baulActivo?.id === baul.id;
    cvChest.innerHTML = boxHTML(baul.color, true);
    cvChest.classList.toggle("is-active", isActive);
    colorBtns.forEach((b) => b.setAttribute("aria-checked", String(b.dataset.color === baul.color)));
    activateBtn.classList.toggle("is-hidden", data.baulActivo?.id === baul.id);
    resetDelete();

    grid.innerHTML = "";
    // recuerdos (fotos de la cámara), del más nuevo al más antiguo, y luego los integrantes
    const recuerdos = (baul.recuerdos || []).map(data.recuerdo).filter(Boolean).reverse();
    const fotos = [...recuerdos, ...baul.integrantes.map(data.integrante).filter(Boolean)];
    fotos.forEach((f) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "cv-card";
      card.setAttribute("aria-label", "Ver foto");
      card.dataset.id = f.id;
      card.innerHTML = window.BonnyPolaroid.html(f, (Math.random() * 12 - 6).toFixed(1));
      card.addEventListener("click", () => { if (!busy) Lightbox.open(card); });
      grid.appendChild(card);
    });
    view.classList.toggle("is-empty", fotos.length === 0);
  }

  async function openChest(id) {
    if (busy || openId) return;
    busy = true;
    openId = id;
    const baul = openBaul();
    const shelfEl = chestEl(id);

    fillView(baul);
    const hydrated = window.BonnyPolaroid.hydrate(grid); // imágenes guardadas en IndexedDB, en paralelo
    const cards = [...grid.children];
    cards.forEach((c) => (c.style.visibility = "hidden"));
    cvChest.classList.add("is-hidden");
    view.classList.remove("is-leaving", "is-compact");
    view.hidden = false;
    scroller.scrollTop = 0;
    void view.offsetWidth;
    view.classList.add("is-visible");
    document.dispatchEvent(new CustomEvent("bonny:chest", { detail: { open: true } }));

    // el cofre sube a la esquina superior izquierda del baúl abierto
    shelfEl.style.visibility = "hidden";
    audio.playFlip(0.35);
    const active = data.baulActivo?.id === baul.id;
    const clone = await flyChest(shelfEl, cvChest, baul.color, 650, active);
    cvChest.classList.remove("is-hidden");
    clone.remove();
    typeTitle(baul.nombre);

    // se abre y las fotos salen hacia su lugar
    cvChest.classList.add("is-open");
    audio.playChestOpen();
    await Promise.all([wait(250), hydrated]);
    const mouth = mouthOf(cvChest);
    let longest = 0;
    cards.forEach((card, i) => {
      if (!inViewport(card)) { card.style.visibility = ""; return; }
      const { f, r } = cloneAt(card);
      const dx = mouth.x - (r.left + r.width / 2);
      const dy = mouth.y - (r.top + r.height / 2);
      const delay = i * 90;
      longest = Math.max(longest, delay + 750);
      f.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(0.15)`, opacity: 0 },
          { opacity: 1, offset: 0.2 },
          { transform: `translate(${dx * 0.4}px, ${dy * 0.4 - 50}px) scale(0.75) rotate(${i % 2 ? 8 : -8}deg)`, offset: 0.55 },
          { transform: "none", opacity: 1 },
        ],
        { duration: 750, delay, easing: "cubic-bezier(0.25, 0.8, 0.3, 1.1)", fill: "both" }
      );
      setTimeout(() => { card.style.visibility = ""; f.remove(); }, delay + 750);
    });
    await wait(longest);

    // cuando salieron todas, se cierra
    cvChest.classList.remove("is-open");
    audio.playChestClose();
    bounce(cvChest);
    await wait(300);
    busy = false;
  }

  async function closeChest() {
    if (busy || !openId) return;
    commitTitle();
    busy = true;
    stopTyping();
    const baul = openBaul();
    cvTitle.textContent = baul.nombre;

    // el cofre se abre y las fotos vuelven a entrar
    cvChest.classList.add("is-open");
    audio.playChestOpen();
    await wait(250);
    const mouth = mouthOf(cvChest);
    const cards = [...grid.children].filter(inViewport).reverse();
    cards.forEach((card, i) => {
      const { f, r } = cloneAt(card);
      const dx = mouth.x - (r.left + r.width / 2);
      const dy = mouth.y - (r.top + r.height / 2);
      f.animate(
        [
          { transform: "none", opacity: 1 },
          { transform: `translate(${dx * 0.4}px, ${dy * 0.6 - 50}px) scale(0.6)`, opacity: 1, offset: 0.5 },
          { transform: `translate(${dx}px, ${dy - 6}px) scale(0.18)`, opacity: 1, offset: 0.85 },
          { transform: `translate(${dx}px, ${dy + 8}px) scale(0.1)`, opacity: 0 },
        ],
        { duration: 600, delay: i * 60, easing: "cubic-bezier(0.5, 0, 0.6, 1)", fill: "forwards" }
      );
    });
    grid.querySelectorAll(".cv-card").forEach((c) => (c.style.visibility = "hidden"));
    // todo lo demás se vuelve transparente
    view.classList.add("is-leaving");
    view.classList.remove("is-visible");
    await wait(600 + cards.length * 60);
    flying.innerHTML = "";

    cvChest.classList.remove("is-open");
    audio.playChestClose();
    bounce(cvChest);
    await wait(320);

    // regresa a su lugar en la repisa (con su nuevo color / nombre)
    render();
    const shelfEl = chestEl(baul.id);
    shelfEl.style.visibility = "hidden";
    shelfEl.scrollIntoView({ block: "nearest" });
    cvChest.classList.add("is-hidden");
    const clone = await flyChest(cvChest, shelfEl, baul.color, 600, data.baulActivo?.id === baul.id);
    shelfEl.style.visibility = "";
    clone.remove();
    bounce(shelfEl);

    finishView();
    busy = false;
  }

  function finishView() {
    view.hidden = true;
    view.classList.remove("is-visible", "is-leaving", "is-empty", "is-compact");
    cvChest.classList.remove("is-active");
    grid.innerHTML = "";
    cvChest.innerHTML = "";
    cvChest.classList.remove("is-hidden");
    openId = null;
    document.dispatchEvent(new CustomEvent("bonny:chest", { detail: { open: false } }));
  }

  backBtns.forEach((b) => b.addEventListener("click", closeChest));

  // al bajar, la cabecera se compacta y "regresar" pasa a la parte inferior
  scroller.addEventListener("scroll", () => {
    view.classList.toggle("is-compact", scroller.scrollTop > 24);
  }, { passive: true });

  /* ---------- Título que se escribe letra por letra ---------- */

  let typing = null;
  function stopTyping() {
    clearTimeout(typing);
    typing = null;
    cvTitle.classList.remove("is-typing");
  }
  function typeTitle(text) {
    stopTyping();
    const chars = [...text];
    let i = 0;
    cvTitle.textContent = "";
    cvTitle.classList.add("is-typing");
    const next = () => {
      cvTitle.textContent = chars.slice(0, ++i).join("");
      if (i % 2) audio.playTick();
      if (i < chars.length) typing = setTimeout(next, 45 + Math.random() * 45);
      else typing = setTimeout(stopTyping, 600);
    };
    typing = setTimeout(next, 120);
  }

  /* ---------- Editar título ---------- */

  function startEdit() {
    if (!openId || busy) return;
    stopTyping();
    titleInput.value = openBaul().nombre;
    cvTitle.hidden = true;
    titleInput.hidden = false;
    titleInput.focus(); // levanta el teclado
    titleInput.select();
  }
  function commitTitle() {
    if (titleInput.hidden || !openId) return;
    const name = titleInput.value.trim();
    if (name) {
      data.renombrarBaul(openId, name);
      cvTitle.textContent = openBaul().nombre;
    }
    titleInput.hidden = true;
    cvTitle.hidden = false;
  }
  editBtn.addEventListener("click", () => (titleInput.hidden ? startEdit() : titleInput.blur()));
  titleInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") titleInput.blur();
    if (e.key === "Escape") { titleInput.value = ""; titleInput.blur(); }
  });
  titleInput.addEventListener("blur", commitTitle);

  /* ---------- Color del baúl ---------- */

  colorBtns.forEach((btn) =>
    btn.addEventListener("click", () => {
      if (!openId) return;
      const color = btn.dataset.color;
      data.colorBaul(openId, color);
      colorBtns.forEach((b) => b.setAttribute("aria-checked", String(b === btn)));
      cvChest.querySelector(".chest__lid").src = `assets/img/cofres/sup_${color}.webp`;
      cvChest.querySelector(".chest__body").src = `assets/img/cofres/inf_${color}.webp`;
      bounce(cvChest);
      audio.playTick();
    })
  );

  /* ---------- Seleccionar activo ---------- */

  activateBtn.addEventListener("click", () => {
    if (!openId) return;
    data.activarBaul(openId);
    markActive();
    cvChest.classList.add("is-active"); // aparece la etiqueta también arriba
    activateBtn.classList.add("is-hidden");
    bounce(cvChest);
    audio.playPop();
  });

  /* ---------- Eliminar (con confirmación de dos toques) ---------- */

  let confirmTimer = null;
  function resetDelete() {
    clearTimeout(confirmTimer);
    deleteBtn.classList.remove("is-confirming");
    deleteBtn.textContent = "eliminar";
  }

  deleteBtn.addEventListener("click", async () => {
    if (busy || !openId) return;
    if (!deleteBtn.classList.contains("is-confirming")) {
      deleteBtn.classList.add("is-confirming");
      deleteBtn.textContent = "¿seguro? toca otra vez";
      deleteBtn.animate(
        [{ transform: "translateX(0)" }, { transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "translateX(0)" }],
        { duration: 300 }
      );
      confirmTimer = setTimeout(resetDelete, 3000);
      return;
    }
    clearTimeout(confirmTimer);
    busy = true;
    const id = openId;

    // todo se desvanece y el cofre desaparece en una nube de polvo
    grid.querySelectorAll(".cv-card").forEach((c) =>
      c.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(0.8)" }], { duration: 300, fill: "forwards" })
    );
    view.classList.add("is-leaving");
    view.classList.remove("is-visible");
    await wait(300);
    cvChest.animate(
      [
        { transform: "none", opacity: 1, filter: "none" },
        { transform: "rotate(-6deg)", offset: 0.15 },
        { transform: "rotate(6deg)", offset: 0.3 },
        { transform: "rotate(-4deg) scale(1.05)", offset: 0.45 },
        { transform: "scale(0.2) translateY(20px)", opacity: 0, filter: "blur(4px)" },
      ],
      { duration: 700, easing: "ease-in", fill: "forwards" }
    );
    puff(cvChest);
    audio.playFlip(0.6);
    await wait(750);

    data.eliminarBaul(id);
    render();
    cvChest.getAnimations().forEach((a) => a.cancel());
    finishView();
    busy = false;
  });

  function puff(el) {
    const r = boxOf(el).getBoundingClientRect();
    for (let i = 0; i < 9; i++) {
      const p = document.createElement("span");
      p.className = "puff";
      const size = 10 + Math.random() * 16;
      Object.assign(p.style, {
        left: r.left + r.width / 2 - size / 2 + "px",
        top: r.top + r.height * 0.6 - size / 2 + "px",
        width: size + "px",
        height: size + "px",
      });
      flying.appendChild(p);
      const a = (i / 9) * Math.PI * 2;
      const d = 30 + Math.random() * 25;
      p.animate(
        [
          { transform: "scale(0.3)", opacity: 0.9 },
          { transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d * 0.6 - 10}px) scale(1.4)`, opacity: 0 },
        ],
        { duration: 700, delay: 250, easing: "ease-out", fill: "both" }
      );
      setTimeout(() => p.remove(), 1000);
    }
  }

  /* ---------- Foto ampliada: con marco, zoom y giro con dos dedos ---------- */

  const Lightbox = (() => {
    const box = document.querySelector(".lightbox");
    const stage = box.querySelector(".lightbox__stage");
    const card = box.querySelector(".lightbox__card");
    const closeBtn = box.querySelector(".lightbox__close");
    const ASPECT = 1023 / 1206; // proporción del marco polaroid
    let source = null;          // la tarjeta del baúl que se amplió
    let base = null;            // posición y tamaño sin zoom
    let s = 1, r = 0, tx = 0, ty = 0;
    const pointers = new Map();
    let pinch = null;
    let lastTap = 0;

    // transform con origen en el centro: translate(esquina) rotate scale
    const tf = (x, y, rot, sc) => `translate(${x}px, ${y}px) rotate(${rot}deg) scale(${sc})`;
    const apply = () => { card.style.transform = tf(base.x + tx, base.y + ty, r, s); };

    function fit() {
      const W = stage.clientWidth, H = stage.clientHeight;
      let w = W * 0.86, h = w / ASPECT;
      if (h > H * 0.8) { h = H * 0.8; w = h * ASPECT; }
      base = { w, h, x: (W - w) / 2, y: (H - h) / 2 };
      card.style.width = w + "px";
      card.style.height = h + "px";
    }

    // transform para que la tarjeta ocupe exactamente el lugar de la mini
    function fromSource() {
      const rc = source.getBoundingClientRect();
      const st = stage.getBoundingClientRect();
      const k = rc.width / base.w;
      const x = rc.left - st.left - (base.w * (1 - k)) / 2;
      const y = rc.top - st.top - (base.h * (1 - k)) / 2;
      const rot = parseFloat(source.querySelector(".mini__card").style.getPropertyValue("--r")) || 0;
      return tf(x, y, rot, k);
    }

    function open(c) {
      source = c;
      const integrante = data.item(c.dataset.id);
      if (!integrante) return;
      card.innerHTML = window.BonnyPolaroid.html(integrante, 0);
      window.BonnyPolaroid.hydrate(card);
      box.hidden = false;
      fit();
      s = 1; r = 0; tx = 0; ty = 0;
      apply();
      void box.offsetWidth;
      box.classList.add("is-visible");
      card.animate([{ transform: fromSource() }, { transform: card.style.transform }], {
        duration: 420, easing: "cubic-bezier(0.2, 0.9, 0.3, 1.05)",
      });
      source.style.visibility = "hidden";
    }

    async function close() {
      if (box.hidden) return;
      box.classList.remove("is-visible");
      card.animate([{ transform: card.style.transform }, { transform: fromSource() }], {
        duration: 340, easing: "cubic-bezier(0.4, 0, 0.3, 1)", fill: "forwards",
      });
      await wait(340);
      source.style.visibility = "";
      card.getAnimations().forEach((a) => a.cancel());
      box.hidden = true;
      card.innerHTML = "";
      source = null;
    }

    const rotate = (x, y, deg) => {
      const a = (deg * Math.PI) / 180;
      return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
    };
    const center = () => [base.x + tx + base.w / 2, base.y + ty + base.h / 2];

    // pone la tarjeta de modo que el punto local q (desde su centro) quede bajo (px, py)
    function placeAt(px, py, q) {
      const [ox, oy] = rotate(q[0] * s, q[1] * s, r);
      tx = px - ox - base.x - base.w / 2;
      ty = py - oy - base.y - base.h / 2;
    }
    function localAt(px, py) {
      const [cx, cy] = center();
      const [lx, ly] = rotate(px - cx, py - cy, -r);
      return [lx / s, ly / s];
    }

    const stagePoint = (p) => {
      const st = stage.getBoundingClientRect();
      return [p.x - st.left, p.y - st.top];
    };

    function startPinch() {
      const [a, b] = [...pointers.values()];
      const [ax, ay] = stagePoint(a), [bx, by] = stagePoint(b);
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      pinch = {
        dist: Math.hypot(bx - ax, by - ay),
        angle: (Math.atan2(by - ay, bx - ax) * 180) / Math.PI,
        s0: s,
        r0: r,
        q: localAt(mx, my),
      };
    }

    stage.addEventListener("pointerdown", (e) => {
      try { stage.setPointerCapture(e.pointerId); } catch (_) {}
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      card.getAnimations().forEach((a) => a.cancel());
      if (pointers.size === 2) startPinch();
    });

    stage.addEventListener("pointermove", (e) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      const cur = { x: e.clientX, y: e.clientY };
      pointers.set(e.pointerId, cur);
      if (pointers.size >= 2 && pinch) {
        const [a, b] = [...pointers.values()];
        const [ax, ay] = stagePoint(a), [bx, by] = stagePoint(b);
        s = Math.max(0.6, Math.min(5, pinch.s0 * (Math.hypot(bx - ax, by - ay) / pinch.dist)));
        r = pinch.r0 + ((Math.atan2(by - ay, bx - ax) * 180) / Math.PI - pinch.angle);
        placeAt((ax + bx) / 2, (ay + by) / 2, pinch.q); // zoom, giro y arrastre a la vez
        apply();
      } else if (pointers.size === 1 && (s > 1.02 || Math.abs(r) > 0.5)) {
        tx += cur.x - prev.x;
        ty += cur.y - prev.y;
        apply();
      }
    });

    function settle() {
      const from = card.style.transform;
      if (s < 1) s = 1;
      if (Math.abs(r % 360) < 8) r = 0; // casi derecha: se endereza
      if (s <= 1.02) { tx = 0; ty = 0; }
      // que el centro no se salga de la pantalla
      const [cx, cy] = center();
      const W = stage.clientWidth, H = stage.clientHeight;
      tx += Math.min(W, Math.max(0, cx)) - cx;
      ty += Math.min(H, Math.max(0, cy)) - cy;
      apply();
      card.animate([{ transform: from }, { transform: card.style.transform }], { duration: 240, easing: "ease-out" });
    }

    function up(e) {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (pointers.size === 0) {
        // doble toque: acerca / vuelve a la normalidad
        if (e.type === "pointerup" && e.timeStamp - lastTap < 280) {
          const [px, py] = stagePoint({ x: e.clientX, y: e.clientY });
          if (s > 1.05 || r !== 0) { s = 1; r = 0; tx = 0; ty = 0; }
          else { const q = localAt(px, py); s = 2.5; placeAt(px, py, q); }
          lastTap = 0;
        } else {
          lastTap = e.timeStamp;
        }
        settle();
      }
    }
    stage.addEventListener("pointerup", up);
    stage.addEventListener("pointercancel", up);

    closeBtn.addEventListener("click", close);
    window.addEventListener("resize", () => { if (!box.hidden) { fit(); s = 1; r = 0; tx = 0; ty = 0; apply(); } });

    return { open };
  })();

  /* ---------- Llegada desde "primer baúl": las fotos vuelan al cofre ---------- */

  async function enterFromBaul(e) {
    const baulScene = document.querySelector(".baul");
    const minis = [...baulScene.querySelectorAll(".members__row .mini")];
    const ids = e.detail.photos.flatMap((p) => p.integrantes);

    // el primer cofre se crea con las fotos; si ya hay cofres, van al activo
    const target = data.baules.length ? data.baulActivo || data.baules[data.baules.length - 1] : data.crearBaul();
    data.guardarEnBaul(target.id, ids);
    data.activarBaul(target.id);

    // las mini fotos se copian a una capa encima de todo para que no desaparezcan
    const flies = minis.map((m) => {
      m.getAnimations().forEach((a) => a.finish()); // mide su posición final, no a mitad de su entrada
      const r = m.getBoundingClientRect();
      const f = document.createElement("div");
      f.className = "fly";
      Object.assign(f.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
      f.innerHTML = m.innerHTML;
      flying.appendChild(f);
      m.style.visibility = "hidden";
      return { f, r };
    });

    busy = true;
    render();
    scene.hidden = false;
    void scene.offsetWidth;
    scene.classList.add("is-in");
    baulScene.classList.add("is-leaving");

    const state = { t: 150 };
    window.BonnySplitChars?.(title, state, 30);
    title.classList.add("is-active");

    const el = chestEl(target.id);
    el.scrollIntoView({ block: "center" }); // el baúl activo se ve a primera vista
    const add = wall.querySelector(".sh-add");
    add.style.opacity = "0";

    await wait(750);
    baulScene.hidden = true;
    el.classList.add("is-open");
    audio.playChestOpen();
    await wait(300);

    // vuelan en arco hacia la boca del cofre y caen adentro
    const mouth = mouthOf(el);
    audio.playFlip(0.4);
    flies.forEach(({ f, r }, i) => {
      const dx = mouth.x - (r.left + r.width / 2);
      const dy = mouth.y - (r.top + r.height / 2);
      const s = (mouth.w * 0.55) / r.width;
      const spin = i % 2 ? 14 : -14;
      f.animate(
        [
          { transform: "none", opacity: 1 },
          { transform: `translate(${dx * 0.45}px, ${dy * 0.55 - 90}px) scale(0.8) rotate(${spin}deg)`, offset: 0.45 },
          { transform: `translate(${dx}px, ${dy - 30}px) scale(${s}) rotate(${-spin / 2}deg)`, opacity: 1, offset: 0.8 },
          { transform: `translate(${dx}px, ${dy + mouth.w * 0.12}px) scale(${s * 0.6})`, opacity: 0 },
        ],
        { duration: 1100, delay: i * 150, easing: "cubic-bezier(0.45, 0.05, 0.4, 1)", fill: "forwards" }
      );
    });
    await wait(1100 + flies.length * 150);
    flying.innerHTML = "";

    el.classList.remove("is-open");
    audio.playChestClose();
    bounce(el);

    add.style.opacity = "";
    add.animate([{ opacity: 0, transform: "scale(0.5)" }, { opacity: 1, transform: "none" }], {
      duration: 450, delay: 250, fill: "backwards", easing: "cubic-bezier(0.2, 0.9, 0.3, 1.4)",
    });
    await wait(400);
    busy = false;
    document.dispatchEvent(new CustomEvent("bonny:shelves"));
  }

  document.addEventListener("baul:continue", enterFromBaul);

  /* ---------- Recibir una foto desde otra pantalla (p. ej. la cámara) ---------- */

  // `el` es la polaroid en pantalla; vuela hasta el baúl y entra en él
  async function receive(el, baulId) {
    busy = true;
    render();
    const chest = chestEl(baulId);
    chest.scrollIntoView({ block: "center" });
    await wait(50);

    const r = el.getBoundingClientRect();
    const fly = document.createElement("div");
    fly.className = "fly";
    Object.assign(fly.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
    fly.innerHTML = el.querySelector(".mini__card")?.outerHTML || el.innerHTML; // polaroid u hoja de dibujo
    flying.appendChild(fly);
    el.style.visibility = "hidden";

    chest.classList.add("is-open");
    audio.playChestOpen();
    await wait(250);

    const mouth = mouthOf(chest);
    const dx = mouth.x - (r.left + r.width / 2);
    const dy = mouth.y - (r.top + r.height / 2);
    const s = (mouth.w * 0.55) / r.width;
    audio.playFlip(0.45);
    fly.animate(
      [
        { transform: "rotate(-2deg)", opacity: 1 },
        { transform: `translate(${dx * 0.4}px, ${dy * 0.5 - 70}px) scale(0.6) rotate(10deg)`, offset: 0.45 },
        { transform: `translate(${dx}px, ${dy - 26}px) scale(${s}) rotate(-4deg)`, opacity: 1, offset: 0.82 },
        { transform: `translate(${dx}px, ${dy + mouth.w * 0.12}px) scale(${s * 0.6})`, opacity: 0 },
      ],
      { duration: 1150, easing: "cubic-bezier(0.45, 0.05, 0.4, 1)", fill: "forwards" }
    );
    await wait(1150);
    fly.remove();

    chest.classList.remove("is-open");
    audio.playChestClose();
    bounce(chest);
    await wait(350);
    busy = false;
  }

  window.BonnyShelves = { receive, render };
})();

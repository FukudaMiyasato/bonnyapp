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
  const backBtn = view.querySelector(".cv-back");
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
  async function flyChest(fromEl, toEl, color, duration = 650) {
    const a = boxOf(fromEl).getBoundingClientRect();
    const b = boxOf(toEl).getBoundingClientRect();
    const clone = document.createElement("div");
    clone.className = "chest fly";
    Object.assign(clone.style, { left: a.left + "px", top: a.top + "px", width: a.width + "px", transformOrigin: "0 0" });
    clone.innerHTML = boxHTML(color);
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

  const miniHTML = (integrante, rot) => `
    <div class="mini__card" style="--r:${rot}deg">
      <img class="mini__photo" src="${integrante.foto}" alt="Integrante" />
      <img class="mini__frame" src="assets/img/photo-mini.webp" alt="" draggable="false" />
    </div>`;

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
    cvTitle.textContent = baul.nombre;
    cvTitle.hidden = false;
    titleInput.hidden = true;
    cvChest.innerHTML = boxHTML(baul.color);
    colorBtns.forEach((b) => b.setAttribute("aria-checked", String(b.dataset.color === baul.color)));
    activateBtn.classList.toggle("is-hidden", data.baulActivo?.id === baul.id);
    resetDelete();

    grid.innerHTML = "";
    const fotos = baul.integrantes.map(data.integrante).filter(Boolean);
    fotos.forEach((f) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "cv-card";
      card.setAttribute("aria-label", "Ver foto");
      card.innerHTML = miniHTML(f, (Math.random() * 12 - 6).toFixed(1));
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
    const cards = [...grid.children];
    cards.forEach((c) => (c.style.visibility = "hidden"));
    cvChest.classList.add("is-hidden");
    view.classList.remove("is-leaving");
    view.hidden = false;
    scroller.scrollTop = 0;
    void view.offsetWidth;
    view.classList.add("is-visible");
    document.dispatchEvent(new CustomEvent("bonny:chest", { detail: { open: true } }));

    // el cofre sube a la esquina superior izquierda del baúl abierto
    shelfEl.style.visibility = "hidden";
    audio.playFlip(0.35);
    const clone = await flyChest(shelfEl, cvChest, baul.color);
    cvChest.classList.remove("is-hidden");
    clone.remove();

    // se abre y las fotos salen hacia su lugar
    cvChest.classList.add("is-open");
    audio.playChestOpen();
    await wait(250);
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
    const baul = openBaul();

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
    const clone = await flyChest(cvChest, shelfEl, baul.color, 600);
    shelfEl.style.visibility = "";
    clone.remove();
    bounce(shelfEl);

    finishView();
    busy = false;
  }

  function finishView() {
    view.hidden = true;
    view.classList.remove("is-visible", "is-leaving", "is-empty");
    grid.innerHTML = "";
    cvChest.innerHTML = "";
    cvChest.classList.remove("is-hidden");
    openId = null;
    document.dispatchEvent(new CustomEvent("bonny:chest", { detail: { open: false } }));
  }

  backBtn.addEventListener("click", closeChest);

  /* ---------- Editar título ---------- */

  function startEdit() {
    if (!openId || busy) return;
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

  /* ---------- Foto ampliada con zoom de dos dedos ---------- */

  const Lightbox = (() => {
    const box = document.querySelector(".lightbox");
    const stage = box.querySelector(".lightbox__stage");
    const img = box.querySelector(".lightbox__img");
    const closeBtn = box.querySelector(".lightbox__close");
    let card = null;
    let base = null;            // posición/tamaño de la foto sin zoom
    let s = 1, tx = 0, ty = 0;  // zoom y desplazamiento
    const pointers = new Map();
    let pinch = null;
    let lastTap = 0;

    const apply = () => {
      img.style.transform = `translate(${base.x + tx}px, ${base.y + ty}px) scale(${s})`;
    };

    function fit() {
      const W = stage.clientWidth, H = stage.clientHeight;
      const aspect = img.naturalWidth / img.naturalHeight || 863 / 759;
      let w = W * 0.94, h = w / aspect;
      if (h > H * 0.78) { h = H * 0.78; w = h * aspect; }
      base = { w, h, x: (W - w) / 2, y: (H - h) / 2 };
      img.style.width = w + "px";
      img.style.height = h + "px";
    }

    function photoRect() {
      return card.querySelector(".mini__photo").getBoundingClientRect();
    }

    async function open(c) {
      card = c;
      img.src = c.querySelector(".mini__photo").src;
      box.hidden = false;
      await img.decode().catch(() => {});
      fit();
      s = 1; tx = 0; ty = 0;
      apply();
      void box.offsetWidth;
      box.classList.add("is-visible");
      // crece desde la mini foto
      const r = photoRect();
      const st = stage.getBoundingClientRect();
      img.animate(
        [
          { transform: `translate(${r.left - st.left}px, ${r.top - st.top}px) scale(${r.width / base.w})` },
          { transform: `translate(${base.x}px, ${base.y}px) scale(1)` },
        ],
        { duration: 380, easing: "cubic-bezier(0.2, 0.9, 0.3, 1.05)" }
      );
      card.style.visibility = "hidden";
    }

    async function close() {
      if (box.hidden) return;
      box.classList.remove("is-visible");
      const r = photoRect();
      const st = stage.getBoundingClientRect();
      img.animate(
        [
          { transform: img.style.transform },
          { transform: `translate(${r.left - st.left}px, ${r.top - st.top}px) scale(${r.width / base.w})` },
        ],
        { duration: 320, easing: "cubic-bezier(0.4, 0, 0.3, 1)", fill: "forwards" }
      );
      await wait(320);
      card.style.visibility = "";
      img.getAnimations().forEach((a) => a.cancel());
      box.hidden = true;
      card = null;
    }

    // eje: si la foto cabe, se centra; si es más grande, no deja ver bordes vacíos
    function clampAxis(t, baseStart, size, view) {
      const shown = size * s;
      if (shown <= view) return (view - shown) / 2 - baseStart;
      return Math.min(-baseStart, Math.max(view - shown - baseStart, t));
    }

    function settle() {
      if (s < 1) { s = 1; tx = 0; ty = 0; }
      const from = img.style.transform;
      tx = clampAxis(tx, base.x, base.w, stage.clientWidth);
      ty = clampAxis(ty, base.y, base.h, stage.clientHeight);
      apply();
      img.animate([{ transform: from }, { transform: img.style.transform }], { duration: 220, easing: "ease-out" });
    }

    function zoomAt(px, py, newS) {
      // mantiene fijo el punto (px, py) de la pantalla mientras cambia el zoom
      const ix = (px - base.x - tx) / s;
      const iy = (py - base.y - ty) / s;
      s = newS;
      tx = px - base.x - ix * s;
      ty = py - base.y - iy * s;
    }

    stage.addEventListener("pointerdown", (e) => {
      try { stage.setPointerCapture(e.pointerId); } catch (_) {}
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const st = stage.getBoundingClientRect();
        pinch = {
          dist: Math.hypot(a.x - b.x, a.y - b.y),
          s0: s,
          mx: (a.x + b.x) / 2 - st.left,
          my: (a.y + b.y) / 2 - st.top,
          tx0: tx,
          ty0: ty,
        };
      }
    });

    stage.addEventListener("pointermove", (e) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      const cur = { x: e.clientX, y: e.clientY };
      pointers.set(e.pointerId, cur);
      if (pointers.size >= 2 && pinch) {
        const [a, b] = [...pointers.values()];
        const st = stage.getBoundingClientRect();
        const mx = (a.x + b.x) / 2 - st.left;
        const my = (a.y + b.y) / 2 - st.top;
        const ns = Math.max(0.7, Math.min(5, pinch.s0 * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.dist)));
        s = pinch.s0; tx = pinch.tx0; ty = pinch.ty0;
        zoomAt(pinch.mx, pinch.my, ns);
        tx += mx - pinch.mx; // también se puede arrastrar con los dos dedos
        ty += my - pinch.my;
        apply();
      } else if (pointers.size === 1 && s > 1) {
        tx += cur.x - prev.x;
        ty += cur.y - prev.y;
        apply();
      }
    });

    function up(e) {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (pointers.size === 0) {
        // doble toque: acerca / aleja
        const now = e.timeStamp;
        if (e.type === "pointerup" && now - lastTap < 280) {
          const st = stage.getBoundingClientRect();
          if (s > 1.05) { s = 1; tx = 0; ty = 0; } else zoomAt(e.clientX - st.left, e.clientY - st.top, 2.5);
          lastTap = 0;
        } else {
          lastTap = now;
        }
        settle();
      }
    }
    stage.addEventListener("pointerup", up);
    stage.addEventListener("pointercancel", up);

    closeBtn.addEventListener("click", close);
    window.addEventListener("resize", () => { if (!box.hidden) { fit(); s = 1; tx = 0; ty = 0; apply(); } });

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
})();

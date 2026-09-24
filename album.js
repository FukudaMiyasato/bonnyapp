/* Selector baúles / álbum / mapa y el álbum: páginas que se pasan con las fotos
   de todos los baúles; cada foto se arrastra con un dedo y se agranda/gira con dos. */
(() => {
  const data = window.BonnyData;
  const audio = window.BonnyAudio;
  const shelves = document.querySelector(".shelves");
  const wall = shelves.querySelector(".shelves__wall");
  const sw = shelves.querySelector(".sh-switch");
  const opts = [...sw.querySelectorAll(".sh-switch__opt")];
  const album = shelves.querySelector(".album");
  const book = album.querySelector(".album__book");
  const counter = album.querySelector(".album__count");
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const PER_PAGE = 4;
  const ASPECT = 832 / 1254; // la hoja de papel
  // lugares iniciales de las fotos en cada página: x, y (fracción de la hoja) y giro
  const SLOTS = [[0.3, 0.26, -6], [0.7, 0.31, 5], [0.31, 0.69, 4], [0.69, 0.74, -5]];

  let view = "baules";
  let pages = [];
  let current = 0;
  let pageW = 0, pageH = 0;

  /* ---------- Selector ---------- */

  function setView(next) {
    if (next === "mapa") {
      // el mapa llega después
      const btn = opts.find((o) => o.dataset.view === "mapa");
      btn.classList.remove("is-soon");
      void btn.offsetWidth;
      btn.classList.add("is-soon");
      btn.textContent = "pronto";
      audio.playTick();
      setTimeout(() => (btn.textContent = "mapa"), 1400);
      return;
    }
    if (next === view) return;
    view = next;
    opts.forEach((o) => o.setAttribute("aria-selected", String(o.dataset.view === view)));
    sw.style.setProperty("--i", opts.findIndex((o) => o.dataset.view === view));
    audio.playTick();
    if (view === "album") showAlbum();
    else hideAlbum();
  }
  opts.forEach((o) => o.addEventListener("click", () => setView(o.dataset.view)));
  // p. ej. al guardar un recuerdo nuevo, se vuelve a la vista de baúles
  document.addEventListener("bonny:set-view", (e) => setView(e.detail.view));

  async function showAlbum() {
    wall.scrollTo({ top: 0, behavior: "smooth" });
    shelves.classList.add("is-album");
    album.hidden = false;
    build();
    void album.offsetWidth;
    album.classList.add("is-in");
    // las páginas aparecen como un libro que se abre
    book.animate(
      [{ transform: "translateY(24px) rotateX(18deg) scale(0.92)", opacity: 0 }, { transform: "none", opacity: 1 }],
      { duration: 550, easing: "cubic-bezier(0.25, 0.9, 0.3, 1.05)" }
    );
    audio.playFlip(0.5);
  }

  async function hideAlbum() {
    shelves.classList.remove("is-album");
    album.classList.remove("is-in");
    await wait(350);
    if (view !== "album") {
      album.hidden = true;
      book.innerHTML = "";
    }
  }

  /* ---------- Construir el álbum ---------- */

  // todo lo que hay en todos los baúles (recuerdos y miembros), en orden de llegada
  function items() {
    const ids = [...new Set(data.baules.flatMap((b) => [...(b.recuerdos || []), ...(b.integrantes || [])]))];
    return ids.map(data.item).filter(Boolean).sort((a, b) => a.creado.localeCompare(b.creado));
  }

  // posición guardada de cada foto: página (p), centro (x, y en fracción de la hoja), escala, giro y capa
  function assignLayouts(list) {
    const perPage = {};
    list.forEach((it, i) => {
      const l = data.album[it.id];
      if (l && l.p === undefined) l.p = Math.floor(i / PER_PAGE); // guardadas antes de tener página
      if (l) perPage[l.p] = (perPage[l.p] || 0) + 1;
    });
    list.forEach((it) => {
      if (data.album[it.id]) return;
      // lo nuevo va a la última hoja con espacio, o a una hoja nueva
      const last = Math.max(0, ...Object.keys(perPage).map(Number));
      const p = (perPage[last] || 0) < PER_PAGE ? last : last + 1;
      const k = perPage[p] || 0;
      const [x, y, r] = SLOTS[k % PER_PAGE];
      data.album[it.id] = { p, x, y, s: 1, r: r + (Math.random() * 4 - 2), z: k };
      perPage[p] = k + 1;
    });
  }

  function place(el, l) {
    const w = pageW * 0.44, h = w * parseFloat(el.dataset.ratio || 1206 / 1023);
    el.style.transform = `translate(${l.x * pageW - w / 2}px, ${l.y * pageH - h / 2}px) rotate(${l.r}deg) scale(${l.s})`;
    el.style.zIndex = l.z;
  }

  function makePage(n) {
    const page = document.createElement("div");
    page.className = "album__page";
    const face = document.createElement("div");
    face.className = "album__face";
    face.dataset.n = `${n + 1}`;
    page.appendChild(face);
    return page;
  }

  function restack() {
    pages.forEach((pg, i) => (pg.style.zIndex = pages.length - i)); // las primeras hojas quedan encima
  }

  function makeItem(item) {
    const el = document.createElement("div");
    el.className = "album__photo";
    el.dataset.id = item.id;
    if (item.medio === "dibujo") {
      // en el álbum el dibujo va sin papel: solo el trazo en PNG transparente
      el.classList.add("is-dibujo");
      el.dataset.ratio = String(1208 / 772);
      el.innerHTML = '<div class="mini__card is-dibujo"><img class="mini__photo album__drawing" alt="Dibujo" draggable="false" /></div>';
      const img = el.querySelector("img");
      data.fotoURL(item.id + ":poster").then((url) => url || data.fotoURL(item.id)).then((url) => url && (img.src = url));
    } else {
      el.innerHTML = window.BonnyPolaroid.html(item, 0);
    }
    return el;
  }

  function build() {
    // tamaño de la hoja según el espacio disponible
    const availH = album.clientHeight - 34;
    const availW = album.clientWidth * 0.88;
    pageH = Math.min(availH, availW / ASPECT);
    pageW = pageH * ASPECT;
    book.style.width = pageW + "px";
    book.style.height = pageH + "px";

    book.innerHTML = "";
    const list = items();
    assignLayouts(list);
    const count = Math.max(1, ...list.map((it) => data.album[it.id].p + 1));
    pages = [];
    for (let p = 0; p < count; p++) {
      const page = makePage(p);
      book.appendChild(page);
      pages.push(page);
    }
    restack();
    list.forEach((item) => {
      const l = data.album[item.id];
      const el = makeItem(item);
      place(el, l);
      pages[l.p].firstChild.appendChild(el);
    });
    if (!list.length) {
      pages[0].firstChild.insertAdjacentHTML("beforeend", '<p class="album__empty">aún no hay recuerdos en tus baúles</p>');
    }

    // bordes que se iluminan al sostener una foto para cambiar de hoja
    ["left", "right"].forEach((side) => {
      const edge = document.createElement("div");
      edge.className = `album__edge album__edge--${side}`;
      book.appendChild(edge);
    });
    carry = document.createElement("div");
    carry.className = "album__carry";
    book.appendChild(carry);

    data.guardarAlbum();
    window.BonnyPolaroid.hydrate(book);
    current = Math.min(current, count - 1);
    pages.forEach((pg, i) => pg.classList.toggle("is-turned", i < current));
    updatePage();
  }

  function updatePage() {
    pages.forEach((pg, i) => pg.classList.toggle("is-current", i === current));
    counter.textContent = `${current + 1} / ${pages.length}`;
  }

  function turn(dir) {
    const next = current + dir;
    if (next < 0 || next >= pages.length) {
      // sin más hojas: un pequeño rebote
      book.animate([{ transform: "translateX(0)" }, { transform: `translateX(${-dir * 10}px)` }, { transform: "translateX(0)" }], { duration: 300 });
      return false;
    }
    if (dir > 0) pages[current].classList.add("is-turned");
    else pages[next].classList.remove("is-turned");
    current = next;
    updatePage();
    audio.playFlip(0.7);
    return true;
  }

  /* ---------- Gestos: fotos y pase de página ---------- */

  const pointers = new Map();
  let g = null;      // gesto en curso
  let carry = null;  // capa donde viaja la foto mientras la hoja se da vuelta
  const HOLD_MS = 900;
  const EDGE = 0.13; // ancho de la zona del borde (fracción de la hoja)

  function startPhotoPinch() {
    const [a, b] = [...pointers.values()];
    g.pinch = {
      dist: Math.hypot(b.x - a.x, b.y - a.y),
      angle: Math.atan2(b.y - a.y, b.x - a.x),
      mx: (a.x + b.x) / 2,
      my: (a.y + b.y) / 2,
      s0: g.l.s,
      r0: g.l.r,
      x0: g.l.x,
      y0: g.l.y,
    };
  }

  /* --- sostener la foto en un borde: cambia de hoja --- */

  function edgeEl(side) { return book.querySelector(`.album__edge--${side}`); }

  function clearEdge() {
    if (!g?.edge) return;
    clearTimeout(g.edgeTimer);
    edgeEl(g.edge)?.classList.remove("is-hot", "is-arming");
    g.edge = null;
  }

  function checkEdge(x) {
    const r = book.getBoundingClientRect();
    let side = null;
    // a la derecha de la última hoja solo se crea una nueva si esta tiene otras fotos
    const lastHasOthers = [...pages[current].querySelectorAll(".album__photo")].some((p) => p !== g.el);
    if (x < r.left + r.width * EDGE && current > 0) side = "left";
    else if (x > r.right - r.width * EDGE && (current < pages.length - 1 || lastHasOthers)) side = "right";
    if (side === g.edge) return;
    clearEdge();
    if (!side || g.flipping) return;
    g.edge = side;
    const el = edgeEl(side);
    el.classList.add("is-hot");
    void el.offsetWidth;
    el.classList.add("is-arming"); // el brillo se va llenando mientras se sostiene
    g.edgeTimer = setTimeout(() => carryTo(side === "right" ? 1 : -1), HOLD_MS);
  }

  async function carryTo(dir) {
    const d = g;
    if (!d || d.type !== "photo" || d.flipping) return;
    clearEdge();
    d.flipping = true;
    // la foto sale de la hoja y viaja por encima mientras la hoja se da vuelta
    carry.appendChild(d.el);
    if (dir > 0 && current === pages.length - 1) {
      const page = makePage(pages.length);
      book.insertBefore(page, book.querySelector(".album__edge"));
      pages.push(page);
      restack();
    }
    turn(dir);
    d.l.p = current;
    audio.playTick();
    await wait(820);
    if (d.el.parentElement === carry) pages[d.l.p].firstChild.appendChild(d.el);
    d.flipping = false;
    // si el dedo sigue en el borde, puede seguir pasando hojas
    if (g === d) { const pt = [...pointers.values()][0]; if (pt) checkEdge(pt.x); }
  }

  book.addEventListener("pointerdown", (e) => {
    try { book.setPointerCapture(e.pointerId); } catch (_) {}
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 1) {
      const photo = e.target.closest(".album__photo");
      if (photo && pages[current].contains(photo)) {
        const l = data.album[photo.dataset.id];
        // la foto tocada queda encima de las demás
        const maxZ = Math.max(0, ...[...pages[current].querySelectorAll(".album__photo")].map((p) => data.album[p.dataset.id].z));
        l.z = maxZ + 1;
        place(photo, l);
        photo.classList.add("is-held");
        g = { type: "photo", el: photo, l, x0: e.clientX, y0: e.clientY, lx: l.x, ly: l.y, moved: false };
      } else {
        g = { type: "page", x0: e.clientX, y0: e.clientY };
      }
    } else if (pointers.size === 2 && g?.type === "photo") {
      g.moved = true;
      clearEdge();
      startPhotoPinch();
    }
  });

  book.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId) || !g) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (g.type !== "photo") return;
    const clamp = (v) => Math.max(0.05, Math.min(0.95, v));

    if (pointers.size >= 2 && g.pinch) {
      const [a, b] = [...pointers.values()];
      const p = g.pinch;
      g.l.s = Math.max(0.5, Math.min(2.4, p.s0 * (Math.hypot(b.x - a.x, b.y - a.y) / p.dist)));
      g.l.r = p.r0 + ((Math.atan2(b.y - a.y, b.x - a.x) - p.angle) * 180) / Math.PI;
      g.l.x = clamp(p.x0 + ((a.x + b.x) / 2 - p.mx) / pageW);
      g.l.y = clamp(p.y0 + ((a.y + b.y) / 2 - p.my) / pageH);
    } else if (pointers.size === 1 && !g.pinch) {
      const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
      if (Math.hypot(dx, dy) > 6) g.moved = true;
      g.l.x = clamp(g.lx + dx / pageW);
      g.l.y = clamp(g.ly + dy / pageH);
      if (g.moved) checkEdge(e.clientX);
    }
    place(g.el, g.l);
  });

  async function onUp(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (!g) return;
    if (g.type === "photo" && pointers.size === 1) {
      // queda un dedo: sigue arrastrando desde donde está
      const [rest] = [...pointers.values()];
      g.pinch = null;
      g.x0 = rest.x; g.y0 = rest.y; g.lx = g.l.x; g.ly = g.l.y;
      return;
    }
    if (pointers.size > 0) return;

    const d = g;
    g = null;
    if (d.type === "photo") {
      if (d.edge) { clearTimeout(d.edgeTimer); edgeEl(d.edge)?.classList.remove("is-hot", "is-arming"); }
      d.el.classList.remove("is-held");
      if (d.flipping) await wait(830); // se suelta mientras la hoja gira: se queda en la nueva
      if (d.el.parentElement === carry) pages[d.l.p].firstChild.appendChild(d.el);
      data.guardarAlbum();
      // un toque sin mover: se abre la foto
      if (!d.moved && e.type === "pointerup") window.BonnyLightbox?.open(d.el);
    } else if (d.type === "page" && e.type === "pointerup") {
      const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) turn(dx < 0 ? 1 : -1);
    }
  }
  book.addEventListener("pointerup", onUp);
  book.addEventListener("pointercancel", onUp);

  // al volver a la sección de baúles desde otra página, el álbum se actualiza
  document.addEventListener("bonny:nav", (e) => {
    if (e.detail.page === "baules" && view === "album") build();
  });
  window.addEventListener("resize", () => { if (view === "album") build(); });
})();

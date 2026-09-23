/* Escena 3: "Mis baúles de recuerdos" — repisas con cofres. */
(() => {
  const scene = document.querySelector(".shelves");
  const wall = scene.querySelector(".shelves__wall");
  const top = scene.querySelector(".sh-top");
  const bottom = scene.querySelector(".sh-bottom");
  const title = scene.querySelector(".shelves__title");
  const view = scene.querySelector(".chest-view");
  const viewTitle = view.querySelector(".chest-view__title");
  const grid = view.querySelector(".chest-view__grid");
  const closeBtn = view.querySelector(".chest-view__close");
  const deleteBtn = view.querySelector(".chest-view__delete");
  const flying = document.querySelector(".flying");
  const data = window.BonnyData;
  const audio = window.BonnyAudio;

  const PER_ROW = 4; // cofres por repisa; el "+" también ocupa un lugar
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  let busy = false;

  /* ---------- Repisas ---------- */

  function makeChest(baul) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "chest";
    el.dataset.id = baul.id;
    el.setAttribute("aria-label", `Abrir ${baul.nombre}`);
    el.innerHTML = `
      <span class="chest__label">${esc(baul.nombre)}</span>
      <span class="chest__box">
        <span class="chest__glow"></span>
        <img class="chest__lid" src="assets/img/cofre_sup.webp" alt="" draggable="false" />
        <span class="chest__inside"></span>
        <img class="chest__body" src="assets/img/cofre_inf.webp" alt="" draggable="false" />
      </span>`;
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

  function markActive() {
    const active = data.baulActivo?.id;
    wall.querySelectorAll(".chest").forEach((c) => c.classList.toggle("is-active", c.dataset.id === active));
  }

  function bounce(el) {
    el.querySelector(".chest__box").animate(
      [
        { transform: "scale(1, 1)" },
        { transform: "scale(1.08, 0.9)", offset: 0.3 },
        { transform: "scale(0.96, 1.05)", offset: 0.6 },
        { transform: "scale(1, 1)" },
      ],
      { duration: 450, easing: "ease-out" }
    );
  }

  /* ---------- Crear un cofre ---------- */

  async function addChest() {
    if (busy) return;
    busy = true;
    const baul = data.crearBaul(); // queda como activo
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

  /* ---------- Abrir un cofre y ver sus fotos ---------- */

  const miniHTML = (integrante, rot) => `
    <div class="mini__card" style="--r:${rot}deg">
      <img class="mini__photo" src="${integrante.foto}" alt="Integrante" />
      <img class="mini__frame" src="assets/img/photo-mini.webp" alt="" draggable="false" />
    </div>`;

  let openId = null;

  function chestMouth(el) {
    const r = el.querySelector(".chest__box").getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height * 0.45, w: r.width };
  }

  // Copia de una foto en la capa superior (encima de repisas y del cofre),
  // así ningún contenedor la recorta mientras vuela
  function cloneAt(card) {
    const r = card.getBoundingClientRect();
    const f = document.createElement("div");
    f.className = "fly";
    Object.assign(f.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
    f.innerHTML = card.innerHTML;
    flying.appendChild(f);
    return { f, r };
  }

  async function openChest(id) {
    if (busy || openId) return;
    busy = true;
    openId = id;
    data.activarBaul(id);
    markActive();
    document.dispatchEvent(new CustomEvent("bonny:chest", { detail: { open: true } }));

    const baul = data.baules.find((b) => b.id === id);
    const el = chestEl(id);
    el.classList.add("is-open");
    audio.playChestOpen();

    const fotos = baul.integrantes.map(data.integrante).filter(Boolean);
    viewTitle.textContent = baul.nombre;
    grid.innerHTML = "";
    fotos.forEach((f) => {
      const card = document.createElement("div");
      card.className = "cv-card";
      card.innerHTML = miniHTML(f, (Math.random() * 12 - 6).toFixed(1));
      grid.appendChild(card);
    });
    resetDelete();
    view.classList.toggle("is-empty", fotos.length === 0);
    view.hidden = false;
    void view.offsetWidth;
    view.classList.add("is-visible");

    // las fotos salen del cofre hacia su lugar
    const mouth = chestMouth(el);
    const gridBox = grid.getBoundingClientRect();
    const cards = [...grid.children];
    let longest = 0;
    cards.forEach((card, i) => {
      const cr = card.getBoundingClientRect();
      if (cr.bottom < gridBox.top || cr.top > gridBox.bottom) return; // fuera de la vista: aparece sin volar
      card.style.visibility = "hidden";
      const { f, r } = cloneAt(card);
      const dx = mouth.x - (r.left + r.width / 2);
      const dy = mouth.y - (r.top + r.height / 2);
      const delay = 200 + i * 80;
      longest = Math.max(longest, delay + 750);
      f.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(0.15)`, opacity: 0 },
          { opacity: 1, offset: 0.25 },
          { transform: `translate(${dx * 0.3}px, ${dy * 0.5 - 60}px) scale(0.7) rotate(${i % 2 ? 8 : -8}deg)`, offset: 0.55 },
          { transform: "none", opacity: 1 },
        ],
        { duration: 750, delay, easing: "cubic-bezier(0.25, 0.8, 0.3, 1.1)", fill: "both" }
      );
      setTimeout(() => { card.style.visibility = ""; f.remove(); }, delay + 750);
    });
    await wait(Math.max(400, longest));
    busy = false;
  }

  // Devuelve las fotos visibles al cofre; true si hubo vuelo
  async function photosBackToChest(el) {
    const mouth = chestMouth(el);
    const gridBox = grid.getBoundingClientRect();
    const cards = [...grid.children].reverse().filter((card) => {
      const cr = card.getBoundingClientRect();
      return cr.bottom > gridBox.top && cr.top < gridBox.bottom;
    });
    cards.forEach((card, i) => {
      const { f, r } = cloneAt(card);
      card.style.visibility = "hidden";
      const dx = mouth.x - (r.left + r.width / 2);
      const dy = mouth.y - (r.top + r.height / 2);
      f.animate(
        [
          { transform: "none", opacity: 1 },
          { transform: `translate(${dx * 0.4}px, ${dy * 0.6 - 50}px) scale(0.6)`, opacity: 1, offset: 0.5 },
          { transform: `translate(${dx}px, ${dy - 6}px) scale(0.18)`, opacity: 1, offset: 0.85 },
          { transform: `translate(${dx}px, ${dy + 8}px) scale(0.1)`, opacity: 0 },
        ],
        { duration: 600, delay: i * 50, easing: "cubic-bezier(0.5, 0, 0.6, 1)", fill: "forwards" }
      );
    });
    grid.querySelectorAll(".cv-card").forEach((c) => (c.style.visibility = "hidden"));
    view.classList.remove("is-visible");
    await wait(600 + cards.length * 50);
    flying.innerHTML = "";
  }

  async function closeChest() {
    if (busy || !openId) return;
    busy = true;
    const el = chestEl(openId);
    await photosBackToChest(el);

    el.classList.remove("is-open");
    audio.playChestClose();
    bounce(el);
    await wait(350);
    view.hidden = true;
    grid.innerHTML = "";
    openId = null;
    busy = false;
    document.dispatchEvent(new CustomEvent("bonny:chest", { detail: { open: false } }));
  }

  closeBtn.addEventListener("click", closeChest);
  view.querySelector(".chest-view__backdrop").addEventListener("click", closeChest);

  /* ---------- Eliminar un baúl (con confirmación de dos toques) ---------- */

  let confirmTimer = null;
  function resetDelete() {
    clearTimeout(confirmTimer);
    deleteBtn.classList.remove("is-confirming");
    deleteBtn.textContent = "eliminar baúl";
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
    const el = chestEl(id);

    // las fotos se desvanecen, la tapa se cierra y el cofre desaparece en una nube
    grid.querySelectorAll(".cv-card").forEach((c) =>
      c.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(0.8)" }], { duration: 300, fill: "forwards" })
    );
    view.classList.remove("is-visible");
    await wait(300);
    view.hidden = true;
    grid.innerHTML = "";
    el.classList.remove("is-open");
    audio.playChestClose();
    await wait(200);

    el.animate(
      [
        { transform: "none", opacity: 1, filter: "none" },
        { transform: "rotate(-6deg)", offset: 0.15 },
        { transform: "rotate(6deg)", offset: 0.3 },
        { transform: "rotate(-4deg) scale(1.05)", offset: 0.45 },
        { transform: "scale(0.2) translateY(20px)", opacity: 0, filter: "blur(4px)" },
      ],
      { duration: 700, easing: "ease-in", fill: "forwards" }
    );
    puff(el);
    audio.playFlip(0.6);
    await wait(700);

    data.eliminarBaul(id);
    openId = null;
    render();
    busy = false;
    document.dispatchEvent(new CustomEvent("bonny:chest", { detail: { open: false } }));
  });

  // pequeña nube de polvo donde estaba el cofre
  function puff(el) {
    const r = el.querySelector(".chest__box").getBoundingClientRect();
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
      ).onfinish = () => p.remove();
    }
  }

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
    const mouth = chestMouth(el);
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

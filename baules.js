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

  async function openChest(id) {
    if (busy || openId) return;
    busy = true;
    openId = id;
    data.activarBaul(id);
    markActive();

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
    view.classList.toggle("is-empty", fotos.length === 0);
    view.hidden = false;
    void view.offsetWidth;
    view.classList.add("is-visible");

    // las fotos salen del cofre hacia su lugar
    const mouth = chestMouth(el);
    [...grid.children].forEach((card, i) => {
      const r = card.getBoundingClientRect();
      const dx = mouth.x - (r.left + r.width / 2);
      const dy = mouth.y - (r.top + r.height / 2);
      card.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(0.15)`, opacity: 0 },
          { opacity: 1, offset: 0.25 },
          { transform: `translate(${dx * 0.3}px, ${dy * 0.5 - 60}px) scale(0.7) rotate(${i % 2 ? 8 : -8}deg)`, offset: 0.55 },
          { transform: "none", opacity: 1 },
        ],
        { duration: 750, delay: 200 + i * 80, easing: "cubic-bezier(0.25, 0.8, 0.3, 1.1)", fill: "backwards" }
      );
    });
    await wait(400);
    busy = false;
  }

  async function closeChest() {
    if (busy || !openId) return;
    busy = true;
    const el = chestEl(openId);
    const mouth = chestMouth(el);
    const cards = [...grid.children].reverse();

    // vuelven a entrar al cofre
    cards.forEach((card, i) => {
      const r = card.getBoundingClientRect();
      const dx = mouth.x - (r.left + r.width / 2);
      const dy = mouth.y - (r.top + r.height / 2);
      card.animate(
        [
          { transform: "none", opacity: 1 },
          { transform: `translate(${dx * 0.4}px, ${dy * 0.6 - 50}px) scale(0.6)`, opacity: 1, offset: 0.5 },
          { transform: `translate(${dx}px, ${dy}px) scale(0.12)`, opacity: 0 },
        ],
        { duration: 550, delay: i * 50, easing: "cubic-bezier(0.5, 0, 0.6, 1)", fill: "forwards" }
      );
    });
    view.classList.remove("is-visible");
    await wait(550 + cards.length * 50);

    el.classList.remove("is-open");
    audio.playChestClose();
    bounce(el);
    await wait(350);
    view.hidden = true;
    grid.innerHTML = "";
    openId = null;
    busy = false;
  }

  closeBtn.addEventListener("click", closeChest);
  view.querySelector(".chest-view__backdrop").addEventListener("click", closeChest);

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
  }

  document.addEventListener("baul:continue", enterFromBaul);
})();

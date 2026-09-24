/* Botonera inferior: secciones + morral central con rueda de sub botones. */
(() => {
  const dock = document.querySelector(".dock");
  const catcher = document.querySelector(".dock-catcher");
  const sphere = dock.querySelector(".dock__sphere");
  const label = dock.querySelector(".dock__label");
  const items = [...dock.querySelectorAll(".wheel__item")];
  const bag = dock.querySelector(".dock__bag");
  const navBtns = [...dock.querySelectorAll(".dock__btn")];
  const audio = window.BonnyAudio;

  const STEP = 52;        // grados entre sub botones
  const RADIUS = 0.366;   // radio de la rueda, en proporción al ancho
  const n = items.length;
  const TAP_SLOP = 14;    // px que el dedo puede moverse y seguir contando como toque

  let rot = 1;            // índice (con decimales) del sub botón que está arriba
  let shown = 1;
  let tween = null;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const radius = () => dock.clientWidth * RADIUS;

  /* ---------- Rueda ---------- */

  function layout() {
    const r = radius();
    items.forEach((el, i) => {
      const a = (i - rot) * STEP;
      const rad = (a * Math.PI) / 180;
      const x = r * Math.sin(rad);
      const y = r * Math.cos(rad);
      const near = Math.max(0, 1 - Math.abs(i - rot)); // 1 = arriba al centro
      const scale = 0.9 + 0.1 * near;                   // los no activos, 10% más chicos
      const fade = clamp(1 - (Math.abs(a) - 62) / 34, 0, 1);
      el.style.transform =
        `translate(-50%, 50%) translate(${x}px, ${-y}px) rotate(${a * 0.5}deg) scale(${scale})`;
      el.style.opacity = fade;
      el.style.zIndex = Math.round(near * 10);
      el.tabIndex = fade > 0.5 ? 0 : -1;
    });

    const idx = clamp(Math.round(rot), 0, n - 1);
    if (idx !== shown) {
      shown = idx;
      label.textContent = items[idx].dataset.name;
      label.animate(
        [{ opacity: 0, transform: "translateX(-50%) translateY(6px) scale(0.9)" }, { opacity: 1, transform: "translateX(-50%)" }],
        { duration: 220, easing: "ease-out" }
      );
      audio.playTick();
    }
  }

  const easeOutBack = (x) => 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2);

  function rotateTo(target) {
    cancelAnimationFrame(tween);
    const from = rot;
    const t0 = performance.now();
    const dur = 380;
    const step = (now) => {
      const x = Math.min(1, (now - t0) / dur);
      rot = from + (target - from) * easeOutBack(x);
      layout();
      if (x < 1) tween = requestAnimationFrame(step);
    };
    tween = requestAnimationFrame(step);
  }

  // arrastre para girar; se detiene en posiciones fijas
  let drag = null;
  sphere.addEventListener("pointerdown", (e) => {
    cancelAnimationFrame(tween);
    drag = { x0: e.clientX, y0: e.clientY, rot0: rot, lastX: e.clientX, lastT: e.timeStamp, v: 0, moved: false, item: e.target.closest(".wheel__item") };
    try { sphere.setPointerCapture(e.pointerId); } catch (_) {}
  });
  sphere.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x0;
    const dy = e.clientY - drag.y0;
    // deslizar hacia abajo cierra el morral
    if (!drag.moved && dy > 40 && dy > Math.abs(dx) * 1.2) {
      drag = null;
      rotateTo(clamp(Math.round(rot), 0, n - 1));
      setOpen(false);
      return;
    }
    if (Math.abs(dx) > TAP_SLOP && Math.abs(dx) > Math.abs(dy)) drag.moved = true;
    if (!drag.moved) return;
    const dt = Math.max(1, e.timeStamp - drag.lastT);
    drag.v = (e.clientX - drag.lastX) / dt;
    drag.lastX = e.clientX;
    drag.lastT = e.timeStamp;

    let next = drag.rot0 - dx / ((radius() * STEP * Math.PI) / 180);
    // resistencia elástica en los extremos
    if (next < 0) next *= 0.35;
    if (next > n - 1) next = n - 1 + (next - (n - 1)) * 0.35;
    rot = next;
    layout();
  });
  function endDrag(e) {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (!d.moved) {
      // si el sistema canceló el toque, solo acomoda la rueda
      if (e.type === "pointercancel" || !d.item) {
        rotateTo(clamp(Math.round(rot), 0, n - 1));
        return;
      }
      const i = items.indexOf(d.item);
      if (i !== Math.round(rot)) rotateTo(i);
      else press(d.item);
      return;
    }
    // un gesto rápido avanza una posición más
    const flick = -d.v * 0.9;
    rotateTo(clamp(Math.round(rot + clamp(flick, -1, 1) * 0.6), 0, n - 1));
  }
  sphere.addEventListener("pointerup", endDrag);
  sphere.addEventListener("pointercancel", endDrag);

  function press(el) {
    el.querySelector("img").animate(
      [{ transform: "scale(1)" }, { transform: "scale(0.88)" }, { transform: "scale(1.06)" }, { transform: "scale(1)" }],
      { duration: 380, easing: "ease-out" }
    );
    audio.playPop();
    // cámara, videocámara y grabadora abren la misma pantalla en su modo
    const modes = { "cámara": "foto", "videocámara": "video", "grabadora": "audio" };
    const mode = modes[el.dataset.name];
    if (mode) {
      setTimeout(() => {
        setOpen(false);
        document.dispatchEvent(new CustomEvent("bonny:camera", { detail: { mode } }));
      }, 220);
    }
  }

  /* ---------- Abrir / cerrar el morral ---------- */

  let open = false;

  function setOpen(value) {
    if (open === value) return;
    open = value;
    dock.classList.toggle("is-open", open);
    catcher.classList.toggle("is-on", open);
    bag.setAttribute("aria-expanded", String(open));
    bag.setAttribute("aria-label", open ? "Cerrar morral" : "Abrir morral");
    if (open) {
      audio.playChestOpen();
      layout();
      items.forEach((el, i) =>
        el.querySelector("img").animate(
          [{ transform: "scale(0) rotate(-20deg)", opacity: 0 }, { transform: "scale(1.12)", opacity: 1, offset: 0.7 }, { transform: "none", opacity: 1 }],
          { duration: 420, delay: 120 + Math.abs(i - rot) * 70, easing: "ease-out", fill: "backwards" }
        )
      );
      label.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 200, fill: "backwards" });
    } else {
      audio.playTick();
    }
  }

  // tocar el morral lo abre/cierra; deslizarlo hacia arriba lo abre y hacia abajo lo cierra
  let bagSwipe = null;
  let swallowClick = false;
  bag.addEventListener("pointerdown", (e) => {
    bagSwipe = e.clientY;
    try { bag.setPointerCapture(e.pointerId); } catch (_) {} // sigue el dedo aunque salga del botón
  });
  bag.addEventListener("pointerup", (e) => {
    if (bagSwipe !== null) {
      const dy = e.clientY - bagSwipe;
      // deslizar hacia arriba abre; hacia abajo cierra
      if ((!open && dy < -30) || (open && dy > 30)) {
        setOpen(!open);
        swallowClick = true;
        setTimeout(() => (swallowClick = false), 400);
      }
    }
    bagSwipe = null;
  });
  bag.addEventListener("click", () => {
    if (swallowClick) return;
    setOpen(!open);
  });
  catcher.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    setOpen(false);
  });

  /* ---------- Secciones ---------- */

  // secciones: baúles y perfil son páginas; el dibujo es una pantalla aparte
  function goTo(page) {
    navBtns.forEach((b) => {
      const on = b.dataset.page === page;
      b.classList.toggle("is-active", on);
      if (on) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
    document.dispatchEvent(new CustomEvent("bonny:nav", { detail: { page } }));
  }

  navBtns.forEach((btn) =>
    btn.addEventListener("click", () => {
      if (btn.classList.contains("is-active")) return;
      if (btn.dataset.page === "dibujo") {
        setOpen(false);
        document.dispatchEvent(new CustomEvent("bonny:dibujo"));
        return;
      }
      if (btn.dataset.page === "baules" || btn.dataset.page === "perfil") {
        setOpen(false);
        audio.playTick();
        goTo(btn.dataset.page);
        return;
      }
      // las demás secciones aún no existen
      btn.querySelector("img").animate(
        [{ transform: "rotate(0)" }, { transform: "rotate(-10deg)" }, { transform: "rotate(8deg)" }, { transform: "rotate(0)" }],
        { duration: 360, easing: "ease-in-out" }
      );
    })
  );

  /* ---------- Cuándo se muestra ---------- */

  document.addEventListener("bonny:shelves", () => {
    dock.hidden = false;
    layout();
    dock.animate(
      [{ transform: "translateY(100%)", opacity: 0 }, { transform: "none", opacity: 1 }],
      { duration: 600, easing: "cubic-bezier(0.3, 1.2, 0.4, 1)" }
    );
  });

  // desaparece mientras hay un cofre abierto
  document.addEventListener("bonny:chest", (e) => {
    if (e.detail.open) setOpen(false);
    dock.classList.toggle("is-away", e.detail.open);
  });

  // tras borrar la cuenta o al entrar, se vuelve a los baúles
  document.addEventListener("bonny:go", (e) => goTo(e.detail.page));

  window.addEventListener("resize", layout);
  layout();
})();

(() => {
  const root = document.querySelector(".onboarding");
  const pages = [...root.querySelectorAll(".page")];
  const copies = [...root.querySelectorAll(".copy__item")];
  const dots = [...root.querySelectorAll(".dot")];
  const startBtn = root.querySelector(".btn-start");
  const total = pages.length;
  const FLIP_MS = 1100;

  let step = 0;
  let busy = false;

  function render(prev) {
    root.dataset.step = step;

    pages.forEach((page, i) => {
      // Pila de libro: las primeras páginas quedan arriba
      page.style.zIndex = total - i;
      page.classList.toggle("is-turned", i < step);
      page.classList.remove("is-under", "is-back");
    });

    if (prev !== undefined && prev !== step) {
      // La página que queda debajo de la hoja en movimiento recibe su sombra
      const forward = step > prev;
      const under = pages[forward ? step : prev];
      void under.offsetWidth; // reinicia la animación
      under.classList.add("is-under");
      if (!forward) under.classList.add("is-back");
    }

    copies.forEach((c, i) => c.classList.toggle("is-active", i === step));
    dots.forEach((d, i) => d.setAttribute("aria-selected", String(i === step)));
    startBtn.tabIndex = step === total - 1 ? 0 : -1;
  }

  function goTo(next) {
    next = Math.max(0, Math.min(total - 1, next));
    if (next === step || busy) return;
    const prev = step;
    step = next;
    busy = true;
    render(prev);
    setTimeout(() => (busy = false), FLIP_MS * 0.8);
  }

  // Asegura el loop de todos los videos (iOS a veces pausa los que no se ven)
  pages.forEach((p) => {
    const v = p.querySelector("video");
    v.muted = true;
    v.play().catch(() => {});
  });

  dots.forEach((d) => d.addEventListener("click", () => goTo(Number(d.dataset.go))));

  // Swipe horizontal
  let x0 = null, y0 = null;
  root.addEventListener("pointerdown", (e) => { x0 = e.clientX; y0 = e.clientY; });
  root.addEventListener("pointerup", (e) => {
    if (x0 === null) return;
    const dx = e.clientX - x0, dy = e.clientY - y0;
    x0 = y0 = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) goTo(step + (dx < 0 ? 1 : -1));
  });
  root.addEventListener("pointercancel", () => { x0 = y0 = null; });

  // Tocar el video avanza
  root.querySelector(".stage").addEventListener("click", () => goTo(step + 1));

  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") goTo(step + 1);
    if (e.key === "ArrowLeft") goTo(step - 1);
  });

  startBtn.addEventListener("click", () => {
    root.dispatchEvent(new CustomEvent("onboarding:done", { bubbles: true }));
  });

  render();
})();

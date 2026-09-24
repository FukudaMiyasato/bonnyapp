/* Perfil (tuerca): lista de miembros de la familia y eliminar cuenta. */
(() => {
  const data = window.BonnyData;
  const audio = window.BonnyAudio;
  const page = document.querySelector(".perfil");
  const scroller = page.querySelector(".perfil__scroll");
  const grid = page.querySelector(".perfil__grid");
  const deleteBtn = page.querySelector(".perfil__delete");
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  function render() {
    grid.innerHTML = "";
    data.integrantes.forEach((m, i) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "cv-card";
      card.dataset.id = m.id;
      card.style.setProperty("--i", i);
      card.setAttribute("aria-label", "Ver foto");
      card.innerHTML = window.BonnyPolaroid.html(m, ((i % 2 ? 1 : -1) * (2 + Math.random() * 4)).toFixed(1));
      card.addEventListener("click", () => window.BonnyLightbox?.open(card));
      grid.appendChild(card);
    });
    page.classList.toggle("is-empty", data.integrantes.length === 0);
  }

  // herramientas: el interruptor de música quita o devuelve el iPod
  const musicSwitch = page.querySelector('.tool-switch[data-tool="musica"]');
  musicSwitch.addEventListener("change", () => window.BonnyMusic?.setIpod(musicSwitch.checked));

  async function show() {
    render();
    musicSwitch.checked = window.BonnyMusic ? window.BonnyMusic.ipodOn : true;
    resetDelete();
    scroller.scrollTop = 0;
    page.hidden = false;
    void page.offsetWidth;
    page.classList.add("is-in");
  }

  async function hide() {
    page.classList.remove("is-in");
    await wait(350);
    page.hidden = true;
    grid.innerHTML = "";
  }

  document.addEventListener("bonny:nav", (e) => (e.detail.page === "perfil" ? show() : !page.hidden && hide()));

  /* ---------- Eliminar cuenta (dos toques) ---------- */

  let timer = null;
  function resetDelete() {
    clearTimeout(timer);
    deleteBtn.classList.remove("is-confirming");
    deleteBtn.textContent = "eliminar cuenta";
  }

  deleteBtn.addEventListener("click", async () => {
    if (!deleteBtn.classList.contains("is-confirming")) {
      deleteBtn.classList.add("is-confirming");
      deleteBtn.textContent = "¿seguro? se borrará todo";
      deleteBtn.animate(
        [{ transform: "translateX(0)" }, { transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "translateX(0)" }],
        { duration: 300 }
      );
      timer = setTimeout(resetDelete, 3500);
      return;
    }
    clearTimeout(timer);
    deleteBtn.disabled = true;
    deleteBtn.textContent = "borrando…";
    audio.stopMusic();
    const wipe = document.createElement("div");
    wipe.className = "wipe";
    document.body.appendChild(wipe);
    void wipe.offsetWidth;
    wipe.classList.add("is-on");
    await Promise.all([data.borrarTodo(), wait(650)]);
    location.reload(); // sin miembros de la familia, la app vuelve al tutorial
  });
})();

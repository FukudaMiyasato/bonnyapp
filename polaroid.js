/* Polaroid de un integrante: foto + marco + ubicación y fecha escritas a mano. */
window.BonnyPolaroid = (() => {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const fecha = (iso) => {
    const d = new Date(iso);
    if (isNaN(d)) return "";
    return d.toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" }).replace(".", "");
  };

  /** HTML de la tarjeta (va dentro de un contenedor con la proporción del marco).
      Sirve para integrantes (foto en línea) y recuerdos (foto en IndexedDB: usar `hydrate`). */
  function html(item, rot = 0) {
    // los dibujos se muestran como una hoja de papel, sin marco de polaroid
    if (item.dibujo) {
      const src = item.foto ? `src="${item.foto}"` : `data-rid="${item.id}"`;
      return `
      <div class="mini__card is-dibujo" style="--r:${rot}deg">
        <img class="mini__photo" ${src} alt="Dibujo" draggable="false" />
      </div>`;
    }
    const lugar = item.ubicacion ? `<span class="mini__place">${esc(item.ubicacion)}</span>` : "";
    const src = item.foto ? `src="${item.foto}"` : `data-rid="${item.id}"`;
    return `
      <div class="mini__card" style="--r:${rot}deg">
        <img class="mini__photo" ${src} alt="${item.tipo === "recuerdo" ? "Recuerdo" : "Integrante"}" draggable="false" />
        <img class="mini__frame" src="assets/img/photo-mini.webp" alt="" draggable="false" />
        <div class="mini__caption">${lugar}<span class="mini__date">${esc(fecha(item.creado))}</span></div>
      </div>`;
  }

  /** Carga las imágenes de recuerdos que haya dentro de `root`. */
  async function hydrate(root) {
    const imgs = [...root.querySelectorAll("img[data-rid]")];
    await Promise.all(imgs.map(async (img) => {
      const url = await window.BonnyData.fotoURL(img.dataset.rid);
      if (url) img.src = url;
      img.removeAttribute("data-rid");
      await img.decode().catch(() => {});
    }));
  }

  return { html, hydrate, fecha };
})();

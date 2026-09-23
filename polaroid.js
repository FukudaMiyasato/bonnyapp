/* Polaroid de un integrante: foto + marco + ubicación y fecha escritas a mano. */
window.BonnyPolaroid = (() => {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const fecha = (iso) => {
    const d = new Date(iso);
    if (isNaN(d)) return "";
    return d.toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" }).replace(".", "");
  };

  /** HTML de la tarjeta (va dentro de un contenedor con la proporción del marco). */
  function html(integrante, rot = 0) {
    const lugar = integrante.ubicacion ? `<span class="mini__place">${esc(integrante.ubicacion)}</span>` : "";
    return `
      <div class="mini__card" style="--r:${rot}deg">
        <img class="mini__photo" src="${integrante.foto}" alt="Integrante" draggable="false" />
        <img class="mini__frame" src="assets/img/photo-mini.webp" alt="" draggable="false" />
        <div class="mini__caption">${lugar}<span class="mini__date">${esc(fecha(integrante.creado))}</span></div>
      </div>`;
  }

  return { html, fecha };
})();

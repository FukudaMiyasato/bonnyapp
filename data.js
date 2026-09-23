/* Datos de Bonny: integrantes de la familia detectados en las fotos.
   Se guardan en localStorage para usarlos en las siguientes escenas. */
window.BonnyData = (() => {
  const KEY = "bonny:integrantes";

  /** @type {{ id: string, foto: string, tipo: "persona" | "mascota" | "foto", etiqueta: string | null, fotoOrigen: string, creado: string }[]} */
  const integrantes = [];

  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (Array.isArray(saved)) integrantes.push(...saved);
  } catch (_) {}

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(integrantes));
    } catch (err) {
      console.warn("No se pudieron guardar los integrantes", err);
    }
  }

  const uid = () =>
    (crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2));

  /** Agrega un integrante y lo devuelve. `foto` es un dataURL JPEG. */
  function agregarIntegrante({ foto, etiqueta = null, fotoOrigen }) {
    const tipo = etiqueta === null ? "foto" : etiqueta === "person" ? "persona" : "mascota";
    const integrante = { id: uid(), foto, tipo, etiqueta, fotoOrigen, creado: new Date().toISOString() };
    integrantes.push(integrante);
    save();
    document.dispatchEvent(new CustomEvent("bonny:integrante", { detail: integrante }));
    return integrante;
  }

  function borrarIntegrantes() {
    integrantes.length = 0;
    save();
  }

  return { integrantes, agregarIntegrante, borrarIntegrantes, nuevoId: uid };
})();

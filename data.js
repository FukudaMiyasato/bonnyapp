/* Datos de Bonny, guardados en localStorage para usarlos en las siguientes escenas:
   - integrantes: fotos de cada integrante detectado en las fotos familiares
   - baules: los cofres de recuerdos; cada uno guarda ids de integrantes */
window.BonnyData = (() => {
  const KEY = "bonny:integrantes";
  const KEY_BAULES = "bonny:baules";

  const load = (key, fallback) => {
    try {
      const v = JSON.parse(localStorage.getItem(key));
      return v ?? fallback;
    } catch (_) {
      return fallback;
    }
  };
  const store = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.warn("No se pudo guardar", key, err);
    }
  };

  const uid = () =>
    (crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2));

  /* ---------- Integrantes ---------- */

  /** @type {{ id: string, foto: string, tipo: "persona" | "mascota" | "foto", etiqueta: string | null, fotoOrigen: string, creado: string }[]} */
  const integrantes = [];
  const savedIntegrantes = load(KEY, []);
  if (Array.isArray(savedIntegrantes)) integrantes.push(...savedIntegrantes);

  const save = () => store(KEY, integrantes);

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

  const integrante = (id) => integrantes.find((i) => i.id === id) || null;

  /* ---------- Baúles ---------- */

  /** @type {{ baules: { id: string, nombre: string, integrantes: string[], creado: string }[], activo: string | null }} */
  const estado = load(KEY_BAULES, { baules: [], activo: null });
  if (!Array.isArray(estado.baules)) estado.baules = [];
  const baules = estado.baules;

  const saveBaules = () => store(KEY_BAULES, estado);

  /** Crea un baúl, lo deja como activo y lo devuelve. */
  function crearBaul(nombre) {
    const baul = {
      id: uid(),
      nombre: nombre || (baules.length === 0 ? "Mi primer baúl" : `Baúl ${baules.length + 1}`),
      integrantes: [],
      creado: new Date().toISOString(),
    };
    baules.push(baul);
    estado.activo = baul.id;
    saveBaules();
    return baul;
  }

  function guardarEnBaul(baulId, integranteIds) {
    const baul = baules.find((b) => b.id === baulId);
    if (!baul) return;
    integranteIds.forEach((id) => { if (!baul.integrantes.includes(id)) baul.integrantes.push(id); });
    saveBaules();
  }

  function activarBaul(id) {
    estado.activo = id;
    saveBaules();
  }

  return {
    integrantes,
    agregarIntegrante,
    borrarIntegrantes,
    integrante,
    baules,
    get baulActivo() { return baules.find((b) => b.id === estado.activo) || null; },
    crearBaul,
    guardarEnBaul,
    activarBaul,
    nuevoId: uid,
  };
})();

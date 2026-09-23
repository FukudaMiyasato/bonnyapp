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

  /** @type {{ id: string, foto: string, tipo: "persona" | "mascota" | "foto", etiqueta: string | null, fotoOrigen: string, ubicacion: string | null, creado: string }[]} */
  const integrantes = [];
  const savedIntegrantes = load(KEY, []);
  if (Array.isArray(savedIntegrantes)) integrantes.push(...savedIntegrantes);

  const save = () => store(KEY, integrantes);

  /** Agrega un integrante y lo devuelve. `foto` es un dataURL JPEG; `ubicacion`, p. ej. "Lima, Perú". */
  function agregarIntegrante({ foto, etiqueta = null, fotoOrigen, ubicacion = null }) {
    const tipo = etiqueta === null ? "foto" : etiqueta === "person" ? "persona" : "mascota";
    const integrante = { id: uid(), foto, tipo, etiqueta, fotoOrigen, ubicacion, creado: new Date().toISOString() };
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

  /** Colores de cofre disponibles (clave → color del círculo). */
  const COLORES = { cafe: "#b45b2e", crema: "#fbe6c8", verde: "#77753d", azul: "#578bb3", rojo: "#e0593b" };

  /** @type {{ baules: { id: string, nombre: string, color: keyof COLORES, integrantes: string[], creado: string }[], activo: string | null }} */
  const estado = load(KEY_BAULES, { baules: [], activo: null });
  if (!Array.isArray(estado.baules)) estado.baules = [];
  const baules = estado.baules;
  baules.forEach((b) => { if (!COLORES[b.color]) b.color = "cafe"; });

  const saveBaules = () => store(KEY_BAULES, estado);

  /** Crea un baúl, lo deja como activo y lo devuelve. El primero es café; los demás, de color al azar. */
  function crearBaul(nombre) {
    const claves = Object.keys(COLORES);
    const primero = baules.length === 0;
    const baul = {
      id: uid(),
      nombre: nombre || (primero ? "Mi primer baúl" : `Baúl ${baules.length + 1}`),
      color: primero ? "cafe" : claves[Math.floor(Math.random() * claves.length)],
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

  /** Quita el baúl (sus integrantes siguen en `integrantes`). */
  function eliminarBaul(id) {
    const i = baules.findIndex((b) => b.id === id);
    if (i < 0) return;
    baules.splice(i, 1);
    if (estado.activo === id) estado.activo = baules.length ? baules[baules.length - 1].id : null;
    saveBaules();
  }

  function renombrarBaul(id, nombre) {
    const baul = baules.find((b) => b.id === id);
    if (!baul || !nombre.trim()) return;
    baul.nombre = nombre.trim();
    saveBaules();
  }

  function colorBaul(id, color) {
    const baul = baules.find((b) => b.id === id);
    if (!baul || !COLORES[color]) return;
    baul.color = color;
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
    eliminarBaul,
    renombrarBaul,
    colorBaul,
    activarBaul,
    COLORES,
    nuevoId: uid,
  };
})();

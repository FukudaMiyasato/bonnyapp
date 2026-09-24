/* Datos de Bonny, guardados en el dispositivo para usarlos en las siguientes escenas:
   - integrantes: fotos de cada integrante detectado en las fotos familiares (localStorage)
   - recuerdos: fotos tomadas con la cámara (imagen en IndexedDB, datos en localStorage)
   - baules: los cofres de recuerdos; cada uno guarda ids de integrantes y de recuerdos */
window.BonnyData = (() => {
  const KEY = "bonny:integrantes";
  const KEY_BAULES = "bonny:baules";
  const KEY_RECUERDOS = "bonny:recuerdos";
  const KEY_ALBUM = "bonny:album";

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

  /* ---------- Imágenes grandes en IndexedDB ---------- */

  let dbPromise = null;
  function db() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open("bonny", 1);
        req.onupgradeneeded = () => req.result.createObjectStore("fotos");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbPromise;
  }
  async function putBlob(id, blob) {
    const d = await db();
    await new Promise((resolve, reject) => {
      const tx = d.transaction("fotos", "readwrite");
      tx.objectStore("fotos").put(blob, id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }
  async function getBlob(id) {
    const d = await db();
    return new Promise((resolve, reject) => {
      const req = d.transaction("fotos").objectStore("fotos").get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  const urls = new Map();
  /** URL para mostrar la imagen de un recuerdo (se carga una sola vez). */
  async function fotoURL(id) {
    if (!urls.has(id)) {
      urls.set(id, getBlob(id).then((b) => (b ? URL.createObjectURL(b) : "")).catch(() => ""));
    }
    return urls.get(id);
  }

  /* ---------- Recuerdos (fotos de la cámara) ---------- */

  /** @type {{ id: string, tipo: "recuerdo", medio: "foto" | "video" | "audio" | "dibujo", ubicacion: string | null, compuesta: boolean, dibujo?: boolean, duracion?: number, creado: string }[]} */
  const recuerdos = [];
  const savedRecuerdos = load(KEY_RECUERDOS, []);
  if (Array.isArray(savedRecuerdos)) recuerdos.push(...savedRecuerdos);
  recuerdos.forEach((r) => { if (!r.medio) r.medio = r.dibujo ? "dibujo" : "foto"; });

  /** Guarda el recuerdo (Blob) y lo devuelve.
      `medio`: foto, video, audio o dibujo; `poster`: miniatura (Blob) para videos y audios;
      `compuesta`: si se le agregó un integrante con IA. */
  async function agregarRecuerdo({ blob, poster = null, medio = "foto", ubicacion = null, compuesta = false, dibujo = false, duracion = null }) {
    if (dibujo) medio = "dibujo";
    const r = { id: uid(), tipo: "recuerdo", medio, ubicacion, compuesta, dibujo: medio === "dibujo", duracion, creado: new Date().toISOString() };
    await putBlob(r.id, blob);
    urls.set(r.id, Promise.resolve(URL.createObjectURL(blob)));
    if (poster) {
      await putBlob(r.id + ":poster", poster);
      urls.set(r.id + ":poster", Promise.resolve(URL.createObjectURL(poster)));
    }
    recuerdos.push(r);
    store(KEY_RECUERDOS, recuerdos);
    return r;
  }

  const recuerdo = (id) => recuerdos.find((r) => r.id === id) || null;
  /** Integrante o recuerdo por id. */
  const item = (id) => integrante(id) || recuerdo(id);

  /* ---------- Álbum: posición de cada foto en sus páginas ---------- */

  /** @type {Record<string, { x: number, y: number, s: number, r: number, z: number }>} */
  const album = load(KEY_ALBUM, {});
  const guardarAlbum = () => store(KEY_ALBUM, album);

  /* ---------- Borrar cuenta: elimina todos los datos del dispositivo ---------- */

  async function borrarTodo() {
    Object.keys(localStorage).filter((k) => k.startsWith("bonny:")).forEach((k) => localStorage.removeItem(k));
    try {
      (await dbPromise)?.close();
    } catch (_) {}
    await new Promise((resolve) => {
      const req = indexedDB.deleteDatabase("bonny");
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    });
  }

  /* ---------- Ubicación (ciudad, país) para escribirla en las fotos ---------- */

  let placePromise = null;
  function ubicacion() {
    if (placePromise) return placePromise;
    placePromise = new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        async ({ coords }) => {
          try {
            // geocodificación inversa gratuita, sin clave
            const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${coords.latitude}&longitude=${coords.longitude}&localityLanguage=es`;
            const r = await (await fetch(url)).json();
            const city = r.city || r.locality || r.principalSubdivision;
            resolve([city, r.countryName].filter(Boolean).join(", ") || null);
          } catch (_) {
            resolve(null);
          }
        },
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60 * 1000 }
      );
    });
    return placePromise;
  }

  /* ---------- Baúles ---------- */

  /** Colores de cofre disponibles (clave → color del círculo). */
  const COLORES = { cafe: "#b45b2e", crema: "#fbe6c8", verde: "#77753d", azul: "#578bb3", rojo: "#e0593b" };

  /** @type {{ baules: { id: string, nombre: string, color: keyof COLORES, integrantes: string[], creado: string }[], activo: string | null }} */
  const estado = load(KEY_BAULES, { baules: [], activo: null });
  if (!Array.isArray(estado.baules)) estado.baules = [];
  const baules = estado.baules;
  baules.forEach((b) => {
    if (!COLORES[b.color]) b.color = "cafe";
    if (!Array.isArray(b.recuerdos)) b.recuerdos = [];
  });

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
      recuerdos: [],
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

  function guardarRecuerdoEnBaul(baulId, recuerdoId) {
    const baul = baules.find((b) => b.id === baulId);
    if (!baul || baul.recuerdos.includes(recuerdoId)) return;
    baul.recuerdos.push(recuerdoId);
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
    recuerdos,
    agregarRecuerdo,
    recuerdo,
    item,
    fotoURL,
    ubicacion,
    album,
    guardarAlbum,
    borrarTodo,
    baules,
    get baulActivo() { return baules.find((b) => b.id === estado.activo) || null; },
    crearBaul,
    guardarEnBaul,
    guardarRecuerdoEnBaul,
    eliminarBaul,
    renombrarBaul,
    colorBaul,
    activarBaul,
    COLORES,
    nuevoId: uid,
  };
})();

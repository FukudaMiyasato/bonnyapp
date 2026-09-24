/* Función de Vercel: agrega a un integrante de la familia dentro de una foto.
   Variables de entorno (Vercel → Settings → Environment Variables):
     OPENAI_API_KEY      (obligatoria) clave de la API de OpenAI
     OPENAI_IMAGE_MODEL  (opcional)   por defecto "gpt-image-2.5-sunburst" */

const DEFAULT_MODEL = "gpt-image-2.5-sunburst";
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

const PROMPT = [
  "Image 1 is a real photo. Image 2 is a portrait of a family member.",
  "Add the person from image 2 into the scene of image 1 so they look naturally present, as if they had been there when the photo was taken.",
  "Place them at a natural spot next to whoever is in the photo (or in the most natural free space if nobody is), at a believable scale and perspective.",
  "Match the lighting direction, shadows, color grading, focus, grain and camera quality of image 1.",
  "Keep the person's face, hair, skin tone and identity faithful to image 2; adapt only pose and body naturally to the scene.",
  "Do not change the background, framing, or anyone already in image 1. Photorealistic, no text, no borders.",
].join(" ");

function dataUrlToBlob(dataUrl) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl || "");
  if (!match) return null;
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > MAX_IMAGE_BYTES) return null;
  return new Blob([buffer], { type: match[1] });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido" });
  }

  // solo la propia app puede usar esta función
  const origin = req.headers.origin;
  if (origin && new URL(origin).host !== req.headers.host) {
    return res.status(403).json({ error: "Origen no permitido" });
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.status(500).json({ error: "Falta configurar OPENAI_API_KEY" });

  const { base, member } = req.body || {};
  const baseBlob = dataUrlToBlob(base);
  const memberBlob = dataUrlToBlob(member);
  if (!baseBlob || !memberBlob) return res.status(400).json({ error: "Imágenes inválidas" });

  const form = new FormData();
  form.append("model", process.env.OPENAI_IMAGE_MODEL || DEFAULT_MODEL);
  form.append("image[]", baseBlob, "foto.jpg");
  form.append("image[]", memberBlob, "integrante.jpg");
  form.append("prompt", PROMPT);
  form.append("size", "1168x1024"); // misma proporción que la ventana de la polaroid
  form.append("quality", "medium");
  form.append("output_format", "jpeg");
  form.append("output_compression", "88");

  try {
    const r = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    const json = await r.json();
    if (!r.ok) {
      console.error("OpenAI:", json.error);
      return res.status(502).json({ error: json.error?.message || "No se pudo generar la imagen" });
    }
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) return res.status(502).json({ error: "Respuesta sin imagen" });
    return res.status(200).json({ image: `data:image/jpeg;base64,${b64}` });
  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: "No se pudo conectar con OpenAI" });
  }
}

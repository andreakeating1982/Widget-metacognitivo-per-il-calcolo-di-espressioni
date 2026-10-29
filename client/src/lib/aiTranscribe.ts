/** Trascrizione IA (giro 20) — lato BROWSER.
 *
 *  Foto e tratti della scrittura a mano vengono inviati al server
 *  (POST /api/ai/transcribe) che chiama l'IA vision di Easy-Peasy AI.
 *  L'IA TRASCRIVE SOLO: la risposta finisce nel campo TASTIERA / pezzo,
 *  dove l'utente la controlla prima di confermare (mai calcolo automatico).
 *
 *  Il server gira solo nel build di produzione (esbuild di server/index.ts):
 *  in sviluppo la fetch risponde 404 e il chiamante ripiega sul
 *  riconoscimento locale (Tesseract / ONNX). */

import { cleanAiExpression, aiExpressionPlausible } from "./aiClean";

export type AiKind = "photo" | "ink";
/** (26/10-bis) Bias di lettura per i tratti a mano:
 *  - "cifra" (default): nel dubbio cifra (box numerici);
 *  - "lettera": le lettere vanno trascritte ESATTE, mai come cifre
 *    (pezzi pagina 2 e box simbolici pagina 3). */
export type AiInkBias = "cifra" | "lettera";

export class AiUnavailableError extends Error {}

/** Invia un'immagine (dataURL) all'IA e ritorna l'espressione PULITA.
 *  Lancia AiUnavailableError se il server non ha l'IA configurata. */
export async function aiTranscribeImage(dataUrl: string, kind: AiKind, bias?: AiInkBias): Promise<string> {
  let res: Response;
  try {
    res = await fetch("/api/ai/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: dataUrl, kind, ...(kind === "ink" && bias ? { bias } : {}) }),
    });
  } catch {
    throw new AiUnavailableError("Rete non disponibile");
  }
  if (!res.ok) {
    let msg = `IA non disponibile (${res.status})`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j?.error) msg = j.error;
    } catch {
      /* corpo non JSON (tipico: 404 del dev server) */
    }
    throw new AiUnavailableError(msg);
  }
  const j = (await res.json()) as { text?: string };
  const raw = typeof j.text === "string" ? j.text : "";
  const expr = cleanAiExpression(raw);
  if (!aiExpressionPlausible(expr)) {
    throw new Error("La trascrizione IA non contiene un'espressione utilizzabile.");
  }
  return expr;
}

/** Converte un File immagine in un dataURL JPEG ridotto (lato lungo max
 *  `maxSide`): sufficiente all'IA e leggero da trasmettere. L'immagine
 *  ORIGINALE resta disponibile per il riconoscimento locale di riserva
 *  (che vuole la PNG lossless e la scala dalle cifre). */
export async function fileToScaledDataUrl(file: File, maxSide = 1800): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas non disponibile");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", 0.92);
}

/** Disegna i TRATTI della scrittura a mano su un canvas bianco e ritorna il
 *  dataURL PNG: è l'immagine che l'IA vision legge come soccorso quando il
 *  modello locale (ONNX) non riconosce nulla. */
export function strokesToDataUrl(
  strokes: { points: { x: number; y: number }[] }[],
  target = 512,
): string {
  const pts = strokes.flatMap((s) => s.points);
  if (pts.length === 0) return "";
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const pad = 24;
  const w = maxX - minX + pad * 2;
  const h = maxY - minY + pad * 2;
  // ingrandisce la scrittura piccola (26/10: max ×8 — prima ×3 e una cifra
  // piccola come «1» restava minuscola e l'IA non la leggeva), mai ridurre
  const scale = Math.min(8, Math.max(1, target / Math.max(w, h)));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas non disponibile");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = Math.max(4, 5 * scale);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const stroke of strokes) {
    const pp = stroke.points;
    if (pp.length === 0) continue;
    ctx.beginPath();
    if (pp.length === 1) {
      ctx.arc((pp[0].x - minX + pad) * scale, (pp[0].y - minY + pad) * scale, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fillStyle = "#111111";
      ctx.fill();
      continue;
    }
    ctx.moveTo((pp[0].x - minX + pad) * scale, (pp[0].y - minY + pad) * scale);
    for (let i = 1; i < pp.length; i++) {
      ctx.lineTo((pp[i].x - minX + pad) * scale, (pp[i].y - minY + pad) * scale);
    }
    ctx.stroke();
  }
  return canvas.toDataURL("image/png");
}

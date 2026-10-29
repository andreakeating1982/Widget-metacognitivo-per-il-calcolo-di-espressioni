/**
 * audio.ts — trascrizione AUDIO del dettato (giro 25), adattata dalla repo
 * https://github.com/andreakeating1982/AUDIO-MATEMATICI (server/ai.ts e
 * wavIsSilent di server/routes.ts).
 *
 * Flusso: il browser registra dal microfono (MediaRecorder), converte in
 * WAV PCM 16 kHz in-process e invia il base64 a POST /api/ai/audio; qui:
 *   1. guardia silenzio (niente chiamata IA su audio vuoto);
 *   2. IA multimodale (gemini-3-flash via gateway Easy-Peasy.AI): trascrive
 *      IN ITALIANO le parole sentite;
 *   3. IA converte il testo parlato in NOTAZIONE dell'app (frazioni impilate
 *      a⁄b, : per «diviso», · per «per», ^ potenze, √∛∜ radici) SENZA MAI
 *      calcolare (regola fissa dell'utente).
 * L'audio non viene conservato da nessuna parte.
 */

import { BAKED_EASY_PEASY_API_KEY } from "../shared/env.generated";

const AI_BASE_URL = (process.env.EASY_PEASY_API_BASE_URL || "https://easy-peasy.ai/api").replace(/\/$/, "");
const AI_MODEL = process.env.EASY_PEASY_LLM_MODEL || "gemini-3-flash";

function apiKey(): string | null {
  const k = process.env.EASY_PEASY_API_KEY;
  if (k && k.trim()) return k.trim();
  // Chiave «cotta» al build nel solo bundle server (scripts/sync-env.mjs).
  // La chiave non raggiunge MAI il bundle del browser.
  try {
    if (typeof BAKED_EASY_PEASY_API_KEY === "string" && BAKED_EASY_PEASY_API_KEY.trim())
      return BAKED_EASY_PEASY_API_KEY.trim();
  } catch {
    /* file generato assente: chiave non configurata */
  }
  return null;
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { Authorization: `Bearer ${apiKey()}`, ...extra };
}

type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "input_audio"; input_audio: { data: string; format: string } };

/* (26/10) OPZIONI di formato passate al gateway (ignorate altrove). */
export interface ChatOptions {
  model?: string;
  maxTokens?: number;
  jsonMode?: boolean;
}

export async function chatCompletion(
  content: string | ChatContentPart[],
  temperature = 0,
  timeoutMs = 90_000,
  opts: ChatOptions = {},
): Promise<string> {
  if (!apiKey()) {
    throw new Error("La trascrizione IA non è attiva: manca la chiave API sul server (EASY_PEASY_API_KEY).");
  }
  const resp = await fetch(`${AI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      model: opts.model ?? AI_MODEL,
      temperature,
      /* (26/10) risposta più corta = risposta più veloce: il JSON dello
         svolgimento sta sotto i 4000 token — non serve lasciarne 16000 */
      max_tokens: opts.maxTokens ?? 16000,
      /* (26/10) formato JSON forzato quando supportato: il modello non
         spreca tempo in ragionamenti fuori dal JSON */
      ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
      messages: [{ role: "user", content }],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!resp.ok) {
    if (resp.status === 413) {
      throw new Error("Messaggio troppo grande per l'IA: riprova con un audio più breve.");
    }
    const body = await resp.text().catch(() => "");
    throw new Error(`IA non raggiungibile (${resp.status})${body ? `: ${body.slice(0, 300)}` : ""}`);
  }
  const json = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content ?? "";
}

/** Trascrizione del dettato: l'audio WAV (base64) al modello multimodale con
 *  l'istruzione di trascrivere IN ITALIANO, parola per parola, senza
 *  interpretare la matematica. */
export async function transcribeAudioWav(wavBase64: string): Promise<{ text: string }> {
  const content: ChatContentPart[] = [
    {
      type: "text",
      text:
        "Trascrivi fedelmente in italiano ciò che è detto in questa registrazione. " +
        "Scrivi SOLO la trascrizione letterale delle parole sentite, senza commenti, " +
        "senza interpretare la matematica e senza aggiungere nulla.",
    },
    { type: "input_audio", input_audio: { data: wavBase64, format: "wav" } },
  ];
  const text = await chatCompletion(content);
  return { text: text.trim().replace(/^["'«]+|["'»]+$/g, "").trim() };
}

/** Converte il testo parlato (matematica detta in italiano) nella NOTAZIONE
 *  di QUESTA app (quella che il parser di lib/espressioni.ts accetta),
 *  SENZA MAI calcolare, semplificare o aggiungere parentesi. */
export async function parseMathText(spoken: string): Promise<{ notation: string }> {
  const prompt = [
    "Sei un convertitore di linguaggio matematico parlato in italiano verso notazione matematica lineare.",
    "Ricevi il testo DETTATO da uno studente (una espressione aritmetica o algebrica) e devi SOLO convertirlo in notazione, MAI calcolarlo o semplificarlo.",
    "",
    "NOTAZIONE DA USARE (esattamente questi simboli, SENZA SPAZI):",
    "- frazioni: numeratore e denominatore SEMPRE come frazione impilata con il carattere ⁄ (frazione slash, U+2044), MAI decimali: 'un mezzo' → 1⁄2, 'due terzi' → 2⁄3, 'tre quarti' → 3⁄4, 'X su Y' (X e Y semplici) → X⁄Y",
    "- 'diviso' (divisione vera) → i due punti : (mai la barra /)",
    "- 'per' (moltiplicazione) → il puntino ·  (mai la lettera x se è un'operazione)",
    "- potenze con ^ attaccato a ciò che eleva: 'alla seconda' → ^2, 'alla terza' → ^3, 'alla meno due' → ^(-2); 'il tutto alla X' dopo una parentesi chiusa → )^X",
    "- se si eleva una FRAZIONE va tra parentesi: 'un terzo alla meno due' → (1⁄3)^(-2)",
    "- radice quadrata 'radice quadrata di' → √, radice cubica → ∛, radice quarta → ∜; il radicando segue subito, tra parentesi se è un'espressione (es. √(x+1))",
    "- parentesi tonde ( ) quadre [ ] graffe { } esattamente come dettate, rispettando l'annidamento",
    "- variabili: x e y; numeri decimali con la virgola (es. 3,5)",
    "- la parola 'uguale' si IGNORA (l'app calcola solo espressioni, senza equazioni): 'due x più tre uguale sette' → 2x+3. NON aggiungere mai '=' alla notazione",
    "",
    "REGOLE ASSOLUTE:",
    "- MAI risolvere, MAI calcolare, MAI arrotondare, MAI semplificare, MAI cambiare l'ordine, MAI aggiungere o togliere parentesi non dettate",
    "- Rispondi SOLO con un oggetto JSON valido: {\"notation\":\"...\"} — niente altro testo, niente spiegazioni, niente virgolette extra.",
    "",
    "ESEMPI (segue esattamente questo stile):",
    "Input: parentesi graffa parentesi quadra un mezzo meno due più parentesi tonda tre quarti per quattro sesti chiusa parentesi tonda il tutto alla seconda meno due chiusa parentesi quadra più cinque diviso un quinto chiusa parentesi graffa",
    `Output: {"notation":"{[1⁄2-2+(3⁄4·4⁄6)^2-2]+5:(1⁄5)}"}`,
    "Input: parentesi quadra tre meno un terzo più parentesi tonda un quarto per due noni chiusa parentesi tonda alla seconda chiusa parentesi quadra",
    `Output: {"notation":"[3-1⁄3+(1⁄4·2⁄9)^2]"}`,
    "Input: due x più tre uguale sette",
    `Output: {"notation":"2x+3"}`,
    "",
    `Input: ${spoken}`,
    "Output:",
  ].join("\n");

  const content = await chatCompletion(prompt);
  const match = content.match(/\{[\s\S]*\}/);
  const raw = match ? match[0] : content;
  try {
    const parsed = JSON.parse(raw) as { notation?: unknown };
    if (typeof parsed.notation === "string") {
      return { notation: parsed.notation.trim() };
    }
  } catch {
    /* cade sotto */
  }
  return { notation: content.replace(/```/g, "").trim() };
}

/**
 * Rileva un WAV di puro silenzio (picco sotto soglia): senza questa guardia
 * l'IA "sogna" frasi inventate su audio vuoto. Soglia conservativa (~-41 dBFS):
 * solo vero silenzio. (Portata da AUDIO-MATEMATICI server/routes.ts.)
 */
export function wavIsSilent(buf: Buffer): boolean {
  try {
    if (buf.length < 44 || buf.toString("ascii", 0, 4) !== "RIFF") return false;
    let off = 12;
    while (off + 8 <= buf.length) {
      const id = buf.toString("ascii", off, off + 4);
      const size = buf.readUInt32LE(off + 4);
      if (id === "data") {
        const data = buf.subarray(off + 8, Math.min(off + 8 + size, buf.length));
        let peak = 0;
        for (let i = 0; i + 1 < data.length; i += 2) {
          const v = Math.abs(data.readInt16LE(i));
          if (v > peak) peak = v;
          if (peak > 300) return false; // c'è voce: esci presto
        }
        return peak <= 300;
      }
      off += 8 + size + (size % 2);
    }
  } catch {
    /* WAV malformato: lascia correre */
  }
  return false;
}

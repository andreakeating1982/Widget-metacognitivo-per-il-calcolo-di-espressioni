import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import { BAKED_EASY_PEASY_API_KEY } from "../shared/env.generated";
import { transcribeAudioWav, parseMathText, wavIsSilent } from "./audio";
import { registerEsercizioRoutes } from "./costruisci";

/* ════════════════ IA VISION — trascrizione FOTO e INCHIOSTRO (giro 20) ════════════════
   L'IA (Easy-Peasy AI, endpoint OpenAI-compatible, modello gemini-3-flash) TRASCRIVE
   SOLO ciò che è scritto nell'immagine: MAI risolvere, semplificare o calcolare
   (regola fissa dell'utente: l'app non compie mai operazioni da sé — la trascrizione
   finisce nel campo TASTIERA e l'utente la controlla prima di ✓ CONFERMA E CALCOLA). */
const AI_BASE_URL = "https://easy-peasy.ai/api";
const AI_MODEL = "gemini-3-flash";
let aiClientCache: OpenAI | null | undefined;

/* Chiave IA: prima da process.env (locale/Render), poi «cotta» al build nel
   solo bundle server da scripts/sync-env.mjs (produzione Easy-Peasy: il
   .env della piattaforma NON contiene EASY_PEASY_API_KEY). La chiave non
   raggiunge MAI il bundle del browser (shared/env.generated.ts è importato
   solo dal server; il client non lo importa mai). */
function bakedKey(): string {
  try {
    return typeof BAKED_EASY_PEASY_API_KEY === "string" ? BAKED_EASY_PEASY_API_KEY.trim() : "";
  } catch {
    return "";
  }
}

function aiClient(): OpenAI | null {
  if (aiClientCache !== undefined) return aiClientCache;
  const envKey = process.env.EASY_PEASY_API_KEY;
  const apiKey = (envKey && envKey.trim()) || bakedKey() || "";
  aiClientCache = apiKey ? new OpenAI({ apiKey, baseURL: AI_BASE_URL }) : null;
  return aiClientCache;
}

const AI_CONTRACT = `Rispondi SOLO con l'espressione matematica scritta nell'immagine, su UNA SOLA RIGA, usando ESATTAMENTE questo formato:
- cifre e lettere minuscole (variabili: x, y, ...)
- addizione con +, sottrazione con -, moltiplicazione con *, divisione con i DUE PUNTI :
- potenza con ^ (esempio: x^2). ESPONENTE IN APICE: un numero PICCOLO disegnato IN ALTO a destra di un numero o di una parentesi è l'ESPONENTE e va scritto con ^ — 9² → 9^2, MAI 92; 3² → 3^2, MAI 32; (3²)² → (3^2)^2. Due cifre affiancate alla STESSA altezza sono invece un numero a due cifre (92, 89)
- radice quadrata con √, radice cubica con ∛, radice quarta con ∜. REGOLA DELLA BARRA (fondamentale con la scrittura a mano): individua PRIMA la linea orizzontale della radice e guarda con precisione DOVE INIZIA e DOVE FINISCE; il radicando è ESATTAMENTE ciò che sta sotto la barra tra quei due estremi, né più né meno. Esempio decisivo: barra sopra «3+6» → √(3+6); barra sopra il SOLO «3» con «+6» disegnato DOPO la fine della barra → √(3)+6. Metti il radicando COMPLETO tra parentesi tonde subito dopo il simbolo. Esempi: radice di 3/7 = √(3⁄7); radice di (3/7 · (1 − 4/7)) = √((3⁄7)·(1−4⁄7)); radice di 9 = √(9). MAI scrivere √3⁄7 o √1⁄64: la radice coprirebbe solo il primo numero. MAI estendere il radicando oltre la fine della barra.
- parentesi tonde ( ) quadre [ ] graffe { } ESATTAMENTE come sono scritte
- frazione IMPILATA (numero sopra, linea, numero sotto): scrivila con il carattere ⁄ (frazione slash, U+2044) tra numeratore e denominatore, esempio: tre settimi = 3⁄7; se la frazione è dentro parentesi mantienile, esempio (3⁄7)

REGOLE ASSOLUTE:
1. TRASCRIVI soltanto ciò che è scritto: NON risolvere, NON calcolare, NON semplificare, NON aggiungere né togliere operatori, numeri o parentesi.
2. Se un simbolo è illeggibile scrivi un punto interrogativo ? al suo posto.
3. Nessun LaTeX, nessun markdown, nessun commento, nessuna spiegazione, NESSUN risultato.
4. Ignora numeri di esercizio, intestazioni, note e testi del libro: trascrivi SOLO l'espressione della riga principale.
5. NON interrompere MAI la trascrizione a metà: se il testo ha più termini, scrivili TUTTI fino all'ultimo. L'espressione deve risultare completa dal primo all'ultimo carattere (parentesi bilanciate).
6. ESEMPIO COMPLETO. Se nell'immagine c'è «radice di (tre settimi per (uno meno quattro settimi)), più radice di (un sessantaquattresimo)», la risposta esatta è:
√((3⁄7)·(1−4⁄7)) + √(1⁄64)
(spotare le parentesi della radice o scrivere * al posto del tratto di frazione è un ERRORE).`;

const AI_INTRO_PHOTO =
  "L'immagine è una foto (da libro o quaderno) che contiene una riga di espressione matematica, con possibili frazioni impilate ed esponenti in apice. ATTENZIONE alle RADICI: individua dove FINISCE la linea orizzontale della radice e metti tutto il radicando tra parentesi tonde.";
const AI_INTRO_INK =
  "L'immagine è generata dai TRATTI digitali disegnati a mano dall'utente su un riquadro bianco: contiene un FRAMMENTO di espressione, anche incompleto o non bilanciato, oppure UN SOLO numero o UNA SOLA cifra. Trascrivi i tratti così come sono. Un tratto verticale singolo o quasi è la CIFRA 1, mai la lettera l o I; nel dubbio tra cifra e lettera scegli sempre la cifra. REGOLA DELLA BARRA delle RADICI disegnate a mano: guarda DOVE INIZIA e DOVE FINISCE la linea orizzontale della radice — dentro √( ) vanno SOLO i simboli coperti dalla barra tra quei due estremi, né più né meno; un + o − disegnato DOPO la fine della barra sta FUORI (barra sopra il solo 3 e poi «+6» → √(3)+6, MAI √(3+6)).";
/* (26/10-bis) Variante per i canvas dove il tratto contiene (o può contenere)
   LETTERE: pezzi dell'espressione (pagina 2) e box simbolici (pagina 3).
   Il bias «nel dubbio cifra» va TOLTO, altrimenti a→2, b→6, z→2, g→9,
   o→0, s→5: la scrittura a mano con lettere non si riconosce mai. */
const AI_INTRO_INK_LETTERE =
  "L'immagine è generata dai TRATTI digitali disegnati a mano dall'utente su un riquadro bianco: contiene un FRAMMENTO di espressione, anche incompleto o non bilanciato, oppure UNA SOLA lettera o UN SOLO numero. I tratti possono contenere LETTERE variabili (a, b, c, d, m, n, x, y, z, …): trascrivi la lettera ESATTA che vedi disegnata, SEMPRE minuscola, e MAI sostituirla con una cifra simile (a non è 2, b non è 6, z non è 2, g non è 9, o non è 0, q non è 9, s non è 5, l non è 1, i non è 1). Un tratto verticale è la CIFRA 1 solo se nel tratto non ci sono altre lettere. ATTENZIONE alle RADICI disegnate a mano: la barra orizzontale della radice è il confine del radicando — dentro √( ) vanno SOLO i simboli coperti dalla barra; un + o − disegnato DOPO la fine della barra sta FUORI dalla radice (esempio: barra sopra il solo 3 e poi «+6» → √(3)+6, MAI √(3+6)).";

/** POST /api/ai/transcribe — body: { image: dataURL, kind: "photo"|"ink" }
 *  → { text: "<espressione trascritta>" }. Senza EASY_PEASY_API_KEY risponde
 *  503 e il client ripiega sul riconoscimento locale (Tesseract/ONNX).
 *  La route è registrata DENTRO startServer (app è nello scope della funzione). */
function registerAiRoutes(app: express.Express) {
  app.post("/api/ai/transcribe", express.json({ limit: "18mb" }), async (req, res) => {
  const client = aiClient();
  if (!client) {
    res.status(503).json({ error: "IA non configurata: manca EASY_PEASY_API_KEY sul server." });
    return;
  }
  const image = typeof req.body?.image === "string" ? req.body.image : "";
  const kind = req.body?.kind === "ink" ? "ink" : "photo";
  /* (26/10-bis) bias «lettera»: i canvas con lettere (pezzi pagina 2, box
     simbolici pagina 3) chiedono l'intro SENZA il bias anti-lettera. */
  const biasLettera = kind === "ink" && req.body?.bias === "lettera";
  if (!image.startsWith("data:image/")) {
    res.status(400).json({ error: "Immagine mancante o non valida." });
    return;
  }
  try {
    const response = await client.chat.completions.create(
      {
        model: AI_MODEL,
        temperature: 0,
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: (kind === "ink" ? (biasLettera ? AI_INTRO_INK_LETTERE : AI_INTRO_INK) : AI_INTRO_PHOTO) + "\n\n" + AI_CONTRACT },
              { type: "image_url", image_url: { url: image } },
            ],
          },
        ],
      },
      { signal: AbortSignal.timeout(90_000), maxRetries: 0 },
    );
    let text = (response.choices[0]?.message?.content ?? "").trim();
    /* (26/10-quarto) SECONDA PASSATA di verifica per i tratti con RADICI:
       la prima trascrizione viene riesaminata insieme all'immagine per
       correggere la struttura (estensione delle barre, apici, parentesi).
       Se la verifica fallisce o non migliora si tiene la prima trascrizione. */
    if (kind === "ink" && text.includes("√")) {
      try {
        const verify = await client.chat.completions.create(
          {
            model: AI_MODEL,
            temperature: 0,
            max_tokens: 4000,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text:
                      "Rileggi i tratti disegnati a mano nell'immagine. Ti propongo una PRIMA trascrizione: «" +
                      text.slice(0, 300) +
                      "». Verificala simbolo per simbolo rispetto all'immagine e restituisci la versione CORRETTA, con le stesse regole di formato. Correggi SOLO dove serve, in particolare: (1) la barra orizzontale di ogni radice: dentro √( ) vanno SOLO i simboli coperti dalla barra tra i suoi estremi, né più né meno — ciò che sta dopo la fine della barra sta FUORI dalla radice; (2) gli esponenti: un numero piccolo disegnato IN ALTO a destra è l'esponente con ^ (9² → 9^2, MAI 92); (3) parentesi bilanciate e nell'ordine disegnato. Rispondi SOLO con l'espressione corretta, su una riga.",
                  },
                  { type: "image_url", image_url: { url: image } },
                ],
              },
            ],
          },
          { signal: AbortSignal.timeout(90_000), maxRetries: 0 },
        );
        const t2 = (verify.choices[0]?.message?.content ?? "").trim();
        if (t2 && !t2.includes("?") && t2.includes("√")) text = t2;
      } catch {
        /* la verifica non è bloccante: si tiene la prima trascrizione */
      }
    }
    res.json({ text });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("AI transcribe error:", msg);
    res.status(502).json({ error: "La trascrizione IA non è andata a buon fine." });
  }
  }
  );

  /** POST /api/ai/verify-steps — VERIFICA IA DEI CONTI (25/10, richiesta
   *  utente: «l'app deve fornire sempre i conti in modo corretto secondo la
   *  filosofia generale dell'app»). body:
   *    { expression: string, steps: [{ i, kind, latex, detail, opLatex }] }
   *  → { ok: boolean, steps: [{ i, ok, motivo?, correzione? }] }
   *
   *  L'IA riceve SOLO i passi visibili dello svolgimento (MAI le risposte
   *  attese dello studente, MAI dati personali, MAI input audio/foto) e
   *  verifica che ogni conteggio e ogni transizione di stato sia corretto.
   *  Non genera passi nuovi e non svela risultati: restituisce solo verdetto
   *  per passo e, al massimo, la forma corretta dello stato (che il CLIENT
   *  accetta solo se combacia col valore della catena — l'IA propone, il
   *  motore dispone, vedi client/src/lib/aiVerify.ts). */
  app.post("/api/ai/verify-steps", express.json({ limit: "1mb" }), async (req, res) => {
    const client = aiClient();
    if (!client) {
      res.status(503).json({ error: "IA non configurata: manca EASY_PEASY_API_KEY sul server." });
      return;
    }
    const expression = typeof req.body?.expression === "string" ? req.body.expression.slice(0, 500) : "";
    const rawSteps = Array.isArray(req.body?.steps) ? req.body.steps : [];
    const steps = rawSteps.slice(0, 80).map((s: any, i: number) => ({
      i: typeof s?.i === "number" ? s.i : i,
      kind: String(s?.kind ?? "").slice(0, 40),
      latex: String(s?.latex ?? "").slice(0, 600),
      detail: String(s?.detail ?? "").slice(0, 600),
      opLatex: String(s?.opLatex ?? "").slice(0, 300),
    }));
    if (!expression || steps.length === 0) {
      res.status(400).json({ error: "Dati mancanti: servono expression e steps." });
      return;
    }
    const prompt =
      "Sei un verificatore di matematica per un'app didattica per studenti con DSA. " +
      "Ti mostro un'espressione e la CATENA DI PASSI generata dal motore: ogni passo ha " +
      "uno stato in LaTeX (latex), un'operazione mostrata allo studente (opLatex, vuota se sola notazione) " +
      "e una nota (detail, può contenere \\\\text{...}).\n\n" +
      "Compiti:\n" +
      "1) per ogni passo verifica che l'operazione (opLatex) sia scritta correttamente e che il suo " +
      "valore aritmetico sia giusto;\n" +
      "2) verifica che ogni stato (latex) sia matematicamente equivalente al precedente: la catena " +
      "deve conservare il valore dell'espressione dalla prima all'ultima riga;\n" +
      "3) segna ok=false SOLO per errori aritmetici o di scrittura CERTI (es. 729·1/216 valutato male, " +
      "segno perso, esponente sbagliato, frazione capovolta nel verso sbagliato). NON segnalare stile, " +
      "didattica, forma delle frazioni o scelta dei passi: non sono errori.\n" +
      "Se un passo è sbagliato, in «correzione» scrivi SOLO il LaTeX corretto dello STATO di quel passo " +
      "(stessa notazione, stesso stile, frazioni con \\\\dfrac). Non inventare passi nuovi; non scrivere " +
      "risultati al posto dello studente nelle motivazioni (motivo: massimo una frase tecnica).\n\n" +
      "Rispondi SOLO con JSON valido, senza testo attorno, in questa forma esatta:\n" +
      '{"ok":true,"steps":[{"i":0,"ok":true},{"i":1,"ok":false,"motivo":"...","correzione":"..."}]}\n\n' +
      "ESPRESSIONE: " +
      expression +
      "\n\nPASSI (JSON): " +
      JSON.stringify(steps);
    try {
      const response = await client.chat.completions.create(
        {
          model: AI_MODEL,
          temperature: 0,
          max_tokens: 2000,
          messages: [{ role: "user", content: prompt }],
        },
        { signal: AbortSignal.timeout(60_000), maxRetries: 0 },
      );
      let raw = response.choices[0]?.message?.content ?? "";
      // estrazione robusta del JSON (l'IA può aggiungere recinti di codice)
      raw = raw.replace(/```[a-z]*/gi, "").replace(/```/g, "").trim();
      const inizio = raw.indexOf("{");
      const fine = raw.lastIndexOf("}");
      if (inizio < 0 || fine <= inizio) {
        res.status(502).json({ error: "La verifica IA non ha prodotto un esito interpretabile." });
        return;
      }
      let parsed: any;
      try {
        parsed = JSON.parse(raw.slice(inizio, fine + 1));
      } catch {
        res.status(502).json({ error: "La verifica IA non ha prodotto un JSON valido." });
        return;
      }
      const outSteps = Array.isArray(parsed?.steps)
        ? parsed.steps
            .filter((x: any) => x && typeof x.i === "number")
            .slice(0, 80)
            .map((x: any) => ({
              i: x.i,
              ok: x.ok !== false,
              motivo: typeof x.motivo === "string" ? x.motivo.slice(0, 300) : undefined,
              correzione: typeof x.correzione === "string" ? x.correzione.slice(0, 600) : undefined,
            }))
        : [];
      res.json({ ok: parsed?.ok !== false, steps: outSteps });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("AI verify-steps error:", msg);
      res.status(502).json({ error: "La verifica IA dei conti non è andata a buon fine." });
    }
  });

  /** POST /api/ai/audio — DITTATO VOCALE (giro 25, adattato da
   *  https://github.com/andreakeating1982/AUDIO-MATEMATICI): body
   *  { audio: dataURL audio/wav (PCM 16 kHz mono) } → { spoken, notation }.
   *  L'IA multimodale trascrive IN ITALIANO ciò che è detto e converte il
   *  testo parlato in NOTAZIONE dell'app (frazioni impilate a⁄b, : divisione,
   *  · moltiplicazione, ^ potenze, √∛∜ radici) SENZA MAI calcolare.
   *  L'audio non viene conservato da nessuna parte. Guardie: silenzio puro,
   *  peso (≈20 s di WAV 16 kHz), chiave assente (503). */
  app.post("/api/ai/audio", express.json({ limit: "18mb" }), async (req, res) => {
    if (!aiClient()) {
      res.status(503).json({ error: "IA non configurata: manca EASY_PEASY_API_KEY sul server." });
      return;
    }
    const audio = typeof req.body?.audio === "string" ? req.body.audio : "";
    if (!audio.startsWith("data:audio/")) {
      res.status(400).json({ error: "Audio mancante o non valido." });
      return;
    }
    try {
      const buf = Buffer.from(audio.slice(audio.indexOf(",") + 1), "base64");
      if (buf.length > 1_500_000) {
        res.status(400).json({
          error: "Audio troppo lungo: detta l'espressione un pezzo alla volta (massimo 20 secondi per dettata).",
        });
        return;
      }
      if (wavIsSilent(buf)) {
        res.status(400).json({ error: "Non ho sentito nulla: prova a parlare più vicino al microfono." });
        return;
      }
      const { text: spoken } = await transcribeAudioWav(buf.toString("base64"));
      if (!spoken) {
        res.status(400).json({ error: "Non ho sentito nulla: prova a parlare più vicino al microfono." });
        return;
      }
      const { notation } = await parseMathText(spoken);
      if (!notation) {
        res.status(400).json({
          error: "Non ho riconosciuto un'espressione matematica: riprova a dettare con calma.",
        });
        return;
      }
      res.json({ spoken, notation });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("AI audio error:", msg);
      res.status(502).json({ error: msg || "La trascrizione del dettato non è andata a buon fine." });
    }
  });

  /** POST /api/ai/parse-spoken — RIANALIZZA CON IA (giro 27, come
   *  /api/math/parse di AUDIO-MATEMATICI): body { spoken } → { notation }.
   *  Rianalizza il testo parlato corretto a mano (o scritto da zero) in
   *  notazione dell'app, MAI calcolare. */
  app.post("/api/ai/parse-spoken", express.json({ limit: "1mb" }), async (req, res) => {
    if (!aiClient()) {
      res.status(503).json({ error: "IA non configurata: manca EASY_PEASY_API_KEY sul server." });
      return;
    }
    const spoken = typeof req.body?.spoken === "string" ? req.body.spoken.trim() : "";
    if (!spoken) {
      res.status(400).json({ error: "Testo mancante: scrivi o detta l'espressione prima di rianalizzare." });
      return;
    }
    try {
      const { notation } = await parseMathText(spoken);
      if (!notation) {
        res.status(400).json({ error: "Non ho riconosciuto un'espressione matematica: riprova." });
        return;
      }
      res.json({ notation });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("AI parse-spoken error:", msg);
      res.status(502).json({ error: msg || "L'interpretazione del testo non è andata a buon fine." });
    }
  });
}
// ═══════════════════════════════════════════════════════════════════════

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);

  registerAiRoutes(app);
  registerEsercizioRoutes(app);

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  // CORS per i font OpenDyslexic (usati anche dalle cornici embed su siti esterni)
  app.use("/fonts", (_req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    next();
  });

  // Ensure .wasm files are served with the correct MIME type.
  // IMPORTANTE: COOP/COEP sono impostati SOLO sui documenti HTML (servono a
  // ONNX Runtime Web per SharedArrayBuffer). NON vanno messi su font/asset:
  // altrimenti il font OpenDyslexic non puo' essere caricato cross-origin dalle
  // cornici embed su Blogger (ricadrebbe su un font serif).
  app.use(
    express.static(staticPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".wasm")) {
          res.setHeader("Content-Type", "application/wasm");
        }
        if (filePath.endsWith(".html")) {
          res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
          res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
        }
      },
    })
  );

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);

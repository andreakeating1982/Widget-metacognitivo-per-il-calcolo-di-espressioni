import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import { BAKED_EASY_PEASY_API_KEY } from "../shared/env.generated";
import { transcribeAudioWav, parseMathText, wavIsSilent } from "./audio";
import { registerEsercizioRoutes } from "./costruisci";
import { segnalaDecimaliDiscordanti } from "../client/src/lib/ocrDecimalConfidence";

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
- potenza con ^ (esempio: x^2). ESPONENTE IN APICE: un numero PICCOLO disegnato IN ALTO a destra di un numero o di una parentesi è l'ESPONENTE e va scritto con ^ — 9² → 9^2, MAI 92; 3² → 3^2, MAI 32; (3²)² → (3^2)^2. Due cifre affiancate alla STESSA altezza sono invece un numero a due cifre (92, 89). ESPONENTE NEGATIVO: il segno − in apico va trascritto con ^- : x⁻¹ → x^-1, a⁻² → a^-2, b⁻² → b^-2. Gli apici sono PICCOLI ma non si scartano MAI: un termine con esponente negativo va scritto PER INTERO, non omesso (10/11)
- radice quadrata con √, radice cubica con ∛, radice quarta con ∜. REGOLA DELLA BARRA (fondamentale con la scrittura a mano): individua PRIMA la linea orizzontale della radice e guarda con precisione DOVE INIZIA e DOVE FINISCE; il radicando è ESATTAMENTE ciò che sta sotto la barra tra quei due estremi, né più né meno. Esempio decisivo: barra sopra «3+6» → √(3+6); barra sopra il SOLO «3» con «+6» disegnato DOPO la fine della barra → √(3)+6. Metti il radicando COMPLETO tra parentesi tonde subito dopo il simbolo. Esempi: radice di 3/7 = √(3⁄7); radice di (3/7 · (1 − 4/7)) = √((3⁄7)·(1−4⁄7)); radice di 9 = √(9). MAI scrivere √3⁄7 o √1⁄64: la radice coprirebbe solo il primo numero. MAI estendere il radicando oltre la fine della barra. RADICE E FRAZIONE: guarda se il segno di radice racchiude verticalmente TUTTA la frazione oppure soltanto il numeratore. Se copre tutta la frazione, scrivi √(numeratore⁄denominatore), per esempio √(9⁄4). Se invece copre il solo numeratore, racchiudi l'INTERA radice tra parentesi prima della barra della frazione: (√(numeratore))⁄denominatore; per esempio (√(25x^4))⁄x. Non spostare mai il denominatore dentro o fuori dalla radice senza riscontro nella foto.
- NUMERI DECIMALI E PERIODICI: usa la virgola decimale. Osserva la piccola barretta ORIZZONTALE sopra le cifre: solo le cifre coperte sono il periodo. Scrivi «1,3per» se la barretta copre solo il 3; scrivi «0,23per» se copre 23; scrivi «0,1_6per» se il solo 6 è periodico e l'1 non lo è. Distingui SEMPRE le cifre prima della barra da quelle coperte: «0,05per» significa che la barretta copre ENTRAMBE le cifre 0 e 5; «0,0_5per» significa che copre SOLO il 5. Il simbolo _ è indispensabile quando c'è un antiperiodo, anche se l'antiperiodo è zero. Se non c'è alcuna barretta scrivi il decimale normale, per esempio «0,5», senza aggiungere «per». Non inventare o cancellare una barretta; se è illeggibile usa ?.
- INDICE DELLA RADICE: il piccolo numero al vertice del simbolo di radice è l'INDICE (√ senza numero = indice 2; 3 davanti alla √ = cubica; 4 = quarta). Distingui il segno meno dell'indice dalla barretta del periodico dalla POSIZIONE, non dall'orientamento: entrambi sono trattini orizzontali. Il meno dell'indice è immediatamente a sinistra della cifra dell'indice; la barretta del periodo è sopra le cifre decimali che copre. Se vedi −3 come indice, trascrivi ⁻³√(9); NON trasformarlo in una potenza del coefficiente, NON omettere il meno e NON correggerlo in un indice positivo. Se la posizione è illeggibile, segnala incertezza con ?.
- parentesi tonde ( ) quadre [ ] graffe { } ESATTAMENTE come sono scritte
- frazione IMPILATA (numero sopra, linea, numero sotto): scrivila con il carattere ⁄ (frazione slash, U+2044) tra numeratore e denominatore, esempio: tre settimi = 3⁄7; se la frazione è dentro parentesi mantienile, esempio (3⁄7)
- FRAZIONI ALGEBRICHE (con lettere, potenze, somme, differenze o prodotti sopra o sotto la linea): il NUMERATORE è TUTTO ciò che sta SOPRA la linea di frazione, il DENOMINATORE è TUTTO ciò che sta SOTTO la linea. Se il numeratore o il denominatore NON è un solo numero, una sola lettera, una sola potenza (a^2, x^3) o UNA SOLA RADICE (√(ab), ∛(x+1)), racchiudilo SEMPRE tra parentesi tonde — anche quando dentro c'è una radice: (√(x)+4)⁄(√(x)+2), (√(3))⁄2. Scrivi ogni frazione per intero, una dopo l'altra, anche quando nella riga ce ne sono tre o più unite da + e −. Esempi: x⁄(x^2-1) · (a+b)⁄(a-b) · (2x)⁄(3y) · x^2⁄(xy-y^2) · (x^2-1)⁄x · 1⁄(x+2). Esempio completo: «x/(x−1) − (x+1)/(x²−1)» con le frazioni impilate si scrive x⁄(x-1)-(x+1)⁄(x^2-1). SENZA le parentesi il significato CAMBIA (x+1⁄x^2-1 è un'altra espressione): è un ERRORE grave. Un termine scritto accanto a una frazione ma FUORI dalla linea (come x² in «½x²») NON fa parte del denominatore: si scrive 1⁄2x^2

REGOLE ASSOLUTE:
1. TRASCRIVI soltanto ciò che è scritto: NON risolvere, NON calcolare, NON semplificare, NON aggiungere né togliere operatori, numeri o parentesi (unica eccezione: le parentesi che delimitano numeratore e denominatore di una frazione impilata, come spiegato sopra).
2. Se un simbolo è illeggibile scrivi un punto interrogativo ? al suo posto.
3. Nessun LaTeX, nessun markdown, nessun commento, nessuna spiegazione, NESSUN risultato.
4. Ignora numeri di esercizio, intestazioni, note e testi del libro: trascrivi SOLO l'espressione della riga principale.
5. NON interrompere MAI la trascrizione a metà: se il testo ha più termini, scrivili TUTTI fino all'ultimo. L'espressione deve risultare completa dal primo all'ultimo carattere (parentesi bilanciate). SE LA RIGA INIZIA O FINISCE con + o − manca un termine che non hai riportato: ricontrolla i BORDI dell'immagine e i termini con apico minuscolo (x^-1, a^-2): vanno TUTTI riportati.
6. CONTATORE DI TERMINI: prima di rispondere conta i termini separati da + e − nella foto e verifica che la tua risposta ne abbia ESATTAMENTE lo stesso numero.
7. ESEMPIO COMPLETO. Se nell'immagine c'è «radice di (tre settimi per (uno meno quattro settimi)), più radice di (un sessantaquattresimo)», la risposta esatta è:
√((3⁄7)·(1−4⁄7)) + √(1⁄64)
(spotare le parentesi della radice o scrivere * al posto del tratto di frazione è un ERRORE).`;

const AI_INTRO_PHOTO =
  "L'immagine è una foto (da libro o quaderno) che contiene una riga di espressione matematica, con possibili frazioni impilate ed esponenti in apice. CONTROLLA SEPARATAMENTE ogni tratto orizzontale: una lunga barra di frazione principale NON è la barra della radice scritta nel denominatore. Il segmento della radice parte dal suo uncino, termina dove termina quella specifica barra e non continua automaticamente sotto tutta la frazione. Anche se un punto di moltiplicazione è seguito da una parentesi sotto la barra di frazione generale, essi sono FUORI dalla radice se stanno oltre il termine della barra della radice. Ricontrolla il radicando carattere per carattere contro l'immagine prima di chiudere la parentesi. ATTENZIONE alle RADICI: individua dove FINISCE la linea orizzontale della radice e metti tutto il radicando tra parentesi tonde. La REGOLA DELLA BARRA vale anche nel NUMERATORE e nel DENOMINATORE di una frazione: esamina ogni radice separatamente e leggi tutto e soltanto ciò che è coperto dalla sua barra. Non presumere che radicandi diversi siano uguali, anche se le barre sembrano della stessa lunghezza. Se un termine come «+1» si trova fuori dalla barra, non inserirlo dentro la radice. ATTENZIONE alle frazioni impilate: valuta se il simbolo della radice abbraccia tutta la frazione, √(numeratore⁄denominatore), oppure SOLO il numeratore, (√(numeratore))⁄denominatore. ATTENZIONE ai decimali: una barretta sopra una o più cifre indica il periodo, da riportare usando «per» secondo le regole. ATTENZIONE all'INDICE della radice: distingui il trattino orizzontale del meno immediatamente a sinistra della cifra dell'indice dalla barretta, anch'essa orizzontale, sopra le cifre di un decimale periodico. Un indice negativo, se visibile, si trascrive fedelmente (es. ⁻³√(9)), senza trasformarlo in un esponente del coefficiente. Se non è leggibile, usa ?.";
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
    /* (12/11, richiesta utente) DECIMALI SEMPRE CON LA VIRGOLA: anche se il
     * modello rispondesse col punto decimale, il testo mostrato allo studente
     * usa la virgola italiana. Nella notazione dell'app cifra.cifra non ha
     * mai un altro significato. */
    text = text.replace(/(\d)\.(\d)/g, "$1,$2");
    /* (26/10-quarto) SECONDA PASSATA di verifica per i tratti con RADICI:
       la prima trascrizione viene riesaminata insieme all'immagine per
       correggere la struttura (estensione delle barre, apici, parentesi).
       Se la verifica fallisce o non migliora si tiene la prima trascrizione. */
    /* (09/11-fix, foto «radicali con lettere»: la verifica a doppia passata
     *  vale anche per le FOTO con radici o frazioni — la prima trascrizione
     *  metteva la radice sull'intera frazione invece che sul numeratore. */
    const hasRad = text.includes("√") || text.includes("∛") || text.includes("∜");
    const hasFrac = text.includes("⁄");
    // Una foto con decimali va riletta anche se non contiene radici o frazioni:
    // la prima lettura potrebbe aver trascurato la piccola barra del periodo.
    const hasDecimal = /\d+[,.]\d/.test(text) || /\\(?:overline|bar)|\d+per/i.test(text);
    if ((kind === "ink" || kind === "photo") && (hasRad || hasFrac || (kind === "photo" && hasDecimal))) {
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
                      (kind === "ink"
                        ? "Rileggi i tratti disegnati a mano nell'immagine."
                        : "Rileggi la riga di espressione nella foto.") +
                      " Ti propongo una PRIMA trascrizione: «" +
                      text.slice(0, 600) +
                      "». Verificala simbolo per simbolo rispetto all'immagine e restituisci la versione CORRETTA, con le stesse regole di formato. Correggi SOLO dove serve, in particolare: (1) la barra orizzontale di ogni radice: dentro √( ) vanno SOLO i simboli coperti dalla barra tra i suoi estremi, né più né meno — ciò che sta dopo la fine della barra sta FUORI dalla radice; se la radice abbraccia SOLO il numeratore scrivi (√(numeratore))⁄denominatore; se il simbolo della radice abbraccia tutta la frazione scrivi √(numeratore⁄denominatore); (2) ogni frazione impilata: NUMERATORE è tutto ciò che sta SOPRA la linea, DENOMINATORE tutto ciò che sta SOTTO, con ⁄ tra i due e parentesi tonde se non sono un solo numero/lettera/potenza; (3) gli esponenti: un numero piccolo disegnato IN ALTO a destra è l'esponente con ^ (9² → 9^2, MAI 92); (4) parentesi bilanciate e nell'ordine disegnato; (5) le BARRETTE SOPRA I DECIMALI: un 3 con la barretta è scritto 1,3per, una barretta sul solo 6 di 0,16 è scritta 0,1_6per. Una barretta sul solo 5 in 0,05 è 0,0_5per, NON 0,05per (quest'ultimo significherebbe una barretta su entrambe le cifre). Anche uno zero iniziale non coperto va scritto prima di _; se non c'è la barretta non aggiungere per. (6) l'INDICE della radice: il piccolo numero al vertice del simbolo di radice; il segno meno dell'indice è un trattino ORIZZONTALE subito a sinistra della cifra dell'indice; la barretta del periodo è orizzontale sopra le cifre del coefficiente. Se il meno è visibile accanto all'indice, trascrivi fedelmente l'indice negativo (es. ⁻³√(9)), senza attribuirlo al coefficiente; se il segno è illeggibile usa ?. Confronta attentamente l'immagine, non inventare né cancellare la barretta. Se il simbolo non si legge, usa ?. Rispondi SOLO con l'espressione corretta, su una riga, senza risultati.",
                  },
                  { type: "image_url", image_url: { url: image } },
                ],
              },
            ],
          },
          { signal: AbortSignal.timeout(90_000), maxRetries: 0 },
        );
        const t2 = (verify.choices[0]?.message?.content ?? "").trim().replace(/(\d)\.(\d)/g, "$1,$2");
        if (
          t2 &&
          // Se la rilettura segnala un simbolo incerto, mostralo all'utente:
          // scartare «?» favoriva una prima lettura potenzialmente sbagliata.
          (!hasRad || /√|∛|∜/.test(t2)) &&
          (!hasFrac || t2.includes("⁄"))
        ) {
          // Se le due letture divergono su cifre o barretta di un decimale,
          // non scegliere arbitrariamente: il punto interrogativo resta nel
          // campo modificabile e impedisce di costruire un esercizio ambiguo.
          text = kind === "photo" ? segnalaDecimaliDiscordanti(text, t2).text : t2;
        }
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

# 🧭 IMPLEMENTAZIONE-IA — Sezione apposita per implementare mediante IA

> ⚠️ **NOTA DI ALLINEAMENTO (settembre 2026)**: questa guida è stata ereditata dalla
> famiglia di app «Widget Matematico». L'argomento di QUESTA app sono le **espressioni
> letterali, monomi e polinomi**: dove la guida parla di equazioni, grado, Δ, t = x^k,
> leggi «espressione», «gruppi di monomi simili», «somma dei coefficienti» ecc. I
> riferimenti a `docs/grado.md`, `docs/disequazioni.md`, `docs/fratte.md`, `docs/quiz.md`
> e `scripts/clone_app.py` NON esistono più: per le varianti vedi `ADATTARE.md`. Il motore
> matematico è `client/src/lib/espressioni.ts` (+ test), la pagina studente
> `client/src/pages/EspressioniExercises.tsx`, la mappa PDF `client/src/lib/mappaPdf.ts`.

> **Documento operativo per un'Intelligenza Artificiale** (MARKY su Easy-Peasy.AI,
> GitHub Copilot, Claude, ChatGPT, ecc.) o per uno sviluppatore, per **implementare
> mediante IA** le tre aree chiave di questa app:
>
> 1. **Scattare foto → ritaglio foto → riconoscimento → trascrizione** (OCR dell'equazione)
> 2. **Produzione di mappe concettuali specifiche** (PDF dinamico su misura)
> 3. **Debug del "tremolio"** (iframe che vibram nell'embed del blog)
>
> Questo documento è la **sezione approfondita e dedicata**: per l'indice generale
> partire da [`AGENTS.md`](AGENTS.md) e [`GUIDA-IA.md`](GUIDA-IA.md). Tutto il
> descritto qui è verificato sul codice reale della repository (Settembre 2026).

---

## INDICE

1. [Area 1 — Foto, ritaglio, riconoscimento OCR, trascrizione](#area-1--foto-ritaglio-riconoscimento-ocr-trascrizione)
2. [Area 2 — Produzione di mappe concettuali specifiche](#area-2--produzione-di-mappe-concettuali-specifiche)
3. [Area 3 — Debug del "tremolio"](#area-3--debug-del-tremolio)
4. [Regole non negoziabili di queste tre aree](#regole-non-negoziabili-di-queste-tre-aree)

---

## Area 1 — Foto, ritaglio, riconoscimento OCR, trascrizione

### 1.1 A che serve

Lo studente **non digita** l'equazione: la **fotografa** dal libro o dal quaderno
(dal telefono o dal PC), **ritaglia** solo la riga utile, e l'app la **riconosce**
(OCR) e la **trascrive** nel campo dell'equazione, pronto da controllare e confermare
con **OK**. È il percorso principale di input oltre alla scrittura a mano (ONNX).

### 1.2 La pipeline completa (flow reale del codice)

```
UI box foto (EspressioniExercises.tsx ~riga 1106)
  ├─ SCATTA UNA FOTO   → <input type="file" capture="environment"> (fotocamera telefono)
  ├─ CARICA IMMAGINE   → file picker (JPG / PNG / WEBP, max 18 MB)
  ├─ Trascina qui      → drag & drop sull'area (dragOver / onDrop)
  └─ Ctrl+V            → window.addEventListener("paste") (~riga 477–492)
        │
        ▼
normalizePhoto(file)                    [client/src/lib/imagePrep.ts]
  · corregge l'orientamento EXIF (createImageBitmap { imageOrientation: "from-image" })
  · produce PNG lossless "dritto" (MAI JPEG: i blocchi DCT affogano l'OCR)
  · riduce le foto enormi a lato max 2600 px (tempi + memoria)
        │
        ▼
CropDialog { open, imageUrl, onConfirm } [client/src/components/CropDialog.tsx]
  · box di ritaglio LIBERO con 4 bordi + 4 angoli, maniglie DENTRO la foto
  · trascinamento su listener globali (continua anche fuori dalla maniglia)
  · onConfirm(croppedFile: File)
        │
        ▼
enhanceForOcr(file)                     [client/src/lib/imagePrep.ts]
  · ingrandimento A PASSI (max ×2 per passo) + maschera di nitidezza:
    un singolo drawImage ×3–5 SFUMA gli esponenti in apice (x⁴ → «2x243x»)
  · lato corto portato a ≥ 1100 px, lato max 2200 px
    ⚠️ APP ESPRESSIONI (6/10): la SCALA si sceglie dall'ALTEZZA DELLE CIFRE (`glyphScale.ts`:
    cifre portate a `DIGIT_TARGET_PX` = 60 px, lato max 4800 px / 9 Mpx), NON dal lato corto del
    ritaglio: una riga 570×49 diventava 12 800×1100 (cifre di 420 px) e il «4²» usciva «+» o «4^22».
    Il criterio 1100/2200 resta SOLO come ripiego se nell'immagine non si trovano cifre.
  · scala di grigi + stiramento del contrasto (pagina gialla, ombre, luci)
        │
        ▼
ocrImage(file, onProgress)              [client/src/lib/ocr.ts]
  · Tesseract.js worker SELF-HOSTED: /tess/worker.min.js, corePath /tess,
    langPath /tessdata — niente CDN (COOP/COEP richiesti dal server, vedi §1.3)
  · lingua "eng", OEM 1 (LSTM), PSM.SINGLE_BLOCK,
    preserve_interword_spaces="1", user_defined_dpi="300"
  · APP ESPRESSIONI (6/10): dopo la lettura, `reconcileSymbols` (`ocrReconcile.ts`) riconcilia i simboli di
    Tesseract con i GLIFI reali dell'immagine preparata: tipo di parentesi dai pixel (`printedBracket.ts`),
    esponenti riletti a template (`pickExponentRead`), cifre/segni/esponenti persi reinseriti, simboli fusi
    esplosi, allucinazioni scartate. Dettagli, numeri e banco di prova: `GUIDA-IA.md` §20
        │
        ▼
normalizeEquationOcrDetailed(raw)       [client/src/lib/eqOcr.ts] → { equation, fuzzy }
  · vedi §1.4: ricostruzione della trinomia dal testo sconnesso di Tesseract
        │
        ▼
TRASCRIZIONE: il testo normalizzato finisce nel campo equazione (modificabile),
con badge/flag fuzzy se l'OCR era incerto; lo studente controlla e preme OK.
```

### 1.3 Dettagli critici (perché funziona — NON cambiare alla leggera)

| Dettaglio | Perché è così |
|---|---|
| **PNG lossless** dopo il ritaglio | I blocchi JPEG, dopo l'ingrandimento per l'OCR, diventano rumore che affoga Tesseract (verificato con sonde A/B). |
| **Ingrandimento a passi (max ×2/step) + unsharp** | Un singolo drawImage grande sfuma gli apici: x⁴ viene letto «2x243x». |
| **COOP/COEP + asset self-hosted** | L'app serve header COOP/COEP (server `server/index.ts`) per ONNX Runtime Web; Tesseract worker/core/`tessdata` sono quindi self-hosted in `client/public/tess/` e `client/public/tessdata/` — **niente CDN**, funziona anche offline e su Render senza config. |
| **Scala dalle CIFRE (app espressioni, 6/10)** | Misurata con `bench/photoSweep.sh` su 121 casi: obiettivo 40/50/55/**60**/70/80 px → 105/104/101/**109**/101/97 esatti. Oltre ~70 px i glifi si fondono («4²» in un solo simbolo), sotto 50 le righe sintetiche a bassa risoluzione perdono cifre. |
| **Nessun calcolo dopo la foto** | La foto produce SOLO il testo nel campo tastiera: lo studente lo controlla e preme «CONFERMA E CALCOLA»; ogni passo attende il risultato dell'utente (richiesta esplicita). |
| **Lingua "eng"** | È la voce che riconosce meglio cifre, `x`, `+ − =` di un'equazione; le lingue "it" introducono rumore. |
| **PSM.SINGLE_BLOCK + dpi 300** | Una riga di equazione è un blocco unico; il dpi dichiarato aiuta il motore a calibrare la dimensione dei glifi. |
| **Formato italiano** | Decimali con virgola, MAIUSCOLE via CSS — la trascrizione rispetta le convenzioni dell'app (vedi `GUIDA-IA.md` §12). |

### 1.4 La ricostruzione dell'equazione (`eqOcr.ts`) — il cuore dell'area

Tesseract legge **malissimo gli esponenti in apice** (x⁴ diventa «*», «t», «X44» o
sparisce), mentre coefficienti e segni li legge bene. Per questo
`normalizeEquationOcrDetailed` NON fa un semplice cleanup: **ricostruisce la trinomia**:

1. **Ricostruzione trinomia (v3)** — l'app tratta solo trinomie `ax⁴ + bx² + c = 0`:
   - scansiona **entrambi i lati** del `=`: ogni «x» trovata è un termine; il
     coefficiente è l'eventuale numero con segno attaccato **prima**; tutto ciò che
     segue la x fino al prossimo segno/x è l'esponente illeggibile e viene **scartato**;
   - la potenza (x⁴ o x²) si legge dalla cifra attaccata alla x quando è
     riconoscibile («x4», «x²», «x⁴»), altrimenti **per posizione** (prima x → x⁴,
     seconda → x²);
   - la RHS viene **spostata a sinistra con i segni invertiti**: gestisce così
     «x⁴ = 5x² − 4», «x⁴ − 5x² = −4», «5x² − 4 = x⁴»;
   - se manca il termine in x² ma ci sono due costanti (l'OCR ha mangiato la x di
     «5x²»), la prima costante ne diventa il coefficiente: «x⁴ − 5 + 4 = 0» →
     «x⁴ − 5x² + 4 = 0» (**recupero della x² persa**);
   - se il coefficiente guida risulta negativo, moltiplica tutto per −1 (a > 0).
2. **Fallback**: per forme inatteste si applica la normalizzazione classica; se non
   basta si riprova la ricostruzione sul testo già normalizzato (**seconda chance**,
   utile quando il «=0» è stato tagliato dal ritaglio).
3. **Flag `fuzzy`**: se la ricostruzione è andata in inferenza (non su glifi certi),
   la UI lo segnala — lo studente deve controllare con più attenzione.

### 1.5 Come estendere/modificare questa area (checklist IA)

| Obiettivo | Dove intervenire |
|---|---|
| Migliorare la lettura degli apici | `client/src/lib/imagePrep.ts` → soglie `MIN_EDGE`/`MAX_EDGE` e la logica di upscale a passi. Modificare solo con test A/B (fotografia reale prima/dopo). |
| Nuove forme di equazione riconoscibili | `client/src/lib/eqOcr.ts` → la ricostruzione v3 è specifica per trinomie `ax⁴+bx²+c`. Per altre forme aggiungere un ramo dedicato, MAI alterare il comportamento esistente (regressione OCR). |
| Cambiare il motore/la lingua OCR | `client/src/lib/ocr.ts` → `getWorker()` (lang, PSM, paths self-hosted). Se cambi `langPath` devi aggiungere i `.traineddata` in `client/public/tessdata/`. |
| Nuovi modi di inserire la foto | `EspressioniExercises.tsx` sezione "Foto dell'equazione" (~riga 400–500 e ~1106): drag&drop, paste, camera. Tutti i percorsi convergono su `handlePhoto → normalizePhoto → CropDialog`. |
| Provare la pipeline senza UI (console del browser) | `const f = new File([blob],'eq.png',{type:'image/png'}); const t = await (await import('/src/lib/ocr')).ocrImage(f); console.log(t, (await import('/src/lib/eqOcr')).normalizeEquationOcrDetailed(t))` |

> ⚠️ Dopo QUALSIASI modifica: `pnpm check` + prova con **foto reali difficili**
> (sfocate, inclinate, sfondo scuro, foto da telefono lontane). L'OCR è la parte più
> fragile dell'app: ogni cambiamento va verificato su un set di 5–6 foto reali.

---

## Area 2 — Produzione di mappe concettuali specifiche

### 2.1 A che serve

L'app genera per ogni esercizio risolto una **mappa concettuale PDF** in due parti
(pulsante giallo **🗺️ MAPPA CONCETTUALE (PDF)** nella terza schermata), adatta agli
studenti BES/DSA (font OpenDyslexic, colori, alto contrasto, box ordinati). Un'IA può
**produrre mappe specifiche** per qualsiasi trinomia `ax⁴ + bx² + c = 0` — ad esempio
per preparare schede già pronte per la classe — chiamando le funzioni esportate.

### 2.2 Le funzioni esportate (`client/src/lib/mappaPdf.ts`)

```ts
export interface MappaRootEntry {
  value: number;          // valore numerico della radice positiva (arrotondato)
  radicalLatex: string;   // LaTeX della forma radicale, es. "\\sqrt{4}"
  isRational: boolean;
  isInteger: boolean;
}

export interface MappaPdfData {
  studentLabel: string;    // "Rossi Mario — Classe 3B — 12/05/2025" (già formattata)
  eqLatex: string;         // equazione completa in LaTeX (builder dell'app)
  tEqLatex: string;        // equazione in t in LaTeX
  a: number; b: number; c: number;
  delta: number;
  isDeltaPerfectSquare: boolean;  // Δ quadrato perfetto → t₁/t₂ e √Δ numerici
  hasDoubleRoot: boolean;         // Δ ≈ 0 → t₁ = t₂
  deltaNegative: boolean;         // Δ < 0 → nessuna soluzione reale
  t1: number | null; t2: number | null;
  xValues: number[];              // soluzioni x ordinate, con segno
  hasRealSolutions: boolean;
  rootEntries: MappaRootEntry[];
}

export function buildMappaHtml(d: MappaPdfData): string;
// ritorna l'HTML AUTOCONTENUTO della mappa (KaTeX + font inline), pronto per
// essere aperto in una finestra o scritto su file

export function openMappaPdf(d: MappaPdfData): void;
// apre una finestra, scrive l'HTML e lancia window.print() (→ "Salva come PDF")
```

**Esempio — generare la mappa di `x⁴ − 5x² + 4 = 0` per uno studente:**

```ts
import { openMappaPdf, type MappaPdfData } from "@/lib/mappaPdf";

const d: MappaPdfData = {
  studentLabel: "Rossi Mario — Classe 3B — 13/09/2026",
  eqLatex: "x^{4} - 5x^{2} + 4 = 0",
  tEqLatex: "t^{2} - 5t + 4 = 0 \\quad (t = x^{2})",
  a: 1, b: -5, c: 4,
  delta: 9, isDeltaPerfectSquare: true,
  hasDoubleRoot: false, deltaNegative: false,
  t1: 1, t2: 4,
  xValues: [-2, -1, 1, 2], hasRealSolutions: true,
  rootEntries: [
    { value: 1, radicalLatex: "\\sqrt{1}", isRational: true, isInteger: true },
    { value: 2, radicalLatex: "\\sqrt{4}", isRational: true, isInteger: true },
  ],
};
openMappaPdf(d); // apre la stampa del PDF
```

Nell'app i dati arrivano **dall'esercizio risolto** (in `EspressioniExercises.tsx` il
gestore del pulsante MAPPA costruisce `MappaPdfData` dai risultati calcolati) — un'IA
che vuole generare schede per la classe può costruire i `MappaPdfData` in un piccolo
script e usare `buildMappaHtml` per produrre HTML/PDF in blocco.

### 2.3 Struttura interna (cosa produce, esattamente)

- **PARTE A — mappa svolta** (dinamica): banner con l'equazione → definizione → box
  RICORDA → PASSO 1…6 → box RICORDA LE FORMULE → RISULTATO. Ogni passo numerico
  mostra la **formula letteraria sopra** e la sostituzione numerica sotto.
- **PARTE B — mappa da completare** (titolo solo «MAPPA CONCETTUALE»): la **stessa
  equazione** con valori in `\dots` per compilare a mano; mostra SOLO i passi che
  l'equazione sviluppa davvero (Δ<0 → 3 passi; Δ=0 → senza Passo 5). Nei passi 3, 4
  e 5 la **formula letteraria visibile sta SEMPRE sopra** quella puntinata:
  PASSO 3 `Δ = b² − 4·a·c`; PASSO 4 `t₁ = (−b+√Δ)/(2·a)`; PASSO 5
  `t₂ = (−b−√Δ)/(2·a)` (stesso trattamento del delta, richiesto dall'utente).
- **Paginazione con misurazione reale**: i box vengono misurati NEL DOM
  (`PAGE_BUDGET ≈ 950 px` utile per pagina) così ogni pagina è piena fino al margine
  (fill tipico 85–91%), con fallback prudenziale a stima in caso di errore; footer
  «Pagina N di M» che **riparte da 1 per ogni parte**; margini 2,5 cm su 4 lati.
- **Palette**: oggetto costante `C` in testa al file (viola titolo, blu/passi, oro).
  I testi dei passi si cambiano SOLO nei builder (Parte A / Parte B).

### 2.4 Personalizzazioni tipiche (checklist IA)

| Obiettivo | Dove intervenire |
|---|---|
| Mappa per un'equazione specifica (scheda pronta) | costruire un `MappaPdfData` (§2.2) e chiamare `buildMappaHtml`/`openMappaPdf` |
| Cambiare titoli/intestazioni | `buildMappaHtml` → costanti titolo + `stepBox(...)` di Parte A/B |
| Cambiare colori | oggetto `C` in testa a `mappaPdf.ts` |
| Adattare a un altro grado (cloni) | SOLO i testi dei passi (t = x^k, ritorno ±√[k]{t}); l'interfaccia `MappaPdfData` resta valida |
| Nuovo PDF scaricabile (quaderno) | è un altro percorso (`handleScaricaPdf` in `EspressioniExercises.tsx`), non la mappa — non confonderli |

> ⚠️ **MAI** scrivere un PDF "a occhio" con stime fisse: la paginazione è basata su
> misurazione DOM e margini 2,5 cm. Qualunque box aggiunto deve passare dalla stessa
> logica (`items.push(stepBox/solidBox/...)`) per essere paginato e numerato correttamente.

---

## Area 3 — Debug del "tremolio"

### 3.1 Sintomo e cause (diagnosi storica, misurata)

**Sintomo**: l'app incorporata nel blog (iframe con altezza automatica) vibra
continuamente di pochi pixel; la pagina "respira" senza che l'utente tocchi nulla.

**Cause trovate e misurate** (Settembre 2026, strumento §3.2):

1. **L'app rinviava l'altezza a OGNI tick** — ResizeObserver + evento resize + risposta
   al ping (ogni 3 s), senza arrotondamento né filtri: **58 messaggi in 82 s** con
   l'iframe che si allungava a scalini di +1…+6 px senza mai fermarsi.
2. **Cornici embed con `transition: height` + applicazione immediata** (versioni vecchie
   lite/base64/universale): durante l'animazione di 0,25 s l'app misura altezze
   **intermedie** e le rinviare → il ciclo si autoalimenta.
3. **Reflow della barra di scorrimento**: se il contenuto sconfinava di mezzo pixel
   (zoom / devicePixelRatio frazionari, altezze intere arrotondate per difetto),
   la scrollbar compariva/spariva → larghezza variabile → ritesti → altezza diversa.

### 3.2 Lo strumento di misura: `client/public/test-tremolio.html`

Pagina di test **già inclusa** nel pacchetto. Serve il dev server attivo
(`pnpm dev`), poi apri:

```
http://localhost:5173/test-tremolio.html?mode=bad   ← replica la cornice VECCHIA
                                                      (transizione + applica ogni
                                                       messaggio, nessun filtro)
http://localhost:5173/test-tremolio.html?mode=v3    ← replica la cornice dedicata v3
                                                      (debounce 200 ms, filtro ±2 px)
```

Nel pannello di destra ogni messaggio è registrato con timestamp. In console:

```js
window.__report()
// → { modalita, messaggi_ricevuti, applicazioni, valori_distinti,
//     ultimi_delta, inversioni_di_direzione, durata_s, ultima_applicata }
```

**Criteri di salute** (dopo il caricamento, a pagina ferma):
`messaggi_ricevuti` stabile (solo i ping a cadenza 3 s se forzati), `ultimi_delta`
tutti a 0, `inversioni_di_direzione` = 0, `valori_distinti` fermo su 1–3 valori di
caricamento. Prima del fix: 58 messaggi/82 s con crescendo continuo; dopo il fix:
silenzio totale dopo il caricamento, e i cambiamenti veri sono seguiti subito
(+300 px seguiti in <1 s; ritorno e micro-cambiamenti +10 px inclusi).

### 3.3 Le contromisure già implementate (NON rimuoverle)

**Lato app — `client/src/lib/heightSync.ts`** (funzionano con QUALSIASI cornice):

1. **Arrotondamento per eccesso** (`Math.ceil`) su una misura **frazionaria** (max fra
   `getBoundingClientRect().height`, `scrollHeight`, `offsetHeight` di body e
   documentElement): dopo l'applicazione il contenuto non sconfinerà MAI dall'iframe →
   niente scrollbar → nessun reflow → il ciclo non riparte.
2. **Isteresi 3 px**: differenze minori non vengono inviate.
3. **Silenzio post-invio 400 ms**: le rimisure intermedie sono scartate (copre le
   transizioni CSS ~250 ms); un salto VERO (≥ 30 px) passa comunque subito.
4. **Coalescenza rAF** del ResizeObserver + trailing settle a ~460 ms che conferma il
   valore stabile.
5. **Il ping risponde SEMPRE** (`pushHeight({force:true})`): è la rete di recovery se
   un messaggio cade nella finestra di mute della cornice (senza il ping, l'isteresi
   bloccherebbe il reinvio e l'altezza resterebbe disallineata).

**Lato cornice — `cornice-dinamica/`**:

- lite / base64 / universale: **NESSUNA `transition: height`**, applicazione con
  **debounce 200 ms** + filtro ±2 px + clamp 100–15000 px (prima applicavano ogni
  messaggio subito, alimentando il tremolio).
- dedicata (v3 impermeabile): debounce + anti-loop già presenti, più **silenzio
  post-applicazione 300 ms** (ignora le rimisure ravvicinate salvo salti ≥ 30 px) e
  **ping ogni 3 s** come recovery.

### 3.4 Procedura diagnostica per un'IA (quando l'utente dice "trema")

1. Riprodurre in locale: `pnpm dev` → aprire `test-tremolio.html?mode=bad` →
   `window.__report()` dopo 30–60 s a pagina ferma. Se `messaggi_ricevuti` cresce o
   `ultimi_delta` non sono tutti 0 → il tremolio è riprodotto.
2. Se in `mode=bad` trema ma in `mode=v3` no → problema **lato cornice** (l'utente
   usa una cornice vecchia nel blog): ripubblicare l'embed aggiornato da
   `cornice-dinamica/`.
3. Se trema anche in `mode=v3` → problema **lato app**: verificare che `heightSync.ts`
   contenga le 5 contromisure (§3.3) e che `index.css` mantenga le regole
   `html.lf-embedded` (disattivazione `min-h-screen`/`min-h-dvh` in iframe).
4. Verificare i cambiamenti legittimi NON siano congelati: nella console del test,
   ingrandire il contenuto dell'iframe di 300 px
   (`document.getElementById('lfIframe').contentDocument.body.style.paddingBottom='300px'`)
   → l'altezza deve seguire in ~1 s. Poi rimettere a 0.
5. Dopo ogni fix: ripetere il test in ENTRAMBE le modalità, poi `pnpm check`,
   checkpoint e deploy (preview → conferma → produzione).

### 3.5 Portare l'anti-tremolio su altre app

Copiare **tutto** `client/src/lib/heightSync.ts` (incluse le costanti
`ISTERESI_PX`, `SILENZIO_MS`, `SALTO_LIBERO_PX`), chiamare `initHeightSync()` da
`main.tsx` **prima del render**, copiare le regole `html.lf-embedded` in `index.css`,
e nelle cornici NON usare MAI `transition: height` né applicare l'altezza senza
debounce. Il canale resta `labvisivo:height` / `labvisivo:ping` (condiviso).

---

## Regole non negoziabili di queste tre aree

1. **OCR**: PNG lossless, upscale a passi, asset Tesseract self-hosted, ricostruzione
   trinomia in `eqOcr.ts` — ogni modifica richiede prove su foto reali difficili.
   Nell'app ESPRESSIONI le prove si fanno col banco foto (`client/src/lib/bench/photoBench.test.ts`,
   `photoSweep.sh`, `GUIDA-IA.md` §20): scala delle cifre, `ocrReconcile.ts` e `printedBracket.ts`
   non si ritoccano senza un confronto prima/dopo (0 peggiorate).
2. **Mappa**: la paginazione è a misurazione DOM con margini 2,5 cm — i nuovi box
   entrano SOLO tramite `stepBox/solidBox` nel builder; le formule letterarie stanno
   SEMPRE sopra quelle numeriche/puntinate (passi 3-4-5, Parte A e Parte B).
3. **Tremolio**: MAI rimuovere ceil/isteresi/silenzio/rAF da `heightSync.ts`, MAI
   reintrodurre `transition: height` o l'applicazione immediata nelle cornici, MAI
   cambiare il canale `labvisivo:height`.
4. Dopo ogni modifica: `pnpm check`, test con `test-tremolio.html`, checkpoint, deploy
   preview e (solo dopo conferma esplicita dell'utente) produzione.

*Documento generato per il pacchetto esportabile — Settembre 2026.*

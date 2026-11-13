# WIDGET METACOGNITIVO PER IL CALCOLO DI ESPRESSIONI

**Versione pubblicata: deploy 8744 del 28/10/2026.**
Nome storico del progetto: Espressioni Letterali, Monomi e Polinomi.
Questo pacchetto contiene i sorgenti e gli asset della versione approvata,
con le guide aggiornate; non contiene chiavi, sessioni o risposte personali.

## Flusso attuale (prevale sulle note storiche)

1. Compilare Cognome, Nome, Classe e Data.
2. Trascrivere l'espressione a mano, con audio/tastiera oppure con foto.
   SCATTA/CARICA apre il clone PHOTO CROPPER 8731: PNG lossless, otto
   maniglie, rotazione e drag diretto senza icona, quattro pulsanti marroni.
3. Controllare/correggere i pezzi, quindi scegliere COSTRUISCI L'ESERCIZIO
   CON L'IA. Richiede una chiave Easy-Peasy configurata sul server.
4. Svolgere i box progressivi: ogni risultato lo inserisce lo studente;
   le frasi spiegano il metodo e non anticipano la soluzione.
5. Scaricare il PDF dello svolgimento effettivo, anche parziale.

Ricostruzione: **[REBUILD.md](REBUILD.md)**. Stato pubblicato e sicurezza:
**[VERSIONE-8744.md](VERSIONE-8744.md)**. La documentazione storica più sotto
non sostituisce questo flusso (non ripristinare limiti di pezzi o foto rimosse).

## Overflow pezzi e didascalia — pubblicata nel deploy 8744

Seconda pagina ad altezza contenuta e scrollbar laterale sottile come
Latino Facile: toolbar sempre disponibile, contenuto scorrevole senza
allungare la cornice, anche con molti pezzi e durante il ritaglio.
Dettagli e limiti: [SECONDA-PAGINA-SCROLL.md](SECONDA-PAGINA-SCROLL.md).
**Pubblicate e verificate (8744):** le espressioni lunghe scorrono DENTRO
i box dei pezzi senza uscire dai bordi (classe `piece-display`), anche nel
box «Espressione trascritta» e nel riquadro di conferma; didascalia solo
«SCRIVI QUI L'ESPRESSIONE» in grassetto nero. Restano validi header 8742,
scorrimento interno (820/720px), cropper e altre pagine. Questo ZIP 8744
sostituisce i pacchetti precedenti (8736, 8737, 8742).

## Origine dell'app e motore locale (note storiche)

App didattica interattiva che guida gli studenti passo-passo nella risoluzione delle
**espressioni** con parentesi, monomi e polinomi (es. `2x + 3y − (x − y)`), con input a
**scrittura a mano** (riconoscimento ONNX), monomi **colorati per gruppi simili**, box
**"RICOPIA SUL QUADERNO"**, **verifica per sostituzione** e **mappa concettuale PDF**
in stile "le regole per risolvere un'espressione".

L'app accetta sia **espressioni letterali** (monomi e polinomi, riduzione con somma dei
coefficienti dei monomi simili) sia **espressioni solo numeriche** (calcolo in ordine da
sinistra a destra, con linea dei numeri per i risultati negativi).

---

## Aggiornamento pubblicato — 28/10/2026 (deploy 8736)

La finestra foto è sostituita con il **clone fedele PHOTO CROPPER 8731**
fornito nell'allegato: titolo RITAGLIA LA FOTO, beige uniforme, quattro comandi
marroni in un unico riquadro, drag diretto senza icona centrale e otto
maniglie. Inclusi hook viewport/lock, CSS e guardia heightSync per il blog.
Questa modifica è **pubblicata in produzione nel deploy 8736**. Le istruzioni
storiche `modal={false}` qui sotto sono superate SOLO per CropDialog:
il contratto attuale è in [`SCROLLING-MOBILE.md`](SCROLLING-MOBILE.md)
e [`TRAPIANTO-FOTO.md`](TRAPIANTO-FOTO.md).
Esiti verificati e limiti delle prove:
[`COLLAUDO-PHOTO-CROP-8731.md`](COLLAUDO-PHOTO-CROP-8731.md).

## 🚀 Produzione

```
https://espressioni-monomi-polinomi.easy-peasy.site
```

**Cronologia, non stato corrente:** versione del **27/10/2026 (deploy 8622)**: **pillola blu della formula risolta** (angoli rettangolari `rounded-xl`), **freccia ← nel pannello calcolatrice**, **scrolling mobile del ritaglio foto** (pattern SCROLLING-MOBILE.md della gemella: `modal={false}`, foto `touch-pan-y`) (in ogni box numerato risolto correttamente, sotto la riga verde, una pillola bianca più chiara con L'INTERA espressione accorciata (la riga progressiva del PDF, con il risultato del box già sostituito) in blu `#2563EB`). Più: **CALCOLATRICE in ogni box** (accanto a «✎ digita il valore» c'è **🧮 CALCOLATRICE**, che apre la vera calcolatrice scientifica Desmos in italiano `https://www.desmos.com/scientific?lang=it` in una NUOVA SCHEDA via `window.open` dentro il gestore del clic — niente iframe: Desmos rifiuta l'incorporamento in ogni ambiente e l'evento `load` dell'iframe scatta comunque, GUIDA-IA §36; l'app mostra solo un PROMEMORIA chiuso con **✕ TORNA ALL'ESERCIZIO** o ESC e il link **RIAPRI LA CALCOLATRICE ↗**; l'app non naviga mai: canvas, disegni e passaggi restano esattamente dove lo studente li ha lasciati). Più: **radici accettate ovunque** (`3√15` a mano e da tastiera: moltiplicazione implicita coefficiente·radice in `latexToPlainMath`/`evaluateLatex`; box con radicale verificati come FORMA esatta, non per arrotondamento; hint dedicato «Scrivi il risultato esatto con la radice»), **pillola blu mai su risposta errata** (niente numero sbagliato mostrato, solo «RISULTATO SBAGLIATO. CALCOLA DI NUOVO»), **canvas anti-scarabocchi** (velo CARICAMENTO + RICONOSCI/✎ disattivati finché il canvas non ha misurato il contenitore, pagine 2 e 3), **«non dire mai la soluzione neanche per iscritto»**: nuovo sanitizer `client/src/lib/promptSicuri.ts` — le frasi dei box guidano il METODO e il sanitizer taglia la soluzione (cifre, parole, TeX, radicali detti, calcoli che danno la risposta; `mcm(…)` e dati visibili protetti), integrato in `riparaEsercizio` + regola 5 del prompt IA indurita; filosofia DSA documentata in **[`FILOSOFIA-DSA.md`](FILOSOFIA-DSA.md)**. Suite: **721 test**. Stato precedente **26/10/2026-bis (deploy 8611)**:

Stato del 26/10/2026 (deploy 8583) — versione precedente: app universale WIDGET METACOGNITIVO (flusso dati → trascrizione pezzi/mano/microfono/tastiera/FOTO → 🤖 COSTRUISCI L'ESERCIZIO CON L'IA → terza pagina con sessione personale `sid`), foto con ritaglio free-box + trascrizione IA vision MAI troncata (`max_tokens: 4000` + regola anti-troncamento), i 3 pulsanti TRASCRIZIONE/SCATTA/CARICA marroni identici (stessa ampiezza, centrati), **SCARICA PDF dallo svolgimento VERO** (dipendenze `[esercizio, testi, tuttiBox, valori]`, collaudato con espressione lunga: finale −1/2, zero tracce del default 71/27), guide `ADATTARE-EQUAZIONI.md` (repliche per sole equazioni 1°/2°/4°/superiore) + `TRAPIANTO-FOTO.md` (tool foto su altre app). Precedente **25/10/2026 (deploy 8551)**: **proprietà delle RADICI** (riscritture segnalate `root-prop`: condizione di realtà, radice↔potenza, MCD indice/esponente, prodotto/quoziente a stesso indice, porta dentro/fuori), **proprietà delle POTENZE con STESSA BASE** (`pow-prop`: quoziente → esponenti SOTTRATTI m−k, prodotto → sommati m+k, es. `(1/3)⁻⁴ : (1/3)⁻²` → «sottraggo gli esponenti (−4)−(−2)» → `(1/3)⁻²`, poi lo studente svolge solo le potenze semplici → 9 — filosofia DSA di segmento minimo; ⚠️ prima versione usava per errore la divisione m:k, corretta in giornata), **SCARICA PDF visibile solo a esercizio completato e corretto**, **RISULTATO FINALE in marrone** nell'ultimo passaggio (app + PDF). **CONTI SEMPRE CORRETTI (25/10)**: la frazione impilata scritta dall'utente dentro le parentesi NON genera più falsi conti («(1/3) =»); audit deterministico `auditConti`/`latexValue` su ogni catena (conti vuoti, risultati attesi, catena a valore costante); **verifica IA** dei passi visibili via `POST /api/ai/verify-steps` con «l'IA propone, il motore dispone» (`client/src/lib/aiVerify.ts`): correzione accettata solo se combacia col valore del motore, passo sbagliato mai mostrato, senza IA l'app resta invariata. Chiave IA `EASY_PEASY_API_KEY` nel `.env` (gitignored) cotta nel bundle server da `scripts/sync-env.mjs` — MAI nel bundle client. Suite: **706 test**.

Stato produzione precedente (24/10/2026, deploy 8508): auto-stop 20s che non perde il dettato, istruzioni tastiera a pulsante anche in editor ✎ e DIGITA IL VALORE, via limite 10 elementi, campo valore con sintassi tastiera, box 2 ridimensionabile, chiave IA nel bundle server. Verifica rapida: `curl -s https://espressioni-monomi-polinomi.easy-peasy.site | grep -o "index-[A-Za-z0-9_-]*\.js"` → `index-jgILIDLt.js`.

---

## 📚 Documentazione chiave (leggi prima di modificare)

### 🟢 Parti da qui

| Documento | A cosa serve |
|-----------|--------------|
| **[`AGENTS.md`](AGENTS.md)** | **Punto di partenza per agenti IA**: indice dei documenti e regole essenziali |
| **[`VERSIONE-8744.md`](VERSIONE-8744.md)** | Stato pubblicato corrente, hash JS/CSS, overflow e didascalia |
| **[`ISTRUZIONI-GITHUB.txt`](ISTRUZIONI-GITHUB.txt)** | Mappa rapida del pacchetto per GitHub/Render (umani e IA) |

### 🔁 Ricostruire l'app identica

| Documento | A cosa serve |
|-----------|--------------|
| **[`REBUILD.md`](REBUILD.md)** | **Ricostruire** l'app identica dal repository GitHub |
| **[`VERIFICA-PACCHETTO-8744.md`](VERIFICA-PACCHETTO-8744.md)** | Ricostruzione verificata dello ZIP corrente e confronto con la produzione |
| **[`GUIDA-IA.md`](GUIDA-IA.md)** | **Guida per l'IA** completa (architettura, file critici, regole d'oro) |
| **[`IMPLEMENTAZIONE-IA.md`](IMPLEMENTAZIONE-IA.md)** | 🧭 **Sezione IA dedicata**: foto/ritaglio/riconoscimento (OCR), mappe concettuali, debug «tremolio» |

### 🧬 Clonare e adattare (nuove app simili)

| Documento | A cosa serve |
|-----------|--------------|
| **[`ADATTARE.md`](ADATTARE.md)** | **Creare varianti**: testi, colori, passi, casi matematici |
| **[`ADATTARE-EQUAZIONI.md`](ADATTARE-EQUAZIONI.md)** | 🧮 **Replicare l'app per SOLE equazioni** (1°/2° grado, biquadratiche, grado superiore, disequazioni): prompt costruzione + verifica a soluzioni + passi per grado |
| **[`ESPORTA-PAGINE-1-2-EQUAZIONI.md`](ESPORTA-PAGINE-1-2-EQUAZIONI.md)** | 🧬 **Sezione IA dedicata all'ESPORTAZIONE**: come riusare la pagina 1 e la pagina 2 di questa app in una NUOVA app per equazioni e disequazioni |
| **[`TRAPIANTO-FOTO.md`](TRAPIANTO-FOTO.md)** | 📷 **Esportare il tool foto** (scatto/carica → ritaglio free-box → IA vision → soccorso OCR) su altre app simili |
| **[`FILOSOFIA-DSA.md`](FILOSOFIA-DSA.md)** | 💡 **La filosofia DSA dell'app, pronta da CLONARE** in nuove app simili (12 principi + checklist + prompt di clonazione) |

### ☁️ Pubblicare su Render + ♿ accessibilità

| Documento | A cosa serve |
|-----------|--------------|
| **[`RENDER.md`](RENDER.md)** | Trasferire l'app su **Render** via GitHub |
| **[`ACCESSIBILITA.md`](ACCESSIBILITA.md)** | ♿ **Sezione ACCESSIBILITÀ** — tutte le misure BES/DSA, portabili su altre app |

### 📷 Ritaglio foto e seconda pagina (dettagli tecnici)

| Documento | A cosa serve |
|-----------|--------------|
| **[`SECONDA-PAGINA-SCROLL.md`](SECONDA-PAGINA-SCROLL.md)** | Layout limitato, scrollbar stile Latino Facile, iframe e test |
| **[`COLLAUDO-PHOTO-CROP-8731.md`](COLLAUDO-PHOTO-CROP-8731.md)** | Risultati e limiti dei collaudi del nuovo ritaglio |
| **[`SCROLLING-MOBILE.md`](SCROLLING-MOBILE.md)** | Pattern storico di scrolling mobile (superato per CropDialog dal clone 8731) |

### 🗃️ Cronologia versioni (non stato corrente)

| Documento | A cosa serve |
|-----------|--------------|
| **[`VERSIONE-8742.md`](VERSIONE-8742.md)** | Cronologia: header rifinito (8742, INDIETRO marrone) |
| **[`VERSIONE-8737.md`](VERSIONE-8737.md)** | Cronologia: scorrimento interno della seconda pagina (8737) |
| **[`VERSIONE-8736.md`](VERSIONE-8736.md)** | Cronologia: rilascio del clone fedele del cropper 8731 |
| **[`VERIFICA-PACCHETTO-8742.md`](VERIFICA-PACCHETTO-8742.md)** | Cronologia: verifica del precedente ZIP 8742 |
| **[`VERIFICA-PACCHETTO-8737.md`](VERIFICA-PACCHETTO-8737.md)** | Cronologia: verifica del precedente ZIP 8737 |
| **[`VERIFICA-PACCHETTO-8736.md`](VERIFICA-PACCHETTO-8736.md)** | Cronologia: verifica del precedente ZIP 8736 |

> Nota: [`GUIDA-UNICA.html`](GUIDA-UNICA.html) è un file ereditato dall'app
> storica delle equazioni biquadratiche (guida stampabile): non fa parte del
> flusso corrente, è conservato per riferimento e non viene caricato dall'app.

---

## 📱 Come si usa

### Per lo studente

1. Apri l'app e compila la schermata iniziale con **Cognome, Nome, Data, Classe**
2. Clicca **ENTRA**
3. Nella **seconda pagina** scegli come inserire l'espressione:
   - **✍ MANO** — **SE VUOI, PUOI TRASCRIVERE L'ESPRESSIONE IN PIU' PEZZI**
     (24/10: NESSUN limite di elementi per pezzo — si può scrivere anche tutto
     in un pezzo solo). Premi **AGGIUNGI PEZZO**: il pezzo entra nell'elenco
     «Pezzi trascritti» (correggibile da tastiera con ✎, eliminabile con ✕).
   - **✎ Correzione da tastiera** (giro 26) — stesse regole dell'app audio:
     `:` divisione, `*` moltiplicazione (→ puntino ·), `3/4` frazione impilata
     (→ 3⁄4), `^2` potenza, `rad2`/`rad3`/`rad4` radici (√ ∛ ∜; anche `sqrt` e
     `radq`). La conversione avviene mentre si digita; le regole stanno dietro
     il pulsante **▸ ISTRUZIONI PER SCRIVERE DA TASTIERA** (24/10, anche nel
     campo ✎ e in DIGITA IL VALORE — non più la riga fissa «TASTIERA: …»).
   - **🎤 Microfono** (24/10): premi, detta, premi di nuovo OPPURE aspetta i
     **20 secondi** — allo scadere la trascrizione parte **da sola** e il dettato
     si accoda ai box (non si perde più senza secondo tocco). Più audios di
     seguito → un'unica espressione.
   - **DIGITA IL VALORE** (24/10, finestra dei risultati): accetta la stessa
     sintassi da tastiera (`6:3`→2, `3*4`→12, `2^3`→8, `rad29`→3) con pulsante
     istruzioni; placeholder «Esempio: 8/3» (via «es. 8/8 o \\frac{8}{8}»).
   - Nel pannello di trascrizione (giro 28) la barra `/` è SEMPRE frazione
     impilata (anche le fratte tipo `(x+1)/(2x-3)`, perché la divisione si scrive
     con i due punti) e i due punti scritti si mostrano come `÷` (nel box reso
     come \div), come nell'app audio originaria; al pezzo si salva comunque `:`.
   - **Niente risultati pre-scritti** (giri 29-30, filosofia scaffolding): i
     passi mostrano le operazioni DA SVOLGERE (es. `5x·1`), mai il risultato —
     lo studente lo scrive a mano sul quaderno, lo digita nel campo con le
     regole tastiera (convalida `parsePolyLoose`+`polyEquals`) o lo inserisce
     negli input interattivi; il seguito si rivela solo dopo il ✓.
   - **Font ≥ 14pt** (giro 30): tutte le scritte della pagina esercizi ≥ 14pt
     (scala dell'app audio originaria); la prima pagina resta invariata
     (`.expr-exercise-page` in index.css).
   - **🎤⌨ TRASCRIZIONE AUDIO E CON TASTIERA** (giro 27, adattato da
     AUDIO-MATEMATICI) — pulsante sotto la finestra di scrittura a mano che apre
     i box dell'app audio: microfono (20 s, auto-stop), «1 · Trascrizione
     letteraria» correggibile con RIANALIZZA CON IA, «2 · Trascrizione
     matematica» con frazioni impilate e campo da tastiera; **✓ AGGIUNGI COME
     PEZZO** trasforma la trascrizione in un pezzo. Più audios di seguito si
     riuniscono in un'unica espressione. Serve il permesso del microfono (nella
     cornice del blog l'iframe ha `allow="microphone"`). Funziona solo in
     produzione: in locale con `pnpm dev` le rotte `/api/*` non esistono.
   - Dal **giro 24** niente più **FOTO né CARICA** (rimosse su richiesta dell'utente,
     come la TASTIERA al giro 22): la trascrizione avviene **A MANO** (modello ONNX
     + soccorso IA vision sui tratti) **oppure Dettando** con DICTA.
4. ⚠️ **L'app non calcola MAI da sola.** In basso compare sempre l'espressione
   trascritta nel riquadro «CONTROLLA PRIMA DI CONFERMARE» (con frazioni impilate): la
   controlli, la correggi se serve con ✎ e il calcolo parte solo premendo il pulsante
   giallo **✓ CONFERMA E CALCOLA**.
5. L'app mostra i **5 box guidati** (flusso STANDARD):
   1. **Espressione inserita** (con il promemoria «prima le parentesi, poi da sinistra a destra»)
   2. **Risolvo le parentesi tonde** (ogni operazione svolta dallo studente, una alla volta)
   3. **Riscrivo senza parentesi** — monomi **colorati** per gruppo simile
   4. **Raggruppo i monomi simili** (letterale: somma dei coefficienti da inserire a mano) /
      **Calcolo in ordine da sinistra a destra** (numerico: catena interattiva di operazioni)
   5. **Risultato** — polinomio ridotto / numero finale (frazione impilata se non intero:
      MAI decimali con la virgola)

   ⚠️ **Caso «operazione già finita»** (espressione numerica che dopo il punto 2 è già un
   numero solo, es. `9 : 5` o `1 : (3 : 4)`): dopo il box 2 compare SOLO il box
   **«3. Inserisco il risultato finale:»** (riquadro con l'operazione da svolgere + input a
   mano), NIENTE «Riscrivo senza parentesi», niente box 4 né 5.

   📌 **Regole di resa delle divisioni**: restano sempre con i due punti ` : ` durante lo
   svolgimento (mai frazioni ridotte tipo `1 : 6` nel RICOPIA); la doppia scrittura
   TUTTI i risultati non interi (intermedi, RICOPIA, finale) sono frazioni impilate:
   MAI decimali con la virgola (richiesta 27/9).
   Nessun promemoria della regola dei segni.
6. Per i gruppi di monomi simili, inserisci la somma dei coefficienti a mano (o scritta a
   mano): l'app dà feedback **CORRETTO/SBAGLIATO** con il box «RICOPIA SUL QUADERNO»
7. Scarica il **quaderno PDF** di tutti i passaggi oppure la **🗺️ MAPPA CONCETTUALE (PDF)**
   — Parte A svolta sulla tua espressione + Parte B da completare

### Per il docente

- L'app è **autoguidata**: lo studente segue i passi da solo
- Il PDF scaricabile contiene **Cognome, Nome, Classe e Data** in testa — perfetto per la valutazione
- Nessun account, nessuna configurazione: l'app è pronta all'uso

---

## 🖼️ Embed nel blog (Blogger / qualsiasi sito)

> ⭐ **Consigliata — cornice dinamica dedicata**: copia l'intero contenuto del file
> [`cornice-dinamica/embed-espressioni-dedicata.html`](cornice-dinamica/embed-espressioni-dedicata.html)
> nella vista HTML del post. Include pulsanti **Schermo intero** e **Ricarica**, spinner
> di caricamento, stato online/errore con **Riprova** e altezza automatica. Per un'altra
> app usa [`cornice-dinamica/embed-universale.html`](cornice-dinamica/embed-universale.html)
> (cambia `APP_URL` o passa `?app=URL`). Dettagli: [`cornice-dinamica/README.md`](cornice-dinamica/README.md).

**L'iframe si auto-ridimensiona** grazie ai messaggi `postMessage` (`labvisivo:height` + `ping`)
integrati nell'app.

---

## 🔀 Varianti

L'app può essere variata cambiando **solo contenuti e testi** (mai l'architettura): vedi
**[`ADATTARE.md`](ADATTARE.md)**. La logica matematica vive tutta in
`client/src/lib/espressioni.ts` (motore + test) e `client/src/lib/mappaPdf.ts` (mappa PDF);
la pagina studente è `client/src/pages/EspressioniExercises.tsx`.

- **Nuova app per SOLE equazioni** (1°/2° grado, biquadratiche, grado superiore,
  disequazioni) riusando questa architettura → **[`ADATTARE-EQUAZIONI.md`](ADATTARE-EQUAZIONI.md)**.
- **Esportare il tool foto+ritaglio+IA** su altre app simili → **[`TRAPIANTO-FOTO.md`](TRAPIANTO-FOTO.md)**.

---

## ☁️ Trasferire su Render (via GitHub)

Il pacchetto include già tutto il necessario: `render.yaml` (Blueprint), la CI di GitHub
(`.github/workflows/ci.yml`) e la guida **[`RENDER.md`](RENDER.md)**.

In sintesi: carica la cartella su un repository GitHub → su [render.com](https://render.com)
→ **New → Blueprint** → collega il repo → Render crea il Web Service automaticamente.

---

## ♿ Accessibilità (BES/DSA)

L'app include misure di inclusione per studenti con **BES/DSA** e **ipovisione**:
**font OpenDyslexic**, barra di accessibilità (dimensione testo, interlinea, righello,
modalità alto contrasto), **lettura ad alta voce** in italiano, focus visibile, ARIA,
`prefers-reduced-motion`, PDF e mappa concettuale in OpenDyslexic.

Tutte le misure sono documentate e **portabili** su altre app nella
**[`ACCESSIBILITA.md`](ACCESSIBILITA.md)** (sezione ACCESSIBILITÀ).

---

## 🏗️ Tecnologie

| Tecnologia | Uso |
|-----------|-----|
| React 19 + TypeScript | Frontend |
| Vite 7 | Build tool |
| TailwindCSS 4 | Styling |
| Wouter | Routing lato client (hash) |
| KaTeX | Rendering formule matematiche |
| ONNX Runtime Web + Ink-ON | Riconoscimento scrittura a mano |
| jsPDF | Quaderno PDF e mappa concettuale |
| Express | Server di produzione (serving statico + COOP/COEP + CORS) |

---

## 🗂️ Struttura del progetto

```
├── client/                     # Frontend React + Vite + Tailwind
│   ├── index.html
│   ├── public/
│   │   ├── models/comer/       # Modelli ONNX (riconoscimento scrittura)
│   │   ├── fonts/              # Font OpenDyslexic
│   │   └── quaderno-matematica-facile-v4.pdf   # Quaderno scolastico scaricabile
│   └── src/
│       ├── pages/
│       │   ├── WelcomePage.tsx           # Home (dati studente)
│       │   └── EspressioniExercises.tsx  # App principale (5 box guidati + caso diretto)
│       ├── lib/
│       │   ├── espressioni.ts            # MOTORE: parser, passi, riduzione, verifica + test
│       │   ├── espressioni.test.ts       # test del motore (36)
│       │   ├── supScript.ts             # esponenti in apice (scrittura a mano)
│       │   ├── supScript.test.ts        # test geometria apici + splice (8)
│       │   ├── inkSigns.ts              # segni a mano √ 8 = − e FRAZIONE IMPILATA (estrazione geometrica)
│       │   ├── inkSigns.test.ts         # test segni + frazione impilata estratta
│       │   ├── exprOcr.ts               # normalizzazione OCR con recupero esponenti
│       │   ├── exprOcr.test.ts          # test OCR esponenti (8)
│       │   ├── recognizePipeline.ts     # pipeline a mano PURA (recognizeInk) — stesso codice in browser e in Node
│       │   ├── recognizePiece.ts        # finalizePiece / recognizePieceWith (un pezzo ≤ 5 elementi)
│       │   ├── pieceCount.ts            # countElements / MAX_PEZZO = 5 (le graffe { } NON contano) (+ test)
│       │   ├── strokeRecorder.ts        # registratore del tratto in corso del canvas (irrobustimento) (+ test)
│       │   ├── squareBrackets.ts        # parentesi ( ) [ ] { } dai tratti; promotePairs + promoteRoundOpeners
│       │   ├── bracketProfile.ts        # profilo geometrico di una parentesi (classifyProfile: tonda/quadra/graffa)
│       │   ├── composeLatex.ts          # LaTeX per atomi e x assoluta (segni, parentesi, esponenti) (+ test)
│       │   ├── gapClose.ts              # vuoti lasciati dagli elementi tolti, chiusi per il modello (+ test)
│       │   ├── glyphScale.ts            # foto: scala dall'altezza delle cifre (60 px)
│       │   ├── ocrReconcile.ts          # foto: riconcilia i simboli di Tesseract coi glifi reali (+ test)
│       │   ├── printedBracket.ts        # foto: tipo di parentesi stampata dai pixel (+ test)
│       │   ├── bench/                   # BANCO DI PROVA (modello reale / Tesseract reale in Node): non è parte dell'app
│       │   ├── mappaPdf.ts               # Mappa concettuale PDF (Parte A + Parte B)
│       │   ├── ocr.ts                    # OCR da foto (Tesseract + riconciliazione)
│       │   └── pdf.ts                    # Quaderno PDF dei passaggi
│       ├── components/
│       │   ├── MathDrawCanvas.tsx        # Canvas disegno
│       │   ├── NumberInputCanvas.tsx     # Canvas input valori
│       │   ├── FractionDisplay.tsx       # Badge frazioni
│       │   ├── AccessibilityToolbar.tsx  # Barra accessibilità
│       │   └── ui/                       # Componenti shadcn/ui
│       ├── contexts/AccessibilityContext.tsx
│       ├── hooks/
│       │   ├── useMathRecognition.ts     # Riconoscimento ONNX
│       │   └── useReadAloud.ts           # Lettura ad alta voce (TTS)
│       ├── App.tsx
│       ├── main.tsx
│       └── index.css                     # Stili globali + tema + accessibilità
├── server/index.ts             # Server Express (serving statico)
├── shared/const.ts             # Costanti condivise
├── cornice-dinamica/           # Cornice dinamica embed (dedicata, lite, universale, autosufficiente)
├── AGENTS.md                   # Punto di partenza per agenti IA
├── REBUILD.md                  # Ricostruire l'app identica
├── ADATTARE.md                 # Creare varianti
├── GUIDA-IA.md                 # Guida per l'IA
├── RENDER.md                   # Guida deploy Render
├── ACCESSIBILITA.md            # Sezione ACCESSIBILITÀ
├── FILOSOFIA-DSA.md            # Filosofia DSA clonabile (12 principi + checklist)
├── render.yaml                 # Blueprint Render
├── package.json                # Dipendenze e script
└── vite.config.ts              # Configurazione Vite
```

---

## 📦 Sviluppo locale

```bash
pnpm install     # dipendenze
pnpm dev         # dev server (solo frontend: le rotte /api/* non esistono qui)
pnpm check       # type-check TypeScript (genera anche shared/env.generated.ts)
(cd client && pnpm exec vitest run)   # test: 738 superati, 28 saltati (NON esiste uno script `pnpm test`)
pnpm build       # build di produzione (client + server)
pnpm start       # server di produzione (unico modo per provare le /api/*)
```

---

## 🧪 Banco di prova del riconoscimento (facoltativo, solo sviluppo)

Il riconoscimento della scrittura a mano e delle foto si MISURA con un banco che usa il modello
reale (mano) e Tesseract reale (foto) in Node: catalogo di 684 letture (parentesi consecutive,
parentesi + numeri vicini, potenze…) e foto stampate sintetiche/reali. Risultati attuali: **mano 88%**
(dal 27%), **foto 89%** sulle righe sintetiche e **92%** sulle varianti reali; le tre righe della foto
degli esercizi sono lette esatte. Non fa parte della build e non gira in `(cd client && pnpm exec vitest run)` (i test del banco
sono «skipped» senza la loro variabile d'ambiente). Serve `npm i --no-save @napi-rs/canvas`.
Istruzioni, comandi e regole: **`GUIDA-IA.md` §20**.

---

## 📄 Licenza

MIT — libero di usare, modificare e condividere.

---

*App creata con ❤️ da MARKY su Easy-Peasy.AI · Settembre 2026*

## 🤖 Trascrizione con l'IA (giro 20, aggiornato al giro 24)

La **scrittura a mano** (quando il modello locale ONNX non legge nulla) viene trascritta
con l'**IA vision di Easy-Peasy AI** (modello `gemini-3-flash`, via
`POST /api/ai/transcribe` del server): i tratti del pezzo vengono disegnati su un'immagine
(`strokesToDataUrl`) e l'IA li trascrive. Dal **giro 25** anche il **DETTATO VOCALE** passa
dall'IA (via `POST /api/ai/audio`, `server/audio.ts`, adattato da AUDIO-MATEMATICI):
l'audio WAV 16 kHz viene trascritto in italiano e convertito in notazione dell'app
(frazioni impilate `a⁄b`, `:` divisione, `·` moltiplicazione) — **mai calcolare** — e
diventa un pezzo. L'IA **trascrive soltanto**: non risolve, non calcola, non
semplifica — il pezzo va controllato nel riquadro «CONTROLLA PRIMA DI CONFERMARE» (e
corretto con ✎ se serve) prima di ✓ CONFERMA E CALCOLA.

- Nei deploy su Easy-Peasy la chiave `EASY_PEASY_API_KEY` è iniettata automaticamente.
- Per locale / GitHub / Render: aggiungerla al `.env` (vedi `.env.example`).
- Senza chiave l'app continua a funzionare: foto e mano ripiegano sul riconoscimento
  locale (Tesseract / ONNX). La route IA esiste solo nel build di produzione
  (`pnpm build && pnpm start`): in `pnpm dev` si ripiega sempre sul locale.

## ➗ Espressioni fratte e radici n-esime (giro 21)

- **Fratte** (incognita al denominatore, es. `2 + 1:(x−2)`): percorso dedicato con
  **campo di esistenza guidato** — per ogni denominatore lo studente risolve
  «denominatore = 0» (input con feedback), poi vede lo svolgimento razionale
  passo per passo e il risultato come frazione impilata. Semplificazioni scolastiche
  automatiche (fattori comuni, Euclide polinomiale); il campo di esistenza resta
  SEMPRE quello dei denominatori originali.
- **Radici**: √ (già presente), ∛ (cubiche), ∜ (quarte) e `8^(1/3)` — solo esatte
  (potenze perfette), con passi interattivi come le altre operazioni.
- Tastiera (solo nella correzione ✎ dei pezzi): scrivi `:` per la divisione,
  `∛`/`∜` o `^(1/3)` per le radici.
- Il quaderno PDF per le fratte arriva in un prossimo giro.

## 🟰 Equazioni con riconoscimento automatico (giro 33)

- L'app si chiama **WIDGET METACOGNITIVO PER IL CALCOLO DI ESPRESSIONI ED EQUAZIONI**.
- Se il testo confermato contiene «=» con due membri (scritto a mano, tastiera o
  dettato con «uguale»), si apre il percorso EQUAZIONI: forma canonica (tutto a
  sinistra), classificazione (1°/2°/biquadratica/sesta/Ruffini-cubica/raccoglimento;
  rifiuto onesto se non trattabile), passi con input dello studente e soluzioni
  esatte (frazioni impilate, radicali semplificati, mai decimali).
- Lo studente può rispondere in forma **letterale o numerica**: `3/2`, `√2`,
  `(5+√1)/2` valgono quanto i decimali (placeholder «numero o frazione/radice»).

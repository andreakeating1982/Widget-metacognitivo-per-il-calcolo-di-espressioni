# ♿ ACCESSIBILITÀ — Widget Metacognitivo per il Calcolo di Espressioni

Stato corrente: produzione 9213 (ASCOLTO legge formule, decimali, periodici,
pulsanti e campi visibili, mai le risposte nascoste; condizioni aggiuntive
per il ramo senza moduli, separate dalle C.E.; gli altri casi non sono svolti). Le C.E. sono
calcolate per le forme supportate; numeri di pagina nel PDF solo se multipagina. Il pulsante **ISTRUZIONI PER SCRIVERE DA
TASTIERA** scarica direttamente la guida PDF; la trascrizione da foto è
modificabile prima della conferma. MOSTRA SOLUZIONE è una scelta reversibile
per il box corrente: `NumberInputCanvas.tsx` usa `aria-expanded`, `aria-controls`
e una regione con nome; la formula è su una riga e può scorrere. La verifica
specifica su screen reader reali resta da eseguire.
Terza pagina, feedback e PDF corrente in
`client/src/pages/EsercizioFrazioni.tsx`; i riferimenti al PDF di
EspressioniExercises/mappaPdf descrivono anche il percorso storico locale.
Le formule lunghe della terza pagina scorrono nel proprio box, anche con
font ingrandito e tastiera; vedere `tests/FRATTE-FOTO.md`.
Non è una certificazione WCAG o PDF/UA: verificare le misure nella variante.
Lo scanner ha rilevato in prima pagina contrasto insufficiente sul pulsante
ENTRA, assenza di h1 e dimensioni di alcuni pulsanti: sono problemi già
presenti nella 9033 e non modificati in questo rilascio.

> ⚠️ **SEZIONE ACCESSIBILITÀ** — Questa è la sezione che riassume **TUTTE** le misure di
> accessibilità/inclusione dell'app. Ogni misura è **portabile su altre app simili**:
> nella tabella è indicato il file da copiare. Il riepilogo operativo "come portarle su
> un'altra app" è in fondo a questa pagina e in `GUIDA-IA.md` (sezione 9).

> Misure di accessibilità/inclusione dell'app **ESPRESSIONI LETTERALI, MONOMI E POLINOMI**,
> portate dall'app di riferimento **LATINO FACILE**
> (https://github.com/andreakeating1982/LATINO-FACILE).
> Pensate per studenti con **BES**, **DSA (dislessia, disortografia)** e **ipovisione**.

**Principio guida**: *ogni comando raggiungibile da tastiera; preferenze persistenti;
testo grande e ad alta leggibilità; contrasto regolabile; rispetto di `prefers-reduced-motion`.*

---

## Panoramica delle misure

| # | Misura | Dove vive nel codice |
|---|--------|----------------------|
| 1 | **Font OpenDyslexic** (auto-ospitato) su tutta l'app | `client/public/fonts/` + `@font-face` in `client/src/index.css` |
| 2 | **Barra di accessibilità** (Font, Interlinea, Righello, Modalità, Ascolto) | `client/src/components/AccessibilityToolbar.tsx` |
| 3 | **Dimensione testo regolabile** 80%–160% | `client/src/contexts/AccessibilityContext.tsx` → `--lf-scale` |
| 4 | **Interlinea regolabile** 1.65 / 1.9 / 2.2 / 2.6 | `AccessibilityContext.tsx` → `--lf-lh` |
| 5 | **Righello di lettura** (banda che segue il mouse) | `index.css` (`.lf-ruler-band`) + context |
| 6 | **Modalità ad alto contrasto** | `index.css` (`html.lf-hc`) |
| 7 | **Focus visibile** (tastiera / ipovedenti) | `index.css` (`:focus-visible`) |
| 8 | **`prefers-reduced-motion`** rispettato | `index.css` (`@media (prefers-reduced-motion)`) |
| 9 | **Testo base 18 px + selezione ad alto contrasto** | `index.css` (`body`, `::selection`) |
| 10 | **ARIA e accessibilità da tastiera** | `AccessibilityToolbar.tsx`, `WelcomePage.tsx` |
| 11 | **PDF esportato in OpenDyslexic** | `client/src/pages/EsercizioFrazioni.tsx` (flusso corrente); `EspressioniExercises.tsx` (storico locale) |
| 12 | **Preferenze persistenti** (`localStorage`) | `AccessibilityContext.tsx` (chiave `wms_access`) |
| 13 | **CORS sui font** (per embed Blogger cross-origin) | `server/index.ts` (`app.use("/fonts", ...)`) |
| 14 | **Lettura ad alta voce** (text-to-speech in italiano) | `client/src/hooks/useReadAloud.ts` + pulsante "Ascolto" nella barra |
| 15 | **Regioni scroll nominate e focusabili, pagine2/3** | `App.tsx`, `EspressioniExercises.tsx`, `EsercizioFrazioni.tsx`, `index.css` |
| 16 | **Pulsanti del ritaglio adattivi al testo ingrandito** | `client/src/photo-crop.css`, `tests/crop-controls.e2e.mjs` |
| 17 | **Cornice: focus, icone complete e area tattile estesa** | `cornice-dinamica/embed-espressioni-dedicata.html`, `tests/frame-controls.e2e.mjs` |
| 18 | **Feedback finale: titolo focalizzato, stelle descritte, conteggio annunciato e pulsanti raggiungibili** | `client/src/pages/EsercizioFrazioni.tsx`, `tests/feedback-prodotti.e2e.mjs` |
| 19 | **Soluzione facoltativa, richiudibile, testo su una riga e scorribile** | `NumberInputCanvas.tsx`, `soluzioneCalcolatrice.ts`, `tests/mostra-soluzione.e2e.mjs` |
| 20 | **Condizioni aggiuntive leggibili e separate dalle C.E.**, ripetute nel PDF | `EsercizioFrazioni.tsx`, `ramoCondizionato.ts`, `moduliSottintesi.ts` |

---

## Dettaglio

### Font OpenDyslexic
- Quattro `@font-face` (Regular 400, Bold 700, Italic 400, Bold Italic 700) con
  `font-display: swap` in `client/src/index.css`.
- File auto-ospitati in `client/public/fonts/` (TTF, OTF, WOFF2). Nessun CDN esterno.
- Applicato a `html, body, #root` e alle classi `.font-sans/.font-serif/.font-mono`
  (con fallback `'Cambria Math', Cambria, serif`).
- **La notazione matematica (KaTeX) conserva il proprio font** (KaTeX_Main ecc.), non
  sovrascritto: le formule restano perfettamente allineate.

### Barra di accessibilità
Barra fissa in alto, visibile su **tutte** le pagine (`App.tsx`), con:
- **Font** (`A−` / `A+`): scala 80%–160%, passo 10%, percentuale annunciata con `aria-live`.
- **Interlinea**: cicla 1.65 → 1.9 → 2.2 → 2.6.
- **Righello**: banda gialla di lettura che segue il mouse (`pointer-events: none`).
- **Modalità**: alterna Normale ↔ Alto contrasto.
- **Ascolto**: pulsante **Leggi** / **Stop** che legge ad alta voce il contenuto della
  pagina in italiano (Web Speech API `speechSynthesis`, voce italiana).

Usa una palette calda fissa (barra bianco caldo `#fdfbf8`, capsule crema `#f5f0e6`
senza bordo, testo `#2e2118`, bordo `#dedbd6`, anello focus `#b71c1c`), identica alla
barra dell'app di riferimento (stile Cornice Universale): l'aspetto resta coerente anche
dentro la cornice dinamica del blog.

### Dimensione testo e interlinea
Il provider imposta su `<html>`: `font-size: 16px × scala` (scala le unità `rem`) e le
variabili `--lf-scale` / `--lf-lh`. Il `body` usa `font-size: calc(18px * var(--lf-scale))`
e `line-height: var(--lf-lh)`. Tutto scala in modo proporzionale.

### Alto contrasto
`html.lf-hc` applica `filter: contrast(1.3) saturate(1.15)` e sfondo bianco
(+ override dello sfondo `.paper-grain`).

### Lettura ad alta voce (text-to-speech)
Il pulsante **Ascolto → Leggi** nella barra legge ad alta voce **tutta la pagina** in
italiano (Web Speech API `speechSynthesis`, `lang="it-IT"`, migliore voce italiana
disponibile). **Stop** interrompe la lettura.

Caratteristiche della lettura **in anteprima** (`useReadAloud.ts`):
- legge testo, pulsanti e collegamenti visibili, comprese le etichette della barra;
  distingue i pulsanti non disponibili e non aziona alcun comando;
- converte le formule KaTeX e la notazione digitata in italiano parlato: frazioni,
  parentesi, potenze, radici e loro indici, decimali con virgola e periodici espliciti;
- annuncia le etichette e i valori dei campi (incluse le date); i campi nascosti,
  password e file non sono letti;
- esclude contenuti nascosti e risposte non ancora mostrate. La soluzione del solo
  box è letta soltanto se lo studente ha aperto «MOSTRA SOLUZIONE»;
- divide le letture lunghe in segmenti e li invia in sequenza. «Stop» interrompe
  anche durante la preparazione. Canvas, script, icone decorative e testo `sr-only`
  non sono inclusi nella lettura vocale; gli screen reader mantengono il loro accesso.

Il collaudo automatizzato intercetta le frasi inviate alla Web Speech API, con
sessioni simulate e senza dati reali. Non certifica le voci, la pronuncia del
motore del dispositivo né l'uso di screen reader o telefoni fisici: la voce
italiana e l'audio dipendono dal browser e dal dispositivo. La barra è interna
all'app; non legge il testo esterno del post Blogger.

### Focus e riduzione movimento
- `:focus-visible { outline: 3px solid var(--ring); outline-offset: 2px }` — anello
  visibile solo alla navigazione da tastiera.
- `::selection { background: var(--primary); color: var(--primary-foreground) }`.
- `@media (prefers-reduced-motion: reduce)` azzera animazioni e transizioni.

### ARIA e struttura
- Le pagine usano il landmark `<main>` (WelcomePage e EspressioniExercises) per la
  navigazione con screen reader e come sorgente per la lettura ad alta voce.
- `html { scroll-behavior: smooth }` per uno scorrimento morbido.
- Barra: `role="toolbar"` con `aria-label`; ogni modulo è un `role="group"` con il
  proprio `aria-label`; `aria-pressed` sui toggle; `aria-live` sulla percentuale;
  icone decorative con `aria-hidden="true"`; descrizione introduttiva `sr-only` e
  live region `role="status"` che annunciano all'avvio la disponibilità della barra
  e del pulsante Ascolto (fruibile da screen reader come NVDA/JAWS/VoiceOver/TalkBack).
- Campi di ingresso `Cognome` / `Nome` / `Data` / `Classe`: `aria-label` (`WelcomePage.tsx`).
- Il canvas di scrittura a mano è affiancato dal pulsante **✎ digita l'espressione**
  (input da tastiera), alternativa per chi non può usare il tratto.

### Feedback finale accessibile

Dopo «CONTINUA» il focus passa al titolo «HAI TERMINATO!» e la regione torna
all'inizio. Il titolo non ha cornice visibile, come richiesto; i pulsanti
mantengono l'indicatore di focus da tastiera. Le cinque stelle sono descritte
con `aria-label` (numero di stelle su cinque), mentre il conteggio è in una
regione `aria-live`. «RIVEDI I PASSAGGI» mantiene il lavoro in memoria; il
PDF è disponibile soltanto nel feedback, dopo il completamento. Verificare
con `tests/FEEDBACK-PRODOTTI.md`, tastiera, scroll, font160% e screen reader
reale prima di dichiarare la piena accessibilità di una variante.

### Calcolatrice accessibile in ogni box

Accanto a «✎ digita il valore» c'è **🧮 CALCOLATRICE** (`NumberInputCanvas.tsx` → `CalculatorPanel.tsx`): apre la calcolatrice scientifica Desmos in italiano in una nuova scheda e mostra un promemoria con **✕ TORNA ALL'ESERCIZIO** (o tasto **ESC**). Per lo studente DSA il vantaggio è il **ritorno senza perdite**: l'app non naviga mai, quindi il box, il disegno a mano e i passaggi restano identici. Accessibilità: `role=dialog` + `aria-modal`, `aria-label` sul pulsante di chiusura, chiusura da tastiera (ESC). Dettagli tecnici in GUIDA-IA §35–36.

### Pillola blu della formula risolta

Quando un box numerato è risolto correttamente, sotto la riga verde della risoluzione compare una **pillola bianca più chiara del box** con **l'intera espressione accorciata** (la riga progressiva del PDF, con il risultato del box già sostituito) scritta in **blu** (`#2563EB`), così ciò che ha appena fatto resta ben visibile e associato al suo risultato. Contrasto blu/bianco adeguato (AA), KaTeX con frazioni impilate.

### PDF
Il PDF del quaderno (`handleScaricaPdf`) usa **OpenDyslexic** (con `<base>` e
`@font-face` inline nel documento di stampa), mantenendo il fallback Cambria Math per
le formule KaTeX. Nell'intestazione i dati si affiancano quando possibile e
vanno a capo senza tagli se sono lunghi; subito sotto compare lo stesso
conteggio delle risposte giuste al primo colpo mostrato nel feedback. La
verifica della stampa è descritta in `tests/FEEDBACK-PRODOTTI.md`.

### Persistenza
Le impostazioni sono salvate in `localStorage` (chiave `wms_access`) e ricaricate
all'avvio, su tutte le pagine.

### Come portare queste misure su un'altra app

1. Copiare la cartella `client/public/fonts/` (font OpenDyslexic).
2. Copiare in `index.css`: i 4 `@font-face`, le variabili `--lf-scale` / `--lf-lh`, le
   classi `.lf-ruler-band` e `html.lf-hc`, `:focus-visible`, `::selection` e
   `@media (prefers-reduced-motion: reduce)`.
3. Copiare `AccessibilityContext.tsx` + `AccessibilityToolbar.tsx` e montarli in `App.tsx`
   dentro un `<AccessibilityProvider>`, **prima** del router.
4. Copiare `useReadAloud.ts` per la lettura ad alta voce (voce italiana, converte formule
   ed esponenti in linguaggio naturale).
5. Aggiungere `aria-label` ai campi di input e `role="toolbar"` / `aria-live` alla barra.
6. Nel PDF: usare OpenDyslexic con `@font-face` inline nel documento di stampa.

---

## Verifica rapida

- [ ] Il font OpenDyslexic si carica (DevTools → Network → `/fonts/OpenDyslexic-Regular.ttf` → 200).
- [ ] `Tab` sposta il focus con anello visibile; la barra si annuncia come "toolbar".
- [ ] `A−`/`A+` scala il testo (80%–160%) e la percentuale si aggiorna.
- [ ] Interlinea cicla 1,6 → 1,9 → 2,2 → 2,6.
- [ ] Righello ON/OFF mostra/nasconde la banda gialla senza bloccare i clic.
- [ ] Modalità Contrasto schiarisce lo sfondo e aumenta il contrasto.
- [ ] Le preferenze restano dopo il riavvio del browser (`localStorage` → `wms_access`).
- [ ] Nel feedback stelle e conteggio hanno descrizioni leggibili; i comandi
      CONTINUA, SCARICA PDF e RIVEDI I PASSAGGI sono raggiungibili da tastiera.
- [ ] Il PDF usa OpenDyslexic.
- [ ] Il pulsante "Ascolto → Leggi" avvia la lettura ad alta voce in italiano; "Stop" la ferma.

---

## Riferimenti

- **OpenDyslexic** — font libero (licenza OFL) per la dislessia.
- **WCAG 2.1/2.2** (W3C): contrasto (1.4.3), ridimensionamento testo (1.4.4), focus
  visibile (2.4.7), tastiera (2.1), `prefers-reduced-motion` (2.3.3).
- **L. 170/2010 e Linee Guida MIUR (DSA)** — contesto normativo della didattica inclusiva.

## Pagine2/3: regioni a scorrimento interno (produzione8756)

`/espressione` ha altezza640px; `/esercizio` segue il contenuto fino a640px.
Fuori iframe il viewport visibile può ridurre ulteriormente il contenitore.
La barra accessibilità resta fuori dallo scroll e la prima pagina non ha
questo limite. Le regioni `expr-input-page` e `expr-exercise-scroll` hanno
`role="region"`, nome descrittivo, `tabIndex=0` e focus visibile: scorrono
da tastiera e touch senza ridurre caratteri o rimuovere i passaggi lunghi.
Alto contrasto: scrollbar scura. In pagina3 flex-basis:auto preserva
l'altezza naturale; il nome storico `expr-exercise-page` non va riutilizzato
perché attiverebbe regole di font estranee al flusso corrente.
Durante il ritaglio la pagina2 si congela e recupera la posizione alla
chiusura. Un solo heightSync, limiti iframe indipendenti da innerHeight;
in stampa i limiti si rimuovono per non tagliare il documento.

Riuso via GitHub: copiare insieme wrapper App, regioni nominate, CSS e
viewport effect, non soltanto un `overflow:auto`. Verificare testo160%,
contrasto, Tab/Ctrl+End, toolbar ferma, tastiera mobile e iframe senza loop.
Specifica/test: `SECONDA-PAGINA-SCROLL.md`, `docs/TERZA-PAGINA-ADATTIVA.md`,
`tests/INPUT-SCROLL.md`, `tests/EXERCISE-SCROLL.md`. Esiti della stessa
build:7scenari/168controlli pagina3 e7/151 pagina2/cropper; emulazioni,
non certificazione di accessibilità né prove su telefoni fisici.

## Ritaglio foto — clone fedele 8731 (28/10/2026, produzione 8736)

La nuova finestra usa i sorgenti del kit allegato senza riscriverne la
geometria o il canvas. Non modifica gli altri tool né il flusso didattico.

- Otto maniglie `role=slider`, etichettate per lato/angolo e raggiungibili
  con Tab: frecce 2%, Maiusc+frecce 10%.
- Trascinamento diretto con mouse e touch dell'interno della selezione,
  senza icona centrale; otto prese da 44px tutte dentro la foto.
- Focus modale Radix, Escape, X e CHIUDI. Stili e scroll precedenti vengono
  ripristinati anche alla chiusura senza conferma.
- RUOTA SINISTRA, RUOTA DESTRA, CHIUDI e RITAGLIA hanno target di almeno
  44px, testo bianco su marrone e vanno a capo in un solo riquadro centrato.
- Corpo scorrevole distinto dai comandi; la finestra resta nello spazio
  effettivamente visibile anche in iframe cross-origin e in orizzontale.
- Lock della sola app durante il ritaglio; gli invii di heightSync sono
  sospesi fino al ripristino. Non si controllano tocchi iniziati sul blog
  esterno all'iframe.

Le prove touch sono emulazioni Chromium, non test su telefoni fisici.
La trascrizione IA/OCR conserva il comportamento già esistente.

# Versione pubblicata8756 — Widget Metacognitivo

## Identità

- Data:29ottobre2026; autorizzazione successiva alla preview verificata.
- App: **WIDGET METACOGNITIVO PER IL CALCOLO DI ESPRESSIONI**.
- Sito: https://espressioni-monomi-polinomi.easy-peasy.site
- Cloud Run: https://deploy-2a7acf3f-6909-wmoltmgh5q-uc.a.run.app
- Runtime approvato: `82602edcb86273a2c2ae997cc97ac30dcaef2dba`.
- Checkpoint pre-deploy: `4868ef6e873ac659cc64581fc346dc60cca649e6`.
- Checkpoint post-verifica: `dcef03ceae59002422d2af3c5416de6b520c2a66`.
  Solo note di rilascio rispetto al runtime pubblicato.
- Il commit esatto del NUOVO pacchetto è in `MANIFEST-SHA256.json`:
  differisce dalle sorgenti runtime solo per guide, strumenti di export,
  test del packaging e checklist. Nessun deploy per aggiornare il pacchetto.

## Asset approvati e pubblicati

| Asset | SHA-256 |
|---|---|
| `assets/index-4q0PEhNN.js` | `734e0af599b2e49ae52bc3660155b241af6fc7223b2b3ea356ed05a4dc340d7c` |
| `assets/index-G2fFP9TG.css` | `d86a90702741b80a751a8c76ee9f7e5a68fcf13cd939a768c1c941a1655eb2e8` |

Verificati identici byte-per-byte online e nella build approvata.
Il controllo di ricostruzione deve confrontare questi asset e tutti i
file di `dist/public` se la baseline compilata è disponibile.
Il bundle server può incorporare la chiave: non distribuirlo e non
pretenderlo identico nella ricostruzione isolata senza credenziali.

## Contratti funzionali8756

1. Prima pagina dati studente invariata, senza limite di altezza compatto.
2. Pagina2 `/espressione`: frame640px, scroll interno; toolbar fuori;
   INDIETRO marrone, niente titolo/dati studente nel suo header, didascalia
   esatta «SCRIVI QUI L'ESPRESSIONE» in grassetto scuro; `piece-display`.
3. Pagina3 `/esercizio`: `expr-exercise-frame` ad altezza naturale fino a640px;
   regione `expr-exercise-scroll`, `flex:0 1 auto`, `min-height:0`, ARIA/focus.
   Non usare il nome storico `expr-exercise-page`, che applica altri font.
4. Fuori iframe, viewport e tastiera possono ridurre i limiti. In iframe
   limite indipendente dall'altezza del child: unico heightSync, token e
   protocollo `labvisivo:height` esistenti. Non serve sostituire l'embed.
5. I contenuti lunghi scorrono: nessuna riduzione font e nessun collasso
   per contenuti brevi. Il MathML KaTeX resta contenuto da position:relative.
6. Print senza clipping/limiti; PDF separato dallo svolgimento effettivo,
   con dati studente e nessun risultato anticipato o input autocompilato.
7. Cropper8731 invariato: modale, hook/CSS/guardia heightSync, PNG lossless,
   drag diretto e quattro pulsanti. Motore, IA, sessioni e risposte invariati.

## Verifiche e limiti

- Tipi/build passati;738unitari passati,28saltati.
- Pagina3:7/7 scenari,168controlli, `tests/exercise-scroll-results.json`.
- Pagina2/cropper:7/7 scenari,151controlli,
  `tests/input-scroll-page3-regression-results.json`.
- Sessioni/IA simulate e touch/viewport Chromium emulati negli E2E;
  nessuna prova fisica né certificazione del blog pubblico.
- Nel post-deploy reale verificati HTTP, asset/font e scroll delle due pagine;
  smoke IA con input vuoto senza chiamata al modello o scrittura dati.
- La ricostruzione dello ZIP è un controllo ulteriore: leggere il rapporto
  esterno8756 che identifica hash e commit dell'archivio effettivamente provato.
  I rapporti8744 precedenti non certificano il nuovo ZIP.

Guide autorevoli: `REBUILD.md`, `AGENTS.md`, `docs/PACCHETTO-ESPORTABILE.md`,
`docs/DEPLOY-8756.md`, `docs/TERZA-PAGINA-ADATTIVA.md`, `ACCESSIBILITA.md`.
Conservare VERSIONE/VERIFICA delle release precedenti come cronologia.


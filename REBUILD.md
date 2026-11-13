# Ricostruire questa identica app — versione pubblicata 9213

**Precedenza aggiornata:** nella 9213 la lettura ad alta voce (ASCOLTO) legge
formule, decimali, periodici, pulsanti e campi visibili, mai le risposte
nascoste, e si arresta al cambio pagina o quando la soluzione viene nascosta.
Dalla 9212 il ramo con valori assoluti omessi vale
soltanto sotto condizioni aggiuntive esplicite, distinte dalle C.E.; gli
altri casi non sono svolti. Il PDF riporta le condizioni. Le C.E. sono
calcolate nei casi supportati senza inventare un elenco incompleto; il PDF
porta i numeri di pagina in basso al centro solo quando va su più di una pagina. Il pulsante MOSTRA SOLUZIONE mostra
su richiesta la risposta del box in notazione calcolatrice e la nasconde
con una seconda pressione; non inserisce automaticamente alcun risultato.
Per una copia completa e una variante di equazioni leggere
`GUIDA-IA-CLONAZIONE-EQUAZIONI.md` e usare `scripts/clona-app-equazioni.py`.
Le date e i divieti assoluti nelle note precedenti sono storici.

Riferimento: **WIDGET METACOGNITIVO PER IL CALCOLO DI ESPRESSIONI**, deploy
9213 del 13/11/2026 (ora italiana), checkpoint funzionale `95eaed5`; vedi
`docs/DEPLOY-9213.md`. La 9212 (condizioni di segno) e la 9197 sono storiche
(la 9162 del 11/11/2026
col pulsante MOSTRA SOLUZIONE è precedente). Nel precedente deploy
9097 del 9/11/2026 (`068b912`) furono introdotti i radicali ad INDICI DIVERSI:
motore a radici di indice 5–12, tastiera `rad5`…`rad12`, costruttore
STESSO INDICE (`costruisciIndiceComune`) e sostituzione identity-preserving
`sostStesso`. La barretta del periodico, le parentesi del radicale in
frazione e il puntino nella traccia vanno preservati; l'OCR resta da
controllare. Leggere `docs/DEPLOY-9097.md`, `docs/DEPLOY-9096.md` e
`AGENTS.md` prima di cambiare il progetto.
Le versioni precedenti, incluse le vecchie schermate «5 passi», sono storiche.

## 1. Estrarre o clonare

Estrarre lo ZIP in una nuova cartella, oppure clonare il repository GitHub.
Entrare nella cartella che contiene `package.json` e `pnpm-lock.yaml`.
Usare **Node.js 22** e pnpm indicato nel campo `packageManager`.

```sh
corepack enable
pnpm install --frozen-lockfile --prod=false
pnpm check
(cd client && pnpm exec vitest run)
pnpm build
pnpm start
```

`--prod=false` include Vite/TypeScript/esbuild anche con NODE_ENV=production.
Per i test degli strumenti di packaging eseguire anche:
`python3 -m unittest discover -s tests -p 'test_export_tools.py' -v`.
Per tutti i test client/server con IA/archivi simulati, senza dati reali,
eseguire `pnpm exec vitest run --root .`. Eseguire con `/tmp` isolato e
senza credenziali o DB reali; eseguire anche `server/trascrizioneFratte.test.ts`
senza escluderlo. Il rapporto del nuovo ZIP documenta gli esiti attuali.
Per verificare il clonatore: `python3 -m unittest discover -s tests -p 'test_clone_equazioni.py' -v`.

Non esiste uno script `pnpm test` in questo package: usare il comando Vitest
sopra. `pnpm check` esegue il precheck che genera automaticamente
`shared/env.generated.ts`; NON copiarlo dalla produzione.

**Stato storico 9162:** i quattro fallimenti allora osservati nelle prove
fratte non rappresentano la baseline attuale. Nella suite isolata prima del
rilascio 9213 risultavano 1.611 test superati e 28 saltati. Rieseguire tutti
i test sullo ZIP finale e riportare separatamente qualsiasi esito diverso.

Suite storica di riferimento del rilascio 9097: **1163 test unificati passati e 28
saltati**; separatamente 1050 client e 108 test server selezionati con mock
(nella selezione server anche `server/indice-comune.test.ts`).
Usare sempre un ambiente isolato con /tmp separato. I banchi di prova saltati
richiedono fixture/risorse facoltative: non sono errori dell'app. I controlli
browser con dati sintetici sono descritti in `tests/FRATTE-FOTO.md`,
`tests/STUDENT-FLOW.md` e `tests/FEEDBACK-PRODOTTI.md`.

## 2. Avvio e configurazione

- `pnpm dev`: compila e avvia Express con frontend e API sulla porta 3000.
  Per il solo frontend Vite usare `pnpm dev:client`; non espone `/api/*`.
- `pnpm build && pnpm start`: Express e frontend; default porta **3000**,
  modificabile con `PORT`. Questo è l'avvio necessario per provare le API.
- Copiare `.env.example` in `.env` solo se serve, inserendo la propria
  `EASY_PEASY_API_KEY` **sul server/build**, mai in variabili `VITE_*`.
  `scripts/sync-env.mjs` legge la variabile d'ambiente o `.env` al build;
  il server prova prima la variabile runtime, poi il fallback incorporato.
- Senza chiave la build riesce, UI/canvas/ritaglio sono utilizzabili e le
  chiamate IA rispondono **503 IA non configurata**. I casi gestiti dai
  costruttori deterministici possono funzionare senza IA; gli altri, come
  rianalisi e dettatura IA, richiedono la chiave.
- `DATABASE_URL` è facoltativa per cache/sessioni. Senza database vengono
  usati file temporanei, non persistenti dopo riavvio. Non eseguire seed,
  reset o migrazioni su dati reali per ricostruire/verificare lo ZIP.

**Sicurezza:** `.env`, `shared/env.generated.ts` e `dist/index.js` possono
contenere chiavi. Non caricarli su GitHub né distribuirli. Il pacchetto
li esclude; contiene un modello `.env.example` vuoto.

## 3. Cosa deve essere identico

- Titolo esatto WIDGET METACOGNITIVO PER IL CALCOLO DI ESPRESSIONI.
- Dati studente → trascrizione mano/audio/tastiera/foto → costruzione IA →
  sessione personale `sid` e box progressivi → CONTINUA → feedback con
  stelline e pulsante PDF dello svolgimento reale, disponibile solo lì.
- Nel feedback non ripetere il risultato: 5 stelle e «OTTIMO LAVORO!» solo
  se tutte le risposte sono giuste al primo colpo; 3–4 «HAI FATTO UN BUON
  LAVORO!»; 0–2 «CONTINUA A ESERCITARTI!». Contare la prima risposta
  pubblicata per ciascun box; un annullamento non è un tentativo.
- Foto SCATTA/CARICA → normalizzazione EXIF → cropper 8731 → PNG → consumer
  IA/OCR → pezzo correggibile. Mai eseguire le operazioni nella trascrizione.
- Le frasi guida non anticipano la soluzione; ogni risultato lo inserisce
  lo studente. MOSTRA SOLUZIONE la rende visibile solo su richiesta, senza
  compilare. Non reintrodurre il promemoria della frazione impilata eliminato
  dall'utente. Invarianti in `FILOSOFIA-DSA.md`.
- Frazioni impilate, moltiplicazione con puntino, parentesi fedeli,
  decimali di input non convertiti automaticamente; box DECIMALI IN FRAZIONE.
- OpenDyslexic auto-ospitato, barra accessibilità, alto contrasto, TTS,
  modello ONNX e WASM/Tesseract locali. Conservare lockfile e `patches/`.

## 3-bis. Seconda e terza pagina: layout compatto e scroll interno

Conservare `.expr-input-frame` SOLO su `/espressione`, altezza640px;
`.expr-exercise-frame` SOLO su `/esercizio`, altezza naturale fino a640px.
Toolbar fuori dalle regioni di scroll `.expr-input-page` e
`.expr-exercise-scroll`. Prima pagina invariata e non limitata.
Fuori iframe rispettare il viewport visibile, compresa la tastiera;
nell'iframe usare limiti indipendenti dall'altezza del child.
`position:relative` contiene il MathML KaTeX; unico heightSync condiviso,
nessun nuovo observer. Pagina3 `flex:0 1 auto`, mai basis0 con height:auto.
NON usare il nome storico `expr-exercise-page`, che attiverebbe altri font.
Durante il crop la pagina interna è ferma e i toast non coprono i comandi.
La stampa rimuove i limiti; il successivo intervento pubblicato nella 9029
interessa solo l'intestazione del generatore PDF separato.
Specifiche: `SECONDA-PAGINA-SCROLL.md`, `docs/TERZA-PAGINA-ADATTIVA.md`.
Collaudo della8756:7scenari/168controlli pagina3 e7/151 pagina2/cropper;
istruzioni in `tests/EXERCISE-SCROLL.md` e `tests/INPUT-SCROLL.md`.
I9scenari crop del rilascio8737 restano una verifica storica separata.

## 3-ter. Rifiniture pagina 2 (8742 e 8744)

Nell'header di `/espressione` NON reintrodurre titolo dell'app né riga dati
studente (rimossi su richiesta; restano in prima pagina e nel PDF). Il
pulsante home è il piccolo pulsante marrone **INDIETRO** (token primary,
`text-xs px-3 py-1.5`, aria-label «Torna alla pagina iniziale»), sempre
visibile. La didascalia della fase input è SOLO «SCRIVI QUI L'ESPRESSIONE»
in grassetto scuro (`text-foreground font-bold`), senza «IN UNO O PIU'
PEZZI.» né «DA SVOLGERE,».

**Pezzi lunghi (8744):** lo span KaTeX di ogni pezzo ha classe
`piece-display` con `flex-1 min-w-0`; il CSS `.piece-display` abilita lo
scorrimento orizzontale DENTRO il box
(`.katex-display { margin .25em auto; width max-content; min-width 100%; }`)
così i pezzi corti restano centrati. Applicare la stessa classe a OGNI
nuovo box che mostri una resa KaTeX (trascrizione, conferma, terza pagina),
altrimenti le espressioni lunghe escono dai bordi su schermo stretto.

## 4. Ritaglio: contratto pubblicato

Copia fedele del kit 8731, pubblicato nel deploy 8736. NON ripristinare
`modal={false}`: **CropDialog è modale**, con scroll interno e pagina dietro
bloccata. Non cambiare `confirm()` né `cropBox.ts` per sistemare il layout.

- Titolo RITAGLIA LA FOTO, beige uniforme, nessuna istruzione sotto.
- Un solo riquadro centrato con RUOTA SINISTRA / RUOTA DESTRA / CHIUDI /
  RITAGLIA; nessun AZZERA o icona centrale. Il footer va a capo se il testo
  ingrandito non entra: non restringere il font né tagliare le etichette.
- Otto maniglie da 44px, drag diretto, tastiera (2%, Maiusc 10%).
- Hook `useCropDialogViewport.ts`, CSS `photo-crop.css` e guardia/evento
  in `heightSync.ts` sono parte dello stesso contratto, anche su mobile.
- PNG lossless max 2200px, proporzioni fedeli, foto piccole ingrandite
  soltanto a schermo. Callback `onConfirm(File)` invariata.
- Nessuna route `/photo-crop-test` nel bundle runtime; fixture conservate
  esclusivamente in `tests/fixtures/photo-crop`.

Test e limiti: `COLLAUDO-PHOTO-CROP-8731.md`, `tests/PHOTO-CROP.md`.

## 5. Mappa dei sorgenti essenziali

| Area | File |
|---|---|
| Schermata dati | `client/src/pages/WelcomePage.tsx` |
| Input/pezzi/foto | `client/src/pages/EspressioniExercises.tsx` |
| Svolgimento e PDF attuale | `client/src/pages/EsercizioFrazioni.tsx` |
| Costruzione, verifica, cache/sessioni | `server/costruisci.ts` |
| API e servizio statici | `server/index.ts` |
| Contratto IA foto | `client/src/lib/aiTranscribe.ts`, `server/index.ts` |
| Ritaglio e viewport | `client/src/components/CropDialog.tsx`, `client/src/hooks/useCropDialogViewport.ts` |
| Geometria e CSS ritaglio | `client/src/lib/cropBox.ts`, `client/src/photo-crop.css` |
| Altezza iframe | `client/src/lib/heightSync.ts` |
| Motore e anti-soluzione | `client/src/lib/espressioni.ts`, `promptSicuri.ts` |
| Font/modelli/OCR | `client/public/fonts`, `models`, `wasm`, `tess`, `tessdata` |

## 6. Verificare l'identità del pacchetto

`MANIFEST-SHA256.json` nello ZIP elenca hash e dimensioni dei sorgenti/asset
esportati, commit di partenza ed esclusioni. Non comprende il proprio hash.

Il bundle client approvato per il rilascio **9213** è
`index-DwZngAFT.js`, SHA-256:

```
dbf636ec7467ae49ab7d23765a76d26a370b35ea26c91c59e7d916bb6bc0a180
```

CSS `index-CTH_tEWo.css`, SHA-256:

```
545c02d9c3cd38b07cf01891f1d25ba0bbdf98363e602bf612d2debaee8794b3
```

Confrontare anche gli altri file `dist/public` con la build approvata.
Il bundle **server** ricostruito senza chiave è intenzionalmente diverso da
quello pubblico con chiave incorporata: non distribuire quello pubblico.
Il report di ricostruzione consegnato con lo ZIP descrive i controlli svolti.

## 7. Rigenerare lo ZIP

Il verificatore incluso controlla gli asset approvati **9213** e l'hash
indicato della cornice. Dopo avere registrato le modifiche in un checkpoint
e avere Git pulito, rigenerare lo ZIP così:

```sh
python3.11 scripts/export-verified.py \
  --project . --output ../espressioni-monomi-polinomi-AGGIORNATO.zip \
  --prefix espressioni-monomi-polinomi --deployment 9213
```

Lo script esclude file riservati/runtime e diagnostici standalone; verifica
credenziali, CRC, SHA-256 e documenti obbligatori. Scrivere lo ZIP fuori dalla
cartella del progetto. Non copiare il bundle server pubblico con le chiavi.

## Cornice del blog e identità degli asset

`cornice-dinamica/embed-espressioni-dedicata.html` è identica alla cornice
pubblica del Widget verificata nel post MATEMATICA il 7/11/2026 (SHA-256
`d7cd547a6f0ba53815a12dd0adcc16276cf02b3a91a16a74b46d8cbcf1968a4c`).
La build rigenera `client/public/anteprima-cornice.html` con questa versione,
ma senza modificare il post. `client/src/index.css` esclude dal rilevamento
Tailwind soltanto quella pagina autonoma. Nel pacchetto 9019 già consegnato
cambiava soltanto l'anteprima della cornice rispetto alla build pubblicata;
il successivo intervento PDF pubblicato nella 9029 cambia il codice client.
Non usare hash di release precedenti per identificare la 9213. Confrontare
sempre con una baseline locale dello stesso commit per `--baseline-public`.

## 7-bis. Verifica e ricostruzione automatizzata dello ZIP

È incluso `scripts/verify-package.py` (Python 3.11+, sola libreria standard).
Il controllo base non esegue codice dell'app; `--rebuild` è esplicito e
ricostruisce in una cartella NUOVA, senza chiavi/API/DB ereditati.

```sh
python3 scripts/verify-package.py ../pacchetto.zip --report ../integrita.json
python3 scripts/verify-package.py ../pacchetto.zip \
  --extract-to ../ricostruzione-nuova --rebuild \
  --baseline-public dist/public --report ../ricostruzione.json
```

Il secondo comando richiede Node 22/Corepack, rete per le dipendenze e una
build client approvata in `dist/public` per il confronto completo facoltativo.
Non usa il bundle server pubblico. Procedura e limiti in
`docs/PACCHETTO-ESPORTABILE.md`.

## 8. Deploy

- Render via GitHub: `RENDER.md` e `render.yaml`, runtime Node/Express,
  NON static site. Impostare la propria chiave nell'ambiente del servizio.
- Easy-Peasy: nella chat di questa app, preview → checkpoint → nuova
  conferma esplicita → produzione. Lo ZIP non autorizza un altro deploy.
- Non sovrascrivere app diverse lavorando dalla chat errata.
- Accessibilità e clonazione: `ACCESSIBILITA.md`, `ADATTARE.md`,
  `ADATTARE-EQUAZIONI.md`, `TRAPIANTO-FOTO.md` e `FILOSOFIA-DSA.md`.

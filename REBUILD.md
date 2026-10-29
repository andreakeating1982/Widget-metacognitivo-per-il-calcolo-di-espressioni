# Ricostruire questa identica app — versione pubblicata8756

Riferimento: **WIDGET METACOGNITIVO PER IL CALCOLO DI ESPRESSIONI**, deploy
8756 del29/10/2026. Leggere `VERSIONE-8756.md` e `AGENTS.md` prima di cambiare
il progetto. Le vecchie schermate «5 passi» documentate nella cronologia
non sostituiscono il flusso universale attuale.

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

Non esiste uno script `pnpm test` in questo package: usare il comando Vitest
sopra. `pnpm check` esegue il precheck che genera automaticamente
`shared/env.generated.ts`; NON copiarlo dalla produzione.

Suite di riferimento: **738 test passati, 28 saltati; 51 file passati e 28
saltati**. I banchi di prova saltati richiedono fixture/risorse facoltative:
non sono errori dell'app.

## 2. Avvio e configurazione

- `pnpm dev`: Vite frontend, normalmente porta 3000. Non espone `/api/*`.
- `pnpm build && pnpm start`: Express e frontend; default porta **3000**,
  modificabile con `PORT`. Questo è l'avvio necessario per provare le API.
- Copiare `.env.example` in `.env` solo se serve, inserendo la propria
  `EASY_PEASY_API_KEY` **sul server/build**, mai in variabili `VITE_*`.
  `scripts/sync-env.mjs` legge la variabile d'ambiente o `.env` al build;
  il server prova prima la variabile runtime, poi il fallback incorporato.
- Senza chiave la build riesce, UI/canvas/ritaglio sono utilizzabili e le
  chiamate IA rispondono **503 IA non configurata**. Costruzione esercizi,
  rianalisi e dettatura IA richiedono la chiave: non prometterle senza.
- `DATABASE_URL` è facoltativa per cache/sessioni. Senza database vengono
  usati file temporanei, non persistenti dopo riavvio. Non eseguire seed,
  reset o migrazioni su dati reali per ricostruire/verificare lo ZIP.

**Sicurezza:** `.env`, `shared/env.generated.ts` e `dist/index.js` possono
contenere chiavi. Non caricarli su GitHub né distribuirli. Il pacchetto
li esclude; contiene un modello `.env.example` vuoto.

## 3. Cosa deve essere identico

- Titolo esatto WIDGET METACOGNITIVO PER IL CALCOLO DI ESPRESSIONI.
- Dati studente → trascrizione mano/audio/tastiera/foto → costruzione IA →
  sessione personale `sid` e box progressivi → PDF dello svolgimento reale.
- Foto SCATTA/CARICA → normalizzazione EXIF → cropper 8731 → PNG → consumer
  IA/OCR → pezzo correggibile. Mai eseguire le operazioni nella trascrizione.
- **Mai dire la soluzione**, neanche nei testi guida; ogni risultato lo
  inserisce lo studente. Non reintrodurre il promemoria permanente della
  frazione impilata eliminato dall'utente. Invarianti in `FILOSOFIA-DSA.md`.
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
La stampa rimuove i limiti; il generatore PDF separato non è stato cambiato.
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
  RITAGLIA; nessun AZZERA o icona centrale.
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

Dopo il build, il bundle client8756 approvato è `index-4q0PEhNN.js`, SHA-256:

```
734e0af599b2e49ae52bc3660155b241af6fc7223b2b3ea356ed05a4dc340d7c
```

CSS `index-G2fFP9TG.css`, SHA-256:

```
d86a90702741b80a751a8c76ee9f7e5a68fcf13cd939a768c1c941a1655eb2e8
```

Confrontare anche gli altri file `dist/public` con la build approvata.
Il bundle **server** ricostruito senza chiave è intenzionalmente diverso da
quello pubblico con chiave incorporata: non distribuire quello pubblico.
Il report di ricostruzione consegnato con lo ZIP descrive i controlli svolti.

## 7. Rigenerare lo ZIP

Dopo avere registrato tutte le modifiche in un commit e avere Git pulito:

```sh
python3.11 scripts/export-verified.py \
  --project . --output ../espressioni-monomi-polinomi-AGGIORNATO.zip \
  --prefix espressioni-monomi-polinomi --deployment 8756
```

Lo script esclude file riservati/runtime e diagnostici standalone; verifica
credenziali, CRC, SHA-256 e documenti obbligatori. Scrivere lo ZIP fuori dalla
cartella del progetto. Non copiare il bundle server pubblico con le chiavi.

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

# Versione pubblicata 8736 — 28 ottobre 2026 (cronologia)

**Superata dal deploy 8737:** leggere VERSIONE-8737.md per stato corrente,
layout della seconda pagina e hash del client. I dati seguenti descrivono
il precedente rilascio del cropper e il suo pacchetto.

## Riferimento verificato

- App: **WIDGET METACOGNITIVO PER IL CALCOLO DI ESPRESSIONI**.
- URL pubblico: https://espressioni-monomi-polinomi.easy-peasy.site
- Deploy: **8736**, autorizzato dall'utente e attivo.
- Commit dei sorgenti pubblicati: `d5a5f5373f4156b9b244785f56b8d5c646a274fc`.
- Bundle client: `index-CYaBE4Bd.js`.
- SHA-256 del bundle: `6fafb4ca54358f45b95c6e48c18b07894c08428c321765567dd97e53b6e2da92`.

Le modifiche successive di guide, skill e configurazione dell'esportazione
non sono un nuovo deploy. Questo pacchetto conserva il codice funzionale
pubblicato; non è stato effettuato un altro deploy per produrre lo ZIP.

## Nuovo ritaglio

Sostituzione completa con il clone fedele del documento
`CLONARE-PHOTO-CROPPER-AGGIORNATO-8731.md`: titolo RITAGLIA LA FOTO,
beige uniforme, quattro comandi marroni (RUOTA SINISTRA, RUOTA DESTRA,
CHIUDI, RITAGLIA) in un riquadro, nessuna icona centrale, otto maniglie.
Finestra modale, scroll interno e blocco pagina; viewport adatto anche a
iframe cross-origin, sincronizzazione della cornice sospesa durante il lock.
Uscita PNG lossless, lato massimo 2200px. Conferma `onConfirm(File)` e
consumer OCR invariati; foto = trascrizione, MAI calcolo automatico.

Non ripristinare il vecchio `modal={false}` per CropDialog. Non cambiare
`confirm()` o `cropBox.ts` per modificare la presentazione. Copiare insieme
componente, hook viewport, CSS e guardia/evento heightSync.

## Collaudi già eseguiti

- Typecheck e build riusciti.
- 738 test unitari superati, 28 saltati (51 file superati, 28 saltati).
- 19 scenari E2E, 425 controlli; altri 7 controlli su foto piccole,
  chiusura X/Escape, riapertura e PNG 2200px.
- Verifica sul sito pubblicato: HTTP 200, bundle uguale a quello approvato,
  apertura, otto maniglie, pulsanti, lock pagina e chiusura della finestra.

Dettagli: `COLLAUDO-PHOTO-CROP-8731.md` e `tests/PHOTO-CROP.md`.
Touch emulato in Chromium e blog simulato, non telefoni fisici. OCR mock nei
test d'integrazione, senza chiamate IA durante il collaudo del cropper.

## Pacchetto e sicurezza

Include sorgenti, modelli ONNX, WASM/Tesseract, font OpenDyslexic, PDF
pubblico didattico, test, cornice Blogger, lockfile/patches e guide per IA.
`MANIFEST-SHA256.json` riporta commit, lista, dimensioni e hash dei file.

Esclude `.env` reali e copie, `shared/env.generated.ts`, `dist/`,
`node_modules/`, `.git/`, cache, log, sessioni e dati database. Questi file
non servono per ricostruire i sorgenti e possono contenere credenziali o
risposte degli studenti. I due diagnostici standalone `client/diag-89.ts`
e `client/diag-profile.ts` non fanno parte del pacchetto; i test di
regressione e le fixture sintetiche sono conservati.

Le guide storiche `GUIDA-UNICA.html`, `ISTRUZIONI-GITHUB.txt` e le sezioni
cronologiche sono conservate come riferimenti di famiglia, NON come istruzioni
aggiornate. Per ricostruire usare `REBUILD.md`, `RENDER.md`, questo file e
le regole iniziali di `AGENTS.md`/`README.md`.

**Chiave IA:** lo ZIP non contiene quella di produzione. Configurare la
propria `EASY_PEASY_API_KEY` nell'ambiente server/build (vedere `.env.example`).
Senza chiave funzionano UI, canvas locale e ritaglio; la costruzione IA e
le altre funzioni IA non sono disponibili. Senza database configurato le
sessioni/cache usano file temporanei, non persistenti dopo un riavvio.
Non copiare dati della produzione per verificare la ricostruzione.


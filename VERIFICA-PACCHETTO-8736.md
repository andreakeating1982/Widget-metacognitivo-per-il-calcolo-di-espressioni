# Verifica del pacchetto aggiornato — produzione 8736

**28 ottobre 2026 — ricostruzione completata da una nuova estrazione dello ZIP.**

Il pacchetto riguarda WIDGET METACOGNITIVO PER IL CALCOLO DI ESPRESSIONI,
versione pubblicata e verificata nel deploy **8736**. Le guide e le skill
sono state aggiornate senza cambiare il codice funzionale o i dati.

## Prova di ricostruzione

- Sorgenti verificati nel test: commit `65200bf5770edc726ce8ff4ee0ac13175fd1cfe8`.
- Nuova cartella, nessun node_modules o file di ambiente copiato.
- `corepack enable`: riuscito.
- `pnpm install --frozen-lockfile`: riuscito.
- `pnpm check`: riuscito.
- `(cd client && pnpm exec vitest run)`: **738 test superati,
  28 saltati** (banchi facoltativi).
- `pnpm build`: riuscito, senza chiave IA.
- **Tutti i 37 file del client compilato sono identici,
  byte per byte, alla build approvata e pubblicata.**
- Bundle `index-CYaBE4Bd.js`, SHA-256:
  `6fafb4ca54358f45b95c6e48c18b07894c08428c321765567dd97e53b6e2da92`.

## Avvio reale del server ricostruito

Server Express avviato su porta di collaudo, senza database e senza chiavi,
poi arrestato regolarmente. Verificati:

- pagina iniziale: HTTP **200**, titolo corretto;
- font OpenDyslexic locale: HTTP **200**;
- COOP `same-origin` e COEP `require-corp` presenti;
- API IA senza chiave: **503**, esito atteso.

Nessuna richiesta IA a pagamento, nessuna migrazione, seed o modifica dei
dati reali. Per usare le funzioni IA nella propria installazione configurare
la propria `EASY_PEASY_API_KEY` sul server/build.

## Contenuto e sicurezza

Archivio completo di sorgenti, test, asset ONNX/WASM/Tesseract, font,
PDF pubblico, cornice Blogger, lockfile, patches e guide. CRC dell'archivio
e SHA-256 di ogni file verificati. `MANIFEST-SHA256.json` contiene l'elenco
completo, commit di esportazione e hash; il manifest non elenca sé stesso.

Esclusi: `.env` reali, file generati con credenziali, dist, node_modules,
.git, cache/log, database e sessioni. Scansione dei valori riservati e delle
firme di chiave superata, senza stampare o includere credenziali.
L'esempio ambiente contiene campi sensibili vuoti.

Esclusi anche due vecchi diagnostici standalone non usati dall'app:
`client/diag-89.ts` e `client/diag-profile.ts`. Le fixture sintetiche e i
banchi di prova riusabili restano inclusi. Le guide storiche ereditate dalla
famiglia matematica restano come riferimento; per ricostruire usare
`REBUILD.md`, `VERSIONE-8736.md` e `RENDER.md`.

Il report e le ultime rettifiche documentali sono stati inclusi DOPO la
prova del commit indicato sopra: il manifest finale identifica il commit
del pacchetto consegnato. Il confronto finale verifica che non sia cambiato
nessun sorgente funzionale o asset rispetto all'estrazione collaudata.

## Skill aggiornate

1. **espressioni-monomi-polinomi**: progetto corrente, produzione 8736,
   cropper fedele 8731, modal=true, viewport/lock/heightSync, test e limiti.
2. **zip-esportabile-guide-ia**: export sicuro con scansione credenziali,
   manifest, esclusioni, script riusabile e ricostruzione senza dati reali.

Entrambe validate con il validatore delle skill. Nessun altro deploy è
stato eseguito per creare questa consegna.

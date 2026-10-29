# AGENTS — lavorare su questa app o crearne una variante

## Identità e precedenza

- Progetto: `espressioni-monomi-polinomi`; titolo pubblico corrente
  **WIDGET METACOGNITIVO PER IL CALCOLO DI ESPRESSIONI**.
- Baseline pubblicata e pacchetto corrente: **8756**,29/10/2026;
  questa esportazione conserva runtime e asset pubblici approvati.
- Modifiche pubblicate in produzione8756 (29/10): pagina2 **640px** come
  cornice dedicata Latino, pagina3 **altezza naturale fino a640px** con
  scroll interno. Leggere `docs/ALTEZZA-COMPATTA-PREVIEW.md` e
  `docs/TERZA-PAGINA-ADATTIVA.md`; le note layout8744 sono precedenti.
  Rilascio verificato: `docs/DEPLOY-8756.md`; lo ZIP8756 sostituisce il8744.
- Leggere nell’ordine: `README.md`, `REBUILD.md`, `VERSIONE-8756.md`,
  `FILOSOFIA-DSA.md`; per una variante anche `ADATTARE.md`.
- I documenti in `docs/storico/` e le sezioni datate di `GUIDA-IA.md`
  sono precedenti: non ripristinare da lì limiti, flussi o titoli superati.
  L’AGENTS precedente completo è conservato in
  `docs/storico/AGENTS-prima-riordino-2026-10-29.md` per dettagli geometrici.

## Comandi reali

```sh
corepack enable
pnpm install --frozen-lockfile --prod=false
pnpm check
(cd client && pnpm exec vitest run)
python3 -m unittest discover -s tests -p 'test_export_tools.py' -v
pnpm build
pnpm start
```

Node 22, pnpm da `packageManager`. Non esiste `pnpm test`.
Vite (`pnpm dev`) serve solo il frontend: le API si provano con Express.
I test del motore della baseline sono 738 passati e 28 saltati;
registrare separatamente i test Python del packaging e gli E2E.
Non aggiornare il lockfile o le patch per riordinare documenti.

## Mappa dei file attuali

| Area | Sorgenti |
|---|---|
| Prima pagina / dati | `client/src/pages/WelcomePage.tsx` |
| Seconda pagina, input/pezzi/foto | `client/src/pages/EspressioniExercises.tsx` |
| Terza pagina, sessione e PDF attuale | `client/src/pages/EsercizioFrazioni.tsx` |
| Router, wrapper pagine2/3 | `client/src/App.tsx` |
| Creazione IA, sessioni/cache | `server/costruisci.ts` |
| API statici/IA, COOP/COEP, CORS font | `server/index.ts`, `server/audio.ts` |
| Matematica locale, audit | `client/src/lib/espressioni.ts`, relativi test |
| Sanitizzazione anti-soluzione | `client/src/lib/promptSicuri.ts` |
| Input a mano / pipeline | `MathDrawCanvas.tsx`, `NumberInputCanvas.tsx`, `useMathRecognition.ts`, `recognizePipeline.ts` |
| Cropper completo | `CropDialog.tsx`, `useCropDialogViewport.ts`, `cropBox.ts`, `photo-crop.css`, `heightSync.ts` |
| Notazione e audio | `keyboardNotation.ts`, `audioNotation.ts`, `useRecorder.ts` |
| Preferenze, toolbar e TTS | `AccessibilityContext.tsx`, `AccessibilityToolbar.tsx`, `useReadAloud.ts` |
| PDF e mappa del percorso storico locale | `client/src/lib/pdf.ts`, `mappaPdf.ts` |
| Ricostruzione e export | `scripts/sync-env.mjs`, `export-verified.py`, `verify-package.py` |

Risoluzione dei percorsi abbreviati: componenti sotto `client/src/components/`,
hook sotto `client/src/hooks/`, librerie sotto `client/src/lib/`.
Non attribuire il PDF attuale della terza pagina soltanto a `pdf.ts`.

## Invarianti assoluti

1. **Mai dire la soluzione**, neanche per iscritto o TTS. Lo studente
   inserisce i risultati; nessuna sostituzione automatica del suo lavoro.
2. IA propone, motore dispone: convalidare deterministicamente i passaggi,
   senza fidarsi dei conti generati dall’IA. Trascrizione foto/audio non
   deve risolvere o semplificare ciò che legge.
3. Aritmetica esatta, frazioni impilate, moltiplicazione col puntino;
   parentesi quadre/graffe conservate. Nessuna coercizione di `2,5` in `25`.
   Distinguere trascrizione fedele, normalizzazione e box DECIMALI IN FRAZIONE.
4. Non reintrodurre il messaggio permanente «SCRIVI IL RISULTATO COME
   FRAZIONE IMPILATA» né il promemoria della regola dei segni.
5. Seconda pagina: header senza titolo/dati; INDIETRO marrone; didascalia
   «SCRIVI QUI L’ESPRESSIONE» in grassetto scuro. Titolo/dati in pagina 1/PDF.
6. `piece-display` su ogni resa KaTeX: testo lungo scorre nel proprio box;
   pagina2 a640px e pagina3 ad altezza naturale fino a640px in produzione8756,
   toolbar fuori dallo scroll. Prima pagina non limitata. Unico heightSync,
   niente observer duplicati o loop iframe. In pagina3 flex-basis:auto,
   NON0: il contenuto corto deve mantenere l'altezza naturale. Regione
   `expr-exercise-scroll`, NON `expr-exercise-page` (collisione di font storici).
7. Cropper 8731 **modale (`modal={true}`)** con hook, CSS e guardia heightSync.
   Non cambiare `confirm()`/`cropBox.ts` per problemi di layout. Otto maniglie,
   drag diretto, PNG lossless, quattro comandi marroni; niente route QA runtime.
8. OpenDyslexic auto-ospitato, accessibilità, TTS, focus, contrasto e ARIA;
   non ridurre i font per nascondere overflow. KaTeX conserva i suoi font.
9. Riconoscimento a mano/foto: prima misurare, poi correggere. I banchi
   opzionali saltati non certificano modello reale o IA live. Preservare
   la sequenza dei segni, la geometria degli apici e il tipo di parentesi.
10. PDF dallo svolgimento reale con dati studente, anche parziale. Nei cloni
    verificare che non venga esportato l’esercizio predefinito.

## Segreti e dati

`EASY_PEASY_API_KEY` resta SOLO server: ambiente/.env e fallback generato
al build, mai `VITE_*`, sorgenti client o Git. Non stampare credenziali.
Non copiare `shared/env.generated.ts`: rigenerarlo con la propria configurazione.
Non archiviare `dist/index.js`, che può contenere il fallback della chiave.

`DATABASE_URL` è facoltativa: senza DB la persistenza usa `/tmp`.
Nessun reset, seed o migrazione sui dati veri per testare un export.
Le nuove app devono usare un ambiente e, se necessario, un database distinti.

## Workflow

- **Clone identico:** copiare sorgenti/lockfile/patch/asset e verificare hash.
- **Variante:** inizializzare una NUOVA app, documentare il perimetro e
  cambiare solo il dominio richiesto; nuovi test del motore prima del rilascio.
  Equazioni generiche/disequazioni/quiz non si ottengono con il solo titolo.
- **Solo ZIP:** niente modifiche a UI/motore/API; Git pulito → export verificato
  → estrazione nuova → install/check/test/build → confronto client → smoke.
  Procedura: `docs/PACCHETTO-ESPORTABILE.md`.
- **Deploy:** checkpoint → preview → condivisione URL e STOP → sì esplicito
  in un messaggio successivo → checkpoint → produzione. La consegna di ZIP
  o skill non autorizza un deploy né una pubblicazione su GitHub/Render.

Conservare documenti storici e file ereditati segnalati, senza usarli per
sovrascrivere lo stato corrente. Aggiornare README/REBUILD/ADATTARE/RENDER,
ACCESSIBILITA e rapporto soltanto con verifiche realmente eseguite.


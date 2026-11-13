# AGENTS — lavorare su questa app o crearne una variante

## Identità e precedenza

**Release corrente 9213 (13/11/2026, ora italiana) — precedenza assoluta sulle note storiche:**
la lettura ad alta voce (ASCOLTO) legge formule, decimali, periodici, pulsanti
e campi visibili, mai le risposte nascoste, e si arresta al cambio pagina o
quando la soluzione viene nascosta; nel ramo senza modulo mostra le condizioni
aggiuntive, separate dalle C.E.; gli altri casi non sono svolti. Conserva
condizioni e dominio anche nel PDF. Non estendere questa semplificazione a
tutto il dominio. Vedi `docs/DEPLOY-9213.md` (lettura accessibile) e
`docs/DEPLOY-9212.md` (condizioni di segno).
MOSTRA SOLUZIONE è un toggle inizialmente nascosto, per il solo box corrente,
formato calcolatrice su una riga; una seconda pressione nasconde la risposta.
Non compilare mai il campo automaticamente né anticipare soluzioni nei prompt.
Per clonazione completa e variante equazioni leggere prima
`GUIDA-IA-CLONAZIONE-EQUAZIONI.md` e usare `scripts/clona-app-equazioni.py`.
Le equazioni non sono già risolte universalmente: servono nuovo parser,
dominio, verificatore, solver e test. Isolare sempre database/ambiente.
I riferimenti 9162/9197/9097 e i divieti assoluti di visualizzazione sotto sono storici;
si applica l'eccezione esplicita MOSTRA SOLUZIONE di cui sopra.

- Progetto: `espressioni-monomi-polinomi`; titolo pubblico corrente
  **WIDGET METACOGNITIVO PER IL CALCOLO DI ESPRESSIONI**.
- Versione storica: **9097**, 9/11/2026; checkpoint `068b912`.
  Radicali ad INDICI DIVERSI: motore a radici di indice 5–12, tastiera
  `rad5`…`rad12`, costruttore STESSO INDICE (`costruisciIndiceComune`) e
  sostituzione identity-preserving `sostStesso` (la `sostituisciNodo` di
  sistema clona i rami: NON usarla per tenere riferimenti all'AST fra più
  box). Dettagli in `docs/DEPLOY-9097.md`; 9096 e le altre versioni sono
  precedenti. Non anticipare mai risultati o soluzioni.
- Periodici: `periodicNotation.ts` preserva barretta e antiperiodo, senza
  inventarli. Foto: raggruppare la radice nella parte fratta e mantenere il
  puntino fra radicali; l'OCR non è infallibile, l'utente verifica il testo.
- Pubblicato nella **9058**: le divisioni «:» della trascrizione IA della
  foto restano divisioni (opzione `keepDivision` in `client/src/lib/exprOcr.ts`,
  flusso foto marca la sorgente IA in `EspressioniExercises.tsx`): prima il
  normalizzatore Tesseract le trasformava in barre di frazione «/» e la
  costruzione falliva sempre su espressioni con potenze di frazioni impilate
  (es. `{[(1⁄2)^4*((1⁄2)^2)^3:(1⁄2)^9]}:[(1⁄2)^3*1⁄2]^2`). Il soccorso Tesseract
  non cambia. Suite 999 client + 53 server; bundle `index-Dpnp3kZL.js`;
  e2e su foto reale in `docs/DEPLOY-9058.md`.
- Pubblicato nella **9055**: potenze oltre i double in modalità
  «Proprietà simboliche» — il motore (`client/src/lib/espressioni.ts`)
  resta sui simboli: lo studente digita SOLO gli esponenti e i risultati
  restano potenze (`pow-prop-exp`, `pow-pow-exp`, `pow-flip` con
  denominatore simbolico, `finalSymbolicLatex`, `symbolicResultLatex`); la
  costruzione IA verifica l'aritmetica intera con BigInt (`valoreBigint` in
  `server/costruisci.ts`), che prima bocciava i box 2^72 come «non
  verificabili». MAI anticipare soluzioni. Suite 995 client + 53 server
  al rilascio; e2e su foto reale in `docs/DEPLOY-9055.md`.
- Pubblicato nella **9052**: riconoscimento delle frazioni algebriche
  impilate — il contratto IA racchiude tra parentesi numeratore/denominatore
  algebrici (unica eccezione alla regola «non aggiungere parentesi») e la
  resa delle impilate prende l'intero operando di `⁄` con potenze comprese
  (modulo `client/src/lib/appNotationLatex.ts`). Il nuovo prompt NON è
  ancora rimisurato dal vivo (limite parole IA 429 durante le prove);
  vedi `docs/DEPLOY-9052.md`.
  Il PDF riporta il conteggio al primo colpo sotto i dati compatti. La **9033**,
  la **9029**, la **9019** e la **8999** sono baseline precedenti; gli ZIP
  precedenti non contengono le ultime correzioni.
- Modifica pubblicata nella **9033**: il consiglio per la frazione composta è
  nello stesso testo del metodo senza riquadro; tonde, quadre e graffe
  equivalenti e ben bilanciate sono accettate. Non alterare il parser solo
  per cambiare lo stile. Test e limiti in
  `docs/ISTRUZIONI-FRAZIONE-ANTEPRIMA-2026-11-07.md`.
- Pubblicato nella 9038: percorso circoscritto e verificato per la somma/
  differenza di due fratte con fattore esterno, fedeltà di `/` e `⁄` e scroll
  delle formule lunghe. Conservare ogni input dello studente; i casi non
  garantiti restano al flusso IA. Ambito e test in `docs/DEPLOY-9038.md` e
  `docs/COLLAUDO-FRATTE-FATTORE-ESTERNO-ANTEPRIMA.md`.
- Modifiche pubblicate in produzione8756 (29/10): pagina2 **640px** come
  cornice dedicata Latino, pagina3 **altezza naturale fino a640px** con
  scroll interno. Leggere `docs/ALTEZZA-COMPATTA-PREVIEW.md` e
  `docs/TERZA-PAGINA-ADATTIVA.md`; le note layout8744 sono precedenti.
  Rilascio verificato: `docs/DEPLOY-8756.md`; lo ZIP8756 sostituisce il8744.
- Leggere nell’ordine: `README.md`, `docs/DEPLOY-9096.md`, `docs/DEPLOY-9094.md`, `docs/DEPLOY-9055.md`, `docs/DEPLOY-9052.md`, `docs/DEPLOY-9038.md`, `docs/DEPLOY-9033.md`, `REBUILD.md`,
  `docs/DEPLOY-9029.md`, `docs/DEPLOY-9019.md`,
  `VERSIONE-8999.md` per la baseline e `FILOSOFIA-DSA.md`; per una variante
  anche `ADATTARE.md`.
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
`pnpm dev` compila e avvia Express con API; `pnpm dev:client` avvia solo Vite.
Nel collaudo 9097 la suite unificata ha 1163 test passati e 28 saltati;
separatamente 1050 client passati, 28 saltati e 108 server selezionati.
I test usano dati isolati, non sessioni reali. Nel collaudo storico 9038 i
client erano 956 passati e 28 saltati; 45 test
server hanno usato archivi e modello simulati. Nei rilasci 9019 e 9029 erano
933 client passati e 28 saltati. Registrare separatamente i test server,
Python del packaging e gli E2E.
Non aggiornare il lockfile o le patch per riordinare documenti.

## Mappa dei file attuali

| Area | Sorgenti |
|---|---|
| Prima pagina / dati | `client/src/pages/WelcomePage.tsx` |
| Seconda pagina, input/pezzi/foto | `client/src/pages/EspressioniExercises.tsx` |
| Terza pagina, sessione e PDF attuale | `client/src/pages/EsercizioFrazioni.tsx` |
| Router, wrapper pagine2/3 | `client/src/App.tsx` |
| Creazione IA, sessioni/cache e fratte guidate | `server/costruisci.ts`, `server/frazioniLetteraliGuidate.ts` |
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

1. Non anticipare la soluzione in istruzioni o TTS; lo studente inserisce
   ogni risultato. Eccezione esplicita: MOSTRA SOLUZIONE mostra/nasconde la
   risposta del box su richiesta, senza alcuna sostituzione automatica.
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
   pagina2 a640px e pagina3 ad altezza naturale fino a640px nelle produzioni 9019 e 9029,
   toolbar fuori dallo scroll. Prima pagina non limitata. Unico heightSync,
   niente observer duplicati o loop iframe. In pagina3 flex-basis:auto,
   NON0: il contenuto corto deve mantenere l'altezza naturale. Regione
   `expr-exercise-scroll`, NON `expr-exercise-page` (collisione di font storici).
7. Cropper 8731 **modale (`modal={true}`)** con hook, CSS e guardia heightSync.
   Non cambiare `confirm()`/`cropBox.ts` per problemi di layout. Otto maniglie,
   drag diretto, PNG lossless, quattro comandi marroni adattivi al font;
   niente route QA runtime. Nella cornice Blogger conservare pulsanti chiari
   come nella foto, SVG completi e area tattile estesa senza cambiare lo stile.
8. OpenDyslexic auto-ospitato, accessibilità, TTS, focus, contrasto e ARIA;
   non ridurre i font per nascondere overflow. KaTeX conserva i suoi font.
9. Riconoscimento a mano/foto: prima misurare, poi correggere. I banchi
   opzionali saltati non certificano modello reale o IA live. Preservare
   la sequenza dei segni, la geometria degli apici e il tipo di parentesi.
10. PDF dello svolgimento reale con dati studente: il pulsante compare solo
    nel feedback dopo il completamento. Nella versione pubblicata i dati stanno
    in una riga quando possibile, con a capo per testi lunghi; subito sotto,
    lo stesso conteggio dei primi tentativi del feedback. Il generatore
    parziale, se richiamato internamente, non deve anticipare risultati non
    inseriti dallo studente o presentare un conteggio come finale. Nei cloni
    verificare che non venga esportato l’esercizio predefinito.
11. Il feedback non ripete il risultato; CONTINUA lo apre solo dopo tutti i
    box. Non modificare il primo tentativo quando si corregge una risposta
    o si rivedono i passaggi. Le soglie dei messaggi sono in `REBUILD.md`.
12. Cornice Blogger: la copia del post del 7/11/2026 (559 righe, hash in
    `cornice-dinamica/README.md`) prevale sulla vecchia copia di 526 righe;
    mantenere CSS scoped, SVG e ping di conferma. La pagina HTML di prova è
    esclusa dalla scansione Tailwind per non alterare il CSS dell'app. La
    modifica del repository non modifica automaticamente il post o il DOCX.

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


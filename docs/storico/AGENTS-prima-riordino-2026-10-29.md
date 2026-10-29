# AGENTS.md — Guida rapida per agenti IA

**Stato corrente — deploy 8744 del 28/10/2026:** leggere `VERSIONE-8744.md`
e `REBUILD.md`. Nome corrente **WIDGET METACOGNITIVO PER IL CALCOLO DI
ESPRESSIONI**: dati → trascrizione → costruzione IA → sessione `sid` →
box progressivi e PDF. Ritaglio clone 8731 pubblicato, `modal={true}`;
le note storiche contrarie sono superate. Suite corrente: 738 passati,
28 saltati; collaudo corrente 7 scenari layout (151 controlli) +9 crop
(223 controlli); i 19 scenari precedenti restano cronologia 8736. Per test usare `(cd client && pnpm exec vitest run)`,
NON `pnpm test` (script inesistente). Cache/sessioni possono usare DB o
fallback temporaneo: non eseguire reset, seed o migrazioni sui dati reali.

**Seconda pagina limitata:** leggere `SECONDA-PAGINA-SCROLL.md`. Solo
`/espressione` ha wrapper App `expr-input-frame` e area `expr-input-page`,
limiti 820/720px e toolbar fuori dallo scroll. Preservare position:relative
per il MathML KaTeX e heightSync unico; non reintrodurre il vecchio observer
locale, non applicare il limite alle pagine 1/3. Le notifiche sono nascoste
solo durante il ritaglio. In iframe NON dimensionare il frame col suo 100vh.
**Pagina 2 (8742/8744):** header senza titolo né dati studente; pulsante
home = piccolo bottone marrone INDIETRO, sempre visibile; didascalia SOLO
«SCRIVI QUI L'ESPRESSIONE» grassetto scuro. **Pezzi lunghi:** ogni resa
KaTeX va in un contenitore `piece-display` con scorrimento interno, mai
fuori dai bordi; i pezzi corti restano centrati. Non reintrodurre titolo,
dati, vecchia didascalia né box senza scorrimento interno.

Questa repository deriva dall'app **ESPRESSIONI LETTERALI, MONOMI E POLINOMI**:
app didattica interattiva **Vite + React + TypeScript + TailwindCSS 4** (scaffold
`web-db-user` dal giro 20: server Express + Drizzle/Neon; DB facoltativo
per cache e sessioni della versione universale). La matematica e le regole tastiera girano nel browser; le rotte
`/api/ai/*` (dettato, rianalisi, soccorso vision) richiedono `EASY_PEASY_API_KEY`
— in produzione la chiave è **cotta nel bundle server** via `scripts/sync-env.mjs`
(da `.env` locale, MAI su git, MAI nel bundle browser).

## Documenti chiave (leggere in questo ordine)

| Documento | Scopo |
|-----------|-------|
| **`REBUILD.md`** | Ricostruire l'app **identica** dal repository (clone → install → check → build → deploy). |
| **`ADATTARE.md`** | Creare **varianti** cambiando solo contenuti/contenuti matematici del motore. |
| **`RENDER.md`** | Trasferire l'app su **Render** via GitHub (Blueprint `render.yaml`). |
| **`ACCESSIBILITA.md`** | ♿ Sezione ACCESSIBILITÀ: misure BES/DSA portabili su altre app. |
| **`FILOSOFIA-DSA.md`** | 💡 Filosofia DSA in 12 principi, CLONABILE in nuove app (checklist + prompt di clonazione). Leggerla PRIMA di proporre funzioni «aiutanti». |
| **`GUIDA-IA.md`** | Architettura, file critici, regole d'oro. ⚠️ Le sezioni sull'«equazione biquadratica» sono da leggere come riferimenti storici della famiglia di app: qui il contenuto sono le **espressioni** (motore `client/src/lib/espressioni.ts`). |
| **`IMPLEMENTAZIONE-IA.md`** | Foto/ritaglio/riconoscimento (OCR), mappe concettuali, debug «tremolio». Valido così com'è. |
| **`ADATTARE-EQUAZIONI.md`** | 🧮 Replicare l'app per SOLE equazioni (1°/2° grado, biquadratiche, grado superiore, disequazioni): prompt + verifica + passi per grado. |
| **`TRAPIANTO-FOTO.md`** | 📷 Esportare il tool foto+ritaglio+IA vision+OCR su altre app simili (file, JSX, AI_CONTRACT, checklist). |

## File critici (tocco con cura)

| File | Ruolo |
|------|-------|
| `client/src/lib/espressioni.ts` | **MOTORE**: parser, passi guidati, riduzione monomi, proprietà delle potenze a stessa base (`powPropMulDiv`: quoziente = esponenti SOTTRATTI m−k, prodotto = sommati m+k) e delle radici (`rootPropMulDiv`), **AUDIT DEI CONTI** (`latexValue` + `auditConti`: conti vuoti/errati/salto — 25/10) e FIX FALSO CONTO «(1/3) =» (frazione impilata `fr:true` in parentesi = sola notazione, kind `paren-div`; se scritta coi due punti resta un conto), verifica (+ `espressioni.test.ts`, `radici.test.ts`, `potenza-prop.test.ts`, `conti-audit.test.ts`; **706 test** totali) |
| `client/src/lib/aiVerify.ts` | **VERIFICA IA DEI CONTI** (25/10): `verifyConti` (chiama `/api/ai/verify-steps`, timeout 20 s, null se IA assente) + `applicaVerifica` («l'IA propone, il motore dispone»: correzione accettata SOLO se `latexValue` combacia col valore della catena; passo sbagliato senza correzione fidata SCARTATO; IA che segnala > metà dei passi ignorata) |
| `client/src/lib/supScript.ts` | **APICI A MANO**: analisi geometrica dei tratti, riconoscimento isolato degli esponenti, riattacco `^{d}` (+ test) |
| `client/src/lib/inkSigns.ts` | **SEGNI A MANO**: √, 8, =, − e **FRAZIONE IMPILATA** — `rewriteStackedFractions` (estrae linea+numeratore+denominatore, riconosciuti a parte in modalità «numero», GUIDA-IA §17) e `digitsFromNumberLatex` (omonimi cifra/lettera) (+ test) |
| `client/src/lib/exprOcr.ts` | **OCR FOTO**: normalizzazione testo Tesseract con recupero esponenti (`x2`→`x^2`; quadre/graffe invariate) (+ test) |
| `client/src/lib/recognizePipeline.ts`, `recognizePiece.ts` | **PIPELINE A MANO PURA** (nessun React/DOM): `recognizeInk`, `finalizePiece`, `recognizePieceWith`; l'hook `useMathRecognition.ts` è un involucro sottile; lo stesso codice gira in Node col banco (GUIDA-IA §20) |
| `client/src/lib/squareBrackets.ts`, `bracketProfile.ts` | **PARENTESI a mano**: candidate tonde/quadre/graffe dai tratti, profilo (`classifyProfile`), abbinamento apri/chiudi (`promotePairs` + `promoteRoundOpeners`), «pezzo di sole parentesi» (+ test: `squareBrackets`, `curlyVariants`, `bracketTick`, `roundOpeners`). ⚠️ ogni decisione di `rewriteBrackets` va RIPETUTA in `detectBracketKinds` (regola 3-septies) |
| `client/src/lib/pieceCount.ts` | Conteggio elementi (SOLO per test e banco di prova dal 24/10: il **limite di 10 elementi è stato RIMOSSO** su richiesta — frase «SE VUOI, PUOI TRASCRIVERE L'ESPRESSIONE IN PIU' PEZZI.», nessun blocco/avviso) |
| `client/src/hooks/useRecorder.ts` | **MICROFONO (giri 25, 24/10)**: MediaRecorder → WAV 16 kHz → `POST /api/ai/audio`; auto-stop 20 s con `autoResult` (il dettato si **accoda da solo** senza secondo tocco; `seenAutoRef` anti-duplicati nella pagina) |
| `client/src/lib/keyboardNotation.ts` | **REGOLE TASTIERA (giri 26, 28)**: `:` ÷, `*` ·, `/` frazione impilata, `^n` potenza, `rad2/3/4` radici; `normalizeKeyboardLive` (live), `toDisplayNotation` (pannello), `sanitizeLatexNotation` (LaTeX IA → lineare); legenda dietro pulsante ISTRUZIONI (stati `legendOpen`/`editorLegendOpen` in pagina) |
| `client/src/components/NumberInputCanvas.tsx` | **DIGITA IL VALORE (24/10)**: `normalizeTypedValueNotation` (stessa sintassi tastiera) + potenza `^`, `*`, radici `√∛∜` in `evaluateLatex`; pulsante istruzioni (`valueLegendOpen`); placeholder «Esempio: 8/3» |
| `client/src/components/MathDrawCanvas.tsx`, `client/src/lib/strokeRecorder.ts` | **CANVAS di scrittura**: il tratto in corso vive nel `StrokeRecorder` (fonte di verità sempre aggiornata) e i gestori non rileggono più lo stato React; è un irrobustimento difensivo (nessuna perdita di punti misurata col codice precedente) (+ test) |
| `client/src/lib/composeLatex.ts`, `gapClose.ts` | Composizione del LaTeX per ATOMI e x ASSOLUTA (segni, parentesi, esponenti reinseriti; `timesToLetterX`, `dedupeHallucinatedBrackets`) e chiusura per il modello dei vuoti lasciati dagli elementi tolti (+ test) |
| `client/src/lib/glyphScale.ts`, `ocrReconcile.ts`, `printedBracket.ts` | **FOTO (6/10)**: scala dall'ALTEZZA DELLE CIFRE (`DIGIT_TARGET_PX` = 60), riconciliazione dei simboli di Tesseract con i glifi REALI, tipo di parentesi stampata dai pixel (+ test) |
| `client/src/lib/bench/` | **BANCO DI PROVA** (mano col modello reale in Node, foto con Tesseract reale): NON fa parte dell'app, serve a misurare prima/dopo; requisito esterno `@napi-rs/canvas` (GUIDA-IA §20) |
| `client/src/pages/EspressioniExercises.tsx` | Pagina studente: 5 box guidati + caso diretto «Inserisco il risultato finale», PDF, mappa |
| `client/src/lib/mappaPdf.ts` | Mappa concettuale PDF (Parte A svolta + Parte B da completare) |
| `client/src/lib/pdf.ts` | Quaderno PDF dei passaggi |
| `client/src/pages/WelcomePage.tsx` | Prima pagina (dati studente, titolo) |
| `client/src/index.css` | Tema, palette, stili accessibilità; importa `photo-crop.css` dopo Tailwind |
| `client/src/components/CropDialog.tsx` + `hooks/useCropDialogViewport.ts` | Clone fedele del kit 8731: modale, drag diretto senza icona, riquadro unico RUOTA/CHIUDI/RITAGLIA. NON ripristinare `modal={false}` per il crop; NON cambiare `confirm()`/`cropBox.ts` per il layout |
| `client/src/lib/heightSync.ts` | Conservare protocollo, token e anti-loop; durante `data-lf-crop-open` nessun invio, dopo `lf:crop-closed` rimisura |
| `cornice-dinamica/` | Cornice embed Blogger (dedicata, lite, universale) |

## Regole essenziali

1. **Mai toccare l'architettura**: si sostituiscono solo contenuti, testi e logica interna
   del motore (`espressioni.ts`). Vedi `ADATTARE.md`.
2. **Aritmetica esatta a frazioni**: mai float; nei risultati MAI decimali con la virgola —
   i valori non interi si mostrano SEMPRE come frazioni impilate (richiesta 27/9).
3. Ogni modifica al motore richiede **test verdi**: `(cd client && pnpm exec vitest run)`
   (738 passati / 28 saltati), poi `pnpm check` e `pnpm build`.
3-bis. **Resa delle divisioni (invariante, deciso con l'utente)**: divisioni sempre con i
   due punti ` : `; nel RICOPIA le divisioni numeriche NON esatte NON hanno il risultato
   (mai `2 : 12 = 1 : 6`); TUTTI i risultati non interi sono SOLO frazioni impilate, MAI
   decimali con la virgola (27/9); NO promemoria regola dei segni; l'ultima operazione non è
   mai un esercizio duplicato nel box 2 (caso diretto: box «3. Inserisco il risultato
   finale» con riquadro operazione ESSENZIALE). Dettagli in `GUIDA-IA.md` (invarianti 13–16).
3-ter. **Riconoscimento a mano (27/9, dettagli in `GUIDA-IA.md` §16)**: l'UGUALE «=» viene
   RIMOSSO dall'inchiostro e reinserito nel LaTeX per ANCORE (stessa tecnica di radici e 8);
   OGNI segno sintetico deve avere ≥ 6 punti (guardia `isStrokeMeaningful` di ink-on:
   MIN_TOTAL_POINTS = 6, altrimenti i pezzi di solo-segno danno «NESSUN PEZZO»); le barre
   piatte (w ≥ 14 e w > 2·h) non sono MAI puntini di « : »; ordine pipeline: dotSigns →
   FRAZIONE IMPILATA (`rewriteStackedFractions`, DOPO dotSigns: il «÷» somiglia a una
   frazione) → radici → 8 → uguale → meno → apici; la firma «8/9/0 isolato»
   (`eightOrNineFromInk`) vale SOLO per un glifo singolo: guardia MULTI-GRAFO (colonna
   verticale vuota interna → ≥ 2 glifi affiancati → null) e w/h ≤ 1,2 — altrimenti
   «27» nella finestra dei risultati veniva FORZATO a «8» sovrascrivendo il modello
   (GUIDA-IA §18);
   radici → 8 → uguale (per ultimo) → apici; apici: gap cluster 12 px, riferimento altezza =
   carattere più alto, omonimi z/a → 2 nel riconoscimento isolato; un 8 sfuggito alla
   geometria letto «\sqrt» dal modello viene riparato (`repairModelSqrt`: \sqrt spurio +
   glifo ad anello + nessuna radice geometrica → 8).
3-quinquies. **8 → √/θ e 9 → g/q (27/9-quater)**: `isCheckmark` rifiuta tratti chiusi o con
   autointersezioni (un 8 non diventa più un radicale falso); `eightOrNineFromInk` è la
   firma d'inchiostro 8/9/0 (profilo a 16 fette, campionamento denso, profilo grezzo);
   `repairModelNine(latex, verdict)` smista g/q/\theta con la firma; pezzo intero con
   firma «8» → LaTeX diretto «8» senza modello, prima di `extractSuperscripts`.
3-quater. **Moltiplicazione SEMPRE puntino (27/9-ter)**: mai «×»/«x» di moltiplicazione
   nel display — `\times`/`\bullet` → `\cdot` nell'hook e in `repairDivisionSigns`;
   «x» fra DUE CIFRE → `\cdot` (lookahead, copre 2x3x4); le «x» laterali (2x, x3,
   2x(3+1)) restano VARIABILI. `prettyExpression` mappa `\times`/`\cdot`/`\bullet` e
   `× ⋅ • ∗` → «·». In TS `"2 \times 3"` è «2 TAB imes 3»: nei test serve `\\times`.
3-sexies. **Riconoscimento (mano e foto): si MISURA prima di correggere (5–6/10, `GUIDA-IA.md` §20)**:
   ogni modifica a `squareBrackets`, `supScript`, `dotSigns`, `inkSigns`, `composeLatex`, `gapClose`,
   `ocr`, `ocrReconcile`, `printedBracket`, `glyphScale`, `imagePrep` si confronta col BANCO
   (`client/src/lib/bench/`): mano 88% (602/684 letture, modello reale) a cifre normali e 77% (524/684) a cifre
   PICCOLE (38 px, punti a pixel interi come il mouse), foto 89% sintetiche e 92% varianti reali,
   **0 peggiorate**. La foto produce SOLO il testo nel campo tastiera (mai calcolo automatico: il
   calcolo parte solo con «✓ CONFERMA E CALCOLA»). Nessuna variabile d'ambiente nel codice dell'app (override del banco: `globalThis.__…`
   o `vi.mock`). `client/public/__test` (foto/tratti di collaudo) non va MAI committata né pubblicata.
3-septies. **Parentesi a mano: tre invarianti (6/10, `GUIDA-IA.md` §20)**: (a) `finalizePiece` chiama
   `restoreSquareBrackets` con l'inchiostro INTERO (anche i tratti già estratti): ogni nuova
   decisione di `rewriteBrackets` (es. `promoteRoundOpeners`: una `{` debole letta tonda, chiusa da
   una `}` forte, è una graffa) va ripetuta in `detectBracketKinds`, altrimenti la parentesi appena
   estratta torna ri-tipata (`{5+1}` → `(5+1}`); (b) la regola quadra/tonda di `classifyProfile`
   (quadra se `hTick` ∨ [1 angolo ∧ uncino ≥ 0,12] ∨ [2 angoli ∧ uncino ≥ 0,08]) deriva da una
   cattura REALE del canvas: il browser tronca clientX/Y a interi e basta 1 px per far leggere `[` una
   `(` stretta; (c) i «piccoli segni» (puntini, `SMALL_REL` in `dotSigns.ts`) si misurano RELATIVAMENTE
   al tratto più alto, e un 8 richiede una vita con ≥ 2 attraversamenti (`rowCrossings`, `inkSigns.ts`):
   a cifre piccole una `3` non è un puntino e l'occhiello di una `b` non è un 8. Ogni correzione:
   test di regressione + confronto del banco a DUE scale (normale e H=38 interi), 0 peggiorate.
4. I monomi simili hanno **lo stesso colore** in tutti i passi, nella verifica e nei PDF.
5. Font **OpenDyslexic** ovunque; niente emoji nei testi studente; messaggi chiari e
   letterali (niente sottintesi).
6. Aggiornare i documenti (README, ACCESSIBILITÀ) a ogni misura nuova: le guide devono
   restare **coerenti con il codice attuale**.

4-ter. **CONTI SEMPRE CORRETTI (25/10)**: ogni modifica al motore DEVE passare `auditConti` senza violazioni gravi (test `conti-audit.test.ts`); una frazione impilata `fr:true` dentro le parentesi NON è mai un conto interattivo; la verifica IA (`/api/ai/verify-steps`) riceve SOLO passi visibili, MAI risposte attese né dati personali, e le sue correzioni valgono solo se `latexValue` le convalida; senza chiave IA l'app deve funzionare ESATTAMENTE come prima.
4-quater. **CHIAVE IA** (`EASY_PEASY_API_KEY`): vive SOLO nel `.env` (gitignored) e nel bundle SERVER via `scripts/sync-env.mjs` (`shared/env.generated.ts`, gitignored). MAI nel client, MAI nel repo, MAI stampata nei log o in chat; se esposta, consigliare la rotazione. Dopo un deploy IA verificare `POST /api/ai/parse-spoken` (non 503).

## Workflow standard

```
(cd client && pnpm exec vitest run) && pnpm check && pnpm build && pnpm start   # verifica locale
webdev_deploy (preview) → verifica → conferma utente → produzione
```

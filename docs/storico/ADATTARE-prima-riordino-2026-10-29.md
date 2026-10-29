# 🔀 ADATTARE — Creare varianti dell'app

Scopo: creare una **NUOVA app identica** a questa ma con contenuto diverso.

**Regola d'oro: NON riscrivere mai l'architettura.**

Prima di progettare la variante, leggi **[`FILOSOFIA-DSA.md`](FILOSOFIA-DSA.md)**:
i 12 principi (segmento minimo, mai la soluzione, frazioni impilate, feedback
rosso fisso, accessibilità, «l'IA propone il motore dispone»…) valgono per
QUALSIASI variante e vanno mantenuti tutti. Si sostituiscono solo stringhe,
configurazioni e la logica matematica interna del motore; UI, input a scrittura a mano,
PDF, accessibilità e cornice embed restano invariati.

## Dove vive il contenuto

| Cosa | File |
|------|------|
| **Motore matematico** (parser, passi, riduzione, verifica) | `client/src/lib/espressioni.ts` + test `espressioni.test.ts` |
| **Testi dei passi e struttura dell'UI** | `client/src/pages/EspressioniExercises.tsx` |
| **Mappa concettuale PDF** (Parte A + Parte B) | `client/src/lib/mappaPdf.ts` |
| **Quaderno PDF** dei passaggi | `client/src/lib/pdf.ts` |
| **Titolo e testi prima pagina** | `client/src/pages/WelcomePage.tsx`, `client/index.html` |
| **Palette / colori** | `client/src/index.css` (variabili tema) |
| **Embed Blogger** | `cornice-dinamica/embed-espressioni-dedicata.html` (campo `APP_URL`) |

## Varianti possibili

| Variante | Cosa cambia | Come |
|----------|-------------|------|
| **A — Altre tipologie di espressioni** (potenze, doppie parentesi, frazioni) | casi gestiti dal motore | estendi `analyzeExpression` in `espressioni.ts` aggiungendo ramificazioni e test; i passi in UI si adattano da soli |
| **B — Esercizi guidati diversi** (es. valore assoluto, distributiva) | passi 2–4 | modifica i `kind` dei passi nel motore e la loro resa in `EspressioniExercises.tsx` + `mappaPdf.ts` |
| **C — Lingua** (inglese, spagnolo, francese) | testi UI + voce TTS + formato numeri | traduci le stringhe in `EspressioniExercises.tsx`, `WelcomePage.tsx`, `mappaPdf.ts`, `pdf.ts`; TTS auto-lingua in `useReadAloud.ts` |
| **D — Grafica** | colori, titolo, footer | solo `index.css` + `WelcomePage.tsx` + cornice embed |

## Trasformare l'app in un widget per EQUAZIONI, DISEQUAZIONI o FRATTE

Questa app appartiene alla **famiglia Widget Matematico** (stessa base di
`EQUAZIONI-DI-QUARTO-GRADO-BIQUADRATICHE`). Per creare la variante «risolvi
l'equazione» si cambia **cosa viene risolto**, non l'architettura:

| Variante | Cosa cambia | Dove |
|----------|-------------|------|
| **E1 — Equazioni di qualunque grado** (grado 2, 4, 6… via sostituzione `t = x^k`) | motore: riconoscimento del polinomio, sostituzione, risoluzione dell'equazione in `t`, ritorno a `x`; passi guidati; testi | nuovo motore in `client/src/lib/` (con test Vitest) + passi in `EspressioniExercises.tsx` + `mappaPdf.ts`; UI, canvas ONNX, PDF e accessibilità invariati |
| **E2 — Disequazioni di qualunque grado** | come E1 + **studio del segno** e rappresentazione dell'insieme soluzione (linea dei numeri già presente nel PDF) | come E1; la linea dei numeri di `mappaPdf.ts` mostra l'insieme soluzione |
| **E3 — Equazioni/disequazioni fratte** | come E1/E2 + dominio (condizione `denominatore ≠ 0`), mcm dei denominatori, controllo delle soluzioni ammissibili | come E1; aggiungere il passo «condizioni di esistenza» prima della risoluzione |

Il riferimento per i passi delle equazioni è l'app sorgente della famiglia:
https://github.com/andreakeating1982/EQUAZIONI-DI-QUARTO-GRADO-BIQUADRATICHE
(riusa la sua struttura a passi e la sua mappa del grado). Regola invariata:
**tutta la matematica vive in un modulo con test** (`espressioni.test.ts` →
per esempio `equazioni.test.ts`); `(cd client && pnpm exec vitest run)` deve restare verde (NON esiste uno script `pnpm test`).

➡️ **Guida dedicata all'IA**: **[`ESPORTA-PAGINE-1-2-EQUAZIONI.md`](ESPORTA-PAGINE-1-2-EQUAZIONI.md)**
— procedura completa per creare la NUOVA app equazioni/disequazioni riusando IDENTICHE la
pagina 1 (benvenuto con dati studente) e la pagina 2 (input a pezzi mano/audio/tastiera)
di questa app, con la spec del motore equazioni al §4 e il workflow al §5.

## F — Trapiantare la sezione «trascrizione audio e con tastiera» su un'altra app simile (24/10/2026)

Questa sezione (microfono + box 1 letterario + box 2 matematico + regole tastiera +
pulsanti istruzioni + campo DIGITA IL VALORE) è **autonoma e trapiantabile** su
qualunque app didattica con input matematico. File da copiare (percorsi identici
nello scaffold `web-db-user`/`web-static` + tRPC/Drizzle):

| # | File | Ruolo nel trapianto |
|---|------|---------------------|
| 1 | `client/src/hooks/useRecorder.ts` | Microfono: MediaRecorder → WAV 16 kHz → `POST /api/ai/audio`; auto-stop 20 s con `autoResult` (accoda da solo, anti-duplicati via ref nella pagina) — copiare **intatto** |
| 2 | `server/audio.ts` | Server: trascrizione IA + conversione in notazione (MAI calcolare) — copiare **intatto**, adattare solo i prompt al dominio |
| 3 | `server/index.ts` (rotte `/api/ai/*`) | Rotte `audio`, `parse-spoken`, `transcribe` + chiave cotta via `shared/env.generated.ts` — copiare le **sole rotte** |
| 4 | `scripts/sync-env.mjs` + `shared/env.generated.ts` | Chiave `EASY_PEASY_API_KEY` nel solo bundle server (MAI nel browser) — copiare **intatti** |
| 5 | `client/src/lib/keyboardNotation.ts` | Le 5 regole (`:` `*` `/` `^n` `rad2/3/4`) + live + display + sanificatore LaTeX — copiare **intatto** |
| 6 | `client/src/lib/audioNotation.ts` | Normalizzazione notazione audio — copiare **intatto** |
| 7 | `client/src/components/NumberInputCanvas.tsx` | Campo DIGITA IL VALORE con `normalizeTypedValueNotation` + pulsante istruzioni — copiare, adattare solo la validazione del dominio |
| 8 | Blocco pannello in `EspressioniExercises.tsx` | Zona microfono + box 1 + box 2 + stati (`audioPanelOpen`, `spokenText`, `audioNotation`, `legendOpen`, `editorLegendOpen`, `seenAutoRef`, `accodaRisultatoMicrofono`) — **estrarre come componente** `AudioKeyboardPanel.tsx` passando `onConfirm(notazione)` |
| 9 | Test `keyboardNotation.test.ts`, `audioNotation.test.ts`, `typedValueNotation.test.ts` | Copiare per tenere la suite verde |

**Passi del trapianto:**

1. Copia i file 1–6 e i test 9 nell'app di destinazione (stessi percorsi).
2. Aggiungi le rotte `/api/ai/*` al server di destinazione (file 3) + `scripts/sync-env.mjs` (file 4); metti la chiave nel `.env` (MAI su git) ed esegui lo script.
3. Estrai il blocco pannello (file 8) come componente con prop `onConfirm(notazione)`: l'app di destinazione decide cosa farne (pezzo, campo, calcolo diretto).
4. Se serve il campo valore, copia il file 7 adattando `evaluateLatex` al dominio (o riusalo così com'è per valori numerici).
5. Aggiungi `allow="microphone"` all'iframe della cornice embed (altrimenti Chrome nega il microfono nel blog).
6. Verifica: `pnpm check` + `(cd client && pnpm exec vitest run)` verdi; in preview il pannello si apre; in produzione `POST /api/ai/parse-spoken {"spoken":"tre più cinque"}` → `{"notation":"3+5"}` HTTP 200.

**Cosa NON trapiantare:** il motore `espressioni.ts`, i 5 box, il PDF, `pieceCount.ts` (solo test/banco).

## E — Replicare l'app per SOLE equazioni (26/10/2026)

Procedura completa dedicata all'IA in **[`ADATTARE-EQUAZIONI.md`](ADATTARE-EQUAZIONI.md)**: riusa
trascrizione (mano/microfono/tastiera/FOTO), job+polling+cache+sessioni, terza pagina e PDF,
ma costruisce e verifica **equazioni invece di espressioni** (nuovo `costruisciPrompt` +
verifica a soluzioni in 4 vie; `=` accettato in input). Scenari: **1° grado** (2 box +
verifica), **2° grado** (coefficienti → Δ → x₁ → x₂ → verifica), **4° biquadratiche**
(`t = x²`, 6 box), **grado superiore** (`t = x^k`, radice k-esima, ± solo con k pari),
**disequazioni** (+ studio del segno e intervalli).

## G — Trapiantare il tool FOTO su un'altra app simile (26/10/2026)

Procedura completa dedicata all'IA in **[`TRAPIANTO-FOTO.md`](TRAPIANTO-FOTO.md)**: scatto
(`capture="environment"`) / caricamento → `normalizePhoto` → `CropDialog` free-box →
`POST /api/ai/transcribe` (IA vision che TRASCRIVE SOLO) → soccorso Tesseract → campo
controllato dall'utente. Tabella dei 9 file, blocco JSX da innestare con `onConfirm`,
adattamento di `AI_CONTRACT` al dominio, checklist.

## Checklist finale di ogni variante

- [ ] `(cd client && pnpm exec vitest run)` verde (test del motore aggiornati alla nuova materia).
- [ ] `pnpm check` + `pnpm build` senza errori.
- [ ] Titolo app, cornice embed (`APP_URL`, `lf-titolo`, commenti) aggiornati alla nuova app.
- [ ] Deploy preview verificato nel browser PRIMA della produzione (con conferma esplicita dell'utente).
- [ ] Le misure di `ACCESSIBILITA.md` restano tutte presenti (font, barra, TTS, ARIA).
- [ ] Le regole di resa delle divisioni e il flusso dei box restano come da invarianti
      (vedi `GUIDA-IA.md`, invarianti 13–22).

## Workflow rapido

1. Modifica SOLO i file indicati nella colonna «Come».
2. Aggiorna/estendi i test con Vitest (`(cd client && pnpm exec vitest run)`) — tutti verdi.
3. `pnpm check` + `pnpm build`.
4. Deploy preview → verifica nel browser → conferma esplicita dell'utente → produzione.

## Invarianti assoluti

- Font **OpenDyslexic** su tutta l'app, PDF e mappa inclusi.
- **Resa delle divisioni** (deciso con l'utente): sempre con i due punti ` : ` durante lo
  svolgimento; nel RICOPIA le divisioni numeriche NON esatte NON hanno il risultato (mai
  `2 : 12 = 1 : 6`); TUTTI i risultati non interi SOLO frazioni impilate, MAI decimali
  con la virgola (27/9).
- **Flusso dei box**: caso standard a 5 box; caso «operazione già finita» (es. `9 : 5`,
  `1 : (3 : 4)`) → SOLO box «3. Inserisco il risultato finale:» con riquadro operazione
  ESSENZIALE, senza box sotto; l'ultima operazione non è mai un esercizio duplicato nel box 2.
- **Nessun promemoria della «REGOLA DEI SEGNI»** (rimosso su richiesta).
- **Parentesi quadre e graffe NON si trasformano MAI in tonde**: `[ ]` e `{ }` scritti
  dallo studente restano tali in tutta l'app (tokenizer con tipo, `wrapParen` per stampa).
- **Divisioni non esatte**: il suggerimento di input dice SOLO «frazione impilata»;
  il risultato è SEMPRE frazione impilata (`fractionStepLatex`), mai decimale.
- Niente emoji nel testo studente; niente sottintesi nei messaggi.
- Palette calda (terracotta/crema) e header centrato; barra accessibilità a 6 moduli.
- Monomi simili **sempre** dello stesso colore tra passo 3, 4, 5, verifica e PDF.
- L'aritmetica è **esatta** (frazioni): mai decimali binari; nei risultati MAI decimali con
  la virgola — solo frazioni impilate. Se la variante ha davvero bisogno di decimali (es.
  app su numeri decimali), introduci una funzione dedicata in `espressioni.ts` e usala
  SOLO lì: non ripristinare i decimali nelle funzioni di resa esistenti.

Approfondimenti: **`GUIDA-IA.md`** e **`IMPLEMENTAZIONE-IA.md`**.

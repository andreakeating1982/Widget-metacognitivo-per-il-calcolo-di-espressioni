# 🧮 ADATTARE-EQUAZIONI — Replicare l'app per SOLE equazioni

> **Guida per l'intelligenza artificiale** — procedura completa per creare una
> NUOVA app che riusa QUESTA architettura (trascrizione → costruzione IA →
> svolgimento guidato → PDF) ma risolve **solo equazioni**: di 1° grado, di 2°
> grado, di 4° grado trinomie biquadratiche, e in generale di grado superiore al
> secondo. Leggi tutto il documento prima di toccare il codice.

## 1. Cosa riusare IDENTICO (non reinventare)

| Blocco | File nel repo | Riuso |
|---|---|---|
| Prima pagina (dati studente) | `client/src/pages/WelcomePage.tsx` | identica, cambia solo titolo/sottotitolo |
| Seconda pagina: pezzi a mano | `MathDrawCanvas`, `useMathRecognition`, `recognizePipeline.ts`, `recognizePiece.ts`, `supScript.ts`, `squareBrackets.ts`, `dotSigns.ts`, `inkSigns.ts`, `exprOcr.ts` | identici |
| Seconda pagina: microfono + tastiera | `hooks/useRecorder.ts`, `lib/keyboardNotation.ts`, `lib/audioNotation.ts`, pannello in `EspressioniExercises.tsx` | identici (vedi `ADATTARE.md` §F) |
| Seconda pagina: FOTO + ritaglio + IA vision | `lib/imagePrep.ts`, `lib/cropBox.ts`, `components/CropDialog.tsx`, `lib/aiTranscribe.ts`, `lib/ocr.ts`, route `POST /api/ai/transcribe` | identici (vedi `TRAPIANTO-FOTO.md`) |
| Job + polling + cache + sessioni | `server/costruisci.ts` (route, `chiaveCache`, `leggiCache`/`scriviCache`, tabella `sessioni_costruzioni`, `salvaStatoJob`/`leggiStatoJob`) | identici, cambia solo il contenuto costruito |
| Terza pagina: struttura | `client/src/pages/EsercizioFrazioni.tsx` (caricamento `?sid=`, `validaEsercizio`, rivelazione progressiva, PDF parziale/completo, avviso sessione scaduta) | identica, cambia il tipo di box |
| Chiave IA | `scripts/sync-env.mjs` + propria `EASY_PEASY_API_KEY` server | copiare lo script, NON `shared/env.generated.ts`; rigenerarlo nel nuovo ambiente |
| Accessibilità, cornice Blogger, font | `ACCESSIBILITA.md`, `cornice-dinamica/` | identici |

## 2. Cosa cambia: il CONTRATTO con l'IA

Il cuore dell'adattamento è **un nuovo prompt di costruzione** + **una nuova
verifica**. Sostituisci in `server/costruisci.ts`:

- `costruisciPrompt()`: chiedi lo SVOLGIMENTO GUIDATO dell'equazione (vedi §3
  per il contratto JSON e i passi per grado).
- `verifica()` + `contoGiusto()`: verifica che ogni passo conservi l'INSIEME
  DELLE SOLUZIONI (non il valore dell'espressione). Le 4 vie diventano:
  1. **numerico**: il passo è un conto tra numeri (es. `Δ = b²−4ac`) → `latexValue` uguali;
  2. **simbolico**: il passo riscrive l'equazione (es. trasporto) → i due membri spostati a sinistra danno polinomi uguali (`polyEquals` su `parsePolyLoose`);
  3. **sostituzione**: la soluzione dichiarata VERIFICA l'equazione originale (sostituisci x e valuta con `substituteAndEvaluate`: deve dare 0=0);
  4. **formula**: il passo applica una formula (es. `x₁ = (−b+√Δ)/(2a)`) → ricalcola la formula dal motore e confronta.
- `EsercizioAI`: tieni la stessa forma (`espressioneLatex` = l'equazione intera
  con `=`; `sezioni[].boxes[]` con `op/prompt/extraLatex/answerLatex/simbolico`;
  `righeProgressive` = equazione riscritta passo-passo; `risultatoFinaleLatex` =
  le soluzioni, es. `x_1 = 2,\ x_2 = 3`).

Regole del prompt che RESTANO: JSON compatto senza spazi inutili, ogni box UN
solo calcolo, `prompt` = metodo mai risultato, max 3 tentativi con problemi
ritornati all'IA, timeout 120 s, pause 5 s/3 s.

## 3. Passi guidati per grado (contratto da chiedere all'IA)

### 3a. Equazioni di 1° GRADO (es. `3x − 5 = 4`)

2 box + verifica:

1. `3x = 4 + 5` → `3x = 9` (trasporto: prompt «Porto i termini noti a destra cambiando segno.»)
2. `x = 9 : 3` → `x = 3` (prompt «Divido per il coefficiente della x.»)
3. Verifica (box finale): `3·3 − 5 = 4` → `4 = 4 ✓` (lo studente sostituisce e calcola il primo membro).

### 3b. Equazioni di 2° GRADO (es. `x² − 5x + 6 = 0`)

5 box + verifica (riferimento famiglia: app in `/home/user/equazioni-secondo-grado`,
repo `EQUAZIONI-DI-QUARTO-GRADO-TRINOMIE-BIQUADRATICHE`):

1. Coefficienti: `a = 1, b = −5, c = 6` (prompt «Leggo i coefficienti dalla forma canonica.»)
2. `Δ = b² − 4ac` → `Δ = 1` (un solo conto)
3. `x₁ = (−b + √Δ) / (2a)` → `x₁ = 3`
4. `x₂ = (−b − √Δ) / (2a)` → `x₂ = 2`
5. Verifica: sostituire `x₁` e `x₂` nell'equazione originale (due micro-box o uno per soluzione).

`Δ < 0` → «nessuna soluzione reale» come nota col libro (pattern `ceAcked`).
Soluzioni ESATTE: frazioni impilate `\\dfrac`, radicali semplificati, MAI decimali.

### 3c. Equazioni di 4° GRADO TRINOMIE BIQUADRATICHE (es. `x⁴ − 5x² + 6 = 0`)

6 box con sostituzione `t = x²` (riferimento: `/home/user/equazioni-biquadratiche`):

1. `t = x²` → `t² − 5t + 6 = 0` (prompt «Sostituisco: con t = x² l'equazione diventa di 2° grado.»)
2. `Δ = 25 − 24` → `Δ = 1`
3. `t₁ = (5 + 1) / 2` → `t₁ = 3`
4. `t₂ = (5 − 1) / 2` → `t₂ = 2`
5. `x = ±√t₁` → `x₁ = √3, x₂ = −√3` (prompt «Torno alla x: ogni t positivo dà due x opposte.»)
6. `x = ±√t₂` → `x₃ = √2, x₄ = −√2` + verifica per sostituzione.

Se `t` è negativo → nessuna x da quel t (nota col libro, non errore).

### 3d. Grado SUPERIORE al secondo (regola `t = x^k`)

Generalizzazione della biquadratica per `a·x^(2k) + b·x^k + c = 0`:

- `k = 3` → grado 6 con `t = x³`; `k = 4` → grado 8 con `t = x⁴`.
- I box 1–4 sono IDENTICI al §3c (equazione in `t`).
- Box 5–6 (ritorno a x): `x = ∛t` / `x = ∜t`:
  - `k` DISPARI → una x per ogni t (`x = \\sqrt[3]{t}`);
  - `k` PARI → due x opposte per ogni t positivo (`x = ±\\sqrt[k]{t}`).
- La verifica per sostituzione chiude sempre (via 3 del §2).

Nel prompt IA aggiungi: «il grado in x è 2k; il ritorno a x usa la radice
k-esima; con k pari ogni t positivo dà ±, con k dispari una sola x».

### 3e. Disequazioni (estensione naturale)

Stessi box dell'equazione corrispondente + 2 passi finali:

1. Studio del segno (tabella o parabola, prompt dedicato).
2. Insieme soluzioni in notazione per intervalli + rappresentazione sulla retta.
3. ATTENZIONE al cambio di verso dividendo per un negativo (passo SEGNALATO:
   è l'errore classico; il feedback deve avere il caso «verso non cambiato»).

Dettagli su tabella dei segni e intervalli: `references/disequazioni.md`
della skill `widget-matematico-sorgente`.

## 4. Adattamenti OBBLIGATORI del codice esistente

1. **Convalida input** (`handleStartCompute` / `handleCostruisci`): l'app
   espressioni RIFIUTA `=`; la nuova app lo ACCETTA (esattamente un `=` per le
   equazioni; `< > ≤ ≥` per le disequazioni). Accetta anche `<=`, `>=` come
   alias tastiera.
2. **`EsercizioFrazioni.tsx` → rinomina** (es. `EsercizioEquazioni.tsx`): i box
   soluzione si verificano per SOSTITUZIONE (via 3); i box formula si
   ricalcolano dal motore. Il PDF resta identico nella struttura (righe
   progressive = equazione riscritta; finale = soluzioni in marrone).
3. **Titolo e testi**: `WIDGET METACOGNITIVO PER LO SVOLGIMENTO DI EQUAZIONI`
   (o DISEQUAZIONI); `index.html`, WelcomePage, header pagina 2, messaggi
   d'errore («espressione» → «equazione»).
4. **Cache**: `chiaveCache` funziona così com'è (AST normalizzato; `=` già
   gestito dal parser come equazione a due membri? in caso contrario usa il
   fallback stringa — documenta la scelta).
5. **Tabelle DB**: riusa `cache_costruzioni` e `sessioni_costruzioni` così come
   sono (stesso schema, contenuto diverso).

## 5. Workflow per l'agente IA (ordine esatto)

1. Copia il repo (o estrai lo ZIP) nella nuova cartella; cambia i TESTI
   (punto 3 del §4) e la convalida di `=` (punto 1 del §4).
2. Riscrivi `costruisciPrompt()` + `verifica()`/`contoGiusto()` secondo §2–§3
   per il grado scelto (3a/3b/3c/3d, +3e se disequazioni).
3. Adatta la terza pagina (§4 punto 2); rinomina il componente.
4. Verifica: `corepack enable && pnpm install --frozen-lockfile && pnpm check && pnpm build`.
5. Collauda nel browser UN'equazione del grado scelto + la verifica finale +
   SCARICA PDF (righe progressive = equazione riscritta, finale marrone).
6. Scrivi le guide (`REBUILD.md`, `ADATTARE.md`, `RENDER.md`,
   `ACCESSIBILITA.md`, `AGENTS.md`) e genera lo ZIP come da skill
   `zip-esportabile-guide-ia`.

## 5-bis. Regole-candeggio apprese sul campo (26/10, NON saltare)

1. **Trascrizione foto MAI troncata**: `POST /api/ai/transcribe` con
   `max_tokens: 4000` (300 troncava le espressioni lunghe a metà!) + regola
   «mai interrompere a metà, parentesi bilanciate» nel contratto.
2. **SCARICA PDF dallo svolgimento VERO**: `scaricaPdf` deve dipendere da
   `[esercizio, testi, tuttiBox, valori]` (dipendenze MAI vuote: la chiusura
   stampava il default anche dopo il caricamento della sessione dello
   studente). Collaudare ricostruendo un'espressione lunga e verificando
   che finale e righe della sessione siano quelli giusti, senza tracce del
   default.
3. **Pulsanti identici**: stesso colore (`bg-primary`), stessa ampiezza
   (`w-full` in contenitori `max-w-md`) e centrati (`mx-auto`).

## 6. Checklist finale

- [ ] Pagina 1 identica (salvo titolo): layout, colori, font, params URL.
- [ ] Input identico: mano, microfono+tastiera, FOTO+ritaglio (vedi `TRAPIANTO-FOTO.md`).
- [ ] Un percorso di box per il grado scelto (§3a–§3d; +§3e se disequazioni).
- [ ] Verifica in 4 vie (§2): nessun conto sbagliato arriva allo studente.
- [ ] `=` accettato (equazioni) / `< > ≤ ≥` (disequazioni); alias `<=` `>=`.
- [ ] Soluzioni esatte impilate, MAI decimali; `Δ<0` → nota col libro.
- [ ] Ultimo passo SEMPRE verifica per sostituzione.
- [ ] SCARICA PDF solo a completamento; sessione `sid` personale.
- [ ] `pnpm check` + `pnpm build` verdi; collaudo browser completo.
- [ ] Chiave IA solo lato server (`grep` nel `dist/public` = 0 occorrenze).

# ESPORTAZIONE DELLE PAGINE 1 E 2 IN UNA NUOVA APP PER EQUAZIONI E DISEQUAZIONI

> **Guida per l'intelligenza artificiale** — questo documento consente a un agente IA di
> creare una NUOVA app (risoluzione guidata di **equazioni e disequazioni**) riutilizzando
> ESATTAMENTE la **prima pagina** (schermata di benvenuto con dati studente) e la
> **seconda pagina** (fase di input: trascrizione a pezzi a mano, audio e tastiera) di
> questa app, sostituendo SOLO la fase successiva di svolgimento con il motore delle
> equazioni/disequazioni descritto al §4. Leggi tutto il documento prima di toccare il codice.

**Aggiornamento autorevole 8744:** leggere prima `ADATTARE.md` e `REBUILD.md`.
Questa è una specifica di variante, non un motore generico già implementato.
Il flusso corrente è pagina dati → `/espressione` (input, foto comprese)
→ costruzione IA → `/esercizio` (`EsercizioFrazioni.tsx`, sessione `sid`, PDF).
Conservare wrapper/scroll della seconda pagina, header 8744 e cropper modale.
Le descrizioni datate dei box locali più sotto non sostituiscono questo flusso.

---

## 1. Cos'è la pagina 1 e la pagina 2 di questa app

| Pagina | File | Componente | Funzione |
|---|---|---|---|
| **Pagina 1** | `client/src/pages/WelcomePage.tsx` (~133 righe) | `WelcomePage` | Card di benvenuto: icona libro, titolo, sottotitolo, campi **Cognome / Nome / Data (precompilata a oggi gg/mm/aaaa) / Classe**, pulsante **ENTRA** che naviga a `/espressione?cognome=…&nome=…&data=…&classe=…` (disabilitato finché cognome e nome sono vuoti) |
| **Pagina 2** | `client/src/pages/EspressioniExercises.tsx` | `EspressioniExercises` | Fase di **INPUT** (trascrizione dell'espressione) seguita dalla fase di **SVOLGIMENTO** (i box guidati). Per la nuova app la fase INPUT si copia IDENTICA; solo la fase di svolgimento cambia (§4) |

La barra di accessibilità globale (`client/src/components/AccessibilityToolbar.tsx`,
hook `client/src/hooks/useReadAloud.ts`) e il routing (`client/src/App.tsx`:
`/` → WelcomePage, `/espressione` → EspressioniExercises,
`/esercizio` → EsercizioFrazioni) sono trasversali e si riutilizzano cosi.

### Pagina 1 — invarianti da NON modificare

- Classe `lf-welcome-top` su `<html>` **solo fuori dall'iframe** (`window.self === window.top`):
  rende bianco il fondo sotto la card quando la pagina è vista da sola; dentro la cornice
  Blogger è il `heightSync` (`client/src/lib/heightSync.ts`) a comunicare l'altezza reale.
- Card: sfondo `#FAF8F5`, bordo `#E5E0D8`, bordi input `#D6CEC4`, focus `#D4B2A0`,
  accento rosso-bruno `#8B3A1A`, icon box `#F0E5DF`; angoli `rounded-[10px]`/`[20px]`;
  larghezza `max-w-[400px]`.
- Font `font-[OpenDyslexic,Cambria,Georgia,serif]` su OGNI input (OpenDyslexic auto-ospitato
  in `client/public/fonts`, dichiarato in `client/src/index.css` — vedi `ACCESSIBILITA.md`).
- Data di default: `getOggi()` = `gg/mm/aaaa` di oggi, non modificabile in automatico.
- La pagina deve TERMINARE subito sotto la card (niente spazi vuoti sotto).

**Unica modifica ammessa nella pagina 1** (testi): il titolo `WIDGET METACOGNITIVO…ESPRESSIONI`
e il sottotitolo `RISOLVI ESPRESSIONI PASSO DOPO PASSO` diventano per la nuova app, ad esempio,
`WIDGET METACOGNITIVO PER LO SVOLGIMENTO DI EQUAZIONI E DISEQUAZIONI` e
`RISOLVI EQUAZIONI E DISEQUAZIONI PASSO DOPO PASSO` (mantieni la stessa struttura
`<br/>` e le classi). Il pulsante resta `ENTRA`.

### Pagina 2 — fase di INPUT da copiare IDENTICA

Tutto ciò che sta PRIMA di `✓ CONFERMA E CALCOLA` (`handleStartCompute`) va riutilizzato cosi:

1. **Trascrizione a pezzi**: finestra di scrittura a mano (`client/src/components/MathDrawCanvas.tsx`)
   con riconoscimento ONNX completo (`client/src/lib/recognizePipeline.ts` + `recognizePiece.ts`,
   `dotSigns.ts`, `inkSigns.ts` — uguale, radice, 8, frazioni impilate, —, `+` —,
   `squareBrackets.ts` — quadre/graffe —, `supScript.ts` — esponenti —, `gapClose.ts`,
   `composeLatex.ts`, `exprOcr.ts`); ogni pezzo è correggibile con **✎** (campo con le regole
   tastiera di `keyboardNotation.ts`, live mentre si digita) e eliminabile con **✕**.
2. **Pannello `🎤⌨ TRASCRIZIONE AUDIO E CON TASTIERA`** (stato `audioPanelOpen`): quando è aperto
   nasconde finestra a mano, riga guida, lista pezzi, errori e riquadro CONTROLLA; contiene
   **box 1 · TRASCRIZIONE LETTERARIA** (hook `client/src/hooks/useRecorder.ts`: registrazione,
   auto-stop 20 s con accodamento automatico, `POST /api/ai/parse-spoken` → `{notation}`,
   testo parlato correggibile, ✨ RIANALIZZA CON IA, CANCELLA E RICOMINCIA) e
   **box 2 · TRASCRIZIONE MATEMATICA** (notazione lineare resa, campo textarea ridimensionabile
   con `normalizeKeyboardDisplayLive`, legenda tastiera dietro pulsante `▸ ISTRUZIONI PER
   SCRIVERE DA TASTIERA`, `✓ AGGIUNGI COME PEZZO`, COPIA NOTAZIONE, SVUOTA, e conferma
   DIRETTA dal pannello via `panelConfirmRef`).
3. **Riquadro `CONTROLLA PRIMA DI CONFERMARE`** (`transDisplay` a 3 livelli: analisi diretta →
   pulizia `normalizeExpressionOcr(…, true)` → ultima spiaggia testo), con `transRef.scrollIntoView`.
4. **`✓ CONFERMA E CALCOLA`** → valida e passa alla fase di svolgimento.
   ⚠️ In questa app rifiuta il `=`: per la nuova app va adattato (§4, punto 3).

Chiave IA: `scripts/sync-env.mjs` copia `EASY_PEASY_API_KEY` da `.env` in
`shared/env.generated.ts` (SOLO lato server, mai nel bundle browser). Senza chiave le rotte
`/api/ai/*` rispondono 503: UI/mano/crop sono disponibili, ma la costruzione IA
dell'esercizio richiede una chiave propria. NON copiarne una dalla sorgente.

---

## 2. Cosa copiare, in pratica

Da questa repo verso la nuova app (stesso scaffold web-db-user), copia i file COSÌ COME SONO:

```
client/src/App.tsx, client/src/pages/WelcomePage.tsx, client/src/pages/EspressioniExercises.tsx
client/src/components/  → MathDrawCanvas, AccessibilityToolbar, NumberInputCanvas, FractionDisplay,
                          ErrorBoundary, components/ui/* (shadcn)
client/src/hooks/       → useRecorder, useReadAloud, useMathRecognition, heightSync (se lì)
client/src/lib/         → espressioni.ts (parser + motore, resta il LEXER/paper di base),
                          keyboardNotation, recognizePipeline, recognizePiece, composeLatex,
                          gapClose, dotSigns, inkSigns, squareBrackets, supScript, exprOcr,
                          ocrGeometry, ocrReconcile, glyphScale, fracDots, pieceCount, aiClean,
                          aiTranscribe, bench/ (banco di prova del riconoscimento)
client/src/index.css, client/public/fonts/* (OpenDyslexic WOFF2), index.html (titolo)
server/index.ts (sole rotte pertinenti /api/ai/*; integrare nella destinazione),
shared/env.generated.ts NON si copia: viene rigenerato da sync-env.mjs,
scripts/sync-env.mjs, .env.example, package.json, pnpm-lock.yaml, patches/
```

Nel nuovo repo poi: `README.md`, `REBUILD.md`, `ADATTARE.md`, `RENDER.md`, `ACCESSIBILITA.md`,
`AGENTS.md`, `render.yaml` seguendo la skill `zip-esportabile-guide-ia` (stessa struttura
della presente repo).

---

## 3. Motore e filosofia del svolgimento (DSA) — la parte che CAMBIA

La filosofia didattica è IDENTICA a questa app e va mantenuta pedissequamente:

- **Segmenti minimi**: ogni passo mostra UN solo calcolo; il calcolo che l'IA non deve
  fare mai è quello dello studente → il `detail` di un passo mostra «operazione = risultato»
  SOLO se il passo è interattivo, altrimenti SOLO l'operazione.
- **Input dello studente**: potenze/divisioni con lettere → `TypedResultInput` con
  `answerPoly` + `errorHint` (feedback per TIPO di sbaglio: segno, reciproco, coefficienti,
  esponenti, valore — MAI il risultato; dal 2º tentativo aggiunge il promemoria della
  proprietà, funzione `errorHint` in `espressioni.ts`); numerici → `NumberInputCanvas`
  con notazione tastiera (`6:3`, `2^3`, `rad29`, `8/3`).
- **Rivelazione progressiva**: il passo N+1 si vede solo dopo la convalida del passo N
  (stessa logica `doneCount` / `firstOpenIdx`).
- **Resa**: frazioni SEMPRE impilate `\\dfrac` (MAI decimali con la virgola, MAI «a : b»
  per risultati risolti), moltiplicazione con `\\cdot`, parentesi col tipo scritto dall'utente.
- **RISULTATO FINALE in marrone** nell'ultimo passaggio; **SCARICA PDF** visibile SOLO a
  esercizio completato e corretto (PDF = cattura DOM `.notebook-content` con `window.print`).
- **Audit di progressività**: ogni passo deve avere un input o una nota «col libro»;
  segna l'audit (`auditProgressivita`) se introdurre un passo senza input.

### Se il testo contiene `=` (equazione) o il tipo è disequazione

Per le **equazioni** la consegna sceltasi in questa famiglia di app: se l'utente scrive
`espressione = 0` si calcola SOLO il primo membro (il `=` e la parte destra si ignorano,
niente equazione); solo un input veramente a due membri (es. `2x+3=7`) apre il percorso
equazioni. Per la **nuova app** il perimetro è l'OPPOSTO: equazioni e disequazioni sono
l'oggetto dell'app (§4).

---

## 4. Spec del motore EQUAZIONI E DISEQUAZIONI per la nuova app

Crea `client/src/lib/equazioni.ts` + `client/src/components/EquazioniExercise.tsx`
e nel memo `analysis` di pagina 2 devia al componente equazioni quando l'input è
un'equazione/disequazione (riconoscimento AUTOMATICO, nessuna scelta manuale).

### 4a. Riconoscimento (`sembraEquazione`)

- C'è esattamente UN `=` → equazione a due membri; c'è `< > ≤ ≥` → disequazione.
- `toFormaCanonica`: tutto a sinistra (sottrazione polinomi, usa `polySub` di `espressioni.ts`).
- `classifica` per grado/struttura: 1º grado · 2º grado · biquadratica (`t = x²`) · grado 6
  (`t = x³`) · cubica (Ruffini) · raccoglimento · disequazione 1º/2º grado · non supportata
  (motivo ONESTO mostrato allo studente, mai silenzio).
- Numeri e segni: usa il parser di `espressioni.ts`; MAI decimali con la virgola.

### 4b. Passi guidati per tipo (come nei widget equazioni di questa famiglia)

- **1º grado** (es. `3x−5=4`): 2 passi — trascrivo/reduco → isolo la x → verifico sostituendo.
- **2º grado** (es. `x²−5x+6=0`): 5 passi — coefficienti `a, b, c` → `Δ = b²−4ac` →
  `x₁ = (−b+√Δ)/(2a)` → `x₂ = (−b−√Δ)/(2a)` → **verifica** `P(x₁)=0`.
- **Biquadratica / grado 6** (es. `x⁴−5x²+6=0`): 6 passi con `t = x²` (o `t = x³`).
- **Cubica**: fattorizzazione Ruffini passo-passo; **raccoglimento** quando il grado > 2
  è fattorizzabile a vista.
- **Disequazioni**: forma canonica → studio del segno (tabella/parabola) → insieme delle
  soluzioni con notazione per intervalli E rappresentazione sulla retta; ATTENZIONE al
  cambio di verso quando si divide per un negativo (passo SEGNALATO, è l'errore classico:
  il feedback `errorHint` deve avere il caso «verso non cambiato»).
- Soluzioni ESATTE: frazioni impilate `\\dfrac`, radicali semplificati (√24/6 → √6/3),
  MAI decimali. `Δ < 0` → «nessuna soluzione reale» come nota col libro (pulsante
  `✓ HO RICAVATO QUESTA CONDIZIONE (COL LIBRO)`, pattern `ceAcked` di questa app).
- Lettura della risposta: `leggiRispostaStudente` accetta decimale (virgola/punto),
  frazione (`3/2`, `1⁄2`), radici (√2, `2√3/3`) e per le disequazioni anche notazioni
  `x>2`, `2<x<5` — confronto a VALORE (come `polyEquals`/`evaluateLatex`), mai a stringa.

### 4c. Verifica finale

L'ultimo passo è SEMPRE la verifica della soluzione nell'equazione originale
(sostituzione guidata, lo studente scrive il valore del primo membro = 0 ✓).
Per le disequazioni: controllo con un valore di prova della soluzione trovata.

---

## 5. Workflow per l'agente IA (ordine esatto)

1. Clona questa repo (o estrai lo ZIP) e crea la nuova app con i file del §2.
2. Cambia i soli TESTI della pagina 1 (titolo/sottotitolo) e i titoli della pagina 2
   (`index.html`, header, messaggi d'errore: «espressione» → «equazione o disequazione»).
3. Adatta la convalida di `✓ CONFERMA E CALCOLA`: accetta anche `=`, `<`, `>`, `≤`, `≥`
   (in `handleStartCompute`), e nel memo `analysis` devia a `EquazioniExercise`.
4. Implementa `lib/equazioni.ts` (§4a-4b) con i SUOI test vitest (un file
   `equazioni.test.ts`: un caso per tipo, compreso `Δ<0` e la disequazione col cambio di verso).
5. Implementa `components/EquazioniExercise.tsx` riusando `TypedResultInput`,
   `NumberInputCanvas`, la logica di rivelazione progressiva e `RISULTATO FINALE` marrone.
6. Verifica: `corepack enable && pnpm install --frozen-lockfile && pnpm check && pnpm build`
   + suite vitest verde + collaudo nel browser di UN'equazione di ogni tipo.
7. Scrivi le guide (`REBUILD.md`, `ADATTARE.md`, `RENDER.md`, `ACCESSIBILITA.md`, `AGENTS.md`)
   e genera lo ZIP esportabile come da skill `zip-esportabile-guide-ia`.

## 6. Checklist finale

- [ ] Pagina 1 IDENTICA (salvo titolo/sottotitolo): layout, colori, font, `lf-welcome-top`, params URL.
- [ ] Fase di input IDENTICA: pezzi a mano con riconoscimento ONNX, ✎ con regole tastiera,
      pannello audio+tastiera con conferma diretta, riquadro CONTROLLA, mai calcolo automatico.
- [ ] Barra di accessibilità, OpenDyslexic, ARIA, heightSync e cornice Blogger funzionanti.
- [ ] Motore equazioni/disequazioni: un percorso per tipo, soluzioni esatte impilate, verifica finale.
- [ ] Feedback `errorHint` senza svelare mai il risultato; audit di progressività pulito.
- [ ] SCARICA PDF solo a completamento; PDF fedele al RICOPIA.
- [ ] `pnpm check` + `pnpm build` + suite verdi; collaudo browser di ogni tipo.
- [ ] Chiave IA solo lato server (`grep` nel `dist/public` = 0 occorrenze).

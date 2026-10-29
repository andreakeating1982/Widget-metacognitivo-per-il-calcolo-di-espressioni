# 🤖 GUIDA-IA — Ricostruzione e variazione del "Widget Matematico Sorgente"

> ⚠️ **NOTA DI ALLINEAMENTO (settembre 2026)**: questa guida è stata ereditata dalla
> famiglia di app «Widget Matematico». L'argomento di QUESTA app sono le **espressioni
> letterali, monomi e polinomi**: dove la guida parla di equazioni, grado, Δ, t = x^k,
> leggi «espressione», «gruppi di monomi simili», «somma dei coefficienti» ecc. I
> riferimenti a `docs/grado.md`, `docs/disequazioni.md`, `docs/fratte.md`, `docs/quiz.md`
> e `scripts/clone_app.py` NON esistono più: per le varianti vedi `ADATTARE.md`. Il motore
> matematico è `client/src/lib/espressioni.ts` (+ test), la pagina studente
> `client/src/pages/EspressioniExercises.tsx`, la mappa PDF `client/src/lib/mappaPdf.ts`.

> **Documento operativo per un'Intelligenza Artificiale** (MARKY su Easy-Peasy.AI,
> GitHub Copilot, Claude, ChatGPT, ecc.) o per uno sviluppatore, per **ricostruire**,
> **clonare** e **variare** questa app partendo dalla repository GitHub.
>
> **App**: ESPRESSIONI LETTERALI, MONOMI E POLINOMI (già "Espressioni Letterali, Monomi e Polinomi")
> **Stack**: Vite + React 19 + TypeScript + TailwindCSS 4 + shadcn/ui + KaTeX + ONNX (ink-on)
> **Nessun backend, nessun database**: tutta la logica (generazione equazione, passi,
> verifica, PDF) è lato client. Il server Express serve solo i file statici.
>
> **Documenti canonici** (lettura rapida): [`AGENTS.md`](AGENTS.md) (indice),
> [`REBUILD.md`](REBUILD.md) (ricostruire identica), [`ADATTARE.md`](ADATTARE.md)
> (creare varianti), [`RENDER.md`](RENDER.md) (deploy Render),
> [`ACCESSIBILITA.md`](ACCESSIBILITA.md) (accessibilità). Questo documento è
> l'approfondimento completo.

---

## INDICE

1. [Che cos'è l'app](#1-che-cosè-lapp)
2. [Architettura e file critici](#2-architettura-e-file-critici)
3. [Ricostruire l'app da GitHub](#3-ricostruire-lapp-da-github)
4. [Variante A — cambiare il grado dell'equazione](#4-variante-a--cambiare-il-grado-dellequazione)
5. [Variante B — disequazioni di qualsiasi grado](#5-variante-b--disequazioni-di-qualsiasi-grado)
6. [Variante C — equazioni/disequazioni fratte](#6-variante-c--equazionidisequazioni-fratte)
7. [Variante D — cambiare la lingua (inglese, spagnolo, francese)](#7-variante-d--cambiare-la-lingua-inglese-spagnolo-francese)
8. [Variante E — quiz con set di domande](#8-variante-e--quiz-con-set-di-domande)
9. [Build, verifica e deploy](#9-build-verifica-e-deploy)
10. [Trasferimento su Render (via GitHub)](#10-trasferimento-su-render-via-github)
11. [ACCESSIBILITÀ (sezione portabile)](#11-accessibilità-sezione-portabile)
12. [Regole d'oro](#12-regole-doro)
13. [Cornice dinamica (embed per il blog)](#13-cornice-dinamica-embed-per-il-blog)
14. [Sezione IA dedicata — foto, mappe concettuali, tremolio](#14-sezione-ia-dedicata--foto-mappe-concettuali-tremolio)
15. [Quaderno «Matematica Facile» (PDF 5 anni)](#15-quaderno-matematica-facile-pdf-5-anni)
16. [Riconoscimento a mano 27/9 — uguale, 8, apici](#16-riconoscimento-a-mano-279--uguale-8-apici)

---

## 1. Che cos'è l'app

L'app guida uno studente nella risoluzione di un'**equazione trinomia** della forma

```
a · x^(2k) + b · x^k + c = 0
```

con sostituzione **`t = x^k`**, che riduce tutto a una quadratica `a·t² + b·t + c = 0`.

Il **grado** dell'equazione in `x` è **2k**. La sorgente attuale è **k = 2 → grado 4**
(biquadratica: `ax⁴ + bx² + c = 0`).

Il flusso didattico è in **7 passi**, con input tramite **canvas di scrittura a mano**
(riconoscimento ONNX via ink-on) e un box **"RICOPIA SUL QUADERNO"** per ogni passo, più
un **PDF scaricabile** al termine:

1. Forma canonica e coefficienti (a, b, c)
2. Variabile ausiliaria `t = x²` e delta (Δ = b² − 4ac)
3. Calcolo di t₁ (prima soluzione in t)
4. Calcolo di t₂ (seconda soluzione in t)
5. Calcolo di x₁ (da t₁: x = ±√t₁)
6. Calcolo di x₂ (da t₂: x = ±√t₂)
7. Verifica finale e insieme delle soluzioni

Tutto è pensato per studenti con **BES/DSA**: pochi passi chiari, colori, box da copiare,
feedback immediato CORRETTO/SBAGLIATO, PDF finale.

---

## 2. Architettura e file critici

| File | Ruolo |
|------|-------|
| `client/src/pages/EspressioniExercises.tsx` | **Tutta l'app**: risoluzione espressioni in 5 sezioni guidate, NotebookGuide, PDF, mappa concettuale |
| `client/src/components/NumberInputCanvas.tsx` | Canvas input con riconoscimento ONNX, elaborazione LaTeX, display frazioni |
| `client/src/components/MathDrawCanvas.tsx` | Canvas disegno puro (penna, gomma), ResizeObserver, rendering stroke |
| `client/src/hooks/useMathRecognition.ts` | Hook gestione modello ONNX (COMER), init engine, recognize, repairLatex |
| `client/src/components/FractionDisplay.tsx` | Badge visualizzazione frazione riconosciuta |
| `client/src/contexts/AccessibilityContext.tsx` | Accessibilità: provider font/interlinea/righello/contrasto, localStorage `wms_access` |
| `client/src/components/AccessibilityToolbar.tsx` | Accessibilità: barra UI (Font A−/A+, Interlinea, Righello, Modalità, Ascolto) |
| `client/src/hooks/useReadAloud.ts` | **Lettura ad alta voce** (TTS italiano, converte formule KaTeX e MAIUSCOLE) |
| `client/src/lib/heightSync.ts` | Cornice dinamica: sincronizzazione altezza iframe (`labvisivo:height`) |
| `client/src/main.tsx` | Chiama `initHeightSync()` PRIMA del render |
| `client/public/fonts/` | **Font OpenDyslexic** (TTF/OTF/WOFF2) per dislessia/ipovedenti |
| `client/public/models/comer/` | Modelli ONNX (encoder/decoder int8) + `vocab.json` |
| `client/src/index.css` | Tema Tailwind, `@font-face` OpenDyslexic, stili accessibilità |
| `server/index.ts` | Server Express: serving statico + header COOP/COEP + CORS `/fonts` |
| `ACCESSIBILITA.md` | Documentazione completa delle misure di accessibilità |
| `docs/grado.md` | Riferimento: **cambiare il grado** (mappa del codice) |
| `docs/disequazioni.md` | Riferimento: **adattare alle disequazioni** |
| `docs/fratte.md` | Riferimento: **adattare alle fratte** (C.E. + verifica) |
| `docs/lingua.md` | Riferimento: **cambiare la lingua** (inglese, spagnolo, francese) |
| `docs/quiz.md` | Riferimento: **adattare a quiz** (set di domande, VERO/FALSO, 3/4 opzioni) |
| `scripts/clone_app.py` | Script di clonazione meccanica con grado diverso |

### Pipeline del riconoscimento scrittura (ONNX)

```
User scrive sul canvas → MathDrawCanvas (stroke)
  → NumberInputCanvas.handleManualRecognize
    → useMathRecognition.recognize() → ink-on preprocessStrokes()
      → ONNX COMER (encoder_int8.onnx + decoder_int8.onnx)
        → token IDs → decodeToTokenArray() → repairLatex() → LaTeX
          → cleanLatex → evaluateLatex() → valore numerico
            → display frazione impilata (MAI decimale)
```

### Il motore delle espressioni (`client/src/lib/espressioni.ts`)

Invarianti stabilite con l'utente (NON modificare):

1. **Le divisioni NON vengono mai convertite in frazione**: l'espressione mostra
   sempre i due punti ( `6 : 2` ), in tutte le sezioni e nel PDF.
2. **Riparazione del segno di divisione** (`repairDivisionSigns`): il segno
   tracciato a mano viene normalizzato — due o più punti `..` → `:`, barra `/` → `:`,
   `=` letto per errore al posto di `:` → `:`, `÷` → `:`. Il suggerimento a video
   invita a tracciare × come piccola X e ÷ come barra `/` (riga sopra la canvas in
   `EspressioniExercises.tsx`).
3. **Ordine rigoroso delle riduzioni** (`analyzeExpression`): ① parentesi →
   ② TUTTI i prodotti/divisioni/potenze (sinistra→destra, parametro `blockFold=true`:
   la catena ± è bloccata finché resta anche solo un ×/:) → ③ catena ± da sinistra.
   Così l'espressione mostrata sotto un'operazione non contiene MAI un prodotto
   «da fare» dopo che la catena è iniziata.
4. **Il segno meno è DENTRO l'operazione** (`pushNegThrough`): `−(2·6)` diventa
   `(−2)·6` PRIMA della riduzione, così lo studente svolge `−2 · 6 = −12` e non
   `2 · 6 = 12` con il meno applicato dopo. Stessa regola per la divisione.
5. **Niente box giallo al punto 3** (il vecchio «TOLGO LE PARENTESI…» è stato
   rimosso), **niente sezione «6. HO CONTROLLATO»** (l'app si chiude con il
   risultato) e **niente scritta «Sono sceso sotto lo zero…»** (resta solo la
   linea dei numeri come aiuto visivo).

---

## 3. Ricostruire l'app da GitHub

### 3.1 Localmente (qualsiasi macchina)

```bash
git clone https://github.com/<utente>/<repo>.git
cd <repo>            # se l'app è in una subfolder: cd <subfolder>
pnpm install
pnpm check           # type-check TypeScript — MAI saltare
pnpm dev             # avvia il dev server (http://localhost:5173)
```

### 3.2 Su Easy-Peasy.AI (MARKY)

Caricare la cartella nel sandbox e chiedere a MARKY di fare build, preview e deploy.
Oppure inizializzare un nuovo progetto `web-static` e copiare dentro i file `client/`,
`server/`, `shared/`, `package.json`, `tsconfig*.json`, `vite.config.ts`, `patches/`.

> **Nota**: lo scaffold è **`web-static`** (NON `web-db-user`). Non c'è database né
> autenticazione: non serve alcuna chiave API.

---

## 4. Variante A — cambiare il grado dell'equazione

La sorgente risolve `a·x^(2k) + b·x^k + c = 0` con `t = x^k`. Cambiare il grado significa
cambiare **k**:

| grado | k | sostituzione | radici x |
|-------|---|--------------|----------|
| 2  | 1 | nessuna (t = x) | x = t |
| 4  | 2 | t = x² | x = ±√t |
| 6  | 3 | t = x³ | x = ∛t |
| 8  | 4 | t = x⁴ | x = ±∜t |
| 2k | k | t = x^k | vedi sotto |

**Regola radici (passo 6):**
- k **pari**: `x = ±(t)^(1/k)` (due radici opposte, serve `t ≥ 0`).
- k **dispari**: `x = (t)^(1/k)` (una sola radice reale, `t` qualsiasi).
- k = 1: nessun passo di estrazione (x = t), i passi diventano 5.

### Clonazione meccanica con lo script

```bash
python3 scripts/clone_app.py --name "equazioni-sesto-grado" --degree 6
# da repository GitHub invece della cartella locale:
python3 scripts/clone_app.py --source https://github.com/<utente>/<repo>.git \
    --name "equazioni-sesto-grado" --degree 6
```

Lo script copia la cartella e applica le sostituzioni meccaniche (potenze, titoli,
placeholder, testo della sostituzione). **Poi stampa una CHECKLIST dei passi manuali**:
leggerla e completarla (in particolare la logica del passo 6: `Math.sqrt` → `Math.pow(t, 1/k)`,
`\sqrt{t}` → `\sqrt[k]{t}`, `±` solo per k pari).

Per la **mappa esatta** di dove è codificato il grado (parser, builder, titoli, testi,
passo 6) leggere **[`docs/grado.md`](docs/grado.md)**.

> ⚠️ **Regola**: MAI fare replace globale delle cifre `4`/`2` — romperebbe `4ac`, `2a`,
> ecc. Sostituire solo i **token di grado** (vedi `clone_app.py` e `docs/grado.md`).

---

## 5. Variante B — disequazioni di qualsiasi grado

Stessa filosofia dell'app, ma la soluzione è un **intervallo** (o unione di intervalli)
con **studio del segno**. Forma: `a·x^(2k) + b·x^k + c ≷ 0` con `≷ ∈ {>, <, ≥, ≤}`.

Restano identici: input a mano ONNX, sostituzione `t = x^k`, delta, radici t₁/t₂,
NotebookGuide, PDF, divulgazione progressiva.

Va aggiunto:
1. **Parser del verso** (`>`, `<`, `≥`, `≤` → campo `verso`).
2. **Passo "studio del segno"** (parabola `y = at² + bt + c`, segno `+`/`−` con colori).
3. **Traduzione in x e intervallo finale** (`x < -2 ∨ x > 2`, notazione italiana).
4. **Input della risposta** come intervallo (o selettore strutturato per BES).

Per la **struttura passi completa**, la tabella dei segni e le linee guida BES leggere
**[`docs/disequazioni.md`](docs/disequazioni.md)**.

---

## 6. Variante C — equazioni/disequazioni fratte

Per le **fratte (razionali)** si aggiungono le **Condizioni di Esistenza (C.E.)**
(denominatore ≠ 0) e la verifica che le soluzioni non annullino i denominatori.

Forme trattate:
1. **Frazione unica = 0**: `N(x)/D(x) = 0` → `N(x) = 0` con `D(x) ≠ 0`.
2. **Somma/differenza di frazioni** → denominatore comune → `numeratore = 0`.
3. **Fratte che si riducono a una trinomia di grado qualsiasi** → il numeratore è
   `a·x^(2k) + b·x^k + c`, quindi si **riusa TUTTA la logica trinomie** (sostituzione
   `t = x^k`, delta, radici, estrazione x). Il grado può essere qualsiasi.

Passi aggiuntivi: **C.E.**, **numeratore = 0**, **verifica contro le C.E.** (badge
ACCETTABILE / NON ACCETTABILE), **insieme soluzione finale**.

Per la **struttura passi completa** e le linee guida BES leggere
**[`docs/fratte.md`](docs/fratte.md)**. La combinazione "fratte + disequazione" si ottiene
sommando i due riferimenti (C.E. + studio del segno).

---

## 7. Variante D — cambiare la lingua (inglese, spagnolo, francese)

La logica matematica **non dipende dalla lingua**: per ottenere un'app per lo studio
dell'**inglese**, dello **spagnolo** o del **francese** cambiano solo i **testi**
dell'interfaccia, la **voce della lettura ad alta voce** (TTS) e i **formati** di
numeri/date.

In sintesi:

1. `client/index.html`: `lang="it"` → `en` / `es` / `fr` + `<title>` tradotto.
2. `WelcomePage.tsx` e `EspressioniExercises.tsx`: traduci le **stringhe** (titoli,
   consegne, box "RICOPIA SUL QUADERNO", pulsanti, testi del PDF). **Non** rinominare
   variabili, chiavi di stato o ID.
3. `useReadAloud.ts`: imposta la voce TTS della lingua (`it-IT` → `en-US`/`en-GB`,
   `es-ES`, `fr-FR`) e traduci le etichette lette ad alta voce.
4. `AccessibilityToolbar.tsx`: traduci le etichette della barra e le `aria-label`.

> Le formule KaTeX (`x⁴`, `Δ`, `√`, `±`, frazioni) **NON si traducono**: sono universali.
> Cambiano solo le parole attorno alle formule ("discriminante" → "discriminant" /
> "discriminante" / "discriminant", ecc.).

Riferimento completo (tabella testi, simboli, formati numeri/date, voci TTS per
it/en/es/fr, accessibilità e lingua, checklist di verifica):
**[`docs/lingua.md`](docs/lingua.md)**.

---

## 8. Variante E — quiz con set di domande

Per ricostruire un **quiz** (con dashboard docente, codici classe, sessioni, contatore
studenti e report PDF con punteggio) si parte dalle app quiz della stessa famiglia e si
cambia **solo il set di domande** tramite un **JSON**: contenuto, numero di domande,
tipologia **VERO/FALSO** (2 opzioni) oppure a **3 o 4 opzioni**.

| Obiettivo | Cosa fare |
|---|---|
| Contenuto diverso | modifica `testo` e `opzioni` di ogni domanda |
| Numero diverso | aggiungi/rimuovi oggetti nell'array `domande` |
| Tipologia diversa | `vero_falso` (2 opzioni), `multipla_3` (3), `multipla_4` (4) |
| Tema/lingua diverso | traduci `testo`/`opzioni` (vedi `docs/lingua.md`) |

Riferimento completo (JSON di esempio, skill di clonazione): **[`docs/quiz.md`](docs/quiz.md)**.

---

## 9. Build, verifica e deploy

```bash
pnpm install                 # dipendenze (usa pnpm-lock.yaml)
pnpm check                   # type-check — MAI saltare prima del deploy
pnpm build                   # vite build + esbuild del server → dist/
pnpm dev                     # dev server locale
pnpm start                   # server di produzione (NODE_ENV=production node dist/index.js)
```

Su Easy-Peasy.AI:
- **Preview**: `webdev_deploy mode="preview" project_dir="<cartella>"`
- **Produzione**: prima `webdev_save_checkpoint`, poi (solo dopo conferma esplicita
  dell'utente) `webdev_deploy mode="production"`.

Verifica residui del grado (dopo una clonazione):

```bash
grep -rn "x^{4}\|x^{2}\|x⁴\|x²" client/src
```

---

## 10. Trasferimento su Render (via GitHub)

Il progetto include già:
- **`render.yaml`** — Blueprint Render: crea il Web Service con un clic (Node 22,
  `pnpm install --frozen-lockfile && pnpm build`, `pnpm start`).
- **`.github/workflows/ci.yml`** — CI su ogni push (install → check → test → build).

Procedura completa passo-passo: **[`RENDER.md`](RENDER.md)**.

In sintesi:
1. Carica questa cartella su un repository GitHub (root del repo).
2. Su [render.com](https://render.com) → **New → Blueprint** → collega il repo.
3. Render legge `render.yaml` e crea il Web Service automaticamente.

> L'app NON ha database né chiavi API: il server Express serve solo i file statici +
> gli header COOP/COEP (richiesti da ONNX Runtime Web) + CORS su `/fonts` (per l'embed
> cross-origin). Non serve configurare nulla oltre a `NODE_VERSION`.

---

## 11. ACCESSIBILITÀ (sezione portabile)

> ⚠️ **SEZIONE ACCESSIBILITÀ** — questa è la sezione che riassume TUTTE le misure di
> accessibilità dell'app. Le stesse misure possono essere **portate su altre app simili**
> copiando i file indicati. Il dettaglio completo è in **[`ACCESSIBILITA.md`](ACCESSIBILITA.md)**.

### Misure implementate (riepilogo)

| # | Misura | File da copiare su altre app |
|---|--------|------------------------------|
| 1 | **Font OpenDyslexic** auto-ospitato | `client/public/fonts/` + `@font-face` in `client/src/index.css` |
| 2 | **Barra di accessibilità** (Font, Interlinea, Righello, Modalità, Ascolto) | `client/src/components/AccessibilityToolbar.tsx` |
| 3 | **Dimensione testo regolabile** 80%–160% | `client/src/contexts/AccessibilityContext.tsx` → `--lf-scale` |
| 4 | **Interlinea regolabile** 1.65 / 1.9 / 2.2 / 2.6 | `AccessibilityContext.tsx` → `--lf-lh` |
| 5 | **Righello di lettura** | `index.css` (`.lf-ruler-band`) |
| 6 | **Modalità ad alto contrasto** | `index.css` (`html.lf-hc`) |
| 7 | **Focus visibile** (`:focus-visible`) | `index.css` |
| 8 | **`prefers-reduced-motion`** rispettato | `index.css` |
| 9 | **Testo base 18px + selezione ad alto contrasto** | `index.css` |
| 10 | **ARIA / tastiera** (`role="toolbar"`, `aria-live`, `aria-label`) | `AccessibilityToolbar.tsx`, `WelcomePage.tsx` |
| 11 | **PDF esportato in OpenDyslexic** | `client/src/pages/EspressioniExercises.tsx` (`handleScaricaPdf`) |
| 12 | **Preferenze persistenti** (`localStorage` `wms_access`) | `AccessibilityContext.tsx` |
| 13 | **CORS sui font** (embed cross-origin) | `server/index.ts` |
| 14 | **Lettura ad alta voce** (TTS italiano) | `client/src/hooks/useReadAloud.ts` + pulsante "Ascolto" |

### Come portare l'accessibilità su un'altra app

1. Copiare `client/public/fonts/` (OpenDyslexic).
2. Copiare in `index.css`: i 4 `@font-face`, le classi `.lf-ruler-band`, `html.lf-hc`,
   `:focus-visible`, `::selection`, `@media (prefers-reduced-motion: reduce)`, e le
   variabili `--lf-scale` / `--lf-lh`.
3. Copiare `AccessibilityContext.tsx` + `AccessibilityToolbar.tsx` e montarli in `App.tsx`
   dentro un `<AccessibilityProvider>`, **prima** del router.
4. Copiare `useReadAloud.ts` per la lettura ad alta voce (voce italiana, converte formule
   ed esponenti in linguaggio naturale).
5. Aggiungere `aria-label` ai campi di input e `role="toolbar"` / `aria-live` alla barra.
6. Nel PDF: usare OpenDyslexic con `@font-face` inline nel documento di stampa.

**Dettaglio completo**: **[`ACCESSIBILITA.md`](ACCESSIBILITA.md)** (con checklist di
verifica rapida).

---

## 12. Regole d'oro

1. **MAI saltare `pnpm check`** prima del deploy — gli errori TypeScript bloccano la build.
2. **Non fare replace globale delle cifre** `4`/`2` quando si cambia grado: sostituire solo
   i **token di grado** (vedi `clone_app.py` / `docs/grado.md`).
3. **Il calcolo di delta, t₁, t₂ è identico per ogni grado** — cambia solo il passo di
   estrazione x (`Math.sqrt` → `Math.pow(t, 1/k)`, `±` solo per k pari).
4. **`buildTEquationLatex` non cambia con k** — produce sempre `at² + bt + c = 0`.
5. **Il canale postMessage è `'labvisivo:height'`** (condiviso): NON cambiarlo negli embed.
6. **Il NotebookGuide DEVE mostrare la derivazione completa** (non versioni abbreviate).
7. **Le frazioni nei badge usano la freccia `→`** (non `=`): `⁴/₂ → 2`.
8. **MAI decimali con la virgola nei risultati** (27/9): interi semplici; valori non
   interi SEMPRE come frazioni impilate `\\dfrac{n}{d}` (nel display KaTeX e nel PDF).
9. **Font OpenDyslexic su `html, body, #root` e `.font-sans/.font-serif/.font-mono`**, ma
   **NON** su `.katex` (le formule restano in KaTeX).
10. **Prima del deploy produzione**: sempre `webdev_save_checkpoint` con descrizione.
11. **`currentHeight()` (heightSync.ts) usa l'altezza REALE del contenuto**: `Math.max(body.scrollHeight, body.offsetHeight, documentElement.offsetHeight)` + `documentElement.scrollHeight` SOLO se supera `window.innerHeight`. **NON** usare `documentElement.scrollHeight` come riferimento assoluto: dentro l'iframe resta gonfiato all'altezza del viewport e la cornice non si restringe MAI, lasciando un grande vuoto sotto la card (bug corretto in produzione).
12. **Anti-tremolio**: l'invio dell'altezza è stabilizzato (ceil su misura frazionaria, isteresi 3 px, silenzio post-invio 400 ms con salto libero ≥ 30 px, coalescenza rAF, ping sempre risposto) e le cornici NON devono avere `transition: height` né applicare l'altezza senza debounce. MAI rimuovere queste protezioni: senza, l'app vibra nel blog (58 messaggi/82 s misurati). Diagnosi e strumento di misura: [`IMPLEMENTAZIONE-IA.md`](IMPLEMENTAZIONE-IA.md), Area 3.
13. **Le divisioni restano con i due punti** ( `a : b` ): mai convertire in frazione, né a schermo né nel PDF. `repairDivisionSigns` normalizza i segni tracciati a mano (`..`, `/`, `=`, `÷` → `:`).
14. **Ordine del motore NON modificabile**: parentesi → tutti i ×/:/potenze (`blockFold`) → catena ± da sinistra; il segno meno passa al primo fattore con `pushNegThrough` PRIMA della riduzione. Rompere l'ordine riporta il bug del «prodotto ancora da fare sotto l'espressione» e il «2 · 6 = 12 senza meno».
15. **Nel RICOPIA le divisioni numeriche NON esatte NON hanno il risultato** (in `espressioni.ts`, case `"div"`: `risNumNonIntero` → il `detail` contiene solo l'operazione, es. `2 : 12`). MAI risultati ridotti con i due punti (mai `2 : 12 = 1 : 6`). Le divisioni esatte (`24 : 12 = 2`) e quelle con lettere (`6x : 4 = \\dfrac{3x}{2}`) mantengono il `= risultato`.
16. **MAI decimali con la virgola — solo frazioni impilate** (richiesta 27/9, sostituisce la vecchia «doppia scrittura»): TUTTI i risultati non interi — intermedi, nel RICOPIA, nel risultato finale, nel PDF — sono SOLO frazioni impilate. `fractionResultLatex(finalPoly)` rende SOLO `\\dfrac{n}{d}` (niente «= 1,8»); `risultatoLatex` (d≠1 → `\\dfrac`); `fractionStepLatex(f, _withDecimal)` ignora il parametro e rende sempre la frazione. `fracToDecimalComma` resta nel motore ma non è più usata per la resa. Interi semplici, zero e le espressioni letterali restano invariati.
17A. **Senza parentesi niente card «Risolvo le parentesi»** (27/9-quinquies, app E PDF): la card con «Niente parentesi: passo direttamente al calcolo» (e l'espressione identica ripetuta sotto nel «Riscrivo senza parentesi») era un doppione: rimossa del tutto. Dopo il punto 1 si parte da «Riscrivo senza parentesi» rinumerato 2, che nel caso numerico NON rimostra l'espressione né la sua RICOPIA e parte da «Calcolo prima prodotti e potenze:». Numerazione dinamica: `noParens = parenSteps.length === 0`, `numRiscrivo = noParens ? 2 : 3`, `numCalcoloOrdine`, `numRisultato` (scala di uno); anche il caso «operazione già finita» segue («2. Inserisco il risultato finale:» senza parentesi, «3.» con).
17B. **Caso «operazione già finita»** (`isDirectResult = !hasVars && numericChain.length === 0`, es. `9 : 5`, `1 : (3 : 4)`): dopo il box 2 SOLO il box «3. Inserisco il risultato finale:» con riquadro grigio dell'operazione (`directOpLatex`, ESSENZIALE, mai rimuoverlo), etichetta «INSERISCO IL RISULTATO FINALE:», feedback, linea dei numeri se negativo e RICOPIA con operazione + risultato. NIENTE «Riscrivo senza parentesi», niente box 4, niente box 5. L'ULTIMA operazione NON è un esercizio del box 2 (è esclusa da `parenSteps`): mai chiedere due volte lo stesso conto.
17C. **Card «Calcolo in ordine» nascosta finché il punto precedente non è completo** (27/9-sexties, segnalazione con screenshot): la card numerica NON mostra più il segnaposto «⬆ Completa prima il punto 2…» — NON ESISTE finché `!upperDone`. Il ternario del punto 4 in `EspressioniExercises.tsx` è `hasVars ? (raggruppo) : upperDone ? (calcolo in ordine) : null` e il messaggio di blocco dentro la card è stato rimosso. (La card «Raggruppo i monomi simili» mantiene il segnaposto.)
17D. **MENO «-» riscritto geometricamente** (27/9-septies, segnalazione «-8»): `rewriteMinusSigns` (inkSigns.ts) toglie dall'inchiostro le barre orizzontali singole (`isMinusBar`: come `isBar` ma larghezza minima 10) e restituisce `{strokes, minuses, anchors}`; il modello legge il resto e «-» viene reinserito nel LaTeX alla posizione proporzionale. Si esegue DOPO `rewriteEqualSigns` (una barra singola residua non è né metà di un uguale né un vinculum). GUARDIA anti-«+»/7/4/A: un tratto ALTO che attraversa il CENTRO della barra (±4 px di tolleranza penna) blocca la rimozione (una cifra adiacente tocca al massimo l'estremo). Pezzo con SOLO segni sintetizzati (meno incluso): LaTeX diretto ordinato per ancora (es. «-8» → «-8»). Casi verificati: «-» da solo → «-» (prima «Nessun pezzo riconosciuto»); «-8» → «-8» (prima «8» o scarto). **FUSIONE DEL DOPPIO MENO «--»** (segnalazione 27/9, «quando scrivo - me lo riconosce sempre come doppio meno»): un meno spesso arriva come DUE tratti quasi sovrapposti (andata + ripasso sullo stesso segno) → entrambe le barre venivano estratte e il LaTeX diventava «--»; ora i meno quasi coincidenti (distanza dei centri < 60% della barra più larga) si FONDONO in uno solo. **RETE DI SICUREZZA `collapseRepeatedMinus`** (exprOcr.ts, per il «--» sopravvissuto alla fusione): qualunque sequenza di 2+ «-» consecutivi si COLASSA in uno, in TRE punti: percorso solo-segni dell'hook, inserimento ancore post-modello (tick residuo letto «-» dal modello che si somma al meno sintetico) e `recognizePiece` come ultima barriera. Nessuna espressione scolastica usa meni consecutivi: il collapse non ha falsi positivi. 8 test (195 totali).
18. **Nessun promemoria della «REGOLA DEI SEGNI»**: box rosso e riga nel RICOPIA rimossi su richiesta (`promemoriaSegni` / `signRuleNeeded` non esistono più). Non reintrodurli.
19. **PDF del quaderno**: spazio vuoto di lavoro (~85 px) sotto la riga del RICOPIA del box 4 con i prodotti svolti (es. `18 − 3 − 9 + 1`): blocco `{generatingPdf && <div style={{ height: "85px" }} />}` subito dopo la riga `ricStartLatex`. Solo nel PDF, mai a schermo.
20. **Suggerimento sopra la canvas** (testo esatto, X e / in grassetto marrone `#8B4513`): «💡 Traccia preferibilmente il segno della moltiplicazione **con** una piccola **X** e il segno della divisione **con** una barra **/**.» — forma «con una», MAI «come una».
21. **Parentesi QUADRE e GRAFFE non si trasformano MAI in tonde** (richiesta esplicita dell'utente): se lo studente scrive `[ ]` o `{ }` (anche LaTeX `\left[ \right]` / `\left\{ \right\}`), la trascrizione e TUTTA l'app le mostrano come scritte. Implementazione in `espressioni.ts`: `normalizeInput` NON converte più `[\[\]{}]` in tonde (unica eccezione `\{`/`\}` → `{`/`}`); il tokenizer accetta `[`/`{` come token `lparen` con campo `b` e `]`/`}` come `rparen`; il nodo `paren` porta `b?: "[" | "{"`; la stampa passa da `wrapParen(b, inner)` (anche nei dettagli `paren-value` e `pow`). Le funzioni che riacchiudono operandi controllano `startsWith("\\left")` (non solo `\\left(`). In `pushNegThrough` il campo `b` viene PRESERVATO.
22. **Divisioni non esatte — input e risultato**: NESSUN suggerimento sopra la canvas: l'avviso «💡 Scrivi il risultato come frazione impilata» è stato ELIMINATO PER SEMPRE (27/10, richiesta utente: superfluo) da ENTRAMBE le pagine (`EspressioniExercises.tsx` e `EsercizioFrazioni.tsx`) — NON reintrodurlo; il vecchio «oppure come numero con la virgola» era già stato rimosso (27/9). Il risultato si mostra SEMPRE come frazione impilata tramite `fractionStepLatex(f, _withDecimal)` (il parametro `lastOp` resta nei siti d'uso ma è ignorato). Coerente con le invarianti 13–14 e 16: mai decimali, nei RICOPIA intermedi resta solo l'operazione (mai `1 : 6`).
23. **Valori non interi GIÀ RISOLTI → sempre frazione impilata ovunque** (richiesta esplicita dell'utente): dopo che lo studente ha risolto `2 : 4 = 1/2` (riga verde), TUTTI i passaggi numerici successivi, il RICOPIA e il risultato finale mostrano `\dfrac{1}{2}` e MAI più `1 : 2`. I due punti restano SOLO per le divisioni NON ancora risolte (nodi `"div"` in `printNode`, es. `9 : [-\left(2 : 4\right)]`). Implementazione: `fracToLatex` (d≠1 → `-\dfrac{n}{d}` con segno fuori) e `termToLatex` (ramo «valore puramente numerico non intero» → `\dfrac{n}{d}`); `polyToLatex`/`finalLatex` ne derivano. NON ripristinare la forma con i due punti per i valori risolti.

## 13. Cornice dinamica (embed per il blog)

Il pacchetto include la **cornice dinamica** in `cornice-dinamica/`: un blocco HTML
autonomo da incollare su Blogger (o qualsiasi sito) che mostra l'app in un iframe con
**altezza automatica**, **font OpenDyslexic**, **Schermo intero**, **Ricarica** e
**isolamento multi-embed (impermeabile, v3)**.

| File | Uso |
|------|-----|
| `cornice-dinamica/embed-espressioni-monomi-polinomi-dedicata.html` | ⭐ **Versione dedicata (v3 impermeabile)**: titolo **e pulsanti sulla stessa riga, tutti centrati**; Schermo intero, Ricarica, spinner, stato online/errore con **Riprova** (timeout 15 s), ping periodico (3 s), altezza al resize e **isolamento multi-embed** (scoping DOM, id con token, filtro `e.source`) e **anti-loop mobile** (debounce + clamp + conferma salti + congelamento). **Da incollare nel post.** |
| `cornice-dinamica/embed-espressioni-monomi-polinomi-lite.html` | Versione minima (~5 KB) riutilizzabile: cambia `APP_URL` (o passa `?app=URL`) |
| `cornice-dinamica/embed-universale.html` | Template universale con URL segnaposto, per altre app |
| `cornice-dinamica/embed-espressioni-monomi-polinomi.html` | Versione autosufficiente (~110 KB, font in base64) |
| `cornice-dinamica/test-dedicata.html` | Pagina di test locale (simula un post Blogger) |
| `cornice-dinamica/test-impermeabile.html` | Pagina di test multi-embed: 2 cornici + un «intruso» che tenta il furto dell'iframe |
| `cornice-dinamica/README.md` | Documentazione completa della cornice |

### Protocollo altezza dinamica

- L'app (in `client/src/lib/heightSync.ts`, inizializzato da `client/src/main.tsx`)
  misura la propria altezza e la invia al genitore con
  `{ type: "labvisivo:height", height }`.
- La cornice ascolta i messaggi `message` e imposta `iframe.style.height`.
- La cornice invia `{ type: "labvisivo:ping", cornice: <token> }`; l'app risponde con la sua altezza **rispecchiando il token** (`heightSync.ts` legge `?cornice=<token>` dall'URL).
- **Fix anti-loop**: quando l'app è dentro un iframe aggiunge la classe `lf-embedded` a
  `<html>` e il CSS disattiva `min-h-screen`/`min-h-dvh` (vedi `client/src/index.css`),
  così l'altezza misurata non dipende dall'altezza dell'iframe.
- **Fix `currentHeight()` (vuoto sotto la card)**: `currentHeight()` NON deve usare
  `documentElement.scrollHeight` come riferimento assoluto. Quando il contenuto è più
  corto dell'iframe, `documentElement.scrollHeight` resta gonfiato all'altezza del
  viewport (mai meno) e la cornice non può MAI restringersi: la prima pagina mostra un
  grande vuoto sotto la card. Usa invece
  `Math.max(body.scrollHeight, body.offsetHeight, documentElement.offsetHeight)` e
  aggiungi `documentElement.scrollHeight` SOLO se supera `window.innerHeight`
  (vedi `client/src/lib/heightSync.ts`).
- **Anti-tremolio (Settembre 2026)**: l'app stabilizza l'invio dell'altezza (ceil su
  misura frazionaria + isteresi 3 px + silenzio post-invio 400 ms con salto libero
  ≥ 30 px + coalescenza rAF + ping sempre risposto) e le cornici applicano l'altezza
  SOLO con debounce, senza `transition: height` (lite/base64/universale corrette;
  dedicata con silenzio post-applicazione 300 ms). Test riproducibile:
  `client/public/test-tremolio.html?mode=bad` (cornice vecchia) o `?mode=v3`, report
  con `window.__report()`. Prima del fix: 58 messaggi/82 s con crescendo continuo;
  dopo: silenzio a pagina ferma e cambiamenti veri seguiti subito. Dettagli completi:
  [`IMPLEMENTAZIONE-IA.md`](IMPLEMENTAZIONE-IA.md), Area 3.

### Adattare la cornice a un'altra app

1. **Versione universale/lite**: cambia la riga `APP_URL` nella sezione `⚙️ CONFIGURAZIONE`;
   oppure passa `?app=URL&title=NOME` come parametri della pagina.
2. **Versione dedicata**: cambia `APP_URL` + i due URL `@font-face` + il testo del titolo.
3. Le app devono servire i font su `/fonts/*` con CORS (`server/index.ts`).

Per i dettagli completi (Schermo intero, stato, ping, mobile, accessibilità) leggi
`cornice-dinamica/README.md`.

---

## 14. Sezione IA dedicata — foto, mappe concettuali, tremolio

> 🧭 **SEZIONE APPOSITA PER IMPLEMENTARE MEDIANTE IA** — le tre aree chiave richieste
> sono documentate in dettaglio operativo in **[`IMPLEMENTAZIONE-IA.md`](IMPLEMENTAZIONE-IA.md)**:
>
> 1. **Scattare foto / ritaglio foto / riconoscimento / trascrizione** — la pipeline
>    completa (SCATTA UNA FOTO / CARICA / drag&drop / Ctrl+V → `normalizePhoto` →
>    `CropDialog` → `enhanceForOcr` → `ocrImage` (Tesseract self-hosted) →
>    `normalizeEquationOcrDetailed` → campo equazione), i dettagli critici (PNG
>    lossless, upscale a passi, COOP/COEP, ricostruzione trinomia v3) e la checklist
>    per estenderla.
> 2. **Produzione di mappe concettuali specifiche** — `MappaPdfData`, `buildMappaHtml`,
>    `openMappaPdf`: come generare la mappa PDF di QUALSIASI trinomia (con esempio
>    completo), la struttura Parte A/Parte B, le formule letterarie sopra quelle
>    numeriche nei passi 3-4-5 e la paginazione a misurazione DOM.
> 3. **Debug del "tremolio"** — sintomo, cause misurate, strumento
>    `client/public/test-tremolio.html?mode=bad|v3` con `window.__report()`, le 5
>    contromisure lato app + quelle lato cornice, la procedura diagnostica passo-passo
>    e come portare l'anti-tremolio su altre app.
>
> Le **regole non negoziabili** di queste tre aree sono in coda allo stesso documento.

---

## 15. Quaderno «Matematica Facile» (PDF 5 anni)

Il pulsante nella seconda pagina scarica il quaderno inclusivo **«Matematica
Facile — Il quaderno di matematica e geometria (liceo linguistico, obiettivi
minimi)»**: 53 pagine A4 PDF/UA-1 in **flusso continuo** (i temi scorrono senza
forzare nuove pagine; la banner colorata è il separatore), riempimento medio 87%,
32 pagine oltre il 90%. Copertina, indice con numeri di pagina automatici, un
capitolo per anno con box TRUCCO/ATTENZIONE/ESEMPIO e mappa finale. File:
`client/public/quaderno-matematica-facile-v4.pdf`; integrazione in
`EspressioniExercises.tsx` (riga con `href="/quaderno-matematica-facile-v4.pdf"`).

I **sorgenti completi** (8 sezioni HTML + `styles.css` + `build.py`;
bilanciatori DEPRECATI con guardia) sono in
**[`docs/quaderno-matematica/`](docs/quaderno-matematica/README-QUADERNO.md)**
con il manuale di ricostruzione, le regole di impaginazione e l'adattamento a
nuovi contenuti:

```bash
cd docs/quaderno-matematica && pip install weasyprint pymupdf && python3 build.py
```

**Regole non negoziabili del quaderno (flusso continuo):** nessun box spezzato
tra due pagine (`break-inside: avoid` su tutti i box, INCLUSI `.mappa-griglia` e
`.mappa-box` che sono `display:table` e non sono coperti dal selettore `table`);
banner di tema mai orfane a fondo pagina (`.page-head { break-after: avoid }`);
numero di pagina nel margine, sollevato con `padding-bottom: 6mm` (assente in
copertina); nuove pagine solo per copertina, indice e divisori d'anno
(`.divider`); MAI `.salto` nei temi e MAI `ristretta` (pagine nominate =
interruzioni forzate): i bilanciatori `fix_fill.py`/`autobalance.py`/
`collapse.py` sono deprecati e si bloccano da soli; MAI `display:flex` (testo
tagliato a destra) — usare `display:table/table-cell` o `inline-block`;
riempimento medio ≥85%: se una pagina resta spoglia è un fine-sezione naturale,
non va «riempita» a forza.

---

*Documento generato per il pacchetto esportabile del "Widget Matematico Sorgente" — Settembre 2026.*
24. **POTENZE: gli esponenti in apice NON si perdono** (richiesta esplicita dell'utente: l'apice spariva sia a mano sia in foto):
    - *Scrittura a mano*: `client/src/lib/supScript.ts` + `useMathRecognition.ts`. `extractSuperscripts` fa analisi geometrica (cluster di tratti; apice = cluster alto < 62% della mediana, in alto a destra della base, base più grande); gli apici sono TOLTI dall'input principale, riconosciuti isolati e INGRANDITI in modalità «numero», poi `spliceExponents` li riattacca come `^{d}` (punti di aggancio: dopo lettere libere — non comandi `\word` — cifre e parentesi `) ] }`; posizione proporzionale `(baseIndex+1)/baseCount`; i punti dentro gruppi `^{...}` esistenti sono occupati). `stripModelExponents` rimuove gli apici impostori del modello. Soglie in px (canvas ~150–170 px): GAP_X/Y=16, SUP_MAX_H=0.62, SUP_MAX_GAP=1.0, SUP_RISE=0.12.
    - *Foto/OCR*: `client/src/lib/exprOcr.ts`. Ordine regole: apici unicode `²`→`^2` (in `unifyLine`) → rimozione spazi → simboli d'apice spurii `° ' ’ ` ´ " ”` PRIMA del filtro (`x°`→`x^2`) → filtro caratteri (CON `[] {}`: quadre e graffe restano, regola 7) → cifra attaccata a lettera/parentesi chiusa = esponente DOPO il filtro (`x2`→`x^2`, `(2x)3`→`(2x)^3`, `xy2`→`xy^2`; con `(?!\d)` per non toccare «x23»). ⚠️ `*` NON è un simbolo d'apice: è la moltiplicazione ×/·.
    - **27/9-quater — niente esponente «22»**: il tratto successivo dell'utente dava «2 alla 22esima»: nella nuova scrittura il ² interno si sovrapponeva in PROFONDITÀ alla cifra (gap < −GAP_X) e la vecchia regola di adiacenza scartava la cifra come base → il ² interno cavalcava la «)» insieme al ² esterno → due apici sullo stesso punto → `spliceExponents` CONCATENA le cifre (`byPoint`) → `^{22}`. Fix nella cavalcazione mega: la base deve FINIRE prima (o quasi, tolleranza 1,5×GAP_X) della fine dell'apice (`bb.x1 ≤ ab.x1 + 1,5×GAP_X`) e il centro dell'apice non sporge oltre 2×GAP_X dal fondo della base — il ² interno non può più cavalcare un glifo che lo supera a destra, per quanto si sovrapponga alla cifra.
    - **27/9-terzies — MEGA-CLUSTER, fix sul tratto REALE dell'utente**: il file diagnostico ha mostrato che in scrittura serrata «(2²)²» TUTTI e cinque i glifi finiscono in UN cluster (la «(» tocca la cifra dx 3, il ² interno tocca cifra e «)» dx −4 e 2, la «)» tocca il ² esterno dx 10) → il recupero per-gruppo saldava ² interno ed esterno in UN solo esponente e la trascrizione era «(2²)». Fix (supScript.ts): `splitMegaCluster` — quando un cluster ha ≥ 2 tratti alti, ogni tratto piccolo cerca INDIVIDUALMENTE il glifo che CAVALCA (vicino in orizzontale ≤ 2,5×GAP_X, fondo dell'apice entro il 35% dell'altezza dalla cima della base, apice < 75% della base, sollevamento; guardia anti-puntino solo se piccolo in ENTRAMBE le dimensioni < 6 px) e i tratti che cavalcano la stessa zona si fondono in un apice (² a 2-3 tratti); i glifi principali si ri-aggruppano con `GAP_SPLIT = 6` (< GAP_X: nella scrittura reale cifra e «)» arrivano a 12 px e il clustering normale li concatena) → baseCount torna allineato al LaTeX e ogni apice riceve la sua base. Verificato end-to-end nel browser con i TRATTI ESATTI dell'utente (replay punto per punto del JSON diagnostico): trascrizione (2²)². Test nuovo con i bbox reali.
    - **27/9-duodecies — apice POCO SOLLEVATO + strumento diagnostico**: (a) `SUP_RISE` da 0.08 a 0.05: il centro della base sale con la sua altezza, quindi contro una «)» alta la vecchia soglia era più severa in valore assoluto che contro la cifra, e un esponente scritto poco sollevato passava col 2 interno ma veniva scartato con quello esterno (trascrizione (2²)); il 5% esclude ancora i glifi scritti ALLA BASE. Test nuovo: «² esterno POCO SOLLEVATO ora è apice». (b) MODALITÀ DIAGNOSTICA `?diag=1`: aprendo l'app con questo parametro, ogni card pezzo mostra un pulsante ⤓ che scarica `pezzo-N-tratti.json` con i TRATTI GREZZI del pezzo (points in coordinate canvas); i tratti sono conservati in memoria per pezzo (`Piece.strokes`, solo points). Serve per riprodurre nei test la scrittura reale quando un glifo sfugge, invece di correggere alla cieca. Senza ?diag=1 l'interfaccia è identica (nessun impatto per gli studenti).
    - **27/9-undecies — (2²)² SERRATO, entrambi gli apici fusi con la «)»**: se il ² interno tocca la «)» a sinistra E quello esterno la tocca a destra, i tre glifi finiscono in UN cluster; sul bbox UNITO dei tratti piccoli le due regole laterali falliscono entrambe (l'apice «parte» a sinistra E «finisce» a destra) → si rinunciava a TUTTO e il modello perdeva l'esponente esterno (trascrizione «(2²)»). Fix (supScript.ts): `findMergedApexGroups` divide i tratti piccoli per LATO rispetto al centro del tratto alto e valida ogni gruppo da solo (guardie invariate per gruppo: parte alta del cluster, h ≥ 15%, base più grande, sollevamento) — gruppo sinistro → glifo precedente, destro → il cluster. Verificato END-TO-END nel browser: trascrizione (2²)² con i due ² che toccano la «)». NOTA: il ² sintetico a DUE BARRE orizzontali viene letto «=» dal modello (correttamente: due barre SONO un uguale) — negli apici di prova usare lo zigzag monotratto.
    - **27/9-decies — «potenza di potenza» (2²)², apice FUSO con la «)»**: riproduzione end-to-end nel browser (tratti sintetici con MouseEvent, pause tra gli eventi per il flush di React): con tratti realistici il ² interno tocca la «)» e i due glifi finiscono in UN cluster; `findMergedApex` scartava l'apice perché guarda solo il lato destro (caso x²). Fix (supScript.ts): `findMergedApex` restituisce `{ idx, side }` — "right" = apice parte nella metà destra della base (base = il cluster stesso); "left" = apice finisce nella metà sinistra → appartiene al GLIFO PRECEDENTE → base = cluster valido più vicino a sinistra (basePool, gap ≤ SUP_MAX_GAP×med, base più grande dell'apice, SUP_RISE, mai apici già presi). Verificato nel browser: trascrizione (2²)² e calcolo → 16.
    - **27/9-decies-bis — STAMPA del passo pow-term**: per (2²)² l'operazione interna compariva come «(2)²» — \left(2\right)^{2} — e sembrava che l'esponente interno fosse perso (la matematica era giusta: 16). Fix (espressioni.ts, case "pow" ramo pow-term): la base NUMERICA positiva e intera (vars.length === 0, c.d === 1, c.n ≥ 0) NON si avvolta in \left( \right) → op «2² = 4»; le parentesi restano per base negativa ((−4)²), frazionaria ((3/2)²) o con lettere ((2x)², altrimenti «2x²» si leggerebbe 2·x²).
    - **27/9-novies — «potenza di potenza» (2²)²**: dentro le parentesi la CIFRA è più bassa delle parentesi (h ≈ 50–70%) e con il pool di basi «normali» (h ≥ 75% del riferimento) l'apice del 2 interno NON poteva agganciarsi al 2: finiva sulla parentesi di apertura (esponente nel posto sbagliato, «(²2)²») o restava all'inchiostro (letto come cifra a livello base). Fix (supScript.ts): il pool delle basi valide è `basePool` = cluster con h ≥ BASE_MIN_H×med (0.45) — gli apici veri (≤ ~25%) restano esclusi, quindi nessuna catena apice→apice; le guardie per-candidato (base più grande, SUP_RISE, SUP_MAX_GAP, base a sinistra) restano. Test: caso (2²)² completo, cifra bassa vicino a parentesi NON è apice, splice di due apici su (2).
    - **27/9-septies — «2 alla seconda» ancora difficile (apice FUSO con la base)**: se il «2» TOCCA la base i due glifi finiscono in UN SOLO cluster e la geometria tra cluster non li separa più (niente early return su `clusters.length < 2` né su `found.length === 0`). `findMergedApex` (supScript.ts) cerca l'apice DENTRO il cluster: tratti non alti (h ≤ 62% del cluster) il cui bbox sta tutto in alto (y1 ≤ top+78%), parte nella METÀ DESTRA della base (x0 ≥ base.x0+50% larghezza base), altezza ≥ 15% e < base, centro ≥ 8% sopra il centro base. Guardie anti-falsi-positivi: barra del «t»/puntino dell'«i» partono a sinistra → scartati; coda della «y»/braccio basso della «k» trascinano il bbox in basso → rinuncia. Soglie aggiornate: GAP_X/Y=12, SUP_MAX_H=0.75 (da 0.68), SUP_MAX_GAP=1.4, SUP_RISE=0.08. RETE DI SICUREZZA nell'hook: apici rilevati ma NESSUNA cifra leggibile → si riprova sull'inchiostro ORIGINARIO (l'apice fuso può essere letto dal modello come apice suo), con stesse riparazioni (√/9/×→·). Test: `client/src/lib/supScript.test.ts` (tratti sintetici) e `client/src/lib/exprOcr.test.ts`.

    - **27/9-undecies — (2²)² con i TRATTI REALI dell'utente, catena completa**: tre difetti a monte ancora attivi con l'inchiostro vero, tutti corretti e verificati end-to-end nel browser (replay punto per punto del JSON ⤓ del pezzo 2): (1) *base orfa* — dopo lo split del mega-cluster il ² esterno puntava al cluster ORIGINARIO non più esistente (baseIndex −1): nuova `indexOfBase` (supScript.ts), la base orfa risale al sotto-cluster che l'apice segue; (2) *tratti duplicati* — `dedupeIdenticalStrokes` (supScript.ts, hook): lo stesso tratto registrato DUE volte (ripasso/double-event) fondava le copie in un unico gruppo apice → il modello number leggeva «22»; le copie con bbox identico (±3 px) vengono ridotte a una; (3) *² mangiato dal puntino* — CAUSA RADICE del «(2²²)²» nel browser: `rewriteDotSigns` (dotSigns.ts) scambiava il ² interno (glifo tondo 22×22 px in alto) per un PUNTINO ISOLATO e lo sostituiva con la croce × sintetica (DUE tratti con lo stesso bbox!) → gruppo apice da 2 tratti → «22». La vecchia guardia anti-apice (cy < tallTop + 0,32×medH) sfaldava per meno di 1 px quando le parentesi alte ~100 px gonfiano medH: nuova seconda guardia — un glifo piccolo interamente SOPRA il centro verticale dei tratti alti (b.y1 < medCy, nuova statistica in `tallStats`) non è mai un puntino di moltiplicazione. Verifica finale browser: tratti restano 5, exps digits «2»/«2», latex `(2^{2})^{2}`. Test: `dedupeIdenticalStrokes` e «l'apice ² NON è un puntino isolato» (dotSigns.test.ts, geometria reale del pezzo 2). Suite: 11 file, 217 test.

### 25. OCR FEDELE: l'app NON inserisce MAI operazioni da sé (richiesta esplicita dell'utente del 26/9: «sembra che nel riconoscimento di foto l'app compia automaticamente operazioni, ciò non deve mai farlo»):
    - `normalizeExpressionOcr` (`client/src/lib/exprOcr.ts`): il simbolo d'apice spurio NON diventa mai `*` — se seguito da cifra/lettera/parentesi aperta si SCARTA (la giustapposizione `2(3…` vale già come prodotto), se seguito da operatore/fine è un apice (`2°+5`→`2^2+5`).
    - Pulizia dei segni raddoppiati dall'OCR («·» letto «*+» o «*/», `*` prima di una chiusura, segni a inizio/fine di foto tagliata): si toglie SOLO il simbolo di troppo, mai si aggiunge. Regex: `/\*([+*/^)\]}])/g→$1`, `/([+*/^(\[{])\*/g→$1`, strip `^[+*/^]+` e `[+\-*/^]+$`. ⚠️ attenzione all'escaping: dentro una character class JS `\]` ha UN solo backslash nel sorgente TS.
    - Modalità `light` (2° argomento true): solo pulizia, nessun recupero esponenti. In `runOcr` (pagina) si propongono DUE candidati (completo e light) e si mette nel campo il primo che passa `canParseExpression` (nuovo export di `espressioni.ts`); se nessuno va, si mostra comunque il completo.
    - Il campo mostra `prettyExpression(expr)` (export di exprOcr): notazione del LIBRO — `·` al posto di `*`, `:` al posto di `/`, apici unicode (`^2`→`²`) — così è evidente che l'app ha SOLO LETTO la foto. `normalizeInput` riconverte `·` `:` e apici all'OK, quindi il campo resta liberamente editabile.
    - Test: `client/src/lib/exprOcrFedele.test.ts` (incluso il caso dello screenshot utente e le letture reali Tesseract su Liberation Serif: il `·` del libro può arrivare come `+`, `-` o `*`).

### 26. OCR GEOMETRICO: il testo semplice di Tesseract NON basta (foto reale dell'utente 26/9: `(2+5²):(4²-2·5-3)+48:(6²-2³)=` veniva letta `(245%) :(44-2-5-3)+48:(6°-23) =`):
    - `client/src/lib/ocrGeometry.ts` + `client/src/lib/ocr.ts`: `ocrImage` riconosce con `worker.recognize(prepared, {}, { text: true, blocks: true })` (tesseract.js 7, funziona uguale) e ricostruisce il testo dai SIMBOLI con bounding box (`rebuildFromSymbols`): APICE = glifo piccolo (h ≤ 0,85·H) e sollevato (fondo ≥ 0,25·H sopra la LINEA DI BASE = MEDIANA dei fondi, mai il massimo: le box fuse dell'OCR lo gonfiano); «·» letto «-» = trattino più stretto di metà della mediana delle larghezze; «+» letto cifra = glifo largo (w > 0,85·h) o sospeso. Non si tocca mai il resto: i meno veri, i «:» e i numeri passano intatti.
    - VALORE dell'apice: il carattere letto è inaffidabile (² → «%», «°», «4»); si ritaglia il glifo dall'immagine preparata, si binarizza e normalizza (`normalizeGlyph` 28×36) e si confronta con le CIFRE renderizzate a canvas (`bestDigitMatch`, font Times/Liberation); soglia `TEMPLATE_MAX_DIST` 0,35, altrimenti fallback sul carattere (foto reale: ²→dist 0,12 dal «2» (0,26 dal «3»), ³→dist 0,14 dal «3» (0,24 dal «5»)).
    - **27/9 — «6²» letto «6^7» (nuova foto dell'utente, espressione A)**: nel ritaglio dell'apice con il solo padding standard (15% dell'altezza) può entrare l'INCHIOSTRO VICINO (il «−» dentro la parentesi): il glifo contaminato può dare un match «abbastanza buono» ma SBAGLIATO (7 con dist 0,30 < soglia) e Tesseract, letto il piccolo ² come «7», lo confermava alla cieca nel fallback. Fix doppio in `resolveSuperscripts` (`client/src/lib/ocr.ts`): (1) RITAGLI MULTIPLI — pads 15% / 6% / 0 sull'bbox di Tesseract, si valutano SEMPRE tutti (nessun break anticipato al primo sotto soglia) e si tiene il migliore: il taglio esatto isola l'apice dal vicino; (2) FALLBACK CORROBORATO — la cifra letta da Tesseract vale solo se la FORMA la conferma: `digitDist` (nuovo export di `ocrGeometry.ts`, distanza minima del glifo dal template di UNA cifra su tutti gli stili) deve dare dist ≤ min(0,45, bestDist+0,03); altrimenti si usa la cifra col template migliore se dist ≤ 0,6; in extremis il fallback storico. Verificato END-TO-END nel browser con la FOTO REALE dell'utente: espressione A → `(2+5^2)/(4^2-2*5-3)+48/(6^2-2^3)` (prima `6^7`), espressione B → tutti gli esponenti 2 corretti. Test nuovi: `digitDist` conferma il 2 e respinge il 7 sul glifo ² reale (fixture), formula di corroborazione del fallback; `diag-p2b.test.ts` (temporaneo, dipendeva da uploads/) rimosso. Suite: 10 file, 218 test.
    - **27/9-otties — RIGO DUPLICATO nel quaderno PDF (istruzioni allegate 27/9)**: nel quaderno dell'espressione `(2+5²):(4²−2·5−3)+48:(6²−2³)` il rigo «27 : 3 + 48 : 28» compariva DUE volte consecutive (chiusura del RICOPIA del punto 3 «Riscrivo senza parentesi» + prima riga del RICOPIA del punto 4 «Calcolo in ordine»: per questa espressione `chainStartLatex` COINCIDE con `flatStep.latex`, e il guard storico confrontava solo con `originalLatex`). Fix DOPPIO in `EspressioniExercises.tsx`: (1) alla fonte — il RICOPIA del punto 4 salta il rigo di partenza se coincide con l'ultimo rigo del RICOPIA del punto 3 (`punto3RicopiaMostrato && chainStartLatex === flatStep.latex`); (2) FILTRO DI SICUREZZA usato sia dall'anteprima sia dal PDF: `dedupeRigheAdiacenti` (NUOVO `client/src/lib/quaderno.ts` + test) elimina ogni rigo consecutivo identico al precedente nelle mappe dei RICOPIA (parentesi e catena), e in `handleScaricaPdf` un dedup adiacente sul DOM (testo normalizzato delle `<p>`, anche TRA sezioni diverse) protegge l'assemblaggio del PDF. Verificato END-TO-END nel browser: esercizio svolto per intero da tastiera → sequenza dei 15 righi ESATTA come da allegato (`(2+5²):(4²−2·5−3)+48:(6²−2³)` → `27 : 3 + 48 : 28` UNA volta → `27 : 3 = 9` → `48 : 28 = 12/7` → `9 + 12/7 = 75/7` → `75/7`), duplicati rimossi dal dedup PDF: 0.
    - **27/9-novies — «−» SPURIO davanti alla frazione impilata scritta a mano (istruzioni allegate 27/9)**: lo studente scrive 75 sopra, la linea, 7 sotto e l'app riconosceva «−75/7» (decimale «−10,71»): la LINEA della frazione — o un pezzo di curva — finiva classificata «−». Due strati: (1) INK (`rewriteMinusSigns` in inkSigns.ts, GUARDIA «LINEA DI FRAZIONE»): la linea della frazione è anche lei una barra orizzontale singola e isolata (numerator/denominator NON la attraversano) — firma geometrica: tratti MOLTO più alti della barra (cifre, ≥ 3× la sua altezza) sia SOPRA sia SOTTO il suo centro, sovrapposti in orizzontale per ≥ 30% della larghezza → NON viene tolta dall'inchiostro e il modello vede la frazione completa; (2) LATEX (`stripSpuriousFractionMinus` in inkSigns.ts, chiamata in `NumberInputCanvas` PRIMA di `evaluateLatex`): se il LaTeX inizia con «−» davanti a una frazione impilata pura (`\frac{n}{d}` o `n/d`), l'inchiostro contiene una linea di frazione (`isFractionLineBox`) e NESSUN tratto ha firma di meno vero (`isRealMinusBox`: barra piatta SENZA cifre nella sua banda, chiaramente a SINISTRA di tutti gli altri tratti), il «−» viene SCARTATO — copre anche il «−» da pezzo di curva (inizio del 7, tratto interrotto). Un «−» disegnato davvero a sinistra, fuori dalla banda della linea, RESTA. ⚠️ Nei test sintetici le «cifre» devono avere bbox ALTE (≥ 3× la linea): barre piatte come numeratore non contano come cifra sopra la linea. Test: 6 nuovi in `inkSigns.test.ts` (linea non estratta, − spurio scartato da \frac e da /, − vero a sinistra resta, non-frazione «-8» resta). Suite: 11 file, 234 test. Verificato END-TO-END nel browser (modulo live): spurio scartato, − vero resta, linea non estratta (minuses 0), − vero estratto (minuses 1); disegno a mano di una frazione impilata → NESSUN «−» davanti alla frazione.
    - **27/9-bis — «4²» letto «+» o «4^22» (segnalazione utente, ancora sulla prima espressione)**: due difetti diversi in `rebuildFromSymbols` (`client/src/lib/ocrGeometry.ts`). (1) DOPPIO APICE: Tesseract a volte SPEZZA il piccolo ² in due simboli con bbox sovrapposte → due segnaposto → «4^22». Fix: se un simbolo apice è CONSECUTIVO al precedente e si sovrappone ORIZZONTALMENTE (> 45% della larghezza minore), le due bbox si FONDONO in un solo apice (un esponente vero a due cifre come 10 è fatto di glifi AFFIANCATI, non sovrapposti, e resta due segnaposto). (2) APICE LETTO «+»: il carattere «+» non passa il test `SUP_LIKE` quindi il ² letto «+» veniva emesso tale e quale. Fix: un segno «+»/«=» con PROPORZIONI DA CIFRA (w/h ≤ 0,95), piccolo (h ≤ 0,85·H) e ben sollevato (raised ≥ 0,25·H) diventa un apice. ⚠️ Calibrazione critica (foto reale 26/9): «-», «·» e «=» hanno bbox NATURALMENTE sollevate (un trattino non arriva alla base: raised fino a 0,42·H; la «=» finale raised 0,30·H) — a distinguerli è l'ASPETTO: ² è stretto come una cifra (w/h ≈ 0,6), «+»/«=» veri sono larghi (w/h 1,0–1,8); il trattino resta fuori dalla regola (un «-» stretto e sollevato è indistinguibile dal «·», regola 2). Test: apice spezzato fuso in UN segnaposto, 2^10 affiancato resta DUE segnaposto, ² letto «+» → apice, «+» vero a base resta «+», «·» vero resta «·». Suite: 10 file, 223 test. Verificato END-TO-END nel browser: A → `a*(2+5^2)/(4^2-2*5-3)+48/(6^2-2^3)`, B invariato.
    - Fixtures: `client/src/lib/ocrGeometry.fixture.json` = i simboli VERI della foto dell'utente (estratti con tesseract.js 7 in node) + glifi normalizzati + template: i test di `ocrGeometry.test.ts` verificano la geometria e il matching su dati reali.
    - Se i simboli non arrivano (<3) o il canvas manca: fallback al testo semplice con le regole testuali di `exprOcr.ts` (invariante 25).
    - In node si può replicare tutto: `/tmp/tjs/prova7.js` (creare di nuovo se serve) con `langPath` sui tessdata self-hosted dell'app.

### 27. I PASSI NON SI RIPETONO MAI: ogni operazione va svolta UNA volta sola (segnalazione utente 26/9: in `(2+5²):(4²-2·5-3)+48:(6²-2³)` la stessa `9+12/7` compariva 4 volte — punto 3, suo RICOPIA, inizio del punto 4 e suo RICOPIA):
    - Causa: «div-num» era tra i `parenKinds` di `EspressioniExercises.tsx` → `lastParenIdx` atterrava sull'ULTIMO passo (già svolto) e `flatStep` coincideva con l'inizio della catena del punto 4.
    - Regola (invariante): le divisioni NUMERICHE ESTERNE (es. 27 : 3, 48 : 28) sono CALCOLO IN ORDINE (punto 4), NON scioglimento parentesi (punto 2) — quando dopo c'è la catena dei ± (`hasAddChain`): `chainSteps = div-num + fold-add-num` nell'ordine del motore, e il punto 4 parte da `chainStartLatex` = passo PRIMA del primo passo catena (es. 27 : 3 + 48 : 28), MAI da un risultato già mostrato. Se invece l'espressione TERMINA con le divisioni (9 : 5, 1 : (3 : 4)) vale il percorso «risultato diretto» (box 3) come prima (`isDirectResult` resta basato su fold-add-num).
    - RICOPIA: righe complete con `copiaRiga(s)` = detail se contiene «=», altrimenti `opLatex = risultatoLatex(answer)` (es. «48 : 28 = 12/7» — il detail delle divisioni con risultato frazionario non ha «=»).

### 28. RICONOSCIMENTO A MANO: · : e PARENTESI QUADRE (segnalazione 26/9: in «[-(3²:3)+1] : [-(2·2³)-2]» il · disegnato diventava «:» e la seconda coppia di quadre diventava tonda):
    - «·» → «:»: il modello legge il puntino isolato come barra «/» (o \div) e repairDivisionSigns lo converte in «:». Fix: `rescueLoneDotSign` (dotSigns.ts) — l'inchiostro è la verità: se `dotRewrite` (attaccato a RecognitionResult dall'hook) dice colons=0, divSigns=0, loneDots=1 e nel testo c'è UN solo segno tra : / =, quel segno È il puntino → `\cdot`. Nella pagina: prima normalizzare \div→/, poi rescue, poi repairDivisionSigns.
    - Coppie di puntini FALSE: `rewriteDotSigns` ha due GUARDIE — (1) altezza: entrambi i puntini devono stare sotto tallTop+0.28×altezza mediana dei tratti alti (un apice sta più in alto e non forma mai «:»); (2) ingombro: nessun tratto alto può sovrapporsi in x all'intervallo tra i due puntini (se in mezzo c'è una cifra, l'accoppio è falso). loneDots conta i puntini rimasti isolati.
    - Quadre → tonde: il modello (che HA [ e ] nel vocabolario, token 42/81) le scambia con le tonde. Fix: `squareBrackets.ts` — `detectBracketShapes` rileva nell'inchiostro le shape ALTE (≥68% altezza espressione E ≥1.1× il tratto alto più corto: le cifre restano escluse); quadra = gruppo con tratto VERTICALE (≥50% dell'altezza con |dx/dy|≤0.25 e larghezza ≤30% h); lato da tick orizzontali vicini alle estremità dell'aste o, se quadra in un tratto solo, dalle estremità (per [ stanno a destra dell'aste). Tonda = curva senza aste, lato dal rigonfiamento (estremità vs centro). Se un tratto solo domina l'altezza del gruppo (cifra attaccata alla parentesi) si classifica solo quello. `restoreSquareBrackets(latex, strokes)`: allinea le parentesi del testo (in ordine) con le shape (in ordine di x); se i conteggi coincidono, quelle disegnate quadre tornano [ ] (e una [ letta dal modello per una tonda disegnata torna tonda); se NON coincidono, nessuna modifica. Nella pagina: dopo repairDivisionSigns, con `exprStrokes` ORIGINALI (prima delle riscritture).
    - wiring: `useMathRecognition.ts` ritorna `{...result, dotRewrite}`; `EspressioniExercises.tsx` (handleRecognize): rescue → repairDivisionSigns → restoreSquareBrackets.

### 29. DUE PUNTI TRA PARENTESI QUADRE «] : [» (segnalazione 26/9: la divisione centrale diventava «] \cdot [»):
    - Cause: (a) le GUARDIE anti-coppie-false del §28 bloccavano l'accoppiamento perché l'ingombro delle quadre ai fianchi sfiorava i puntini; (b) i puntini «marcati» (h > 15 px) non qualificavano come puntini e restavano isolati → il modello li leggeva «.» → repair → «\cdot».
    - Fix (dotSigns.ts): piccoli segni fino a SMALL_MAX=24 px possono accoppiarsi in «:»; **27/9-octies — «:» di divisione ancora difficile**: soglie allargate a SMALL_MAX=34 (puntini marcati, prima 24), GAP_MAX=85 (« : » scritto grande, prima 55), ALIGN_MAX=26 (« : » scritto storto, prima 18). Senza queste, i due punti sfuggivano all'accoppiamento e i puntini diventavano due CROCI «×» (moltiplicazione). Le guardie anti-coppie-false (altezza, ingombro, apice sospeso, barra piatta) restano INVARIATE e proteggono le soglie allargate; GUARDIA 2 ora blocca solo i tratti alti che ATTRAVERSANO l'intervallo tra i CENTRI dei puntini (tolleranza GUARD_TOL=4): i caratteri ai fianchi (quadre di «] : [») non bloccano; nuova GUARDIA 3 (apice sospeso): il segno superiore della coppia non deve librarsi SOPRA un tratto alto con x sovrapposta (quello è un apice, non un «:»). loneDots conta solo i piccoli segni in ZONA DI RIGA (cy ≥ tallTop+0.32×mediana): gli apici in alto non fanno scattare il soccorso del puntino.
    - Fallback: se un «:» vero non si accoppia comunque, i due puntini isolati vengono letti dal modello come «=» o «..» e repairDivisionSigns li recupera in «:».

### 30. ESPRESSIONE CON UGUALE FINALE, «] : [» LETTO «V», «3·3» LETTO «33» (segnalazione 26/9, screenshot disastro.png):
    - «…]=» diventava «…]:»: repairDivisionSigns convertiva OGNI «=» in «:». Ora l'«=» diventa «:» SOLO fra due operandi (lookahead operando/segno −): l'uguale finale resta «=» e normalizeInput tiene la parte a sinistra.
    - La «V» al centro: il modello leggeva il cluster «]/[/» come «V» e normalizeInput trasforma «V» davanti a cifra/parentesi in RADICE «√» (riga 401!) — disastro totale. Cause: la GUARDIA 3 scartava il « : » vero se l'ingombro del punto superiore TOCCAVA la quadra (ora conta il CENTRO dentro l'ingombro, con margine 2 px); la barra sintetica era troppo stretta (SLASH_HALF_W 14→18).
    - «3·3³» letto «33»: il modello rasterizza a TARGET_H=128 px (scaleToFit in ink-on): un puntino con lineWidth ~4 diventa sub-pixel e SPARISCE. Fix: rewriteDotSigns RIDISEGNA i puntini isolati in zona riga con lineWidth ≥ LONE_DOT_W=12 (stessa forma e posizione, solo più marcati). loneDots non cambia.
    - Nota: il vocabolario CoMER contiene V, \cdot, \times, =, / ma NON «:» — ogni segno di divisione passa per barra sintetica → repair.

### 30-BIS. PEGGIORAMENTO DOPO §30: MENO CORTI → LETTERE («[o2(2^2:2):(cos3(3^23)]», messaggio «Ci sono caratteri che non riconosco»):
    - Causa: la sostituzione con lineWidth ≥ 12 del §30 si applicava a OGNI piccolo segno in zona riga, INCLUSI i trattini meno corti: diventavano palloni tondeggianti letti come LETTERE (o, s → «cos») e normalizeInput rifiutava (giusto!).
    - Fix (dotSigns.ts): i candidati «puntino isolato» ora devono essere TONDI (rapporto lati ≤ 3): un trattino piatto non è mai un puntino e resta com'è. Il puntino tondo isolato NON viene più ingrossato: viene SOSTITUITO con una CROCE «×» sintetica (CROSS_R=11, lineWidth 4): operatore netto, il modello lo legge «\times», normalizeInput converte già \times→* e repairDivisionSigns riporta \times→\cdot. Regola d'oro: MAI trasformare segni in palloni o lettere — solo in operatori netti presenti nel vocabolario.

### 31. OCR FOTO: POTENZE BASSE E PUNTINO PERSO (segnalazione 26/9):
    - Potenze: la detection geometrica (ocrGeometry.ts) richiedeva sollevamento ≥ 0,25·H: gli esponenti scritti a mano poco in alto (o con bbox gonfiata) sfuggivano. Aggiunta soglia RILASSATA: h ≤ 0,65·H e sollevamento ≥ 0,10·H → comunque apice. Il VALORE dell'apice si confrontava solo con cifre serif → un ² a mano non matchava e il fallback rispondeva SEMPRE «2». Ora i template sono in TRE stili (serif, sans, corsivo tipo «scrittura a mano», chiavi con prefisso s/h; bestDigitMatch legge la cifra dall'ULTIMO carattere della chiave).
    - Puntino: «3·3» letto «3.3» diventava il DECIMALE 3,3! Fix in due punti: (1) geometria — un «.» minuscolo (w,h < 0,5 mediani) diventa «·»; la virgola scende sotto la base e resta decimale; (2) testo (unifyLine) — «cifra.cifra» → «cifra*cifra» (in Italia il decimale si scrive con la virgola, gestita dopo).
    - Test: ocrGeometry.test.ts (apice poco sollevato, cifra a base intatta, 3.3→3·3, 2,5→decimale), exprOcr.test.ts (punto tra cifre → *, virgola → decimale).

### 32. TRASCRIZIONE A PEZZI + FOTO RIMOSSA E POI REINSERITA (richieste esplicite dell'utente 26/9 e 27/9):
    - L'utente ha chiesto: «dai all'utente la possibilità di trascrivere l'espressione a pezzi più piccoli, un pezzo dopo l'altro. Ogni pezzo può contenere un numero limitato di elementi... Dai all'utente di trascrivere sia a mano che tramite tastiera... un ultimo pulsante di INIZIA IL CALCOLO DELL'ESPRESSIONE... Togli la possibilità di scattare foto o trascinare foto».
    - Fatto in EspressioniExercises.tsx: fase input RIDISEGNATA. MAX_PEZZO = 8 elementi (numeri, lettere, segni, radici, potenze, parentesi TONDE e QUADRE; **dal 6/10 le parentesi GRAFFE { } NON contano**, decisione dell'utente: `{[(3+2)]}` vale 7; funzione unica in `lib/pieceCount.ts`, usata da pagina e banco); countElements conta i caratteri significativi della forma interna (i comandi LaTeX valgono 1, ^ { } $ e spazi zero). Ogni pezzo: modalità «✍ MANO» (canvas + RICONOSCI con la pipeline completa del pezzo: soccorso puntino, repairDivisionSigns, restoreSquareBrackets) o «⌨ TASTIERA» (input diretto, il testo dell'utente è la verità). AGGIUNGI PEZZO → il pezzo entra nella lista (con ✕ per eliminarlo) e la finestra si SVUOTA per il pezzo successivo (etichetta «PEZZO n»). Pulsante finale «▶ INIZIA IL CALCOLO DELL'ESPRESSIONE»: unisce i pezzi (join senza separatori!), valida con canParseExpression e passa alla fase exercise; se non valida mostra l'errore SENZA perdere i pezzi.
    - FOTO RIMOSSA del tutto dalla UI il 26/9 e poi REINSERITA il 27/9 (richiesta esplicita: «implementa la possibilità di fare foto e trascrivere subito l'intera espressione», dopo il miglioramento del riconoscimento a mano). Flusso attuale in EspressioniExercises.tsx: pulsanti «📷 SCATTA» (input capture=environment) e «🖼 CARICA» accanto alle schede ✍ MANO / ⌨ TASTIERA + incolla (Ctrl+V) → CropDialog → OCR (`ocrImage` + `normalizeExpressionOcr`) → trascrizione IMMEDIATA dell'INTERA espressione nel campo ⌨ TASTIERA (`setKbExpr`, modalità commutata automaticamente) con toast «controlla il testo e premi ✓ CONFERMA E CALCOLA»: L'APP NON CALCOLA MAI DA SOLA (regola OCR FEDELE). Barra «📷 LEGGO LA FOTO… N%» (`ocrProgress`) e messaggio d'errore dedicato (`ocrError`). Verificato end-to-end nel browser con una foto sintetica 200×90 («3·(2+4)»): trascritta e avviato il calcolo solo col pulsante.
    - **CropDialog — AMPIEZZA MINIMA STANDARD (27/9)**: `MIN_IMG_W = 560` px (CropDialog.tsx): le foto piccole vengono INGRANDITE SOLO A SCHERMO (state `disp`, `computeDisp`, `stageRef`, `natRef`, listener resize) finché il lato lungo non raggiunge 560 px, così le maniglie di ritaglio restano sempre agibili. Il ritaglio è calcolato in PERCENTUALE sulla foto originale (confirm() e libreria box `moveBox`/`resizeBox`/`resizeCorner` INVARIATE), quindi l'ingrandimento non altera il risultato del taglio. Il contenitore scatta a `overflow-auto` con sfondo `bg-[#f8f1e4]`: se serve, scorre. La rotazione 90° ricalcola l'ingrandimento via onLoad. Verificato: foto 200×90 mostrata 576×261 con maniglie agibili e taglio corretto.
    - handleConfirmExpression, handleRecognize, handleEditExprSubmit e il preview KaTeX «ESPRESSIONE RICONOSCIUTA» sono stati rimossi: il flusso va dritto dai pezzi al calcolo.

### 33. ERRORI CHE SCOMPAIONO + CORREZIONE TASTIERA DEI PEZZI + TASTIERA = SOLO ESPRESSIONE INTERA (richiesta esplicita dell'utente 26/9):
    - «I messaggi come ESPRESSIONE INCOMPLETA falli scomparire quando l'utente inizia a riscrivere di nuovo il pezzo»: clearInputErrors() (azzera parseError e pieceError) è chiamata a OGNI cambio di tratti nella canvas del pezzo e a ogni battuta nel campo tastiera; anche salvare/eliminare un pezzo azzera gli errori.
    - «Dai la possibilità di correggere con la tastiera i pezzi riconosciuti a mano»: ogni card pezzo ha il pulsante ✎ → campo precompilato con il pezzo in notazione del libro (prettyPiece: \cdot→·, \div→:, \sqrt→√, ^n→apici unicode, via prettyExpression); Invio/OK salva (sempre max MAX_PEZZO elementi), Esc/✕ annulla. Il raw del pezzo corretto diventa il testo digitato (normalizeInput accetta entrambe le notazioni).
    - «Con la tastiera solo l'espressione INTERA, non a pezzi»: la modalità ⌨ TASTIERA non ha più il campo pezzo; mostra «ESPRESSIONE COMPLETA» con un solo campo (kbExpr) e il pulsante ▶ INIZIA IL CALCOLO dentro la card. Se esistono già pezzi a mano, il campo si precompila con la loro unione (join degli shown) per correggerla tutta. Il pulsante finale giallo dei pezzi compare SOLO in modalità mano. Rimossi pieceText/addPieceKeyboard/pieceInputRef; aggiunti startCompute(expr) condiviso, handleStartKeyboard, kbExpr, editingPiece/editPieceText.

## 16. Riconoscimento a mano 27/9 — uguale, 8, apici

Richieste esplicite dell'utente: «l'OCR ha difficoltà con gli esponenti delle potenze
(in particolare il 2), il numero 8 e il segno = (letto di frequente come :)» e «esprimi
TUTTI i risultati solo come frazione impilata, mai decimale con la virgola» (quest'ultima:
vedi invarianti 8, 16, 22). Tutto verificato IN PRODUZIONE disegnando nel browser.

### a) Causa del bug «=» letto «:» — guardia barra piatta (`dotSigns.ts`)
- Le due barrette di un uguale PICCOLO (larghezza ≤ 24 px = `SMALL_MAX`) rientravano in
  `isSmall` e venivano accoppiate come « : » da `rewriteDotSigns` PRIMA che
  `rewriteEqualSigns` le vedesse (poi riparate in divisione).
- Fix: `isFlatBar(w,h) = w ≥ 14 && w > 2·h` — una barra piatta orizzontale NON è mai un
  puntino di « : » né un puntino isolato «·» (un puntino vero è tondo, w ≈ h). Applicata
  sia a `isSmall` sia al ramo roundish dei loneDots.

### b) Uguale RIMOSSO dall'inchiostro + ANCORE (`inkSigns.ts` → `EqRewrite {strokes, equals, anchors}`)
- Verificato nel browser: anche l'uguale SINTETICO (due barre pulite) il modello lo legge
  male quando l'uguale è da solo («\frac{\infty}{\frac{m}{m}}»), mentre cifre e lettere da
  sole le legge bene.
- Soluzione definitiva, STESSA TECNICA di radici (√) e 8: le barre vengono TOLTE
  dall'inchiostro, il modello legge il resto, «=» viene REINSERITO nel LaTeX alla posizione
  proporzionale (`anchors` = frazione 0..1 del centro del segno rispetto all'inchiostro
  RESTANTE; reinserimento da destra a sinistra insieme alle ancore di radici e 8).
- ORDINE della pipeline nell'hook: `rewriteDotSigns` → `rewriteRadicalSigns` →
  `rewriteEights` → `rewriteEqualSigns` (PER ULTIMO: così le sue ancore sono calcolate
  sull'inchiostro che il modello vede davvero, senza radici né 8) → `extractSuperscripts`.
- Early-return per pezzo con SOLO segni sintetizzati:
  `latex = "=".repeat(eq.equals) + "\\sqrt".repeat(rad.radicals) + "8".repeat(eights.eights)`.
- `eqEquals` (attaccato a `RecognitionResult`) protegge comunque il «=» da
  `repairDivisionSigns`.
- Soglie più permissive (27/9): `EQ_H_MAX` 12→14, `EQ_CX_ALIGN` 18→24, `EQ_GAP_MAX` 34→44.
  Resta il riconoscimento dell'uguale IN UN SOLO TRATTO (vai-e-torna orizzontale).

### c) ⚠️ Segni sintetici e `isStrokeMeaningful` (ink-on)
- La guardia di ink-on richiede MIN_TOTAL_POINTS = 6 punti e MIN_PATH_LENGTH = 15: un segno
  sintetico di soli 2 punti rende un pezzo composto SOLO da quel segno non significativo →
  «NESSUN PEZZO RICONOSCIUTO» (verificato: un «=» disegnato da solo dava sempre null).
- Regola: OGNI tratto sintetico deve essere INTERPOLATO con ≥ 6 punti (la barra «/» del
  « : » in `slashStroke` ha 13 punti). MAI reintrodurre barre di soli 2 punti.

### d) Numero 8 più permissivo (`inkSigns.ts`)
`EIGHT_MIN_H` 28→22 (8 piccoli), `EIGHT_PINCH` 0.55→0.62 (vita più larga; lo ZERO resta
escluso perché più largo al centro).

### e) Apici più permissivi (`supScript.ts` + hook)
- `GAP_X`/`GAP_Y` 16→12: apici attaccati alla base non si fondono più con essa (5² non
  diventa «52»); `SUP_MAX_H` 0.62→0.68.
- ⚠️ RIFERIMENTO D'ALTEZZA = carattere PIÙ ALTO (`Math.max(median(heights), ...heights)`):
  con solo DUE cluster (base + apice) il 75° percentile è interpolato verso il basso
  ([80, 52] → 73) e un apice grande (65% della base) sfuggiva alla classificazione.
- Omonimi del 2 (hook, riattacco esponenti): in modalità «numero» l'apice può essere solo
  una cifra, ma un «2» piccolo e isolato viene a volte letto come LETTERA (verificato: «z»)
  → prima del filtro cifre: `latex.replace(/[zZaA]/g, "2")`. Estendere con parsimonia.

### f-bis) «8» letto come radice (segnalazione 27/9-bis)
Un 8 che sfugge alla geometria resta nell'inchiostro e il MODELLO lo decodifica a volte
«\sqrt» (token del vocabolario; per una radice VERA non produce mai «\sqrt»). Fix su due
fronti (inkSigns.ts + hook):
1. Firme geometriche allargate: 8 APERTO (traccia non richiusa ma con autointersezione
   centrale; guardia anti-«x»: x-spread delle estremità ≤ 0.5·w e gap ≤ 0.5·diag/20);
   8 in DUE TRATTI con anelli SOVRAPPOSTI (impilamento ≥ 0.45·h invece di 0.6, rapporto
   dimensioni ≥ 0.4). La strozzatura (pinch) resta SOLO per tratti chiusi (una «s» aperta
   strozza anch'essa).
2. `repairModelSqrt(latex, radicalsFound, strokes)` chiamata nell'hook dopo la riparazione
   token: se radicalsFound === 0 E il latex contiene «\sqrt» E c'è un glifo ad anello
   (`hasLoopGlyph`), ogni «\sqrt» → «8» («\sqrt{9}» → «89»: contenuto graffe in
   giustapposizione). MAI attivare con radici geometriche presenti (la radice vera arriva
   dalle ancore, un «\sqrt» sarebbe duplicato).

### f-quater) «8» letto √/θ e «9» letto g/q (segnalazione 27/9-quater)
Verificato nel browser e con tsx (diag-89.ts): un 9 a due tratti (anello + coda) il modello
lo legge «q»/«g», uno a un tratto «3»; un 8 sfuggito alla geometria finiva nel radicale
falso (√) o veniva letto «θ» (visto anche con l'app Frazioni confrontata: lì l'utente
scrive operazioni INTERE e il contesto aiuta il modello, qui i glifi sono isolati). Fix:
1. `isCheckmark` (inkSigns.ts): GUARDIA ANTI-8 — un tratto chiuso (gap ≤ 0.35·diag/14) o
   con ≥ 1 autointersezione NON è una V di radice. Una √ vera è aperta e semplice: resta
   riconosciuta (test «una radice VERA resta un radicale»; barra ≥ `RAD_BAR_MIN_W`, non
   fare barre troppo corte nei test).
2. `eightOrNineFromInk(strokes)`: firma d'inchiostro 8/9/0 su profilo a 16 fette con
   campionamento denso dei segmenti (profilo GREZZO: la piallatura riempie la valle
   dell'8). «8» = due picchi ≥ 0.7·w con valle ≤ 0.85·min; «9» = quarto alto largo +
   picco anello interno + fondo stretto ≤ 0.5·w; «0» = senza valle (≥ 0.92·min).
3. `repairModelNine(latex, verdict)`: g/q/G/Q isolati → 9 (o 8 se firma «8»); «\theta»
   segue la firma (mai legittimo nelle espressioni scolastiche); «\sigma»/«\log» e le
   sequenze di lettere restano intatti.
4. SOCCORSO 8 ISOLATO nell'hook: firma «8» su TUTTO l'inchiostro del pezzo e
   rewriteEights a 0 → LaTeX diretto «8» senza modello (PRIMA di extractSuperscripts,
   così l'anello superiore dell'8 non viene rubato dagli apici).
Il caso «9 → 3» NON è riparabile alla cieca (3 è cifra legittima): si corregge con la
tastiera (✎ sul pezzo). NB: i test browser con MouseEvent sintetici perdono punti del
tratto (React) → archi troncati e letture false: per i glifi completi usare tsx/test.

### f-ter) Moltiplicazione SEMPRE puntino (segnalazione 27/9-ter)
Richiesta: «il segno di moltiplicazione scritto come puntino non deve MAI essere
riconosciuto come segno × (si confonde con la lettera/variabile x); la moltiplicazione
si scrive sempre e solo come puntino». Tre livelli di garanzia:
1. Hook (`useMathRecognition.ts`): dopo `repairModelSqrt`, ogni `\times` del modello →
   `\cdot` (vale per la croce disegnata, il puntino sintetico di `rewriteDotSigns` e la
   «x» fra cifre).
2. `repairDivisionSigns` (espressioni.ts): `\times`/`\bullet` → `\cdot`; «x» fra DUE
   CIFRE → `\cdot` con lookahead `/(\d)\s*x(?=\s*\d)/` + `.replace(/\s{2,}/g, " ")`
   (la lookahead non consuma la cifra destra: copre anche «2x3x4»). Le «x» LATERALI
   (2x, x3, 2x(3+1), 2xy3) restano VARIABILI — non convertirle mai. La conversione è
   sicura perché lo studente scrive 2·x·3 sempre con un operatore, e il suggerimento
   dell'app (regola 5) dice di tracciare la × piccola per la moltiplicazione.
3. `prettyExpression` (exprOcr.ts): `\times`/`\cdot`/`\bullet` → «·» e simboli Unicode
   `× ⋅ • ∗` → «·» (il display non conobbe mai più «×»). Il motore stampa comunque
   `\cdot` nei passi (printNode/termToLatex).

### f) Verifica live nel browser (anche in produzione)
Dalla pagina `/esercizio?…` si disegnano tratti con `console_exec` dispatchando MouseEvent
(mousedown/mousemove/mouseup, coordinate frazioni della rect del canvas, pause ~30 ms tra i
punti, ~140 ms tra i tratti), poi «AGGIUNGI PEZZO» (~2,5 s prima per il debounce, ~7 s dopo
per il riconoscimento) e si leggono i pezzi da `[aria-label="Pezzi trascritti"]`. Lo
screenshot di `console_exec` è scattato ALL'INIZIO dell'azione: per vedere il risultato
serve una seconda exec di sola lettura. Tratti utili: «=» = due barre a y 0.42/0.58;
«8» = due anelli (loop 90°→450° e −90°→−450°, raggio ~0.05); «x²» = due tratti incrociati +
3 tratti del 2 piccolo in alto (x 0.20–0.25, y 0.22–0.40).

### g) Test (160 totali in `client/src/lib/`)
Aggiunti: due barrette piatte NON formano « : »; trattino corto non diventa «·»; uguale con
gap ~40 px e centri disallineati ~20 px riconosciuto; 8 piccolo (h ~28 px) tolto
dall'inchiostro; apice al 65% della base e vicino riconosciuto; frazione impilata SEMPRE
(niente decimali) in `espressioni.test.ts`.

## 17. FRAZIONE IMPILATA RICONOSCIUTA GEOMETRICAMENTE + NUMERI PIÙ AFFIDABILI (27/9, segnalazione utente: «il riconoscimento dei numeri e in particolare delle frazioni è ancora terribile»)

### a) Perché: il modello NON sa leggere la struttura impilata
Il risultato si scrive come frazione impilata (numeratore, linea, denominatore) ma CoMER
riceve TUTTO l'inchiostro insieme e la stravolge: «7-5» nel numeratore,
«\frac{\infty}{m/m}», cifre sbagliate, segni spurii. Soluzione: LA STESSA TECNICA già
usata per apici, √, 8, = e − — estrazione geometrica + riconoscimento separato in
modalità «numero» + reinserimento nel LaTeX con ancora proporzionale.

### b) `rewriteStackedFractions` (inkSigns.ts) → `FracRewrite {strokes, fracs[]}`
- **RILEVAMENTO della linea**: barra piatta (w > 1,6·h) con ALMENO un tratto «da cifra»
  (h ≥ 3× la linea) SOPRA e uno SOTTO il suo centro, sovrapposti in orizzontale
  (≥ 30% della larghezza) — la stessa firma della guardia anti-meno 27/9-novies.
- **ASSEGNAZIONE per CENTRO del tratto** (NON per altezza!): la barra orizzontale del
  «5» ha bbox piatta (h≈0) e il tratto verticale del «5» ha larghezza 0 — con criteri
  d'altezza/larghezza restringono tratti interi fuori dalla frazione e il modello li
  leggeva «-r» / «1» accanto («-r\frac{70}{7}», «1\frac{75}{7}», verificati in browser).
  Regole finali: (1) tratto piatto sovrapposto alla BANDA della linea = ripasso → scartato;
  (2) centro x del tratto dentro la campata della linea = sovrapposizione OK;
  (3) centro y del tratto sopra/sotto il centro della linea = numeratore/denominatore.
- Numeratore e denominatore vengono TOLTI dall'inchiostro; per ognuno c'è una copie
  INGRANDITA (`numScaled`/`denScaled`, formula degli apici) per la modalità «numero».
- NB: l'estrazione avviene DOPO `rewriteDotSigns` (il «÷» è geometricamente simile a
  una frazione: barra con puntini sopra e sotto — va già sintetizzato in barra diagonale)
  e PRIMA di radici/8/uguale/meno (le loro ancore restano coerenti).

### c) Collegamento nell'hook (`useMathRecognition.ts`)
- Numeratore e denominatore riconosciuti A PARTE con `engine.recognize(…, "number")` e
  `digitsFromNumberLatex` (omonimi: g/q/G/Q→9, o/O/θ→0, l/I/i/|/ℓ→1, s/S→5, z/Z→2,
  B/∞→8, b→6; gli ALTRI comandi LaTeX diventano un segnaposto: senza, la «l» di
  «\alpha» diventava 1!). Se una parte non dà cifre → FALLBACK: modello su TUTTO
  l'inchiostro (frazione compresa, percorso storico).
- «\frac{n}{d}» reinserito alla posizione proporzionale del centro della linea rispetto
  all'inchiostro restante (come \sqrt e «8»); se il modello a vuoto o l'inchiostro
  restante è vuoto, il LaTeX è SOLO la frazione. Il controllo «8 isolato» viene saltato
  se ci sono frazioni estratte.

### d) Numeri più affidabili (`NumberInputCanvas.tsx`)
- Se la modalità «expression» NON produce un valore valutabile, il pezzo viene
  riconosciuto di NUOVO in modalità «numero» (vocabolario ridotto, meno confondibile)
  prima di mostrare l'errore.
- `DIGIT_FIXES` esteso a TUTTI gli omonimi delle cifre (risultato esatto a tratto
  singolo: «l»→1, «o»→0, «s»→5, «z»→2, «b»→6, «B»→8, «θ»→0, «∞»→8…).

### e) Verifica end-to-end nel browser (modello reale)
Frazione 75/7 disegnata due volte nel canvas dei pezzi (pag. 1, modalità MANO):
PEZZO 1 e PEZZO 2 = «\frac{75}{7}» ESATTO, senza prefissi spurii, senza meno
(prima: «7-5» nel numeratore / «-r\frac{70}{7}» / «1\frac{75}{7}»). Debug usato:
`import('/src/lib/inkSigns.ts')` con i tratti sintetici + verifica `rimasti: 0`.
⚠️ Gli eventi mouse sintetici possono arrivare PARZIALI (tratti persi): ridisegnare
con pause più lunghe (35 ms/punto, 220 ms/tratto) e CANCELLA prima.

## 18. «27» LETTO «8» NELLA FINESTRA DEI RISULTATI (27/9, segnalazione utente)

### a) Causa
La scorciatoia «8 isolato» nell'hook SOVRASCRIVE il modello quando la firma d'inchiostro
`eightOrNineFromInk(eq.strokes)` dice «8». Nella finestra dei risultati l'inchiostro è
SOLO il numero: due cifre compatte affiancate («27», e in generale «2x»/«88») possono
soddisfare la firma dell'8 (due fasce larghe con valle al centro) → il modello viene
IGNORATO e il LaTeX diventa sempre «8».

### b) Fix: guardia MULTI-GRAFO in `eightOrNineFromInk` (inkSigns.ts)
La firma 8/9/0 vale per UN SINGOLO glifo. Due guardie nuove:
1. **Colonna verticale vuota interna** (24 colonne, campionamento denso dei segmenti
   ogni ~3 px): se tra la prima e l'ultima colonna occupata ce ne sono ≥ 2 vuote di
   fila (~8% della larghezza), l'inchiostro si spezza in ≥ 2 glifi affiancati → null.
   Un anello unico (8/9/0) attraversa tutte le colonne tra gli estremi.
2. **Rapporto larghezza/altezza ≤ 1,2** (era 1,4): coerente con `EIGHT_MAX_WH` di
   `isEightStroke` — un glifo ad anello è più alto che largo.
Se l'utente scrive le cifre del tutto ATTACCACTE (nessuna colonna vuota) la guardia 1
non scatta: usare `?diag=1` per i tratti reali e riprodurre.

### c) Verifica
- Unit: «27» separato → null; «27» ravvicinato → null; «88» (due anelli affiancati) →
  null; 8 vero → «8»; 9 vero → «9» (5 test nuovi in `inkSigns.test.ts`).
- Browser col modello reale: «27» disegnato nella canvas del risultato del passo finale
  (esercizio (5−2)·(4+5) via tastiera): la scorciatoia NON scatta più (prima produceva
  sempre «8»); decide il modello. ⚠️ Le cifre sintetiche restano inaffidabili (eventi
  persi, letture tipo «zY»/«4,70»): il giudizio sul defect è la scomparsa dell'«8»
  forzato, non la lettura delle cifre sintetiche.

## 19. GRAFFE { } E QUADRE [ ] ESTRATTE GEOMETRICAMENTE (27/9, segnalazione utente: «il riconoscimento a mano ha difficoltà con le graffe e le quadre»)

### a) Causa
Il modello legge una graffa disegnata come «3»/«\sum» (verificato nel browser: «{3}» →
«33\sum2») e le quadre a volte spariscono o mutano tipo. Il recupero preesistente
(`restoreSquareBrackets`, GUIDA-IA §28) è una MAPPA testo↔inchiostro: funziona solo se
il modello ha PRODOTTO le parentesi (conteggi uguali) — con le graffe non produce nulla.

### b) Fix: ESTRAZIONE + REINSERIMENTO (stessa tecnica di √, 8, = e −)
In `squareBrackets.ts` tre novità:
1. **`detectBracketKinds`**: classificazione a TRE tipi (`round`/`square`/`curly`),
   non solo quadra/tonda. Firma della GRAFFA: due RIGONFIAMENTI che sporgono OLTRE
   le estremità e una PUNTA centrale che sporge dal lato OPPOSTO, con punta ≥ 60%
   dei rigonfiamenti (una «3» ha l'incavo centrale timido e le estremità dal lato
   della punta; una tonda ha profilo monotono).
2. **`rewriteBrackets(strokes)`**: le shape classificate GRAFFA o QUADRA vengono
   TOLTE dall'inchiostro (le TONDE restano: il modello le legge bene), il modello
   legge il contenuto e le parentesi vengono REINSERITE nel LaTeX alla posizione
   proporzionale (ancore, calcolate sull'inchiostro RESTANTE come per le frazioni).
   PRIMO passo della pipeline dell'hook (prima di dotSigns: le ancore dei segni
   successivi restano coerenti). Guardie anti-falsi-positivi:
   - la shape dev'essere MOLTO più alta del resto del contenuto (≥ 1,3× il glifo
     non-candidato più alto): una «E» o una «l» alla stessa altezza delle altre
     lettere non viene mai tolta;
   - niente estrazione se il pezzo non ha ALTRO contenuto;
   - quadra a un tratto: ENTRAMBE le estremità deviate dalla stessa parte (un «1»
     con flag ha solo quella alta);
   - niente barra centrale a metà altezza (anti-«E»).
   NB: due graffe con una cifra in mezzo finiscono nello stesso gruppo (GROUP_GAP):
   i tratti dominanti vengono separati in CLUSTER per gap orizzontale e classificati
   singolarmente (`clusterByXGap`), altrimenti la firma si calcola sui punti fusi.
3. **`restoreSquareBrackets` esteso alle graffe**: il testo viene scansionato anche
   per `{ }` MA le graffe dei COMANDI (`\frac{..}{..}`, `\sqrt{..}`, `^{..}`,
   `_{..}`) sono saltate (skip di gruppi bilanciati); `\{ \}` e `\left\{ \right\}`
   valgono come parentesi utente; la sostituzione riscrive la COPPIA («\{» → «[»).

### c) Verifica
- Unit: 263 test (16 nuovi: firme graffa/«3»/«E», estrazione {3} e [3], tonde
  intatte, guardia 1,3×, solo-parentesi, mappatura graffe con \frac/\sqrt/^{ } e
  \left\{ → \left[).
- Browser col modello reale: «{3}» disegnato → PEZZO «{3}» (prima «33\sum2»);
  «[3]» disegnato → PEZZO «[z]» (quadre corrette; il 3 sintetico letto «z» — limite
  noto degli eventi sintetici, non delle parentesi); espressione [3]·[3] accettata
  dal motore e renderizzata con le quadre preservate (regola 7).
- ⚠️ Le guardie richiedono parentesi NETTAMENTE più alte del contenuto (1,3×): con
  parentesi appena più alte delle cifre l'estrazione non scatta (e resta la mappa).
  Le cifre sintetiche restano inaffidabili nel browser: per i glifi fare affidamento
  sui test unitari; per i casi reali usare `?diag=1`.

### c-bis) Quadre MULTI-TRATTO: niente meno spurio (4/10, «la quadra aggiunge un meno (-) a destra [-»)
Una quadra disegnata in TRATTI SEPARATI (aste + tick in alto/in basso, tipico di
tablet/mouse) non veniva MAI classificata: l'unità dominante conteneva solo l'asta
nuda (senza la firma delle estremità) → nessuna estrazione → i trattini restavano
nell'inchiostro e il modello li leggeva come un MENO spurio accanto alla quadra.
Fix in `squareBrackets.ts`: `absorbBracketTicks()` assorbe nell'unità i trattini
corti del gruppo vicini alle estremità dell'asta (tw ∈ [0,05·gh, 0,6·gh],
th ≤ 0,15·gh, centro x entro 0,45·gh) — entrano nella firma E vengono tolti
dall'inchiostro con l'asta. Guardie: anti-«+» (due trattini con centri quasi
coincidenti = segno più → nessuno dei due assorbito, criterio LARGO per i
compagni: il tratto verticale del «+» è stretto), anti-punto (puntini di «:»
troppo stretti), anti-«E» estesa alla scansione di TUTTO il gruppo
(classifyFromGroup riceve groupIdxs per la barra centrale non assorbita).
Verifica browser end-to-end: quadra in 3 tratti + «2» → pezzo «[2», nessun meno.

### d) Display senza backslash (4/10, «la graffa me la riconosce con una slash accanto»)
Per un pezzo con SOLO la graffa l'estrazione non scatta (guardia: nessun contenuto)
e il modello legge la graffa come comando LaTeX («\{», «\left\{», «\lbrace» — corretto
semanticamente). MA `prettyExpression` (exprOcr.ts, usata da prettyPiece per la lista
pezzi) NON convertiva «\{» → «{»: il pezzo mostrava il backslash, che l'utente leggeva
«/». Fix: prettyExpression converte ora «\\left|\\right», «\\lbrace|\\rbrace» e
«\\{»/«\\}» nel display (MAI backslash visibile); `normalizeInput` (espressioni.ts)
converte anche «\\lbrace|\\rbrace» oltre a «\\{» (tokenizer: parentesi col tipo).
Test: 269 (4 nuovi multi-tratto + 2 display/normalizeInput graffe).

### e) AUDIT esponenti (4/10, «Ricontrolla gli esponenti»): potenza a DUE CIFRE con cifre DISTACCIATE
«5¹⁰» scritto con l'1 e lo 0 a più di GAP_X (12 px) produce DUE cluster apice con la
STESSA base (baseIndex/baseCount identici) — la geometria è corretta. Il difetto era
nel RIATTACCO: `spliceExponents` segnava il punto d'aggancio come occupato dopo la
prima cifra, così la seconda cadeva sul punto libero più vicino (esponente sul glifo
successivo: «x¹⁰y⁵» → «x^{1}y^{0}») o si PERDEVAMO («5^{1}»). Fix: le cifre degli
apici con STESSA base si fondono PRIMA dell'inserimento (passo 2-bis, ordine di
scrittura = ordine per x di extractSuperscripts). Verificato nel browser col flusso
reale: 5¹⁰ distaccato → «5^{10}». Test: 273 (4 nuovi audit + 269).

### f) PARENTESI IN SEQUENZA E CON NUMERI ALTI ACCANTO (4/10: «scrivo graffa, quadra e tonda di seguito, oppure una parentesi più qualche numero accanto, difficilmente le riconosce»)
Tre cause in `squareBrackets.ts`:
1. **Soglia unica 1,3× avvelenata**: le TONDE non si estraggono (il modello le
   legge) ma contavano come «contenuto» per la soglia — nella sequenza {[() la
   tonda, alta quanto le altre, richiedeva graffa e quadra ≥ 1,3× la SUA altezza →
   niente estratto, il modello sbagliava le graffe. In più in `shapeCandidates` il
   riferimento «cifra» era il tratto alto più corto IN ASSOLUTO: in un pezzo di sole
   parentesi la parentesi più corta si AUTO-ESCLUDEVA (1,1×110 = 121 > 110).
   Fix: riferimento = solo i tratti CHIARAMENTE più corti (< 85% del più alto);
   soglia PER-FIRMA in `rewriteBrackets`: firma FORTE (graffa; quadra con tick a
   ENTRAMBE le estremità; quadra a un tratto con entrambe le estremità deviate) →
   1,0× del contenuto più alto; firma DEBOLE (quadra multi-tratto con UN tick
   solo: può somigliare a un «1» con flag) → resta 1,3×.
2. **Pezzo di SOLE graffe/quadre**: prima non si toccava nulla (l'inchiostro vuoto
   non darebbe al modello nulla da leggere). Ora si estrae tutto tranne un'ANCORA
   (l'ultima QUADRA a destra — il modello legge «[» meglio di «{» — altrimenti
   l'ultima a destra) che resta all'inchiostro. ⚠️ RIVISTO in 5/10-3ª parte
   (sezione l): l'ancora è SOPPRESSA — il modello sbaglia anche quella
   («r»/«\sum» su graffa sola) e il percorso «solo segni sintetizzati» rende
   inutile lasciare inchiostro.
3. **Guardia anti-«0» boxy**: uno «0» chiuso a loop (parte e arriva allo stesso
   punto) non è mai una quadra a un tratto, nemmeno a spigoli vivi.
Verifica browser: {[() + cifre alte → graffa+quadra estratte, tonda e cifre restano;
{[()} → le 4 estratte, le tonde restano al modello; {[]} → tutte e 4 estratte
   (5/10-3ª parte, v. sezione l);
«0» boxy intatto. Test: 278 (5 nuovi + 273).

### g) PUNTINO DI MOLTIPLICAZIONE: MAI una «piccola x» (5/10: «viene trascritto
sotto forma di piccola X, voglio che il puntino resti un puntino»)
Prima il puntino isolato (·) veniva SOSTITUITO nell'inchiostro da una croce «×»
sintetica (CROSS_R = 11) perché il puntino è quasi invisibile alla rasterizzazione
a 128 px e un pallone ingrandito veniva letto come LETTERA (o, s → «cos»): ma la
croce PICCOLA il modello la legge come la LETTERA «x» — e le regole di riparazione
coprivano solo «cifra x cifra» (…)x4, 2xx sfuggivano → la trascrizione mostrava la
piccola x. SOLUZIONE DEFINITIVA (stessa tecnica di quadre/√/8/=/meno): il puntino
isolato viene TOLTO dall'inchiostro (`rewriteDotSigns` ritorna `dots: {cx}[]` e
NON sostituisce più nulla) e «\cdot» viene REINSERITO nel LaTeX alla posizione
proporzionale (`dotInsertions` in useMathRecognition, ancore come per le quadre).
Il modello non vede nulla al posto del puntino → la trascrizione è SEMPRE «·».
Le regole di riparazione (\times→\cdot, cifra x cifra → \cdot) restano come
rete di sicurezza per croci e x disegnate DAVVERO dall'utente.
Verifica browser (modello reale CoMER): ink «3 · 4» → rewriteDotSigns toglie il
puntino (loneDots=1, anchor cx=255) → modello legge «3 4» → ancora → finale
«3\cdot 4»; confronto: la VECCHIA croce sintetica veniva letta «3 \times 4».
Test: 280 (2 nuovi + aggiornato il test della croce).

### h) TONDE STRETTE DISegnATE A MANO (5/10: «le tonde non le riconosce più,
specialmente vicino ad altre parentesi o numeri»)
DUE cause, entrambe in `squareBrackets.ts` + `useMathRecognition.ts`:
1. **Arco stretto scambiato per quadra**: una tonda scritta STRETTA (larghezza
   ≤ ~14 px — esattamente quella che si stringe per far posto al contenuto) ha
   verticalFraction alta → finisce nel percorso «aste» della quadra, e con
   ENTRAMBE le estremità deviate dallo stesso lato passava la firma della quadra
   a un tratto (FORTE, 1,0×) → veniva ESTRATTA e reinserita come «[»/«]», oppure
   toglieva la tonda al modello. Sweep su 126 varianti disegnate (w 8–30,
   h 85–130, con ganci e inclinazione, 1 e 2 tratti): 46 falsi positivi.
   FIX: GUARDIA anti-ARCO nel percorso single-stroke — una quadra vera ha il
   fianco RETTO (la x resta su midX fino quasi alle estremità, la deviazione è
   concentrata nei tick); un arco devia GRADUALMENTE (a 15–25% d'altezza è già
   deviato oltre 1/3 della deviazione finale). Se curvo → classificato TONDA
   (kind round) → resta nell'inchiostro, dove il modello legge bene «(»/«)»
   (verificato nel browser: (2+3) con tonde strette w=10 → «( 3 + 3 )»).
2. **Ordine delle ancore a parità di posizione**: più parentesi estratte
   FUORI dall'arco dell'inchiostro rimasto ({[(3+3)]}) ricadono sullo stesso
   indice di inserimento e lo splice alla stessa posizione INVERTE l'ordine
   («[\{» invece di «\{[»). FIX: tiebreaker `cx` DECRESCENTE a parità di pos
   (l'ultimo splice finisce prima → ordine finale nel testo = ordine di
   scrittura, verificato: «\{[( 3 + 3 )]»).
Test: 282 (sweep anti-arco + positiva di controllo della quadra retta).

### i) PARENTESI + NUMERI MESSI INSIEME, scrittura fitta (5/10-2ª parte)
QUATTRO difetti in `squareBrackets.ts`, attivi quando le CIFRE SONO ALTE
(≥ 85% del gruppo) e INCOLLATE alle parentesi:
1. **Cifra alta nell'unità della parentesi**: finiva nell'unità per x-gap ≤ 8
   → (a) estratta INSIEME alla parentesi e SPARIVA dall'inchiostro (rip.:
   «3[2+1]» gap 4 → la «3» mangiata), o (b) bloccava la firma (la ricerca
   asta prendeva la PRIMA verticale — la cifra «1», non la quadra; rip.:
   «[1]» stretto → quadra chiusa persa). FIX PER-SPINA: si prova OGNI tratto
   verticale dell'unità come asta; il candidato comprende SOLO asta + tick
   (mai le cifre).
2. **Barra del «+»/«=» nel gruppo scartava la quadra vera**: a scrittura
   incollata l'inchiostro si incatena (GROUP_GAP 12) e la barra orizzontale
   a metà altezza fa scattare la guardia anti-«E» anche a 60 px dall'asta
   (rip.: «3[2+1]» gap 0 → ZERO quadre). FIX: la barra conta solo se
   ADIACENTE in orizzontale all'asta E SENZA compagno incrociato («+») o
   parallelo («=») — una E non ha nessuno dei due.
3. **Graffa + «1» alta**: profilo unito corrotto → graffa non estratta
   (rip. browser: «3{2+1}» cifre alte → solo la graffa aperta, il modello
   leggeva «y» per «1}»). FIX: se l'unità mescola verticale + curvi,
   fallback sui SINGOLI tratti non verticali (nessun break: nell'unità
   fusa possono esserci DUE parentesi).
4. **Graffa + cifra alta full-height**: il profilo unito «riusciva» ma
   INGHITTISCE la cifra (rip. browser: gap 4 → candidato [3+graffa], la
   «3» spariva). FIX: con ≥2 tratti non verticali alti ≥ 80% del gruppo si
   classifica ogni tratto DA SOLO (una graffa in due metà ha metà ~55-60%,
   mai full-height, quindi non rischia).
Verifica browser col modello reale: 3[2+1], 3{2+1}, 3(2+1) con cifre
~100 px a gap 25/12/4/0 → quadre e graffe estratte e reinserite, cifre
SEMPRE intatte, «+» letto correttamente; tonde in inchiostro lette bene.
Test: 286.

### l) GRAFFA DISEGNATA LETTA «\sum» (5/10-3ª parte, segnalazione utente: «la graffa disegnata viene spesso riconosciuta come SUM»)
QUATTRO difetti in `squareBrackets.ts`, tutti sulla catena di classificazione/
ESTRAZIONE della graffa, più uno di PIPELINE (ancora inutile):
1. **Metà di graffa escluse dalle unità**: le DUE METÀ di una graffa disegnata
   in due tratti sono alte ~55% ciascuna; con una cifra ALTA vicina (≥ 85%
   del gruppo) diventavano «dominanti» e clusterizzavano DA SOLE → le metà
   non stavano in NESSUNA unità e la graffa non veniva mai provata (rip.:
   «1}» con cifra alta → solo la graffa aperta estratta, la chiusa restava
   nell'inchiostro → il modello la leggeva «\sum»). FIX: entrano nelle unità
   anche i tratti di ALTEZZA MEDIA (≥ 45% del gruppo).
2. **Profilo fuso attendibile solo se ogni tratto TOCCA cima o fondo**: il
   profilo unito di un'unità fusa (cifra media incollata + parentesi)
   produceva una CURLY SPURIA che in GUARDIA 2 diventava «ancora» e
   bloccava l'estrazione della graffa vera (rip.: «{3}» → cifra E graffa
   restavano nell'inchiostro). FIX: una shape da profilo unito multi-tratto
   è accettata solo se OGNI tratto dell'unità raggiunge la cima o il fondo
   (le due metà di una graffa sì, una cifra centrale no); altrimenti si
   azzerano e classificano i singoli tratti / leave-one-out.
3. **Leave-one-out con guardia di sovrapposizione in x**: per unità tutte
   shaft-like (graffa in due metà + cifra alta) si riprova il profilo
   FORZATO sui sottoinsiemi che escludono un tratto alla volta, ma solo se
   i tratti del sottoinsieme si SOVRAPPONGONO in x (le metà della stessa
   graffa sì: una cifra accanto no, altrimenti veniva inghiottita).
4. **Tonda da profilo fuso = RIPIEGO**: il profilo unito che dà una TONDA
   per un'unità di ≥ 2 tratti non è affidabile (rip.: «{3}» → tonda spuria
   su [cifra, graffa chiusa] che bloccava tutto); diventa un ripiego usato
   SOLO se singoli tratti e leave-one-out non producono nulla, così le
   «()» strette fuse restano valide come prima.
5. **GUARDIA 2: niente più ANCORA** — la verifica nel browser (modello
   reale) ha mostrato che il modello sbaglia ANCHE l'ancora lasciata
   nell'inchiostro (una graffa sola → «r»/«\sum»); la pipeline ha già il
   percorso «pezzo con SOLO segni sintetizzati» (LaTeX diretto senza
   modello quando l'inchiostro resta vuoto), quindi si estraggono TUTTE
   le candidate FORTI, ANCHE UNA SOLA (graffa disegnata da sola → «}»). Le
   candidate DEBOLI (quadra multi-tratto con un tick solo: può essere un
   «1» con flag) restano al modello.
Verifica browser col modello reale CoMER: graffa chiusa SINGOLA → «}» (prima
«r»); «{3}» completo → «{3}» (prima graffa persa); «{[» scritti di seguito
→ «{[» (prima letture sbagliate); «3}» → «3]» con graffa estratta. Test
PERMANENTI: `curlyVariants.test.ts` (graffe in CONTESTO con cifre normali
e ALTE, un tratto e DUE tratti, singola + cifra) + test guardia 2 aggiornati.
Suite: 297.

### f) Test (297 totali in `client/src/lib/` a quella data; oggi 479, vedi §20)
Nuovi in `inkSigns.test.ts` (6): estrazione da frazione pura (num/den/scaled/rimasti 0),
tratti estranei restano nell'inchiostro, meno con cifre accanto NON è frazione, barra
diagonale sintetizzata (÷) non è frazione, barra senza cifre non è linea, inchiostro
invariato senza frazioni; + 2 su `digitsFromNumberLatex` (omonimi, comandi LaTeX
protetti, cifre vere invariate).


---

## 20. REVISIONE GENERALE DEL RICONOSCIMENTO (5–6/10): BANCO DI PROVA COL MODELLO REALE, SCRITTURA A MANO E FOTO

Richiesta dell'utente: «rendere più efficace e puntuale il riconoscimento della scrittura a mano e
delle foto, in particolare con più parentesi consecutive e con parentesi e numeri vicini».
**Metodo: prima si misura, poi si corregge.** Fino al 4/10 ogni fix era verificato a mano nel browser
su pochi casi e peggiorava spesso altro (regressioni invisibili). Dal 5/10 esiste un **banco di prova
riproducibile** che esegue la pipeline VERA (stesso modello CoMER int8, stesso `beamWidth`) in Node su
centinaia di scritture sintetiche e su foto stampate, e confronta un giro con il precedente
(migliorate / peggiorate).

### a) Risultati in sintesi

| Misura (banco, modello reale) | Prima (HEAD c758deb) | Dopo |
|---|---|---|
| Scrittura a mano, catalogo di 684 letture (P1–P7 × 3 stili × 2 semi) | **27%** | **88%** (602/684) |
| · P1 sole parentesi di seguito (`]]`, `)]}`, `({`…) | 14% | 100% |
| · P2 parentesi + contenuto | 28% | 91% |
| · P3 parentesi + numeri adiacenti (`10[2]`, `2(3)`, `(2+3)(4-1)`) | 34% | 86% |
| · P4 parentesi annidate + operatori | 22% | 77% |
| · P5 parentesi + lettere (`3x(2x+1)`) | 5% | 76% |
| · P6 potenze (`[3]^2`, `(-2)^2`) | 17% | 89% |
| · P7 numeri e segni (`18:3`, `14-8`, `1000`) | 56% | 93% |
| · per stile: normal / tight / touch | 30 / 30 / 19% | 99 / 95 / 71% |
| Foto: 85 righe stampate sintetiche (font, sfocature, risoluzioni basse) | 31 (36%) | 76 (89%) |
| Foto: 36 varianti reali delle tre righe (ritagli, scale ≥ 0,65, anche JPEG) | — | 33 (92%) |
| Foto reale dell'utente («ESPRESSIONI CON LE POTENZE», righe A/B/C) | `4²` letto «+» o «4^22»; riga B errata | **3/3 esatte** (anche nel browser col vero Tesseract.js) |

**Due scale di scrittura, perché il canvas dell'app non è il banco ideale.** Il banco sintetico produce cifre alte 46–68 px con coordinate decimali; il canvas REALE dell'app (476×136) riceve invece punti INTERI (il browser tronca `clientX/Y`) e una scrittura tipica più piccola (cifre di ~38 px): è lì che si vedeva l'errore segnalato dall'utente (`{[(3+2)]}` letta `{[[3+2)]}`). Il banco ora gira anche in quelle condizioni (`BENCH_ROUND=1`, `BENCH_H=38`). Risultati sulle stesse 684 letture, modello reale: scala normale 599/684 (87,6%) → **602/684 (88,0%)** con la regola degli angoli (3 migliorate, 0 peggiorate); punti interi con cifre di 46–68 px 589/684 (86,1%); **cifre di 38 px a punti interi 477/684 (69,7%) → 524/684 (76,6%)**: **47 letture migliorate, 0 peggiorate** (P1 81→93%, P2 82→86%, P3 67→75%, P4 51→54%, P5 53→64%, P6 70→80%, P7 80→80%; normal 80→87%, tight 75→82%, touch 55→61%).

### b) Il banco di prova (`client/src/lib/bench/`)

- **Pipeline estratta e pura**: `recognizePipeline.ts` (`recognizeInk`, nessun React/DOM) e
  `recognizePiece.ts` (`finalizePiece`, `recognizePieceWith`). L'hook `useMathRecognition.ts` e la
  pagina sono involucri sottili: lo STESSO codice gira nel browser e in Node.
- **Modello reale in Node**: `bench/nodeEngine.ts` (ink-on + onnxruntime-web WASM, modelli in
  `client/public/models/comer`). Requisito ESTERNO (non in `package.json`): `npm i --no-save
  @napi-rs/canvas` (rasterizza i tratti e le foto); se sta altrove `CANVAS_MODULE=/…/@napi-rs/canvas/index.js`.
- **Dati**: `bench/cases.ts` (catalogo P1–P7), `bench/synthInk.ts` (scrittura sintetica deterministica:
  tratti con rumore, cifre alte 46–68 px, stili `normal` / `tight` / `touch`, dove `touch` = cifre a
  contatto con le parentesi, il caso peggiore).
- **Lancio tipico** (2 shard in parallelo ≈ 10–12 min; la sandbox ha 2 CPU e 2 GB: non più di 2 processi):
  ```
  cd client && for i in 0 1; do (CANVAS_MODULE=… MODEL_BENCH=1 BENCH_SEEDS=2 BENCH_SHARD=$i/2 \
    BENCH_OUT=/tmp/benchN_$i.json npx vitest run src/lib/bench/handBench.test.ts > /tmp/benchN_$i.log 2>&1 &); done
  python3 src/lib/bench/compare.py /tmp/benchPrec /tmp/benchN --fails     # per classe/stile, migliorate/peggiorate
  ```
  Filtri/varianti: `BENCH_FILTER="^P3-"`, `BENCH_RAW_CACHE`, `BENCH_ROUND=1` (punti a pixel INTERI come
  gli eventi mouse), `BENCH_H=<px>` (altezza delle cifre).
- **Diagnosi di un caso**: `oneCase.test.ts` (grezzo / modello-resto / finale), `stageDump.test.ts`
  (QUALE stadio toglie ogni tratto), `shapeProbe.test.ts` (candidati parentesi e profilo), `modelProbe.test.ts`
  (varianti d'inchiostro al modello), `trace.test.ts` + `trace.py` (PNG colorati degli stadi),
  `classAudit/tipStats/roundStats/geoAudit.test.ts` (matrici di confusione delle parentesi senza modello).
  I test diagnostici girano SOLO con la loro variabile d'ambiente (`describe.skipIf`): nella suite normale sono «skipped».
- **Foto** (Tesseract reale in Node con shim del canvas; `tesseract.js` va importato PRIMA dello shim di `document`):
  `photoBench.test.ts` (`PHOTO=1`; senza specifiche usa le 3 righe della foto in `bench/fixtures/foto-esercizi.png`;
  `PHOTO_SPEC_FILE=` per insiemi più grandi, `PHOTO_TUNE='{"letterToDigit":0.15}'` per variare `TUNE`,
  `PHOTO_TARGET_H=` per variare l'altezza obiettivo delle cifre, `PHOTO_NO_RECONCILE=1` per l'A/B senza
  riconciliazione, `PHOTO_RECON=1` per stampare glifi/simboli prima-dopo), `photoSynth.py` (righe stampate sintetiche),
  `photoVariants.py` (varianti realistiche della foto), `photoSweep.sh` + `photoSweepSummary.py` (misura di una
  configurazione su entrambi gli insiemi), `letterBench.test.ts` (SICUREZZA: le variabili non devono diventare cifre),
  `bracketBench.test.ts` + `genBracketFixtures.cjs` (→ `printedBracket.fixtures.ts`, le maschere ASCII dei test unitari).
- **Collaudo nel browser**: `exportStrokes.test.ts` scrive in JSON i tratti sintetici (cifre H=38 px per il canvas dell'app,
  476×136) da riprodurre con `MouseEvent` sul `<canvas>`; `strokesCheck.test.ts` ripete un'espressione con più semi/altezze
  (`CHECK_ROUND=1` per i pixel interi) e mostra anche la lettura del solo modello.

### c) Scrittura a mano — cosa è cambiato e PERCHÉ (per file)

Il banco ha mostrato che il modello da solo legge il 42% (e sulle sole parentesi il 2%): il resto lo fa la
geometria, che però prima rovinava il 17% delle letture già giuste («guasta»). Le correzioni, in ordine di effetto:

1. **`dedupeIdenticalStrokes` (`supScript.ts`) cancellava una diagonale della «x»**: due tratti con lo stesso
   riquadro (±3 px) erano «duplicati». Ora duplicato = stesso riquadro **e stessa forma** (24 punti per arco,
   verso diretto o inverso, distanza media ≤ min(4 px, 15% diagonale)). Prima `x[x+1]` → `1[+1]`.
2. **Tratto trafitto e incrocio (`inkContext.ts`, `dotSigns.ts`)**: `crossesOther` e `piercedByOther` (un altro tratto
   passa nel riquadro interno al 20%) contano come CONTATTO: né la «x» piccola né la gamba a «L» del 4 vengono
   mangiate come «puntino» (`45+78` → `\cdot 15+78`).
3. **Due punti e ÷ come ITEMS di posizione** (`dotSigns.ts`, flag `COLON_AS_ITEM`): niente barra sintetica nell'inchiostro
   del modello (veniva letta «.»/`\cdot`); guardia 1 dei due punti allentata se la coppia è centrata sulle cifre
   (`18:3`). Il puntino di moltiplicazione resta SEMPRE un puntino, mai una «x» (regola 27/9).
4. **Composizione per ATOMI e per x ASSOLUTA (`composeLatex.ts`, nuovo)**: i segni e le parentesi estratti
   (`items`) e gli esponenti (`exps`) vengono ricomposti con il LaTeX del modello allineando le COLONNE di inchiostro,
   non più per «frazione della lunghezza della stringa» (fragile con glifi larghi/stretti). Gli indici di inserimento non
   cadono mai dentro `^{…}`, `\frac`, `\sqrt`; i pareggi di ancora si risolvono con la x reale del centro. Aggiunte:
   `timesToLetterX` (un `\times` grande è la LETTERA x, uno piccolo è `\cdot`), `dedupeHallucinatedBrackets` (parentesi
   uguale inventata dal modello accanto a quella estratta → scartata: `[3]^2` non diventa `[3]]^{2}`).
5. **Apici su basi virtuali (`supScript.ts`)**: `extractSuperscripts(strokes, extraBases)` agganciano l'esponente
   alle parentesi chiuse ESTRATTE e agli 8 estratti (`[3]²`, `{x+1}³`, `8²`); `isOperatorCluster` (+ e − non sono mai
   apici né basi); `SUP_BOTTOM = 0.12` (la cifra DENTRO una parentesi non è apice: `(-2)^2`, `(2+3)(4-1)`).
6. **Parentesi (`squareBrackets.ts`, `bracketProfile.ts`)**: profilo geometrico del glifo (polarità, bordi, depth, endWidth,
   tick); `absorbBracketTicks` assegna i tick all'asta PIÙ VICINA; quadre multi-tratto con asta dritta; `mergeStackedHalves`
   (due metà impilate); `promotePairs` (pila apri/chiudi: debole + forte dello stesso tipo → entrambe forti); `contentRefs`
   (soglie separate per cifre/lettere e per tonde); «pezzo di SOLE parentesi» (`bracketOnlyPiece`, anche in modalità
   rilassata) estratto per intero SENZA chiamare il modello (P1: 14% → 97%); `isBraceTip` (la punta della graffa: tonde
   0,0% di falsi, graffe 86,8%); `restoreSquareBrackets` usa la stessa tipizzazione con abbinamento (prima una `}` ben
   estratta diventava `]`).
7. **`gapClose.ts` (nuovo)**: per il MODELLO si chiudono i vuoti larghi lasciati dalle parentesi/segni tolti (il modello
   inventava un `+` in `3·[2x+1]`), ma SOLO i vuoti che contengono la x di un elemento tolto (la spaziatura naturale
   `4 -` non si tocca: `14-8` non diventa `14-=8`).
8. **Barre del meno**: `MINUS_BARS_OUT = false` (A/B del banco: 60 → 64%; togliere le barre cambiava il contesto del modello).
9. **Display**: `prettyPiece`/`prettyExpression` mai `\{`, `\}`, `\lbrace`, `\rbrace` nel testo mostrato.

Correzioni del 6/10 sera, nate dalla cattura REALE del canvas (le scritture sintetiche a decimali non le mostravano):

10. **Regola quadra/tonda (`classifyProfile`, `bracketProfile.ts`)**: a cifre piccole e punti interi bastava 1 px di scarto per dare a una `(` stretta un «angolo» artificiale e farla leggere `[`. Una tonda è ora «quadra» solo se `hTick` ∨ [1 angolo ∧ uncino (`endWidth`) ≥ 0,12] ∨ [2 angoli ∧ uncino ≥ 0,08] (`tickVeryWide`). Test `bracketTick.test.ts` con la tonda catturata dal canvas (`bench/fixtures/uiCanvasRoundOpen.json`). Da sola questa regola migliora la scala normale (+3/0) ma a H=38 faceva leggere `(` la `{` debole (6 peggiorate): da qui il punto 13.
11. **Piccoli segni RELATIVI (`SMALL_REL`, `dotSigns.ts`)**: puntini e segni piccoli si misurano rispetto al tratto più ALTO dell'espressione, non con soglie assolute in pixel. A cifre di 38 px una cifra a tratto singolo (un `3` di 16×33 px) rientrava fra i puntini: veniva TOLTA dall'inchiostro e al suo posto tornava `\cdot` (`(-3)` → `(-·)`, `[2][3]` → `[2][·]`, `{2+1}3` → `{2+1}·`) e due cifre piccole impilate potevano passare per « : ». Il limite è ora min(`SMALL_MAX` = 34 px, `SMALL_REL` = 0,55 × tratto più alto), mai sotto `DOT_MAX`. Test `dotSignsScale.test.ts` (il puntino vero di `3*4` e il due-punti di `12:3` si riconoscono ancora).
12. **Otto (`rowCrossings`, `inkSigns.ts`)**: un tratto è un 8 solo se la vita è stretta E la riga centrale è attraversata almeno 2 volte. A H=38 l'occhiello di una `b` (`3a(b+1)` seme 1574, `(a+b)(a-b)` seme 9714) non è più un 8, mentre l'8 di `14-8` resta riconosciuto. Test `eightScale.test.ts`.
13. **`promoteRoundOpeners` (`squareBrackets.ts`)**: una chiusura graffa FORTE senza apertura graffa, la cui apertura più vicina non abbinata è una TONDA, non può essere `(…}` (matematica non valida): l'apertura diventa una graffa debole. SOLO l'apertura (una `)` senza `(` è comune e `{2·(3+1)}` si romperebbe). Va applicata in **`rewriteBrackets` E in `detectBracketKinds`**: `finalizePiece` → `restoreSquareBrackets` lavora sull'inchiostro INTERO e ri-tipava `(` la `{` appena estratta (scoperto solo col modello reale). Test `roundOpeners.test.ts` (27: unit, integrazione, e mutation check: senza i due passi falliscono 6 e 9 test).
14. **`pieceCount.ts` — limite «MAX 10 ELEMENTI ALLA VOLTA (dal 21/10/2026 giro 19; prima 5 dal 7/10, prima ancora 8)»**: `countElements` / `MAX_PEZZO = 10`; le parentesi GRAFFE `{ }` NON contano (decisione dell'utente 6/10: `{[(3+2)]}` vale 7 ed è accettata). Tonde, quadre, cifre, lettere, operatori ed esponenti contano 1 ciascuno.
15. **`strokeRecorder.ts`**: il canvas registra il tratto in corso in un registratore (fonte di verità sempre aggiornata) e i gestori non rileggono lo stato React. È un irrobustimento DIFENSIVO: nel codice precedente non si è misurata nessuna perdita di punti, quindi NON era la causa dei difetti.

Per ogni difetto trovato c'è un test PERMANENTE (suite unitaria senza modello, vedi sotto) e, dove serve, il caso
nel catalogo del banco. Le soglie sono calibrate con statistiche (es. regola `isBraceTip`), non a occhio.

### d) Foto — la causa del `4²` letto male e le correzioni

- **Causa (misurata con il banco foto)**: `enhanceForOcr` portava il lato CORTO del ritaglio a 1100 px: una riga 570×49
  diventava 12 800×1100 (cifre di ~420 px, 13 s, 14 Mpx). A quella scala Tesseract dava `4²` come UN solo «4» con riquadro
  largo il doppio e la regola 3 di `ocrGeometry.ts` (cifra larga ≈ quadrata = «+») lo trasformava in «+»; a scala bassa
  usciva `4^22` (un «2» spurio con riquadro senza inchiostro): esattamente i due sintomi segnalati.
- **`glyphScale.ts` (nuovo)**: `estimateDigitHeight` (Otsu → componenti connesse → mediana delle alte) e `scaleForDigits`:
  le cifre vengono portate a `DIGIT_TARGET_PX = 60` px (misurato: 40/50/55/**60**/70/80 → totale 105/104/101/**109**/101/97
  su 121 casi; oltre 70 i glifi si fondono). Immagine ~10× più piccola e ~10× più veloce.
- **`ocrReconcile.ts` (nuovo, puro)**: i simboli di Tesseract si riconciliano con i GLIFI reali dell'immagine preparata:
  estrazione glifi (componenti connesse; i punti di «:» e le barre di «=» uniti; blob larghi divisi nel minimo di inchiostro),
  assegnazione MONOTONA glifo→simbolo, simboli senza inchiostro scartati (allucinazioni), simboli fusi (`{(`, `4²`, `)²`)
  ESPLOSI in parentesi/esponente `°`/cifra/segno, cifre, parentesi, segni ed esponenti PERSI reinseriti, `=` a barra
  singola → `-`, forma a croce → `+` (`isPlusShape`), lettera/segno a forma di cifra con template vicino → cifra
  (`TUNE.letterToDigit = 0.15`; `letterBench`: le variabili minuscole sicure stanno a ≥ 0,18), bordi del ritaglio e schegge
  scartati. Tutta la logica è provata da `ocrReconcile.test.ts` con maschere SINTETICHE (nessun canvas, nessun Tesseract).
- **`printedBracket.ts` (nuovo)**: il TIPO di parentesi stampata si legge dai PIXEL (profilo per fasce; `[`/`]` da allineamento
  dei bordi, `(` vs `{` dalla frazione di fasce al bordo sporgente) e corregge Tesseract: 98,9% a sfocatura moderata, 93% a
  sfocatura pesante (`bracketBench`).
- **`pickExponentRead` (`ocrGeometry.ts`)**: nel rileggere un esponente a template il ritaglio ESATTO ha la precedenza (entro
  `EXP_TIGHT_TOL = 0.05` dal migliore): il padding faceva entrare un pezzo della `)` vicina e `2^3` diventava `2^1`.
- **Regola 3 di `ocrGeometry.ts`** («cifra larga e bassa = +»): ha la guardia `h ≤ 0.9·H`; un glifo alto quanto una cifra non diventa mai «+».
- **`ocrDebug` (`ocr.ts`)**: gancio di DIAGNOSI (vuoto in produzione) per il banco (`onReconcile`, `skipReconcile`). L'app NON legge
  variabili d'ambiente: gli override del banco sono `vi.mock("../glyphScale")` e `globalThis.__…`.
- **Nessun calcolo automatico dopo la foto** (invariante, richiesta esplicita): la foto produce solo il TESTO nel campo
  tastiera («ESPRESSIONE TRASCRITTA DALLA FOTO: CONTROLLA IL TESTO E PREMI ✓ CONFERMA E CALCOLA»); i passi partono solo dopo la
  conferma e ciascuno attende il risultato dell'utente.
- **`CropDialog`**: la foto piccola è mostrata a lato lungo ≥ 560 px senza toccare il ritaglio né la libreria dei riquadri (verificato:
  foto 290×30 → 576×60).

### e) Verifica nel browser (modello CoMER e Tesseract.js REALI)

Procedura ripetibile (anche in produzione): caricare la foto con `fetch('/__test/riga.png')` → `File` → `DataTransfer` →
`input[type=file]` SENZA `capture` → evento `change`, poi «CONFERMA TAGLIO»; per la mano, riprodurre i tratti di
`exportStrokes` con `MouseEvent` sul canvas (le cartelle `client/public/__test` servono SOLO per il collaudo e NON vanno
mai committate né pubblicate).
Esito 6/10: righe A, B, C della foto lette ESATTE nel browser (`(2+5^2):(4^2-2*5-3)+48:(6^2-2^3)`, `{(6^2:4-3^2*8^0)^2+10^2-[5*3^2+(100:25)^2]}`,
`9^2-{3^3*2+5*[7-(4^2-3*2^2):2]-3^1}+1`); `[(2)]` a tratti ravvicinati (il caso 1470 che sbagliava) letto esatto.
Nota: il campo tastiera memorizza la divisione come `/`, la pagina la mostra con «:».

Esito 6/10 (sera, dopo i punti 10–15): `{[(3+2)]}` a cifre piccole (replay a 3 ms, punti interi) letta **ESATTA** (prima `{[[3+2)]}`). Limite «MAX 8 ELEMENTI» provato con la correzione da tastiera: `{[(3+2)]}+` (8) accettato; `{[(3+2)]}+1` (9), `{(1+2)(3+4)}` (10) e `(1+2)(3+4)+5` (12) rifiutati con «Il pezzo ha N elementi: il massimo è 8.»; `{{[(3+2)]}}` (7, graffe doppie) accettato; il messaggio sparisce dopo una correzione valida. ⚠️ Nelle sonde del browser escludere il proprio `#__probe` quando si cerca testo nel `body` (la sonda ritrovava il proprio log).

### f) Limiti noti (da non nascondere)

- **Scrittura PICCOLA con coordinate a pixel INTERI** (mouse, LIM): a cifre alte ~38 px il banco (684 letture) sta al **77%** contro l'88% delle cifre normali; punti deboli: P4 (parentesi annidate + operatori) 54%, P5 (parentesi + lettere) 64%, stile `touch` 61%. Prima delle correzioni del 6/10 `{[(3+2)]}` scendeva da 11/12 (decimali) a 5/12 (interi): ora **6/12** (a 50 px 9/12, a 60 px 11/12). Stessa prova, punti interi, 12 semi, a 38 / 50 / 60 px: `3*(2+4)` 6/12 · 12/12 · 12/12, `{5+1}` 9/12 · 12/12 · 11/12, `[(2)]` 11/12 · 12/12 · 12/12 (a 38 px sbagliano anche cifre che non c'entrano con le parentesi: `3\cdot(2^{1}+1)`). **Consiglio pratico: scrivere con cifre alte almeno ~50 px** sul canvas di 476×136. Causa: il rumore di ±0,5 px su punti ogni ~4 px sporca le regole geometriche (graffa letta `[`, tonda letta `[`). **Il lisciamento dei tratti (filtro [1 2 1]) è stato PROVATO e SCARTATO**: 58/96 senza filtro, 56/96 con una passata, 47/96 con due. La strada seguita (e da proseguire) è rendere più tolleranti SOLO le regole del classificatore delle parentesi (angoli/uncino, `promoteRoundOpeners`), non filtrare tutto l'inchiostro.
- Stile `touch` (cifre a contatto con le parentesi): 71%. Errori tipici: `4` letto `1^{1}`, `(3+4)` → `\beta`, `1`/`+` → `H`.
- `{2+1}3`: la `}` con cuspide debole (≈ 8% di mancati). `[2][3]` touch → `[2]^{3}[]`.
- Foto con cifre alte meno di ~14 px (risoluzione pessima) o 290 px di larghezza: Tesseract sbaglia (`5²`→`52`, `2³`→`2^1`); l'app
  non si blocca e chiede di controllare il testo. Una seconda passata «se non valida» non basta: le letture errate sono
  sintatticamente valide.
- Le tre righe della foto sono note, ma altre foto (calligrafia a mano, ombre, prospettiva) NON sono coperte dal banco: segnalarle con la foto.

### g) Regole d'oro per chi continua

1. **Mai correggere a occhio**: aggiungere il caso al banco, misurare, correggere, ricomisurare con `compare.py` (0 peggiorate).
2. Una soglia nuova si calibra con una statistica (`tipStats`, `classAudit`, `letterBench`, `bracketBench`), non con un solo esempio.
3. Un A/B sul banco prima di cambiare un default (`MINUS_BARS_OUT`, `COLON_AS_ITEM`, `DIGIT_TARGET_PX` sono tutti misurati).
4. La suite unitaria (520 test) NON usa il modello né Tesseract: gira ovunque e in pochi secondi; il banco è solo manuale.
5. Niente variabili d'ambiente nel codice dell'app: l'override per il banco passa da `globalThis.__…` o `vi.mock`.
6. Prima di consegnare: `npx tsc --noEmit`, suite completa, `pnpm build`, **cancellare `client/public/__test`**, checkpoint, anteprima.
7. **Misurare a DUE scale** (normale e `BENCH_ROUND=1 BENCH_H=38`): una regola che migliora una può peggiorare l'altra (la regola degli angoli: +3/0 a scala normale ma 6 PEGGIORATE a H=38 finché non è arrivato `promoteRoundOpeners`). Si accetta solo con 0 peggiorate su ENTRAMBE (`compare.py` o un confronto per id/stile/seme).
8. **Ogni decisione di `rewriteBrackets` va ripetuta in `detectBracketKinds`**: `finalizePiece` → `restoreSquareBrackets` lavora sull'inchiostro INTERO (anche i tratti già estratti) e ri-tipa le parentesi; se le due funzioni non concordano, la parentesi estratta torna sbagliata (`{5+1}` → `(5+1}`). I test sintetici di `rewriteBrackets` erano verdi: l'errore è emerso solo con la pipeline completa e il modello reale (`pipeProbe`).
9. **Un problema segnalato dall'utente su un canvas reale va riprodotto con la cattura REALE** (tratti registrati dal browser, punti interi), non con scritture sintetiche: è così che si è trovata la causa dei 4 difetti del 6/10 sera.

**In produzione dal 6/10/2026** (deploy 7499, commit 220b820): entrambe le URL
(`espressioni-monomi-polinomi.easy-peasy.site` e `deploy-2a7acf3f-6909-wmoltmgh5q-uc.a.run.app`)
servono il bundle di questa versione (`index-D9aV583b.js` / `index-BsliUCG4.css`, verificato con
`curl` e confrontato con l'hash della build locale). Il pacchetto ZIP aggiornato (236 file,
`template.json` escluso perché è un metadato dello scaffold) è verificato ricostruendo da zero:
`pnpm install --frozen-lockfile`, `pnpm check`, `pnpm build` → stessi hash degli asset e 520 test
verdi anche nell'albero ricostruito.

**7/10/2026 — suggerimento «scrittura piccola»** (`lib/smallWriting.ts`, test `smallWriting.test.ts`, 4): dopo la lettura di un pezzo a mano, se l'altezza MEDIANA dei tratti (esclusi puntini/trattini < 15 px) è sotto 44 px l'app mostra un toast informativo non bloccante («Hai scritto piccolo: controlla il pezzo letto…»). NON modifica mai la lettura. Errori residui del banco a H=38 (160/684): cifre a contatto (`touch`) e `]` letta `)` in `{[2]}` (14 casi); possibile passo futuro: promozione simmetrica delle CHIUSURE tonde (come `promoteRoundOpeners`), da misurare a due scale. Suite: 520 test.

**7/10/2026 — `promoteRoundClosers`** (squareBrackets.ts, speculare di `promoteRoundOpeners`; 6 test in `roundOpeners.test.ts`, suite 489): una `)` non abbinata dopo una `[` forte viene promossa a `]`. Misurato a due scale (bench25/26 contro bench23/24): **risultati identici** (88% a cifre normali, 76,6% a H=38; 0 peggiorate, 0 migliorate): la promozione è innocua ma NON scatta sui 5 casi residui. Diagnosi: nei casi `{[2]}` e `5-[2+(3-1)]` la `]` non viene estratta da `rewriteBrackets` (resta nell'inchiostro e il modello la legge `)`), mentre `restoreSquareBrackets` (recognizePiece.ts) non interviene; in `3[2(1)]` e `[2+1]5` la `]` quasi dritta non è nemmeno rilevata come quadra. Il reinserimento è per posizione (`recognizePipeline.ts` ~L283, composeLatex): ogni parentesi ESTRATTA torna col tipo giusto. Prossimo passo, solo se serve (0,7% dei casi): estrarre la `]` debole in `rewriteBrackets` con guardie e misurare a due scale. `oneCase.test.ts` accetta ora `BENCH_H=38 BENCH_ROUND=1` per riprodurre i casi del banco.

**7/10/2026 — chiusura debole «quasi alta»** (`promotePairs`, costante `NEAR_TALL_FRAC = 1.04`; 4 test in `roundOpeners.test.ts`, suite 493). Diagnosi dei residui `]`→`)`: in `{[2]}` e `5-[2+(3-1)]` la `]` era una candidata DEBOLE di 45–48 px contro cifre di 43 e la guardia del 12% la scartava per un soffio. Nuova regola: una chiusura debole alta almeno 1,04× il contenuto e almeno il 75% dell'apertura, con apertura alta/forte dello stesso tipo e contenuto in mezzo, completa la coppia. Una «1» (≈1,00× il contenuto) resta esclusa (test dedicato). **Misura a due scale (bench27/28 contro bench25/26): 0 peggiorate, 4 migliorate a H=38 (P2 86%→90%, totale 77%) e 1 a cifre normali (P4 77%→78%, totale 88%).** Restano non risolti `3[2(1)]` e `[2+1]5`: la `]` quasi dritta non è nemmeno candidata (firma insufficiente, confondibile con `1`): non forzare senza nuova evidenza.

**In produzione dal 7/10/2026** (deploy 7499, commit 35dead2, bundle `index-D9aV583b.js`): include suggerimento «scrittura piccola», `promoteRoundClosers` e la chiusura debole «quasi alta»; 520 test.

**7/10/2026 — `]` quasi dritta per esclusione** (`inferMissingCloser` in squareBrackets.ts, usata da `rewriteBrackets`; 6 test in `roundOpeners.test.ts`, suite 499). Casi `3[2(1)]` e `[2+1]5`: la `]` è un tratto quasi dritto che non supera il rilevatore e si confonde con `1`/`)`. Regola: se esiste UNA SOLA quadra forte che apre senza chiusura quadra (né chiusure quadre orfane), a destra e con contenuto in mezzo, un UNICO tratto libero sottile (larghezza ≤ 0,45·altezza), alto ≥ 1,3× la mediana delle cifre, ≥ 1,15× la più alta delle altre e ≥ 85% dell'apertura, è la `]`. Entra come candidata DEBOLE e attraversa tutte le guardie (promotePairs, soglie di altezza). Un «1» alto come le cifre, due candidati o niente contenuto in mezzo: nessuna inferenza (test dedicati). **Misura a due scale (bench29/30 contro bench27/28): 0 peggiorate; H=38 77%→78% (+3: P3 75%→77%; stile normal 88%→89%), cifre normali invariate 88%.** Non toccata la lettura di nessun altro caso.

**7/10/2026 — tentativo SCARTATO: apertura debole «quasi alta»** (simmetrico della chiusura debole quasi alta, in `promotePairs`: `[` debole di 45 px su cifre di 42 con `]` forte). Banco a due scale (bench31/32 contro bench29/30): a cifre normali 0 migliorate / 0 peggiorate; a H=38 **2 migliorate e 2 peggiorate** (`[2*(3+4)]:5` letta `(3+4]]`, stili normal e tight). Bilancio nullo e criterio «0 peggiorate» violato: codice annullato, nessuna modifica rispetto al commit `35dead2` (520 test). Anche il rilassamento di `tall(o)` in `promoteRoundClosers` non risolveva `[(5-2)*(4+1)]`. **Non ripetere** senza un segnale in più che distingua la `[` debole dalla `(` alta. Residui H=38 (153 su 684): 88 stile «touch» (cifre a contatto), 40 «tight», 25 «normal»: il margine sta ormai nella segmentazione delle cifre, non nelle regole sulle parentesi.

**In produzione dal 7/10/2026 (secondo deploy)**: deploy 7499, commit del codice 35dead2, bundle `index-D9aV583b.js` (verificato con `curl` su entrambe le URL e uguale alla build locale); include `inferMissingCloser` (`]` quasi dritta per esclusione). 520 test.

**7/10/2026 — limite per pezzo ridotto a 5 elementi + consiglio sulle parentesi** (richiesta dell'utente). `MAX_PEZZO = 5` in `client/src/lib/pieceCount.ts` (le graffe `{ }` continuano a NON contare; `{[(2)]}` vale 5, `(2x+1)` vale 6 e viene rifiutato). Testo della fase MANO: «MAX 5 ELEMENTI ALLA VOLTA» e, sotto, «E' CONSIGLIABILE DISEGNARE UNA PARENTESI PER VOLTA.» (`EspressioniExercises.tsx`). I messaggi d'errore usano `MAX_PEZZO`, quindi seguono da soli. Il BANCO resta invariato (conserva i casi più lunghi scritti col limite 8: servono a misurare, non a imporre il limite). Test: 499 (riscritti quelli di `pieceCount.test.ts`).

**7/10/2026 — «=» spuri da piedi e cappelli (giro 6)**. Tre regole in `inkSigns.ts` / `exprOcr.ts`, misurate a due scale (bench35/36 contro bench29/30): **0 peggiorate; H=38 +10 migliorate (78%→79%), cifre normali +2 (88%)**; 520 test.
1. *Piede dell'«1»* (`rewriteEqualSigns`): la barra inferiore sotto un tratto alto che la tocca e il cui centro cade nel suo intervallo orizzontale è la base di un `1`, non metà di un «=» (`-[3-1]` non diventa più `-[3=1]`).
2. *Cappello del «5»* (stessa funzione, simmetrica): la barra superiore con un tratto alto che parte subito sotto di lei è il cappello di un `5`/`7`/`T` (`12-5` non diventa più `12=5`).
3. *«-=» impossibile* (`collapseRepeatedMinus`): il modello leggeva «=» sul cappello del 4 e, sommato al meno sintetico, dava `14-=8`; la sequenza «-=» si riduce a «-». `=-` (`x=-3`) resta intatto.

**In produzione dal 7/10/2026 (terzo deploy)**: deploy 7499, commit del codice d63ad80, bundle `index-D9aV583b.js` (verificato con `curl` su entrambe le URL, uguale alla build locale, contiene il testo «E' CONSIGLIABILE…»); include limite 5 elementi per pezzo, consiglio sulle parentesi, guardie piede dell'1 / cappello del 5 e «-=» impossibile. 520 test.

**7/10/2026 — «+» dai tratti, a due passate (giro 7)**. Il modello leggeva la croce di un «+» a contatto con la cifra come «4» (`2+3` → `243`, `[2+1]5` → `[24]5`). Nuovo `client/src/lib/plusSigns.ts` (`rewritePlusSigns`, 7 test): due segmenti dritti (rettilineità ≥ 0,85), uno ~orizzontale e uno ~verticale, che si incrociano al centro di entrambi (frazione 0,38–0,62), bracci simili (0,55–1,8), un solo candidato. Un «4» (incrocio a ~70%), una «t», un «1» con piede e un «7» NON scattano. **Attenzione: estrarre SEMPRE la croce è stato scartato** (bench37/38: +12/−26 a H=38, +6/−23 normale: senza croce il modello legge male la cifra accanto). Soluzione tenuta: `recognizeInk` fa prima la lettura storica; solo se la geometria trova PIÙ croci dei «+» nel LaTeX (`probe` > `have`) rifà la lettura con la croce estratta (`recognizeInkCore(..., forcePlus)`). **Misura a due scale (bench39/40 contro bench35/36): 0 peggiorate; H=38 +9 (79%→80%), normale +3 (88%→89%).** Interfaccia: il consiglio «E' CONSIGLIABILE DISEGNARE UNA PARENTESI PER VOLTA.» è ora sulla stessa riga di «MAX 5 ELEMENTI ALLA VOLTA».

**In produzione dal 7/10/2026 (quarto deploy)**: deploy 7499, commit del codice 538e727, bundle `index-D9aV583b.js` (identico alla build locale su entrambe le URL, verificato con `cmp`); include il «+» dai tratti a due passate e il consiglio sulla stessa riga di «MAX 5 ELEMENTI ALLA VOLTA». 520 test. **Nota operativa:** subito dopo il deploy `curl` può restituire il bundle PRECEDENTE per cache; verificare con un parametro casuale (`/?n=$RANDOM`) e confrontare con `cmp` prima di dichiarare il deploy riuscito o fallito.

**7/10/2026 — «frazioni trascritte a mano devono essere trascritte IMPILATE» (giro 9)**. La pipeline riconosceva bene le frazioni (`\frac{1}{2}`) ma il SOLVER le linearizzava: il passo 0 (paren-unwrap) mostrava «1 : 2» come divisione. Correzioni in `espressioni.ts`: (1) il nodo di divisione ha il flag `fr` = «frazione impilata scritta dall'utente»; (2) `replaceLatexFractions` separa numeratore e denominatore con U+2044 (frazione) invece di `/`, e la whitelist di `normalizeInput` lo ammette; (3) `parsePower`: `a⁄b` lega più stretto di `·` e `:` (es. «2⁄3·3⁄4» è (2:3)·(3:4)); (4) `printNode` stampa i nodi `fr` come `\dfrac{num}{den}` (segno meno fuori dalle graffe, anche con termine negativo); (5) le regole di parentesi (`needsParensForMul/Div/Pow`, `soft`) NON avvolgono `\dfrac` in `\left( \right)`; (6) nel prodotto, due frazioni si mostrano con il PUNTINO (`\dfrac{2}{3} \cdot \dfrac{3}{4}`, mai giustapposte); (7) `pushNegThrough` preserva `fr`; (8) nel passo div-num con numeratore numerico il passo «a : b» viene saltato (la catena dei numeri usa già `\dfrac`); con LETTERE il dettaglio del passo è impilato (`\frac{x}{2} = \dfrac{x}{2}`, mai «x : 2»). Le divisioni scritte con i DUE PUNTI restano «a : b» ovunque (invariate). Test: +6 in `espressioni.test.ts` (520 totali, tutti verdi).

**19/10/2026 — «l'app ha calcolato da solo 1/2·1/5» (giro 11)**. Con espressioni tipo `(1/2·[1/5]) : 1/3` il prodotto DENTRO le parentesi tonde veniva emesso come passo `mul-terms`: nel percorso «risultato diretto» (`isDirectResult`, espressione numerica senza catena ±) il punto 3 «Riscrivo senza parentesi» viene SALTATO, quindi il passo non veniva mai proposto e l'app mostrava direttamente `(1/10) : 1/3` nel box del risultato finale — calcolato da sola. FIX: nuovo tipo di passo **`paren-prod`** in `espressioni.ts` per prodotti, potenze e radici DENTRO le parentesi (`insideParen`); `parenKinds` in `EspressioniExercises.tsx` e nella copia di `chainSelection.test.ts` include `paren-prod`, quindi il punto 2 («Risolvo le parentesi tonde») propone TUTTO il contenuto delle tonde, uno alla volta. Flusso corretto: `[1/5]=1/5` → `1/2·1/5=1/10` (punto 2, da svolgere) → `(1/10):1/3=3/10` (box risultato). I prodotti FUORI dalle parentesi restano `mul-terms` (punto 3). Test +4 in `espressioni.test.ts` (inclusa una replica della selezione del punto 2).

**19/10/2026 — «la divisione dentro la parentesi calcolata da sola» (giro 13)**. Con espressioni tipo `(3/7 : 9/14)^2 − 7/12·2` la divisione DENTRO le parentesi tonde veniva emessa come passo `div-num`: la UI non la assegnava a nessun punto (fuori da `lastParenIdx`, esclusa da `chainSteps` per via della catena ±) e l'app la calcolava da sola, mostrando già `(2/3)^2` nel punto 3. FIX: nuovo tipo di passo **`paren-div`** in `espressioni.ts` per le divisioni numeriche DENTRO le parentesi (`insideParen`); `parenKinds` aggiornato in `EspressioniExercises.tsx` e nella copia di `chainSelection.test.ts`. Flusso corretto: `3/7 : 9/14 = 2/3` (punto 2, da svolgere) → `(2/3)^2` e `7/12·2` (punto 3) → somma algebrica (punto 4). Le divisioni FUORI dalle parentesi restano `div-num`. Test +4 in `espressioni.test.ts`. Verificato nel browser.

## 34. FRAZIONI IMPILATE NELLE FOTO: la linea si cerca NEI PIXEL (19/10, giro 14)

**Problema**. Tesseract non vede le frazioni impilate come «num⁄den»: nella maggior parte dei
casi FUNDE l'intera frazione in UN simbolo alto («5⁄3» → un solo «3» con riquadro alto
2,3 volte la cifra; il banco foto scendeva a 0/35). In altri casi emette num e den come
item piatti e perde la linea, o legge la linea come «-»/«~».

**Architettura** (`photoFractions.ts` + blocco «FRAZIONI IMPILATE» in `ocr.ts`):
1. `findFractionBars(field, symbols)`: run orizzontali ≥ 9 px raggruppate per RIGHE a
   componenti connesse (ogni run si aggancia al gruppo della riga precedente con la migliore
   sovrapposizione ≥ 55%; l'accoppiamento a lista spezzava le barre multi-riga in singleton).
   Filtri: L/T ≥ 2,5; inchiostro sopra E sotto alto ≥ 0,4·L e voluminoso ≥ 0,04·L²
   (scarta «=» e «÷»); tratto interno di cifra scartato se contenuto in un simbolo
   alfanumerico di Tesseract ALTEZZA NORMALE (h < 1,7·medH0) — i simboli FUSI (≥ 1,7·medH0)
   sono candidati frazione legittimi; GAP TEST per gruppi sottili: almeno una delle due righe
   sopra (e sotto) la barra quasi vuota (tolleranza max(0,15·L, 3) px) — il gambo di una cifra
   (la barra del «4» dentro «000^4» fuso) riempie ogni riga; i BLOCCHI FUSI num+linea+den
   (T ≥ 0,8·medH0, foto piccole sfocate) sono esentati. Dedup: barre sovrapposte ≥ 40% e
   vicine ≤ 1,2·medH → tiene la più lunga; max 8.
2. `planPhotoFractions(symbols, bars)`: per ogni barra, `contain` = simboli che contengono la
   barra (±3 px, il glifo fuso: buttato SOLO se la frazione viene ricostruita); `drop` = in
   regione (x ±0,15·g, y ±1,5·g) SOLO cifre/lettere/«-»/«~»/punti — MAI operatori e parentesi
   (i «:» fra frazioni adiacenti restano); `above`/`below` = riserva; numBox/denBox con
   margini 0,15·g; piani la cui barra è contenuta in una barra più lunga (±0,2·g, ±1,5·g) sono
   scartati (barre-sotto-barra).
3. In `ocr.ts`: num/den letti da Tesseract su RITAGLIO INGRANDITO (PSM SINGLE_LINE, whitelist
   «0123456789x», upscale 4× se largo < 60 px) con SECONDO TENTATIVO più largo se vuoto;
   riserva dai simboli sopra/sotto filtrata SOLO cifre; se entrambi ci sono, sintetico
   «num\u2044den» con riquadro bar.y0-g .. bar.y1+g (l'app lo stampa impilato, mai decimale).

**Banco**: `PHOTO=1 PHOTO_SPEC_FILE=/tmp/fotofrac/specs.json` (35 casi sintetici con frazioni
impilate, digit_h 14–40): 0/35 → 8/35. Debug: `PHOTO_FRAC_DEBUG=1` stampa barre, piani e
letture num/den. A mano (A/B stesso shard): P1–P8 identiche, P9 16/30 → 20/30.

**Residui noti**: garbage del passaggio principale di Tesseract («tie», «h11»), «:» a volte
non emessi, cifre sbagliate su ritagli piccoli («9»→«0»), frazioni con num/barra/den saldati
in un blocco sottile indistinguibile dal gambo di una cifra.

### 34b. Correzioni del giro 15 (19/10 notte): soglie sull'ALTEZZA CIFRA, non su L
1. **Soglie d'inchiostro**: `minCnt = 0,1·medH0²` e `minInkH = 0,45·medH0` (prima
   `0,04·L²` e `0,4·L`). Motivo: la linea di «11⁄4» si fonde con le grazie serif dei
   due «1» e diventa più larga dei numeri (L=91 con cifre di 48 px) — con soglie ∝ L
   il den «4» (alto 0,55·cifra) restava sotto soglia e la frazione si perdeva.
2. **medH0 al 30° percentile** (prima mediana): i glifi fusi delle frazioni (≈2× la
   cifra) gonfiavano la mediana e i glifi fusi veri restavano sotto la soglia
   1,7·medH (caso 14: fuso alto 101 px, mediana 60 → 1,7·60 = 102 > 101).
3. **Controllo larghezza** per le barre che TOCCANO l'inchiostro sopra/sotto (gap test
   fallito): la linea di una frazione è larga 1,15× i suoi numeri → se l'inchiostro
   sopra/sotto supera 1,1·L è il tratto interno di una cifra (la «4» dentro
   «1000^4»). I riquadri Tesseract non bastano a contenere le barre fantasma (bbox
   sfalsati dalla riconciliazione): niente containment per questo caso.
4. **Ritagli stretti** (w ≤ 1,15·h, una cifra sola): PSM 10 con retry a riga se vuoto.
5. Debug: `FRACDBG` stampa anche `FRACSYM` (simboli post-riconciliazione con riquadri).
Residui: «9»→«0» sistematico sui ritagli sfocati (PSM 10 non basta), garbage del
passaggio principale («ie» per «*{»). Banco: 9/35 (da 0 al giro 13).

### 35. Riquadro «CONTROLLA PRIMA DI CONFERMARE» anche con la FOTO (giro 16, 20/10)
- Il riquadro ESISTEVA già per la foto (kbExpr → transSource) ma con testo OCR non
  analizzabile `analyzeExpression` lanciava e il riquadro mostrava il segnaposto.
  Fix: `transDisplay {kind:"latex"|"text"}` — se l'analisi fallisce si mostra il TESTO
  così com'è (`prettyExpression`, font-mono). MAI il segnaposto con trascrizione presente.
- Dopo la foto la vista scorre al riquadro (`transRef.scrollIntoView`, block:center, +200 ms).
- Soccorso di forma sui ritagli num/den di una cifra (`readRegionDigits`): letture
  PSM 10 + riga VUOTE → template matching (dist ≤ 0,35). NON sovrascrive mai letture
  non vuote (tentativo scartato: banco 8/35, «2⁄5»→corrotto — vedi notes giro 16).
- Banco foto 9/35 zero regressioni; suite 538 test. Via a mano invariata.

### 35b. Riquadro «CONTROLLA PRIMA DI CONFERMARE»: sempre matematica resa (giro 17, 20/10)
- Segnalazione: col giro 16 il riquadro «dava tutto sbagliato» (niente frazioni
  impilate né apici). Diagnosi: il fallback testuale del giro 16 mostrava il TESTO
  GREZZO quando analyzeExpression lanciava (foto con simboli mismatchati). Il percorso
  LaTeX era immutato (diff verificato 14b1f80..dabc9b2).
- Fix: transDisplay a 3 livelli: (1) analisi diretta; (2) pulizia da foto
  `normalizeExpressionOcr(transSource, true)` — light=true, NESSUN operatore o
  esponente inventato — e nuova analisi; (3) ultima spiaggia prettyExpression.
- Collaudo: parentesi mancante riparata, ⁄ impilate e apici ok. Suite 538 test.
- ATTENZIONE: la barra «/» digitata resta divisione «a : b» (semantica calcolo):
  NON convertirla in frazione impilata senza decisione esplicita dell'utente.

### 35c. FOTO REALE (3⁄7:9⁄14)²−7⁄12·2 letta «87/0/14^28122» (giro 18, 21/10)
- Segnalazione: la foto a mano dell'utente (fixtures/foto-parentesi-frazione.jpg,
  nel banco come riga «PF») usciva `87/0/14^28122`. Diagnosi con `PHOTO_RECON=1`
  + nuovo hook `ocrDebug.onReconcile` (passa `field`/`readers`/simboli prima-dopo)
  + log gated `RDBG` (`globalThis.__RECON_DEBUG__`): 5 difetti.
- Fix in `ocrReconcile.ts`:
  1. `isArtifact` NON scarta più OGNI componente alta ≥ 1,9·Hd: le parentesi scritte
     a mano attorno a una frazione sono legittimamente 2–3× la cifra e spariscono
     tutte. Scarto solo se a filo bordo del ritaglio o sottilissima (≤ 0,12·Hd).
  2. Percorso «glifo fuso»: la BARRA DI FRAZIONE fusa con la cifra si SALTA
     (larga ≥ 1,1·Hd, sottile ≤ 0,12·Hd, inchiostro SOPRA e SOTTO via `inkAboveBelow`)
     e CONTA come pezzo (`parts.length + skippedBar >= 2`): il simbolo fuso
     «( + barra + cifra» non resta più intero a coprire parentesi e numeratore.
     Un MENO lunghissimo fuso resta «-». MENO letto «i»/«l»/cifra con forma di
     tratto (markOf «-») → «-».
  3. Override cifra a MARGINE NETTO (stessa regola di templateRead): nuovo reader
     `readers.distTo(box, digit)` (distanza a template di UNA cifra, implementato
     in `ocr.ts` con `normalizeGlyph`+`glyphDistance`); `refine` corregge Tesseract
     solo se il template è netto (dist ≤ 0,12) e la lettura Tesseract peggiore di
     +0,08 (il «2» finale di …·2 letto «7»: template 2/0,083).
- Fix in `printedBracket.ts`: `bracketLike` fino a 3,2·Hd (era 1,9·Hd).
- Fix in `photoFractions.ts` (`planPhotoFractions`):
  4. PARENTESI CHE ABBRACCIA LA FRAZIONE: il margine 0,15·g del numBox/denBox può
     includere un lembo di parentesi (alta ≥ 1,5·g e stretta ≤ 0,55·h) → il ritaglio
     inizia DOPO di lei (nx0/nx1 con clamp su simboli alti-stretti a cavallo del margine).
  5. Ritaglio verticale 1,4·g (era 1,2·g): una cifra a mano può sporgere ~1,35·g
     sopra la barra — tagliata in cima il «3» si leggeva «5».
- Fix in `ocr.ts` (`readRegionDigits`): `trimEdgeFullHeight` — colonne di inchiostro
  a TUTTA altezza sui bordi del ritaglio (corsa ≤ 0,35·w) cancellate prima dell'OCR.
- Debug: `diagParen.test.ts` creato e RIMOSSO a fine giro (riprodurre con
  `ocrDebug.onReconcile`); rimesso il catch silenzioso su foto illeggibili.
- ESITI: foto reale PF 0/1 → 1/1 (permanente nel banco, 4/4 con le 3 righe A/B/C);
  sintetico 76/85 e varianti reali 33/42 = identici al baseline `sweep_h60`
  (DIGIT_TARGET_PX=60); mano 87% (banda storica 87–89%); suite 539 test; tsc ok.
  Collaudo browser: percorso tastiera con «CONTROLLA PRIMA DI CONFERMARE» ok.

### 35d. VIA ALLA FOTO, DENTRO LA DITTATURA VOCALE (IT/EN/ES/FR) + LIMITE 10 (giro 19, 21/10)
- Richiesta dell'utente: «togli la possibilità di scattare foto e inserisci al suo posto la
  possibilità di dettare vocalmente (in italiano, inglese, spagnolo e francese)
  l'espressione. L'utente detta premendo un pulsante e quando finisce ripreme il pulsante.
  Controlla l'esattezza dell'espressione e poi conferma». E: «aumenta a 10 elementi il
  massimo di quelli che si possono scrivere manualmente volta per volta».
- FOTO RIMOSSA dall'interfaccia (`EspressioniExercises.tsx`): via i pulsanti SCATTA/CARICA,
  gli input file nascosti (con `capture="environment"`), il `CropDialog`, l'incolla da
  appunti (Ctrl+V immagine) e tutto lo stato OCR (`ocrBusy/ocrProgress/ocrError`,
  `runOcr/handleOcrFile/onCropConfirm/closeCrop`). ⚠️ Le LIBRERIE foto restano nella repo
  e funzionano (servono al banco foto `PHOTO=1`): rimosso solo il punto d'ingresso UI.
- DITTATURA VOCALE:
  - `client/src/lib/dictation.ts` (NUOVA, parser PURO + 14 test in `dictation.test.ts`):
    `DICT_LANGS` (it-IT, en-US, es-ES, fr-FR), `transcriptToExpression(transcript, lang)` →
    `{ expr, unknown }`. Emette ASCII compreso da `normalizeInput` (+ - * : ^ ( ) [ ] { } =
    e lettere). Semantica: «diviso/divided by/dividido por/divisé par» → `:`; «tre settimi»
    (numero + ordinale) → `3:7` (come la tastiera: `/` = divisione); «moltiplicato/por/fois»
    → `*` (la resa è sempre «·», MAI «×»); parentesi SOLO pronunciate («parentesi tonda
    aperta…», «open parenthesis…», «abre paréntesis…», «ouvre la parenthèse…»), MAI inventate;
    «al quadrato/al cubo/all'N» → `^2/^3/^N`; «due punti» (it/es/fr) → `:` PRIMA del numero;
    parole non riconosciute → elenco `unknown` (l'app le segnala col toast, MAI simboli
    inventati). Numeri: parser additivo/moltiplicativo condiviso (centinaia/migliaia
    moltiplicano, unità si sommano solo su parziale tondo: «novanta nove»→99 ma «tre
    sette»→due numeri); ITALIANO: composti uniti generati fino a 9999 («duemilatrecentoventi»);
    FRANCESE: «quatre-vingt»→80, «soixante-dix»→70; SPAGNOLO: centinaia irregolari
    (quinientos…), «treinta y cinco»→35; INGLESE: «one hundred and five»→105.
    Ordinali-frazionario fino al 20 in tutte le lingue («quattordicesimi»→:14, «fourteenths»,
    «décima», «quatorzième»).
  - UI (`EspressioniExercises.tsx`): al posto di SCATTA/CARICA c'è il selettore lingua
    (ITALIANO/ENGLISH/ESPAÑOL/FRANÇAIS) + pulsante **🎤 DICTA / ⏹ FERMA** (icona Mic/Square,
    rosso durante l'ascolto). Web Speech API (`SpeechRecognition`/`webkitSpeechRecognition`),
    `continuous=true` + `interimResults=true`, riavvio automatico in `onend` finché l'utente
    non preme FERMA (ref `dictatingRef`); trascrizioni finali in `finalRef`, interim in
    `interimRef` e mostrate live nel pannello «🎙 STO ASCOLTANDO…». Alla FERMA:
    `transcriptToExpression` → `setPieceMode("keyboard")` + `setKbExpr(expr)` → toast
    (con le parole non capite, se ci sono) → scroll al riquadro «CONTROLLA PRIMA DI
    CONFERMARE» → l'utente conferma con ✓ CONFERMA E CALCOLA (mai calcolo automatico).
    Browser senza Web Speech API (Firefox/Safari vecchi) o microfono negato → messaggio
    chiaro e invito a usare la TASTIERA. Pannelli di stato `role="status" aria-live="polite"`.
- LIMITE ELEMENTI: `MAX_PEZZO` 5 → **10** in `lib/pieceCount.ts` (le graffe { } NON contano,
  invariato); testo «MAX 10 ELEMENTI ALLA VOLTA» (stessa riga del consiglio parentesi);
  `pieceCount.test.ts` aggiornato ((2x+1)=6 ora ammesso; 11 elementi rifiutato).
- Docs aggiornate: README (per lo studente), REBUILD (checklist), AGENTS (tabella file),
  GUIDA-IA §14 + questa sezione. Non toccati: motore, riconoscimento mano/foto, PDF,
  cornice dinamica (nessun riferimento alla foto).
- **GIRO 19-BIS (21/10) — PARENTESI ELASTICHE nella dettatura**: il riconoscimento vocale
  scrive le parentesi dette in MOLTISSIME forme («parentesi tonda aperta», «parentesi TONDE
  APERTE», «APRI LA parentesi», «aperta parentesi», «chiudi LA parentesi tonda», «open THE
  parenthesis»…) e l'elenco fisso di frasi non le copriva. Nuovo pre-pass `prepassParens`
  in `dictation.ts` (chiamato PRIMA del parser): un GRUPPO parentesi = parola di DIREZIONE
  (apri/aperta/chiusa/chiudi…, con plurali e forme verbali) + parola di TIPO
  (tonda/quadra/graffa/parentesi…, generic = tonda) entro una finestra di 4 parole,
  nell'ORDINE INVERSO ammesso e con ARTICOLI riempitivi (la/il/le/the/el…; «un/una/une»
  SOLO dentro i gruppi: fuori sono numeri, fr «trois moins un» → 1). Il gruppo SI CHIUDE
  appena ha direzione+tipo SPECIFICO (il generico non chiude: «parentesi quadra»), così
  non inghiotte la parentesi successiva («…chiusa parentesi tonda chiusa…»). Un residuo di
  tipo orfano subito dopo una parentesi emessa («chiudi la parentesi tonda» → il «tonda»
  avanzato) è SCARTATO IN SILENZIO; una «parentesi» SENZA direzione resta ignota
  (unknown: MAI inventata). Le frasi-parentesi fisse sono state TOLTE dalle 4 lingue
  (le copre il pre-pass). 10 nuovi test in `dictation.test.ts` (24 totali, suite 563).
  Collaudo browser: «apri la parentesi tre settimi due punti apri la parentesi nove
  quattordicesimi chiudi la parentesi tonda chiudi la parentesi al quadrato meno sette
  dodicesimi punto due» → `(3:7:(9:14))^2-7:12*2`, riquadro `((3:7):(9:14))² − (7:12)·2`.
- 23/10/2026 (giro 20): **IA VISION per FOTO e SCRITTURA A MANO** (richiesta: «il riconoscimento
  delle foto e della scrittura a mano è ancora molto critico, fallo funzionare con l'intelligenza
  artificiale»). L'app è passata da web-static a **web-db-user** (Drizzle + Neon, `pnpm db:push`;
  il DB non è usato dall'app: serve solo per l'infrastruttura). NUOVA ROUTE SERVER `POST /api/ai/transcribe`
  (`server/index.ts`, `registerAiRoutes`): body `{ image: dataURL, kind: "photo"|"ink" }` → chiama
  l'endpoint OpenAI-compatible di Easy-Peasy AI (`https://easy-peasy.ai/api`, modello **gemini-3-flash**,
  OpenAI SDK, temperatura 0, timeout 90 s) con un CONTRATTO STRETTO: trascrivere SOLO (mai risolvere,
  mai calcolare, mai semplificare), formato ASCII dell'app (+ - * : ^ √ ( ) [ ] { } =, frazioni
  impilate come `3⁄7` con U+2044, simbolo illeggibile → `?`), niente LaTeX/markdown/commenti,
  ignora numeri d'esercizio e testi del libro. **Senza `EASY_PEASY_API_KEY` la route risponde 503**
  e il client RIPIEGA sul riconoscimento locale (Tesseract/ONNX): nei deploy Easy-Peasy la chiave
  è iniettata automaticamente, per locale/Render va aggiunta a `.env` (vedi `.env.example`).
  CLIENT: `lib/aiClean.ts` (PURO, 8 test: LaTeX→notazione interna `\frac{a}{b}`→`(a)⁄(b)`,
  `\cdot`→`*`, ×÷−→*:-, apici unicode `²`→`^2`, spurii TOLTI MAI inventati, `?` conservato,
  minuscole) + `lib/aiTranscribe.ts` (browser: `aiTranscribeImage`, `AiUnavailableError`,
  `fileToScaledDataUrl` (JPEG ridotto 1800 px per l'IA: l'originale resta per il fallback locale),
  `strokesToDataUrl` (disegna i tratti su canvas bianco, ingrandisce ×≤3)). **FOTO RIENTRA
  NELL'INTERFACCIA** (era stata tolta al giro 19): pulsanti 📷 FOTO (fotocamera) e 🖼 CARICA
  accanto a DICTA + Ctrl+V + CropDialog → PRIMA l'IA, in caso di errore/assenza l'OCR locale
  (toast trasparente). Il risultato finisce SEMPRE nel campo TASTIERA → riquadro «CONTROLLA
  PRIMA DI CONFERMARE» → ✓ CONFERMA E CALCOLA (mai calcolo automatico). **SOCORSO IA sulla
  MANO**: in `addPieceHand`, se il modello locale non legge NULLA, i tratti diventano immagine
  e l'IA li trascrive (pezzo correggibile con ✎, limite MAX_PEZZO verificato); se anche l'IA
  non è disponibile, messaggio di errore come prima. Suite **571 test** (+8 `aiClean.test.ts`),
  tsc e build ok. Collaudo browser (server di produzione in sandbox): foto reale
  `(3⁄7:9⁄14)²−7⁄12·2` → IA 503 → toast «IA non disponibile: uso il riconoscimento locale» →
  OCR locale → campo `(3⁄7⁄9⁄14)^2-7⁄12*2`, riquadro `(3⁄7 : 9⁄14)² − 7⁄12·2`. ⚠️ La route AI
  esiste SOLO nel build di produzione (esbuild di server/index.ts): in `pnpm dev` la fetch
  risponde 404 e si ripiega sul locale. Stato produzione: ancora deploy 8389 (giro 17).
- 23/10/2026 (giro 21): **FRATTE + RADICI N-ESIME + nuovo testo guida** (richiesta: «abilita le
  espressioni fratte con campo di esistenza, le potenze e le radici quadrate/cubiche/ecc., e
  sostituisci la scritta dei pezzi»). RADICI: nuovo nodo `root{a,n}` (additivo: `sqrt` resta per n=2);
  tokenizer accetta ∛ (U+221B) e ∜ (U+221C), `normalizeInput` mappa `\sqrt[3]{…}`→`∛(…)`,
  `\sqrt[4]{…}`→`∜(…)` (indice >4 → errore chiaro) e l'esponente frazionario `8^(1/3)` → radice cubica;
  `nthRootFrac`/`nthRootTerm` (potenza perfetta, esponenti multipli dell'indice, indice dispari
  accetta il negativo); `reduceOnce` case "root" con passo interattivo (opLatex `\sqrt[3]{8}`, answer)
  e `root` aggiunto al dispatch figli-first (BUG trovato in collaudo: `∛(8)` con parentesi non si
  riduceva); `printNode` sqrt/root con parentesi triviali via (∛(8) → \sqrt[3]{8}). FRATTE:
  modulo NUOVO `lib/fratte.ts` SEPARATO dal flusso polinomiale (zero regressioni): valori razionali
  `Rat {num, den}` (den=[] = 1), `evalRat`, `isFratte` (evalPoly fallisce E c'è un divisore con
  lettere: x⁶:x⁴ resta polinomiale), `ratFrom` con semplificazione scolastica (fattore monomio
  comune + Euclide polinomiale univariato `polyGcdUnivariate`/`polyDivExact`), `collectCe`
  (denominatori ORIGINALI dell'AST, dedup per latex), `solveZeros` (grado 1 esatto; grado 2 con Δ
  quadrato perfetto, Δ<0 → nessuna esclusione, Δ non perfetto → condizione den≠0; grado ≥3 con
  test dei divisori razionali p/q ≤ 24 + sdeflazione, radice 0 gestita), riduttore `reduceRatOnce`
  (figli prima; div→rat UNA operazione per volta; add/sub con mcm=prodotto; mul/pow/neg; frazioni
  dentro frazioni → errore chiaro). NODO `rat` in espressioni.ts (stampa `\dfrac{num}{den}`,
  parentesi come operando di × : ^). UI: `components/FratteExercise.tsx` DEDICATO (montato solo se
  `analyzeFratte` riesce): 1. CAMPO DI ESISTENZA con input guidato per ogni radice (l'app NON le
  calcola mai da sola: feedback ✓/✗, C.E. visibile solo a schiudo di tutte le equazioni);
  2. svolgimento passo per passo (dettagli in testo LEGGIBILE `polyPlain`, mai LaTeX grezzo);
  risultato finale impilato + RICOPIA SUL QUADERNO (C.E. incluso); SCARICA PDF nascosto per le
  fratte (quaderno fratte = prossimo giro). `startCompute` invariato: il memo `analysis` prova
  analyzeFratte nel catch (senza setParseError) e il memo `fratta` devia il rendering; riquadro
  «CONTROLLA» con fallback analyzeFratte. TESTO GUIDA pezzi (richiesta testuale esatta):
  «TRASCRIVI L'ESPRESSIONE UN PEZZO ALLA VOLTA, AD ESEMPIO [2+1 (4 : 2)]. PUOI SCRIVERE MASSIMO
  10 ELEMENTI ALLA VOLTA.» (MAX_PEZZO resta 10). IA: contratto transcribe aggiornato (∛/∜) e
  `aiClean` ammette ∛∜. Suite **600 test** (+29: radici 10, fratte 19). Collaudo browser (server
  di produzione in sandbox): `2 + 1:(x−2)` → campo di esistenza con equazione (x−2)=0, input
  studente (3 → «NON È LA SOLUZIONE», 2 → ✓ → C.E. x≠2 → svolgimento (2x−3)/(x−2) impilato);
  `∛8+√16` → percorso polinomiale con passo interattivo √16. ⚠️ NUOVO ESERCIZIO con parametri
  studente in URL torna alla home (comportamento pre-esistente).


## 36. VIA LA TASTIERA E LA DITTATURA: SOLO MANO + FOTO IA; LETTERALE VERIFICATO (giro 22, 23/10/2026)

Richiesta esplicita dell'utente: «togli la possibilità di trascrivere tramite tastiera
nella seconda schermata (lascia solo la scrittura a mano oppure la foto da scattare o
caricare — tutte con IA)» + «togli anche DICTA» + «tieni la correzione ✎» + «verifica
l'intero flusso letterale e pubblica».

- **RIMOSSI** da `EspressioniExercises.tsx`: tab ⌨ TASTIERA (e ramo tastiera con
  `kbExpr` + `handleStartKeyboard`), pulsante 🎤 DICTA/⏹ FERMA con selettore lingua,
  stati `dictLang/dictating/dictInterim/dictError`, `finishDictation`/`startDictation`,
  effetto di pulizia del recognizer. **ELIMINATI** `client/src/lib/dictation.ts` e
  `dictation.test.ts` (lib non più usata; suite da 600 a 576 test, tutti verdi).
- **FOTO → PEZZO**: `applyPhotoTranscript` non usa più `setPieceMode("keyboard")` +
  `setKbExpr`: la trascrizione IA/OCR diventa un **pezzo** (`{ raw, shown:
  prettyPiece(raw) }`) con ✎ ed ✕ come gli altri. Per la foto (e ora anche per la
  correzione ✎) il limite `MAX_PEZZO` NON è bloccante: oltre 10 elementi arriva solo
  un `toast.warning` non bloccante (il limite resta FERREO solo per la scrittura a
  mano, dove la lettura si affiderebbe). `transSource` = join dei `raw` dei pezzi
  (niente più `pieceMode`).
- **UI resta**: header «PEZZO n» + pulsanti 📷 FOTO / 🖼 CARICA (+ Ctrl+V), canvas a
  mano, ✓ CONFERMA E CALCOLA (sempre visibile, disabilitato con 0 pezzi), riquadro
  «CONTROLLA PRIMA DI CONFERMARE» con frazioni impilate.
- **FLUSSO LETTERALE VERIFICATO** (scelta «Tutto insieme» dell'utente):
  - sonde tsx: monomi (`3x+2x−5x`), distributiva (`(2x+3)·(x−1)`), quadrato/cubo di
    binomio, prodotti notevoli, `3x:2` (→ 3x/2 impilato), `x²:x`, div-mono
    (`12a³b:4a²`), radici letterali (`√(9x²)=3x`), tre binomi, lettere multiple —
    tutti OK; `(x+1):(x−1)` ecc. deviati al percorso fratte (giro 21).
  - suite: espressioni 53, fratte 19, radici 10+19 — 576 test passati, `tsc` pulito,
    `pnpm build` OK.
  - **collaudo browser end-to-end** (dev server, IA non disponibile → soccorso OCR):
    foto `(3/7:9/14)²−7/12·2` → pezzo 1 con frazioni impilate + avviso «18 elementi»
    → CONTROLLA impilato → CONFERMA → box guidati con passo interattivo. Correzione ✎
    del pezzo in `(x^2−1):(x+1)` (12 elementi: salvata con solo avviso) → CONFERMA →
    **ESPRESSIONE FRATTA (INCOGNITA AL DENOMINATORE)** con «1. CAMPO DI ESISTENZA»
    e Risolvi (x+1)=0.
- Documentazione aggiornata: README (flusso input + sezione IA + nota fratte),
  REBUILD (checklist: voce DITTATURA sostituita; test 576).


## 37. TRASCRIZIONE IN BASSO SEMPRE IN MATEMATICA + RIPARAZIONE «^2»+«1» (giro 23, 23/10/2026)

Segnalazioni utente (foto allegata): «PUOI SCRIVERE MASSIMO 10 ELEMENTI… non deve
essere scritta in marrone ma in nero» e «il box CONTROLLA PRIMA DI CONFERMARE
trascrive malissimo tutta l'espressione» (mostrava il TESTO GREZZO
«((\frac{3}{4})^21+1»: non renderizzato e con «^21» che sembra un esponente 21).

- **COLORE** (`EspressioniExercises.tsx`, riga suggerimento): tolto lo span marrone
  `text-[#8B3A1A]` da «PUOI SCRIVERE MASSIMO 10 ELEMENTI ALLA VOLTA.» → ora è come
  il resto della frase (grigio-nero `text-muted-foreground`). Restano marroni solo
  l'esempio `[2+1 (4 : 2)]` e i titoli/pulsanti.
- **CAUSA RADICE della trascrizione grezza**: i pezzi «(\frac{3}{4})^2» + «1+1»
  concatenati diventano «^21» → il motore rifiuta (esponenti solo 1–9: «Gli
  esponenti devono essere numeri interi da 1 a 9») → analyzeExpression,
  analyzeFratte e normalizeExpressionOcr falliscono → `transDisplay` ricadeva nel
  ramo `kind:"text"` (font-mono grezzo).
- **RIPARAZIONE giustapposizione** `exprFromPieces(list)`: unisce i raw dei pezzi e,
  se un pezzo termina con «^<cifra>» e il successivo comincia con una cifra,
  inserisce un «·» esplicito (i pezzi erano scritti separatamente: è
  moltiplicazione implicita, NON un calcolo). Usata da `transSource` E da
  `handleStartCompute` (così anche il calcolo parte senza l'errore dell'esponente).
- **FALLBACK sempre LaTeX**: `transDisplay` ora, quando NEMMENO il percorso OCR
  normalizzato valuta (espressione ancora incompleta, parentesi non chiuse mentre
  si scrive a pezzi), restituisce `{kind:"latex", value: transSource}` invece del
  testo grezzo: katexHtml usa `throwOnError:false`, quindi il render degrada con
  eleganza e la frazione resta IMPILATA.
- Verifiche: tsx («((\frac{3}{4})^2·1+1)» → \left(\left(\dfrac{3}{4}\right)^{2}
  \cdot 1 + 1\right), variante con «:2» OK); tsc pulito; 576 test verdi; build OK.
  Collaudo browser: pezzo 1 «(» (via foto+✎), pezzo 2 «(\frac{3}{4})^2», pezzo 3
  «1+1» → CONTROLLA mostra «((3/4)²·1+1» IMPILATO anche senza parentesi chiusa;
  con «)» nel pezzo 3 → CONFERMA E CALCOLA → box guidati «2. RISOLVO LE PARENTESI
  TONDE» con (3/4) = (nessun calcolo automatico).

## 38. VIA ANCHE LA FOTO: SOLO SCRITTURA A MANO POTENZIATA IA (giro 24, 23/10/2026)

Richiesta utente: «Elimina anche la possibilità di scattare foto oppure caricarle,
lasciando solo la possibilità di scrittura a mano potenziata con IA».

- **RIMOSSO da `EspressioniExercises.tsx`**: i pulsanti 📷 FOTO e 🖼 CARICA, gli input
  file nascosti (fotocamera/caricamento), il ritaglio (CropDialog), l'incolla Ctrl+V,
  lo stato di attesa «L'IA STA LEGGENDO LA FOTO…», gli errori foto e TUTTO il flusso
  handler (`applyPhotoTranscript`, `runPhotoAi`, `runPhotoOcr`, `onCropConfirmPhoto`,
  `closeCrop`, `handlePhotoFile`, paste listener) e gli import ora inutilizzati
  (`Camera`, `ImagePlus`, `CropDialog`, `normalizePhoto`, `ocrImage`,
  `fileToScaledDataUrl`).
- **RESTA INTATTO**: la scrittura a mano con modello ONNX e SOCCORSO IA (`strokesToDataUrl`
  + `aiTranscribeImage(dataUrl, "ink")` quando il modello non legge nulla), la correzione ✎
  da tastiera, l'eliminazione ✕, il limite 10 elementi a mano, il riquadro CONTROLLA con
  frazioni impilate (giro 23) e il CONFERMA E CALCOLA.
- **File morti lasciati nella repo** (non più importati dalla pagina, bundle pulito):
  `lib/ocr.ts` (Tesseract foto), `lib/imagePrep.ts`, `components/CropDialog.tsx` e i banchi
  foto (`photoBench`): restano per un eventuale ripristino.
- Verifiche: `tsc` pulito; **576 test passati**; build OK; collaudo browser (tratto «2»
  sintetico sulla canvas → pezzo riconosciuto, PEZZO 2 aperto, CONTROLLA impilato,
  nessun pulsante foto).

## 39. DITTATO VOCALE CON IA — DA AUDIO-MATEMATICI (giro 25, 23/10/2026)

Richiesta utente: «implementa nella seconda schermata quest'app per la trascrizione
audio, adattando colori e font al resto dell'app: github.com/andreakeating1982/AUDIO-MATEMATICI».

- **Flusso** (dal Dettato Matematico): 🎤 DICTA accanto al canvas del pezzo →
  MediaRecorder → WAV PCM 16 kHz **in-process** (`client/src/hooks/useRecorder.ts`,
  adattato; auto-stop a 20 s con conto alla rovescia) → POST `/api/ai/audio`
  (JSON `{audio: dataURL}`) → IA multimodale (gemini-3-flash) trascrive IN ITALIANO
  (`server/audio.ts: transcribeAudioWav`) → IA converte in NOTAZIONE dell'app
  (`parseMathText`: frazioni impilate `a⁄b` U+2044, `:` per «diviso», `·` per «per»,
  `^` potenze, √∛∜, parentesi come dettate, MAI `=`, MAI calcolare) →
  `normalizeAudioNotation` (`lib/audioNotation.ts`: spazi via, −→-, a/b→a⁄b) →
  il dettato diventa un **PEZZO** (correggibile ✎, eliminabile ✕), con avviso NON
  bloccante se supera i 10 elementi (il limite vale solo per la scrittura a mano).
- **Server**: `POST /api/ai/audio` in `server/index.ts` + `server/audio.ts` (chat
  completions via fetch con `input_audio` WAV base64); guardie: silenzio puro
  (`wavIsSilent`, portata da AUDIO-MATEMATICI), peso >1,5 MB, chiave assente (503).
  L'audio non viene conservato.
- **Cornice Blogger**: aggiunto `allow="microphone"` all'iframe di
  `cornice-dinamica/embed-espressioni-dedicata.html` (getUserMedia nel cross-origin
  iframe richiede la permission policy).
- **Nota dev**: in preview (`pnpm dev`, Vite) `/api/ai/audio` NON esiste (rotte solo
  nel server di produzione, `pnpm build` + `node dist/index.js`): DICTA dà errore in
  preview, funziona in produzione.
- **Collaudo**: rotta provata col server di build (silenzio → 400 «Non ho sentito
  nulla», audio → raggiunge il gateway, body errato → 400); UI collaudata (pulsante
  DICTA nello stile dell'app, percorso di errore microfono negato); 4 test nuovi su
  `normalizeAudioNotation` (580 totali).

## 40. REGOLE DI TRASCRIZIONE DA TASTIERA NELL'EDITOR DEI PEZZI (giro 26, 23/10/2026)

Richiesta utente: «Nella sezione di editing con tastiera delle parti scritte a mano
implementa le stesse regole di trascrizione con tastiera che usa l'app audio appena
inserita: : per la divisione, * per la moltiplicazione, 3/4 per la frazione impilata,
^2 per l'esponente, rad2 per la radice quadrata e rad3 per la radice cubica, ecc».

- **Modulo**: `client/src/lib/keyboardNotation.ts` — `normalizeKeyboardNotation`
  (spazi via, `sqrt`/`radq`/`rad2` → √, `rad3` → ∛, `rad4` → ∜, `*` → ·, `÷` → `:`,
  `−` → `-`, frazioni semplici `a/b` → `a⁄b` U+2044; i rapporti complessi tipo
  `(x+1)/(2x-3)` restano con la barra) e `normalizeKeyboardLive` (conversione MENTRE
  si digita con riposizionamento del cursore, come nell'app audio) e
  `keyboardNotationHint` (riga di aiuto sotto il campo).
- **UI**: il campo di correzione ✎ converte mentre si digita e mostra il promemoria
  «TASTIERA: : diviso · * per · 3/4 frazione impilata · ^2 potenza · rad2 radice
  quadrata · rad3 cubica · rad4 quarta»; al salvataggio seconda conversione di
  sicurezza (`saveEditPiece`).
- **Collaudo**: 9 test nuovi su `keyboardNotation` (589 totali); tsc e build puliti.

## 41. PANNELLO «TRASCRIZIONE AUDIO E CON TASTIERA» (giro 27, 23/10/2026)

Richiesta utente: «l'utente deve poter premere il pulsante DETTA L'ESPRESSIONE e si
devono aprire tutti i box presenti nell'app audio originaria (con la trascrizione
letteraria e matematica immediatamente sotto la finestra per scrittura a mano e tutti
i box sopra il pulsante CONFERMA E CALCOLA. Elimina quindi il pulsante DICTA e
sostituiscilo con TRASCRIZIONE AUDIO E CON TASTIERA».

- **Il pulsante DICTA del giro 25 è STATO ELIMINATO** dall'intestazione del pezzo.
  Al suo posto, SOTTO la finestra di scrittura a mano e SOPRA ✓ CONFERMA E CALCOLA,
  c'è il pulsante **🎤⌨ TRASCRIZIONE AUDIO E CON TASTIERA** (aria-expanded/
  aria-controls="pannello-audio") che apre/chiude il pannello con TUTTI i box
  dell'app AUDIO-MATEMATICI:
  1. **zona microfono**: tondo (h-16), bg-primary / bg-destructive in registrazione,
     Loader2 in attesa, barra elapsed/maxSeconds, nota «l'audio viene elaborato
     dall'IA e subito cancellato», errori (audio.error ?? panelError);
  2. **box 1 · TRASCRIZIONE LETTERARIA**: textarea correggibile (spokenText) con
     **✨ RIANALIZZA CON IA** (POST `/api/ai/parse-spoken` {spoken} → {notation},
     come /api/math/parse) e **CANCELLA E RICOMINCIA** (clearAudioPanel);
  3. **box 2 · TRASCRIZIONE MATEMATICA**: matematica RESA con frazioni impilate
     (STESSA catena del riquadro di controllo del giro 23: analyzeExpression →
     analyzeFratte → normalizeExpressionOcr → prettyExpression), notazione lineare,
     campo correggibile con **normalizeKeyboardLive** (regole giro 26, come
     expandiRadici nell'app audio), «Nota bene» con keyboardNotationHint, e bottoni
     **✓ AGGIUNGI COME PEZZO** (addPieceFromPanel: normalizeKeyboardNotation → pezzo,
     avviso NON bloccante se > MAX_PEZZO, chiude pannello e scrolla al CONTROLLA),
     COPIA NOTAZIONE, SVUOTA LA TRASCRIZIONE.
- **Più audios di seguito** si riuniscono in un'unica espressione: il nuovo spoken si
  concatena al precedente e l'IA rianalizza il tutto (come nell'app originaria).
- **Server**: `POST /api/ai/parse-spoken` in `server/index.ts` (guardia chiave 503,
  spoken vuoto → 400, errori IA → 502).
- **Stato del pannello**: audioPanelOpen, spokenText, audioNotation, parseBusy,
  panelError, copied (EspressioniExercises.tsx, blocco «PANNELLO TRASCRIZIONE AUDIO
  E CON TASTIERA»); lib/audioNotation.ts resta come riferimento ma NON è più
  importato dalla pagina (il pannello usa keyboardNotation, che copre le stesse
  regole più rad2/rad3/rad4).
- **Collaudo browser end-to-end senza IA**: digitato «(3/4*4/6)^2-2:5» nel campo →
  conversione live in (3⁄4·4⁄6)^2-2:5 → box 2 mostra (¾·⅚)²−2:5 impilato →
  ✓ AGGIUNGI COME PEZZO → pezzo 1 in lista + CONTROLLA reso uguale + toast avviso
  non bloccante «14 elementi»; rotte provate col server di build (parse-spoken
  vuoto → 400, audio silenzio → 400); 589 test; tsc e build puliti.

## 42. REGOLE PANNELLO: FRATTE CON «/» SEMPRE IMPILATE E DIVISIONE «÷» (giro 28, 23/10/2026)

Richiesta utente: «non riesco a scrivere le espressioni fratte con il segno / che poi
vengono trascritte impalate. Inoltre il segno diviso deve essere scritto dalla tastiera
con : ma apparire con i due puntini e una linea in mezzo ai puntini (proprio come
nell'app audio originaria). Inoltre il tasto RIANALIZZA CON IA chiamalo più
semplicemente ANALIZZA CON IA».

- **`keyboardNotation.ts`**: base condivisa `baseNormalize(s, display)` con DUE
  modalità — APP (editor ✎, giro 26, invariata: ":" divisione, solo a/b semplici →
  ⁄) e DISPLAY (pannello, giro 28): la barra "/" è SEMPRE frazione impilata (anche
  le fratte come (x+1)/(2x-3) → (x+1)⁄(2x-3), perché la divisione si scrive con i
  due punti) e i due punti scritti si MOSTRANO come «÷» (U+00F7). Nuove esporti:
  `normalizeKeyboardDisplayNotation`, `normalizeKeyboardDisplayLive`,
  `toDisplayNotation` (notazione IA ":" → schermo "÷"), `keyboardDisplayHint`.
- **Flusso del pannello**: il campo del box 2 (e i risultati dell'IA) contengono la
  notazione da SCHERMO («÷» + «⁄»); al pezzo si salva con
  `normalizeKeyboardNotation` (÷ → :) e nel box reso si analizza la notazione
  DELL'APP; il LaTeX del box 2 sostituisce «:» con «\div» SOLO nel pannello (come
  il MathNotation dell'app audio), il resto dell'app resta con «:» (giro 23).
- **Motore**: la fratta impilata (x+1)⁄(2x-3) viene riconosciuta dal parser
  (canParse) ma `analyzeExpression` rifiuta la divisione tra polinomi — STESSO
  limite di prima con «:», nessuna regressione; (3x+1)⁄2 e simili funzionano.
- **UI**: pulsante «✨ ANALIZZA CON IA» (era RIANALIZZA CON IA); Nota bene del
  box 2 = keyboardDisplayHint («: diviso (si mostra ÷) · / frazione impilata · …»).

## 43. NIENTE RISULTATI PRE-SCRITTI NEI PASSI (giro 29, 23/10/2026)

Richiesta utente (con foto di `(3·x⁄4):(5x·1)`): «il widget continua a scrivere il
risultato finale automaticamente di conti che invece dovrebbe fare l'utente. Va bene
il modo in cui il widget suddivide i vari calcoli da fare, ma non deve mai trascrivere
automaticamente il risultato finale di un calcolo che solo l'utente deve fare. L'utente
può trascrivere i vari risultati a mano oppure con le regole della trascrizione
mediante tastiera implementate nella pagina due».

- **REGOLA** (`client/src/lib/espressioni.ts`): il dettaglio di un passo mostra
  «operazione = risultato» SOLO se il passo è INTERATTIVO (opLatex+answer numerici,
  lo studente inserisce e convalida il risultato). Per i passi non interattivi
  (risultato con lettere) il dettaglio mostra SOLO l'operazione: lo studente la
  ricopia e svolge il conto sul quaderno.
- Punti toccati in `reduceOnce`: paren-sign (solo l'espressione col segno da
  applicare), mul-terms/paren-prod, div-num (con risultato letterale), div-mono,
  root e sqrt con lettere, paren-mul `(a+b)^n` (resta il promemoria «(moltiplico
  n volte)»), pow-term. La frazione impilata scritta dall'utente NON è un conto:
  niente dettaglio «x = x⁄4» (la notazione si vede già nell'espressione).
- **Valgono le riscritture progressive**: le espressioni di stato (`s.latex`)
  restano (la «suddivisione dei calcoli» è stata approvata dall'utente); le righe
  RICOPIA passano da `copiaRiga` → dettaglio senza «=» → solo l'operazione. Il PDF
  cattura il DOM dei RICOPIA (`.notebook-content`), quindi eredita la correzione.
- **Collaudo browser** (espressione della foto, via pannello tastiera
  «(3*x/4):(5x*1)»): punto 2 mostra SOLO `3·x⁄4` e `5x·1` (niente `= 5x`,
  niente `x = x⁄4`); RICOPIA «RISOLVO PRIMA LE PARENTESI» con le sole operazioni;
  box 3 «Inserisco il risultato finale» con input manuale per `3x⁄4 : 5x`.
- Test: 600 (+4 nuovi in espressioni.test.ts «giro 29»); tsc e build puliti.

## 44. FILOSOFIA SCAFFOLDING + ARIOSO + FONT 14PT (giro 30, 23/10/2026)

Richiesta utente: «il widget deve poter parcellizzare ordinatamente i conti da fare
dell'espressione ma il risultato finale dei vari conti deve essere sempre e solo
dato dall'utente… scaffolding cognitivo per alunni discalculici»; sezione audio
più ariosa; «tutte le scritte dell'app non devono avere un font size inferiore a
14 pt (eccetto la prima pagina che deve rimanere invariata)».

- **answerPoly** (`espressioni.ts`): ExprStep.answerPoly?: Term[] = risultato
  atteso dei conti con LETTERE. Impostato nei siti reduceOnce: paren-sign,
  mul-terms/paren-prod, div-num (letterale, NON per le fratte dell'utente),
  div-mono, root/sqrt, paren-mul, pow-term. ATTENZIONE: l'helper `spread` di
  reduceOnce propaga i campi del passo figlio — va esteso anche ad answerPoly;
  il push in analyzeExpression propaga `...(r.answerPoly ? … : {})`; i passi
  con answerPoly ma latex IDENTICO al precedente si saltano (fusioni interne
  dell'albero, es. 5·x dentro 5x·1).
- **Convalida tastiera** (`EspressioniExercises.tsx`): `parsePolyLoose` (lib)
  parsa l'input libero con normalizeInput (regole giro 26: 3x/4, a^2, ·, :, ⁄),
  `polyEquals` confronta i polinomi normalizzati. Componente TypedResultInput:
  operazione + «=» + campo + VERIFICA; errore SOLO dopo VERIFICA; ✓ CORRETTO
  rivela lo stato successivo. firstOpenIdx considera anche i passi typed →
  rivelazione progressiva IDENTICA al caso numerico (un conto alla volta).
  Il risultato finale (hasVars) ora richiede upperDone + allGroupsCorrect.
- **CSS 14pt** (`index.css`, in coda): `.expr-exercise-page` (+ discendenti
  .text-xs/.text-sm/.text-base = 14pt, .text-lg = 15pt, .text-\[13px\] = 14pt)
  — STESSA scala dell'app audio originaria AUDIO-MATEMATICI. SCOPATA alla
  pagina esercizi: WelcomePage invariata. Verificato nel browser: nessun
  testo (fuori KaTeX) sotto 18,7px.
- **Pannello audio arioso**: contenitore p-5/p-6 + space-y-6, box p-4/p-5 +
  space-y-3, gap mic 5, bottoni px-4 py-2.5, hint mt-2/mt-3, display min-h 76px.
- Test: 605 (+5 «giro 30»: parsePolyLoose, polyEquals, answerPoly foto, 6x:2,
  nessuna regressione numerica); tsc e build puliti; collaudo browser completo
  sull'espressione della foto ((3·x⁄4):(5x·1)): 5x sbagliato → RIPROVA, 3x/4 →
  ✓ + stato successivo, 5x → ✓, punto 3 con input del risultato finale.

## §45 — Giro 33: equazioni, lettore letterale, nuovo nome (23/10/2026)

- Riconoscimento: `sembraEquazione` nel memo analysis di EspressioniExercises.tsx
  (due membri non vuoti attorno al primo «=»; fratte con «=» restano alle fratte).
- `lib/equazioni.ts`: sembraEquazione, toFormaCanonica, classifica, passiPer (1°:
  2 passi; 2°: 5 passi widget; biquadratica/sesta: 6 passi t=x²/x³),
  solveQuadratica/solveBiquadratica/solveSesta/ruffini/raccogli/verificaSol,
  sqrtExactLatex, decimalToFracLatex, auditEquazione, leggiRispostaStudente.
- `components/EquazioniExercise.tsx` + `components/passiExtraEq.tsx` (cubica,
  raccoglimento). Progressività via doneCount; MAI ramo «svolto sul quaderno»
  senza input (bug fixato: impostava doneCount(i) e bloccava tutto).
- Lettore risposte: decimali → evalPoly diretto (NON isNumericFlat: rifiuta le
  parentesi) → sostituisciRadici (radicando semplice senza «/») → forme isolate.
- Voce: server/audio.ts «uguale» → «=» (uno solo per dettato).
- Nome app ovunque + scritte «ESPRESSIONE O EQUAZIONE»; esempio guida
  `[3(2+2x) - 2(4x + 2)] = 0`. Cornice embed aggiornata.
- Test: equazioni.test.ts 36 (classifica, canonica, soluzioni, Ruffini,
  raccoglimento, sentinella, lettore); suite 643; tsc/build puliti; collaudo
  browser x^2-5x+6=0 end-to-end (EQUAZIONE RISOLTA ✓).

## §46 — Giro 33-fix: sanificare il LaTeX dell'IA nel pannello (23/10/2026)

- Foto utente: campo tastiera con «·\frac{3}{c}(\frac{1}{4}» vs legenda «/ frazione
  impilata». Causa: `parseMathText` chiede notazione lineare ma l'IA a volte
  restituisce LaTeX; nessun filtro lo intercettava.
- `sanitizeLatexNotation` (keyboardNotation.ts) all'inizio di baseNormalize:
  copre digitazione, incolla, salvataggio pezzo e risposte IA (toDisplayNotation
  ora = normalizzazione display completa). MAI commenti JS dentro una catena
  .replace (la spezza senza errori); guardia su backslash E graffe.
- Test: keyboardNotation.test.ts 21 (+5); suite 648; tsc/build puliti; collaudo
  browser con incolla del caso della foto.

## §47 — Giro 34: pezzi nascosti col pannello aperto (23/10/2026)

- Foto utente: pezzo `(3-1/2)^2` visibile sopra il pannello aperto. Regola: i due
  modi di trascrizione non si mostrano mai insieme — `!audioPanelOpen &&` su
  riga guida (già), finestra mano (già), lista pezzi, errori pezzo/parse,
  riquadro CONTROLLA (nuovi). I pezzi restano nello stato, ricompaiono alla
  chiusura; CONFERMA E CALCOLA resta sempre visibile e usa la notazione del
  pannello quando è aperto. Collaudo browser round-trip con pezzo 2x+3=7.

## §48 — Giro 35: mai \frac nei campi, solo la barra (23/10/2026)

- Foto utente: campo ✎ del pezzo 4 con «\frac{3}{4}^2)» grezzo + legenda
  TASTIERA (3/4 frazione impilata). Causa: `prettyPiece` non sanificava il
  \frac (solo \cdot \div \sqrt \left \right); il sanificatore copriva gli
  altri ingressi ma non la precompilazione del campo ✎ (pieces[i].shown).
- Fix: `prettyPiece = prettyExpression(sanitizeLatexNotation(
  normalizeKeyboardNotation(...)))`. Copre lista, campo ✎ e pezzi vecchi.
  Regola: \frac NON è un comando del widget — frazioni solo con la barra.
- Test: keyboardNotation.test.ts +1 (caso foto); suite 649; tsc/build puliti;
  collaudo browser con incolla del caso della foto.

## §49 — Giro 36: microfono nel blog, parser giustapposizione, legenda (23/10/2026)

- MICROFONO: iframe del Codice 14 nel DOCX senza `allow="microphone"`
  (perso nell'aggiornamento del documento) → Chrome nega senza prompt.
  Pagina standalone o cornice aggiornata funzionano. Fix: allow in tutte
  le cornici (lite, universale, autosufficiente, dedicata già dal giro 25);
  DOCX «...+fix-microfono.docx» col Codice 14 rigenerato. L'utente deve
  re-incollare il Codice 14 nel post del blog.
- PARSER: `2(3)(4)` e `(1)(2)(3)` erano errore (solo 2 fattori giustapposti)
  → fallback testo grezzo con `/` in linea. Fix: `prevEndsFactor` include
  `node.k === "mul"`: la catena giustapposta continua. Il caso della foto
  `3·2(-2-1⁄4)(-1⁄2·(3⁄4)^2)` rende TUTTO impilato. Suite 650, zero regressioni.
- LEGENDA box 2: «COME SI SCRIVE DA TASTIERA» a righe colorate (blu/verde/
  ambra/viola/rosa/ciano). Messaggio 503 IA operativo con ripiego manuale.

## §50 — Deploy produzione giro 36 (23/10/2026, ID 8493)
- URL: https://espressioni-monomi-polinomi.easy-peasy.site — bundle
  index-BSP6SeqC.js verificato identico al build locale. Home + esercizio
  HTTP 200. Include §49 (microfono/parser/legenda).

## §51 — Giro 37: legenda dietro pulsante (23/10/2026)
- Richiesta utente: la scritta COME SI SCRIVE DA TASTIERA occupava spazio
  fisso. Ora è visibile solo su richiesta: pulsante
  «▸ ISTRUZIONI PER SCRIVERE DA TASTIERA» nella stessa posizione
  (sotto il campo notazione, sopra AGGIUNGI COME PEZZO); aperto il
  pulsante diventa «▾ NASCONDI LE ISTRUZIONI». Stato `legendOpen`,
  `aria-expanded`, contenuto invariato. tsc/build/suite 650 puliti.

## §52 — Chiave IA cotta nel bundle server (24/10/2026)
- Richiesta utente (foto: «IA non configurata» col microfono nel blog;
  «Ho già una chiave»). Meccanismo preso da AUDIO-MATEMATICI:
  `scripts/sync-env.mjs` legge `.env` (ignorato da git) e genera
  `shared/env.generated.ts` con `BAKED_EASY_PEASY_API_KEY`, importato SOLO
  da `server/index.ts`. La chiave NON finisce mai nel bundle browser
  (verifica: `grep -r <chiave> dist/public/` = 0; nel bundle server = 1).
  Collaudo: `POST /api/ai/parse-spoken {"spoken":"tre più cinque"}` →
  `{"notation":"3+5"}` HTTP 200 (prima 503). `.env.example` senza chiave.

## §53 — Istruzioni tastiera a pulsante anche nell'editor ✎ (24/10/2026)
- Richiesta: togliere «Correggi la notazione a mano se l'IA ha capito male»
  (già tolta), la legenda fissa «TASTIERA: …» sotto il campo ✎ e la scritta
  privacy «L'audio viene elaborato dall'IA…». Nuovo stato `editorLegendOpen`
  con lo stesso pulsante del box 2; box con le 5 righe colorate una per rigo
  (: blu, * ambra, / verde, ^2 viola, rad2/3/4 rosa).
  `keyboardNotationHint` resta esportato ma non più importato dalla pagina.

## §54 — Box 2 con textarea ridimensionabile + «Esempio:» (24/10/2026)
- Foto SI (maniglia resize) / SI SI (campo riga singola senza + «Es:»).
  Il campo notazione del box 2 era `<input>` → ora `<textarea rows={2}>`
  con `resize-y min-h-[44px]` come il box 1 (conversione live invariata).
  Placeholder «Esempio: (3/4*4/6)^2-2+5:(1/5)» (unica occorrenza «Es:»).

## §55 — Auto-stop 20s che non perde il dettato (24/10/2026)
- Segnalazione: senza secondo tocco il dettato andava perso. Causa:
  l'auto-stop fermava e trascriveva ma buttava il risultato. Fix:
  `useRecorder` pubblica in `autoResult` (azzerato da `reset()`); la pagina
  lo accoda con `accodaRisultatoMicrofono` (stessa logica del tocco, con
  `seenAutoRef` anti-duplicati; il tocco manuale marca come visto; il
  CANCELLA del pannello azzera il visto). Suite 613; collaudo browser.

## §56 — DIGITA IL VALORE con sintassi tastiera + istruzioni (24/10/2026)
- Foto: placeholder «es. 8/8 o \\frac{8}{8}». Fix in NumberInputCanvas.tsx:
  placeholder «Esempio: 8/3»; stato `valueLegendOpen` con pulsante e 5 righe;
  `normalizeTypedValueNotation` (stesse 5 regole + ÷·⁄√∛∜ da incolla) in
  `handleEditSubmit`; `evaluateLatex` + potenza `^` (`bdPow`), `*` (`bdMul`),
  radici `√∛∜` (forme `√(…)` e `√n`); blocco editing in frammento `<>`.
  Test `typedValueNotation.test.ts`; funzionale: 6:3→2, 3*4→12, 2^3→8,
  rad29→3, rad327→3, rad416→2. Suite 616.

## §57 — Via il limite dei 10 elementi (24/10/2026)
- Richiesta: frase «SE VUOI, PUOI TRASCRIVERE L'ESPRESSIONE IN PIU' PEZZI.»
  (era «TRASCRIVI… UN PEZZO ALLA VOLTA. PUOI SCRIVERE MASSIMO 10 ELEMENTI
  ALLA VOLTA.»). Rimossi TUTTI i blocchi/avvisi `MAX_PEZZO` dalla pagina
  (mano, soccorso IA, AGGIUNGI COME PEZZO, ✎) + import + commenti.
  `pieceCount.ts` solo per test/banco. Suite 616; frase verificata in preview.

## §58 — Deploy produzione 24/10 (ID 8508)
- URL: https://espressioni-monomi-polinomi.easy-peasy.site — bundle
  `index-jgILIDLt.js` identico su run.app ed easy-peasy.site, HTTP 200 +
  titolo corretto. Include §52–§57.

## §59 — Chiave IA: provisioning via .env + sync-env (25/10/2026, commit f2da5fb)
- Sintomo in produzione: `POST /api/ai/parse-spoken` → 503 «IA non configurata:
  manca EASY_PEASY_API_KEY sul server» (microfono e «✨ RIANALIZZA CON IA»
  morti nel blog).
- Provisioning: chiave nel `.env` del progetto (gitignored) →
  `scripts/sync-env.mjs` genera `shared/env.generated.ts` (gitignored) con
  `BAKED_EASY_PEASY_API_KEY` COTTA nel bundle server. `sync-env.mjs` legge
  `process.env.EASY_PEASY_API_KEY` di build oppure `.env` (fallback).
  Il server usa `BAKED_…` o `process.env` (server/index.ts `aiClient()`).
- INVARIANTI: la chiave NON finisce MAI nel bundle client (verificare
  `grep -l "ep_" dist/public/assets/*.js` → vuoto), MAI nel repo, MAI in
  chat/log (se esposta: rotazione). Il build gira sync-env DOPO vite build:
  `pnpm build` = `vite build && node scripts/sync-env.mjs && esbuild …`.
- Verifica post-deploy: `parse-spoken` e `/api/ai/verify-steps` senza 503.

## §60 — Conti sempre corretti (25/10/2026, commit 7a738d2, deploy 8551)
- Richiesta (con foto di `(1/3)^-6 : (1/6)^-3 + 1/6`): «implementa la
  sezione dei conti con l'IA in modo che fornisca sempre i conti in modo
  corretto secondo la filosofia generale dell'app».
- 1. FIX FALSO CONTO: con frazioni impilate dell'utente in parentesi
  (`div` con `fr:true`, numerico/numerico), `case "paren"` in
  espressioni.ts restituisce `{node: num, kind: "paren-div", detail: ""}`
  (sola notazione): niente più `paren-value` interattivo «(1/3) =» (un
  conto che non esiste). Con i DUE PUNTI (`1 : 3`) resta un conto vero.
- 2. AUDIT DETERMINISTICO (espressioni.ts, provabile in Node):
  `latexValue()` (valutatore del sottoinsieme LaTeX del motore; null su
  lettere = mai falsi positivi) e `auditConti()` → violazioni
  `conto-vuoto` (opLatex interattivo senza operazioni; euristica
  `opHaConto`: frazioni = valori, RADICI = conto vero), `conto-errato`
  (answer ≠ valore di opLatex), `salto-errato` (la catena cambia valore).
- 3. VERIFICA IA («l'IA propone, il motore dispone»): route server
  `POST /api/ai/verify-steps` (SOLO passi visibili: kind/latex/detail/
  opLatex; MAI risposte attese, MAI dati personali; JSON estratto in modo
  robusto, temperature 0) + client `client/src/lib/aiVerify.ts`
  (`verifyConti` timeout 20 s → null se IA assente; `applicaVerifica`:
  audit prima, correzione IA accettata SOLO se `latexValue` combacia col
  valore del passo successivo/finale, passo sbagliato senza correzione
  fidata SCARTATO, IA che segnala > metà dei passi ignorata, senza IA
  nessun cambiamento). UI: il percorso polinomiale appare SOLO a
  `verificaDone` (gli indici dei campi non cambiano mai sotto i piedi).
  Filosofia inviolata: l'IA non genera passi e non scrive MAI risultati
  al posto dello studente.
- Test: 26 nuovi in `conti-audit.test.ts` (fix (1/3)=, corpus audit,
  latexValue, applicaVerifica con correzione valida/non valida/IA
  inaffidabile). Suite 706. Produzione 8551: app/verify-steps/parse-spoken
  200; l'IA categorizza un errore voluto (1/81 vs 1/729) e propone la
  correzione esatta.

## §34 (26/10) — «NON DIRE MAI LA SOLUZIONE, NEANCHE PER ISCRITTO» — promptSicuri.ts

Le frasi didattiche dei box (`prompt`) guidano il **METODO** e non rivelano MAI il
**RISULTATO** che lo studente deve scrivere. Fotografia del caso: box `√(3/4)·√8`
con frase «MOLTIPLICO SOTTO RADICE: RADICE DI (3/4 PER 8) = RADICE DI 6.» — la
soluzione (√6) regalata due volte.

- **Sanitizer**: `client/src/lib/promptSicuri.ts`, funzione `ripulisciPrompt(prompt, opLatex, answerLatex)`.
  - Taglia: clausole dopo parole-risultato (`= → è fa dà viene esce resta ossia cioè uguale totale scrivo ottengo diventa vale sono fanno`) che contengono la risposta (cifre, parole-numero 0-999, frazioni a parole «tre quarti», TeX `\frac`/`\sqrt`, «radice di N» detta); simboli TeX isolati che valgono la risposta; risposta con LETTERE ripetuta tale e quale (`5x`); frammenti di calcolo che danno la risposta o il suo radicando (`3·2`, `10/12`, `(3/4)·8 = 6` con risposta √6).
  - NON tocca: `mcm(…)` (notazione del metodo, sempre protetta), numeri/parole GÀ visibili nell'operazione del box («radice di 9» con √9 nei dati resta — lo studente calcola da solo).
  - Se la frase si svuota → `FRASE_METODO_RISERVA` («Applica il metodo e scrivi tu il risultato.»).
- **Integrazione**: `riparaEsercizio` (server/costruisci.ts) chiama il sanitizer su ogni box; se taglia, avverte in `avvertenze` (log, non studente). L'esercizio resta valido: pagina 3 sempre aperta.
- **Prompt IA**: regola 5 indurita (VIETATO `= numero`, «fa/è/diventa + numero», «RADICE DI N» se è la risposta, frazioni a parole della risposta; CONSENTITO nominare i dati visibili) con esempi giusto/sbagliato.
- **Export riusabile**: `normalizeTypedValueNotation` (NumberInputCanvas.tsx) usata per confrontare risposte radicali scritte da tastiera («3rad2(15)»).
- Test: `client/src/lib/promptSicuri.test.ts` (13 test, incluso il caso della foto).

### (26/10-bis) Radici accettate ovunque e canvas protetti

- **Moltiplicazione implicita coefficiente·radice**: `latexToPlainMath` (espressioni.ts) ora converte `3\sqrt{15}` → `3*(15)^(1/2)` (il regex `(\d|\))\s*\(` accanto alle radici; il coefficiente davanti alla radice era la causa del falso «RISULTATO SBAGLIATO» su `2√15+√15 = 3√15`). Stesso supporto in `evaluateLatex` (tastiera: `3√15`, `3√(15)`, `3rad2(15)`).
- **Box radicali senza lettere**: verificati come FORMA esatta via `latexValue` (confronto numerico esatto con tolleranza relativa), mai sull'arrotondamento; `haRadicaleAtteso` in `validaEsercizio` li marca; la progressione accetta anche il valore numerico pubblicato dal canvas.
- **Hint radicali**: risposta attesa con `\sqrt` ma senza lettere → «💡 Scrivi il risultato esatto con la radice (es. 3√15)», non più l'hint «con le lettere».
- **Pillola blu MAI su risposta errata**: in `NumberInputCanvas`, quando `hideValue` è attivo (errore già pubblicato) il display non mostra NULLA (né valore né badge decimale).
- **Anti-scarabocchi**: `MathDrawCanvas` accetta `onReady` (chiamato dopo la misura del contenitore); `NumberInputCanvas` espone `canvasPronto` → velo CARICAMENTO sul disegno, `RICONOSCI` e `✎` disattivati finché non pronto (pagine 2 e 3). MAI rimuovere: senza, l'input anticipato produce scarabocchi sfasati.

## §35 (26/10) — Pulsante CALCOLATRICE accanto a DIGITA IL VALORE (Desmos)

- **Componente**: `client/src/components/CalculatorPanel.tsx` — overlay FULL-SCREEN con iframe di `https://www.desmos.com/scientific?lang=it`, aperto da `NumberInputCanvas.tsx` (stato `calcAperta`): il pulsante **🧮 CALCOLATRICE**compare accanto a **✎ digita il valore** in OGNI box numerico (pagine 2 e 3).
- **Ritorno senza perdite**: l'overlay NON naviga — monta un dialogo sopra l'app; canvas, campi e passaggi restano montati. Chiusura con **✕ TORNA ALL'ESERCIZIO** o **ESC**; lo scroll del body è bloccato mentre è aperto e ripristinato alla chiusura. LO studente riprende il box esatto dove si era interrotto.
- **ATTENZIONE iframe Desmos**: Desmos può rifiutare l'incorporamento («refused to connect») e in quel caso Chrome DECODA COMUNQUE l'evento `load` dell'iframe → un fallback basato su timeout/onLoad NON funziona. Per questo il link **«APRI IN UNA NUOVA SCHEDA ↗»** è SEMPRE visibile nella barra del pannello (soccorso permanente). L'app non naviga mai: anche con la scheda esterna lo stato resta intatto.
- Accessibilità: `role=dialog` + `aria-modal`, `aria-haspopup=dialog` sul pulsante, `aria-label` su chiusura, ESC da tastiera.
- NON rimuovere il link di soccorso né sostituire l'overlay con un `window.location`: quest'ultimo distruggerebbe lo stato dell'esercizio (violazione del principio «ritorno dove si era interrotti»).

## §36 (26/10-fix) — CALCOLATRICE: apertura in NUOVA SCHEDA (l'utente ha confermato che Desmos rifiuta l'iframe anche nel suo browser)

- Il pulsante **🧮 CALCOLATRICE** (NumberInputCanvas) ora chiama `window.open('https://www.desmos.com/scientific?lang=it', '_blank', 'noopener,noreferrer')` DENTRO il gestore del clic (gesture utente → nessun blocco pop-up) e poi apre `CalculatorPanel.tsx`, che è solo un PROMEMORIA: «Calcolatrice aperta in una nuova scheda — l'esercizio ti aspetta qui».
- NIENTE IFRAME: Desmos rifiuta l'incorporamento in ogni ambiente e l'evento `load` dell'iframe scatta comunque → qualsiasi tentativo di incorporamento/fallback è da evitare.
- Chiusura del promemoria con **✕ TORNA ALL'ESERCIZIO** o ESC; link **RIAPRI LA CALCOLATRICE ↗** come soccorso. L'app non naviga mai: stato del box sempre intatto.
- NON reintrodurre l'iframe né spostare window.open fuori dal gestore del clic.

## §37 (27/10) — Pillola blu con la formula risolta in ogni box (foto collage_matematico)

- In `EsercizioFrazioni.tsx` → `BoxCard`, ramo `corretto`: SOTTO la riga verde della risoluzione (`op = answerLatex`, `text-success`) c'è SEMPRE una **pillola più chiara del box** (bianca `bg-white` + bordo `#E5E0D8` + `rounded-full`, `data-testid="pillola-formula-risolta"`) con la STESSA parte di formula con il risultato — la riga che si trova anche nel PDF — scritta in **BLU** (`text-[#2563EB]`, KaTeX eredita il colore).
- Vale per OGNI box numerato risolto correttamente: numerico E simbolico (lettere/radicali), esercizio demo E costruito con l'IA (il parsing IA produce gli stessi `Box`).
- CONTENUTO (correzione utente 27/10): la pillola mostra L'INTERA ESPRESSIONE accorciata — la riga progressiva del PDF — NON il solo pezzo risolto: BoxCard riceve `rigaProgressiva={esercizio.righeProgressive[idx + 1]}` (la riga i+1 corrisponde al box i, validata dal server: contiene già il risultato del box sostituito). Fallback al pezzo `${box.op} = ${box.answerLatex}` solo se le righe mancano. La pillola ha `max-w-full overflow-x-auto` per le righe lunghe.
- NON rimuovere la riga verde: la pillola si aggiunge SOTTO (richiesta esplicita «sotto la scritta della risoluzione in verde»).

## §38 (27/10) — Rifiniture UI su foto utente

1. **Pillola della formula risolta**: angoli da `rounded-full` a `rounded-xl` (più rettangolari: gli angoli pieni nascondevano i margini dell'espressione).
2. **Pannello CALCOLATRICE** (`CalculatorPanel.tsx`): testo ridotto a «Quando hai finito con la calcolatrice, premi il pulsante sotto»; icona 🧮, titolo in grassetto e i due pulsanti (✕ TORNA ALL'ESERCIZIO, RIAPRI LA CALCOLATRICE ↗) invariati. Tutto il marrone della sezione ora usa i token `primary` dell'app (oklch 55% .115 42), NON più i marroni fissi #5d4037/#3e2723/#4e342e/#8a5a44.
3. **Pulsanti ✎ DIGITA IL VALORE e 🧮 CALCOLATRICE** (`NumberInputCanvas.tsx`, ramo tastiera): da testo `text-muted-foreground` a pulsanti pieni `bg-primary text-primary-foreground rounded-lg` — lo stesso marrone di RICONOSCI/VERIFICA.

## §39 (27/10) — Freccia ← e scrolling mobile del ritaglio (pattern della gemella)

1. **Pulsante del pannello calcolatrice**: `← TORNA ALL'ESERCIZIO` (freccetta a sinistra al posto della ✕, richiesta utente). Icona 🧮, titolo, testo e colore invariati.
2. **Scrolling mobile del ritaglio foto** (`CropDialog.tsx`): clonato il pattern di `SCROLLING-MOBILE.md` della repo gemella andreakeating1982/Applicazione-Latino-facile (copia inclusa nella radice di questa repo):
   - `<Dialog modal={false}>` (§2.1): la pagina dietro resta SCORRIBILE col dito mentre la finestra è aperta;
   - wrapper foto `touch-pan-y` (§2.3): il dito sulla foto fa scorrere il corpo, il ritaglio non si muove per sbaglio; `touch-none` resta SOLO su maniglie e area di spostamento;
   - corpo già conforme (§2.2): `min-h-0 flex-1 overflow-auto overscroll-contain` tra header e footer fissi;
   - regressione nota (§5): dopo OGNI modifica alle finestre rieseguire `grep -n "modal={false}" client/src/components/CropDialog.tsx` — può perdersi.

## §40 (27/10) — Avviso frazione impilata eliminato per sempre

Rimosso da entrambe le pagine (`EspressioniExercises.tsx` ~1877, `EsercizioFrazioni.tsx` ~342) l'avviso «💡 Scrivi il risultato come frazione impilata (il numero di sopra, la linea, il numero di sotto).» — giudicato superfluo dall'utente. REGOLA FISSA: non reintrodurlo mai, nemmeno come hint condizionale; il comportamento (frazione impilata sempre, mai decimali con la virgola) NON cambia: è solo la scritta a essere stata tolta.

## §41 (27/10) — Sfondo beige dello specchietto di ritaglio

In `CropDialog.tsx` lo specchietto della foto (wrapper con `rounded-xl border-2 border-[#d6cec4]`) ha sfondo `bg-[#f8f1e4]` — lo STESSO beige del corpo della finestra — non più `bg-black/90`. L'oscuramento `bg-black/55` ATTORNO al box di ritaglio resta invariato: è funzionale alla selezione (mostra cosa verrà tagliato). NON tornare al nero dietro la foto.

### §41.1 (27/10) — Intera finestra beige, non solo lo specchietto
Richiesta utente dopo il primo intervento: il beige `#f8f1e4` va su TUTTO il CropDialog — `DialogContent` ora `bg-[#f8f1e4]` (prima `bg-card` bianco: la testata «TAGLIA I MARGINI DELLA FOTO» spiccava) e il piedino `bg-[#f8f1e4]` pieno (prima `bg-background/80`). Nessuna residua `bg-card`/`bg-background/80`/`bg-black/90` nel file.

## §42 (27/10) — Collaudo completo e correzione dei decimali con la virgola

Collaudo in produzione: 9 espressioni su 10 costruite in 15-22 s; fallivano SEMPRE quelle con decimali con la virgola (es. «2,5 + 3/4·2 - 1/8»). Cause e correzioni in `server/costruisci.ts`:
1. `valore()`/`polinomio()` del validatore ora passano da `conPuntoDecimale()` (virgola tra cifre → punto, solo nella verifica dell'output IA; `latexValue` per le risposte studente resta invariata: lo studente NON può scrivere decimali con la virgola).
2. Normalizzazione `2{,}5` → `2,5` in tutto l'esercizio prima dei controlli.
3. Regola 2b nel prompt: ogni decimale ha un box «DECIMALI IN FRAZIONE» (op = il solo decimale, risposta = frazione ridotta) PRIMA degli altri calcoli; poi solo frazioni impilate.
Verificato: 2,5+3/4·2-1/8 → 31/8; 0,5+1/4-0,25·2 → 1/4; 1,2·3+4:0,5-2 → 48/5 (tutti corretti, 1 tentativo).

## §43 (27/10) — Collaudo: ritaglio, trascrizione decimali, qualità dei testi guida
- **CropDialog**: testi ≥ 14 pt (il Dialog è in portal, fuori da `.expr-exercise-page`); pulsanti «Ruota sinistra/destra»; le 8 maniglie hanno `tabIndex=0` e frecce (2%, Maiusc 10%). Verificato a 1280 px e 390 px.
- **Trascrizione tastiera**: il decimale (`2,5`) NON viene più convertito in frazione (`Tok/Node num.dec` in `lib/espressioni.ts`, stampa `2{,}5`): la conversione la fa lo studente nel box «DECIMALI IN FRAZIONE». Test: `decimaliFedeli.test.ts`.
- **Testi guida** (`server/costruisci.ts`): regola prompt 5b (metodo, ≤ 90 car., una azione per frase, niente gergo) + `rifinisciFrase()` deterministica, applicata anche agli esercizi letti dalla CACHE. Corregge l'errore «moltiplico la base per sé stessa due volte» (3² = 3·3). Test: `rifinisciFrase.test.ts`.
- Scelta lasciata invariata (protetta da FILOSOFIA-DSA.md): `mcm(a,b)=n` nel testo guida.

## §44 — Ritaglio foto sostituito con il clone fedele 8731 (28/10/2026)

Richiesta: ricopiare integralmente il ritaglio del documento allegato
`CLONARE-PHOTO-CROPPER-AGGIORNATO-8731.md`, non reinterpretarne la UI.

- `CropDialog.tsx`, `useCropDialogViewport.ts`, `cropBox.ts` e
  `photo-crop.css` corrispondono ai rispettivi sorgenti incorporati nel kit.
  Non toccare `confirm()` né le funzioni di geometria.
- Titolo RITAGLIA LA FOTO, nessuna istruzione sotto né icona centrale.
  Quattro comandi marroni in un solo riquadro, senza AZZERA:
  RUOTA SINISTRA / RUOTA DESTRA / CHIUDI / RITAGLIA.
- L'interno della selezione trascina direttamente con mouse/touch; lo scroll
  resta sui margini beige e fuori dalla selezione. Delta dall'ultimo evento,
  pointer capture sul contenitore stabile, 8 maniglie e tastiera preservati.
- CropDialog è MODALE. Il vecchio pattern `modal={false}` è superato SOLO
  per questo dialogo. Hook con body fixed important e ripristino stili/scroll;
  visualViewport nella vista autonoma, IntersectionObserver nell'iframe.
- `heightSync.ts`: aggiunte solo la guardia `data-lf-crop-open` e la rimisura
  rAF dopo `lf:crop-closed`. Protocollo, token, ping e anti-loop invariati.
- `imagePrep.ts` della destinazione mantenuto: normalizzazione EXIF già
  presente, nessuna sostituzione del pre-processing OCR dell'app.
- Firma callback invariata `onConfirm(File)`; uscita PNG lossless lato max
  2200px. Il consumer continua a trascrivere come pezzo, senza calcolare.
- I test originali del kit richiedono adattamenti: route `/espressione`,
  risposta OCR matematica valida e controllo del pezzo (non textarea latina).
  La fixture generica `/photo-crop-test` è temporanea: rimuoverla dalla UI
  prima della consegna. Riavviare Vite se serve ancora un modulo in cache.
- Solo anteprima per questo intervento. Produzione dopo autorizzazione
  esplicita in un nuovo messaggio, checkpoint obbligatorio.

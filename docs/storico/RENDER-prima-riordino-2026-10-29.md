# 🚀 RENDER — Trasferire l'app da Easy-Peasy.AI a Render (via GitHub)

> Guida passo-passo per spostare l'app **Espressioni Letterali, Monomi e Polinomi** su
> [Render.com](https://render.com) usando un repository GitHub e il Blueprint
> (`render.yaml`) già incluso nel pacchetto.

---

## Perché funziona "out of the box"

L'app usa un frontend **Vite/React + server Express**, non un semplice
Static Site. Il server:

- serve i file statici (`dist/public`);
- imposta gli header **COOP/COEP** (`Cross-Origin-Opener-Policy` /
  `Cross-Origin-Embedder-Policy`) sui documenti HTML — **richiesti da ONNX Runtime Web**
  per l'uso di `SharedArrayBuffer` (riconoscimento della scrittura a mano);
- imposta **CORS** `Access-Control-Allow-Origin: *` su `/fonts` (per caricare il font
  OpenDyslexic dalle cornici embed cross-origin).

**Stato attuale: versione universale, deploy Easy-Peasy 8744.** Il server
espone anche le rotte IA di trascrizione, dettato e costruzione esercizi.
Richiedono la propria **`EASY_PEASY_API_KEY`** nell'ambiente di build/runtime.
Lo ZIP non contiene quella di produzione. Senza chiave UI e ritaglio
funzionano, ma la costruzione IA non è disponibile (503).
`DATABASE_URL` è facoltativa per sessioni/cache; senza database il fallback
usa file temporanei e non garantisce persistenza dopo riavvio.
Non importare dati della produzione per provare questo pacchetto.

---

## Prerequisiti

- Un account GitHub (gratuito).
- Un account Render (gratuito — il piano Free basta).
- Il contenuto di questo pacchetto (la cartella dell'app).

---

## Passo 1 — Creare il repository su GitHub

1. Vai su [github.com](https://github.com) → **New repository**.
2. Dagli un nome (es. `espressioni-monomi-polinomi`), **Public** o **Private** a scelta.
3. **NON** inizializzare con README/gitignore (Render clonerà il tuo codice).
4. Carica **tutti i file di questo pacchetto** nella root del repository.

Da terminale (nella cartella del pacchetto):

```bash
git init
git add .
git commit -m "Espressioni Letterali, Monomi e Polinomi"
git branch -M main
git remote add origin https://github.com/<tuo-utente>/espressioni-monomi-polinomi.git
git push -u origin main
```

> **Nota**: NON committare `node_modules/`, `dist/` e `.git/`. Il pacchetto ZIP esportato
> li esclude già. Se li hai localmente, aggiungili a `.gitignore` (già presente).

---

## Passo 2 — Deploy con il Blueprint su Render

1. Vai su [render.com](https://render.com) → **Dashboard** → **New** → **Blueprint**.
2. Collega il repository GitHub che hai appena creato.
3. Render legge automaticamente il file **`render.yaml`** alla root e mostra l'anteprima
   del Web Service che sta per creare.
4. Impostare `EASY_PEASY_API_KEY` nella sezione Environment con la propria
   chiave. Il build genera il fallback server; non usare variabili `VITE_*`.
5. Clicca **Apply** (o **Create Resources**). Non caricare `.env`,
   `shared/env.generated.ts` o `dist/index.js` su GitHub.

Il file `render.yaml` (già incluso) definisce:

```yaml
services:
  - type: web
    name: espressioni-monomi-polinomi
    runtime: node
    plan: free
    buildCommand: pnpm install --frozen-lockfile && pnpm build
    startCommand: pnpm start
    healthCheckPath: /
    autoDeploy: true
    envVars:
      - key: NODE_VERSION
        value: "22"
      - key: NODE_ENV
        value: production
```

Render:
1. installa le dipendenze dal lockfile (`pnpm install --frozen-lockfile`);
2. esegue la build (`pnpm build` → Vite + esbuild del server → `dist/`);
3. avvia `pnpm start` (`NODE_ENV=production node dist/index.js`);
4. ascolta su `process.env.PORT` (impostata automaticamente da Render).

---

## Passo 3 — Verifica

1. Attendi che il deploy finisca (stato **Live**).
2. Apri l'URL fornito da Render (es. `https://widget-matematico-sorgente.onrender.com`).
3. Verifica che:
   - la schermata iniziale si carichi (Cognome, Nome, Data, Classe);
   - il **riconoscimento della scrittura a mano** funzioni (i modelli ONNX si caricano
     via WASM — richiede gli header COOP/COEP già configurati);
   - il **font OpenDyslexic** si carichi (DevTools → Network → `/fonts/…ttf` → 200);
   - il **PDF** si generi correttamente.

---

## Passo 4 — Dominio personalizzato (opzionale)

1. Su Render → il Web Service → **Settings** → **Custom Domains**.
2. Aggiungi il tuo dominio (es. `app.miosito.it`) e configura il record **CNAME**
   presso il tuo provider DNS come indicato da Render.
3. Attendi la verifica e l'emissione del certificato HTTPS (automatico).

---

## Passo 5 — Aggiornare l'app dopo il primo deploy

Con `autoDeploy: true`, **ogni `git push` su `main` riavvia automaticamente la build**.
Basta quindi:

```bash
git add .
git commit -m "Aggiornamento ..."
git push
```

La CI di GitHub (`.github/workflows/ci.yml`) esegue già in parallelo `install → check →
test → build`, così gli errori TypeScript vengono scovati prima del deploy.

---

## Risoluzione problemi

| Sintomo | Causa probabile | Soluzione |
|---------|-----------------|-----------|
| Il riconoscimento scrittura non parte / errore WASM | Header COOP/COEP mancanti | Verificare `server/index.ts` (header su `.html`) e che si usi `pnpm start` |
| Font OpenDyslexic non carica (fallback serif) | CORS su `/fonts` mancante | Verificare `app.use("/fonts", ...)` in `server/index.ts` |
| Build fallita | Errore TypeScript | Eseguire `pnpm check` in locale e correggere |
| `ERR_OSSL` / versione Node | Node diverso da 22 | `NODE_VERSION=22` è già in `render.yaml` |
| 404 su `/favicon` o route | Routing client-side | Il server fa già `app.get("*")` → `index.html` |

---

*Guida inclusa nel pacchetto esportabile — Settembre 2026.*

## Variabile d'ambiente per l'IA (giro 20)

`POST /api/ai/transcribe` richiede `EASY_PEASY_API_KEY` (endpoint OpenAI-compatible di
Easy-Peasy AI, modello `gemini-3-flash`). Su Easy-Peasy è iniettata automaticamente;
su Render aggiungerla in Environment. Senza chiave il server risponde 503;
per la sola foto è disponibile il soccorso locale Tesseract/ONNX, ma non
la costruzione IA degli esercizi. Ricostruzione aggiornata: `REBUILD.md`.

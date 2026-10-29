# RENDER — GitHub → Web Service Node/Express

App: **WIDGET METACOGNITIVO PER IL CALCOLO DI ESPRESSIONI**, baseline pubblicata8756.
Questa è una procedura di trasferimento: la consegna dello ZIP non crea
un repository, un servizio Render né un nuovo deploy Easy-Peasy.

## 1. Perché Web Service e non Static Site

Express serve `dist/public`, le API `/api/ai/*` e gli header COOP/COEP
necessari al riconoscimento; `/fonts` espone CORS per la cornice Blogger.
Un semplice Static Site non sostituisce queste funzioni.
La costruzione IA richiede la PROPRIA `EASY_PEASY_API_KEY`, solo server.
Senza chiave build/UI/crop funzionano, API IA 503 atteso.

Prerequisiti: account GitHub e Render, accesso al repository e una propria
configurazione IA se desiderata. Il Blueprint propone `plan: free`:
verificare che il piano scelto sia adeguato a risorse, sospensione e
persistenza richieste; non è una garanzia di disponibilità o prestazioni.

## 2. Caricare correttamente su GitHub

Estrarre lo ZIP. Entrare nella cartella **espressioni-monomi-polinomi**
che contiene `package.json`. Questi file devono essere direttamente nella
root del repository, non dentro un secondo livello di cartelle.
Includere anche file nascosti: `.github/`, `.gitignore`, `.env.example`.
Non caricare soltanto il file ZIP.

Creare un repository pubblico o privato, collegabile dal proprio account
Render. Non inizializzarlo con un altro README se si usa il flusso seguente.
Dalla cartella estratta, PRIMA di creare un `.env` con credenziali:

```sh
git init
git add .
git status --short
git commit -m "Sorgenti widget metacognitivo: baseline8756"
git branch -M main
git remote add origin https://github.com/TUO-UTENTE/TUO-REPOSITORY.git
git push -u origin main
```

Sostituire il segnaposto e verificare in `git status` che non ci siano
`.env`, `env.generated.ts`, database, sessioni, log, `node_modules` o `dist`.
Non togliere lockfile/patches per risolvere errori di installazione.

## 3. Blueprint: configurazione effettivamente inclusa

Render → **New → Blueprint** → collegare il repository e il branch.
Verificare l’anteprima delle risorse prima di confermare.
Il file `render.yaml` incluso contiene:

```yaml
services:
  - type: web
    name: espressioni-monomi-polinomi
    runtime: node
    plan: free
    buildCommand: corepack enable && pnpm install --frozen-lockfile --prod=false && pnpm check && pnpm build
    startCommand: pnpm start
    healthCheckPath: /
    autoDeploy: true
    envVars:
      - key: NODE_VERSION
        value: "22"
      - key: NODE_ENV
        value: production
      - key: ENABLE_COREPACK
        value: "1"
      - key: EASY_PEASY_API_KEY
        sync: false
```

`sync: false` richiede di inserire la propria chiave dall’interfaccia;
il valore non è nel repository. Per un clone cambiare il nome del servizio.
`--prod=false` è deliberato: Vite, TypeScript ed esbuild sono dipendenze
di sviluppo, indispensabili anche se `NODE_ENV=production` durante il build.
Corepack usa la versione pnpm dichiarata in `packageManager`.

Facoltativo: aggiungere `DATABASE_URL` in Environment per una propria
persistenza compatibile Postgres/Neon. Senza DB l’app usa file `/tmp`:
cache/sessioni possono sparire con riavvii o cambio istanza. Lo ZIP non
contiene dati o database della produzione. Non eseguire seed o migrazioni
sull’ambiente originale per fare questa prova.

Il server ascolta la `PORT` assegnata da Render; non fissarla manualmente.
Nessuna directory statica da impostare al posto di `startCommand`.

### Alternativa manuale

**New → Web Service**, stesso repo, runtime Node, Node 22,
ENABLE_COREPACK=1, identici build/start/health check e variabili sopra.
Per le chiavi usare solo Environment, mai variabili `VITE_*`.

## 4. Verifiche dopo il proprio deploy

- Root: HTTP 200, contenuto della schermata dati e JS/CSS effettivi.
- `/fonts/OpenDyslexic-Regular.ttf`: HTTP 200, tipo font/contenuto reale,
  non HTML di fallback SPA; CORS `*`.
- Modelli ONNX, WASM, Tesseract e quaderno pubblico scaricabili.
- HTML con `Cross-Origin-Opener-Policy: same-origin` e
  `Cross-Origin-Embedder-Policy: require-corp`.
- Senza chiave: `POST /api/ai/transcribe` risponde 503 (atteso).
  Con chiave: testare trascrizione/costruzione su dati sintetici propri.
- Ritaglio foto, drag/maniglie, rotazioni, PNG; scorrimento interno
  seconda pagina e KaTeX lungo dentro i box; accessibilità/TTS.
- PDF corrispondente allo svolgimento realmente inserito dallo studente.

Il manifest dello ZIP certifica sorgenti/asset, non l’esito di un deploy
Render. Il rapporto `docs/VERIFICA-RIORDINO-2026-10-29.md` distingue i test
locali effettivi dalle verifiche da svolgere sul proprio servizio.

## 5. Aggiornamenti, CI e segreti

La CI GitHub usa Node 22/pnpm del package ed esegue in sequenza:
install → type-check → Vitest nella directory `client` → test Python del
packaging → build. L’artifact contiene SOLO `dist/public`: non il server,
che potrebbe incorporare la chiave tramite `sync-env.mjs`.
Non configurare chiavi di produzione nei job CI per verificare una build.

Con `autoDeploy: true`, un push sul branch collegato può far partire un
build Render **indipendentemente dall’esito della CI**. Per richiedere
approvazione o controlli prima di pubblicare, configurare nel proprio
servizio il gate supportato oppure disabilitare l’autodeploy e pubblicare
manualmente dopo CI verde. Non dichiarare che questa CI lo blocchi da sola.

Il fallback chiave viene incorporato soltanto nel server durante il build:
non distribuire `dist/index.js` né `shared/env.generated.ts`. Per cambiare
chiave, aggiornare Environment e ridistribuire/riavviare come richiesto
per eliminare vecchi fallback. Nessuna chiave nel client.

## 6. Blog e dominio

Dopo il collaudo, aggiornare `APP_URL` nella cornice dedicata e verificare
font cross-origin, microfono e protocollo altezza/token. Non sostituire
l’URL dell’app sorgente prima di avere un nuovo servizio funzionante.
Un dominio personalizzato si configura dalle impostazioni del proprio
servizio secondo le indicazioni DNS di Render.

## Risoluzione problemi

| Sintomo | Verifica |
|---|---|
| `vite` / `tsc` / `esbuild` non trovato | install con `--prod=false`; Node 22 e pnpm del package |
| Lockfile incompatibile | non rigenerarlo; usare Corepack e packageManager dichiarato |
| API 404 o risposta HTML | avviare Express con `pnpm start`, non Vite o Static Site |
| API IA 503 | propria chiave server e nuovo build/riavvio; niente `VITE_*` |
| ONNX/WASM non carica | percorso, risposta binaria reale, header COOP/COEP |
| Font non carica in cornice | risposta reale del font e CORS di `/fonts` |
| Sessioni sparite dopo riavvio | fallback `/tmp` non persistente; configurare propria persistenza |
| Nuovo sito espone ancora vecchi asset | verificare bundle effettivi e propagazione prima di concludere |

Istruzioni precedenti conservate in
`docs/storico/RENDER-prima-riordino-2026-10-29.md`, solo per cronologia.


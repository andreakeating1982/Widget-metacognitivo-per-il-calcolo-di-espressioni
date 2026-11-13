# Collaudo ripetibile: feedback, prodotti notevoli e PDF

Queste prove usano solo esercizi sintetici e intercettano tutte le richieste
`/api/`: **non** inviano esercizi a IA remota, non scrivono nel database e non
richiedono dati personali. Usano browser desktop, telefono e touch **emulati**,
non dispositivi fisici. Non sono una certificazione di accessibilità o di
qualità matematica universale.

## Prerequisiti e ambiente isolato

Estrarre lo ZIP in una nuova cartella e seguire `REBUILD.md`, senza creare
`.env`, impostare chiavi o collegare database. Installare le dipendenze
bloccate dal lockfile, quindi costruire senza credenziali. Gli script browser
richiedono un ambiente QA separato con Node 22, Playwright 1.64.1 e Chromium;
Playwright non è una dipendenza runtime dell'app. Il test dell'intestazione
PDF richiede inoltre `pdftotext` (pacchetto Poppler) per controllare il testo
estratto dalla stampa A4. Esempio su Linux/macOS, dalla cartella estratta
che contiene `package.json`:

```sh
set -eu
APP_ROOT="$(pwd -P)"
QA_DIR="$(mktemp -d)"

# L'estrazione non deve avere .env o credenziali; non usare un database reale.
env -u EASY_PEASY_API_KEY -u DATABASE_URL pnpm build
pnpm exec tsx tests/feedback-fixtures.ts "$QA_DIR/feedback-fixtures.json"
pnpm exec tsx tests/student-flow-fixtures.ts "$QA_DIR/student-fixtures.json"

# Avviare SOLO la copia isolata sulla porta libera 3171 (modificarla se occupata).
env -u EASY_PEASY_API_KEY -u DATABASE_URL PORT=3171 node dist/index.js >"$QA_DIR/server.log" 2>&1 &
QA_PID=$!
trap 'kill "$QA_PID" 2>/dev/null || true' EXIT
for i in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:3171/ >/dev/null; then break; fi
  sleep 1
done
curl -fsS http://127.0.0.1:3171/ >/dev/null

# Installazione di test separata: non modificare package.json o lockfile dell'app.
cd "$QA_DIR"
npm init -y
npm install --no-save playwright@1.64.1
npx playwright install chromium
cp "$APP_ROOT/tests/feedback-prodotti.e2e.mjs" .
cp "$APP_ROOT/tests/parentesi-frazione.e2e.mjs" .
cp "$APP_ROOT/tests/exercise-scroll.e2e.mjs" .
cp "$APP_ROOT/tests/student-flow.e2e.mjs" .
cp "$APP_ROOT/tests/frame-controls.e2e.mjs" .
cp "$APP_ROOT/tests/frame-blog-sync.e2e.mjs" .
cp "$APP_ROOT/tests/pdf-intestazione.e2e.mjs" .

FEEDBACK_URL=http://127.0.0.1:3171 \
FEEDBACK_FIXTURES="$QA_DIR/feedback-fixtures.json" \
FEEDBACK_KATEX="$APP_ROOT/node_modules/katex/dist" \
FEEDBACK_OUTPUT="$QA_DIR/feedback" node feedback-prodotti.e2e.mjs

PARENTESI_QA_URL=http://127.0.0.1:3171 \
PARENTESI_QA_FIXTURES="$QA_DIR/feedback-fixtures.json" \
PARENTESI_QA_OUTPUT="$QA_DIR/parentesi" node parentesi-frazione.e2e.mjs

EXERCISE_SCROLL_URL=http://127.0.0.1:3171 \
EXERCISE_SCROLL_OUTPUT="$QA_DIR/scroll" node exercise-scroll.e2e.mjs

STUDENT_FLOW_URL=http://127.0.0.1:3171 \
STUDENT_FLOW_FIXTURES="$QA_DIR/student-fixtures.json" \
STUDENT_FLOW_KATEX="$APP_ROOT/node_modules/katex/dist" \
STUDENT_FLOW_OUTPUT="$QA_DIR/student" node student-flow.e2e.mjs

FRAME_CONTROLS_URL=http://127.0.0.1:3171 \
FRAME_PROJECT_DIR="$APP_ROOT" FRAME_CONTROLS_OUTPUT="$QA_DIR/frame-controls" \
node frame-controls.e2e.mjs

FRAME_BLOG_URL=http://127.0.0.1:3171 \
FRAME_PROJECT_DIR="$APP_ROOT" FRAME_BLOG_OUTPUT="$QA_DIR/frame-blog" \
node frame-blog-sync.e2e.mjs

PDF_QA_URL=http://127.0.0.1:3171 \
PDF_QA_FIXTURES="$QA_DIR/feedback-fixtures.json" \
PDF_QA_KATEX="$APP_ROOT/node_modules/katex/dist" \
PDF_QA_OUTPUT="$QA_DIR/pdf-intestazione" node pdf-intestazione.e2e.mjs
printf 'Risultati e PDF sintetici: %s\n' "$QA_DIR"
```

Chromium può richiedere librerie di sistema aggiuntive: consultare la guida di
installazione Playwright per il proprio sistema. Il test con iframe crea un
host di prova intercettato dal browser, non pubblica un post.

## Cosa verificano

- **Feedback/prodotti:** 9 scenari, soglie da 0 a 5 stelle, prima risposta,
  titolo senza cornice, spazio tra istruzioni e input, CONTINUA, PDF solo nel
  feedback, conteggio identico nel PDF anche dopo «RIVEDI I PASSAGGI», nessun
  risultato ripetuto, frazione composta, prodotto notevole e PDF A4 sintetico.
- **Frazione e parentesi:** istruzione nel normale testo del metodo senza
  riquadro; accettazione di tonde, quadre e graffe anche annidate a numeratore
  e denominatore; rifiuto di parentesi sbilanciate, denominatori nulli e
  risposte diverse. Verifica primo tentativo e punteggio nel feedback/PDF,
  con API simulate e desktop, telefono e iframe emulati.
- **Intestazione PDF:** 6 scenari sintetici con 0, alcune o tutte le risposte
  giuste al primo colpo; dati normali, lunghi, speciali o assenti; confronto
  con il feedback, sicurezza HTML e stampa A4 con controllo del testo estratto.
  Il popup di stampa reale usa il CSS KaTeX pubblico previsto dall'app;
  il rendering PDF A4 separato usa invece il CSS locale. La riga dei dati va
  a capo se necessario, senza ridurre i caratteri.
- **Scroll:** 7 scenari tra desktop, schermi stretti, orizzontale, iframe e
  font160%; focus e raggiungibilità del pulsante PDF.
- **Percorsi studente:** 14 casi desktop/mobile e 2 rendering PDF sintetici,
  con costruzione e sessioni intercettate; verificare i report `results.json`.
- **Cornice del blog:** 6 casi per pulsanti, SVG, touch, schermo intero,
  ricarica e isolamento tra istanze, più 2 per il ping anticipato di conferma
  altezza con un iframe sintetico. Nessuna modifica a post o dati reali.

Le prove automatiche non inviano il PDF a una stampante né testano servizi IA
live o coprono tutte le espressioni. Per una variante cambiare i casi in modo
esplicito e aggiornare i contratti solo dopo la verifica del dominio.


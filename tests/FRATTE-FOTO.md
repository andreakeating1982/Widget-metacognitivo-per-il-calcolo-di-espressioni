# Collaudo isolato: frazioni letterali della foto

Le prove usano esercizi sintetici e intercettano tutte le richieste `/api/`.
Non contattano IA, non creano sessioni e non accedono a database reali.
Non sono prova di un telefono fisico, di una stampante o del modello IA live.

## Test del motore e della route

Dalla root del progetto, con dipendenze installate:

```sh
pnpm check
pnpm exec vitest run --root "$PWD" \
  server/frazioniLetteraliGuidate.test.ts server/trascrizioneFratte.test.ts \
  server/costruisci.test.ts server/costruisci-ai-mock.test.ts \
  server/costruisci-http-mock.test.ts
```

Il generatore deterministico è verificato solo per il suo ambito: non forzare
cancellazioni implicite, denominatori nulli o espressioni più complesse.
I casi non riconosciuti restano al flusso IA, senza garanzia di successo.

## Browser, iframe e caratteri ingranditi

Occorrono un ambiente Playwright con Chromium e l'app già avviata in locale.
In una shell con `PROJECT` che punti a questa cartella e `QA` all'ambiente
Playwright (che deve già contenere il modulo `playwright`):

```sh
cd "$PROJECT"
pnpm exec tsx tests/student-flow-fixtures.ts /tmp/widget-fixtures.json
cp tests/fratte-foto-iframe.e2e.mjs "$QA/"
cd "$QA"
FRATTE_QA_URL=http://127.0.0.1:3000 \
FRATTE_QA_FIXTURES=/tmp/widget-fixtures.json \
FRATTE_QA_OUTPUT=/tmp/widget-fratte-foto-results \
node fratte-foto-iframe.e2e.mjs
```

Scenari desktop, telefono/iframe e 320 px con font 160%; controlli su
scorrimento delle formule, istruzioni, tastiera e assenza di soluzioni prima
dell'input. Per il percorso completo e le regressioni su parentesi, PDF e
feedback vedere `STUDENT-FLOW.md` e `FEEDBACK-PRODOTTI.md`.


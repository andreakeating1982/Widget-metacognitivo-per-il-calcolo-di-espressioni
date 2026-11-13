# Collaudo isolato del percorso studente — 7/11/2026

## Cosa verifica

`student-flow-fixtures.ts` costruisce sette esercizi **sintetici** passando
le risposte di un finto modello dal vero `riparaEsercizio`: aritmetica,
frazioni letterali della foto, radicali, frazioni equivalenti, risultati
negativi, quadre/graffe e decimali con virgola. Le righe IA volutamente
scorrette devono essere ricostruite senza anticipare la soluzione.

`student-flow.e2e.mjs` apre il frontend in Chromium a larghezza desktop e
mobile, prova prima risposte errate e poi forme corrette/equivalenti, controlla
progressione e PDF e simula una sessione inesistente. Tutte le rotte `/api/`
sono intercettate: **nessuna chiamata IA o scrittura al database**. Il PDF
viene generato dal vero pulsante e renderizzato in A4 con il CSS KaTeX locale,
per le frazioni letterali e per le parentesi quadre/graffe annidate; verifica
anche la conservazione delle parentesi nella riga intermedia del PDF. Non è
una stampa su carta e la tastiera/il touch sono emulati.

`server/costruisci-ai-mock.test.ts` e `server/costruisci-http-mock.test.ts`
verificano anche pipeline e API server reali con modello e archivio simulati
in memoria; il secondo intercetta ogni lettura/scrittura delle cartelle di
archivio e blocca Neon. Non avviare fixture contro il database reale.

## Esecuzione

Da una shell, impostare `PROJECT` alla cartella contenente questo README e
`QA` a una cartella che abbia Playwright e Chromium installati. L'app deve
essere disponibile su localhost:3000; il test blocca tutte le sue API.

```sh
PROJECT=/percorso/del/progetto
QA=/percorso/ambiente-playwright
cd "$PROJECT"
pnpm exec tsx tests/student-flow-fixtures.ts /tmp/widget-fixtures.json
pnpm exec vitest run --root "$PROJECT" server/costruisci-ai-mock.test.ts server/costruisci-http-mock.test.ts
cp tests/student-flow.e2e.mjs "$QA/student-flow.e2e.mjs"
cd "$QA"
STUDENT_FLOW_URL=http://127.0.0.1:3000 \
STUDENT_FLOW_FIXTURES=/tmp/widget-fixtures.json \
STUDENT_FLOW_KATEX="$PROJECT/node_modules/katex/dist" \
STUDENT_FLOW_OUTPUT=/tmp/widget-student-flow-results \
node student-flow.e2e.mjs
```

Risultati in `results.json`; eventuali screenshot/PDF contengono solo dati
inventati per il collaudo. Non confondere questi test simulati con una prova
live del modello IA, con dispositivi fisici o con la produzione.


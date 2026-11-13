# Collaudo esteso del Widget Metacognitivo — 7 novembre 2026

## Stato della versione

Il collaudo descrive l'**anteprima** successiva alla produzione 8756 del
29 ottobre. Dopo il consenso esplicito, quella versione (con le correzioni
successive di ritaglio e cornice) è stata pubblicata il 7/11 nel deploy
**8999**: vedere `VERSIONE-8999.md` e `docs/DEPLOY-8999.md`. Anteprima e
produzione possono condividere il database.

## Interventi verificati

- Accettazione di forme algebriche equivalenti nelle frazioni letterali,
  inclusa la traccia fotografata dall'utente, e rifiuto dei casi errati
  verificati. Le frazioni complesse digitate da tastiera necessitano di
  parentesi che delimitino numeratore e denominatore.
- Controllo delle risposte numeriche esatte, inclusi radicali, decimali con
  virgola e valori non definiti. Alcuni radicali letterali che richiedono il
  valore assoluto non sono verificabili in ogni forma equivalente.
- Traccia fedele e conservazione di parentesi quadre e graffe, anche
  annidate, nei passaggi e nel PDF. Le frazioni già risolte restano impilate.
- Righe progressive ricostruite da operazioni verificate; prove contro
  risposte premature nei titoli, nelle istruzioni e negli ausili. La risposta
  resta dello studente e viene mostrata solo dopo il suo inserimento.
- Una sessione con `sid` inesistente mostra l'avviso, non l'esercizio
  predefinito; il contenuto personale non appare prima del caricamento.
- Colori del pulsante e del caricamento IA coordinati alla palette marrone;
  rimossi i suggerimenti verdi con lampadina sulla modalità di scrittura.
- L'anteprima avvia Express con le API; `pnpm dev:client` avvia soltanto
  il frontend Vite ed è adatto ai test che simulano i servizi.

## Esiti

| Verifica | Esito |
|---|---|
| TypeScript e build frontend/server | superati |
| Test unitari client | **886 superati**, 28 test diagnostici saltati |
| Test server, con archivi e modello simulati | **16 superati** |
| Corpus matematico indipendente costruito con SymPy | **720 confronti**, nessun errore registrato |
| Tracce IA storiche verificate | **24** fedeli al testo in ingresso |
| Percorso studente desktop/mobile | **16/16 scenari**, **146** controlli |
| Seconda pagina, iframe e ritaglio | **7/7 scenari**, **151** controlli |
| Terza pagina, iframe, scorrimento e accessibilità | **7/7 scenari**, **168** controlli |
| PDF A4 frazioni e parentesi | generati dal pulsante dell'app e controllati |
| API nell'anteprima | Express attivo; richiesta vuota rifiutata con 400 |

La prova del percorso copre risposta errata, risposta corretta/equivalente,
righe progressive, sessione assente e PDF. Per le parentesi annidate è stata
verificata anche l'annotazione della riga intermedia nel PDF. Le prove PDF
sono generate in Chromium a partire dal documento HTML del pulsante e non
sono stampe fisiche.

## Dettagli e limiti delle prove

- Le risposte del modello, la trascrizione della foto e le sessioni dei test
  browser sono **simulate**. I test server usano il motore e le route reali,
  con modello e archivi simulati in memoria; non certificano il servizio IA
  reale o la sua disponibilità.
- Touch, schermi e iframe sono emulati in Chromium; non sono prove su un
  telefono fisico, nel blog pubblico o su una stampante. La verifica della
  tastiera in iframe tiene conto dell'isteresi anti-tremolio preesistente:
  fino a 2 pixel di scarto del viewport, senza movimento della toolbar
  rispetto al documento, non sono trattati come uno scroll della toolbar.
- In tastiera, la barra `/` da sola non delimita automaticamente tutti i
  termini di una frazione: usare parentesi attorno a numeratore e denominatore.
- Il controllo visivo automatico segnala due aspetti preesistenti, fuori dal
  perimetro di questa modifica: il contrasto del pulsante **ENTRA** abilitato
  (bianco su `#B8846A`, circa 3,2:1) è inferiore a 4,5:1; alcuni controlli
  compatti della barra di accessibilità hanno area di tocco inferiore ai
  44px consigliati. La seconda pagina non ha un titolo visibile perché la
  sua rimozione è stata richiesta; sulla prima il titolo è marcato `h2`.
  Questi aspetti non sono stati modificati nel collaudo corrente.
- Le correzioni sono basate sui casi verificati: non certificano la totalità
  delle espressioni matematiche né l'infallibilità dell'IA o dell'OCR.
- Nessun test ha creato o cancellato righe nel database dell'utente. Nessuna
  chiave o bundle server deve essere incluso in eventuali pacchetti pubblici.

## Ripetere i controlli

Vedere `tests/STUDENT-FLOW.md`, `tests/INPUT-SCROLL.md` e
`tests/EXERCISE-SCROLL.md`. Per i test server:

```sh
pnpm exec vitest run --root "$PWD" \
  server/costruisci.test.ts server/costruisci-ai-mock.test.ts \
  server/costruisci-http-mock.test.ts
```


# Baseline pubblicata 9212 — Widget metacognitivo

Deploy autorizzato **9212**, 13/11/2026 (ora italiana); sorgente funzionale
`fa1d410` e checkpoint dell'anteprima condivisa `728b6f8`. Questa è l'app di
**espressioni**, non un risolutore di equazioni. Gli aggiornamenti di guida
successivi non implicano un nuovo deploy.

## Ramo con condizioni aggiuntive

Quando si applica la convenzione richiesta per un valore assoluto, il modulo
`client/src/lib/ramoCondizionato.ts` costruisce in memoria un percorso in cui
si sostituisce `|A|` con `A` sotto l'ipotesi aggiuntiva esplicita `A ≥ 0`.
`client/src/lib/moduliSottintesi.ts` ricava le condizioni e conserva il
raggruppamento. Le condizioni aggiuntive sono distinte dalle C.E. e compaiono
anche nel PDF; il percorso indica che **gli altri casi non sono svolti**.
Non modificare il testo originario dell'esercizio, l'archivio della sessione
né presentare questa riscrittura come equivalente su tutto il dominio.
Se un'ipotesi numerica è falsa o un delimitatore non è leggibile, il ramo
non viene applicato. La continuazione aggiunge, dove verificabile, box
separati senza compilare i risultati per lo studente.

Per una nuova app di equazioni: un solo ramo non rappresenta in generale
l'insieme completo delle soluzioni; servono rami verificati e unione degli
insiemi oppure dichiarare esplicitamente il limite. Non applicare `A ≥ 0` a
un'espressione complessa senza una definizione appropriata. Vedi
`GUIDA-IA-CLONAZIONE-EQUAZIONI.md`.

## Funzioni da conservare e limiti

- MOSTRA SOLUZIONE è nascosta per default, si attiva solo sul box richiesto,
  si richiude e non compila. Testo e sintesi vocale non anticipano la risposta.
- Le C.E. originali sono da conservare anche dopo semplificazione. Non
  promettere un elenco completo delle esclusioni per forme che il motore non
  riesce a risolvere esattamente: non inventare condizioni mancanti.
- Radici di indici oltre 12 e negativi, periodici, virgola italiana, OCR da
  controllare, formule lunghe e PDF multipagina sono parte della baseline;
  consultare codice e test prima di sostenere il supporto di una forma.
- La prova dei 28 box della foto usa una risposta IA **registrata e simulata**;
  verifica la continuazione nell'interfaccia, non dimostra che ogni nuova
  chiamata IA live o tutte le immagini saranno sempre costruite correttamente.

## Verifiche documentate

- Suite unificata isolata: **1.588 superati, 28 saltati**, prima dell'ultimo
  limite di sicurezza sulla continuazione; test mirati e `pnpm check`
  rieseguiti dopo tale limite. Il rapporto del presente ZIP indica gli esiti
  della ricostruzione finale, senza usare vecchi conteggi come certificazione.
- Anteprima: 28 box consecutivi della foto registrata, PDF, opzione mostra/
  nascondi e condizioni; test desktop/mobile simulato. Non è un test su
  dispositivo fisico né una verifica IA live.
- Asset JS pubblicato `assets/index-BqWdPZnL.js`: SHA-256
  `4099b5ed4b0cac2df2424f37b5a354b80bfe7df245c40b8a11baaff07e1ad9a1`.
  CSS `assets/index-CU5iKsjL.css`: SHA-256
  `8ca4b7169e95a129d4a0751bfb8be173fd4e0811a226101af110a65785775d86`.
  Gli hash servono per la baseline IDENTICA, non per la variante modificata.
- Il clone e l'export non creano repository, servizi, nuovi deploy o dati.


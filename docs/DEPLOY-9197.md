# DEPLOY 9197 — Condizioni di Esistenza (C.E.) e numeri di pagina nel PDF

## Stato del rilascio

Produzione **9197**, 12 novembre 2026, pubblicata su consenso esplicito
dell'utente dopo l'anteprima condivisa e il collaudo dal vivo completato
(esercizio di prova risolto 14/14 al primo colpo). Runtime: checkpoint
`eba38a1`, progetto corrente della chat
`/home/user/espressioni-monomi-polinomi`. Sito pubblico:
https://espressioni-monomi-polinomi.easy-peasy.site/.

Bundle JS `index-BL9EkuY6.js`, SHA-256
`4f13e5f3d34e2fcc849e0c3a25735e3c014b5a304dc00be62f8c8b5dd98dd654`;
CSS `index-CU5iKsjL.css` INVARIATO dalla 9162, SHA-256
`8ca4b7169e95a129d4a0751bfb8be173fd4e0811a226101af110a65785775d86`.
Il JS pubblicato è stato confrontato con la build locale (stesso nome e
stesso hash servito da produzione).

## Novità 1 — CONDIZIONI DI ESISTENZA (C.E.) sempre nelle fratte

- Ogni espressione fratta (lettere al denominatore) comincia da una sezione
  **CONDIZIONI DI ESISTENZA (C.E.)** in testa a TUTTI i box di calcolo,
  con un box per ogni denominatore **originale** distinto
  («(x+1) ≠ 0» con consegna «Scrivi il valore vietato: x ≠ …»).
- Radici calcolate **in modo esatto dal motore**
  (`sezioneCondizioniEsistenza` in `server/costruisci.ts`), senza IA:
  grado 1; grado 2 con discriminante quadrato perfetto (frazioni impilate,
  es. x ≠ −3/2); fattore x^k (x³−x → −1, 0, 1); monomi a più lettere
  ((2ab) al denominatore → a ≠ 0, b ≠ 0).
- **Mai una C.E. incompleta**: se l'elenco completo delle radici non è
  garantito (grado > 2, radici irrazionali, esponenti negativi) il
  denominatore NON produce box.
- I box C.E. sono marcati `condizioniEsistenza`: saltano la verifica
  matematica dei conti e NON toccano le righe progressive (verificato dal
  vivo: dopo 3 box C.E. le righe restano allineate). Sopravvivono ai
  ricaricamenti dall'archivio (marca idempotente).
- MOSTRA SOLUZIONE su un box C.E. mostra/nasconde SOLO il valore vietato.
- **PDF**: riga CONDIZIONI DI ESISTENZA dopo l'intestazione, una
  implicazione per denominatore; nel PDF parziale la risposta compare solo
  quando lo studente l'ha calcolata (niente soluzione anticipata).
- Il prompt IA vieta esplicitamente di creare le C.E. da solo: le
  costruisce sempre il motore deterministico, anche nel percorso IA.
- Esercizi senza lettere al denominatore (solo numeri) NON hanno la sezione
  C.E.

## Novità 2 — Numeri di pagina nel PDF multipagina

- Quando il PDF scaricabile (parziale o completo) va su più di una pagina,
  il **numero di pagina** compare **in basso al centro** di ogni pagina
  (OpenDyslexic 11 pt).
- Solo PDF multi-pagina: la regola `@page { @bottom-center { content:
  counter(page) } }` (Chrome 131+) nasce DISATTIVATA; lo script della
  finestra di stampa misura il contenuto dopo che i font sono pronti e la
  attiva solo se supera l'altezza utile di una pagina A4
  (`(29.7-1.8-1.6)*96/2.54` ≈ 994 px). PDF di una pagina: nessun numero.
- Implementazione in `involucroPdf` (`client/src/pages/EsercizioFrazioni.tsx`,
  esportato per i test, sicuro anche fuori dal browser); test in
  `client/src/pages/pdfNumeriPagina.test.ts`.
- LIMITI: i margin-box di `@page` sono supportati da Chrome 131+; su
  Firefox/Safari il numero può non comparire (il PDF resta valido).

## Verifiche

- Suite completa: **1325 passati, 0 falliti, 28 saltati** (inclusi 16 test
  nuovi per le C.E. e 4 per i numeri di pagina). `pnpm check` pulito.
- Collaudo dal vivo su `1/(x+1)+1/(x+2)+1/(x+3)` (percorso deterministico):
  3 box C.E. accettati (−1, −2, −3), righe progressive allineate,
  esercizio completato 14/14 al primo colpo, PDF finale generato.
- Deploy verificato HTTP 200 sulla home di produzione.

## Pacchetto ZIP

La release 9197 è la baseline del pacchetto esportabile corrente
(`widget-metacognitivo-9197-equazioni.zip`); le release precedenti sono
cronologia. Report dell'archivio consegnato separatamente con lo ZIP.

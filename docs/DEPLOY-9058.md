# Deploy 9058 — Foto IA: le divisioni della trascrizione restano divisioni (8/11/2026)

## Richiesta dell'utente

«Risolvi il problema della foto allegata. E' ancora una questione di
proprietà delle potenze?» — foto `no.png` con l'espressione
`{[(½)⁴·((½)²)³:(½)⁹]}:[(½)³·½]²` (basi frazionarie impilate, esponenti
piccoli): nell'app la lettura della foto riusciva ma la costruzione
dell'esercizio falliva sempre («L'IA non ha prodotto una struttura
utilizzabile per l'esercizio. Riprova tra qualche minuto.»).

## Causa individuata (una sola, non le potenze)

Il motore delle proprietà delle potenze e la trascrizione IA funzionavano:
la foto veniva letta correttamente in notazione dell'app
(`{[(1⁄2)^4*((1⁄2)^2)^3:(1⁄2)^9]}:[(1⁄2)^3*1⁄2]^2`, «:» divisione, «⁄»
frazione impilata). Il difetto era nel **flusso foto del client**
(`onCropConfirm` in `client/src/pages/EspressioniExercises.tsx`): la
trascrizione IA passava per `normalizeExpressionOcr` — il normalizzatore
nato per il soccorso Tesseract — che esegue `.replace(/[÷:]/g, "/")`.
Tutte le divisioni diventavano barre di frazione e al costruttore arrivava
`{[(1⁄2)^4*((1⁄2)^2)^3/(1⁄2)^9]}/[(1⁄2)^3*1⁄2]^2`: fratte impilate annidate
al posto delle divisioni, struttura che l'IA non riesce a impostare
(3 tentativi su 3 bocciati, confermato via API: la stringa con «:»
riusce al tentativo 1, quella con «/» fallisce sempre).

## Correzione

- `client/src/lib/exprOcr.ts`: nuova opzione
  `normalizeExpressionOcr(raw, light, { keepDivision })` — con
  `keepDivision` (testo GIÀ in notazione dell'app, es. trascrizione IA)
  `unifyLine` non tocca «:» e riporta «÷» a «:»; il filtro caratteri
  ammette ora anche «:» (prima veniva rimosso, mascherato dalla
  conversione storica in «/»).
- `client/src/pages/EspressioniExercises.tsx`: nel flusso foto la
  sorgente è tracciata (`daIa`); la trascrizione IA viene pulita con
  `{ keepDivision: true }`, il soccorso Tesseract resta esattamente
  com'era (comportamento storico invariato).
- `client/src/lib/exprOcr.test.ts`: 4 nuovi test (trascrizione reale
  intatta, «÷» → «:», comportamento storico senza opzione, moltiplicazioni
  normalizzate in entrambe le modalità).

## Filosofia invariata

- La trascrizione diventa UN PEZZO, mai calcolo automatico; le risposte
  si mostrano solo dopo la risposta dello studente.
- Nessuna modifica al soccorso OCR, alla tastiera, al microfono, ai PDF
  o alla cornice del blog.

## Collaudo

- Suite: **999 client** (995 dorati + 4 nuovi) + **53 server**
  + `pnpm check` pulito.
- **Collaudo UI completo locale** (server isolato 3181 senza database,
  Playwright, flusso reale dell'utente): foto → ritaglio → lettura IA
  (8,5 s) → pezzo aggiunto → costruzione **riuscita al tentativo 1 in
  46,6 s** → pagina 3 con l'espressione impilata corretta, box 1 con il
  solo metodo («Moltiplico tra loro gli esponenti lasciando la stessa
  base»), nessuna soluzione visibile.
- **Produzione 9058** (`espressioni-monomi-polinomi.easy-peasy.site`,
  servizio `deploy-2a7acf3f-6909-wmoltmgh5q-uc.a.run.app`): app 200 con
  titolo corretto su entrambi gli URL; bundle `assets/index-Dpnp3kZL.js`
  servito con SHA-256
  `c50319a63e53a7f699dfd13757ce6949cefe17cff35277794096ccb1e71a39e2`
  identico al build locale; CSS `index-D6pcemJP.css` invariato; flusso
  foto completo ripetuto su produzione: lettura IA 10,9 s, costruzione
  **riuscita al tentativo 1 in 6,4 s**, pagina 3 senza errori e senza
  soluzioni (screenshot `prod-5-esercizio.png` verificato).

## Limiti

- Il soccorso Tesseract (solo quando l'IA non risponde) continua a
  convertire «:» in «/» come da comportamento storico: non è stato
  toccato.
- Gli esercizi costruiti PRIMA del 9058 e salvati in sessione non
  cambiano (la correzione agisce alla lettura della foto).

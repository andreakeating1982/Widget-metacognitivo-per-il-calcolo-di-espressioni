
# Deploy 9052 — Riconoscimento delle frazioni algebriche (7/11/2026)

## Richiesta dell'utente

«L'app non riconosce in alcun modo l'espressione algebrica nella foto
allegata» — frazioni algebriche impilate in fila: a² sopra (ab−b²),
(a²+b²) sopra (a²−b²), b² sopra (ab+b²), unite da sottrazioni.

## Cause individuate (due difetti indipendenti)

1. **Contratto IA senza parentesi algebriche** (`server/index.ts`,
   `AI_CONTRACT`): il prompt chiedeva di trascrivere le frazioni impilate con
   `⁄` ma non diceva di racchiudere tra parentesi numeratore e denominatore
   che contengono somme, differenze o prodotti. Senza parentesi la
   trascrizione diventa ambigua e il parser legge un'espressione diversa
   (es. `a^2⁄ab-b^2` = a²/ab − b²). Banco di prova live con il vecchio
   prompt: **37/57** su foto algebriche (la foto utente 2/3), ma **15/15**
   su foto numeriche e con polinomi: il difetto riguarda SOLO le frazioni
   algebriche.
2. **Resa delle frazioni impilate nel display** (`client/src/lib/
   EspressioniExercises.tsx`): l'operando di `⁄` poteva essere solo un
   fattore singolo; in `a^2⁄(ab-b^2)` la potenza restava fuori e l'esponente
   «2» veniva scambiato per il numeratore della frazione → l'espressione
   giusta si mostrava come «a elevato a 2/(ab−b²)». Anche con la
   trascrizione giusta l'utente vedeva un'espressione sbagliata.

## Correzioni

- `server/index.ts`: nuova riga «FRAZIONI ALGEBRICHE» nel contratto
  (numeratore/denominatore non semplici → SEMPRE tra parentesi tonde;
  ogni frazione scritta per intero, anche con tre o più frazioni in fila;
  esempi espliciti). Unica eccezione ammessa alla regola «non aggiungere
  parentesi» di TRASCRIVI (parentesi che delimitano numeratore e
  denominatore dell'impilata). Filosofia invariata: l'IA TRASCRIVE, non
  risolve; nessuna soluzione anticipata.
- Nuovo modulo puro **`client/src/lib/appNotationLatex.ts`** (estratto da
  `EspressioniExercises.tsx`, non-React): la conversione notazione → LaTeX
  ora prende l'INTERO operando di `⁄` (potenze comprese), accolama le
  graffe degli esponenti con più caratteri (`x^{10}`, `x^{-2}`) e non
  mostra dentro la frazione le parentesi che delimitano numeratore e
  denominatore (come sul libro). Esportato anche `tidyFractionParens`.
- Test **`client/src/lib/appNotationLatex.test.ts`**: 27 test (conversione
  pura, esponenti multi-carattere, radici attorno alle frazioni, parentesi
  di delimitazione, casi della foto utente).

## Verifiche

- Suite: client **983 superati, 28 saltati** (era 956/28); server **45
  superati**; `pnpm check` e `pnpm build` puliti.
- Browser con API intercettate (nessuna chiamata IA reale, nessun dato
  scritto): con la risposta IA osservata in produzione con parentesi
  corrette la lista dei pezzi e il riquadro di controllo mostrano ESATTAMENTE
  l'espressione della foto; con la risposta senza parentesi la resa è
  coerente con ciò che il parser legge (l'ambiguità della trascrizione non
  è mascherata).
- Checkpoint pre-deploy `03c0baf`; anteprima condivisa e consenso esplicito
  dell'utente prima della produzione.

## Produzione 9052

- URL: https://espressioni-monomi-polinomi.easy-peasy.site (deploy 9052,
  aggiorna il servizio esistente).
- JS `index-Dgqt3cY8.js` SHA-256
  `8975c25eda6d2119913f62ed642d817373bf26aa0509deddefd194f0a2e45c8d`;
  CSS `index-D6pcemJP.css` invariato (SHA-256
  `e1c328148ea7947f99c587066e0f93456dcaff0ea8260cd30ea421302c67393e`).

## Limiti e avvertenze

- Il nuovo prompt NON è stato rimisurato dal vivo: durante il banco di prova
  il piano ha raggiunto il **limite di parole dell'IA** (errore 429). La
  regola è verificata con risposte simulate e per struttura; rinnovare la
  misura quando il piano lo consente.
- Il display corretto non può salvare una trascrizIONE AMBIGUA: se l'IA
  (o il soccorso Tesseract) restituisce la forma senza parentesi, ciò che
  l'app mostra è ciò che il parser legge. La conferma prima del calcolo
  resta il momento di controllo dell'utente.
- Nessuna modifica al motore, al PDF, al cropper, alla cornice del blog o
  ai dati. Il deploy non aggiorna il post Blogger.



# Deploy 9055 — Potenze oltre i double: proprietà simboliche e verifica bigint (8/11/2026)

## Richiesta dell'utente

«L'app non riconosce l'espressione nella foto allegata né prepara
l'esercizio: non conosce le proprietà delle potenze?» — espressione della
foto `[(2^15·2^3)^4 : 2^8] : (2^15 : 2^8)`, catena di esponenti
18 → 72 → 64 → 7 → 57 con valori fino a **2^72 ≈ 4,7·10^21**, oltre il
limite esatto dei double. L'utente ha scelto esplicitamente la modalità
**«Proprietà simboliche (consigliato)»**: lo studente digita SOLO gli
esponenti e i risultati restano in forma di potenza.

## Cause individuate (due difetti indipendenti)

1. **Motore del percorso guidato** (`client/src/lib/espressioni.ts`):
   durante la riduzione l'analisi esplodeva i numeri e si fermava con
   `Error: Numeri troppo grandi per mantenere il calcolo esatto.`
   (stack `frBig` → `fMul` → `polyMul` → `evalPoly` → `reduceOnce`) —
   solo sulle catene con parentesi tonde/quadre. Inoltre il flip della
   divisione con esponente negativo (2^3 : 2^70 → 1/2^67) rimaneva
   intrappolato e il risultato dei passi con esponente si perdeva.
2. **Costruzione IA** (`server/costruisci.ts`): `contoGiusto` verifica i
   conti con `rationalPolyEquals`/`exactNumericEquality`, che lavorano sui
   double: per 2^72 nessun percorso decideva e il conto veniva bollato
   «radicale numerico non verificabile esattamente». Con 3 tentativi su 3
   bocciati l'esercizio non si costruisse MAI (l'IA proponeva giusto, la
   verifica non sapeva confermarlo).

## Correzioni

### 1. Motore — proprietà simboliche (9 blocchi di test, poi 12 test finali)

- `analyzeExpression`: con l'intera espressione fuori scala
  (`modalitaSimbolica`, `isPuraPotenze`) le proprietà NON calcolano più i
  numeri: `pow-prop`/`pow-pow` spiegano il metodo e i passi
  `pow-prop-exp`/`pow-pow-exp` chiedono allo studente SOLO l'esponente
  (18, 72, 64, 7, 57 per la foto), contrassegnando le potenze risultanti
  in `powSimboliche` (`potenzaSballa` per il pow-pow che sballa).
- `pow-flip` con potenza simbolica: 2^3 : 2^70 → `\dfrac{1}{2^{67}}`
  senza intrappolamento.
- `symbolicResultLatex` (risultato in forma di potenza) propagato con lo
  spread nel driver dei passi (prima perduto) e reso dalla UI («2^{18} =»).
- `frBig` lancia `Error` semplice: il catch della valutazione lo riconosce.
- Risultato finale: `finalSymbolicLatex` esteso a QUALSIASI stato finale
  che contiene ancora potenze simboliche (`contienePowSimbolica`) — mai
  «0», mai il numero svolto; il cat `[(2^15·2^3)^4:2^8]:(2^15:2^8)`
  termina in `2^{57}`.
- `auditConti`/`auditProgressivita` estesi con le invarianze simboliche.
- Test `client/src/lib/potenze-simboliche.test.ts` (12): la catena esatta
  della foto, il flip 2^3 : 2^70, :128 (motore onesto: si ferma senza
  inventare 2^64 : 128), regredissione di 10 catene notevoli.

### 2. Costruzione IA — verifica esatta con BigInt

- `server/costruisci.ts`: nuovo helper **`valoreBigint(latex)`** — parser
  aritmetico in sola aritmetica intera con BigInt (`\frac{A}{B}` →
  `(A)/(B)`, `\cdot`/`·`/`×` → `*`, `:`/`÷` → `/`, quadre → tonde,
  esponenti `^{n}`; esponenti 0..4096, stima bit ≤ 40000, quoziente solo
  esatto; decimali, radici, lettere e esponenti negativi → `null` e restano
  sui percorsi di prima — nessun falso positivo).
- In `contoGiusto`, dopo `exactNumericEquality` e PRIMA del ramo radicale:
  se entrambe le espressioni valgono come interi, confronto esatto
  `{ok, via: "intero esatto (bigint)"}` o rifiuto motivato.
- Test `server/costruisci.test.ts` (8 nuovi), incluso
  `valoreBigint((2^{15}·2^{3})^{4}) = 4722366482869645213696` esatto.

## Filosofia invariata

- Nessuna soluzione anticipata: le risposte dei box si mostrano solo dopo
  la risposta esatta dello studente; nel percorso guidato ogni conto resta
  da fare (l'esponente lo scrive lo studente).
- Le regole dell'utente restano: mai decimali con la virgola, mai
  trasformare quadre/graffe, mai trascrivere automaticamente risultati.

## Collaudo

- **E2e con la foto reale** (`/dev/shm/riconoscimento-qa/e2e-reale.mjs`):
  - anteprima: trascrizione 5 s, costruzione `fatto` al tentativo 1,
    5 box `2^{18}`, `2^{72}`, `2^{64}`, `2^{7}`, `2^{57}`;
  - **produzione 9055** (`espressioni-monomi-polinomi.easy-peasy.site`):
    trascrizione 5 s, costruzione **19 s, tentativo 1**, stesse 5 sezioni
    (PARENTESI TONDE / POTENZA DI POTENZA / PARENTESI QUADRA / SECONDA
    PARENTESI / CALCOLO FINALE), righe progressive tutte simboliche,
    `risultatoFinaleLatex = 2^{57}`, prompt = solo metodo.
- Produzione: app 200; bundle `assets/index-D-0ZrcU9.js` servito con
  SHA-256 `900e36db87b563e7cc6bb27986f890dbcaa76de7e5e85f5640541d0e77021a0a`
  identico al build locale; CSS `index-D6pcemJP.css` invariato;
  `POST /api/ai/parse-spoken` → 200 (`{spoken:"due alla terza per due"}` →
  `2^3·2`): chiave IA attiva (non 503).
- Suite: **995 client** (983 dorati + 12 nuovi) + **53 server** (8 nuovi)
  + `pnpm check` pulito.

## Limiti

- La verifica bigint copre l'aritmetica intera pura: conti con decimali,
  radici o lettere seguono i percorsi razionali/numerici esistenti
  (invariati).
- Gli esercizi costruiti PRIMA del 9055 e salvati in sessione non
  beneficiano della nuova verifica (agiscono alla costruzione).
- Lo studente digita gli esponenti nel percorso guidato; i box
  dell'esercizio costruito restano numerici (le potenze di 2 sono esatte
  anche come double, e il confronto client usa tolleranza assoluta 1e-9
  che su 2^72 equivale all'uguaglianza esatta).

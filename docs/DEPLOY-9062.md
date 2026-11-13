# DEPLOY 9062 — Radicali in costruzione: le proprietà dei radicali nel verificatore (8/11/2026)

## Stato

Deploy **9062** autorizzato dall'utente («continua, dimmi quando hai finito e
ridistribuisci»), commit `d6c6803`. Produzione:
`https://espressioni-monomi-polinomi.easy-peasy.site` (servizio Cloud Run
`deploy-2a7acf3f-6909-wmoltmgh5q-uc.a.run.app`, deployment ID 9062). Bundle
`assets/index-HnG9x97T.js` (SHA-256
`fe2e1e2727600082d941af15f9a1a9db2d8666550458695523303fd933b58adc`,
verificato identico su produzione), CSS `index-a9KvYjRF.css` (SHA-256
`3edeecca92392ce574b7309fec80cbf8474f66726fe27927d4fa9b57b5f1786d`,
invariato dalla 9059). Suite: **1007 client (28 saltati) + 60 server**
(53 preesistenti + 7 nuovi in `server/radicali-costruisci.test.ts`),
`pnpm check` pulito. Checkpoint pre-deploy: stato già allineato
(auto-checkpoint preview; commit `d6c6803`).

## Richiesta

«Osserva la foto allegata: ho provato un'espressione con i radicali, ma non
funziona. Forse non conosce la proprietà dei radicali? Le proprietà le trovi
qui: youmath.it …» — foto `non_funziona.png` con
`(2√3−2√2−2+√18−√12−√6)/(2[(2)²−(√6)²])` e banner
«L'IA NON RESTITUISCE RISPOSTE VALIDE. RIPROVA TRA QUALCHE MINUTO.»
dopo tutti i tentativi di costruzione.

## Cause (riproduzione reale pre-fix, log `[costruisci]`)

TENTATIVO 1 — risposta IA COMPLETA ma rigettata:
`box 9: non riesco a collegare il conto alla riga precedente senza alterarla`.
Il box finale dell'IA era la frazione PULITA `\dfrac{\sqrt{2}-2-\sqrt{6}}{-4}`,
mentre la riga meccanica ricostruita conteneva il RESIDUO ZERO del raccoglimento
(`\left(0+\sqrt{2}-2-\sqrt{6}\right)`, da «2√3−2√3 = 0»): il confronto
strutturale di `replaceExpressionStep` non trovava l'operazione dentro la riga.

TENTATIVO 2 — su 3 prove, 3 risposte TRONCATE dal gateway a metà JSON
(455, 424 e 905 caratteri; il taglio cadeva sempre dentro i box, spesso dopo
`\sqrt{`): JSON.parse fallito su tutte → «L'IA non restituisce risposte valide».
Il cutoff del gateway era già noto (commento in `ESEMPIO_MINI`) ma non veniva
mai sfruttato alcun prefisso salvabile.

Inoltre `risultatoMotore` (soccorso Opzione A) NON sapeva calcolare i radicali:
`evalRat` si ferma sulle radici non perfette, quindi un box o un risultato
finale mancante/sbagliato con radicali era irrecuperabile.

## Correzioni (commit `d6c6803`)

1. **Soma esatta c·√d esportata e stampabile** (`client/src/lib/numericRadicalEquality.ts`):
   `sommaRadicaleDi(raw)` (valutazione esatta nel corpo c·√d già usata per il
   confronto), `laticeSommaRadicale(s)` (stampa LaTeX: parte razionale prima,
   radicali per radicando crescente, coefficienti frazionari con denominatore
   comune → frazione impilata col meno DAVANTI), `risultatoRadicaleLatex(raw)`.
2. **`risultatoMotore` con i radicali** (`server/costruisci.ts`): dopo il
   percorso razionale prova `risultatoRadicaleLatex` — proprietà applicate:
   trasporto fuori radice (√18=3√2), radicali simili sommati, potenza con
   esponente pari all'indice ((√6)²=6), frazioni impilate, MAI decimali.
   Guardia anti-box degenere: se il «calcolo del motore» ha la STESSA
   struttura dell'operazione (√2 → √2, già minima) NON è una riparazione e
   la risposta IA resta bocciata (auditEspressioni invariato nel criterio).
3. **Collegamento a prova di residui zero** (`client/src/lib/progressiveExpression.ts`):
   `replaceExpressionStep` pruna gli addendi zero PRIMA del confronto
   (`prunaAddendiZero`): l'op pulita dell'IA si collega alla riga con
   `0 + …` e la riga stampata resta pulita. 
4. **Gate finale «manca almeno un passaggio» a forma pulita**
   (`progressiveExpression.ts` + `costruisci.ts`): nuova `haContoPendente(raw)`
   individua i conti ANCORA RIDUCIBILI in una riga (operazioni tra soli
   razionali, radici non in forma minima, potenze di radicali, radicali
   simili da raccogliere). La forma diversa (meno nel numeratore, frazione
   del motore) si accetta SOLO se la riga non ha conti pendenti E il valore
   coincide ESATTAMENTE; con un conto pendente («2+12» con finale «14»)
   il rifiuto resta invariato (auditAIGuidata invariato).
5. **Guarigione dei JSON troncati** (`server/costruisci.ts`): terzo tentativo
   di `estraiJson` con `riparaJsonTroncato` — chiude stringhe/array/oggetti
   rimasti aperti dal cutoff e restituisce il prefisso COMPLETO (taglio solo
   su strutture chiuse: fine oggetto/array/numero); i box completi
   sopravvivono, i mancanti li ricalcola `riparaEsercizio`.
6. **Regola 4d RADICALI nel prompt** (`costruisci.ts`): trasporto fuori
   radice → radicali simili → potenza pari all'indice → radici non
   semplificabili INDICATE (mai decimali), in linea con la lezione YouMath.

## Collaudo

- Unit: **1007 client (28 saltati) + 60 server**; `pnpm check` pulito.
  Nuovi test: `client/src/lib/radicaliCostruzione.test.ts` (8: catena completa
  della foto collegata SENZA «non riesco a collegare», nessun residuo `0 +`,
  `risultatoRadicaleLatex` su √18/√18−√12/numeratore/frazione intera/√(2+3)=√5/lettere,
  `exactNumericEquality` sui risultati stampati) e
  `server/radicali-costruisci.test.ts` (7: l'esercizio della foto accettato con
  l'ultima riga ristampata dal motore, risultato finale mancante calcolato dal
  motore, risposta sbagliata sostituita dal motore con avviso, box degenere
  √2=√2 RIFIUTATO, box perso nel troncamento RIFIUTATO, `riparaJsonTroncato`
  su taglio dentro stringa/oggetto). Entrambi i file aggiunti a
  `scripts/verify-package.py` (unit_server).
- E2E reale anteprima (espressione della foto): costruzione **riuscita** —
  4 sezioni, 9 box, 10 righe, risultato finale `(-√2+2+√6)/4`, avvertenza
  «righe progressive ricostruite dai calcoli effettivamente svolti». Tutte le
  proprietà corrette: `2²=4`, `(√6)²=6`, `√18=3√2`, `√12=2√3`,
  `2√3−2√3=0`, `−2√2+3√2=√2`, `4−6=−2`, `2·(−2)=−4`, divisione finale col segno.
- Produzione (dopo deploy 9062): costruzione stessa espressione **riuscita**
  (cache condivisa, ~5 s), risultato finale `\dfrac{2+\sqrt{6}-\sqrt{2}}{4}`,
  bundle servito identico al locale.

## Regole da non violare

- NON dire mai la soluzione (regole 1–3 del prompt e sanitizer `promptSicuri`
  INTATTI): le risposte le scrive lo studente; il motore sostituisce solo
  risposte sbagliate/mancanti dell'IA, con avvertenza nei log.
- Radici non semplificabili restano INDICATE: mai decimali, mai √ di somme non svolte.
- `haContoPendente` va tenuta CONSERVATIVA: un parse che fallisce = conto
  pendente (rifiuto). Non allentare il gate «manca almeno un passaggio».
- Il taglio di `riparaJsonTroncato` avviene SOLO su strutture chiuse:
  non introdurre tagli a metà stringa (chiavi pendenti).
- Filosofia DSA e regole fissee in SKILL.md: invariate.

# DEPLOY 9097 — Radicali ad indici diversi

## Stato del rilascio

Produzione **9097**, 9 novembre 2026, autorizzata dopo l'anteprima e la
conferma dell'utente. Runtime: checkpoint `068b912`, progetto corrente della
chat `/home/user/espressioni-monomi-polinomi`. Sito pubblico:
https://espressioni-monomi-polinomi.easy-peasy.site/.

Bundle JS `index-5BMVJBCD.js`, SHA-256
`8355b046c70f5199fafc585cfa2714c8823e6d3023477723fe362d6f4bc64ca4`;
CSS `index-U_o0b2U8.css` INVARIATO dalla 9096, SHA-256
`976cbb45d67b87e39e8bfb82579d8d65a6397b49b4f0f23e1e0d8abdfaac6b51`.
Il JS pubblicato è stato confrontato con la build locale (stesso nome e
stesso hash servito da produzione).

## Novità

- **Motore esteso alle radici di indice 5–12** (`client/src/lib/espressioni.ts`,
  parser `\sqrt[n]{X}` con graffe bilanciate): prima gli indici oltre 4
  davano errore, ora sono accettati e calcolati esatti. Limite superiore 12
  (m.c.m. tra 3 e 4); da 13 in poi resta il messaggio di errore. Il test
  storico che pretendeva l'errore sull'indice 5 è stato aggiornato: NON
  ripristinarlo.
- **Tastiera `rad5`…`rad12`** (`client/src/lib/keyboardNotation.ts`): le
  cifre dell'indice diventano apici davanti a √ (es. `rad6(…)` → ⁶√).
- **Costruttore deterministico STESSO INDICE**
  (`server/guida-radicali.ts`, `costruisciIndiceComune`): per un quoziente
  (o prodotto) di radicali con INDICI diversi (es. √((a²−1)/3) : ∛(3a+3))
  l'app costruisce l'esercizio senza IA: riduce all'indice comune (m.c.m.
  degli indici), alza ogni radicando alla potenza che manca, unisce sotto
  radice unica. Consegna = SOLO il metodo, campi risposta vuoti.
- **Sostituzione `sostStesso` identity-preserving**: la `sostituisciNodo`
  di sistema clona ogni sottopercorso con `{...n}` anche invariato, così il
  riferimento al secondo radicale si perdeva dopo il primo box (il box 3
  non si collegava alla riga precedente). La sostituzione locale ritorna il
  nodo STESSO quando il ramo non cambia. Lezione riusabile per ogni nuovo
  costruttore che tiene riferimenti all'AST fra più box.

## Verifiche

- Suite unificata: **1163 passati, 28 saltati**. A parte: **1050 client**
  passati e 28 saltati; **108 test server selezionati** con mock
  (ora anche `server/indice-comune.test.ts`, 16 test: costruzione,
  `contoGiusto` per ogni box, `riparaEsercizio` + `trascrizioneFedele`,
  nessuna cifra nei prompt, respinta del perimetro).
- Collaudo dal vivo in anteprima: input tastiera
  `rad2((a^2-1)/3) : rad3(3a+3)` → finestra «CONTROLLA PRIMA DI
  CONFERMARE» identica alla foto → costruzione ok con sezione STESSO
  INDICE. Nessuna soluzione mostrata o anticipata.
- Produzione 9097 verificata via API (`POST /api/ai/costruisci-esercizio`
  + polling): sezione STESSO INDICE, 5 box, nessun problema. Nessun dato
  utente toccato.

## Limiti e trappole

- ⚠️ Il server di anteprima serve `dist/index.js` (start = build + start):
  dopo ogni edit fare `pnpm build` e riavviare PRIMA del collaudo live, e
  per l'export seguire `REBUILD.md` §7. Nella 9097 un collaudo live su
  bundle stale sembrava un fallimento di verifica («non verificabile con il
  motore disponibile») e non lo era.
- L'OCR resta fallibile: la trascrizione va sempre controllata nella
  finestra di conferma prima di costruire.
- Filosofia DSA invariata: ogni risultato lo scrive lo studente; l'app non
  anticipa mai soluzioni, neanche nei prompt dei box.

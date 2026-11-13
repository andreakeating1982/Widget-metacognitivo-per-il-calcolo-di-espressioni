# DEPLOY 9073 — Radicali con lettere: costruzione e verifica a sostituzione (8/11/2026)

## Stato

Deploy **9073** autorizzato dall'utente («pubblica in produzione»), commit
correzione `ddd18b4` e allineamento pacchetto `444f218` (hash APPROVED del
nuovo bundle in `verify-package.py`, test di rilascio e guide al 9073).
Produzione: `https://espressioni-monomi-polinomi.easy-peasy.site`
(servizio Cloud Run `deploy-2a7acf3f-6909-wmoltmgh5q-uc.a.run.app`,
deployment ID 9073). Bundle `assets/index-ChrQq2K_.js` (SHA-256
`9e94e9613d07e05498ea5878d73770d537740c2937cb4ef856cf490d618dfc08`,
verificato IDENTICO al build locale e al bundle servito in produzione),
CSS `index-a9KvYjRF.css` (SHA-256
`3edeecca92392ce574b7309fec80cbf8474f66726fe27927d4fa9b57b5f1786d`,
invariato dalla 9059), font OpenDyslexic WOFF2 servito reale
(HTTP 200, 39 912 B). Suite: **1027 client (28 saltati) + 77 server**
(60 preesistenti + 17 nuovi in `server/letterali-radicali.test.ts` e
13 in `client/src/lib/verificaSostituzione.test.ts`), `pnpm check`
pulito. Checkpoint pre-deploy: stato già allineato (commit `ddd18b4`).

## Richiesta

«Osserva la foto allegata, ci sono ancora dei problemi» — foto `no.png`
con `√((a²−1)/3) : (3a+3)`. L'utente chiedeva se l'app conosce le
proprietà delle potenze e i prodotti notevoli (riferimenti YouMath
forniti) e ipotizzava: «L'errore forse era nella radice quadrata al
numeratore che doveva essere preceduta dalla parentesi (e poi chiudersi
dopo la radice)?». L'ipotesi è confermata solo in parte: la notazione
`(√(...))/√3` passa, ma la causa reale era duplice (sotto).

## Cause (due difetti indipendenti)

1. **Costruzione** — l'IA, sull'espressione letterale con radicali,
   restituiva la struttura SENZA `risultatoFinaleLatex` e i controlli
   server bocciavano tutta la risposta («L'IA non ha prodotto una
   struttura utilizzabile», 3 tentativi riprodotti pre-fix).
2. **Verifica risposte** — anche con la sessione costruita, le risposte
   GIUSTE dei box con radici E lettere venivano boccate:
   `stessaForma` copriva radici senza lettere (`verificaRadice`) e
   lettere senza radici (`parsePolyLoose`), ma NON la combinazione
   (es. `√((a-1)(a+1))/√3` contro
   `\dfrac{\sqrt{(a-1)(a+1)}}{\sqrt{3}}`).

## Correzioni

- `server/costruisci.ts`: se il risultato finale manca, viene assunto
  dalla risposta DELL'ULTIMO BOX GIÀ VERIFICATO dal motore (il valore
  esiste nei dati verificati: nessuna soluzione anticipata).
- `client/src/lib/verificaSostituzione.ts` (nuovo, puro) usato da
  `stessaForma` in `EsercizioFrazioni.tsx`: forme con √/∛/∜ E lettere
  verificate con la STESSA tecnica del server
  (`ugualePerSostituzione`): valutazione simbolica esatta (frazione
  unica con BigInt, radici in forma a·√b) + sostituzione numerica
  multipla di interi piccoli (tornate con negativi, es. [−2,−5,11];
  `null` = non decide → rispetto; `false` al primo campione che
  differisce).
- `scripts/verify-package.py`: APPROVED aggiornati al bundle 9073.

## Collaudo

- Unit: 77 server (`npx vitest run --root . server`) + 1027 client
  (28 saltati); TypeScript pulito.
- API: costruzione di `√((a²-1)/3):(3a+3)` al PRIMO tentativo (6 box,
  risultato finale promosso dalla risposta verificata del box 6).
- Regressione: l'espressione numerica con radicali della 9062
  `(2√3−2√2−2+√18−√12−√6)/(2[(2)²−(√6)²])` dà lo stesso risultato
  finale approvato.
- E2E dal vivo (anteprima, browser, sessione reale): 6/6 box accettati
  al primo colpo digitando `(a-1)(a+1)`, `3(a+1)`,
  `√((a-1)(a+1))/√3`, `√(a-1)·√(a+1)`,
  `√(a-1)/(3·√3·√(a+1))`, `√(3(a^2-1))/(9(a+1))`; pagina finale
  «HAI TERMINATO! OTTIMO LAVORO!» con 5 stelle, 6/6 al primo colpo.

## Verifica produzione (post-deploy)

Titolo corretto su `.easy-peasy.site` e `.run.app`; bundle servito
`index-ChrQq2K_.js` con SHA-256 identico al locale; le tornate del
verificatore ([−2,−5,11]) presenti nel bundle produzione; CSS reale
(Tailwind 4.1.14) invariato; font WOFF2 reale.

## Lezioni

- `pnpm dev` fa **build+start** di `dist` (niente HMR): dopo ogni edit
  client serve il rebuild prima del collaudo (causa del falso «la
  correzione non funziona» di questo turno: i test erano verdi ma il
  browser girava il bundle delle 14:14, precedente alla fix delle 14:36).
- Il vitest di default ha root=`client` (da `vite.config.ts`): per i
  test server usare `npx vitest run --root . server`.

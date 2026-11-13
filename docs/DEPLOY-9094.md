# DEPLOY 9094 — Costruzione deterministica delle tre tipologie fotografate + periodico da tastiera (9/11/2026)

## Stato

Deploy **9094** autorizzato dall'utente dopo collaudo dell'anteprima («i tre
esercizi funzionano. Procedi con produzione e zip»), commit
`343361e` + documenti di rilascio di questa release. Produzione:
`https://espressioni-monomi-polinomi.easy-peasy.site` (servizio Cloud Run
`deploy-2a7acf3f-6909-wmoltmgh5q-uc.a.run.app`, deployment ID 9094).
Bundle `assets/index-CD-CjIXG.js` (SHA-256
`4fa87dc770e0fc1f17b501b36a50ff239d53680fb8e5ed1f4f58be570c809a9a`),
CSS `index-C-zfk86e.css` (SHA-256
`4e3e434fe1c8bfefb3d0d767b8e3a9a5b99d0e82f6ca76bf935f71a5c5bd7cd3`):
entrambi verificati IDENTICI al build locale e al bundle servito in
produzione (HTTP 200). Suite: **1028 test passati, 28 saltati**
(`npx vitest run`, 92 file), `pnpm check` pulito (target ES2015, nessun
BigInt nei percorsi nuovi). Checkpoint pre-deploy: `343361e`.

## Richiesta

«Quest'app è un totale fallimento» — tre foto con espressioni che l'app non
riconosceva né costruiva («O fai un ultimo cambiamento radicale … oppure
abbandono la costruzione dell'app»). Le tre tipologie:

1. `2∛81 − 5∛32 − 3∛24 + 4∛108` (somma/differenza di radici cubiche con
   radicandi numericamente diversi ma semplificabili);
2. `√(9x³)·√x − 2x·√(4x²) + √(25x⁴):x` (radicali con lettere e proprietà);
3. `[(3/2 − 0,5)²·√(9/4) + 1,3̄] : (2 − 1/3)` (catena con decimali,
   frazione impilata, radice di frazione e periodico).

In più, richiesta successiva: «dai un comando semplice per l'utente per
poter scrivere il numero periodico anche con la tastiera (aggiungendolo
alla legenda a tendina)».

## Cambiamento radicale: costruzione deterministica, non più IA

Prima di qualunque chiamata all'IA, `server/costruisci.ts` (rotta
`/api/ai/costruisci-esercizio`) prova **tre costruttori deterministici**
in `server/guida-radicali.ts`:

- `costruisciRadiciNesime` — somme/differenze di radici n-esime
  (√, ∛, ∜) con radicandi interi: scomposizione in fattori primi,
  portata fuori dei cubi/quarti perfetti, catena di box
  («Radice», «Moltiplico il coefficiente», «Raccolgo», …) che PARTE
  sempre dall'espressione originale e non anticipa mai i risultati;
- `costruisciRadicaliLetterali` — radicali con lettere (convenzione dei
  libri di testo: variabili implicite > 0), proprietà dei radicali,
  frazioni dentro la radice, fattori esterni;
- `costruisciCatenaEsatta` — catene con decimali, frazioni impilate,
  potenze e radici di frazioni, decimali periodici (`0,\overline{3}`).

Ogni candidato è riverificato ESATTAMENTE come i risultati IA
(`riparaEsercizio` + verifica completa + `trascrizioneFedele`): un
candidato che non passa TUTTI i controlli è scartato e si cade
sull'IA come prima. Se l'IA è richiesta, un modulo puro
`client/src/lib/numericRadicalEquality.ts` (+ test) convalida le
equivalenze con radici e lettere durante la verifica di struttura.

Risultato misurato (bench sull'anteprima e ripetuto sulla produzione
9094): i tre casi fotografati passano da **3 tentativi IA + errore** a
**tentativo 1, ~2–3 secondi, senza IA**.

## Periodico da tastiera (legenda a tendina)

In `client/src/lib/keyboardNotation.ts` e nella legenda a tendina
(`: diviso · * per · 3/4 frazione impilata · ^2 potenza · rad2 radice
quadrata · rad3 cubica · rad4 quarta · **0,3per periodico**`):

- `0,3per` → `0,\overline{3}` (solo il periodo);
- `0,1_6per` → `0,1\overline{6}` (parte antiperiodica con `_`);
- la regola vive nella libreria condivisa di normalizzazione, quindi
  vale SIA da tastiera (client) sia lato server (input già testuale).

## Filosofia DSA invariata

I costruttori generano SOLO i box (operazione + consegna): nessun
risultato scritto nell'esercizio o nel PDF. Le risposte restano
trascrizione a mano dell'utente o tastiera. Niente avviso
«SCRIVI IL RISULTATO COME FRAZIONE IMPILATA» (rimosso in release
precedente). Verifica risposte: forme equivalenti accettate, niente
falsi errori.

## Collaudo

- Anteprima: banco `bench_3foto.py` — 5/5 «fatto» a tentativo 1
  (radici-cubiche 9 box, radicali-lettere 4 box, catena-periodico,
  periodico-tastiera 3 box, quarte-fraz).
- Produzione 9094: stesso banco — 5/5 «fatto» a tentativo 1.
- Collaudo dell'utente in anteprima: «i tre esercizi funzionano».
- Suite completa 1028/1028 passati (28 saltati), `pnpm check` pulito.

## Verificatori allineati

`scripts/verify-package.py`: APPROVED aggiornati al bundle 9094
(`index-CD-CjIXG.js`, CSS `index-C-zfk86e.css`).
`scripts/export-verified.py`: REQUIRED include `docs/DEPLOY-9094.md`,
`server/guida-radicali.ts`, `server/guida-radicali.test.ts`,
`client/src/lib/numericRadicalEquality.ts`,
`client/src/lib/numericRadicalEquality.test.ts`.

# DEPLOY 9096 — Periodici e radicali nelle fotografie

## Stato del rilascio

Produzione **9096**, 9 novembre 2026, autorizzata dopo l'anteprima e la
conferma dell'utente. Runtime: checkpoint `f1d0cb4`, progetto corrente della
chat `/home/user/espressioni-monomi-polinomi`. Sito pubblico:
https://espressioni-monomi-polinomi.easy-peasy.site/.

Bundle JS `index-CGwBWSS5.js`, SHA-256
`6552a4a0014d97e2a05a74917e24f5b7ab9342659e3f932ab30057ce07c19da2`;
CSS `index-U_o0b2U8.css`, SHA-256
`976cbb45d67b87e39e8bfb82579d8d65a6397b49b4f0f23e1e0d8abdfaac6b51`.
Entrambi i file sono stati confrontati con la build approvata su entrambi gli
indirizzi pubblici. Guide e strumenti possono avere un checkpoint successivo
senza modificare il runtime già distribuito.

## Correzioni

- `periodicNotation.ts` conserva la barretta del periodo: comandi `per`,
  barre Unicode combinate e `\\bar`/`\\overline` sono normalizzati prima
  dei filtri. Non inventare un periodo dove l'OCR non ne ha letto uno.
- `exprOcr.ts`, `aiClean.ts` e il contratto IA nel server preservano periodi,
  indici radicali e parentesi del numeratore radicale. La radice dell'esempio
  in frazione viene raggruppata prima della linea di frazione. La trascrizione
  automatica va sempre controllata dall'utente: l'OCR non è infallibile.
- In `keyboardNotation.ts` la legenda documenta `0,3per`; per l'antiperiodo
  si usa la separazione con trattino basso. La finestra «CONTROLLA PRIMA DI
  CONFERMARE» deve mostrare il periodo con la barretta.
- `espressioni.ts` conserva il puntino tra due radicali nella traccia e nel
  box successivo alla costruzione; `server/guida-radicali.ts` produce box
  progressivi anche per la catena periodica.
- Mai trascrivere risposte o risultati prima che lo studente li inserisca e
  vengano verificati. Non ripristinare l'avviso permanente sulla frazione.

## Verifiche e limiti effettivi

- In un ambiente isolato senza database e con /tmp separato: tre foto reali
  fino a trascrizione e costruzione; 9, 9 e 4 box, tutti percorsi con dati
  di prova; errore, feedback e documento di stampa controllati. Un OCR nella
  prova precedente ha confuso una parentesi finale: la lettura va controllata.
- Suite unificata: **1146 passati, 28 saltati**. A parte: **1049 client**
  passati, 28 saltati e **92 test server** selezionati, con mock e /tmp
  isolato; `pnpm check` superato.
- Produzione: homepage, font, JS/CSS e guida tastiera verificati. Una prova
  dal browser con la foto originale del periodico ha mostrato la barretta
  nella finestra di controllo. Non è stata creata una sessione di prova sul
  database di produzione; le altre due foto non sono state ripetute live.
- I documenti di stampa dei tre casi sintetici sono stati controllati tramite
  PDF di prova generati da HTML con WeasyPrint, non con una stampante fisica.
  Nessun test su telefoni fisici o certificazione di accessibilità.
- Blogger, GitHub e Render non vengono aggiornati automaticamente dal deploy.

## Esportazione

Usare `scripts/export-verified.py` e `scripts/verify-package.py` aggiornati a
9096, con `--deployment 9096` e una destinazione nuova. Confrontare tutti i
file della build client con `--baseline-public dist/public`; eseguire i test
in ambiente privo di credenziali e con /tmp isolato, senza database reali.


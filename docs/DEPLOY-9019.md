# Rilascio in produzione 9019 — 7 novembre 2026

## Versione autorizzata

- Sito: https://espressioni-monomi-polinomi.easy-peasy.site/
- Servizio: https://deploy-2a7acf3f-6909-wmoltmgh5q-uc.a.run.app/
- Deploy Easy-Peasy: **9019**, aggiornamento del servizio esistente.
- Runtime approvato: checkpoint Git `58ac7a6cc50b23dc7868234faba0563c6cab041e`.
- L'anteprima è stata condivisa e l'utente ha autorizzato esplicitamente la
  produzione in un messaggio successivo. Gli aggiornamenti successivi a
  guide, strumenti e copia della cornice nel pacchetto non rappresentano un
  nuovo deploy dell'app.

Dopo il deploy, su indicazione dell'utente, lo snippet nel repository è stato
allineato alla cornice già pubblicata nel post Blogger: 559 righe, SHA-256
`d7cd547a6f0ba53815a12dd0adcc16276cf02b3a91a16a74b46d8cbcf1968a4c`.
La build dello ZIP 9019 consegnato conservava identici i 37 file pubblici
dell'app e cambiava solo `anteprima-cornice.html`; l'esclusione mirata della
pagina di prova dal rilevamento Tailwind non cambiava i bundle JS/CSS. La
successiva modifica dell'intestazione PDF non appartiene al runtime 9019:
è stata pubblicata in seguito con il deploy autorizzato 9029, documentato in
`DEPLOY-9029.md`. Nessun nuovo deploy né modifica del post è stato eseguito
per l'allineamento/export della sola cornice.

La produzione comprende feedback al primo colpo con messaggi basati sulle
stelline, titolo senza cornice, «CONTINUA» nella pagina dei passaggi, PDF solo
nel feedback, maggiore spazio prima dell'input e nessuna ripetizione del
risultato nella pagina finale. Comprende anche le istruzioni sulle frazioni
composte e il percorso verificato dei prodotti notevoli. Ogni risposta resta
inserita dallo studente, senza anticiparne la soluzione.

## Verifica effettivamente eseguita

Su entrambi gli indirizzi: titolo corretto e asset client identici byte per
byte alla build dell'anteprima approvata:

- `index-7ij18fdS.js`: SHA-256
  `6bf8bbb6fb1f6446caf4d09a730b19062066467c2774079251454398eda2f6a1`.
- `index-Bg2H0_BO.css`: SHA-256
  `fc6092b5df609b122a62e8184c4e648f4dadbcf30cc9bd2759ebe830136f7d8d`.
- Font OpenDyslexic WOFF2 reale, identico al file locale.
- POST vuoto a `/api/ai/parse-spoken`: HTTP 400 su entrambi i domini,
  senza chiamate al modello. Questo controlla la validazione della richiesta
  e la presenza della configurazione, non prova il funzionamento dell'IA live.
- Sito pubblicato: 9/9 scenari feedback su desktop, telefono e iframe e 7/7
  scenari di scorrimento; risposte e sessioni sintetiche, tutte le API di
  esercizio intercettate e simulate. PDF catturato e renderizzato in A4.
- Prima del deploy: 933 test client superati e 28 saltati, 19 test server con
  IA/archivi simulati, `pnpm check` e build superati; 16/16 percorsi studente
  sintetici nell'anteprima.

Gli schermi e il tocco mobile sono emulati, il PDF non è stato provato su una
stampante fisica e non è stata eseguita un'inferenza IA reale in produzione.
Non sono stati modificati i dati reali degli studenti. Il browser Chrome
collegato non ha risposto; il percorso è stato verificato con Chromium isolato.

## Blogger e pacchetti

Il dominio dell'app resta invariato, quindi gli iframe esistenti puntano allo
stesso servizio aggiornato. La pubblicazione non modifica automaticamente il
codice della cornice già incollato nel post Blogger. Lo ZIP 8999 consegnato in
precedenza non contiene le modifiche del rilascio 9019; non attribuire a quel
pacchetto le verifiche o i file della versione corrente.


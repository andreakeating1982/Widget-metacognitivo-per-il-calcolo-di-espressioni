# PDF con conteggio al primo colpo — anteprima del 7 novembre 2026

## Richiesta e soluzione

Il PDF completo dello svolgimento, disponibile dal feedback finale, mostra
subito dopo i dati dello studente la riga:

**Risposte giuste al primo colpo: X su Y**

Il valore è lo stesso oggetto `statistiche` usato dal feedback, calcolato da
`conteggioPrimoColpo` per i box dell'esercizio e per le prime risposte
pubblicate. Una correzione successiva non cambia il primo tentativo. Il PDF
parziale interno non presenta il dato come finale e continua a non mostrare
passaggi che lo studente non ha svolto.

Cognome/nome, classe e data sono affiancati quando entrano nello spazio A4;
con nomi o dati molto lunghi vanno a capo senza ridurre i caratteri né
nasconderli. Il testo dei dati viene inserito nel documento come testo sicuro,
non come markup. Font OpenDyslexic a 14 pt nell'intestazione. Svolgimento,
risultato finale già acquisito dallo studente, feedback e cornice del blog
rimangono invariati.

## Verifiche eseguite

- **6/6 scenari PDF:** tutti giusti, alcuni giusti, nessuno giusto, dati lunghi,
  caratteri speciali e dati assenti. Confronto tra feedback e testo nel PDF,
  ordine degli elementi, separazione testuale, testo estratto con Poppler,
  font, formato A4 e controllo di eventuali tagli. Desktop, telefono e iframe
  sono emulati.
- Il pulsante apre una **vera finestra di stampa** con il conteggio richiesto;
  nel test `window.print` è intercettato per evitare un dialogo fisico. La
  prova del popup usa il CSS KaTeX remoto previsto dall'app; il rendering A4
  separato usa KaTeX locale. Nessuna stampante fisica è stata usata.
- **9/9 scenari feedback:** numeri e lettere, errori iniziali corretti,
  punteggio stabile dopo «RIVEDI I PASSAGGI», PDF solo nel feedback, desktop,
  mobile, iframe e font ingrandito; PDF A4 sintetico renderizzato.
- **16/16 percorsi studente:** aritmetica, frazioni, radicali, parentesi,
  decimali e sessioni mancanti con costruzione/sessione simulate; due PDF A4.
- `pnpm check` e build superati; **933 test client superati, 28 saltati**;
  **19 test server** con IA/archivi simulati; **16 test** degli strumenti ZIP.
- Il controllo visuale automatico della prima pagina non modificata ha
  segnalato aspetti preesistenti: assenza di h1, contrasto del pulsante ENTRA
  nella schermata iniziale e alcuni controlli mobili più piccoli di 40 px.
  Non sono stati cambiati in questo intervento limitato al PDF.

Test ripetibili: `tests/pdf-intestazione.e2e.mjs`,
`tests/feedback-prodotti.e2e.mjs`, `tests/student-flow.e2e.mjs` e istruzioni
in `tests/FEEDBACK-PRODOTTI.md`. Tutti gli esercizi e i dati sono sintetici;
nessun uso di dati reali, scrittura nel database o inferenza IA live.

## Stato pubblicazione

La modifica è stata pubblicata con il deploy **9029** dopo conferma esplicita
successiva all'anteprima. Le verifiche online e gli hash sono documentati in
`DEPLOY-9029.md`. Lo ZIP 9019 consegnato in precedenza non include questa
intestazione PDF; lo ZIP 9029 è un export distinto dal deploy e il suo
collaudo effettivo è riportato nel rapporto esterno del pacchetto.


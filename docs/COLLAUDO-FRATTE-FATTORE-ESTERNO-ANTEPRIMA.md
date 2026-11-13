# Espressioni fratte con fattore esterno — collaudo storico dell'anteprima

> L'anteprima descritta qui è stata successivamente approvata e pubblicata
> come produzione **9038**. Per lo stato corrente e i collaudi online vedere
> `docs/DEPLOY-9038.md`; le indicazioni temporali sotto descrivono il momento
> in cui si preparava l'anteprima.

## Stato e ambito dell'anteprima

Durante la preparazione dell'anteprima la produzione era la **9033**
(`docs/DEPLOY-9033.md`); la correzione non era ancora stata pubblicata.

La foto dell'utente mostrava un errore di costruzione con una somma di due
frazioni letterali e un fattore esterno alla seconda. È stata riprodotta
un'incongruenza tra la struttura mostrata e il controllo di fedeltà tra le
forme `/` e `⁄`. La correzione conserva la distinzione tra la frazione e la
moltiplicazione esterna, senza accettare una diversa trascrizione solo perché
matematicamente equivalente.

Per somme o differenze **riconoscibili e verificabili** di due frazioni
letterali con numeratori monomiali e denominatori polinomiali di complessità
limitata è stato aggiunto un percorso deterministico. L'eventuale fattore
esterno viene trattato in un box autonomo. Seguono passi distinti per il
denominatore comune, il numeratore e il denominatore. I denominatori
coniugati mantengono il percorso del prodotto notevole già approvato.

Il percorso non è un risolutore generale di tutte le espressioni fratte:
forme più complesse, passaggi con cancellazioni implicite, denominatori
nulli e altre forme non garantite vengono lasciate al flusso IA già presente;
non si promette che tale flusso riesca sempre. Ogni candidato deterministico
passa comunque dai controlli esatti e strutturali del server prima dell'uso.
Ogni risultato è inserito dallo studente; non compare in istruzioni o TTS
prima della risposta. Le soluzioni verificate rimangono soltanto nei dati
interni e si mostrano nell'interfaccia dopo l'inserimento corretto.

Le operazioni e i passaggi lunghi scorrono orizzontalmente **nel proprio box**,
anche da tastiera, senza riduzione dei caratteri. Il post Blogger e la sua
cornice non sono stati modificati.

## Verifiche del 7/11/2026

- `pnpm check` e `pnpm build`: superati.
- Suite server isolata: **45 test superati**, compresi percorso reale della
  route HTTP con archivi e modello simulati, fedeltà della trascrizione,
  caso fotografato, frazioni coniugate e casi non supportati.
- Suite client: **956 test superati, 28 saltati** (sonde disabilitate).
- Percorso studente con API simulate: **16/16 scenari** desktop e telefono,
  inclusi errore iniziale, tutti i box della foto, feedback e PDF sintetico.
- Iframe ospite sintetico: **3/3 scenari**, incluso telefono da 320 px e
  font al 160%; tutti e sette i box della foto sono stati completati e le
  formule lunghe verificate per scorrimento, anche da tastiera. Sono state
  controllate la leggibilità dell'istruzione scorrendo e la lettura simulata.
- Regressioni con API simulate: parentesi tonde/quadre/graffe **13/13**;
  feedback e coniugati **9/9**; intestazione e conteggio nel PDF **6/6**.
- Lo script `web-design/scripts/check_site.mjs` e l'analisi visiva sono stati
  eseguiti a 1440 e 390 px. Le segnalazioni della pagina iniziale su contrasto
  di ENTRA, dimensione di alcuni pulsanti e assenza di `h1` compaiono anche
  nella baseline 9033 e non sono state modificate in questo intervento.
  Lo scanner ha inoltre segnalato `math`, famiglia CSS generica, come font
  non scaricato; OpenDyslexic e KaTeX risultano caricati.

Tutti i test con risposte e dati studente usano fixture e API isolate. La
prova diretta del modello IA non è partita per un errore di sintassi dello
script di prova: non è stata effettuata una verifica live del servizio IA.
Non sono state create, modificate o cancellate sessioni reali per i collaudi.

## File e prove ripetibili

- `server/frazioniLetteraliGuidate.ts` e relativo test: percorso circoscritto.
- `server/trascrizioneFratte.test.ts`: distinzione grafica e fedeltà.
- `server/costruisci-http-mock.test.ts`: route, job e sessioni simulati.
- `tests/student-flow-fixtures.ts` e `tests/student-flow.e2e.mjs`: percorso
  completo e PDF con dati sintetici.
- `tests/fratte-foto-iframe.e2e.mjs`: layout, ascolto simulato, scorrimento
  delle formule e percorso completo con caratteri ingranditi.
- `tests/parentesi-frazione.e2e.mjs`, `tests/feedback-prodotti.e2e.mjs`,
  `tests/pdf-intestazione.e2e.mjs`: regressioni precedenti.

La build locale contiene il client `index-BFByotI7.js`, SHA-256
`dbee09925f33385c422694628121dce52187a372259ece81b4c5162dd12fb4f5`, e lo
stile `index-D6pcemJP.css`, SHA-256
`e1c328148ea7947f99c587066e0f93456dcaff0ea8260cd30ea421302c67393e`.
L'anteprima verificata è
https://3000-iaryg6ndakwxhfohpvsnh.sandbox.easy-peasy.ai/: titolo, impronte
JS/CSS e font coincidono con la build collaudata; il processo Express è stato
riavviato dopo la compilazione e include il nuovo percorso. La route di lettura
per un job inesistente ha risposto correttamente senza creare dati. La pagina
iniziale è stata aperta anche nel Chrome collegato dell'utente. In quel
momento la produzione serviva il client 9033, con impronta
`98f0adbd8a12ee7d7138d012cf14798e1e6a112bcd0a13a8bcbbca69e74b639c`.

**Nota operativa:** il deploy preview ha indicato per errore la porta 3001,
occupata da un vecchio servizio Python non relativo all'app: non condividerla
come anteprima. La porta 3000 sopra è quella verificata per questa app.


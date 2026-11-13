# Feedback finale e prodotti notevoli — produzione 9019

Queste modifiche seguono la produzione 8999 e sono state pubblicate nel
rilascio 9019 dopo anteprima condivisa e consenso esplicito. Per i dettagli
online vedere [DEPLOY-9019](DEPLOY-9019.md). Ogni futuro rilascio richiede
una nuova anteprima condivisa e un nuovo consenso esplicito.

## Schermata finale

Dopo che tutti i box sono corretti, il pulsante «CONTINUA» nella terza
pagina apre il feedback con «HAI TERMINATO!» senza cornice, cinque stelle e
«Risposte giuste al primo colpo: X su Y». Il messaggio è «OTTIMO LAVORO!»
con 5 stelle, «HAI FATTO UN BUON LAVORO!» con 3–4 stelle e «CONTINUA A
ESERCITARTI!» con 0–2 stelle.
Il totale Y è il numero dei box che richiedono una risposta per la sessione;
X è il numero di box la cui prima risposta pubblicata e verificabile è
corretta, incluso l'eventuale criterio sul tipo di passaggio. Un tentativo
successivo non sostituisce il primo; cancellare o un riconoscimento non
riuscito non conta come risposta pubblicata. Il punteggio è mantenuto in
memoria durante lo svolgimento e quando si rivedono i passaggi: come il
resto del lavoro, non viene ripristinato dopo un aggiornamento della pagina.

Le cinque stelle sono tutte piene solo con tutte le risposte giuste al primo
colpo. Zero risposte giuste dà zero stelle; valori intermedi sono
proporzionali, con un minimo di una e un massimo di quattro. Lo screen reader
riceve la descrizione numerica. La schermata offre il pulsante PDF e «RIVEDI
I PASSAGGI», che mantiene i risultati; il PDF usa la stampa del browser e lo
svolgimento effettivo della sessione. Il pulsante PDF non appare nei passaggi,
ma solo nel feedback. Il risultato finale rimane nella terza pagina dopo la
risposta corretta e nel PDF; non viene ripetuto nella schermata del feedback.
L'etichetta «INSERISCI IL RISULTATO:» è più distanziata dalle istruzioni che
la precedono, sia nei box numerici sia in quelli simbolici.

## Frazioni composte e prodotti notevoli

L'istruzione nera per la tastiera dice di racchiudere l'intero numeratore e
l'intero denominatore tra parentesi tonde, separandoli con `/`; lo schema è
`(numeratore)/(denominatore)`. Non contiene un esempio numerico che possa
coincidere con il risultato dell'esercizio. Lo schema può andare a capo senza
uscire dal riquadro anche su telefono e con caratteri ingranditi; non riduce
la dimensione del testo. Il parser continua ad accettare forme matematicamente
equivalenti: non impone una grafia identica.

`server/prodottiNotevoli.ts` riconosce in modo conservativo una somma o
sottrazione di due frazioni letterali, con numeratori monomiali e denominatori
coniugati strutturalmente del tipo A−B e A+B. Crea un percorso con denominatore
comune, prodotti nel numeratore, coppie di termini simili e ultimo box dedicato
al prodotto notevole nel denominatore. Le frasi sul metodo evitano numerali
ambigui, in modo da restare chiare anche dopo il filtro anti-soluzione.
Le risposte attese sono dati interni:
lo studente deve scriverle. Ogni passaggio e la traccia sono verificati dal
motore prima della consegna. I vecchi contenuti in cache non vengono
modificati: per un caso riconosciuto la nuova costruzione usa direttamente il
percorso verificato. Se la forma non è riconosciuta, se serve una cancellazione
o se la verifica fallisce, rimane il normale costruttore IA; il suo prompt
richiede il prodotto notevole quando applicabile, ma non ne garantisce la
presenza per ogni espressione.

`client/src/lib/criteriDidattici.ts` distingue un'unica frazione, un prodotto
svolto e la somma ridotta: una forma equivalente che ripete il conto senza
eseguirlo non fa apparire automaticamente il risultato. Le forme equivalenti
che soddisfano il passo sono accettate con confronto esatto, anche in ordine
diverso. I criteri sono conservati dal server quando la sessione viene
salvata e ricaricata; i dati reali delle sessioni non sono stati modificati
per effettuare il collaudo.

## Controlli

- 933 test client superati e 28 saltati; 19 test server con IA e archivi
  simulati; `pnpm check` e build superati.
- Nove scenari feedback/prodotti notevoli (tutte le soglie da zero a cinque
  stelle), sette scenari di scroll e sedici percorsi studente con API simulate,
  a desktop, telefono e/o cornice. Verificati il titolo senza contorno, il
  margine tra istruzione e input e il PDF soltanto nella schermata finale.
  In particolare le istruzioni sono misurate dentro il riquadro anche a 320px
  e font160%; il PDF è renderizzato in A4 con formule e font locali.
- Il controllo grafico automatico segnala nella prima pagina preesistente
  l'assenza di un'intestazione h1, contrasto del pulsante ENTRA sotto 4,5:1
  e alcuni controlli di accessibilità piccoli su telefono. Quella pagina non
  è stata modificata da questa attività.
- Test client: `pnpm check` e `(cd client && pnpm exec vitest run)`.
- Server con IA e archivi simulati: `pnpm exec vitest run --root "$PWD" server/costruisci.test.ts server/costruisci-ai-mock.test.ts server/costruisci-http-mock.test.ts`.
- Browser isolato: `pnpm exec tsx tests/feedback-fixtures.ts /tmp/widget-feedback-fixtures.json`, poi `tests/feedback-prodotti.e2e.mjs` con Playwright in un ambiente di collaudo. Tutte le rotte API sono simulate.
- I test del browser usano touch e dimensioni emulati, non telefoni fisici;
  il documento PDF è verificato come HTML di stampa e rendering A4, non su
  una stampante reale. Nessuna verifica dimostra l'infallibilità dell'IA.


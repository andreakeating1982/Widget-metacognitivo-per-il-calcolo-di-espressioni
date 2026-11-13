# Design — Widget Metacognitivo (manutenzione)

## Formule fratte lunghe — verifica del 7/11

Preservare aspetto, font, colori e dimensioni approvate. Quando una formula
non entra nel box, l'operazione, la conferma verde e la pillola blu scorrono
orizzontalmente nel proprio contenitore, anche da tastiera, senza tagliare
l'inizio e senza ridurre i caratteri. Conservare la cornice del blog e lo
scorrimento verticale. Verificare a 320px, con font al 160% e in iframe.

## Indicazione delle frazioni — richiesta del 7/11

Conservare la schermata e i colori approvati. Eliminare l'intero riquadro
separato della trascrizione; nel normale testo nero del metodo aggiungere,
quando serve per una frazione composta, «Scrivo così il risultato:
(numeratore)/(denominatore)». Le parole tra parentesi sono uno schema generico,
mai la soluzione. Testo leggibile e adattabile senza sbordare su telefoni,
iframe e con font ingranditi; preservare distanza e comandi dell'input.
La valutazione conserva esattamente il tipo di parentesi scritte e accetta
raggruppamenti corretti con tonde, quadre o graffe, anche annidati.

## Intestazione del PDF — nuova richiesta del 7/11

Nel PDF mantenere font OpenDyslexic, inchiostro scuro, bordo sottile e resto
dello svolgimento invariati. Disporre cognome/nome, classe e data sulla
stessa riga quando lo spazio A4 lo consente; con dati più lunghi lasciare
andare a capo senza tagliare o ridurre i caratteri. Subito sotto riportare
«Risposte giuste al primo colpo: X su Y» usando lo stesso dato del feedback.
Solo il PDF dell'esercizio completo mostra il conteggio finale. Verificare
le pagine PDF stampate A4 e il comportamento con dati lunghi, oltre alle
schermate desktop e telefono esistenti.

L'app e la sua cornice mantengono la direzione didattica già approvata:
carta beige `#f8f1e4`, inchiostro marrone scuro, comandi marroni e font
OpenDyslexic. Questo intervento non ridisegna l'app né cambia testi, calcoli,
ritaglio geometrico o comportamento di sincronizzazione dell'iframe.

- **Ritaglio foto:** quattro pulsanti nello stesso riquadro; icone e testo
  sempre contenuti. Su schermi stretti o con font ingranditi i pulsanti
  passano a righe centrate, senza ridurre il testo.
- **Cornice Blogger, riferimento fotografico 7/11:** ripristinare la forma
  originale dei due pulsanti: sfondo avorio chiaro `#fdfbf8`, bordo sottile
  `#dedbd6`, raggio 10px, testo e icone marrone scuro `#2e2018`, font
  OpenDyslexic grassetto 12px, icone 16px e spazio 6px. Conservare le
  etichette «Schermo intero» e «Ricarica» anche su telefono; se non entrano,
  i pulsanti vanno a capo senza sovrapporsi. L'area tattile invisibile è
  estesa in verticale, ma il riquadro resta piccolo come nella foto. Focus
  visibile e un solo path SVG chiuso mantengono accessibilità e compatibilità
  con Blogger senza cambiare l'aspetto richiesto.
- **Verifica:** viste desktop e telefono, font ingrandito, iframe, rotazioni,
  conferma/chiusura del cropper e comandi della cornice. Il post pubblico
  incolla la propria cornice: la modifica locale non lo aggiorna da sola.

## Esito dell'esercizio — anteprima successiva al 7/11

Ispirazione: la foto allegata con riquadro bianco, icona celebrativa, due
messaggi in italiano, cinque stelle, numero di risposte al primo colpo e
pulsante PDF. Conservare i colori avorio/marrone, OpenDyslexic, toolbar e
contenitore adattivo dell'app: è una pagina conclusiva distinta, non un
ridisegno delle schermate precedenti. Stelle oro e contatore esplicito,
nessun risultato prima dell'ultima risposta inserita dallo studente. Il
pulsante PDF e l'opzione per rivedere i passaggi restano chiaramente visibili
anche su telefono, con scorrimento interno e font ingrandito. Le istruzioni
sulla scrittura delle frazioni composte sono nere, brevi e mostrano soltanto
uno schema con parole, mai la soluzione dell'espressione.

Aggiornamento richiesto: titolo «HAI TERMINATO!» senza cornice, messaggio
incoraggiante commisurato alle stelle, nessuna ripetizione del risultato
nella schermata finale. In terza pagina, un solo pulsante «CONTINUA» conduce
al feedback; «SCARICA PDF» resta esclusivamente nel feedback. Aggiungere un
po' di spazio prima dell'etichetta marrone di ogni input, senza ridurre i
caratteri e senza modificare canvas, riconoscimento o motore.


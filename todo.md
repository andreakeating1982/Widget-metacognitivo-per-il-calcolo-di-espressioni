# Lettura accessibile della cornice — 13/11/2026

- [x] Individuare l’origine della lettura incompleta nella barra interna all’app e verificare il ruolo della cornice Blogger.
- [x] Leggere testo visibile, pulsanti e campi senza ripetizioni né soluzioni nascoste.
- [x] Rendere comprensibili formule, frazioni, radici, indici, potenze, parentesi e decimali/periodici.
- [x] Collaudare le tre pagine, la cornice anche a origini diverse, avvio/arresto e testi lunghi con dati isolati su desktop e telefono simulato.
- [x] Suite completa superata: 1.611 test riusciti, 28 saltati; anteprima condivisa senza pubblicare in produzione.
- [ ] Attendere il collaudo di ascolto sul dispositivo dell’utente e l’eventuale approvazione esplicita per la produzione.

# Convenzione scolastica: contenuto del valore assoluto nei box — 13/11/2026

- [x] Esaminare la foto: la risposta attesa e le righe verde/blu contengono barre del valore assoluto.
- [x] Dopo il consenso dell’utente, costruire in memoria un vero ramo di calcolo senza barrette, con condizioni aggiuntive esplicite, separate dalle C.E. originali.
- [x] Indicare che gli altri casi non sono svolti; bloccare i rami numericamente impossibili e proseguire con ulteriori calcoli esatti, senza riscrivere i dati archiviati.
- [x] Collaudare la foto (28 box consecutivi), casi analoghi, condizioni e PDF in un ambiente isolato; verificare desktop/mobile e che la soluzione resti nascosta.
- [x] Condividere l’anteprima verificata, senza pubblicazione in produzione.

# Segnalazione: nuova foto con periodi a più cifre — 12/11/2026

- [x] Verificare foto e trascrizione inviata: la radice al denominatore comprende il fattore con potenza.
- [x] Riprodurre dai log il blocco: periodi restituiti con barre incomplete e verifica numerica incapace di trattare periodi di più cifre; preservare il valore assoluto senza annullarlo.
- [x] Correggere in modo conservativo i periodici solo quando la trascrizione originale li identifica senza ambiguità; confronto su frazioni esatte senza espandere i periodi.
- [x] Collaudare foto e variante con risposte IA registrate: riparazione completa, C.E., box collegati, nessuna risposta anticipata e controllo di sostituzioni positive/negative. Foto provata in interfaccia desktop/mobile in archivio isolato; soluzione solo su richiesta e risposta errata non fa avanzare.
- [x] Condivisa l’anteprima verificata; nessuna pubblicazione in produzione senza un nuovo consenso esplicito.

# Segnalazione: nuova foto e virgola — 12/11/2026

- [x] Riprodurre il blocco e il punto al posto della virgola dalla nuova schermata.
- [x] Correggere il confine dei radicali e la resa delle virgole senza alterare altre notazioni.
- [x] Collegare passaggi mancanti con radici e frazioni mediante box verificati, senza anticipare risposte; aggiungere ancore esatte interne per radici a indice negativo.
- [x] Segnalare i disaccordi tra due letture OCR dei decimali con «?» e impedire la costruzione finché il punto incerto non viene corretto.
- [x] Collaudare la foto reale nell'interfaccia: incertezza OCR correggibile, confini dei radicali, virgole, barre periodiche, costruzione, C.E. e formula scorrevole su telefono.
- [x] Verificare MOSTRA SOLUZIONE su desktop/telefono e il download diretto del PDF nelle tre sezioni.
- [x] Verificare varianti reali con valori e indici differenti; la variante con indice −5 è riuscita al terzo tentativo. Superati 1515 test, 28 saltati; TypeScript e build corretti.
- [x] Condividere l’anteprima senza pubblicare in produzione; attendere eventuale consenso esplicito per la pubblicazione.

# Segnalazione precedente: foto e indici negativi oltre −3 — 12/11/2026

- [x] Riprodurre il difetto del precedente collaudo: eliminazione non valida del valore assoluto e campionamento solo positivo.
- [x] Mantenere il valore assoluto quando necessario e rifiutare passaggi non equivalenti, anche in cache.
- [x] Verificare gli indici negativi oltre −3 nel parser e verificatore fino a −99, inclusi casi non definiti; costruzione IA provata per −4, −5, −7 e −13.
- [x] Trascrivere la foto reale con il polinomio sotto la radice del denominatore, provare la costruzione tramite l'interfaccia in un'istanza isolata e senza dati dell'utente.
- [x] Eseguire TypeScript, build e 1420 test superati (28 saltati); controllare il rifiuto di una risposta errata tramite l'interfaccia.
- [x] Condivisa l'anteprima senza pubblicazione automatica; l'approvazione per la produzione resta separata.

Nota: il riconoscimento OCR e la costruzione IA non sono deterministici; la trascrizione va sempre controllata e i conti non validi vengono respinti.

# Condizioni di Esistenza (C.E.) nelle fratte — 12/11/2026

- [x] Sezione CONDIZIONI DI ESISTENZA (C.E.) SEMPRE in testa a ogni
  espressione fratta (lettere al denominatore): un box per ogni denominatore
  originale distinto («(x+1) ≠ 0 → x ≠ -1»), calcolata in modo ESATTO dal
  motore (`sezioneCondizioniEsistenza` in `server/costruisci.ts`).
- [x] Radici esatte: grado 1, grado 2 con discriminante quadrato perfetto,
  fattore x^k (x³-x → -1, 0, 1), monomi a più lettere (xy → a ≠ 0, b ≠ 0);
  se l'elenco completo non è garantito (grado > 2, radici irrazionali,
  esponenti negativi) il denominatore NON produce box, mai una C.E. incompleta.
- [x] Box marcati `condizioniEsistenza`: salto `contoGiusto` e collegamento
  alle righe, sopravvivono ai ricaricamenti dall'archivio (idempotenti);
  prompt senza risultati, risposta = solo il valore vietato (calcolatrice);
  `soluzioneCe` «x \ne …» per la risposta risolta e il PDF.
- [x] Client allineato: box C.E. senza riga progressiva (mappa riga/box solo
  conti), display «(x+1) ≠ 0 ⇒ x ≠ -1», scrittura a mano accetta il segno
  meno, MOSTRA SOLUZIONE mostra il valore vietato in formato calcolatrice.
- [x] PDF: riga CONDIZIONI DI ESISTENZA dopo l'intestazione (una implicazione
  per denominatore); nel PDF parziale compare solo quando lo studente l'ha
  già calcolata.
- [x] Prompt IA: regola 12 — l'IA NON crea le C.E., le aggiunge il motore.
- [x] Test: 16 nuovi in `server/condizioniEsistenza.test.ts`; 14 test
  strutturali aggiornati alla nuova sezione; suite completa 1321 passati,
  0 falliti; TypeScript pulito.
- [x] Collaudo dal vivo in anteprima: «1/(x+1)+1/(x+2)+1/(x+3)» costruito
  in modo deterministico; 3 box C.E. (-1, -2, -3) accettati con display
  «⇒», righe progressive dei conti perfettamente allineate, esercizio
  completato 14/14 al primo colpo, PDF finale scaricato. Checkpoint d948e3e.
# Numeri di pagina nel PDF — 12/11/2026

- [x] Quando il PDF scaricabile (parziale o completo) va su più di una
  pagina, il NUMERO DI PAGINA compare in basso al centro: margin-box
  `@page { @bottom-center { content: counter(page) } }` (Chrome 131+),
  OpenDyslexic 11 pt, colore del testo normale.
- [x] NUMERI SOLO SE MULTI-PAGINA: il foglio stile nasce spento e lo
  script della finestra di stampa misura il contenuto (dopo che i font
  sono pronti) e lo accende solo se supera l'altezza utile di una pagina
  A4: 29,7 − 1,8 − 1,6 = 26,3 cm → soglia `(29.7-1.8-1.6)*96/2.54`.
- [x] `involucroPdf` esportato e sicuro anche fuori dal browser (origine
  con fallback): 4 test nuovi in `client/src/pages/pdfNumeriPagina.test.ts`;
  TypeScript pulito.
- [ ] Collaudo dal vivo del PDF multipagina (estensione browser non
  collegata al momento della modifica) e pubblicazione in produzione:
  solo dopo consenso esplicito.


# Quattro miglioramenti del widget — 12/11/2026

- [x] Indici radicali da 2 a 99 (anche negativi): parser, tastiera, messaggi e prompt; «rad2 9» resta √9 mentre «rad13»/«rad45» sono indici (spaziatura disambigua); test verdi.
- [x] Fratte generiche senza IA: N addendi (fino a 6), numeratori polinomiali, addendi interi, prodotto e quoziente di due frazioni in `frazioniLetteraliGuidate`; 23 test verdi.
- [x] Corretto `rationalPolyEquals`: legge i valori con frazioni impilate conservate, così i due punti «:» legano come nell'app e i quozienti di fratte vengono verificati davvero.
- [x] Box extra di semplificazione garantito nella razionalizzazione: radice come fattore in qualunque posizione, con verifica esatta; 16 test verdi.
- [x] (12/11) I 4 test rossi in `trascrizioneFratte.test.ts` sono VERDI: il parser marca la moltiplicazione implicita (`impl`) e la fedeltà assorbe nel numeratore solo i fattori GIUSTAPPOSTI, mai quelli con · esplicito.
- [x] Suite completa verde: 1305 passati, 0 falliti, 28 saltati (116 file).
- [x] Collaudo dal vivo in anteprima (server riavviato): «1/(x+1)+1/(x+2)+1/(x+3)»
  costruito in modo DETERMINISTICO senza chiamare l'IA; MOSTRA SOLUZIONE mostra
  e nasconde la risposta in formato calcolatrice; «rad13(8192)+rad45(x+1)+(-2)^(1/15)»
  accettato senza errori ed esercizio costruito. Nessuna pubblicazione senza nuovo consenso.

# ZIP 9162 e clonazione per equazioni — 11/11/2026

- [x] Individuare baseline e comportamenti pubblicati, inclusa la soluzione solo su richiesta.
- [x] Preparare guida IA per clonazione completa e implementazione graduale delle famiglie di equazioni.
- [x] Aggiungere clonatore sicuro e test isolati, senza sovrascritture o dati reali.
- [ ] Verificare archivio, segreti, ricostruzione e casi noti; consegnare ZIP e rapporto.

# Mostra soluzione su richiesta — 11/11/2026

- [x] Analizzare i pulsanti della foto e le risposte effettivamente richieste nei diversi box.
- [x] Aggiungere un terzo pulsante con visualizzazione facoltativa e reversibile, senza compilazione automatica.
- [x] Convertire le risposte esatte in notazione lineare da tastiera, rispettando frazioni, parentesi, potenze e radici.
- [x] Verificare le soluzioni reinserendole nei box su desktop e telefono simulato; controllare che siano nascoste all’inizio e che il clic non compili la risposta.
- [x] Collaudare frazioni, fratte, radicali anche con indice negativo e 12, quattro variabili e due box progressivi; controllare la non sovrapposizione e le variabili minuscole.
- [x] Eseguire build e TypeScript. Suite completa: 1287 superati, 28 saltati e i 4 errori preesistenti in `server/trascrizioneFratte.test.ts`; la razionalizzazione continua a rifiutare i passaggi invariati.
- [x] Salvare il checkpoint e condividere l’anteprima, senza pubblicare in produzione.

# Razionalizzazione guidata — 11/11/2026

- [x] Riprodurre il box che lasciava invariata la frazione con radice al denominatore.
- [x] Riconoscere le parentesi aggiunte alle righe e aggiungere/sostituire il passo guidato, senza anticipare la risposta.
- [x] Controllare conversioni numeriche e letterali con il motore, senza modificare dati di archivio; mantenere gli indici negativi.
- [x] Collaudare l'interfaccia con dati sintetici isolati e la rilettura della sessione, anche per un box già prodotto dall'IA (desktop e telefono simulato).
- [x] Eseguire la build e il controllo TypeScript.
- [x] Verificare la costruzione IA reale per il box dello screenshot e per la trascrizione precedente della foto, senza usare archivi o sessioni reali; la verifica della foto riguarda tale trascrizione, non garantisce la lettura OCR dell'immagine.
- [x] Salvare un checkpoint e preparare l'anteprima.
- [x] Pubblicazione in produzione su richiesta esplicita dell'utente: deploy **9148** del 11/11/2026, `https://espressioni-monomi-polinomi.easy-peasy.site/`, checkpoint `3c5533d`.
- Ambito automatico: frazioni con denominatore costituito dalla sola radice quadrata; altri casi restano ai percorsi esistenti. Se il motore non verifica il conto, il passo non viene aggiunto.
- Suite completa: 1259 passati, 28 saltati, 4 errori preesistenti in `trascrizioneFratte.test.ts`.

# Indici negativi delle radici — 10/11/2026

- [x] Riprodurre la perdita del segno e lo scambio tra indice e potenza nel percorso foto.
- [x] Correggere normalizzazione, visualizzazione e prompt senza svolgere l'esercizio; mostrare l'incertezza invece di indovinare.
- [x] Testare la foto e il pannello reale in anteprima: entrambi gli indici −3 rimangono accanto alle radici.
- [x] Controllo TypeScript superato; suite completa 1199 passati, 28 saltati e 4 falliti sulle fratte, già presenti nel checkpoint precedente 5a33fac.
- [x] Salvare il checkpoint e condividere l'anteprima senza pubblicare in produzione.

# Costruzione bloccata dall'indice negativo — 10/11/2026 (sera)

- [x] Riprodotto: canonizzaEspressione trasformava l'apice indice ⁻³√ nella potenza ^-3 del coefficiente.
- [x] Corretto il canonizzatore (l'apice prima di √ resta indice) e il prompt IA (\sqrt[-k]{} never potenza).
- [x] Test server nuovi (5) superati; suite 1204 passati, stessi 4 falliti preesistenti sulle fratte; pnpm check pulito.
- [ ] Verifica dal vivo: costruzione reale avviata in background sulla trascrizione della foto.

# Espressioni fratte con fattore esterno — nuova segnalazione 7/11/2026

- [x] Riprodurre l'incongruenza tra / e ⁄ nella verifica della traccia; tre test falliscono sulla versione 9033. Il percorso dell'immagine non rientra nel generatore dei coniugati e dipende dall'IA.
- [x] Preparare un percorso verificato per somme e differenze di due fratte nei casi gestibili, con un box per ogni calcolo.
- [x] Correggere la fedeltà di / e ⁄ e preservare grafia, parentesi, sicurezza dei conti e percorso dei coniugati.
- [x] Rendere scorrevoli nel box le formule fratte più lunghe, anche da tastiera e con caratteri ingranditi.
- [x] Collaudare i casi della foto, varianti, percorso studente e regressioni con archivi simulati; documentare i limiti dell'IA e gli avvisi grafici preesistenti.
- [x] Salvare checkpoint, riavviare l'app e verificare il collegamento dell'anteprima.
- [x] Ricevere il consenso esplicito successivo e pubblicare in produzione come 9038.
- [x] Verificare online bundle, font e percorsi studente con API simulate, senza sessioni reali.
- [x] Aggiornare guide e verificatore al rilascio 9038; superare i 18 test del packaging.
- L'esito dello ZIP definitivo, della ricostruzione isolata e delle skill è
  documentato nei rispettivi rapporti esterni generati dopo l'esportazione.

# Istruzione delle frazioni e parentesi — 7/11/2026

- [x] Analizzare la foto, la guida esistente e i controlli matematici.
- [x] Integrare il breve schema nel testo normale, eliminando il riquadro grigio.
- [x] Confermare che il motore accetta parentesi tonde, quadre e graffe ben bilanciate; aggiungere test permanenti senza alterare il parser.
- [x] Verificare nei test unitari risposte errate, parentesi malformate e denominatori nulli.
- [x] Collaudare visualizzazione, lettura vocale simulata, feedback e PDF con dati sintetici su desktop, telefono e iframe emulati.
- [x] Salvare checkpoint e verificare l'anteprima con risposte e API simulate.
- [x] Condividere l'anteprima e una schermata di prova.
- [x] Ricevere il consenso esplicito per il deploy in produzione.
- [x] Pubblicare la versione approvata come 9033 e confrontare online client, stile e font con l'anteprima; il Chrome personale non ha risposto.

# Export della produzione 9029 — 7/11/2026

- [x] Confrontare gli asset pubblicati con la build e la cornice con il feed del blog.
- [x] Aggiornare gli hash del verificatore, i file obbligatori e le guide alla 9029.
- Gli esiti di ricostruzione e sicurezza dell'archivio definitivo sono riportati
  nel rapporto esterno, generato dopo lo ZIP; l'export non autorizza un deploy.

# PDF: conteggio del primo colpo e dati su una riga — 7/11/2026

- [x] Individuare il conteggio del feedback e il generatore del PDF effettivo.
- [x] Riutilizzare il conteggio nel PDF completo, subito dopo i dati studente.
- [x] Disporre dati sulla stessa riga quando possibile, senza tagli nei casi lunghi.
- [x] Collaudare PDF A4, dati lunghi e caratteri speciali, risultati 0/parziale/totale,
  ritorno al feedback e dispositivi emulati senza usare IA o dati reali.
- [x] Eseguire check, test client e server, build e collaudo della stampa.
- [x] Salvare il checkpoint 2d1f166 e condividere l'anteprima.
- [x] Ricevuto il consenso separato, pubblicare il deploy 9029 e verificare
  dominio, asset/font e PDF/feedback online con dati sintetici.
- [x] Registrare il rilascio e distinguere lo ZIP 9019 già consegnato.

# Export 9019 e cornice aggiornata del blog — 7/11/2026

- [x] Leggere il post pubblico indicato dall'utente e individuare la cornice
  del Widget, distinta dalla Cornice Universale per il PDF.
- [x] Allineare lo snippet byte per byte al feed pubblico (559 righe); non
  modificare il post né presumere aggiornato il DOCX precedente.
- [x] Testare comandi/icone/touch/isolamento e ping di conferma su desktop e
  telefono emulati; preservare i bundle pubblicati.
- [x] Aggiornare guide, sei skill e strumenti di esportazione alla cornice
  attuale; conservare i file originali delle skill e validarne i formati.
- [x] Esportare dal checkpoint 81fecdf e verificare integrità e sicurezza.
- [x] Ricostruire lo ZIP definitivo, provare il server senza chiavi o database
  e consegnare il pacchetto insieme alle skill installabili.

# Personalizzazione del feedback e del pulsante PDF — 7/11/2026

- [x] Rimuovere la cornice intorno al titolo «HAI TERMINATO!».
- [x] Mostrare messaggi incoraggianti diversi in base alle stelle, con
  «OTTIMO LAVORO!» solo quando ogni risposta è giusta al primo colpo.
- [x] Terza pagina: niente pulsante PDF, accesso al feedback con «CONTINUA».
- [x] Feedback: PDF solo qui, senza ripetere il risultato dell'espressione.
- [x] Aumentare lo spazio prima di «INSERISCI IL RISULTATO» in ogni box.
- [x] Testare soglie da 0 a 5 stelle, stampa, navigazione, focus e layout
  desktop/telefono/cornice (9 + 7 + 16 scenari con dati sintetici).
- [x] Salvare il checkpoint e condividere l'anteprima; ricevuto il consenso
  esplicito successivo, pubblicare il rilascio 9019.
- [x] Verificare produzione 9019: asset/font, API vuota senza inferenza,
  feedback 9/9 e scorrimento 7/7 con dati sintetici e touch emulato.

# Pagina finale di feedback e regola di trascrizione — 7/11/2026

- [x] Analizzare le due foto: schermata modello con 5 stelline, «Risposte giuste
  al primo colpo: 6 su 6» e pulsante PDF; box «DENOMINATORE COMUNE» con
  3/(x-2)+2/(x+2) per la regola di trascrizione.
- [x] Contare le risposte giuste AL PRIMO COLPO: prima risposta pubblicata per
  box (canvas/tastiera pubblicano un valore per invio; cancellare non conta).
- [x] Schermata finale autonoma ispirata alla foto: messaggi in italiano,
  cinque stelle, contatore «X su Y», pulsante PDF e possibilità di rivedere
  i passaggi. Il risultato appare nella terza pagina soltanto dopo l'ultima
  risposta corretta; non viene ripetuto nella schermata di feedback.
- [x] Istruzione nera per le frazioni composte: tutto il numeratore fra
  parentesi tonde, barra, tutto il denominatore fra parentesi tonde; schema
  generico con parole, senza esempi che possano coincidere con la soluzione.
- [x] Denominatori coniugati riconoscibili: percorso deterministico e
  verificato con passaggi singoli e prodotto notevole per ultimo. Le altre
  espressioni mantengono il percorso IA e la regola generale del prompt.
- [x] Forme didattiche ammesse: frazione unica, prodotto svolto e somma
  ridotta; accettare forme equivalenti, senza scambiare il conto ripetuto
  per un risultato. Il costruttore e le sessioni conservano i criteri.
- [x] Test mirati prodotti notevoli, feedback e API con archivi/IA simulati.
- [x] Suite completa, build e collaudo con dati sintetici su desktop, telefono,
  cornice, caratteri 160% e stampa PDF; verificato anche che istruzioni e
  schema frazionario non escano dal riquadro.
- [x] Checkpoint 48f7a97 salvato e anteprima precedente condivisa; nessuna
  produzione senza consenso esplicito successivo.

# Pubblicazione 8999 e pacchetto aggiornato — 7/11/2026

- [x] Verificare l'anteprima condivisa e il checkpoint runtime d03a73d.
- [x] Pubblicare con consenso esplicito: deploy 8999, servizio esistente.
- [x] Confrontare asset/font con entrambi i domini e verificare cornice mobile/desktop e API senza dati.
- [x] Rieseguire 886 test client (28 saltati) e 16 server con IA/archivi simulati.
- [x] Aggiornare guide e strumenti di export; 14 test di packaging superati.
- La ricostruzione dello ZIP definitivo e le skill aggiornate sono documentate
  nel rapporto esterno di consegna, successivo a questo checkpoint.
- [ ] Il post Blogger resta invariato: sostituire l'embed separatamente solo su richiesta.

# Pulsanti della cornice come nella foto — 7/11/2026

- [x] Confrontare la foto con i pulsanti originari e la versione precedente.
- [x] Ripristinare sfondo chiaro, bordo sottile, icone e testo scuri nelle proporzioni originali.
- [x] Mantenere SVG completi, etichette visibili e adattamento senza sovrapposizioni su schermi stretti.
- [x] Collaudare schermo intero, ricarica, accessibilità, tocco ai bordi e isolamento della cornice: 6/6 scenari.
- [x] Verificare che il cropper non sia cambiato: regressione mobile con font al 160% superata.
- [x] Preparare l'anteprima e il codice Blogger nello stile della foto.
- [x] Consenso ricevuto e produzione 8999 pubblicata; il post Blogger rimane distinto e invariato.

# Ritaglio foto e comandi della cornice — 7/11/2026

- [x] Individuare i quattro comandi del cropper 8731 e i due pulsanti della cornice dedicata Blogger.
- [x] Riprodurre fuoriuscite di testo e icone del cropper a 320px con font al 160%.
- [x] Adattare l'impaginazione dei comandi al font, senza ridurlo né cambiare il ritaglio.
- [x] Riparare SVG annidati da Blogger e migliorare contrasto e dimensione dei comandi, senza cambiare protocollo o isolamento.
- [x] Testare ritaglio, rotazione, conferma, drag e scroll su desktop, mobile e iframe; verificare icone, schermo intero e ricarica.
- [x] Preparare il codice Blogger dedicato, senza modificare il post esistente.
- [x] Preparare checkpoint e anteprima verificata da condividere.
- [x] Pubblicazione 8999 autorizzata; un'eventuale modifica del post Blogger richiede un'azione separata.

# Collaudo esteso di espressioni — 7/11/2026

- [x] Analizzare parser, validazione studente, calcoli e costruzione IA senza usare dati reali.
- [x] Verificare famiglie numeriche, letterali, fratte, potenze, radici e casi limite.
- [x] Aggiungere test ripetibili di equivalenza, falsi positivi e non-definito.
- [x] Correggere difetti riprodotti, rispettando il principio: nessuna soluzione anticipata.
- [x] Collaudare costruzione IA simulata, UI completa e regressioni di layout/PDF: 30 scenari, 465 controlli.
- [x] Eseguire tipi, test client e server, build; documentare i limiti reali.
- [x] Preparare checkpoint e anteprima collaudata, con rapporto e limiti dichiarati.
- [x] Preparare e verificare l'anteprima da condividere.
- [x] Produzione 8999 autorizzata e pubblicata il 7/11.

# Colori palette, niente suggerimenti verdi, frazioni con lettere — 7/11/2026

- [x] Palette del blog verificata: marrone coerente col primary #8B4513.
- [x] Pulsante IA e riquadro di caricamento da blu sky a marrone palette.
- [x] Rimossi i suggerimenti verdi con 💡 (radici e lettere) in EsercizioFrazioni.
- [x] Causa del rifiuto individuata: le frazioni con lettere fallivano in tutti i rami.
- [x] rationalPolyEquals nel motore: prodotto incrociato num/den, denominatori non nulli.
- [x] 12 test nuovi (frazioniLetterali.test.ts); suite 750 passati/28 saltati; tipi e build OK.
- [x] Verifica nel browser del modulo servito: true per le 4 forme giuste, false per i 2 conti sbagliati.
- [x] Anteprima preparata e verificata; produzione solo dopo un sì esplicito successivo.
- [x] Documentare per la tastiera la necessità di parentesi (…)/(…) per frazioni complesse.

# ZIP e skill aggiornati alla produzione8756 — 29/10/2026

- [x] Verificare commit pubblicato, asset8756 e guide/toolkit precedenti.
- [x] Allineare guide correnti, accessibilità e verificatore ai bundle8756.
- [x] Aggiornare5skill pertinenti, conservando originali e toolkit8744 storici.
- [x] Esportare definitivo8756 da checkpoint52e4e8c:342payload+1manifest, scansione credenziali/CRC/hash passati.
- [x] Ricostruire il definitivo senza chiavi/DB:738test/28saltati,14packaging,check/build e37file client identici.
- [x] Validare5skill,67payload del backup, riferimenti/toolkit e checksum; preparare allegati finali.

Esiti conclusivi e checksum sono esterni allo ZIP immutabile, nella consegna8756.
Il todo incluso nel commit52e4e8c fotografa il lavoro prima dei test finali;
questo aggiornamento del solo registro non richiede una nuova esportazione.
Nessun nuovo deploy, modifica runtime o aggiornamento automatico della libreria account.
- [x] Nessuna modifica runtime o nuovo deploy autorizzati da questa richiesta.

# Deploy produzione autorizzato — 29/10/2026

- [x] Consenso esplicito «deploy in produzione» dopo la preview condivisa.
- [x] Perimetro approvato: seconda pagina640px e terza adattiva fino a640px.
- [x] Versione runtime82602ed, tipi/build e rapporti dei14scenari verificati.
- [x] Pubblicare la versione approvata: deployment8756 active, checkpoint4868ef6.
- [x] Verificare URL pubblico/Cloud Run, hash JS/CSS, font e scroll delle due pagine.
- [x] Registrare rilascio in docs/DEPLOY-8756.md e preparare consegna del link pubblico.

# Terza pagina adattiva — anteprima, 29/10/2026

- [x] Leggere le guide correnti e individuare route, struttura, sessione e PDF.
- [x] Applicare altezza naturale fino a640px e scorrimento interno a /esercizio.
- [x] Mantenere toolbar disponibile, focus accessibile e prima/seconda pagina invariate.
- [x] Collaudare contenuti corti/lunghi, progressione, resize mobile e iframe anti-loop:7/7 scenari,168controlli.
- [x] Verificare risposte immesse via UI su fixture sintetica e PDF; sorgente motore identico.
- [x] Ricontrollare pagina2 e ritaglio foto:7/7 scenari,151controlli.
- [x] Preparare checkpoint e consegna dell'anteprima verificata, con confronto e rapporti.
- [x] Preview accettata; produzione autorizzata con messaggio successivo del29/10.

# Seconda pagina compatta — anteprima, 29/10/2026

- [x] Esaminare le due foto caricate e il riferimento Latino Facile attuale.
- [x] Individuare il frame 820/720px e la dipendenza dall'embed.
- [x] Prima modifica CSS salvata in checkpoint 260a50b; tipi/test/build verdi.
- [x] Misurare altezza reale prima/dopo su viewport mobile in iframe:720 →640px.
- [x] Verificare pannelli lunghi, scrollbar, accessibilità e cropper:7/7 scenari.
- [x] Correggere il collasso flex della prima prova auto; test/documentazione aggiornati.
- [x] Preparare consegna dell'anteprima con confronto visivo e rapporto verificato.
- [x] Preview accettata; produzione autorizzata insieme alla terza pagina il29/10.

L'ultimo ZIP consegnato resta la baseline 8744, precedente a questa modifica.

# Pacchetto esportabile — app pubblicata 8744

## Nuovo audit GitHub / clonazione / Render — 29/10/2026

- [x] Inventario progetto, ZIP precedente, guide e skill correnti.
- [x] Separare documentazione storica dalle istruzioni autorevoli.
- [x] Allineare CI, Blueprint Render e procedure di clonazione.
- [x] Aggiungere verificatore riutilizzabile dello ZIP e ricostruzione (14 test).
- [x] Esportare il candidato da checkpoint pulito, scansione segreti e manifest.
- [x] Nuova estrazione del candidato: install/check/738 test/build, 37 file client identici.
- [x] Smoke Express senza IA/DB e verifica HTTP degli asset: 200, IA503 atteso.
- [x] Aggiornare e validare le due skill tematiche pertinenti; toolkit14 test verdi.
- [x] Predisporre ZIP definitivo, schema rapporto esterno/checksum e skill complete.
      Il definitivo viene ricostruito dopo questo checkpoint; gli esiti finali
      e il checksum sono nel rapporto esterno consegnato con l'archivio.

Nessun deploy, nessun accesso/modifica ai dati di produzione.

# Cronologia precedente (non checklist del nuovo audit)

## Pacchetto precedente 8736 (completato)

- [x] Clone fedele del cropper 8731 e integrazione mobile/iframe.
- [x] 738 test unitari superati, 28 saltati; 19 scenari E2E e 7 controlli aggiuntivi.
- [x] Rimozione delle fixture temporanee dal runtime.
- [x] Deploy produzione 8736 autorizzato e verificato.
- [x] Aggiornamento delle skill manutenzione ed esportazione con riferimenti riusabili.
- [x] Allineamento guide, modello ambiente e note storiche allo stato pubblicato.
- [x] Validare le skill e preparare il checkpoint del pacchetto.
- [x] Generare ZIP con manifest, esclusioni e scansione credenziali.
- [x] Ricostruire da nuova estrazione: install/check/738 test/build OK; tutti i 37 file client identici.
- [x] Preparare la consegna di ZIP, rapporto di verifica e skill aggiornate.

L'attività del pacchetto non ha modificato il codice funzionale, i dati o la produzione.

## Aggiornamento skill e ZIP 8744

- [x] Overflow pezzi lungi corretto con scorrimento interno e didascalia
      «SCRIVI QUI L'ESPRESSIONE» in grassetto nero; 738 test superati.
- [x] Deploy produzione 8744 autorizzato e verificato (dopo propagazione,
      asset online identici alla build approvata).
- [x] Aggiornare guide e skill alla produzione 8744 (validazione riuscita).
- [x] Creare ZIP sicuro con manifest, sorgenti/asset e guide complete.
- [x] Ricostruire da nuova estrazione (install/check/738 test/build), tutti i
      37 file client identici, smoke test Express riuscito.
- [x] Rigenerare ZIP definitivo con rapporto e checklist, verificare
      l'archivio finale e consegnare ZIP, rapporto, checksum e skill.

## Controllo e riordino pacchetto ZIP (GitHub/clonazione/Render)

- [x] Inventario ZIP 8744 (326 file) e guide: indice, comandi, file ereditati.
- [x] Indice README gerarchico; comandi test uniformati (niente `pnpm test`).
- [x] ISTRUZIONI-GITHUB riscritta per questa app; FILOSOFIA-DSA obbligatoria
      nello script di export; nota su GUIDA-UNICA.html ereditata.
- [x] Checkpoint, check/test/build, rigenerazione ZIP e ricostruzione pulita.
- [x] Rapporto 8744 aggiornato con sezione riordino 29/10.
- [x] ZIP definitivo, verifica archivio finale, consegna ZIP + skill aggiornate.
      ATTENZIONE: skill consegnate ferme al 28/10 22:04, utente dice di averle
      cambiate dopo: se ha modificato i file, riallineare e riconsegnare.
- [x] 29/10: recuperate le 6 skill riordinate dall'altra chat LATINO FACILE
      (SKILLS-RIORDINATE-2026-10-29.zip). Per questa app valgono
      didattica-app-matematica + didattica-pubblicazione-blog: installate,
      validate e completate con gli originali locali 8744 (profilo
      espressioni dichiarato parziale solo per mancanza file lì).
- [x] ZIP 8744 invariato: commit fc0daeb, SHA-256
      dbcc9c408f3f63d03d9272fdb453cd4358c059ff524ae22c8b8e99389193e46d.
      Riconsegnare ZIP + skill aggiornate.

## Miglioria successiva — seconda pagina ad altezza contenuta

- [x] Confrontare la repository Applicazione-Latino-Facile (commit 39f503c).
- [x] Aggiungere contenitore limitato e scrollbar interna come il riferimento.
- [x] Eliminare il vecchio resize duplicato, mantenendo heightSync condiviso.
- [x] Collaudare contenuti lunghi, tastiera, mobile, iframe e ritaglio foto: 7+9 scenari riusciti (151+223 controlli).
- [x] Verificare sorgenti prima/terza pagina e geometria del crop invariati; 738 test passati.
- [x] Versione pronta per checkpoint e SOLO anteprima, con rapporto di collaudo incluso.
- [x] Approvazione utente e pubblicazione in produzione 8737.
- [x] Verifica online HTTP 200, JS/CSS identici e scorrimento interno.



- [x] Rifiniture seconda pagina da foto: header ripulito, INDIETRO marrone,
      didascalia corretta; 738 test, check e build superati.
- [x] Deploy produzione 8742 autorizzato e verificato (8739/8741 falliti per
      indisponibilità del servizio, 8742 riuscito; asset online identici).
- [x] Aggiornare guide e skill alla produzione 8742 (validazione riuscita).
- [x] Creare ZIP sicuro con manifest, sorgenti/asset e guide complete.
- [x] Ricostruire da nuova estrazione, testare e confrontare tutti i file client
      (install/check/738 test/build OK; 37 file client identici; smoke 200/200/503).
- [x] Consegnare ZIP, rapporto, checksum e skill aggiornate.

## Aggiornamento skill e ZIP 8737

- [x] Aggiornare stato pubblicato e guide eliminando «solo anteprima».
- [x] Documentare invarianti del layout e collaudi nelle due skill.
- [x] Validare entrambe le skill e preparare il checkpoint del pacchetto.
- [x] Creare ZIP sicuro con manifest, sorgenti/asset e guide complete; scansione credenziali e integrità riuscite.
- [x] Ricostruire da nuova estrazione senza chiavi/DB: install/check/build OK, 738 test superati, 28 saltati, 37 file client identici.
- [x] Preparare la consegna di ZIP definitivo, rapporto, checksum e due skill aggiornate e validate.

Questa attività non modifica il codice funzionale, i dati o la produzione.


## 11/11 — costruzione dalla foto con radice al denominatore
- [x] Riprodurre il blocco nel controllo di fedeltà.
- [x] Allineare il confronto alla stessa frazione impilata mostrata nell'anteprima, preservando i controlli sulle differenze.
- [x] Test su radici e indici; prima costruzione verificata con IA reale senza database.
- [x] Collaudo dell'intero percorso: foto originale → OCR reale → creazione IA reale → sessione e primo box, con archivi isolati in memoria.
- [x] Rimosse le cancellazioni automatiche SQL delle sessioni e della cache dal database condiviso; nessun dato esistente è stato eliminato.
- [x] (12/11) Box aggiuntivo di semplificazione GARANTITO nel codice: la radice
  come fattore del numeratore è riconosciuta in qualunque posizione
  (`sostitutoFrazioneConRadice` ora copre 2a·√B, √B·2a, 2a√B, √B√B, 2a·3·√B
  e il radicando tra parentesi), con verifica esatta su ogni risposta.
- [x] Test mirati e TypeScript superati; quattro test preesistenti sulle frazioni letterali restano falliti nella suite generale.
- [x] Preparare checkpoint e anteprima senza pubblicare.

## 11/11 — foto con frazioni e radici
- [x] Riprodurre il difetto di resa della frazione fotografata.
- [x] Rendere impilate le frazioni con radicali, preservando gli indici e il testo letto.
- [x] Collaudare la foto originale nel flusso foto reale: entrambe le frazioni impilate e radicandi fedeli in una prova; controllare sempre l'OCR.
- [x] Preparare l'anteprima da condividere senza pubblicare in produzione.

## 9/11 — periodici visibili e foto dei radicali
- [x] Riprodurre la barretta invisibile nel riquadro «CONTROLLA PRIMA DI CONFERMARE» e individuare il disallineamento tra CSS e motore KaTeX.
- [x] Allineare il CSS KaTeX alla versione installata e preservare pure periodiche, antiperiodo e periodi su più cifre senza inventare segni.
- [x] Inserire le parentesi attorno alla radice nel solo numeratore e distinguere una radice sull'intera frazione.
- [x] Nel riquadro della foto con lettere rappresentare la moltiplicazione con il puntino, non con l'asterisco.
- [x] Conservare il puntino fra due radicali anche nella traccia e nei passaggi costruiti, con test client e server.
- [x] Pubblicare la build approvata in produzione 9096 e confrontare i bundle sui due domini.
- [x] Verificare in produzione la foto del periodico nella schermata di controllo senza creare sessioni di prova.
- [x] Aggiornare le guide e i verificatori ZIP alla produzione 9096, senza cambiare il runtime.
- [ ] Ricostruire e verificare il pacchetto definitivo in ambiente isolato.
- [x] Guidare le espressioni con periodico in box distinti e in ordine, senza mostrare risultati.
- [x] Aggiungere il comando periodico nella legenda dell'editor a pezzi.
- [ ] Verificare regressioni e compilazione; controllare le foto reali nell'anteprima e la larghezza visibile della barretta.
- [ ] Collaudare la costruzione in archivio isolato, senza toccare le sessioni e i dati dell'utente.
- [ ] Salvare il checkpoint e condividere l'anteprima, senza pubblicare senza nuovo consenso.


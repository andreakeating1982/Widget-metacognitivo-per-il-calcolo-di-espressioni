# Seconda pagina compatta — sviluppo e rilascio del 29/10/2026

**Stato aggiornato:** pubblicata insieme alla terza pagina nella
produzione8756 dopo consenso esplicito successivo alla preview.
Vedere `DEPLOY-8756.md`; il precedente ZIP8744 non è stato rigenerato.
Le note di anteprima sotto conservano la cronologia del collaudo.

## Richiesta e riferimento effettivo

Foto mobile caricate dall'utente: Latino Facile presenta una cornice più
corta rispetto al widget. La repository richiesta è
https://github.com/andreakeating1982/Applicazione-Latino-facile,
main `fccd3eeb46d801b5110e2fc9a3b682e6501a4d6c` al momento della verifica.

In `cornice-dinamica/embed-latino-facile-dedicata.html`, `.lf-iframe`
ha `height:640px` come altezza iniziale. Il documento dell'app Latino
segue poi il proprio contenuto: non esiste un limite generale della
pagina Home. La modifica del widget riprende l'altezza iniziale640,
NON pretende di rendere identici tutti i contenuti/layout delle due app.

## Implementazione

Solo CSS del contenitore `/espressione`:
- altezza predefinita complessiva **640px**, toolbar inclusa;
- standalone `height:min(640px,var(--expr-visible-height,100dvh))`:
  non supera lo spazio disponibile con tastiera o in landscape;
- iframe `height:640px`, senza dipendenza dal viewport del child;
- contenuto `.expr-input-page` scorre dentro, toolbar esterna;
- nessuna riduzione di font, testo, canvas o pulsanti per farli entrare;
- invariati input/foto/OCR, `piece-display`, cropper8731, heightSync,
  motore, API, dati, prima/terza pagina e PDF.

La prima prova `height:auto;max-height:720/820px` del checkpoint260a50b
NON va ripristinata: nel browser, in iframe mobile393px, il figlio
`flex:1 1 0` collassa a0px e resta soltanto la toolbar138px.
Il limite esplicito640 evita il problema e conserva lo scroll stabile.

## Collaudo

Il test ripetibile `tests/input-scroll.e2e.mjs` è stato allineato al target640.
Collaudo Playwright/Chromium locale: **7/7 scenari superati** — desktop,
mobile320, mobile393, landscape, blog mobile, blog desktop e accessibilità160%.
I risultati effettivi sono in `tests/compact-height-browser-results.json`.
Verificati: limite640, scroll da tastiera/dito simulato, toolbar ferma,
10pezzi e pannelli lunghi, nessun overflow orizzontale, apertura/chiusura
ritaglio con posizione conservata, otto maniglie e comandi raggiungibili,
PNG e OCR simulato senza eseguire calcoli, token altezza stabile.
Prima/terza pagina rimangono prive del contenitore limitato.

Type-check e build superati; unit test **738 passati e28 saltati**.
L'audit rispetto al pacchetto consegnato8744 conferma che l'unico file
runtime modificato è `client/src/index.css`. Non sono stati rieseguiti
inutilmente i sette test già riusciti per preparare l'immagine comparativa.

Il confronto visivo iniziale a393px misura prima720px e dopo640px,
con area scroll rispettivamente582 e502px. Il lato «prima» è ricostruito
con una sola sovrascrittura CSS isolata; non accede alla produzione.
Il pulsante inferiore può essere parzialmente fuori vista all'apertura:
è raggiungibile con lo scroll, intenzionalmente mantenuto.

Dopo che l'estensione dell'utente ha smesso di rispondere, il collaudo è
stato completato in Chromium headless nel sandbox. Nessuna prova su
telefono fisico o modifica al blog pubblico è implicita; OCR simulato,
nessun database e nessuna IA reale usati.

## Estensione successiva richiesta dall'utente

La frase sopra «prima/terza pagina invariata» descrive questa prima
iterazione. Su richiesta successiva anche `/esercizio` ha un wrapper
adattivo fino a640px e scroll interno: vedere `TERZA-PAGINA-ADATTIVA.md`.
La seconda pagina conserva il comportamento già collaudato.

## Rilascio

Anteprima soltanto. Produzione precedente8744 invariata; occorre un nuovo
consenso dopo avere condiviso l'URL dell'anteprima. Il precedente ZIP
consegnato e i suoi hash restano quelli della baseline8744.
Non rigenerare automaticamente ZIP/skill o distribuire in produzione
solo per la modifica dell'altezza: eventuali consegne successive vanno
richieste e verificate separatamente.


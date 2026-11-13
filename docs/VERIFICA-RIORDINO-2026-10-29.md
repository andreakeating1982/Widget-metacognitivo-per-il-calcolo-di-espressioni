# Audit e riordino del pacchetto — 29/10/2026

## Perimetro

Baseline funzionale **8744**, invariata. Questa attività aggiorna guide,
configurazioni GitHub/Render e strumenti di esportazione/verifica;
non cambia i sorgenti client/server/shared, la matematica o gli asset.
Non crea repository né servizi e non pubblica una nuova versione dell’app.

## Problemi individuati e correzioni

| Punto | Correzione |
|---|---|
| README mescolava flusso corrente e cronologia con istruzioni contrarie | Nuovo ingresso operativo; originale completo in docs/storico |
| Guide IA/adattamento attribuivano la terza pagina/PDF al vecchio percorso | Mappa corrente di server/costruisci ed EsercizioFrazioni |
| Varianti promettevano gradi arbitrari e quiz già presenti | Distinti famiglie strutturate, nuovo motore e sorgente quiz dedicata |
| Trapianti suggerivano copia del file generato con chiavi | Copiare lo script e rigenerare con configurazione propria |
| CI non coincideva col comando di test documentato | working-directory client, Vitest reale senza passWithNoTests |
| CI archiviava anche il bundle server | Artifact limitato a dist/public |
| Render NODE_ENV=production con dipendenze build non forzate | Corepack + install --prod=false + check + build |
| Nessun campo Blueprint per inserire la propria chiave | EASY_PEASY_API_KEY sync:false, nessun valore nel repo |
| Assunzione che CI bloccasse autodeploy | Guida distingue CI e autodeploy/gate del proprio servizio |
| Verifiche ripetibili solo tramite script esterni alla consegna | verify-package.py portabile + test Python inclusi |
| Conteggio file ambiguo | Manifest esplicita payload e totale incluso il manifest |

## Contratto di collaudo del nuovo archivio

Lo ZIP definitivo deve essere esportato da checkpoint pulito e verificato
da una NUOVA estrazione senza chiave o DB. Il verificatore incluso esegue
installazione con NODE_ENV=production e --prod=false, check, Vitest, test
Python, build, confronto client e smoke HTTP di header/asset/IA assente.

**Gli esiti effettivi, commit, conteggi e SHA-256 di questo nuovo ZIP sono
nel rapporto JSON esterno consegnato con l’archivio.** Non sono dedotti
dai rapporti storici 8736/8737/8742/8744. La separazione evita di modificare
l’archivio dopo averlo collaudato per inserirvi il proprio checksum.

Prima ricostruzione del candidato (commit `8d5e5b2`): corepack, install,
check, Vitest, test Python e build riusciti in NODE_ENV=production con
--prod=false. **738 test Vitest passati, 28 saltati e 14 test Python passati**;
JS index-BnuQEBUp.js e CSS index-D1FTbNg8.css identici; tutti i **37 file
client identici**, senza mancanti, extra o diversi. Smoke Express root200,
font/ONNX/WASM/Tesseract/PDF/bundle200 con hash identici; IA senza chiave503
atteso. Chiave generata vuota; nessun endpoint dati/sessioni utilizzato.

Il definitivo sarà ricostruito nuovamente dopo l’aggiornamento della
checklist e di questo rapporto: fa fede il JSON esterno del ZIP consegnato.
I test Python del packaging sono separati dalla suite app.

## Limiti

Nessun deploy Render reale; nessuna IA live, uso di database o test su
telefoni fisici. Conservati fixture/E2E e i loro rapporti precedenti senza
presentarli come nuovo collaudo browser. Build/source invariati permettono
di conservare le approvazioni funzionali 8744 senza ridistribuire l’app.

## Skill

Aggiornare le due skill tematiche pertinenti (matematica e pubblicazione),
con riferimenti/script e precedenza delle guide correnti sugli originali
storici. Consegnare i pacchetti completi, non due file omonimi privi di
risorse. Il salvataggio locale di una skill non aggiorna automaticamente
la libreria dell’account: un eventuale aggiornamento account va distinto
dalla consegna e verificato esplicitamente.


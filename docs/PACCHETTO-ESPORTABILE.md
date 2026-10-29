# Pacchetto esportabile: GitHub, clonazione e verifica

Questa guida descrive il pacchetto della baseline pubblicata **8756**.
Aggiornamento29/10/2026: solo guide/toolkit/skill, nessuna modifica runtime
e nessun nuovo deploy. Il rapporto esterno riguarda il nuovo ZIP effettivo;
quelli8744 sono storici. Nessun dato o segreto di produzione incluso.

## 1. Radice e file obbligatori

Lo ZIP ha una sola cartella `espressioni-monomi-polinomi/`.
Caricarne il CONTENUTO nella root GitHub, compresi i file nascosti.
Alla root devono esserci package/lockfile, patch, configurazioni, client,
server, shared e guide. Lo ZIP non sostituisce un repository remoto.

`MANIFEST-SHA256.json` indica:
- `source_commit`: commit esatto delle sorgenti del pacchetto;
- `production_deployment`: baseline funzionale, non un deploy dello ZIP;
- `payload_file_count`: numero di file sorgenti/guide/asset esportati;
- `zip_file_entries_including_manifest`: payload + un manifest;
- `files`: percorsi relativi, dimensioni in byte e SHA-256;
- esclusioni tracciate e categorie private/generated non incluse.

Il manifest non include il proprio hash. Il checksum esterno copre
l’intero ZIP. Un hash verifica integrità, non costituisce firma digitale
né certificazione di origine: conservarlo insieme a una fonte fidata.

## 2. Contenuti da conservare

Font OpenDyslexic, ONNX, WASM, Tesseract, vocabolari, quaderno pubblico,
patches e lockfile sono DIPENDENZE necessarie, non spazzatura runtime.
I test E2E e le fixture sintetiche sono utili e non vengono montati nel
runtime. `GUIDA-UNICA.html` resta come eredità documentata.

Gli originali di README/AGENTS/ADATTARE/RENDER precedenti al riordino sono
in `docs/storico/`, per conservazione. Le loro istruzioni superate o i
link relativi originari non sono procedure correnti; partire dal nuovo README.

Da escludere: `.git`, `node_modules`, `dist`, `.env` reali, file generati
con chiavi, database/sessioni, log e diagnostici standalone identificati.
Non togliere fixture o asset solo perché grandi. Nessun file di produzione
viene cancellato per costruire lo ZIP.

## 3. Controllo di integrità senza eseguire il codice dell’app

Dopo avere estratto il pacchetto, dalla cartella dell’app:

```sh
python3 scripts/verify-package.py /percorso/pacchetto.zip \
  --report /percorso/verifica-integrita.json
```

Richiede Python 3.11+ e sola libreria standard. Verifica CRC, unicità e
sicurezza dei percorsi, assenza di symlink, corrispondenza esatta con il
manifest, SHA-256/dimensioni di ogni payload, file obbligatori, esclusioni
private e firme note di credenziali. Nessun accesso a DB o API IA.
La scansione non è un penetration test né garanzia contro ogni segreto
possibile: l’export cerca anche i valori noti dell’ambiente sorgente.

## 4. Ricostruzione automatizzata da nuova estrazione

```sh
python3 scripts/verify-package.py /percorso/pacchetto.zip \
  --extract-to /percorso/cartella-NUOVA \
  --rebuild \
  --baseline-public dist/public \
  --report /percorso/verifica-ricostruzione.json
```

`--baseline-public` è facoltativo: usarlo solo con una build approvata
realmente disponibile. Senza, lo script controlla comunque JS/CSS8756.
Non usare questa identità JS/CSS per una variante con runtime modificato:
in tal caso aggiornare esplicitamente il contratto dopo approvazione.

La destinazione NON deve esistere. La procedura:

1. Verifica lo ZIP prima di estrarlo.
2. Rimuove dall’ambiente ereditato chiavi, token, DATABASE_URL e variabili
   benchmark; non copia `.env` o dipendenze dalla sorgente.
3. Imposta `NODE_ENV=production`, CI e installa con
   `pnpm install --frozen-lockfile --prod=false`: simulazione del requisito
   Render senza perdere Vite/TypeScript/esbuild.
4. Esegue corepack, install, tipi, Vitest in `client`, test Python e build;
   salva log isolati in `qa-logs/`.
5. Verifica chiave server generata vuota, JS/CSS approvati e, se richiesto,
   hash di TUTTI i file della build client.
6. Avvia Express su una porta libera e controlla root/header,
   font/ONNX/WASM/Tesseract/PDF e bundle via contenuto reale e hash.
7. Verifica IA non configurata (503) senza chiamare servizi IA live.
   Non usa endpoint di lettura/scrittura di dati o sessioni.
8. Arresta il server di collaudo e scrive un rapporto JSON.

Richiede Node 22, Corepack/pnpm e rete per installare le dipendenze.
La build esegue codice del repository: usarla su sorgenti fidate, in
ambiente isolato. Non eseguire con credenziali o DB di produzione.

## 5. Rigenerazione da repository

Dopo checkpoint/commit e Git pulito:

```sh
python3 scripts/export-verified.py --project . \
  --output ../espressioni-monomi-polinomi-RIORDINATO.zip \
  --prefix espressioni-monomi-polinomi --deployment 8756
```

Scrivere lo ZIP fuori dal repository. Lo script rifiuta un albero sporco,
file obbligatori mancanti o credenziali note, ed esclude runtime/diagnostici.
Esportare anche lo script verificatore e i suoi test: non relegare gli
strumenti di ricostruzione a una cartella privata non consegnata.

Il rapporto finale può essere esterno all’archivio per evitare dipendenze
circolari: prima esportare lo ZIP definitivo, poi collaudarlo e calcolarne
checksum/rapporto. Se si cambia lo ZIP DOPO il test, ricontrollare il delta
esatto o ripetere la ricostruzione. Non chiamare un vecchio rapporto
«verifica del nuovo ZIP» senza questo controllo.

## 6. Verifiche non coperte

- Nessun nuovo deploy Render/GitHub/Cloud Run durante questo audit.
- Nessun test IA live: serve una chiave propria.
- Nessun database di produzione o migrazione eseguita.
- Nessun nuovo collaudo su telefoni fisici o certificazione di accessibilità.
- Gli E2E crop/layout sono conservati con istruzioni e rapporti storici;
  la ricostruzione non li esegue implicitamente.

Consegna: ZIP + rapporto effettivo + checksum + skill pertinenti complete
(con tutti i relativi riferimenti e script). Le skill sono strumenti
separati: non introdurle nelle dipendenze runtime dell’app.


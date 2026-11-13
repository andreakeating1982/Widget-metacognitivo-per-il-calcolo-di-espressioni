# Verifica del pacchetto 8737

**Esito: ricostruzione riuscita da una nuova estrazione, senza chiavi di
produzione e senza database.** Questo ZIP sostituisce il pacchetto 8736.

## Versione inclusa

App WIDGET METACOGNITIVO PER IL CALCOLO DI ESPRESSIONI, produzione **8737**.
URL: https://espressioni-monomi-polinomi.easy-peasy.site
Commit funzionale pubblicato: `f2f285102a92deae1ae35175ba64cc49722bfb42`.
Il manifest del pacchetto riporta il commit documentale finale e gli hash
individuali dei file. Il codice runtime non è stato modificato né ridistribuito
per questa richiesta di ZIP/skill.

La seconda pagina ha altezza contenuta e scrollbar interna stile Latino
Facile; toolbar fuori dallo scroll, iframe senza crescita ricorsiva,
ritaglio modale e altre due pagine preservati. Specifica tecnica:
`SECONDA-PAGINA-SCROLL.md`. Guide di avvio/riuso: REBUILD, ADATTARE,
RENDER, ACCESSIBILITA, AGENTS e FILOSOFIA-DSA.

## Ricostruzione effettivamente eseguita

Verificati via SHA-256 **320 file** della prima
estrazione. Installazione in cartella nuova, senza copiare node_modules,
.env, dist o file generati. Variabili API/DB rimosse dall'ambiente di prova.

| Passo | Esito | Tempo |
|---|---|---|
| corepack | riuscito | 0.12 s |
| install | riuscito | 5.66 s |
| check | riuscito | 10.16 s |
| unit | riuscito | 19.97 s |
| build | riuscito | 9.11 s |

**738 test unitari superati, 28 saltati** (fixture/banchi facoltativi).
Il server generato contiene chiave IA vuota, come atteso per uno ZIP sicuro.

**Tutti i 37 file di `dist/public` sono identici**
a quelli della build approvata della produzione 8737: nessun file mancante,
aggiunto o diverso. JS e CSS sono stati anche scaricati nuovamente dal sito
pubblico e confrontati byte per byte prima di ricostruire:

- `/assets/index-DUnezMFd.js`: `ff501c0074806d11f52a01b3e71fccd0767098c199ba0664f9f2ec5b94dabfbe`.
- `/assets/index-BlxE_eut.css`: `c0dabb88896f9d5eb57191f72028978696931e19f01c0bf84cd99cdc0241a97b`.

Il bundle server senza chiave è intenzionalmente diverso da quello pubblico:
non si distribuisce un bundle contenente le credenziali di produzione.

## Smoke test Express locale isolato

- Pagina principale: HTTP **200**.
- Font OpenDyslexic: HTTP **200**.
- API IA senza chiave: HTTP **503**, atteso.
- COOP: `same-origin`; COEP: `require-corp`.
- Nessun database, sessione reale o operazione IA usata nel test.

Le funzioni IA richiedono la propria EASY_PEASY_API_KEY nell'ambiente
server/build. Non sono operative senza chiave; il pacchetto non contiene
quella della produzione. Senza DB cache e sessioni sono temporanee.

## Collaudo browser già completato prima del deploy 8737

- Layout: **7 scenari /151 controlli**.
- Regressione cropper: **9 scenari /223 controlli**.
- Risultati e istruzioni conservati in `tests/input-scroll-results.json`,
  `tests/INPUT-SCROLL.md` e nei due script E2E.

Touch e viewport emulati in Chromium; blog cross-origin simulato, OCR mock.
Non è una certificazione su telefoni fisici o sul blog pubblico dell'utente.
Le due suite vanno eseguite in sequenza, attendendo gli autoscroll.

## Controllo dell'archivio definitivo

Dopo la ricostruzione sono stati aggiunti soltanto questo rapporto e le
spuntature della checklist; nessun sorgente o asset funzionale è variato.
Il controllo finale confronta tutti i payload con il manifest dell'estrazione
ricostruita e ammette soltanto queste variazioni documentali.

Archivio verificato con CRC e manifest SHA-256 per ciascun file. Escluse
credenziali, dati runtime/DB, .git, node_modules e dist; conservati ONNX,
WASM/Tesseract, font, PDF pubblico, test, fixture, lockfile e patches.
Il checksum dell'intero ZIP è in `SHA256SUMS.txt` allegato alla consegna.

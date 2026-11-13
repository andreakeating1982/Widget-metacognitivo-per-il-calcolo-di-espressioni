# Versione pubblicata 8737 — 28 ottobre 2026

## Riferimento verificato

- App: **WIDGET METACOGNITIVO PER IL CALCOLO DI ESPRESSIONI**.
- URL: https://espressioni-monomi-polinomi.easy-peasy.site
- Deploy **8737**, approvato esplicitamente dall'utente, attivo.
- Commit funzionale pubblicato: `f2f285102a92deae1ae35175ba64cc49722bfb42`.
- JS: `index-DUnezMFd.js` — SHA-256
  `ff501c0074806d11f52a01b3e71fccd0767098c199ba0664f9f2ec5b94dabfbe`.
- CSS: `index-BlxE_eut.css` — SHA-256
  `c0dabb88896f9d5eb57191f72028978696931e19f01c0bf84cd99cdc0241a97b`.

Guide e skill aggiornate dopo il deploy non costituiscono un nuovo deploy.
Il pacchetto include il codice funzionale pubblicato, senza credenziali né
dati di esecuzione. Il commit del pacchetto è nel manifest SHA-256.

## Novità: altezza contenuta della seconda pagina

Solo `/espressione` ha una scrollbar interna sottile marrone nello stile
di Latino Facile, con toolbar accessibilità sempre disponibile. Non è un
menu laterale. La pagina autonoma non supera 820px desktop /720px mobile
né il viewport visibile. In iframe i limiti 820/720px sono indipendenti
dall'altezza assegnata alla cornice: nessun feedback di crescita.

Pezzi e pannelli lunghi scorrono internamente; nessun limite ai pezzi e
nessuna riduzione dei font. Il ritaglio congela lo scroll interno e lo
ripristina chiudendo; le notifiche non coprono i suoi quattro comandi.
La prima pagina e lo svolgimento/PDF della terza restano invariati.

Dettagli e invarianti: **SECONDA-PAGINA-SCROLL.md**. Non rimuovere il
position:relative che contiene il MathML KaTeX e non reintrodurre il vecchio
observer locale: l'altezza embed è gestita SOLO da initHeightSync().

## Ritaglio e filosofia didattica preservati

Il cropper 8731 pubblicato nella versione 8736 è conservato: modale,
viewport mobile/iframe, otto maniglie, drag diretto, rotazione e PNG max
2200px. `CropDialog.tsx`, hook, `cropBox.ts` e `photo-crop.css` invariati.
Per i dettagli storici leggere VERSIONE-8736.md e COLLAUDO-PHOTO-CROP-8731.md.

Ogni risultato lo inserisce lo studente. Mai anticipare soluzioni nei testi
né ripristinare l'avviso permanente della frazione impilata eliminato.
Trascrizione foto = solo testo/espressione, mai esecuzione delle operazioni.

## Verifiche della versione pubblicata

- Typecheck e build riusciti; **738 test superati, 28 saltati**.
- Nuovo layout: **7 scenari, 151 controlli**.
- Regressione cropper: **9 scenari, 223 controlli**.
- HTTP 200 e JS/CSS identici su URL pubblico e Cloud Run.
- Browser online: contenitore 820px, scrollbar 4px, scorrimento interno
  e toolbar ferma anche con pannello audio/tastiera aperto.

Prove touch/viewport in Chromium emulato; blog cross-origin simulato.
OCR intercettato nei test, nessuna chiamata IA reale o modifica DB.
Risultati: tests/input-scroll-results.json. La verifica della ricostruzione
dello ZIP è documentata separatamente in VERIFICA-PACCHETTO-8737.md.

## Pacchetto, sicurezza e avvio

Sorgenti completi, modelli ONNX, WASM/Tesseract, font OpenDyslexic, PDF
pubblico didattico, test/fixture, cornice Blogger, lockfile e patches.
Guide REBUILD/ADATTARE/RENDER/AGENTS/ACCESSIBILITA/FILOSOFIA-DSA incluse.

Esclusi `.env` reali, `shared/env.generated.ts`, `dist`, `node_modules`,
`.git`, cache/log, sessioni e file database; scansione credenziali e
manifest SHA-256 per ciascun file. Rapporti 8736 conservati come cronologia,
non come descrizione dello stato corrente.

La propria `EASY_PEASY_API_KEY` va nell'ambiente server/build: lo ZIP non
contiene quella di produzione. Senza chiave funzionano UI, canvas e crop;
IA non configurata restituisce 503. DATABASE_URL facoltativa; senza DB
sessioni/cache temporanee non persistono dopo riavvio. Non copiare dati
reali, non eseguire seed/reset/migrazioni per verificare lo ZIP.


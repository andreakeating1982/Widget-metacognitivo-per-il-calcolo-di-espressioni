# Versione pubblicata 8744 — 28 ottobre 2026

## Riferimento verificato

- App: **WIDGET METACOGNITIVO PER IL CALCOLO DI ESPRESSIONI**.
- URL: https://espressioni-monomi-polinomi.easy-peasy.site
- Deploy **8744**, approvato esplicitamente dall'utente e attivo.
- Commit funzionale pubblicato: `a90d5972c9f46adbfbc24f994f30ab4e976f7957`.
- JS: `index-BnuQEBUp.js` — SHA-256
  `c68d11243554e58fb2c21bff0e3d7dd50f8948c7aba9f4e53be448636e2262db`.
- CSS: `index-D1FTbNg8.css` — SHA-256
  `7699ceeb6be69e7f4524154b148e17564845da855e682538beabd96be09ebe43`.

Nota di trasparenza: subito dopo il deploy il sito serviva ancora gli
asset vecchi (propagazione della revisione). Ricontrollato dopo attesa:
HTTP 200 e JS/CSS identici byte per byte alla build approvata, schermata
online conforme. Le modifiche documentali e lo ZIP non costituiscono un
nuovo deploy.

## Novità: overflow dei pezzi e didascalia (da foto utente)

- **Overflow corretto**: le espressioni troppo lunghe non escono più dai
  bordi dei box dei pezzi. Il box del pezzo (classe `piece-display` in
  `client/src/index.css`, con `flex-1 min-w-0` sullo span KaTeX) diventa
  un contenitore che SCORRE in orizzontale al proprio interno; se il
  pezzo è corto resta centrato come prima. Stessa regola applicata al
  box «Espressione trascritta» del pannello audio/tastiera e al riquadro
  «Controlla prima di confermare».
- **Didascalia semplificata**: solo «**SCRIVI QUI L'ESPRESSIONE**», in
  grassetto e inchiostro scuro (`text-foreground font-bold`), senza
  «IN UNO O PIU' PEZZI.».

Il resto è invariato: header 8742, scrollbar interna stile Latino Facile,
cropper 8731, prima pagina e svolgimento/PDF.

## Verifiche della versione pubblicata

- Typecheck, **738 test superati / 28 saltati** e build riusciti.
- Collaudo browser con pezzo lunghissimo di prova: nessuna fuoriuscita
  oltre la pagina (`scrollWidth` pagina contenuto), scorrimento interno
  del box, didascalia corretta e grassetto confermati.

## Pacchetto, sicurezza e avvio (riordino doc, stesso runtime)

Il riordino documentale successivo al deploy NON cambia il runtime
né gli hash: README con indice gerarchico (parti da qui, ricostruisci,
clona, Render, dettagli, cronologia) e nota sul file ereditato
`GUIDA-UNICA.html`; comandi di test uniformati a
`(cd client && pnpm exec vitest run)` in README/AGENTS/ADATTARE (NON
esiste uno script `pnpm test`); `ISTRUZIONI-GITHUB.txt` riscritta per
questa app (produzione 8744, varianti, Render, comandi di verifica);
`FILOSOFIA-DSA.md` aggiunta ai file obbligatori di `export-verified.py`.

## Pacchetto, sicurezza e avvio (versione originale)

Vale tutto quanto già documentato in VERSIONE-8742.md e
VERIFICA-PACCHETTO-8742.md: sorgenti completi senza credenziali né dati di
esecuzione, propria `EASY_PEASY_API_KEY` nell'ambiente server/build, DB
facoltativa. La verifica della ricostruzione dello ZIP corrente è in
VERIFICA-PACCHETTO-8744.md.


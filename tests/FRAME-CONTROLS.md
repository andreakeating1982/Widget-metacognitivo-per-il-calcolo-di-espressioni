# Cornice Blogger — collaudo controlli

`frame-controls.e2e.mjs` verifica la **cornice dedicata vera** tramite
`/anteprima-cornice.html`, generata dal file Blogger e collegata allo stesso
ambiente. La verifica è isolata e non modifica il post pubblico o il database.

- Schermi da 280, 320, 393 e 740px e desktop da 1280px, emulati in Chromium.
- Riferimento fotografico: pulsanti avorio con bordo sottile, testo e icone
  scuri, icone 16px e testo OpenDyslexic 12px; le etichette sono sempre visibili.
- Contrasto almeno 4,5:1; area tattile estesa a 44px senza alterare la forma
  visibile, anche a capo; assenza di sovrapposizioni e focus da tastiera.
- Nomi accessibili e resistenza ai CSS generici del blog.
- I simboli devono conservare quattro angoli e freccia; un solo path SVG
  chiuso direttamente dentro ogni `<svg>` non può essere annidato da Blogger.
- Apertura/uscita dallo schermo intero e ricarica reale dell'app, con dati
  sintetici nella sola pagina iniziale. Su mobile i test toccano davvero
  l'area estesa fuori dal bordo visibile. Due cornici sono provate in
  parallelo per verificare isolamento del reload e filtro messaggi provenienti
  da un iframe diverso.

```sh
node scripts/prepare-cornice-preview.mjs --check
# Copiare il test in un ambiente con Playwright + Chromium e poi:
FRAME_CONTROLS_URL=http://127.0.0.1:3000 node frame-controls.e2e.mjs
```

`FRAME_CASE=mobile-320` seleziona uno scenario. Il vero post del blog non è
modificato: servirà sostituire solo la sua cornice dedicata dopo approvazione.
Le misure touch/viewport sono emulazioni, non test su telefono fisico.


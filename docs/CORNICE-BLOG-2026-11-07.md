# Cornice del Widget presente sul blog — 7 novembre 2026

## Fonte effettiva

Il post [MATEMATICA](https://blogdelprofessoreandreacentinaro.blogspot.com/2026/09/matematica_01504356514.html)
contiene due elementi distinti: prima la Cornice Universale per il quaderno
PDF e poi la cornice dedicata al Widget Metacognitivo. È stata confrontata
**soltanto quest'ultima**, come indicato dall'utente.

Il feed pubblico Blogger del post `679576033890164509` riporta una modifica
del post alle `2026-11-07T11:33:52.660+00:00`. La porzione dal commento
`CORNICE DINAMICA — WIDGET METACOGNITIVO` alla chiusura `</script>` era
composta da 559 righe. È identica byte per byte a
`cornice-dinamica/embed-espressioni-dedicata.html` (compreso il ritorno a capo
finale), SHA-256:

```text
d7cd547a6f0ba53815a12dd0adcc16276cf02b3a91a16a74b46d8cbcf1968a4c
```

Il confronto attesta ciò che era pubblico al momento del controllo, non
impedisce modifiche successive al blog. Non sono stati pubblicati né modificati
il post, il precedente DOCX dei codici o la Cornice Universale.

## Differenze dalla copia precedente nel progetto

- Aggiunto lo standard CSS scoped del blog per i controlli: testo, icone e
  area tattile restano leggibili anche su telefono e con CSS esterni.
- L'icona Ricarica usa il path SVG effettivamente presente sul blog.
- Dopo un salto sospetto dell'altezza, `setTimeout(ping, 80)` chiede subito
  la conferma; restano il filtro per istanza e le difese anti-loop.

Non sostituire questa versione con la precedente di 526 righe. Prima di
modificare un DOCX, aprire la copia attuale e verificare numero e contenuto
del codice; il precedente Codice 14 non è stato automaticamente aggiornato.

## Build e verifiche

Il solo HTML ausiliario `client/public/anteprima-cornice.html` viene rigenerato
da questa cornice; il sorgente usa URL di produzione, l'anteprima usa
l'ambiente corrente. La direttiva di esclusione in `client/src/index.css`
impedisce ai testi della pagina autonoma di generare utility Tailwind
nell'app. Confrontata la build locale con quella pubblicata in produzione9019:
**37 file client identici su 38**; unico diverso `anteprima-cornice.html`.
I bundle JS/CSS dell'app conservano esattamente gli hash pubblicati.

Verificati: 6/6 scenari di controlli, icone, aree di tocco, schermo intero,
ricarica e isolamento; 2/2 scenari di conferma dell'altezza con iframe
sintetico. Schermi e touch sono emulati, non dispositivi fisici. Per ripetere
le prove vedere `tests/FEEDBACK-PRODOTTI.md`. Il controllo grafico segnala
pulsanti visivi inferiori a 40 px: il test specifico verifica l'estensione
reale dell'area toccabile a 44 px, come richiesto senza alterare l'aspetto.


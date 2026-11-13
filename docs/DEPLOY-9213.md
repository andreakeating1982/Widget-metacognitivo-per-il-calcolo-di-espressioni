# Baseline pubblicata 9213 — Widget metacognitivo

Deploy autorizzato **9213**, 13/11/2026 (ora italiana); sorgente funzionale
`95eaed5` (checkpoint "Completa i test della lettura accessibile"). Questa è
l'app di **espressioni**, non un risolutore di equazioni. La 9212 (condizioni
di segno) resta la baseline funzionale precedente.

## Lettura ad alta voce (ASCOLTO) — barra di accessibilità interna

Prima della 9213 la lettura escludeva i pulsanti e si poteva interrompere sui
testi lunghi; non pronunciava formule, decimali né periodici. Correzioni:

- **Testo e controlli**: legge i pulsanti e i collegamenti visibili con il
  loro nome accessibile (senza icone decorative), segnala i pulsanti non
  disponibili e le etichette e i valori dei campi (incluse le date).
- **Formule**: pronuncia le espressioni KaTeX e la notazione digitata senza
  svolgerle né risolverle: frazioni ("inizio frazione … fratto … fine
  frazione"), parentesi aperte/chiuse, potenze ("al quadrato", esponenti
  negativi e superiori a 12), radici con qualunque indice (inclusi negativi
  come −13), decimali con virgola ("due virgola zero cinque") e periodici
  espliciti ("periodo … fine periodo").
- **Frazione impilata** di `FractionDisplay` resa leggibile con `role="math"`
  e `aria-label` "numeratore fratto denominatore".
- **Contenuti nascosti mai letti**: elementi con `hidden`, `inert`,
  `aria-hidden`, `sr-only` o non visibili; la risposta del box viene letta
  solo se lo studente ha aperto MOSTRA SOLUZIONE.
- **Robustezza**: lettura in segmenti sequenziali con pause naturali; STOP e
  il cambio di pagina interrompono la coda; nascondere la soluzione interrompe
  la lettura in corso (`ascolto:contenuto-cambiato`).

## Verifiche

- Suite completa isolata (database escluso, archivi simulati): **1.611 test
  superati, 28 saltati** (137 file di test).
- 30 test dedicati alla pronuncia matematica (decimali, periodici, radici con
  indice negativo, frazioni annidate, colori, spazi nei comandi LaTeX).
- Collaudo end-to-end nella cornice reale su desktop e telefono simulato, con
  post e app sulla stessa origine e su origini diverse: 21–22 controlli per
  scenario superati; la voce non legge il resto del post e non avvia nulla.
- Bundle di produzione verificato dopo il deploy (`index-DwZngAFT.js`,
  `index-CTH_tEWo.css`): contiene le nuove stringhe di lettura e l'arresto.

## Limiti e invarianti

- La voce dipende dal dispositivo; l'app seleziona solo voci italiane
  disponibili e non ne forza una straniera.
- ASCOLTO resta distinta dagli screen reader (NVDA, JAWS, VoiceOver,
  TalkBack), che usano gli stessi nomi accessibili.
- Nessuna modifica alla cornice Blogger, ai dati, alle sessioni né alla
  didattica: nessuna soluzione anticipata.
- La cornice dinamica resta identica al post MATEMATICA del 7/11/2026.

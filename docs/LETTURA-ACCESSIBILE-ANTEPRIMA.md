# Lettura ad alta voce nella cornice — rilascio 9213

Questa modifica riguarda la barra di accessibilità **interna all'app** ed è
pubblicata con il deploy 9213 (vedi `docs/DEPLOY-9213.md`). La cornice Blogger
non è stata modificata; l'app incorporata può essere letta anche quando il post
e l'app hanno origini diverse. La voce non legge il resto del post.

## Modifica

- ASCOLTO legge i comandi e i collegamenti visibili, con nome accessibile e
  indicazione dei pulsanti non disponibili; legge etichette e valori dei campi.
- Le formule KaTeX, la frazione impilata di `FractionDisplay` e la notazione
  matematica digitata sono pronunciate senza eseguire calcoli. Sono distinte
  parentesi, frazioni e relativo termine, radici e indici, esponenti, decimali
  con virgola e periodici espliciti.
- Sono esclusi i contenuti nascosti, i campi password/file e il testo `sr-only`;
  restano disponibili agli screen reader gli elementi previsti per loro. La
  soluzione del box viene letta solo quando esplicitamente mostrata.
- La lettura è suddivisa in segmenti brevi trasmessi in sequenza. Stop, cambio
  pagina e apertura/chiusura della soluzione fermano la lettura in corso.
- L'aspetto, la logica di calcolo, le sessioni, il PDF e l'HTML Blogger restano
  invariati; nessuna scrittura sui dati è necessaria.

## Verifica ripetibile

1. `pnpm check` e `pnpm exec vitest run --root .`.
2. Avviare il server con `DATABASE_URL=''` e `WIDGET_STORAGE_DIR` in una
   cartella di test separata. Il file `tests/lettura-accessibile.e2e.mjs` usa
   Playwright facoltativo (`NODE_PATH` o modulo locale) e un Chromium disponibile;
   `QA_URL` e `QA_CHROMIUM` ne selezionano origine e binario.
3. Il test intercetta tutte le API, carica un esercizio fittizio e sostituisce la
   sola Web Speech API con un simulatore. Verifica pagine, cornice dello stesso
   sito e blog fittizio su altra origine, desktop e telefono simulato, formule,
   pulsanti, lettura lunga, Stop e protezione della soluzione. L'eventuale test
   di disponibilità della voce italiana reale è separato dalla simulazione.

La Web Speech API dipende dal dispositivo e dalle voci installate. La verifica
simulata controlla ciò che viene passato alla sintesi, non qualità e pronuncia
percepite: occorre una prova di ascolto sul telefono e sul browser effettivi.
Nessuna certificazione di accessibilità o prova con screen reader fisici è
implicata. L'anteprima non modifica automaticamente l'app in produzione.


/* Diagnosi isolata: quali costruttori riconoscono l'espressione della foto.
 * Solo analisi strutturale: NESSUN risultato calcolato né mostrato. */
import {
  costruisciCatenaEsatta,
  costruisciRadicaliLetterali,
  costruisciRadiciNesime,
} from "../server/guida-radicali";
import { normalizeInput, parseExpression, printLatex } from "../client/src/lib/espressioni";

/* forme plausibili che l'OCR/tastiera può produrre per la foto */
const forme = [
  "√((a^2-1)/3):∛(3a+3)",
  "\\sqrt{(a^2-1)/3}:\\sqrt[3]{3a+3}",
  "√((a²−1)/3) : ∛(3a+3)",
];

for (const f of forme) {
  let ok = true;
  let latex = "";
  try {
    const ast = parseExpression(normalizeInput(f));
    latex = printLatex(ast);
  } catch (e) {
    ok = false;
  }
  console.log("FORMA:", f);
  console.log("  parse:", ok ? `OK → ${latex}` : "FALLITO");
  if (ok) {
    const a = costruisciRadiciNesime(f);
    const b = costruisciRadicaliLetterali(f);
    const c = costruisciCatenaEsatta(f);
    console.log("  radiciNesime:", a ? "riconosciuta" : "null");
    console.log("  radicaliLetterali:", b ? "riconosciuta" : "null");
    console.log("  catenaEsatta:", c ? "riconosciuta" : "null");
  }
}

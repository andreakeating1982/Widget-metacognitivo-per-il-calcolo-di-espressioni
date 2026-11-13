/** haContoPendente sulle forme LEGITTIME di un risultato finale */
import { haContoPendente } from "./client/src/lib/progressiveExpression";

const forme = [
  "14", "0,5", "3/4", "1/2", "2/9", "11/9", "1/90", "6/9", "10/4",
  "\\sqrt{2}", "2\\sqrt{3}", "-3/4", "1/54", "5/3", "0,0\\overline{1}",
  "\\dfrac{5}{3}", "2+3", "\\dfrac{10\\left(7x-12\\right)}{9\\sqrt{10}\\left(x-1\\right)\\left(x-2\\right)\\left(x+1\\right)^{2}}",
];
for (const f of forme) console.log(f, "→ pendente:", haContoPendente(f));

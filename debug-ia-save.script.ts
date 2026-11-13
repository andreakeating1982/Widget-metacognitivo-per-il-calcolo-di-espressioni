/** Salva la risposta IA reale per l'espressione della foto (senza ripara). */
import { it } from "vitest";
import { canonizzaEspressione, costruisciEsercizioConIA } from "./server/costruisci";
import { writeFileSync } from "node:fs";

const ESP = "\\dfrac{\\sqrt[-3]{x^{3}-3x^{2}+3x-1}\\cdot 1,\\overline{6}+\\left(\\sqrt[4]{x^{4}-8x^{3}+24x^{2}-32x+16}\\right)^{-1}\\cdot 0,\\overline{6}}{\\sqrt[-2]{0,0\\overline{1}}\\cdot\\left(x^{2}+2x+1\\right)\\cdot 0,1}";

it("salva la risposta IA", async () => {
  const esp = canonizzaEspressione(ESP);
  const out = await costruisciEsercizioConIA(esp, () => {});
  writeFileSync("/tmp/ia-raw.json", JSON.stringify(out), "utf-8");
  console.log("SALVATO, tentativi:", out.tentativi);
}, 240000);

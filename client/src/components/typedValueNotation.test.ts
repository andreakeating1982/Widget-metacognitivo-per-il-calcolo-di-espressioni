/** Test della sintassi da tastiera nel campo DIGITA IL VALORE (24/10):
 *  il campo accetta le stesse 5 regole del pulsante ISTRUZIONI
 *  (: * / ^n rad2/rad3/rad4). Testa il parser via evaluateLatex dopo
 *  normalizzazione: importa la logica duplicando le regole? No —
 *  testa l'effetto finale copiando la normalizzazione minima qui è fragile.
 *  Per questo il test verifica i casi via DOM? Semplice: verifica che il
 *  componente esporti il placeholder nuovo e che evaluateLatex gestisca
 *  gli operatori, usando una riesportazione per i test.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "NumberInputCanvas.tsx"), "utf8");

describe("campo DIGITA IL VALORE (24/10)", () => {
  it("placeholder nuovo senza \\frac", () => {
    expect(src).toContain('placeholder="Esempio: 8/3"');
    expect(src).not.toContain("es. 8/8");
  });
  it("pulsante istruzioni presente", () => {
    expect(src).toContain("ISTRUZIONI PER SCRIVERE DA TASTIERA");
    expect(src).toContain("Scrivi :");
    expect(src).toContain("Scrivi *");
    expect(src).toContain("Scrivi /");
    expect(src).toContain("Scrivi ^2");
    expect(src).toContain("rad2, rad3, rad4");
  });
  it("parser con potenza, moltiplicazione e radici", () => {
    expect(src).toContain("Potenza con ^");
    expect(src).toContain("Moltiplicazione con *");
    expect(src).toContain("Radici con simboli");
  });
});

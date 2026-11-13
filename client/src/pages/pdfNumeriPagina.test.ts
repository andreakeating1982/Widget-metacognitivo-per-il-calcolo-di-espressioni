import { describe, expect, it } from "vitest";
import { involucroPdf } from "./EsercizioFrazioni";

/* (12/11) NUMERI DI PAGINA nel PDF scaricabile: solo quando il PDF va su
   più pagine, il numero compare in basso al centro (margin-box
   @bottom-center di @page con counter(page), Chrome 131+). */
describe("involucroPdf — numeri di pagina (solo PDF multi-pagina)", () => {
  const html = involucroPdf("<div>corpo</div>");

  it("contiene il foglio stile dei numeri di pagina limitato alla stampa", () => {
    expect(html).toContain('id="numeri-pagina" media="print"');
    expect(html).toContain("@page{@bottom-center{content:counter(page)");
    /* in basso AL CENTRO: solo il margin-box bottom-center, nessun altro */
    expect(html).not.toContain("@top-center");
    expect(html).not.toContain("@bottom-left");
  });

  it("lo script misura l'altezza utile di una pagina A4 (26,3 cm) prima di stampare", () => {
    expect(html).toContain("(29.7-1.8-1.6)*96/2.54");
    expect(html).toContain("window.print()");
  });

  it("i numeri partono SPENTI e si accendono solo se il contenuto supera una pagina", () => {
    /* stato predefinito spento via JS (l'attributo in markup non basta) */
    expect(html).toContain("if(foglio)foglio.disabled=true;");
    /* l'accensione avviene SOLO dentro il ramo multipagina */
    const acceso = "if(h>utile&&foglio)foglio.disabled=false;";
    expect(html).toContain(acceso);
    const dopoRamo = html.slice(html.indexOf(acceso));
    /* dopo l'accensione c'è subito la stampa: niente altri percorsi che
       possano accendere i numeri fuori dalla misura */
    expect(dopoRamo.indexOf("window.print()")).toBeGreaterThan(-1);
  });

  it("funziona identica per il PDF parziale e per il completo (stesso involucro)", () => {
    const corpoAltro = involucroPdf("<header>intestazione</header><div>righe</div>");
    expect(corpoAltro).toContain('id="numeri-pagina" media="print"');
    expect(corpoAltro).toContain("content:counter(page)");
  });
});

import { initHeightSync } from "./lib/heightSync";
import { createRoot } from "react-dom/client";
import App from "./App";
// Usa il CSS e i font della stessa versione KaTeX del motore (0.18.1).
// Un CSS 0.16.x lasciava la barretta dei periodici larga zero pixel.
import "katex/dist/katex.min.css";
import "./index.css";

// Sincronizza l'altezza dell'app con la cornice iframe che la ospita
// (protocollo labvisivo:height, usato dagli embed su Blogger/siti).
// Chiamato PRIMA del render: imposta la classe `lf-embedded` su <html>
// (niente 100vh in iframe) evitando un flash di layout.
initHeightSync();

createRoot(document.getElementById("root")!).render(<App />);

import { initHeightSync } from "./lib/heightSync";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Sincronizza l'altezza dell'app con la cornice iframe che la ospita
// (protocollo labvisivo:height, usato dagli embed su Blogger/siti).
// Chiamato PRIMA del render: imposta la classe `lf-embedded` su <html>
// (niente 100vh in iframe) evitando un flash di layout.
initHeightSync();

createRoot(document.getElementById("root")!).render(<App />);

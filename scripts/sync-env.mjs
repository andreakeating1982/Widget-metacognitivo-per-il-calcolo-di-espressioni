/**
 * sync-env.mjs — legge la chiave API dal .env del progetto e la "cotta" nel
 * bundle del SOLO server (shared/env.generated.ts). Il file generato NON è
 * mai incluso nel bundle del browser: la chiave non raggiunge il client.
 * Se la variabile non è impostata, il file viene generato vuoto (l'app
 * mostra l'avviso «chiave non configurata» invece di rompersi).
 * (Adattato da AUDIO-MATEMATICI scripts/sync-env.mjs — giro fix IA 24/10/2026)
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env");

const aliases = ["EASY_PEASY_API_KEY", "EASY_PEASY_AI_API_KEY", "OPENAI_API_KEY", "AI_API_KEY"];
let key = "";

// 1) Prima dalle variabili d'ambiente del processo di build (piattaforma/CI).
for (const name of aliases) {
  const v = process.env[name];
  if (v && v.trim()) { key = v.trim(); break; }
}
// 2) Fallback: dal file .env del progetto.
if (!key && existsSync(envPath)) {
  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const name of aliases) {
    const line = lines.find((l) => l.startsWith(`${name}=`));
    if (line) {
      const value = line.slice(name.length + 1).trim().replace(/^["']|["']$/g, "");
      if (value) {
        key = value;
        break;
      }
    }
  }
}

const generated = `/**
 * GENERATO AUTOMATICAMENTE da scripts/sync-env.mjs al build — non modificare.
 * Contiene SOLO la chiave usata dal server (mai esposta al browser).
 */
export const BAKED_EASY_PEASY_API_KEY: string = ${JSON.stringify(key)};
`;
writeFileSync(path.join(root, "shared", "env.generated.ts"), generated);
console.log(`[sync-env] chiave ${key ? "configurata (bundle server)" : "ASSENTE: l'app avviserà che l'IA non è attiva"}`);

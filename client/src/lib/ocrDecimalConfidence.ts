/** Segnala disaccordi tra le due letture OCR senza indovinare il periodo.
 * La seconda lettura resta quella mostrata: quando le cifre o l'estensione
 * della barretta differiscono, «?» obbliga a controllare e correggere.
 * L'accordo non garantisce che la lettura sia corretta. */
import { canonicalizePeriodicNotation } from "./periodicNotation";

type Decimal = { value: string; end: number };

function decimals(raw: string): { text: string; values: Decimal[] } {
  const input = (raw ?? "").replace(/(\d)\.(?=\d)/g, "$1,");
  const text = canonicalizePeriodicNotation(input);
  const values: Decimal[] = [];
  const re = /\d+,(?:\d+(?:\\overline\{\d+\})?|\\overline\{\d+\})/g;
  for (const m of text.matchAll(re)) values.push({ value: m[0], end: (m.index ?? 0) + m[0].length });
  return { text, values };
}

export function segnalaDecimaliDiscordanti(prima: string, seconda: string): { text: string; discordanti: boolean } {
  if (!prima || !seconda) return { text: seconda, discordanti: false };
  const a = decimals(prima), b = decimals(seconda);
  if (!a.values.length && !b.values.length) return { text: seconda, discordanti: false };
  // Con un numero diverso di decimali non possiamo associare con sicurezza
  // le posizioni: segnaliamo l'incertezza invece di inventare l'abbinamento.
  if (a.values.length !== b.values.length) {
    return { text: b.text.includes("?") ? b.text : `${b.text}?`, discordanti: true };
  }
  const ends = b.values.filter((v, i) => v.value !== a.values[i].value).map(v => v.end);
  if (!ends.length) return { text: seconda, discordanti: false };
  let text = b.text;
  // Inserisco da destra, così gli indici degli altri numeri restano validi.
  for (const end of ends.reverse()) {
    if (text[end] !== "?") text = `${text.slice(0, end)}?${text.slice(end)}`;
  }
  return { text, discordanti: true };
}


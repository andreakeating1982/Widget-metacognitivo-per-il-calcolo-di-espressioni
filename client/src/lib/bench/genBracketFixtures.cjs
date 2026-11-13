// Genera `src/lib/printedBracket.fixtures.ts`: maschere ASCII di ( ) [ ] { } | renderizzate con font
// reali (DejaVu Sans, Liberation Serif) a cifra alta 28 px, anti-aliasing 3×, soglia 128 — le stesse
// condizioni del banco `bracketBench.test.ts` — così il test unitario non dipende da nessun canvas.
//
//   CANVAS_MODULE=/percorso/@napi-rs/canvas/index.js node src/lib/bench/genBracketFixtures.cjs
const fs = require("node:fs");
const path = require("node:path");
const nc = require(process.env.CANVAS_MODULE || "@napi-rs/canvas");

const FONTS = {
  "DejaVu Sans": "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  "Liberation Serif": "/usr/share/fonts/truetype/liberation2/LiberationSerif-Regular.ttf",
};
for (const [f, p] of Object.entries(FONTS)) nc.GlobalFonts.registerFromPath(p, f);

const DH = 28;
const SS = 3;
const px = Math.round((DH / 0.72) * SS);
const chars = ["(", ")", "[", "]", "{", "}", "|"];
const out = {};
for (const fam of Object.keys(FONTS)) {
  out[fam] = {};
  for (const ch of chars) {
    const W = Math.round(px * 1.2);
    const H = Math.round(px * 1.8);
    const cv = nc.createCanvas(W, H);
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#000";
    ctx.font = `${px}px "${fam}"`;
    ctx.fillText(ch, Math.round(px * 0.3), Math.round(H * 0.72));
    const d = ctx.getImageData(0, 0, W, H).data;
    const w = Math.floor(W / SS);
    const h = Math.floor(H / SS);
    const g = new Float32Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let a = 0;
        for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) a += d[((y * SS + j) * W + (x * SS + i)) * 4];
        g[y * w + x] = a / (SS * SS);
      }
    let x0 = w, x1 = -1, y0 = h, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (g[y * w + x] < 128) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const rows = [];
    for (let y = y0; y <= y1; y++) {
      let s = "";
      for (let x = x0; x <= x1; x++) s += g[y * w + x] < 128 ? "#" : ".";
      rows.push(s);
    }
    out[fam][ch] = rows;
  }
}

let ts = `// GENERATO da bench/genBracketFixtures.cjs — non modificare a mano.
// Maschere ASCII (# = inchiostro) di parentesi renderizzate con font reali, cifra alta ${DH} px.
export const BRACKET_FIXTURES: Record<string, Record<string, string[]>> = ${JSON.stringify(out, null, 1)};
`;
fs.writeFileSync(path.join(__dirname, "..", "printedBracket.fixtures.ts"), ts);
console.log("scritto", Object.keys(out).map((f) => `${f}: ${Object.values(out[f]).map((r) => r.length + "x" + r[0].length).join(" ")}`).join(" | "));

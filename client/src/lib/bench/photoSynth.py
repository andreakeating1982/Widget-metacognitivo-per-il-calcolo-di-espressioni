#!/usr/bin/env python3
"""
Genera righe di ESPRESSIONI STAMPATE «da foto» con la verità nota, per misurare la pipeline OCR
delle foto (banco `photoBench.test.ts`).

Realismo: carattere sans/serif, esponenti rimpiccioliti e rialzati, parentesi tonde/quadre/graffe
annidate, `·` per il per e `:` per la divisione, bassa risoluzione (cifre alte 14–40 px come in
una foto da telefono ritagliata), sfocatura, rumore, rotazione, luce irregolare, JPEG.

Uso:  python3 photoSynth.py OUT_DIR [N_ESPRESSIONI=36] [SEME=7]
Scrive OUT_DIR/img_XXXX.png e OUT_DIR/specs.json (lista di {file, box, truth, meta}).
La verità usa: `^n` esponente, `*` per, `:` divisione, `-` meno (come `comparable()` del banco).
"""
import io
import json
import math
import os
import random
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

FONTS = {
    "sans": "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
    "dejavu": "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "serif": "/usr/share/fonts/truetype/liberation2/LiberationSerif-Regular.ttf",
}

# ---------------------------------------------------------------- espressioni ---------------


def gen_number(rng: random.Random) -> str:
    r = rng.random()
    if r < 0.62:
        return str(rng.randint(2, 9))
    if r < 0.93:
        return str(rng.randint(10, 99))
    return str(rng.choice([100, 125, 200, 144, 256, 1000]))


def gen_atom(rng: random.Random) -> list:
    """lista di token (testo, è_esponente)"""
    n = gen_number(rng)
    if rng.random() < 0.38:
        e = rng.choice(["2", "2", "2", "3", "3", "4", "0", "1"])
        return [(n, False), (e, True)]
    return [(n, False)]


OPS = [("+", "+"), ("-", "-"), ("*", "·"), (":", ":")]

# (19/10) FRAZIONI IMPILATE: con FRACS=1 una parte degli atomi diventa una
# frazione impilata (numeratore, linea, denominatore) — il caso segnalato
# «con le foto è difficile anche il riconoscimento delle frazioni stesse».
FRAC_P = float(os.environ.get("FRACS", "0"))


def gen_frac(rng: random.Random) -> tuple[str, str]:
    n = str(rng.randint(1, 9)) if rng.random() < 0.7 else str(rng.randint(10, 14))
    d = str(rng.randint(2, 9)) if rng.random() < 0.7 else str(rng.randint(10, 14))
    return (n, d)


def gen_expr(rng: random.Random, depth: int, max_depth: int) -> list:
    """sequenza di token: atomi e gruppi separati da operatori"""
    n_terms = rng.choice([2, 2, 3, 3, 4]) if depth == 0 else rng.choice([1, 2, 2, 3])
    out: list = []
    for i in range(n_terms):
        if i > 0:
            out.append(("op", rng.choice(OPS)))
        if depth < max_depth and rng.random() < (0.55 if depth == 0 else 0.35):
            kinds = ["(", "[", "{"]
            # tonde dentro quadre dentro graffe (regola di scuola)
            allowed = kinds[max(0, 2 - (max_depth - depth)) :] if False else kinds
            k = ["(", "[", "{"][min(2, max_depth - depth - 0)] if depth < max_depth else "("
            # la parentesi più interna è tonda, poi quadra, poi graffa
            level = max_depth - depth
            k = {1: "(", 2: "[", 3: "{"}.get(level, "(")
            close = {"(": ")", "[": "]", "{": "}"}[k]
            out.append(("open", k))
            out.extend(gen_expr(rng, depth + 1, max_depth))
            out.append(("close", close))
            if close == ")" and rng.random() < 0.25:
                out.append(("exp", rng.choice(["2", "2", "3"])))
        else:
            if FRAC_P > 0 and rng.random() < FRAC_P:
                out.append(("frac", gen_frac(rng)))
            else:
                for t, is_exp in gen_atom(rng):
                    out.append(("exp", t) if is_exp else ("num", t))
    return out


def tokens_to_truth(tokens: list) -> str:
    s = ""
    for kind, val in tokens:
        if kind == "op":
            s += val[0]
        elif kind == "exp":
            s += "^" + val
        elif kind == "frac":
            s += val[0] + "\u2044" + val[1]
        else:
            s += val
    return s + "="


# ------------------------------------------------------------------ rendering ---------------


def render_line(tokens: list, font_path: str, digit_h: float, rng: random.Random) -> Image.Image:
    """Disegna la riga in grigio a 4× e la riduce: antialiasing come un vero scatto."""
    SS = 4
    em = digit_h / 0.72  # altezza cifra ≈ 0,72 em
    size = int(round(em * SS))
    f_main = ImageFont.truetype(font_path, size)
    f_exp = ImageFont.truetype(font_path, int(round(size * 0.62)))
    f_br = ImageFont.truetype(font_path, int(round(size * 1.14)))
    pad = int(0.9 * size)
    W = int(len(tokens) * size * 0.95) + 2 * pad + size * 4
    H = int(size * 2.3)
    base = int(H * 0.68)
    img = Image.new("L", (W, H), 255)
    d = ImageDraw.Draw(img)
    x = pad
    gap = 0.07 * size
    sp = 0.30 * size
    prev = None
    for kind, val in tokens:
        if kind == "num":
            d.text((x, base), val, font=f_main, fill=0, anchor="ls")
            x += d.textlength(val, font=f_main) + gap
        elif kind == "frac":
            # frazione impilata: linea a metà cifra, num sopra, den sotto
            n, den = val
            bar_y = base - 0.55 * size
            nw = d.textlength(n, font=f_main)
            dw = d.textlength(den, font=f_main)
            bw = 1.15 * max(nw, dw) + 0.1 * size
            d.text((x + (bw - nw) / 2, bar_y - 0.12 * size), n, font=f_main, fill=0, anchor="ls")
            d.text((x + (bw - dw) / 2, bar_y + 0.85 * size), den, font=f_main, fill=0, anchor="ls")
            d.line([(x, bar_y), (x + bw, bar_y)], fill=0, width=max(1, int(round(0.06 * size))))
            x += bw + gap
        elif kind == "exp":
            d.text((x + 0.02 * size, base - 0.46 * size), val, font=f_exp, fill=0, anchor="ls")
            x += d.textlength(val, font=f_exp) + gap
        elif kind in ("open", "close"):
            if kind == "open" and prev in ("num", "close", "exp"):
                x += 0.06 * size
            d.text((x, base + 0.05 * size), val, font=f_br, fill=0, anchor="ls")
            x += d.textlength(val, font=f_br) + gap * 1.2
        elif kind == "op":
            ch = val[1]
            x += sp * 0.45
            if ch == "-":
                ch = "\u2212"
            d.text((x, base), ch, font=f_main, fill=0, anchor="ls")
            x += d.textlength(ch, font=f_main) + sp * 0.55
        prev = kind
    # «=» finale
    x += sp * 0.3
    d.text((x, base), "=", font=f_main, fill=0, anchor="ls")
    x += d.textlength("=", font=f_main)
    # taglio sull'inchiostro (+ margine) e riduzione
    arr = np.array(img)
    ys, xs = np.where(arr < 128)
    img = img.crop((max(0, xs.min() - pad // 2), max(0, ys.min() - pad // 2), xs.max() + pad // 2, ys.max() + pad // 2))
    return img.resize((max(1, img.width // SS), max(1, img.height // SS)), Image.LANCZOS)


def degrade(line: Image.Image, rng: random.Random, level: int = 1) -> Image.Image:
    """sfondo carta + luce irregolare + rotazione + sfocatura + rumore + JPEG"""
    w, h = line.size
    margin_x = rng.randint(6, 22)
    margin_y = rng.randint(6, 16)
    W, H = w + 2 * margin_x, h + 2 * margin_y
    paper = np.full((H, W), rng.uniform(222, 248), dtype=np.float32)
    # luce irregolare: gradiente lineare + onda lenta
    gx = np.linspace(-1, 1, W)[None, :] * rng.uniform(-14, 14)
    gy = np.linspace(-1, 1, H)[:, None] * rng.uniform(-10, 10)
    paper = paper + gx + gy
    ink = 255.0 - np.array(line, dtype=np.float32)  # 0..255, 255 = inchiostro
    canvas = paper.copy()
    region = canvas[margin_y : margin_y + h, margin_x : margin_x + w]
    canvas[margin_y : margin_y + h, margin_x : margin_x + w] = region * (1 - ink / 255.0 * rng.uniform(0.78, 0.97))
    img = Image.fromarray(np.clip(canvas, 0, 255).astype(np.uint8))
    # livello 0 = pulito, 1 = foto normale, 2 = foto difficile (mossa, compressa, inclinata)
    rot = (0.4, 0.9, 1.6)[level]
    ang = rng.uniform(-rot, rot)
    img = img.rotate(ang, resample=Image.BICUBIC, expand=True, fillcolor=int(paper.mean()))
    if level == 2:  # leggera inclinazione prospettica (shear)
        sh = rng.uniform(-0.03, 0.03)
        img = img.transform(img.size, Image.AFFINE, (1, sh, -sh * img.height / 2, 0, 1, 0), resample=Image.BICUBIC, fillcolor=int(paper.mean()))
    blur = {0: (0.35, 0.6), 1: (0.55, 0.95), 2: (0.9, 1.35)}[level]
    img = img.filter(ImageFilter.GaussianBlur(rng.uniform(*blur)))
    nz = {0: (1, 3), 1: (3, 6), 2: (6, 10)}[level]
    a = np.array(img, dtype=np.float32) + np.random.RandomState(rng.randint(0, 10**6)).normal(0, rng.uniform(*nz), (img.height, img.width))
    img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    buf = io.BytesIO()
    q = {0: (70, 90), 1: (50, 80), 2: (28, 50)}[level]
    img.convert("RGB").save(buf, "JPEG", quality=rng.randint(*q))
    buf.seek(0)
    return Image.open(buf).convert("RGB")


def main() -> None:
    out_dir = sys.argv[1]
    n = int(sys.argv[2]) if len(sys.argv) > 2 else 36
    seed = int(sys.argv[3]) if len(sys.argv) > 3 else 7
    os.makedirs(out_dir, exist_ok=True)
    rng = random.Random(seed)
    specs = []
    heights = [14, 19, 27, 38]  # altezza cifra in px: foto lontana … vicina
    for i in range(n):
        max_depth = rng.choice([1, 2, 2, 3])
        tokens = gen_expr(rng, 0, max_depth)
        truth = tokens_to_truth(tokens)
        if len(truth) < 9 or len(truth) > 46:
            continue
        font = rng.choice(list(FONTS))
        dh = rng.choice(heights)
        line = render_line(tokens, FONTS[font], dh, rng)
        level = rng.choice([0, 1, 1, 2])
        img = degrade(line, rng, level)
        fn = os.path.join(out_dir, f"img_{i:04d}.png")
        img.save(fn)
        specs.append({"file": fn, "box": None, "truth": truth, "meta": {"font": font, "digit_h": dh, "level": level, "size": list(img.size)}})
    json.dump(specs, open(os.path.join(out_dir, "specs.json"), "w"), ensure_ascii=False, indent=1)
    print(f"{len(specs)} righe in {out_dir}")


if __name__ == "__main__":
    main()

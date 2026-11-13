#!/usr/bin/env python3
"""Varianti REALISTICHE delle tre righe della foto fixture: ritagli con margini diversi, scale
0,5–2,5 e ricompressione JPEG, per misurare la robustezza dell'OCR delle foto.

    python3 photoVariants.py [cartella_uscita=/tmp/real_variants]
    PHOTO=1 PHOTO_SPEC_FILE=/tmp/real_variants/specs.json CANVAS_MODULE=… npx vitest run src/lib/bench/photoBench.test.ts
"""
import io, json, os, random, sys
from PIL import Image

out = sys.argv[1] if len(sys.argv) > 1 else "/tmp/real_variants"
os.makedirs(out, exist_ok=True)
here = os.path.dirname(os.path.abspath(__file__))
im = Image.open(os.path.join(here, "fixtures", "foto-esercizi.png")).convert("RGB")
W, H = im.size
rng = random.Random(5)
rows = {
    "A": ((48, 140, 618, 189), "(2+5^2):(4^2-2*5-3)+48:(6^2-2^3)="),
    "B": ((47, 233, 618, 287), "{(6^2:4-3^2*8^0)^2+10^2-[5*3^2+(100:25)^2]}="),
    "C": ((48, 327, 618, 381), "9^2-{3^3*2+5*[7-(4^2-3*2^2):2]-3^1}+1="),
}
specs = []
for k, (box, truth) in rows.items():
    for s in [0.5, 0.65, 0.8, 1.0, 1.3, 1.8, 2.5]:
        for rep in range(2):
            x0, y0, x1, y1 = box
            j = lambda: rng.randint(0, 7)
            c = im.crop((max(0, x0 - j()), max(0, y0 - j()), min(W, x1 + j()), min(H, y1 + j())))
            c = c.resize((max(8, int(c.width * s)), max(8, int(c.height * s))), Image.LANCZOS)
            if rep == 1:  # ricompressione JPEG
                buf = io.BytesIO(); c.save(buf, "JPEG", quality=rng.randint(45, 80)); buf.seek(0); c = Image.open(buf).convert("RGB")
            fn = os.path.join(out, f"v_{k}_{s}_{rep}.png")
            c.save(fn)
            specs.append({"file": fn, "box": None, "truth": truth, "meta": {"row": k, "scale": s, "jpeg": rep, "size": list(c.size)}})
json.dump(specs, open(os.path.join(out, "specs.json"), "w"), indent=1)
print(len(specs), "varianti in", out)

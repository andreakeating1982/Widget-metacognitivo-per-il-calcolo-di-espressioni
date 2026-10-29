#!/usr/bin/env python3
"""Lancia trace.test.ts per le letture di un giro del banco.
   python3 trace.py /tmp/bench1 P2-02:normal P5-02:normal [--all]   # solo le guaste (grezzo giusto, pipeline sbagliata); --all = anche le altre
"""
import json, os, subprocess, sys
# cartella `client/` ricavata dalla posizione di questo file (client/src/lib/bench/trace.py): niente percorsi fissi
CLIENT_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
CANVAS = os.environ.get("CANVAS_MODULE", "/home/user/ocr-bench/node_modules/@napi-rs/canvas/index.js")
prefix = sys.argv[1]
rows = []
for i in (0, 1):
    try: rows += json.load(open(f"{prefix}_{i}.json"))
    except FileNotFoundError: pass
only_all = "--all" in sys.argv
for spec in [a for a in sys.argv[2:] if not a.startswith("--")]:
    rid, st = spec.split(":")
    for r in rows:
        if r["id"] != rid or r["style"] != st: continue
        if not only_all and r["ok"]: continue
        env = dict(os.environ, TRACE="1", TRACE_EXPR=r["expr"], TRACE_STYLE=st, TRACE_SEED=str(r["seed"]),
                   CANVAS_MODULE=CANVAS)
        out = subprocess.run(["npx", "vitest", "run", "src/lib/bench/trace.test.ts"], cwd=CLIENT_DIR,
                             env=env, capture_output=True, text=True, timeout=120)
        print(f"=== {rid} {st} seed {r['seed']}  vero «{r['expr']}»  pipeline «{r['got']}»  modello «{r.get('raw','')}»")
        for l in (out.stdout + out.stderr).splitlines():
            if l.startswith(("TRACE-FILE", "parentesi", "puntini", "al modello")): print("  " + l)

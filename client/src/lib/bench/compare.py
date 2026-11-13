#!/usr/bin/env python3
"""Confronto fra due giri del banco di prova (handBench.test.ts).

Uso:
    python3 compare.py /tmp/bench0 /tmp/bench1 [--fails]

Ogni argomento è un PREFISSO: legge <prefisso>_0.json e <prefisso>_1.json
(i due shard). Stampa, per classe di casi e per stile di scrittura, la
percentuale di letture esatte della pipeline nei due giri, più:
  GUASTA = il modello da solo aveva letto giusto e la pipeline ha rovinato;
  SALVA  = il modello da solo sbagliava e la pipeline ha corretto.
Con --fails elenca le letture che sono PEGGIORATE (giuste prima, sbagliate ora).
"""
import json
import sys
from collections import defaultdict


def load(prefix):
    rows = []
    for i in (0, 1):
        try:
            rows += json.load(open(f"{prefix}_{i}.json"))
        except FileNotFoundError:
            pass
    return {(r["id"], r["style"], r["seed"]): r for r in rows}


def pct(a, b):
    return f"{100 * a / b:4.0f}%" if b else "   — "


def main():
    a = load(sys.argv[1])
    b = load(sys.argv[2])
    keys = sorted(set(a) & set(b))
    print(f"letture confrontabili: {len(keys)} (baseline {len(a)}, nuovo {len(b)})")
    by = defaultdict(lambda: defaultdict(int))
    for k in keys:
        cls = a[k]["cls"]
        # la lettura GREZZA del modello non dipende dal codice: se un giro non la
        # riporta (baseline storica), si prende dall'altro giro (stessi tratti, stesso seed)
        raw_ok = a[k].get("rawOk", b[k].get("rawOk", False))
        raw_ok_b = b[k].get("rawOk", raw_ok)
        for tag, r, ro in (("a", a[k], raw_ok), ("b", b[k], raw_ok_b)):
            by[cls][f"{tag}_n"] += 1
            by[cls][f"{tag}_ok"] += 1 if r["ok"] else 0
            by[cls][f"{tag}_raw"] += 1 if ro else 0
            by[cls][f"{tag}_bad"] += 1 if (ro and not r["ok"]) else 0
            by[cls][f"{tag}_save"] += 1 if (not ro and r["ok"]) else 0
    print(f"{'classe':6} {'n':>4} | {'prima':>6} {'ora':>6} | {'solo-modello':>12} | {'guasta prima→ora':>16} | {'salva prima→ora':>15}")
    tot = defaultdict(int)
    for cls in sorted(by):
        d = by[cls]
        for kk, v in d.items():
            tot[kk] += v
        print(
            f"{cls:6} {d['a_n']:4d} | {pct(d['a_ok'], d['a_n']):>6} {pct(d['b_ok'], d['b_n']):>6} | "
            f"{pct(d['a_raw'], d['a_n']):>12} | {d['a_bad']:7d} → {d['b_bad']:<6d} | {d['a_save']:6d} → {d['b_save']:<5d}"
        )
    d = tot
    print(
        f"{'TOT':6} {d['a_n']:4d} | {pct(d['a_ok'], d['a_n']):>6} {pct(d['b_ok'], d['b_n']):>6} | "
        f"{pct(d['a_raw'], d['a_n']):>12} | {d['a_bad']:7d} → {d['b_bad']:<6d} | {d['a_save']:6d} → {d['b_save']:<5d}"
    )
    # per stile
    st = defaultdict(lambda: [0, 0, 0])
    for k in keys:
        s = a[k]["style"]
        st[s][0] += 1
        st[s][1] += 1 if a[k]["ok"] else 0
        st[s][2] += 1 if b[k]["ok"] else 0
    print("\nper stile:", "  ".join(f"{s}: {pct(v[1], v[0])} → {pct(v[2], v[0])}" for s, v in sorted(st.items())))
    better = [k for k in keys if not a[k]["ok"] and b[k]["ok"]]
    worse = [k for k in keys if a[k]["ok"] and not b[k]["ok"]]
    print(f"migliorate: {len(better)}   peggiorate: {len(worse)}")
    if "--fails" in sys.argv:
        for k in worse:
            print(f"  PEGGIORATA {k[0]:7} {k[1]:6} «{a[k]['expr']}»  prima «{a[k]['got']}»  ora «{b[k]['got']}»  (grezzo «{b[k]['raw']}»)")


if __name__ == "__main__":
    main()

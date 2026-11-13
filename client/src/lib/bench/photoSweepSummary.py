import json, glob, os, sys
for f in sorted(glob.glob('/tmp/sweep_*.json')):
    try:
        rs = json.load(open(f))
    except Exception as e:
        print(os.path.basename(f), 'in corso/errore'); continue
    ok = sum(1 for r in rs if r['ok'])
    n = len(rs)
    # varianti: escludi scala 0.5 dal conteggio «utile»
    extra = ''
    if 'var' in f:
        use = [r for r in rs if r['meta'].get('scale', 1) >= 0.65]
        extra = f"  (scala ≥0,65: {sum(1 for r in use if r['ok'])}/{len(use)})"
    print(f"{os.path.basename(f):28s} {ok}/{n} = {100*ok/n:.1f}%{extra}")

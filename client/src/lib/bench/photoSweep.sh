#!/bin/bash
# Misura il banco foto su due insiemi (sintetico e varianti reali) con una configurazione.
#   photoSweep.sh <etichetta> [json TUNE] [altezza obiettivo cifre px]
# Esempi:  photoSweep.sh base           → impostazioni dell'app
#          photoSweep.sh t60 '{}' 60    → stessa soglia, cifre portate a 60 px
# Serve:   CANVAS_MODULE (default /home/user/ocr-bench/node_modules/@napi-rs/canvas/index.js),
#          /tmp/synth/specs.json (photoSynth.py) e /tmp/real_variants/specs.json (photoVariants.py).
# Uscita:  /tmp/sweep_<etichetta>.{synth,var}.json e /tmp/sweep_<etichetta>.txt (riga riassuntiva).
L="$1"; T="${2:-{\}}"; H="${3:-0}"
CANVAS="${CANVAS_MODULE:-/home/user/ocr-bench/node_modules/@napi-rs/canvas/index.js}"
cd "$(dirname "$0")/../../.."
run() { # $1=file specifiche  $2=uscita json
  PHOTO=1 PHOTO_QUIET=1 PHOTO_TARGET_H="$H" PHOTO_TUNE="$T" PHOTO_OUT="$2" PHOTO_SPEC_FILE="$1" CANVAS_MODULE="$CANVAS" \
    timeout 1500 npx vitest run src/lib/bench/photoBench.test.ts 2>&1 | grep -E "PHOTO TOT" | cut -c1-80
}
S=$(run /tmp/synth/specs.json /tmp/sweep_$L.synth.json)
V=$(run /tmp/real_variants/specs.json /tmp/sweep_$L.var.json)
echo "$L tune=$T h=$H | sintetico: $S | varianti reali: $V" > /tmp/sweep_$L.txt

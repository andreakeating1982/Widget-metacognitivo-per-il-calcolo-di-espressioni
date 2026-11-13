#!/usr/bin/env python3
"""Genera test-impermeabile.html partendo dalla cornice dedicata v3.

Il test simula un blog con DUE istanze della stessa cornice dedicata + una
terza cornice «intrusa» (vecchio stile v2) che tenta il furto dell'iframe e
invia altezze false. Serve a verificare che ogni cornice v3 resti isolata.
"""
import pathlib

base = pathlib.Path(__file__).parent
dedicata = (base / "embed-espressioni-dedicata.html").read_text(encoding="utf-8")

header = """<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8">
<title>TEST impermeabilità cornice — 2 cornici + interferenza</title>
<style>
  body { font-family: Georgia, serif; background: #eee; margin: 0; padding: 20px; }
  h1 { text-align: center; font-size: 20px; }
  .post { background: #fff; border: 1px dashed #999; border-radius: 10px; margin: 20px auto; max-width: 860px; padding: 14px; }
  .post h2 { font-size: 15px; margin: 0 0 8px; color: #444; }
  #esito { position: fixed; top: 8px; right: 8px; background: #222; color: #0f0; font: 11px monospace; padding: 8px 12px; border-radius: 8px; max-width: 380px; white-space: pre-wrap; z-index: 999; }
</style>
</head>
<body>
<h1>🧪 Test impermeabilità — come sul blog (2 cornici + intruso)</h1>
<div id="esito">attendo verifiche…</div>

<div class="post">
  <h2>📄 Post 1 — cornice Espressioni Letterali (istanza A)</h2>
  <!-- ===== CORNICE A (v3 impermeabile) ===== -->
"""

post2 = """</div>

<div class="post">
  <h2>📄 Post 2 — cornice Espressioni Letterali (istanza B)</h2>
  <!-- ===== CORNICE B (v3 impermeabile) ===== -->
"""

intruso = """</div>

<div class="post">
  <h2>📄 Post 3 — cornice «intrusa» (vecchio stile, tenta il furto)</h2>
  <p>Questa terza «cornice» usa il <b>vecchio approccio v2</b> (id globali
  <code>lfIframe</code>) e prova a (1) agganciare l'iframe delle altre cornici
  e (2) inviare altezze <b>false</b> con <code>postMessage</code>. Le cornici
  A e B devono IGNORARLA del tutto.</p>
  <script>
    (function () {
      'use strict';
      // 1) Prova a rubare l'iframe con l'id globale vecchio stile (v2)
      var rubato = document.getElementById('lfIframe');
      if (rubato) {
        rubato.src = 'https://esempio-estraneo.example.com/';
        window.__furto = 'RIUSCITO (da ignorare: non deve succedere)';
      } else {
        window.__furto = 'FALLITO (id rinominate con token: corretto)';
      }
      // 2) Invia un'altezza falsa a tutta la pagina
      var falsi = 0;
      setInterval(function () {
        falsi++;
        window.postMessage({ type: 'labvisivo:height', height: 9999 }, '*');
        window.postMessage({ type: 'labvisivo:height', height: 250, cornice: 'token-falso' }, '*');
      }, 1000);
      window.__falsi = falsi;
    })();
  </script>
  <p>✅ <b>Verifica:</b> la cornice A e la cornice B NON devono cambiare altezza
  né mostrare l'app estranea, anche se l'intruso invia altezze false ogni secondo.</p>
</div>
"""

footer = """
<script>
  // Riepilogo automatico in alto a destra
  (function () {
    var esito = document.getElementById('esito');
    function report() {
      var cornici = document.querySelectorAll('.lf-cornice').length;
      var iframes = document.querySelectorAll('iframe.lf-iframe').length;
      esito.textContent =
        'cornici .lf-cornice: ' + cornici + '\\n' +
        'iframe .lf-iframe: ' + iframes + '\\n' +
        'furto id globale: ' + (window.__furto || '—') + '\\n' +
        '(le altezze false dell\\'intruso devono essere ignorate)';
    }
    setTimeout(report, 2000);
  })();
</script>
</body>
</html>
"""

out = header + dedicata + post2 + dedicata + intruso + footer
(base / "test-impermeabile.html").write_text(out, encoding="utf-8")
print("OK: test-impermeabile.html", len(out), "byte")

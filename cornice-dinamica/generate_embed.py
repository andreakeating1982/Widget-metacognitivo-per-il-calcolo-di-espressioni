#!/usr/bin/env python3
"""
Genera la cornice dinamica AUTOSUFFICIENTE di ESPRESSIONI LETTERALI, MONOMI E POLINOMI:
embed-espressioni-autosufficiente.html con i font OpenDyslexic incorporati in base64.

Uso:  python3 generate_embed.py
Legge i font da client/public/fonts/ e scrive il file HTML nella cartella
cornice-dinamica/. Ri-eseguibile in ogni momento (i font restano sincronizzati).
"""
import base64
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
FONTS = ROOT / "client" / "public" / "fonts"
OUT = ROOT / "cornice-dinamica" / "embed-espressioni-autosufficiente.html"

regular_b64 = base64.b64encode((FONTS / "OpenDyslexic-Regular-v2.woff2").read_bytes()).decode()
bold_b64 = base64.b64encode((FONTS / "OpenDyslexic-Bold-v2.woff2").read_bytes()).decode()

TEMPLATE = """<!-- ============================================================
     ESPRESSIONI LETTERALI, MONOMI E POLINOMI — CORNICE DINAMICA (embed per Blogger)
     Font: OpenDyslexic incorporato (WOFF2 base64) — autosufficiente
     Altezza dinamica: protocollo labvisivo:height
     ============================================================ -->
<style>
  @font-face {
    font-family: 'OpenDyslexic';
    src: url(data:font/woff2;base64,__REGULAR_B64__) format('woff2');
    font-weight: 400;
    font-style: normal;
    font-display: swap;
  }
  @font-face {
    font-family: 'OpenDyslexic';
    src: url(data:font/woff2;base64,__BOLD_B64__) format('woff2');
    font-weight: 700;
    font-style: normal;
    font-display: swap;
  }
  #eqEmbed {
    background: #faf7f2;
    border-radius: 16px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    font-family: 'OpenDyslexic', 'Cambria', 'Times New Roman', Georgia, serif;
    margin: 0 auto;
    max-width: 800px;
    overflow: hidden;
  }
  #eqEmbedHead {
    background: linear-gradient(135deg, #7c4a6b 0%, #b8846a 100%);
    padding: 14px 20px;
    text-align: center;
    border-bottom: 2px solid rgba(46,32,24,0.08);
  }
  #eqEmbedTitle {
    color: #ffffff;
    font-family: 'OpenDyslexic', 'Cambria', 'Times New Roman', Georgia, serif;
    font-size: 17px;
    font-weight: 700;
    letter-spacing: 2px;
    margin: 0;
    line-height: 1.3;
  }
  #eqIframe {
    border: none;
    display: block;
    height: 600px;
    min-width: 100%;
    width: 1px;
  }
</style>

<div id="eqEmbed">
  <div id="eqEmbedHead">
    <div id="eqEmbedTitle">ESPRESSIONI LETTERALI · MONOMI E POLINOMI</div>
  </div>
  <iframe id="eqIframe" title="Espressioni letterali, monomi e polinomi — risolvi in 6 passi guidati" src="https://espressioni-monomi-polinomi.easy-peasy.site/"></iframe>
</div>

<script>
(function() {
  var iframe = document.getElementById('eqIframe');
  if (!iframe) return;
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'labvisivo:height' && typeof e.data.height === 'number') {
      if (e.data.height > 100) iframe.style.height = e.data.height + 'px';
    }
  });
  setTimeout(function() {
    try { if (iframe.contentWindow) iframe.contentWindow.postMessage({ type: 'labvisivo:ping' }, '*'); } catch (err) {}
  }, 800);
})();
</script>
"""

html = TEMPLATE.replace("__REGULAR_B64__", regular_b64).replace("__BOLD_B64__", bold_b64)
OUT.write_text(html)
print(f"OK -> {OUT}")
print(f"  dimensione: {len(html)} byte (regular_b64={len(regular_b64)}, bold_b64={len(bold_b64)})")

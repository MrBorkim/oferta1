#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
docx_to_html.py
----------------
Tworzy pojedynczy plik HTML, który renderuje wskazany plik DOCX 1:1 w przeglądarce
(z użyciem biblioteki docx-preview z CDN). Plik HTML zawiera zakodowany w base64 DOCX,
prosty pasek narzędzi (edycja / druk / eksport HTML) oraz JS do renderowania.
Użycie:
    python docx_to_html.py /ścieżka/do/plik.docx -o oferta.html
    # parametr -o jest opcjonalny; domyślnie tworzy plik obok DOCX z rozszerzeniem .html
Wymaga połączenia z Internetem (CDN: unpkg) przy otwieraniu HTML w przeglądarce.
Autor: ChatGPT (GPT-5 Thinking)
"""
import argparse
import base64
import os
from pathlib import Path

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{title}</title>

  <!-- docx-preview: wierne odwzorowanie stylów z Worda -->
  <link id="docx-css" rel="stylesheet" href="https://unpkg.com/docx-preview/dist/docx-preview.css"/>
  <script src="https://unpkg.com/docx-preview/dist/docx-preview.min.js"></script>

  <style>
    :root {{ --border:#e5e7eb; --toolbar-bg:#f8fafc; --bg:#f3f4f6; }}
    html, body {{ height:100%; margin:0; background:var(--bg); font-family:system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; }}
    .shell {{ max-width:1100px; margin:18px auto; padding:0 12px; }}
    .toolbar {{
      position: sticky; top: 0; z-index: 20; display:flex; flex-wrap:wrap; gap:8px; align-items:center;
      padding:10px; border:1px solid var(--border); background:var(--toolbar-bg); border-radius:10px;
      box-shadow:0 2px 8px rgba(0,0,0,.04);
    }}
    .toolbar button, .toolbar select {{
      border:1px solid var(--border); background:#fff; padding:8px 10px; border-radius:8px; cursor:pointer; font-size:14px;
    }}
    .spacer {{ flex: 1; }}
    #viewer {{ background:transparent; display:flex; flex-direction:column; align-items:center; gap:16px; padding:16px 0; }}
    #viewer .docx {{ box-shadow:0 10px 25px rgba(0,0,0,.08); }}
    [contenteditable="true"]:focus {{ outline:2px solid #93c5fd; outline-offset:2px; }}
    .hint {{ color:#6b7280; font-size:12px; margin-left:6px; }}
    @media print {{ .shell, .toolbar {{ display:none !important; }} body{{ background:white; }} #viewer .docx{{ box-shadow:none; }} }}
  </style>
  <!-- W to miejsce wstrzykniemy treść CSS z docx-preview, aby eksport HTML był samowystarczalny -->
  <style id="inline-docx-css"></style>
</head>
<body>
  <div class="shell">
    <div class="toolbar" role="toolbar" aria-label="Edytor">
      <button id="toggle-edit">✏️ Włącz edycję</button>
      <button id="bold"><b>B</b></button>
      <button id="italic"><i>I</i></button>
      <button id="underline"><u>U</u></button>
      <button id="ulist">• Lista</button>
      <button id="olist">1. Lista</button>
      <select id="block-format" title="Styl akapitu">
        <option value="p">Akapit</option>
        <option value="h1">Nagłówek 1</option>
        <option value="h2">Nagłówek 2</option>
        <option value="h3">Nagłówek 3</option>
      </select>
      <button id="link">🔗 Link</button>
      <button id="clear">⎚ Wyczyść format</button>
      <div class="spacer"></div>
      <button id="print">🖨️ PDF/Drukuj</button>
      <button id="export-html">⬇️ Eksport HTML (1:1)</button>
    </div>
    <div class="hint">Ten widok odtwarza DOCX 1:1 (fonty, marginesy, listy, tabele, kolory, podziały stron). Aby edytować treść bez zmiany układu, użyj „✏️ Włącz edycję”.</div>
  </div>

  <div id="viewer"></div>

  <!-- Zakodowany plik DOCX (base64) -->
  <script id="docx-b64" type="application/json">{docx_b64}</script>

  <script>
    // Wczytaj CSS docx-preview jako inline, aby eksport był samowystarczalny
    ;(async function ensureInlineCSS(){{
      try {{
        const href = document.getElementById('docx-css')?.href;
        if (!href) return;
        const res = await fetch(href, {{mode:'cors'}});
        if (!res.ok) return;
        const css = await res.text();
        document.getElementById('inline-docx-css').textContent = css;
      }} catch (e) {{}}
    }})();

    const viewer = document.getElementById('viewer');
    const {{ renderAsync }} = window.docx || {{}};

    function b64ToArrayBuffer(b64) {{
      const binary_string = atob(b64);
      const len = binary_string.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binary_string.charCodeAt(i);
      return bytes.buffer;
    }}

    async function renderDocxFromB64(b64) {{
      viewer.innerHTML = '';
      await renderAsync(b64ToArrayBuffer(b64), viewer, viewer, {{
        className: 'docx', inWrapper: true, experimental: true, ignoreLastRenderedPageBreak: false, debug: false
      }});
      setEditable(false);
    }}

    // Inicjalizacja – renderuj dokument z wstrzykniętego base64
    (async function init(){{
      const b64 = JSON.parse(document.getElementById('docx-b64').textContent || '""');
      if (b64) await renderDocxFromB64(b64);
    }})();

    // Edycja
    const toggleBtn = document.getElementById('toggle-edit');
    function setEditable(on) {{
      viewer.querySelectorAll('.docx').forEach(p => p.setAttribute('contenteditable', on ? 'true' : 'false'));
      toggleBtn.textContent = on ? '🔒 Zablokuj edycję' : '✏️ Włącz edycję';
    }}
    let isEditable = false;
    toggleBtn.addEventListener('click', () => {{ isEditable = !isEditable; setEditable(isEditable); }});

    // Proste komendy
    const exec = (cmd, val=null) => document.execCommand(cmd, false, val);
    document.getElementById('bold').onclick = () => exec('bold');
    document.getElementById('italic').onclick = () => exec('italic');
    document.getElementById('underline').onclick = () => exec('underline');
    document.getElementById('ulist').onclick = () => exec('insertUnorderedList');
    document.getElementById('olist').onclick = () => exec('insertOrderedList');
    document.getElementById('clear').onclick = () => exec('removeFormat');
    document.getElementById('link').onclick = () => {{ const u = prompt('Adres URL'); if(u) exec('createLink', u); }};
    document.getElementById('block-format').onchange = (e)=> exec('formatBlock', e.target.value);

    // Drukuj / PDF
    document.getElementById('print').onclick = () => window.print();

    // Eksport HTML – pakuje aktualny viewer oraz zebrane style w jeden plik
    document.getElementById('export-html').onclick = () => {{
      const inlineCSS = document.getElementById('inline-docx-css')?.textContent || '';
      const html = `<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8"><title>{title}</title><style>${{inlineCSS}}</style></head><body>${{viewer.innerHTML}}</body></html>`;
      const blob = new Blob([html], {{type: 'text/html'}});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = '{safe_name}.html'; a.click();
      URL.revokeObjectURL(url);
    }};
  </script>
</body>
</html>
"""

def main():
    ap = argparse.ArgumentParser(description="Konwersja DOCX → samodzielny HTML (1:1) z docx-preview")
    ap.add_argument("input", help="Ścieżka do pliku .docx")
    ap.add_argument("-o", "--output", help="Ścieżka wyjściowego .html (opcjonalnie)")
    args = ap.parse_args()

    src = Path(args.input).expanduser().resolve()
    if not src.exists() or src.suffix.lower() != ".docx":
        raise SystemExit("Podaj istniejący plik .docx")

    out = Path(args.output).expanduser().resolve() if args.output else src.with_suffix(".html")

    # Wczytaj DOCX i zakoduj jako base64 (bez nagłówka data:)
    b64 = base64.b64encode(src.read_bytes()).decode("ascii")

    title = src.stem
    safe_name = src.stem.replace('"','').replace("'", "").replace(" ", "_")

    html = HTML_TEMPLATE.format(
        title=title,
        safe_name=safe_name,
        docx_b64=b64
    )

    out.write_text(html, encoding="utf-8")
    print(f"Zapisano: {out}")

if __name__ == "__main__":
    main()

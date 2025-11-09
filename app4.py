#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FAST DOCX -> JPG 1:1 on Linux (LibreOffice + unoserver + PyMuPDF)

- DOCX -> PDF: prefer 'unoconvert' (unoserver warm instance), fallback to 'soffice --headless'
- PDF -> JPG: single-pass loop with PyMuPDF (very fast)
- JPEG save: uses PyMuPDF native JPEG if available; auto-fallbacks for older versions

Dependencies:
  apt-get install -y libreoffice libreoffice-writer ttf-mscorefonts-installer fonts-dejavu
  pip install pymupdf unoserver
  # (Pillow optional, used only as last-resort fallback for very old PyMuPDF)
"""

import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import fitz  # PyMuPDF


# ---------- Helpers ----------

def which(cmd: str) -> str | None:
    return shutil.which(cmd)


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)


# ---------- DOCX -> PDF ----------

def convert_docx_to_pdf(docx_path: Path, out_pdf: Path, uc_host: str | None, uc_port: int | None) -> None:
    """
    Convert DOCX to PDF using 'unoconvert' (unoserver) if available, else fallback to soffice.
    """
    outdir = out_pdf.parent
    outdir.mkdir(parents=True, exist_ok=True)

    unoconvert = which("unoconvert")
    if unoconvert:
        cmd = [unoconvert, str(docx_path), str(out_pdf), "--convert-to", "pdf"]
        if uc_host:
            cmd += ["--host", uc_host]
        if uc_port:
            cmd += ["--port", str(uc_port)]
        try:
            run(cmd)
            if out_pdf.exists() and out_pdf.stat().st_size > 0:
                return
        except subprocess.CalledProcessError:
            pass  # fall back below

    soffice = which("soffice") or which("libreoffice")
    if not soffice:
        raise RuntimeError("Brak 'soffice/libreoffice' w PATH. Zainstaluj: apt install libreoffice")

    # LibreOffice zapisze PDF do outdir z nazwą bazującą na pliku DOCX
    cmd = [
        soffice, "--headless", "--nologo", "--nodefault", "--nofirststartwizard",
        "--convert-to", "pdf:writer_pdf_Export",
        "--outdir", str(outdir),
        str(docx_path),
    ]
    run(cmd)

    candidate = outdir / (docx_path.stem + ".pdf")
    if not candidate.exists():
        pdfs = list(outdir.glob("*.pdf"))
        if not pdfs:
            raise RuntimeError("LibreOffice nie wygenerował PDF.")
        candidate = max(pdfs, key=lambda p: p.stat().st_mtime)
    candidate.replace(out_pdf)


# ---------- PDF -> JPG (FAST single-pass) ----------

def _save_pixmap_as_jpeg_fast(pix: fitz.Pixmap, out_path: Path, quality: int) -> None:
    """
    Try the fastest native PyMuPDF JPEG save first. If not supported (older versions),
    fall back to extension-based save, and finally (optionally) to Pillow.
    """
    # 1) Newer PyMuPDF API: control JPEG quality directly
    try:
        # PyMuPDF >= 1.23/1.24 typically supports this:
        pix.save(str(out_path), output="jpeg", jpg_quality=int(quality))
        return
    except TypeError:
        pass  # older build

    # 2) Older PyMuPDF can save JPEG by file extension (no quality control)
    try:
        pix.save(str(out_path))  # if name ends with .jpg, writes JPEG
        return
    except Exception:
        pass

    # 3) Last resort: Pillow (if installed)
    try:
        from PIL import Image
        mode = "RGB" if not pix.alpha else "RGBA"
        img = Image.frombytes(mode, (pix.width, pix.height), pix.samples)
        if img.mode == "RGBA":
            img = img.convert("RGB")
        img.save(out_path, format="JPEG", quality=int(quality))
        return
    except Exception as e:
        raise RuntimeError(f"Nie udało się zapisać JPEG (spróbuj: pip install -U pymupdf lub Pillow). Szczegóły: {e}")


def pdf_to_jpg_fast(pdf_path: Path, out_dir: Path, dpi: int, quality: int) -> int:
    """
    Render PDF pages to JPG using a single pass (usually faster than multiprocess for small/medium docs).
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    zoom = dpi / 72.0
    mat = fitz.Matrix(zoom, zoom)
    count = 0

    with fitz.open(pdf_path) as doc:
        for i, page in enumerate(doc, start=1):
            pix = page.get_pixmap(matrix=mat, alpha=False)  # RGB, no alpha (faster / smaller)
            out_path = out_dir / f"page_{i:04d}.jpg"
            _save_pixmap_as_jpeg_fast(pix, out_path, quality)
            count += 1

    return count


# ---------- CLI ----------

def main():
    ap = argparse.ArgumentParser(description="FAST DOCX -> JPG 1:1 (LibreOffice/unoserver + PyMuPDF)")
    ap.add_argument("input", help="Ścieżka do pliku .docx")
    ap.add_argument("-o", "--outdir", default=None,
                    help="Katalog wyjściowy (domyślnie <katalog_DOCX>/<nazwa>_jpg)")
    ap.add_argument("--dpi", type=int, default=200, help="DPI renderu (180–300). 200 = szybki i ostry.")
    ap.add_argument("--quality", type=int, default=90, help="Jakość JPEG 0–100 (zalecane 85–95)")
    ap.add_argument("--uc-host", default="127.0.0.1", help="Host XML-RPC unoserver dla unoconvert")
    ap.add_argument("--uc-port", type=int, default=2003, help="Port XML-RPC unoserver dla unoconvert")
    args = ap.parse_args()

    docx_path = Path(args.input).resolve()
    if not docx_path.exists() or docx_path.suffix.lower() != ".docx":
        print("Podaj istniejący plik .docx", file=sys.stderr)
        sys.exit(1)

    out_dir = Path(args.outdir).resolve() if args.outdir else docx_path.parent / f"{docx_path.stem}_jpg"

    # Roboczy PDF w /tmp (szybszy I/O)
    with tempfile.TemporaryDirectory(dir="/tmp") as td:
        pdf_path = Path(td) / "out.pdf"
        # DOCX -> PDF (unoserver / soffice)
        convert_docx_to_pdf(docx_path, pdf_path, args.uc_host, args.uc_port)
        # PDF -> JPG (FAST)
        pages = pdf_to_jpg_fast(pdf_path, out_dir, dpi=args.dpi, quality=args.quality)

    print(f"OK: zapisano {pages} stron JPG w: {out_dir}")


if __name__ == "__main__":
    main()

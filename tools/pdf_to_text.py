"""Extract text from every PDF in the project root into extracted/*.txt.

Usage: py tools/pdf_to_text.py

Uses PyMuPDF (fitz). For each PDF it writes one .txt file with page markers.
Pages that yield no text (scanned images) are reported so they can be OCR'd.
"""

import pathlib
import sys

try:
    import fitz  # PyMuPDF
except ImportError:
    sys.exit("PyMuPDF is required: py -m pip install pymupdf")

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "extracted"


def extract_one(pdf_path: pathlib.Path) -> tuple[int, int, list[int]]:
    doc = fitz.open(pdf_path)
    parts: list[str] = []
    empty_pages: list[int] = []
    for page_num, page in enumerate(doc, start=1):
        text = page.get_text("text")
        if not text.strip():
            empty_pages.append(page_num)
        parts.append(f"\n===== PAGE {page_num} =====\n{text.strip()}\n")
    out_path = OUT_DIR / (pdf_path.stem.strip() + ".txt")
    out_path.write_text("".join(parts), encoding="utf-8")
    total_chars = sum(len(p) for p in parts)
    return len(doc), total_chars, empty_pages


def main() -> None:
    OUT_DIR.mkdir(exist_ok=True)
    pdfs = sorted(ROOT.glob("*.pdf"))
    if not pdfs:
        sys.exit("No PDF files found in project root.")
    for pdf in pdfs:
        pages, chars, empty = extract_one(pdf)
        print(f"{pdf.name}: {pages} pages, {chars} chars -> extracted/{pdf.stem.strip()}.txt")
        if empty:
            print(f"    WARNING: no extractable text on pages {empty} (likely scanned images; OCR needed)")


if __name__ == "__main__":
    main()

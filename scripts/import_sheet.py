"""Import the vocabulary spreadsheet into the hardcoded lexicon.

Usage:
    python3 scripts/import_sheet.py path/to/bang-tu-vung.xlsx

Source: the Google Sheet "[Hóa ESL 11A10 + 11E2] Bảng từ vựng"
(https://docs.google.com/spreadsheets/d/169QZcTti2lvf3sVGuyJwoYf9G-zxpr0iE-0e7PzYy8Q/edit).
Download it with File > Download > Microsoft Excel (.xlsx). Every tab named
"Bài N" is read; the header row is the one whose column C reads "Thuật ngữ tiếng Anh".
Outputs shared/data/lexicon.json and WebP illustrations in public/hinh/.
"""
import io
import json
import re
import sys
import unicodedata
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import openpyxl
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT_JSON = ROOT / "shared" / "data" / "lexicon.json"
OUT_IMG = ROOT / "public" / "hinh"
EMU_PER_PT = 12700
MAX_IMG_WIDTH = 1200

# Alt text describes what each picture shows; keyed by "<lesson>:<english term>".
ALT = {
    "10:Hydrocarbon": "Mô hình quả cầu – que của phân tử methane: một nguyên tử C nối với bốn nguyên tử H.",
    "10:Functional group": "Mô hình phân tử ethanol kèm công thức H₃C–CH₂–OH, nhóm –OH tô màu đỏ.",
    "10:Aromatic compound": "Công thức cấu tạo vòng benzene C₆H₆ với chú thích góc liên kết 120° và electron π không định chỗ.",
    "11:Organic compound": "Mô hình quả cầu – que của phân tử butane với bốn nguyên tử C và mười nguyên tử H.",
    "11:Molecular formula": "Bảng so sánh công thức phân tử C₄H₁₀ và C₂H₆O với công thức cấu tạo đầy đủ và thu gọn.",
    "11:Mass spectrometry": "Hình 3.5: phổ khối lượng của neon, các vạch tại m/z 20 (90,9%), 21 (0,3%) và 22 (8,8%).",
}


def clean(value):
    if value is None:
        return None
    text = re.sub(r"\s+", " ", str(value)).strip()
    return text or None


def fold(text):
    text = unicodedata.normalize("NFD", text.replace("đ", "d").replace("Đ", "D"))
    return "".join(c for c in text if unicodedata.category(c) != "Mn")


def slugify(text):
    return re.sub(r"[^a-z0-9]+", "-", fold(text).lower()).strip("-")


def strip_tracking(url):
    parts = urlsplit(url)
    query = [(k, v) for k, v in parse_qsl(parts.query) if not k.startswith("utm_")]
    return urlunsplit(parts._replace(query=urlencode(query)))


def image_rows(ws):
    """Map each floating image to the data row it sits in.

    Sheets exports one-cell anchors whose offset may run past the anchor row; when the
    offset reaches that row's height the picture belongs to the next row.
    """
    default_pt = ws.sheet_format.defaultRowHeight or 15.75
    found = []
    for img in ws._images:
        start = img.anchor._from
        row = start.row + 1  # 1-based
        height = ws.row_dimensions[row].height or default_pt
        if start.rowOff / EMU_PER_PT >= height:
            row += 1
        found.append((row, img))
    return found


def build_source(cell, vi_term):
    text = clean(cell.value)
    url = strip_tracking(cell.hyperlink.target) if cell.hyperlink and cell.hyperlink.target else None
    if text and re.match(r"https?://", text):
        url = strip_tracking(text)  # the typed URL keeps fragments such as #page=70
    if not text and not url:
        return None
    label = text
    # A bare URL or a cell that repeats the term says nothing; name the site instead.
    if url and (not text or re.match(r"https?://", text) or text == vi_term):
        label = urlsplit(url).hostname
    return {"label": label, "url": url}


def main(xlsx_path):
    wb = openpyxl.load_workbook(xlsx_path)
    OUT_IMG.mkdir(parents=True, exist_ok=True)
    lessons = []
    for ws in wb.worksheets:
        m = re.fullmatch(r"\s*Bài\s+(\d+)\s*", ws.title)
        if not m:
            continue
        number = int(m.group(1))
        header = next(r for r in range(1, ws.max_row + 1) if clean(ws.cell(r, 3).value) == "Thuật ngữ tiếng Anh")
        pictures = {}
        for row, img in image_rows(ws):
            pictures.setdefault(row, []).append(img)

        senses = []
        for r in range(header + 1, ws.max_row + 1):
            vi, en = clean(ws.cell(r, 2).value), clean(ws.cell(r, 3).value)
            if not vi and not en:
                continue
            sense = {
                "id": f"b{number}-{len(senses) + 1:02d}",
                "lesson": number,
                "row": r,
                "vi": vi,
                "en": en,
                "ipa": clean(ws.cell(r, 4).value),
                "pos": clean(ws.cell(r, 5).value),
                "defVi": clean(ws.cell(r, 6).value),
                "defEn": clean(ws.cell(r, 7).value),
                "illustration": None,
                "source": build_source(ws.cell(r, 9), vi),
            }
            note = clean(ws.cell(r, 8).value)
            if r in pictures:
                img = pictures[r][0]
                pil = Image.open(io.BytesIO(img._data())).convert("RGB")
                if pil.width > MAX_IMG_WIDTH:
                    pil = pil.resize((MAX_IMG_WIDTH, round(pil.height * MAX_IMG_WIDTH / pil.width)), Image.LANCZOS)
                name = f"bai-{number}-{slugify(en)}.webp"
                pil.save(OUT_IMG / name, "WEBP", quality=82, method=6)
                sense["illustration"] = {
                    "kind": "image",
                    "src": f"/hinh/{name}",
                    "width": pil.width,
                    "height": pil.height,
                    "alt": ALT.get(f"{number}:{en}", f"Hình minh họa cho thuật ngữ {en}"),
                }
                print(f"  image -> Bài {number} row {r}: {en}")
            elif note:
                sense["illustration"] = {"kind": "text", "text": note}
            senses.append(sense)
        lessons.append({"number": number, "title": ws.title.strip(), "senses": senses})
        print(f"Bài {number}: {len(senses)} terms")

    lessons.sort(key=lambda l: l["number"])
    OUT_JSON.write_text(
        # The sheet's name and URL stay out of the site's bundle: the site never names its source sheet.
        json.dumps({"lessons": lessons}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {OUT_JSON.relative_to(ROOT)}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])

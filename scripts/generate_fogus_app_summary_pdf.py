from __future__ import annotations

from pathlib import Path

import fitz
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.utils import simpleSplit
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "output" / "pdf"
TMP_DIR = ROOT / "tmp" / "pdfs"
PDF_PATH = OUTPUT_DIR / "fogus-app-summary-one-page.pdf"
PNG_PATH = TMP_DIR / "fogus-app-summary-one-page-preview.png"
FONT_REG = "TahomaThai"
FONT_BOLD = "TahomaThaiBold"


CONTENT = {
    "title": "สรุปแอป FOGUS",
    "subtitle": (
        "สรุปจากหลักฐานที่พบใน repo ของ workspace นี้เท่านั้น"
    ),
    "what_it_is": (
        "FOGUS เป็นแอป Next.js ที่เชื่อม LINE OA, LIFF และ Supabase เพื่อรับ"
        "ความต้องการงานป้ายหรือสิ่งพิมพ์จากลูกค้า สร้างใบเสนอราคา และติดตาม"
        "สถานะงานหลังลูกค้าอนุมัติ"
    ),
    "who_its_for": [
        "Persona หลัก: Not found in repo.",
        (
            "จากหลักฐานใน repo เหมาะกับแอดมินหรือทีมปฏิบัติการของร้านป้าย"
            "หรือร้านพิมพ์ ที่ต้องรับงานจาก LINE ออกใบเสนอราคา เปิดงานผลิต"
            " และตามเคสที่ต้อง review เอง"
        ),
    ],
    "what_it_does": [
        "รับ webhook จาก LINE Messaging API และตรวจ x-line-signature",
        "ตอบกลับเป็น Flex Message เพื่อเปิดฟอร์ม LIFF หรือส่งเข้า escalation",
        "เก็บประเภทงาน ขนาด หน่วย จำนวน วันใช้งาน เบอร์โทร หมายเหตุ และข้อมูลอ้างอิง",
        "แปลงหน่วยเป็นมิลลิเมตร แล้วสร้าง lead, quote, quote item, VAT และยอดรวมอัตโนมัติ",
        "เปิดหน้าใบเสนอราคาและหน้าสถานะงานแบบ token-based ให้ลูกค้าเข้าดูได้",
        "สร้าง job และ timeline หลังลูกค้าอนุมัติ พร้อมส่งแจ้งเตือนสถานะกลับไปใน LINE",
        "แสดงแดชบอร์ดแอดมินที่รวม leads, quotes, jobs, escalations และ conversations",
    ],
    "how_it_works": [
        "ส่วนติดต่อผู้ใช้: LINE OA chat, LIFF ที่ /liff -> /liff/intake, หน้า /quote/[token], /status/[token], และ /admin",
        "ฝั่งเซิร์ฟเวอร์: Next.js App Router และ API /api/webhook, /api/intake, /api/quotes/[id]/approve, /api/jobs/[id]/status",
        "ฝั่งข้อมูล: Supabase เก็บ conversations, messages, customers, leads, quotes, quote_items, jobs, job_timeline และ escalations โดยเปิด realtime ให้ conversations, jobs, escalations",
        "ลำดับข้อมูล: ลูกค้าทัก LINE -> webhook บันทึกบทสนทนา -> Flex Message เปิด LIFF -> intake API สร้าง lead/quote -> ลูกค้าอนุมัติใบเสนอราคา -> ระบบสร้าง job -> แอดมินอัปเดตสถานะและระบบ push กลับไปที่ LINE",
    ],
    "how_to_run": [
        "npm install",
        "สร้างโปรเจกต์ Supabase แล้วรัน supabase/migrations/001_initial.sql",
        "ตั้งค่า LINE_CHANNEL_SECRET, LINE_CHANNEL_ACCESS_TOKEN, LIFF_ID, NEXT_PUBLIC_LIFF_ID, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY และ NEXT_PUBLIC_BASE_URL",
        "รัน npm run dev",
        "ถ้าจะทดสอบกับ LINE จริง ให้ชี้ webhook ไปที่ /api/webhook และตั้ง LIFF endpoint เป็น /liff",
    ],
    "repo_gaps": [
        ".env.example: Not found in repo.",
        "วิธีสร้างผู้ใช้แอดมินคนแรกหรือขั้นตอน seed ข้อมูล: Not found in repo.",
    ],
    "sources": (
        "หลักฐานที่ตรวจ: README.md, FOGUS_FINAL_SPEC.md, src/app routes, "
        "src/lib/*, supabase/migrations/001_initial.sql, package.json, "
        "next.config.ts, vercel.json"
    ),
}


PAGE_WIDTH, PAGE_HEIGHT = letter
MARGIN = 36
GUTTER = 18
HEADER_HEIGHT = 82
COL_WIDTH = (PAGE_WIDTH - (MARGIN * 2) - GUTTER) / 2
BOTTOM_LIMIT = 34

TITLE_COLOR = colors.HexColor("#14213d")
ACCENT = colors.HexColor("#d97706")
TEXT = colors.HexColor("#1f2937")
MUTED = colors.HexColor("#6b7280")
PANEL = colors.HexColor("#f8fafc")
PANEL_BORDER = colors.HexColor("#e5e7eb")


def register_fonts() -> None:
    pdfmetrics.registerFont(TTFont(FONT_REG, r"C:\Windows\Fonts\tahoma.ttf"))
    pdfmetrics.registerFont(TTFont(FONT_BOLD, r"C:\Windows\Fonts\tahomabd.ttf"))


def wrap(text: str, font_name: str, font_size: float, width: float) -> list[str]:
    return simpleSplit(text, font_name, font_size, width)


def draw_text_block(
    pdf: canvas.Canvas,
    x: float,
    y: float,
    width: float,
    text: str,
    *,
    font_name: str = FONT_REG,
    font_size: float = 9.2,
    leading: float = 12,
    color=TEXT,
) -> float:
    lines = wrap(text, font_name, font_size, width)
    text_obj = pdf.beginText(x, y)
    text_obj.setFont(font_name, font_size)
    text_obj.setLeading(leading)
    text_obj.setFillColor(color)
    for line in lines:
        text_obj.textLine(line)
    pdf.drawText(text_obj)
    return y - (len(lines) * leading)


def draw_bullets(
    pdf: canvas.Canvas,
    x: float,
    y: float,
    width: float,
    items: list[str],
    *,
    font_name: str = FONT_REG,
    font_size: float = 8.8,
    leading: float = 11.2,
    bullet_indent: float = 9,
    gap_after: float = 3,
) -> float:
    for item in items:
        lines = wrap(item, font_name, font_size, width - bullet_indent)
        text_obj = pdf.beginText(x + bullet_indent, y)
        text_obj.setFont(font_name, font_size)
        text_obj.setLeading(leading)
        text_obj.setFillColor(TEXT)
        for index, line in enumerate(lines):
            if index == 0:
                text_obj.textLine(f"- {line}")
            else:
                text_obj.textLine(f"  {line}")
        pdf.drawText(text_obj)
        y -= (len(lines) * leading) + gap_after
    return y


def draw_numbered_steps(
    pdf: canvas.Canvas,
    x: float,
    y: float,
    width: float,
    items: list[str],
    *,
    font_name: str = FONT_REG,
    font_size: float = 8.8,
    leading: float = 11.2,
    number_indent: float = 12,
    gap_after: float = 3,
) -> float:
    for idx, item in enumerate(items, start=1):
        prefix = f"{idx}. "
        lines = wrap(item, font_name, font_size, width - number_indent)
        text_obj = pdf.beginText(x + number_indent, y)
        text_obj.setFont(font_name, font_size)
        text_obj.setLeading(leading)
        text_obj.setFillColor(TEXT)
        for index, line in enumerate(lines):
            if index == 0:
                text_obj.textLine(f"{prefix}{line}")
            else:
                text_obj.textLine("   " + line)
        pdf.drawText(text_obj)
        y -= (len(lines) * leading) + gap_after
    return y


def draw_section_box(
    pdf: canvas.Canvas,
    x: float,
    y_top: float,
    width: float,
    title: str,
    body_type: str,
    body,
) -> float:
    pad_x = 12
    pad_top = 12
    pad_bottom = 10

    probe_y = y_top - pad_top - 14
    if body_type == "paragraph":
        lines = wrap(body, FONT_REG, 9.2, width - (pad_x * 2))
        body_height = len(lines) * 12
    elif body_type == "bullets":
        body_height = 0
        for item in body:
            body_height += len(wrap(item, FONT_REG, 8.8, width - (pad_x * 2) - 9)) * 11.2
            body_height += 3
    elif body_type == "numbered":
        body_height = 0
        for item in body:
            body_height += len(wrap(item, FONT_REG, 8.8, width - (pad_x * 2) - 12)) * 11.2
            body_height += 3
    else:
        raise ValueError(f"Unsupported body type: {body_type}")

    box_height = pad_top + 14 + 8 + body_height + pad_bottom
    y_bottom = y_top - box_height

    pdf.setFillColor(PANEL)
    pdf.setStrokeColor(PANEL_BORDER)
    pdf.roundRect(x, y_bottom, width, box_height, 10, fill=1, stroke=1)

    pdf.setFillColor(TITLE_COLOR)
    pdf.setFont(FONT_BOLD, 10.2)
    pdf.drawString(x + pad_x, y_top - pad_top, title)

    line_y = y_top - pad_top - 5
    pdf.setStrokeColor(ACCENT)
    pdf.setLineWidth(1)
    pdf.line(x + pad_x, line_y, x + width - pad_x, line_y)

    content_y = y_top - pad_top - 18
    content_x = x + pad_x
    content_w = width - (pad_x * 2)

    if body_type == "paragraph":
        draw_text_block(pdf, content_x, content_y, content_w, body, color=TEXT)
    elif body_type == "bullets":
        draw_bullets(pdf, content_x, content_y, content_w, body)
    else:
        draw_numbered_steps(pdf, content_x, content_y, content_w, body)

    return y_bottom - 10


def build_pdf() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    register_fonts()

    pdf = canvas.Canvas(str(PDF_PATH), pagesize=letter)
    pdf.setTitle(CONTENT["title"])

    header_y = PAGE_HEIGHT - MARGIN - HEADER_HEIGHT
    pdf.setFillColor(TITLE_COLOR)
    pdf.roundRect(MARGIN, header_y, PAGE_WIDTH - (MARGIN * 2), HEADER_HEIGHT, 14, fill=1, stroke=0)

    pdf.setFillColor(colors.white)
    pdf.setFont(FONT_BOLD, 21)
    pdf.drawString(MARGIN + 16, PAGE_HEIGHT - MARGIN - 26, CONTENT["title"])

    pdf.setFont(FONT_REG, 9.6)
    pdf.setFillColor(colors.HexColor("#dbeafe"))
    pdf.drawString(MARGIN + 16, PAGE_HEIGHT - MARGIN - 41, CONTENT["subtitle"])

    desc_y = PAGE_HEIGHT - MARGIN - 58
    draw_text_block(
        pdf,
        MARGIN + 16,
        desc_y,
        PAGE_WIDTH - (MARGIN * 2) - 32,
        CONTENT["what_it_is"],
        font_name=FONT_REG,
        font_size=9.4,
        leading=11.6,
        color=colors.white,
    )

    left_x = MARGIN
    right_x = MARGIN + COL_WIDTH + GUTTER
    start_y = header_y - 14

    left_y = start_y
    left_y = draw_section_box(pdf, left_x, left_y, COL_WIDTH, "คืออะไร", "paragraph", CONTENT["what_it_is"])
    left_y = draw_section_box(pdf, left_x, left_y, COL_WIDTH, "เหมาะกับใคร", "bullets", CONTENT["who_its_for"])
    left_y = draw_section_box(pdf, left_x, left_y, COL_WIDTH, "ทำอะไรได้บ้าง", "bullets", CONTENT["what_it_does"])

    right_y = start_y
    right_y = draw_section_box(pdf, right_x, right_y, COL_WIDTH, "ทำงานอย่างไร", "bullets", CONTENT["how_it_works"])
    right_y = draw_section_box(pdf, right_x, right_y, COL_WIDTH, "วิธีรัน", "numbered", CONTENT["how_to_run"])
    right_y = draw_section_box(pdf, right_x, right_y, COL_WIDTH, "ช่องว่างใน repo", "bullets", CONTENT["repo_gaps"])

    footer_y = min(left_y, right_y) - 2
    if footer_y < BOTTOM_LIMIT:
        raise RuntimeError("Content overflowed the single-page layout.")

    pdf.setStrokeColor(PANEL_BORDER)
    pdf.line(MARGIN, footer_y, PAGE_WIDTH - MARGIN, footer_y)
    pdf.setFont(FONT_REG, 7.9)
    pdf.setFillColor(MUTED)
    draw_text_block(
        pdf,
        MARGIN,
        footer_y - 10,
        PAGE_WIDTH - (MARGIN * 2),
        CONTENT["sources"],
        font_name=FONT_REG,
        font_size=7.9,
        leading=9.4,
        color=MUTED,
    )

    pdf.showPage()
    pdf.save()


def render_preview() -> None:
    doc = fitz.open(PDF_PATH)
    page = doc.load_page(0)
    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
    pix.save(PNG_PATH)
    doc.close()


if __name__ == "__main__":
    build_pdf()
    render_preview()
    print(PDF_PATH)
    print(PNG_PATH)

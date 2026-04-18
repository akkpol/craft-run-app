import sys
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "output" / "pdf"
TMP_DIR = ROOT / "tmp" / "pdfs"
PDF_PATH = OUTPUT_DIR / "quotation-template-standard.pdf"


def register_fonts() -> tuple[str, str]:
    regular = Path(r"C:\Windows\Fonts\tahoma.ttf")
    bold = Path(r"C:\Windows\Fonts\tahomabd.ttf")
    pdfmetrics.registerFont(TTFont("FogusTahoma", str(regular)))
    pdfmetrics.registerFont(TTFont("FogusTahomaBold", str(bold)))
    return "FogusTahoma", "FogusTahomaBold"


def draw_text(c: canvas.Canvas, text: str, x: float, y: float, font: str, size: int, color=colors.black):
    c.setFont(font, size)
    c.setFillColor(color)
    c.drawString(x, y, text)


def draw_right_text(c: canvas.Canvas, text: str, x: float, y: float, font: str, size: int, color=colors.black):
    c.setFont(font, size)
    c.setFillColor(color)
    c.drawRightString(x, y, text)


def draw_field(c: canvas.Canvas, label: str, value: str, x: float, y: float, width: float, regular_font: str, bold_font: str):
    draw_text(c, label, x, y, bold_font, 9, colors.HexColor("#4B5563"))
    c.setStrokeColor(colors.HexColor("#CBD5E1"))
    c.line(x, y - 4, x + width, y - 4)
    draw_text(c, value, x, y - 18, regular_font, 10, colors.HexColor("#0F172A"))


def draw_wrapped_lines(c: canvas.Canvas, lines: list[str], x: float, y: float, font: str, size: int, leading: int, color):
    text_obj = c.beginText(x, y)
    text_obj.setFont(font, size)
    text_obj.setFillColor(color)
    text_obj.setLeading(leading)
    for line in lines:
        text_obj.textLine(line)
    c.drawText(text_obj)


def draw_shop_attachment_page(
    c: canvas.Canvas,
    page_width: float,
    page_height: float,
    margin: float,
    regular_font: str,
    bold_font: str,
    image_path: Path | None,
):
    navy = colors.HexColor("#123B63")
    slate = colors.HexColor("#475569")
    light = colors.HexColor("#CBD5E1")
    soft = colors.HexColor("#F8FAFC")

    draw_text(c, "ใบปะหลัง / Shop Attachment", margin, page_height - margin - 10 * mm, bold_font, 20, navy)
    draw_text(c, "แนบภาพจากร้านเพื่ออ้างอิงงานผลิต งานพิมพ์ หรือสภาพหน้างาน", margin, page_height - margin - 18 * mm, regular_font, 10, slate)

    frame_x = margin
    frame_y = margin + 24 * mm
    frame_w = page_width - (margin * 2)
    frame_h = page_height - (margin * 2) - 34 * mm

    c.setFillColor(soft)
    c.setStrokeColor(light)
    c.roundRect(frame_x, frame_y, frame_w, frame_h, 8, fill=1, stroke=1)

    if image_path and image_path.exists():
        image = ImageReader(str(image_path))
        img_w, img_h = image.getSize()
        scale = min((frame_w - 8 * mm) / img_w, (frame_h - 8 * mm) / img_h)
        draw_w = img_w * scale
        draw_h = img_h * scale
        draw_x = frame_x + (frame_w - draw_w) / 2
        draw_y = frame_y + (frame_h - draw_h) / 2
        c.drawImage(image, draw_x, draw_y, width=draw_w, height=draw_h, preserveAspectRatio=True, mask="auto")
        draw_text(c, f"แนบรูปจากร้าน: {image_path.name}", margin, margin + 8 * mm, regular_font, 9, slate)
    else:
        c.setDash(5, 4)
        c.setStrokeColor(colors.HexColor("#94A3B8"))
        c.roundRect(frame_x + 8 * mm, frame_y + 8 * mm, frame_w - 16 * mm, frame_h - 16 * mm, 6, fill=0, stroke=1)
        c.setDash()
        draw_text(c, "[วางรูปภาพจากร้านที่นี่ / Place shop image here]", frame_x + 24 * mm, frame_y + (frame_h / 2), bold_font, 16, colors.HexColor("#64748B"))
        draw_text(c, "รันสคริปต์พร้อม path รูป เพื่อฝังภาพจริงลงหน้า 2", margin, margin + 8 * mm, regular_font, 9, slate)


def build_pdf() -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    TMP_DIR.mkdir(parents=True, exist_ok=True)

    regular_font, bold_font = register_fonts()
    page_width, page_height = A4
    margin = 18 * mm
    navy = colors.HexColor("#123B63")
    slate = colors.HexColor("#475569")
    light = colors.HexColor("#E2E8F0")
    ink = colors.HexColor("#0F172A")
    soft = colors.HexColor("#F8FAFC")

    c = canvas.Canvas(str(PDF_PATH), pagesize=A4)
    c.setTitle("Quotation Template Standard")

    c.setStrokeColor(light)
    c.setLineWidth(1)
    c.rect(margin, margin, page_width - (margin * 2), page_height - (margin * 2))

    logo_x = page_width - margin - 34 * mm
    logo_y = page_height - margin - 28 * mm
    c.setStrokeColor(colors.HexColor("#94A3B8"))
    c.setDash(4, 3)
    c.rect(logo_x, logo_y, 34 * mm, 28 * mm)
    c.setDash()
    draw_text(c, "[LOGO]", logo_x + 9 * mm, logo_y + 12 * mm, bold_font, 12, colors.HexColor("#64748B"))

    draw_text(c, "ใบเสนอราคา / Quotation", margin, page_height - margin - 10 * mm, bold_font, 22, navy)
    draw_text(c, "Template สำหรับกรอกชื่อบริษัทหลัก บริษัทลูก และโลโก้", margin, page_height - margin - 18 * mm, regular_font, 10, slate)

    right_col_x = page_width - margin - 70 * mm
    draw_field(c, "เลขที่ใบเสนอราคา / Quote No.", "[QT-0001]", right_col_x, page_height - margin - 12 * mm, 64 * mm, regular_font, bold_font)
    draw_field(c, "วันที่ / Issue Date", "[DD/MM/YYYY]", right_col_x, page_height - margin - 28 * mm, 64 * mm, regular_font, bold_font)
    draw_field(c, "อายุใบเสนอราคา / Valid Until", "[DD/MM/YYYY]", right_col_x, page_height - margin - 44 * mm, 64 * mm, regular_font, bold_font)

    box_top = page_height - margin - 66 * mm
    left_box_x = margin
    box_width = (page_width - (margin * 2) - 8 * mm) / 2
    box_height = 45 * mm

    c.setFillColor(soft)
    c.setStrokeColor(light)
    c.roundRect(left_box_x, box_top - box_height, box_width, box_height, 6, fill=1, stroke=1)
    c.roundRect(left_box_x + box_width + 8 * mm, box_top - box_height, box_width, box_height, 6, fill=1, stroke=1)

    draw_text(c, "ผู้ออกใบเสนอราคา / Seller", left_box_x + 5 * mm, box_top - 8 * mm, bold_font, 11, navy)
    draw_wrapped_lines(
        c,
        [
            "[บริษัทหลัก / Parent Company]",
            "[บริษัทลูกหรือสาขา / Subsidiary or Branch]",
            "[เลขประจำตัวผู้เสียภาษี / Tax ID]",
            "[โทรศัพท์ / Phone]   [อีเมล / Email]",
            "[ที่อยู่บริษัท / Company Address]",
        ],
        left_box_x + 5 * mm,
        box_top - 16 * mm,
        regular_font,
        10,
        13,
        ink,
    )

    customer_x = left_box_x + box_width + 8 * mm
    draw_text(c, "ลูกค้า / Bill To", customer_x + 5 * mm, box_top - 8 * mm, bold_font, 11, navy)
    draw_wrapped_lines(
        c,
        [
            "[ชื่อลูกค้า / Customer Name]",
            "[ชื่อบริษัทลูกค้า / Customer Company]",
            "[ผู้ติดต่อ / Contact Person]",
            "[โทรศัพท์ / Phone]   [อีเมล / Email]",
            "[ที่อยู่ลูกค้า / Customer Address]",
        ],
        customer_x + 5 * mm,
        box_top - 16 * mm,
        regular_font,
        10,
        13,
        ink,
    )

    summary_y = box_top - box_height - 10 * mm
    draw_field(c, "สรุปงาน / Project or Service Summary", "[ระบุขอบเขตงานหรือบริการโดยสั้น]", margin, summary_y, page_width - (margin * 2), regular_font, bold_font)

    table_top = summary_y - 18 * mm
    table_x = margin
    table_width = page_width - (margin * 2)
    row_height = 11 * mm
    col_widths = [16 * mm, 86 * mm, 22 * mm, 30 * mm, 30 * mm]
    headers = ["ลำดับ / No.", "รายการ / Description", "จำนวน / Qty", "ราคา / Unit Price", "รวม / Amount"]

    c.setFillColor(navy)
    c.setStrokeColor(navy)
    c.rect(table_x, table_top - row_height, table_width, row_height, fill=1, stroke=0)

    current_x = table_x
    for header, width in zip(headers, col_widths):
        draw_text(c, header, current_x + 3 * mm, table_top - 7.5 * mm, bold_font, 9, colors.white)
        current_x += width

    c.setStrokeColor(light)
    sample_rows = [
        ["1", "[รายการที่ 1]", "[1]", "[0.00]", "[0.00]"],
        ["2", "[รายการที่ 2]", "[1]", "[0.00]", "[0.00]"],
        ["3", "[รายการที่ 3]", "[1]", "[0.00]", "[0.00]"],
        ["4", "[รายการที่ 4]", "[1]", "[0.00]", "[0.00]"],
    ]

    row_y = table_top - row_height
    for row in sample_rows:
        c.rect(table_x, row_y - row_height, table_width, row_height, fill=0, stroke=1)
        current_x = table_x
        for idx, (cell, width) in enumerate(zip(row, col_widths)):
            c.line(current_x, row_y, current_x, row_y - row_height)
            if idx == 1:
                draw_text(c, cell, current_x + 3 * mm, row_y - 7.5 * mm, regular_font, 9, ink)
            else:
                draw_right_text(c, cell, current_x + width - 3 * mm, row_y - 7.5 * mm, regular_font, 9, ink)
            current_x += width
        c.line(table_x + table_width, row_y, table_x + table_width, row_y - row_height)
        row_y -= row_height

    totals_x = page_width - margin - 58 * mm
    totals_y = row_y - 8 * mm
    totals = [
        ("ยอดรวม / Subtotal", "[0.00]"),
        ("ส่วนลด / Discount", "[0.00]"),
        ("ภาษีมูลค่าเพิ่ม 7% / VAT 7%", "[0.00]"),
        ("ยอดสุทธิ / Grand Total", "[0.00]"),
    ]
    line_gap = 9 * mm
    for idx, (label, value) in enumerate(totals):
        y = totals_y - (idx * line_gap)
        if idx == len(totals) - 1:
            c.setFillColor(soft)
            c.roundRect(totals_x - 4 * mm, y - 5 * mm, 62 * mm, 9 * mm, 4, fill=1, stroke=0)
        draw_text(c, label, totals_x, y, bold_font if idx == len(totals) - 1 else regular_font, 10, navy if idx == len(totals) - 1 else slate)
        draw_right_text(c, value, page_width - margin, y, bold_font, 10, ink)

    terms_y = totals_y - (len(totals) * line_gap) - 4 * mm
    c.setStrokeColor(light)
    c.roundRect(margin, terms_y - 34 * mm, page_width - (margin * 2), 34 * mm, 6, fill=0, stroke=1)
    draw_text(c, "เงื่อนไข / Terms", margin + 4 * mm, terms_y - 6 * mm, bold_font, 11, navy)
    draw_wrapped_lines(
        c,
        [
            "การชำระเงิน / Payment Terms: [เช่น ชำระ 50% ก่อนเริ่มงาน และ 50% ก่อนส่งมอบ]",
            "หมายเหตุ / Notes: [ใส่หมายเหตุเพิ่มเติม เงื่อนไขเครดิต หรือขอบเขตที่ไม่รวม]",
            "ผู้ติดต่อ / Contact: [ชื่อผู้ประสานงาน]  [เบอร์โทร]  [อีเมล]",
        ],
        margin + 4 * mm,
        terms_y - 14 * mm,
        regular_font,
        9,
        12,
        ink,
    )

    sign_y = margin + 26 * mm
    sign_width = 72 * mm
    left_sign_x = margin
    right_sign_x = page_width - margin - sign_width

    c.line(left_sign_x, sign_y, left_sign_x + sign_width, sign_y)
    c.line(right_sign_x, sign_y, right_sign_x + sign_width, sign_y)
    draw_text(c, "ผู้มีอำนาจลงนาม / Authorized Signature", left_sign_x, sign_y - 8 * mm, regular_font, 9, slate)
    draw_text(c, "ผู้ยอมรับใบเสนอราคา / Customer Acceptance", right_sign_x, sign_y - 8 * mm, regular_font, 9, slate)

    image_path = Path(sys.argv[1]).expanduser() if len(sys.argv) > 1 else None

    c.showPage()
    draw_shop_attachment_page(c, page_width, page_height, margin, regular_font, bold_font, image_path)

    c.save()
    return PDF_PATH


if __name__ == "__main__":
    path = build_pdf()
    print(path)

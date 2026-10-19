#!/usr/bin/env python3
"""Generate the small HTML entry page of every tool (<slug>/index.html).

Each page is the same shell: shared CSS + assets/core.js + assets/tools/<id>.js.
Run after adding a tool or changing the shell:  python3 scripts/make-pages.py
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# id, folder, title, description (keep in sync with PT.TOOLS in assets/core.js)
TOOLS = [
    ("merge", "ghep-pdf", "Ghép PDF", "Ghép nhiều file PDF thành một file theo thứ tự bạn muốn."),
    ("split", "tach-pdf", "Tách PDF", "Tách PDF theo khoảng trang, mỗi trang một file hoặc trích các trang bạn chọn."),
    ("remove", "xoa-trang-pdf", "Xoá trang PDF", "Xoá các trang không cần khỏi file PDF."),
    ("organize", "sap-xep-pdf", "Sắp xếp trang PDF", "Đổi thứ tự, xoay, xoá trang, chèn trang trắng hoặc ghép thêm PDF."),
    ("rotate", "xoay-pdf", "Xoay PDF", "Xoay từng trang hoặc toàn bộ file PDF."),
    ("compress", "nen-pdf", "Nén PDF", "Giảm dung lượng file PDF mà chữ vẫn sắc nét."),
    ("pdf2img", "pdf-sang-anh", "PDF sang ảnh", "Chuyển trang PDF thành ảnh JPG hoặc PNG chất lượng cao."),
    ("img2pdf", "anh-sang-pdf", "Ảnh sang PDF", "Chuyển ảnh JPG, PNG, ảnh chụp màn hình sang PDF."),
    ("text", "pdf-sang-van-ban", "PDF sang văn bản", "Lấy toàn bộ chữ trong file PDF để sao chép hoặc lưu .txt."),
    ("sign", "ky-pdf", "Ký PDF", "Vẽ, gõ hoặc dán chữ ký, thêm chữ và ngày tháng vào file PDF."),
    ("numbers", "danh-so-trang", "Đánh số trang PDF", "Thêm số trang vào file PDF, chọn vị trí và kiểu số."),
    ("watermark", "watermark-pdf", "Chèn watermark PDF", "Đóng dấu chữ hoặc logo mờ lên các trang PDF."),
    ("protect", "bao-ve-pdf", "Đặt mật khẩu PDF", "Khoá file PDF bằng mật khẩu, mã hoá AES-256."),
    ("unlock", "mo-khoa-pdf", "Mở khoá PDF", "Gỡ mật khẩu và giới hạn in, sao chép khỏi file PDF."),
]

PAGE = """<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{title} – PDFNhanh</title>
<meta name="description" content="{desc} Miễn phí, xử lý ngay trên trình duyệt, không tải file lên máy chủ.">
<link rel="icon" href="../assets/icon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap">
<link rel="stylesheet" href="../assets/app.css">
<script src="../assets/core.js"></script>
</head>
<body>
<noscript><p style="padding:24px">Trang này cần bật JavaScript để xử lý file ngay trên máy bạn.</p></noscript>
<script src="../assets/tools/{id}.js"></script>
</body>
</html>
"""

for tid, folder, title, desc in TOOLS:
    d = ROOT / folder
    d.mkdir(exist_ok=True)
    (d / "index.html").write_text(PAGE.format(id=tid, title=title, desc=desc), encoding="utf-8")
    print("wrote", folder + "/index.html")

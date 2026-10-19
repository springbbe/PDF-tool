# PDFNhanh

Bộ công cụ PDF tiếng Việt chạy hoàn toàn trên trình duyệt (kiểu iLovePDF), host bằng GitHub Pages: https://springbbe.github.io/PDF-tool/

File không bao giờ rời khỏi máy người dùng: mọi xử lý dùng [pdf-lib (@cantoo)](https://github.com/cantoo-scribe/pdf-lib) và [pdf.js](https://mozilla.github.io/pdf.js/) tải từ CDN.

## Công cụ

| Nhóm | Công cụ | Thư mục |
|---|---|---|
| Sắp xếp | Ghép PDF, Tách PDF, Xoá trang, Sắp xếp trang, Xoay PDF | `ghep-pdf/`, `tach-pdf/`, `xoa-trang-pdf/`, `sap-xep-pdf/`, `xoay-pdf/` |
| Tối ưu | Nén PDF (nén lại ảnh bên trong, giữ chữ vector) | `nen-pdf/` |
| Chuyển đổi | PDF sang ảnh, Ảnh sang PDF, PDF sang văn bản | `pdf-sang-anh/`, `anh-sang-pdf/`, `pdf-sang-van-ban/` |
| Chỉnh sửa | Ký PDF, Đánh số trang, Chèn watermark | `ky-pdf/`, `danh-so-trang/`, `watermark-pdf/` |
| Bảo mật | Đặt mật khẩu (AES-256), Mở khoá PDF | `bao-ve-pdf/`, `mo-khoa-pdf/` |

Mọi công cụ đều nhận file bằng: nút chọn file, kéo thả vào bất cứ đâu, dán (Ctrl/⌘ + V: ảnh chụp màn hình, file đã copy, hoặc link trực tiếp tới file), và nhận file chuyển tiếp từ công cụ khác (“Tiếp tục với file này”).

## Cấu trúc

```
index.html              trang chủ (lưới công cụ, thả/dán file → chọn công cụ)
<thư-mục-công-cụ>/      trang của từng công cụ (sinh bởi scripts/make-pages.py)
assets/app.css          giao diện dùng chung
assets/core.js          lõi: header, nhận file, mở PDF/mật khẩu, khung trang, bảng file/trang, chuyển file giữa công cụ
assets/tools/<id>.js    logic riêng của từng công cụ
scripts/make-pages.py   sinh lại các trang công cụ
scripts/dev-server.py   chạy thử ở máy (không cache)
```

Thêm công cụ mới: thêm vào `PT.TOOLS` trong `assets/core.js` và `TOOLS` trong `scripts/make-pages.py`, viết `assets/tools/<id>.js`, rồi chạy `python3 scripts/make-pages.py`.

## Chạy thử ở máy

```bash
python3 scripts/dev-server.py
```

Mở http://localhost:8765/

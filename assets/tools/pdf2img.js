/* PDF sang ảnh: render chosen pages to JPG or PNG */
(function () {
  const { $, h } = PT;
  let pb;
  const app = PT.shell({
    tool: "pdf2img",
    railTitle: "PDF sang ảnh",
    rail:
      '<div class="group"><span class="lbl">Định dạng</span>' + PT.tiles("fmt", [
        { value: "jpg", label: "JPG", sub: "Nhẹ, hợp ảnh chụp", checked: true },
        { value: "png", label: "PNG", sub: "Nét nhất, chữ không bị mờ" }
      ]) + "</div>" +
      '<div class="group"><label class="lbl" for="dpi">Độ nét</label><div class="sel"><select id="dpi">' +
      '<option value="110">Xem trên điện thoại (110 DPI)</option>' +
      '<option value="150" selected>Tiêu chuẩn (150 DPI)</option>' +
      '<option value="220">Cao (220 DPI)</option>' +
      '<option value="300">In ấn (300 DPI)</option></select></div></div>' +
      '<p class="hint box">Mặc định lấy mọi trang. Bấm vào trang để bỏ chọn hoặc chọn lại (giữ <kbd>Shift</kbd> để chọn cả dãy).</p>' +
      '<div class="summary" id="sum"></div>',
    action: "Chuyển sang ảnh",
    sample: async () => { const f = await PT.samplePdf({ pages: 3 }); f.sample = true; return [f]; },
    onFiles: async (files) => {
      if (files.length > 1) PT.toast("Đã lấy file đầu tiên, công cụ này xử lý từng file một.");
      if (await pb.addFile(files[0])) { pb.pages.forEach((p) => { p.sel = true; }); pb.render(); }
    },
    onReset: () => pb.clear(),
    onGo: () => app.run(run)
  });
  pb = PT.PageBoard(app, {
    tick: "sel", rangeProp: "sel",
    click(p) { p.sel = !p.sel; pb.render(); },
    onChange() {
      const n = pb.pages.filter((p) => p.sel).length;
      $("sum").innerHTML = n ? "Sẽ tạo <b>" + n + "</b> ảnh" + (n > 1 ? " (tải về dạng ZIP)" : "") + "." : "Chưa chọn trang nào.";
      app.setReady(n > 0);
    }
  });
  $("boardTools").prepend(
    PT.pillBtn(null, "Chọn tất cả", () => { pb.pages.forEach((p) => { p.sel = true; }); pb.render(); }),
    PT.pillBtn(null, "Bỏ chọn", () => { pb.pages.forEach((p) => { p.sel = false; }); pb.render(); }));

  async function run() {
    const fmt = PT.radio("fmt"), dpi = +$("dpi").value;
    const mime = fmt === "png" ? "image/png" : "image/jpeg";
    const sel = pb.pages.filter((p) => p.sel);
    const base = PT.baseName(pb.docs[0].name);
    const outs = [];
    for (let i = 0; i < sel.length; i++) {
      const p = sel[i];
      app.status("Đang chuyển trang " + p.n + " (" + (i + 1) + "/" + sel.length + ")…");
      const c = await PT.renderPage(pb.docs[p.doc].js, p.n, { scale: dpi / 72, maxPixels: 36e6 });
      const blob = await new Promise((r) => c.toBlob(r, mime, 0.9));
      outs.push({ name: base + "-trang-" + p.n + "." + fmt, data: blob });
      c.width = c.height = 0;
      app.progress((i + 1) / sel.length);
      await PT.frame();
    }
    if (outs.length === 1) {
      const blob = outs[0].data;
      const url = URL.createObjectURL(blob);
      app.finish({
        blob, name: outs[0].name, title: "Đã chuyển sang ảnh!", info: fmt.toUpperCase() + " · " + PT.fmtSize(blob.size),
        preview: h("img", { class: "imgprev", src: url, alt: "Ảnh trang " + sel[0].n }),
        copy: { label: "Sao chép ảnh", run: () => copyImage(blob) }
      });
    } else {
      const blob = await PT.zip(outs);
      app.finish({ blob, name: base + "-" + outs.length + "-anh.zip", title: "Đã chuyển " + outs.length + " trang sang ảnh!", info: outs.length + " ảnh " + fmt.toUpperCase() + " · " + PT.fmtSize(blob.size) });
    }
  }
  async function copyImage(blob) {
    try {
      let png = blob;
      if (blob.type !== "image/png") {
        const bmp = await createImageBitmap(blob);
        const c = document.createElement("canvas"); c.width = bmp.width; c.height = bmp.height;
        c.getContext("2d").drawImage(bmp, 0, 0);
        png = await new Promise((r) => c.toBlob(r, "image/png"));
      }
      await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
      PT.toast("Đã sao chép ảnh, dán vào Zalo, Word… bằng " + PT.MOD + " + V");
    } catch (e) { PT.toast("Trình duyệt chưa cho sao chép ảnh. Hãy dùng nút Tải file."); }
  }
})();

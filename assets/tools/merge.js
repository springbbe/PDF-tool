/* Ghép PDF: several PDFs → one, in the order shown */
(function () {
  const { $, h } = PT;
  let fb;
  const app = PT.shell({
    tool: "merge", multiple: true,
    pick: "Chọn các file PDF",
    sub: "Nối nhiều file PDF thành một file. Kéo thả để sắp thứ tự, xoay file nếu cần.",
    railTitle: "Ghép PDF",
    rail: '<div class="summary" id="sum"></div><p class="hint">Mẹo: kéo thả các thẻ để đổi thứ tự, hoặc bấm <b>Sắp xếp A→Z</b> để xếp theo tên file. Muốn chọn từng trang? Dùng <a href="' + PT.ROOT + 'sap-xep-pdf/">Sắp xếp trang PDF</a>.</p>',
    action: "Ghép PDF",
    sample: async () => {
      const a = await PT.samplePdf({ name: "bao-cao-quy-1.pdf", pages: 2, title: "Báo cáo quý 1" });
      const b = await PT.samplePdf({ name: "bao-cao-quy-2.pdf", pages: 3, title: "Báo cáo quý 2", tint: "#2A5DB0" });
      a.sample = b.sample = true; return [a, b];
    },
    onFiles: (files) => fb.add(files),
    onReset: () => fb.clear(),
    onGo: () => app.run(merge)
  });
  fb = PT.FileBoard(app, {
    reorder: true, rotate: true, sortable: true,
    onChange() {
      const n = fb.items.length, pages = fb.items.reduce((s, i) => s + (i.pages || 0), 0);
      $("sum").innerHTML = "Sẽ ghép <b>" + n + "</b> file thành một PDF <b>" + pages + "</b> trang.";
      const locked = fb.items.some((i) => i.locked);
      app.setReady(fb.ready() && n >= 2, locked ? "Có file đang khoá, hãy nhập mật khẩu hoặc bỏ file đó." : n === 1 ? "Thêm ít nhất 1 file nữa để ghép." : "");
    }
  });

  async function merge() {
    const L = await PT.lib("pdflib");
    const out = await L.PDFDocument.create();
    const items = fb.items;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      app.status("Đang ghép file " + (i + 1) + "/" + items.length + "…");
      const src = await PT.libDoc(it.bytes, it.password);
      const pages = await out.copyPages(src, src.getPageIndices());
      pages.forEach((p) => {
        if (it.rot) p.setRotation(L.degrees(((p.getRotation().angle || 0) + it.rot) % 360));
        out.addPage(p);
      });
      app.progress((i + 1) / items.length);
      await PT.frame();
    }
    const bytes = await out.save();
    const blob = new Blob([bytes], { type: "application/pdf" });
    app.finish({
      blob, name: "ghep-" + items.length + "-file.pdf",
      title: "Đã ghép " + items.length + " file PDF!",
      info: out.getPageCount() + " trang · " + PT.fmtSize(blob.size)
    });
  }
})();

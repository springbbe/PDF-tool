/* Sắp xếp trang PDF: reorder, rotate, delete, add blank pages, append more PDFs */
(function () {
  const { $ } = PT;
  let pb;
  const app = PT.shell({
    tool: "organize", multiple: true,
    railTitle: "Sắp xếp trang",
    rail:
      '<p class="hint box">Kéo thả trang để đổi thứ tự (hoặc dùng nút ← →). Rê chuột vào trang để xoay hoặc xoá. Thêm file PDF khác để ghép trang của chúng vào.</p>' +
      '<div class="summary" id="sum"></div>',
    action: "Lưu PDF",
    sample: async () => { const f = await PT.samplePdf({ pages: 5 }); f.sample = true; return [f]; },
    onFiles: async (files) => { for (const f of files) await pb.addFile(f); },
    onReset: () => pb.clear(),
    onGo: () => app.run(run)
  });
  let original = [];
  pb = PT.PageBoard(app, {
    reorder: true, rotate: true, remove: true, multiDoc: true,
    onChange() {
      const n = pb.pages.length;
      $("countText").textContent = n + " trang · kéo thả để đổi thứ tự";
      $("sum").innerHTML = "File mới sẽ có <b>" + n + "</b> trang" + (pb.docs.length > 1 ? " từ <b>" + pb.docs.length + "</b> file" : "") + ".";
      app.setReady(n > 0);
    }
  });
  const tools = $("boardTools");
  tools.prepend(
    PT.pillBtn("reverse", "Đảo ngược", () => { pb.pages.reverse(); pb.render(); }, "Đảo ngược thứ tự trang"),
    PT.pillBtn("blank", "Trang trắng", () => {
      const last = pb.pages[pb.pages.length - 1] || { w: 595.28, h: 841.89 };
      const [w, h] = pb.visDims(last);
      pb.pages.push({ key: Math.random(), blank: true, doc: -1, n: 0, rot: 0, w, h });
      pb.render();
      PT.toast("Đã thêm trang trắng ở cuối, kéo đến chỗ bạn muốn.");
    }, "Thêm một trang trắng"),
    PT.pillBtn("rotate", "Đặt lại", () => {
      pb.pages = pb.pages.filter((p) => !p.blank);
      pb.pages.sort((a, b) => a.doc - b.doc || a.n - b.n);
      pb.pages.forEach((p) => { p.rot = 0; });
      pb.render();
    }, "Trở về thứ tự và chiều ban đầu (trang đã xoá không khôi phục)"));

  async function run() {
    const doc = await pb.build(pb.pages);
    const blob = new Blob([await doc.save()], { type: "application/pdf" });
    app.finish({ blob, name: PT.baseName(pb.docs[0] ? pb.docs[0].name : "tai-lieu") + "-da-sap-xep.pdf", title: "Đã lưu thứ tự trang mới!", info: pb.pages.length + " trang · " + PT.fmtSize(blob.size) });
  }
})();

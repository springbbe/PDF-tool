/* Xoay PDF: click a page to turn it, or turn every page at once */
(function () {
  const { $ } = PT;
  let pb;
  const app = PT.shell({
    tool: "rotate",
    railTitle: "Xoay PDF",
    rail:
      '<p class="hint box">Bấm vào một trang để xoay trang đó 90°. Hoặc xoay tất cả cùng lúc:</p>' +
      '<div class="tiles">' +
      '<button type="button" class="tile" id="allL">' + PT.ICON.rotateL + "Xoay trái tất cả</button>" +
      '<button type="button" class="tile" id="allR">' + PT.ICON.rotate + "Xoay phải tất cả</button></div>" +
      '<div class="summary" id="sum"></div>',
    action: "Xoay PDF",
    sample: async () => { const f = await PT.samplePdf({ pages: 4 }); f.sample = true; return [f]; },
    onFiles: async (files) => { if (files.length > 1) PT.toast("Đã lấy file đầu tiên, công cụ này xử lý từng file một."); await pb.addFile(files[0]); },
    onReset: () => pb.clear(),
    onGo: () => app.run(run)
  });
  pb = PT.PageBoard(app, {
    rotate: true,
    click(p) { p.rot = (p.rot + 90) % 360; pb.render(); },
    onChange() {
      const n = pb.pages.filter((p) => p.rot).length;
      $("sum").innerHTML = n ? "Đã xoay <b>" + n + "</b>/" + pb.pages.length + " trang." : "Chưa xoay trang nào.";
      app.setReady(n > 0);
    }
  });
  const all = (d) => { pb.pages.forEach((p) => { p.rot = (p.rot + d + 360) % 360; }); pb.render(); };
  $("allL").addEventListener("click", () => all(-90));
  $("allR").addEventListener("click", () => all(90));
  $("boardTools").prepend(PT.pillBtn(null, "Đặt lại", () => { pb.pages.forEach((p) => { p.rot = 0; }); pb.render(); }));

  async function run() {
    const doc = await pb.build(pb.pages);
    const blob = new Blob([await doc.save()], { type: "application/pdf" });
    app.finish({ blob, name: PT.baseName(pb.docs[0].name) + "-da-xoay.pdf", title: "Đã xoay PDF!", info: pb.pages.length + " trang · " + PT.fmtSize(blob.size) });
  }
})();

/* Xoá trang PDF: click pages to drop them */
(function () {
  const { $ } = PT;
  let pb;
  const app = PT.shell({
    tool: "remove",
    railTitle: "Xoá trang",
    rail:
      '<p class="hint box">Bấm vào những trang muốn bỏ đi. Giữ <kbd>Shift</kbd> để chọn cả dãy.</p>' +
      '<div class="group"><label class="lbl" for="offList">Trang sẽ xoá</label>' +
      '<input class="field" id="offList" inputmode="numeric" autocomplete="off" placeholder="VD: 2, 5-7">' +
      '<p class="field-err" id="offErr" hidden></p></div>' +
      '<div class="summary" id="sum"></div>',
    action: "Xoá trang",
    sample: async () => { const f = await PT.samplePdf({ pages: 5 }); f.sample = true; return [f]; },
    onFiles: async (files) => { if (files.length > 1) PT.toast("Đã lấy file đầu tiên, công cụ này xử lý từng file một."); await pb.addFile(files[0]); },
    onReset: () => pb.clear(),
    onGo: () => app.run(run)
  });
  pb = PT.PageBoard(app, {
    tick: "off", rangeProp: "off",
    click(p) { p.off = !p.off; pb.render(); },
    onChange() {
      const off = pb.pages.filter((p) => p.off), left = pb.pages.length - off.length;
      if (document.activeElement !== $("offList")) $("offList").value = PT.toRanges(off.map((p) => p.n));
      $("sum").innerHTML = off.length ? "Xoá <b>" + off.length + "</b> trang · còn lại <b>" + left + "</b> trang." : "Chưa chọn trang nào để xoá.";
      app.setReady(off.length > 0 && left > 0, left === 0 ? "Không thể xoá hết mọi trang." : "");
    }
  });
  $("boardTools").prepend(PT.pillBtn(null, "Bỏ chọn", () => { pb.pages.forEach((p) => { p.off = false; }); pb.render(); }));
  $("offList").addEventListener("input", () => {
    const r = PT.parseRanges($("offList").value, pb.pages.length);
    $("offErr").hidden = !r.bad; $("offErr").textContent = r.bad ? "File chỉ có " + pb.pages.length + " trang." : "";
    const set = new Set(r.pages);
    pb.pages.forEach((p) => { p.off = set.has(p.n); });
    pb.render();
  });

  async function run() {
    const keep = pb.pages.filter((p) => !p.off);
    const doc = await pb.build(keep);
    const blob = new Blob([await doc.save()], { type: "application/pdf" });
    const removed = pb.pages.length - keep.length;
    app.finish({ blob, name: PT.baseName(pb.docs[0].name) + "-da-xoa-trang.pdf", title: "Đã xoá " + removed + " trang!", info: keep.length + " trang · " + PT.fmtSize(blob.size) });
  }
})();

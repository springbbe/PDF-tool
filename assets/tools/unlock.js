/* Mở khoá PDF: remove the open password (when known) and print/copy restrictions */
(function () {
  const { $, h } = PT;
  let fb;
  const app = PT.shell({
    tool: "unlock", multiple: true,
    railTitle: "Mở khoá PDF",
    rail:
      '<p class="hint box">File chỉ bị chặn in / sao chép sẽ được mở khoá ngay, không cần mật khẩu. File cần mật khẩu để mở thì bạn phải biết mật khẩu đó.</p>' +
      '<div class="summary" id="sum"></div>',
    action: "Mở khoá PDF",
    sampleLabel: "Dùng thử với file mẫu (mật khẩu: 1234)",
    sample: async () => { const f = await PT.samplePdf({ pages: 2, name: "file-mau-mat-khau-1234.pdf", password: "1234" }); f.sample = true; return [f]; },
    onFiles: (files) => fb.add(files),
    onReset: () => fb.clear(),
    onGo: () => app.run(run)
  });
  const state = new WeakMap();
  fb = PT.FileBoard(app, {
    meta(it) {
      if (!state.has(it)) { state.set(it, null); detect(it); }
      const s = state.get(it);
      if (!s) return "Đang kiểm tra…";
      return h("div", { class: "meta" }, it.pages + " trang · ", h("span", { class: s === "none" ? "" : "good", text: s === "none" ? "không có khoá" : s === "owner" ? "chặn in/sao chép" : "đã nhập đúng mật khẩu" }));
    },
    onChange() {
      const items = fb.items;
      const locked = items.filter((i) => i.locked).length;
      $("sum").innerHTML = items.length ? "<b>" + items.length + "</b> file" + (locked ? " · <b>" + locked + "</b> file cần mật khẩu" : "") : "";
      app.setReady(fb.ready(), locked ? "Bấm “Nhập mật khẩu” trên file bị khoá, hoặc bỏ file đó." : "");
    }
  });
  async function detect(it) {
    try {
      const L = await PT.lib("pdflib");
      const d = await L.PDFDocument.load(it.bytes, { ignoreEncryption: true, updateMetadata: false });
      state.set(it, !d.isEncrypted ? "none" : it.password ? "user" : "owner");
    } catch (_) { state.set(it, "owner"); }
    fb.render();
  }

  async function run() {
    const outs = [];
    for (let i = 0; i < fb.items.length; i++) {
      const it = fb.items[i];
      const doc = await PT.libDoc(it.bytes, it.password);
      outs.push({ name: PT.baseName(it.name).replace(/-co-mat-khau$/, "") + "-da-mo-khoa.pdf", data: await doc.save() });
      app.progress((i + 1) / fb.items.length);
      await PT.frame();
    }
    if (outs.length === 1) {
      const blob = new Blob([outs[0].data], { type: "application/pdf" });
      app.finish({ blob, name: outs[0].name, title: "Đã mở khoá PDF!", info: "Không còn mật khẩu · " + PT.fmtSize(blob.size) });
    } else {
      const blob = await PT.zip(outs);
      app.finish({ blob, name: "pdf-da-mo-khoa-" + outs.length + "-file.zip", title: "Đã mở khoá " + outs.length + " file!", info: PT.fmtSize(blob.size) });
    }
  }
})();

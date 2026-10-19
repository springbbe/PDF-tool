/* PDF sang văn bản: pull the text layer out with pdf.js */
(function () {
  const { $, h } = PT;
  let fb;
  const app = PT.shell({
    tool: "text", multiple: true,
    railTitle: "Lấy văn bản",
    rail:
      PT.checkbox("pageMarks", "Ghi rõ số trang", "Thêm dòng “— Trang 3 —” giữa các trang.", true) +
      PT.checkbox("joinLines", "Nối dòng bị ngắt giữa câu", "Hợp khi dán vào Word, Zalo. Bỏ chọn để giữ đúng xuống dòng như PDF.", false) +
      '<p class="hint">PDF scan (chụp từ giấy) chỉ có ảnh, không có chữ để lấy.</p>',
    action: "Lấy văn bản",
    onFiles: (files) => fb.add(files),
    onReset: () => fb.clear(),
    onGo: () => app.run(run)
  });
  fb = PT.FileBoard(app, {
    onChange() { app.setReady(fb.ready(), fb.items.some((i) => i.locked) ? "Có file đang khoá, hãy nhập mật khẩu hoặc bỏ file đó." : ""); }
  });

  async function pageText(js, n) {
    const page = await js.getPage(n);
    const tc = await page.getTextContent();
    let out = "", lastY = null, lastEnd = null;
    for (const it of tc.items) {
      if (!("str" in it)) continue;
      const y = it.transform[5], x = it.transform[4];
      if (lastY !== null && Math.abs(y - lastY) > Math.max(2, (it.height || 10) * 0.6) && !out.endsWith("\n")) out += "\n";
      else if (lastEnd !== null && x - lastEnd > (it.height || 10) * 0.25 && !/\s$/.test(out) && it.str && !/^\s/.test(it.str)) out += " ";
      out += it.str;
      if (it.hasEOL && !out.endsWith("\n")) out += "\n";
      lastY = y; lastEnd = x + (it.width || 0);
    }
    return out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }
  const join = (t) => t.replace(/([^\n.!?:;。])\n(?=[a-zà-ỹđ0-9(“"])/g, "$1 ");

  async function run() {
    const marks = $("pageMarks").checked, joinLines = $("joinLines").checked;
    const totalPages = fb.items.reduce((s, i) => s + i.pages, 0);
    let doneP = 0;
    const outs = [];
    for (const it of fb.items) {
      const parts = [];
      for (let n = 1; n <= it.pages; n++) {
        app.status("Đang đọc " + it.name + ", trang " + n + "/" + it.pages + "…");
        let t = await pageText(it.js, n);
        if (joinLines) t = join(t);
        parts.push(marks ? "— Trang " + n + " —\n" + t : t);
        app.progress(++doneP / totalPages);
        if (n % 5 === 0) await PT.frame();
      }
      outs.push({ name: PT.baseName(it.name) + ".txt", text: parts.join("\n\n"), pages: it.pages, chars: parts.join("").replace(/— Trang \d+ —/g, "").replace(/\s/g, "").length });
    }
    const chars = outs.reduce((s, o) => s + o.chars, 0);
    if (chars < 10 * totalPages) {
      app.status("Gần như không có chữ trong PDF này, có thể là bản scan (chỉ có ảnh).", true);
      if (chars === 0) return;
    }
    const all = outs.length === 1 ? outs[0].text : outs.map((o) => "===== " + o.name + " =====\n\n" + o.text).join("\n\n\n");
    const ta = h("textarea", { readonly: true, "aria-label": "Văn bản lấy được" });
    ta.value = all.length > 200000 ? all.slice(0, 200000) + "\n\n… (còn nữa, hãy tải file .txt để xem đủ)" : all;
    const copy = { label: "Sao chép toàn bộ", run: async () => {
      try { await navigator.clipboard.writeText(all); PT.toast("Đã sao chép " + chars.toLocaleString("vi-VN") + " ký tự"); }
      catch (_) { ta.select(); document.execCommand("copy"); PT.toast("Đã sao chép"); }
    } };
    const bom = "﻿"; // so Notepad on Windows opens Vietnamese correctly
    if (outs.length === 1) {
      const blob = new Blob([bom + outs[0].text], { type: "text/plain;charset=utf-8" });
      app.finish({ blob, name: outs[0].name, title: "Đã lấy văn bản!", info: outs[0].pages + " trang · " + chars.toLocaleString("vi-VN") + " ký tự", preview: h("div", { class: "preview" }, ta), copy, chain: false });
    } else {
      const blob = await PT.zip(outs.map((o) => ({ name: o.name, data: bom + o.text })));
      app.finish({ blob, name: "van-ban-" + outs.length + "-file.zip", title: "Đã lấy văn bản từ " + outs.length + " file!", info: chars.toLocaleString("vi-VN") + " ký tự", preview: h("div", { class: "preview" }, ta), copy, chain: false });
    }
  }
})();

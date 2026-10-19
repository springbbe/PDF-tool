/* Ảnh sang PDF: images (picked, dropped, pasted or taken with the camera) → one PDF or one PDF per image */
(function () {
  const { $, h } = PT;
  const MM = 72 / 25.4;
  const PAPER = { a4: [210, 297], letter: [215.9, 279.4], a5: [148, 210] };
  const QUALITY = { low: { max: 1240, q: 0.62 }, mid: { max: 1754, q: 0.8 }, high: { max: 2480, q: 0.92 } };
  let items = [], uid = 0;
  const st = { from: -1 };

  const cam = h("input", { type: "file", accept: "image/*", capture: "environment", hidden: true });
  document.body.append(cam);
  const app = PT.shell({
    tool: "img2pdf", accept: ["image"], multiple: true,
    pick: "Chọn ảnh",
    sub: "Ghép ảnh JPG, PNG, ảnh chụp màn hình thành một file PDF. Tuỳ chỉnh khổ giấy, hướng trang và lề chỉ trong vài giây.",
    landingExtra: PT.IS_TOUCH ? h("button", { class: "btn2", type: "button", onclick: () => cam.click() }, h("span", { html: PT.ICON.camera, style: { display: "grid" } }), "Chụp ảnh") : null,
    formats: ["JPG", "PNG", "WEBP", "GIF", "BMP"],
    sampleLabel: "Dùng thử với ảnh mẫu",
    railTitle: "Tùy chọn PDF",
    rail:
      '<div class="group"><span class="lbl">Hướng trang</span><div class="tiles" role="radiogroup" aria-label="Hướng trang">' +
      '<label class="opt"><input type="radio" name="orient" value="p" checked><span class="tile"><svg viewBox="0 0 34 44"><rect class="pg" x="1" y="1" width="32" height="42" rx="2"/><rect class="im" x="7" y="10" width="20" height="24" rx="1"/></svg>Dọc</span></label>' +
      '<label class="opt"><input type="radio" name="orient" value="l"><span class="tile"><svg viewBox="0 0 44 34" style="height:31px;margin-block:4px"><rect class="pg" x="1" y="1" width="42" height="32" rx="2"/><rect class="im" x="10" y="7" width="24" height="20" rx="1"/></svg>Ngang</span></label>' +
      '<label class="opt"><input type="radio" name="orient" value="auto"><span class="tile"><svg viewBox="0 0 48 44"><rect class="pg" x="1" y="5" width="22" height="30" rx="2"/><rect class="pg" x="21" y="13" width="26" height="20" rx="2"/></svg>Theo ảnh</span></label></div></div>' +
      '<div class="group"><label class="lbl" for="size">Khổ giấy</label><div class="sel"><select id="size">' +
      '<option value="fit">Vừa khít ảnh (giống kích thước ảnh)</option><option value="a4" selected>A4 (297 × 210 mm)</option>' +
      '<option value="letter">US Letter (215 × 279,4 mm)</option><option value="a5">A5 (210 × 148 mm)</option></select></div></div>' +
      '<div class="group"><span class="lbl">Lề</span><div class="tiles" role="radiogroup" aria-label="Lề">' +
      '<label class="opt"><input type="radio" name="margin" value="0" checked><span class="tile"><svg viewBox="0 0 34 44"><rect class="pg" x="1" y="1" width="32" height="42" rx="2"/><rect class="im" x="3" y="3" width="28" height="38"/></svg>Không lề</span></label>' +
      '<label class="opt"><input type="radio" name="margin" value="10"><span class="tile"><svg viewBox="0 0 34 44"><rect class="pg" x="1" y="1" width="32" height="42" rx="2"/><rect class="im" x="7" y="7" width="20" height="30"/></svg>Lề nhỏ</span></label>' +
      '<label class="opt"><input type="radio" name="margin" value="25"><span class="tile"><svg viewBox="0 0 34 44"><rect class="pg" x="1" y="1" width="32" height="42" rx="2"/><rect class="im" x="11" y="11" width="12" height="22"/></svg>Lề lớn</span></label></div></div>' +
      '<div class="group"><label class="lbl" for="quality">Chất lượng ảnh</label><div class="sel"><select id="quality">' +
      '<option value="low">Nhẹ: file nhỏ, gửi Zalo/email</option><option value="mid" selected>Khuyên dùng: cân bằng</option><option value="high">Cao: nét nhất, file lớn</option></select></div></div>' +
      PT.checkbox("merge", "Gộp tất cả ảnh vào một file PDF", "Bỏ chọn để mỗi ảnh thành một PDF riêng (tải về dạng ZIP).", true),
    action: "Chuyển sang PDF",
    libs: ["pdflib"],
    sample: sampleBlobs,
    onFiles: (files, how) => addBlobs(files, how === "sample"),
    onReset: () => clear(),
    onGo: () => app.run(convert)
  });
  cam.addEventListener("change", () => { addBlobs([...cam.files]); cam.value = ""; });

  PT.boardHead(app.board);
  const banner = h("p", { class: "banner", hidden: true, text: "Đây là ảnh mẫu. Thêm ảnh của bạn, ảnh mẫu sẽ tự được thay thế." });
  const list = h("ol", { class: "cards" });
  app.board.append(banner, list);
  $("boardTools").append(
    PT.pillBtn("sort", "Sắp xếp A→Z", () => { items.sort((a, b) => a.name.localeCompare(b.name, "vi", { numeric: true })); render(); }, "Sắp xếp theo tên file"),
    PT.pillBtn(null, "Xoá hết", () => { clear(); app.show("landing"); }));

  const opts = () => ({ size: $("size").value, orient: PT.radio("orient"), margin: +PT.radio("margin"), quality: $("quality").value, merge: $("merge").checked });
  const rotDims = (it) => it.rot % 180 === 0 ? [it.w, it.h] : [it.h, it.w];
  function pageDims(it, o) { // mm
    const [iw, ih] = rotDims(it);
    if (o.size === "fit") { const s = 297 / Math.max(iw, ih); return [iw * s + 2 * o.margin, ih * s + 2 * o.margin]; }
    const [pw, ph] = PAPER[o.size];
    const land = o.orient === "l" || (o.orient === "auto" && iw > ih);
    return land ? [ph, pw] : [pw, ph];
  }
  function drawRotated(it, maxSide) {
    const [rw, rh] = rotDims(it);
    const s = Math.min(1, maxSide / Math.max(rw, rh));
    const cw = Math.max(1, Math.round(rw * s)), ch = Math.max(1, Math.round(rh * s));
    const c = document.createElement("canvas"); c.width = cw; c.height = ch;
    const g = c.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, cw, ch);
    g.translate(cw / 2, ch / 2); g.rotate(it.rot * Math.PI / 180);
    g.imageSmoothingQuality = "high";
    g.drawImage(it.img, -it.w * s / 2, -it.h * s / 2, it.w * s, it.h * s);
    return c;
  }
  const makeThumb = (it) => { it.thumb = drawRotated(it, 400).toDataURL("image/jpeg", 0.82); };

  async function addBlobs(blobs, sample) {
    if (!blobs.length) return;
    if (!sample && items.some((i) => i.sample)) { items.filter((i) => i.sample).forEach((i) => URL.revokeObjectURL(i.url)); items = items.filter((i) => !i.sample); }
    const failed = [];
    for (const b of blobs) {
      const url = URL.createObjectURL(b);
      try {
        const img = await PT.loadImg(url);
        const it = { id: ++uid, name: b.name || ("anh-" + uid + ".png"), url, img, w: img.naturalWidth, h: img.naturalHeight, rot: 0, sample: !!sample };
        makeThumb(it); items.push(it);
      } catch (e) { URL.revokeObjectURL(url); failed.push(b.name || "ảnh"); }
    }
    if (items.length) { if (app.step !== "ws") app.show("ws"); render(); }
    if (failed.length) PT.toast("Không đọc được " + failed.join(", ") + ". Hãy chuyển sang JPG hoặc PNG rồi thử lại.");
    else if (!sample && blobs.length) PT.toast("Đã thêm " + blobs.length + " ảnh");
  }
  function clear() { items.forEach((i) => URL.revokeObjectURL(i.url)); items = []; render(); }
  function move(from, to) { if (to < 0 || to >= items.length || from === to) return; const [it] = items.splice(from, 1); items.splice(to, 0, it); render(); }

  function render() {
    const o = opts(), small = window.innerWidth <= 480;
    list.textContent = "";
    items.forEach((it, idx) => {
      const [pw, ph] = pageDims(it, o);
      const li = h("li", { class: "card", tabindex: "0", "aria-label": "Trang " + (idx + 1) + ": " + it.name });
      const sheet = h("div", { class: "sheet", style: { aspectRatio: pw + " / " + ph, width: "min(100%, " + Math.round((small ? 160 : 200) * pw / ph) + "px)" } },
        h("div", { class: "in", style: { padding: (o.margin / pw * 100) + "%" } }, h("img", { class: "pg", src: it.thumb, alt: "" })));
      li.append(
        h("span", { class: "num", text: idx + 1 }),
        h("div", { class: "hover-acts" },
          h("button", { type: "button", class: "ic", title: "Xoay", "aria-label": "Xoay ảnh " + (idx + 1), html: PT.ICON.rotate, onclick: () => { it.rot = (it.rot + 90) % 360; makeThumb(it); render(); } }),
          h("button", { type: "button", class: "ic", title: "Xoá", "aria-label": "Xoá ảnh " + (idx + 1), html: PT.ICON.del, onclick: () => { URL.revokeObjectURL(it.url); items.splice(idx, 1); if (!items.length) app.show("landing"); render(); } })),
        h("div", { class: "slot" }, sheet),
        h("div", { class: "fname", title: it.name, text: it.name }),
        h("div", { class: "order" },
          h("button", { type: "button", text: "←", title: "Đưa lên trước", "aria-label": "Đưa ảnh " + (idx + 1) + " lên trước", disabled: idx === 0, onclick: () => move(idx, idx - 1) }),
          h("button", { type: "button", text: "→", title: "Đưa ra sau", "aria-label": "Đưa ảnh " + (idx + 1) + " ra sau", disabled: idx === items.length - 1, onclick: () => move(idx, idx + 1) })));
      li.draggable = true;
      li.addEventListener("dragstart", (e) => { st.from = idx; li.classList.add("dragging"); e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", String(idx)); } catch (_) {} });
      li.addEventListener("dragend", () => { st.from = -1; li.classList.remove("dragging"); list.querySelectorAll(".target").forEach((c) => c.classList.remove("target")); });
      li.addEventListener("dragover", (e) => { if (st.from < 0) return; e.preventDefault(); e.stopPropagation(); li.classList.add("target"); });
      li.addEventListener("dragleave", () => li.classList.remove("target"));
      li.addEventListener("drop", (e) => { if (st.from < 0) return; e.preventDefault(); e.stopPropagation(); const f = st.from; st.from = -1; move(f, idx); });
      list.append(li);
    });
    list.append(
      h("li", null, h("button", { type: "button", class: "add-card", onclick: () => app.pick() }, h("span", { class: "plus", text: "+" }), "Thêm ảnh")),
      PT.IS_TOUCH ? h("li", null, h("button", { type: "button", class: "add-card", onclick: () => cam.click() }, h("span", { class: "plus", html: PT.ICON.camera, style: { padding: "11px" } }), "Chụp ảnh")) : null,
      h("li", null, PT.pasteBox(null, "Dán ảnh")));
    const n = items.length;
    $("badge").textContent = n;
    $("countText").textContent = n + " ảnh · kéo thả để đổi thứ tự trang";
    banner.hidden = !items.some((i) => i.sample);
    app.setReady(n > 0);
    document.querySelectorAll('input[name="orient"]').forEach((x) => { x.disabled = o.size === "fit"; });
  }
  PT.onInput("#size, #quality, #merge, input[name=orient], input[name=margin]", render);

  async function pdfFor(list, o, L, onStep) {
    const Q = QUALITY[o.quality];
    const doc = await L.PDFDocument.create();
    for (const it of list) {
      const [pw, ph] = pageDims(it, o).map((v) => v * MM);
      const m = o.margin * MM;
      const page = doc.addPage([pw, ph]);
      const c = drawRotated(it, Q.max);
      const img = await doc.embedJpg(await PT.canvasBytes(c, "image/jpeg", Q.q));
      const s = Math.min((pw - 2 * m) / c.width, (ph - 2 * m) / c.height);
      const dw = c.width * s, dh = c.height * s;
      page.drawImage(img, { x: (pw - dw) / 2, y: (ph - dh) / 2, width: dw, height: dh });
      if (onStep) await onStep();
    }
    return doc.save();
  }
  async function convert() {
    const L = await PT.lib("pdflib");
    const o = opts();
    let done = 0;
    const step = async () => { done++; app.progress(done / items.length); app.status("Đang xử lý ảnh " + Math.min(done + 1, items.length) + "/" + items.length + "…"); await PT.frame(); };
    if (o.merge || items.length === 1) {
      const bytes = await pdfFor(items, o, L, step);
      const blob = new Blob([bytes], { type: "application/pdf" });
      app.finish({ blob, name: items.length === 1 ? PT.baseName(items[0].name) + ".pdf" : "anh-ghep-" + items.length + "-trang.pdf", title: "Ảnh đã được chuyển sang PDF!", info: items.length + " trang · " + PT.fmtSize(blob.size) });
    } else {
      const outs = [];
      for (const it of items) outs.push({ name: PT.baseName(it.name) + ".pdf", data: await pdfFor([it], o, L, step) });
      const blob = await PT.zip(outs);
      app.finish({ blob, name: "anh-sang-pdf-" + items.length + "-file.zip", title: "Đã chuyển " + items.length + " ảnh thành " + items.length + " file PDF!", info: items.length + " file PDF · " + PT.fmtSize(blob.size) });
    }
  }

  async function sampleBlobs() {
    const pal = [["#E0453A", "#FDECEA"], ["#2A5DB0", "#E3EBF8"], ["#1E7A55", "#E0F2EA"]];
    const dims = [[900, 1200], [1400, 900], [1000, 1000]];
    const out = [];
    for (let i = 0; i < 3; i++) {
      const [w, hh] = dims[i];
      const c = document.createElement("canvas"); c.width = w; c.height = hh;
      const g = c.getContext("2d");
      g.fillStyle = pal[i][1]; g.fillRect(0, 0, w, hh); g.fillStyle = pal[i][0];
      for (let k = 0; k < 6; k++) { g.globalAlpha = .12 + k * .05; g.beginPath(); g.arc(w * (.15 + k * .15), hh * .72, hh * (.08 + k * .02), 0, Math.PI * 2); g.fill(); }
      g.globalAlpha = 1;
      g.font = "800 " + Math.round(hh * .09) + "px 'Be Vietnam Pro', sans-serif"; g.fillText("Ảnh mẫu " + (i + 1), w * .08, hh * .2);
      g.font = "500 " + Math.round(hh * .035) + "px 'Be Vietnam Pro', sans-serif"; g.fillText(w + " × " + hh + " px", w * .08, hh * .28);
      const b = await new Promise((r) => c.toBlob(r, "image/png"));
      out.push(new File([b], "anh-mau-" + (i + 1) + ".png", { type: "image/png" }));
    }
    return out;
  }
})();

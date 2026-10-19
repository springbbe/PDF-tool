/* Chèn watermark: text (any Vietnamese text, drawn as a crisp image) or a logo, live preview on thumbnails */
(function () {
  const { $, h } = PT;
  const GRID = [["tl", "Trên trái"], ["tc", "Trên giữa"], ["tr", "Trên phải"], ["ml", "Giữa trái"], ["mc", "Chính giữa"], ["mr", "Giữa phải"], ["bl", "Dưới trái"], ["bc", "Dưới giữa"], ["br", "Dưới phải"]];
  let pb, logo = null, mark = null;
  const app = PT.shell({
    tool: "watermark", wsAccept: ["image"],
    railTitle: "Watermark",
    rail:
      '<div class="group">' + PT.tiles("kind", [{ value: "text", label: "Chữ", checked: true }, { value: "image", label: "Hình ảnh / logo" }]) + "</div>" +
      '<div class="group" id="gText"><label class="lbl" for="wmText">Nội dung</label><input class="field" id="wmText" value="BẢN SAO" maxlength="80" autocomplete="off">' +
      '<div class="swatches" role="radiogroup" aria-label="Màu chữ">' +
      [["#9AA0A6", "Xám"], ["#E0453A", "Đỏ"], ["#1A4FA0", "Xanh"], ["#1E8A5A", "Xanh lá"], ["#000000", "Đen"]].map(([c, n], i) =>
        '<label title="' + n + '"><input type="radio" name="color" value="' + c + '" aria-label="' + n + '"' + (i === 0 ? " checked" : "") + '><span style="background:' + c + '"></span></label>').join("") + "</div>" +
      '<label class="lbl" for="fsize">Cỡ chữ <output id="fsizeOut">64</output></label><input type="range" id="fsize" min="16" max="160" value="64"></div>' +
      '<div class="group" id="gImage" hidden><span class="lbl">Ảnh / logo</span>' +
      '<div id="logoPrev" class="hint box">Chưa có ảnh. Bấm nút dưới, hoặc dán ảnh (' + PT.MOD + ' + V), hoặc kéo ảnh vào trang.</div>' +
      '<button class="btn2" type="button" id="pickLogo">Chọn ảnh…</button>' +
      '<label class="lbl" for="lsize">Độ rộng <output id="lsizeOut">40%</output></label><input type="range" id="lsize" min="5" max="100" value="40"></div>' +
      '<div class="group"><label class="lbl" for="opacity">Độ đậm <output id="opOut">30%</output></label><input type="range" id="opacity" min="5" max="100" value="30"></div>' +
      '<div class="group"><span class="lbl">Góc xoay</span>' + PT.tiles("angle", [{ value: "0", label: "Ngang" }, { value: "45", label: "Chéo lên", checked: true }, { value: "-45", label: "Chéo xuống" }]) + "</div>" +
      '<div class="group"><span class="lbl">Vị trí</span><div class="posrow"><div class="posgrid" role="radiogroup" aria-label="Vị trí">' +
      GRID.map(([v, l]) => '<label title="' + l + '"><input type="radio" name="pos" value="' + v + '" aria-label="' + l + '"' + (v === "mc" ? " checked" : "") + "><span></span></label>").join("") +
      "</div><div>" + PT.checkbox("tile", "Lặp kín trang", "Khó cắt bỏ hơn") + "</div></div></div>" +
      '<div class="group"><span class="lbl">Áp dụng cho</span>' +
      '<div class="tiles"><label class="opt"><input type="radio" name="which" value="all" checked><span class="tile">Mọi trang</span></label>' +
      '<label class="opt"><input type="radio" name="which" value="some"><span class="tile">Một số trang</span></label></div>' +
      '<input class="field" id="which" placeholder="VD: 1-3, 5" inputmode="numeric" hidden></div>',
    action: "Chèn watermark",
    sample: async () => { const f = await PT.samplePdf({ pages: 4 }); f.sample = true; return [f]; },
    onFiles: async (files) => {
      const imgs = files.filter((f) => !PT.isPdf(f)), pdfs = files.filter(PT.isPdf);
      if (pdfs.length) await pb.addFile(pdfs[0]);
      if (imgs.length) await setLogo(imgs[0]);
    },
    onReset: () => pb.clear(),
    onGo: () => app.run(run)
  });

  const o = () => ({
    kind: PT.radio("kind"), text: $("wmText").value.trim(), color: PT.radio("color"), fsize: +$("fsize").value,
    lsize: +$("lsize").value / 100, opacity: +$("opacity").value / 100, angle: +PT.radio("angle"), pos: PT.radio("pos"), tile: $("tile").checked
  });

  async function setLogo(file) {
    try {
      const url = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
      const img = await PT.loadImg(url);
      // re-encode as PNG so pdf-lib can embed any browser-readable format
      const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext("2d").drawImage(img, 0, 0);
      logo = { url: c.toDataURL("image/png"), ratio: img.naturalHeight / img.naturalWidth };
      $("logoPrev").textContent = "";
      $("logoPrev").append(h("img", { src: logo.url, alt: "", style: { maxHeight: "80px", display: "block", margin: "0 auto" } }));
      document.querySelector('input[name="kind"][value="image"]').checked = true;
      refresh();
      PT.toast("Đã dùng ảnh làm watermark");
    } catch (_) { PT.toast("Không đọc được ảnh này. Hãy thử ảnh PNG hoặc JPG."); }
  }

  // text → transparent PNG at 4 px per point (keeps Vietnamese accents, looks crisp when printed)
  function textMark(x) {
    const K = 4, px = x.fsize * K;
    const c = document.createElement("canvas"), g = c.getContext("2d");
    const font = "800 " + px + "px 'Be Vietnam Pro', sans-serif";
    g.font = font;
    const tw = Math.ceil(g.measureText(x.text || " ").width);
    c.width = Math.max(1, tw + px * 0.2); c.height = Math.ceil(px * 1.35);
    g.font = font; g.fillStyle = x.color; g.textBaseline = "middle";
    g.fillText(x.text, px * 0.1, c.height / 2);
    return { url: c.toDataURL("image/png"), w: c.width / K, h: c.height / K };
  }
  function makeMark() {
    const x = o();
    if (x.kind === "text") mark = x.text ? Object.assign({ kind: "text" }, textMark(x)) : null;
    else mark = logo ? { kind: "image", url: logo.url, ratio: logo.ratio } : null;
  }
  // centres (from the top-left of the visible page, in pt) of every stamp on a page
  function layout(vw, vh, x) {
    let w, hh;
    if (mark.kind === "text") { w = mark.w; hh = mark.h; } else { w = vw * x.lsize; hh = w * mark.ratio; }
    const a = x.angle * Math.PI / 180, bw = Math.abs(w * Math.cos(a)) + Math.abs(hh * Math.sin(a)), bh = Math.abs(w * Math.sin(a)) + Math.abs(hh * Math.cos(a));
    const out = [];
    if (x.tile) {
      const sx = bw + Math.max(40, w * 0.35), sy = bh + Math.max(40, hh * 1.5);
      for (let row = 0, cy = sy / 2 - 10; cy < vh + bh / 2; cy += sy, row++)
        for (let cx = (row % 2 ? sx / 2 : 0) + bw / 2 - 20; cx < vw + bw / 2; cx += sx) out.push({ cx, cy, w, h: hh });
    } else {
      const m = 28;
      const cx = x.pos[1] === "l" ? m + bw / 2 : x.pos[1] === "r" ? vw - m - bw / 2 : vw / 2;
      const cy = x.pos[0] === "t" ? m + bh / 2 : x.pos[0] === "b" ? vh - m - bh / 2 : vh / 2;
      out.push({ cx, cy, w, h: hh });
    }
    return out;
  }
  function chosen() {
    if (PT.radio("which") === "all") return null;
    return new Set(PT.parseRanges($("which").value, pb.pages.length).pages);
  }

  pb = PT.PageBoard(app, {
    decorate(sheet, p, idx) {
      if (!mark) return;
      const sel = chosen();
      if (sel && !sel.has(idx + 1)) return;
      const x = o(), [vw, vh] = pb.visDims(p);
      layout(vw, vh, x).forEach((s) => {
        sheet.append(h("img", { class: "deco", src: mark.url, alt: "", style: {
          position: "absolute", zIndex: 2, pointerEvents: "none", opacity: x.opacity, maxWidth: "none",
          left: ((s.cx - s.w / 2) / vw * 100) + "%", top: ((s.cy - s.h / 2) / vh * 100) + "%",
          width: (s.w / vw * 100) + "%", height: (s.h / vh * 100) + "%", transform: "rotate(" + (-x.angle) + "deg)"
        } }));
      });
    },
    onChange() { app.setReady(!!mark && pb.pages.length > 0, mark ? "" : (o().kind === "image" ? "Hãy chọn hoặc dán ảnh làm watermark." : "Hãy nhập nội dung watermark.")); }
  });

  function refresh() {
    const x = o();
    $("gText").hidden = x.kind !== "text"; $("gImage").hidden = x.kind !== "image";
    $("fsizeOut").textContent = x.fsize; $("lsizeOut").textContent = Math.round(x.lsize * 100) + "%"; $("opOut").textContent = Math.round(x.opacity * 100) + "%";
    $("which").hidden = PT.radio("which") !== "some";
    document.querySelectorAll('input[name="pos"]').forEach((r) => { r.disabled = x.tile; });
    makeMark();
    pb.redecorate();
    app.setReady(!!mark && pb.pages.length > 0, mark ? "" : (x.kind === "image" ? "Hãy chọn hoặc dán ảnh làm watermark." : "Hãy nhập nội dung watermark."));
  }
  PT.onInput('input[name="kind"], #wmText, input[name="color"], #fsize, #lsize, #opacity, input[name="angle"], input[name="pos"], #tile, input[name="which"], #which', refresh);
  $("pickLogo").addEventListener("click", () => app.intake.pick("image/*"));
  document.fonts && document.fonts.load("800 40px 'Be Vietnam Pro'").then(refresh).catch(() => {});
  makeMark();

  async function run() {
    const L = await PT.lib("pdflib");
    const x = o(), d = pb.docs[0];
    const doc = await PT.libDoc(d.bytes, d.password);
    const img = await doc.embedPng(PT.dataUrlBytes(mark.url));
    const sel = chosen();
    const pages = doc.getPages();
    pages.forEach((page, idx) => {
      if (sel && !sel.has(idx + 1)) return;
      const g = PT.geom(page);
      layout(g.VW, g.VH, x).forEach((s) => {
        const pl = PT.place(g, { x: s.cx - s.w / 2, y: s.cy - s.h / 2, w: s.w, h: s.h, angle: x.angle }, L.degrees);
        page.drawImage(img, Object.assign(pl, { opacity: x.opacity }));
      });
    });
    const blob = new Blob([await doc.save()], { type: "application/pdf" });
    app.finish({ blob, name: PT.baseName(d.name) + "-watermark.pdf", title: "Đã chèn watermark!", info: pages.length + " trang · " + PT.fmtSize(blob.size) });
  }
})();

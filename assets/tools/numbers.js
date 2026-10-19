/* Đánh số trang: live preview on the thumbnails, vector text in the output */
(function () {
  const { $, h } = PT;
  const POS = [["tl", "Trên trái"], ["tc", "Trên giữa"], ["tr", "Trên phải"], ["bl", "Dưới trái"], ["bc", "Dưới giữa"], ["br", "Dưới phải"]];
  let pb;
  const app = PT.shell({
    tool: "numbers",
    railTitle: "Đánh số trang",
    rail:
      '<div class="group"><span class="lbl">Vị trí</span><div class="posrow"><div class="posgrid" role="radiogroup" aria-label="Vị trí số trang" style="grid-template-rows:auto auto">' +
      POS.map(([v, l]) => '<label title="' + l + '"><input type="radio" name="pos" value="' + v + '" aria-label="' + l + '"' + (v === "bc" ? " checked" : "") + "><span></span></label>").join("") +
      '</div><p id="posName">Dưới giữa</p></div></div>' +
      '<div class="group"><label class="lbl" for="fmt">Kiểu số</label><div class="sel"><select id="fmt">' +
      '<option value="{n}">1</option><option value="Trang {n}">Trang 1</option><option value="{n} / {N}" selected>1 / 10</option>' +
      '<option value="Trang {n} / {N}">Trang 1 / 10</option><option value="- {n} -">- 1 -</option></select></div></div>' +
      '<div class="group"><span class="lbl">Bỏ qua trang đầu</span>' +
      '<div class="tiles"><label class="opt"><input type="radio" name="skip" value="0" checked><span class="tile">Đánh số từ trang 1</span></label>' +
      '<label class="opt"><input type="radio" name="skip" value="1"><span class="tile">Không đánh trang bìa</span></label></div></div>' +
      '<details class="more"><summary>Tùy chỉnh thêm</summary><div>' +
      '<div class="group"><label class="lbl" for="startNo">Số bắt đầu</label><input class="field" id="startNo" type="number" min="0" value="1" inputmode="numeric"></div>' +
      '<div class="group"><label class="lbl" for="size">Cỡ chữ</label><div class="sel"><select id="size"><option value="9">Nhỏ</option><option value="11" selected>Vừa</option><option value="14">Lớn</option><option value="18">Rất lớn</option></select></div></div>' +
      '<div class="group"><label class="lbl" for="margin">Khoảng cách tới mép</label><div class="sel"><select id="margin"><option value="18">Sát mép</option><option value="30" selected>Vừa</option><option value="46">Xa mép</option></select></div></div>' +
      '<div class="group"><span class="lbl">Màu chữ</span><div class="swatches">' +
      '<label title="Đen"><input type="radio" name="color" value="#000000" checked aria-label="Đen"><span style="background:#000"></span></label>' +
      '<label title="Xám"><input type="radio" name="color" value="#6B6F80" aria-label="Xám"><span style="background:#6B6F80"></span></label>' +
      '<label title="Đỏ"><input type="radio" name="color" value="#C62828" aria-label="Đỏ"><span style="background:#C62828"></span></label>' +
      '<label title="Xanh"><input type="radio" name="color" value="#1A4FA0" aria-label="Xanh"><span style="background:#1A4FA0"></span></label>' +
      "</div></div></div></details>",
    action: "Đánh số trang",
    sample: async () => { const f = await PT.samplePdf({ pages: 4 }); f.sample = true; return [f]; },
    onFiles: async (files) => { if (files.length > 1) PT.toast("Đã lấy file đầu tiên, công cụ này xử lý từng file một."); await pb.addFile(files[0]); },
    onReset: () => pb.clear(),
    onGo: () => app.run(run)
  });

  const opts = () => ({
    pos: PT.radio("pos"), fmt: $("fmt").value, skip: +PT.radio("skip"),
    start: parseInt($("startNo").value, 10) || 0, size: +$("size").value, margin: +$("margin").value, color: PT.radio("color")
  });
  const label = (o, idx, total) => {
    if (idx < o.skip) return null;
    const n = o.start + idx - o.skip, N = o.start + total - 1 - o.skip;
    return o.fmt.replace("{n}", n).replace("{N}", N);
  };
  pb = PT.PageBoard(app, {
    decorate(sheet, p, idx) {
      const o = opts(), t = label(o, idx, pb.pages.length);
      if (t == null) return;
      const [vw, vh] = pb.visDims(p);
      const el = h("div", { class: "deco", text: t });
      Object.assign(el.style, {
        position: "absolute", zIndex: 2, lineHeight: 1, whiteSpace: "nowrap", color: o.color, fontFamily: "Helvetica, Arial, sans-serif",
        fontSize: (o.size / vw * 100) + "cqw"
      });
      const mx = (o.margin / vw * 100) + "%", my = ((o.margin - o.size * 0.2) / vh * 100) + "%";
      if (o.pos[0] === "t") el.style.top = my; else el.style.bottom = my;
      if (o.pos[1] === "l") el.style.left = mx;
      else if (o.pos[1] === "r") el.style.right = mx;
      else { el.style.left = "50%"; el.style.transform = "translateX(-50%)"; }
      sheet.append(el);
    },
    onChange() { app.setReady(pb.pages.length > 0); }
  });
  PT.onInput('input[name="pos"], #fmt, input[name="skip"], #startNo, #size, #margin, input[name="color"]', () => {
    $("posName").textContent = POS.find((x) => x[0] === PT.radio("pos"))[1];
    pb.redecorate();
  });

  async function run() {
    const L = await PT.lib("pdflib");
    const o = opts();
    const d = pb.docs[0];
    const doc = await PT.libDoc(d.bytes, d.password);
    const font = await doc.embedFont(L.StandardFonts.Helvetica);
    const hex = o.color.slice(1), color = L.rgb(parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255);
    const pages = doc.getPages();
    pages.forEach((page, idx) => {
      const t = label(o, idx, pages.length);
      if (t == null) return;
      const g = PT.geom(page);
      const tw = font.widthOfTextAtSize(t, o.size);
      const vx = o.pos[1] === "l" ? o.margin : o.pos[1] === "r" ? g.VW - o.margin - tw : (g.VW - tw) / 2;
      const vy = o.pos[0] === "b" ? o.margin : g.VH - o.margin - o.size * 0.72;
      const [x, y] = PT.toUser(g, vx, vy);
      page.drawText(t, { x, y, size: o.size, font, color, rotate: L.degrees(g.r) });
    });
    const blob = new Blob([await doc.save()], { type: "application/pdf" });
    app.finish({ blob, name: PT.baseName(d.name) + "-danh-so.pdf", title: "Đã đánh số trang!", info: pages.length + " trang · " + PT.fmtSize(blob.size) });
  }
})();

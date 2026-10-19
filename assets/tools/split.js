/* Tách PDF: by ranges, every N pages, or pick pages to extract */
(function () {
  const { $, h } = PT;
  const COLORS = ["#E0453A", "#2A5DB0", "#1E8A5A", "#D98A06", "#7A4DD8", "#0E8C9B"];
  let pb;
  const app = PT.shell({
    tool: "split",
    railTitle: "Tách PDF",
    rail:
      '<div class="group"><span class="lbl">Cách tách</span>' + PT.tiles("mode", [
        { value: "range", label: "Theo khoảng trang", sub: "Mỗi khoảng thành một file", checked: true },
        { value: "every", label: "Cứ mỗi N trang", sub: "Chia đều thành nhiều file" },
        { value: "pick", label: "Chọn trang để lấy", sub: "Bấm chọn trang trên màn hình" }
      ], true) + "</div>" +
      '<div class="group" id="gRange"><label class="lbl" for="ranges">Các khoảng trang</label>' +
      '<input class="field" id="ranges" inputmode="numeric" autocomplete="off" placeholder="VD: 1-3, 4-6, 9">' +
      '<p class="field-err" id="rangeErr" hidden></p>' +
      '<p class="hint">Ngăn cách bằng dấu phẩy. “5-” nghĩa là từ trang 5 đến hết.</p>' +
      PT.checkbox("mergeRanges", "Gộp tất cả khoảng vào một file", "Dùng khi chỉ muốn lấy ra vài đoạn.") + "</div>" +
      '<div class="group" id="gEvery" hidden><label class="lbl" for="everyN">Mỗi file gồm bao nhiêu trang?</label>' +
      '<input class="field" id="everyN" type="number" min="1" value="1" inputmode="numeric"></div>' +
      '<div class="group" id="gPick" hidden><label class="lbl" for="picked">Trang đã chọn</label>' +
      '<input class="field" id="picked" inputmode="numeric" autocomplete="off" placeholder="Bấm vào trang hoặc gõ: 1, 3, 5-7">' +
      '<p class="hint">Bấm vào trang để chọn. Giữ <kbd>Shift</kbd> để chọn cả dãy.</p>' +
      PT.checkbox("pickSeparate", "Mỗi trang đã chọn thành một file riêng") + "</div>" +
      '<div class="summary" id="sum"></div>',
    action: "Tách PDF",
    sample: async () => { const f = await PT.samplePdf({ pages: 6 }); f.sample = true; return [f]; },
    onFiles: async (files) => {
      if (files.length > 1) PT.toast("Công cụ này tách từng file một, đã lấy file đầu tiên.");
      if (await pb.addFile(files[0])) {
        const n = pb.pages.length, half = Math.ceil(n / 2);
        $("ranges").value = n > 1 ? "1-" + half + (half < n ? ", " + (half + 1) + "-" + n : "") : "1";
        update();
      }
    },
    onReset: () => pb.clear(),
    onGo: () => app.run(split)
  });
  const mode = () => PT.radio("mode");
  pb = PT.PageBoard(app, {
    tick: () => mode() === "pick" ? "sel" : null,
    rangeProp: "sel",
    click(p) { if (mode() !== "pick") { selectMode(); } p.sel = !p.sel; syncPicked(); pb.render(); },
    group(p) { const gi = groupIndex.get(p.n); return gi == null ? null : COLORS[gi % COLORS.length]; },
    onChange: () => summary()
  });
  $("boardTools").prepend(
    PT.pillBtn(null, "Chọn tất cả", () => { selectMode(); pb.pages.forEach((p) => { p.sel = true; }); syncPicked(); pb.render(); }),
    PT.pillBtn(null, "Bỏ chọn", () => { pb.pages.forEach((p) => { p.sel = false; }); syncPicked(); pb.render(); }));

  let groupIndex = new Map(), outputs = [];
  function selectMode() { document.querySelector('input[name="mode"][value="pick"]').checked = true; showGroups(); }
  function syncPicked() { $("picked").value = PT.toRanges(pb.pages.filter((p) => p.sel).map((p) => p.n)); }
  function showGroups() {
    const m = mode();
    $("gRange").hidden = m !== "range"; $("gEvery").hidden = m !== "every"; $("gPick").hidden = m !== "pick";
  }
  function compute() {
    const n = pb.pages.length, m = mode();
    let groups = [], err = "";
    if (m === "range") {
      const r = PT.parseRanges($("ranges").value, n);
      if (r.bad) err = "Có khoảng không hợp lệ (file chỉ có " + n + " trang).";
      groups = $("mergeRanges").checked ? (r.pages.length ? [r.pages] : []) : r.groups;
    } else if (m === "every") {
      const k = Math.max(1, parseInt($("everyN").value, 10) || 1);
      for (let i = 1; i <= n; i += k) { const g = []; for (let j = i; j < i + k && j <= n; j++) g.push(j); groups.push(g); }
    } else {
      const sel = pb.pages.filter((p) => p.sel).map((p) => p.n);
      groups = $("pickSeparate").checked ? sel.map((x) => [x]) : (sel.length ? [sel] : []);
    }
    return { groups, err };
  }
  function summary() {
    if (!pb.pages.length) return;
    const { groups, err } = compute();
    outputs = groups;
    $("rangeErr").hidden = !err; $("rangeErr").textContent = err;
    $("ranges").classList.toggle("bad", !!err);
    const used = new Set(groups.flat());
    $("sum").innerHTML = groups.length
      ? "Sẽ tạo <b>" + groups.length + "</b> file PDF" + (groups.length > 1 ? " (tải về dạng ZIP)" : "") + " từ <b>" + used.size + "</b>/" + pb.pages.length + " trang."
      : "Chưa có trang nào được chọn.";
    app.setReady(groups.length > 0);
  }
  function update() {
    showGroups();
    const { groups } = compute();
    groupIndex = new Map();
    if (mode() !== "pick") groups.forEach((g, gi) => g.forEach((n) => { if (!groupIndex.has(n)) groupIndex.set(n, gi); }));
    pb.render();
  }
  PT.onInput('input[name="mode"], #ranges, #everyN, #mergeRanges, #pickSeparate', update);
  $("picked").addEventListener("input", () => {
    const r = PT.parseRanges($("picked").value, pb.pages.length);
    const set = new Set(r.pages);
    pb.pages.forEach((p) => { p.sel = set.has(p.n); });
    pb.render();
  });

  async function split() {
    const base = PT.baseName(pb.docs[0].name);
    const files = [];
    for (let i = 0; i < outputs.length; i++) {
      app.status("Đang tạo file " + (i + 1) + "/" + outputs.length + "…");
      const list = outputs[i].map((n) => pb.pages.find((p) => p.n === n));
      const doc = await pb.build(list);
      files.push({ name: base + "-trang-" + PT.toRanges(outputs[i]).replace(/, /g, "_") + ".pdf", data: await doc.save() });
      app.progress((i + 1) / outputs.length);
      await PT.frame();
    }
    if (files.length === 1) {
      const blob = new Blob([files[0].data], { type: "application/pdf" });
      app.finish({ blob, name: files[0].name, title: "Đã tách xong!", info: outputs[0].length + " trang · " + PT.fmtSize(blob.size) });
    } else {
      const blob = await PT.zip(files);
      app.finish({ blob, name: base + "-tach-" + files.length + "-file.zip", title: "Đã tách thành " + files.length + " file PDF!", info: files.length + " file PDF · " + PT.fmtSize(blob.size) });
    }
  }
})();

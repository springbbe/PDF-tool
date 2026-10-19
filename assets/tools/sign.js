/* Ký PDF: place signatures (drawn / typed / image), text, date and ticks on the pages, then stamp them in */
(function () {
  const { $, h } = PT;
  const SIG_KEY = "pdfnhanh.signatures";
  const SIG_FONTS = [["Dancing Script", 700], ["Great Vibes", 400], ["Pacifico", 400]];
  const INK = [["#111111", "Đen"], ["#1A3D9C", "Xanh"], ["#C62828", "Đỏ"]];
  let doc = null, pages = [], objs = [], uid = 0, selected = null, dlgImage = null;

  const app = PT.shell({
    tool: "sign", wsAccept: ["image"],
    railTitle: "Ký PDF",
    rail:
      '<div class="group"><span class="lbl">Chữ ký của bạn</span><div class="siglist" id="sigList"></div>' +
      '<button class="btn2" type="button" id="newSig">' + PT.ICON.sign + "Tạo chữ ký mới</button></div>" +
      '<div class="group"><span class="lbl">Thêm vào trang</span><div class="addbtns">' +
      '<button type="button" id="addText"><b>Aa</b>Chữ</button>' +
      '<button type="button" id="addDate"><b>📅</b>Ngày</button>' +
      '<button type="button" id="addTick"><b>✓</b>Dấu tích</button></div></div>' +
      '<p class="hint box">Bấm chữ ký hoặc một mục để đặt vào trang đang xem. Kéo để di chuyển, kéo chấm đỏ ở góc để đổi cỡ, bấm đúp vào chữ để sửa. Có thể dán ảnh con dấu, chữ ký chụp (' + PT.MOD + " + V).</p>" +
      '<div class="summary" id="sum"></div>',
    action: "Ký và tải về",
    sample: async () => { const f = await PT.samplePdf({ pages: 2, title: "Hợp đồng mẫu" }); f.sample = true; return [f]; },
    onFiles: async (files) => {
      const pdfs = files.filter(PT.isPdf), imgs = files.filter((f) => !PT.isPdf(f));
      if (imgs.length && dlgImage) { dlgImage(imgs[0]); return; }
      if (pdfs.length) await open(pdfs[0]);
      for (const f of imgs) { const r = await readImage(f); addObj({ kind: "img", url: r.url, ratio: r.ratio }, 0.3); PT.toast("Đã dán ảnh vào trang " + (curPage() + 1)); }
    },
    onReset: () => { objs = []; if (doc) doc.js.destroy(); doc = null; },
    onGo: () => app.run(run)
  });

  /* ---------- pages ---------- */
  const head = PT.boardHead(app.board);
  const wrap = h("div", { class: "spages" });
  app.board.append(wrap);
  const io = new IntersectionObserver((ents) => ents.forEach((en) => { if (en.isIntersecting) { io.unobserve(en.target); en.target._load(); } }), { rootMargin: "600px" });

  async function open(file) {
    app.status("Đang mở " + file.name + "…");
    let r;
    try { r = await PT.readPdf(file); } catch (e) { app.status(""); PT.toast(PT.pdfError(e, file.name)); return; }
    if (doc) doc.js.destroy();
    doc = { file, name: file.name, bytes: r.bytes, js: r.js, password: r.password, sample: !!file.sample };
    objs = []; selected = null; pages = [];
    for (let n = 1; n <= r.pages; n++) { const v = (await r.js.getPage(n)).getViewport({ scale: 1 }); pages.push({ n, w: v.width, h: v.height }); }
    app.status("");
    app.show("ws");
    buildPages();
    head.querySelector("#countText").textContent = r.pages + " trang · " + file.name;
    update();
  }
  function buildPages() {
    wrap.textContent = "";
    if (doc && doc.sample) wrap.append(h("p", { class: "banner", style: { width: "100%" }, text: "Đây là file mẫu. Chọn hoặc dán file PDF của bạn để ký thật." }));
    pages.forEach((p, i) => {
      const el = h("div", { class: "spage", "data-i": i, style: { aspectRatio: p.w + " / " + p.h, maxWidth: Math.max(320, Math.round(860 * Math.min(1, p.w / p.h * 1.414))) + "px" } },
        h("span", { class: "pno", text: "Trang " + (i + 1) }), h("div", { class: "ph" }));
      el._load = async () => {
        const width = Math.min(1600, el.clientWidth * Math.min(2, window.devicePixelRatio || 1));
        try {
          const c = await PT.renderPage(doc.js, p.n, { width });
          const blob = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.88));
          const ph = el.querySelector(".ph"); if (ph) ph.remove();
          el.prepend(h("img", { src: URL.createObjectURL(blob), alt: "" }));
        } catch (_) {}
      };
      el.addEventListener("pointerdown", (e) => { if (e.target === el || e.target.tagName === "IMG") select(null); });
      p.el = el;
      wrap.append(el);
      io.observe(el);
    });
    objs.forEach(mountObj);
  }
  function curPage() {
    const mid = window.innerHeight / 2;
    let best = 0, bd = Infinity;
    pages.forEach((p, i) => {
      if (!p.el) return;
      const r = p.el.getBoundingClientRect();
      const d = r.top <= mid && r.bottom >= mid ? 0 : Math.min(Math.abs(r.top - mid), Math.abs(r.bottom - mid));
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }

  /* ---------- objects on pages ---------- */
  // o: { kind: "img"|"text", url, ratio, text, fs (font size as share of page width), color }
  function addObj(o, widthShare, at) {
    if (!pages.length) return;
    const i = at != null ? at : curPage(), p = pages[i];
    const pr = p.el.getBoundingClientRect();
    // centre of the part of the page that is on screen
    const visTop = Math.max(0, -pr.top), visBot = Math.min(pr.height, window.innerHeight - pr.top);
    const cy = ((visTop + visBot) / 2) / pr.height;
    const obj = Object.assign({ id: ++uid, page: i, x: 0.5, y: cy }, o);
    if (o.kind === "img") {
      obj.w = widthShare; obj.h = widthShare * o.ratio * p.w / p.h;
      obj.x = 0.5 - obj.w / 2; obj.y = Math.min(0.97 - obj.h, Math.max(0.02, cy - obj.h / 2));
    } else { obj.x = 0.38; obj.y = Math.max(0.02, Math.min(0.95, cy - 0.02)); }
    // don't stack a new item exactly on top of the previous one
    while (objs.some((x) => x.page === i && Math.abs(x.y - obj.y) < 0.03 && Math.abs(x.x - obj.x) < 0.1) && obj.y < 0.9) obj.y += 0.05;
    objs.push(obj);
    mountObj(obj);
    select(obj);
    update();
    return obj;
  }
  function mountObj(o) {
    const p = pages[o.page];
    if (!p || !p.el) return;
    if (o.el) o.el.remove();
    const el = h("div", { class: "sobj", tabindex: "0" });
    let content;
    if (o.kind === "img") content = h("img", { src: o.url, alt: "" });
    else content = h("div", { class: "stext", text: o.text, spellcheck: "false", style: { fontSize: (o.fs * 100) + "cqw", color: o.color || "#111" } });
    const bar = h("div", { class: "sbar" },
      pages.length > 1 ? h("button", { type: "button", text: "Chép ra mọi trang", onclick: (e) => { e.stopPropagation(); copyToAll(o); } }) : null,
      h("button", { type: "button", text: "Xoá", onclick: (e) => { e.stopPropagation(); removeObj(o); } }));
    const res = h("span", { class: "sres", title: "Kéo để đổi cỡ" });
    el.append(content, bar, res);
    o.el = el; o.content = content;
    place(o);
    p.el.append(el);
    drag(o, el, res);
    if (o.kind === "text") {
      content.addEventListener("input", () => { o.text = content.innerText; });
      content.addEventListener("blur", () => { content.contentEditable = "false"; o.text = content.innerText.replace(/\n$/, ""); if (!o.text.trim()) removeObj(o); });
      content.addEventListener("dblclick", () => editText(o));
    }
  }
  function place(o) {
    const s = o.el.style;
    s.left = (o.x * 100) + "%"; s.top = (o.y * 100) + "%";
    if (o.kind === "img") { s.width = (o.w * 100) + "%"; s.height = (o.h * 100) + "%"; }
    else o.content.style.fontSize = (o.fs * 100) + "cqw";
  }
  function editText(o) {
    select(o);
    o.content.contentEditable = "true";
    o.content.focus();
    const r = document.createRange(); r.selectNodeContents(o.content);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
  }
  function select(o) {
    if (selected && selected !== o && selected.el) selected.el.classList.remove("on");
    selected = o;
    if (o && o.el) o.el.classList.add("on");
  }
  function removeObj(o) {
    objs = objs.filter((x) => x !== o);
    if (o.el) o.el.remove();
    if (selected === o) selected = null;
    update();
  }
  function copyToAll(o) {
    let n = 0;
    pages.forEach((p, i) => {
      if (i === o.page) return;
      const c = Object.assign({}, o, { id: ++uid, page: i, el: null, content: null });
      objs.push(c); mountObj(c); n++;
    });
    update();
    PT.toast("Đã chép ra " + n + " trang khác");
  }
  function drag(o, el, res) {
    let mode = null, sx, sy, start, pw, ph, moved;
    el.addEventListener("pointerdown", (e) => {
      if (o.kind === "text" && o.content.isContentEditable) return;
      if (e.target.closest(".sbar")) return;
      e.preventDefault(); e.stopPropagation();
      select(o);
      el.focus({ preventScroll: true });
      mode = e.target === res ? "size" : "move";
      sx = e.clientX; sy = e.clientY; moved = false;
      start = { x: o.x, y: o.y, w: o.w, h: o.h, fs: o.fs };
      const r = pages[o.page].el.getBoundingClientRect(); pw = r.width; ph = r.height;
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
    });
    el.addEventListener("pointermove", (e) => {
      if (!mode) return;
      const dx = (e.clientX - sx) / pw, dy = (e.clientY - sy) / ph;
      if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 3) moved = true;
      if (mode === "move") {
        const bw = el.offsetWidth / pw, bh = el.offsetHeight / ph;
        o.x = Math.min(1 - bw, Math.max(0, start.x + dx)); o.y = Math.min(1 - bh, Math.max(0, start.y + dy));
      } else if (o.kind === "img") {
        o.w = Math.max(0.03, Math.min(1 - o.x, start.w + dx)); o.h = o.w * o.ratio * pw / ph;
      } else {
        const bw0 = el.offsetWidth / pw || 0.1;
        o.fs = Math.max(0.008, start.fs * (1 + dx / Math.max(0.02, bw0)));
      }
      place(o);
    });
    const end = () => {
      if (mode === "move" && !moved && o.kind === "text" && o._wasOn) editText(o);
      o._wasOn = true;
      mode = null;
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", () => { mode = null; });
    el.addEventListener("keydown", (e) => {
      if (o.kind === "text" && o.content.isContentEditable) { if (e.key === "Escape") o.content.blur(); return; }
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeObj(o); }
      const k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (k) { e.preventDefault(); o.x += k[0] * 0.005; o.y += k[1] * 0.005; place(o); }
    });
    el.addEventListener("focus", () => select(o));
  }
  document.addEventListener("pointerdown", (e) => { if (selected && !e.target.closest(".sobj") && !e.target.closest(".rail")) { selected.el && selected.el.classList.remove("on"); selected._wasOn = false; selected = null; } });

  function update() {
    const n = objs.length, pg = new Set(objs.map((o) => o.page)).size;
    $("sum").innerHTML = n ? "Đã đặt <b>" + n + "</b> mục trên <b>" + pg + "</b> trang." : "Chưa đặt chữ ký hay nội dung nào.";
    app.setReady(!!doc && n > 0, doc && !n ? "Hãy đặt ít nhất một chữ ký hoặc nội dung lên trang." : "");
  }

  /* ---------- saved signatures ---------- */
  function loadSigs() { try { return JSON.parse(localStorage.getItem(SIG_KEY) || "[]"); } catch (_) { return []; } }
  function saveSigs(list) { try { localStorage.setItem(SIG_KEY, JSON.stringify(list.slice(0, 6))); } catch (_) {} }
  let sigs = loadSigs();
  function renderSigs() {
    const box = $("sigList");
    box.textContent = "";
    box.hidden = !sigs.length;
    sigs.forEach((s, i) => box.append(h("div", { class: "sig", role: "button", tabindex: "0", title: "Đặt chữ ký này vào trang", "aria-label": "Đặt chữ ký " + (i + 1) + " vào trang",
      onclick: () => addObj({ kind: "img", url: s.url, ratio: s.ratio }, 0.26),
      onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); addObj({ kind: "img", url: s.url, ratio: s.ratio }, 0.26); } } },
      h("img", { src: s.url, alt: "" }),
      h("button", { class: "x", type: "button", title: "Xoá chữ ký đã lưu", "aria-label": "Xoá chữ ký đã lưu", html: PT.ICON.del, onclick: (e) => { e.stopPropagation(); sigs.splice(i, 1); saveSigs(sigs); renderSigs(); } }))));
  }
  renderSigs();

  /* ---------- signature maker ---------- */
  function trim(c) {
    const g = c.getContext("2d"), { width: w, height: hh } = c, d = g.getImageData(0, 0, w, hh).data;
    let x0 = w, y0 = hh, x1 = -1, y1 = -1;
    for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return null;
    const pad = 6, o = document.createElement("canvas");
    o.width = x1 - x0 + 1 + pad * 2; o.height = y1 - y0 + 1 + pad * 2;
    o.getContext("2d").drawImage(c, x0 - pad, y0 - pad, o.width, o.height, 0, 0, o.width, o.height);
    return { url: o.toDataURL("image/png"), ratio: o.height / o.width };
  }
  async function readImage(file, knockout) {
    const url = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
    const img = await PT.loadImg(url);
    const s = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
    const g = c.getContext("2d"); g.drawImage(img, 0, 0, c.width, c.height);
    if (knockout) {
      // turn the paper white into transparency so only the ink stays
      const id = g.getImageData(0, 0, c.width, c.height), d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        if (l > 205) d[i + 3] = 0; else if (l > 160) d[i + 3] = Math.round(d[i + 3] * (205 - l) / 45);
      }
      g.putImageData(id, 0, 0);
      return trim(c) || { url: c.toDataURL("image/png"), ratio: c.height / c.width };
    }
    return { url: c.toDataURL("image/png"), ratio: c.height / c.width };
  }
  let fontsLinked = false;
  function linkFonts() {
    if (fontsLinked) return; fontsLinked = true;
    document.head.append(h("link", { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Great+Vibes&family=Pacifico&display=swap&subset=vietnamese" }));
  }

  function makeSignature() {
    linkFonts();
    return PT.dialog((close) => {
      let tab = "draw", ink = INK[0][0], strokes = 0, imgSig = null;
      const tabs = h("div", { class: "segs", role: "tablist" });
      const panes = {};
      const setTab = (t) => {
        tab = t;
        [...tabs.children].forEach((b) => b.setAttribute("aria-selected", String(b.dataset.t === t)));
        Object.keys(panes).forEach((k) => { panes[k].hidden = k !== t; });
        if (t === "draw") sizePad();
        if (t === "type") setTimeout(() => nameIn.focus(), 30);
      };
      [["draw", "Vẽ"], ["type", "Gõ tên"], ["image", "Ảnh chữ ký"]].forEach(([t, l]) => tabs.append(h("button", { type: "button", role: "tab", "data-t": t, text: l, onclick: () => setTab(t) })));
      const inkPick = h("div", { class: "swatches", role: "radiogroup", "aria-label": "Màu mực" }, INK.map(([c, n], i) =>
        h("label", { title: n }, h("input", { type: "radio", name: "ink", value: c, "aria-label": n, checked: i === 0, onchange: () => { ink = c; redrawTyped(); } }), h("span", { style: { background: c } }))));

      // draw
      const pad = h("canvas", { class: "pad", "aria-label": "Vùng vẽ chữ ký" });
      const pg = pad.getContext("2d");
      function sizePad() {
        const r = pad.getBoundingClientRect(); if (!r.width) return;
        const k = window.devicePixelRatio || 1;
        if (pad.width !== Math.round(r.width * k)) { pad.width = Math.round(r.width * k); pad.height = Math.round(r.height * k); strokes = 0; }
      }
      let last = null, lastMid = null;
      pad.addEventListener("pointerdown", (e) => { sizePad(); try { pad.setPointerCapture(e.pointerId); } catch (_) {} last = pt(e); lastMid = last; strokes++; dot(last); });
      pad.addEventListener("pointermove", (e) => {
        if (!last) return;
        const p = pt(e), mid = { x: (last.x + p.x) / 2, y: (last.y + p.y) / 2 };
        pg.strokeStyle = ink; pg.lineWidth = 2.6 * (window.devicePixelRatio || 1); pg.lineCap = "round"; pg.lineJoin = "round";
        pg.beginPath(); pg.moveTo(lastMid.x, lastMid.y); pg.quadraticCurveTo(last.x, last.y, mid.x, mid.y); pg.stroke();
        last = p; lastMid = mid;
      });
      const up = () => { last = null; };
      pad.addEventListener("pointerup", up); pad.addEventListener("pointercancel", up);
      function pt(e) { const r = pad.getBoundingClientRect(); return { x: (e.clientX - r.left) * pad.width / r.width, y: (e.clientY - r.top) * pad.height / r.height }; }
      function dot(p) { pg.fillStyle = ink; pg.beginPath(); pg.arc(p.x, p.y, 1.3 * (window.devicePixelRatio || 1), 0, Math.PI * 2); pg.fill(); }
      panes.draw = h("div", { class: "typed" }, pad,
        h("div", { class: "row2" }, h("p", { text: PT.IS_TOUCH ? "Ký bằng ngón tay vào khung trên." : "Giữ chuột và ký vào khung trên." }),
          h("button", { class: "link", type: "button", text: "Vẽ lại", onclick: () => { pg.clearRect(0, 0, pad.width, pad.height); strokes = 0; } })));

      // type
      const nameIn = h("input", { class: "field", placeholder: "Họ và tên của bạn", value: (() => { try { return localStorage.getItem("pdfnhanh.name") || ""; } catch (_) { return ""; } })(), autocomplete: "name" });
      const styles = h("div", { class: "typed", role: "radiogroup", "aria-label": "Kiểu chữ ký" });
      function redrawTyped() {
        const v = nameIn.value || "Chữ ký";
        [...styles.querySelectorAll("span")].forEach((s) => { s.textContent = v; s.style.color = ink; });
      }
      SIG_FONTS.forEach(([f, wgt], i) => styles.append(h("label", null, h("input", { type: "radio", name: "sfont", value: i, checked: i === 0 }), h("span", { style: { fontFamily: "'" + f + "', cursive", fontWeight: wgt } }))));
      nameIn.addEventListener("input", redrawTyped);
      panes.type = h("div", { class: "typed", hidden: true }, nameIn, styles);
      redrawTyped();

      // image
      const drop = h("div", { class: "imgdrop", html: "Chọn ảnh chữ ký (chụp trên giấy trắng), hoặc dán ảnh bằng " + PT.MOD + " + V" });
      const knock = h("input", { type: "checkbox", id: "knock", checked: true });
      let imgFile = null;
      const showImg = async () => {
        if (!imgFile) return;
        imgSig = await readImage(imgFile, knock.checked);
        drop.textContent = ""; drop.append(h("img", { src: imgSig.url, alt: "Ảnh chữ ký" }));
      };
      dlgImage = (f) => { imgFile = f; setTab("image"); showImg(); };
      knock.addEventListener("change", showImg);
      panes.image = h("div", { class: "typed", hidden: true }, drop,
        h("div", { class: "row2" },
          h("label", { class: "chk" }, knock, h("span", { class: "box", html: PT.ICON.check }), h("span", { text: "Xoá nền trắng" })),
          h("button", { class: "btn2", type: "button", text: "Chọn ảnh…", onclick: () => app.intake.pick("image/*") })));

      const err = h("p", { class: "field-err", hidden: true });
      const done = async () => {
        let res = null;
        if (tab === "draw") {
          if (!strokes) { err.hidden = false; err.textContent = "Hãy ký vào khung trước đã."; return; }
          res = trim(pad);
        } else if (tab === "type") {
          const v = nameIn.value.trim();
          if (!v) { err.hidden = false; err.textContent = "Hãy gõ tên của bạn."; nameIn.focus(); return; }
          try { localStorage.setItem("pdfnhanh.name", v); } catch (_) {}
          const [f, wgt] = SIG_FONTS[+styles.querySelector("input:checked").value];
          try { await document.fonts.load(wgt + " 80px '" + f + "'", v); } catch (_) {}
          const c = document.createElement("canvas"), g = c.getContext("2d"), font = wgt + " 120px '" + f + "', cursive";
          g.font = font; c.width = Math.ceil(g.measureText(v).width) + 80; c.height = 230;
          g.font = font; g.fillStyle = ink; g.textBaseline = "middle"; g.fillText(v, 40, 115);
          res = trim(c);
        } else {
          if (!imgSig) { err.hidden = false; err.textContent = "Hãy chọn hoặc dán ảnh chữ ký."; return; }
          res = imgSig;
        }
        if (!res) return;
        close(res);
      };
      setTimeout(() => setTab("draw"), 30);
      return h("div", { class: "body" },
        h("h2", { text: "Tạo chữ ký" }), tabs, panes.draw, panes.type, panes.image,
        h("div", { class: "row2" }, h("span", { text: "Màu mực" }), inkPick), err,
        h("div", { class: "acts" },
          h("button", { class: "btn2", type: "button", text: "Huỷ", onclick: () => close(null) }),
          h("button", { class: "big", type: "button", text: "Dùng chữ ký này", onclick: done })));
    }, { wide: true }).then((res) => {
      dlgImage = null;
      if (!res) return;
      sigs = [res].concat(sigs.filter((s) => s.url !== res.url)); saveSigs(sigs); renderSigs();
      if (doc) addObj({ kind: "img", url: res.url, ratio: res.ratio }, 0.26);
    });
  }
  $("newSig").addEventListener("click", makeSignature);
  const today = () => { const d = new Date(); return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear(); };
  $("addText").addEventListener("click", () => { const o = addObj({ kind: "text", text: "Nhập nội dung", fs: 0.022, color: "#111111" }); if (o) setTimeout(() => editText(o), 30); });
  $("addDate").addEventListener("click", () => addObj({ kind: "text", text: today(), fs: 0.022, color: "#111111" }));
  $("addTick").addEventListener("click", () => addObj({ kind: "text", text: "✓", fs: 0.04, color: "#111111" }));

  /* ---------- output ---------- */
  function textPng(o, pageW) {
    const K = 4, px = o.fs * pageW * K;
    const font = "500 " + px + "px 'Be Vietnam Pro', sans-serif";
    const lines = o.text.split("\n");
    const c = document.createElement("canvas"), g = c.getContext("2d");
    g.font = font;
    const w = Math.ceil(Math.max(...lines.map((l) => g.measureText(l).width), 1));
    const lh = px * 1.2;
    c.width = w + 2; c.height = Math.ceil(lh * lines.length);
    g.font = font; g.fillStyle = o.color || "#111"; g.textBaseline = "middle";
    lines.forEach((l, i) => g.fillText(l, 1, lh * i + lh / 2));
    return { url: c.toDataURL("image/png"), w: c.width / K, h: c.height / K };
  }
  async function run() {
    const L = await PT.lib("pdflib");
    try { await document.fonts.load("500 20px 'Be Vietnam Pro'"); } catch (_) {}
    const out = await PT.libDoc(doc.bytes, doc.password);
    const cache = new Map();
    const embed = async (url) => { if (!cache.has(url)) cache.set(url, await out.embedPng(PT.dataUrlBytes(url))); return cache.get(url); };
    const list = objs.filter((o) => o.kind === "img" || (o.text || "").trim());
    for (let i = 0; i < list.length; i++) {
      const o = list[i], page = out.getPage(o.page), g = PT.geom(page);
      let img, box;
      if (o.kind === "img") { img = await embed(o.url); box = { x: o.x * g.VW, y: o.y * g.VH, w: o.w * g.VW, h: o.h * g.VH }; }
      else { const t = textPng(o, g.VW); img = await embed(t.url); box = { x: o.x * g.VW, y: o.y * g.VH, w: t.w, h: t.h }; }
      page.drawImage(img, PT.place(g, box, L.degrees));
      app.progress((i + 1) / list.length);
    }
    const blob = new Blob([await out.save()], { type: "application/pdf" });
    app.finish({ blob, name: PT.baseName(doc.name) + "-da-ky.pdf", title: "Đã ký PDF!", info: pages.length + " trang · " + PT.fmtSize(blob.size) });
  }
})();

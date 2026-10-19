/* Shared core for every tool page: header, file intake (pick / drop / paste), PDF helpers,
   page shell (landing → workspace → done), file & page boards, hand-off between tools. */
(function () {
  "use strict";
  const PT = window.PT = {};
  const $ = PT.$ = (id) => document.getElementById(id);
  const h = PT.h = function (tag, props, ...kids) {
    const e = document.createElement(tag);
    for (const k in props || {}) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k === "html") e.innerHTML = v;
      else if (k === "text") e.textContent = v;
      else if (k === "style" && typeof v === "object") Object.assign(e.style, v);
      else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
      else if (v === true) e.setAttribute(k, "");
      else e.setAttribute(k, v);
    }
    kids.flat(Infinity).forEach((c) => { if (c != null && c !== false) e.append(c); });
    return e;
  };
  PT.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  PT.frame = () => new Promise((r) => setTimeout(r, 0));
  PT.fmtSize = (b) => b >= 1048576 ? (b / 1048576).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round(b / 1024)) + " KB";
  PT.baseName = (n) => (n || "").replace(/\.[^.]+$/, "").replace(/[\\/:*?"<>|]+/g, "-").trim() || "tai-lieu";
  PT.isPdf = (f) => f && (f.type === "application/pdf" || /\.pdf$/i.test(f.name || ""));
  PT.isImage = (f) => f && ((f.type || "").startsWith("image/") || /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i.test(f.name || ""));
  // site root, worked out from where this script lives (…/assets/core.js)
  PT.ROOT = (document.currentScript && document.currentScript.src || location.href).replace(/assets\/core\.js.*$/, "");
  PT.IS_TOUCH = window.matchMedia("(hover: none)").matches;
  PT.MOD = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘" : "Ctrl";

  /* ---------- Icons ---------- */
  const svg = (inner, sw) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + "</svg>";
  const DOC = '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>';
  PT.ICON = {
    merge: svg('<path d="M6 3v4a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><path d="M12 13v8"/><path d="M8.5 17.5L12 21l3.5-3.5"/>'),
    split: svg('<path d="M12 3v6"/><path d="M12 9a6 6 0 0 0-6 6v6M12 9a6 6 0 0 1 6 6v6"/><path d="M3 18l3 3 3-3M15 18l3 3 3-3"/>'),
    remove: svg(DOC + '<path d="M9 14.5h6"/>'),
    organize: svg('<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>'),
    rotate: svg('<path d="M20 11a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>', 2.4),
    rotateL: svg('<path d="M4 11a8 8 0 1 0 2.3-5.7"/><path d="M4 4v5h5"/>', 2.4),
    compress: svg('<path d="M12 2v7M8.5 5.5L12 9l3.5-3.5M12 22v-7M8.5 18.5L12 15l3.5 3.5M4 12h16"/>'),
    pdf2img: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>'),
    img2pdf: svg(DOC + '<path d="M8 18l3-3.5 2 2 1.5-1.5L17 18"/><circle cx="10" cy="11" r="1.2"/>'),
    text: svg('<path d="M5 6h14M5 10h14M5 14h10M5 18h7"/>'),
    sign: svg('<path d="M3 20c2.5 0 3.5-2.5 5.5-2.5S10.5 20 13 20s3-2 5-2h3"/><path d="M15 4l3 3-8.5 8.5H6.5v-3z"/>'),
    numbers: svg(DOC + '<path d="M9.5 13.5l1.5-1v5M14 13.2a1.4 1.4 0 1 1 2.2 1.2L14 17.5h2.6"/>', 1.8),
    watermark: svg('<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/><path d="M9.5 15a2.5 2.5 0 0 0 2.5 2.5"/>'),
    lock: svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
    unlock: svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.6-1.8"/>'),
    del: svg('<path d="M6 6l12 12M18 6L6 18"/>', 2.4),
    check: svg('<path d="M5 12l5 5 9-10"/>', 3.5),
    down: svg('<path d="M12 4v12M6 11l6 6 6-6M5 20h14"/>', 2.6),
    arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>', 2.6),
    paste: svg('<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="M12 9v7M9 13l3 3 3-3"/>'),
    eye: svg('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
    eyeOff: svg('<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>'),
    copy: svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'),
    open: svg('<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
    sort: svg('<path d="M7 4v16M3 16l4 4 4-4M14 5h7M14 10h5M14 15h3"/>'),
    grid: svg('<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>'),
    chevron: svg('<path d="M6 9l6 6 6-6"/>', 2.4),
    plus: svg('<path d="M12 5v14M5 12h14"/>', 2.6),
    camera: svg('<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>'),
    reverse: svg('<path d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4"/>'),
    blank: svg(DOC + '<path d="M12 11v6M9 14h6"/>')
  };

  /* ---------- Tool catalogue ---------- */
  PT.CATS = [
    { id: "org", name: "Sắp xếp PDF", color: "#E0453A" },
    { id: "opt", name: "Tối ưu PDF", color: "#1E8A5A" },
    { id: "conv", name: "Chuyển đổi", color: "#D98A06" },
    { id: "edit", name: "Chỉnh sửa PDF", color: "#7A4DD8" },
    { id: "sec", name: "Bảo mật PDF", color: "#2A5DB0" }
  ];
  PT.TOOLS = [
    { id: "merge", href: "ghep-pdf/", name: "Ghép PDF", cat: "org", input: "pdf", desc: "Nối nhiều file PDF thành một file theo đúng thứ tự bạn muốn." },
    { id: "split", href: "tach-pdf/", name: "Tách PDF", cat: "org", input: "pdf", desc: "Tách theo khoảng trang, mỗi trang một file hoặc trích các trang bạn chọn." },
    { id: "remove", href: "xoa-trang-pdf/", name: "Xoá trang PDF", cat: "org", input: "pdf", desc: "Bấm chọn những trang không cần rồi xoá khỏi file." },
    { id: "organize", href: "sap-xep-pdf/", name: "Sắp xếp trang PDF", cat: "org", input: "pdf", desc: "Kéo thả đổi thứ tự, xoay, xoá, chèn trang trắng hoặc PDF khác." },
    { id: "rotate", href: "xoay-pdf/", name: "Xoay PDF", cat: "org", input: "pdf", desc: "Xoay từng trang hoặc cả file cho đúng chiều đọc." },
    { id: "compress", href: "nen-pdf/", name: "Nén PDF", cat: "opt", input: "pdf", desc: "Giảm dung lượng để gửi email, Zalo mà chữ vẫn sắc nét." },
    { id: "pdf2img", href: "pdf-sang-anh/", name: "PDF sang ảnh", cat: "conv", input: "pdf", desc: "Chuyển từng trang PDF thành ảnh JPG hoặc PNG chất lượng cao." },
    { id: "img2pdf", href: "anh-sang-pdf/", name: "Ảnh sang PDF", cat: "conv", input: "image", desc: "Ghép ảnh JPG, PNG, ảnh chụp màn hình thành một file PDF." },
    { id: "text", href: "pdf-sang-van-ban/", name: "PDF sang văn bản", cat: "conv", input: "pdf", desc: "Lấy toàn bộ chữ trong PDF để sao chép hoặc lưu file .txt." },
    { id: "sign", href: "ky-pdf/", name: "Ký PDF", cat: "edit", input: "pdf", desc: "Vẽ, gõ hoặc dán chữ ký; thêm chữ và ngày tháng vào trang." },
    { id: "numbers", href: "danh-so-trang/", name: "Đánh số trang", cat: "edit", input: "pdf", desc: "Thêm số trang ở đầu hoặc cuối trang, chọn vị trí và kiểu số." },
    { id: "watermark", href: "watermark-pdf/", name: "Chèn watermark", cat: "edit", input: "pdf", desc: "Đóng dấu chữ hoặc logo mờ lên các trang PDF." },
    { id: "protect", href: "bao-ve-pdf/", name: "Đặt mật khẩu PDF", cat: "sec", input: "pdf", desc: "Khoá file bằng mật khẩu, mã hoá AES-256." },
    { id: "unlock", href: "mo-khoa-pdf/", name: "Mở khoá PDF", cat: "sec", input: "pdf", desc: "Gỡ mật khẩu và giới hạn in, sao chép khỏi file PDF." }
  ];
  const ICON_OF = { merge: "merge", split: "split", remove: "remove", organize: "organize", rotate: "rotate", compress: "compress", pdf2img: "pdf2img", img2pdf: "img2pdf", text: "text", sign: "sign", numbers: "numbers", watermark: "watermark", protect: "lock", unlock: "unlock" };
  PT.tool = (id) => PT.TOOLS.find((t) => t.id === id);
  PT.toolColor = (t) => PT.CATS.find((c) => c.id === t.cat).color;
  PT.toolIcon = (t, cls) => h("span", { class: "tico " + (cls || ""), style: { background: PT.toolColor(t) }, html: PT.ICON[ICON_OF[t.id]] });

  /* ---------- Header with "all tools" menu ---------- */
  PT.header = function (activeId) {
    const mega = h("div", { class: "mega gut", hidden: true, id: "mega" },
      h("div", { class: "in" }, PT.CATS.map((c) => h("div", null,
        h("h3", { text: c.name }),
        PT.TOOLS.filter((t) => t.cat === c.id).map((t) => h("a", { href: PT.ROOT + t.href, "aria-current": t.id === activeId ? "page" : null }, PT.toolIcon(t), t.name))
      ))));
    const btn = h("button", { class: "menu-btn", type: "button", "aria-expanded": "false", "aria-controls": "mega" }, "Tất cả công cụ", h("span", { html: PT.ICON.chevron, style: { display: "grid" } }));
    const toggle = (open) => { mega.hidden = !open; btn.setAttribute("aria-expanded", String(open)); };
    btn.addEventListener("click", (e) => { e.stopPropagation(); toggle(mega.hidden); });
    document.addEventListener("click", (e) => { if (!mega.hidden && !mega.contains(e.target)) toggle(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") toggle(false); });
    const top = h("header", { class: "top gut" },
      h("div", { class: "in" },
        h("a", { class: "brand", href: PT.ROOT },
          h("span", { class: "mark", html: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>' }),
          h("span", { html: "PDF<b>Nhanh</b>" })),
        btn,
        h("div", { class: "note", html: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg><span>Xử lý ngay trên máy bạn, không tải file lên máy chủ</span>' })),
      mega);
    document.body.prepend(top);
  };

  /* ---------- Library loader ---------- */
  const PDFJS = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/";
  const LIBS = {
    pdflib: ["https://cdn.jsdelivr.net/npm/@cantoo/pdf-lib@2.11.1/dist/pdf-lib.min.js", () => window.PDFLib],
    pdfjs: [PDFJS + "build/pdf.min.js", () => {
      const l = window.pdfjsLib;
      if (l && !l.GlobalWorkerOptions.workerSrc) l.GlobalWorkerOptions.workerSrc = PDFJS + "build/pdf.worker.min.js";
      return l;
    }],
    jszip: ["https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js", () => window.JSZip],
    jspdf: ["https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js", () => window.jspdf]
  };
  const libCache = {};
  PT.lib = function (name) {
    if (!libCache[name]) {
      const [src, get] = LIBS[name];
      libCache[name] = new Promise((res, rej) => {
        if (get()) return res(get());
        const s = h("script", { src, async: true });
        s.onload = () => get() ? res(get()) : rej(new Error("lib " + name));
        s.onerror = () => { delete libCache[name]; rej(new Error("Không tải được thư viện. Hãy kiểm tra kết nối mạng rồi tải lại trang.")); };
        document.head.append(s);
      });
    }
    return libCache[name];
  };

  /* ---------- Toast ---------- */
  let toastTimer = null;
  PT.toast = function (msg, action) {
    let t = $("toast");
    if (!t) { t = h("div", { class: "toast", id: "toast", role: "status", hidden: true }); document.body.append(t); }
    t.textContent = "";
    t.append(h("span", { text: msg }));
    if (action) t.append(h("button", { type: "button", text: action.label, onclick: () => { t.hidden = true; action.run(); } }));
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, action ? 6000 : 2800);
  };

  /* ---------- Dialogs ---------- */
  PT.dialog = function (build, opts) {
    return new Promise((resolve) => {
      const d = h("dialog", { class: "dlg" + (opts && opts.wide ? " wide" : "") });
      const close = (v) => { d.close(); d.remove(); resolve(v); };
      d.append(build(close));
      d.addEventListener("cancel", (e) => { e.preventDefault(); close(null); });
      d.addEventListener("click", (e) => { if (e.target === d) close(null); });
      document.body.append(d);
      d.showModal();
    });
  };
  PT.pwField = function (attrs) {
    const input = h("input", Object.assign({ class: "field", type: "password", autocomplete: "off", spellcheck: "false" }, attrs));
    const eye = h("button", { type: "button", title: "Hiện mật khẩu", "aria-label": "Hiện mật khẩu", html: PT.ICON.eye });
    eye.addEventListener("click", () => {
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      eye.innerHTML = show ? PT.ICON.eyeOff : PT.ICON.eye;
      eye.title = show ? "Ẩn mật khẩu" : "Hiện mật khẩu";
    });
    return { wrap: h("div", { class: "pw" }, input, eye), input };
  };
  PT.askPassword = function (name, wrong) {
    return PT.dialog((close) => {
      const pw = PT.pwField({ placeholder: "Mật khẩu của file", "aria-label": "Mật khẩu" });
      const form = h("form", { method: "dialog" },
        h("h2", { text: "File có mật khẩu" }),
        h("p", null, h("b", { text: name }), " được khoá. Nhập mật khẩu để mở. Mật khẩu chỉ dùng trên máy bạn."),
        pw.wrap,
        wrong ? h("p", { class: "field-err", text: "Mật khẩu chưa đúng, thử lại nhé." }) : null,
        h("div", { class: "acts" },
          h("button", { class: "btn2", type: "button", text: "Bỏ qua", onclick: () => close(null) }),
          h("button", { class: "big", type: "submit", text: "Mở file" })));
      form.addEventListener("submit", (e) => { e.preventDefault(); close(pw.input.value); });
      setTimeout(() => pw.input.focus(), 30);
      return form;
    });
  };

  /* ---------- Hand-off between tools (IndexedDB) ---------- */
  function idb() {
    return new Promise((res, rej) => {
      const r = indexedDB.open("pdfnhanh", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("h");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  PT.handoff = {
    async put(files) {
      const db = await idb();
      const recs = await Promise.all(files.map(async (f) => ({ name: f.name, type: f.type, data: await f.arrayBuffer() })));
      await new Promise((res, rej) => { const tx = db.transaction("h", "readwrite"); tx.objectStore("h").put({ t: Date.now(), files: recs }, "x"); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    },
    async take() {
      const db = await idb();
      const rec = await new Promise((res, rej) => {
        const tx = db.transaction("h", "readwrite"); const st = tx.objectStore("h");
        const g = st.get("x"); g.onsuccess = () => { st.delete("x"); res(g.result); }; g.onerror = () => rej(g.error);
      });
      if (!rec || Date.now() - rec.t > 30 * 60 * 1000) return [];
      return rec.files.map((r) => new File([r.data], r.name, { type: r.type }));
    }
  };
  PT.sendTo = async function (toolId, files) {
    const t = PT.tool(toolId);
    try { await PT.handoff.put(files); location.href = PT.ROOT + t.href + "#tiep"; }
    catch (e) { location.href = PT.ROOT + t.href; }
  };
  PT.chooseTool = function (files) {
    const kind = files.some(PT.isPdf) ? "pdf" : "image";
    const list = PT.TOOLS.filter((t) => t.input === kind);
    return PT.dialog((close) => h("div", { class: "body" },
      h("h2", { text: files.length > 1 ? "Bạn muốn làm gì với " + files.length + " file này?" : "Bạn muốn làm gì với file này?" }),
      h("p", { text: files.map((f) => f.name).join(", ") }),
      h("div", { class: "chooser" }, list.map((t) => h("a", { href: PT.ROOT + t.href, onclick: (e) => { e.preventDefault(); close(t.id); PT.sendTo(t.id, files); } }, PT.toolIcon(t), t.name))),
      h("div", { class: "acts" }, h("button", { class: "btn2", type: "button", text: "Huỷ", onclick: () => close(null) }))
    ), { wide: true });
  };

  /* ---------- File intake: picker, drag & drop anywhere, paste anywhere ---------- */
  let pasteCount = 0;
  function renamePasted(f) {
    // screenshots arrive as "image.png" every time; give each paste its own name
    if (!f.name || /^image\.\w+$/i.test(f.name) || f.name === "blob") {
      const ext = PT.isPdf(f) ? "pdf" : (f.type.split("/")[1] || "png").replace("jpeg", "jpg");
      return new File([f], (PT.isPdf(f) ? "file-dan-" : "anh-dan-") + (++pasteCount) + "." + ext, { type: f.type });
    }
    return f;
  }
  function filesFromClipboard(cd) {
    if (!cd) return [];
    let fs = [...(cd.items || [])].filter((x) => x.kind === "file").map((x) => x.getAsFile()).filter(Boolean);
    if (!fs.length) fs = [...(cd.files || [])];
    return fs.map(renamePasted);
  }
  async function fetchUrl(url) {
    const r = await fetch(url, { mode: "cors" });
    if (!r.ok) throw new Error("http");
    const b = await r.blob();
    let name = decodeURIComponent((new URL(url).pathname.split("/").pop() || "").trim()) || "file-tu-link";
    const type = b.type || (/\.pdf$/i.test(name) ? "application/pdf" : "");
    if (type === "application/pdf" && !/\.pdf$/i.test(name)) name += ".pdf";
    return new File([b], name, { type });
  }

  PT.pasteBox = function (el, label) {
    el = el || h("div");
    el.className = "paste-box";
    el.setAttribute("contenteditable", "true");
    el.setAttribute("inputmode", "none");
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
    el.setAttribute("aria-label", label || "Dán file từ clipboard");
    el.spellcheck = false;
    el.innerHTML = PT.ICON.paste + "<span>" + (label || "Dán file") + '</span><small contenteditable="false">' +
      (PT.IS_TOUCH ? "Chạm giữ vào ô này → chọn Dán" : "Bấm vào ô này rồi nhấn <kbd>" + PT.MOD + "</kbd> + <kbd>V</kbd>") + "</small>";
    el.addEventListener("keydown", (e) => {
      const ok = (e.ctrlKey || e.metaKey) && (e.key === "v" || e.key === "V");
      if (!ok && e.key !== "Tab") e.preventDefault();
    });
    el.addEventListener("beforeinput", (e) => e.preventDefault());
    return el;
  };

  // opts: { accept: ["pdf"] | ["image"] | ["pdf","image"], multiple, onFiles(files, how), enabled() }
  PT.intake = function (opts) {
    const accAttr = opts.accept.map((k) => k === "pdf" ? "application/pdf,.pdf" : "image/*").join(",");
    const input = h("input", { type: "file", hidden: true, accept: accAttr, multiple: opts.multiple ? true : null });
    document.body.append(input);
    const deliver = (files, how) => {
      files = [...files];
      if (!files.length) return;
      if (opts.enabled && !opts.enabled()) return;
      opts.onFiles(files, how);
    };
    input.addEventListener("change", () => { deliver(input.files, "pick"); input.value = ""; });
    const api = {
      pick(accept) { input.accept = accept || accAttr; input.click(); setTimeout(() => { input.accept = accAttr; }, 1000); },
      input
    };
    document.addEventListener("click", (e) => { const b = e.target.closest("[data-pick]"); if (b) { e.preventDefault(); api.pick(); } });

    // drag & drop anywhere on the page
    const overlay = h("div", { class: "drop-overlay", hidden: true },
      h("div", null, opts.accept.includes("pdf") ? "Thả file PDF vào đây" : "Thả ảnh vào đây", h("small", { text: "Thả ở bất cứ đâu trên trang" })));
    document.body.append(overlay);
    let depth = 0;
    const hasFiles = (e) => e.dataTransfer && [...e.dataTransfer.types].includes("Files");
    document.addEventListener("dragenter", (e) => { if (!hasFiles(e) || (opts.enabled && !opts.enabled())) return; depth++; overlay.hidden = false; });
    document.addEventListener("dragleave", (e) => { if (hasFiles(e) && --depth <= 0) { depth = 0; overlay.hidden = true; } });
    document.addEventListener("dragover", (e) => { if (hasFiles(e)) e.preventDefault(); });
    document.addEventListener("drop", (e) => {
      depth = 0; overlay.hidden = true;
      if (!hasFiles(e)) return;
      e.preventDefault();
      deliver(e.dataTransfer.files, "drop");
    });

    // paste anywhere (files, screenshots, or a direct link to a PDF / image)
    document.addEventListener("paste", async (e) => {
      const tgt = e.target;
      const typing = tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || (tgt.isContentEditable && !tgt.closest(".paste-box")));
      const fs = filesFromClipboard(e.clipboardData);
      if (typing && !fs.length) return;           // normal text paste into a field
      e.preventDefault();
      if (document.activeElement && document.activeElement.classList.contains("paste-box")) document.activeElement.blur();
      if (fs.length) { deliver(fs, "paste"); return; }
      const txt = (e.clipboardData && e.clipboardData.getData("text/plain") || "").trim();
      if (/^https?:\/\/\S+$/i.test(txt)) {
        PT.toast("Đang tải file từ đường link…");
        try { const f = await fetchUrl(txt); deliver([f], "paste"); }
        catch (_) { PT.toast("Trang gốc không cho tải trực tiếp. Hãy tải file về máy rồi kéo vào đây."); }
        return;
      }
      PT.toast(opts.accept.includes("pdf") ? "Clipboard chưa có file. Hãy copy file PDF (hoặc ảnh) rồi dán lại." : "Clipboard chưa có ảnh. Hãy copy một ảnh rồi dán lại.");
    });
    return api;
  };

  /* ---------- PDF helpers ---------- */
  const PDFJS_OPTS = { cMapUrl: PDFJS + "cmaps/", cMapPacked: true, standardFontDataUrl: PDFJS + "standard_fonts/", isEvalSupported: false };
  PT.Cancel = class extends Error {};
  // Opens a PDF with pdf.js, asking for the password when needed. Returns { bytes, js, password, pages }.
  PT.readPdf = async function (file, opts) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const pdfjs = await PT.lib("pdfjs");
    let password = opts && opts.password, wrong = false;
    for (;;) {
      try {
        const js = await pdfjs.getDocument(Object.assign({ data: bytes.slice(), password }, PDFJS_OPTS)).promise;
        return { bytes, js, password, pages: js.numPages };
      } catch (e) {
        if (e && e.name === "PasswordException") {
          if (opts && opts.noPrompt) throw new PT.Cancel("locked");
          wrong = e.code === 2;
          password = await PT.askPassword(file.name, wrong);
          if (password == null) throw new PT.Cancel("locked");
          continue;
        }
        throw e;
      }
    }
  };
  // pdf-lib document for editing; decrypts with the known password (or empty password for "restrictions only" files)
  PT.libDoc = async function (bytes, password) {
    const { PDFDocument } = await PT.lib("pdflib");
    try { return await PDFDocument.load(bytes, { updateMetadata: false }); }
    catch (e) {
      if (!/encrypt/i.test(e.message || "")) throw e;
      const doc = await PDFDocument.load(bytes, { password: password || "", updateMetadata: false });
      await dropEncryption(doc);
      return doc;
    }
  };
  // After decrypting, pdf-lib keeps the old /Encrypt dictionary, xref/object streams and unreadable leftovers;
  // remove them so the saved file opens without a password.
  async function dropEncryption(doc) {
    const L = await PT.lib("pdflib"), N = (x) => L.PDFName.of(x), ctx = doc.context;
    for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
      if (obj instanceof L.PDFInvalidObject) { ctx.delete(ref); continue; }
      const d = obj instanceof L.PDFDict ? obj : obj.dict;
      if (!d || !d.get) continue;
      const t = d.get(N("Type"));
      if (t === N("XRef") || t === N("ObjStm") || (d.get(N("Filter")) === N("Standard") && d.get(N("O")) && d.get(N("U")))) ctx.delete(ref);
    }
    delete ctx.trailerInfo.Encrypt;
  }
  PT.pdfError = function (e, name) {
    if (e instanceof PT.Cancel) return "Bỏ qua " + name + " vì chưa nhập mật khẩu.";
    if (e && e.name === "InvalidPDFException") return name + " không phải file PDF hợp lệ hoặc đã bị hỏng.";
    return "Không đọc được " + name + ". " + ((e && e.message) || "");
  };

  // render one page to a canvas (white background). opts: { width } (css px) or { scale }, rotation (extra degrees)
  PT.renderPage = async function (js, n, opts) {
    const page = await js.getPage(n);
    const rotation = ((page.rotate + (opts.rotation || 0)) % 360 + 360) % 360;
    const vp1 = page.getViewport({ scale: 1, rotation });
    let scale = opts.scale || (opts.width / vp1.width);
    if (opts.maxPixels) scale = Math.min(scale, Math.sqrt(opts.maxPixels / (vp1.width * vp1.height)));
    const vp = page.getViewport({ scale, rotation });
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(vp.width)); c.height = Math.max(1, Math.round(vp.height));
    const g = c.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
    // "print" intent renders in one go instead of via requestAnimationFrame, so it keeps working in a background tab
    await page.render({ canvasContext: g, viewport: vp, intent: "print" }).promise;
    c.ptW = vp1.width; c.ptH = vp1.height;
    return c;
  };
  // small queue so long documents render thumbnails two at a time
  const q = []; let running = 0;
  PT.thumb = function (js, n, width) {
    return new Promise((res, rej) => { q.push({ js, n, width, res, rej }); pump(); });
  };
  function pump() {
    while (running < 2 && q.length) {
      const t = q.shift(); running++;
      PT.renderPage(t.js, t.n, { width: t.width * Math.min(2, window.devicePixelRatio || 1) })
        .then((c) => t.res({ url: c.toDataURL("image/jpeg", 0.8), w: c.ptW, h: c.ptH }), t.rej)
        .finally(() => { running--; pump(); });
    }
  }
  const imgCache = new Map();
  function loadImg(url) {
    if (imgCache.has(url)) return Promise.resolve(imgCache.get(url));
    return new Promise((res, rej) => { const i = new Image(); i.onload = () => { imgCache.set(url, i); res(i); }; i.onerror = rej; i.src = url; });
  }
  PT.loadImg = loadImg;
  // rotate an image (data URL) by 0/90/180/270 → data URL
  PT.rotateUrl = async function (url, rot) {
    rot = ((rot % 360) + 360) % 360;
    if (!rot) return url;
    const img = await loadImg(url);
    const sw = rot % 180 === 0;
    const c = document.createElement("canvas");
    c.width = sw ? img.naturalWidth : img.naturalHeight; c.height = sw ? img.naturalHeight : img.naturalWidth;
    const g = c.getContext("2d");
    g.translate(c.width / 2, c.height / 2); g.rotate(rot * Math.PI / 180);
    g.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    return c.toDataURL("image/jpeg", 0.85);
  };

  // Geometry of a pdf-lib page as the viewer sees it (after /Rotate)
  PT.geom = function (page) {
    const b = page.getCropBox();
    const r = (((page.getRotation().angle || 0) % 360) + 360) % 360;
    return { x0: b.x, y0: b.y, W: b.width, H: b.height, r, VW: r % 180 ? b.height : b.width, VH: r % 180 ? b.width : b.height };
  };
  // visual point (vx from left, vy from bottom) → PDF user space
  PT.toUser = function (g, vx, vy) {
    switch (g.r) {
      case 90: return [g.x0 + g.W - vy, g.y0 + vx];
      case 180: return [g.x0 + g.W - vx, g.y0 + g.H - vy];
      case 270: return [g.x0 + vy, g.y0 + g.H - vx];
      default: return [g.x0 + vx, g.y0 + vy];
    }
  };
  // box given in visual coordinates from the top-left (pt), rotated `angle` degrees counter-clockwise around its centre
  PT.place = function (g, box, degrees) {
    const angle = box.angle || 0, a = angle * Math.PI / 180;
    const cx = box.x + box.w / 2, cy = g.VH - (box.y + box.h / 2);
    const ax = cx - (box.w / 2 * Math.cos(a) - box.h / 2 * Math.sin(a));
    const ay = cy - (box.w / 2 * Math.sin(a) + box.h / 2 * Math.cos(a));
    const [x, y] = PT.toUser(g, ax, ay);
    return { x, y, width: box.w, height: box.h, rotate: degrees(angle + g.r) };
  };
  PT.dataUrlBytes = (u) => { const s = atob(u.split(",")[1]); const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; };
  PT.canvasBytes = (c, type, q) => new Promise((res) => c.toBlob((b) => b.arrayBuffer().then((a) => res(new Uint8Array(a))), type || "image/png", q));

  // "1-3, 5, 8-" → sorted unique page numbers within 1..max. Returns { pages, groups, bad }
  PT.parseRanges = function (str, max) {
    const groups = []; let bad = false;
    (str || "").split(/[,;]+/).map((s) => s.trim()).filter(Boolean).forEach((part) => {
      const m = part.match(/^(\d*)\s*[-–]\s*(\d*)$/);
      let a, b;
      if (m && (m[1] || m[2])) { a = m[1] ? +m[1] : 1; b = m[2] ? +m[2] : max; }
      else if (/^\d+$/.test(part)) { a = b = +part; }
      else { bad = true; return; }
      if (a > b) [a, b] = [b, a];
      if (a < 1 || b > max) { bad = true; a = Math.max(1, a); b = Math.min(max, b); if (a > b) return; }
      const g = []; for (let i = a; i <= b; i++) g.push(i);
      groups.push(g);
    });
    const pages = [...new Set(groups.flat())].sort((x, y) => x - y);
    return { pages, groups, bad };
  };
  PT.toRanges = function (nums) {
    const s = [...new Set(nums)].sort((a, b) => a - b), out = [];
    for (let i = 0; i < s.length; i++) {
      let j = i; while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
      out.push(j > i ? s[i] + "-" + s[j] : String(s[i])); i = j;
    }
    return out.join(", ");
  };

  // Sample document so people can try a tool without their own file
  PT.samplePdf = async function (o) {
    o = Object.assign({ name: "tai-lieu-mau.pdf", pages: 4, title: "Tài liệu mẫu", tint: "#E0453A" }, o);
    const { PDFDocument } = await PT.lib("pdflib");
    try { await document.fonts.load("800 40px 'Be Vietnam Pro'"); } catch (_) {}
    const doc = await PDFDocument.create();
    const W = 1240, H = 1754;
    for (let i = 0; i < o.pages; i++) {
      const c = document.createElement("canvas"); c.width = W; c.height = H;
      const g = c.getContext("2d");
      g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);
      g.fillStyle = o.tint; g.fillRect(0, 0, W, 210);
      g.fillStyle = "#fff"; g.font = "800 64px 'Be Vietnam Pro', sans-serif"; g.fillText(o.title, 90, 132);
      g.font = "500 30px 'Be Vietnam Pro', sans-serif"; g.globalAlpha = .85; g.fillText("Trang " + (i + 1) + " / " + o.pages, 90, 180); g.globalAlpha = 1;
      g.fillStyle = "#1F2230"; g.font = "800 300px 'Be Vietnam Pro', sans-serif"; g.globalAlpha = .08; g.fillText(String(i + 1), W - 330, 560); g.globalAlpha = 1;
      g.font = "700 40px 'Be Vietnam Pro', sans-serif"; g.fillText(["Giới thiệu", "Số liệu chính", "Kế hoạch", "Tổng kết", "Phụ lục"][i % 5], 90, 330);
      g.fillStyle = "#D5D7E0";
      for (let k = 0; k < 9; k++) { const w = k % 4 === 3 ? 620 : 1060; g.beginPath(); g.roundRect(90, 380 + k * 52, w, 22, 11); g.fill(); }
      g.fillStyle = o.tint; g.globalAlpha = .18; g.beginPath(); g.roundRect(90, 880, 1060, 420, 18); g.fill(); g.globalAlpha = 1;
      g.fillStyle = o.tint;
      for (let k = 0; k < 7; k++) { const bh = 80 + ((k * 53 + i * 37) % 260); g.beginPath(); g.roundRect(150 + k * 140, 1260 - bh, 80, bh, 8); g.fill(); }
      g.fillStyle = "#D5D7E0";
      for (let k = 0; k < 5; k++) { const w = k === 4 ? 480 : 1060; g.beginPath(); g.roundRect(90, 1380 + k * 52, w, 22, 11); g.fill(); }
      const img = await doc.embedJpg(await PT.canvasBytes(c, "image/jpeg", 0.86));
      const p = doc.addPage([595.28, 841.89]);
      p.drawImage(img, { x: 0, y: 0, width: 595.28, height: 841.89 });
    }
    if (o.password) doc.encrypt({ userPassword: o.password, ownerPassword: o.password });
    const bytes = await doc.save();
    return new File([bytes], o.name, { type: "application/pdf" });
  };

  PT.zip = async function (entries) {
    const JSZip = await PT.lib("jszip");
    const z = new JSZip(), used = {};
    for (const e of entries) {
      let n = e.name, m = n.match(/^(.*?)(\.[^.]+)?$/);
      used[n] = (used[n] || 0) + 1;
      if (used[n] > 1) n = m[1] + "-" + used[n] + (m[2] || "");
      z.file(n, e.data);
    }
    return z.generateAsync({ type: "blob" });
  };
  PT.save = function (blob, name) {
    const a = h("a", { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  };

  /* ---------- Page shell: landing → workspace → done ---------- */
  /* cfg: { tool, accept:["pdf"], multiple, title, sub, pick, railTitle, rail (html), action, formats, sample(), onFiles(files), onReset(), wsAccept:["image"] } */
  PT.shell = function (cfg) {
    const tool = PT.tool(cfg.tool);
    document.title = tool.name + " – PDFNhanh";
    PT.header(cfg.tool);
    const accept = cfg.accept || ["pdf"];
    const isPdfTool = accept.includes("pdf");
    const kindWord = isPdfTool ? "file PDF" : "ảnh";
    const main = h("main", { id: "app" });
    const landing = h("section", { class: "landing gut", id: "landing" },
      PT.toolIcon(tool),
      h("h1", { text: cfg.title || tool.name }),
      h("p", { class: "sub", text: cfg.sub || tool.desc }),
      h("div", { class: "row" },
        h("button", { class: "big", type: "button", "data-pick": true, text: cfg.pick || ("Chọn " + kindWord) }),
        cfg.landingExtra || null),
      h("p", { class: "or", html: PT.IS_TOUCH ? "hoặc dán " + kindWord + " vào ô bên dưới" : "hoặc kéo thả " + kindWord + " vào đây, hoặc nhấn <kbd>" + PT.MOD + "</kbd> + <kbd>V</kbd> để dán" }),
      PT.pasteBox(null, isPdfTool ? "Dán file" : "Dán ảnh"),
      cfg.sample ? h("button", { class: "link", type: "button", id: "trySample", text: cfg.sampleLabel || "Dùng thử với file mẫu" }) : null,
      h("div", { class: "formats" }, (cfg.formats || ["PDF"]).map((f) => h("span", { text: f }))));

    const board = h("section", { class: "board gut", id: "board" });
    if (cfg.multiple) board.append(h("button", { class: "fab", type: "button", "data-pick": true, title: "Thêm file", "aria-label": "Thêm file" }, "+", h("span", { class: "badge", id: "badge", text: "0" })));
    const railBody = h("div", { class: "rail-body gut", id: "railBody", html: cfg.rail || "" });
    const status = h("p", { class: "status", id: "status", role: "status" });
    const prog = h("div", { class: "progress", id: "progress", hidden: true }, h("div"));
    const go = h("button", { class: "big", type: "button", id: "go", disabled: true }, h("span", { text: cfg.action || tool.name }), h("span", { html: PT.ICON.arrow, style: { display: "grid", width: "22px" } }));
    const ws = h("div", { class: "ws", id: "ws", hidden: true },
      board,
      h("aside", { class: "rail" },
        h("div", { class: "rail-head gut" }, h("h2", { text: cfg.railTitle || "Tùy chọn" })),
        railBody,
        h("div", { class: "rail-foot gut" }, prog, status, go)));

    const done = h("section", { class: "done gut", id: "done", hidden: true });
    main.append(landing, ws, done);
    document.body.append(main);

    const app = { cfg, tool, board, railBody, go, landing, ws, done, step: "landing", result: null };
    app.show = function (step) {
      app.step = step;
      landing.hidden = step !== "landing"; ws.hidden = step !== "ws"; done.hidden = step !== "done";
      document.body.classList.toggle("has-foot", step === "ws");
      window.scrollTo(0, 0);
    };
    app.status = function (msg, err) { status.textContent = msg || ""; status.className = "status" + (err ? " err" : ""); };
    app.progress = function (f) {
      if (f == null) { prog.hidden = true; return; }
      prog.hidden = false; prog.firstElementChild.style.width = Math.round(f * 100) + "%";
    };
    app.busy = false;
    app.setReady = function (ok, why) { go.disabled = !ok || app.busy; if (why !== undefined && !app.busy) app.status(why); };
    app.run = async function (fn) {
      if (app.busy) return;
      app.busy = true; go.disabled = true; app.status("Đang xử lý…"); app.progress(0);
      await PT.frame();
      try { await fn(); }
      catch (e) { console.error(e); app.status((e && e.userMsg) || "Có lỗi khi xử lý: " + ((e && e.message) || e) + ". Hãy thử lại.", true); }
      finally { app.busy = false; go.disabled = false; app.progress(null); if (cfg.onIdle) cfg.onIdle(); }
    };

    /* result: { blob, name, info, title, saving, preview(el), copy:{label, run}, chain } */
    app.finish = function (r) {
      app.result = r;
      app.status("");
      const ext = (r.name.split(".").pop() || "").toUpperCase();
      const dl = h("button", { class: "big", type: "button" }, h("span", { html: PT.ICON.down, style: { display: "grid", width: "24px" } }), "Tải file " + (ext === "ZIP" ? "ZIP" : ext));
      const dst = h("p", { class: "status", role: "status" });
      const doSave = () => { PT.save(r.blob, r.name); dst.textContent = "Đã tải " + r.name + ". Không thấy file? Bấm nút tải lần nữa."; };
      dl.addEventListener("click", doSave);
      const extra = [];
      if (/^(PDF|JPG|PNG|TXT)$/.test(ext)) extra.push(h("button", { class: "btn2", type: "button", onclick: () => { const u = URL.createObjectURL(r.blob); window.open(u, "_blank"); setTimeout(() => URL.revokeObjectURL(u), 120000); } }, h("span", { html: PT.ICON.open, style: { display: "grid" } }), "Xem trước"));
      if (r.copy) extra.push(h("button", { class: "btn2", type: "button", onclick: r.copy.run }, h("span", { html: PT.ICON.copy, style: { display: "grid" } }), r.copy.label));
      let chain = null;
      const chainKind = ext === "PDF" ? "pdf" : (/^(JPG|PNG)$/.test(ext) ? "image" : null);
      if (chainKind && r.chain !== false) {
        const list = PT.TOOLS.filter((t) => t.input === chainKind && t.id !== cfg.tool);
        chain = h("div", { class: "chain" }, h("h2", { text: "Tiếp tục với file này" }),
          h("div", { class: "list" }, list.map((t) => h("button", { type: "button", onclick: () => PT.sendTo(t.id, [new File([r.blob], r.name, { type: r.blob.type || (chainKind === "pdf" ? "application/pdf" : "image/" + ext.toLowerCase().replace("jpg", "jpeg")) })]) }, PT.toolIcon(t), t.name))));
      }
      done.textContent = "";
      done.append(...[
        h("h1", { text: r.title || "Xong rồi!" }),
        r.saving ? h("p", { class: "saving", text: r.saving }) : null,
        h("div", { class: "file" },
          h("span", { html: '<svg viewBox="0 0 34 40"><path d="M3 1h20l10 10v26a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2z" fill="' + PT.toolColor(tool) + '"/><path d="M23 1v10h10" fill="none" stroke="#fff" stroke-width="2" opacity=".6"/><text x="17" y="31" text-anchor="middle" font-size="9" font-weight="800" fill="#fff" font-family="sans-serif">' + ext.slice(0, 4) + "</text></svg>", style: { display: "grid" } }),
          h("div", null, h("b", { text: r.name }), h("small", { text: r.info || PT.fmtSize(r.blob.size) }))),
        dl,
        extra.length ? h("div", { class: "row" }, extra) : null,
        dst,
        r.preview || null,
        h("div", { class: "row" },
          h("button", { class: "link", type: "button", text: "← Quay lại chỉnh sửa", onclick: () => app.show("ws") }),
          h("button", { class: "link", type: "button", text: "Làm với file khác", onclick: () => { app.result = null; if (cfg.onReset) cfg.onReset(); app.show("landing"); } })),
        chain].filter(Boolean));
      app.show("done");
      if (r.autoDownload !== false) doSave();
    };

    const routeFiles = (files, how) => {
      const pdfs = files.filter(PT.isPdf), imgs = files.filter((f) => !PT.isPdf(f) && PT.isImage(f));
      const okKinds = accept.concat(app.step === "ws" ? (cfg.wsAccept || []) : []);
      const take = [];
      if (okKinds.includes("pdf")) take.push(...pdfs);
      if (okKinds.includes("image")) take.push(...imgs);
      const rest = files.filter((f) => !take.includes(f));
      if (take.length) cfg.onFiles(take, how);
      if (!rest.length) return;
      const restImgs = rest.filter(PT.isImage), restPdfs = rest.filter(PT.isPdf);
      if (!take.length && restImgs.length && isPdfTool) PT.toast("Đây là ảnh, chưa phải PDF.", { label: "Chuyển ảnh sang PDF", run: () => PT.sendTo("img2pdf", restImgs) });
      else if (!take.length && restPdfs.length && !isPdfTool) PT.toast("Đây là file PDF.", { label: "Chọn công cụ PDF", run: () => PT.chooseTool(restPdfs) });
      else PT.toast("Đã bỏ qua " + rest.length + " file không đúng định dạng.");
    };
    app.intake = PT.intake({ accept: accept.concat(cfg.wsAccept || []).filter((v, i, a) => a.indexOf(v) === i), multiple: cfg.multiple, onFiles: routeFiles, enabled: () => app.step !== "done" && !app.busy });
    app.intake.input.accept = accept.map((k) => k === "pdf" ? "application/pdf,.pdf" : "image/*").join(",");
    app.pick = () => app.intake.pick(accept.map((k) => k === "pdf" ? "application/pdf,.pdf" : "image/*").join(","));
    go.addEventListener("click", () => cfg.onGo && cfg.onGo());
    if (cfg.sample) $("trySample").addEventListener("click", async (e) => {
      e.target.disabled = true;
      try { cfg.onFiles(await cfg.sample(), "sample"); } catch (err) { PT.toast("Không tạo được file mẫu: " + err.message); }
      e.target.disabled = false;
    });

    // files handed over from another tool (“Tiếp tục với…”) or from the home page
    if (location.hash === "#tiep") {
      history.replaceState(null, "", location.pathname + location.search);
      PT.handoff.take().then((fs) => { if (fs.length) routeFiles(fs, "handoff"); }).catch(() => {});
    }
    // warm up libraries while the person picks a file
    (cfg.libs || ["pdfjs", "pdflib"]).forEach((l) => PT.lib(l).catch(() => {}));
    return app;
  };

  /* ---------- Shared bits for boards ---------- */
  function sheetFor(w, h2, small) {
    const sh = h("div", { class: "sheet" });
    const slotH = small ? 160 : 200;
    sh.style.aspectRatio = w + " / " + h2;
    sh.style.width = "min(100%, " + Math.round(slotH * w / h2) + "px)";
    return sh;
  }
  const SMALL = () => window.innerWidth <= 480;
  function dragSort(li, idx, state, move) {
    li.draggable = true;
    li.addEventListener("dragstart", (e) => { state.from = idx; li.classList.add("dragging"); e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", String(idx)); } catch (_) {} });
    li.addEventListener("dragend", () => { state.from = -1; li.classList.remove("dragging"); document.querySelectorAll(".card.target").forEach((c) => c.classList.remove("target")); });
    li.addEventListener("dragover", (e) => { if (state.from < 0) return; e.preventDefault(); e.stopPropagation(); li.classList.add("target"); });
    li.addEventListener("dragleave", () => li.classList.remove("target"));
    li.addEventListener("drop", (e) => { if (state.from < 0) return; e.preventDefault(); e.stopPropagation(); const f = state.from; state.from = -1; move(f, idx); });
  }
  function orderButtons(idx, len, move, label) {
    return h("div", { class: "order" },
      h("button", { type: "button", text: "←", title: "Đưa lên trước", "aria-label": "Đưa " + label + " lên trước", disabled: idx === 0, onclick: (e) => { e.stopPropagation(); move(idx, idx - 1); } }),
      h("button", { type: "button", text: "→", title: "Đưa ra sau", "aria-label": "Đưa " + label + " ra sau", disabled: idx === len - 1, onclick: (e) => { e.stopPropagation(); move(idx, idx + 1); } }));
  }
  function addCards(list, label, onAdd) {
    list.append(
      h("li", null, h("button", { type: "button", class: "add-card", onclick: onAdd }, h("span", { class: "plus", text: "+" }), label)),
      h("li", null, PT.pasteBox(null, "Dán file")));
  }
  PT.boardHead = function (board) {
    const head = h("div", { class: "board-head" }, h("p", { id: "countText" }), h("div", { class: "tools", id: "boardTools" }));
    board.append(head);
    return head;
  };
  PT.pillBtn = (icon, label, onclick, title) => h("button", { class: "pill", type: "button", title: title || null, onclick }, icon ? h("span", { html: PT.ICON[icon], style: { display: "grid" } }) : null, label);

  /* ---------- File board: one card per PDF (merge, compress, protect, unlock, text) ---------- */
  /* opts: { reorder, rotate, sortable, meta(item) → string/el, extra(item) → el, onChange(), addLabel, keepLocked } */
  PT.FileBoard = function (app, opts) {
    const fb = { items: [], opts };
    let uid = 0;
    const st = { from: -1 };
    const head = PT.boardHead(app.board);
    const banner = h("p", { class: "banner", hidden: true });
    const list = h("ol", { class: "cards" });
    app.board.append(banner, list);
    if (opts.sortable) $("boardTools").append(PT.pillBtn("sort", "Sắp xếp A→Z", () => { fb.items.sort((a, b) => a.name.localeCompare(b.name, "vi", { numeric: true })); fb.render(); }, "Sắp xếp theo tên file"));
    $("boardTools").append(PT.pillBtn(null, "Xoá hết", () => fb.clear()));
    fb.banner = banner;

    async function open(it, prompt) {
      it.loading = true; it.err = null; fb.render();
      try {
        const r = await PT.readPdf(it.file, { password: it.password, noPrompt: !prompt });
        Object.assign(it, { bytes: r.bytes, js: r.js, password: r.password, pages: r.pages, locked: false, loading: false });
        fb.render();
        const t = await PT.thumb(r.js, 1, 200);
        it.thumb = t.url; it.tw = t.w; it.th = t.h;
      } catch (e) {
        it.loading = false;
        if (e instanceof PT.Cancel) { it.locked = true; it.bytes = it.bytes || new Uint8Array(await it.file.arrayBuffer()); }
        else { PT.toast(PT.pdfError(e, it.name)); fb.items = fb.items.filter((x) => x !== it); }
      }
      fb.render();
    }
    fb.unlock = (it) => open(it, true);
    fb.add = async function (files) {
      if (fb.items.some((i) => i.sample) && !files.every((f) => f.sample)) fb.items = fb.items.filter((i) => !i.sample);
      const fresh = files.map((f) => ({ id: ++uid, file: f, name: f.name, size: f.size, rot: 0, loading: true, sample: !!f.sample }));
      fb.items.push(...fresh);
      if (app.step !== "ws") app.show("ws");
      fb.render();
      for (const it of fresh) await open(it, !opts.keepLocked);
    };
    fb.clear = function () { fb.items.forEach((i) => i.js && i.js.destroy()); fb.items = []; fb.render(); app.show("landing"); };
    fb.ready = () => fb.items.length > 0 && fb.items.every((i) => !i.loading && !i.locked);
    const move = (from, to) => {
      if (to < 0 || to >= fb.items.length || from === to) return;
      const [x] = fb.items.splice(from, 1); fb.items.splice(to, 0, x); fb.render();
    };
    fb.render = function () {
      list.textContent = "";
      fb.items.forEach((it, idx) => {
        const li = h("li", { class: "card", tabindex: "0", "aria-label": "File " + (idx + 1) + ": " + it.name });
        const w = it.tw || 595, hh = it.th || 842;
        const rw = it.rot % 180 ? hh : w, rh = it.rot % 180 ? w : hh;
        const sheet = sheetFor(rw, rh, SMALL());
        if (it.thumb) {
          const im = h("img", { class: "pg", alt: "" });
          if (it.rot) PT.rotateUrl(it.thumb, it.rot).then((u) => { im.src = u; }); else im.src = it.thumb;
          sheet.append(im);
        } else if (it.locked) sheet.append(h("div", { class: "lockface", html: PT.ICON.lock }));
        else sheet.append(h("div", { class: "ph" }));
        if (opts.reorder) li.append(h("span", { class: "num", text: idx + 1 }));
        const acts = h("div", { class: "hover-acts" });
        if (opts.rotate && !it.locked) acts.append(h("button", { type: "button", class: "ic", title: "Xoay", "aria-label": "Xoay " + it.name, html: PT.ICON.rotate, onclick: () => { it.rot = (it.rot + 90) % 360; fb.render(); } }));
        acts.append(h("button", { type: "button", class: "ic", title: "Bỏ file", "aria-label": "Bỏ " + it.name, html: PT.ICON.del, onclick: () => { if (it.js) it.js.destroy(); fb.items.splice(idx, 1); if (!fb.items.length) app.show("landing"); fb.render(); } }));
        li.append(acts, h("div", { class: "slot" }, sheet), h("div", { class: "fname", title: it.name, text: it.name }));
        let meta = it.loading ? "Đang đọc…" : it.locked ? null : (it.pages + " trang · " + PT.fmtSize(it.size));
        if (opts.meta && !it.loading && !it.locked) meta = opts.meta(it) || meta;
        if (meta) li.append(typeof meta === "string" ? h("div", { class: "meta", text: meta }) : meta);
        if (it.locked) li.append(h("div", { style: { textAlign: "center" } }, h("button", { type: "button", class: "lock-cta", onclick: () => fb.unlock(it) }, h("span", { html: PT.ICON.lock, style: { display: "grid" } }), "Nhập mật khẩu")));
        if (opts.extra) { const x = opts.extra(it); if (x) li.append(x); }
        if (opts.reorder && fb.items.length > 1) { li.append(orderButtons(idx, fb.items.length, move, it.name)); dragSort(li, idx, st, move); }
        list.append(li);
      });
      addCards(list, opts.addLabel || "Thêm file PDF", () => app.pick());
      const n = fb.items.length;
      if ($("badge")) $("badge").textContent = n;
      const pages = fb.items.reduce((s, i) => s + (i.pages || 0), 0);
      $("countText").textContent = n + " file · " + pages + " trang" + (opts.reorder && n > 1 ? " · kéo thả để đổi thứ tự" : "");
      banner.hidden = !fb.items.some((i) => i.sample);
      banner.textContent = "Đây là file mẫu. Chọn hoặc dán file của bạn, file mẫu sẽ tự được thay thế.";
      if (opts.onChange) opts.onChange();
    };
    return fb;
  };

  /* ---------- Page board: one card per page (split, remove, organize, rotate, to-image, numbers, watermark) ---------- */
  /* opts: { reorder, rotate, remove, click(p, idx, e) → bool, rangeProp:"sel"|"off", decorate(sheet, p, idx), group(p, idx) → color, onChange(), multiDoc, insertBlank } */
  PT.PageBoard = function (app, opts) {
    const pb = { docs: [], pages: [], opts };
    let key = 0, lastClick = -1;
    const st = { from: -1 };
    PT.boardHead(app.board);
    const banner = h("p", { class: "banner", hidden: true });
    const list = h("ol", { class: "cards" });
    app.board.append(banner, list);
    pb.list = list; pb.banner = banner;
    const io = new IntersectionObserver((ents) => ents.forEach((en) => { if (en.isIntersecting) { io.unobserve(en.target); en.target._load && en.target._load(); } }), { rootMargin: "400px" });

    pb.addFile = async function (file) {
      if (pb.docs.some((d) => d.sample) && !file.sample) pb.clearDocs();
      if (!opts.multiDoc && pb.docs.length) pb.clearDocs();
      app.status("Đang mở " + file.name + "…");
      let r;
      try { r = await PT.readPdf(file); }
      catch (e) { app.status(""); PT.toast(PT.pdfError(e, file.name)); return false; }
      const di = pb.docs.length;
      pb.docs.push({ file, name: file.name, bytes: r.bytes, js: r.js, password: r.password, sample: !!file.sample });
      const first = await r.js.getPage(1);
      const vp = first.getViewport({ scale: 1 });
      for (let n = 1; n <= r.pages; n++) pb.pages.push({ key: ++key, doc: di, n, rot: 0, sel: false, off: false, w: vp.width, h: vp.height });
      app.status("");
      if (app.step !== "ws") app.show("ws");
      pb.render();
      // exact sizes of every page (cheap), so previews keep the right shape
      (async () => {
        for (const p of pb.pages.filter((x) => x.doc === di)) {
          try { const pg = await r.js.getPage(p.n); const v = pg.getViewport({ scale: 1 }); if (Math.abs(v.width - p.w) > 1 || Math.abs(v.height - p.h) > 1) { p.w = v.width; p.h = v.height; p.dirty = true; } } catch (_) {}
        }
        if (pb.pages.some((p) => p.dirty)) { pb.pages.forEach((p) => { p.dirty = false; }); pb.render(); }
      })();
      return true;
    };
    pb.clearDocs = function () { pb.docs.forEach((d) => d.js && d.js.destroy()); pb.docs = []; pb.pages = []; };
    pb.clear = function () { pb.clearDocs(); pb.render(); app.show("landing"); };
    pb.libDoc = function (di) { const d = pb.docs[di]; if (!d.lib) d.lib = PT.libDoc(d.bytes, d.password); return d.lib; };
    pb.visDims = (p) => p.rot % 180 ? [p.h, p.w] : [p.w, p.h];
    const move = (from, to) => {
      if (to < 0 || to >= pb.pages.length || from === to) return;
      const [x] = pb.pages.splice(from, 1); pb.pages.splice(to, 0, x); pb.render();
    };
    pb.move = move;

    pb.render = function () {
      list.textContent = "";
      const multi = pb.docs.length > 1;
      pb.pages.forEach((p, idx) => {
        const tk = typeof opts.tick === "function" ? opts.tick() : opts.tick;
        const li = h("li", { class: "card" + (p.sel && tk === "sel" ? " sel" : "") + (p.off ? " off" : "") + (opts.click ? " clickable" : ""), tabindex: "0", "aria-label": "Trang " + (idx + 1) + (p.sel ? ", đã chọn" : "") + (p.off ? ", sẽ bị xoá" : "") });
        const [vw, vh] = pb.visDims(p);
        const sheet = sheetFor(vw, vh, SMALL());
        const im = h("img", { class: "pg", alt: "" });
        sheet.append(im);
        if (p.blank) im.remove();
        else if (p.thumb) PT.rotateUrl(p.thumb, p.rot).then((u) => { im.src = u; });
        else {
          sheet.append(h("div", { class: "ph" }));
          li._load = async () => {
            try {
              const t = await PT.thumb(pb.docs[p.doc].js, p.n, 200);
              p.thumb = t.url;
              const ph = sheet.querySelector(".ph"); if (ph) ph.remove();
              im.src = await PT.rotateUrl(t.url, p.rot);
            } catch (_) {}
          };
          io.observe(li);
        }
        if (opts.decorate) opts.decorate(sheet, p, idx);
        li.append(h("span", { class: "num", text: idx + 1 }));
        if (tk) li.append(h("span", { class: "tick", html: tk === "off" ? PT.ICON.del : PT.ICON.check }));
        const acts = h("div", { class: "hover-acts" });
        if (opts.rotate) acts.append(h("button", { type: "button", class: "ic", title: "Xoay phải", "aria-label": "Xoay trang " + (idx + 1), html: PT.ICON.rotate, onclick: (e) => { e.stopPropagation(); p.rot = (p.rot + 90) % 360; pb.render(); } }));
        if (opts.remove) acts.append(h("button", { type: "button", class: "ic", title: "Xoá trang", "aria-label": "Xoá trang " + (idx + 1), html: PT.ICON.del, onclick: (e) => { e.stopPropagation(); pb.pages.splice(idx, 1); if (!pb.pages.length) { pb.clear(); return; } pb.render(); } }));
        if (acts.children.length) li.append(acts);
        li.append(h("div", { class: "slot" }, sheet));
        li.append(h("div", { class: "fname", html: p.blank ? "Trang trắng" : (multi ? "<b>" + String.fromCharCode(65 + p.doc) + "</b> · " : "") + "Trang " + p.n + (p.rot ? " · ↻" + p.rot + "°" : "") }));
        if (opts.group) { const c = opts.group(p, idx); if (c) li.append(h("span", { class: "group-tag", style: { background: c } })); }
        if (opts.reorder) { li.append(orderButtons(idx, pb.pages.length, move, "trang " + (idx + 1))); dragSort(li, idx, st, move); }
        if (opts.click) {
          const act = (e) => {
            if (opts.rangeProp && e.shiftKey && lastClick >= 0 && lastClick < pb.pages.length) {
              const v = !p[opts.rangeProp];
              const [a, b] = [Math.min(lastClick, idx), Math.max(lastClick, idx)];
              for (let i = a; i <= b; i++) pb.pages[i][opts.rangeProp] = v;
              pb.render();
            } else opts.click(p, idx, e);
            lastClick = idx;
          };
          li.addEventListener("click", (e) => { if (e.target.closest("button")) return; act(e); });
          li.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); act(e); } });
        }
        list.append(li);
      });
      if (opts.multiDoc) addCards(list, "Thêm file PDF", () => app.pick());
      $("countText").textContent = pb.pages.length + " trang" + (pb.docs.length === 1 ? " · " + pb.docs[0].name : "");
      if (opts.onChange) opts.onChange();
      banner.hidden = !pb.docs.some((d) => d.sample);
      banner.textContent = "Đây là file mẫu. Chọn hoặc dán file của bạn, file mẫu sẽ tự được thay thế.";
    };
    // re-apply live preview overlays without rebuilding the grid
    pb.redecorate = function () {
      if (!opts.decorate) return;
      [...list.querySelectorAll(".card .sheet")].forEach((sh, idx) => {
        sh.querySelectorAll(".deco").forEach((d) => d.remove());
        if (pb.pages[idx]) opts.decorate(sh, pb.pages[idx], idx);
      });
    };
    // copy pages (in the given order) into a new pdf-lib document, one copyPages call per source
    pb.build = async function (pageList, onStep) {
      const L = await PT.lib("pdflib");
      const out = await L.PDFDocument.create();
      const need = new Map();
      pageList.forEach((p) => { if (!p.blank) { if (!need.has(p.doc)) need.set(p.doc, new Set()); need.get(p.doc).add(p.n - 1); } });
      const copied = new Map();
      for (const [di, set] of need) {
        const src = await pb.libDoc(di);
        const idxs = [...set].sort((a, b) => a - b);
        const cps = await out.copyPages(src, idxs);
        idxs.forEach((n, k) => copied.set(di + ":" + n, cps[k]));
        if (onStep) await onStep();
      }
      const usedOnce = new Set();
      for (const p of pageList) {
        if (p.blank) { const bp = out.addPage([p.w, p.h]); if (p.rot) bp.setRotation(L.degrees(p.rot)); continue; }
        const k = p.doc + ":" + (p.n - 1);
        let pg = copied.get(k);
        if (usedOnce.has(k)) { [pg] = await out.copyPages(await pb.libDoc(p.doc), [p.n - 1]); } // same page placed twice
        usedOnce.add(k);
        if (p.rot) pg.setRotation(L.degrees(((pg.getRotation().angle || 0) + p.rot) % 360));
        out.addPage(pg);
      }
      return out;
    };
    return pb;
  };

  // radio tiles: rows=true gives full-width rows with a sub line; opts: [{ value, label, sub, icon, checked }]
  PT.tiles = (name, opts, rows) =>
    '<div class="tiles' + (rows ? " rows" : "") + '" role="radiogroup">' + opts.map((o) =>
      '<label class="opt"><input type="radio" name="' + name + '" value="' + o.value + '"' + (o.checked ? " checked" : "") + '><span class="tile">' +
      (o.icon || "") + "<span><b>" + o.label + "</b>" + (o.sub ? "<small>" + o.sub + "</small>" : "") + "</span></span></label>").join("") + "</div>";
  PT.radio = (name) => { const r = document.querySelector('input[name="' + name + '"]:checked'); return r ? r.value : null; };
  PT.onInput = (sel, fn) => document.querySelectorAll(sel).forEach((el) => { el.addEventListener("input", fn); el.addEventListener("change", fn); });
  PT.checkbox = (id, label, sub, checked) =>
    '<label class="chk"><input type="checkbox" id="' + id + '"' + (checked ? " checked" : "") + '><span class="box">' + PT.ICON.check + "</span><span>" + label + (sub ? "<small>" + sub + "</small>" : "") + "</span></label>";
})();

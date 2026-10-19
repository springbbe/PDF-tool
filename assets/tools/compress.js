/* Nén PDF: re-encode the pictures inside the PDF (text and vector graphics stay sharp), then save with object streams */
(function () {
  const { $ } = PT;
  const LEVELS = {
    low: { max: 2400, q: 0.8, flate: false },
    mid: { max: 1600, q: 0.66, flate: true },
    high: { max: 1100, q: 0.5, flate: true }
  };
  let fb;
  const app = PT.shell({
    tool: "compress", multiple: true,
    pick: "Chọn file PDF",
    railTitle: "Mức nén",
    rail:
      '<div class="group">' + PT.tiles("level", [
        { value: "low", label: "Nén nhẹ", sub: "Gần như giữ nguyên chất lượng ảnh" },
        { value: "mid", label: "Khuyên dùng", sub: "Nhỏ gọn, ảnh vẫn rõ khi xem trên máy", checked: true },
        { value: "high", label: "Nén mạnh", sub: "Nhỏ nhất, ảnh mờ hơn — hợp gửi Zalo" }
      ], true) + "</div>" +
      '<p class="hint">Chữ và hình vẽ giữ nguyên dạng vector nên vẫn sắc nét và chọn được chữ. File ít ảnh sẽ giảm không nhiều.</p>',
    action: "Nén PDF",
    sample: async () => { const f = await PT.samplePdf({ pages: 3 }); f.sample = true; return [f]; },
    onFiles: (files) => fb.add(files),
    onReset: () => fb.clear(),
    onGo: () => app.run(run)
  });
  fb = PT.FileBoard(app, {
    onChange() { app.setReady(fb.ready(), fb.items.some((i) => i.locked) ? "Có file đang khoá, hãy nhập mật khẩu hoặc bỏ file đó." : ""); }
  });

  const N = (L, s) => L.PDFName.of(s);
  async function inflate(bytes) {
    const ds = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate"));
    return new Uint8Array(await new Response(ds).arrayBuffer());
  }
  // undo PNG row filters (Predictor >= 10)
  function unpng(data, w, h, bpp) {
    const stride = w * bpp, out = new Uint8Array(stride * h);
    let ip = 0;
    for (let y = 0; y < h; y++) {
      const ft = data[ip++], row = y * stride, prev = row - stride;
      for (let x = 0; x < stride; x++) {
        const raw = data[ip++] || 0;
        const a = x >= bpp ? out[row + x - bpp] : 0, b = y ? out[prev + x] : 0, c = (x >= bpp && y) ? out[prev + x - bpp] : 0;
        let v;
        switch (ft) {
          case 1: v = raw + a; break;
          case 2: v = raw + b; break;
          case 3: v = raw + ((a + b) >> 1); break;
          case 4: { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v = raw + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); break; }
          default: v = raw;
        }
        out[row + x] = v & 255;
      }
    }
    return out;
  }
  function components(L, cs) {
    if (!cs) return 0;
    if (cs instanceof L.PDFName) return { "/DeviceRGB": 3, "/DeviceGray": 1, "/CalRGB": 3, "/CalGray": 1 }[cs.toString()] || 0;
    if (cs instanceof L.PDFArray && cs.size() >= 2) {
      const kind = cs.lookup(0);
      if (kind && kind.toString() === "/ICCBased") {
        const icc = cs.lookup(1);
        const n = icc && icc.dict && icc.dict.lookup(N(L, "N"));
        return n ? n.asNumber() : 0;
      }
      if (kind && /^\/Cal(RGB|Gray)$/.test(kind.toString())) return kind.toString() === "/CalRGB" ? 3 : 1;
    }
    return 0;
  }

  async function shrinkImages(L, doc, cfg, onStep) {
    const ctx = doc.context;
    const imgs = ctx.enumerateIndirectObjects().filter(([, o]) => o instanceof L.PDFRawStream && o.dict.lookup(N(L, "Subtype")) === N(L, "Image"));
    let done = 0;
    for (const [ref, obj] of imgs) {
      done++;
      try {
        const d = obj.dict, get = (k) => d.lookup(N(L, k));
        if (get("ImageMask") || get("Decode") || get("Mask")) continue;
        let filter = get("Filter");
        if (filter instanceof L.PDFArray) filter = filter.size() === 1 ? filter.lookup(0) : null;
        if (!filter) continue;
        const fname = filter.toString();
        const W = get("Width").asNumber(), H = get("Height").asNumber();
        const bpc = get("BitsPerComponent") ? get("BitsPerComponent").asNumber() : 8;
        const nc = components(L, get("ColorSpace"));
        if (W * H < 60000 || bpc !== 8 || !(nc === 1 || nc === 3)) continue;
        const old = obj.contents;
        let source;
        if (fname === "/DCTDecode") {
          source = await createImageBitmap(new Blob([old], { type: "image/jpeg" }));
        } else if (fname === "/FlateDecode" && cfg.flate) {
          let raw = await inflate(old);
          const parms = get("DecodeParms");
          const pred = parms && parms.lookup && parms.lookup(N(L, "Predictor")) ? parms.lookup(N(L, "Predictor")).asNumber() : 1;
          if (pred >= 10) raw = unpng(raw, W, H, nc);
          else if (pred !== 1) continue;
          if (raw.length < W * H * nc) continue;
          const id = new ImageData(W, H), px = id.data;
          for (let i = 0, j = 0; i < W * H; i++, j += nc) {
            const k = i * 4;
            if (nc === 3) { px[k] = raw[j]; px[k + 1] = raw[j + 1]; px[k + 2] = raw[j + 2]; }
            else { px[k] = px[k + 1] = px[k + 2] = raw[j]; }
            px[k + 3] = 255;
          }
          source = await createImageBitmap(id);
        } else continue;
        const s = Math.min(1, cfg.max / Math.max(W, H));
        const cw = Math.max(1, Math.round(W * s)), ch = Math.max(1, Math.round(H * s));
        const c = document.createElement("canvas"); c.width = cw; c.height = ch;
        const g = c.getContext("2d");
        g.imageSmoothingQuality = "high";
        g.drawImage(source, 0, 0, cw, ch);
        if (source.close) source.close();
        const jpg = await PT.canvasBytes(c, "image/jpeg", cfg.q);
        if (jpg.length >= old.length * 0.9) continue;
        const ns = ctx.stream(jpg, { Type: "XObject", Subtype: "Image", Width: cw, Height: ch, ColorSpace: "DeviceRGB", BitsPerComponent: 8, Filter: "DCTDecode" });
        const smask = d.get(N(L, "SMask"));
        if (smask) ns.dict.set(N(L, "SMask"), smask);
        ctx.assign(ref, ns);
      } catch (e) { /* leave this picture as it was */ }
      if (onStep) await onStep(done / imgs.length);
    }
  }

  async function run() {
    const L = await PT.lib("pdflib");
    const cfg = LEVELS[PT.radio("level")];
    const outs = [];
    let before = 0, after = 0;
    for (let i = 0; i < fb.items.length; i++) {
      const it = fb.items[i];
      app.status("Đang nén " + it.name + (fb.items.length > 1 ? " (" + (i + 1) + "/" + fb.items.length + ")" : "") + "…");
      const doc = await PT.libDoc(it.bytes, it.password);
      await shrinkImages(L, doc, cfg, async (f) => { app.progress((i + f) / fb.items.length); await PT.frame(); });
      let data = await doc.save({ useObjectStreams: true });
      if (data.length >= it.bytes.length && !it.password) data = it.bytes; // never hand back something bigger
      before += it.bytes.length; after += data.length;
      outs.push({ name: PT.baseName(it.name) + "-da-nen.pdf", data });
      app.progress((i + 1) / fb.items.length);
    }
    const pct = Math.round((1 - after / before) * 100);
    const saving = pct > 0 ? "Giảm " + pct + "%: " + PT.fmtSize(before) + " → " + PT.fmtSize(after) : null;
    const title = pct >= 3 ? "Đã nén PDF!" : "File đã gọn sẵn, gần như không nén thêm được";
    if (outs.length === 1) {
      const blob = new Blob([outs[0].data], { type: "application/pdf" });
      app.finish({ blob, name: outs[0].name, title, saving, info: PT.fmtSize(blob.size) });
    } else {
      const blob = await PT.zip(outs);
      app.finish({ blob, name: "pdf-da-nen-" + outs.length + "-file.zip", title, saving, info: outs.length + " file PDF · " + PT.fmtSize(blob.size) });
    }
  }
})();

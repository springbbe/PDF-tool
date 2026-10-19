/* Đặt mật khẩu PDF: AES-256 encryption with optional permission limits */
(function () {
  const { $, h } = PT;
  let fb;
  const app = PT.shell({
    tool: "protect", multiple: true,
    railTitle: "Đặt mật khẩu",
    rail:
      '<div class="group"><label class="lbl" for="pw1">Mật khẩu mở file</label><div id="pw1Wrap"></div>' +
      '<label class="lbl" for="pw2">Nhập lại mật khẩu</label><div id="pw2Wrap"></div><p class="field-err" id="pwErr" hidden></p></div>' +
      '<p class="hint box">Hãy ghi nhớ mật khẩu. Không ai (kể cả chúng tôi) lấy lại được nếu bạn quên.</p>' +
      '<details class="more"><summary>Hạn chế quyền (tuỳ chọn)</summary><div>' +
      PT.checkbox("noPrint", "Không cho in") +
      PT.checkbox("noCopy", "Không cho sao chép chữ, hình") +
      PT.checkbox("noEdit", "Không cho chỉnh sửa, thêm bớt trang") +
      '<p class="hint">Người có mật khẩu mở file vẫn bị hạn chế các quyền trên. Bạn (người tạo) dùng mật khẩu quản trị dưới đây để có toàn quyền.</p>' +
      '<label class="lbl" for="pwOwner">Mật khẩu quản trị</label><div id="pwOwnerWrap"></div>' +
      "</div></details>",
    action: "Khoá PDF",
    sample: async () => { const f = await PT.samplePdf({ pages: 2 }); f.sample = true; return [f]; },
    onFiles: (files) => fb.add(files),
    onReset: () => fb.clear(),
    onGo: () => app.run(run)
  });
  const p1 = PT.pwField({ id: "pw1", autocomplete: "new-password", placeholder: "Ít nhất 4 ký tự" });
  const p2 = PT.pwField({ id: "pw2", autocomplete: "new-password" });
  const po = PT.pwField({ id: "pwOwner", autocomplete: "new-password", placeholder: "Để trống = giống mật khẩu mở file" });
  $("pw1Wrap").replaceWith(p1.wrap); $("pw2Wrap").replaceWith(p2.wrap); $("pwOwnerWrap").replaceWith(po.wrap);

  fb = PT.FileBoard(app, { onChange: check });
  function check() {
    const a = $("pw1").value, b = $("pw2").value;
    let err = "";
    if (a && a.length < 4) err = "Mật khẩu nên có ít nhất 4 ký tự.";
    else if (b && a !== b) err = "Hai mật khẩu chưa khớp.";
    $("pwErr").hidden = !err; $("pwErr").textContent = err;
    const ok = fb.ready() && a.length >= 4 && a === b;
    app.setReady(ok, fb.items.some((i) => i.locked) ? "Có file đang khoá, hãy nhập mật khẩu hoặc bỏ file đó." : (!a ? "Nhập mật khẩu để khoá file." : ""));
  }
  PT.onInput("#pw1, #pw2", check);

  async function run() {
    const pw = $("pw1").value;
    const limit = $("noPrint").checked || $("noCopy").checked || $("noEdit").checked;
    const owner = $("pwOwner").value || pw;
    const permissions = {
      printing: $("noPrint").checked ? false : "highResolution",
      copying: !$("noCopy").checked, contentAccessibility: true,
      modifying: !$("noEdit").checked, annotating: !$("noEdit").checked, fillingForms: true, documentAssembly: !$("noEdit").checked
    };
    if (limit && owner === pw) app.status("Lưu ý: mật khẩu quản trị trùng mật khẩu mở file nên hạn chế quyền chỉ có tác dụng với một số trình đọc PDF.");
    const outs = [];
    for (let i = 0; i < fb.items.length; i++) {
      const it = fb.items[i];
      const doc = await PT.libDoc(it.bytes, it.password);
      doc.encrypt({ userPassword: pw, ownerPassword: owner, permissions });
      outs.push({ name: PT.baseName(it.name) + "-co-mat-khau.pdf", data: await doc.save() });
      app.progress((i + 1) / fb.items.length);
      await PT.frame();
    }
    const info = "Mã hoá AES-256";
    if (outs.length === 1) {
      const blob = new Blob([outs[0].data], { type: "application/pdf" });
      app.finish({ blob, name: outs[0].name, title: "Đã khoá PDF bằng mật khẩu!", info: info + " · " + PT.fmtSize(blob.size), chain: false });
    } else {
      const blob = await PT.zip(outs);
      app.finish({ blob, name: "pdf-co-mat-khau-" + outs.length + "-file.zip", title: "Đã khoá " + outs.length + " file PDF!", info: info + " · " + PT.fmtSize(blob.size) });
    }
  }
})();

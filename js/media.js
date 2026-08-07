// Media Library → Files: интерактив прототипа.
// Только показать/скрыть готовую статичную разметку — меню действий (⋮) и
// модалки-превью. Никаких innerHTML-шаблонов (кроме подстановки имени файла).
(function () {
  var pop = document.getElementById("mlActions");
  var activeRow = null; // строка, для которой открыто меню «⋮» (нужно имя файла для Share)
  var revokeTargetRow = null; // строка доступа, ожидающая подтверждения отзыва
  // кастомная панель видео вынесена в js/player.js (переиспользуется и на публичной странице)

  function positionPop(btn) {
    var r = btn.getBoundingClientRect();
    var pw = pop.offsetWidth || 210;
    var ph = pop.offsetHeight || 300;
    var left = Math.min(r.right - pw, window.innerWidth - pw - 8);
    var top = r.bottom + 4;
    if (top + ph > window.innerHeight - 8) top = Math.max(8, r.top - ph - 4);
    pop.style.left = Math.max(8, left) + "px";
    pop.style.top = top + "px";
  }

  function openActions(btn, kind) {
    var isFolder = kind === "folder";
    var isFile = !isFolder;
    var isVideo = kind === "video";
    var isAudio = kind === "audio";
    var items = pop.querySelectorAll(".ml-action");
    for (var i = 0; i < items.length; i++) {
      var when = items[i].getAttribute("data-when");
      var show = when === "any" || (when === "file" && isFile) || (when === "video" && isVideo) || (when === "av" && (isVideo || isAudio));
      items[i].hidden = !show;
    }
    // пункт транскрибации: если файл уже транскрибирован — «Review transcription»
    // (откроет модалку результата с Regenerate/Save as…), иначе «Transcribe»
    var trAction = pop.querySelector('[data-action="transcribe"]');
    if (trAction) {
      var fname = activeRow ? activeRow.getAttribute("data-name") : "";
      var lbl = trAction.querySelector("[data-transcribe-label]");
      if (fname && transcribedFiles[fname]) { trAction.setAttribute("data-transcribe-mode", "review"); if (lbl) lbl.textContent = "Review transcription"; }
      else { trAction.setAttribute("data-transcribe-mode", "create"); if (lbl) lbl.textContent = "Transcribe"; }
    }
    // разделитель виден только если есть видимая группа И до него, И после него
    // (иначе для не-видео файлов / скрытых пунктов не будет «пустых» линий подряд)
    var groups = [].slice.call(pop.querySelectorAll(".ml-actions__group"));
    var seps = [].slice.call(pop.querySelectorAll(".ml-actions__sep"));
    var vis = groups.map(function (g) { return !!g.querySelector(".ml-action:not([hidden])"); });
    seps.forEach(function (sep, i) {
      // sep[i] стоит между group[i] и group[i+1]; показываем, только если сама
      // group[i] видима (непосредственно перед) И есть видимая группа после неё —
      // иначе вокруг скрытой группы не будет двух линий подряд.
      var before = vis[i];
      var after = vis.slice(i + 1).indexOf(true) !== -1;
      sep.hidden = !(before && after);
    });
    pop.classList.add("is-open");
    positionPop(btn);
  }
  function closeActions() { pop && pop.classList.remove("is-open"); }

  function openModal(kind, name, src) {
    var modal = document.getElementById("mlModal-" + kind);
    if (!modal) return;
    var titles = modal.querySelectorAll("[data-title]");
    for (var i = 0; i < titles.length; i++) titles[i].textContent = name;
    // Проставляем источник в нативный элемент превью (реальный файл из files/)
    if (src) {
      var v = modal.querySelector(".ml-video-el");
      var a = modal.querySelector(".ml-audio-el");
      var img = modal.querySelector(".ml-img-el");
      var frame = modal.querySelector(".ml-pdf-frame");
      if (v) { v.src = src; }
      if (a) { a.src = src; }
      if (img) { img.src = src; }
      if (frame) { frame.src = src; }
    }
    modal.classList.add("is-open");
    document.body.style.overflow = "hidden";
  }
  function closeModals() {
    var open = document.querySelectorAll(".ml-modal.is-open");
    for (var i = 0; i < open.length; i++) {
      var m = open[i];
      m.classList.remove("is-open");
      // остановить/сбросить медиа, чтобы не играло в фоне и не грузилось
      var v = m.querySelector(".ml-video-el");
      var a = m.querySelector(".ml-audio-el");
      var frame = m.querySelector(".ml-pdf-frame");
      if (v) { v.pause(); v.removeAttribute("src"); v.load(); }
      if (a) { a.pause(); a.removeAttribute("src"); a.load(); }
      if (frame) { frame.removeAttribute("src"); }
    }
    if (pubTimer) { clearTimeout(pubTimer); pubTimer = null; }
    document.body.style.overflow = "";
  }

  // ----- модалка метаданных: два режима — «send» (Send to YouTube Studio, с выбором канала + success)
  //        и «metadata» (только генерация → Save metadata в файл, без канала/отправки) -----
  var pubTimer = null;
  var pubMode = "send";       // текущий режим модалки
  var pubVideoName = "";      // имя видео, для которого открыт флоу (для имени .txt)
  var metadataFiles = {};     // имя .txt → текст (для превью/перезаписи)
  var metadataRevealed = true; // папка Metadata видна по умолчанию (с одним семпл-файлом)
  // Семпл-контент для предзаполненного .txt (совпадает по имени со строкой в разметке)
  metadataFiles["video_2026-06-30_intro-teaser - metadata.txt"] =
    "Title\n" +
    "1. Intro Teaser — Meet SubSub in 60 Seconds\n" +
    "2. What Is SubSub? Quick Intro for Creators\n" +
    "3. SubSub in 60 Seconds (Teaser)\n\n" +
    "Description\n" +
    "A short teaser introducing SubSub — one place to manage, preview, share and publish every asset. Full walkthrough coming soon.\n\n" +
    "Tags\n" +
    "subsub, teaser, intro, creator tools, media library\n\n" +
    "Hashtags\n" +
    "#SubSub #Teaser #CreatorTools #Intro\n\n" +
    "Timecodes\n" +
    "0:00 Hook\n" +
    "0:15 What SubSub does\n" +
    "0:40 Call to action";
  var TITLE_VARIANTS = [
    "How to Use SubSub Media Library — Full Walkthrough",
    "SubSub Media Library Tutorial: Upload, Preview & Publish",
    "Master Your Media Library in SubSub (Step-by-Step Guide)",
  ];
  var titleIdx = 0;

  function setPubStep(n) {
    var modal = document.getElementById("mlModal-publish");
    if (!modal) return;
    var steps = modal.querySelectorAll(".ml-publish__step");
    for (var i = 0; i < steps.length; i++) {
      steps[i].classList.toggle("is-active", steps[i].getAttribute("data-step") === String(n));
    }
    // «Regenerate» и закреплённый футер видны только на шаге с формой (не на лоадере/успехе)
    var onForm = String(n) === "2";
    var regen = modal.querySelector("[data-pub-regen]");
    if (regen) regen.hidden = !onForm;
    var foot = modal.querySelector("[data-pub-foot]");
    if (foot) foot.hidden = !onForm;
    // режим: send → секция канала + CTA «Send to YouTube Studio»; metadata → без канала + CTA «Save metadata»
    var isSend = pubMode !== "metadata";
    var chan = modal.querySelector("[data-pub-channel]"); if (chan) chan.hidden = !isSend;
    var sendBtn = modal.querySelector("[data-pub-send]"); if (sendBtn) sendBtn.hidden = !isSend;
    var saveBtn = modal.querySelector("[data-pub-save]"); if (saveBtn) saveBtn.hidden = isSend;
    var title = modal.querySelector("[data-pub-title]"); if (title) title.textContent = isSend ? "Send to YouTube Studio" : "Generate metadata";
  }
  function applyTitle(modal) {
    var inp = modal.querySelector("[data-title-input]");
    var idx = modal.querySelector("[data-title-idx]");
    var total = modal.querySelector("[data-title-total]");
    if (inp) inp.value = TITLE_VARIANTS[titleIdx];
    if (idx) idx.textContent = String(titleIdx + 1);
    if (total) total.textContent = String(TITLE_VARIANTS.length);
  }
  function setChannelState(modal, empty) {
    var pop = modal.querySelector("[data-chan-populated]");
    var emp = modal.querySelector("[data-chan-empty]");
    var cta = modal.querySelector(".ml-publish__cta");
    if (pop) pop.hidden = empty;
    if (emp) emp.hidden = !empty;
    if (cta) cta.disabled = empty; // без каналов публиковать нельзя
  }
  function initPublish() {
    var modal = document.getElementById("mlModal-publish");
    if (!modal) return;
    titleIdx = 0;
    applyTitle(modal);
    var menu = modal.querySelector("[data-chan-menu]"); if (menu) menu.hidden = true;
    var g = modal.querySelector("[data-gsignin]"); if (g) g.hidden = true;
    // ?channels=empty → показать empty-state (нет подключённых каналов)
    setChannelState(modal, /[?&]channels=empty\b/.test(location.search));
    var copied = modal.querySelectorAll(".ml-copy.is-copied");
    for (var i = 0; i < copied.length; i++) { copied[i].classList.remove("is-copied"); var l = copied[i].querySelector("[data-copy-label]"); if (l) l.textContent = "Copy"; }
  }
  function openPublish(mode) {
    var modal = document.getElementById("mlModal-publish");
    if (!modal) return;
    pubMode = mode === "metadata" ? "metadata" : "send";
    modal.setAttribute("data-pub-mode", pubMode);
    setPubStep(1);
    modal.classList.add("is-open");
    document.body.style.overflow = "hidden";
    if (pubTimer) clearTimeout(pubTimer);
    pubTimer = setTimeout(function () { setPubStep(2); initPublish(); }, 1500); // мок «генерации»
  }
  function openSendToStudio() { openPublish("send"); }
  function openMetadata() { openPublish("metadata"); }
  function selectChannel(modal, opt) {
    var name = opt.getAttribute("data-name") || opt.textContent.trim();
    var ava = opt.querySelector(".ml-chan__ava");
    var curName = modal.querySelector("[data-chan-current]");
    var curAva = modal.querySelector("[data-chan-ava]");
    if (curName) curName.textContent = name;
    if (curAva && ava) curAva.textContent = ava.textContent;
    var menu = modal.querySelector("[data-chan-menu]"); if (menu) menu.hidden = true;
  }
  function connectChannel(modal) {
    var g = modal.querySelector("[data-gsignin]"); if (g) g.hidden = true;
    setChannelState(modal, false);            // после «подключения» — populated
    var curName = modal.querySelector("[data-chan-current]");
    var curAva = modal.querySelector("[data-chan-ava]");
    if (curName) curName.textContent = "New Channel";
    if (curAva) curAva.textContent = "N";
    var menu = modal.querySelector("[data-chan-menu]"); if (menu) menu.hidden = true;
  }
  function pubClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).catch(function () {}); }
    else { try { var ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); } catch (e) {} }
  }
  function joinChips(box, sep) { return box ? [].slice.call(box.children).map(function (c) { return c.textContent.trim(); }).join(sep) : ""; }
  function doCopy(btn) {
    var modal = document.getElementById("mlModal-publish");
    if (!modal) return;
    var field = btn.getAttribute("data-copy"), text = "";
    if (field === "title") { var i = modal.querySelector("[data-title-input]"); text = i ? i.value : ""; }
    else if (field === "desc") { var t = modal.querySelector("[data-copy-desc]"); text = t ? t.value : ""; }
    else if (field === "tags") { text = joinChips(modal.querySelector("[data-copy-tags]"), ", "); }
    else if (field === "hashtags") { text = joinChips(modal.querySelector("[data-copy-hashtags]"), " "); }
    else if (field === "timecodes") {
      var rows = modal.querySelectorAll("[data-copy-timecodes] .ml-tc");
      text = [].slice.call(rows).map(function (r) { var sp = r.querySelectorAll("span"); return (sp[0] ? sp[0].textContent : "") + " " + (sp[1] ? sp[1].textContent : ""); }).join("\n");
    }
    pubClipboard(text);
    var label = btn.querySelector("[data-copy-label]");
    btn.classList.add("is-copied"); if (label) label.textContent = "Copied";
    setTimeout(function () { btn.classList.remove("is-copied"); if (label) label.textContent = "Copy"; }, 1300);
  }

  // ----- «Metadata»: сборка текста + сохранение в .txt в папку Metadata (общее для обоих флоу) -----
  function metaTxtName(videoName) { return baseName(videoName) + " - metadata.txt"; }
  function buildMetadataText(modal) {
    var parts = [];
    parts.push("Title");
    for (var i = 0; i < TITLE_VARIANTS.length; i++) parts.push((i + 1) + ". " + TITLE_VARIANTS[i]);
    parts.push("");
    var desc = modal.querySelector("[data-copy-desc]");
    parts.push("Description"); parts.push(desc ? desc.value : ""); parts.push("");
    parts.push("Tags"); parts.push(joinChips(modal.querySelector("[data-copy-tags]"), ", ")); parts.push("");
    parts.push("Hashtags"); parts.push(joinChips(modal.querySelector("[data-copy-hashtags]"), " ")); parts.push("");
    parts.push("Timecodes");
    var rows = modal.querySelectorAll("[data-copy-timecodes] .ml-tc");
    for (var j = 0; j < rows.length; j++) { var sp = rows[j].querySelectorAll("span"); parts.push((sp[0] ? sp[0].textContent : "") + " " + (sp[1] ? sp[1].textContent : "")); }
    return parts.join("\n");
  }
  function makeMetaTxtRow(txt) {
    var tr = document.createElement("tr");
    tr.className = "ml-row";
    tr.setAttribute("data-kind", "document"); // категория document/text
    tr.setAttribute("data-name", txt);
    tr.setAttribute("data-metatxt", ""); // маркер: открывать превью метаданных, а не docx-заглушку
    tr.innerHTML =
      '<td class="c-check"><input class="ml-check" type="checkbox" aria-label="Select" /></td>' +
      '<td class="c-drag"><svg class="ml-drag"><use href="#ml-drag"></use></svg></td>' +
      '<td class="c-name"><div class="ml-name"><div class="ml-preview ml-preview--document" data-preview><svg class="ml-preview__icon"><use href="#ml-file"></use></svg></div><span class="ml-name__text" data-preview>' + txt + '</span></div></td>' +
      '<td class="c-created">17.07.2026</td>' +
      '<td class="c-storage">2 KB</td>' +
      '<td class="c-author"><span class="ml-you">You</span></td>' +
      '<td class="c-shared"><span class="ml-notshared"><svg><use href="#ml-eyeslash"></use></svg>Not shared</span></td>' +
      '<td class="c-actions c-actions-cell"><button class="ml-more" type="button" aria-label="Actions"><svg><use href="#ml-more"></use></svg></button></td>';
    return tr;
  }
  // сохранить/перезаписать .txt метаданных в папке Metadata (создать папку, если её нет)
  function saveMetadataFile(videoName) {
    var modal = document.getElementById("mlModal-publish");
    if (!modal || !videoName) return;
    var txt = metaTxtName(videoName);
    metadataFiles[txt] = buildMetadataText(modal); // перезапись содержимого
    var folderRow = document.querySelector("[data-metadata-folder]");
    var tbody = document.querySelector('tbody[data-folder="metadata"]');
    if (!folderRow || !tbody) return;
    folderRow.hidden = false;
    metadataRevealed = true;
    var exists = false, rows = tbody.querySelectorAll("tr");
    for (var i = 0; i < rows.length; i++) if (rows[i].getAttribute("data-name") === txt) { exists = true; break; }
    if (!exists) tbody.insertBefore(makeMetaTxtRow(txt), tbody.firstChild);
    refreshFolderRowMeta(folderRow, tbody);
    var rootTb = document.querySelector('tbody[data-level="root"]');
    if (rootTb && !rootTb.hidden) updateRootCount();
    applyFilter();
  }
  function openMetaTxt(txt) {
    var modal = document.getElementById("mlModal-metatxt");
    if (!modal) return;
    var title = modal.querySelector("[data-title]"); if (title) title.textContent = txt;
    var pre = modal.querySelector("[data-meta-text]"); if (pre) pre.textContent = metadataFiles[txt] || "";
    modal.classList.add("is-open");
    document.body.style.overflow = "hidden";
  }
  function copyMetaTxt(modal) {
    var pre = modal.querySelector("[data-meta-text]"); pubClipboard(pre ? pre.textContent : "");
    var btn = modal.querySelector("[data-meta-copy]"), lbl = btn ? btn.querySelector("[data-copy-label]") : null;
    if (btn) { btn.classList.add("is-copied"); if (lbl) lbl.textContent = "Copied"; setTimeout(function () { btn.classList.remove("is-copied"); if (lbl) lbl.textContent = "Copy"; }, 1300); }
  }
  function downloadMetaTxt(modal) {
    var titleEl = modal.querySelector("[data-title]"); var fname = titleEl && titleEl.textContent.trim() ? titleEl.textContent.trim() : "metadata.txt";
    var pre = modal.querySelector("[data-meta-text]");
    try {
      var blob = new Blob([pre ? pre.textContent : ""], { type: "text/plain" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a"); a.href = url; a.download = fname; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    } catch (e) { console.log("[prototype] download .txt", fname); }
  }

  // ----- модалка шеринга: copy link + поиск получателей (подсказки) + список доступа с Revoke -----
  // портрет-плейсхолдер для динамически добавленных строк/аватаров
  var PORTRAIT_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12.2a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2Z"/><path d="M4.8 19.2c0-3.05 3.23-4.9 7.2-4.9s7.2 1.85 7.2 4.9V20H4.8v-.8Z"/></svg>';
  var shareListDefault = null; // снимок исходного списка доступа (для сброса при открытии)

  function openShare() {
    var modal = document.getElementById("mlModal-share");
    if (!modal) return;
    var search = modal.querySelector("[data-share-search]"); if (search) search.value = "";
    var results = modal.querySelector("[data-share-results]"); if (results) results.hidden = true;
    var invBtn = modal.querySelector("[data-share-invite-btn]"); if (invBtn) invBtn.disabled = true;
    var copyBtn = modal.querySelector("[data-share-copy]");
    if (copyBtn) { copyBtn.classList.remove("is-copied"); var l = copyBtn.querySelector("[data-copy-label]"); if (l) l.textContent = "Copy link"; }
    // сброс списка доступа к исходному снимку (убирает добавленных, возвращает удалённых)
    var list = modal.querySelector("[data-share-list]");
    if (list) { if (shareListDefault === null) shareListDefault = list.innerHTML; else list.innerHTML = shareListDefault; }
    modal.classList.add("is-open");
    document.body.style.overflow = "hidden";
  }
  function isShareEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }
  function shareHasAccess(modal, name) {
    var rows = modal.querySelectorAll("[data-share-list] .ml-share__acc-name");
    for (var i = 0; i < rows.length; i++) { if (rows[i].textContent.trim().toLowerCase() === name.toLowerCase()) return true; }
    return false;
  }
  function shareSearch(modal) {
    var inp = modal.querySelector("[data-share-search]");
    var results = modal.querySelector("[data-share-results]");
    if (!inp || !results) return;
    var q = (inp.value || "").trim().toLowerCase();
    results.hidden = false;
    var items = results.querySelectorAll("[data-share-pick]");
    var visible = 0;
    for (var i = 0; i < items.length; i++) {
      var n = items[i].getAttribute("data-name").toLowerCase(), em = items[i].getAttribute("data-email").toLowerCase();
      var match = !q || n.indexOf(q) !== -1 || em.indexOf(q) !== -1;
      items[i].hidden = !match;
      items[i].classList.toggle("is-added", shareHasAccess(modal, items[i].getAttribute("data-name")));
      if (match) visible++;
    }
    var nores = results.querySelector("[data-share-noresults]"); if (nores) nores.hidden = visible > 0;
    var btn = modal.querySelector("[data-share-invite-btn]"); if (btn) btn.disabled = !isShareEmail(q);
  }
  function shareAddRow(modal, color, name, email) {
    var list = modal.querySelector("[data-share-list]");
    var owner = modal.querySelector("[data-owner]");
    var row = document.createElement("div");
    row.className = "ml-share__acc is-invited";
    var info = '<div class="ml-share__acc-info"><span class="ml-share__acc-name">' + name + '</span>' + (email ? '<span class="ml-share__acc-email">' + email + '</span>' : '') + '</div>';
    row.innerHTML = '<span class="ml-share__avatar" style="background:' + color + '">' + PORTRAIT_SVG + '</span>' + info + '<button class="ml-share__revoke" type="button" data-revoke>Revoke</button>';
    list.insertBefore(row, owner || null);
  }
  function sharePick(modal, btn) {
    if (btn.classList.contains("is-added")) return; // уже есть доступ
    shareAddRow(modal, btn.getAttribute("data-color"), btn.getAttribute("data-name"), btn.getAttribute("data-email"));
    var inp = modal.querySelector("[data-share-search]"); if (inp) inp.value = "";
    var results = modal.querySelector("[data-share-results]"); if (results) results.hidden = true;
  }
  function shareInviteEmail(modal) {
    var inp = modal.querySelector("[data-share-search]");
    var q = (inp && inp.value || "").trim();
    if (!isShareEmail(q.toLowerCase())) return;
    shareAddRow(modal, "var(--color-avatar-2)", q, "");
    if (inp) inp.value = "";
    var results = modal.querySelector("[data-share-results]"); if (results) results.hidden = true;
    var btn = modal.querySelector("[data-share-invite-btn]"); if (btn) btn.disabled = true;
  }
  // живой поиск получателей — слушатели на поле (статично в DOM)
  var _shareSearchInput = document.querySelector("#mlModal-share [data-share-search]");
  if (_shareSearchInput) {
    _shareSearchInput.addEventListener("input", function () { shareSearch(document.getElementById("mlModal-share")); });
    _shareSearchInput.addEventListener("focus", function () { shareSearch(document.getElementById("mlModal-share")); });
  }
  function shareCopyLink(btn) {
    var text = btn.getAttribute("data-link") || "";
    var label = btn.querySelector("[data-copy-label]");
    function done() {
      btn.classList.add("is-copied");           // прячет скрепку (CSS)
      if (label) label.textContent = "Copied!";
      setTimeout(function () {
        btn.classList.remove("is-copied");
        if (label) label.textContent = "Copy link";
      }, 1500);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, done);
    } else {
      try { var ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); } catch (e) {}
      done();
    }
  }
  // ----- подтверждение отзыва доступа (маленькое окно поверх шеринга) -----
  function openRevokeConfirm(row) {
    var cm = document.getElementById("mlRevokeConfirm");
    if (!cm || !row) return;
    revokeTargetRow = row;
    var nameEl = row.querySelector(".ml-share__acc-name");
    var name = nameEl ? nameEl.textContent.replace(/\s*\(you\)\s*$/, "").trim() : "this user";
    var slot = cm.querySelector("[data-revoke-name]"); if (slot) slot.textContent = name;
    cm.classList.add("is-open");
  }
  function closeRevokeConfirm() {
    var cm = document.getElementById("mlRevokeConfirm");
    if (cm) cm.classList.remove("is-open");
    revokeTargetRow = null;
  }

  // ===== Транскрибация: мок-флоу (бейдж в топбаре + попап + нотификация + .srt-файл) =====
  // Отдельная от паблишинга фича. Запуск: ⋮ → Transcribe → модалка выбора языка → Start.
  // Не связана с Timecodes в модалке Metadata.
  var CHEVRON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
  var CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
  var CLOSE_X_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var GOTO_CHEVRON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
  var TRANSCRIBE_MS = 3800; // мок-длительность (как таймаут у конверсии)

  var jobsEl = document.getElementById("jobsTranscribe");
  var jobsList = jobsEl ? jobsEl.querySelector("[data-jobs-list]") : null;
  var jobsPanel = jobsEl ? jobsEl.querySelector("[data-jobs-panel]") : null;
  var jobsCountEl = jobsEl ? jobsEl.querySelector("[data-jobs-count]") : null;
  var jobsToggle = jobsEl ? jobsEl.querySelector("[data-jobs-toggle]") : null;
  var activeJobs = 0;
  var jobTimers = []; // id таймеров активных задач — чтобы «Clear all» отменял их (не дать завершиться)
  var transcriptionsRevealed = false;
  var transcribedFiles = {}; // имя видео → { folderId, primary, base } (для «Review transcription»)
  var txFolderSeq = 0; // счётчик безопасных id под-папок видео (tx-1, tx-2, …)
  // реестр папок для вложенных хлебных крошек: id → { name, parent }
  var folderInfo = {
    analytics: { name: "Analytics", parent: null },
    music: { name: "Music", parent: null },
    transcriptions: { name: "Transcriptions", parent: null },
    metadata: { name: "Metadata", parent: null }
  };
  var LANG_CODE = { English: "eng", Ukrainian: "ukr", Spanish: "spa", German: "ger", French: "fre", Portuguese: "por", Italian: "ita", Polish: "pol", Japanese: "jpn" };
  function langCode(l) { return LANG_CODE[l] || "eng"; }

  function baseName(name) { var i = name.lastIndexOf("."); return i > 0 ? name.slice(0, i) : name; }
  function srtName(name) { return baseName(name) + ".srt"; }

  function openTranscribeModal(name) {
    var modal = document.getElementById("mlModal-transcribe");
    if (!modal) return;
    var f = modal.querySelector("[data-transcribe-file]"); if (f) f.textContent = name || "this file";
    // сброс единственного мультиселекта языков транскрипта
    var multi = modal.querySelector("[data-tr-multi]");
    if (multi) {
      multi.classList.remove("is-open");
      var menu = multi.querySelector("[data-tr-menu]"); if (menu) menu.hidden = true;
      var boxes = multi.querySelectorAll("[data-tr-lang]"); for (var i = 0; i < boxes.length; i++) boxes[i].checked = false;
      var search = multi.querySelector("[data-tr-search]"); if (search) search.value = "";
      trFilterLangs(multi); trUpdateChips(multi);
    }
    trSyncStart(modal);
    modal.setAttribute("data-file", name || "");
    modal.classList.add("is-open");
    document.body.style.overflow = "hidden";
  }
  // мультиселект «Translate to»: чипы выбранного + поиск
  function trSelectedLangs(multi) {
    var out = [], boxes = multi.querySelectorAll("[data-tr-lang]");
    for (var i = 0; i < boxes.length; i++) if (boxes[i].checked) out.push(boxes[i].getAttribute("data-tr-lang"));
    return out;
  }
  function trUpdateChips(multi) {
    var chips = multi.querySelector("[data-tr-chips]");
    var ph = multi.querySelector("[data-tr-placeholder]");
    if (!chips) return;
    var sel = trSelectedLangs(multi);
    chips.innerHTML = sel.map(function (l) { return '<span class="ml-multi__chip">' + l + '</span>'; }).join("");
    if (ph) ph.hidden = sel.length > 0;
  }
  // кнопка «Start transcription» доступна только когда выбран хотя бы один язык
  function trSyncStart(modal) {
    if (!modal) return;
    var multi = modal.querySelector("[data-tr-multi]");
    var btn = modal.querySelector("[data-transcribe-start]");
    if (!btn) return;
    var n = multi ? trSelectedLangs(multi).length : 0;
    btn.disabled = n === 0;
  }
  function trFilterLangs(multi) {
    var q = "", s = multi.querySelector("[data-tr-search]"); if (s) q = (s.value || "").trim().toLowerCase();
    var opts = multi.querySelectorAll("[data-tr-opts] .ml-multi__opt"), vis = 0;
    for (var i = 0; i < opts.length; i++) {
      var lang = opts[i].querySelector("[data-tr-lang]").getAttribute("data-tr-lang").toLowerCase();
      var match = !q || lang.indexOf(q) !== -1;
      opts[i].hidden = !match; if (match) vis++;
    }
    var nr = multi.querySelector("[data-tr-noresults]"); if (nr) nr.hidden = vis > 0;
  }
  var _tlMulti = document.querySelector("#mlModal-translate [data-tl-multi]");
  if (_tlMulti) {
    var _tlSearch = _tlMulti.querySelector("[data-tl-search]");
    if (_tlSearch) _tlSearch.addEventListener("input", function () { tlFilterLangs(_tlMulti); });
    var _tlOpts = _tlMulti.querySelector("[data-tl-opts]");
    if (_tlOpts) _tlOpts.addEventListener("change", function () {
      tlUpdateChips(_tlMulti); tlSyncStart(document.getElementById("mlModal-translate"));
    });
  }

  var _trMulti = document.querySelector("#mlModal-transcribe [data-tr-multi]");
  if (_trMulti) {
    var _trSearch = _trMulti.querySelector("[data-tr-search]");
    if (_trSearch) _trSearch.addEventListener("input", function () { trFilterLangs(_trMulti); });
    var _trOpts = _trMulti.querySelector("[data-tr-opts]");
    if (_trOpts) _trOpts.addEventListener("change", function () { trUpdateChips(_trMulti); trSyncStart(document.getElementById("mlModal-transcribe")); });
  }

  // ===== TRANSLATE: перевод готового транскрипта в другие языки =====
  // Модалка открывается поверх превью транскрипта (как «Save as SRT»), выбор языков —
  // тот же мультиселект. Результат: отдельный .srt на каждый язык рядом с оригиналом.
  var tlSourceModal = null;
  function tlSelectedLangs(multi) {
    var out = [], boxes = multi.querySelectorAll("[data-tl-lang]");
    for (var i = 0; i < boxes.length; i++) if (boxes[i].checked) out.push(boxes[i].getAttribute("data-tl-lang"));
    return out;
  }
  function tlUpdateChips(multi) {
    var chips = multi.querySelector("[data-tl-chips]"), ph = multi.querySelector("[data-tl-placeholder]");
    if (!chips) return;
    var sel = tlSelectedLangs(multi);
    chips.innerHTML = sel.map(function (l) { return '<span class="ml-multi__chip">' + l + '</span>'; }).join("");
    if (ph) ph.hidden = sel.length > 0;
  }
  function tlFilterLangs(multi) {
    var q = "", s2 = multi.querySelector("[data-tl-search]"); if (s2) q = (s2.value || "").trim().toLowerCase();
    var opts = multi.querySelectorAll("[data-tl-opts] .ml-multi__opt"), vis = 0;
    for (var i = 0; i < opts.length; i++) {
      var lang = opts[i].querySelector("[data-tl-lang]").getAttribute("data-tl-lang").toLowerCase();
      var match = !q || lang.indexOf(q) !== -1;
      opts[i].hidden = !match; if (match) vis++;
    }
    var nr = multi.querySelector("[data-tl-noresults]"); if (nr) nr.hidden = vis > 0;
  }
  // «Translate» доступна только когда выбран хотя бы один язык
  function tlSyncStart(modal) {
    if (!modal) return;
    var multi = modal.querySelector("[data-tl-multi]"), btn = modal.querySelector("[data-translate-start]");
    if (!btn) return;
    btn.disabled = !multi || tlSelectedLangs(multi).length === 0;
  }
  function openTranslate(sourceModal) {
    tlSourceModal = sourceModal || document.getElementById("mlModal-transcript");
    var tm = document.getElementById("mlModal-translate");
    if (!tm) return;
    var fname = transcriptSrt(tlSourceModal);
    tm.setAttribute("data-file", fname);
    var f = tm.querySelector("[data-translate-file]"); if (f) f.textContent = fname || "this transcript";
    var multi = tm.querySelector("[data-tl-multi]");
    if (multi) {                                   // каждый раз открываем с чистым выбором
      multi.classList.remove("is-open");
      var menu = multi.querySelector("[data-tl-menu]"); if (menu) menu.hidden = true;
      var boxes = multi.querySelectorAll("[data-tl-lang]");
      for (var i = 0; i < boxes.length; i++) boxes[i].checked = false;
      var sr = multi.querySelector("[data-tl-search]"); if (sr) sr.value = "";
      tlFilterLangs(multi); tlUpdateChips(multi);
    }
    tlSyncStart(tm);
    tm.classList.add("is-open");
    document.body.style.overflow = "hidden";
  }
  function closeTranslate() {
    var tm = document.getElementById("mlModal-translate");
    if (tm) tm.classList.remove("is-open");
    // превью транскрипта под ней остаётся открытым → overflow не сбрасываем
  }
  // имя переведённого файла: языковой префикс как у остальных транскриптов (ukr_/spa_/…)
  function translatedName(fname, lang) {
    return langCode(lang) + "_" + rootOf(fname).replace(/^[a-z]{3}_/, "") + ".srt";
  }
  function addTranslateCard(origName, files, langs) {
    if (!jobsList) return null;
    var card = document.createElement("article");
    card.className = "job";
    var subrows = files.map(function (fn, i) {
      return '<div class="job__subrow" data-sub-srt="' + fn + '">' +
               '<span class="job__subname">' + fn + '</span>' +
               '<span class="job__langbadge">' + langs[i] + '</span>' +
               '<div class="job__bar"><div class="job__fill" data-job-fill style="animation-duration:' + TRANSCRIBE_MS + 'ms"></div></div>' +
             '</div>';
    }).join("");
    card.innerHTML =
      '<div class="job__row">' +
        '<button class="job__chev" type="button" data-job-expand aria-label="Expand">' + CHEVRON_SVG + '</button>' +
        '<span class="job__name">' + origName + '</span>' +
        '<span class="job__time">just now</span>' +
        '<span class="job__status" data-job-status>Translating…</span>' +
      '</div>' +
      '<div class="job__bar"><div class="job__fill" data-job-fill style="animation-duration:' + TRANSCRIBE_MS + 'ms"></div></div>' +
      '<div class="job__foot"><span data-job-progress>0 of ' + files.length + ' done</span><span class="job__dot">·</span>' +
        '<span class="job__lang">Translate · ' + langs.join(", ") + '</span></div>' +
      '<div class="job__sub" data-job-sub hidden>' + subrows + '</div>';
    jobsList.insertBefore(card, jobsList.firstChild);
    return card;
  }
  function startTranslation(fname, langs) {
    if (!fname || !langs || !langs.length) return;
    var videoName = findVideoForSrt(fname);
    var folderId = videoName && transcribedFiles[videoName] ? transcribedFiles[videoName].folderId : null;
    var subTbody = folderId ? document.querySelector('tbody[data-folder="' + folderId + '"]') : null;
    if (!subTbody) {                               // фолбэк: папка исходной строки
      var srcRows = document.querySelectorAll("tr[data-name]");
      for (var i = 0; i < srcRows.length; i++) if (srcRows[i].getAttribute("data-name") === fname) { subTbody = srcRows[i].closest("tbody[data-folder]"); break; }
    }
    var files = langs.map(function (l) { return translatedName(fname, l); });
    activeJobs++; jobsRefreshBadge();
    var card = addTranslateCard(fname, files, langs);
    var tid = setTimeout(function () {
      var idx = jobTimers.indexOf(tid); if (idx !== -1) jobTimers.splice(idx, 1);
      completeTranslation(card, videoName, files, subTbody);
    }, TRANSCRIBE_MS);
    jobTimers.push(tid);
  }
  function completeTranslation(card, videoName, files, subTbody) {
    if (card) {
      card.classList.add("is-done");
      var st = card.querySelector("[data-job-status]");
      if (st) {
        var end = document.createElement("span"); end.className = "job__end";
        end.innerHTML = '<span class="job__check" aria-label="Done">' + CHECK_SVG + '</span>' +
                        '<button class="job__dismiss" type="button" data-job-dismiss aria-label="Dismiss">' + CLOSE_X_SVG + '</button>';
        st.parentNode.replaceChild(end, st);
      }
      var pr = card.querySelector("[data-job-progress]"); if (pr) pr.textContent = files.length + " of " + files.length + " done";
      var fills = card.querySelectorAll("[data-job-fill]");
      for (var i = 0; i < fills.length; i++) { fills[i].style.animation = "none"; fills[i].style.width = "100%"; }
      var subrows = card.querySelectorAll("[data-job-sub] .job__subrow");
      for (var k = 0; k < subrows.length; k++) {
        var sr2 = subrows[k];
        var sb = sr2.querySelector(".job__bar"); if (sb) sb.remove();
        var chk = document.createElement("span"); chk.className = "job__check"; chk.setAttribute("aria-label", "Done"); chk.innerHTML = CHECK_SVG;
        var go = document.createElement("button"); go.className = "job__goto"; go.type = "button";
        go.setAttribute("data-job-goto", ""); go.setAttribute("data-video", videoName || "");
        go.setAttribute("data-file", sr2.getAttribute("data-sub-srt") || "");
        go.innerHTML = "Go to file " + GOTO_CHEVRON;
        sr2.appendChild(chk); sr2.appendChild(go);
      }
    }
    activeJobs = Math.max(0, activeJobs - 1);
    if (subTbody) {
      files.forEach(function (fn) {                 // добавляем файлы в папку транскриптов
        var exists = false, ex = subTbody.querySelectorAll("tr");
        for (var j = 0; j < ex.length; j++) if (ex[j].getAttribute("data-name") === fn) { exists = true; break; }
        if (!exists) subTbody.appendChild(makeTranscriptRow(fn));
      });
      var fid = subTbody.getAttribute("data-folder");
      var subRow = document.querySelector('tr[data-enter-folder="' + fid + '"]');
      if (subRow) refreshFolderRowMeta(subRow, subTbody);
      var txFolderRow = document.querySelector("[data-transcriptions-folder]");
      var txTbody = document.querySelector('tbody[data-folder="transcriptions"]');
      if (txFolderRow && txTbody) refreshFolderRowMeta(txFolderRow, txTbody);
      var rootTb = document.querySelector('tbody[data-level="root"]'); if (rootTb && !rootTb.hidden) updateRootCount();
      applyFilter();
    }
    files.forEach(function (fn) { addRegenNotification(fn, videoName); });
    jobsRefreshBadge();
  }

  function jobsRefreshBadge() {
    if (!jobsEl) return;
    var totalCards = jobsList ? jobsList.querySelectorAll(".job").length : 0;
    var label = jobsEl.querySelector("[data-jobs-label]");
    if (activeJobs > 0) {
      // идёт транскрибация → indigo «Transcribing N»
      jobsEl.hidden = false;
      jobsEl.classList.remove("is-done");
      if (label) label.textContent = "Transcribing";
      if (jobsCountEl) jobsCountEl.textContent = String(activeJobs);
    } else if (totalCards > 0) {
      // всё готово, карточки ещё в списке → зелёный «✓ Transcribed» (как прод «Converted»)
      jobsEl.hidden = false;
      jobsEl.classList.add("is-done");
      if (label) label.textContent = "Transcribed";
    } else {
      // карточек нет (Clear all / все dismissed) → скрыть бейдж
      jobsEl.hidden = true;
      jobsEl.classList.remove("is-done");
      if (jobsPanel) jobsPanel.hidden = true;
      if (jobsToggle) jobsToggle.setAttribute("aria-expanded", "false");
    }
  }

  function addJobCard(name, langs, langLabel) {
    if (!jobsList) return null;
    var base = baseName(name);
    // по одной под-строке на каждый язык (свой .srt + прогресс-бар) — как файлы в прод-конверсии
    var subrows = langs.map(function (l) {
      var fn = langCode(l) + "_" + base + ".srt";
      return '<div class="job__subrow" data-sub-srt="' + fn + '">' +
               '<span class="job__subname">' + fn + '</span>' +
               '<span class="job__langbadge">' + l + '</span>' +
               '<div class="job__bar"><div class="job__fill" data-job-fill style="animation-duration:' + TRANSCRIBE_MS + 'ms"></div></div>' +
             '</div>';
    }).join("");
    var card = document.createElement("article");
    card.className = "job";
    card.innerHTML =
      '<div class="job__row">' +
        '<button class="job__chev" type="button" data-job-expand aria-label="Expand">' + CHEVRON_SVG + '</button>' +
        '<span class="job__name">' + name + '</span>' +
        '<span class="job__time">just now</span>' +
        '<span class="job__status" data-job-status>Processing…</span>' +
      '</div>' +
      '<div class="job__bar"><div class="job__fill" data-job-fill style="animation-duration:' + TRANSCRIBE_MS + 'ms"></div></div>' +
      '<div class="job__foot"><span data-job-progress>0 of ' + langs.length + ' done</span><span class="job__dot">·</span><span class="job__lang">' + langLabel + '</span></div>' +
      '<div class="job__sub" data-job-sub hidden>' + subrows + '</div>';
    jobsList.insertBefore(card, jobsList.firstChild);
    return card;
  }

  // дедуп выбранных целевых языков (первый = primary/файл по умолчанию)
  function resolveLangs(selected) {
    var langs = [];
    for (var i = 0; i < selected.length; i++) if (langs.indexOf(selected[i]) === -1) langs.push(selected[i]);
    return langs;
  }
  function startTranscription(name, selected) {
    if (!name) return;
    var langs = resolveLangs(selected || []);
    if (langs.length === 0) return; // нужен хотя бы один язык
    var langLabel = langs[0] + (langs.length > 1 ? " +" + (langs.length - 1) : "");
    activeJobs++;
    jobsRefreshBadge();
    var card = addJobCard(name, langs, langLabel);
    var tid = setTimeout(function () {
      var idx = jobTimers.indexOf(tid); if (idx !== -1) jobTimers.splice(idx, 1);
      completeTranscription(card, name, langs);
    }, TRANSCRIBE_MS);
    jobTimers.push(tid);
  }

  function completeTranscription(card, name, langs) {
    if (card) {
      card.classList.add("is-done");
      var st = card.querySelector("[data-job-status]");
      if (st) {
        // статус «Processing…» → зелёная галочка + серый крестик-dismiss (как в прод-попапе)
        var end = document.createElement("span");
        end.className = "job__end";
        end.innerHTML = '<span class="job__check" aria-label="Done">' + CHECK_SVG + '</span>' +
                        '<button class="job__dismiss" type="button" data-job-dismiss aria-label="Dismiss">' + CLOSE_X_SVG + '</button>';
        st.parentNode.replaceChild(end, st);
      }
      var total = (langs && langs.length) || 1;
      var pr = card.querySelector("[data-job-progress]"); if (pr) pr.textContent = total + " of " + total + " done";
      var fills = card.querySelectorAll("[data-job-fill]");
      for (var i = 0; i < fills.length; i++) { fills[i].style.animation = "none"; fills[i].style.width = "100%"; }
      // каждая под-строка (языковой файл) по завершении: бар → галочка + «Go to file ›» этого файла
      var subrows = card.querySelectorAll("[data-job-sub] .job__subrow");
      for (var k = 0; k < subrows.length; k++) {
        var sr = subrows[k];
        var sb = sr.querySelector(".job__bar"); if (sb) sb.remove();
        var chk2 = document.createElement("span"); chk2.className = "job__check"; chk2.setAttribute("aria-label", "Done"); chk2.innerHTML = CHECK_SVG;
        var go = document.createElement("button"); go.className = "job__goto"; go.type = "button";
        go.setAttribute("data-job-goto", ""); go.setAttribute("data-video", name); go.setAttribute("data-file", sr.getAttribute("data-sub-srt") || "");
        go.innerHTML = "Go to file " + GOTO_CHEVRON;
        sr.appendChild(chk2); sr.appendChild(go);
      }
    }
    activeJobs = Math.max(0, activeJobs - 1);
    addTranscriptionResult(name, langs); // создаёт папку видео + .srt по языкам, пишет transcribedFiles[name]
    addTranscribeNotification(name);
    jobsRefreshBadge(); // → «✓ Transcribed» (галочка; бейдж не скрывается, пока есть карточки)
    // модалку НЕ открываем автоматически — юзер заходит через «Go to file» / «Review transcription»
  }

  // Результат — .srt в папке Transcriptions (создаём папку, если её ещё нет)
  function makeTranscriptRow(srt) {
    var tr = document.createElement("tr");
    tr.className = "ml-row";
    tr.setAttribute("data-kind", "transcript");
    tr.setAttribute("data-name", srt);
    tr.innerHTML =
      '<td class="c-check"><input class="ml-check" type="checkbox" aria-label="Select" /></td>' +
      '<td class="c-drag"><svg class="ml-drag"><use href="#ml-drag"></use></svg></td>' +
      // .srt — текстовый файл, поэтому иконка кода (как у остальных code-файлов)
      '<td class="c-name"><div class="ml-name"><div class="ml-preview ml-preview--code" data-preview><svg class="ml-preview__icon"><use href="#ml-code"></use></svg></div><span class="ml-name__text" data-preview>' + srt + '</span></div></td>' +
      '<td class="c-created">17.07.2026</td>' +
      '<td class="c-storage">4.2 KB</td>' +
      '<td class="c-author"><span class="ml-you">You</span></td>' +
      '<td class="c-shared"><span class="ml-notshared"><svg><use href="#ml-eyeslash"></use></svg>Not shared</span></td>' +
      '<td class="c-actions c-actions-cell"><button class="ml-more" type="button" aria-label="Actions"><svg><use href="#ml-more"></use></svg></button></td>';
    return tr;
  }
  // строка-папка (для под-папки видео внутри Transcriptions)
  function makeFolderRow(id, name) {
    var tr = document.createElement("tr");
    tr.className = "ml-row ml-row--folder";
    tr.setAttribute("data-kind", "folder");
    tr.setAttribute("data-name", name);
    tr.setAttribute("data-enter-folder", id);
    tr.innerHTML =
      '<td class="c-check"><input class="ml-check" type="checkbox" aria-label="Select" /></td>' +
      '<td class="c-drag"><svg class="ml-drag"><use href="#ml-drag"></use></svg></td>' +
      '<td class="c-name"><div class="ml-name"><div class="ml-preview ml-preview--folder"><svg class="ml-preview__icon"><use href="#ml-folder"></use></svg></div>' +
        '<div class="ml-name__folder"><span class="ml-name__text">' + name + '</span><span class="ml-name__meta"><span>0 files</span><span class="dot"></span><span>0 folders</span></span></div></div></td>' +
      '<td class="c-created">17.07.2026</td>' +
      '<td class="c-storage">0 B</td>' +
      '<td class="c-author"><span class="ml-you">You</span></td>' +
      '<td class="c-shared"><span class="ml-notshared"><svg><use href="#ml-eyeslash"></use></svg>Not shared</span></td>' +
      '<td class="c-actions c-actions-cell"><button class="ml-more" type="button" aria-label="Actions"><svg><use href="#ml-more"></use></svg></button></td>';
    return tr;
  }
  function refreshFolderRowMeta(row, tb) {
    var rows = tb.querySelectorAll("tr"), folders = 0, files = 0;
    for (var i = 0; i < rows.length; i++) { if (rows[i].getAttribute("data-kind") === "folder") folders++; else files++; }
    var meta = row.querySelectorAll(".ml-name__meta span"); // [0]=files, [1]=dot, [2]=folders
    if (meta[0]) meta[0].textContent = files + (files === 1 ? " file" : " files");
    if (meta[2]) meta[2].textContent = folders + (folders === 1 ? " folder" : " folders");
    var sizeCell = row.querySelector(".c-storage"); if (sizeCell) sizeCell.textContent = files > 0 ? (files * 4.2).toFixed(1) + " KB" : "0 B";
  }
  function updateRootCount() {
    var cEl = document.querySelector("[data-count]");
    var n = 4 + (transcriptionsRevealed ? 1 : 0) + (metadataRevealed ? 1 : 0);
    if (cEl) cEl.textContent = n + " folders · 353 files";
  }
  // результат: папка с именем видео внутри Transcriptions + .srt по каждому языку (<код>_<база>.srt)
  function addTranscriptionResult(name, langs) {
    var txFolderRow = document.querySelector("[data-transcriptions-folder]");
    var txTbody = document.querySelector('tbody[data-folder="transcriptions"]');
    if (!txFolderRow || !txTbody) return;
    txFolderRow.hidden = false;
    transcriptionsRevealed = true;
    var base = baseName(name);

    // найти/создать под-папку с именем видео (безопасный id tx-N; отображаемое имя — база)
    var rec = transcribedFiles[name], folderId, subTbody;
    if (rec && rec.folderId && document.querySelector('tbody[data-folder="' + rec.folderId + '"]')) {
      folderId = rec.folderId;
      subTbody = document.querySelector('tbody[data-folder="' + folderId + '"]');
    } else {
      txFolderSeq++; folderId = "tx-" + txFolderSeq;
      folderInfo[folderId] = { name: base, parent: "transcriptions" };
      txTbody.insertBefore(makeFolderRow(folderId, base), txTbody.firstChild);
      subTbody = document.createElement("tbody");
      subTbody.setAttribute("data-level", "folder");
      subTbody.setAttribute("data-folder", folderId);
      subTbody.hidden = true;
      var table = document.querySelector(".ml-table"); if (table) table.appendChild(subTbody);
    }

    // бэкап: по одному .srt на язык (первый — primary). Клик по файлу открывает
    // ту же модалку результата (#mlModal-transcript) с Regenerate + Save as….
    var primary = null;
    for (var i = 0; i < langs.length; i++) {
      var fn = langCode(langs[i]) + "_" + base + ".srt";
      if (i === 0) primary = fn;
      var exists = false, ex = subTbody.querySelectorAll("tr");
      for (var j = 0; j < ex.length; j++) if (ex[j].getAttribute("data-name") === fn) { exists = true; break; }
      if (!exists) subTbody.appendChild(makeTranscriptRow(fn));
    }
    transcribedFiles[name] = { folderId: folderId, primary: primary, base: base };

    // счётчики: под-папка (файлы) + Transcriptions (под-папки) + шапка (если в корне)
    var subRow = document.querySelector('tr[data-enter-folder="' + folderId + '"]');
    if (subRow) refreshFolderRowMeta(subRow, subTbody);
    refreshFolderRowMeta(txFolderRow, txTbody);
    var rootTb = document.querySelector('tbody[data-level="root"]');
    if (rootTb && !rootTb.hidden) updateRootCount();
    applyFilter();
  }
  // «Go to file» конкретного языкового файла: открыть под-папку видео + превью именно этого .srt
  function goToTranscriptFile(videoName, srt) {
    var rec = transcribedFiles[videoName];
    if (!rec || !rec.folderId) { reviewTranscription(videoName); return; }
    enterFolder(rec.folderId);
    if (srt) {
      var rows = document.querySelectorAll('tbody[data-folder="' + rec.folderId + '"] tr');
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].getAttribute("data-name") === srt) { rows[i].classList.remove("ml-row--flash"); void rows[i].offsetWidth; rows[i].classList.add("ml-row--flash"); break; }
      }
      openTranscript(srt); // модалка результата (#mlModal-transcript) с Regenerate + Save as…
    }
  }
  // «Review transcription» / нотификация View: открыть под-папку видео + превью primary-файла
  function reviewTranscription(videoName) {
    var rec = transcribedFiles[videoName];
    if (!rec || !rec.folderId) return;
    enterFolder(rec.folderId);
    if (rec.primary) {
      var rows = document.querySelectorAll('tbody[data-folder="' + rec.folderId + '"] tr');
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].getAttribute("data-name") === rec.primary) {
          rows[i].classList.remove("ml-row--flash"); void rows[i].offsetWidth; rows[i].classList.add("ml-row--flash");
          break;
        }
      }
      // и сразу открываем модалку транскрипта: язык — в шапке, действия — в футере
      openTranscript(rec.primary);
    }
  }

  // Нотификация о завершении + инкремент бейджа на колокольчике
  function bumpNotifBadge() {
    var badge = document.querySelector("[data-notif-count]");
    var list = document.querySelector("[data-notif-list]");
    if (badge && list) { var n = list.querySelectorAll(".notif-item").length; badge.textContent = String(n); badge.hidden = n === 0; }
  }
  function addTranscribeNotification(name) {
    var list = document.querySelector("[data-notif-list]");
    if (!list) return;
    var art = document.createElement("article");
    art.className = "notif-item";
    art.innerHTML =
      '<div class="notif-item__main">' +
        '<div class="notif-item__row">' +
          '<p class="notif-item__title">Transcription ready</p>' +
          '<button class="notif-item__close" type="button" data-notif-dismiss aria-label="Dismiss">' + CLOSE_X_SVG + '</button>' +
        '</div>' +
        '<p class="notif-item__desc">Transcription for <strong>' + name + '</strong> is ready.</p>' +
        '<p class="notif-item__time">just now</p>' +
        '<div class="notif-item__actions">' +
          '<button class="notif-item__act" type="button" data-notif-dismiss>Dismiss</button>' +
          '<button class="notif-item__act notif-item__act--view" type="button" data-open-transcript>View</button>' +
        '</div>' +
      '</div>';
    list.insertBefore(art, list.firstChild);
    // View → открыть транскрипт напрямую (прямой обработчик: nav.js гасит всплытие внутри панели)
    var viewBtn = art.querySelector("[data-open-transcript]");
    if (viewBtn) viewBtn.addEventListener("click", function () {
      var panel = document.getElementById("notifPanel"); if (panel) panel.hidden = true;
      var bell = document.getElementById("notifBell"); if (bell) bell.setAttribute("aria-expanded", "false");
      var rec = transcribedFiles[name]; // View → папка видео + модалка результата primary-файла
      goToTranscriptFile(name, rec ? rec.primary : null);
    });
    bumpNotifBadge();
  }

  // ===== REVIEW TRANSCRIPTION =====
  // Модалка результата: в шапке имя + переключение языка, действия — в футере.
  var CODE_BY_LANG = (function () { var o = {}; for (var k in LANG_CODE) o[LANG_CODE[k]] = k; return o; })();
  function mlEsc(t) { return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function langOfSrt(fname) {
    var m = String(fname).match(/^([a-z]{3})_/);
    return m ? (CODE_BY_LANG[m[1]] || m[1]) : "Original";
  }
  // все языковые версии транскрипта этого видео (по файлам в его папке)
  function transcriptSiblings(fname) {
    var out = [];
    var videoName = findVideoForSrt(fname);
    var folderId = videoName && transcribedFiles[videoName] ? transcribedFiles[videoName].folderId : null;
    var tb = folderId ? document.querySelector('tbody[data-folder="' + folderId + '"]') : null;
    if (!tb) {
      var rows0 = document.querySelectorAll("tr[data-name]");
      for (var i0 = 0; i0 < rows0.length; i0++) if (rows0[i0].getAttribute("data-name") === fname) { tb = rows0[i0].closest("tbody[data-folder]"); break; }
    }
    if (!tb) return [{ file: fname, lang: langOfSrt(fname) }];
    var rows = tb.querySelectorAll("tr[data-name]");
    for (var i = 0; i < rows.length; i++) {
      var n = rows[i].getAttribute("data-name");
      if (!/\.srt$/i.test(n)) continue;
      out.push({ file: n, lang: langOfSrt(n) });
    }
    if (!out.length) out.push({ file: fname, lang: langOfSrt(fname) });
    return out;
  }
  function renderLangSel(fname) {
    var sel = document.querySelector("#mlModal-transcript [data-langsel]");
    if (!sel) return;
    var list = transcriptSiblings(fname), cur = langOfSrt(fname);
    var val = sel.querySelector("[data-langsel-val]"); if (val) val.textContent = cur;
    var menu = sel.querySelector("[data-langsel-menu]");
    if (menu) {
      menu.innerHTML = list.map(function (it) {
        return '<button class="ml-langsel__opt' + (it.file === fname ? " is-selected" : "") + '" type="button" role="option"' +
               ' data-langsel-opt="' + mlEsc(it.file) + '">' + mlEsc(it.lang) + '</button>';
      }).join("") +
      // перевод живёт здесь же — отдельного действия в футере нет.
      // стандартная иконка перевода (A + иероглиф)
      '<div class="ml-langsel__foot"><button class="ml-langsel__add" type="button" data-langsel-translate>' +
      '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.33 9.19 6.79 8h-2c.63 1.83 1.57 3.56 2.79 5.11l-3.11 3.06L5.5 18.5l3.5-3.5 2.19 2.19.68-2.12zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/></svg>' +
      'Translate</button></div>';
      menu.hidden = true;
    }
    sel.classList.remove("is-open");
    var trig = sel.querySelector("[data-langsel-trig]"); if (trig) trig.setAttribute("aria-expanded", "false");
    sel.hidden = false;   // нужен всегда: через него же добавляется перевод
  }
  // отображаемое имя ассета: видео, к которому относится транскрипт (без расширения)
  function transcriptAssetTitle(fname) {
    var v = findVideoForSrt(fname);
    return v ? baseName(v) : baseName(String(fname).replace(/^[a-z]{3}_/, ""));
  }
  // Review transcription: заголовок — ассет, конкретный .srt живёт в data-srt
  function openTranscript(name) {
    openModal("transcript", transcriptAssetTitle(name), null);
    var m = document.getElementById("mlModal-transcript");
    if (m) m.setAttribute("data-srt", name);
    renderLangSel(name);
  }
  // текущий .srt открытой модалки (для Regenerate / Save as / Translate)
  function transcriptSrt(modal) {
    var m = modal || document.getElementById("mlModal-transcript");
    return (m && m.getAttribute("data-srt")) || "";
  }
  // .srt как текстовый файл (на проде превью .srt — код/текст, а не читаемый транскрипт)
  function srtTime(t) {
    var p2 = String(t).split(":");
    var mm = p2.length > 1 ? p2[0] : "0", ss = p2.length > 1 ? p2[1] : "0";
    return "00:" + ("0" + mm).slice(-2) + ":" + ("0" + ss).slice(-2) + ",000";
  }
  function srtFileLines() {
    var rows = document.querySelectorAll("#mlModal-transcript [data-transcript-text] .ml-tl");
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      var t = rows[i].querySelector(".ml-tl__t").textContent.trim();
      var txt = rows[i].querySelector(".ml-tl__s").textContent.trim();
      var nextRow = rows[i + 1];
      var end = nextRow ? nextRow.querySelector(".ml-tl__t").textContent.trim() : null;
      out.push(String(i + 1));
      out.push(srtTime(t) + " --> " + (end ? srtTime(end) : srtTime(t).replace(",000", ",000")));
      out.push(txt);
      out.push("");
    }
    return out;
  }
  function openSrtAsCode(name) {
    var m = document.getElementById("mlModal-code");
    if (!m) { openTranscript(name); return; }        // фолбэк, если код-вьюера нет
    var lines = srtFileLines();
    var gutter = m.querySelector(".ml-code__gutter"), body = m.querySelector(".ml-code__lines");
    if (gutter) gutter.innerHTML = lines.map(function (_, i) { return "<div>" + (i + 1) + "</div>"; }).join("");
    if (body) body.innerHTML = lines.map(function (l) { return "<div>" + (l ? mlEsc(l) : "&nbsp;") + "</div>"; }).join("");
    openModal("code", name, null);
  }

  // Copy / Download .srt в модалке превью транскрипта
  function transcriptText(modal) {
    var rows = modal.querySelectorAll("[data-transcript-text] .ml-tl");
    return [].slice.call(rows).map(function (r) {
      var t = r.querySelector(".ml-tl__t"), s = r.querySelector(".ml-tl__s");
      return (t ? t.textContent : "") + " — " + (s ? s.textContent : "");
    }).join("\n");
  }
  function copyTranscript(modal) {
    pubClipboard(transcriptText(modal));
    var btn = modal.querySelector("[data-transcript-copy]"), lbl = btn ? btn.querySelector("[data-copy-label]") : null;
    if (btn) { btn.classList.add("is-copied"); if (lbl) lbl.textContent = "Copied"; setTimeout(function () { btn.classList.remove("is-copied"); if (lbl) lbl.textContent = "Copy"; }, 1300); }
  }
  function pad2(n) { n = String(n); return n.length < 2 ? "0" + n : n; }
  function pad3(n) { n = String(n); while (n.length < 3) n = "0" + n; return n; }
  function pad10(n) { n = String(n); while (n.length < 10) n = "0" + n; return n; }
  function mmssToSec(mmss) { var p = (mmss || "0:0").split(":"); return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0); }
  function secToSrt(sec) {
    if (sec < 0) sec = 0;
    var whole = Math.floor(sec), ms = Math.round((sec - whole) * 1000);
    if (ms >= 1000) { whole++; ms -= 1000; }
    var m = Math.floor(whole / 60), s = whole % 60;
    return "00:" + pad2(m) + ":" + pad2(s) + "," + pad3(ms);
  }
  // читает строки транскрипта из DOM → [ [startSec, endSec, text], ... ]
  function transcriptSegments(modal) {
    var rows = [].slice.call(modal.querySelectorAll("[data-transcript-text] .ml-tl")), segs = [];
    for (var i = 0; i < rows.length; i++) {
      var start = mmssToSec(rows[i].querySelector(".ml-tl__t").textContent);
      var end = i + 1 < rows.length ? mmssToSec(rows[i + 1].querySelector(".ml-tl__t").textContent) : start + 3;
      if (end <= start) end = start + 3;
      var text = (rows[i].querySelector(".ml-tl__s").textContent || "").replace(/\s+/g, " ").trim();
      segs.push([start, end, text]);
    }
    return segs;
  }
  // SRT: пост-форматирование ГОТОВОГО транскрипта — режем каждую реплику на сегменты
  // не длиннее maxWords слов (в стиле TurboScribe), время распределяем внутри интервала.
  function buildSrt(modal, maxWords) {
    maxWords = maxWords || 8;
    var base = transcriptSegments(modal), out = "", n = 1;
    for (var i = 0; i < base.length; i++) {
      var start = base[i][0], end = base[i][1];
      var words = base[i][2] ? base[i][2].split(" ") : [];
      var chunks = Math.max(1, Math.ceil(words.length / maxWords));
      var dur = (end - start) / chunks;
      for (var c = 0; c < chunks; c++) {
        var text = words.slice(c * maxWords, (c + 1) * maxWords).join(" ");
        if (!text) continue;
        out += n + "\n" + secToSrt(start + c * dur) + " --> " + secToSrt(start + (c + 1) * dur) + "\n" + text + "\n\n";
        n++;
      }
    }
    return out;
  }
  // TXT: читаемый транскрипт с таймкодами
  function buildTxt(modal) {
    var head = baseName(transcriptSrt(modal)) || "Transcript";
    var rows = [].slice.call(modal.querySelectorAll("[data-transcript-text] .ml-tl"));
    var lines = [head, ""];
    for (var i = 0; i < rows.length; i++) {
      var t = rows[i].querySelector(".ml-tl__t").textContent;
      var s = rows[i].querySelector(".ml-tl__s").textContent;
      lines.push("[" + t + "]  " + s);
    }
    return lines.join("\n");
  }
  // PDF: минимальный валидный однослойный PDF (Helvetica). Текст приводим к ASCII, чтобы
  // длина потока в байтах совпадала с длиной строки → корректный /Length и таблица xref.
  function asciiClean(s) {
    return String(s)
      .replace(/[–—]/g, "-").replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"').replace(/…/g, "...")
      .replace(/[^\x20-\x7E]/g, "");
  }
  function pdfEsc(s) { return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)"); }
  function pdfWrap(str, max) {
    var words = str.split(" "), out = [], cur = "";
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if (cur && (cur + " " + w).length > max) { out.push(cur); cur = w; }
      else { cur = cur ? cur + " " + w : w; }
    }
    if (cur) out.push(cur);
    return out.length ? out : [""];
  }
  function buildPdf(modal) {
    var title = asciiClean(baseName(transcriptSrt(modal)) || "Transcript");
    var rows = [].slice.call(modal.querySelectorAll("[data-transcript-text] .ml-tl"));
    var lines = [title, ""];
    for (var i = 0; i < rows.length; i++) {
      var t = rows[i].querySelector(".ml-tl__t").textContent;
      var s = rows[i].querySelector(".ml-tl__s").textContent;
      lines = lines.concat(pdfWrap(asciiClean("[" + t + "]  " + s), 92));
    }
    var content = "BT\n/F1 11 Tf\n14 TL\n50 800 Td\n";
    for (var j = 0; j < lines.length; j++) content += "(" + pdfEsc(lines[j]) + ") Tj T*\n";
    content += "ET";
    var objs = [
      "<</Type/Catalog/Pages 2 0 R>>",
      "<</Type/Pages/Kids[3 0 R]/Count 1>>",
      "<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>",
      "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
      "<</Length " + content.length + ">>\nstream\n" + content + "\nendstream"
    ];
    var pdf = "%PDF-1.4\n", offsets = [];
    for (var k = 0; k < objs.length; k++) { offsets.push(pdf.length); pdf += (k + 1) + " 0 obj\n" + objs[k] + "\nendobj\n"; }
    var xref = pdf.length;
    pdf += "xref\n0 " + (objs.length + 1) + "\n0000000000 65535 f \n";
    for (var m = 0; m < offsets.length; m++) pdf += pad10(offsets[m]) + " 00000 n \n";
    pdf += "trailer\n<</Size " + (objs.length + 1) + "/Root 1 0 R>>\nstartxref\n" + xref + "\n%%EOF";
    return pdf;
  }
  function downloadBlob(fname, content, mime) {
    try {
      var blob = new Blob([content], { type: mime });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a"); a.href = url; a.download = fname;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    } catch (e) { console.log("[prototype] download", fname); }
  }
  function getMaxWords(modal) {
    var inp = modal.querySelector("[data-mw]"), v = inp ? parseInt(inp.value, 10) : 8;
    if (!v || v < 1) v = 1; if (v > 30) v = 30; return v;
  }
  function stepMaxWords(modal, delta) {
    var inp = modal.querySelector("[data-mw]"); if (!inp) return;
    var v = getMaxWords(modal) + delta; if (v < 1) v = 1; if (v > 30) v = 30; inp.value = v;
  }
  function downloadTranscriptAs(modal, fmt, maxWords) {
    if (!modal) return;
    var base = baseName(transcriptSrt(modal)) || "transcript";
    if (fmt === "pdf") downloadBlob(base + ".pdf", buildPdf(modal), "application/pdf");
    else if (fmt === "txt") downloadBlob(base + ".txt", buildTxt(modal), "text/plain;charset=utf-8");
    else downloadBlob(base + ".srt", buildSrt(modal, maxWords || 8), "application/x-subrip");
    var dlas = modal.querySelector("[data-dlas]");
    if (dlas) { dlas.classList.remove("is-open"); var mn = dlas.querySelector("[data-dlas-menu]"); if (mn) mn.hidden = true; }
  }
  // «Save as → SRT»: открыть модалку выбора Max Words поверх модалки результата
  var srtSourceModal = null;
  function openSrtWords(sourceModal) {
    srtSourceModal = sourceModal || document.getElementById("mlModal-transcript");
    var sw = document.getElementById("mlModal-srtwords");
    if (!sw) return;
    var inp = sw.querySelector("[data-mw]"); if (inp) inp.value = "8"; // дефолт 8 при каждом открытии
    sw.classList.add("is-open");
    document.body.style.overflow = "hidden";
  }
  function closeSrtWords() {
    var sw = document.getElementById("mlModal-srtwords");
    if (sw) sw.classList.remove("is-open");
    // модалка результата остаётся открытой → overflow не сбрасываем (сбросит closeModals при её закрытии)
  }
  // Regenerate — запускает бейдж транскрибации в топбаре и по завершении создаёт НОВУЮ
  // версию файла ((v2), (v3)…) в той же папке. В модалке — краткий отклик-оверлей.
  function regenerateTranscript(modal) {
    var fname = transcriptSrt(modal);
    var body = modal.querySelector(".ml-transcript__body");
    var tx = modal.querySelector("[data-transcript-text]");
    if (body && tx && !body.classList.contains("is-regenerating")) {
      var regenBtn = modal.querySelector("[data-transcript-regen]");
      var saved = tx.innerHTML;
      body.classList.add("is-regenerating");
      if (regenBtn) regenBtn.disabled = true;
      tx.style.opacity = "0.3";
      var overlay = document.createElement("div");
      overlay.className = "ml-transcript__loading";
      overlay.innerHTML = '<span class="ml-transcript__spinner"></span><span>Regenerating transcript…</span>';
      body.appendChild(overlay);
      setTimeout(function () {
        tx.innerHTML = saved;
        tx.style.opacity = "";
        body.classList.remove("is-regenerating");
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        if (regenBtn) regenBtn.disabled = false;
      }, 1400);
    }
    if (fname) startRegeneration(fname); // бейдж в топбаре + 2-й файл
  }
  // корень имени файла: без .srt и без суффикса версии « (vN)»
  function rootOf(name) { return String(name).replace(/\.srt$/i, "").replace(/ \(v\d+\)$/, ""); }
  // видео, которому принадлежит .srt (снимаем языковой префикс «xxx_» и ищем в transcribedFiles)
  function findVideoForSrt(fname) {
    var vb = rootOf(fname).replace(/^[a-z]{3}_/, "");
    for (var k in transcribedFiles) { if (transcribedFiles[k] && transcribedFiles[k].base === vb) return k; }
    return null;
  }
  // имя следующей версии: <root> (vN).srt, где N = (число файлов той же серии в папке) + 1
  function nextRegenName(fname, subTbody) {
    var root = rootOf(fname), count = 0;
    if (subTbody) {
      var rows = subTbody.querySelectorAll("tr[data-name]");
      for (var i = 0; i < rows.length; i++) if (rootOf(rows[i].getAttribute("data-name")) === root) count++;
    }
    return root + " (v" + (count + 1) + ").srt";
  }
  function addRegenCard(origName, newName) {
    if (!jobsList) return null;
    var card = document.createElement("article");
    card.className = "job";
    card.innerHTML =
      '<div class="job__row">' +
        '<button class="job__chev" type="button" data-job-expand aria-label="Expand">' + CHEVRON_SVG + '</button>' +
        '<span class="job__name">' + origName + '</span>' +
        '<span class="job__time">just now</span>' +
        '<span class="job__status" data-job-status>Regenerating…</span>' +
      '</div>' +
      '<div class="job__bar"><div class="job__fill" data-job-fill style="animation-duration:' + TRANSCRIBE_MS + 'ms"></div></div>' +
      '<div class="job__foot"><span data-job-progress>0 of 1 done</span><span class="job__dot">·</span><span class="job__lang">Regenerate</span></div>' +
      '<div class="job__sub" data-job-sub hidden>' +
        '<div class="job__subrow" data-sub-srt="' + newName + '">' +
          '<span class="job__subname">' + newName + '</span>' +
          '<span class="job__langbadge">New version</span>' +
          '<div class="job__bar"><div class="job__fill" data-job-fill style="animation-duration:' + TRANSCRIBE_MS + 'ms"></div></div>' +
        '</div>' +
      '</div>';
    jobsList.insertBefore(card, jobsList.firstChild);
    return card;
  }
  function startRegeneration(fname) {
    var videoName = findVideoForSrt(fname);
    var folderId = videoName && transcribedFiles[videoName] ? transcribedFiles[videoName].folderId : null;
    var subTbody = folderId ? document.querySelector('tbody[data-folder="' + folderId + '"]') : null;
    if (!subTbody) { // фолбэк: папка исходной строки
      var srcRows = document.querySelectorAll("tr[data-name]");
      for (var i = 0; i < srcRows.length; i++) if (srcRows[i].getAttribute("data-name") === fname) { subTbody = srcRows[i].closest("tbody[data-folder]"); break; }
    }
    var newName = nextRegenName(fname, subTbody);
    activeJobs++; jobsRefreshBadge();
    var card = addRegenCard(fname, newName);
    var tid = setTimeout(function () {
      var idx = jobTimers.indexOf(tid); if (idx !== -1) jobTimers.splice(idx, 1);
      completeRegeneration(card, videoName, newName, subTbody);
    }, TRANSCRIBE_MS);
    jobTimers.push(tid);
  }
  function completeRegeneration(card, videoName, newName, subTbody) {
    if (card) {
      card.classList.add("is-done");
      var st = card.querySelector("[data-job-status]");
      if (st) {
        var end = document.createElement("span"); end.className = "job__end";
        end.innerHTML = '<span class="job__check" aria-label="Done">' + CHECK_SVG + '</span>' +
                        '<button class="job__dismiss" type="button" data-job-dismiss aria-label="Dismiss">' + CLOSE_X_SVG + '</button>';
        st.parentNode.replaceChild(end, st);
      }
      var pr = card.querySelector("[data-job-progress]"); if (pr) pr.textContent = "1 of 1 done";
      var fills = card.querySelectorAll("[data-job-fill]"); for (var i = 0; i < fills.length; i++) { fills[i].style.animation = "none"; fills[i].style.width = "100%"; }
      var sr = card.querySelector("[data-job-sub] .job__subrow");
      if (sr) {
        var sb = sr.querySelector(".job__bar"); if (sb) sb.remove();
        var chk = document.createElement("span"); chk.className = "job__check"; chk.setAttribute("aria-label", "Done"); chk.innerHTML = CHECK_SVG;
        var go = document.createElement("button"); go.className = "job__goto"; go.type = "button";
        go.setAttribute("data-job-goto", ""); go.setAttribute("data-video", videoName || ""); go.setAttribute("data-file", newName);
        go.innerHTML = "Go to file " + GOTO_CHEVRON;
        sr.appendChild(chk); sr.appendChild(go);
      }
    }
    activeJobs = Math.max(0, activeJobs - 1);
    if (subTbody) {
      var exists = false, ex = subTbody.querySelectorAll("tr");
      for (var j = 0; j < ex.length; j++) if (ex[j].getAttribute("data-name") === newName) { exists = true; break; }
      if (!exists) subTbody.appendChild(makeTranscriptRow(newName));
      var fid = subTbody.getAttribute("data-folder");
      var subRow = document.querySelector('tr[data-enter-folder="' + fid + '"]');
      if (subRow) refreshFolderRowMeta(subRow, subTbody);
      var txFolderRow = document.querySelector("[data-transcriptions-folder]");
      var txTbody = document.querySelector('tbody[data-folder="transcriptions"]');
      if (txFolderRow && txTbody) refreshFolderRowMeta(txFolderRow, txTbody);
      var rootTb = document.querySelector('tbody[data-level="root"]'); if (rootTb && !rootTb.hidden) updateRootCount();
      applyFilter();
    }
    addRegenNotification(newName, videoName);
    jobsRefreshBadge();
  }
  function addRegenNotification(newName, videoName) {
    var list = document.querySelector("[data-notif-list]"); if (!list) return;
    var art = document.createElement("article"); art.className = "notif-item";
    art.innerHTML =
      '<div class="notif-item__main"><div class="notif-item__row">' +
        '<p class="notif-item__title">Transcript regenerated</p>' +
        '<button class="notif-item__close" type="button" data-notif-dismiss aria-label="Dismiss">' + CLOSE_X_SVG + '</button>' +
      '</div>' +
      '<p class="notif-item__desc">A new version <strong>' + newName + '</strong> is ready.</p>' +
      '<p class="notif-item__time">just now</p>' +
      '<div class="notif-item__actions">' +
        '<button class="notif-item__act" type="button" data-notif-dismiss>Dismiss</button>' +
        '<button class="notif-item__act notif-item__act--view" type="button" data-open-transcript>View</button>' +
      '</div></div>';
    list.insertBefore(art, list.firstChild);
    var viewBtn = art.querySelector("[data-open-transcript]");
    if (viewBtn) viewBtn.addEventListener("click", function () {
      var panel = document.getElementById("notifPanel"); if (panel) panel.hidden = true;
      var bell = document.getElementById("notifBell"); if (bell) bell.setAttribute("aria-expanded", "false");
      goToTranscriptFile(videoName, newName);
    });
    bumpNotifBadge();
  }

  document.addEventListener("click", function (e) {

    // action-bar модалок и пункт меню «Publish to YouTube»
    var actEl = e.target.closest("[data-action]");
    if (actEl) {
      var act = actEl.getAttribute("data-action");
      if (act === "send" || act === "metadata") {
        e.stopPropagation();
        // имя видео: из шапки текущего превью, иначе из строки, для которой открыт «⋮»
        var srcM = actEl.closest(".ml-modal"), vname = "";
        if (srcM) { var vt = srcM.querySelector("[data-title]"); if (vt) vname = vt.textContent; }
        if (!vname && activeRow) vname = activeRow.getAttribute("data-name");
        pubVideoName = vname || "video_2026-07-10_12-44-13_original.mp4";
        closeActions();
        closeModals();     // закрыть текущее превью/меню
        if (act === "metadata") openMetadata(); else openSendToStudio();
        return;
      }
      if (act === "share") {
        e.stopPropagation();
        // имя файла: из шапки текущего превью, иначе из строки, для которой открыт «⋮»
        var srcModal = actEl.closest(".ml-modal");
        var name = "";
        if (srcModal) { var st = srcModal.querySelector("[data-title]"); if (st) name = st.textContent; }
        if (!name && activeRow) name = activeRow.getAttribute("data-name");
        closeActions();
        closeModals();
        openShare(name);
        return;
      }
      if (act === "download") {
        e.stopPropagation();
        console.log("[prototype] download clicked"); // заглушка
        if (actEl.closest(".ml-actions")) closeActions();
        return;
      }
      if (act === "transcribe") {
        e.stopPropagation();
        var trName = activeRow ? activeRow.getAttribute("data-name") : "";
        var trMode = actEl.getAttribute("data-transcribe-mode");
        closeActions();
        closeModals();
        if (trMode === "review" && trName && transcribedFiles[trName]) reviewTranscription(trName); // папка видео + модалка результата
        else openTranscribeModal(trName);
        return;
      }
    }

    // мультиселект переводов: открыть/закрыть меню
    var trToggle = e.target.closest("[data-tr-toggle]");
    if (trToggle) {
      var multiEl = trToggle.closest("[data-tr-multi]");
      var trMenu = multiEl.querySelector("[data-tr-menu]");
      var willOpen = trMenu.hidden;
      trMenu.hidden = !willOpen;
      multiEl.classList.toggle("is-open", willOpen);
      return;
    }
    // клик вне мультиселекта — закрыть его меню (клики по чекбоксам/поиску внутри не закрывают)
    var openTrMulti = document.querySelector("#mlModal-transcribe [data-tr-multi].is-open");
    if (openTrMulti && !e.target.closest("[data-tr-multi]")) {
      var otm = openTrMulti.querySelector("[data-tr-menu]"); if (otm) otm.hidden = true;
      openTrMulti.classList.remove("is-open");
    }

    // модалка «Transcribe»: запуск мок-процесса (выбранные языки → отдельные транскрипты)
    if (e.target.closest("[data-transcribe-start]")) {
      var tm = document.getElementById("mlModal-transcribe");
      var fileName = "", selectedLangs = [];
      if (tm) {
        fileName = tm.getAttribute("data-file") || "";
        var trMulti = tm.querySelector("[data-tr-multi]"); if (trMulti) selectedLangs = trSelectedLangs(trMulti);
      }
      if (selectedLangs.length === 0) return; // без языка — no-op (кнопка и так disabled)
      closeModals();
      startTranscription(fileName, selectedLangs);
      return;
    }

    // модалка результата транскрипта: Copy / Regenerate / Save as… (SRT → модалка Max Words; PDF/TXT — сразу)
    var tModalEl = e.target.closest("#mlModal-transcript");
    if (tModalEl) {
      if (e.target.closest("[data-transcript-copy]")) { copyTranscript(tModalEl); return; }
      if (e.target.closest("[data-transcript-regen]")) { regenerateTranscript(tModalEl); return; }
      if (e.target.closest("[data-transcript-translate]")) { openTranslate(tModalEl); return; }
      // переключение языка транскрипта
      if (e.target.closest("[data-langsel-trig]")) {
        var lsel = tModalEl.querySelector("[data-langsel]"), lmenu = lsel.querySelector("[data-langsel-menu]");
        var lopen = lmenu.hidden; lmenu.hidden = !lopen; lsel.classList.toggle("is-open", lopen);
        var ltrig = lsel.querySelector("[data-langsel-trig]"); if (ltrig) ltrig.setAttribute("aria-expanded", lopen ? "true" : "false");
        return;
      }
      if (e.target.closest("[data-langsel-translate]")) {
        var lsel2 = tModalEl.querySelector("[data-langsel]");
        if (lsel2) { var lm2 = lsel2.querySelector("[data-langsel-menu]"); if (lm2) lm2.hidden = true; lsel2.classList.remove("is-open"); }
        openTranslate(tModalEl);
        return;
      }
      var lopt = e.target.closest("[data-langsel-opt]");
      if (lopt) {
        var pickFile = lopt.getAttribute("data-langsel-opt");
        tModalEl.setAttribute("data-srt", pickFile);
        renderLangSel(pickFile);
        return;
      }
      if (!e.target.closest("[data-langsel]")) {
        var openLs = tModalEl.querySelector("[data-langsel].is-open");
        if (openLs) { var olm = openLs.querySelector("[data-langsel-menu]"); if (olm) olm.hidden = true; openLs.classList.remove("is-open"); }
      }
      var dlToggle = e.target.closest("[data-dlas-toggle]");
      if (dlToggle) {
        var dlas = dlToggle.closest("[data-dlas]"), dlMenu = dlas.querySelector("[data-dlas-menu]");
        var open = dlMenu.hidden; dlMenu.hidden = !open; dlas.classList.toggle("is-open", open);
        return;
      }
      var dlOpt = e.target.closest("[data-dl]");
      if (dlOpt) {
        var fmt = dlOpt.getAttribute("data-dl");
        var dl0 = dlOpt.closest("[data-dlas]"); if (dl0) { dl0.classList.remove("is-open"); var m0 = dl0.querySelector("[data-dlas-menu]"); if (m0) m0.hidden = true; }
        if (fmt === "srt") openSrtWords(tModalEl);              // SRT → отдельная модалка Max Words
        else downloadTranscriptAs(tModalEl, fmt);               // PDF/TXT — сразу
        return;
      }
    }
    // клик вне открытого «Save as…» — закрыть меню
    var openDlas = document.querySelector("#mlModal-transcript [data-dlas].is-open");
    if (openDlas && !e.target.closest("[data-dlas]")) {
      var odm = openDlas.querySelector("[data-dlas-menu]"); if (odm) odm.hidden = true;
      openDlas.classList.remove("is-open");
    }

    // модалка выбора языков перевода (поверх модалки результата)
    var tlEl = e.target.closest("#mlModal-translate");
    if (tlEl) {
      var tlToggle = e.target.closest("[data-tl-toggle]");
      if (tlToggle) {
        var tlm = tlToggle.closest("[data-tl-multi]"), tlMenu = tlm.querySelector("[data-tl-menu]");
        var tlOpen = tlMenu.hidden; tlMenu.hidden = !tlOpen; tlm.classList.toggle("is-open", tlOpen);
        return;
      }
      if (e.target.closest("[data-translate-start]")) {
        var multiT = tlEl.querySelector("[data-tl-multi]");
        var langsT = multiT ? tlSelectedLangs(multiT) : [];
        if (!langsT.length) return;                 // кнопка и так disabled
        var fnameT = tlEl.getAttribute("data-file") || "";
        closeTranslate();
        startTranslation(fnameT, langsT);
        return;
      }
      if (e.target.closest("[data-translate-close]")) { closeTranslate(); return; }
      if (e.target.classList.contains("ml-modal__overlay")) { closeTranslate(); return; }
      // клик внутри модалки вне меню языков — закрыть меню
      if (!e.target.closest("[data-tl-multi]")) {
        var openTl = tlEl.querySelector("[data-tl-multi].is-open");
        if (openTl) { var otm = openTl.querySelector("[data-tl-menu]"); if (otm) otm.hidden = true; openTl.classList.remove("is-open"); }
      }
      return;
    }

    // модалка выбора Max words per segment для SRT (поверх модалки результата)
    var swEl = e.target.closest("#mlModal-srtwords");
    if (swEl) {
      if (e.target.closest("[data-mw-dec]")) { stepMaxWords(swEl, -1); return; }
      if (e.target.closest("[data-mw-inc]")) { stepMaxWords(swEl, 1); return; }
      if (e.target.closest("[data-srtwords-export]")) {
        var mw = getMaxWords(swEl);
        downloadTranscriptAs(srtSourceModal || document.getElementById("mlModal-transcript"), "srt", mw);
        closeSrtWords();
        return;
      }
      if (e.target.closest("[data-srtwords-close]")) { closeSrtWords(); return; }
      if (e.target.classList.contains("ml-modal__overlay")) { closeSrtWords(); return; }
    }

    // модалка превью .txt метаданных: Copy / Download .txt
    var mtxtEl = e.target.closest("#mlModal-metatxt");
    if (mtxtEl) {
      if (e.target.closest("[data-meta-copy]")) { copyMetaTxt(mtxtEl); return; }
      if (e.target.closest("[data-meta-download]")) { downloadMetaTxt(mtxtEl); return; }
    }

    // топбар-бейдж транскрибации: открыть/закрыть попап, Clear all, раскрыть под-строки
    if (e.target.closest("[data-jobs-toggle]")) {
      e.stopPropagation();
      if (jobsPanel) { jobsPanel.hidden = !jobsPanel.hidden; if (jobsToggle) jobsToggle.setAttribute("aria-expanded", String(!jobsPanel.hidden)); }
      return;
    }
    if (e.target.closest("[data-jobs-clear]")) { for (var jt = 0; jt < jobTimers.length; jt++) clearTimeout(jobTimers[jt]); jobTimers = []; if (jobsList) jobsList.innerHTML = ""; activeJobs = 0; jobsRefreshBadge(); return; }
    var jobGoto = e.target.closest("[data-job-goto]");
    if (jobGoto) {
      if (jobsPanel) jobsPanel.hidden = true;
      if (jobsToggle) jobsToggle.setAttribute("aria-expanded", "false");
      var gv = jobGoto.getAttribute("data-video"), gf = jobGoto.getAttribute("data-file");
      if (gf) goToTranscriptFile(gv, gf); else reviewTranscription(gv); // конкретный файл или primary
      return;
    }
    var jobDismiss = e.target.closest("[data-job-dismiss]");
    if (jobDismiss) { var dc = jobDismiss.closest(".job"); if (dc) dc.remove(); jobsRefreshBadge(); return; }
    var jobExpand = e.target.closest("[data-job-expand]");
    if (jobExpand) { var jcard = jobExpand.closest(".job"); var sub = jcard.querySelector("[data-job-sub]"); if (sub) sub.hidden = !sub.hidden; jcard.classList.toggle("is-expanded"); return; }

    // интерактив модалки «Metadata» (Copy, варианты Title, Regenerate, дропдаун каналов, Google-мок)
    var pubModalEl = e.target.closest("#mlModal-publish");
    if (pubModalEl) {
      var copyEl = e.target.closest("[data-copy]");
      if (copyEl) { doCopy(copyEl); return; }
      if (e.target.closest("[data-title-prev]")) { titleIdx = (titleIdx - 1 + TITLE_VARIANTS.length) % TITLE_VARIANTS.length; applyTitle(pubModalEl); return; }
      if (e.target.closest("[data-title-next]")) { titleIdx = (titleIdx + 1) % TITLE_VARIANTS.length; applyTitle(pubModalEl); return; }
      if (e.target.closest("[data-pub-regen]")) { setPubStep(1); if (pubTimer) clearTimeout(pubTimer); pubTimer = setTimeout(function () { setPubStep(2); }, 1200); return; }
      if (e.target.closest("[data-chan-toggle]")) { var cm = pubModalEl.querySelector("[data-chan-menu]"); if (cm) cm.hidden = !cm.hidden; return; }
      var chOpt = e.target.closest("[data-chan-opt]"); if (chOpt) { selectChannel(pubModalEl, chOpt); return; }
      if (e.target.closest("[data-chan-connect]")) { var gg = pubModalEl.querySelector("[data-gsignin]"); if (gg) gg.hidden = false; return; }
      if (e.target.closest("[data-gsignin-cancel]")) { var g2 = pubModalEl.querySelector("[data-gsignin]"); if (g2) g2.hidden = true; return; }
      if (e.target.closest("[data-gsignin-go]")) { connectChannel(pubModalEl); return; }
      // клик мимо меню каналов — закрыть его (но не мешаем data-pub-publish / data-close ниже)
      var openMenu = pubModalEl.querySelector("[data-chan-menu]");
      if (openMenu && !openMenu.hidden && !e.target.closest("[data-chan-menu]")) openMenu.hidden = true;
    }

    // модалка шеринга: copy link, выбор получателя, invite по email, role-дропдауны
    var shareModalEl = e.target.closest("#mlModal-share");
    if (shareModalEl) {
      var copyBtn = e.target.closest("[data-share-copy]");
      if (copyBtn) { shareCopyLink(copyBtn); return; }
      var pick = e.target.closest("[data-share-pick]");
      if (pick) { sharePick(shareModalEl, pick); return; }
      if (e.target.closest("[data-share-invite-btn]")) { shareInviteEmail(shareModalEl); return; }
      var revokeBtn = e.target.closest("[data-revoke]");
      if (revokeBtn) { openRevokeConfirm(revokeBtn.closest(".ml-share__acc")); return; }
      // клик мимо поля поиска — скрыть дропдаун подсказок
      if (!e.target.closest(".ml-share__search")) { var rr = shareModalEl.querySelector("[data-share-results]"); if (rr) rr.hidden = true; }
    }

    // «Send to YouTube Studio» → метаданные сохраняются в файл (синхронизация с Metadata) + экран успеха
    if (e.target.closest("[data-pub-send]")) { saveMetadataFile(pubVideoName); setPubStep(3); return; }
    // «Save metadata» → сохранить .txt, закрыть модалку и перейти в папку Metadata (подсветить файл)
    if (e.target.closest("[data-pub-save]")) {
      saveMetadataFile(pubVideoName);
      closeModals();
      enterFolder("metadata");
      var savedName = metaTxtName(pubVideoName);
      var mrows = document.querySelectorAll('tbody[data-folder="metadata"] tr');
      for (var mi = 0; mi < mrows.length; mi++) {
        if (mrows[mi].getAttribute("data-name") === savedName) {
          mrows[mi].scrollIntoView({ block: "center" });
          mrows[mi].classList.remove("ml-row--flash"); void mrows[mi].offsetWidth; mrows[mi].classList.add("ml-row--flash");
          break;
        }
      }
      return;
    }

    // конфирм отзыва доступа (поверх модалки шеринга)
    if (e.target.closest("[data-revoke-confirm]")) { if (revokeTargetRow) revokeTargetRow.remove(); closeRevokeConfirm(); return; }
    if (e.target.closest("[data-revoke-cancel]")) { closeRevokeConfirm(); return; }

    // табы All / My / Shared media — визуальное переключение активного
    var tabBtn = e.target.closest(".ml-tab");
    if (tabBtn) { setActiveTab(tabBtn); return; }

    // фильтр по типу файла: открыть/закрыть дропдаун
    if (e.target.closest("[data-filter-toggle]")) {
      var fm = document.querySelector("[data-filter-menu]"); if (fm) fm.hidden = !fm.hidden; return;
    }
    // сброс фильтра — снять все чекбоксы и применить (меню остаётся открытым, чтобы видеть сброс)
    if (e.target.closest("[data-filter-clear]")) {
      var fboxes = document.querySelectorAll("[data-filter-kind]");
      for (var fb = 0; fb < fboxes.length; fb++) fboxes[fb].checked = false;
      applyFilter();
      return;
    }
    // клик вне фильтра — закрыть его меню (клики по чекбоксам/лейблам внутри не закрывают)
    if (!e.target.closest("[data-filter]")) { var fmm = document.querySelector("[data-filter-menu]"); if (fmm) fmm.hidden = true; }

    // клик вне бейджа транскрибации — закрыть его попап
    if (!e.target.closest("#jobsTranscribe")) { if (jobsPanel && !jobsPanel.hidden) { jobsPanel.hidden = true; if (jobsToggle) jobsToggle.setAttribute("aria-expanded", "false"); } }

    // хлебные крошки: клик по уровню пути (пустой id → корень)
    var crumbGo = e.target.closest("[data-crumb-go]");
    if (crumbGo) { var cid = crumbGo.getAttribute("data-crumb-go"); if (cid) enterFolder(cid); else exitToRoot(); return; }

    // вход в папку (клик по имени/иконке папки)
    var nameCell = e.target.closest(".c-name");
    if (nameCell) {
      var fRow = nameCell.closest("tr[data-enter-folder]");
      if (fRow) { enterFolder(fRow.getAttribute("data-enter-folder")); return; }
    }

    // клик по прочему пункту меню действий — заглушка, просто закрыть
    if (e.target.closest(".ml-action")) { closeActions(); return; }

    // кнопка ⋮
    var moreBtn = e.target.closest(".ml-more");
    if (moreBtn) {
      e.stopPropagation();
      var row = moreBtn.closest("tr");
      activeRow = row;
      if (pop.classList.contains("is-open")) closeActions();
      else openActions(moreBtn, row.getAttribute("data-kind"));
      return;
    }

    // открыть превью (клик по миниатюре/имени превьюабельного файла)
    var trigger = e.target.closest("[data-preview]");
    if (trigger) {
      var trow = trigger.closest("tr");
      if (trow.hasAttribute("data-metatxt")) { openMetaTxt(trow.getAttribute("data-name")); return; } // .txt метаданных
      // .srt открывается как текстовый файл; читаемый транскрипт — через «Review transcription»
      if (trow.getAttribute("data-kind") === "transcript") { openSrtAsCode(trow.getAttribute("data-name")); return; }
      openModal(trow.getAttribute("data-kind"), trow.getAttribute("data-name"), trow.getAttribute("data-src"));
      return;
    }


    // закрыть модалку (крестик или клик по подложке)
    if (e.target.closest("[data-close]") || e.target.classList.contains("ml-modal__overlay")) {
      closeModals();
      return;
    }

    // клик вне меню действий — закрыть его
    if (!e.target.closest(".ml-actions")) closeActions();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var cm = document.getElementById("mlRevokeConfirm");
    if (cm && cm.classList.contains("is-open")) { closeRevokeConfirm(); return; } // сначала закрываем конфирм
    // вложенные модалки поверх превью транскрипта — Esc гасит только верхнюю
    var tlmEsc = document.getElementById("mlModal-translate");
    if (tlmEsc && tlmEsc.classList.contains("is-open")) { closeTranslate(); return; }
    var swmEsc = document.getElementById("mlModal-srtwords");
    if (swmEsc && swmEsc.classList.contains("is-open")) { closeSrtWords(); return; }
    if (jobsPanel && !jobsPanel.hidden) { jobsPanel.hidden = true; if (jobsToggle) jobsToggle.setAttribute("aria-expanded", "false"); }
    closeActions();
    closeModals();
  });

  function setActiveTab(tab) {
    var tabs = document.querySelectorAll(".ml-tab");
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle("is-active", tabs[i] === tab);
    var label = document.querySelector(".ml-subrow__label");
    if (label && tab) label.textContent = tab.textContent.trim();
  }

  // ----- вход в папку / возврат в корень (+ хлебные крошки) -----
  // путь до папки (root → … → id) по реестру folderInfo
  function folderPath(id) {
    var path = [], cur = id;
    while (cur) { var info = folderInfo[cur]; if (!info) break; path.unshift({ id: cur, name: info.name }); cur = info.parent; }
    path.unshift({ id: "", name: "Media Library" });
    return path;
  }
  function renderCrumbs(id) {
    var crumbs = document.querySelector("[data-crumbs]");
    if (!crumbs) return;
    if (!id) { crumbs.hidden = true; crumbs.innerHTML = ""; return; }
    var path = folderPath(id), html = "";
    for (var i = 0; i < path.length; i++) {
      if (i === path.length - 1) html += '<span class="ml-crumb ml-crumb--current">' + path[i].name + '</span>';
      else html += '<button class="ml-crumb" type="button" data-crumb-go="' + path[i].id + '">' + path[i].name + '</button><span class="ml-crumb__sep">/</span>';
    }
    crumbs.innerHTML = html;
    crumbs.hidden = false;
  }
  function updateCountFor(tb) {
    var rows = tb.querySelectorAll("tr"), folders = 0, files = 0;
    for (var i = 0; i < rows.length; i++) { if (rows[i].getAttribute("data-kind") === "folder") folders++; else files++; }
    var parts = [];
    if (folders) parts.push(folders + (folders === 1 ? " folder" : " folders"));
    if (files) parts.push(files + (files === 1 ? " file" : " files"));
    var countEl = document.querySelector("[data-count]"); if (countEl) countEl.textContent = parts.length ? parts.join(" · ") : "0 files";
  }
  function enterFolder(id) {
    var folderTb = document.querySelector('tbody[data-folder="' + id + '"]');
    if (!folderTb) return;
    var rootTb = document.querySelector('tbody[data-level="root"]'); if (rootTb) rootTb.hidden = true;
    var all = document.querySelectorAll('tbody[data-level="folder"]');
    for (var i = 0; i < all.length; i++) all[i].hidden = true;
    folderTb.hidden = false;
    renderCrumbs(id);
    updateCountFor(folderTb);
    pauseInfinite(); // внутри папки инфинайт-скролл не нужен
    applyFilter();   // применить активный фильтр к строкам папки
    closeActions();
  }
  function exitToRoot() {
    var rootTb = document.querySelector('tbody[data-level="root"]'); if (rootTb) rootTb.hidden = false;
    var all = document.querySelectorAll('tbody[data-level="folder"]');
    for (var i = 0; i < all.length; i++) all[i].hidden = true;
    renderCrumbs(null);
    updateRootCount();
    resumeInfinite();
    applyFilter();
  }

  // ----- фильтр по типу файла (фронтовая фильтрация строк) -----
  function getFilterSet() {
    var set = [], boxes = document.querySelectorAll("[data-filter-kind]");
    for (var i = 0; i < boxes.length; i++) if (boxes[i].checked) set.push(boxes[i].getAttribute("data-filter-kind"));
    return set;
  }
  function applyFilter() {
    var set = getFilterSet();
    var rows = document.querySelectorAll(".ml-row");
    for (var i = 0; i < rows.length; i++) {
      var kind = rows[i].getAttribute("data-kind");
      rows[i].hidden = set.length > 0 && set.indexOf(kind) === -1; // пусто → показываем всё
    }
    var dot = document.querySelector("[data-filter-dot]"); if (dot) dot.hidden = set.length === 0; // точка при активном фильтре
  }
  var _filterMenu = document.querySelector("[data-filter-menu]");
  if (_filterMenu) _filterMenu.addEventListener("change", applyFilter);

  // ----- инфинайт-скролл: подгрузка мок-строк порциями + лоадер (только в корне) -----
  var infiniteActive = true;
  var _loadEl = document.querySelector("[data-loadmore]");
  function pauseInfinite() { infiniteActive = false; if (_loadEl) _loadEl.hidden = true; }
  function resumeInfinite() { infiniteActive = true; }
  (function initInfinite() {
    var tbody = document.querySelector('tbody[data-level="root"]');
    var sentinel = document.querySelector("[data-infinite-sentinel]");
    if (!tbody || !sentinel || !("IntersectionObserver" in window)) return;
    var CHUNK = 25, TOTAL = 75, loaded = 0, loading = false, done = false;
    var TYPES = [
      { k: "video", f: "sample-video.webm", ext: "mp4" },
      { k: "image", f: "cover-photo.png", ext: "png" },
      { k: "audio", f: "podcast-episode-04.wav", ext: "wav" },
      { k: "document", f: "contract-draft.docx", ext: "docx" },
      { k: "spreadsheet", f: "revenue-report.xlsx", ext: "xlsx" },
      { k: "pdf", f: "portfolio.pdf", ext: "pdf" },
      { k: "code", f: "upload-script.js", ext: "js" },
      { k: "other", f: "project-archive.zip", ext: "zip" }
    ];
    var SIZES = ["1.2 MB", "452 KB", "88 KB", "12.4 MB", "3.1 MB", "640 KB", "24.9 MB", "7.7 MB"];
    var ICON = { image: "ml-image", audio: "ml-audio", document: "ml-file", spreadsheet: "ml-spreadsheet", pdf: "ml-pdf", code: "ml-code", other: "ml-file" };
    function preview(kind) {
      if (kind === "video") return '<div class="ml-preview ml-preview--video" data-preview><div class="ml-preview__play"><span><svg><use href="#ml-play"></use></svg></span></div></div>';
      return '<div class="ml-preview ml-preview--' + kind + '" data-preview><svg class="ml-preview__icon"><use href="#' + ICON[kind] + '"></use></svg></div>';
    }
    function makeRow(i) {
      var t = TYPES[i % TYPES.length];
      var name = t.k + "-asset-" + (i + 1) + "." + t.ext;
      var d = (i % 28) + 1; var day = d < 10 ? "0" + d : "" + d;
      return '<tr class="ml-row" data-kind="' + t.k + '" data-name="' + name + '" data-src="files/' + t.f + '">' +
        '<td class="c-check"><input class="ml-check" type="checkbox" aria-label="Select" /></td>' +
        '<td class="c-drag"><svg class="ml-drag"><use href="#ml-drag"></use></svg></td>' +
        '<td class="c-name"><div class="ml-name">' + preview(t.k) + '<span class="ml-name__text" data-preview>' + name + '</span></div></td>' +
        '<td class="c-created">' + day + '.06.2026</td>' +
        '<td class="c-storage">' + SIZES[i % SIZES.length] + '</td>' +
        '<td class="c-author"><span class="ml-you">You</span></td>' +
        '<td class="c-shared"><span class="ml-notshared"><svg><use href="#ml-eyeslash"></use></svg>Not shared</span></td>' +
        '<td class="c-actions c-actions-cell"><button class="ml-more" type="button" aria-label="Actions"><svg><use href="#ml-more"></use></svg></button></td>' +
        '</tr>';
    }
    function loadChunk() {
      if (loading || done || !infiniteActive) return;
      loading = true; if (_loadEl) _loadEl.hidden = false;
      setTimeout(function () {
        var end = Math.min(loaded + CHUNK, TOTAL);
        var tmp = document.createElement("tbody"); var html = "";
        for (var i = loaded; i < end; i++) html += makeRow(i);
        tmp.innerHTML = html;
        while (tmp.firstChild) tbody.appendChild(tmp.firstChild);
        loaded = end;
        applyFilter(); // применить активный фильтр к новым строкам
        loading = false; if (_loadEl) _loadEl.hidden = true;
        if (loaded >= TOTAL) { done = true; obs.disconnect(); } // конец мок-данных → стоп, без повторных триггеров
      }, 700);
    }
    var obs = new IntersectionObserver(function (entries) {
      if (entries[0] && entries[0].isIntersecting) loadChunk();
    }, { root: null, rootMargin: "300px" });
    obs.observe(sentinel);
  })();

  // deep-link из нотификации «View»: ?open=shared → вкладка Shared media + сразу открыть видео
  if (/[?&]open=shared\b/.test(location.search)) {
    var _tabs = document.querySelectorAll(".ml-tab"), _shared = null;
    for (var _i = 0; _i < _tabs.length; _i++) { if (/shared/i.test(_tabs[_i].textContent)) _shared = _tabs[_i]; }
    if (_shared) setActiveTab(_shared);
    var _vrow = document.querySelector('tr[data-kind="video"]');
    if (_vrow) openModal(_vrow.getAttribute("data-kind"), _vrow.getAttribute("data-name"), _vrow.getAttribute("data-src"));
  }


  // ----- отчёты из Analytics: файл появляется в папке Analytics -----
  // Мост односторонний: страница Reports пишет запись в localStorage, Media Library
  // дорисовывает строку при загрузке — тот же принцип, что у Metadata/Transcriptions,
  // только состояние переживает переход между страницами прототипа.
  var ML_EXTRA_KEY = "subsub_ml_files";
  function mlExtraLoad() {
    try { var v = JSON.parse(localStorage.getItem(ML_EXTRA_KEY) || "[]"); return Array.isArray(v) ? v : []; }
    catch (e) { return []; }
  }
  function makeSheetRow(rec) {
    var tr = document.createElement("tr");
    tr.className = "ml-row";
    tr.setAttribute("data-kind", rec.kind || "spreadsheet");
    tr.setAttribute("data-name", rec.name);
    if (rec.src) tr.setAttribute("data-src", "files/" + rec.src);
    tr.innerHTML =
      '<td class="c-check"><input class="ml-check" type="checkbox" aria-label="Select" /></td>' +
      '<td class="c-drag"><svg class="ml-drag"><use href="#ml-drag"></use></svg></td>' +
      '<td class="c-name"><div class="ml-name"><div class="ml-preview ml-preview--spreadsheet" data-preview>' +
        '<svg class="ml-preview__icon"><use href="#ml-spreadsheet"></use></svg></div>' +
        '<span class="ml-name__text" data-preview>' + rec.name + '</span></div></td>' +
      '<td class="c-created">' + (rec.created || "") + '</td>' +
      '<td class="c-storage">' + (rec.size || "") + '</td>' +
      '<td class="c-author"><span class="ml-you">You</span></td>' +
      '<td class="c-shared"><span class="ml-notshared"><svg><use href="#ml-eyeslash"></use></svg>Not shared</span></td>' +
      '<td class="c-actions c-actions-cell"><button class="ml-more" type="button" aria-label="Actions"><svg><use href="#ml-more"></use></svg></button></td>';
    return tr;
  }
  (function () {
    var list = mlExtraLoad();
    if (!list.length) return;
    var touched = {};
    list.forEach(function (rec) {
      if (!rec || !rec.name) return;
      var fid = rec.folder || "analytics";
      var tb = document.querySelector('tbody[data-folder="' + fid + '"]');
      if (!tb) return;
      if (tb.querySelector('tr[data-name="' + rec.name + '"]')) return;   // не дублируем
      tb.appendChild(makeSheetRow(rec));
      touched[fid] = true;
    });
    // счётчик файлов в строке папки в корне
    Object.keys(touched).forEach(function (fid) {
      var tb = document.querySelector('tbody[data-folder="' + fid + '"]');
      var rowsCount = tb ? tb.querySelectorAll("tr.ml-row:not(.ml-row--folder)").length : 0;
      var folderRow = document.querySelector('tr[data-enter-folder="' + fid + '"]');
      var meta = folderRow ? folderRow.querySelector(".ml-name__meta span") : null;
      if (meta) meta.textContent = rowsCount + (rowsCount === 1 ? " file" : " files");
    });
    applyFilter();
  })();
  // deep-link со страницы Reports: ?folder=analytics&file=<имя> — войти в папку и подсветить файл
  (function () {
    var qs = new URLSearchParams(location.search);
    var fid = qs.get("folder");
    if (!fid) return;
    if (!document.querySelector('tbody[data-folder="' + fid + '"]')) return;
    enterFolder(fid);
    var want = qs.get("file");
    if (!want) return;
    var rows = document.querySelectorAll('tbody[data-folder="' + fid + '"] tr.ml-row');
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].getAttribute("data-name") === want) {
        rows[i].classList.remove("ml-row--flash");
        void rows[i].offsetWidth;
        rows[i].classList.add("ml-row--flash");
        if (rows[i].scrollIntoView) rows[i].scrollIntoView({ block: "center" });
        break;
      }
    }
  })();

  window.addEventListener("resize", closeActions);
})();

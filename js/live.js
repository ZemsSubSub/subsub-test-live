// Раздел Live — движок прототипа. Данные приходят инлайном (window.LIVE_FIXTURES),
// изменяемое состояние живёт в localStorage, сети и API нет.
//
// Фаза A: Э1 список стримов и Э2 карточка стрима, плюс модалки Э9 1–3, 7 и баннер 10.
// Матрица доступности действий — из Э9, блокировки по ADR-0002, тосты по ADR-0003.
(function () {
  "use strict";

  var UI = window.LVUI, IC = window.LIVE_ICONS || {}, F = window.LIVE_FIXTURES;
  if (!UI || !F) return;

  // Демо-вариант порта: build/serve.js ставит <body data-demo="empty">, как в Analytics.
  // Нулевой сценарий: канал подключён, аккаунт платный, но ни стримов, ни плейлистов,
  // ни файлов ещё нет (решение 03.09). Состояние у варианта своё.
  function demoMode() {
    var v = document.body ? document.body.getAttribute("data-demo") : "";
    return v === "empty" ? v : "";
  }
  var DEMO = demoMode();
  if (DEMO) {
    F = JSON.parse(JSON.stringify(F));
    F.streams = []; F.playlists = []; F.notifications = []; F.files = []; F.folders = [];
    F.account.mode = "payg";
  }
  var KEY = "subsub_live_state" + (DEMO ? "_" + DEMO : "");
  var PAGE = document.body.getAttribute("data-lv-page") || "";

  // ============================================================ состояние
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function fresh() {
    return {
      v: 3,
      calChannel: null,
      calView: "cal",
      now: F.now,
      account: { mode: F.account.mode },
      streams: clone(F.streams),
      playlists: clone(F.playlists),
      cols: null,          // null → состав колонок по умолчанию
      filters: { status: [], channels: [] },
      loading: false
    };
  }
  var STATE_V = 3;                        // при смене модели старое состояние сбрасывается
  var S = UI.storeGet(KEY, null) || fresh();
  if (S.v !== STATE_V) S = fresh();       // в старом состоянии оставались пустые «New playlist»
  if (!S.filters) S.filters = { status: [], channels: [] };
  // загруженные в демо файлы живут в состоянии, иначе после перезагрузки очередь осиротеет
  if (DEMO && S.extraFiles && S.extraFiles.length) F.files = F.files.concat(S.extraFiles);
  // подключённые через консент каналы тоже живут в состоянии: флаг connected лежит в фикстурах
  (S.connected || []).forEach(function (id) { var c = chan(id); if (c) { c.connected = true; c.revoked = false; } });
  function save() { UI.storeSet(KEY, S); }
  function nowMs() { return Date.parse(S.now); }

  var TZ = F.account.tz, TZL = F.account.tzLabel;

  // ---- справочники
  function chan(id) { return F.channels.filter(function (c) { return c.id === id; })[0] || null; }
  function file(id) { return F.files.filter(function (f) { return f.id === id; })[0] || null; }
  function playlist(id) { return S.playlists.filter(function (p) { return p.id === id; })[0] || null; }
  function stream(id) { return S.streams.filter(function (s) { return s.id === id; })[0] || null; }
  function acc() {
    var m = F.account.modes[S.account.mode] || F.account.modes.payg;
    return { mode: S.account.mode, kind: m.kind, balance: m.balance, creditHours: m.creditHours, shared: !!m.shared, orgName: m.orgName, label: m.label };
  }

  // ============================================================ статусы
  // UI-состояние ВЫВОДИТСЯ из сырых полей status и virtual_status, а не хранится —
  // документ «Состояния стрима», раздел 7. Десять бейджей, других в интерфейсе нет.
  var ST = {
    ready:      { label: "Ready to start" },
    scheduled:  { label: "Scheduled" },
    preparing:  { label: "Preparing" },
    live:       { label: "Live", dot: true },
    stopping:   { label: "Stopping" },
    stopped:    { label: "Stopped" },
    archived:   { label: "Archived" },
    needconv:   { label: "Needs conversion" },
    converting: { label: "Converting" },
    convfail:   { label: "Conversion failed" },
    // Redis-лок запуска: пока держится, ни одно действие не срабатывает — бейдж это и говорит
    starting:   { label: "Starting…" },
    // мастер закрыли, не дойдя до конца: набор и настройки лежат черновиком
    draft:      { label: "Draft" },
    // файл в наборе не выровнять: конвертация не спасёт, запуск заблокирован
    cant:       { label: "Not aligned" }
  };
  var ST_RAW = { draft: "draft", created: "ready", ready: "ready", processing: "preparing", downloading: "preparing",
    live: "live", stopped: "stopped", archived: "archived", needs_conversion: "needconv",
    converting: "converting", conversion_failed: "convfail" };
  function stKey(s) {
    var vs = s.virtual_status;
    if (s.status === "draft") return "draft";
    if (vs === "starting") return "starting";
    if (vs === "stopping") return "stopping";
    // подготовка видна и у запланированного: прогрев идёт по крону за час до старта
    if (s.status === "processing" || s.status === "downloading") return "preparing";
    if (vs === "scheduled") return "scheduled";
    var raw = ST_RAW[s.status] || "ready";
    if (raw === "ready" || raw === "scheduled") {
      var byContent = { convfail: "convfail", busy: "converting", cant: "cant", convert: "needconv" };
      var rd = readiness(content(s));
      var k = byContent[rd.state];
      if (k) return k;
    }
    return raw;
  }
  // Redis-лок действия: пока он держится, ни одно действие не срабатывает
  function inAction(s) { return s.virtual_status === "starting" || s.virtual_status === "stopping"; }
  // пять причин остановки из документа; null — просто Stopped, ничего не выдумываем
  var STOP_REASON = {
    you: "Stopped by you",
    schedule: "Stopped · schedule ended",
    balance: "Stopped · balance ran out",
    youtube: "Stopped · ended on YouTube or the key is no longer valid"
  };
  function stopReason(s) { return (stKey(s) === "stopped" && STOP_REASON[s.stopReason]) || ""; }
  // Канал стрима для показа. С ручным ключом канал опознаётся по ссылке на эфир (Э3):
  // к системе он не подключён, но существует — «No channel» тут врал бы.
  function chanView(s) {
    var ch = chan(s.channelId);
    if (ch) return { name: ch.name, initial: ch.initial, color: ch.color, external: false, manual: s.dest && s.dest.mode === "manual" };
    if (s.dest && s.dest.mode === "manual") {
      var nm = s.dest.channelName || destHost(s.dest.link) || "Unknown channel";
      return { name: nm, initial: nm.charAt(0).toUpperCase(), color: "var(--color-shade-300)", external: true, manual: true };
    }
    return null;
  }
  // подпись под именем канала: не подключён — важнее, чем способ ввода ключа
  function chanTag(v) {
    return v.external ? '<span class="lv-chan__off">Not connected</span>'
      : v.manual ? '<span class="lv-chan__off">Manual key</span>' : "";
  }
  function chanHtml(s) {
    var v = chanView(s);
    if (!v) return '<span class="an-muted">No channel</span>';
    return '<span class="lv-chan"><span class="an-chan__ava" style="background:' + v.color + '">' + UI.esc(v.initial) + "</span>" +
      '<span class="lv-chan__col"><span class="lv-chan__n">' + UI.esc(v.name) + "</span>" + chanTag(v) + "</span></span>";
  }
  function chanName(s) { var v = chanView(s); return v ? v.name + (v.external ? " · Not connected" : "") : "No channel"; }
  function streamHref(s) {
    return (s && s.status === "draft" ? "live-stream-create.html?id=" : "live-stream.html?id=") + encodeURIComponent(s.id);
  }
  function stBadge(k, tip) {
    var s = ST[k] || ST.ready;
    return '<span class="ml-tag ml-tag--pill lv-st lv-st--' + k + '"' +
      (tip ? ' tabindex="0" data-tip="' + UI.esc(tip) + '"' : "") + ">" +
      (s.dot ? '<span class="ml-tag__dot"></span>' : "") + s.label + "</span>";
  }

  // ============================================================ тексты — по одному на смысл
  var T = {
    // причины блокировок
    alreadyRunning: "This stream is already running.",
    alreadyPreparing: "The stream is already preparing to go live.",
    notLive: "This stream is not live.",
    inProgress: "Action in progress.",
    draftStart: "Finish the setup to start.",
    pastRun: "Past runs stay as history — only future runs can be changed.",
    draftOnly: "Finish the setup first.",
    afterStop: "Available after the stream stops.",
    noAirYet: "The stream hasn’t been live yet.",
    archivedRO: "Archived streams can’t be edited.",
    stopBeforeArchive: "Stop the stream before archiving it.",
    stopBeforeDelete: "Stop the stream before deleting it.",
    liveEditPlaylist: "The stream is on air — stop it to change the queue or settings.",
    needChannel: "Connect a channel or enter a stream key to continue.",
    needVideo: "Add at least one video to continue.",
    balanceEmpty: "Your balance is empty — top up to start streaming.",
    onAir: "This video is on air",
    emptyPl: "An empty playlist can’t be selected in a stream.",
    needPlaylist: "Select a playlist or create a new one to continue",
    needFileForm: "Choose a video to continue",
    calAllRO: "Switch to a single channel to move slots.",
    // панель готовности (SSDEV-2153, сведено в одну модель)
    readyNone: "Add at least one video.",
    // баланс
    paused: "Streaming is paused — top up your balance to continue.",
    topUp: "Top up balance"
  };

  // ============================================================ готовность плейлиста
  // Матрица эфира: короткая сторона × частота кадров → допустимый битрейт, Мбит/с.
  // Из неё считаются все состояния файлов: цель по разрешению выбирает человек,
  // частота берётся из самих файлов.
  var RATE_MATRIX = {
    480:  { 24: [1.0, 2.0],   30: [1.2, 2.5],   60: [2.0, 4.0] },
    720:  { 24: [2.5, 5.0],   30: [3.0, 6.0],   60: [4.5, 9.0] },
    1080: { 24: [4.0, 8.0],   30: [4.5, 10.0],  60: [6.0, 15.0] },
    1920: { 24: [5.0, 10.0],  30: [6.0, 12.0],  60: [9.0, 18.0] },
    2560: { 24: [8.0, 18.0],  30: [10.0, 24.0], 60: [15.0, 30.0] },
    3840: { 24: [15.0, 35.0], 30: [20.0, 50.0], 60: [53.0, 68.0] }
  };
  // Пять ступеней качества; вертикаль — та же ступень, повёрнутый кадр.
  // Строка 1920 из исходной таблицы — это вертикальная 1080: её числа и берём.
  var PRESETS = [3840, 2560, 1080, 720, 480];
  var RATE_VERT = { 1080: RATE_MATRIX[1920] };
  var FPS_COLS = [24, 30, 60];
  var FPS_MIN = 24, FPS_MAX = 60;
  // стороны кадра каждого пресета: 1920 — вертикальное видео, 2k и 4k названы по длинной стороне
  var RES_DIM = { 480: [854, 480], 720: [1280, 720], 1080: [1920, 1080],
    2560: [2560, 1440], 3840: [3840, 2160] };
  var RES_LBL = { 480: "480p", 720: "720p", 1080: "1080p", 2560: "2k", 3840: "4k" };
  // Требования ингеста YouTube: ими нельзя управлять, их можно только соблюдать.
  // Разрешения и частоты здесь нет — их задаёт контент стрима.
  var INGEST = { fps: 30, vcodec: "h264", acodec: "aac", ac: 2, ar: 48000, audio: true };
  function resLabel(row) { return RES_LBL[row] || row + "p"; }
  // кадр ступени: по умолчанию горизонтальный, для вертикали стороны меняются местами
  function resDim(row, vert) {
    var d = RES_DIM[row] || [Math.round(row * 16 / 9), row];
    return vert ? [d[1], d[0]] : [d[0], d[1]];
  }
  function resDimLabel(row, vert) {
    var d = resDim(row, vert);
    return d[0] + " × " + d[1];
  }
  // вертикальный кадр требует больше битрейта: для 1080 числа даны в исходной таблице,
  // для остальных ступеней пока берём горизонтальные — уточняется как LV20
  function rateRangeFor(row, fps, vert) {
    var m = vert && RATE_VERT[row] ? RATE_VERT[row] : RATE_MATRIX[row];
    return (m || {})[fps] || null;
  }
  function rateRange(h, fps) { return (RATE_MATRIX[h] || {})[fps] || null; }
  // строка матрицы по кадру: сначала точное совпадение сторон, иначе по высоте
  function resRow(h, w) {
    var shortSide = w ? Math.min(w, h) : h, hit = null;
    Object.keys(RES_DIM).forEach(function (k) {
      if (RES_DIM[k][1] === shortSide) hit = Number(k);
    });
    if (hit) return hit;
    if (shortSide >= 2160) return 3840;
    if (shortSide >= 1440) return 2560;
    if (shortSide >= 1080) return 1080;
    if (shortSide >= 720) return 720;
    return 480;
  }
  function isVert(w, h) { return !!(w && h && h > w); }
  // столбец матрицы: 24 / 30 / 60, вниз до ближайшего — 25 кадров считаются как 24
  // 29.97 и 30 (как 59.94 и 60, 23.976 и 24) — одна частота, записанная по-разному:
  // сравнивать их как разные значит гнать файл на конвертацию без причины.
  // 25 и 24 при этом разные: их путать нельзя.
  function fpsNorm(fps) {
    var n = Number(fps) || 0, r = Math.round(n);
    return Math.abs(n - r) <= 0.1 ? r : n;
  }
  function fpsCol(fps) {
    // 29.97 — это столбец 30: сравниваем по округлённому значению, а не по сырому
    var r = Math.round(fps || 0), out = FPS_COLS[0];
    FPS_COLS.forEach(function (c) { if (r >= c) out = c; });
    return out;
  }
  // средний битрейт файла, Мбит/с: отдельного поля у файла нет, считаем из размера
  // 44100 → «44.1 kHz», 48000 → «48 kHz»: дробная часть только когда она есть
  function khz(hz) {
    var v = (hz || 0) / 1000;
    return (Math.round(v * 10) % 10 ? v.toFixed(1) : String(Math.round(v))) + " kHz";
  }
  function fileMbps(f) {
    if (!f || !f.bytes || !f.sec) return 0;
    // округляем до той же десятой, что печатаем: иначе «3.0 Mbps ниже 3.0–6.0»
    return Math.round((f.bytes * 8) / f.sec / 1e5) / 10;
  }
  // Потолок качества: конвертация умеет только уменьшать, поэтому цель не может быть
  // выше самого маленького файла. Возвращает строку матрицы и файл, который её задал.
  // Потолок очереди: цель не может быть больше самого маленького файла ни по одной
  // стороне. Ориентация берётся у большинства файлов — её же предлагаем по умолчанию.
  function resCap(pl) {
    var cap = null, byFile = null, vert = 0, horiz = 0;
    ((pl && pl.items) || []).forEach(function (i) {
      if (!inSet(i)) return;
      var f = file(i.fileId);
      if (!f.q || !f.q.h) return;
      if (isVert(f.q.w, f.q.h)) vert++; else horiz++;
      var row = resRow(f.q.h, f.q.w);
      if (cap === null || row < cap) { cap = row; byFile = f; }
    });
    return { row: cap, file: byFile, vert: vert > horiz };
  }
  // влезает ли кадр ступени в каждый файл набора — иначе это апскейл
  function resFits(pl, row, vert) {
    var d = resDim(row, vert), ok = true;
    ((pl && pl.items) || []).forEach(function (i) {
      if (!inSet(i) || !ok) return;
      var f = file(i.fileId);
      if (!f.q || !f.q.w || !f.q.h) return;
      if (d[0] > f.q.w || d[1] > f.q.h) ok = false;
    });
    return ok;
  }
  function resCapWhy(cap) {
    if (!cap.row) return "";
    return "The smallest file in the queue is " + resLabel(cap.row) +
      (cap.file ? " (" + cap.file.name + ")" : "") + " — conversion can only scale down.";
  }
  // Частота эфира не выбирается: берём минимальную среди файлов, годных для эфира
  // (24…60). Файлы вне этих границ конвертация не спасает — они помечаются отдельно.
  function fpsOf(pl) {
    var min = 0;
    ((pl && pl.items) || []).forEach(function (i) {
      if (!inSet(i)) return;
      var f = file(i.fileId);
      if (!f.q || !f.q.fps) return;
      if (f.q.fps < FPS_MIN || f.q.fps > FPS_MAX) return;
      var n = fpsNorm(f.q.fps);
      if (!min || n < min) min = n;
    });
    // цель — ровно минимум из файлов: файл, задавший её, конвертировать не нужно.
    // Столбец матрицы для битрейта берётся ближайшим снизу (25 кадров → столбец 24).
    return min || INGEST.fps;
  }

  // Считаем по включённым файлам с известными метаданными: файл в обработке из сравнения
  // исключается и никогда не блокирует (SSDEV-2153, следствие 2).
  // Профиль стрима (Э10): плейлист наследует профиль аккаунта и может переопределить.
  // профиль эфира из выбранного пресета: строка матрицы едет вместе с кадром
  function resProfile(row, vert) {
    var r = RES_DIM[row] ? row : resRow(row || 1080);
    var d = resDim(r, vert);
    return { row: r, vert: !!vert, w: d[0], h: d[1], fps: INGEST.fps, vcodec: INGEST.vcodec,
      acodec: INGEST.acodec, ac: INGEST.ac, ar: INGEST.ar, audio: INGEST.audio };
  }
  function profileOf(pl) {
    // цели по умолчанию нет: набор судится по максимуму, который сам позволяет
    var base = (pl && pl.profile) || null;
    var capO = resCap(pl);
    var out = base && base.row ? base : resProfile(capO.row || (base && base.h) || 1080, capO.vert);
    // частота всегда из файлов: в профиле она может быть устаревшей
    out.fps = fpsOf(pl);
    return out;
  }
  // Состояние файла — сравнение с ячейкой матрицы. Конвертация приводит разрешение,
  // частоту, битрейт, кодеки и звук. Не лечится только два случая: частота кадров вне
  // 24…60 и файл меньше цели — вверх не масштабируем.
  // Файл, который не стримить ни при какой цели: частота вне 24…60. В очередь он не
  // попадает — ни из пикера, ни папкой (решение 02.09); в медиатеке остаётся.
  function fileUnfit(f) {
    if (!f || !f.q || !f.q.fps) return "";
    if (f.q.fps < FPS_MIN || f.q.fps > FPS_MAX) {
      return fpsNorm(f.q.fps) + " fps is outside the 24–60 range — this file can’t be streamed.";
    }
    return "";
  }
  function fileState(f, prof) {
    if (!f) return "missing";
    if (f.state === "missing") return "missing";
    if (f.state === "uploading") return "uploading";
    if (f.state === "processing") return "processing";
    if (f.state === "failed") return "broken";
    if (f.state === "converting") return "converting";
    if (f.state === "convfail") return "convfail";
    if (!f.q) return "processing";
    if (f.q.fps < FPS_MIN || f.q.fps > FPS_MAX) return "cant";
    var rng = rateRangeFor(prof.row || resRow(prof.h, prof.w), fpsCol(prof.fps), prof.vert);
    if (!rng) return "cant";
    var frow = resRow(f.q.h, f.q.w), trow = prof.row || resRow(prof.h, prof.w);
    // вверх не масштабируем: файл меньше цели починить нечем
    if (frow < trow) return "cant";
    if (f.q.h !== prof.h || f.q.w !== prof.w) return "needconv";
    if (fpsNorm(f.q.fps) !== fpsNorm(prof.fps)) return "needconv";
    // битрейт выше нормы срезается конвертацией; ниже — поднять нельзя, файл идёт как есть
    var mbps = fileMbps(f);
    if (mbps && mbps > rng[1]) return "needconv";
    // кодеки и звук конвертер приводит сам — это повод конвертировать, а не блокер
    if (f.q.vcodec !== prof.vcodec || String(f.q.acodec) !== String(prof.acodec) ||
        f.q.ac !== prof.ac || f.q.ar !== prof.ar || !!f.q.audio !== !!prof.audio) return "needconv";
    return "ready";
  }
  // Агрегат по включённым файлам. Приоритет: Conversion failed > Converting > File missing >
  // Can't be aligned > Needs conversion. Показываем одно самое важное состояние.
  // файл, которого нет в медиатеке или чья загрузка сорвалась, в наборе не участвует:
  // «File missing» не показывается нигде, «Upload failed» живёт только в медиатеке
  function inSet(i) {
    if (i.off) return false;
    var f = file(i.fileId);
    return !!f && f.state !== "missing" && f.state !== "failed";
  }
  function readiness(pl) {
    if (!pl) return { state: "none", label: "Empty", text: T.readyNone, files: [] };
    var prof = profileOf(pl);
    var items = pl.items.filter(inSet);   // выключенные и недоступные не считаются
    if (!items.length) return { state: "none", label: "Empty", text: T.readyNone, files: [] };
    var by = { missing: [], processing: [], broken: [], uploading: [], converting: [], convfail: [], cant: [], needconv: [], ready: [] };
    items.forEach(function (i) {
      var f = file(i.fileId);
      by[fileState(f, prof)].push(f || { id: i.fileId });
    });
    var n = items.length;
    function ids(a) { return a.map(function (f) { return f.id; }); }
    // приоритет Э10: сначала то, что человек обязан починить руками
    if (by.convfail.length) {
      return { state: "convfail", label: "Conversion failed",
        text: "Conversion failed for " + UI.plural(by.convfail.length, "file", "files") + " — try again or change the files.",
        files: ids(by.convfail) };
    }
    if (by.uploading.length) {
      return { state: "uploading", label: "Uploading · " + by.uploading.length + " of " + n,
        text: UI.plural(by.uploading.length, "file is", "files are") + " still uploading.",
        files: ids(by.uploading) };
    }
    if (by.converting.length) {
      return { state: "busy", label: "Converting · " + by.converting.length + " of " + n,
        text: "Conversion is running. " + by.converting.length + " of " + n + " files left.",
        files: ids(by.converting) };
    }
    if (by.cant.length) {
      return { state: "cant", label: "Can’t be aligned · " + UI.plural(by.cant.length, "file", "files"),
        text: "The queue isn’t ready. " + UI.plural(by.cant.length, "file can’t", "files can’t") + " be aligned.",
        files: ids(by.cant) };
    }
    if (by.processing.length) {
      return { state: "processing", label: "Processing · " + UI.plural(by.processing.length, "file", "files"),
        text: "Metadata is still being read for " + UI.plural(by.processing.length, "file", "files") + ".",
        files: ids(by.processing) };
    }
    if (by.needconv.length) {
      return { state: "convert", label: "Needs conversion · " + by.needconv.length + " of " + n,
        text: UI.plural(by.needconv.length, "file needs", "files need") +
          " conversion — it runs automatically before the stream goes live.",
        files: ids(by.needconv) };
    }
    return { state: "ready", label: "Ready",
      text: n === 1 ? "Ready — the file matches the stream profile." : "Ready — all " + n + " files match the stream profile.",
      files: [] };
  }

  // Конвертация запускается сама сразу после создания. Оценка прототипа — примерно
  // треть длительности файлов, но не меньше двух минут: пока она идёт, эфира нет.
  function convEta(pl) {
    var prof = profileOf(pl), sec = 0, n = 0;
    ((pl && pl.items) || []).forEach(function (i) {
      if (i.off) return;
      var f = file(i.fileId);
      if (fileState(f, prof) !== "needconv") return;
      n++;
      sec += (f && f.sec) || 0;
    });
    if (!n) return null;
    var min = Math.max(2, Math.ceil(sec * 0.35 / 60));
    return { files: n, min: min, readyAt: new Date(nowMs() + min * 60000).toISOString() };
  }
  function convEtaText(eta) {
    return UI.plural(eta.files, "file needs", "files need") + " conversion — about " +
      UI.plural(eta.min, "minute", "minutes") + ".";
  }
  // «раньше 15:02» внутри того же дня, иначе с датой — чтобы граница читалась однозначно
  function convEtaAt(eta, sameDayIso) {
    var sameDay = sameDayIso && UI.dayFull(sameDayIso, FORM.tz) === UI.dayFull(eta.readyAt, FORM.tz);
    return (sameDay ? "" : UI.dayFull(eta.readyAt, FORM.tz) + " ") + UI.time(eta.readyAt, FORM.tz);
  }
  function plStats(pl) {
    var all = (pl && pl.items) || [];
    var on = all.filter(inSet);
    var sec = 0, bytes = 0, missing = 0;
    on.forEach(function (i) {
      var f = file(i.fileId);
      if (!f) return;
      if (f.state === "missing") { missing++; return; }
      sec += f.sec; bytes += f.bytes;
    });
    return { count: on.length, total: all.length,
      off: all.filter(function (i) { return i.off; }).length,
      // файлы, которых в наборе нет: их состояния мы не показываем (Э10)
      gone: all.filter(function (i) { return !i.off && !inSet(i); }).length,
      sec: sec, bytes: bytes, missing: missing };
  }

  // ============================================================ стоимость
  function rateStr() { return F.account.customRate ? "Custom rate" : "$" + F.account.hourRate + " / hour"; }
  function rateNum(s) { return F.account.hourRate * (s && s.backup ? 2 : 1); }

  function cost(s) {
    var a = acc(), r = rateNum(s);
    var slot = nextSlot(s);
    var windowH = slot ? (Date.parse(slot.end) - Date.parse(slot.start)) / 3600e3 : 0;
    var balHours = a.kind === "hours" ? a.creditHours : (r > 0 ? a.balance / r : 0);
    // сколько на самом деле будет идти вещание: без цикла — один проход, с лимитом циклов —
    // столько проходов; окно только ограничивает сверху, а платить за простой не за что
    var contentSec = plStats(content(s) || null).sec;
    var loops = s && s.playback && s.playback.loop ? (s.loopLimit > 0 ? s.loopLimit : 0) : 1;
    var billH = windowH;
    if (contentSec && loops > 0) billH = Math.min(windowH, contentSec * loops / 3600);
    return {
      rate: r, rateStr: F.account.customRate ? "Custom rate" : "$" + (F.account.hourRate * (s && s.backup ? 2 : 1)) + " / hour",
      perDay: r * 24, windowH: windowH, billH: billH, windowCost: billH * r,
      balHours: balHours, notEnough: billH > 0 && balHours < billH, account: a
    };
  }

  // ============================================================ расписание
  var REP = { none: "", daily: "Daily", weekdays: "Weekdays", weekly: "Weekly", custom: "Custom" };
  function repLabel(sl) {
    if (!sl || !sl.repeat || sl.repeat.type === "none") return "";
    var t = REP[sl.repeat.type] || "";
    if (sl.repeat.type === "weekly" && sl.repeat.days) t += " · " + sl.repeat.days.join(", ");
    return t;
  }
  // ближайший будущий слот; для идущего эфира — текущий
  function nextSlot(s) {
    if (!s || !s.schedules || !s.schedules.length) return null;
    var n = nowMs();
    var future = s.schedules.filter(function (sl) { return Date.parse(sl.end) > n; })
      .sort(function (a, b) { return Date.parse(a.start) - Date.parse(b.start); });
    return future[0] || s.schedules[s.schedules.length - 1];
  }
  // следующие три запуска правила повтора — текстом, чтобы правило было проверяемым
  function next3(sl) {
    if (!sl) return [];
    var out = [], start = Date.parse(sl.start), step = 24 * 3600e3;
    if (!sl.repeat || sl.repeat.type === "none") return [sl.start];
    if (sl.repeat.type === "weekly") step = 7 * 24 * 3600e3;
    var t = start;
    while (out.length < 3) {
      if (t >= nowMs() - 3600e3) {
        var d = new Date(t), wd = d.getUTCDay();
        if (sl.repeat.type !== "weekdays" || (wd >= 1 && wd <= 5)) out.push(new Date(t).toISOString());
      }
      t += step;
      if (t > start + 60 * 24 * 3600e3) break;   // горизонт планирования
    }
    return out;
  }
  // Каналу параллельные эфиры не мешают: YouTube ведёт несколько трансляций на одном
  // канале одновременно, у каждой свой ключ. Единственный конфликт — стрим с самим собой:
  // два его окна не могут идти в одно время (решение 02.09).
  function slotFits(s, cand) { return !channelBusy(s, cand); }
  var T_SELF_OVERLAP = "Two windows of this stream overlap — a stream can’t run twice at once.";
  // пересекается ли это окно с другими окнами того же стрима
  function slotHitsOwn(list, sl) {
    return (list || []).some(function (x) {
      return x.id !== sl.id && Date.parse(x.start) < Date.parse(sl.end) && Date.parse(sl.start) < Date.parse(x.end);
    });
  }
  // окна одного стрима не могут пересекаться: играет всегда один прогон
  function slotsOverlap(list) {
    var a = (list || []).map(function (sl) { return [Date.parse(sl.start), Date.parse(sl.end)]; })
      .sort(function (x, y) { return x[0] - y[0]; });
    for (var i = 1; i < a.length; i++) if (a[i][0] < a[i - 1][1]) return true;
    return false;
  }
  // горизонт планирования обещан подписью под «Add slot» — значит, он и проверяется
  function slotBeyondHorizon(list) {
    var days = F.account.horizonDays || 0;
    if (!days) return "";
    var limit = nowMs() + days * 24 * 3600e3;
    for (var i = 0; i < (list || []).length; i++) {
      if (Date.parse(list[i].start) > limit) return "Windows can be scheduled up to " + days + " days ahead.";
    }
    return "";
  }
  // Один стрим-ключ несёт один поток: два стрима с одним ключом не могут идти одновременно —
  // YouTube второй поток на тот же ingest не примет. Каналу при этом параллельные эфиры не мешают.
  function T_KEY_BUSY(name) { return "“" + name + "” streams on this key at that time — one key carries one stream."; }
  function keyClash(s, cand) {
    var key = s && s.dest && s.dest.mode === "manual" ? String(s.dest.key || "").trim() : "";
    if (!key) return null;
    for (var i = 0; i < S.streams.length; i++) {
      var o = S.streams[i];
      if (o.id === s.id || o.status === "draft" || !o.dest || o.dest.mode !== "manual") continue;
      if (String(o.dest.key || "").trim() !== key) continue;
      // эфир без окна держит ключ до остановки
      if (running(o.status) && !(o.schedules || []).length) return { msg: T_KEY_BUSY(o.name), liveId: o.id };
      if (slotHitsOwn(o.schedules || [], Object.assign({}, cand, { id: "__cand" }))) return { msg: T_KEY_BUSY(o.name), liveId: running(o.status) ? o.id : null };
    }
    return null;
  }
  // единая проверка на все входы (форма, модалка окна, перенос в календаре):
  // окно сравнивается с другими окнами того же стрима и с окнами стримов на том же ключе
  function channelBusy(s, cand) {
    if (slotHitsOwn((s && s.schedules) || [], cand)) return { msg: T_SELF_OVERLAP };
    return keyClash(s, cand);
  }

  // ============================================================ матрица доступности (Э9)
  // Доступность действий — матрица Э9 от 26.08, недоступное видно и заблокировано (ADR-0002).
  // Матрица Э9. Тройка конвертации ведёт себя как Ready to start с двумя отличиями:
  // Start заблокирован причиной из Э10, а в Converting заблокирована и правка контента.
  var M = {
    // Start при needconv/converting разрешён: конвертация автоматическая, запуск сначала
    // готовит файлы и затем выводит в эфир. Блокирует только сорванная конвертация
    // и файл, который не выровнять (cant). starting — Redis-лок запуска: всё заблокировано.
    // draft — недособранный мастер: открыть и дособрать или удалить, остальное не имеет смысла
    start:      { ready: 1, scheduled: 1, preparing: 0, starting: 0, live: 0, stopping: 0, stopped: 0, archived: 0, needconv: 1, converting: 1, convfail: "conv", cant: "conv", draft: 0 },
    stop:       { ready: 0, scheduled: 0, preparing: 1, starting: 0, live: 1, stopping: 0, stopped: 0, archived: 0, needconv: 0, converting: 0, convfail: 0, cant: 0, draft: 0 },
    edit:       { ready: 1, scheduled: 1, preparing: 0, starting: 0, live: 0, stopping: 0, stopped: 1, archived: 0, needconv: 1, converting: 0, convfail: 1, cant: 1, draft: 1 },
    duplicate:  { ready: 1, scheduled: 1, preparing: 1, starting: 0, live: 1, stopping: 1, stopped: 1, archived: 1, needconv: 1, converting: 1, convfail: 1, cant: 1, draft: 0 },
    startAgain: { ready: 0, scheduled: 0, preparing: 0, starting: 0, live: 0, stopping: 0, stopped: 1, archived: 1, needconv: 0, converting: 0, convfail: 0, cant: 0, draft: 0 },
    archive:    { ready: 1, scheduled: 1, preparing: 1, starting: 0, live: 0, stopping: 0, stopped: 1, archived: 0, needconv: 1, converting: 1, convfail: 1, cant: 1, draft: 0 },
    analytics:  { ready: 0, scheduled: 0, preparing: 0, starting: 0, live: 1, stopping: 1, stopped: 1, archived: 1, needconv: 0, converting: 0, convfail: 0, cant: 0, draft: 0 },
    del:        { ready: 1, scheduled: 1, preparing: 1, starting: 0, live: 0, stopping: 0, stopped: 1, archived: 1, needconv: 1, converting: 1, convfail: 1, cant: 1, draft: 1 }
  };
  // стрим фактически поднят: во время ретраев и остановки он всё ещё live
  function running(st) { return st === "live"; }
  // почему действие недоступно — ровно одна формулировка на смысл
  function why(action, s) {
    if (inAction(s)) return T.inProgress;      // лок держится — не срабатывает ничто
    var k = stKey(s), v = (M[action] || {})[k];
    if (v === 1) return "";
    if (v === "playlist") return T.liveEditPlaylist;
    if (v === "conv" && action === "start") return readiness(content(s)).text || T.needVideo;
    if (k === "draft") return action === "start" ? T.draftStart : T.draftOnly;
    if (action === "start") return k === "preparing" || k === "starting" ? T.alreadyPreparing
      : k === "live" ? T.alreadyRunning : T.afterStop;
    if (action === "stop") return T.notLive;
    if (action === "startAgain") return T.afterStop;
    if (action === "archive") return k === "archived" ? "Already archived." : T.stopBeforeArchive;
    if (action === "analytics") return T.noAirYet;
    if (action === "edit") return k === "archived" ? T.archivedRO
      : k === "converting" ? "Conversion is running — the content is locked." : T.liveEditPlaylist;
    if (action === "del") return T.stopBeforeDelete;
    return "";
  }
  // что мешает именно запуску: состав, канал, баланс
  function startBlock(s) {
    var a = acc();
    if (a.kind === "money" && a.balance <= 0) return { reason: T.balanceEmpty, act: T.topUp };
    if (!s.channelId && s.dest.mode === "connected") return { reason: T.needChannel };
    var r = readiness(content(s));
    if (r.state === "none") return { reason: T.readyNone };
    // конвертация автоматическая: needconv и busy запуску не мешают — он с неё начинается
    if (r.state !== "ready" && r.state !== "convert" && r.state !== "busy") return { reason: r.text };
    return null;
  }

  // ============================================================ действия
  function ev(type, text, extra) {
    return Object.assign({ at: new Date(nowMs()).toISOString(), type: type, text: text }, extra || {});
  }
  function runOf(s) { return (s.runs && s.runs[0]) || null; }

  function doStart(s) {
    var b = startBlock(s);
    if (b) { UI.toast(b.reason); return; }
    var rd0 = readiness(content(s));
    if (rd0.state === "convert" || rd0.state === "busy") {
      // запуск начинается с конвертации: файлы уходят в очередь воркера, стрим — в подготовку
      var pl0 = content(s), prof0 = profileOf(pl0), n0 = 0;
      ((pl0 && pl0.items) || []).forEach(function (i) {
        var f = file(i.fileId);
        if (!i.off && f && fileState(f, prof0) === "needconv") { f.state = "converting"; f.progress = 10 + (n0 * 25) % 60; n0++; }
      });
      var etaS = convEta(pl0);
      s.status = "processing"; s.virtual_status = null;
      s.runs = s.runs || [];
      s.runs.unshift({ id: s.id + "-r" + (s.runs.length + 1), index: s.runs.length + 1,
        start: null, end: null, spent: 0,
        events: [ev("conversion_decided", "Converting " + UI.plural(Math.max(n0, rd0.files.length), "file", "files") +
          " — the stream goes live when conversion finishes", { author: "You" })] });
      save(); render();
      UI.toast("Conversion started — “" + s.name + "” goes live in about " +
        UI.plural(etaS ? etaS.min : 2, "minute", "minutes") + ".");
      return;
    }
    s.status = "live";
    s.virtual_status = null;
    s.runs = s.runs || [];
    s.runs.unshift({ id: s.id + "-r" + (s.runs.length + 1), index: s.runs.length + 1,
      start: new Date(nowMs()).toISOString(), end: null, spent: 0, events: [ev("live", "Went live")] });
    save(); render();
    UI.toast("“" + s.name + "” is live.");
  }
  function doStop(s, cancelSchedule) {
    s.status = "stopped";
    s.virtual_status = null;
    s.stopReason = "you";
    var r = runOf(s);
    if (r) { r.end = new Date(nowMs()).toISOString(); r.events.unshift(ev("stopped", "Stopped by You", { author: "You" })); }
    if (cancelSchedule) s.schedules = [];
    s.onAir = null;
    save(); render();
    UI.toast("“" + s.name + "” stopped.");
  }
  // Start again: переходов из stopped в бэкенде нет — создаётся НОВЫЙ стрим с теми же
  // настройками, старый остаётся в истории (Э9, диалог 1)
  function doStartAgain(s) {
    var copy = clone(s);
    copy.id = "s" + Date.now();
    copy.status = "live";
    copy.virtual_status = null;
    copy.stopReason = null;
    copy.schedules = [];
    copy.onAir = null;
    copy.spentTotal = 0;
    copy.metrics = {};
    copy.viewers = 0;
    copy.runs = [{ id: copy.id + "-r1", index: 1, start: new Date(nowMs()).toISOString(),
      end: null, spent: 0, events: [ev("created", "Created", { author: "You" }), ev("live", "Went live")] }];
    S.streams.unshift(copy);
    save();
    UI.toast("“" + copy.name + "” started as a new stream — the old one stays in history.");
    location.href = "live-stream.html?id=" + encodeURIComponent(copy.id);
  }
  function doArchive(s) {
    s.status = "archived";
    s.virtual_status = null;
    var r = runOf(s);
    if (r) r.events.unshift(ev("archived", "Archived", { author: "You" }));
    save(); render();
    UI.toast("“" + s.name + "” archived — find it with the Archived filter.");
  }
  function doDelete(s) {
    S.streams = S.streams.filter(function (x) { return x.id !== s.id; });
    save();
    UI.toast("“" + s.name + "” deleted.");
    if (PAGE === "stream") { location.href = "live-streams.html"; return; }
    render();
  }
  function doDuplicate(s, opts) {
    var copy = clone(s);
    copy.id = "s" + Date.now();
    copy.name = opts.name || (s.name + " (copy)");
    copy.channelId = null;
    copy.dest = { mode: "connected" };
    copy.status = "created";
    copy.virtual_status = opts.schedule && (s.schedules || []).length ? "scheduled" : null;
    copy.stopReason = null;
    copy.onAir = null;
    copy.runs = [{ id: copy.id + "-r1", index: 1, start: null, end: null, spent: 0,
      events: [ev("created", "Created", { author: "You" })] }];
    copy.spentTotal = 0;
    copy.metrics = {};
    if (!opts.playlist) copy.playlistId = null;
    if (!opts.schedule) copy.schedules = [];
    if (!opts.playback) copy.playback = { loop: true, shuffle: false };
    S.streams.unshift(copy);
    save(); render();
    UI.toast("“" + copy.name + "” created — ready to start.");
  }
  function doAddSlot(s) {
    var start = nowMs() + 24 * 3600e3, end = start + 2 * 3600e3;
    s.schedules = s.schedules || [];
    s.schedules.push({ id: "sl" + Date.now(), start: new Date(start).toISOString(), end: new Date(end).toISOString(),
      tz: TZ, repeat: { type: "none" } });
    if (["created", "ready", "processing", "downloading"].indexOf(s.status) !== -1) s.virtual_status = "scheduled";
    save(); render();
    UI.toast("Slot added — starts " + UI.dt(new Date(start).toISOString(), TZ) + " (" + TZL + ").");
  }

  // ---- модалка окна расписания (Э3)
  // FORM здесь — временный контекст: те же поля читают dtField, колесо времени и селекты,
  // поэтому правила «не раньше конца конвертации» и «канал занят» работают без копий.
  var SLOT_M = null;
  function slotModal(streamId, slotId) {
    var s = stream(streamId);
    if (!s) return;
    var src = (s.schedules || []).filter(function (x) { return x.id === slotId; })[0];
    // как в мастере: следующий день после последнего окна, длина — один проход очереди
    var start = nextSlotStart(s.schedules, TZ);
    var passSec = plStats(content(s)).sec;
    var lenMs = (passSec ? Math.ceil(passSec / 60) * 60 : 2 * 3600) * 1000;
    var sl = src ? clone(src) : { id: "sl" + Date.now(), start: new Date(start).toISOString(),
      end: new Date(start + lenMs).toISOString(), tz: TZ, repeat: { type: "none" } };
    sl.endSet = true;                       // окно правит человек, пересчёт его не двигает
    SLOT_M = { streamId: streamId, slotId: src ? slotId : null };
    FORM = {
      id: s.id, modal: true, name: s.name, channelId: s.channelId,
      destMode: s.dest.mode, key: s.dest.key || "", link: s.dest.link || "",
      queue: s.queue ? clone(s.queue) : (content(s) ? clone(content(s).items) : []),
      srcPl: s.queue ? (s.srcPl || null) : (s.playlistId || null), detached: s.queue ? !!s.detached : false,
      cover: null, ytThumb: !!s.ytThumb, desc: s.desc || "",
      loop: s.playback.loop, shuffle: s.playback.shuffle, loopLimit: s.loopLimit || 0,
      res: s.res || resCap({ items: s.queue || [] }).row || null,
      startMode: "schedule", schedules: [sl], backup: !!s.backup, tz: TZ, editStatus: s.status
    };
    slotModalRender();
  }
  function slotModalBody() {
    var sl = FORM.schedules[0], ps = formPseudo();
    var s0m = stream(SLOT_M.streamId);
    var busy = channelBusy({ id: SLOT_M.streamId, dest: s0m && s0m.dest,
      schedules: ((s0m && s0m.schedules) || []).filter(function (x) { return x.id !== sl.id; }) }, sl);
    var eta = convEta(formQueuePl());
    return '<div class="lv-slotm">' +
      '<div class="lv-slotm__grid">' +
        field("Starts", dtField(sl, "start", ps)) +
        field("Ends", dtField(sl, "end", ps)) +
        field("Time zone", '<div class="lv-ftz">' +
          selTrig("tz", UI.selectValue({ label: tzOffLabel(FORM.tz) }), { label: "Time zone" }) + "</div>") +
        field("Repeat", '<div class="lv-frep">' + selTrig("slotRep",
          UI.selectValue(optByValue(REP_OPTS, (sl.repeat && sl.repeat.type) || "none")),
          { label: "Repeat" }, sl.id) + "</div>") +
      "</div>" +
      (formEndWhy() ? '<span class="an-hint">' + UI.esc(formEndWhy() + " " + formEndFree()) + "</span>" : "") +
      (eta ? '<div class="lv-busyline">' + (IC.attention || "") +
        '<span class="an-hint an-hint--warn">' + UI.esc(convEtaText(eta) +
          " The window can’t start before " + convEtaAt(eta, sl.start) + ".") + "</span></div>" : "") +
      (busy ? '<div class="lv-busyline">' + (IC.attention || "") +
        '<span class="an-hint an-hint--warn">' + UI.esc(busy.msg) + "</span>" +
        (busy.liveId ? '<a class="lv-link" href="live-stream.html?id=' + encodeURIComponent(busy.liveId) + '">Open the stream</a>' : "") +
        "</div>" : "") +
      '<div class="lv-form__row"><label class="lv-pick__only"><span>Back-to-back</span>' +
        UI.switchHtml('data-lv-slot="' + sl.id + ':b2b"', !!(sl.backToBack && sl.backToBack.on), "Back-to-back") + "</label>" +
        (sl.backToBack && sl.backToBack.on
          ? '<span class="an-hint">Restarts after ' +
            '<input class="an-input an-input--mini" type="number" min="0" value="' + (sl.backToBack.pauseMin || 0) +
              '" data-lv-slot="' + sl.id + ':pause" /> min, ' +
            '<input class="an-input an-input--mini" type="number" min="1" value="' + (sl.backToBack.maxCycles || 1) +
              '" data-lv-slot="' + sl.id + ':cycles" /> cycles max</span>'
          : "") +
      "</div></div>";
  }
  function slotModalGate() {
    var sl = FORM.schedules[0], ps = formPseudo();
    var s0 = stream(SLOT_M.streamId);
    // окна одного стрима не пересекаются: сравниваем с остальными окнами этого же стрима
    var others = ((s0 && s0.schedules) || []).filter(function (x) { return x.id !== sl.id; });
    if (slotsOverlap(others.concat([sl]))) return T_SELF_OVERLAP;
    var horizon = slotBeyondHorizon([sl]);
    if (horizon) return horizon;
    var kb2 = keyClash({ id: SLOT_M.streamId, dest: s0 && s0.dest }, sl);
    if (kb2) return kb2.msg;
    var eta = convEta(formQueuePl());
    if (eta && Date.parse(sl.start) < Date.parse(eta.readyAt)) {
      return "Conversion needs about " + UI.plural(eta.min, "minute", "minutes") +
        " — move the window to " + convEtaAt(eta, sl.start) + " or later.";
    }
    return "";
  }
  function slotModalRender() {
    var gate = slotModalGate();
    var m = modalShell("lvSlotM", SLOT_M.slotId ? "Edit slot" : "Add slot", slotModalBody(),
      btn("Cancel", "secondary", "data-lv-close data-lv-focus") +
      '<button class="an-btn an-btn--primary an-btn--small' + (gate ? " is-off" : "") +
        '" type="button" data-lv-slotmsave' + (gate ? ' aria-disabled="true" data-tip="' + UI.esc(gate) + '"' : "") + ">" +
        (SLOT_M.slotId ? "Save slot" : "Add slot") + "</button>");
    [].forEach.call(m.querySelectorAll("[data-lv-close]"), function (b) {
      b.addEventListener("click", function () { FORM = null; SLOT_M = null; });
    });
  }
  function slotModalSave() {
    if (slotModalGate() || !SLOT_M) return;
    var s = stream(SLOT_M.streamId), sl = clone(FORM.schedules[0]);
    s.schedules = s.schedules || [];
    if (SLOT_M.slotId) {
      s.schedules = s.schedules.map(function (x) { return x.id === SLOT_M.slotId ? sl : x; });
    } else {
      s.schedules.push(sl);
    }
    if (["created", "ready", "processing", "downloading"].indexOf(s.status) !== -1) s.virtual_status = "scheduled";
    var added = !SLOT_M.slotId;
    FORM = null; SLOT_M = null;
    save(); UI.closeModals(); render();
    UI.toast(added ? "Slot added — starts " + UI.dt(sl.start, TZ) + " (" + TZL + ")." : "Slot updated.");
  }

  // ============================================================ модалки (Э9)
  function modalShell(id, title, bodyHtml, footHtml, cls) {
    var m = document.getElementById(id);
    if (!m) {
      m = document.createElement("div");
      m.className = "an-modal";
      m.id = id;
      document.body.appendChild(m);
    }
    m.innerHTML = '<div class="an-modal__overlay" data-lv-close></div>' +
      '<div class="an-modal__dialog' + (cls || "") + '" role="dialog" aria-modal="true" aria-label="' + UI.esc(title) + '">' +
        '<div class="an-modal__head"><h3 class="an-modal__title">' + UI.esc(title) + '</h3>' +
        '<button class="an-modal__x" type="button" data-lv-close aria-label="Close">' + (IC.close || "×") + "</button></div>" +
        '<div class="an-modal__body">' + bodyHtml + "</div>" +
        '<div class="an-modal__foot">' + footHtml + "</div>" +
      "</div>";
    return UI.openModal(m);
  }
  // icon — иконка слева от подписи, size — «small» по умолчанию либо «tiny»
  function btn(label, mode, attrs, icon, size) {
    return '<button class="an-btn an-btn--' + mode + " an-btn--" + (size || "small") + '" type="button" ' +
      (attrs || "") + ">" + (icon || "") + UI.esc(label) + "</button>";
  }

  // 1 · Restart stream
  function askStartAgain(s) {
    var c = cost(s), pl = content(s), ch = chan(s.channelId);
    var body = '<p class="an-modal__text">A new stream is created with the same settings — this one stays in history.</p>' +
      '<div class="lv-kv">' +
        kv("Content", pl ? UI.esc(pl.name) : "—") +
        kv("Channel", ch ? UI.esc(ch.name) : "Manual stream key") +
        kv("Price", c.rateStr) +
        kv("Forecast", "≈" + UI.money(c.perDay) + " / day") +
      "</div>" +
      (s.dest.mode === "manual"
        ? '<p class="an-modal__text">YouTube may have rotated your stream key. If the stream fails, update the key and try again.</p>' : "");
    var m = modalShell("lvAgain", "Start this stream again?", body,
      btn("Cancel", "secondary", 'data-lv-close data-lv-focus') + btn("Start again", "primary", 'data-lv-do="again"'));
    m.querySelector('[data-lv-do="again"]').onclick = function () { UI.closeModals(); doStartAgain(s); };
  }
  function askArchive(s) {
    var body = '<p class="an-modal__text">The stream leaves the list and stays available under the ' +
      "<b>Archived</b> filter. There is no way back from the archive yet.</p>";
    var m = modalShell("lvArch", "Archive this stream?", body,
      btn("Cancel", "secondary", 'data-lv-close data-lv-focus') + btn("Archive", "primary", 'data-lv-do="arch"'));
    m.querySelector('[data-lv-do="arch"]').onclick = function () { UI.closeModals(); doArchive(s); };
  }
  // 2 · Duplicate stream
  function askDuplicate(s) {
    var body = '<label class="lv-pop__t" for="lvDupName">Stream name</label>' +
      '<input class="an-input" id="lvDupName" type="text" value="' + UI.esc(s.name + " (copy)") + '" />' +
      '<label class="lv-pop__t">Channel</label>' +
      selTrig("dupChan", UI.selectValue(null, "Select channel"), { label: "Channel" }) +
      '<div class="lv-kv" style="margin-top:12px">' +
        swRow("dup-playlist", "Copy playlist", true) +
        swRow("dup-schedule", "Copy schedule", false) +
        swRow("dup-playback", "Copy playback settings", true) +
      "</div>" +
      '<p class="an-modal__text">The copy starts as a draft and is not launched.</p>';
    var m = modalShell("lvDup", "Duplicate stream", body,
      btn("Cancel", "secondary", 'data-lv-close data-lv-focus') + btn("Duplicate", "primary", 'data-lv-do="dup"'));
    m.querySelector('[data-lv-do="dup"]').onclick = function () {
      var name = m.querySelector("#lvDupName").value.trim() || (s.name + " (copy)");
      void DUP_CHAN;                       // канал копии выбирают уже в самой копии
      var on = function (k) { var el = m.querySelector('[data-lv-sw="' + k + '"]'); return !el || el.getAttribute("aria-checked") === "true"; };
      UI.closeModals();
      doDuplicate(s, { name: name, playlist: on("dup-playlist"), schedule: on("dup-schedule"), playback: on("dup-playback") });
    };
  }
  // 3 · Stop stream
  function askStop(s) {
    var r = runOf(s);
    var onAirSec = r && r.start ? (nowMs() - Date.parse(r.start)) / 1000 : 0;
    var future = (s.schedules || []).filter(function (sl) { return Date.parse(sl.start) > nowMs(); });
    var body = '<p class="an-modal__text">YouTube will end the broadcast and viewers will lose it.</p>' +
      '<div class="lv-kv">' +
        kv("On air", UI.durHuman(onAirSec)) +
        kv("Spent this run", UI.money(r ? r.spent : 0)) +
      "</div>" +
      (future.length
        ? '<div class="lv-kv" style="margin-top:12px">' +
          '<label class="lv-radio is-active"><input type="radio" name="lvStopMode" value="run" checked />' +
            '<span>Stop this run<span class="lv-radio__d">' + UI.plural(future.length, "upcoming run stays", "upcoming runs stay") + ' scheduled.</span></span></label>' +
          '<label class="lv-radio"><input type="radio" name="lvStopMode" value="all" />' +
            '<span>Stop and cancel schedule<span class="lv-radio__d">All upcoming runs are removed.</span></span></label>' +
          "</div>"
        : "");
    var m = modalShell("lvStop", "Stop this stream?", body,
      btn("Cancel", "secondary", 'data-lv-close data-lv-focus') + btn("Stop", "danger", 'data-lv-do="stop"'));
    m.querySelector('[data-lv-do="stop"]').onclick = function () {
      var mode = m.querySelector('input[name="lvStopMode"]:checked');
      UI.closeModals();
      doStop(s, mode && mode.value === "all");
    };
  }
  // 7 · Delete stream
  function askDelete(s) {
    var future = (s.schedules || []).filter(function (sl) { return Date.parse(sl.start) > nowMs(); });
    var body = '<p class="an-modal__text">The run history and the event log will be deleted. The playlist and the files stay.</p>' +
      (future.length ? '<p class="an-modal__text">' + UI.plural(future.length, "upcoming run", "upcoming runs") + " will be canceled.</p>" : "");
    var m = modalShell("lvDel", "Delete this stream?", body,
      btn("Cancel", "secondary", 'data-lv-close data-lv-focus') + btn("Delete", "danger", 'data-lv-do="del"'));
    m.querySelector('[data-lv-do="del"]').onclick = function () { UI.closeModals(); doDelete(s); };
  }
  function kv(k, v) { return '<div class="lv-kv__r"><span class="lv-kv__k">' + k + '</span><span class="lv-kv__v">' + v + "</span></div>"; }
  function swRow(key, label, on) {
    return '<div class="lv-kv__r"><span class="lv-kv__k">' + UI.esc(label) + "</span>" +
      UI.switchHtml('data-lv-sw="' + key + '"', on, label) + "</div>";
  }

  // ============================================================ меню действий
  // На карточке стрима основные действия уже стоят кнопками, поэтому в меню остаётся
  // только то, чего в строке нет: аналитика, YouTube, ключ и удаление
  // в карточке кнопкой стоит только основное действие, его и убираем из меню
  function detailPrimaryLabel(s) {
    var k = stKey(s);
    if (k === "live" || k === "preparing" || k === "stopping") return "Stop";
    if (k === "stopped" || k === "archived") return "Start again";
    return "Start";
  }
  // Ближайшие по смыслу действия выносятся из «⋮» в строку: берём первые два
  // доступных в текущем состоянии, недоступные не показываем — им место в меню
  // с причиной блокировки (ADR-0002).
  var QUICK = [
    { key: "edit", label: "Edit", act: "edit", icon: "edit", m: "edit" },
    { key: "again", label: "Start again", act: "again", icon: "restart", m: "startAgain" },
    { key: "duplicate", label: "Duplicate", act: "duplicate", icon: "copy", m: "duplicate" },
    { key: "archive", label: "Archive", act: "archive", icon: "save", m: "archive" }
  ];
  function detailQuick(s, primaryLabel) {
    var out = [];
    QUICK.forEach(function (q) {
      if (out.length === 2 || q.label === primaryLabel || why(q.m, s)) return;
      out.push(q);
    });
    return out;
  }
  // Ближайшие по смыслу действия выносятся из «⋮» в строку: берём первые два
  // доступных в текущем состоянии, недоступные не показываем — им место в меню
  // с причиной блокировки (ADR-0002).
  var QUICK = [
    { key: "edit", label: "Edit", act: "edit", icon: "edit", m: "edit" },
    { key: "again", label: "Start again", act: "again", icon: "restart", m: "startAgain" },
    { key: "duplicate", label: "Duplicate", act: "duplicate", icon: "copy", m: "duplicate" },
    { key: "archive", label: "Archive", act: "archive", icon: "save", m: "archive" }
  ];
  function detailQuick(s, primaryLabel) {
    var out = [];
    QUICK.forEach(function (q) {
      if (out.length === 2 || q.label === primaryLabel || why(q.m, s)) return;
      out.push(q);
    });
    return out;
  }
  function menuFor(s, anchor, inDetail) {
    var b = startBlock(s);
    var primaryOff = why("start", s) || (b ? b.reason : "");
    var items = [
      { label: "Open", icon: IC.external, onClick: function () { location.href = streamHref(s); } },
      { label: running(s.status) ? "Stop" : "Start",
        icon: running(s.status) ? IC.stop : IC.play,
        off: running(s.status) ? !!why("stop", s) : !!primaryOff,
        reason: running(s.status) ? why("stop", s) : primaryOff,
        act: b && b.act ? b.act : null,
        onClick: function () { running(s.status) ? askStop(s) : doStart(s); } },
      { label: "Edit", icon: IC.edit, off: !!why("edit", s), reason: why("edit", s),
        onClick: function () { location.href = streamHref(s); } },
      { label: "Start again", icon: IC.restart, off: !!why("startAgain", s), reason: why("startAgain", s),
        onClick: function () { askStartAgain(s); } },
      { label: "Duplicate", icon: IC.copy, off: !!why("duplicate", s), reason: why("duplicate", s),
        onClick: function () { askDuplicate(s); } },
      { label: "Archive", icon: IC.save, off: !!why("archive", s), reason: why("archive", s),
        onClick: function () { askArchive(s); } },
      { sep: true },
      { label: "Analytics", icon: IC.chart, off: !!why("analytics", s), reason: why("analytics", s),
        onClick: function () {
          if (PAGE !== "stream") { location.href = "live-stream.html?id=" + encodeURIComponent(s.id) + "#analytics"; return; }
          var el = document.querySelector("[data-lv-analytics]");
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        } },
      { label: "Open on YouTube", icon: IC.youtube,
        off: !s.channelId, reason: !s.channelId ? T.needChannel : "",
        onClick: function () { UI.toast("The broadcast opens on YouTube."); } },
      { label: "Copy stream key", icon: IC.link, onClick: function () { UI.toast("Stream key copied."); } },
      { sep: true },
      { label: "Delete", icon: IC.trash, danger: true, off: !!why("del", s), reason: why("del", s),
        onClick: function () { askDelete(s); } }
    ];
    if (inDetail) {
      var prim = detailPrimaryLabel(s);
      var quick = detailQuick(s, prim).map(function (q) { return q.label; });
      items = items.filter(function (it) {
        return it.sep || (it.label !== "Open" && it.label !== prim && quick.indexOf(it.label) === -1);
      });
      while (items.length && items[0].sep) items.shift();
      items = items.filter(function (it, i) { return !(it.sep && items[i - 1] && items[i - 1].sep); });
    }
    UI.menu(anchor, items);
  }

  // Кошелёк в топбаре — единственное место, где баланс виден вне карточки стрима:
  // из шапки раздела плашку баланса и Top up balance убрали по решению владельца.
  function syncChrome() {
    var a = acc();
    var w = document.querySelector("[data-lv-wallet]");
    if (w) w.textContent = a.kind === "hours" ? "≈" + UI.hours(a.creditHours) : UI.money(a.balance);
  }

  // ============================================================ Э1 · список
  var COLS = [
    { k: "stream",  label: "Stream",       w: "minmax(260px,2fr)", def: true, lock: true },
    { k: "status",  label: "Status",       w: "176px", def: true },
    { k: "channel", label: "Channel",      w: "minmax(160px,1fr)", def: true },
    { k: "next",    label: "Next run",     w: "minmax(170px,1fr)", def: true },
    { k: "cost",    label: "Cost",         w: "120px", def: true },
    { k: "spent",   label: "Spent",        w: "100px", def: true },
    { k: "last",    label: "Last run",     w: "150px", def: true },
    { k: "views",   label: "Views",        w: "90px",  def: false },
    { k: "likes",   label: "Likes",        w: "90px",  def: false },
    { k: "comments",label: "Comments",     w: "110px", def: false },
    { k: "users",   label: "Active users", w: "120px", def: false },
    { k: "rev",     label: "Rev",          w: "90px",  def: false },
    { k: "acts",    label: "",             w: "56px",  def: true, lock: true }
  ];
  function visCols() {
    var on = S.cols || COLS.filter(function (c) { return c.def; }).map(function (c) { return c.k; });
    return COLS.filter(function (c) { return on.indexOf(c.k) !== -1; });
  }
  function q() { var el = document.querySelector("[data-lv-q]"); return el ? el.value.trim().toLowerCase() : ""; }
  function hasFilters() { return !!(q() || S.filters.status.length || S.filters.channels.length); }
  function filtered() {
    var s = q();
    return S.streams.filter(function (x) {
      var k = stKey(x);
      // архив по умолчанию скрыт: он появляется только явным фильтром
      if (k === "archived" && S.filters.status.indexOf("archived") === -1) return false;
      if (S.filters.status.length && S.filters.status.indexOf(k) === -1) return false;
      if (S.filters.channels.length && S.filters.channels.indexOf(x.channelId) === -1) return false;
      if (!s) return true;
      var ch = chan(x.channelId);
      return x.name.toLowerCase().indexOf(s) !== -1 || (ch && ch.name.toLowerCase().indexOf(s) !== -1);
    }).sort(function (a, b) {
      // идущий эфир всегда выше остальных
      var w = function (x) { return stKey(x) === "live" ? 0 : 1; };
      return w(a) - w(b);
    });
  }

  function cellHtml(s, k) {
    var ch = chan(s.channelId), pl = content(s), c = cost(s);
    if (k === "stream") {
      return '<div class="ml-name">' + coverBox(coverOf(s)) +
        '<span class="ml-name__folder"><span class="ml-name__text">' + UI.esc(s.name) + "</span>" +
        '<span class="ml-name__meta">' + (pl ? UI.esc(pl.name) : "No playlist") + "</span></span></div>";
    }
    if (k === "status") {

      // причина остановки живёт в тултипе бейджа: вторая строка обрезалась и врала
      return stBadge(stKey(s), stopReason(s));
    }
    if (k === "channel") return chanHtml(s);
    if (k === "next") {
      var sl = nextSlot(s), rest = (s.schedules || []).filter(function (x) { return x.id !== (sl && sl.id); });
      if (!sl) return '<span class="an-muted">Not scheduled</span>';
      // остальные окна перечисляем в тултипе: «+1 more» без объяснения читается как загадка
      var tip = rest.map(function (x) {
        return UI.dt(x.start, TZ) + " → " + UI.time(x.end, TZ) + (repLabel(x) ? " · " + repLabel(x) : "");
      }).join(" · ");
      return '<span class="lv-next"><span>' + UI.dt(sl.start, TZ) + " (" + TZL + ")</span>" +
        (repLabel(sl) ? '<span class="lv-next__rep">' + (IC.restart || "") + repLabel(sl) + "</span>" : "") +
        (rest.length ? '<span class="lv-next__more" tabindex="0" data-tip="' + UI.esc("Other slots: " + tip) +
          '">+' + rest.length + (rest.length === 1 ? " more slot" : " more slots") + "</span>" : "") + "</span>";
    }
    if (k === "cost") {
      // цена часа как в документации ($0.023), а не округлённая до двух знаков:
      // это тариф, а не сумма. Итоги и списания — всегда двумя знаками.
      return '<span class="lv-chan__col"><span>' + c.rateStr.replace(" / hour", "/h") + "</span>" +
        (s.backup ? '<span class="lv-chan__off">×2 backup stream</span>' : "") + "</span>";
    }
    if (k === "spent") return UI.money(s.spentTotal);
    if (k === "last") {
      var r = (s.runs || []).filter(function (x) { return x.start; })[0];
      if (!r) return '<span class="an-muted">—</span>';
      var dur = (r.end ? Date.parse(r.end) : nowMs()) - Date.parse(r.start);
      return '<span class="lv-next"><span>' + UI.durHuman(dur / 1000) + "</span>" +
        '<span class="lv-next__rep">' + UI.dt(r.start, TZ) + "</span></span>";
    }
    if (k === "views") return s.metrics.views != null ? String(s.metrics.views) : '<span class="an-muted">—</span>';
    if (k === "likes") return s.metrics.likes != null ? String(s.metrics.likes) : '<span class="an-muted">—</span>';
    if (k === "comments") return s.metrics.comments != null ? String(s.metrics.comments) : '<span class="an-muted">—</span>';
    if (k === "users") return s.metrics.users != null ? String(s.metrics.users) : '<span class="an-muted">—</span>';
    if (k === "rev") return s.metrics.rev != null ? UI.money(s.metrics.rev) : '<span class="an-muted">—</span>';
    if (k === "acts") return '<button class="mc-more" type="button" data-lv-menu-for="' + s.id + '" aria-label="Actions for ' + UI.esc(s.name) + '">' + (IC.more || "⋮") + "</button>";
    return "";
  }

  function renderList() {
    var wrap = document.querySelector("[data-lv-table]");
    if (!wrap) return;   // у .ml-toolbar свой display, [hidden] его не перебивает
    var cols = visCols(), rows = filtered();
    var tpl = cols.map(function (c) { return c.w; }).join(" ");

    // баннер нулевого баланса: сам баланс живёт в кошельке топбара
    var a = acc();
    var banner = document.querySelector("[data-lv-banner]");
    if (banner) {
      var zero = a.kind === "money" && a.balance <= 0;
      banner.hidden = !zero;
      banner.innerHTML = zero
        ? '<span>' + (IC.attention || "") + "</span><span>" + T.paused + "</span>" +
          '<span class="lv-banner__acts">' + btn(T.topUp, "primary", 'data-lv-topup') + "</span>"
        : "";
    }
    var cnt = document.querySelector("[data-lv-count]");
    if (cnt) cnt.textContent = rows.length + (rows.length === 1 ? " stream" : " streams");

    var chips = document.querySelector("[data-lv-chips]");
    if (chips) {
      chips.innerHTML = S.filters.status.map(function (st) {
        return chip("Status: " + (ST[st] ? ST[st].label : st), 'data-lv-unchip="status:' + st + '"');
      }).join("") + S.filters.channels.map(function (id) {
        var c = chan(id);
        return chip("Channel: " + (c ? c.name : id), 'data-lv-unchip="channels:' + id + '"');
      }).join("") + (hasFilters() ? '<button class="an-fchips__clear" type="button" data-lv-clear>Clear all</button>' : "");
      chips.hidden = !hasFilters();
    }

    // скелетон — только в теле, тулбар и пагинация остаются
    if (S.loading) {
      wrap.innerHTML = head(cols, tpl) + Array.from({ length: 5 }).map(function () {
        return '<div class="an-tr" style="grid-template-columns:' + tpl + '">' +
          cols.map(function () { return '<div class="an-td"><span class="lv-skel" style="width:70%"></span></div>'; }).join("") + "</div>";
      }).join("");
      return;
    }

    var empty = document.querySelector("[data-lv-empty]");
    if (!rows.length) {
      wrap.hidden = true;
      wrap.innerHTML = "";
      // без данных тулбар и рамка таблицы — пустое место; с активным фильтром тулбар нужен, чтобы его снять
      wrap.parentElement.hidden = !hasFilters();
      var tbS = document.querySelector(".ml-toolbar");
      if (tbS) tbS.style.display = hasFilters() ? "" : "none";
      if (empty) {
        empty.hidden = false;
        empty.innerHTML = hasFilters()
          ? '<div class="an-blank"><span class="an-blank__ico">' + (IC.search || "") + '</span>' +
            '<p class="an-blank__title">No streams match your filters.</p>' +
            '<div class="an-head__btns">' + btn("Clear all", "secondary", "data-lv-clear") + "</div></div>"
          : '<div class="an-blank"><span class="an-blank__ico"><svg><use href="#ic-stream"></use></svg></span>' +
            '<p class="an-blank__title">No streams yet</p>' +
            // нулевой сценарий живёт внутри Live: в медиатеку отсюда не отправляем
            '<p class="an-blank__text">Put a playlist or a few videos on air around the clock.</p>' +
            '<div class="an-head__btns">' + btn("Create stream", "primary", 'data-lv-new') + "</div></div>";
      }
      return;
    }
    if (empty) { empty.hidden = true; empty.innerHTML = ""; }
    wrap.parentElement.hidden = false;
    var tbS2 = document.querySelector(".ml-toolbar");
    if (tbS2) tbS2.style.display = "";
    wrap.hidden = false;

    var totals = rows.reduce(function (t, s) {
      t.spent += s.spentTotal || 0;
      t.views += s.metrics.views || 0; t.likes += s.metrics.likes || 0;
      t.comments += s.metrics.comments || 0; t.users += s.metrics.users || 0; t.rev += s.metrics.rev || 0;
      return t;
    }, { spent: 0, views: 0, likes: 0, comments: 0, users: 0, rev: 0 });

    wrap.innerHTML = head(cols, tpl) +
      '<div class="an-tr an-tr--avg" style="grid-template-columns:' + tpl + '">' +
        cols.map(function (c) {
          var v = c.k === "stream" ? "Totals"
            : c.k === "spent" ? UI.money(totals.spent)
            : c.k === "views" ? String(totals.views)
            : c.k === "likes" ? String(totals.likes)
            : c.k === "comments" ? String(totals.comments)
            : c.k === "users" ? String(totals.users)
            : c.k === "rev" ? UI.money(totals.rev)
            : c.k === "acts" ? ""                       // в колонке действий суммировать нечего
            : '<span class="an-muted">—</span>';
          return '<div class="an-td' + (c.k === "acts" ? " an-td--acts an-td--pinr" : "") + '">' + v + "</div>";
        }).join("") + "</div>" +
      rows.map(function (s) {
        return '<div class="an-tr an-tr--link' +
          '" style="grid-template-columns:' + tpl + '" data-lv-row-id="' + s.id + '" tabindex="0" role="link" aria-label="' + UI.esc(s.name) + '">' +
          cols.map(function (c) {
            return '<div class="an-td' + (c.k === "acts" ? " an-td--acts an-td--pinr" : "") + '">' + cellHtml(s, c.k) + "</div>";
          }).join("") + "</div>";
      }).join("");
  }
  function head(cols, tpl) {
    return '<div class="an-tr an-tr--head" style="grid-template-columns:' + tpl + '">' +
      cols.map(function (c) { return '<div class="an-th' + (c.k === "acts" ? " an-th--pinr" : "") + '">' + UI.esc(c.label) + "</div>"; }).join("") + "</div>";
  }

  function chip(label, attrs) {
    return '<span class="an-fchip">' + UI.esc(label) +
      '<button class="an-fchip__x" type="button" ' + attrs + ' aria-label="Remove filter ' + UI.esc(label) + '">' + (IC.close || "×") + "</button></span>";
  }
  // фильтры: статус и канал. Период и плейлист появятся вместе с календарём и плейлистами.
  function filtersPopover(anchor) {
    var pop = popEl();
    pop.innerHTML = '<p class="lv-pop__t">Status</p>' +
      Object.keys(ST).map(function (k) {
        return '<div class="lv-pop__row"><span>' + ST[k].label + "</span>" +
          UI.switchHtml('data-lv-f="status:' + k + '"', S.filters.status.indexOf(k) !== -1, ST[k].label) + "</div>";
      }).join("") +
      '<p class="lv-pop__t" style="margin-top:10px">Channel</p>' +
      F.channels.filter(function (c) { return c.connected; }).map(function (c) {
        return '<div class="lv-pop__row"><span>' + UI.esc(c.name) + "</span>" +
          UI.switchHtml('data-lv-f="channels:' + c.id + '"', S.filters.channels.indexOf(c.id) !== -1, c.name) + "</div>";
      }).join("") +
      '<div class="lv-pop__foot">' + btn("Clear all", "secondary", "data-lv-clear") + "</div>";
    placePop(pop, anchor);
  }
  function popEl() {
    var pop = document.querySelector("[data-lv-pop]");
    // попап один на раздел: модификаторы предыдущего содержимого снимаем
    if (pop) pop.className = "lv-pop";
    if (!pop) {
      pop = document.createElement("div");
      pop.className = "lv-pop";
      pop.setAttribute("data-lv-pop", "");
      document.body.appendChild(pop);
    }
    return pop;
  }
  function placePop(pop, anchor) {
    pop.hidden = false;
    var r = anchor.getBoundingClientRect();
    var w = pop.offsetWidth, h = pop.offsetHeight;
    pop.style.left = Math.round(Math.max(12, Math.min(r.left, window.innerWidth - w - 12))) + "px";
    // ниже якоря, если панель туда влезает; иначе выше — и всегда внутри экрана
    var top = r.bottom + h + 12 <= window.innerHeight ? r.bottom + 8 : r.top - h - 8;
    top = Math.max(12, Math.min(top, window.innerHeight - h - 12));
    pop.style.top = Math.round(top + window.scrollY) + "px";
  }
  // настройка колонок
  function colsPopover(anchor) {
    var pop = popEl();
    var on = visCols().map(function (c) { return c.k; });
    // состав панели — как в Analytics: чекбоксы, а не тумблеры, и Reset ссылкой в шапке
    pop.innerHTML =
      '<div class="an-cols__head"><h3 class="an-cols__title">Columns visibility</h3>' +
        '<button class="an-btn an-btn--link an-btn--small" type="button" data-lv-colsreset>' +
          (IC.restart || "") + "Reset</button></div>" +
      '<div class="an-cols__list">' +
        COLS.filter(function (c) { return !c.lock; }).map(function (c) {
          var checked = on.indexOf(c.k) !== -1;
          return '<button class="an-cols__row' + (checked ? " is-checked" : "") + '" type="button" role="switch" ' +
            'aria-checked="' + checked + '" data-lv-col="' + c.k + '">' +
            '<span class="an-check">' + (IC.check || "") + "</span>" +
            '<span class="an-cols__lbl">' + UI.esc(c.label) + "</span></button>";
        }).join("") +
      "</div>";
    placePop(pop, anchor);
  }
  function closePop() {
    var pop = document.querySelector("[data-lv-pop]");
    if (pop) pop.hidden = true;
  }

  // ============================================================ Э2 · карточка
  // адрес эфира без протокола: в мете нужна узнаваемая часть, а не вся ссылка
  function destHost(link) {
    return String(link || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
  function stateBar(s) {
    var c = cost(s), sl = nextSlot(s), r = runOf(s);
    var box = function (k, v) { return '<div class="lv-state__m"><span class="lv-state__k">' + k + '</span><span class="lv-state__v">' + v + "</span></div>"; };
    var acts = "";
    var inner = "";
    var k = stKey(s);
    if (k === "ready") {
      // состояние уже сказано бейджем, а про слот говорит кнопка в расписании
      inner = "";
    } else if (k === "scheduled") {
      inner = box("Starts", UI.until(sl ? sl.start : null, nowMs())) +
        (sl ? box("Window", windowStr(sl)) : "") +
        (repLabel(sl) ? box("Repeat", repLabel(sl)) : "");
    } else if (k === "preparing") {
      // прогрев идёт и по крону за час до старта, и по нажатию Start
      inner = '<div class="lv-state__v">Preparing — the files are being sent to the worker.' +
        (sl ? " The stream goes live at " + UI.time(sl.start, TZ) + " (" + TZL + ")." : "") + "</div>";
    } else if (k === "live") {
      var onAirSec = r && r.start ? (nowMs() - Date.parse(r.start)) / 1000 : 0;
      // в узкой колонке значения короткие: «Off» у бекапа не пишем вовсе, конец эфира
      // называем в два слова — подробности живут на шаге воспроизведения
      inner = box("On air", UI.durHuman(onAirSec)) +
        box("Viewers", String(s.viewers || 0)) +
        (s.backup ? box("Backup", "Active") : "") +
        box(sl ? "Window ends" : "Ends", sl ? UI.until(sl.end, nowMs()).replace(/^in /, "")
          : s.loopLimit ? s.loopLimit + " loops"
          : s.playback.loop ? "Until stop" : "Queue ends");
    } else if (k === "stopping") {
      inner = box("Stopping", "YouTube is ending the broadcast");
    } else if (k === "stopped") {
      var last = (s.runs || []).filter(function (x) { return x.start; })[0];
      inner = box("Reason", stopReason(s) || "Stopped") +
        box("Duration", last ? UI.durHuman(((last.end ? Date.parse(last.end) : nowMs()) - Date.parse(last.start)) / 1000) : "—") +
        box("Spent", UI.money(s.spentTotal));
    } else if (k === "archived") {
      // «Start again» стоит кнопкой рядом, повторять её словами незачем
      inner = box("Archived", "Hidden from the list");
    } else if (k === "needconv") {
      var rdc = readiness(content(s));
      inner = box("Conversion", rdc.label.replace("Needs conversion", "Needed").replace(" · ", " · ")) +
        box("Unconverted", "Archived after 14 days");
    } else if (k === "converting") {
      inner = '<div class="lv-state__v">' + UI.esc(readiness(content(s)).text || "Conversion is running.") + "</div>";
    } else if (k === "convfail") {
      var bad = readiness(content(s)).files.length;
      inner = box("Conversion", (bad ? UI.plural(bad, "file", "files") : "Some files") + " failed");
    }
    // пустая плашка не рисуется вовсе: рамка без содержимого только шумит
    if (!inner && !acts) return "";
    var stIco = "";   // цвет полосы уже кодирует состояние, иконка дублировала его
    return '<div class="lv-state lv-state--' + k + '">' + stIco + inner +
      (acts ? '<div class="lv-state__acts">' + acts + "</div>" : "") + "</div>";
  }

  // manual — в плейлисте конвертацию можно запустить заранее, руками; в стриме она
  // начинается сама, поэтому кнопки там нет
  // длина окна словами: округление до часов превращало 45 минут в «0 h»
  function winLen(h) {
    var m = Math.max(1, Math.round((h || 0) * 60));
    var hh = Math.floor(m / 60), mm = m % 60;
    return hh ? hh + " h" + (mm ? " " + mm + " min" : "") : mm + " min";
  }
  function readyPanel(rd, manual) {
    if (!rd) return "";
    var cls = { ready: "ok", convert: "warn", busy: "busy", none: "none" }[rd.state] || "bad";
    var act = rd.state === "convfail" ? btn("Try again", "secondary", 'data-lv-act="prepare"')
      : manual && rd.state === "convert" ? btn("Prepare for streaming", "secondary", 'data-lv-act="prepare"')
      : rd.state === "cant" ? btn("Show files", "secondary", 'data-lv-act="showbad"') : "";
    return '<span class="lv-ready lv-ready--' + cls + '" data-lv-ready>' + UI.esc(rd.text) + "</span>" + act;
  }

  // mode: "tech" — плейлист (разрешение и битрейт), "slim" — мастер (без размера файла:
  // суммарный вес виден в итогах под таблицей, а имени нужна ширина)
  function queueRows(s, pl, draftItems, mode, locked) {
    var tech = mode === "tech", slim = mode === "slim";
    var items = draftItems || (pl ? pl.items : []);
    var rd = readiness(pl);
    var onAirIdx = -1;
    if (s.status === "live" && s.onAir) {
      items.forEach(function (i, idx) { if (i.fileId === s.onAir.fileId) onAirIdx = idx; });
    }
    // один файл: порядка нет, поэтому нет ни номера, ни ручки перетаскивания
    var solo = items.filter(inSet).length === 1;
    var num = 0;
    return items.map(function (i, idx) {
      var f = file(i.fileId);
      // пропавшего файла и сорвавшейся загрузки в очереди не существует
      if (!f || f.state === "missing" || f.state === "failed") return "";
      num++;
      var isOnAir = idx === onAirIdx, isNext = onAirIdx !== -1 && idx === onAirIdx + 1;
      var badge = (slim ? "" : fileFmt(f)) + fileBadge(f, profileOf(pl));
      var prog = isOnAir && s.onAir
        ? '<div class="lv-qr__bar"><i style="width:' + Math.round(100 * s.onAir.passedSec / (f.sec || 1)) + '%"></i></div>'
        : f.state === "converting"
          ? '<div class="lv-qr__bar lv-qr__bar--conv"><i style="width:' + (f.progress || 0) + '%"></i></div>' : "";
      return '<div class="lv-qr' + (solo ? " is-solo" : "") + (i.off ? " is-off-file" : "") +
          (isOnAir ? " is-onair" : "") + (isNext ? " is-next" : "") +
          (f.state === "missing" ? " is-missing" : "") + '" data-lv-row="' + i.fileId + '"' +
          (isOnAir || solo || locked ? ' data-lv-fixed="1"' : ' draggable="true"') + ">" +
        (solo ? "" :
          '<span class="lv-qr__i">' + (s.playback.shuffle ? "" : "#" + num) + "</span>" +
          (locked ? '<span class="lv-qr__grip"></span>'
            : '<span class="lv-qr__grip"' + (isOnAir ? ' data-tip="' + T.onAir + '"' : "") + ">" + (IC.grip || "") + "</span>")) +
        coverBox(f.cover) +
        '<span class="lv-qr__n"><span class="lv-qr__nm">' + UI.esc(f.name) + "</span>" +
          (isOnAir ? '<span class="lv-qr__mark lv-qr__mark--onair">On air · ' + UI.durHuman((f.sec - s.onAir.passedSec)) + " left</span>"
            : isNext ? '<span class="lv-qr__mark lv-qr__mark--next">Up next</span>' : "") + "</span>" +
        '<span class="lv-qr__meta">' + (f.state === "missing" ? "—" : UI.dur(f.sec)) + "</span>" +
        (slim ? "" : '<span class="lv-qr__meta">' + (f.state === "missing" ? "—" : UI.bytes(f.bytes)) + "</span>") +
        '<span class="lv-qr__meta">' + fileRes(f) + "</span>" +
        (tech ? '<span class="lv-qr__meta">' + fileRate(f) + "</span>" : "") +
        badge +
        UI.switchHtml('data-lv-file="' + i.fileId + '"' +
          (locked ? ' data-tip="' + UI.esc(T.liveEditPlaylist) + '"' : isOnAir ? ' data-tip="' + T.onAir + '"' : ""), !i.off, "Include " + f.name, !!locked) +
        (locked
          ? '<button class="mc-more is-off" type="button" aria-disabled="true" data-tip="' + UI.esc(T.liveEditPlaylist) + '" aria-label="Actions for ' + UI.esc(f.name) + '">' + (IC.more || "⋮") + "</button>"
          : '<button class="mc-more" type="button" data-lv-fmenu="' + i.fileId + '" aria-label="Actions for ' + UI.esc(f.name) + '">' + (IC.more || "⋮") + "</button>") +
        prog + "</div>";
    }).join("");
  }

  function costBlock(s) {
    var c = cost(s), a = c.account, pl = content(s), st = plStats(pl);
    var headBig = a.kind === "hours"
      ? "Free credit · ≈" + UI.hours(a.creditHours) + " left"
      : c.rateStr;
    var sub = a.kind === "hours" ? "at " + c.rateStr : "≈" + UI.money(c.perDay) + " / day";
    var rows =
      kvRow("Spent this run", UI.money(runOf(s) ? runOf(s).spent : 0)) +
      kvRow("Spent all time", UI.money(s.spentTotal)) +
      kvRow(c.windowH ? "Window " + winLen(c.windowH) : "No window",
            c.windowH ? "≈" + UI.money(c.windowCost) : "Runs until you stop it");
      // остаток в часах не строка карточки: баланс виден в топбаре, а нехватку
      // называет предупреждение ниже
    var warn = c.notEnough
      ? '<div class="lv-cost__warn">' + (IC.attention || "") +
        "<span>Balance covers ≈" + UI.hours(c.balHours) + " of the " + winLen(c.windowH) + " window.</span>" +
        btn(T.topUp, "primary", "data-lv-topup") + "</div>" : "";
    // заголовок не нужен: ставка крупной строкой сама говорит, о чём карточка
    return '<section class="rp-card">' +
      '<div class="lv-cost__head"><span class="lv-cost__big">' + headBig + "</span>" +
        '<span class="lv-cost__sub">' + sub + (s.backup ? " · backup doubles it" : "") + "</span></div>" +
      '<div class="lv-cost__rows">' + rows + "</div>" + warn +
      '<div class="lv-cost__more">' +
        '<button class="lv-cost__toggle" type="button" data-lv-costmore aria-expanded="false">' + (IC.chevDown || "") + "What the price depends on</button>" +
        '<div class="lv-cost__detail" data-lv-costdetail hidden>' +
          "<span>Videos: " + st.count + (st.off ? " (" + st.off + " off)" : "") + "</span>" +
          "<span>Playlist duration: " + UI.dur(st.sec) + "</span>" +
          "<span>Playlist size: " + UI.bytes(st.bytes) + "</span>" +
          "<span>Price per hour: " + c.rateStr + "</span>" +
          "<span>One full cycle: ≈" + UI.money(c.rate * st.sec / 3600) + "</span>" +
          "<span>Price depends on quality and file size, and on how many streams run at once.</span>" +
        "</div></div></section>";
  }
  function kvRow(k, v) { return '<div class="lv-cost__row"><span>' + k + "</span><b>" + v + "</b></div>"; }

  var logIcons = {
    created: "ok", scheduled: "ok", live: "ok", playlist: "warn",
    reconnected: "warn", restart: "warn", backup: "warn", error: "err", charged: "ok",
    limit: "warn", stopped: "ok", archived: "ok",
    // сорванная конвертация и исчерпанный баланс — это ошибки: и по иконке, и для фильтра
    blocked: "err", conversion_decided: "warn"
  };
  function logKind(e) { return logIcons[e.type] || ""; }
  // Аналитика стрима: сводка по аудитории и деньгам плюс разбор по запускам.
  // Появляется, когда стрим хотя бы раз выходил в эфир — иначе показывать нечего.
  function analyticsCard(s) {
    var runs = (s.runs || []).filter(function (r) { return r.start; });
    if (!runs.length) return "";
    var m = s.metrics || {};
    var airSec = runs.reduce(function (a, r) {
      return a + ((r.end ? Date.parse(r.end) : nowMs()) - Date.parse(r.start)) / 1000;
    }, 0);
    var tile = function (k, v) {
      return '<div class="lv-an__m"><span class="lv-state__k">' + k + '</span><span class="lv-state__v">' + v + "</span></div>";
    };
    return '<section class="rp-card" data-lv-analytics>' +
      '<div class="lv-card__h"><h2 class="lv-card__t">Analytics</h2>' +
        '<span class="lv-card__sub">' + UI.plural(runs.length, "run", "runs") + " · " + UI.durHuman(airSec) + " on air</span></div>" +
      '<div class="lv-card__b lv-card__b--pad">' +
        '<div class="lv-an__grid">' +
          tile("Views", m.views != null ? String(m.views) : "—") +
          tile("Likes", m.likes != null ? String(m.likes) : "—") +
          tile("Comments", m.comments != null ? String(m.comments) : "—") +
          tile("Active users", m.users != null ? String(m.users) : "—") +
          tile("Revenue", m.rev != null ? UI.money(m.rev) : "—") +
          tile("Spent", UI.money(s.spentTotal || 0)) +
        "</div>" +
        '<div class="lv-an__rows">' + runs.map(function (r) {
          var sec = ((r.end ? Date.parse(r.end) : nowMs()) - Date.parse(r.start)) / 1000;
          return '<div class="lv-an__r"><span class="lv-an__n">Run ' + r.index + "</span>" +
            '<span class="lv-an__d">' + UI.dt(r.start, TZ) + (r.end ? " → " + UI.time(r.end, TZ) : " → on air") + "</span>" +
            '<span class="lv-an__v">' + UI.durHuman(sec) + "</span>" +
            '<span class="lv-an__v">' + UI.money(r.spent || 0) + "</span></div>";
        }).join("") + "</div>" +
        '<p class="an-hint">Audience numbers come from YouTube and refresh a few minutes behind the broadcast.</p>' +
      "</div></section>";
  }
  function logBlock(s, errorsOnly) {
    var runs = (s.runs || []);
    var total = runs.reduce(function (a, r) { return a + r.events.length; }, 0);
    var body = runs.map(function (r) {
      var evs = r.events.filter(function (e) { return !errorsOnly || logKind(e) === "err"; });
      if (!evs.length) return "";
      var when = r.start ? UI.day(r.start, TZ) + ", " + UI.time(r.start, TZ) : "not started";
      var till = r.end ? " — " + UI.time(r.end, TZ) : "";
      return '<div class="lv-log__run">Run ' + r.index + " · " + when + till + "</div>" +
        evs.map(function (e) {
          var kind = logKind(e);
          return '<div class="lv-log__e"><span class="lv-log__t">' + UI.dt(e.at, TZ) + "</span>" +
            '<span class="lv-log__ic' + (kind ? " lv-log__ic--" + kind : "") + '">' +
              (kind === "err" ? (IC.attention || "!") : (IC.check || "")) + "</span>" +
            '<span class="lv-log__txt"><span>' + UI.esc(e.text) + "</span>" +
              (e.author ? '<span class="lv-log__who">by ' + UI.esc(e.author) + "</span>" : "") +
              (e.code ? '<span class="lv-log__code">' + UI.esc(e.code) + "</span>" : "") +
            "</span></div>";
        }).join("");
    }).join("");
    // фильтру нечего фильтровать в пустом логе, а «Nothing found» там читается как результат поиска
    var blank = total && errorsOnly ? "No errors in the log." : "No events yet.";
    return '<section class="rp-card" id="lvLog">' +
      '<div class="lv-card__h"><h2 class="lv-card__t">Event log</h2>' +
        (total
          ? '<span class="lv-card__acts">' +
            '<label class="lv-pop__row" style="padding:0;gap:8px">Errors only' +
              UI.switchHtml("data-lv-errors", !!errorsOnly, "Errors only") + "</label></span>"
          : "") + "</div>" +
      '<div class="lv-log">' + (body || '<div class="an-blank"><p class="an-blank__text">' + blank + "</p></div>") + "</div></section>";
  }

  var draft = null;   // черновик правок плейлиста в эфире
  function renderDetail() {
    // модалку могли закрыть по Esc или клику по фону — временный контекст не переживает страницу
    if (FORM && FORM.modal && !document.querySelector("#lvSlotM.is-open, #lvSlotM[open]")) {
      var openM = document.getElementById("lvSlotM");
      if (!openM || openM.offsetParent === null) { FORM = null; SLOT_M = null; }
    }
    var host = document.querySelector("[data-lv-detail]");
    if (!host) return;
    var id = new URLSearchParams(location.search).get("id");
    var s = stream(id) || S.streams[0];
    if (s && s.status === "draft") { location.replace(streamHref(s)); return; }
    if (!s) {
      host.innerHTML = '<div class="an-blank"><p class="an-blank__title">Stream not found</p>' +
        '<div class="an-head__btns">' + btn("Back to streams", "secondary", 'data-an-back') + "</div></div>";
      return;
    }
    document.title = s.name + " — SubSub";
    var ch = chan(s.channelId), pl = content(s), st = plStats(pl), rd = readiness(pl);
    var errorsOnly = host.getAttribute("data-lv-errors-only") === "1";
    // очередь идущего (и поднимающегося) стрима не правится: добавить, убрать, переставить
    // или выключить файл можно только после остановки (решение 03.09)
    var k0lock = stKey(s);
    var locked = running(s.status) || k0lock === "preparing" || k0lock === "starting" || k0lock === "stopping";
    var b = startBlock(s);
    var k0 = stKey(s);
    var primary = k0 === "live" || k0 === "preparing" || k0 === "stopping"
      ? { label: "Stop", mode: "danger", act: "stop", off: !!why("stop", s), reason: why("stop", s) }
      : k0 === "stopped" || k0 === "archived"
        ? { label: "Start again", mode: "primary", act: "again", off: !!why("startAgain", s), reason: why("startAgain", s) }
        : { label: "Start", mode: "primary", act: "start", off: !!(why("start", s) || (b && b.reason)),
            reason: why("start", s) || (b ? b.reason : ""), tipAct: b && b.act };

    host.innerHTML =
      '<a class="an-back" href="live-streams.html">' + (IC.chevLeft || "") + "Back to streams</a>" +
      // основная информация, действия, состояние и стоимость закреплены слева;
      // правая колонка с контентом, расписанием и логом скроллится
      '<div class="lv-dwrap"><aside class="lv-dside">' +
      coverBox(coverOf(s), "lv-dcover lv-dcover--big") +
        '<div class="lv-dtitle"><h1 class="lv-dtitle__n" data-lv-name>' + UI.esc(s.name) + "</h1>" +
          stBadge(stKey(s)) +
          (stopReason(s) ? '<span class="an-hint">' + UI.esc(stopReason(s)) + "</span>" : "") + "</div>" +
        '<div class="lv-dmeta">' +
          chanHtml(s) +
        "</div>" +
        '<div class="lv-dacts lv-dacts--wrap">' +
          '<button class="an-btn an-btn--' + primary.mode + ' an-btn--small' + (primary.off ? " is-off" : "") + '" type="button" data-lv-act="' + primary.act + '"' +
            (primary.off ? ' aria-disabled="true" data-tip="' + UI.esc(primary.reason) + '"' + (primary.tipAct ? ' data-tip-act="' + primary.tipAct + '"' : "") : "") + ">" + primary.label + "</button>" +
          detailQuick(s, primary.label).map(function (q) {
            return '<button class="an-btn an-btn--secondary an-btn--small" type="button" data-lv-act="' + q.act + '">' +
              (IC[q.icon] || "") + q.label + "</button>";
          }).join("") +
          '<button class="mc-more" type="button" data-lv-menu-for="' + s.id + '" aria-label="More actions">' + (IC.more || "⋮") + "</button>" +
        "</div>" +
      stateBar(s) +
      costBlock(s) +
      "</aside>" +
      '<div class="lv-dmain">' +
      // ---- плейлист
      '<section class="rp-card">' +
        '<div class="lv-card__h">' +
          '<h2 class="lv-card__t">' + (pl ? UI.esc(pl.name) : "No playlist") + "</h2>" +
          '<span class="lv-card__sub">' + st.count + (st.count === 1 ? " video · " : " videos · ") + UI.dur(st.sec) + " · " + UI.bytes(st.bytes) +
            (st.off ? " · " + st.off + " off" : "") + "</span>" +
          '<span class="lv-card__acts">' + readyPanel(rd) +
            '<span class="lv-slot__tag">' + (s.playback.loop ? "Loop" + (s.loopLimit ? " ×" + s.loopLimit : "") : "Play once") + "</span>" +
            '<span class="lv-slot__tag">' + (IC.shuffle || "") + (s.playback.shuffle ? "Shuffle on" : "Shuffle off") + "</span>" +
            (locked ? "" : btn("Add video", "secondary", 'data-lv-act="addvideo"')) +
          "</span></div>" +
        '<div class="lv-card__b"><div class="lv-q" data-lv-queue>' + queueRows(s, pl, draft && draft.id === s.id ? draft.items : null, "slim", locked) + "</div></div>" +
        (!locked && draft && draft.id === s.id
          ? '<div class="an-footer"><div class="an-footer__inner">' +
            '<span class="an-footer__count">You have unsaved changes</span>' +
            '<span class="lv-card__sub">' + draft.added + " added · " + draft.removed + " removed</span>" +
            '<span class="an-head__btns" style="margin-left:auto">' + btn("Discard", "secondary", 'data-lv-act="discard"') +
              btn("Apply to live stream", "primary", 'data-lv-act="apply"') + "</span></div></div>"
          : "") +
      "</section>" +
      // ---- расписание
      '<section class="rp-card">' +
        '<div class="lv-card__h"><h2 class="lv-card__t">Schedule</h2>' +
          '<span class="lv-card__sub">' + (s.schedules || []).length + " slot" + ((s.schedules || []).length === 1 ? "" : "s") + " · " + TZ + " (" + TZL + ")</span>" +
          '<span class="lv-card__acts">' + btn("Add slot", "secondary", 'data-lv-act="addslot"') +
            btn("Open in calendar", "secondary", 'data-lv-act="calendar"') + "</span></div>" +
        '<div class="lv-card__b">' + slotsHtml(s) + "</div></section>" +
      analyticsCard(s) +
      logBlock(s, errorsOnly) +
      "</div></div>";

    var qroot = host.querySelector("[data-lv-queue]");
    if (qroot && !locked) UI.dnd(qroot, function (order) { onReorder(s, order); });
  }
  // Календарь открывается на дне слота и на канале стрима: человек попадает туда,
  // где окно видно, а не в текущую неделю чужого канала.
  function openCalendar(s, sl) {
    var date = sl ? partsIn(Date.parse(sl.start), TZ).date : partsIn(nowMs(), TZ).date;
    location.href = "live-calendar.html?date=" + encodeURIComponent(date) +
      (s && s.channelId ? "&channel=" + encodeURIComponent(s.channelId) : "");
  }
  function btnOff(label, mode, act, reason) {
    return '<button class="an-btn an-btn--' + mode + ' an-btn--small' + (reason ? " is-off" : "") + '" type="button" data-lv-act="' + act + '"' +
      (reason ? ' aria-disabled="true" data-tip="' + UI.esc(reason) + '"' : "") + ">" + label + "</button>";
  }
  // конец окна с датой, если он в другой день: «21 Aug, 08:00 → 22 Aug, 08:00»
  function windowStr(sl) {
    var sameDay = UI.day(sl.start, TZ) === UI.day(sl.end, TZ);
    return UI.dt(sl.start, TZ) + " → " + (sameDay ? UI.time(sl.end, TZ) : UI.dt(sl.end, TZ)) + " (" + TZL + ")";
  }
  function slotsHtml(s) {
    if (!(s.schedules || []).length) {
      return '<div class="an-blank"><p class="an-blank__text">No schedule yet — the stream runs until you stop it.</p></div>';
    }
    return s.schedules.map(function (sl) {
      var runs = next3(sl);
      return '<div class="lv-slot">' +
        '<span class="lv-slot__w"><span class="lv-slot__t">' + windowStr(sl) + "</span>" +
          (repLabel(sl) ? '<span class="lv-slot__m">Repeat: ' + repLabel(sl) + "</span>" : "") +
        "</span>" +
        '<span class="lv-slot__runs"><span class="lv-slot__m">' +
          (runs.length > 1 ? "Next " + runs.length + " runs" : "Next run") + "</span>" +
          '<span class="lv-slot__t">' + runs.map(function (r) { return UI.dt(r, TZ); }).join(" · ") + "</span></span>" +
        (sl.backToBack && sl.backToBack.on
          ? '<span class="lv-slot__tag">Back-to-back · ' + sl.backToBack.pauseMin + " min · " + sl.backToBack.maxCycles + " cycles</span>" : "") +
        '<button class="mc-more" type="button" data-lv-slotmenu="' + sl.id + '" aria-label="Slot actions">' + (IC.more || "⋮") + "</button>" +
        "</div>";
    }).join("");
  }

  // правки плейлиста в эфире идут в черновик, а не сразу в эфир
  function onReorder(s, order) {
    var pl = content(s);
    if (!pl) return;
    if (s.status === "live") {
      draft = draft && draft.id === s.id ? draft : { id: s.id, items: clone(pl.items), added: 0, removed: 0 };
      draft.items = order.map(function (fid) {
        return draft.items.filter(function (i) { return i.fileId === fid; })[0] || { fileId: fid, off: false };
      });
      renderDetail();
      return;
    }
    pl.items = order.map(function (fid) {
      return pl.items.filter(function (i) { return i.fileId === fid; })[0] || { fileId: fid, off: false };
    });
    save(); renderDetail();
    UI.toast("Playlist order saved.");
  }


  // ============================================================ an-select: конфиги
  // Тригеры рисуются в разметке экранов, наборы опций собираются здесь по ключу.
  function selTrig(key, view, opts, arg) {
    return UI.selectHtml('data-lv-sel="' + key + '"' + (arg ? ' data-lv-selarg="' + UI.esc(arg) + '"' : ""), view, opts || {});
  }
  function chanOpt(c) {
    return { value: c.id, label: c.name, avatar: { color: c.color, initial: c.initial },
             sub: c.liveEnabled ? "" : "Live not enabled" };
  }
  function chanOpts(withManual) {
    var out = F.channels.filter(function (c) { return c.connected; }).map(chanOpt);
    if (withManual) {
      out.push({ kind: "sep" });
      out.push({ value: "__manual", label: "Enter stream key manually", kind: "action" });
      out.push({ value: "__connect", label: "Connect YouTube", kind: "action" });
    }
    return out;
  }
  function plOpts() {
    return S.playlists.map(function (p) {
      var st = plStats(p), rd = readiness(p);
      return { value: p.id, label: p.name,
               sub: (st.count ? st.count + (st.count === 1 ? " video · " : " videos · ") + UI.dur(st.sec) : "Empty") +
                    " · " + rd.label,
               off: !st.count, reason: !st.count ? "An empty playlist can’t be selected in a stream." : "" };
    });
  }
  function tzOpts() {
    return TZS.map(function (z) {
      return { value: z.id, label: tzOffLabel(z.id), sub: z.cities, off: false };
    }).sort(function (a, b) { return tzOffMin(a.value) - tzOffMin(b.value); });
  }
  var REP_OPTS = [
    { value: "none", label: "No repeat" }, { value: "daily", label: "Daily" },
    { value: "weekdays", label: "Weekdays" }, { value: "weekly", label: "Weekly" }
  ];
  function optByValue(list, v) {
    return list.filter(function (o) { return o.value === v; })[0] || null;
  }
  // key → конфиг попапа. Один обработчик на весь раздел.
  var SEL_CFG = {
    channel: function () {
      return { value: FORM.channelId, options: chanOpts(true), label: "Channel", onPick: function (v) {
        if (v === "__connect") { ytConnectAsk(); return; }
        if (v === "__manual") { FORM.destMode = "manual"; FORM.channelId = null; }
        else FORM.channelId = v;
        renderForm();
      } };
    },
    playlist: function () {
      return { value: FORM.playlistId, options: plOpts(), label: "Playlist", search: "Search playlists",
        onPick: function (v) { FORM.playlistId = v; renderForm(); } };
    },
    tz: function () {
      return { value: FORM.tz, options: tzOpts(), label: "Time zone", search: "Search time zones",
        onPick: function (v) { FORM.tz = v; renderForm(); } };
    },
    qpl: function () {
      return { value: FORM.srcPl || "", options: plOpts(), label: "Playlist", search: "Search playlists",
        onPick: function (v) { formPickPlaylist(v); renderForm(); } };
    },
    slotRep: function (arg) {
      var sl = FORM.schedules.filter(function (x) { return x.id === arg; })[0];
      return { value: sl ? (sl.repeat && sl.repeat.type) || "none" : "none", options: REP_OPTS, label: "Repeat",
        onPick: function (v) { if (sl) { sl.repeat = { type: v }; renderForm(); } } };
    },
    dupChan: function () {
      return { value: DUP_CHAN, options: chanOpts(false), label: "Channel", onPick: function (v, o) {
        DUP_CHAN = v;
        var t = document.querySelector('[data-lv-sel="dupChan"] .an-select__val');
        if (t) t.innerHTML = UI.selectValue(o);
      } };
    },
    calScale: function () {
      return { value: CALV.scale, label: "Scale", options: [
        { value: "month", label: "Month view" }, { value: "week", label: "Week view" }, { value: "day", label: "Day view" }
      ], onPick: function (v) { CALV.scale = v; renderCalendar(); } };
    },
    calTz: function () {
      return { value: calTz(), options: tzOpts(), label: "Time zone", search: "Search time zones",
        onPick: function (v) { CALV.tz = v; save(); renderCalendar(); } };
    },
    calChan: function () {
      var opts = F.channels.filter(function (c) { return c.connected; }).map(chanOpt);
      opts.push({ kind: "sep" });
      opts.push({ value: "__all", label: "All channels", sub: "Overview only — slots can’t be moved" });
      return { value: calChannel(), options: opts, label: "Channel", onPick: function (v) {
        CALV.channel = v; S.calChannel = v; save(); renderCalendar();
      } };
    }
  };
  var DUP_CHAN = "";
  document.addEventListener("click", function (e) {
    var trig = e.target.closest && e.target.closest("[data-lv-sel]");
    if (!trig || UI.isOff(trig)) return;
    var make = SEL_CFG[trig.getAttribute("data-lv-sel")];
    if (make) UI.select(trig, make(trig.getAttribute("data-lv-selarg")));
  });

  // ============================================================ Э5 · плейлисты
  // Плейлист — самостоятельная сущность: один набор крутится в разных стримах, поэтому
  // луп и шафл здесь не задаются, а изменение состава касается всех, кто его использует.
  function usedBy(plId) {
    return S.streams.filter(function (s) { return s.playlistId === plId; });
  }
  var RD_CLS = { ready: "ok", convert: "warn", cant: "bad", missing: "bad", convfail: "bad",
    busy: "info", processing: "muted", none: "muted" };
  function rdBadge(rd) {
    return '<span class="ml-tag ml-tag--' + (RD_CLS[rd.state] || "muted") + '" data-tip="' + UI.esc(rd.text) +
      '" tabindex="0">' + UI.esc(rd.label || "Empty") + "</span>";
  }
  var PL_COLS = "minmax(240px,2fr) 120px 130px 110px 150px minmax(140px,1fr) 130px 56px";

  function renderPlaylists() {
    var host = document.querySelector("[data-lv-playlists]");
    if (!host) return;
    var qp2 = new URLSearchParams(location.search);
    // вход из медиатеки: папка или выборка файлов становятся плейлистом
    if (qp2.get("fromFolder") || qp2.get("fromFiles")) {
      var byName2 = function (n) { return F.files.filter(function (f) { return f.name === n; })[0]; };
      var name2, items2;
      if (qp2.get("fromFolder")) {
        var fo2 = F.folders.filter(function (x) { return x.name === qp2.get("fromFolder"); })[0];
        name2 = qp2.get("fromFolder");
        items2 = fo2 ? fo2.fileIds.map(function (fid) { return { fileId: fid, off: false }; }) : [];
      } else {
        name2 = "Selected videos";
        items2 = qp2.get("fromFiles").split("|").map(byName2).filter(Boolean)
          .map(function (f) { return { fileId: f.id, off: false }; });
      }
      var np2 = { id: "pl" + Date.now(), name: name2, items: items2, updated: new Date(nowMs()).toISOString() };
      S.playlists.unshift(np2); save();
      UI.toast("“" + name2 + "” saved as a playlist.");
      location.replace("live-playlist.html?id=" + encodeURIComponent(np2.id));
      return;
    }

    var qEl = document.querySelector("[data-lv-plq]");
    var q = qEl ? qEl.value.trim().toLowerCase() : "";
    var rows = S.playlists.filter(function (p) { return !q || p.name.toLowerCase().indexOf(q) !== -1; });
    var cnt = document.querySelector("[data-lv-plcount]");
    if (cnt) cnt.textContent = rows.length + (rows.length === 1 ? " playlist" : " playlists");

    var wrap = document.querySelector("[data-lv-pltable]");
    var empty = document.querySelector("[data-lv-plempty]");
    if (!rows.length) {
      wrap.hidden = true; wrap.innerHTML = "";
      // без плейлистов поиск искать нечего — с введённым запросом он остаётся, чтобы его снять
      var tbP = document.querySelector(".ml-toolbar");
      if (tbP) tbP.style.display = q ? "" : "none";
      empty.hidden = false;
      empty.innerHTML = q
        ? '<div class="an-blank"><span class="an-blank__ico">' + (IC.search || "") + '</span>' +
          '<p class="an-blank__title">No playlists match your search.</p>' +
          '<div class="an-head__btns">' + btn("Clear search", "secondary", "data-lv-plclear") + "</div></div>"
        : '<div class="an-blank"><span class="an-blank__ico"><svg><use href="#ic-collections"></use></svg></span>' +
            '<p class="an-blank__title">No playlists yet</p>' +
            '<p class="an-blank__text">Build one here, or save a queue from a stream.</p>' +
            '<div class="an-head__btns">' + btn("New playlist", "primary", "data-lv-plnew") + "</div></div>";
      return;
    }
    empty.hidden = true; empty.innerHTML = "";
    var tbP2 = document.querySelector(".ml-toolbar");
    if (tbP2) tbP2.style.display = "";
    wrap.hidden = false;
    // карточки без превью: кадра у плейлиста нет, полезны имя, состав и готовность
    wrap.innerHTML = rows.map(function (p) {
      var st = plStats(p), rd = readiness(p), used = usedBy(p.id);
      return '<div class="lv-plcard" data-lv-plrow="' + p.id + '" tabindex="0" role="link" aria-label="' + UI.esc(p.name) + '">' +
        '<div class="lv-plcard__top">' +
          '<span class="lv-plcard__t">' + UI.esc(p.name) + "</span>" +
          '<button class="mc-more" type="button" data-lv-plmenu="' + p.id + '" aria-label="Actions for ' + UI.esc(p.name) + '">' +
            (IC.more || "⋮") + "</button>" +
        "</div>" +
        '<div class="lv-plcard__rd">' + rdBadge(rd) + "</div>" +
        '<div class="lv-plcard__kv">' +
          // «3 of 4 videos» вместо «4 videos · 1 off»: одна величина вместо двух, строка не переносится
          "<span>" + (IC.film || "") + (st.off ? (st.total - st.off) + " of " + st.total + " videos"
            : st.total + (st.total === 1 ? " video" : " videos")) + "</span>" +
          "<span>" + (IC.clock || "") + UI.dur(st.sec) + "</span>" +
          "<span>" + (IC.save || "") + UI.bytes(st.bytes) + "</span>" +
        "</div>" +
        '<div class="lv-plcard__foot">' +
          (used.length
            ? '<span class="lv-next__more">' +
              (IC.video || "") + "Used in " + UI.plural(used.length, "stream", "streams") + "</span>"
            : '<span class="an-muted">' + (IC.video || "") + "Not used in streams</span>") +
          '<span class="lv-plcard__upd">' + UI.dt(p.updated, TZ) + "</span>" +
        "</div></div>";
    }).join("") +
      '<button class="lv-plcard lv-plcard--new" type="button" data-lv-plnew>' + (IC.plus || "+") + "New playlist</button>";
  }

  // Черновик нового плейлиста: живёт в памяти, в список не попадает до первого сохранения.
  // Так в демо-наборе не накапливаются пустые «New playlist».
  var PL_DRAFT = null;
  // Рабочая копия сохранённого плейлиста: все правки идут в неё, в данные их переносит
  // только Save changes. Копия создаётся лениво при первом входе в редактор.
  var PL_EDIT = null;
  function plTarget() {
    var id = new URLSearchParams(location.search).get("id");
    if (id && playlist(id)) {
      if (!PL_EDIT || PL_EDIT.id !== id) {
        var real0 = playlist(id);
        PL_EDIT = { id: id, name: real0.name, items: clone(real0.items), profile: real0.profile };
      }
      return PL_EDIT;
    }
    if (!PL_DRAFT) PL_DRAFT = { id: null, name: "Untitled playlist", items: [], updated: new Date(nowMs()).toISOString() };
    return PL_DRAFT;
  }
  function plDirtySaved(p) {
    if (plIsDraft(p)) return false;
    var real = playlist(p.id);
    if (!real) return false;
    return p.name !== real.name || JSON.stringify(p.items) !== JSON.stringify(real.items);
  }
  function plIsDraft(p) { return !p.id; }
  function plById(id) {
    if (id === "draft" || id === "__draft") return PL_DRAFT;
    if (PL_EDIT && PL_EDIT.id === id) return PL_EDIT;   // в редакторе мутируется рабочая копия
    return playlist(id);
  }
  // Содержимое стрима: подготовленный плейлист либо одно видео. Одно видео описываем той же
  // моделью — очередью из одного файла, — чтобы готовность, длительность и цена считались одинаково.
  // Обложка стрима: своя загруженная либо кадр первого включённого видео
  function coverOf(s) {
    if (s.cover && s.cover.src) return s.cover.src;
    var c = content(s);
    var it = c && c.items.filter(function (i) { return !i.off; })[0];
    var f = it && file(it.fileId);
    return (f && f.cover) || null;
  }
  // превью в списках: обложка, если она есть, иначе прежняя иконка
  function coverBox(src, cls) {
    return '<span class="ml-preview' + (src ? " ml-preview--video" : "") + (cls ? " " + cls : "") + '">' +
      (src ? '<img src="' + src + '" alt="" />' : (IC.film || "")) + "</span>";
  }
  // Очередь принадлежит стриму: у неё может быть источник-плейлист, а может не быть никакого.
  // Ссылка на плейлист остаётся у старых стримов, пока их не открывали в форме.
  function content(s) {
    if (s.queue && s.queue.length) {
      var src = s.srcPl && playlist(s.srcPl);
      // цель хранится в стриме: у одного плейлиста могут быть разные эфиры
      return { id: s.srcPl && !s.detached ? s.srcPl : null, srcId: s.srcPl || null,
        name: src ? src.name : "Custom queue", items: s.queue,
        detached: !!s.detached, custom: !s.srcPl,
        profile: resProfile(s.res || (src && src.profile && src.profile.h),
          s.vert === true || s.vert === false ? s.vert : resCap({ items: s.queue }).vert) };
    }
    if (s.playlistId) return playlist(s.playlistId);
    var f = s.fileId && file(s.fileId);
    return f ? { id: null, name: f.name, items: [{ fileId: f.id, off: false }], single: true } : null;
  }
  function plDirty() { return !!(PL_DRAFT && PL_DRAFT.items.length); }
  // первое сохранение переводит черновик в список и меняет адрес на «?id=»
  function plSave(p, silent) {
    if (!plIsDraft(p)) {
      // рабочая копия переносится в данные; если плейлист в эфире — спрашиваем, когда применить
      var real = playlist(p.id);
      var wasLive = usedBy(real.id).filter(function (s) { return running(s.status); }).length;
      plApplyAsk(real, function () {
        real.name = p.name;
        real.items = clone(p.items);
        real.updated = new Date(nowMs()).toISOString();
        PL_EDIT = null;
        plRecomputeStreams(real);
        save();
        var backTo = plBackTo();
        if (!wasLive) UI.toast("Changes saved.");   // при эфире тост даёт сам диалог применения
        if (backTo) { location.href = backTo; return; }
        render();
      });
      return real;
    }
    p.id = "pl" + Date.now();
    p.updated = new Date(nowMs()).toISOString();
    S.playlists.unshift(p);
    PL_DRAFT = null;
    PL_EDIT = null;
    save();
    if (!silent) UI.toast("“" + p.name + "” saved.");
    history.replaceState(null, "", "live-playlist.html?id=" + encodeURIComponent(p.id));
    return p;
  }
  // Состояние конвертации — статус стрима, пересчитывается на изменение плейлиста
  // (RecomputeStreamConversionStateAction в бэкенде)
  function plRecomputeStreams(pl) {
    var map = { convert: "needs_conversion", busy: "converting", convfail: "conversion_failed" };
    var rd = readiness(pl);
    usedBy(pl.id).forEach(function (s) {
      if (["created", "ready", "needs_conversion", "converting", "conversion_failed"].indexOf(s.status) === -1) return;
      s.status = map[rd.state] || (s.status === "ready" ? "ready" : "created");
    });
  }
  function plLeave(href) {
    if (!plDirty()) { location.href = href; return; }
    var body = '<p class="an-modal__text">This playlist has ' +
      UI.plural(PL_DRAFT.items.length, "video", "videos") + " and hasn’t been saved yet.</p>";
    var m = modalShell("lvPlDiscard", "Discard this playlist?", body,
      btn("Keep editing", "secondary", "data-lv-close data-lv-focus") + btn("Discard", "danger", 'data-lv-do="pldiscard"'));
    m.querySelector('[data-lv-do="pldiscard"]').onclick = function () {
      PL_DRAFT = null; UI.closeModals(); location.href = href;
    };
  }
  // адрес возврата приходит параметром: пусто — обычный вход из списка плейлистов
  function plBackTo() {
    var v = new URLSearchParams(location.search).get("back");
    return v && /^live-[a-z-]+\.html(\?[\w=&%.-]*)?$/.test(v) ? v : "";
  }
  function renderPlEditor(p) {
    var host = document.querySelector("[data-lv-pleditor]");
    if (!host) return;
    p = p || plTarget();
    var draft = plIsDraft(p);
    var st = plStats(p), rd = readiness(p), used = draft ? [] : usedBy(p.id);
    var live = used.filter(function (s) { return running(s.status); });
    var ghost = { status: "created", onAir: null, playback: { shuffle: false } };
    document.title = p.name + " — SubSub";
    var dirty = plDirtySaved(p);
    var busyPl = rd.state === "busy";
    // конвертация автоматическая: needconv запуску не мешает — как и на карточке стрима
    var startOff = !st.count ? T.emptyPl
      : dirty ? "Save your changes first."
      : (rd.state === "cant" || rd.state === "convfail") ? rd.text : "";
    // праймари зависит от состояния, одновременно чёрная кнопка одна (Э5 / Э9)
    var acts = "";
    if (draft) {
      acts = btn("Save playlist", "primary", "data-lv-plsave");
    } else if (busyPl) {
      acts = "";                                     // конвертация идёт: праймари нет
    } else if (dirty) {
      acts = btn("Save changes", "primary", "data-lv-plsave") +
        '<button class="an-btn an-btn--secondary an-btn--small is-off" type="button" aria-disabled="true" ' +
          'data-tip="Save your changes first.">Start stream</button>';
    } else {
      acts = '<button class="an-btn an-btn--primary an-btn--small' + (startOff ? " is-off" : "") +
        '" type="button" data-lv-plstart="' + p.id + '"' +
        (startOff ? ' aria-disabled="true" data-tip="' + UI.esc(startOff) + '"' : "") + ">Start stream</button>";
    }
    acts += draft
      ? '<button class="mc-more" type="button" data-lv-plmenu="draft" aria-label="More actions">' + (IC.more || "⋮") + "</button>"
      : '<button class="mc-more" type="button" data-lv-plmenu="' + p.id + '" aria-label="More actions">' + (IC.more || "⋮") + "</button>";
    host.innerHTML =
      (plBackTo()
        ? '<button class="an-back" type="button" data-lv-plbackform>' + (IC.chevLeft || "") + "Back to stream setup</button>"
        : '<button class="an-back" type="button" data-lv-plback>' + (IC.chevLeft || "") + "Back to playlists</button>") +
      '<div class="lv-dhead"><div class="lv-dhead__l">' +
        '<div class="lv-dtitle">' +
          (draft
            ? '<input class="lv-dtitle__inp" type="text" value="' + UI.esc(p.name === "Untitled playlist" ? "" : p.name) +
              '" placeholder="Untitled playlist" data-lv-plname aria-label="Playlist name" />'
            : '<h1 class="lv-dtitle__n">' + UI.esc(p.name) + "</h1>" +
              '<button class="lv-dtitle__edit" type="button" data-lv-plrename="' + p.id + '" aria-label="Rename playlist">' + (IC.pencil || "") + "</button>") +
          rdBadge(rd) +
          (live.length
            ? '<span class="ml-tag ml-tag--muted" tabindex="0" data-tip="Changes ask you when to apply them.">On air in ' +
              UI.plural(live.length, "stream", "streams") + "</span>"
            : "") +
          (draft ? '<span class="ml-tag ml-tag--muted">Not saved</span>'
            : dirty ? '<span class="ml-tag ml-tag--muted">Unsaved changes</span>'
            : '<span class="an-hint">All changes saved</span>') + "</div>" +
        '<div class="lv-dmeta"><span>' + st.count + (st.count === 1 ? " video" : " videos") + " · " + UI.dur(st.sec) + " · " + UI.bytes(st.bytes) +
          (st.off ? " · " + st.off + " off" : "") + "</span>" +
          "<span>" + (draft ? "Not saved yet" : used.length ? "Used in " + UI.plural(used.length, "stream", "streams") + ":" : "Not used in streams") + "</span>" +
          (!draft && used.length
            ? '<span class="lv-usetags">' + used.map(function (s) {
                return '<a class="ml-tag ml-tag--muted lv-usetag" href="' + streamHref(s) + '">' + UI.esc(s.name) + "</a>";
              }).join("") + "</span>"
            : "") +
        "</div></div>" +
        '<div class="lv-dacts">' + acts + "</div></div>" +
      '<section class="rp-card">' +
        '<div class="lv-card__h"><h2 class="lv-card__t">Videos</h2>' +
          '<span class="lv-card__sub">Loop and shuffle belong to the stream, not to the playlist.</span>' +
          '<span class="lv-card__acts">' + readyPanel(rd, true) +
            (busyPl
              ? '<button class="an-btn an-btn--secondary an-btn--small is-off" type="button" aria-disabled="true" ' +
                'data-tip="Conversion is running — the content is locked.">Add video</button>'
              : btn("Add video", "secondary", 'data-lv-act="addvideo"')) + "</span></div>" +
        '<div class="lv-card__b"><div class="lv-q" data-lv-plqueue="' + (p.id || "draft") + '">' +
          (p.items.length ? queueRows(ghost, p, null, "tech")
            : '<div class="an-blank"><p class="an-blank__title">This playlist is empty</p>' +
              '<p class="an-blank__text">An empty playlist can’t be selected in a stream. Add at least one video.</p>' +
              '<div class="an-head__btns">' + btn("Add video", "primary", 'data-lv-act="addvideo"') + "</div></div>") +
        "</div></div></section>";
    var q = host.querySelector("[data-lv-plqueue]");
    if (q) UI.dnd(q, function (order) { plReorder(p, order); });
  }

  // Изменение плейлиста, который уже в эфире: автоматически в эфир не уезжает.
  function plApplyAsk(p, apply) {
    var live = usedBy(p.id).filter(function (s) { return running(s.status); });
    if (!live.length) { apply(); return; }
    var body = '<p class="an-modal__text">' + UI.plural(live.length, "stream is", "streams are") +
      " on air with “" + UI.esc(p.name) + "”: " + UI.esc(live.map(function (s) { return s.name; }).join(", ")) + ".</p>" +
      '<div class="lv-kv"><label class="lv-radio is-active"><input type="radio" name="lvPlApply" value="now" checked />' +
        '<span>Apply to live streams now<span class="lv-radio__d">The tail of the queue changes; the video on air is not touched.</span></span></label>' +
      '<label class="lv-radio"><input type="radio" name="lvPlApply" value="next" />' +
        '<span>Apply from the next run<span class="lv-radio__d">Live streams keep the current queue until they restart.</span></span></label></div>';
    var m = modalShell("lvPlApply", "Save playlist changes?", body,
      btn("Cancel", "secondary", "data-lv-close data-lv-focus") + btn("Save", "primary", 'data-lv-do="plapply"'));
    m.querySelector('[data-lv-do="plapply"]').onclick = function () {
      var mode = m.querySelector('input[name="lvPlApply"]:checked');
      UI.closeModals();
      apply();
      UI.toast(mode && mode.value === "next"
        ? "Playlist saved — live streams keep the current queue until the next run."
        : "Playlist saved — changes apply to live streams immediately.");
    };
  }
  function plReorder(p, order) {
    // порядок меняется в рабочей копии; в данные его переносит Save changes
    p.items = order.map(function (fid) {
      return p.items.filter(function (i) { return i.fileId === fid; })[0] || { fileId: fid, off: false };
    });
    renderPlEditor();
  }
  // Подготовка к стриму: пресет выбирается явно, автоминимум убран. По умолчанию подсвечен
  // пресет большинства файлов; 2160p и 480p спрятаны за More resolutions.
  var PREP_MAIN = [1080, 2560, 720], PREP_MORE = [3840, 480];
  // по умолчанию берём пресет, в который уже попадает большинство файлов
  function prepDefault(pl) {
    var capD = resCap(pl).row;
    if (capD) return capD;                     // выше самого маленького файла не поднимаемся
    var counts = {};
    pl.items.filter(function (i) { return !i.off; }).forEach(function (i) {
      var f = file(i.fileId);
      if (f && f.q) { var r = resRow(f.q.h, f.q.w); counts[r] = (counts[r] || 0) + 1; }
    });
    var best = 1080, n = -1;
    Object.keys(counts).forEach(function (r) {
      if (counts[r] > n || (counts[r] === n && Number(r) > best)) { best = Number(r); n = counts[r]; }
    });
    return PRESETS.indexOf(best) !== -1 ? best : 1080;
  }
  function prepLabel(r) { return resLabel(r); }
  // есть ли что конвертировать: нелечимые файлы этому не мешают
  function prepAny(pl) {
    var prof = profileOf(pl);
    return (pl && pl.items || []).some(function (i) {
      return !i.off && fileState(file(i.fileId), prof) === "needconv";
    });
  }
  function askPrepare(pl) {
    var sel = prepDefault(pl), more = true;   // все пять пресетов видны сразу
    var used = usedBy(pl.id || "");
    function affected() {
      return pl.items.filter(function (i) {
        if (i.off) return false;
        var f = file(i.fileId);
        return f && f.q && resRow(f.q.h, f.q.w) !== sel;
      }).length;
    }
    function body() {
      var list = more ? PRESETS : PREP_MAIN;   // раскрытый список идёт по убыванию разрешения
      var capP = resCap(pl), capWhyP = resCapWhy(capP);
      var mains = list.map(function (r) {
        var offP = capP.row && r > capP.row;
        return '<button class="nc-seg__btn' + (sel === r ? " is-active" : "") + (offP ? " is-off" : "") +
          '" type="button"' + (offP ? ' aria-disabled="true" data-tip="' + UI.esc(capWhyP) + '"' : ' data-lv-preset="' + r + '"') +
          (sel === r ? ' aria-current="true"' : "") + ">" + prepLabel(r) + "</button>";
      }).join("");
      var mores = "";
      var n = affected();
      return '<div class="lv-kv" style="align-items:flex-start"><span class="lv-pop__t">Target resolution</span>' +
        '<div class="nc-seg cc-seg" role="group" aria-label="Target resolution" style="width:auto;align-self:flex-start">' + mains + mores + "</div>" +
        "</div>" +
        '<p class="an-hint">' + UI.plural(n, "file", "files") + " will be re-encoded · about 8 min · originals are kept</p>" +
        '<p class="an-modal__text">Conversion aligns resolution, frame rate and bitrate to the stream profile. ' +
        "Codecs and the audio track stay as they are. Originals are kept in the media library.</p>" +
        (used.length ? '<p class="an-modal__text"><b>This playlist is used in ' + UI.plural(used.length, "stream", "streams") + ".</b></p>" : "");
    }
    var m = modalShell("lvPrep", "Prepare for streaming", body(),
      btn("Cancel", "secondary", "data-lv-close data-lv-focus") + btn("Start conversion", "primary", 'data-lv-do="prep"'));
    function rerender() { m.querySelector(".an-modal__body").innerHTML = body(); }
    m.addEventListener("click", function (e) {
      var pb = e.target.closest && e.target.closest("[data-lv-preset]");
      if (pb) { sel = Number(pb.getAttribute("data-lv-preset")); rerender(); return; }
      if (e.target.closest && e.target.closest("[data-lv-presetmore]")) { more = true; rerender(); }
    });
    m.querySelector('[data-lv-do="prep"]').onclick = function () {
      var n = 0;
      pl.items.forEach(function (i) {
        if (i.off) return;
        var f = file(i.fileId);
        if (f && f.q && Math.min(f.q.w, f.q.h) !== sel && ["ready", "needconv"].indexOf(fileState(f, profileOf(pl))) !== -1) {
          f.state = "converting"; f.progress = 15 + (n * 25) % 60; n++;
        }
      });
      var real = pl.id ? playlist(pl.id) : null;
      if (real) plRecomputeStreams(real);
      save(); UI.closeModals(); render();
      UI.toast("Conversion started — " + UI.plural(n, "file re-encodes", "files re-encode") + " to " + prepLabel(sel) + ".");
    };
  }
  function plClearAllAsk(p) {
    var m = modalShell("lvClear", "Clear all videos?",
      '<p class="an-modal__text">The queue empties in the editor — nothing changes until you press <b>Save changes</b>.</p>',
      btn("Cancel", "secondary", "data-lv-close data-lv-focus") + btn("Clear all", "danger", 'data-lv-do="plclear"'));
    m.querySelector('[data-lv-do="plclear"]').onclick = function () {
      p.items = [];
      UI.closeModals(); renderPlEditor();
    };
  }
  function plEditorMenu(p, anchor) {
    if (plIsDraft(p)) {
      UI.menu(anchor, [
        { label: "Discard", icon: IC.trash, danger: true, onClick: function () { plLeave("live-playlists.html"); } }
      ]);
      return;
    }
    var rd = readiness(p);
    var busyPl = rd.state === "busy";
    var busyWhy = busyPl ? "Conversion is running — the content is locked." : "";
    var used = usedBy(p.id), live = used.filter(function (s) { return running(s.status); });
    UI.menu(anchor, [
      { label: "Duplicate", icon: IC.copy, onClick: function () {
        var copy = clone(playlist(p.id));
        copy.id = "pl" + Date.now();
        copy.name = p.name + " (copy)";
        copy.updated = new Date(nowMs()).toISOString();
        S.playlists.unshift(copy); save();
        UI.toast("“" + copy.name + "” created.");
      } },
      { label: "Prepare for streaming", icon: IC.restart,
        // часть файлов может быть нелечимой — остальные это конвертировать не мешает
        off: busyPl || !prepAny(p),
        reason: busyPl ? busyWhy : !prepAny(p) ? "Nothing to convert in this playlist." : "",
        onClick: function () { askPrepare(playlist(p.id) || p); } },
      { label: "Clear all", icon: IC.restart, off: busyPl, reason: busyWhy,
        onClick: function () { plClearAllAsk(p); } },
      { sep: true },
      { label: "Delete", icon: IC.trash, danger: true,
        off: busyPl || !!live.length,
        reason: busyPl ? busyWhy : live.length ? "The playlist is on air — stop the stream first." : "",
        onClick: function () { plDelete(playlist(p.id)); } }
    ]);
  }
  function plMenu(p, anchor) {
    var used = usedBy(p.id);
    var live = used.filter(function (s) { return running(s.status); });
    UI.menu(anchor, [
      { label: "Edit", icon: IC.edit, onClick: function () { location.href = "live-playlist.html?id=" + encodeURIComponent(p.id); } },
      { label: "Duplicate", icon: IC.copy, onClick: function () {
        var copy = clone(p);
        copy.id = "pl" + Date.now();
        copy.name = p.name + " (copy)";
        copy.updated = new Date(nowMs()).toISOString();
        S.playlists.unshift(copy); save(); render();
        UI.toast("“" + copy.name + "” created.");
      } },
      { label: "Start stream", icon: IC.play,
        off: !p.items.filter(function (i) { return !i.off; }).length,
        reason: T.needVideo,
        onClick: function () { plStart(p); } },
      { label: "Rename", icon: IC.pencil, onClick: function () { plRename(p); } },
      { sep: true },
      { label: "Delete", icon: IC.trash, danger: true,
        off: !!live.length,
        reason: live.length ? "This playlist is on air — stop the stream first." : "",
        onClick: function () { plDelete(p, used); } }
    ]);
  }
  function plRename(p) {
    var body = '<label class="lv-pop__t" for="lvPlName">Playlist name</label>' +
      '<input class="an-input" id="lvPlName" type="text" value="' + UI.esc(p.name) + '" />';
    var m = modalShell("lvPlRn", "Rename playlist", body,
      btn("Cancel", "secondary", "data-lv-close") + btn("Save", "primary", 'data-lv-do="plrn" data-lv-focus'));
    m.querySelector('[data-lv-do="plrn"]').onclick = function () {
      var v = m.querySelector("#lvPlName").value.trim();
      if (!v) { UI.toast("Name can’t be empty"); return; }
      p.name = v; p.updated = new Date(nowMs()).toISOString();
      save(); UI.closeModals(); render(); UI.toast("Playlist renamed.");
    };
  }
  // 8 · Delete playlist used in streams
  function plDelete(p, used) {
    var body = used.length
      ? '<p class="an-modal__text">' + UI.plural(used.length, "stream", "streams") +
        " will move to Draft: " + UI.esc(used.map(function (s) { return s.name; }).join(", ")) +
        ". The files stay in Media Library.</p>"
      : '<p class="an-modal__text">The files stay in Media Library.</p>';
    var m = modalShell("lvPlDel", "Delete this playlist?", body,
      btn("Cancel", "secondary", "data-lv-close data-lv-focus") + btn("Delete", "danger", 'data-lv-do="pldel"'));
    m.querySelector('[data-lv-do="pldel"]').onclick = function () {
      S.playlists = S.playlists.filter(function (x) { return x.id !== p.id; });
      // стрим не ломается: он теряет контент, и запуск блокируется готовностью
      used.forEach(function (s) { s.playlistId = null; });
      save(); UI.closeModals();
      UI.toast("“" + p.name + "” deleted.");
      if (new URLSearchParams(location.search).get("id")) { location.href = "live-playlists.html"; return; }
      render();
    };
  }
  // Стрим из плейлиста: имя НЕ наследуется, оно только предлагается в поле формы.
  function plStart(p) {
    if (!p.items.filter(function (i) { return !i.off; }).length) { UI.toast(T.emptyPl); return; }
    location.href = "live-stream-create.html?playlist=" + encodeURIComponent(p.id);
  }


  // ============================================================ Э3 · форма стрима
  // Черновик формы держим в памяти: перезагрузка страницы начинает заполнение заново,
  // зато нет риска, что недособранный стрим утечёт в состояние раздела.
  var FORM = null;
  // id зоны → города в подписи, как в системном выборе Windows
  var TZS = [
    { id: "Pacific/Honolulu", cities: "Hawaii" },
    { id: "America/Los_Angeles", cities: "Pacific Time — US & Canada" },
    { id: "America/Chicago", cities: "Central Time — US & Canada" },
    { id: "America/New_York", cities: "Eastern Time — US & Canada" },
    { id: "America/Sao_Paulo", cities: "Brasilia" },
    { id: "UTC", cities: "Coordinated Universal Time" },
    { id: "Europe/London", cities: "Dublin, Edinburgh, Lisbon, London" },
    { id: "Europe/Berlin", cities: "Amsterdam, Berlin, Rome, Vienna" },
    { id: "Europe/Warsaw", cities: "Sarajevo, Skopje, Warsaw, Zagreb" },
    { id: "Europe/Kyiv", cities: "Kyiv, Riga, Sofia, Tallinn, Vilnius" },
    { id: "Europe/Istanbul", cities: "Istanbul" },
    { id: "Asia/Dubai", cities: "Abu Dhabi, Muscat" },
    { id: "Asia/Kolkata", cities: "Chennai, Kolkata, Mumbai, New Delhi" },
    { id: "Asia/Singapore", cities: "Kuala Lumpur, Singapore" },
    { id: "Asia/Tokyo", cities: "Osaka, Sapporo, Tokyo" },
    { id: "Australia/Sydney", cities: "Canberra, Melbourne, Sydney" }
  ];
  // смещение в минутах: спрашиваем у Intl, поэтому лето и зима считаются сами
  function tzOffMin(id) {
    try {
      var s = new Intl.DateTimeFormat("en-GB", { timeZone: id, timeZoneName: "longOffset" })
        .format(new Date(nowMs()));
      var m = /GMT([+-])(\d{2}):(\d{2})/.exec(s);
      if (!m) return 0;
      return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
    } catch (e) { return 0; }
  }
  // «(UTC+03:00)» в поле; города остаются второй строкой в списке опций
  function tzOffLabel(id) {
    var off = tzOffMin(id), sign = off < 0 ? "-" : "+", abs = Math.abs(off);
    var hh = String(Math.floor(abs / 60)), mm = String(abs % 60);
    if (hh.length < 2) hh = "0" + hh;
    if (mm.length < 2) mm = "0" + mm;
    return "UTC" + sign + hh + ":" + mm;
  }
  function tzLabel(id) {
    var z = TZS.filter(function (x) { return x.id === id; })[0];
    var off = tzOffMin(id), sign = off < 0 ? "-" : "+", abs = Math.abs(off);
    var hh = String(Math.floor(abs / 60));
    if (hh.length < 2) hh = "0" + hh;
    var mm = String(abs % 60);
    if (mm.length < 2) mm = "0" + mm;
    return "(UTC" + sign + hh + ":" + mm + ") " + (z ? z.cities : id.split("/").pop().replace(/_/g, " "));
  }

  // Уход в редактор плейлиста не должен стирать набранную форму: складываем её
  // в хранилище и достаём обратно, когда редактор отпускает пользователя.
  var FORM_DRAFT_KEY = "subsub_lv_form_draft";
  // Черновик: мастер закрыли на полпути. Набор, назначение и настройки хранятся вместе
  // с самой формой, чтобы продолжить с того же шага; в списке это стрим со статусом Draft.
  function formDirty() {
    if (!FORM) return false;
    return !!(formQueue().length || (FORM.name || "").trim() || FORM.channelId ||
      (FORM.key || "").trim() || (FORM.link || "").trim());
  }
  function formSaveDraft() {
    var s = FORM.id ? stream(FORM.id) : null;
    if (!s || s.status !== "draft") {
      s = { id: "s" + Date.now(), runs: [], spentTotal: 0, metrics: {}, schedules: [] };
      S.streams.unshift(s);
    }
    s.status = "draft"; s.virtual_status = null;
    s.name = formName().trim() || FORM.nameSuggest || "Untitled stream";
    s.channelId = FORM.destMode === "connected" ? FORM.channelId : null;
    s.dest = FORM.destMode === "connected" ? { mode: "connected" } : { mode: "manual", key: (FORM.key || "").trim(), link: (FORM.link || "").trim() };
    s.queue = clone(formQueue()); s.srcPl = FORM.srcPl || null; s.detached = !!FORM.detached;
    s.playback = { loop: FORM.loop, shuffle: FORM.shuffle }; s.loopLimit = FORM.loop ? FORM.loopLimit : 0;
    s.res = formRes() || null; s.vert = formVert(); s.backup = !!FORM.backup;
    s.draftForm = clone(FORM); s.draftStep = WZ.step; s.draftMax = WZ.max;
    save();
    UI.toast("“" + s.name + "” saved as a draft.");
    return s;
  }
  // Уход из мастера: правка существующего стрима уходит молча, как и раньше; недособранный
  // новый стрим или открытый черновик — спрашиваем, оставить ли его черновиком (Э9, диалог 13)
  function formLeave(href) {
    var cur = FORM && FORM.id ? stream(FORM.id) : null;
    var reopened = !!(cur && cur.status === "draft");
    var existing = !!(cur && !reopened);
    var to = existing ? href : "live-streams.html";
    if (existing || !formDirty()) { location.href = to; return; }
    var body = '<p class="an-modal__text">' + (reopened
      ? "The draft keeps what you had before this visit unless you save it again."
      : UI.plural(plStats(formQueuePl()).count, "video", "videos") + " and the settings you’ve filled in can stay as a draft — it shows in the list with a <b>Draft</b> badge and opens here again.") + "</p>";
    var m = modalShell("lvLeave", reopened ? "Leave the draft?" : "Leave the setup?", body,
      btn("Keep editing", "secondary", "data-lv-close data-lv-focus") +
      btn(reopened ? "Discard changes" : "Discard", "danger", 'data-lv-do="leavediscard"') +
      btn(reopened ? "Save draft" : "Save as draft", "primary", 'data-lv-do="leavedraft"'));
    m.querySelector('[data-lv-do="leavedraft"]').onclick = function () {
      UI.closeModals(); UI.storeDel(FORM_DRAFT_KEY); formSaveDraft(); location.href = to;
    };
    m.querySelector('[data-lv-do="leavediscard"]').onclick = function () {
      UI.closeModals(); UI.storeDel(FORM_DRAFT_KEY); location.href = to;
    };
  }
  function formStash(step) {
    UI.storeSet(FORM_DRAFT_KEY, { form: FORM, step: step || WZ.step });
  }
  function formUnstash() {
    var d = UI.storeGet(FORM_DRAFT_KEY, null);
    if (!d || !d.form) return null;
    UI.storeDel(FORM_DRAFT_KEY);
    return d;
  }
  function formInit() {
    var back = formUnstash();
    if (back) {
      FORM = back.form;
      WZ.step = back.step || 1;
      WZ.max = Math.max(WZ.max, WZ.step);
      return;
    }
    var id = new URLSearchParams(location.search).get("id");
    var s = id ? stream(id) : null;
    if (s && s.status === "draft" && s.draftForm) {
      // черновик продолжается с того шага, на котором его оставили
      FORM = clone(s.draftForm);
      FORM.id = s.id;
      WZ.step = s.draftStep || 1;
      WZ.max = Math.max(WZ.max, s.draftMax || WZ.step);
      return;
    }
    if (s) {
      var pl = content(s);
      FORM = {
        id: s.id, name: s.name, channelId: s.channelId,
        destMode: s.dest.mode, key: s.dest.key || "", link: s.dest.link || "",
        // очередь стрима: своя, либо копия плейлиста, либо один файл прежней модели
        queue: s.queue ? clone(s.queue) : pl ? clone(pl.items) : [],
        srcPl: s.queue ? (s.srcPl || null) : (s.playlistId || null),
        detached: s.queue ? !!s.detached : false,
        cover: (s.cover && s.cover.src) || null, ytThumb: !!s.ytThumb, desc: s.desc || "",
        res: s.res || resCap(pl).row || null,
        vert: s.vert === true || s.vert === false ? s.vert : null,
        loop: s.playback.loop, shuffle: s.playback.shuffle,
        startMode: (s.schedules || []).length ? "schedule" : "now",
        // окна сохранённого стрима — уже решение человека, пересчёт их не переписывает
        schedules: (clone(s.schedules || [])).map(function (x) { x.endSet = true; return x; }),
        loopLimit: s.loopLimit || 0,
        backup: !!s.backup, tz: TZ, editStatus: s.status
      };
      // прямая ссылка на шаг: «Edit slot» с карточки открывает расписание
      var stq0 = Number(new URLSearchParams(location.search).get("step"));
      if (stq0 >= 1 && stq0 <= WZ_STEPS.length) { WZ.step = stq0; WZ.max = WZ_STEPS.length; }
    } else {
      FORM = {
        id: null, name: "", channelId: null, destMode: "connected", key: "", link: "",
        queue: [], srcPl: null, detached: false, loop: true, shuffle: false,
        res: null,
        cover: null, ytThumb: true, desc: "",
        startMode: "schedule", schedules: [], loopLimit: 0, backup: false, tz: TZ, editStatus: null
      };
      formAddSlot();          // окно, повтор и зона видны сразу, без раскрытия
      var qp = new URLSearchParams(location.search);
      // вход из плейлиста: состав копируется в очередь, источник запоминается
      var plq = qp.get("playlist");
      if (plq && playlist(plq)) formPickPlaylist(plq);
      // вход из папки медиатеки: очередь из её видео в порядке папки
      var fol = qp.get("folder");
      if (fol) {
        var fo = F.folders.filter(function (x) { return x.id === fol; })[0];
        // порядок папки — это порядок её fileIds; в очередь попадают только видео
        var inFolder = (fo ? fo.fileIds : []).map(function (fid0) { return file(fid0); })
          .filter(function (f) { return f && f.container === "mp4"; });
        if (inFolder.length) {
          FORM.queue = inFolder.map(function (f) { return { fileId: f.id, off: false }; });
          FORM.nameSuggest = fo.name;
        }
      }
      // вход из медиатеки: один файл или набор
      var one = qp.get("file"), many = qp.get("files");
      var picked = (many ? many.split(",") : one ? [one] : []).filter(function (id) { return !!file(id); });
      if (picked.length) {
        FORM.queue = picked.map(function (id) { return { fileId: id, off: false }; });
        if (!FORM.nameSuggest) FORM.nameSuggest = file(picked[0]).name.replace(/\.[a-z0-9]+$/i, "");
      }
      // вход из календаря: окно и канал уже выбраны
      if (qp.get("start") && qp.get("end")) {
        FORM.startMode = "schedule";
        // окно выбрано человеком в календаре: длина проходов его не переписывает
        FORM.schedules = [{ id: "sl" + Date.now(), start: qp.get("start"), end: qp.get("end"),
          tz: TZ, repeat: { type: "none" }, endSet: true }];
      }
      var chq = qp.get("channel");
      if (chq && chan(chq)) FORM.channelId = chq;
      // вход «Use a stream key instead» из первых шагов
      if (qp.get("dest") === "manual") FORM.destMode = "manual";
      // прямая ссылка на шаг: правка слота с карточки открывает расписание
      var stq = Number(qp.get("step"));
      if (stq >= 1 && stq <= WZ_STEPS.length) { WZ.step = stq; return; }
      // человек попадает на первый незаполненный шаг, пройденные открыты
      for (var wi = 1; wi <= WZ_STEPS.length; wi++) {
        if (wizBlocked(wi)) { WZ.step = wi; break; }
        WZ.step = Math.min(WZ_STEPS.length, wi + 1);
      }
      WZ.max = Math.max(WZ.max, WZ.step);
    }
  }
  // то же содержимое, но из состояния формы: черновик нового плейлиста, готовый плейлист или файл
  function formPl() { return formQueue().length ? formQueuePl() : null; }
  function formPseudo() {
    return {
      id: FORM.id || "form", name: FORM.name, channelId: FORM.channelId,
      dest: { mode: FORM.destMode, key: FORM.key },
      queue: formQueue(), srcPl: FORM.srcPl, detached: !!FORM.detached,
      playlistId: null, fileId: null,
      cover: FORM.cover ? { src: FORM.cover, uploaded: true } : null, ytThumb: FORM.ytThumb,
      res: formRes() || null, vert: formVert(),
      playback: { loop: FORM.loop, shuffle: FORM.shuffle }, loopLimit: FORM.loop ? FORM.loopLimit : 0,
      backup: FORM.backup, status: "created", schedules: FORM.startMode === "schedule" ? FORM.schedules : [],
      spentTotal: 0, metrics: {}, runs: []
    };
  }
  // чего не хватает для отправки — одна причина на смысл
  function formBlock() {
    var a = acc();
    if (!formName().trim()) {
      return { reason: FORM.destMode === "manual" ? "Paste the stream link to continue" : "Name the stream to continue" };
    }
    if (FORM.destMode === "connected" && !FORM.channelId) return { reason: T.needChannel };
    if (FORM.destMode === "manual" && !FORM.key.trim()) return { reason: T.needChannel };
    var pl = formPl();
    if (!pl) return { reason: FORM.contentMode === "video" ? T.needFileForm : T.needPlaylist };
    var rdf = readiness(pl);
    if (rdf.state === "none") return { reason: T.readyNone };
    if (rdf.state === "cant" || rdf.state === "convfail") return { reason: rdf.text };
    if (FORM.startMode === "schedule" && !FORM.schedules.length) return { reason: "Add at least one slot or start the stream now" };
    if (FORM.startMode === "schedule") {
      var ps2 = formPseudo();
      for (var bi = 0; bi < FORM.schedules.length; bi++) {
        var busy2 = channelBusy(ps2, FORM.schedules[bi]);
        if (busy2) return { reason: busy2.msg };
      }
    }
    // нулевой баланс мешает запуску, но не созданию: расписание сохранить можно
    if (FORM.startMode === "now" && a.kind === "money" && a.balance <= 0) return { reason: T.balanceEmpty, act: T.topUp };
    return null;
  }
  function seg(name, opts, active, attr) {
    return '<div class="nc-seg cc-seg" role="group" aria-label="' + UI.esc(name) + '">' +
      opts.map(function (o) {
        return '<button class="nc-seg__btn' + (o.k === active ? " is-active" : "") + '" type="button" ' +
          attr + '="' + o.k + '"' + (o.k === active ? ' aria-current="true"' : "") + ">" + UI.esc(o.l) + "</button>";
      }).join("") + "</div>";
  }
  // Запуск с ключа: имя стрима не набирают руками — оно выводится из ссылки на эфир.
  // «https://youtube.com/live/retro-cuts-night» → «Retro Cuts Night».
  function nameFromLink(link) {
    var s = String(link || "").trim();
    if (!s) return "";
    s = s.replace(/[?#].*$/, "").replace(/\/+$/, "");
    var last = s.split("/").pop() || "";
    if (/^https?:$/i.test(last) || !last) return "";
    last = last.replace(/\.[a-z0-9]{2,4}$/i, "").replace(/[-_+]+/g, " ").trim();
    if (!last) return "";
    return last.split(/\s+/).map(function (w) {
      return w.length > 3 ? w.charAt(0).toUpperCase() + w.slice(1) : w.toUpperCase();
    }).join(" ");
  }
  // имя стрима: своё при подключённом канале, производное при ручном ключе
  function formName() {
    return FORM.destMode === "manual" ? nameFromLink(FORM.link) : FORM.name;
  }
  function formFile() { return (FORM.fileId && file(FORM.fileId)) || null; }
  // Обложка в форме: по умолчанию кадр первого видео, можно загрузить свою.
  // Чекбокс про YouTube — постановка: без OAuth и broadcast обложку туда не поставить (LV30).
  // Воспроизведение — своя поверхность в правой колонке: свойства стрима, а не содержимого
  function formPlaybackCard() {
    return '<div class="lv-sum__b">' +
      '<div class="lv-form__sub">Playback</div>' +
      '<div class="lv-playrow">' +
        '<label class="lv-pick__only"><span class="lv-ico">' + (IC.repeat || "") + "Loop</span>" +
          UI.switchHtml('data-lv-f="loop"', FORM.loop, "Loop") + "</label>" +
        '<label class="lv-pick__only"><span class="lv-ico">' + (IC.shuffle || "") + "Shuffle</span>" +
          UI.switchHtml('data-lv-f="shuffle"', FORM.shuffle, "Shuffle") + "</label>" +
        // в Play once окончание задаёт сам плейлист, лимит циклов там не нужен
        (FORM.loop
          ? '<label class="lv-pick__only"><span class="lv-ico">' + (IC.clock || "") + "Loop limit</span>" +
            UI.switchHtml('data-lv-f="loopLimitOn"', FORM.loopLimit > 0, "Loop limit") + "</label>"
          : "") +
      "</div>" +
      (FORM.loop && FORM.loopLimit > 0
        ? '<span class="an-hint">Ends after ' +
          '<input class="an-input an-input--mini" type="number" min="1" value="' +
          FORM.loopLimit + '" data-lv-f="loopLimit" /> loops' +
          (plStats(formPl()).sec ? " · ≈" + UI.dur(plStats(formPl()).sec * FORM.loopLimit) : "") + ".</span>"
        : "") +
      "</div>";
  }
  // Обложка, имя и назначение — одна строка под заголовком: три решения одного уровня
  function formBasicsRow() {
    return '<section class="rp-card"><div class="lv-card__b lv-card__b--pad lv-basicsrow">' +
      formCoverBox() +
      field("Stream name *", '<input class="an-input" type="text" value="' + UI.esc(FORM.name) +
        '" placeholder="' + UI.esc(FORM.nameSuggest || "e.g. Forza Chill Ride") + '" data-lv-f="name" />') +
      (FORM.destMode === "connected"
        ? field("Destination",
            selTrig("channel", UI.selectValue(optByValue(chanOpts(false), FORM.channelId), "Select channel"),
              { label: "Channel" }))
        : field("Stream link",
            '<input class="an-input" type="text" value="' + UI.esc(FORM.link) + '" placeholder="https://youtube.com/live/…" data-lv-f="link" />') +
          field("Stream key",
            '<input class="an-input" type="text" value="' + UI.esc(FORM.key) + '" placeholder="e.g. abcd-1234-efgh-5678" data-lv-f="key" />',
            '<button class="lv-link" type="button" data-lv-destmode="connected">Use a connected channel</button>')) +
      (F.channels.filter(function (c) { return c.connected; }).length ? "" :
        '<div class="lv-banner lv-banner--info">' + (IC.info || "") +
        "<span>No channel connected yet.</span>" +
        '<span class="lv-banner__acts">' + btn("Connect YouTube", "primary", "data-lv-connectyt") + "</span></div>") +
      "</div></section>";
  }
  // Обложка: своя загруженная либо кадр первого файла очереди. Три состояния,
  // нативный ввод спрятан — контрол не притворяется системным полем выбора файла.
  function formCoverBox() {
    var own = FORM.cover || null, auto = coverOf(formPseudo());
    var src = own || auto;
    var connected = FORM.destMode === "connected";
    // thumbnails.set требует OAuth и конкретного канала: до выбора отдавать кадр некуда
    var ytWhy = !connected ? "Connect the channel to set the YouTube thumbnail."
      : !FORM.channelId ? "Pick the channel first." : "";
    var ytOk = !ytWhy;
    var name = own ? (FORM.coverName || "Custom image") : auto ? "Frame from the first video" : "No file chosen";
    return field("Cover",
      '<div class="lv-thumbcol">' +
        '<button class="lv-file" type="button" data-lv-coverdrop ' +
          'aria-label="Upload cover — JPG or PNG, up to 2 MB">' +
          '<span class="lv-file__btn">Choose file</span>' +
          '<span class="lv-file__name' + (own ? "" : " is-ph") + '">' + UI.esc(name) + "</span>" +
          (src ? '<img class="lv-file__thumb" src="' + src + '" alt="" />' : "") +
        "</button>" +
        '<input type="file" accept="image/png,image/jpeg" data-lv-coverfile hidden />' +
        (FORM.coverErr ? '<span class="an-hint an-hint--warn">' + UI.esc(FORM.coverErr) + "</span>" : "") +
        // ограничение и галочка — одна строка: оба про обложку, а не про порядок действий
        '<div class="lv-thumbcol__b">' +
          '<label class="an-cols__row' + (FORM.ytThumb && ytOk ? " is-checked" : "") +
            (ytOk ? "" : " is-off") + '"' + (ytOk ? "" : ' aria-disabled="true" data-tip="' + UI.esc(ytWhy) + '"') + ">" +
            '<span class="an-check' + (FORM.ytThumb && ytOk ? " is-checked" : "") + '" role="checkbox" aria-checked="' +
              (FORM.ytThumb && ytOk ? "true" : "false") + '"' + (ytOk ? ' data-lv-ytthumb' : "") + ">" + (IC.check || "") + "</span>" +
            '<span class="an-cols__lbl">Set as YouTube thumbnail</span></label>' +
          '<span class="an-hint">JPG or PNG, up to 2 MB.' +
            (own ? ' · <button class="lv-link" type="button" data-lv-coverrm>Use the video frame</button>' : "") + "</span>" +
        "</div>" +
      "</div>");
  }

  // Новый плейлист собирается внутри блока Content: сохранится вместе со стримом.
  // Порядок видео задаётся вручную — стрелками; колонки выровнены по всей ширине блока.
  function formNewPlQueue() {
    var items = FORM.newPl.items;
    return '<div class="lv-form__sub">Videos in this playlist</div>' +
      (items.length
        ? '<div class="lv-q lv-plq">' + items.map(function (i, idx) {
            var f = file(i.fileId);
            if (!f) return "";
            return '<div class="lv-plq__r" data-lv-row="' + f.id + '" draggable="true">' +
              '<span class="lv-qr__i">#' + (idx + 1) + "</span>" +
              '<span class="lv-qr__grip">' + (IC.grip || "") + "</span>" +
              '<span class="lv-qr__nm">' + UI.esc(f.name) + "</span>" +
              '<span class="an-hint">' + UI.dur(f.sec) + "</span>" +
              '<span class="an-hint">' + UI.bytes(f.bytes) + "</span>" +
              fileBadge(f) +
              '<button class="mc-more' + (idx === 0 ? " is-off" : "") + '" type="button" ' +
                (idx === 0 ? 'aria-disabled="true" ' : 'data-lv-formplmv="' + f.id + ':-1" ') +
                'aria-label="Move ' + UI.esc(f.name) + ' up">' + (IC.arrowUp || "") + "</button>" +
              '<button class="mc-more' + (idx === items.length - 1 ? " is-off" : "") + '" type="button" ' +
                (idx === items.length - 1 ? 'aria-disabled="true" ' : 'data-lv-formplmv="' + f.id + ':1" ') +
                'aria-label="Move ' + UI.esc(f.name) + ' down">' + (IC.arrowDown || "") + "</button>" +
              '<button class="mc-more" type="button" data-lv-formplrm="' + f.id +
                '" aria-label="Remove ' + UI.esc(f.name) + '">' + (IC.close || "") + "</button></div>";
          }).join("") + "</div>"
        : '<span class="an-hint">' + T.needVideo + "</span>") +
      '<div class="lv-form__row">' + btn("Add video", "secondary", "data-lv-formpladd", IC.plus) +
        '<span class="an-hint" style="margin-left:auto"></span>' +
        btn("Cancel", "secondary", "data-lv-formnewplcancel") +
        btn("Save playlist", "secondary", "data-lv-formplsave") + "</div>";
  }
  function field(label, inner, hint) {
    return '<div class="ai-field"><label class="ai-lbl">' + label + "</label>" + inner +
      (hint ? '<span class="an-hint">' + hint + "</span>" : "") + "</div>";
  }
  // секции, недоступные при правке в эфире, гасим целиком с одной причиной
  function lockedInAir() { return FORM.editStatus && running(FORM.editStatus); }
  function lockAttr() {
    return lockedInAir() ? ' class="rp-card is-off" aria-disabled="true" data-tip="' + T.liveEditPlaylist + '"' : ' class="rp-card"';
  }

  // ---- Вариант «степпер»: слева карта шагов, справа текущий шаг с собственным
  // заголовком и кнопкой продолжения. Состояние шага живёт в памяти страницы.
  var WZ = { step: 1, max: 1 };
  // Порядок 31.08: контент первым — он самый тяжёлый шаг, а обложка и имя выводятся из него
  var WZ_STEPS = [
    { k: "content", t: "Content", d: "Queue and playback.", ic: "video",
      h: "Choose what goes on air.", lead: "Pick a playlist, add files from the library or upload your own, then set how they play." },
    { k: "basics", t: "Basics", d: "Name, cover and destination.", ic: "pencil",
      h: "Name the stream", lead: "The cover comes from the first file in the queue; the name is only a suggestion." },
    { k: "schedule", t: "Schedule", d: "Window and repeat rule.", ic: "calendar",
      h: "Schedule the stream", lead: "Set the window and repeat rule, or start right after creation." },
    { k: "review", t: "Review & launch", d: "Cost and launch.", ic: "wallet",
      h: "Review and launch", lead: "Check what goes live and what it costs." }
  ];

  // длительность неизвестна, пока хоть один включённый файл грузится, читается или потерян
  function queueUnknown(pl) {
    if (!pl) return true;
    return pl.items.filter(function (i) { return !i.off; }).some(function (i) {
      var st = fileState(file(i.fileId), profileOf(pl));
      return st === "uploading" || st === "processing";
    });
  }
  // ---- очередь стрима в форме: список файлов, у которого может быть источник-плейлист
  function formQueue() { return (FORM.queue = FORM.queue || []); }
  function formSrcPl() { return FORM.srcPl ? playlist(FORM.srcPl) : null; }
  // правка очереди отвязывает её от источника: плейлист неявно не меняется
  function formDetach() { if (FORM.srcPl) FORM.detached = true; }
  // цель эфира выбирается на шаге контента и хранится в стриме, а не в плейлисте
  function formProfile() { return resProfile(formRes(), formVert()); }
  // ориентация: пока человек не выбрал — та, что у большинства файлов очереди
  // тумблер вертикали: подпись, состояние и причина блокировки
  function vertToggle(pl, prof) {
    var canV = PRESETS.some(function (r) { return resFits(pl, r, true); });
    var why = "The queue is landscape — a vertical frame would need upscaling.";
    var off = canV ? "" : ' aria-disabled="true" data-tip="' + UI.esc(why) + '"';
    return '<label class="lv-pick__only lv-target__o' + (canV ? "" : " is-off") + '"' + off + ">" +
      "<span>Vertical video</span>" +
      UI.switchHtml('data-lv-f="vert"' + (canV ? "" : ' data-tip="' + UI.esc(why) + '"'), prof.vert, "Vertical video") +
      "</label>";
  }
  function formVert() {
    if (FORM.vertTouched && (FORM.vert === true || FORM.vert === false)) return FORM.vert;
    return resCap({ items: formQueue() }).vert;
  }
  // цель не может быть выше потолка очереди: при добавлении меньшего файла она опускается
  var RES_DEFAULT = 1080;
  function formRes() {
    // Пока человек не трогал выбор, цель следует за контентом: максимум, который
    // позволяет очередь, а на пустой очереди — 1080p. Тронул — держим его выбор:
    // файл ниже цели честно помечается «не выровнять».
    var cap = resCap({ items: formQueue() }).row;
    if (FORM.resTouched && RES_DIM[FORM.res]) return FORM.res;
    return cap || RES_DEFAULT;
  }
  function formQueuePl() {
    var src = formSrcPl();
    return { id: FORM.srcPl && !FORM.detached ? FORM.srcPl : null, srcId: FORM.srcPl || null,
      name: src ? src.name : "Custom queue", items: formQueue(),
      detached: !!FORM.detached, custom: !FORM.srcPl, profile: formProfile() };
  }
  function formPickPlaylist(id) {
    var p = playlist(id);
    if (!p) return;
    // берём максимум, который очередь позволяет: выше — апскейл, его не бывает
    var capP = resCap(p).row;
    if (capP) FORM.res = capP;
    FORM.queue = clone(p.items);          // копия: источник не разделяется со стримом
    FORM.srcPl = id; FORM.detached = false;
    FORM.nameSuggest = p.name;
  }

  // чего не хватает на шаге: тултип кнопки повторяет строку готовности дословно
  // Клик по заблокированной кнопке не только повторяет причину тултипом, но и метит
  // незаполненные поля. Метка снимается при первом же вводе.
  var INV_KEYS = { "Stream name": "name", "Destination": "channel", "Stream link": "link", "Stream key": "key" };
  function invCls(key) {
    if (!FORM || !FORM.showInvalid) return "";
    var miss = wizMissing(WZ.step).map(function (m) { return INV_KEYS[m]; });
    return miss.indexOf(key) === -1 ? "" : " lv-inv";
  }
  function wizMissing(n) {
    var out = [];
    var k = WZ_STEPS[n - 1].k;
    if (k === "content") {
      var q = formQueue().filter(function (i) { return !i.off; });
      if (!q.length) out.push("Video");
    }
    if (k === "basics") {
      // при ручном ключе имя выводится из ссылки, поэтому спрашиваем ссылку, а не имя
      if (FORM.destMode === "connected") {
        if (!FORM.name.trim()) out.push("Stream name");
        if (!FORM.channelId) out.push("Destination");
      } else {
        if (!FORM.link.trim()) out.push("Stream link");
        if (!FORM.key.trim()) out.push("Stream key");
      }
    }
    if (k === "schedule" && FORM.startMode === "schedule" && !FORM.schedules.length) out.push("Schedule slot");
    return out;
  }
  // строка готовности шага: то же предложение и в тултипе кнопки, и в подсказке карты
  function wizReadyLine(n) {
    var k = WZ_STEPS[n - 1].k, miss = wizMissing(n);
    if (k === "content") {
      if (!formQueue().length) return "Add at least one video.";
      if (miss.length) return "Every file in the queue is turned off.";
      var rd = readiness(formQueuePl());
      if (rd.state === "uploading" || rd.state === "processing") {
        return FORM.startMode === "now" ? "Wait for the upload to finish." : rd.text;
      }
      // файл, который не выровнять, разбирается здесь, а не на шаге расписания:
      // иначе длительность и стоимость считались бы по тому, что играть нельзя
      if (rd.state === "cant") return rd.text;
      return "";
    }
    if (k === "schedule" && FORM.startMode === "schedule") {
      var eta = convEta(formQueuePl());
      if (eta) {
        var earliest = Date.parse(eta.readyAt);
        for (var j = 0; j < FORM.schedules.length; j++) {
          if (Date.parse(FORM.schedules[j].start) < earliest) {
            return "Conversion needs about " + UI.plural(eta.min, "minute", "minutes") +
              " — move the window to " + convEtaAt(eta, FORM.schedules[j].start) + " or later.";
          }
        }
      }
      var ps = formPseudo();
      if (slotsOverlap(FORM.schedules)) return T_SELF_OVERLAP;
      var horizon = slotBeyondHorizon(FORM.schedules);
      if (horizon) return horizon;
      for (var ki = 0; ki < FORM.schedules.length; ki++) {
        var kb = keyClash(ps, FORM.schedules[ki]);
        if (kb) return kb.msg;
      }
    }
    if (miss.length) {
      return miss.length + (miss.length === 1 ? " field left: " : " fields left: ") + miss.join(", ");
    }
    return "";
  }
  // гейт: пустая строка готовности значит, что шаг можно покинуть
  function wizBlocked(n) {
    var line = wizReadyLine(n);
    if (!line) return "";
    // в режиме расписания незавершённая загрузка предупреждает, но не блокирует
    var rd = WZ_STEPS[n - 1].k === "content" ? readiness(formQueuePl()) : null;
    if (rd && FORM.startMode === "schedule" && (rd.state === "uploading" || rd.state === "processing")) return "";
    return line;
  }
  // значение пройденного шага во второй строке карты
  function wizValue(n) {
    var k = WZ_STEPS[n - 1].k;
    if (k === "content") {
      var st = plStats(formQueuePl());
      if (!st.count) return "";
      return st.count + (st.count === 1 ? " video" : " videos") + (st.sec ? " · " + UI.dur(st.sec) : "");
    }
    if (k === "basics") {
      if (FORM.destMode === "manual") return FORM.key ? "Manual key" : "";
      var ch = chan(FORM.channelId);
      return ch ? ch.name : "";
    }
    if (k === "schedule") {
      if (FORM.startMode === "now") return "Starts right after creation";
      var sl = FORM.schedules[0];
      if (!sl) return "";
      return UI.dt(sl.start, FORM.tz).replace(",", "") + " → " + UI.time(sl.end, FORM.tz);
    }
    return "";
  }
  // read-only полоса под шагами: то, что в одностраничной раскладке жило липкой сводкой
  function wizStrip() {
    var pl = formQueuePl(), st = plStats(pl), c = cost(formPseudo());
    var rd = readiness(pl);
    var unknown = queueUnknown(pl) || !st.sec;
    var runs = FORM.startMode === "schedule" ? next3All() : [];
    var perWin = c.windowH && st.sec ? Math.max(1, Math.floor(c.windowH * 3600 / st.sec)) : 0;
    if (FORM.loop && FORM.loopLimit > 0 && perWin) perWin = Math.min(FORM.loopLimit, perWin);
    var cyc = unknown ? "—"
      : UI.dur(st.sec) + (perWin ? " · " + UI.plural(FORM.loop ? perWin : 1, "run", "runs") : "");
    var next = FORM.startMode === "now" ? "Right after creation"
      : runs.length ? UI.dt(runs[0].start, FORM.tz) : "—";
    var cst = unknown || !c.windowH ? "—" : "≈" + UI.money(c.windowCost);
    return '<div class="lv-wiz__strip">' +
      '<div class="lv-wiz__srow"><span>Cycle</span><b>' + cyc + "</b></div>" +
      '<div class="lv-wiz__srow"><span>Next run</span><b>' + next + "</b></div>" +
      '<div class="lv-wiz__srow"><span>Window cost</span><b>' + cst + "</b></div>" +
      "</div>";
  }

  // Загрузка в очередь: прогресс идёт сам, затем чтение метаданных, затем вердикт профиля.
  // Файл появляется в медиатеке — очередь ссылается на него, а не хранит копию.
  var UPL_N = 0;
  // выбранные в системном диалоге файлы: имя и размер настоящие, дальше идёт демо-прогресс
  function formQueueUpload(picked) {
    var list = picked && picked.length ? [].slice.call(picked) : [null];
    list.forEach(function (real) {
      if (real && String(real.type || "").indexOf("video/") !== 0) { UI.toast("Videos only — that file was skipped."); return; }
      UPL_N++;
      var id = "up" + Date.now() + UPL_N;
      var f = { id: id, name: real ? real.name : "My Upload " + UPL_N + ".mp4",
        sec: 0, bytes: real ? real.size : 620 * 1024 * 1024,
        container: "mp4", state: "uploading", progress: 0, q: null, folderId: null, cover: null };
      F.files.push(f);
      if (DEMO) { S.extraFiles = S.extraFiles || []; S.extraFiles.push(f); save(); }
      FORM.queue.push({ fileId: id, off: false });
      formQueueTick(f);
    });
    formDetach();
    renderForm();
    UI.toast("Upload started.");
  }
  // прогресс загрузки видно там, где человек сейчас: в открытом пикере или в очереди мастера
  function uploadRedraw() {
    if (PICK && document.querySelector("[data-lv-picklist]")) { pickRender(); return; }
    if (PAGE === "form" && FORM) renderForm();
  }
  function formQueueTick(f) {
    var t = setInterval(function () {
      f.progress = Math.min(100, f.progress + 20);
      if (f.progress >= 100) {
        clearInterval(t);
        f.state = "processing";                       // метаданные читаются после загрузки
        setTimeout(function () {
          f.state = "ready"; f.sec = 1500;
          f.q = { w: 1920, h: 1080, fps: 30, vcodec: "h264", acodec: "aac", ac: 2, ar: 44100, audio: true };
          if (DEMO) save();
          uploadRedraw();
        }, 1600);
      }
      uploadRedraw();
    }, 700);
  }

  // Диалог Э9-12: одна формулировка на смысл, ветка обновления живёт по правилам общих данных
  function formSaveAsPlaylistAsk() {
    var src = formSrcPl();
    var suggested = (FORM.name || "").trim() || FORM.nameSuggest || "";
    var used = src ? usedBy(src.id) : [];
    var live = used.filter(function (s) { return running(s.status); });
    var body = '<div class="lv-kv" data-lv-qsname><label class="lv-pop__t" for="lvQsName">Playlist name</label>' +
      '<input class="an-input" id="lvQsName" type="text" value="' + UI.esc(suggested) + '" placeholder="e.g. Racing Marathon" /></div>' +
      (src
        ? '<div class="lv-kv lv-kv--group"><span class="lv-pop__t">Where to save</span>' +
            '<label class="lv-radio is-active"><input type="radio" name="lvQsMode" value="new" checked />' +
              "<span>Create a new playlist</span></label>" +
            '<label class="lv-radio"><input type="radio" name="lvQsMode" value="update" />' +
              '<span>Update “' + UI.esc(src.name) + '”' +
              '<span class="lv-radio__d">This playlist is used in ' + UI.plural(used.length, "stream", "streams") + ".</span></span></label>" +
          "</div>" +
          (live.length
            ? '<div class="lv-kv lv-kv--group" data-lv-qsapply hidden><span class="lv-pop__t">When to apply</span>' +
                '<label class="lv-radio is-active"><input type="radio" name="lvQsApply" value="now" checked />' +
                  "<span>Apply to live streams now</span></label>" +
                '<label class="lv-radio"><input type="radio" name="lvQsApply" value="next" />' +
                  "<span>Apply from the next run</span></label></div>"
            : "")
        : "") +
      '<p class="an-hint" data-lv-qsdup hidden>A playlist with this name already exists.</p>';
    var m = modalShell("lvQsave", "Save this queue as a playlist?", body,
      btn("Cancel", "secondary", "data-lv-close") + btn("Save playlist", "primary", 'data-lv-do="qsave" data-lv-focus'));
    var inp = m.querySelector("#lvQsName");
    var dup = m.querySelector("[data-lv-qsdup]");
    function syncDup() {
      var v = inp.value.trim().toLowerCase();
      dup.hidden = !v || !S.playlists.filter(function (p) { return p.name.toLowerCase() === v; }).length;
    }
    inp.addEventListener("input", syncDup);
    syncDup();
    var applyBox = m.querySelector("[data-lv-qsapply]");
    if (applyBox) {
      m.addEventListener("change", function () {
        var mode = m.querySelector('input[name="lvQsMode"]:checked');
        applyBox.hidden = !mode || mode.value !== "update";
      });
    }
    // имя нужно только новому плейлисту: при обновлении существующий его не меняет
    var nameBox = m.querySelector("[data-lv-qsname]");
    m.addEventListener("change", function () {
      var mode = m.querySelector('input[name="lvQsMode"]:checked');
      var upd = mode && mode.value === "update";
      if (nameBox) nameBox.hidden = upd;
      if (upd) dup.hidden = true; else syncDup();
    });
    m.querySelector('[data-lv-do="qsave"]').onclick = function () {
      var mode = m.querySelector('input[name="lvQsMode"]:checked');
      var items = clone(formQueue());
      if (src && mode && mode.value === "update") {
        // обновляется только состав: имя плейлиста остаётся своим
        var real = playlist(src.id);
        real.items = items; real.updated = new Date(nowMs()).toISOString();
        FORM.detached = false;
        plRecomputeStreams(real);
        save(); UI.closeModals(); renderForm();
        UI.toast("“" + real.name + "” updated.");
        return;
      }
      var name = inp.value.trim();
      if (!name || /^untitled playlist$/i.test(name)) { UI.toast("Name the playlist to save it."); return; }
      var np = { id: "pl" + Date.now(), name: name, items: items, updated: new Date(nowMs()).toISOString() };
      S.playlists.unshift(np);
      FORM.srcPl = np.id; FORM.detached = false;
      save(); UI.closeModals(); renderForm();
      UI.toast("“" + name + "” saved.");
    };
  }

  // ================= шаг 1 · Content =================
  function wizContent() {
    var pl = formQueuePl(), st = plStats(pl), rd = readiness(pl), q = formQueue();
    var src = formSrcPl();
    // итоги переехали под таблицу: в шапке остаются готовность и действия
    var foot = q.length
      ? '<div class="lv-qfoot"><span class="lv-card__sub">' + st.count + (st.count === 1 ? " video" : " videos") +
          (st.off ? " · " + st.off + " off" : "") + " · " + UI.dur(st.sec) + " · " + UI.bytes(st.bytes) + "</span></div>"
      : "";
    // общий бейдж готовности снят: состояние видно в каждой строке, а проблема —
    // в предупреждении над таблицей. Слева бейджи и ссылки, справа кнопки наполнения.
    var head = q.length
      ? '<div class="lv-qhead">' +
          '<span class="lv-qhead__l">' +
            // источник очереди назван по имени; своя очередь называется так же, как
            // её зовёт модель в остальных местах — «Custom queue»
            '<span class="lv-card__t">' + UI.esc(src ? src.name : "Custom queue") + "</span>" +
            (FORM.detached && src ? '<span class="ml-tag ml-tag--brand" data-tip="The queue no longer matches “' + UI.esc(src.name) + '”." tabindex="0">Playlist detached</span>' +
              '<button class="lv-link" type="button" data-lv-qreset data-tip="Bring the queue back to “' + UI.esc(src.name) + '”.">Reset queue</button>' : "") +
            // сохранять нечего, пока очередь совпадает со своим плейлистом
            (!FORM.srcPl || FORM.detached
              ? '<button class="lv-link" type="button" data-lv-qsave>Save as playlist</button>' : "") +
            // при шафле порядок не имеет смысла: ручки и стрелки скрыты, а причина названа
            (FORM.shuffle && q.length > 1 ? '<span class="an-hint">Order is ignored while Shuffle is on.</span>' : "") +
          "</span>" +
          '<span class="lv-qhead__acts">' +
            btn("Add from library", "secondary", "data-lv-qadd", IC.folder, "tiny") +
            btn("Upload", "secondary", "data-lv-qupload", IC.upload, "tiny") +
            btn("Clear all", "secondary", "data-lv-qclear", IC.trash, "tiny") +
          "</span></div>" +
        ""
      : "";
    var aggregate = q.length && rd.state !== "ready"
      ? '<div class="lv-sum__rd lv-sum__rd--' + (rd.state === "convert" || rd.state === "uploading" || rd.state === "processing" ? "warn" : "bad") +
        '" data-lv-ready>' + (IC.attention || "") + "<span>" + UI.esc(rd.text) + "</span>" +
        "</div>"
      : "";
    // три входа наполнения: пока очередь пуста они стоят рядом, потом живут в шапке
    var inputs = q.length ? "" :
      '<div class="lv-qsources">' +
        field("Pick a playlist", S.playlists.length
          ? selTrig("qpl", UI.selectValue(null, "Select playlist"), { label: "Playlist" })
          // плейлистов ещё нет — селектор виден, но заблокирован с причиной (ADR-0002)
          : '<span class="is-off" aria-disabled="true" data-tip="No playlists yet." tabindex="0">' +
            selTrig("qpl", UI.selectValue(null, "Select playlist"), { label: "Playlist" }) + "</span>") +
        '<div class="ai-field lv-field--btn">' +
          btn("Add from library", "secondary", "data-lv-qadd", IC.folder, "tiny") +
          btn("Upload", "secondary", "data-lv-qupload", IC.upload, "tiny") + "</div>" +
      "</div>";
    var pseudo = formPseudo();
    // Цель эфира: разрешение выбирает человек, частота приходит из файлов, битрейт —
    // из матрицы. Все бейджи в очереди считаются от этой ячейки.
    var pl0 = formQueuePl(), cap = resCap(pl0), capWhy = resCapWhy(cap);
    var prof = formProfile(), tFps = fpsOf(pl0);
    var rng = rateRangeFor(prof.row, fpsCol(tFps), prof.vert);
    var target = '<div class="ai-field lv-target"><label class="ai-lbl">Stream quality</label>' +
        '<div class="nc-seg" role="group" aria-label="Target resolution">' +
        PRESETS.map(function (r) {
          var off = !resFits(pl0, r, prof.vert);
          return '<button class="nc-seg__btn' + (prof.row === r ? " is-active" : "") + (off ? " is-off" : "") +
            '" type="button"' + (prof.row === r ? ' aria-current="true"' : "") +
            (off ? ' aria-disabled="true" data-tip="' + UI.esc(capWhy) + '"' : ' data-lv-res="' + r + '"') +
            ">" + resLabel(r) + "</button>";
        }).join("") + "</div>" +
        // ориентация — да или нет, а не выбор из равных: тумблер. Если вертикаль
        // невозможна, он заблокирован причиной (ADR-0002)
        vertToggle(pl0, prof) +
        '<span class="an-hint">' + resDimLabel(prof.row, prof.vert) + " · " + tFps + " fps" +
          (q.length ? " from the files" : "") +
          (rng ? " · target bitrate " + rng[0].toFixed(1) + "–" + rng[1].toFixed(1) + " Mbps" : "") +
        "</span></div>";
    return '<div class="lv-wiz__step lv-form">' +
      // системный выбор файлов: кнопка Upload кликает по этому вводу
      '<input type="file" accept="video/*" multiple data-lv-qfile hidden />' +
      inputs + aggregate +
      // очередь живёт в серфейсе: шапка и строки — один объект, а не набор строк на фоне
      (q.length
        ? '<div class="lv-qsurf">' + head +
          '<div class="lv-q' + (FORM.shuffle ? " is-shuffled" : "") + (q.length === 1 ? " is-single" : "") +
          '" data-lv-queue data-lv-formq>' + queueRows(pseudo, pl, q, "slim") + "</div>" + foot + "</div>"
        : '<p class="an-hint">' + T.needVideo + "</p>") +
      // качество выбирается и до наполнения очереди: по умолчанию 1080p
      target +
      // воспроизведение подчинено очереди: это свойства стрима, а не содержимого
      '<div class="lv-fplay lv-form">' +
        '<div class="lv-form__sub">Playback</div>' +
        '<div class="ai-grid">' +
          '<div class="ai-field">' +
            seg("Playback mode", [{ k: "loop", l: "Loop" }, { k: "once", l: "Play once" }],
                FORM.loop ? "loop" : "once", "data-lv-loopmode") + "</div>" +
          (q.length > 2
            ? '<div class="ai-field"><label class="lv-pick__only" data-tip="Play videos in random order."><span class="lv-ico">' +
              (IC.shuffle || "") + "Shuffle</span>" +
              UI.switchHtml('data-lv-f="shuffle"', FORM.shuffle, "Shuffle") + "</label></div>"
            : "") +
          (FORM.loop
            ? '<div class="ai-field"><label class="lv-pick__only"><span class="lv-ico">' + (IC.clock || "") + "Loop limit</span>" +
              UI.switchHtml('data-lv-f="loopLimitOn"', FORM.loopLimit > 0, "Loop limit") + "</label>" +
              (FORM.loopLimit > 0
                ? '<span class="lv-lim"><input class="an-input an-input--mini" type="number" min="1" value="' +
                  FORM.loopLimit + '" data-lv-f="loopLimit" aria-label="Loop limit" />' +
                  '<span class="an-hint">loops' + (st.sec ? " · ≈" + UI.dur(st.sec * FORM.loopLimit) : "") + "</span></span>"
                : "") + "</div>"
            : "") +
        "</div></div>" +
      "</div>";
  }

  // ================= шаг 2 · Basics =================
  function wizBasics() {
    var connected = FORM.destMode === "connected";

    return '<div class="lv-wiz__step lv-form">' +
      // обложка и имя — одна строка: то, как стрим выглядит и как называется
      '<div class="ai-grid ai-grid--2 lv-fpair">' +
        formCoverBox() +
        (connected
          ? field("Stream name *", '<input class="an-input' + invCls("name") + '" type="text" value="' + UI.esc(FORM.name) +
              '" placeholder="' + UI.esc(FORM.nameSuggest || "e.g. Forza Chill Ride") + '" data-lv-f="name" />',
              FORM.nameSuggest ? "Suggested from the queue — the name stays your choice." : "")
          // с ключа имя не набирают: оно приходит из ссылки на эфир (ADR-0002 — не disabled)
          : field("Stream name",
              '<div class="an-input lv-ro is-off" aria-disabled="true" data-lv-nameout' +
                ' data-tip="The name comes from the stream link.">' +
                (nameFromLink(FORM.link) ? UI.esc(nameFromLink(FORM.link))
                  : '<span class="an-muted">From the stream link</span>') + "</div>",
              "Taken from the stream link.")) +
      "</div>" +
      '<div class="ai-grid ai-grid--2 lv-fpair">' +
        (connected
          ? field("Destination *",
              '<span class="' + (invCls("channel") ? "lv-inv" : "") + '">' +
              selTrig("channel", UI.selectValue(optByValue(chanOpts(false), FORM.channelId), "Select channel"),
                { label: "Channel" }) + "</span>")
          : field("Stream link *",
              '<input class="an-input' + invCls("link") + '" type="text" value="' + UI.esc(FORM.link) +
                '" placeholder="https://youtube.com/live/…" data-lv-f="link" />',
              '<button class="lv-link" type="button" data-lv-destmode="connected">Use a connected channel</button>') +
            field("Stream key *",
              '<input class="an-input' + invCls("key") + '" type="text" value="' + UI.esc(FORM.key) +
                '" placeholder="e.g. abcd-1234-efgh-5678" data-lv-f="key" />')) +
        "</div>" +
        // Описание принадлежит трансляции на YouTube. Её создаём мы только на подключённом
        // канале; с ручного ключа трансляцию создаёт человек сам, и отправить описание
        // некуда — поле убираем из потока, а не показываем заблокированным.
        (connected
          ? field("Description",
              '<textarea class="an-input lv-ta" rows="5" data-lv-f="desc" ' +
                'placeholder="What the stream is about — this text goes to YouTube.">' +
                UI.esc(FORM.desc || "") + "</textarea>",
              "Up to 5000 characters. Goes to YouTube with the broadcast.")
          : "") +
        (F.channels.filter(function (c) { return c.connected; }).length ? "" :
          '<div class="lv-banner lv-banner--info">' + (IC.info || "") +
          "<span>No channel connected yet.</span>" +
          '<span class="lv-banner__acts">' + btn("Connect YouTube", "primary", "data-lv-connectyt") + "</span></div>") +
      '<div class="lv-fplay lv-form">' +
        '<div class="lv-form__row"><label class="lv-pick__only"><span>Backup stream</span>' +
          UI.switchHtml('data-lv-f="backup"', FORM.backup, "Backup stream") + "</label></div>" +
        '<span class="an-hint">Doubles the cost. Uses the same stream key on YouTube’s backup ingest.</span>' +
      "</div>" +
      "</div>";
  }
  // занятость канала для текущего набора слотов — одна причина на смысл
  function wizBusy() {
    if (FORM.startMode !== "schedule") return null;
    var ps = formPseudo();
    for (var i = 0; i < FORM.schedules.length; i++) {
      var b = channelBusy(ps, FORM.schedules[i]);
      if (b) return b;
    }
    return null;
  }

  // ================= шаг 3 · Schedule =================
  function wizSchedule(pseudo0) {
    var eta = convEta(formQueuePl());
    var first = FORM.schedules.length ? FORM.schedules[0].start : null;
    var convLine = eta
      ? '<div class="lv-busyline">' + (IC.attention || "") +
        '<span class="an-hint an-hint--warn">' + UI.esc(convEtaText(eta) + " " +
          (FORM.startMode === "now"
            ? "The stream goes live once it finishes."
            : "The window can’t start before " + convEtaAt(eta, first) + ".")) + "</span></div>"
      : "";
    return '<div class="lv-wiz__step lv-form">' +
      '<div class="lv-form__row">' + seg("Launch mode", [
        { k: "schedule", l: "Schedule" }, { k: "now", l: "Start now" }
      ], FORM.startMode, "data-lv-startmode") + "</div>" +
      (FORM.startMode === "now"
        ? '<p class="an-modal__text" style="margin:0">' +
          (eta ? "The stream goes live as soon as conversion finishes and runs until you stop it."
               : "The stream goes live right after you create it and runs until you stop it.") + "</p>" +
          convLine
        : convLine +
          // зона у всех окон одна, поэтому стоит один раз над списком
          field("Time zone", '<div class="lv-ftz">' +
            selTrig("tz", UI.selectValue({ label: tzOffLabel(FORM.tz) }), { label: "Time zone" }) + "</div>") +
          FORM.schedules.map(function (sl, i) {
            var c = channelBusy(pseudo0, sl);
            return '<div class="ai-grid lv-slot__row' + (c ? " lv-slot--conflict" : "") + '">' +
              field("Starts", dtField(sl, "start", pseudo0)) +
              field("Ends", dtField(sl, "end", pseudo0)) +
              // правило повтора принадлежит слоту: у каждого окна своё
              field("Repeat",
                '<div class="lv-frep">' + selTrig("slotRep",
                  UI.selectValue(optByValue(REP_OPTS, (sl.repeat && sl.repeat.type) || "none")),
                  { label: "Repeat" }, sl.id) + "</div>") +
              (FORM.schedules.length > 1
                ? '<div class="ai-field lv-slot__del">' +
                  '<button class="mc-more" type="button" data-lv-slotdel="' + sl.id +
                    '" aria-label="Remove slot">' + (IC.close || "") + "</button></div>"
                : "") +
              (c ? '<div class="lv-busyline" style="grid-column:1/-1">' + (IC.attention || "") +
                '<span class="an-hint an-hint--warn">' + UI.esc(c.msg) + "</span>" +
                (c.liveId ? '<a class="lv-link" href="live-stream.html?id=' + encodeURIComponent(c.liveId) + '">Open the stream</a>' : "") +
                "</div>" : "") +
            "</div>";
          }).join("") +
          (formEndWhy()
            ? '<span class="an-hint">' + UI.esc(formEndWhy() + " " + formEndFree()) + "</span>"
            : "") +
          '<div class="lv-form__row">' + btn("Add slot", "secondary", "data-lv-slotadd", IC.plus) +
            '<span class="an-hint">Up to ' + F.account.horizonDays + " days ahead.</span></div>" +
          (FORM.schedules.length
            ? '<div class="lv-fplay lv-form__row">' +
                '<label class="lv-pick__only"><span>Back-to-back</span>' +
                  UI.switchHtml('data-lv-slot="' + FORM.schedules[0].id + ':b2b"',
                    !!(FORM.schedules[0].backToBack && FORM.schedules[0].backToBack.on), "Back-to-back") + "</label>" +
                (FORM.schedules[0].backToBack && FORM.schedules[0].backToBack.on
                  ? '<span class="an-hint">Restarts after ' +
                    '<input class="an-input an-input--mini" type="number" min="0" value="' + (FORM.schedules[0].backToBack.pauseMin || 0) +
                      '" data-lv-slot="' + FORM.schedules[0].id + ':pause" /> min, ' +
                    '<input class="an-input an-input--mini" type="number" min="1" value="' + (FORM.schedules[0].backToBack.maxCycles || 1) +
                      '" data-lv-slot="' + FORM.schedules[0].id + ':cycles" /> cycles max</span>'
                  : "") +
              "</div>"
            : "")) +
      "</div>";
  }

  // ================= шаг 4 · Review & launch =================
  function wizReview() {
    var pl = formQueuePl(), st = plStats(pl), rd = readiness(pl);
    var ps = formPseudo(), c = cost(ps), a = c.account;
    var line = wizReadyLine(4) || wizBlocked(1) || wizBlocked(2) || wizBlocked(3);
    var runs = FORM.startMode === "schedule" ? next3All() : [];
    var unknown = queueUnknown(pl) || !st.sec;
    var perWin = unknown || !c.windowH ? 0 : Math.max(1, Math.floor(c.windowH * 3600 / st.sec));
    if (FORM.loop && FORM.loopLimit > 0) perWin = Math.min(FORM.loopLimit, perWin);
    if (!FORM.loop) perWin = 1;
    var play = (FORM.loop ? "Loop" : "Play once") +
      (perWin ? " · " + UI.plural(perWin, "run", "runs") + " per window" : "") +
      (FORM.shuffle ? " · shuffled" : "");
    var ch4 = chan(FORM.channelId), prof4 = formProfile();
    return '<div class="lv-wiz__step">' +
      '<div class="lv-sum__rd lv-sum__rd--' + (line ? "warn" : "ok") + '" data-lv-ready>' +
        (line ? (IC.attention || "") : (IC.check || "")) + "<span>" +
        UI.esc(line || "Ready to create") + "</span></div>" +
      '<div class="lv-rev__g"><div class="lv-sum__rows">' +
        kvRow("Goes on air",
              (st.count ? st.count + (st.count === 1 ? " video" : " videos") : "Nothing") +
              (unknown ? "" : " · " + UI.dur(st.sec))) +
        kvRow("Files are", rd.label) +
        kvRow("Plays as", play) +
        kvRow("Quality", resLabel(prof4.h) + " · " + fpsOf(pl) + " fps") +
        kvRow(FORM.destMode === "manual" ? "Streams with a key" : "Streams to",
              FORM.destMode === "manual" ? (FORM.key ? "Manual key set" : "Key missing") : ch4 ? ch4.name : "—") +
        (FORM.startMode === "now"
          ? kvRow("Starts", "Right after creation")
          : runs.length
            ? kvRow("First run", UI.dt(runs[0].start, FORM.tz).replace(",", "") + " → " + UI.time(runs[0].end, FORM.tz) +
                " " + tzOffLabel(FORM.tz)) +
              (FORM.schedules[0].repeat && FORM.schedules[0].repeat.type !== "none"
                ? kvRow("Repeats", (optByValue(REP_OPTS, FORM.schedules[0].repeat.type) || {}).label || "")
                : "") +
              (FORM.schedules.length > 1 ? kvRow("Windows planned", String(FORM.schedules.length)) : "")
            : kvRow("First run", "No slots yet")) +
        (FORM.backup ? kvRow("Backup stream", "On — the rate is doubled") : "") +
        kvRow(unknown ? "This window costs" : c.windowH ? "This " + winLen(c.windowH) + " window costs" : "One day costs",
              (unknown ? "—" : c.windowH ? "≈" + UI.money(c.windowCost) : "≈" + UI.money(c.perDay)) +
              " · " + (a.kind === "hours" ? "≈" + UI.hours(a.creditHours) + " of free credit" : c.rateStr)) +
        kvRow(a.shared ? "Organization balance covers" : "Your balance covers", "≈" + UI.hours(c.balHours) + " of streaming") +
      "</div></div>" +
      (c.notEnough
        ? '<p class="lv-sum__note">Balance covers ≈' + UI.hours(c.balHours) + " of the " + winLen(c.windowH) + " window.</p>"
        : "") +
      "</div>";
  }

  function renderForm() {
    // окно правится в модалке: контролы те же, а перерисовывать нужно её, не мастер
    if (FORM && FORM.modal) { slotModalRender(); return; }
    var host = document.querySelector("[data-lv-form]");
    if (!host) return;
    if (!FORM) formInit();
    formSyncEnds();
    var editing = !!FORM.id;
    var pseudo0 = formPseudo();
    document.title = (editing ? "Edit stream" : "New stream") + " — SubSub";

    var cur = WZ_STEPS[WZ.step - 1];
    var gate = wizBlocked(WZ.step);
    var bodies = [wizContent, wizBasics, function () { return wizSchedule(pseudo0); }, wizReview];

    host.innerHTML =
      '<button class="an-back" type="button" data-lv-wzleave>' +
        (IC.chevLeft || "") + (editing ? "Back to stream" : "Back to streams") + "</button>" +

      '<div class="lv-wiz">' +
      '<aside class="lv-wiz__map">' + wizMapHtml(editing) + "</aside>" +
      '<section class="lv-wiz__body">' +
        '<div class="lv-wiz__eyebrow">Step ' + WZ.step + " of " + WZ_STEPS.length + "</div>" +
        '<h1 class="lv-wiz__h">' + (editing && WZ.step === 4 ? "Review and save" : cur.h) + "</h1>" +
        '<p class="lv-wiz__lead">' + cur.lead + "</p>" +
        bodies[WZ.step - 1]() +
        '<div class="lv-wiz__foot">' + wizFootHtml(editing, gate) + "</div>" +
      "</section></div>";

    // очередь перетаскивается, если порядок вообще имеет смысл
    wizBindDnd(host);
    void 0;
  }
  // карта шагов и полоса значений: обновляются и при печати в поле, без перерисовки шага
  function wizMapHtml(editing) {
    return '<h2 class="lv-wiz__maptitle">' + (editing ? "Stream setup" : "New stream setup") + "</h2>" +
        WZ_STEPS.map(function (s, i) {
          var n = i + 1;
          var reachable = n <= WZ.max;
          var satisfied = !wizBlocked(n);
          var current = n === WZ.step;
          var done = !current && reachable && satisfied && (n < WZ.max || n < WZ.step);
          var attention = !current && reachable && !satisfied && n < WZ.max;
          var val = done ? wizValue(n) : "";
          var tip = attention ? wizReadyLine(n) : "";
          return '<button class="lv-wiz__st' + (current ? " is-current" : "") + (done ? " is-done" : "") +
            (attention ? " is-attention" : "") + (reachable ? "" : " is-off") +
            '" type="button" data-lv-wzstep="' + n + '"' +
            (reachable ? "" : ' aria-disabled="true"') +
            (tip ? ' data-tip="' + UI.esc(tip) + '"' : "") +
            (current ? ' aria-current="step"' : "") + ">" +
            '<span class="lv-wiz__ico">' + (done ? (IC.check || "") : attention ? (IC.attention || "") : (IC[s.ic] || "")) + "</span>" +
            '<span class="lv-wiz__tx"><b>' + s.t + "</b><span>" + UI.esc(val || s.d) + "</span></span></button>";
        }).join("") +
        wizStrip();
  }
  function wizFootHtml(editing, gate) {
    return (WZ.step > 1 ? btn("Back", "secondary", "data-lv-wzback") : "") +
      (WZ.step < WZ_STEPS.length
        ? '<button class="an-btn an-btn--primary an-btn--small' + (gate ? " is-off" : "") +
          '" type="button" data-lv-wznext' +
          (gate ? ' aria-disabled="true" data-tip="' + UI.esc(gate) + '"' : "") +
          ">Save and continue</button>"
        : '<button class="an-btn an-btn--primary an-btn--small' + (gate ? " is-off" : "") +
          '" type="button" data-lv-formsubmit' +
          (gate ? ' aria-disabled="true" data-tip="' + UI.esc(gate) + '"' +
            (/balance/i.test(gate) ? ' data-tip-act="' + T.topUp + '"' : "") : "") + ">" +
          (editing ? "Save changes" : "Create stream") + "</button>");
  }
  function wizBindDnd(host) {
    var q = host.querySelector("[data-lv-formq]");
    if (q && !FORM.shuffle && formQueue().length > 1) {
      UI.dnd(q, function (order) {
        var map = {};
        formQueue().forEach(function (i) { (map[i.fileId] = map[i.fileId] || []).push(i); });
        FORM.queue = order.map(function (id) { return (map[id] || []).shift(); }).filter(Boolean);
        formDetach();
        renderForm();
      });
    }

    // вход из плейлиста: фокус на первом незаполненном обязательном поле — канале
    if (FORM.focusChannel) {
      FORM.focusChannel = false;
      var chTrig = host.querySelector('[data-lv-sel="channel"]');
      if (chTrig) setTimeout(function () { chTrig.focus(); }, 0);
    }
    void 0;
  }
  // datetime-local хочет локальное время без зоны
  function isoLocal(iso) {
    if (!iso) return "";
    try {
      var p = new Intl.DateTimeFormat("sv-SE", { timeZone: FORM.tz, year: "numeric", month: "2-digit",
        day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
      return p.replace(" ", "T");
    } catch (e) { return ""; }
  }
  function localIso(v) {
    // прототип держит одну зону аккаунта, поэтому смещение берём из неё
    return v ? new Date(v + ":00+03:00").toISOString() : null;
  }

  // Резюме формы: одна колонка справа, липкая. Готовность, цикл, запуск, деньги и
  // единственная пара действий на всю форму — дубля в подвале больше нет.
  // ближайшие запуски по всем слотам сразу: в резюме нужен общий порядок, а не по слоту
  function next3All() {
    var out = [];
    FORM.schedules.forEach(function (sl) {
      var durMs = Date.parse(sl.end) - Date.parse(sl.start);
      next3(sl).forEach(function (iso) {
        out.push({ start: iso, end: new Date(Date.parse(iso) + durMs).toISOString() });
      });
    });
    return out.sort(function (x, y) { return Date.parse(x.start) - Date.parse(y.start); }).slice(0, 3);
  }
  function formSubmit() {
    var b = formBlock();
    if (b) { UI.toast(b.reason); return; }
    var plId = null;
    var s = FORM.id ? stream(FORM.id) : null;
    // черновик при создании ведёт себя как новый стрим: статус, прогон и тост — как у нового
    var wasDraft = !!(s && s.status === "draft");
    var isNew = !s || wasDraft;
    if (!s) {
      s = { id: "s" + Date.now(), runs: [], spentTotal: 0, metrics: {} };
      S.streams.unshift(s);
    }
    if (wasDraft) { delete s.draftForm; delete s.draftStep; delete s.draftMax; s.runs = s.runs || []; }
    s.name = formName().trim() || s.name;
    s.channelId = FORM.destMode === "connected" ? FORM.channelId : (s.channelId || null);
    s.dest = FORM.destMode === "connected" ? { mode: "connected" } : { mode: "manual", key: FORM.key.trim(), link: FORM.link.trim() };
    s.playlistId = plId;
    s.fileId = null;
    s.queue = clone(formQueue());
    s.srcPl = FORM.srcPl || null;
    s.detached = !!FORM.detached;
    s.cover = FORM.cover ? { src: FORM.cover, uploaded: true } : null;
    s.desc = FORM.desc || "";
    s.ytThumb = !!FORM.ytThumb;
    s.res = formRes() || null;
    s.vert = formVert();
    s.playback = { loop: FORM.loop, shuffle: FORM.shuffle };
    s.loopLimit = FORM.loop ? FORM.loopLimit : 0;
    s.backup = FORM.backup;
    s.schedules = FORM.startMode === "schedule" ? clone(FORM.schedules) : [];
    if (isNew || !running(s.status)) {
      s.virtual_status = FORM.startMode === "schedule" && FORM.schedules.length ? "scheduled" : null;
      s.status = FORM.startMode === "now" ? "live" : (isNew ? "created" : s.status);
      s.runs = s.runs || [];
      if (FORM.startMode === "now") {
        s.runs.unshift({ id: s.id + "-r" + (s.runs.length + 1), index: s.runs.length + 1,
          start: new Date(nowMs()).toISOString(), end: null,
          spent: 0, events: [ev("created", (isNew ? "Created" : "Updated"), { author: "You" }), ev("live", "Went live")] });
      } else {
        s.runs.unshift({ id: s.id + "-r" + (s.runs.length + 1), index: s.runs.length + 1, start: null, end: null,
          spent: 0, events: [ev("scheduled", "Scheduled", { author: "You" })] });
      }
    } else {
      (runOf(s) || { events: [] }).events.unshift(ev("playlist", "Stream settings changed", { author: "You" }));
    }
    save();
    UI.toast(isNew
      ? (FORM.startMode === "now" ? "“" + s.name + "” is live." : "“" + s.name + "” scheduled.")
      : "Changes saved.");
    location.href = "live-stream.html?id=" + encodeURIComponent(s.id);
  }

  // ============================================================ Э6 · пикер медиатеки
  var PICK = null;
  // Профиль, относительно которого пикер показывает готовность: цель стрима, если
  // выбираем в очередь, профиль плейлиста — если пополняем плейлист.
  function pickProfile() {
    var t = PICK && PICK.target;
    if (!t) return null;
    if ((t.kind === "queue" || t.kind === "qreplace" || t.kind === "video") && PAGE === "form" && FORM) {
      return profileOf(formQueuePl());
    }
    if (t.kind === "playlist" || t.kind === "replace") {
      var pl = t.plId ? playlist(t.plId) : t.id && t.id !== "__draft" ? playlist(t.id) : plTarget && plTarget();
      if (pl) return profileOf(pl);
    }
    return null;
  }
  function pickOpen(target) {
    // одно видео для стрима и замена файла выбираются по одному
    PICK = { target: target, single: target.kind === "video" || target.kind === "replace",
      matchProfile: target.kind === "replace", folder: null, sel: {}, videosOnly: true, q: "" };
    pickRender();
    UI.openModal("lvPicker");
  }
  // Составного «MP4 · Ready» больше нет: формат — своей колонкой, готовность — бейджем
  function fileRate(f) {
    if (!f || !f.bytes || !f.sec) return "—";
    var mbps = (f.bytes * 8) / f.sec / 1e6;
    return (mbps >= 10 ? Math.round(mbps) : mbps.toFixed(1)) + " Mbps";
  }
  // разрешение как у пресетов: по короткой стороне, «1080p». Без метаданных — прочерк
  function fileRes(f) {
    if (!f || !f.q || !f.q.w || !f.q.h) return "—";
    return Math.min(f.q.w, f.q.h) + "p";
  }
  function fileFmt(f) {
    return '<span class="lv-qr__fmt">' + UI.esc((f.container || "mp4").toUpperCase()) + "</span>";
  }
  var FILE_BADGE = { ready: ["ok", "Ready"], needconv: ["warn", "Needs conversion"],
    cant: ["bad", "Can’t be aligned"], convfail: ["bad", "Conversion failed"],
    processing: ["muted", "Processing"], missing: ["bad", "File missing"], broken: ["bad", "Upload failed"],
    uploading: ["info", "Uploading"] };
  // Почему файл в таком состоянии. Для «Can’t be aligned» перечисляем расхождения:
  // конвертация выравнивает только разрешение, остальное человек меняет сам.
  function fileWhy(f, prof) {
    var st = fileState(f, prof);
    if (st === "ready") {
      // ниже рекомендованного битрейта поднять нельзя: предупреждаем, но не блокируем
      var rngR = rateRangeFor(prof.row || resRow(prof.h, prof.w), fpsCol(prof.fps), prof.vert), mbR = fileMbps(f);
      if (rngR && mbR && mbR < rngR[0]) {
        return mbR.toFixed(1) + " Mbps is below the recommended " + rngR[0].toFixed(1) + "–" +
          rngR[1].toFixed(1) + " — it streams as is, quality stays lower.";
      }
      return "";
    }
    if (st === "broken") return "The upload didn’t finish — retry it in Media Library.";
    if (st === "convfail") return "Conversion failed — try again or change the file.";
    if (st === "processing") return "Metadata is still being read.";
    if (st === "needconv") {
      // это не ошибка файла, а список того, что с ним сделают: «было → станет»
      var d2 = [], rng2 = rateRangeFor(prof.row || resRow(prof.h, prof.w), fpsCol(prof.fps), prof.vert), mb2 = fileMbps(f);
      if (f.q.h !== prof.h || f.q.w !== prof.w) {
        d2.push(f.q.w + " × " + f.q.h + " → " + prof.w + " × " + prof.h);
      }
      if (fpsNorm(f.q.fps) !== fpsNorm(prof.fps)) d2.push(fpsNorm(f.q.fps) + " → " + fpsNorm(prof.fps) + " fps");
      if (rng2 && mb2 && mb2 > rng2[1]) {
        d2.push(mb2.toFixed(1) + " → " + rng2[0].toFixed(1) + "–" + rng2[1].toFixed(1) + " Mbps");
      }
      if (f.q.vcodec !== prof.vcodec) d2.push(f.q.vcodec + " → " + prof.vcodec + " video");
      if (!f.q.audio && prof.audio) d2.push("silent audio track added");
      else {
        if (String(f.q.acodec) !== String(prof.acodec)) d2.push(f.q.acodec + " → " + prof.acodec + " audio");
        if (f.q.ac !== prof.ac) d2.push(f.q.ac + " → " + prof.ac + " audio channels");
        if (f.q.ar !== prof.ar) d2.push(khz(f.q.ar) + " → " + khz(prof.ar) + " audio");
      }
      return "Prepared automatically before the stream: " + d2.join(", ") + ".";
    }
    if (st !== "cant") return "";
    // нелечимых поводов ровно два, и каждый говорит сам за себя
    if (f.q.fps < FPS_MIN || f.q.fps > FPS_MAX) {
      return f.q.fps + " fps is outside " + FPS_MIN + "–" + FPS_MAX + " — conversion can’t change that.";
    }
    if (resRow(f.q.h, f.q.w) < (prof.row || resRow(prof.h, prof.w))) {
      return f.q.w + " × " + f.q.h + " and the target is " + prof.w + " × " + prof.h +
        " — upscaling isn’t possible. Lower the stream quality or remove the file.";
    }
    return "The target has no bitrate profile — pick another stream quality.";
  }
  function fileBadge(f, prof, tip) {
    // без цели сравнивать не с чем: показываем факт, а не вердикт
    var pr = prof || null;
    if (!pr) {
      var stx = f && f.state;
      var mx = FILE_BADGE[stx === "failed" ? "broken" : stx === "convfail" ? "convfail"
        : stx === "converting" ? "converting" : stx === "uploading" ? "uploading"
        : stx === "processing" ? "processing" : stx === "missing" ? "missing" : "ready"];
      return stx && stx !== "ready" ? '<span class="ml-tag ml-tag--' + mx[0] + '">' + mx[1] + "</span>" : "";
    }
    var st = fileState(f, pr);
    var reason = tip || fileWhy(f, pr);
    var t = reason ? ' data-tip="' + UI.esc(reason) + '" tabindex="0"' : "";
    if (st === "converting") return '<span class="ml-tag ml-tag--info"' + t + ">Converting · " + (f.progress || 0) + "%</span>";
    if (st === "uploading") return '<span class="ml-tag ml-tag--info"' + t + ">Uploading · " + (f.progress || 0) + "%</span>";
    var m = FILE_BADGE[st];
    return '<span class="ml-tag ml-tag--' + m[0] + '"' + t + ">" + m[1] + "</span>";
  }
  function pickRender() {
    var list = document.querySelector("[data-lv-picklist]");
    var crumbs = document.querySelector("[data-lv-pickcrumbs]");
    if (!list) return;
    var q = PICK.q.toLowerCase();
    crumbs.innerHTML = (PICK.folder
      ? '<button class="lv-link" type="button" data-lv-pickup>All media</button><span class="an-hint"> / ' +
        UI.esc((F.folders.filter(function (x) { return x.id === PICK.folder; })[0] || {}).name || "") + "</span>"
      : '<span class="an-hint">All media</span>') +
      ' <span class="an-hint" data-lv-picksum></span>';

    var pprof = pickProfile();
    var rows = "";
    if (!PICK.folder) {
      rows += F.folders.filter(function (fo) { return !q || fo.name.toLowerCase().indexOf(q) !== -1; }).map(function (fo) {
        var files = fo.fileIds.map(file).filter(Boolean);
        var sec = files.reduce(function (a2, f) { return a2 + f.sec; }, 0);
        var bytes = files.reduce(function (a2, f) { return a2 + f.bytes; }, 0);
        var offReason = fo.system ? "System folders can’t be streamed." : (!files.length ? "This folder has no videos." : "");
        return '<div class="lv-pick__r" data-lv-pickfolder="' + fo.id + '">' +
          // папка — это не одно видео: в режиме одного выбора её не выбирают
          (PICK.single ? "<span></span>" : offReason
            ? '<span class="an-check is-off" aria-disabled="true" data-tip="' + UI.esc(offReason) + '" tabindex="0"></span>'
            : '<button class="an-check' + (PICK.sel["fold:" + fo.id] ? " is-checked" : "") + '" type="button" role="checkbox" aria-checked="' +
              (PICK.sel["fold:" + fo.id] ? "true" : "false") + '" data-lv-pickfold="' + fo.id + '" aria-label="Select folder ' + UI.esc(fo.name) + '">' + (IC.check || "") + "</button>") +
          '<span class="ml-preview ml-preview--folder">' + (IC.folder || "") + "</span>" +
          '<span class="lv-qr__n"><span class="lv-qr__nm" data-tip="' + UI.esc(fo.name) + '">' + UI.esc(fo.name) + "</span>" +
            '<span class="an-hint">' + UI.plural(files.length, "video", "videos") + "</span></span>" +
          '<span class="lv-qr__meta">' + (sec ? UI.dur(sec) : "—") + "</span>" +
          '<span class="lv-qr__meta">' + (bytes ? UI.bytes(bytes) : "—") + "</span>" +
          '<span class="lv-qr__meta"></span><span class="lv-qr__meta"></span>' +
          '<button class="mc-more" type="button" data-lv-pickenter="' + fo.id + '" aria-label="Open folder ' + UI.esc(fo.name) + '">' + (IC.chevRight || "") + "</button>" +
        "</div>";
      }).join("");
    }
    var pool = PICK.folder
      ? (F.folders.filter(function (x) { return x.id === PICK.folder; })[0] || { fileIds: [] }).fileIds.map(file).filter(Boolean)
      : F.files;
    rows += pool.filter(function (f) {
      if (f.state === "missing") return false;          // такого файла в медиатеке уже нет
      if (PICK.videosOnly && f.container !== "mp4") return false;
      // замена нелечимого: показываем только файлы, совпадающие с профилем
      if (PICK.matchProfile && pprof && fileState(f, pprof) !== "ready") return false;
      return !q || f.name.toLowerCase().indexOf(q) !== -1;
    }).map(function (f) {
      var off = f.state === "processing" ? "Metadata is still being read — this file can be added later."
        : f.state === "uploading" ? "Still uploading — the file can be added once it’s ready."
        : f.state === "failed" ? "The upload didn’t finish — retry it in Media Library."
        : fileUnfit(f);
      // одно видео берут кликом по строке: набор чекбоксов врал бы про множественный выбор.
      // Причина недоступности живёт тултипом на бадже состояния, отдельного значка нет
      return (PICK.single && !off
          ? '<div class="lv-pick__r lv-pick__r--one" role="button" tabindex="0" data-lv-picktake="' + f.id +
            '" aria-label="Choose ' + UI.esc(f.name) + '">'
          : '<div class="lv-pick__r">') +
        (PICK.single
          ? "<span></span>"
          : off
            ? '<span class="an-check is-off" aria-disabled="true" data-tip="' + UI.esc(off) + '" tabindex="0"></span>'
            : '<button class="an-check' + (PICK.sel[f.id] ? " is-checked" : "") + '" type="button" role="checkbox" aria-checked="' +
              (PICK.sel[f.id] ? "true" : "false") + '" data-lv-pickfile="' + f.id + '" aria-label="Select ' + UI.esc(f.name) + '">' + (IC.check || "") + "</button>") +
        coverBox(f.cover) +
        '<span class="lv-qr__n"><span class="lv-qr__nm" data-tip="' + UI.esc(f.name) + '">' + UI.esc(f.name) + "</span></span>" +
        '<span class="lv-qr__meta">' + (f.sec ? UI.dur(f.sec) : "—") + "</span>" +
        '<span class="lv-qr__meta">' + UI.bytes(f.bytes) + "</span>" +
        '<span class="lv-qr__meta">' + fileRes(f) + "</span>" +
        fileFmt(f) + fileBadge(f, pprof, off) +
      "</div>";
    }).join("");

    // три разных нуля: поиск без совпадений, папка без видео, пустая медиатека
    var blankT = PICK.q ? "Nothing found" : PICK.folder ? "No videos in this folder" : "No videos yet";
    var blankH = !PICK.q && !F.files.length
      ? '<p class="an-blank__text">Upload a video — it lands in Media Library and can go into any stream.</p>' : "";
    list.innerHTML = rows || '<div class="an-blank"><p class="an-blank__title">' + blankT + "</p>" + blankH + "</div>";
    pickSum();
  }
  function pickFiles() {
    var out = [];
    Object.keys(PICK.sel).forEach(function (k) {
      if (!PICK.sel[k]) return;
      if (k.indexOf("fold:") === 0) {
        var fo = F.folders.filter(function (x) { return x.id === k.slice(5); })[0];
        (fo ? fo.fileIds : []).forEach(function (id) {
          var f = file(id);
          if (f && f.state === "ready" && !fileUnfit(f) && out.indexOf(id) === -1) out.push(id);
        });
      } else if (out.indexOf(k) === -1) out.push(k);
    });
    return out;
  }
  function pickSum() {
    var ids = pickFiles();
    var sec = 0, bytes = 0;
    ids.forEach(function (id) { var f = file(id); if (f) { sec += f.sec; bytes += f.bytes; } });
    var sum = document.querySelector("[data-lv-picksum]");
    if (sum) sum.textContent = "· " + (ids.length
      ? ids.length + " selected · " + UI.dur(sec) + " · " + UI.bytes(bytes)
      : "Nothing selected");
    var add = document.querySelector("[data-lv-pickadd]");
    if (add && PICK.single) { add.hidden = true; return; }
    if (add) add.hidden = false;
    if (add) {
      UI.off(add, !ids.length, PICK.single ? "Select a video" : "Select at least one video");
      add.textContent = PICK.target.kind === "replace" ? "Replace file"
        : PICK.single ? "Choose video"
        : ids.length ? "Add to queue (" + ids.length + ")" : "Add to queue";
    }
  }
  // Загрузка из пикера идёт через системный диалог выбора файла и тот же жизненный цикл,
  // что у загрузки в очередь: uploading → processing → ready. Файл ложится в медиатеку
  // (в текущую папку) и становится выбираемым, как только прочитаны метаданные.
  function pickUploadFiles(picked) {
    var list = [].slice.call(picked || []);
    if (!list.length) return;
    var added = 0;
    list.forEach(function (real) {
      if (String(real.type || "").indexOf("video/") !== 0) { UI.toast("Videos only — that file was skipped."); return; }
      UPL_N++;
      var f = { id: "up" + Date.now() + UPL_N, name: real.name, sec: 0, bytes: real.size,
        container: "mp4", state: "uploading", progress: 0, q: null, folderId: PICK ? PICK.folder || null : null, cover: null };
      F.files.push(f);
      if (PICK && PICK.folder) {
        var fo = F.folders.filter(function (x) { return x.id === PICK.folder; })[0];
        if (fo) fo.fileIds.push(f.id);
      }
      if (DEMO) { S.extraFiles = S.extraFiles || []; S.extraFiles.push(f); save(); }
      formQueueTick(f);
      added++;
    });
    if (!added) return;
    pickRender();
    UI.toast(UI.plural(added, "upload", "uploads") + " started.");
  }
  function pickAdd() {
    var ids = pickFiles();
    if (!ids.length) return;
    if (PICK.target.kind === "video") {                 // одно видео прямо в поле формы
      FORM.fileId = ids[0];
      UI.closeModals(); renderForm();
      UI.toast("Video selected.");
      return;
    }
    if (PICK.target.kind === "replace") {               // замена нелечимого файла на месте
      var rp = plById(PICK.target.plId);
      var rit = rp && rp.items.filter(function (x) { return x.fileId === PICK.target.fileId; })[0];
      if (rit) rit.fileId = ids[0];
      UI.closeModals(); renderPlEditor();
      UI.toast("File replaced.");
      return;
    }
    if (PICK.target.kind === "qreplace") {              // замена файла в очереди стрима
      var rit = formQueue().filter(function (x) { return x.fileId === PICK.target.fileId; })[0];
      if (rit) rit.fileId = ids[0];
      formDetach();
      UI.closeModals(); renderForm();
      UI.toast("File replaced.");
      return;
    }
    if (PICK.target.kind === "queue") {                 // очередь стрима на шаге контента
      ids.forEach(function (id) { FORM.queue.push({ fileId: id, off: false }); });
      formDetach();
      UI.closeModals(); renderForm();
      UI.toast(UI.plural(ids.length, "video", "videos") + " added to the queue.");
      return;
    }
    if (PICK.target.kind === "formpl") {                // очередь нового плейлиста в форме
      ids.forEach(function (id) {
        if (!FORM.newPl.items.filter(function (i) { return i.fileId === id; }).length) {
          FORM.newPl.items.push({ fileId: id, off: false });
        }
      });
      UI.closeModals(); renderForm();
      UI.toast(UI.plural(ids.length, "video", "videos") + " added.");
      return;
    }
    var skipped = Object.keys(PICK.sel).filter(function (k) {
      if (k.indexOf("fold:") === 0) return false;
      var f = file(k);
      return PICK.sel[k] && f && (f.state !== "ready" || fileUnfit(f));
    }).length;
    {
      var p = plById(PICK.target.id);
      if (!p) { UI.closeModals(); return; }
      if (plIsDraft(p)) {
        ids.forEach(function (id) {
          if (!p.items.filter(function (i) { return i.fileId === id; }).length) p.items.push({ fileId: id, off: false });
        });
        UI.closeModals();
        renderPlEditor();
        UI.toast(UI.plural(ids.length, "video", "videos") + " added. Press Save to keep the playlist.");
        return;
      }
      if (PAGE === "playlist") {
        ids.forEach(function (id) {
          if (!p.items.filter(function (i) { return i.fileId === id; }).length) p.items.push({ fileId: id, off: false });
        });
        UI.closeModals();
        renderPlEditor();
        UI.toast(UI.plural(ids.length, "video", "videos") + " added. Press Save changes to keep them.");
        return;
      }
      UI.closeModals();
      plApplyAsk(p, function () {
        ids.forEach(function (id) {
          if (!p.items.filter(function (i) { return i.fileId === id; }).length) p.items.push({ fileId: id, off: false });
        });
        p.updated = new Date(nowMs()).toISOString();
        save(); render();
      });
    }
    UI.toast(skipped
      ? skipped + " files won’t be added: not video, still processing or with an unsupported frame rate."
      : UI.plural(ids.length, "video", "videos") + " added.");
  }


  // ============================================================ Э4 · календарь
  // Календарь показывает слоты, а не стримы: повтор разворачивается в отдельные полосы.
  var CALV = { scale: "week", anchor: null, tz: null, channel: null, statuses: [], view: null, hour: null };
  var SCALE_LBL = { month: "Month", week: "Week", day: "Day" };
  function tzShort(z) { return z === "UTC" ? "UTC" : z.split("/").pop().replace(/_/g, " "); }
  var DAYMS = 24 * 3600e3;

  function calTz() { return CALV.tz || TZ; }
  function calChans() { return F.channels.filter(function (c) { return c.connected; }); }
  // выбор канала помнится между заходами: календарь почти всегда смотрят по одному каналу
  function calChannel() {
    if (CALV.channel) return CALV.channel;
    if (S.calChannel) { CALV.channel = S.calChannel; return CALV.channel; }
    var first = calChans()[0];
    CALV.channel = first ? first.id : "__all";
    return CALV.channel;
  }
  function calAll() { return calChannel() === "__all"; }
  // вид и высота часа помнятся: их меняют один раз под свою привычку
  function calView() { if (!CALV.view) CALV.view = S.calView || "cal"; return CALV.view; }
  // Высота часа: по умолчанию 24 часа ровно заполняют доступную высоту сетки; минимум 22px —
  // дальше включается внутренний скролл. Кнопки масштаба переопределяют расчёт (CALV.hour).
  function calHourAuto() {
    var body = document.querySelector(".lv-calbody");
    if (!body) return 44;
    var avail = window.innerHeight - body.getBoundingClientRect().top - 16;   // низ страницы
    var headH = 56;                                                           // шапка дней в сетке
    return Math.max(22, Math.floor((avail - headH) / 24));
  }
  function calHour() { return CALV.hour || S.calHour || calHourAuto(); }
  function wd3(dateStr) {
    return new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" })
      .format(new Date(Date.parse(dateStr + "T12:00:00Z"))).toUpperCase();
  }
  function isoWeek(dateStr) {
    var d = new Date(Date.parse(dateStr + "T12:00:00Z"));
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3);      // четверг этой недели
    var thu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
    thu.setUTCDate(thu.getUTCDate() - ((thu.getUTCDay() + 6) % 7) + 3);
    return 1 + Math.round((d - thu) / (7 * DAYMS));
  }
  function weekStart(dateStr) {
    return addDaysStr(dateStr, -((new Date(Date.parse(dateStr + "T12:00:00Z")).getUTCDay() + 6) % 7));
  }
  // подпись периода: сначала человеческое «This week», потом точные даты
  function calPeriodLabel(r, fromMs, toMs) {
    var today = partsIn(nowMs(), calTz()).date;
    if (CALV.scale === "day") {
      var rel = r.days[0] === today ? "Today · "
        : r.days[0] === addDaysStr(today, 1) ? "Tomorrow · "
        : r.days[0] === addDaysStr(today, -1) ? "Yesterday · " : "";
      return rel + UI.day(new Date(fromMs).toISOString(), calTz());
    }
    if (CALV.scale === "week") {
      var tw = weekStart(today), rel2 = r.from === tw ? "This week · "
        : r.from === addDaysStr(tw, 7) ? "Next week · "
        : r.from === addDaysStr(tw, -7) ? "Last week · " : "";
      // недели читаются по числам: дни недели и так стоят в шапках колонок
      var f2 = UI.day(new Date(fromMs).toISOString(), calTz()).replace(/^[A-Z][a-z]{2} /, "");
      var t2 = UI.day(new Date(toMs - DAYMS).toISOString(), calTz()).replace(/^[A-Z][a-z]{2} /, "");
      var same = f2.split(" ")[1] === t2.split(" ")[1];
      return rel2 + (same ? f2.split(" ")[0] + " — " + t2 : f2 + " — " + t2) + " · W" + isoWeek(r.from);
    }
    var mLbl = new Intl.DateTimeFormat("en-GB", { timeZone: calTz(), month: "long", year: "numeric" })
      .format(new Date(dayStartMs(calAnchor(), calTz())));
    return (r.month === today.slice(0, 7) ? "This month · " : "") + mLbl;
  }
  // сколько эфира и денег в периоде: окна режем по границам диапазона
  function clipSec(o, fromMs, toMs) {
    var st = Math.max(o.start, fromMs), en = Math.min(o.end, toMs);
    return en > st ? (en - st) / 1000 : 0;
  }
  function calTotals(occ, fromMs, toMs) {
    var sec = 0, money = 0;
    occ.forEach(function (o) {
      var c = clipSec(o, fromMs, toMs);
      sec += c;
      money += (c / 3600) * rateNum(stream(o.streamId));
    });
    return { sec: Math.round(sec), money: money };
  }
  // локальные части даты в выбранной зоне — считаем без библиотек
  function partsIn(ms, tz) {
    var f = new Intl.DateTimeFormat("sv-SE", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false });
    var s = f.format(new Date(ms));                     // «2026-08-21 14:30»
    return { date: s.slice(0, 10), h: Number(s.slice(11, 13)), m: Number(s.slice(14, 16)) };
  }
  // начало суток указанной даты в выбранной зоне → мс
  function dayStartMs(dateStr, tz) {
    var guess = Date.parse(dateStr + "T00:00:00Z");
    for (var i = 0; i < 3; i++) {
      var p = partsIn(guess, tz);
      var diff = (p.h * 60 + p.m) * 60e3;
      if (p.date === dateStr && diff === 0) return guess;
      guess -= diff;
      if (p.date > dateStr) guess -= DAYMS / 24;
      if (p.date < dateStr) guess += DAYMS / 24;
    }
    return guess;
  }
  function addDaysStr(dateStr, n) {
    var d = new Date(Date.parse(dateStr + "T12:00:00Z") + n * DAYMS);
    return d.toISOString().slice(0, 10);
  }
  function calAnchor() { return CALV.anchor || partsIn(nowMs(), calTz()).date; }
  // видимый диапазон в датах выбранной зоны
  function calRange() {
    var a = calAnchor();
    if (CALV.scale === "day") return { from: a, to: a, days: [a] };
    if (CALV.scale === "week") {
      var wd = new Date(Date.parse(a + "T12:00:00Z")).getUTCDay();       // 0 = вс
      var shift = (wd + 6) % 7;                                          // неделя с понедельника
      var from = addDaysStr(a, -shift), days = [];
      for (var i = 0; i < 7; i++) days.push(addDaysStr(from, i));
      return { from: from, to: days[6], days: days };
    }
    var first = a.slice(0, 8) + "01";
    var wd2 = new Date(Date.parse(first + "T12:00:00Z")).getUTCDay();
    var gridFrom = addDaysStr(first, -((wd2 + 6) % 7));
    var days2 = [];
    for (var j = 0; j < 42; j++) days2.push(addDaysStr(gridFrom, j));
    return { from: gridFrom, to: days2[41], days: days2, month: a.slice(0, 7) };
  }
  // разворот слота в конкретные запуски внутри диапазона
  function expand(s, sl, fromMs, toMs) {
    var out = [], start = Date.parse(sl.start), dur = Date.parse(sl.end) - start;
    var rep = (sl.repeat && sl.repeat.type) || "none";
    var skips = sl.skips || [];
    var step = rep === "weekly" ? 7 * DAYMS : DAYMS;
    var horizon = nowMs() + F.account.horizonDays * DAYMS;
    for (var t = start, guard = 0; t <= toMs && guard < 400; guard++) {
      if (t + dur >= fromMs && t <= horizon) {
        var dstr = partsIn(t, calTz()).date;
        var wd = new Date(Date.parse(dstr + "T12:00:00Z")).getUTCDay();
        var okDay = rep !== "weekdays" || (wd >= 1 && wd <= 5);
        if (sl.until && dstr >= sl.until) break;     // правило закончилось: дальше история другого слота
        if (okDay && skips.indexOf(dstr) === -1) {
          out.push({ streamId: s.id, slotId: sl.id, start: t, end: t + dur, rep: rep, occDate: dstr });
        }
      }
      if (rep === "none") break;
      t += step;
    }
    return out;
  }
  function calOccurrences(rangeFromMs, rangeToMs) {
    var out = [];
    S.streams.forEach(function (s) {
      if (!calAll() && s.channelId !== calChannel()) return;
      if (CALV.statuses.length && CALV.statuses.indexOf(stKey(s)) === -1) return;
      (s.schedules || []).forEach(function (sl) {
        expand(s, sl, rangeFromMs, rangeToMs).forEach(function (o) { out.push(o); });
      });
    });
    // конфликт — пересечение окон на одном канале
    out.forEach(function (o) {
      var s1 = stream(o.streamId);
      o.taken = out.some(function (x) {
        if (x === o) return false;
        var s2 = stream(x.streamId);
        return s1 && s2 && s1.channelId && s1.channelId === s2.channelId && o.start < x.end && x.start < o.end;
      });
    });
    return out;
  }
  function calRunningNoWindow() {
    return S.streams.filter(function (s) {
      return running(s.status) && !(s.schedules || []).length &&
        (calAll() || s.channelId === calChannel());
    });
  }

  function renderCalendar() {
    var host = document.querySelector("[data-lv-calgrid]");
    if (!host) return;
    var r = calRange();
    var fromMs = dayStartMs(r.days[0], calTz());
    var toMs = dayStartMs(r.days[r.days.length - 1], calTz()) + DAYMS;
    var occ = calOccurrences(fromMs, toMs);

    // шапка: период, итог периода, масштаб, вид, канал, зона
    var scSel = document.querySelector("[data-lv-calscalesel]");
    if (scSel) scSel.innerHTML = selTrig("calScale", UI.selectValue({ label: SCALE_LBL[CALV.scale] }), { label: "Scale" });
    var vws = document.querySelector("[data-lv-calviews]");
    if (vws) {
      vws.innerHTML = [["cal", "Calendar"], ["list", "List"]].map(function (x) {
        return '<button class="nc-seg__btn' + (calView() === x[0] ? " is-active" : "") + '" type="button" ' +
          'data-lv-calview="' + x[0] + '"' + (calView() === x[0] ? ' aria-current="true"' : "") + ">" + x[1] + "</button>";
      }).join("");
    }
    var zw = document.querySelector("[data-lv-calzoomwrap]");
    if (zw) zw.hidden = CALV.scale === "month" || calView() === "list";
    var tot = document.querySelector("[data-lv-caltotal]");
    if (tot) {
      var tt = calTotals(occ, fromMs, toMs);
      // пустой период: прочерк честнее нулевого времени
      tot.textContent = tt.sec ? UI.dur(tt.sec) + " · ≈" + UI.money(tt.money) : "—";
    }
    var chWrap = document.querySelector("[data-lv-calchanwrap]");
    if (chWrap) {
      // один канал — выбирать нечего, селектор не показываем
      chWrap.hidden = calChans().length < 2;
      var host2 = chWrap.querySelector("[data-lv-calchansel]");
      var curCh = calAll()
        ? { label: "All channels" }
        : chanOpt(chan(calChannel()) || { id: "", name: "No channel", initial: "?", color: "var(--color-shade-300)" });
      // пояснения к варианту показываем только в открытом списке
      if (host2) host2.innerHTML = selTrig("calChan",
        UI.selectValue({ label: curCh.label, avatar: curCh.avatar }), { label: "Channel" });
    }
    var tzWrap = document.querySelector("[data-lv-caltzwrap]");
    if (tzWrap) tzWrap.innerHTML = selTrig("calTz", UI.selectValue({ label: tzShort(calTz()) }), { label: "Time zone" });
    var range = document.querySelector("[data-lv-calrange]");
    if (range) range.textContent = calPeriodLabel(r, fromMs, toMs);
    var chips = document.querySelector("[data-lv-calchips]");
    if (chips) {
      chips.innerHTML = CALV.statuses.map(function (st) {
        return chip("Status: " + (ST[st] ? ST[st].label : st), 'data-lv-calunchip="statuses:' + st + '"');
      }).join("") + (CALV.statuses.length ? '<button class="an-fchips__clear" type="button" data-lv-calclear>Clear all</button>' : "") +
      (calAll() ? '<span class="an-hint">' + T.calAllRO + "</span>" : "");
      chips.hidden = !CALV.statuses.length && !calAll();
    }
    // алерт остался один: нулевой баланс. Пересечений в расписании не бывает — их не дают создать
    var warn = document.querySelector("[data-lv-calwarn]");
    var a = acc(), zero = a.kind === "money" && a.balance <= 0;
    var alertKey = calChannel() + "|" + r.from + "|" + CALV.scale + "|" + (zero ? "z" : "");
    if (warn) {
      warn.hidden = !zero || CALV.alertOff === alertKey;
      warn.setAttribute("data-lv-alertkey", alertKey);
      warn.className = "an-alert an-alert-dock an-alert--attention";
      warn.innerHTML = zero
        ? "<span>" + T.paused + "</span>" + '<span class="an-alert__acts">' + btn(T.topUp, "primary", "data-lv-topup") + "</span>"
        : "";
      if (!warn.hidden) {
        var acts = warn.querySelector(".an-alert__acts");
        var xBtn = '<button class="an-alert__x" type="button" data-lv-alertclose aria-label="Dismiss">' +
          (IC.close || "×") + "</button>";
        if (acts) acts.insertAdjacentHTML("beforeend", xBtn);
        else warn.insertAdjacentHTML("beforeend", '<span class="an-alert__acts">' + xBtn + "</span>");
      }
    }
    // пустое состояние
    var empty = document.querySelector("[data-lv-calempty]");
    if (empty) {
      var none = !occ.length && !calRunningNoWindow().length;
      empty.hidden = !none;
      var liveNoWin = calRunningNoWindow();
      empty.innerHTML = !none ? ""
        : '<div class="an-blank lv-empty"><span class="an-blank__ico"><svg><use href="#ic-calendar"></use></svg></span>' +
            '<p class="an-blank__title">Nothing scheduled in this period</p>' +
            '<p class="an-blank__text">Click any slot to schedule a stream. You can plan up to ' + F.account.horizonDays + " days ahead.</p>" +
            // эфир без окна в сетку не попадает: иначе пустой календарь при живом эфире читается как ошибка
            (liveNoWin.length
              ? '<p class="an-blank__text">“' + UI.esc(liveNoWin[0].name) + "” is live without a window, so it isn’t on the calendar.</p>"
              : "") +
            '<div class="an-head__btns">' + btn("New stream", "primary", "data-lv-new") + "</div></div>";
    }

    var listHost = document.querySelector("[data-lv-callist]");
    var isList = calView() === "list";
    host.hidden = isList;
    if (listHost) {
      listHost.hidden = !isList;
      listHost.innerHTML = isList ? calListHtml(r, occ, fromMs, toMs) : "";
    }
    if (isList) return;
    host.className = "lv-cal lv-cal--" + CALV.scale;
    host.style.setProperty("--lv-hour", calHour() + "px");
    host.innerHTML = CALV.scale === "month" ? calMonth(r, occ) : calTime(r, occ, zero);
    // при пустом периоде линия now резала бы текст подсказки поверх сетки
    if (typeof none !== "undefined" && none) [].forEach.call(host.querySelectorAll(".lv-cal__now"), function (el) { el.style.display = "none"; });
    calFitLabels(host);
    calScroll(host, occ);
  }
  // сетка скроллится сама, а не всей страницей: ставим её сразу на первый эфир периода
  function calScroll(host, occ) {
    var grid = host.querySelector(".lv-cal__grid");
    if (!grid) return;
    var mins = occ.reduce(function (m, o) {
      var p = partsIn(o.start, calTz());
      return Math.min(m, p.h * 60 + p.m);
    }, 8 * 60);
    grid.scrollTop = Math.max(0, ((Math.max(0, mins - 60)) / 60) * calHour());
  }
  // Repeat из колонок убран: повторов в бэкенде не существует как сущности (Э4)
  var CL_COLS = "190px minmax(0,1fr) 200px 150px 120px 110px";
  // ---- вид «List»: те же слоты периода, сгруппированные по дням
  function calListHtml(r, occ, fromMs, toMs) {
    var run = calRunningNoWindow();
    var byDay = {};
    occ.forEach(function (o) {
      var d = partsIn(Math.max(o.start, fromMs), calTz()).date;
      (byDay[d] = byDay[d] || []).push(o);
    });
    var days = r.days.filter(function (d) { return byDay[d] && byDay[d].length; });
    var rows = days.map(function (d) {
      var dFrom = dayStartMs(d, calTz()), dTo = dFrom + DAYMS;
      var list = byDay[d].sort(function (x, y) { return x.start - y.start; });
      var dSec = list.reduce(function (n, o) { return n + clipSec(o, dFrom, dTo); }, 0);
      return '<div class="an-tr an-tr--avg lv-clday" style="grid-template-columns:' + CL_COLS + '">' +
          '<div class="an-td">' + UI.day(new Date(dFrom).toISOString(), calTz()) +
            (d === partsIn(nowMs(), calTz()).date ? ' <span class="ml-tag ml-tag--sm ml-tag--pill ml-tag--brand lv-clday__today">Today</span>' : "") + "</div>" +
          '<div class="an-td an-td--r"><b>' + UI.dur(Math.round(dSec)) + "</b></div><div class=\"an-td\"></div></div>" +
        list.map(function (o) {
          var s = stream(o.streamId), ch = chan(s.channelId);
          var sec = Math.round((o.end - o.start) / 1000);
          var cross = partsIn(o.start, calTz()).date !== partsIn(o.end, calTz()).date;
          // окно идёт прямо сейчас: показываем, сколько стрим уже в эфире
          var onAirNow = running(s.status) && o.start <= nowMs() && nowMs() < o.end;
          var airSec = onAirNow
            ? Math.max(0, Math.round((nowMs() - Date.parse((runOf(s) || {}).start || new Date(o.start).toISOString())) / 1000))
            : 0;
          return '<button class="an-tr an-tr--link" type="button" ' +
            'style="grid-template-columns:' + CL_COLS + '" ' +
            'data-lv-occ="' + o.streamId + "|" + o.slotId + "|" + o.occDate + '">' +
            '<span class="an-td">' + UI.time(new Date(o.start).toISOString(), calTz()) + " → " +
              UI.time(new Date(o.end).toISOString(), calTz()) + (cross ? ' <span class="an-muted">next day</span>' : "") + "</span>" +
            '<span class="an-td">' + UI.esc(s.name) + "</span>" +
            '<span class="an-td">' + chanHtml(s) + "</span>" +
            '<span class="an-td">' + stBadge(stKey(s)) + "</span>" +
            '<span class="an-td an-td--r"' + (onAirNow ? ' data-tip="Time on air so far."' : '') + ">" +
              (onAirNow ? UI.dur(airSec) : UI.dur(sec)) + "</span>" +
            '<span class="an-td an-td--r">≈' + UI.money((sec / 3600) * rateNum(s)) + "</span>" +
            "</button>";
        }).join("");
    }).join("");
    var runRows = run.length
      ? '<div class="an-tr an-tr--avg lv-clday" style="grid-template-columns:' + CL_COLS + '">' +
        '<div class="an-td">Running now <span class="an-muted">· no end time</span></div>' +
        '<div class="an-td"></div><div class="an-td"></div></div>' +
        run.map(function (s) {
          var ch = chan(s.channelId);
          return '<button class="an-tr an-tr--link" type="button" style="grid-template-columns:' + CL_COLS + '" ' +
            'data-lv-calopen="' + s.id + '">' +
            '<span class="an-td">' + UI.time(new Date(nowMs()).toISOString(), calTz()) + ' <span class="an-muted">on air</span></span>' +
            '<span class="an-td">' + UI.esc(s.name) + "</span>" +
            '<span class="an-td">' + chanHtml(s) + "</span>" +
            '<span class="an-td">' + stBadge(stKey(s)) + "</span>" +
            // у идущего стрима длительность — фактическое время в эфире, а стоимость без окна неизвестна
            '<span class="an-td an-td--r">' + UI.dur(Math.max(0, Math.round((nowMs() - Date.parse((runOf(s) || {}).start || new Date(nowMs()).toISOString())) / 1000))) + "</span>" +
            '<span class="an-td an-td--r"><span class="an-muted">—</span></span>' +
            "</button>";
        }).join("")
      : "";
    if (!rows && !runRows) return "";
    var head = ["Time", "Stream", "Channel", "Status", "Duration", "Cost"];
    return '<div class="an-table an-table--grid">' +
      '<div class="an-tr an-tr--head" style="grid-template-columns:' + CL_COLS + '">' +
        head.map(function (h, i) {
          return '<div class="an-th' + (i > 3 ? " an-th--r" : "") + '">' + h + "</div>";
        }).join("") + "</div>" +
      runRows + rows + "</div>";
  }
  // строк имени столько, сколько влезает: иначе в узкой дорожке многоточие съедает полназвания
  function calFitLabels(host) {
    [].slice.call(host.querySelectorAll(".lv-bar[data-lv-occ]")).forEach(function (b) {
      var n = b.querySelector(".lv-bar__n");
      if (!n) return;
      var room = b.clientHeight - (b.querySelector(".lv-bar__c") ? 20 : 6);
      n.style.setProperty("--lvlines", String(Math.max(1, Math.min(8, Math.floor(room / 15)))));
    });
  }

  // ---- бегущие без окна: отдельная полоса сверху
  function calRunRow() {
    var run = calRunningNoWindow();
    if (!run.length) return "";
    return '<div class="lv-cal__nowrow"><span class="lv-cal__nowlbl">Running now · no end time</span>' +
      run.map(function (s) {
        var ch = chan(s.channelId);
        return '<button class="lv-bar lv-bar--' + stKey(s) + ' lv-bar--inline" type="button" data-lv-calopen="' + s.id + '">' +
          '<span class="lv-bar__n">' + UI.esc(s.name) + "</span>" +
          '<span class="lv-bar__c">· ' + UI.esc(chanName(s)) + "</span></button>";
      }).join("") + "</div>";
  }

  // ---- недельный и дневной вид: ось времени слева, полосы по колонкам дней
  function calTime(r, occ, dim) {
    var ro = calAll();                     // обзор всех каналов: окна не двигаем
    var hours = "";
    for (var h = 0; h < 24; h++) hours += '<div class="lv-cal__h"><span>' + String(h).padStart(2, "0") + ":00</span></div>";
    var nowP = partsIn(nowMs(), calTz());
    var cols = r.days.map(function (d) {
      var dFrom = dayStartMs(d, calTz()), dTo = dFrom + DAYMS;
      var dayOcc = occ.filter(function (o) { return o.start < dTo && o.end > dFrom; })
        .sort(function (a2, b2) { return a2.start - b2.start; });
      // дорожки считаем внутри группы реально пересекающихся окон: одинокая полоса
      // занимает всю ширину колонки, делят её только те, кому действительно тесно
      var groups = [], cur = null;
      dayOcc.forEach(function (o) {
        var st2 = Math.max(o.start, dFrom), en2 = Math.min(o.end, dTo);
        if (!cur || st2 >= cur.end) { cur = { end: en2, items: [o] }; groups.push(cur); }
        else { cur.items.push(o); cur.end = Math.max(cur.end, en2); }
      });
      // параллельные эфиры на одном канале легальны, поэтому дорожки считаются всегда
      groups.forEach(function (g) {
        var lanes = [];
        g.items.forEach(function (o) {
          var li = 0;
          while (lanes[li] !== undefined && lanes[li] > Math.max(o.start, dFrom)) li++;
          lanes[li] = Math.min(o.end, dTo);
          o._lane = li;
        });
        var n = Math.max(1, lanes.length);
        g.items.forEach(function (o) { o._lanes = n; });
      });
      var bars = dayOcc.map(function (o) {
        var s = stream(o.streamId), ch = chan(s.channelId);
        var top = Math.max(0, (o.start - dFrom) / DAYMS) * 100;
        var height = Math.min(100 - top, ((Math.min(o.end, dTo) - Math.max(o.start, dFrom)) / DAYMS) * 100);
        var cont = o.start < dFrom, contAfter = o.end > dTo;
        var w = 100 / (o._lanes || 1), left = o._lane * w;
        var past = o.start <= nowMs();                 // запуск уже начался или прошёл — это история
        return '<button class="lv-bar lv-bar--' + stKey(s) +
          (ro ? " is-ro" : "") + (past ? " is-past" : "") + '" type="button" ' +
          'style="top:' + top.toFixed(2) + "%;height:" + Math.max(2.2, height).toFixed(2) +
          "%;left:calc(" + left.toFixed(2) + "% + 3px);width:calc(" + w.toFixed(2) + '% - 6px)" ' +
          'data-lv-occ="' + o.streamId + "|" + o.slotId + "|" + o.occDate + '" ' +
          (ro ? ' data-tip="' + UI.esc(T.calAllRO) + '"' : past ? ' data-tip="' + UI.esc(T.pastRun) + '"' : "") +
          'aria-label="' + UI.esc(s.name + ", " + UI.dt(new Date(o.start).toISOString(), calTz())) + '">' +
          '<span class="lv-bar__n">' + (cont ? "↑ " : "") + UI.esc(s.name) + (contAfter ? " ↓" : "") + "</span>" +
          // канал на полосе нужен только в обзоре: при одном канале он и так в шапке
          (ro
            ? '<span class="lv-bar__c">' + UI.esc(chanName(s)) +
              (o.rep !== "none" ? " " + (IC.restart || "") : "") + "</span>"
            : o.rep !== "none" ? '<span class="lv-bar__c">' + (IC.restart || "") + "</span>" : "") +
          (ro || past ? "" : '<span class="lv-bar__grip" data-lv-resize="' + o.streamId + "|" + o.slotId + '"></span>') +
        "</button>";
      }).join("");
      var isToday = d === partsIn(nowMs(), calTz()).date;
      var nowLine = isToday
        ? '<div class="lv-cal__now" style="top:' + (((nowP.h * 60 + nowP.m) / 1440) * 100).toFixed(2) + '%"></div>' : "";
      var dSec = dayOcc.reduce(function (n, o) {
        var st3 = Math.max(o.start, dFrom), en3 = Math.min(o.end, dTo);
        return n + (en3 > st3 ? (en3 - st3) / 1000 : 0);
      }, 0);
      return '<div class="lv-cal__col' + (isToday ? " is-today" : "") + (dim ? " is-dim" : "") + '" data-lv-calday="' + d + '">' +
        '<div class="lv-cal__colhead"><span class="lv-cal__dh">' +
          '<b class="lv-cal__dnum">' + Number(d.slice(8)) + '</b><span class="lv-cal__dwd">' + wd3(d) + "</span></span>" +
          (dSec ? '<span class="lv-cal__dtot">' + UI.dur(Math.round(dSec)) + "</span>" : "") + "</div>" +
        '<div class="lv-cal__cells" data-lv-calcells="' + d + '">' + nowLine + bars + "</div></div>";
    }).join("");
    return calRunRow() +
      '<div class="lv-cal__grid"><div class="lv-cal__axis"><div class="lv-cal__colhead lv-cal__zoom">' +
        '<button class="an-btn an-btn--secondary an-btn--tiny" type="button" data-lv-calzoom="-" aria-label="Shorter rows">−</button>' +
        '<button class="an-btn an-btn--secondary an-btn--tiny" type="button" data-lv-calzoom="+" aria-label="Taller rows">+</button>' +
      '</div><div class="lv-cal__hours">' + hours + "</div></div>" +
      '<div class="lv-cal__cols">' + cols + "</div></div>";
  }

  // ---- месяц: до трёх полос в дне, дальше «+N more»
  function calMonth(r, occ) {
    var wdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
      .map(function (w) { return '<div class="lv-cal__wd">' + w + "</div>"; }).join("");
    var cells = r.days.map(function (d) {
      var dFrom = dayStartMs(d, calTz()), dTo = dFrom + DAYMS;
      var list = occ.filter(function (o) { return o.start < dTo && o.end > dFrom; });
      var shown = list.slice(0, 3).map(function (o) {
        var s = stream(o.streamId);
        return '<button class="lv-mbar lv-bar--' + stKey(s) + '" type="button" ' +
          'data-lv-occ="' + o.streamId + "|" + o.slotId + "|" + o.occDate + '">' +
          UI.time(new Date(o.start).toISOString(), calTz()) + " " + UI.esc(s.name) + "</button>";
      }).join("");
      var more = list.length > 3 ? '<span class="lv-next__more" tabindex="0" data-tip="' +
        UI.esc(list.slice(3).map(function (o) { return (stream(o.streamId) || {}).name; }).join(" · ")) + '">+' +
        (list.length - 3) + " more</span>" : "";
      var outside = r.month && d.slice(0, 7) !== r.month;
      return '<div class="lv-cal__mcell' + (outside ? " is-outside" : "") +
        (d === partsIn(nowMs(), calTz()).date ? " is-today" : "") + '" data-lv-calday="' + d + '">' +
        '<span class="lv-cal__mday">' + Number(d.slice(8)) + "</span>" + shown + more + "</div>";
    }).join("");
    return calRunRow() + '<div class="lv-cal__month"><div class="lv-cal__wds">' + wdays + "</div>" +
      '<div class="lv-cal__mgrid">' + cells + "</div></div>";
  }

  // ---- карточка слота
  function calCard(o, anchor) {
    var s = stream(o.streamId), sl = (s.schedules || []).filter(function (x) { return x.id === o.slotId; })[0];
    var ch = chan(s.channelId), pl = content(s);
    var hours = (o.end - o.start) / 3600e3;
    var pop = popEl();
    pop.innerHTML = '<p class="lv-pop__t">' + UI.esc(s.name) + "</p>" +
      '<div class="lv-kv">' +
        kv("Channel", UI.esc(chanName(s))) +
        kv("Window", UI.dt(new Date(o.start).toISOString(), calTz()) + " → " +
          (UI.day(new Date(o.start).toISOString(), calTz()) === UI.day(new Date(o.end).toISOString(), calTz())
            ? UI.time(new Date(o.end).toISOString(), calTz())
            : UI.dt(new Date(o.end).toISOString(), calTz()))) +
        kv("Playlist", UI.esc(pl ? pl.name : "—")) +
        kv("Window cost", "≈" + UI.money(hours * rateNum(s))) +
        (o.rep !== "none" ? kv("Repeat", REP[o.rep] || o.rep) : "") +

      "</div>" +
      '<div class="lv-pop__foot">' +
        btn("Open", "secondary", 'data-lv-calopen="' + s.id + '"') +
        // идущий стрим не редактируется и окно у него не удалить: та же причина, что на карточке
        (why("edit", s) || o.start <= nowMs()
          ? '<button class="an-btn an-btn--secondary an-btn--small is-off" type="button" aria-disabled="true" data-tip="' + UI.esc(why("edit", s) || T.pastRun) + '">Edit</button>' +
            '<button class="an-btn an-btn--danger an-btn--small is-off" type="button" aria-disabled="true" data-tip="' + UI.esc(why("edit", s) || T.pastRun) + '">Delete slot</button>'
          : btn("Edit", "secondary", 'data-lv-caledit="' + s.id + '"') +
            btn("Delete slot", "danger", 'data-lv-calslotdel="' + s.id + "|" + sl.id + '"')) +
      "</div>";
    placePop(pop, anchor);
  }

  // ---- перенос и растягивание
  var DRAG = null;
  function calDragStart(e, bar, mode) {
    var parts = bar.getAttribute(mode === "resize" ? "data-lv-resize" : "data-lv-occ").split("|");
    var cells = bar.closest("[data-lv-calcells]");
    if (!cells) return;
    var el = bar.closest(".lv-bar") || bar;
    if (el.classList.contains("is-past")) return;
    DRAG = { mode: mode, streamId: parts[0], slotId: parts[1], occDate: parts[2] || null,
             y0: e.clientY, x0: e.clientX, h: cells.getBoundingClientRect().height,
             bar: el, h0: el.style.height, moved: false };
    e.preventDefault();
  }
  document.addEventListener("mousedown", function (e) {
    if (PAGE === "calendar" && calAll()) return;        // обзор всех каналов — только чтение
    var grip = e.target.closest && e.target.closest("[data-lv-resize]");
    if (grip) { calDragStart(e, grip, "resize"); return; }
    var bar = e.target.closest && e.target.closest("[data-lv-occ]");
    if (bar && PAGE === "calendar" && CALV.scale !== "month") { calDragStart(e, bar, "move"); return; }
    // пустое место в сетке: окно рисуется протяжкой
    var cellsEl = e.target.closest && e.target.closest("[data-lv-calcells]");
    if (cellsEl && PAGE === "calendar" && CALV.scale !== "month") calDrawStart(e, cellsEl);
  });
  // Заготовка окна: минимум 15 минут, шаг 15 минут — как у переноса и растягивания.
  var DRAW = null;
  function calDrawStart(e, cells) {
    calDrawDrop();                       // одна заготовка за раз
    var r = cells.getBoundingClientRect();
    DRAW = { date: cells.getAttribute("data-lv-calcells"), cells: cells, h: r.height, top: r.top,
             from: calDrawMin(e.clientY - r.top, r.height), to: null, ghost: null, moved: false };
    e.preventDefault();
  }
  function calDrawMin(y, h) {
    var min = Math.round((Math.max(0, Math.min(h, y)) / h) * 1440 / 15) * 15;
    return Math.max(0, Math.min(1440, min));
  }
  function calDrawGhost() {
    var a = Math.min(DRAW.from, DRAW.to), b = Math.max(DRAW.from, DRAW.to);
    if (b - a < 15) b = a + 15;
    if (!DRAW.ghost) {
      DRAW.ghost = document.createElement("div");
      DRAW.ghost.className = "lv-cal__draw";
      DRAW.cells.appendChild(DRAW.ghost);
    }
    DRAW.ghost.style.top = (a / 1440 * 100).toFixed(2) + "%";
    DRAW.ghost.style.height = ((b - a) / 1440 * 100).toFixed(2) + "%";
    DRAW.ghost.innerHTML = '<span class="lv-cal__draw__t">' + UI.dur((b - a) * 60) + "</span>" +
      '<span class="lv-cal__draw__w">' + calDrawTime(a) + " → " + calDrawTime(b) + "</span>";
    return { a: a, b: b };
  }
  function calDrawTime(min) {
    var hh = String(Math.floor(min / 60) % 24), mm = String(min % 60);
    return (hh.length < 2 ? "0" + hh : hh) + ":" + (mm.length < 2 ? "0" + mm : mm);
  }
  function calDrawEnd() {
    var d = DRAW; DRAW = null;
    if (!d.moved || d.to === null) { if (d.ghost) d.ghost.remove(); calNewAt(d.date, d.from / 1440); return; }
    var a = Math.min(d.from, d.to), b = Math.max(d.from, d.to);
    if (b - a < 15) b = a + 15;
    var day0 = dayStartMs(d.date, calTz());
    // заготовка остаётся на месте, решение принимается рядом с ней
    DRAWN = { date: d.date, start: day0 + a * 60e3, end: day0 + b * 60e3, ghost: d.ghost, cells: d.cells };
    calDrawBar();
  }
  // панель у нижнего края заготовки: границы окна, длительность, стрим и «Add»
  var DRAWN = null;
  function calDrawBar() {
    if (!DRAWN) return;
    var bar = DRAWN.bar || document.createElement("div");
    DRAWN.bar = bar;
    bar.className = "lv-cal__drawbar";
    bar.style.top = "calc(" + DRAWN.ghost.style.top + " + " + DRAWN.ghost.style.height + " + 6px)";
    bar.innerHTML =
      '<span class="lv-cal__drawbar__w">' + UI.time(new Date(DRAWN.start).toISOString(), calTz()) +
        ' <span class="an-muted">→</span> ' + UI.time(new Date(DRAWN.end).toISOString(), calTz()) + "</span>" +
      '<span class="lv-cal__drawbar__d">' + UI.dur((DRAWN.end - DRAWN.start) / 1000) + "</span>" +
      btn("Create stream", "primary", "data-lv-drawadd") +
      '<button class="mc-more" type="button" data-lv-drawcancel aria-label="Discard the window">' + (IC.close || "") + "</button>";
    if (!bar.parentNode) DRAWN.cells.appendChild(bar);
  }
  function calDrawDrop() {
    if (!DRAWN) return;
    if (DRAWN.ghost) DRAWN.ghost.remove();
    if (DRAWN.bar) DRAWN.bar.remove();
    DRAWN = null;
  }
  // нарисованное окно уходит в мастер: слот и канал уже заполнены, остальное решает человек
  function calDrawAdd() {
    if (!DRAWN) return;
    calNewRange(DRAWN.start, DRAWN.end);
  }
  document.addEventListener("mousemove", function (e) {
    if (DRAW) {
      DRAW.to = calDrawMin(e.clientY - DRAW.top, DRAW.h);
      if (Math.abs(DRAW.to - DRAW.from) >= 15) DRAW.moved = true;
      if (DRAW.moved) calDrawGhost();
      return;
    }
    if (!DRAG) return;
    if (Math.abs(e.clientY - DRAG.y0) > 4 || Math.abs(e.clientX - DRAG.x0) > 4) {
      DRAG.moved = true;
      DRAG.bar.classList.add("is-dragging");
    }
    if (DRAG.moved) calDragPreview(e);
  });
  // Полоса едет за курсором с шагом 15 минут и показывает новое окно: без этого перенос
  // выглядел так, будто ничего не происходит, пока не отпустишь кнопку.
  function calDragPreview(e) {
    var d = DRAG, s = stream(d.streamId), sl = s && (s.schedules || []).filter(function (x) { return x.id === d.slotId; })[0];
    if (!sl) return;
    var stepPx = d.h / 96;
    var dyMin = Math.round(((e.clientY - d.y0) / d.h) * 1440 / 15) * 15;
    var dyPx = dyMin / 15 * stepPx;
    var start = Date.parse(sl.start), end = Date.parse(sl.end);
    if (d.mode === "resize") {
      var lenMin = Math.max(15, (end - start) / 60e3 + dyMin);
      d.bar.style.height = Math.max(2, lenMin / 1440 * d.h) + "px";
      end = start + lenMin * 60e3;
    } else {
      d.bar.style.transform = "translate(" + (e.clientX - d.x0) + "px," + dyPx + "px)";
      start += dyMin * 60e3; end += dyMin * 60e3;
    }
    var tag = d.bar.querySelector(".lv-bar__drag");
    if (!tag) { tag = document.createElement("span"); tag.className = "lv-bar__drag"; d.bar.appendChild(tag); }
    tag.textContent = UI.time(new Date(start).toISOString(), calTz()) + " → " + UI.time(new Date(end).toISOString(), calTz());
  }
  document.addEventListener("mouseup", function (e) {
    if (DRAW) { calDrawEnd(); return; }
    if (!DRAG) return;
    var d = DRAG; DRAG = null;
    d.bar.classList.remove("is-dragging");
    d.bar.style.transform = ""; d.bar.style.height = d.h0 || "";
    var dtag = d.bar.querySelector(".lv-bar__drag"); if (dtag) dtag.remove();
    if (!d.moved) return;                                   // обычный клик — карточка слота
    var s = stream(d.streamId), sl = (s.schedules || []).filter(function (x) { return x.id === d.slotId; })[0];
    if (!sl) return;
    // сдвиг по вертикали — время, по горизонтали — день
    var dyMin = Math.round(((e.clientY - d.y0) / d.h) * 1440 / 15) * 15;
    var dayEl = document.elementFromPoint(e.clientX, e.clientY);
    var col = dayEl && dayEl.closest && dayEl.closest("[data-lv-calday]");
    var newDay = col ? col.getAttribute("data-lv-calday") : null;
    if (d.mode === "resize") {
      var newEnd = Date.parse(sl.end) + dyMin * 60e3;
      if (newEnd - Date.parse(sl.start) < 15 * 60e3) return;
      if (!slotFits(s, { id: sl.id, start: sl.start, end: new Date(newEnd).toISOString() })) {
        renderCalendar(); UI.toast(T_SELF_OVERLAP); return;
      }
      sl.end = new Date(newEnd).toISOString();
      save(); renderCalendar();
      UI.toast("Window is now " + UI.durHuman((Date.parse(sl.end) - Date.parse(sl.start)) / 1000) +
        " · ≈" + UI.money(((Date.parse(sl.end) - Date.parse(sl.start)) / 3600e3) * rateNum(s)) + ".");
      return;
    }
    var shift = dyMin * 60e3;
    if (newDay && d.occDate && newDay !== d.occDate) {
      shift += (dayStartMs(newDay, calTz()) - dayStartMs(d.occDate, calTz()));
    }
    if (!shift) return;
    calMoveAsk(s, sl, d.occDate, shift);
  });
  // сдвиг словами: «1 day 30 min later» читается, «+90 min» — нет
  function shiftLabel(ms) {
    var min = Math.round(Math.abs(ms) / 60e3);
    var d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = min % 60;
    var parts = [];
    if (d) parts.push(UI.plural(d, "day", "days"));
    if (h) parts.push(h + " h");
    if (m) parts.push(m + " min");
    return (parts.join(" ") || "0 min") + (ms < 0 ? " earlier" : " later");
  }
  // Э9 · 15: перенос повторяющегося слота — только этот запуск или все будущие
  function calMoveAsk(s, sl, occDate, shift) {
    var apply = function (onlyThis) {
      var day0 = dayStartMs(partsIn(Date.parse(sl.start), calTz()).date, calTz());
      var cand = onlyThis
        ? { id: "sl" + Date.now(), tz: sl.tz || TZ, repeat: { type: "none" },
            start: new Date(dayStartMs(occDate, calTz()) + (Date.parse(sl.start) - day0) + shift).toISOString(),
            end: new Date(dayStartMs(occDate, calTz()) + (Date.parse(sl.end) - day0) + shift).toISOString() }
        : { id: "sl" + Date.now(), tz: sl.tz || TZ, repeat: sl.repeat, skips: [],
            start: new Date(dayStartMs(occDate, calTz()) + (Date.parse(sl.start) - day0) + shift).toISOString(),
            end: new Date(dayStartMs(occDate, calTz()) + (Date.parse(sl.end) - day0) + shift).toISOString() };
      // окно, занятое другим стримом того же канала, не отдаём: пересечений в данных не бывает
      if (!slotFits(s, cand)) { renderCalendar(); UI.toast(T_SELF_OVERLAP); return; }
      if (onlyThis) {
        sl.skips = (sl.skips || []).concat([occDate]);
        s.schedules.push(cand);
      } else if (occDate === partsIn(Date.parse(sl.start), calTz()).date) {
        // тянут самый первый запуск — истории ещё нет, правило просто переезжает
        sl.start = cand.start; sl.end = cand.end;
      } else {
        sl.until = occDate;                           // прошедшие запуски остаются как были
        s.schedules.push(cand);
      }
      save(); renderCalendar();
      // одиночное окно не имеет будущих запусков — про них и не говорим
      var repeats = sl.repeat && sl.repeat.type !== "none";
      UI.toast(!repeats
        ? "Window moved to " + UI.dt(cand.start, calTz()).replace(",", "") + "."
        : onlyThis
          ? "This run moved to " + UI.dt(cand.start, calTz()).replace(",", "") + "."
          : "This and future runs moved " + shiftLabel(shift) + ".");
    };
    if (!sl.repeat || sl.repeat.type === "none") { apply(false); return; }
    // куда уезжает схваченный запуск — это одинаково для обоих вариантов
    var day0 = dayStartMs(partsIn(Date.parse(sl.start), calTz()).date, calTz());
    var fromMs = dayStartMs(occDate, calTz()) + (Date.parse(sl.start) - day0);
    var toMs = fromMs + shift;
    var body = '<p class="an-modal__text">“' + UI.esc(s.name) + '” repeats ' +
        (REP[sl.repeat.type] || "").toLowerCase() + ".</p>" +
      '<div class="lv-kv">' +
        kv("Dragged run", UI.dt(new Date(fromMs).toISOString(), calTz()).replace(",", "") + " → " +
          UI.dt(new Date(toMs).toISOString(), calTz()).replace(",", "")) +
        kv("Shift", shiftLabel(shift)) +
      "</div>" +
      '<div class="lv-kv"><label class="lv-radio is-active"><input type="radio" name="lvCalMove" value="one" checked />' +
        "<span>Only this run" +
        '<span class="lv-radio__d">This date moves once. Other days keep ' +
          UI.time(sl.start, calTz()) + ".</span></span></label>" +
      '<label class="lv-radio"><input type="radio" name="lvCalMove" value="all" />' +
        "<span>This and future runs" +
        '<span class="lv-radio__d">Every run from this date shifts ' + shiftLabel(shift) +
          ". Past runs stay as they were.</span></span></label></div>";
    var m = modalShell("lvCalMove", "Move a repeating run", body,
      btn("Cancel", "secondary", "data-lv-close data-lv-focus") + btn("Move", "primary", 'data-lv-do="calmove"'));
    m.querySelector('[data-lv-do="calmove"]').onclick = function () {
      var v = m.querySelector('input[name="lvCalMove"]:checked');
      UI.closeModals();
      apply(!v || v.value === "one");
    };
    // отказ возвращает сетку: перетаскивание уже сдвинуло вид, данные — ещё нет
    [].forEach.call(m.querySelectorAll("[data-lv-close]"), function (b) {
      b.addEventListener("click", function () { renderCalendar(); });
    });
  }
  // клик по пустому слоту — создание с предзаполненным окном
  // клик по пустому месту — окно по умолчанию, протяжка — окно, которое человек нарисовал
  // клик по пустому месту — окно по умолчанию на два часа, дальше тот же мастер
  function calNewAt(dateStr, ratio) {
    var mins = Math.round((ratio * 1440) / 30) * 30;
    var start0 = dayStartMs(dateStr, calTz()) + mins * 60e3;
    calNewRange(start0, start0 + 2 * 3600e3);
  }
  function calNewRange(start, end) {
    var ch = calChannel();
    location.href = "live-stream-create.html?start=" + encodeURIComponent(new Date(start).toISOString()) +
      "&end=" + encodeURIComponent(new Date(end).toISOString()) +
      (ch && ch !== "__all" ? "&channel=" + encodeURIComponent(ch) : "");
  }
  function calFiltersPopover(anchor) {
    var pop = popEl();
    // канал теперь не фильтр, а режим просмотра — он живёт в шапке
    pop.innerHTML = '<p class="lv-pop__t">Status</p>' +
      Object.keys(ST).map(function (k) {
        return '<div class="lv-pop__row"><span>' + ST[k].label + "</span>" +
          UI.switchHtml('data-lv-calf="statuses:' + k + '"', CALV.statuses.indexOf(k) !== -1, ST[k].label) + "</div>";
      }).join("") +
      '<div class="lv-pop__foot">' + btn("Clear all", "secondary", "data-lv-calclear") + "</div>";
    placePop(pop, anchor);
  }


  // ============================================================ Э7 · уведомления
  // Матрица «событие × канал». Три события в колокольчике не снимаются: это случаи,
  // когда пользователь теряет деньги или эфир. Заблокированный чекбокс видим с причиной.
  var EVENTS = [
    { k: "wentLive", l: "Stream went live" },
    { k: "recovered", l: "Stream failed and recovered" },
    { k: "stayedDown", l: "Stream failed and stayed down" },
    { k: "autostartFail", l: "Autostart failed" },
    { k: "finished", l: "Stream finished" },
    { k: "backup", l: "Switched to backup stream" },
    { k: "convFinished", l: "Conversion finished" },
    { k: "convFailed", l: "Conversion failed" }
  ];
  var CHANS = [{ i: 0, l: "In-app" }, { i: 1, l: "Email" }, { i: 2, l: "Telegram" }];
  var LOCK_REASON = "This event is always sent in the app.";

  function notif() {
    if (!S.notifications) S.notifications = clone(F.notifications);
    return S.notifications;
  }
  function renderSettings() {
    var host = document.querySelector("[data-lv-set]");
    if (!host) return;
    var n = notif(), tg = n.telegram;
    document.title = "Notifications — SubSub";
    host.innerHTML =
      '<div class="lv-dhead"><div class="lv-dhead__l"><div class="lv-dtitle">' +
        '<h1 class="lv-dtitle__n">Notifications</h1></div>' +
        '<div class="lv-dmeta"><span>Events are always written to the log, even when a channel is off.</span></div>' +
      "</div></div>" +
      '<h2 class="lv-set__prod">Live</h2>' +

      '<section class="rp-card">' +
        '<div class="lv-card__h"><h2 class="lv-card__t">Events</h2>' +
          '<span class="lv-card__sub">A series of reconnects collapses into one message: “Reconnected 4 times in the last hour.”</span></div>' +
        '<div class="lv-card__b">' +
          '<div class="an-tr an-tr--head lv-mx"><span class="an-th"></span>' + CHANS.map(function (c) { return '<span class="an-th">' + c.l + "</span>"; }).join("") + "</div>" +
          EVENTS.map(function (ev2) {
            var row = n.matrix[ev2.k] || { on: [false, false, false] };
            return '<div class="an-tr lv-mx"><span class="an-td">' +
              UI.esc(ev2.l) + "</span>" +
              CHANS.map(function (c) {
                var locked = row.locked && row.locked[c.i];
                // «включено и заблокировано» — третье состояние: и не как включённый, и не как выключенный
                return "<span>" + (locked
                  ? '<button class="lv-sw is-on is-locked" type="button" role="switch" aria-checked="true" ' +
                    'aria-disabled="true" data-tip="' + UI.esc(LOCK_REASON) + '" ' +
                    'aria-label="' + UI.esc(ev2.l + " · " + c.l) + '">' +
                    '<span class="lv-sw__dot">' + (IC.check || "") + "</span></button>"
                  : UI.switchHtml('data-lv-nf="' + ev2.k + ":" + c.i + '"',
                      !!row.on[c.i], ev2.l + " · " + c.l)) + "</span>";
              }).join("") + "</div>";
          }).join("") +
        "</div></section>" +

      '<section class="rp-card">' +
        '<div class="lv-card__h"><h2 class="lv-card__t">Channels</h2></div>' +
        '<div class="lv-card__b lv-card__b--pad lv-form">' +
          '<div class="lv-form__row"><span class="ai-lbl">In-app</span>' +
            '<span class="an-hint">Always on. You can turn off single events above.</span></div>' +
          '<div class="lv-form__row"><span class="ai-lbl">Email</span>' +
            "<span>" + UI.esc(n.email) + "</span>" +
            '<span class="an-hint">Notifications go to your account email.</span></div>' +
          '<div class="lv-form__row"><span class="ai-lbl">Telegram</span>' +
            (tg.state === "connected"
              ? '<span class="ml-tag ml-tag--ok">Connected · ' + UI.esc(tg.account) + "</span>" +
                btn("Send test message", "secondary", "data-lv-tgtest") +
                btn("Disconnect", "secondary", "data-lv-tgoff")
              : tg.state === "pending"
                ? '<span class="ml-tag ml-tag--warn">Waiting for confirmation</span>' +
                  '<span class="an-hint">Send the code <b>' + UI.esc(tg.code || "SUBSUB-4821") + "</b> to our bot. The code expires in 10 minutes.</span>" +
                  btn("I’ve sent the code", "primary", "data-lv-tgdone") +
                  btn("Cancel", "secondary", "data-lv-tgcancel")
                : btn("Connect Telegram", "primary", "data-lv-tgon", IC.telegram)) +
          "</div>" +
        "</div></section>" +



      '<section class="rp-card">' +
        '<div class="lv-card__h"><h2 class="lv-card__t">How a notification looks</h2></div>' +
        '<div class="lv-card__b lv-card__b--pad lv-form">' +
          ["“Forza Chill Ride” is live on Zems Racing.",
           "“Forza Chill Ride” dropped and was restarted automatically — down for 42 seconds.",
           "“Forza Chill Ride” is down and could not be restarted.",
           "Conversion finished for “Highlights Mix” — 3 files are ready to stream."].map(function (t2) {
            return '<div class="lv-nfex">' + (IC.notifications || IC.info || "") + "<span>" + UI.esc(t2) + "</span></div>";
          }).join("") +
          '<span class="an-hint">Every channel carries the same minimum: stream name, channel, event time in the account time zone and a link to the stream.</span>' +
        "</div></section>" +

      ["Analytics", "Collections", "Fan Funding", "Media Library"].map(function (prod) {
        return '<h2 class="lv-set__prod">' + prod + '</h2>' +
          '<section class="rp-card"><div class="lv-card__h">' +
            '<h2 class="lv-card__t">Notifications</h2>' +
            '<span class="ml-tag ml-tag--muted">Not in this iteration</span></div></section>';
      }).join("") +
      '<section class="rp-card" hidden>' +
        '<div class="lv-card__h"><h2 class="lv-card__t">YouTube connection</h2>' +
          '<span class="lv-card__acts">' + btn("Manage connection", "secondary", "data-lv-ytopen") + "</span></div>" +
        '<div class="lv-card__b">' + F.channels.map(function (c) {
          var state = !c.connected ? (c.liveEnabled ? "Not connected" : "Live not enabled")
            : c.revoked ? "Access revoked" : "Connected";
          var cls = state === "Connected" ? "ok" : state === "Access revoked" ? "bad" : "warn";
          return '<div class="an-tr lv-mx lv-mx--chan"><span class="lv-chan"><span class="an-chan__ava" style="background:' + c.color + '">' +
            c.initial + "</span>" + UI.esc(c.name) + "</span>" +
            '<span class="ml-tag ml-tag--' + cls + '">' + state + "</span>" +
            "<span>" + (state === "Connected" ? "" : btn(state === "Access revoked" ? "Reconnect YouTube" : "Connect YouTube", "secondary", "data-lv-ytopen")) + "</span></div>";
        }).join("") + "</div></section>";
  }

  // ============================================================ Э8 · подключение YouTube
  // Состояния берём из фикстур каналов; переключение для показа — subsubLiveYT().
  function ytState() {
    if (S.ytState) return S.ytState;
    return F.channels.some(function (c) { return c.connected; }) ? "connected" : "none";
  }
  function ytModal() {
    var st = ytState();
    var body;
    if (st === "none") {
      body = '<p class="an-modal__text">We’ll create the broadcast on your channel and handle the stream key for you. ' +
        "You stay in control of the title, description and visibility.</p>" +
        '<p class="an-modal__text">Nothing is published until you start the stream.</p>';
    } else if (st === "notEnabled") {
      body = '<p class="an-modal__text">This channel can’t go live yet. YouTube requires a verified phone number and no active restrictions. ' +
        "First-time activation can take up to 24 hours.</p>" +
        '<div class="lv-kv">' +
          ytCheck("Phone number verified", false) +
          ytCheck("No active restrictions", true) +
          ytCheck("24 hours passed since activation", false) +
        "</div>";
    } else if (st === "revoked") {
      body = '<p class="an-modal__text">We lost access to this channel. Reconnect to keep scheduled streams running.</p>' +
        '<p class="an-modal__text">Scheduled runs stay in the calendar and are marked as at risk until access is back.</p>';
    } else if (st === "quota") {
      body = '<p class="an-modal__text">YouTube API quota for today is used up. You can still go live with a manual stream key ' +
        "— paste it in the stream form.</p>";
    } else {
      body = '<div class="lv-kv">' + F.channels.filter(function (c) { return c.connected; }).map(function (c) {
        return kv(UI.esc(c.name), c.liveEnabled ? "Live enabled" : "Live not enabled");
      }).join("") + "</div>" +
        '<p class="an-modal__text">Title, description, visibility and the thumbnail are set in the stream form. ' +
        "The stream key is reusable, which is what makes Restart and Duplicate work without going to Studio.</p>";
    }
    var foot = st === "connected"
      ? btn("Add another account", "secondary", 'data-lv-do="ytadd"') + btn("Done", "primary", "data-lv-close data-lv-focus")
      : st === "notEnabled"
        ? btn("Open YouTube Studio", "secondary", 'data-lv-do="ytstudio"') + btn("Check again", "primary", 'data-lv-do="ytcheck" data-lv-focus')
        : st === "quota"
          ? btn("Enter stream key manually", "primary", 'data-lv-do="ytmanual" data-lv-focus') + btn("Cancel", "secondary", "data-lv-close")
          : btn("Cancel", "secondary", "data-lv-close data-lv-focus") +
            btn(st === "revoked" ? "Reconnect YouTube" : "Connect YouTube", "primary", 'data-lv-do="ytgo"');
    var title = st === "none" ? "Connect YouTube"
      : st === "notEnabled" ? "This channel can’t go live yet"
      : st === "revoked" ? "Reconnect YouTube"
      : st === "quota" ? "YouTube quota is used up" : "YouTube connection";
    var m = modalShell("lvYT", title, body, foot);
    var go = m.querySelector('[data-lv-do="ytgo"]');
    if (go) go.onclick = function () {
      S.ytState = "connected"; save(); UI.closeModals(); render();
      UI.toast("YouTube connected — the stream key is handled for you.");
    };
    var chk = m.querySelector('[data-lv-do="ytcheck"]');
    if (chk) chk.onclick = function () { UI.toast("Still not enabled — YouTube needs a verified phone number."); };
    var studio = m.querySelector('[data-lv-do="ytstudio"]');
    if (studio) studio.onclick = function () { UI.toast("YouTube Studio opens in a new tab."); };
    var man = m.querySelector('[data-lv-do="ytmanual"]');
    if (man) man.onclick = function () {
      UI.closeModals();
      if (PAGE === "form" && FORM) { FORM.destMode = "manual"; renderForm(); }
      else location.href = "live-stream-create.html";
    };
    var add = m.querySelector('[data-lv-do="ytadd"]');
    if (add) add.onclick = function () { UI.toast("Another Google account can be linked here."); };
  }
  // Подключение канала: настоящий флоу уходит на консент Google и возвращается
  // с выбранным каналом. Прототип имитирует возврат, чтобы флоу можно было пройти.
  function ytConnectAsk() {
    var free = F.channels.filter(function (c) { return !c.connected && !c.revoked; })[0];
    var m = modalShell("lvYTAdd", "Connect YouTube",
      '<p class="an-modal__text">Google asks for permission to create broadcasts on your channel. ' +
      "Nothing is published until you start the stream.</p>" +
      '<p class="an-modal__text">You come back here with the new channel selected.</p>',
      btn("Cancel", "secondary", "data-lv-close data-lv-focus") +
      btn("Continue with Google", "primary", 'data-lv-do="ytconnect"'));
    m.querySelector('[data-lv-do="ytconnect"]').onclick = function () {
      UI.closeModals();
      if (!free) { UI.toast("Every channel on this Google account is already connected."); return; }
      free.connected = true;
      S.connected = (S.connected || []).concat([free.id]); save();
      if (FORM) { FORM.destMode = "connected"; FORM.channelId = free.id; renderForm(); }
      else render();
      UI.toast("Channel connected — " + free.name + ".");
    };
  }
  function ytCheck(label, ok) {
    return '<div class="lv-kv__r"><span class="lv-kv__k">' + UI.esc(label) + "</span>" +
      '<span class="ml-tag ml-tag--' + (ok ? "ok" : "warn") + '">' + (ok ? "Done" : "Required") + "</span></div>";
  }
  window.subsubLiveYT = function (st) {
    var ok = ["none", "connected", "notEnabled", "revoked", "quota"];
    if (ok.indexOf(st) === -1) return "state must be one of: " + ok.join(", ");
    S.ytState = st; save(); render();
    return "youtube state → " + st;
  };

  // ============================================================ обработчики
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (UI.isOff(t.closest && t.closest(".is-off"))) return;

    var menuBtn = t.closest && t.closest("[data-lv-menu-for]");
    if (menuBtn) {
      var s0 = stream(menuBtn.getAttribute("data-lv-menu-for"));
      if (s0) menuFor(s0, menuBtn, !!document.querySelector("[data-lv-detail]"));
      return;
    }

    var row = t.closest && t.closest("[data-lv-row-id]");
    if (row && !t.closest("[data-lv-menu-for]")) {
      location.href = streamHref(stream(row.getAttribute("data-lv-row-id")) || { id: row.getAttribute("data-lv-row-id") });
      return;
    }

    if (t.closest && t.closest("[data-lv-cols]")) { colsPopover(t.closest("[data-lv-cols]")); return; }
    if (t.closest && t.closest("[data-lv-filters]")) { filtersPopover(t.closest("[data-lv-filters]")); return; }
    // ---- уведомления и YouTube
    if (t.closest && t.closest("[data-lv-ytopen]")) { ytModal(); return; }
    // «Connect YouTube» везде ведёт в консент Google; статусная модалка — только по data-lv-ytopen
    if (t.closest && t.closest("[data-lv-connectyt]")) { ytConnectAsk(); return; }
    if (t.closest && t.closest("[data-lv-tgon]")) {
      notif().telegram = { state: "pending", code: "SUBSUB-4821" }; save(); renderSettings();
      UI.toast("Send the code to our Telegram bot to finish."); return;
    }
    if (t.closest && t.closest("[data-lv-tgdone]")) {
      notif().telegram = { state: "connected", account: "@zems" }; save(); renderSettings();
      UI.toast("Telegram connected — a test message is on its way."); return;
    }
    if (t.closest && t.closest("[data-lv-tgcancel]")) {
      notif().telegram = { state: "off" }; save(); renderSettings(); return;
    }
    if (t.closest && t.closest("[data-lv-tgoff]")) {
      notif().telegram = { state: "off" }; save(); renderSettings();
      UI.toast("Telegram disconnected — events still go to the log and the in-app list."); return;
    }
    if (t.closest && t.closest("[data-lv-tgtest]")) { UI.toast("Test message sent to Telegram."); return; }

    // ---- календарь
    var csc = t.closest && t.closest("[data-lv-calscale]");
    if (csc) { CALV.scale = csc.getAttribute("data-lv-calscale"); renderCalendar(); return; }
    var cvw = t.closest && t.closest("[data-lv-calview]");
    if (cvw) { CALV.view = cvw.getAttribute("data-lv-calview"); S.calView = CALV.view; save(); renderCalendar(); return; }
    if (t.closest && t.closest("[data-lv-slotmsave]")) { slotModalSave(); return; }
    if (t.closest && t.closest("[data-lv-drawadd]")) { calDrawAdd(); return; }
    if (t.closest && t.closest("[data-lv-drawcancel]")) { calDrawDrop(); return; }
    var czm = t.closest && t.closest("[data-lv-calzoom]");
    if (czm) {
      CALV.hour = Math.max(22, Math.min(96, calHour() + (czm.getAttribute("data-lv-calzoom") === "+" ? 8 : -8)));
      S.calHour = CALV.hour; save(); renderCalendar(); return;
    }
    if (t.closest && t.closest("[data-lv-calprev]")) { calShift(-1); return; }
    if (t.closest && t.closest("[data-lv-calnext]")) { calShift(1); return; }
    if (t.closest && t.closest("[data-lv-drtrig]")) {
      var drp = document.querySelector("[data-lv-drpop]");
      cdrOpen(!drp || drp.hidden); return;
    }
    var dpr = t.closest && t.closest("[data-lv-drpreset]");
    if (dpr) { cdrUsePreset(dpr.getAttribute("data-lv-drpreset")); return; }
    var dday = t.closest && t.closest("[data-lv-drday]");
    if (dday) { cdrPick(dday.getAttribute("data-lv-drday")); return; }
    if (t.closest && t.closest("[data-lv-drprev]")) { cdrShift(-1); return; }
    if (t.closest && t.closest("[data-lv-drnext]")) { cdrShift(1); return; }
    if (t.closest && t.closest("[data-lv-drcancel]")) { cdrOpen(false); return; }
    if (t.closest && t.closest("[data-lv-drapply]")) { cdrApply(); return; }
    if (t.closest && t.closest("[data-lv-calfilters]")) { calFiltersPopover(t.closest("[data-lv-calfilters]")); return; }
    if (t.closest && t.closest("[data-lv-calclear]")) { CALV.statuses = []; closePop(); renderCalendar(); return; }
    var cun = t.closest && t.closest("[data-lv-calunchip]");
    if (cun) {
      var cp = cun.getAttribute("data-lv-calunchip").split(":");
      CALV[cp[0]] = CALV[cp[0]].filter(function (v) { return v !== cp[1]; });
      renderCalendar(); return;
    }
    var alertX = t.closest && t.closest("[data-lv-alertclose]");
    if (alertX) {
      var box = alertX.closest("[data-lv-calwarn]");
      CALV.alertOff = box ? box.getAttribute("data-lv-alertkey") : null;
      if (box) box.hidden = true;
      return;
    }
    var copen = t.closest && t.closest("[data-lv-calopen]");
    if (copen) { location.href = "live-stream.html?id=" + encodeURIComponent(copen.getAttribute("data-lv-calopen")); return; }
    var cedit = t.closest && t.closest("[data-lv-caledit]");
    if (cedit) { location.href = "live-stream-create.html?id=" + encodeURIComponent(cedit.getAttribute("data-lv-caledit")); return; }
    var cdel = t.closest && t.closest("[data-lv-calslotdel]");
    if (cdel) {
      var dp = cdel.getAttribute("data-lv-calslotdel").split("|");
      var ds = stream(dp[0]);
      ds.schedules = ds.schedules.filter(function (x) { return x.id !== dp[1]; });
      if (!ds.schedules.length && ds.virtual_status === "scheduled") ds.virtual_status = null;
      save(); closePop(); renderCalendar(); UI.toast("Slot deleted."); return;
    }
    var occEl = t.closest && t.closest("[data-lv-occ]");
    if (occEl) {
      var op = occEl.getAttribute("data-lv-occ").split("|");
      var os = stream(op[0]);
      var osl = (os.schedules || []).filter(function (x) { return x.id === op[1]; })[0];
      if (osl) {
        var occs = expand(os, osl, dayStartMs(op[2], calTz()), dayStartMs(op[2], calTz()) + DAYMS);
        var occ = occs.filter(function (x) { return x.occDate === op[2]; })[0] || occs[0];
        if (occ) calCard(occ, occEl);
      }
      return;
    }
    // в недельной сетке окно создаёт протяжка (mouseup), клик здесь не нужен
    if (t.closest && t.closest("[data-lv-calcells]")) return;
    var mcell = t.closest && t.closest("[data-lv-calday]");
    if (mcell && CALV.scale === "month" && !t.closest("[data-lv-occ]")) {
      calNewAt(mcell.getAttribute("data-lv-calday"), 0.5); return;
    }
    // ---- форма стрима
    var dm2 = t.closest && t.closest("[data-lv-destmode]");
    if (dm2) { FORM.destMode = dm2.getAttribute("data-lv-destmode"); renderForm(); return; }
    // «New playlist» уводит в редактор: черновик формы в памяти, поэтому сначала спрашиваем
    // плейлист создаётся на месте: уходить из формы и терять черновик стрима незачем
    if (t.closest && t.closest("[data-lv-formnewpl]")) {
      FORM.newPl = { id: null, name: "", items: [] }; FORM.playlistId = null; renderForm(); return;
    }
    if (t.closest && t.closest("[data-lv-formnewplcancel]")) { FORM.newPl = null; renderForm(); return; }
    var prep = t.closest && t.closest('[data-lv-act="prepare"]');
    if (prep && !document.querySelector("[data-lv-detail]")) {
      var plp = document.querySelector("[data-lv-pleditor]") ? plTarget() : formPl();
      if (plp) askPrepare(plp);
      return;
    }
    if (t.closest && t.closest("[data-lv-formplsave]")) {
      if (!FORM.newPl || !FORM.newPl.items.length) { UI.toast(T.needVideo); return; }
      var np2 = { id: "pl" + Date.now(), name: FORM.newPl.name.trim() || "Untitled playlist",
        items: clone(FORM.newPl.items), updated: new Date(nowMs()).toISOString() };
      S.playlists.unshift(np2);
      FORM.playlistId = np2.id; FORM.newPl = null;
      save(); renderForm();
      UI.toast("“" + np2.name + "” saved.");
      return;
    }
    var epl = t.closest && t.closest("[data-lv-editpl]");
    if (epl && FORM) {
      formStash(WZ.step);
      location.href = "live-playlist.html?id=" + encodeURIComponent(epl.getAttribute("data-lv-editpl")) +
        "&back=" + encodeURIComponent(location.pathname.split("/").pop() + location.search);
      return;
    }
    if (t.closest && t.closest("[data-lv-wzleave]")) {
      // formDiscardAsk никогда не существовала: клик по «Back to streams» падал ReferenceError
      formLeave(FORM && FORM.id ? "live-stream.html?id=" + encodeURIComponent(FORM.id) : "live-streams.html");
      return;
    }
    var lmd = t.closest && t.closest("[data-lv-loopmode]");
    if (lmd && FORM) {
      FORM.loop = lmd.getAttribute("data-lv-loopmode") === "loop";
      if (!FORM.loop) FORM.loopLimit = 0;      // в Play once лимит из потока уходит совсем
      renderForm();
      return;
    }
    // ---- очередь на шаге контента
    if (t.closest && t.closest("[data-lv-qadd]")) { pickOpen({ kind: "queue" }); return; }
    if (t.closest && t.closest("[data-lv-qupload]")) {
      var fi0 = document.querySelector("[data-lv-qfile]");
      if (fi0) fi0.click();
      return;
    }
    if (t.closest && t.closest("[data-lv-qsave]")) { formSaveAsPlaylistAsk(); return; }
    var resB = t.closest && t.closest("[data-lv-res]");
    if (resB && FORM) {
      FORM.res = Number(resB.getAttribute("data-lv-res"));
      FORM.resTouched = true;
      renderForm();
      return;
    }
    if (t.closest && t.closest("[data-lv-qclear]")) {
      // очередь чистится целиком, поэтому спрашиваем: отменить это нечем
      var n0 = formQueue().length;
      var mC = modalShell("lvQclear", "Clear the queue?",
        '<p class="an-modal__text">' + UI.plural(n0, "video", "videos") + " will be removed from this stream. " +
        "Files stay in the media library.</p>",
        btn("Keep the queue", "secondary", "data-lv-close data-lv-focus") + btn("Clear all", "danger", 'data-lv-do="qclear"'));
      mC.querySelector('[data-lv-do="qclear"]').onclick = function () {
        FORM.queue = []; FORM.srcPl = null; FORM.detached = false;
        UI.closeModals(); renderForm(); UI.toast("Queue cleared.");
      };
      return;
    }
    if (t.closest && t.closest("[data-lv-qreset]")) {
      var src0 = formSrcPl();
      if (src0) {
        FORM.queue = clone(src0.items); FORM.detached = false;
        renderForm(); UI.toast("Queue reset to “" + src0.name + "”.");
      }
      return;
    }
    var wzn = t.closest && t.closest("[data-lv-wznext]");
    if (wzn && FORM && !UI.isOff(wzn)) {
      FORM.showInvalid = false;
      WZ.step = Math.min(WZ_STEPS.length, WZ.step + 1); WZ.max = Math.max(WZ.max, WZ.step); renderForm();
      return;
    }
    var wzb = t.closest && t.closest("[data-lv-wzback]");
    if (wzb && FORM) { WZ.step = Math.max(1, WZ.step - 1); renderForm(); return; }
    var wzs = t.closest && t.closest("[data-lv-wzstep]");
    if (wzs && FORM) {
      var wn = Number(wzs.getAttribute("data-lv-wzstep"));
      // вперёд только через «дальше»: пройденные шаги открыты, будущие закрыты
      if (wn <= WZ.max && wn !== WZ.step) { WZ.step = wn; renderForm(); }
      return;
    }
    var cmd = t.closest && t.closest("[data-lv-contentmode]");
    if (cmd) {
      // данные другого таба живут в FORM и не сбрасываются: переключение ничего не теряет
      FORM.contentMode = cmd.getAttribute("data-lv-contentmode");
      renderForm(); return;
    }
    if (t.closest && t.closest("[data-lv-choosevideo]")) { pickOpen({ kind: "video" }); return; }
    var dtb = t.closest && t.closest("[data-lv-dt]");
    if (dtb) {
      var dp = dtb.getAttribute("data-lv-dt").split(":");
      dtPopover(dtb, dp[0], dp[1]); return;
    }
    var tpo = t.closest && t.closest("[data-lv-tpopen]");
    if (tpo) {
      var tpp = tpo.getAttribute("data-lv-tpopen").split(":");
      tpPopover(tpo, tpp[0], tpp[1]); return;
    }
    var tps = t.closest && t.closest("[data-lv-tpset]");
    if (tps) {
      var tpv = tps.getAttribute("data-lv-tpset").split(":");
      tpPick(tpv[0], Number(tpv[1])); return;
    }
    var dtn = t.closest && t.closest("[data-lv-dtnav]");
    if (dtn) {
      DTP.view = monthAdd(DTP.view, Number(dtn.getAttribute("data-lv-dtnav")));
      dtPopRender(document.querySelector('[data-lv-dt="' + DTP.slId + ":" + DTP.which + '"]')); return;
    }
    var dtd = t.closest && t.closest("[data-lv-dtday]");
    if (dtd) {
      var sl9 = FORM.schedules.filter(function (x) { return x.id === DTP.slId; })[0];
      if (sl9) {
        var old = Date.parse(sl9[DTP.which]);
        var mins = old - dayStartMs(partsIn(old, FORM.tz).date, FORM.tz);
        DTP.view = dtd.getAttribute("data-lv-dtday").slice(0, 7);
        dtSet(sl9, DTP.which, dayStartMs(dtd.getAttribute("data-lv-dtday"), FORM.tz) + mins);
      }
      closePop(); return;
    }
    var dtt = t.closest && t.closest("[data-lv-dttime]");
    if (dtt) {
      if (dtt.classList.contains("is-off")) return;
      var slT = FORM.schedules.filter(function (x) { return x.id === DTP.slId; })[0];
      if (slT) dtSet(slT, DTP.which, Number(dtt.getAttribute("data-lv-dttime")));
      closePop(); return;
    }
    if (t.closest && (t.closest("[data-lv-coverdrop]") || t.closest("[data-lv-coverdrop2]"))) {
      var fi = document.querySelector("[data-lv-coverfile]");
      if (fi) fi.click();
      return;
    }
    if (t.closest && t.closest("[data-lv-coverrm]")) { FORM.cover = null; FORM.coverErr = ""; renderForm(); UI.toast("Cover removed."); return; }
    if (t.closest && t.closest("[data-lv-ytthumb]")) { FORM.ytThumb = !FORM.ytThumb; renderForm(); return; }
    if (t.closest && t.closest("[data-lv-formpladd]")) { pickOpen({ kind: "formpl" }); return; }
    var fpmv = t.closest && t.closest("[data-lv-formplmv]");
    if (fpmv && !UI.isOff(fpmv)) {
      var mv = fpmv.getAttribute("data-lv-formplmv").split(":");
      var arr = FORM.newPl.items;
      var from = arr.findIndex(function (x) { return x.fileId === mv[0]; });
      var to = from + Number(mv[1]);
      if (from > -1 && to > -1 && to < arr.length) {
        var tmp = arr[from]; arr[from] = arr[to]; arr[to] = tmp;
        renderForm();
      }
      return;
    }
    var fprm = t.closest && t.closest("[data-lv-formplrm]");
    if (fprm) {
      var rid = fprm.getAttribute("data-lv-formplrm");
      FORM.newPl.items = FORM.newPl.items.filter(function (i) { return i.fileId !== rid; });
      renderForm(); return;
    }
    var sm = t.closest && t.closest("[data-lv-startmode]");
    if (sm) {
      FORM.startMode = sm.getAttribute("data-lv-startmode");
      if (FORM.startMode === "schedule" && !FORM.schedules.length) formAddSlot();
      renderForm(); return;
    }
    if (t.closest && t.closest("[data-lv-slotadd]")) { formAddSlot(); renderForm(); return; }
    var sd = t.closest && t.closest("[data-lv-slotdel]");
    if (sd) {
      FORM.schedules = FORM.schedules.filter(function (x) { return x.id !== sd.getAttribute("data-lv-slotdel"); });
      renderForm(); return;
    }

    if (t.closest && t.closest("[data-lv-formcancel]")) {
      formLeave(FORM && FORM.id ? "live-stream.html?id=" + encodeURIComponent(FORM.id) : "live-streams.html");
      return;
    }
    if (t.closest && t.closest("[data-lv-formsubmit]")) { formSubmit(); return; }
    // ---- пикер медиатеки
    var po = t.closest && t.closest("[data-lv-pickopen]");
    if (po) {
      var kind = po.getAttribute("data-lv-pickopen");
      pickOpen({ kind: "playlist", id: kind });
      return;
    }
    var ptk = t.closest && t.closest("[data-lv-picktake]");
    if (ptk) {
      PICK.sel = {};
      PICK.sel[ptk.getAttribute("data-lv-picktake")] = true;
      pickAdd(); return;
    }
    var pf = t.closest && t.closest("[data-lv-pickfile]");
    if (pf) {
      var k1 = pf.getAttribute("data-lv-pickfile");
      // одно видео: выбор ровно один, набор чекбоксов врал бы про возможность
      if (PICK.single) PICK.sel = {};
      PICK.sel[k1] = PICK.single ? true : !PICK.sel[k1];
      pickRender(); return;
    }
    var pfo = t.closest && t.closest("[data-lv-pickfold]");
    if (pfo) { var k2 = "fold:" + pfo.getAttribute("data-lv-pickfold"); PICK.sel[k2] = !PICK.sel[k2]; pickRender(); return; }
    var pe3 = t.closest && t.closest("[data-lv-pickenter]");
    if (pe3) { PICK.folder = pe3.getAttribute("data-lv-pickenter"); pickRender(); return; }
    if (t.closest && t.closest("[data-lv-pickup]")) { PICK.folder = null; pickRender(); return; }
    if (t.closest && t.closest("[data-lv-pickadd]")) { pickAdd(); return; }
    if (t.closest && t.closest("[data-lv-pickupload]")) {
      var pfi = document.querySelector("[data-lv-pickfileinput]");
      if (pfi) pfi.click();
      return;
    }
    // ---- плейлисты
    var plm = t.closest && t.closest("[data-lv-plmenu]");
    if (plm) {
      var pid0 = plm.getAttribute("data-lv-plmenu");
      if (document.querySelector("[data-lv-pleditor]")) { plEditorMenu(plTarget(), plm); return; }
      var p0 = playlist(pid0);
      if (p0) plMenu(p0, plm);
      return;
    }
    var plr = t.closest && t.closest("[data-lv-plrow]");
    if (plr && !t.closest("[data-lv-plmenu]") && !t.closest("[data-tip]")) {
      location.href = "live-playlist.html?id=" + encodeURIComponent(plr.getAttribute("data-lv-plrow"));
      return;
    }
    if (t.closest && t.closest("[data-lv-plnew]")) {
      // запись в списке появится только после первого сохранения
      location.href = "live-playlist.html";
      return;
    }
    if (t.closest && t.closest("[data-lv-plclear]")) {
      var pq = document.querySelector("[data-lv-plq]"); if (pq) pq.value = "";
      renderPlaylists(); return;
    }
    if (t.closest && t.closest("[data-lv-plback]")) { plLeave("live-playlists.html"); return; }
    if (t.closest && t.closest("[data-lv-plsave]")) {
      var pd = plTarget();
      // пустым может сохраниться только уже существующий: черновику нечего сохранять
      if (plIsDraft(pd) && !pd.items.length) { UI.toast(T.readyNone); return; }
      plSave(pd); renderPlEditor(); return;
    }
    var pls = t.closest && t.closest("[data-lv-plstart]");
    if (pls) {
      var pid = pls.getAttribute("data-lv-plstart");
      var ps = pid ? playlist(pid) : null;
      if (!ps && PAGE === "playlist") ps = plSave(plTarget(), true);   // из черновика сначала сохраняем
      if (ps) plStart(ps);
      return;
    }

    var plrn = t.closest && t.closest("[data-lv-plrename]");
    if (plrn) { var pr = playlist(plrn.getAttribute("data-lv-plrename")); if (pr) plRename(pr); return; }
    if (t.closest && t.closest("[data-lv-export]")) { UI.toast("Export is prepared in the background — we’ll notify you when the file is ready."); return; }
    var unchip = t.closest && t.closest("[data-lv-unchip]");
    if (unchip) {
      var parts = unchip.getAttribute("data-lv-unchip").split(":");
      S.filters[parts[0]] = S.filters[parts[0]].filter(function (v) { return v !== parts[1]; });
      save(); renderList(); return;
    }
    if (t.closest && t.closest("[data-lv-colsreset]")) { S.cols = null; save(); closePop(); renderList(); return; }
    var colRow = t.closest && t.closest("[data-lv-col]");
    if (colRow) {
      var ck = colRow.getAttribute("data-lv-col");
      var onNow = visCols().map(function (c) { return c.k; });
      var next = onNow.indexOf(ck) !== -1 ? onNow.filter(function (k) { return k !== ck; }) : onNow.concat([ck]);
      // порядок колонок всегда канонический, а не порядок включения
      S.cols = COLS.filter(function (c) { return c.lock || next.indexOf(c.k) !== -1; }).map(function (c) { return c.k; });
      save(); renderList();
      colsPopover(document.querySelector("[data-lv-cols]"));
      return;
    }
    if (t.closest && t.closest("[data-lv-clear]")) {
      var qq = document.querySelector("[data-lv-q]"); if (qq) qq.value = "";
      S.filters = { status: [], channels: [] };
      save(); closePop(); renderList(); return;
    }
    if (t.closest && t.closest("[data-lv-new]")) { location.href = "live-stream-create.html"; return; }
    if (t.closest && t.closest("[data-lv-topup]")) { UI.toast("Top-up page will open in the billing section."); return; }
    if (t.closest && t.closest("[data-lv-plbackform]")) { location.href = plBackTo() || "live-playlists.html"; return; }
    if (t.closest && t.closest("[data-an-back]")) { location.href = "live-streams.html"; return; }
    if (t.closest && t.closest("[data-lv-yt]")) { e.preventDefault(); UI.toast("The broadcast opens on YouTube."); return; }
    if (t.closest && t.closest("[data-lv-costmore]")) {
      var tg = t.closest("[data-lv-costmore]"), d = document.querySelector("[data-lv-costdetail]");
      var open = tg.getAttribute("aria-expanded") === "true";
      tg.setAttribute("aria-expanded", open ? "false" : "true");
      if (d) d.hidden = open;
      return;
    }
    // действия карточки
    var act = t.closest && t.closest("[data-lv-act]");
    if (act) {
      var id = new URLSearchParams(location.search).get("id");
      var s = stream(id) || S.streams[0];
      if (!s) return;
      var a = act.getAttribute("data-lv-act");
      if (a === "start") doStart(s);
      else if (a === "stop") askStop(s);
      else if (a === "again") askStartAgain(s);
      else if (a === "archive") askArchive(s);
      else if (a === "duplicate") askDuplicate(s);
      else if (a === "addslot") slotModal(s.id, null);
      else if (a === "calendar") openCalendar(s, (s.schedules || [])[0]);
      else if (a === "edit") location.href = "live-stream-create.html?id=" + encodeURIComponent(s.id);
      else if (a === "addvideo") {
        if (PAGE === "playlist") { var pt = plTarget(); pickOpen({ kind: "playlist", id: pt.id || "__draft" }); }
        else if (s && s.playlistId) pickOpen({ kind: "playlist", id: s.playlistId });
        else UI.toast(T.needVideo);
      }
      else if (a === "prepare") askPrepare(content(s) || {});
      else if (a === "showbad") {
        var bad = readiness(content(s)).files || [];
        [].slice.call(document.querySelectorAll("[data-lv-row]")).forEach(function (r) {
          r.classList.toggle("is-missing", bad.indexOf(r.getAttribute("data-lv-row")) !== -1);
        });
        UI.toast(bad.length === 1 ? "1 file doesn’t match the others." : bad.length + " files don’t match the others.");
      } else if (a === "apply") {
        var pl = content(s);
        if (draft && pl) { pl.items = draft.items; draft = null; save(); renderDetail();
          UI.toast("Playlist updated — changes apply immediately."); }
      } else if (a === "discard") { draft = null; renderDetail(); UI.toast("Changes discarded."); }
      return;
    }
    // меню файла в очереди: клавиатурная альтернатива перетаскиванию
    var fmForm = t.closest && t.closest("[data-lv-fmenu]");
    if (fmForm && PAGE === "form" && FORM) { formRowMenu(fmForm.getAttribute("data-lv-fmenu"), fmForm); return; }
    var fm = t.closest && t.closest("[data-lv-fmenu]");
    if (fm && fm.closest("[data-lv-plqueue]")) {
      var pe2 = plById(fm.closest("[data-lv-plqueue]").getAttribute("data-lv-plqueue"));
      if (pe2) plFileMenu(pe2, fm.getAttribute("data-lv-fmenu"), fm);
      return;
    }
    if (fm) {
      var sid = new URLSearchParams(location.search).get("id");
      var st2 = stream(sid) || S.streams[0];
      var fid = fm.getAttribute("data-lv-fmenu");
      var pl2 = playlist(st2.playlistId);
      var isOnAir = st2.status === "live" && st2.onAir && st2.onAir.fileId === fid;
      UI.menu(fm, [
        { label: "Move up", icon: IC.arrowUp, off: isOnAir, reason: isOnAir ? T.onAir : "", onClick: function () { moveFile(st2, fid, -1); } },
        { label: "Move down", icon: IC.arrowDown, off: isOnAir, reason: isOnAir ? T.onAir : "", onClick: function () { moveFile(st2, fid, 1); } },
        { sep: true },
        { label: "Remove from playlist", icon: IC.trash, danger: true, off: isOnAir, reason: isOnAir ? T.onAir : "",
          onClick: function () { removeFile(st2, fid); } }
      ]);
      return;
    }
    var slm = t.closest && t.closest("[data-lv-slotmenu]");
    if (slm) {
      var s3 = stream(new URLSearchParams(location.search).get("id"));
      var slid = slm.getAttribute("data-lv-slotmenu");
      var slObj = (s3.schedules || []).filter(function (x) { return x.id === slid; })[0];
      // одиночное окно, которое уже прошло, — история: его не правят и не удаляют
      var pastSlot = !!(slObj && (!slObj.repeat || slObj.repeat.type === "none") && Date.parse(slObj.end) <= nowMs());
      var slotWhy = why("edit", s3) || (pastSlot ? T.pastRun : "");
      UI.menu(slm, [
        { label: "Edit slot", icon: IC.edit, off: !!slotWhy, reason: slotWhy,
          onClick: function () { slotModal(s3.id, slid); } },
        { label: "Open in calendar", icon: IC.calendar, onClick: function () {
          openCalendar(s3, (s3.schedules || []).filter(function (x) { return x.id === slid; })[0]);
        } },
        { label: "Delete slot", icon: IC.trash, danger: true, off: !!slotWhy, reason: slotWhy, onClick: function () {
          s3.schedules = s3.schedules.filter(function (x) { return x.id !== slid; });
          if (!s3.schedules.length && s3.virtual_status === "scheduled") s3.virtual_status = null;
          save(); render(); UI.toast("Slot deleted.");
        } }
      ]);
      return;
    }
    if (!(t.closest && t.closest("[data-lv-pop]"))) closePop();
  });

  // меню файла в редакторе плейлиста: тот же состав, но без «в эфире»
  // меню строки очереди в форме: порядок, замена, выключение, удаление, повтор загрузки
  function formRowMenu(fid, anchor) {
    var idx = formQueue().findIndex(function (i) { return i.fileId === fid; });
    if (idx === -1) return;
    var it = formQueue()[idx];
    var f = file(fid);
    var stt = fileState(f, profileOf(formQueuePl()));
    var single = formQueue().length < 2;
    var items = [];
    if (!FORM.shuffle && !single) {
      items.push({ label: "Move up", icon: IC.arrowUp, off: idx === 0,
        onClick: function () { formQueueMove(idx, -1); } });
      items.push({ label: "Move down", icon: IC.arrowDown, off: idx === formQueue().length - 1,
        onClick: function () { formQueueMove(idx, 1); } });
      items.push({ sep: true });
    }
    if (stt === "broken") {
      items.push({ label: "Retry upload", icon: IC.restart, onClick: function () {
        f.state = "uploading"; f.progress = 0; renderForm(); UI.toast("Upload restarted.");
      } });
    }
    if (stt === "cant" || stt === "missing") {
      items.push({ label: "Replace file", icon: IC.copy, onClick: function () {
        pickOpen({ kind: "qreplace", fileId: fid });
      } });
    }
    items.push({ label: it.off ? "Turn on" : "Turn off", icon: it.off ? IC.play : IC.pause,
      onClick: function () { it.off = !it.off; formDetach(); renderForm(); } });
    items.push({ label: "Remove from queue", icon: IC.trash, danger: true, onClick: function () {
      if (stt === "converting") UI.toast("Conversion canceled for this file.");
      FORM.queue.splice(idx, 1); formDetach(); renderForm();
    } });
    UI.menu(anchor, items);
  }
  function formQueueMove(idx, dir) {
    var to = idx + dir;
    if (to < 0 || to >= formQueue().length) return;
    var tmp = FORM.queue[idx]; FORM.queue[idx] = FORM.queue[to]; FORM.queue[to] = tmp;
    formDetach(); renderForm();
  }
  function plFileMenu(p, fid, anchor) {
    var f = file(fid), st = fileState(f, profileOf(p));
    var items = [
      { label: "Move up", icon: IC.arrowUp, onClick: function () { plMoveFile(p, fid, -1); } },
      { label: "Move down", icon: IC.arrowDown, onClick: function () { plMoveFile(p, fid, 1); } },
      { sep: true }
    ];
    // у нелечимого и отсутствующего — три выхода и ничего больше (Э10 §7)
    if (st === "cant" || st === "broken" || st === "missing") {
      items = [
        { label: "Replace file", icon: IC.restart, onClick: function () { pickOpen({ kind: "replace", plId: p.id || "draft", fileId: fid }); } },
        { label: "Remove from playlist", icon: IC.trash, danger: true, onClick: function () {
          p.items = p.items.filter(function (x) { return x.fileId !== fid; });
          renderPlEditor();
        } },
        { label: "Turn off", icon: IC.eye, onClick: function () {
          var it = p.items.filter(function (x) { return x.fileId === fid; })[0];
          if (it) { it.off = true; renderPlEditor(); }
        } }
      ];
      UI.menu(anchor, items);
      return;
    }
    items.push({ label: "Remove from playlist", icon: IC.trash, danger: true, onClick: function () {
      p.items = p.items.filter(function (x) { return x.fileId !== fid; });
      renderPlEditor();
    } });
    UI.menu(anchor, items);
  }
  function plMoveFile(p, fid, dir) {
    var i = p.items.findIndex(function (x) { return x.fileId === fid; });
    var j = i + dir;
    if (i < 0 || j < 0 || j >= p.items.length) return;
    if (plIsDraft(p)) {
      var tmp0 = p.items[i]; p.items[i] = p.items[j]; p.items[j] = tmp0;
      renderPlEditor(); return;
    }
    plApplyAsk(p, function () {
      var tmp = p.items[i]; p.items[i] = p.items[j]; p.items[j] = tmp;
      p.updated = new Date(nowMs()).toISOString(); save(); render();
    });
  }
  // ── выбор периода: пресеты, две месячные сетки, поля «от — до». Сетка календаря знает
  // три масштаба, поэтому выбранный диапазон приводим к ближайшему: сутки, неделя, месяц.
  var CDR = { from: null, to: null, view: null };          // даты «YYYY-MM-DD», view — левый месяц
  var CDR_WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  function dsToday() { return partsIn(nowMs(), calTz()).date; }
  function dsHuman(ds) { return ds.slice(8, 10) + "." + ds.slice(5, 7) + "." + ds.slice(0, 4); }
  function dsFromHuman(v) {
    var m = String(v).trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    return m ? m[3] + "-" + m[2] + "-" + m[1] : null;
  }
  function monthAdd(ym, n) {
    var y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)) - 1 + n;
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    return y + "-" + ("0" + (m + 1)).slice(-2);
  }
  function monthLast(ym) {
    return new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).toISOString().slice(0, 10);
  }
  function monthName(ym) {
    return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long", year: "numeric" })
      .format(new Date(Date.parse(ym + "-01T12:00:00Z")));
  }
  function dsSpan(from, to) {
    return Math.round((Date.parse(to + "T12:00:00Z") - Date.parse(from + "T12:00:00Z")) / DAYMS) + 1;
  }
  // пресеты считаются от «сегодня» аккаунта и сразу знают, каким масштабом показать период
  function cdrPresets() {
    var t = dsToday(), tw = weekStart(t), m = t.slice(0, 7), nm = monthAdd(m, 1);
    return [
      { id: "today", label: "Today", from: t, to: t, scale: "day", anchor: t },
      { id: "yesterday", label: "Yesterday", from: addDaysStr(t, -1), to: addDaysStr(t, -1), scale: "day", anchor: addDaysStr(t, -1) },
      { id: "tomorrow", label: "Tomorrow", from: addDaysStr(t, 1), to: addDaysStr(t, 1), scale: "day", anchor: addDaysStr(t, 1) },
      { id: "thisweek", label: "This week", from: tw, to: addDaysStr(tw, 6), scale: "week", anchor: tw },
      { id: "lastweek", label: "Last week", from: addDaysStr(tw, -7), to: addDaysStr(tw, -1), scale: "week", anchor: addDaysStr(tw, -7) },
      { id: "nextweek", label: "Next week", from: addDaysStr(tw, 7), to: addDaysStr(tw, 13), scale: "week", anchor: addDaysStr(tw, 7) },
      { id: "thismonth", label: "This month", from: m + "-01", to: monthLast(m), scale: "month", anchor: m + "-01" },
      { id: "nextmonth", label: "Next month", from: nm + "-01", to: monthLast(nm), scale: "month", anchor: nm + "-01" }
    ];
  }
  // что показано сейчас: в месяце подсвечиваем сам месяц, а не 42 дня его сетки
  function cdrCurrent() {
    var r = calRange();
    if (CALV.scale === "month") {
      var m = (r.month || calAnchor().slice(0, 7));
      return { from: m + "-01", to: monthLast(m) };
    }
    return { from: r.from, to: r.to };
  }
  function cdrOpen(open) {
    var wrap = document.querySelector("[data-lv-dr]");
    if (!wrap) return;
    if (open) {
      var c = cdrCurrent();
      CDR.from = c.from; CDR.to = c.to; CDR.view = c.from.slice(0, 7);
      cdrRender();
    }
    wrap.querySelector("[data-lv-drpop]").hidden = !open;
    wrap.classList.toggle("is-open", !!open);
    wrap.querySelector("[data-lv-drtrig]").setAttribute("aria-expanded", open ? "true" : "false");
  }
  function cdrRender() {
    var wrap = document.querySelector("[data-lv-dr]");
    if (!wrap || !CDR.view) return;
    wrap.querySelector("[data-lv-drpresets]").innerHTML = cdrPresets().map(function (p) {
      var on = p.from === CDR.from && p.to === CDR.to;
      return '<button class="an-dr__preset' + (on ? " is-on" : "") + '" type="button" data-lv-drpreset="' +
        p.id + '"' + (on ? ' aria-current="true"' : "") + ">" + p.label + "</button>";
    }).join("");
    var today = dsToday();
    [0, 1].forEach(function (i) {
      var ym = monthAdd(CDR.view, i);
      wrap.querySelector('[data-lv-drmon="' + i + '"]').textContent = monthName(ym);
      var html = CDR_WD.map(function (w) { return '<span class="an-dr__wd">' + w + "</span>"; }).join("");
      var first = ym + "-01", start = weekStart(first);             // сетка всегда с понедельника
      for (var c = 0; c < 42; c++) {
        var ds = addDaysStr(start, c);
        var out = ds.slice(0, 7) !== ym;
        var isStart = ds === CDR.from, isEnd = ds === CDR.to;
        var band = CDR.from && CDR.to && CDR.from !== CDR.to;
        html += '<button class="an-dr__day' + (out ? " an-dr__day--out" : "") +
          (CDR.from && CDR.to && ds > CDR.from && ds < CDR.to ? " an-dr__day--in" : "") +
          (isStart || isEnd ? " an-dr__day--edge" : "") +
          (band && isStart ? " an-dr__day--start" : "") + (band && isEnd ? " an-dr__day--end" : "") +
          (ds === today ? " an-dr__day--today" : "") +
          '" type="button" data-lv-drday="' + ds + '"><span class="an-dr__d">' +
          Number(ds.slice(8, 10)) + "</span></button>";
      }
      wrap.querySelector('[data-lv-drgrid="' + i + '"]').innerHTML = html;
    });
    wrap.querySelector("[data-lv-drfrom]").value = CDR.from ? dsHuman(CDR.from) : "";
    wrap.querySelector("[data-lv-drto]").value = CDR.to ? dsHuman(CDR.to) : "";
    cdrNote();
  }
  function cdrPick(ds) {
    // первый клик после готового диапазона начинает новый выбор
    if (!CDR.from || (CDR.from && CDR.to)) { CDR.from = ds; CDR.to = null; }
    else if (ds < CDR.from) { CDR.to = CDR.from; CDR.from = ds; }
    else CDR.to = ds;
    cdrRender();
  }
  // что именно окажется на сетке при выбранном диапазоне
  function cdrShown(x) {
    if (x.scale === "day") return { from: x.anchor, to: x.anchor };
    if (x.scale === "week") return { from: weekStart(x.anchor), to: addDaysStr(weekStart(x.anchor), 6) };
    var m = x.anchor.slice(0, 7);
    return { from: m + "-01", to: monthLast(m) };
  }
  function cdrNote() {
    var note = document.querySelector("[data-lv-drnote]");
    if (!note) return;
    if (!CDR.from) { note.hidden = true; return; }
    var x = cdrScaleFor(CDR.from, CDR.to || CDR.from), sh = cdrShown(x);
    var exact = sh.from === CDR.from && sh.to === (CDR.to || CDR.from);
    note.hidden = exact;
    // без года: обе даты рядом и читаются короче
    note.textContent = exact ? "" : "Shown as " + SCALE_LBL[x.scale] + " · " +
      dsHuman(sh.from).slice(0, 5) + " – " + dsHuman(sh.to).slice(0, 5);
  }
  function cdrShift(n) { CDR.view = monthAdd(CDR.view, n); cdrRender(); }
  function cdrUsePreset(id) {
    var p = cdrPresets().filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    CALV.scale = p.scale; CALV.anchor = p.anchor;
    cdrOpen(false); renderCalendar();
  }
  // диапазон приводим к масштабу сетки: сутки, неделя (пн—вс) или месяц
  function cdrScaleFor(from, to) {
    if (from === to) return { scale: "day", anchor: from };
    if (weekStart(from) === from && addDaysStr(from, 6) === to) return { scale: "week", anchor: from };
    var m = from.slice(0, 7);
    if (from === m + "-01" && to === monthLast(m)) return { scale: "month", anchor: from };
    return dsSpan(from, to) <= 7 ? { scale: "week", anchor: from } : { scale: "month", anchor: from };
  }
  function cdrApply() {
    var wrap = document.querySelector("[data-lv-dr]");
    if (!wrap) return;
    var f = dsFromHuman(wrap.querySelector("[data-lv-drfrom]").value) || CDR.from;
    var t = dsFromHuman(wrap.querySelector("[data-lv-drto]").value) || CDR.to || f;
    if (!f) return;
    if (t < f) { var sw = f; f = t; t = sw; }
    var x = cdrScaleFor(f, t);
    CALV.scale = x.scale; CALV.anchor = x.anchor;
    cdrOpen(false); renderCalendar();
  }
  var CAL_RSZ = null;
  window.addEventListener("resize", function () {
    if (PAGE !== "calendar" || CALV.hour || S.calHour) return;   // ручной масштаб не трогаем
    clearTimeout(CAL_RSZ);
    CAL_RSZ = setTimeout(renderCalendar, 120);
  });
  function calShift(dir) {
    var a = calAnchor();
    CALV.anchor = CALV.scale === "day" ? addDaysStr(a, dir)
      : CALV.scale === "week" ? addDaysStr(a, 7 * dir)
      : (function () {
          var y = Number(a.slice(0, 4)), m = Number(a.slice(5, 7)) - 1 + dir;
          var d = new Date(Date.UTC(y, m, 1));
          return d.toISOString().slice(0, 10);
        })();
    renderCalendar();
  }
  // Новое окно встаёт на следующий день после последнего: копия того же времени
  // на том же канале — это заведомый конфликт, а не заготовка.
  function nextSlotStart(list, tz) {
    var base = nowMs() + 24 * 3600e3;
    (list || []).forEach(function (sl) {
      var next = Date.parse(sl.start) + 24 * 3600e3;
      if (next > base) base = next;
    });
    return base;
  }
  function formAddSlot() {
    var start = nextSlotStart(FORM.schedules, FORM.tz);
    var len = (formPassSec() || 2 * 3600) * 1000;
    FORM.schedules.push({ id: "sl" + Date.now(), start: new Date(start).toISOString(),
      end: new Date(start + len).toISOString(), tz: FORM.tz, repeat: { type: "none" } });
  }
  function formSlotEdit(el, swOn) {
    var parts = el.getAttribute("data-lv-slot").split(":");
    var sl = FORM.schedules.filter(function (x) { return x.id === parts[0]; })[0];
    if (!sl) return;
    var k = parts[1];
    if (k === "start" || k === "end") {
      if (k === "end") sl.endSet = true;
      sl[k] = localIso(el.value) || sl[k]; formLight(); return;
    }
    if (k === "repeat") { sl.repeat = { type: el.value }; renderForm(); return; }
    if (k === "b2b") { sl.backToBack = swOn ? { on: true, pauseMin: 5, maxCycles: 3 } : { on: false }; renderForm(); return; }
    if (k === "pause") { sl.backToBack.pauseMin = Math.max(0, Number(el.value) || 0); return; }
    if (k === "cycles") { sl.backToBack.maxCycles = Math.max(1, Number(el.value) || 1); return; }
  }
  // ── контрол даты и времени проекта (Э3): дата — попап-календарь, время — селектор
  // с шагом 30 минут; занятые каналом времена серые ещё до того, как на них наступили
  // дата и время правятся раздельно: календарь в попапе, время — поле ввода HH:MM
  // в поле даты день недели не нужен: он виден в календаре, а место в строке слота
  // отдано зоне и правилу повтора
  // «22 Aug 2026»: день недели виден в календаре, а год в поле нужен — окна ставят
  // и на следующий год, и это должно читаться без открытия попапа
  function dayShort(iso, tz) {
    if (!iso) return "—";
    try {
      return new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "2-digit", month: "short", year: "numeric" })
        .format(new Date(iso));
    } catch (e) { return UI.day(iso, tz); }
  }
  function dtField(sl, which, pseudo) {
    var iso = sl[which];
    // ADR-0002: производный конец видно, но он не редактируется — причина в тултипе
    var why = which === "end" ? formEndWhy() : "";
    var off = why ? ' aria-disabled="true" data-tip="' + UI.esc(why) + '"' : "";
    return '<div class="lv-dtwrap">' +
      '<button class="an-input lv-dt' + (why ? " is-off" : "") + '" type="button"' +
        (why ? off : ' data-lv-dt="' + sl.id + ":" + which + '"') + ">" +
        (IC.calendar || "") + "<span>" + dayShort(iso, FORM.tz) + "</span></button>" +
      '<button class="an-input lv-dttime' + (why ? " is-off" : "") + '" type="button"' +
        (why ? off : ' data-lv-tpopen="' + sl.id + ":" + which + '"') +
        ' aria-label="' + (which === "start" ? "Start time" : "End time") + '">' +
        UI.time(iso, FORM.tz) + "</button>" +
      "</div>";
  }
  // Без лупа очередь проходит один раз, поэтому конец окна известен: считаем его сами
  // и не даём править. С лупом длина окна — решение человека, обрезать можно как угодно.
  // Число проходов известно — при Play once их один, при лимите кругов их ровно столько.
  // Тогда конец окна не решение человека, а следствие: считаем и не даём править.
  // Бесконечный луп длину окна не задаёт: обрезать его можно как угодно.
  function formEndRuns() {
    if (!FORM.loop) return 1;
    return FORM.loopLimit > 0 ? FORM.loopLimit : 0;
  }
  function formEndSec() {
    var runs = formEndRuns();
    if (!runs) return 0;
    var sec = (plStats(formQueuePl()).sec || 0) * runs;
    // время показывается с точностью до минуты, поэтому округляем вверх: окно не должно
    // оказаться короче содержимого из-за отброшенных секунд
    return sec ? Math.ceil(sec / 60) * 60 : 0;
  }
  function formEndWhy() {
    if (!formEndSec()) return "";
    return FORM.loop
      ? "Loop limit " + FORM.loopLimit + " — the window ends after " +
        UI.plural(FORM.loopLimit, "run", "runs") + "."
      : "Play once — the window ends when the queue ends.";
  }
  // как вернуть себе управление окном — зависит от того, что его сейчас задаёт
  function formEndFree() {
    return FORM.loop ? "Turn the loop limit off to choose your own window."
      : "Switch playback to Loop to choose your own window.";
  }
  // один проход очереди, округлённый до минуты вверх
  function formPassSec() {
    var sec = plStats(formQueuePl()).sec || 0;
    return sec ? Math.ceil(sec / 60) * 60 : 0;
  }
  // Окна приводятся к длине: при известном числе проходов — всегда, при бесконечном лупе —
  // пока человек не выбрал конец сам. Иначе окно жило бы с придуманными двумя часами.
  function formSyncEnds() {
    var fixed = formEndSec(), pass = formPassSec();
    FORM.schedules.forEach(function (sl) {
      var broken = Date.parse(sl.end) <= Date.parse(sl.start);
      // сломанное окно лечим даже поверх своего выбора: конец раньше начала не бывает
      var len = fixed || (sl.endSet && !broken ? 0 : pass);
      if (len) sl.end = new Date(Date.parse(sl.start) + len * 1000).toISOString();
    });
  }
  // Запрещённые интервалы для выбираемого конца окна. Одна причина на смысл, порядок —
  // от жёстких к мягким: что нельзя физически, потом занятость канала, потом длина очереди.
  // lo — нижние границы самого момента, iv — занятые интервалы канала, которые окно
  // не должно накрывать. Порядок причин: физически нельзя, потом канал, потом длина очереди.
  function tpBlocks(sl, which) {
    var lo = [{ min: nowMs(), why: "That time has already passed." }], iv = [];
    var eta = convEta(formQueuePl());
    if (eta) {
      lo.push({ min: Date.parse(eta.readyAt),
        why: "Conversion runs until " + UI.time(eta.readyAt, FORM.tz) + "." });
    }
    if (which === "end") {
      // луп включён — окно короче очереди допустимо: последний файл просто обрежется
      lo.push({ min: Date.parse(sl.start) + 60e3, why: "The window must end after it starts." });
    }
    // другие окна этого же стрима: колесо не даёт залезть в них. В модалке окна
    // остальные окна лежат на самом стриме, а не в FORM
    var own = FORM.modal && SLOT_M ? ((stream(SLOT_M.streamId) || {}).schedules || []) : FORM.schedules;
    (own || []).forEach(function (o) {
      if (o.id === sl.id) return;
      iv.push({ from: Date.parse(o.start), to: Date.parse(o.end),
        why: "Another window of this stream runs " + UI.time(o.start, FORM.tz) + "–" + UI.time(o.end, FORM.tz) + "." });
    });
    // стримы на том же ключе: их окна тоже закрыты — один ключ несёт один поток
    var myKey = FORM.destMode === "manual" ? String(FORM.key || "").trim() : "";
    if (myKey) {
      S.streams.forEach(function (o) {
        if (o.id === FORM.id || o.status === "draft" || !o.dest || o.dest.mode !== "manual" || String(o.dest.key || "").trim() !== myKey) return;
        (o.schedules || []).forEach(function (osl) {
          iv.push({ from: Date.parse(osl.start), to: Date.parse(osl.end), why: T_KEY_BUSY(o.name) });
        });
        if (running(o.status) && !(o.schedules || []).length) iv.push({ from: -Infinity, to: nowMs() + DAYMS, why: T_KEY_BUSY(o.name) });
      });
    }
    return { lo: lo, iv: iv };
  }
  // причина, по которой момент недоступен, либо пустая строка
  function tpWhy(blocks, ms, sl, which) {
    var i;
    for (i = 0; i < blocks.lo.length; i++) {
      if (ms < blocks.lo[i].min) return blocks.lo[i].why;
    }
    var a = which === "end" ? Date.parse(sl.start) : ms;
    var b = which === "end" ? ms : ms + (Date.parse(sl.end) - Date.parse(sl.start));
    for (i = 0; i < blocks.iv.length; i++) {
      if (a < blocks.iv[i].to && blocks.iv[i].from < b) return blocks.iv[i].why;
    }
    return "";
  }
  function dtSet(sl, which, ms) {
    var dur = Date.parse(sl.end) - Date.parse(sl.start);
    if (which === "start") {
      sl.start = new Date(ms).toISOString();
      sl.end = new Date(ms + dur).toISOString();      // окно едет целиком, длительность сохраняется
    } else {
      if (ms <= Date.parse(sl.start)) { UI.toast("The window must end after it starts."); return; }
      sl.end = new Date(ms).toISOString();
    }
    renderForm();
  }
  // варианты времени: каждые 30 минут; занятое каналом время заблокировано с причиной
  function dtTimeOpts(sl, which, pseudo) {
    var dayIso = sl[which];
    var d0 = dayStartMs(partsIn(Date.parse(dayIso), FORM.tz).date, FORM.tz);
    var out = [];
    for (var m = 0; m < 1440; m += 30) {
      var ms = d0 + m * 60e3;
      var cand = which === "start"
        ? { id: sl.id, start: new Date(ms).toISOString(),
            end: new Date(ms + (Date.parse(sl.end) - Date.parse(sl.start))).toISOString() }
        : { id: sl.id, start: sl.start, end: new Date(ms).toISOString() };
      var bad = which === "end" && ms <= Date.parse(sl.start) ? { msg: "Before the start." } : channelBusy(pseudo, cand);
      out.push({ value: String(ms), label: UI.time(new Date(ms).toISOString(), FORM.tz),
        off: !!bad, reason: bad ? bad.msg : "" });
    }
    return out;
  }
  var TPP = { slId: null, which: "start" };
  var DTP = null;   // открытый попап даты: { slId, which, view "YYYY-MM" }
  function dtPopover(anchor, slId, which) {
    var sl = FORM.schedules.filter(function (x) { return x.id === slId; })[0];
    if (!sl) return;
    DTP = { slId: slId, which: which, view: partsIn(Date.parse(sl[which]), FORM.tz).date.slice(0, 7) };
    dtPopRender(anchor);
  }
  function dtPopRender(anchor) {
    var sl = FORM.schedules.filter(function (x) { return x.id === DTP.slId; })[0];
    var cur = partsIn(Date.parse(sl[DTP.which]), FORM.tz).date;
    var today = partsIn(nowMs(), FORM.tz).date;
    var cal = '<div class="an-dr__nav" style="grid-template-columns:32px 1fr 32px">' +
      '<button class="an-dr__arrow" type="button" data-lv-dtnav="-1">' + (IC.chevLeft || "‹") + "</button>" +
      '<span class="an-dr__mon">' + monthName(DTP.view) + "</span>" +
      '<button class="an-dr__arrow" type="button" data-lv-dtnav="1">' + (IC.chevRight || "›") + "</button></div>" +
      '<div class="an-dr__grid" style="padding:0 8px 8px">' +
      CDR_WD.map(function (w) { return '<span class="an-dr__wd">' + w + "</span>"; }).join("");
    var start = weekStart(DTP.view + "-01");
    for (var c = 0; c < 42; c++) {
      var ds = addDaysStr(start, c);
      cal += '<button class="an-dr__day' + (ds.slice(0, 7) !== DTP.view ? " an-dr__day--out" : "") +
        (ds === cur ? " an-dr__day--edge" : "") + (ds === today ? " an-dr__day--today" : "") +
        '" type="button" data-lv-dtday="' + ds + '"><span class="an-dr__d">' + Number(ds.slice(8, 10)) + "</span></button>";
    }
    cal += "</div>";
    var pop = popEl();
    pop.innerHTML = '<div class="lv-dtp"><div class="lv-dtp__cal">' + cal + "</div></div>";
    placePop(pop, anchor);
  }

  function tpPopover(anchor, slId, which) {
    TPP = { slId: slId, which: which };
    tpPopRender(anchor);
  }
  function tpPopRender(anchor) {
    var sl = FORM.schedules.filter(function (x) { return x.id === TPP.slId; })[0];
    if (!sl) return;
    var iso = sl[TPP.which], cur = partsIn(Date.parse(iso), FORM.tz);
    var day0 = dayStartMs(cur.date, FORM.tz);
    var blocks = tpBlocks(sl, TPP.which);
    function why(h, m) { return tpWhy(blocks, day0 + (h * 60 + m) * 60e3, sl, TPP.which); }
    function col(kind, list, selected, label) {
      return '<div class="lv-tp__col" role="listbox" aria-label="' + label + '">' +
        list.map(function (v) {
          var reason = kind === "h" ? hourWhy(v) : why(cur.h, v);
          return '<button class="lv-tp__o' + (v === selected ? " is-sel" : "") + (reason ? " is-off" : "") +
            '" type="button" role="option" aria-selected="' + (v === selected ? "true" : "false") + '"' +
            (reason ? ' aria-disabled="true" data-tip="' + UI.esc(reason) + '"' : ' data-lv-tpset="' + kind + ":" + v + '"') +
            ">" + (v < 10 ? "0" + v : v) + "</button>";
        }).join("") + "</div>";
    }
    // час закрыт целиком, только если в нём не осталось ни одной свободной минуты
    function hourWhy(h) {
      var first = "";
      for (var m = 0; m < 60; m++) {
        var r = why(h, m);
        if (!r) return "";
        if (!first) first = r;
      }
      return first;
    }
    var hs = [], ms = [];
    for (var h = 0; h < 24; h++) hs.push(h);
    for (var m = 0; m < 60; m++) ms.push(m);
    // Причину пишем только про то, что человек выбрал сейчас: раньше строка показывала
    // причину самого жёсткого запрета и при верном выборе читалась как ошибка.
    var note = why(cur.h, cur.m);
    var pop = popEl();
    pop.classList.add("lv-pop--tp");
    pop.innerHTML = '<div class="lv-tp">' +
      col("h", hs, cur.h, "Hour") + col("m", ms, cur.m, "Minute") + "</div>" +
      (note ? '<div class="lv-tp__note">' + UI.esc(note) + "</div>" : "");
    placePop(pop, anchor);
    // выбранная строка встаёт в середину колонки, как в системном пикере
    TP_LOCK = true;
    [].forEach.call(pop.querySelectorAll(".lv-tp__col"), function (c) {
      var s = c.querySelector(".is-sel");
      if (s) c.scrollTop = Math.max(0, Math.round(s.offsetTop - c.clientHeight / 2 + s.offsetHeight / 2));
      tpSettleOn(c);
    });
    // программная прокрутка тоже шлёт scroll — короткая пауза, чтобы не доводить себя
    setTimeout(function () { TP_LOCK = false; }, 220);
  }
  // Колесо доводится само: отпустил между значениями — ближайшее свободное встаёт в полосу
  // и становится выбранным, как в системном пикере.
  var TP_LOCK = false;
  function tpSettleOn(c) {
    if (c.dataset.lvSettle) return;
    c.dataset.lvSettle = "1";
    c.addEventListener("scroll", function () {
      if (TP_LOCK) return;
      clearTimeout(c._lvT);
      c._lvT = setTimeout(function () { tpSettle(c); }, 140);
    });
  }
  function tpSettle(c) {
    var rows = c.querySelectorAll(".lv-tp__o");
    if (rows.length < 2) return;
    var pitch = rows[1].offsetTop - rows[0].offsetTop;
    if (!pitch) return;
    var idx = Math.round(c.scrollTop / pitch);
    idx = Math.max(0, Math.min(rows.length - 1, idx));
    // если ближайшее значение занято, идём наружу до первого свободного
    var pick = null;
    for (var d = 0; d < rows.length && !pick; d++) {
      [idx - d, idx + d].forEach(function (k) {
        if (pick || k < 0 || k >= rows.length) return;
        if (rows[k].hasAttribute("data-lv-tpset")) pick = rows[k];
      });
    }
    if (!pick) return;
    var parts = pick.getAttribute("data-lv-tpset").split(":");
    if (pick.classList.contains("is-sel")) {
      // значение то же — просто ставим его ровно в полосу
      TP_LOCK = true;
      c.scrollTop = Math.max(0, Math.round(pick.offsetTop - c.clientHeight / 2 + pick.offsetHeight / 2));
      setTimeout(function () { TP_LOCK = false; }, 220);
      return;
    }
    tpPick(parts[0], Number(parts[1]));
  }
  // клик по свободной строке: минута подтягивается к первой доступной в выбранном часе
  function tpPick(kind, v) {
    var sl = FORM.schedules.filter(function (x) { return x.id === TPP.slId; })[0];
    if (!sl) return;
    var cur = partsIn(Date.parse(sl[TPP.which]), FORM.tz);
    var day0 = dayStartMs(cur.date, FORM.tz);
    var blocks = tpBlocks(sl, TPP.which);
    var h = kind === "h" ? v : cur.h, m = kind === "m" ? v : cur.m;
    if (tpWhy(blocks, day0 + (h * 60 + m) * 60e3, sl, TPP.which)) {
      for (var i = 0; i < 60; i++) {
        if (!tpWhy(blocks, day0 + (h * 60 + i) * 60e3, sl, TPP.which)) { m = i; break; }
      }
    }
    if (TPP.which === "end") sl.endSet = true;      // свой конец окна пересчёт не трогает
    dtSet(sl, TPP.which, day0 + (h * 60 + m) * 60e3);
    var anchor = document.querySelector('[data-lv-tpopen="' + TPP.slId + ":" + TPP.which + '"]');
    if (anchor) tpPopRender(anchor);
  }

  // файл превью читается в data URL прямо в браузере — сети прототипу не нужно
  function coverFromFile(f) {
    if (!f) return;
    if (["image/png", "image/jpeg"].indexOf(f.type) === -1) { FORM.coverErr = "JPG or PNG only."; renderForm(); return; }
    if (f.size > 2 * 1024 * 1024) { FORM.coverErr = "The image is larger than 2 MB."; renderForm(); return; }
    FORM.coverErr = "";
    var rd = new FileReader();
    rd.onload = function () {
      FORM.cover = rd.result;
      FORM.coverName = f.name;
      renderForm(); UI.toast("Thumbnail updated.");
    };
    rd.readAsDataURL(f);
  }
  document.addEventListener("change", function (e) {
    if (e.target.closest && e.target.closest("[data-lv-pickfileinput]")) {
      pickUploadFiles(e.target.files);
      e.target.value = "";
      return;
    }
    if (e.target.closest && e.target.closest("[data-lv-qfile]") && FORM) {
      formQueueUpload(e.target.files);
      e.target.value = "";
      return;
    }
    if (e.target.closest && e.target.closest("[data-lv-coverfile]")) {
      coverFromFile(e.target.files && e.target.files[0]);
      e.target.value = "";
    }
  });
  document.addEventListener("dragover", function (e) {
    var z = e.target.closest && e.target.closest("[data-lv-coverdrop]");
    if (z) { e.preventDefault(); z.classList.add("is-over"); }
  });
  document.addEventListener("dragleave", function (e) {
    var z = e.target.closest && e.target.closest("[data-lv-coverdrop]");
    if (z) z.classList.remove("is-over");
  });
  document.addEventListener("drop", function (e) {
    var z = e.target.closest && e.target.closest("[data-lv-coverdrop]");
    if (!z) return;
    e.preventDefault();
    z.classList.remove("is-over");
    coverFromFile(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]);
  });

  // имя выводится из ссылки: обновляем табличку, не перерисовывая поле со ссылкой
  function formNameOut() {
    var box = document.querySelector("[data-lv-nameout]");
    if (!box) return;
    var n = nameFromLink(FORM.link);
    box.innerHTML = n ? UI.esc(n) : '<span class="an-muted">From the stream link</span>';
  }
  // мелкая перерисовка: обновляем только правую колонку, не теряя фокус в поле слева
  function formLight() {
    if (!FORM) return;
    formSyncEnds();          // полоса значений считает по окну, поэтому оно всегда актуально
    var map = document.querySelector(".lv-wiz__map"), foot = document.querySelector(".lv-wiz__foot");
    if (!map || !foot) { renderForm(); return; }
    map.innerHTML = wizMapHtml(!!FORM.id);
    foot.innerHTML = wizFootHtml(!!FORM.id, wizBlocked(WZ.step));
  }
  function moveFile(s, fid, dir) {
    var pl = content(s);
    if (!pl) return;
    var i = pl.items.findIndex(function (x) { return x.fileId === fid; });
    var j = i + dir;
    if (i < 0 || j < 0 || j >= pl.items.length) return;
    var tmp = pl.items[i]; pl.items[i] = pl.items[j]; pl.items[j] = tmp;
    save(); renderDetail();
    UI.toast("Moved " + (dir < 0 ? "up" : "down") + ".");
  }
  function removeFile(s, fid) {
    var pl = content(s);
    if (!pl) return;
    pl.items = pl.items.filter(function (x) { return x.fileId !== fid; });
    save(); renderDetail();
    UI.toast("1 video removed from “" + pl.name + "”.");
  }
  // тумблеры: файл вкл/выкл, колонки, «только ошибки»
  document.addEventListener("lv:switch", function (e) {
    var el = e.target;
    var nf = el.getAttribute("data-lv-nf");
    if (nf) {
      var np2 = nf.split(":"), row = notif().matrix[np2[0]];
      if (row) { row.on[Number(np2[1])] = e.detail.on; save(); }
      return;
    }
    var cf = el.getAttribute("data-lv-calf");
    if (cf) {
      var cfp = cf.split(":");
      CALV[cfp[0]] = e.detail.on ? CALV[cfp[0]].concat([cfp[1]]) : CALV[cfp[0]].filter(function (v) { return v !== cfp[1]; });
      renderCalendar();
      return;
    }
    var fidForm = el.getAttribute("data-lv-file");
    if (fidForm && PAGE === "form" && FORM) {
      var itF = formQueue().filter(function (i) { return i.fileId === fidForm; })[0];
      if (itF) { itF.off = !e.detail.on; formDetach(); renderForm(); }
      return;
    }
    var fid = el.getAttribute("data-lv-file");
    if (fid) {
      // тумблер файла работает и в карточке стрима, и в редакторе плейлиста
      var qroot = el.closest("[data-lv-plqueue]");
      if (qroot) {
        var pe = plById(qroot.getAttribute("data-lv-plqueue"));
        var pit = pe && pe.items.filter(function (i) { return i.fileId === fid; })[0];
        if (pit) { pit.off = !e.detail.on; renderPlEditor(); }
        return;
      }
      var s = stream(new URLSearchParams(location.search).get("id")) || S.streams[0];
      var pl = content(s);
      var item = pl && pl.items.filter(function (i) { return i.fileId === fid; })[0];
      if (item) { item.off = !e.detail.on; save(); renderDetail(); }
      return;
    }
    if (el.hasAttribute("data-lv-pickonly")) { PICK.videosOnly = e.detail.on; pickRender(); return; }
    var ffs = el.getAttribute("data-lv-f");
    if (ffs && FORM) {
      if (ffs === "loop") { FORM.loop = e.detail.on; renderForm(); return; }
      if (ffs === "vert") {
        FORM.vert = e.detail.on;
        FORM.vertTouched = true;
        // ступень могла стать невозможной в новой ориентации — опускаем до допустимой
        var plO = formQueuePl();
        if (!resFits(plO, formRes(), FORM.vert)) {
          var okRow = null;
          PRESETS.forEach(function (r) { if (!okRow && resFits(plO, r, FORM.vert)) okRow = r; });
          FORM.res = okRow;
        }
        renderForm();
        return;
      }
      if (ffs === "shuffle") FORM.shuffle = e.detail.on;
      else if (ffs === "loopLimitOn") FORM.loopLimit = e.detail.on ? 3 : 0;
      else if (ffs === "backup") FORM.backup = e.detail.on;
      renderForm();
      return;
    }
    var slsw = el.getAttribute("data-lv-slot");
    if (slsw && FORM) { formSlotEdit(el, e.detail.on); return; }
    var f = el.getAttribute("data-lv-f");
    if (f) {
      var kv2 = f.split(":"), arr = S.filters[kv2[0]];
      S.filters[kv2[0]] = e.detail.on ? arr.concat([kv2[1]]) : arr.filter(function (v) { return v !== kv2[1]; });
      save(); renderList();
      return;
    }
    var col = el.getAttribute("data-lv-col");
    if (col) {
      var on = visCols().map(function (c) { return c.k; });
      S.cols = e.detail.on ? on.concat([col]) : on.filter(function (k) { return k !== col; });
      // порядок колонок всегда канонический, а не порядок включения
      S.cols = COLS.filter(function (c) { return c.lock || S.cols.indexOf(c.k) !== -1; }).map(function (c) { return c.k; });
      save(); renderList();
      return;
    }
    if (el.hasAttribute("data-lv-errors")) {
      var host = document.querySelector("[data-lv-detail]");
      host.setAttribute("data-lv-errors-only", e.detail.on ? "1" : "0");
      renderDetail();
    }
  });

  // Заблокированная кнопка «дальше»: тултип уже назвал причину, клик вдобавок метит
  // сами незаполненные поля. Слушаем на перехвате — общий отсекатель кликов по
  // заблокированным контролам (ui-kit) не даёт событию всплыть до обработчика выше.
  document.addEventListener("click", function (e) {
    var wzn = e.target.closest && e.target.closest("[data-lv-wznext]");
    if (!wzn || !FORM || !UI.isOff(wzn)) return;
    FORM.showInvalid = true;
    renderForm();
    var first = document.querySelector(".lv-inv");
    if (first) {
      var inp = first.tagName === "INPUT" ? first : first.querySelector("input, button");
      if (inp && inp.focus) inp.focus();
    }
  }, true);

  document.addEventListener("input", function (e) {
    var ff = e.target.closest && e.target.closest("[data-lv-f]");
    if (ff && FORM) {
      var key = ff.getAttribute("data-lv-f");
      if (key === "loopLimit") FORM.loopLimit = Math.max(1, Number(ff.value) || 1);
      else FORM[key] = ff.value;
      if (FORM.showInvalid) {
        // человек начал заполнять — метку снимаем, но поле с фокусом не перерисовываем
        FORM.showInvalid = false;
        [].slice.call(document.querySelectorAll(".lv-inv")).forEach(function (n) { n.classList.remove("lv-inv"); });
      }
      if (key === "link") formNameOut();
      if (key === "playlistId" || key === "tz" || key === "channelId") renderForm();
      else formLight();
      return;
    }
    var sl2 = e.target.closest && e.target.closest("[data-lv-slot]");
    if (sl2 && FORM) { formSlotEdit(sl2); return; }
    if (e.target.closest && e.target.closest("[data-lv-formplname]")) {
      FORM.newPl.name = e.target.value; formLight(); return;
    }
    if (e.target.closest && e.target.closest("[data-lv-plname]")) {
      var pt2 = plTarget();
      pt2.name = e.target.value.trim() || "Untitled playlist";
      return;
    }

    if (e.target.closest && e.target.closest("[data-lv-nfhours]")) {
      notif().balanceWarnHours = Math.max(1, Number(e.target.value) || 1); save(); return;
    }
    if (e.target.closest && e.target.closest("[data-lv-caltz]")) { CALV.tz = e.target.value; renderCalendar(); return; }
    if (e.target.closest && e.target.closest("[data-lv-pickq]")) { PICK.q = e.target.value; pickRender(); return; }
    if (e.target.closest && e.target.closest("[data-lv-q]")) renderList();
    if (e.target.closest && e.target.closest("[data-lv-plq]")) renderPlaylists();
  });
  // датапикер периода: клик вне закрывает, Escape закрывает, Enter в поле применяет
  document.addEventListener("click", function (e) {
    var wrap = document.querySelector("[data-lv-dr]");
    if (!wrap || !wrap.classList.contains("is-open")) return;
    if (!(e.target.closest && e.target.closest("[data-lv-dr]"))) cdrOpen(false);
  }, true);
  document.addEventListener("keydown", function (e) {
    if (!(e.target.closest && e.target.closest("[data-lv-dr]"))) return;
    if (e.key === "Escape") { cdrOpen(false); return; }
    if (e.key === "Enter" && e.target.tagName === "INPUT") { e.preventDefault(); cdrApply(); }
  });
  document.addEventListener("keydown", function (e) {
    var row = e.target.closest && e.target.closest("[data-lv-row-id]");
    if (row && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      location.href = streamHref(stream(row.getAttribute("data-lv-row-id")) || { id: row.getAttribute("data-lv-row-id") });
    }
  });
  // переименование на месте
  document.addEventListener("click", function (e) {
    if (!(e.target.closest && e.target.closest("[data-lv-rename]"))) return;
    var s = stream(new URLSearchParams(location.search).get("id")) || S.streams[0];
    var body = '<label class="lv-pop__t" for="lvRnName">Stream name</label>' +
      '<input class="an-input" id="lvRnName" type="text" value="' + UI.esc(s.name) + '" />';
    var m = modalShell("lvRn", "Rename stream", body,
      btn("Cancel", "secondary", "data-lv-close") + btn("Save", "primary", 'data-lv-do="rn" data-lv-focus'));
    m.querySelector('[data-lv-do="rn"]').onclick = function () {
      var v = m.querySelector("#lvRnName").value.trim();
      if (!v) { UI.toast("Name can’t be empty"); return; }
      s.name = v; save(); UI.closeModals(); render(); UI.toast("Stream renamed.");
    };
  });

  // ============================================================ демо-API
  window.subsubLiveState = function (name, status) {
    var s = S.streams.filter(function (x) { return x.id === name || x.name === name; })[0];
    if (!s) return "stream not found";
    if (!ST[status]) return "status must be one of: " + Object.keys(ST).join(", ");
    var parts2 = String(status).split(":");
    s.status = parts2[0];
    s.virtual_status = parts2[1] || null;
    if (status === "live" && !s.onAir) {
      var pl = content(s);
      if (pl && pl.items.length) s.onAir = { fileId: pl.items[0].fileId, passedSec: 60 };
    }
    save(); render();
    return s.name + " → " + status;
  };
  window.subsubLiveStates = function () {
    var out = {};
    S.streams.forEach(function (s) { out[s.name] = s.status; });
    return out;
  };
  window.subsubLiveAccount = function (mode) {
    if (!F.account.modes[mode]) return "mode must be one of: " + Object.keys(F.account.modes).join(", ");
    S.account.mode = mode; save(); render();
    return "account mode → " + mode;
  };
  window.subsubLiveNow = function (iso) {
    if (!iso) return S.now;
    S.now = iso; save(); render();
    return S.now;
  };
  window.subsubLiveLoading = function (on) { S.loading = !!on; save(); render(); return S.loading; };
  window.subsubLiveReset = function () {
    UI.storeDel(KEY);
    S = fresh();
    save();
    location.reload();
  };

  // ============================================================ старт
  function render() {
    syncChrome();
    if (PAGE === "streams") renderList();
    else if (PAGE === "stream") renderDetail();
    else if (PAGE === "playlists") renderPlaylists();
    else if (PAGE === "playlist") renderPlEditor();
    else if (PAGE === "form") renderForm();
    else if (PAGE === "calendar") renderCalendar();
    else if (PAGE === "settings") renderSettings();
  }
  // Демо-параметры в адресе: удобно и для показа, и для снимков состояний одним URL.
  // ?demo=payg|trial|org|empty — режим счёта, ?loading=1 — состояние загрузки.
  function readQuery() {
    var p = new URLSearchParams(location.search);
    var dm = p.get("demo");
    if (dm && F.account.modes[dm]) S.account.mode = dm;
    // вход из карточки стрима: календарь открывается на нужном дне и канале
    if (PAGE === "calendar") {
      var dq = p.get("date"), cq = p.get("channel"), sq = p.get("scale");
      if (dq && /^\d{4}-\d{2}-\d{2}$/.test(dq)) CALV.anchor = dq;
      if (cq && (cq === "__all" || chan(cq))) CALV.channel = cq;
      if (sq && ["day", "week", "month"].indexOf(sq) !== -1) CALV.scale = sq;
      var vq = p.get("view");
      if (vq === "list" || vq === "cal") CALV.view = vq;
    }
    if (p.get("loading") === "1") S.loading = true;
    return p.get("loading") === "1";
  }
  function boot() {
    var forceLoading = readQuery();
    if (forceLoading) { render(); return; }
    // скелетон видно на первой отрисовке: состояние загрузки достижимо без правки кода
    var firstPaint = !UI.storeGet(KEY + "_seen", false);
    if (firstPaint && PAGE === "streams") {
      S.loading = true;
      render();
      UI.storeSet(KEY + "_seen", true);
      setTimeout(function () { S.loading = false; save(); render(); }, 400);
      return;
    }
    S.loading = false;
    render();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

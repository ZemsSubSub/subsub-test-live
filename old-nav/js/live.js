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
  // Нулевой сценарий: аккаунт платный, но ни каналов, ни стримов, ни плейлистов, ни файлов
  // ещё нет (решение 08.09: канал человек подключает сам). Состояние у варианта своё.
  function demoMode() {
    var v = document.body ? document.body.getAttribute("data-demo") : "";
    return v === "empty" || v === "org" ? v : "";
  }
  var DEMO = demoMode();
  if (DEMO === "empty") {
    F = JSON.parse(JSON.stringify(F));
    F.streams = []; F.playlists = []; F.notifications = []; F.files = []; F.folders = [];
    F.account.mode = "payg";
  }
  var ORGF = window.LIVE_FIXTURES_ORG || null;
  var CTX = (function () {
    var p = new URLSearchParams(location.search);
    // the organisation context opens by ?ws=org in any build; the org variant opens it by default
    var c = { on: !!ORGF && (DEMO === "org" || p.get("ws") === "org"), ws: "org", role: null, roleParam: null, me: null, org: null };
    if (!c.on) return c;
    c.ws = p.get("ws") === "personal" ? "personal" : "org";
    var r = p.get("role");
    c.roleParam = r === "owner" || r === "manager" || r === "user" ? r : null;
    if (c.ws === "org") {
      c.role = c.roleParam || "manager";
      c.org = ORGF.org;
      c.me = ORGF.org.viewerByRole[c.role];
    }
    return c;
  })();
  if (CTX.on) {
    F = JSON.parse(JSON.stringify(F));
    var WSF = CTX.ws === "org" ? ORGF.org : ORGF.personal;
    F.streams = WSF.streams; F.playlists = WSF.playlists;
    if (CTX.ws === "org") { F.account.modes.org.balance = WSF.balance; F.account.modes.org.orgName = WSF.name; F.account.mode = "org"; }
    else { F.account.modes.payg.balance = WSF.balance; F.account.mode = "payg"; }
  }
  var PAGE = document.body.getAttribute("data-lv-page") || "";
  var MQ_M = window.matchMedia ? window.matchMedia("(max-width: 767px)") : null;
  var MOB = !!(MQ_M && MQ_M.matches);
  var M_LOAD = Date.now();
  var KEY = "subsub_live_state" + (DEMO ? "_" + DEMO : "") + (CTX.on ? "_" + CTX.ws : "");

  // ============================================================ состояние
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function fresh() {
    return {
      v: STATE_V,
      calDest: null,
      calView: "cal",
      now: F.now,
      account: { mode: F.account.mode },
      streams: clone(F.streams),
      playlists: clone(F.playlists),
      cols: null,          // null → состав колонок по умолчанию
      filters: { status: [], dests: [], authors: [] },
      loading: false
    };
  }
  var STATE_V = 12;                        // a new value discards saved state from the previous model
  var S = UI.storeGet(KEY, null) || fresh();
  if (S.v !== STATE_V) S = fresh();       // в старом состоянии оставались пустые «New playlist»
  if (!S.filters) S.filters = { status: [], dests: [], authors: [] };
  if (!S.filters.authors) S.filters.authors = [];
  // загруженные в демо файлы живут в состоянии, иначе после перезагрузки очередь осиротеет
  if (DEMO && S.extraFiles && S.extraFiles.length) F.files = F.files.concat(S.extraFiles);
  if (S.qkFiles && S.qkFiles.length) F.files = F.files.concat(S.qkFiles);
  // сконвертированные файлы: фикстуры получают сохранённый профиль и размер
  Object.keys(S.conv || {}).forEach(function (id) {
    var cf = F.files.filter(function (x) { return x.id === id; })[0];
    if (cf) { cf.q = S.conv[id].q; if (S.conv[id].bytes) cf.bytes = S.conv[id].bytes; cf.state = "ready"; }
  });
  // поля, добавленные в фикстуры позже сохранённого состояния: ссылка на эфир и прогресс подготовки
  F.streams.forEach(function (f0) {
    var st = stream(f0.id);
    if (!st) return;
    if (st.dest && !st.dest.link && f0.dest && f0.dest.link) st.dest.link = f0.dest.link;
    if (f0.prep && !st.prep) st.prep = f0.prep;
  });
  if (inOrg()) { var meRow = person(CTX.me); if (meRow) meRow.role = CTX.role; }
  function save() { UI.storeSet(KEY, S); }
  // the mobile clock moves with real time from the page load: timers and «Starts in» must not freeze
  function nowMs() { return Date.parse(S.now) + (MOB ? Date.now() - M_LOAD : 0); }

  var TZ = F.account.tz, TZL = F.account.tzLabel;

  // ---- справочники
  function file(id) { return F.files.filter(function (f) { return f.id === id; })[0] || null; }
  function playlist(id) { return S.playlists.filter(function (p) { return p.id === id; })[0] || null; }
  function stream(id) { return S.streams.filter(function (s) { return s.id === id; })[0] || null; }
  function acc() {
    var m = F.account.modes[S.account.mode] || F.account.modes.payg;
    return { mode: S.account.mode, kind: m.kind, balance: m.balance, creditHours: m.creditHours, shared: !!m.shared, orgName: m.orgName, label: m.label };
  }

  function inOrg() { return CTX.on && CTX.ws === "org"; }
  function isUser() { return inOrg() && CTX.role === "user"; }
  function isMgr() { return inOrg() && CTX.role !== "user"; }
  function members() {
    if (!inOrg()) return [];
    if (!S.members) S.members = clone(CTX.org.people);
    return S.members;
  }
  function person(id) { return members().filter(function (p) { return p.id === id; })[0] || null; }
  function me() { return inOrg() ? person(CTX.me) : ORGF ? ORGF.org.people[1] : null; }
  function mine(s) { return !inOrg() || !s || !s.authorId || s.authorId === CTX.me; }
  function canSee(s) { return !isUser() || mine(s); }
  function vis() { return S.streams.filter(canSee); }
  function own(o) { if (inOrg()) o.authorId = CTX.me; return o; }
  function authorName(id) { var p = person(id); return p ? p.name : ""; }
  function authorHtml(id) {
    var p = person(id);
    if (!p) return '<span class="an-muted">—</span>';
    var gone = p.status === "removed";
    return '<span class="lv-chan lv-author' + (gone ? " is-removed" : "") + '"><span class="an-chan__ava" style="background:' + p.color + '">' + UI.esc(p.initial) + "</span>" +
      '<span class="lv-chan__col"><span class="lv-chan__n">' + UI.esc(p.name) + "</span></span></span>";
  }
  // the stream page names the author without an avatar: the pair sits beside the channel in a 360 px column
  function authorText(id) {
    var p = person(id);
    if (!p) return '<span class="an-muted">—</span>';
    return '<span class="lv-dpair__v' + (p.status === "removed" ? " is-removed" : "") + '" title="' + UI.esc(p.name) + '">' + UI.esc(p.name) + "</span>";
  }
  function streamAuthors() {
    var ids = [];
    S.streams.forEach(function (s) { if (s.authorId && ids.indexOf(s.authorId) === -1) ids.push(s.authorId); });
    return ids;
  }
  function roleLabel(r) { return r === "owner" ? "Owner" : r === "manager" ? "Manager" : "User"; }
  function ctxUrl(u) {
    if (!CTX.on || !u || /^(https?:|#|mailto:|javascript:)/.test(u)) return u;
    var hash = "", i = u.indexOf("#");
    if (i !== -1) { hash = u.slice(i); u = u.slice(0, i); }
    if (/[?&]ws=/.test(u)) return u + hash;
    var add = "ws=" + CTX.ws + (CTX.roleParam ? "&role=" + CTX.roleParam : "");
    return u + (u.indexOf("?") === -1 ? "?" : "&") + add + hash;
  }
  function offBtn(label, mode, why) {
    return '<button class="an-btn an-btn--' + mode + ' an-btn--small is-off" type="button" aria-disabled="true" data-tip="' + UI.esc(why) + '">' + UI.esc(label) + "</button>";
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
    archived:   { label: "Deleted" },
    needconv:   { label: "Needs conversion" },
    converting: { label: "Converting" },
    convfail:   { label: "Conversion failed" },
    // Redis-лок запуска: пока держится, ни одно действие не срабатывает — бейдж это и говорит
    starting:   { label: "Starting…" },
    // мастер закрыли, не дойдя до конца: набор и настройки лежат черновиком
    draft:      { label: "Draft" },
    // файл в наборе не выровнять: конвертация не спасёт, запуск заблокирован
    cant:       { label: "Not aligned" },
    uploading:  { label: "Uploading" },
    fproc:      { label: "Processing" },
    needdest:   { label: "Needs destination" }
  };
  // Фильтры статусов работают по группам, бейджи остаются подробными. Список фильтрует жизненный
  // цикл стрима, проблемы контента собраны в «Needs attention»; календарь отвечает на четыре вопроса:
  // что идёт сейчас, что запланировано, где проблема, что уже прошло (решение владельца 09.09).
  var ATTENTION_KEYS = ["needconv", "converting", "convfail", "cant", "uploading", "fproc", "needdest"];
  var LIST_ST_GROUPS = [
    { k: "draft", label: "Draft", keys: ["draft"] },
    { k: "ready", label: "Ready to start", keys: ["ready"] },
    { k: "scheduled", label: "Scheduled", keys: ["scheduled"] },
    { k: "live", label: "Live", keys: ["live", "starting", "preparing", "stopping"] },
    { k: "stopped", label: "Stopped", keys: ["stopped"] },
    { k: "attention", label: "Needs attention", keys: ATTENTION_KEYS }
  ];
  var CAL_ST_GROUPS = [
    { k: "onair", label: "On air", keys: ["live", "starting", "preparing", "stopping"] },
    { k: "scheduled", label: "Scheduled", keys: ["ready", "scheduled"] },
    { k: "attention", label: "Needs attention", keys: ATTENTION_KEYS },
    { k: "finished", label: "Finished", keys: ["stopped"] }
  ];
  function stGroup(groups, k) { return groups.filter(function (g) { return g.keys.indexOf(k) !== -1; })[0] || null; }
  function stGroupLabel(groups, gk) { var g = groups.filter(function (x) { return x.k === gk; })[0]; return g ? g.label : gk; }
  // в сохранённом состоянии могли остаться старые ключи-статусы: они больше не фильтруют ничего
  S.filters.status = S.filters.status.filter(function (k) { return LIST_ST_GROUPS.some(function (g) { return g.k === k; }); });
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
    var qs = qkStreamState(s);
    if (qs) return qs;
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
  function destName(s) {
    var d = (s && s.dest) || {};
    return d.name || channelOf(d.link, d.key, s && s.id) || destHost(d.link) || "No destination";
  }
  function knownChannels() {
    var seen = {};
    return S.streams.filter(function (s) { return s.dest && s.dest.name; }).map(function (s) { return s.dest.name; })
      .filter(function (nm) { if (seen[nm]) return false; seen[nm] = true; return true; })
      .sort(function (a, b) { return a.localeCompare(b); });
  }
  function channelOf(link, key, selfId) {
    var l = String(link || "").trim(), k = String(key || "").trim(), basis = l || k;
    if (!basis) return "";
    var hit = S.streams.filter(function (o) {
      return o.id !== selfId && o.dest && o.dest.name &&
        ((l && String(o.dest.link || "").trim() === l) || (k && String(o.dest.key || "").trim() === k));
    })[0];
    if (hit) return hit.dest.name;
    var list = knownChannels();
    if (!list.length) return "YouTube channel";
    var h = 0; for (var i = 0; i < basis.length; i++) h = (h * 31 + basis.charCodeAt(i)) >>> 0;
    return list[h % list.length];
  }
  function destHtml(s) {
    return '<span class="lv-chan"><span class="lv-chan__n">' + UI.esc(destName(s)) + "</span></span>";
  }
  function destAva(nm) {
    var h = 0; for (var i = 0; i < nm.length; i++) h = (h * 31 + nm.charCodeAt(i)) >>> 0;
    return '<span class="an-chan__ava" style="background: var(--color-avatar-' + (h % 7) + ')">' + UI.esc(nm.charAt(0).toUpperCase()) + "</span>";
  }
  function dests() {
    var seen = {};
    return S.streams.filter(function (s) { return s.status !== "draft"; }).map(destName)
      .filter(function (nm) { if (seen[nm]) return false; seen[nm] = true; return true; })
      .sort(function (a, b) { return a.localeCompare(b); });
  }
  function streamHref(s) {
    return (s && s.status === "draft" ? "live-stream-create.html?id=" : "live-stream.html?id=") + encodeURIComponent(s.id);
  }
  function stBadge(k, tip, label) {
    var s = ST[k] || ST.ready;
    return '<span class="ml-tag ml-tag--pill lv-st lv-st--' + k + '"' +
      (tip ? ' tabindex="0" data-tip="' + UI.esc(tip) + '"' : "") + ">" +
      (s.dot ? '<span class="ml-tag__dot"></span>' : "") + (label || s.label) + "</span>";
  }

  // ============================================================ тексты — по одному на смысл
  var T = {
    // причины блокировок
    alreadyRunning: "This stream is already running.",
    alreadyPreparing: "The stream is already preparing to go live.",
    notLive: "This stream is not live.",
    inProgress: "Action in progress.",
    draftStart: "Finish the setup to start.",
    openEndVal: "Until you stop it",
    pastRun: "Past runs stay as history — only future runs can be changed.",
    draftOnly: "Finish the setup first.",
    afterStop: "Available after the stream stops.",
    noAirYet: "The stream hasn’t been live yet.",
    archivedRO: "Deleted streams can’t be edited.",
    stopBeforeArchive: "Stop the stream before deleting it.",
    liveEditPlaylist: "The stream is on air — stop it to change the queue or settings.",
    needKey: "Paste the stream link and key to continue.",
    needLink: "Add the stream link to open the broadcast.",
    destEditHint: "A new broadcast comes with a new stream link — update the link together with the key.",
    vrQuality: "360° streams go out at 2k or 4k.",
    needVideo: "Add at least one video to continue.",
    balanceEmpty: "Your balance is empty — top up to start streaming.",
    onAir: "This video is on air",
    emptyPl: "An empty playlist can’t be selected in a stream.",
    calAllRO: "Switch to a single destination to move runs.",
    // панель готовности (SSDEV-2153, сведено в одну модель)
    readyNone: "Add at least one video.",
    // баланс
    paused: "Streaming is paused — top up your balance to continue.",
    topUp: "Top up balance",
    orgBalanceOut: "The organization's balance has run out. Ask an owner or a manager to top it up.",
    plForeign: "Only the playlist author, a manager or the owner can edit this playlist.",
    keyBusyAnon: "Key already used by another stream.",
    noAccess: "You don't have access to this stream.",
    needOwner: "An organization needs an owner. Pick one before you leave.",
    leaveNote: "Your channels stay in the organization. You can be re-invited later.",
    maxSlots: "Up to 10 start times per stream.",
    filesGone: "Some files are no longer available.",
    plLimit: "You reached the 500 GB limit for one playlist.",
    noKey: "This stream has no stream key yet.",
    inert: "Not included in this prototype"
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
  function resProfile(row, vert, vr) {
    var r = RES_DIM[row] ? row : resRow(row || 1080);
    var d = resDim(r, vert);
    return { row: r, vert: !!vert, vr: !!vr, w: d[0], h: d[1], fps: INGEST.fps, vcodec: INGEST.vcodec,
      acodec: INGEST.acodec, ac: INGEST.ac, ar: INGEST.ar, audio: INGEST.audio };
  }
  function profileOf(pl) {
    // цели по умолчанию нет: набор судится по максимуму, который сам позволяет
    var base = (pl && pl.profile) || null;
    var capO = resCap(pl);
    var out = base && base.row ? base : resProfile(capO.row || (base && base.h) || 1080, capO.vert);
    // частота всегда из файлов: в профиле она может быть устаревшей
    out.fps = fpsOf(pl);
    out.vr = pl && pl.vr != null ? !!pl.vr : base && base.vr != null ? !!base.vr : anyVr(pl && pl.items);
    // a quick stream plays each file in its own orientation: the turned frame of the same step is not a mismatch
    out.anyOrient = !!(pl && pl.quick);
    return out;
  }
  function anyVr(items) {
    return (items || []).filter(inSet).some(function (i) { var f = file(i.fileId); return !!(f && f.q && f.q.vr); });
  }
  // Conversion aligns resolution, frame rate, bitrate, codecs and audio. It cannot fix a frame rate
  // outside 24–60, a file below the target (no upscaling) or the wrong projection (360° vs flat).
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
    if (!!f.q.vr !== !!prof.vr) return "cant";
    var rng = rateRangeFor(prof.row || resRow(prof.h, prof.w), fpsCol(prof.fps), prof.vert);
    if (!rng) return "cant";
    var frow = resRow(f.q.h, f.q.w), trow = prof.row || resRow(prof.h, prof.w);
    // вверх не масштабируем: файл меньше цели починить нечем
    if (frow < trow) return "cant";
    if ((f.q.h !== prof.h || f.q.w !== prof.w) && !(prof.anyOrient && f.q.h === prof.w && f.q.w === prof.h)) return "needconv";
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
  // 360° streams run at 2k–4k with roughly triple the bitrate, hence their own rate
  function rateNum(s) { return s && s.vr ? (F.account.hourRateVR || F.account.hourRate * 3) : F.account.hourRate; }
  function rateStr(s) { return F.account.customRate ? "Custom rate" : "$" + rateNum(s) + " / hour"; }

  function endOf(s) { return (s && s.playback && s.playback.end) || { mode: "none" }; }
  function loopsOf(s) { var e = endOf(s); return s && s.playback && s.playback.loop && e.mode === "loops" && e.loops > 0 ? e.loops : 0; }
  function untilOf(s) { var e = endOf(s); return s && s.playback && s.playback.loop && e.mode === "until" && e.until ? e.until : null; }
  function openWindow(s) { return !!(s && s.playback && s.playback.loop && endOf(s).mode === "none"); }
  function playLabel(s) {
    var e = endOf(s);
    return s.playback && s.playback.loop
      ? "Loop" + (e.mode === "loops" ? " ×" + e.loops : e.mode === "until" ? " · until " + UI.time(e.until, TZ) : "")
      : "Play once";
  }
  function cost(s) {
    var a = acc(), r = rateNum(s);
    var slot = nextSlot(s);
    var windowH = slot ? (openWindow(s) ? 24 : (Date.parse(slot.end) - Date.parse(slot.start)) / 3600e3) : 0;
    var untilH = !slot && untilOf(s) ? Math.max(0, (Date.parse(untilOf(s)) - nowMs()) / 3600e3) : 0;
    var balHours = a.kind === "hours" ? a.creditHours : (r > 0 ? a.balance / r : 0);
    // сколько на самом деле будет идти вещание: без цикла — один проход, с лимитом циклов —
    // столько проходов; окно только ограничивает сверху, а платить за простой не за что
    var contentSec = plStats(content(s) || null).sec;
    var loops = s && s.playback && s.playback.loop ? loopsOf(s) : 1;
    var bound = windowH || untilH;
    var billH = bound;
    if (contentSec && loops > 0) billH = bound ? Math.min(bound, contentSec * loops / 3600) : contentSec * loops / 3600;
    return {
      rate: r, rateStr: rateStr(s),
      perDay: r * 24, windowH: windowH, untilH: untilH, billH: billH, windowCost: billH * r,
      passSec: contentSec, passCost: contentSec / 3600 * r,
      balHours: balHours, notEnough: billH > 0 && balHours < billH, account: a
    };
  }

  // ============================================================ расписание
  // ближайший будущий слот; для идущего эфира — текущий
  function nextSlot(s) {
    if (!s || !s.schedules || !s.schedules.length) return null;
    var n = nowMs();
    var future = s.schedules.filter(function (sl) { return Date.parse(sl.end) > n; })
      .sort(function (a, b) { return Date.parse(a.start) - Date.parse(b.start); });
    return future[0] || s.schedules[s.schedules.length - 1];
  }
  // следующие три запуска правила повтора — текстом, чтобы правило было проверяемым
  // горизонт планирования обещан подписью под «Add another time» — значит, он и проверяется
  function slotBeyondHorizon(list) {
    var days = F.account.horizonDays || 0;
    if (!days) return "";
    var limit = nowMs() + days * 24 * 3600e3;
    for (var i = 0; i < (list || []).length; i++) {
      if (Date.parse(list[i].start) > limit) return "Windows can be scheduled up to " + days + " days ahead.";
    }
    return "";
  }
  function horizonMs() { return nowMs() + (F.account.horizonDays || 60) * DAYMS; }
  // длина одного запуска: Play once — очередь, луп с лимитом — очередь × N, бесконечный луп — само окно
  function runLenMs(s, sl) {
    var pb = (s && s.playback) || {}, lim = loopsOf(s);
    var win = Date.parse(sl.end) - Date.parse(sl.start);
    if (pb.loop && !lim) return win;
    var sec = plStats(content(s) || null).sec;
    if (!sec) return win;
    return Math.ceil(sec / 60) * 60e3 * (pb.loop ? lim : 1);
  }
  function runsOf(s, sl, fromMs, toMs) {
    var start = Date.parse(sl.start), end = Date.parse(sl.end);
    if (!(end > start)) end = start + 60e3;
    return end > fromMs && start < toMs ? [{ start: start, end: end }] : [];
  }
  function firstClash(a, b) {
    var best = null;
    a.forEach(function (x) {
      b.forEach(function (y) {
        if (x.start < y.end && y.start < x.end) {
          var at = Math.max(x.start, y.start);
          if (best === null || at < best) best = at;
        }
      });
    });
    return best;
  }
  function dayMon(ms) {
    return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric", month: "short" }).format(new Date(ms));
  }
  function T_SELF_OVERLAP(ms) { return "These runs overlap from " + dayMon(ms) + " — a stream can’t run twice at once."; }
  function T_KEY_BUSY(name) { return "Key already used by “" + name + "”."; }
  function selfClash(s, list, cand) {
    var from = nowMs(), to = horizonMs();
    var cr = runsOf(s, cand, from, to);
    for (var i = 1; i < cr.length; i++) {
      if (cr[i].start < cr[i - 1].end) return { msg: T_SELF_OVERLAP(cr[i].start), at: cr[i].start };
    }
    var best = null;
    (list || []).forEach(function (o) {
      if (o.id === cand.id) return;
      var at = firstClash(cr, runsOf(s, o, from, to));
      if (at !== null && (best === null || at < best)) best = at;
    });
    return best === null ? null : { msg: T_SELF_OVERLAP(best), at: best };
  }
  function listClash(s, list) {
    for (var i = 0; i < (list || []).length; i++) {
      var c = selfClash(s, list, list[i]);
      if (c) return c;
    }
    return null;
  }
  function keyBusyOf(o) {
    if (isUser() && !mine(o)) return { msg: T.keyBusyAnon, liveId: null };
    return { msg: T_KEY_BUSY(o.name), liveId: o.id };
  }
  function keyBusy(key, selfId) {
    var k = String(key || "").trim();
    if (!k) return null;
    for (var i = 0; i < S.streams.length; i++) {
      var o = S.streams[i];
      if (o.id === selfId || o.status === "archived" || !o.dest) continue;
      if (String(o.dest.key || "").trim() === k) return keyBusyOf(o);
    }
    return null;
  }
  function channelBusy(s, cand) {
    return selfClash(s, (s && s.schedules) || [], cand);
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
    if (action === "archive") return k === "archived" ? "Already deleted." : T.stopBeforeArchive;
    if (action === "analytics") return T.noAirYet;
    if (action === "edit") return k === "archived" ? T.archivedRO
      : k === "converting" ? "Conversion is running — the content is locked." : T.liveEditPlaylist;
    return "";
  }
  // что мешает именно запуску: состав, канал, баланс
  function balanceBlock() {
    return isUser() ? { reason: T.orgBalanceOut } : { reason: T.balanceEmpty, act: T.topUp };
  }
  function startBlock(s) {
    var qs = qkStreamState(s);
    if (qs) return { reason: qs === "uploading" ? MT.waitUpload : qs === "fproc" ? QT.procWait : QT.needDest };
    if (s.needWindow && !(s.schedules || []).length) return { reason: "Set a time for this stream first." };
    var a = acc();
    if (a.kind === "money" && a.balance <= 0) return balanceBlock();
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
        if (!i.off && f && fileState(f, prof0) === "needconv") { convStart(f, prof0); n0++; }
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
  function doDuplicate(s) {
    var copy = clone(s);
    copy.id = "s" + Date.now();
    copy.name = s.name + " (copy)";
    copy.stopReason = null;
    copy.onAir = null;
    copy.spentTotal = 0;
    copy.metrics = {};
    copy.viewers = 0;
    copy.status = "created";
    copy.virtual_status = null;
    copy.schedules = [];
    copy.needWindow = true;
    delete copy.startingAt;
    copy.runs = [{ id: copy.id + "-r1", index: 1, start: null, end: null, spent: 0,
      events: [ev("created", "Created", { author: "You" })] }];
    S.streams.unshift(own(copy));
    save();
    UI.toast("“" + copy.name + "” created.");
    location.href = ctxUrl("live-stream.html?id=" + encodeURIComponent(copy.id) + "&edit=" + (keyBusy(copy.dest.key, copy.id) ? "dest" : "time"));
  }
  function doArchive(s) {
    s.status = "archived";
    s.virtual_status = null;
    var r = runOf(s);
    if (r) r.events.unshift(ev("archived", "Deleted", { author: "You" }));
    save();
    UI.toast("“" + s.name + "” deleted.");
    if (PAGE === "stream") { location.href = ctxUrl("live-streams.html"); return; }
    render();
  }
  // the backend archives an unconverted stream 14 days after creation, so the date is shown in advance
  function createdMs(s) {
    var evs = (s.runs || []).reduce(function (a, r) { return a.concat(r.events || []); }, [])
      .filter(function (e) { return e.type === "created"; });
    return evs.length ? Date.parse(evs[evs.length - 1].at) : nowMs();
  }
  function autoDeleteIso(s) { return new Date(createdMs(s) + 14 * 24 * 3600e3).toISOString(); }
  // ---- правки на странице стрима: временный контекст FORM, те же контролы, что в мастере
  function formCtx(s, ctx) {
    var pl = content(s);
    return {
      id: s.id, ctx: ctx, name: s.name, key: s.dest.key || "", link: s.dest.link || "",
      queue: s.queue ? clone(s.queue) : pl ? clone(pl.items) : [],
      srcPl: s.queue ? (s.srcPl || null) : (s.playlistId || null), detached: s.queue ? !!s.detached : false,
      cover: (s.cover && s.cover.src) || null, coverName: s.cover && s.cover.uploaded ? "Custom image" : "",
      desc: s.desc || "",
      res: s.res || null, resTouched: !!s.res, loop: s.playback.loop, shuffle: s.playback.shuffle,
      endMode: endOf(s).mode || "none", loopLimit: loopsOf(s) || 0,
      untilSlot: untilOf(s) ? { id: "until", start: new Date(nowMs()).toISOString(), end: untilOf(s) } : null,
      startMode: "schedule", schedules: clone(s.schedules || []).map(function (x) { x.endSet = true; return x; }), tz: TZ
    };
  }
  function sectionStream() { return FORM && FORM.id ? stream(FORM.id) : null; }
  function secModalRemove() {
    var m = document.getElementById("lvSecEdit");
    if (m) { UI.closeModal(m); m.remove(); }
  }
  function secModalClose() {
    FORM = null;
    secModalRemove();
    renderDetail();
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && FORM && FORM.ctx === "dest" && document.getElementById("lvSecEdit")) secModalClose();
  });
  function sectionOpen(s, ctx) {
    FORM = formCtx(s, ctx);
    renderDetail();
    var first = document.querySelector('[data-lv-sec="' + ctx + '"] input:not([hidden]), [data-lv-sec="' + ctx + '"] textarea, [data-lv-sec="' + ctx + '"] .an-select__trig');
    if (first) setTimeout(function () { first.focus(); }, 0);
  }
  function timeEditCtx(s, slotId) {
    var src = (s.schedules || []).filter(function (x) { return x.id === slotId; })[0];
    var start = nextSlotStart(s.schedules, TZ);
    var passSec = plStats(content(s)).sec;
    var lenMs = (passSec ? Math.ceil(passSec / 60) * 60 : 2 * 3600) * 1000;
    var sl = src ? clone(src) : { id: "sl" + Date.now(), start: new Date(start).toISOString(),
      end: new Date(start + lenMs).toISOString(), tz: TZ, repeat: { type: "none" } };
    sl.endSet = true;
    if (!src && s.needWindow) sl.unset = true;
    var ctx = formCtx(s, "time");
    ctx.schedules = [sl];
    ctx.timeId = src ? slotId : null;
    return ctx;
  }
  function timeEditOpen(s, slotId) {
    FORM = timeEditCtx(s, slotId);
    renderDetail();
  }
  function timeOthers(s) {
    var cur = FORM.schedules[0];
    return (s.schedules || []).filter(function (x) { return x.id !== cur.id; });
  }
  function timeBusy(s) {
    var sl = FORM.schedules[0];
    return channelBusy(Object.assign(formPseudo(), { schedules: timeOthers(s).concat([sl]) }), sl);
  }
  function sectionGate(k) {
    var s = sectionStream();
    if (!s) return "";
    if (k === "dest") {
      if (!(FORM.link || "").trim()) return "Paste the stream link to continue";
      if (!(FORM.key || "").trim()) return T.needKey;
      var kb = keyBusy(FORM.key, FORM.id);
      return kb ? kb.msg : "";
    }
    if (k === "time") {
      var sl = FORM.schedules[0];
      if (sl.unset) return "Pick a date to continue";
      var busy = timeBusy(s);
      if (busy) return busy.msg;
      var horizon = slotBeyondHorizon([sl]);
      if (horizon) return horizon;
      var eta = convEta(formQueuePl());
      if (eta && Date.parse(sl.start) < Date.parse(eta.readyAt)) {
        return "Conversion needs about " + UI.plural(eta.min, "minute", "minutes") +
          " — move the window to " + convEtaAt(eta, sl.start) + " or later.";
      }
    }
    return "";
  }
  function sectionSave(k) {
    var s = sectionStream();
    if (!s || sectionGate(k)) return;
    var toast = "Changes saved.";
    if (k === "dest") {
      var linkChanged = FORM.link.trim() !== String(s.dest.link || "").trim();
      s.dest = { name: (linkChanged ? channelOf(FORM.link, FORM.key, s.id) : s.dest.name) || null, key: FORM.key.trim(), link: FORM.link.trim() };
      if (linkChanged) s.name = nameFromLink(FORM.link) || s.name;
    } else if (k === "time") {
      var sl = clone(FORM.schedules[0]);
      s.schedules = s.schedules || [];
      if (FORM.timeId) s.schedules = s.schedules.map(function (x) { return x.id === FORM.timeId ? sl : x; });
      else s.schedules.push(sl);
      if (["created", "ready", "processing", "downloading"].indexOf(s.status) !== -1) s.virtual_status = "scheduled";
      delete s.needWindow;
      toast = FORM.timeId ? "Time updated." : "Time added — starts " + UI.dt(sl.start, TZ) + " (" + TZL + ").";
    }
    var r0 = runOf(s);
    if (r0 && k !== "time") r0.events.unshift(ev("playlist", "Stream settings changed", { author: "You" }));
    FORM = null;
    secModalRemove();
    save(); renderDetail();
    UI.toast(toast);
    if (k === "dest" && s.needWindow && !(s.schedules || []).length) { timeEditOpen(s, null); focusSlotDate(); }
  }
  function focusSlotDate() {
    setTimeout(function () {
      var b = document.querySelector('[data-lv-sec="time"] [data-lv-dt$=":start"]');
      if (b) { b.scrollIntoView({ block: "center" }); b.focus(); }
    }, 0);
  }
  function timeRemove(s, slotId) {
    s.schedules = (s.schedules || []).filter(function (x) { return x.id !== slotId; });
    if (!s.schedules.length && s.virtual_status === "scheduled") s.virtual_status = null;
    if (FORM && FORM.ctx === "time" && FORM.timeId === slotId) FORM = null;
    save(); render();
    UI.toast("Time removed.");
  }
  // очередь правится в сфокусированном редакторе поверх страницы — та же поверхность, что шаг Content
  function queueEditOpen(s) {
    FORM = formCtx(s, "queue");
    queueEditorRender();
  }
  function queueEditorRender() {
    var m = document.getElementById("lvQEdit");
    if (FORM.qOpened && !(m && m.classList.contains("is-open"))) { FORM = null; renderDetail(); return; }
    var gate = wizBlocked(1);
    var body = '<div class="lv-qedit">' + wizContent() + "</div>";
    var foot = btn("Cancel", "secondary", "data-lv-qcancel") +
      '<button class="an-btn an-btn--primary an-btn--small' + (gate ? " is-off" : "") + '" type="button" data-lv-qdone' +
        (gate ? ' aria-disabled="true" data-tip="' + UI.esc(gate) + '"' : "") + ">Done</button>";
    if (m && m.classList.contains("is-open")) {
      m.querySelector(".an-modal__body").innerHTML = body;
      m.querySelector(".an-modal__foot").innerHTML = foot;
    } else {
      m = modalShell("lvQEdit", "Edit queue", body, foot, " an-modal__dialog--lg an-modal__dialog--qedit");
    }
    FORM.qOpened = true;
    wizBindDnd(m);
  }
  function queueEditDone() {
    var s = sectionStream();
    if (!s || wizBlocked(1)) return;
    s.queue = clone(formQueue()); s.srcPl = FORM.srcPl || null; s.detached = !!FORM.detached;
    s.playlistId = null; s.fileId = null;
    s.res = formRes() || null; s.vert = formVert(); s.vr = formVr();
    s.playback = formPlayback();
    var map = { convert: "needs_conversion", busy: "converting", convfail: "conversion_failed" };
    if (["created", "ready", "needs_conversion", "converting", "conversion_failed"].indexOf(s.status) !== -1) {
      var rd = readiness(content(s));
      s.status = map[rd.state] || (s.status === "ready" ? "ready" : "created");
    }
    var r0 = runOf(s);
    if (r0) r0.events.unshift(ev("playlist", "Queue changed", { author: "You" }));
    FORM = null;
    save(); UI.closeModals(); renderDetail();
    UI.toast("Queue saved.");
  }

  // ============================================================ модалки (Э9)
  var CONFIRM_MODALS = ["lvArch", "lvPlDiscard", "lvPlLeave", "lvClear", "lvPlDel", "lvLeave", "lvPlReplace", "lvMemRm", "lvQclear"];
  function modalShell(id, title, bodyHtml, footHtml, cls) {
    if (CONFIRM_MODALS.indexOf(id) !== -1) cls = (cls || "") + " an-modal__dialog--confirm";
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
  function iconBtn(label, icon, attrs, why) {
    return '<button class="an-btn an-btn--secondary an-btn--small lv-icbtn' + (why ? " is-off" : "") + '" type="button" ' +
      (why ? 'aria-disabled="true" data-tip="' + UI.esc(why) + '"' : attrs + ' data-tip="' + UI.esc(label) + '"') +
      ' aria-label="' + UI.esc(label) + '">' + (icon || "") + "</button>";
  }
  function btn(label, mode, attrs, icon, size) {
    return '<button class="an-btn an-btn--' + mode + " an-btn--" + (size || "small") + '" type="button" ' +
      (attrs || "") + ">" + (icon || "") + UI.esc(label) + "</button>";
  }

  // 1 · Restart stream
  // the window is prefilled with the time of the last one; its date has usually passed, so the
  // start moves to today or the next day where that time is still ahead
  function askArchive(s) {
    var future = (s.schedules || []).filter(function (sl) { return Date.parse(sl.start) > nowMs(); });
    var body = '<p class="an-modal__text">The stream is removed together with its run history and log. It can’t be brought back.</p>' +
      (future.length ? '<p class="an-modal__text">' + UI.plural(future.length, "upcoming run", "upcoming runs") + " will be canceled.</p>" : "") +
      '<p class="an-modal__text">The playlist and the files stay in the library.</p>';
    var m = modalShell("lvArch", "Delete this stream?", body,
      btn("Cancel", "secondary", 'data-lv-close data-lv-focus') + btn("Delete", "danger", 'data-lv-do="arch"'));
    m.querySelector('[data-lv-do="arch"]').onclick = function () { UI.closeModals(); doArchive(s); };
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
    if (k === "stopped" || k === "archived") return "Duplicate";
    return "Start now";
  }
  // Ближайшие по смыслу действия выносятся из «⋮» в строку: берём первые два
  // доступных в текущем состоянии, недоступные не показываем — им место в меню
  // с причиной блокировки (ADR-0002). Edit в строке не живёт: у каждой секции страницы своя правка.
  var QUICK = [
    { key: "duplicate", label: "Duplicate", act: "duplicate", icon: "copy", m: "startAgain" }
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
      { label: "Open", icon: IC.external, onClick: function () { location.href = ctxUrl(streamHref(s)); } },
      { label: running(s.status) ? "Stop" : "Start now",
        icon: running(s.status) ? IC.stop : IC.play,
        off: running(s.status) ? !!why("stop", s) : !!primaryOff,
        reason: running(s.status) ? why("stop", s) : primaryOff,
        act: b && b.act ? b.act : null,
        onClick: function () { running(s.status) ? askStop(s) : doStart(s); } },
      { label: "Edit destination", icon: IC.youtube, off: !!why("edit", s), reason: why("edit", s),
        onClick: function () {
          if (PAGE === "stream") { sectionOpen(s, "dest"); return; }
          location.href = ctxUrl("live-stream.html?id=" + encodeURIComponent(s.id) + "&edit=dest");
        } },
      { label: "Duplicate", icon: IC.copy, off: !!why("startAgain", s), reason: why("startAgain", s),
        onClick: function () { doDuplicate(s); } },
      { sep: true },
      { label: "Analytics", icon: IC.chart, off: !!why("analytics", s), reason: why("analytics", s),
        onClick: function () {
          if (PAGE !== "stream") { location.href = ctxUrl("live-stream.html?id=" + encodeURIComponent(s.id) + "#analytics"); return; }
          var el = document.querySelector("[data-lv-analytics]");
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        } },
      { label: "Open on YouTube", icon: IC.youtube,
        off: !s.dest.link, reason: !s.dest.link ? T.needLink : "",
        onClick: function () { UI.toast("The broadcast opens on YouTube."); } },
      { label: "Copy stream key", icon: IC.copy, onClick: function () { copyKey(s.id); } },
      { sep: true },
      { label: "Delete", icon: IC.trash, danger: true, off: !!why("archive", s), reason: why("archive", s),
        onClick: function () { askArchive(s); } }
    ];
    if (inDetail) {
      var prim = detailPrimaryLabel(s);
      var quick = detailQuick(s, prim).map(function (q) { return q.label; });
      items = items.filter(function (it) {
        return it.sep || (it.label !== "Open" && it.label !== prim && it.label !== "Copy stream key" && quick.indexOf(it.label) === -1);
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
    if (isUser()) { var bc = document.querySelector(".balance-chip"); if (bc) bc.remove(); }
    var w = document.querySelector("[data-lv-wallet]");
    if (w) w.textContent = a.kind === "hours" ? "≈" + UI.hours(a.creditHours) : UI.money(a.balance);
  }

  // ============================================================ Э1 · список
  var COLS = [
    { k: "stream",  label: "Stream",       w: "minmax(260px,2fr)", def: true, lock: true },
    { k: "status",  label: "Status",       w: "176px", def: true },
    { k: "dest", label: "Destination",     w: "minmax(160px,1fr)", def: true },
    { k: "author",  label: "Author",       w: "minmax(190px,1.2fr)", def: true, org: true },
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
  COLS = COLS.filter(function (c) { return !c.org || isMgr(); });
  function visCols() {
    var on = S.cols || COLS.filter(function (c) { return c.def; }).map(function (c) { return c.k; });
    return COLS.filter(function (c) { return on.indexOf(c.k) !== -1; });
  }
  function q() { var el = document.querySelector("[data-lv-q]"); return el ? el.value.trim().toLowerCase() : ""; }
  function hasFilters() { return !!(q() || S.filters.status.length || S.filters.dests.length || S.filters.authors.length); }
  function filtered() {
    var s = q();
    return vis().filter(function (x) {
      if (isMgr() && S.scope === "mine" && !mine(x)) return false;
      if (S.filters.authors.length && S.filters.authors.indexOf(x.authorId) === -1) return false;
      var k = stKey(x);
      if (k === "archived") return false;
      var g = stGroup(LIST_ST_GROUPS, k);
      if (S.filters.status.length && (!g || S.filters.status.indexOf(g.k) === -1)) return false;
      if (S.filters.dests.length && S.filters.dests.indexOf(destName(x)) === -1) return false;
      if (!s) return true;
      return x.name.toLowerCase().indexOf(s) !== -1 || destName(x).toLowerCase().indexOf(s) !== -1;
    }).sort(function (a, b) {
      // идущий эфир всегда выше остальных
      var w = function (x) { return stKey(x) === "live" ? 0 : 1; };
      return w(a) - w(b);
    });
  }

  function cellHtml(s, k) {
    var pl = content(s), c = cost(s);
    if (k === "stream") {
      return '<div class="ml-name">' + coverBox(coverOf(s)) +
        '<span class="ml-name__folder"><span class="ml-name__text">' + UI.esc(s.name) + (s.vr ? vrTag() : "") + "</span>" +
        '<span class="ml-name__meta">' + (pl ? UI.esc(pl.name) : "No playlist") + "</span></span></div>";
    }
    if (k === "status") {

      // причина остановки живёт в тултипе бейджа: вторая строка обрезалась и врала
      return stBadge(stKey(s), stopReason(s));
    }
    if (k === "dest") return destHtml(s);
    if (k === "author") return authorHtml(s.authorId);
    if (k === "next") {
      var sl = nextSlot(s);
      if (!sl) return '<span class="an-muted">Not scheduled</span>';
      var planned = (s.schedules || []).filter(function (x) { return Date.parse(x.end) > nowMs(); }).length;
      return '<span class="lv-next"><span>' + UI.dt(sl.start, TZ) + " (" + TZL + ")</span>" +
        (planned > 1 ? '<span class="lv-next__rep">' + planned + " times planned</span>" : "") + "</span>";
    }
    if (k === "cost") {
      // цена часа как в документации ($0.023), а не округлённая до двух знаков:
      // это тариф, а не сумма. Итоги и списания — всегда двумя знаками.
      return '<span class="lv-chan__col"><span>' + c.rateStr.replace(" / hour", "/h") + "</span></span>";
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
    if (!wrap) return;
    destFilterMount();   // у .ml-toolbar свой display, [hidden] его не перебивает
    var cols = visCols(), rows = filtered();
    var tpl = cols.map(function (c) { return c.w; }).join(" ");

    // баннер нулевого баланса: сам баланс живёт в кошельке топбара
    var a = acc();
    var banner = document.querySelector("[data-lv-banner]");
    if (banner) {
      var zero = a.kind === "money" && a.balance <= 0;
      banner.hidden = !zero;
      banner.innerHTML = zero
        ? '<span>' + (IC.attention || "") + "</span><span>" + (isUser() ? T.orgBalanceOut : T.paused) + "</span>" +
          (isUser() ? "" : '<span class="lv-banner__acts">' + btn(T.topUp, "primary", 'data-lv-topup') + "</span>")
        : "";
    }
    var cnt = document.querySelector("[data-lv-count]");
    if (cnt) cnt.textContent = rows.length + (rows.length === 1 ? " stream" : " streams");
    var scope = document.querySelector("[data-lv-scope]");
    if (scope) {
      scope.hidden = !isMgr();
      scope.innerHTML = isMgr() ? [["all", "All streams"], ["mine", "My streams"]].map(function (x) {
        var on = (S.scope || "all") === x[0];
        return '<button class="nc-seg__btn' + (on ? " is-active" : "") + '" type="button" data-lv-scopeset="' + x[0] + '"' +
          (on ? ' aria-current="true"' : "") + ">" + x[1] + "</button>";
      }).join("") : "";
    }

    var chips = document.querySelector("[data-lv-chips]");
    if (chips) {
      chips.innerHTML = S.filters.status.map(function (st) {
        return chip("Status: " + stGroupLabel(LIST_ST_GROUPS, st), 'data-lv-unchip="status:' + st + '"');
      }).join("") + S.filters.dests.map(function (id) {
        return chip("Destination: " + id, 'data-lv-unchip="dests:' + UI.esc(id) + '"');
      }).join("") + S.filters.authors.map(function (id) {
        return chip("Author: " + (authorName(id) || id), 'data-lv-unchip="authors:' + id + '"');
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
          : inOrg() && S.streams.length
          ? '<div class="an-blank"><span class="an-blank__ico"><svg><use href="#ic-stream"></use></svg></span>' +
            '<p class="an-blank__title">No streams of yours yet</p>' +
            '<p class="an-blank__text">Streams you create appear here.</p>' +
            '<div class="an-head__btns">' + btn("Schedule stream", "primary", 'data-lv-new="schedule"', IC.calendar) + btn("Quick stream", "secondary", 'data-lv-new="now"', IC.play) + "</div></div>"
          : '<div class="an-blank"><span class="an-blank__ico"><svg><use href="#ic-stream"></use></svg></span>' +
            '<p class="an-blank__title">No streams yet</p>' +
            // нулевой сценарий живёт внутри Live: в медиатеку отсюда не отправляем
            '<p class="an-blank__text">Put a playlist or a few videos on air around the clock.</p>' +
            '<div class="an-head__btns">' + btn("Schedule stream", "primary", 'data-lv-new="schedule"', IC.calendar) + btn("Quick stream", "secondary", 'data-lv-new="now"', IC.play) + "</div></div>";
      }
      return;
    }
    if (empty) { empty.hidden = true; empty.innerHTML = ""; }
    wrap.parentElement.hidden = false;
    var tbS2 = document.querySelector(".ml-toolbar");
    if (tbS2) tbS2.style.display = "";
    wrap.hidden = false;

    var totals = rows.reduce(function (t, s) {
      var m = s.metrics || {};
      t.spent += s.spentTotal || 0;
      t.views += m.views || 0; t.likes += m.likes || 0;
      t.comments += m.comments || 0; t.users += m.users || 0; t.rev += m.rev || 0;
      return t;
    }, { spent: 0, views: 0, likes: 0, comments: 0, users: 0, rev: 0 });
    var avg = S.listSum === "avg";
    var sum = function (k) { return avg ? totals[k] / rows.length : totals[k]; };
    var cnt = function (k) { return String(Math.round(sum(k))); };

    wrap.innerHTML = head(cols, tpl) +
      '<div class="an-tr an-tr--avg" style="grid-template-columns:' + tpl + '">' +
        cols.map(function (c) {
          var v = c.k === "stream"
              ? '<button class="an-collsel and-avg" type="button" data-lv-sel="listSum" aria-haspopup="listbox">' +
                  (avg ? "Averages" : "Totals") + (IC.chevDown || "") + "</button>"
            : c.k === "spent" ? UI.money(sum("spent"))
            : c.k === "views" ? cnt("views")
            : c.k === "likes" ? cnt("likes")
            : c.k === "comments" ? cnt("comments")
            : c.k === "users" ? cnt("users")
            : c.k === "rev" ? UI.money(sum("rev"))
            : c.k === "acts" ? ""
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
    pop.innerHTML = chkList("status") + (isMgr() ? chkList("authors") : "") +
      '<div class="lv-pop__foot">' + btn("Clear all", "secondary", "data-lv-clear") + "</div>";
    placePop(pop, anchor);
  }
  var MSOPEN = null;
  var MS_LABEL = { status: "Status", dests: "Destination", authors: "Author" };
  function msOptsFor(key) {
    if (key === "status") return LIST_ST_GROUPS.map(function (g) { return { value: g.k, label: g.label }; });
    if (key === "dests") return dests().map(function (nm) { return { value: nm, label: nm }; });
    return members().filter(function (p) { return streamAuthors().indexOf(p.id) !== -1; }).map(function (p) { return { value: p.id, label: p.name, muted: p.status === "removed" }; });
  }
  function chkList(key) {
    var sel = S.filters[key];
    return '<p class="lv-pop__t">' + MS_LABEL[key] + "</p>" +
      '<div class="lv-fchk" data-lv-ms="' + key + '" role="listbox" aria-multiselectable="true" aria-label="' + MS_LABEL[key] + '">' +
      msOptsFor(key).map(function (o) {
        var on = sel.indexOf(o.value) !== -1;
        return '<button class="anf-opt anf-opt--chk' + (on ? " is-selected" : "") + '" type="button" role="option" aria-selected="' + on + '" data-lv-msopt="' + UI.esc(o.value) + '">' +
          '<span class="anf-chk" aria-hidden="true">' + (IC.check || "") + '</span><span class="anf-opt__name' + (o.muted ? " an-muted" : "") + '">' + UI.esc(o.label) + "</span></button>";
      }).join("") + "</div>";
  }
  function msTrigInner(key) {
    var n = S.filters[key].length;
    return '<span class="anf-val' + (n ? "" : " is-ph") + '">' + MS_LABEL[key] + "</span>" +
      (n ? '<span class="an-collsel__qty">' + n + "</span>" : "") +
      '<span class="anf-chev">' + (IC.chevDown || "") + "</span>";
  }
  function msHtml(key) {
    var sel = S.filters[key];
    return '<div class="anf-select lv-ms" data-lv-ms="' + key + '">' +
      '<button class="anf-trig" type="button" data-lv-mstrig aria-haspopup="listbox" aria-expanded="false">' + msTrigInner(key) + "</button>" +
      '<div class="anf-menu" data-lv-msmenu hidden role="listbox" aria-multiselectable="true">' +
        '<div class="anf-search">' + (IC.search || "") + '<input type="text" placeholder="Search" data-lv-msq aria-label="Search ' + MS_LABEL[key].toLowerCase() + '" /></div>' +
        '<div class="anf-opts">' + msOptsFor(key).map(function (o) {
          var on = sel.indexOf(o.value) !== -1;
          return '<button class="anf-opt anf-opt--chk' + (on ? " is-selected" : "") + '" type="button" role="option" aria-selected="' + on + '" data-lv-msopt="' + UI.esc(o.value) + '">' +
            '<span class="anf-chk" aria-hidden="true">' + (IC.check || "") + '</span><span class="anf-opt__name">' + UI.esc(o.label) + "</span></button>";
        }).join("") + "</div></div></div>";
  }
  function msSync(key) {
    [].forEach.call(document.querySelectorAll('[data-lv-ms="' + key + '"] .anf-trig'), function (tr) { tr.innerHTML = msTrigInner(key); });
  }
  function msClose() {
    [].forEach.call(document.querySelectorAll("[data-lv-ms]"), function (w) {
      w.classList.remove("is-open");
      var m = w.querySelector("[data-lv-msmenu]"); if (m) m.hidden = true;
      var tr = w.querySelector(".anf-trig"); if (tr) tr.setAttribute("aria-expanded", "false");
    });
    MSOPEN = null;
  }
  function destFilterMount() {
    var fb = document.querySelector("[data-lv-filters]");
    if (!fb) return;
    var holder = document.querySelector("[data-lv-destf]");
    if (!holder) {
      holder = document.createElement("div");
      holder.className = "lv-destf";
      holder.setAttribute("data-lv-destf", "");
      fb.parentNode.insertBefore(holder, fb.nextSibling);
    }
    if (MSOPEN === "dests") { msSync("dests"); return; }
    holder.innerHTML = msHtml("dests");
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
    var acct = document.querySelector("[data-lv-acct]");
    if (acct) acct.setAttribute("aria-expanded", "false");
    calUnderlays(null);
  }
  function calUnderlays(occKey) {
    [].forEach.call(document.querySelectorAll(".lv-bar--long.is-shown"), function (b) { b.classList.remove("is-shown"); });
    if (occKey) [].forEach.call(document.querySelectorAll('.lv-bar--long[data-lv-occ="' + occKey + '"]'), function (b) { b.classList.add("is-shown"); });
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
        (sl ? box("Window", windowStr(sl, s)) : "");
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
        box(sl && !openWindow(s) ? "Window ends" : "Ends", sl && !openWindow(s) ? UI.until(sl.end, nowMs()).replace(/^in /, "")
          : loopsOf(s) ? loopsOf(s) + " loops"
          : untilOf(s) ? UI.time(untilOf(s), TZ)
          : s.playback.loop ? "Until stop" : "Queue ends") +
        box("Spent", UI.money(r ? r.spent : 0));
    } else if (k === "stopping") {
      inner = box("Stopping", "YouTube is ending the broadcast");
    } else if (k === "stopped") {
      var last = (s.runs || []).filter(function (x) { return x.start; })[0];
      inner = box("Reason", stopReason(s) || "Stopped") +
        box("Duration", last ? UI.durHuman(((last.end ? Date.parse(last.end) : nowMs()) - Date.parse(last.start)) / 1000) : "—") +
        box("Spent", UI.money(s.spentTotal));
    } else if (k === "archived") {
      // «Duplicate» стоит кнопкой рядом, повторять её словами незачем
      inner = box("Deleted", "Removed from the list");
    } else if (k === "needconv") {
      var rdc = readiness(content(s));
      inner = box("Conversion", rdc.label.replace("Needs conversion", "Needed").replace(" · ", " · ")) +
        box("Deleted on", UI.day(autoDeleteIso(s), TZ) + " unless converted");
    } else if (k === "converting") {
      inner = '<div class="lv-state__v">' + UI.esc(readiness(content(s)).text || "Conversion is running.") + "</div>";
    } else if (k === "convfail") {
      var bad = readiness(content(s)).files.length;
      inner = box("Conversion", (bad ? UI.plural(bad, "file", "files") : "Some files") + " failed") +
        box("Deleted on", UI.day(autoDeleteIso(s), TZ) + " unless converted");
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
      : manual && rd.state === "convert" ? btn("Prepare for streaming", "secondary", 'data-lv-act="prepare" data-tip="Converts the playlist files so the stream can start without delay."')
      : rd.state === "cant" ? btn("Show files", "secondary", 'data-lv-act="showbad"') : "";
    return '<span class="lv-ready lv-ready--' + cls + '" data-lv-ready>' + UI.esc(rd.text) + "</span>" + act;
  }

  // mode: "tech" — плейлист (разрешение и битрейт), "slim" — мастер (без размера файла:
  // суммарный вес виден в итогах под таблицей, а имени нужна ширина)
  function queueRows(s, pl, draftItems, mode, locked) {
    var tech = mode === "tech", view = mode === "view", slim = mode === "slim" || view;
    var lockWhy = typeof locked === "string" ? locked : T.liveEditPlaylist;
    var items = draftItems || (pl ? pl.items : []);
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
      if (!f || f.state === "failed" || (f.state === "missing" && mode !== "slim")) return "";
      num++;
      var isOnAir = idx === onAirIdx, isNext = onAirIdx !== -1 && idx === onAirIdx + 1;
      var badge = (slim ? "" : fileFmt(f)) + fileBadge(f, profileOf(pl));
      var fixed = isOnAir || solo || locked || view;
      return '<div class="lv-qr' + (solo ? " is-solo" : "") + (i.off ? " is-off-file" : "") +
          (isOnAir ? " is-onair" : "") + (isNext ? " is-next" : "") +
          (f.state === "missing" ? " is-missing" : "") + '" data-lv-row="' + i.fileId + '"' +
          (fixed ? ' data-lv-fixed="1"' : ' draggable="true"') + ">" +
        (solo ? "" :
          '<span class="lv-qr__i">' + (s.playback.shuffle ? "" : "#" + num) + "</span>" +
          (fixed ? '<span class="lv-qr__grip"></span>'
            : '<span class="lv-qr__grip">' + (IC.grip || "") + "</span>")) +
        coverBox(f.cover) +
        '<span class="lv-qr__n"><span class="lv-qr__nm">' + UI.esc(f.name) + "</span>" +
          (isOnAir ? '<span class="lv-qr__mark lv-qr__mark--onair">On air</span>'
            : isNext ? '<span class="lv-qr__mark lv-qr__mark--next">Up next</span>' : "") + "</span>" +
        '<span class="lv-qr__meta">' + (f.state === "missing" ? "—" : UI.dur(f.sec)) + "</span>" +
        (slim ? "" : '<span class="lv-qr__meta">' + (f.state === "missing" ? "—" : UI.bytes(f.bytes)) + "</span>") +
        '<span class="lv-qr__meta">' + fileRes(f) + (f.q && f.q.vr ? vrTag("VR 360") : "") + "</span>" +
        (tech ? '<span class="lv-qr__meta">' + fileRate(f) + "</span>" : "") +
        badge +
        (view ? "" :
          UI.switchHtml('data-lv-file="' + i.fileId + '"' +
            (locked ? ' data-tip="' + UI.esc(lockWhy) + '"' : isOnAir ? ' data-tip="' + T.onAir + '"' : ""), !i.off, "Include " + f.name, !!locked) +
          (locked
            ? '<button class="mc-more is-off" type="button" aria-disabled="true" data-tip="' + UI.esc(lockWhy) + '" aria-label="Actions for ' + UI.esc(f.name) + '">' + (IC.more || "⋮") + "</button>"
            : '<button class="mc-more" type="button" data-lv-fmenu="' + i.fileId + '" aria-label="Actions for ' + UI.esc(f.name) + '">' + (IC.more || "⋮") + "</button>")) +
        "</div>";
    }).join("");
  }

  function costBlock(s) {
    var c = cost(s), a = c.account, pl = content(s), st = plStats(pl);
    var loop = !!(s.playback && s.playback.loop), e = endOf(s);
    var headBig = a.kind === "hours"
      ? "Free credit · ≈" + UI.hours(a.creditHours) + " left"
      : loop || !st.sec ? c.rateStr : "≈" + UI.money(c.passCost);
    var sub = a.kind === "hours" ? "at " + c.rateStr
      : loop ? (st.sec ? "≈" + UI.money(c.passCost) + " per loop" : "≈" + UI.money(c.perDay) + " / day")
      : c.rateStr + (st.sec ? " · queue " + UI.dur(st.sec) : "");
    var noWin = !loop ? "One pass of the queue"
      : e.mode === "loops" ? UI.plural(e.loops, "loop", "loops") + (st.sec ? " · ≈" + UI.money(c.passCost * e.loops) : "")
      : e.mode === "until" ? "Until " + UI.dt(e.until, TZ).replace(",", "") + (c.untilH ? " · ≈" + UI.money(c.windowCost) : "")
      : "Runs until you stop it";
    var rows =
      kvRow("Spent this run", UI.money(runOf(s) ? runOf(s).spent : 0)) +
      kvRow("Spent all time", UI.money(s.spentTotal)) +
      kvRow(!c.windowH ? "No window" : openWindow(s) ? "One day on air" : "Window " + winLen(c.windowH),
            c.windowH ? "≈" + UI.money(c.windowCost) : noWin);
      // остаток в часах не строка карточки: баланс виден в топбаре, а нехватку
      // называет предупреждение ниже
    var warn = c.notEnough && !isUser()
      ? '<div class="lv-cost__warn">' + (IC.attention || "") +
        "<span>Balance covers ≈" + UI.hours(c.balHours) + " of the " + winLen(c.windowH) + " window.</span>" +
        btn(T.topUp, "primary", "data-lv-topup") + "</div>" : "";
    // заголовок не нужен: ставка крупной строкой сама говорит, о чём карточка
    return '<section class="rp-card">' +
      '<div class="lv-cost__head"><span class="lv-cost__big">' + headBig + "</span>" +
        '<span class="lv-cost__sub">' + sub + "</span></div>" +
      '<div class="lv-cost__rows lv-dots">' + rows + "</div>" + warn +
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
    reconnected: "warn", restart: "warn", error: "err", charged: "ok",
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
        '<span class="lv-card__info" tabindex="0" aria-label="About the numbers" data-tip="Audience numbers come from YouTube and refresh a few minutes behind the broadcast.">' + (IC.info || "") + "</span>" +
        '<span class="lv-card__sub">' + UI.plural(runs.length, "run", "runs") + " · " + UI.durHuman(airSec) + " on air</span>" +
        '<span class="lv-card__acts lv-card__acts--r">' +
          (S.ytLinked ? '<span class="ml-tag ml-tag--ok">Channel connected</span>' +
            '<button class="an-btn an-btn--secondary an-btn--tiny is-off" type="button" aria-disabled="true" data-tip="' + UI.esc(T.inert) + '">' +
              (IC.chart || "") + "View analytics</button>" : btn("Connect channel", "secondary", 'data-lv-connectyt data-tip="Connect the YouTube channel for extended analytics."', "", "tiny")) +
        "</span></div>" +
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
          ? '<span class="lv-card__acts lv-card__acts--r">' +
            '<label class="lv-pop__row" style="padding:0;gap:8px">Errors only' +
              UI.switchHtml("data-lv-errors", !!errorsOnly, "Errors only") + "</label></span>"
          : "") + "</div>" +
      '<div class="lv-log">' + (body || '<div class="an-blank"><p class="an-blank__text">' + blank + "</p></div>") + "</div></section>";
  }

  function renderDetail() {
    var host = document.querySelector("[data-lv-detail]");
    if (!host) return;
    var qp = new URLSearchParams(location.search);
    var s = stream(qp.get("id")) || vis()[0];
    if (s && !canSee(s)) {
      host.innerHTML = '<div class="an-blank"><p class="an-blank__title">' + T.noAccess + "</p>" +
        '<div class="an-head__btns">' + btn("Back to streams", "secondary", "data-an-back") + "</div></div>";
      return;
    }
    if (s && s.status === "draft") { location.replace(ctxUrl(streamHref(s))); return; }
    if (!s) {
      host.innerHTML = '<div class="an-blank"><p class="an-blank__title">Stream not found</p>' +
        '<div class="an-head__btns">' + btn("Back to streams", "secondary", 'data-an-back') + "</div></div>";
      return;
    }
    if (FORM && FORM.id !== s.id) FORM = null;
    if (FORM && FORM.ctx === "queue") queueEditorRender();
    document.title = s.name + " — SubSub";
    var pl = content(s), st = plStats(pl), rd = readiness(pl);
    var errorsOnly = host.getAttribute("data-lv-errors-only") === "1";
    var k0 = stKey(s);
    // страница идущего и поднимающегося стрима только читается: правки — после остановки (решение 03.09)
    var ro = running(s.status) || k0 === "preparing" || k0 === "starting" || k0 === "stopping";
    var editWhy = ro ? "" : why("edit", s);
    var edq = qp.get("edit");
    var focusDate = false;
    if ((edq === "time" || edq === "dest") && !FORM && !ro && !editWhy) {
      FORM = edq === "time" ? timeEditCtx(s, qp.get("time")) : formCtx(s, "dest");
      focusDate = edq === "time";
      history.replaceState(null, "", ctxUrl("live-stream.html?id=" + encodeURIComponent(s.id)));
    }
    var editing = function (k) { return !!(FORM && FORM.ctx === k && FORM.id === s.id); };
    var secFoot = function (k) {
      var g = sectionGate(k);
      return btn("Cancel", "secondary", "data-lv-seccancel") +
        '<button class="an-btn an-btn--primary an-btn--small' + (g ? " is-off" : "") + '" type="button" data-lv-secsave="' + k + '"' +
          (g ? ' aria-disabled="true" data-tip="' + UI.esc(g) + '"' : "") + ">Save</button>";
    };
    var b = startBlock(s);
    var primary = k0 === "live" || k0 === "preparing" || k0 === "stopping"
      ? { label: "Stop", mode: "danger", act: "stop", off: !!why("stop", s), reason: why("stop", s) }
      : k0 === "stopped" || k0 === "archived"
        ? { label: "Duplicate", mode: "primary", act: "duplicate", off: !!why("startAgain", s), reason: why("startAgain", s) }
        : { label: "Start now", mode: "primary", act: "start", off: !!(why("start", s) || (b && b.reason)),
            reason: why("start", s) || (b ? b.reason : ""), tipAct: b && b.act };
    var destLinked = '<span class="lv-chan">' + destAva(destName(s)) +
      '<span class="lv-chan__n">' + UI.esc(destName(s)) + "</span>" + extLinkBtn(s.dest.link) + "</span>";
    var dest = '<div class="lv-dsec lv-dsec--row' + (inOrg() ? " lv-dsec--pairs" : "") + '">' +
          (inOrg()
            ? '<span class="lv-dpair"><span class="lv-dpair__k">Destination</span>' + destLinked + "</span>" +
              '<span class="lv-dpair"><span class="lv-dpair__k">Author</span>' + authorText(s.authorId) + "</span>"
            : destLinked) +
        "</div>";
    var identity = coverBox(coverOf(s), "lv-dcover lv-dcover--big") +
        '<div class="lv-dsec">' +
          '<div class="lv-dtitle"><h1 class="lv-dtitle__n" data-lv-name>' + UI.esc(s.name) + "</h1>" + (s.vr ? vrTag() : "") + stBadge(k0) +
            (stopReason(s) ? '<span class="an-hint">' + UI.esc(stopReason(s)) + "</span>" : "") + "</div>" +
          dest +
          (s.desc ? '<p class="lv-ddesc">' + UI.esc(s.desc) + "</p>" : "") +
        "</div>";
    var qEdit = ro ? "" :
      '<button class="an-btn an-btn--secondary an-btn--tiny' + (editWhy ? " is-off" : "") + '" type="button" ' +
        (editWhy ? 'aria-disabled="true" data-tip="' + UI.esc(editWhy) + '"' : "data-lv-qedit") + ">" + (IC.edit || "") + "Edit queue</button>";
    var tAdd = ro || openWindow(s) ? "" : addTimeBtn((s.schedules || []).length, editWhy, 'data-lv-act="addtime"', "tiny");
    var nT = (s.schedules || []).length;

    host.innerHTML =
      '<a class="an-back" href="live-streams.html">' + (IC.chevLeft || "") + "Back to streams</a>" +
      // основная информация, действия, состояние и стоимость закреплены слева;
      // правая колонка с контентом, расписанием и логом скроллится
      '<div class="lv-dwrap"><aside class="lv-dside">' +
        identity + stateBar(s) +
        '<div class="lv-dacts lv-dacts--wrap">' +
          '<button class="an-btn an-btn--' + primary.mode + ' an-btn--small' + (primary.off ? " is-off" : "") + '" type="button" data-lv-act="' + primary.act + '"' +
            (primary.off ? ' aria-disabled="true" data-tip="' + UI.esc(primary.reason) + '"' + (primary.tipAct ? ' data-tip-act="' + primary.tipAct + '"' : "") : "") + ">" + primary.label + "</button>" +
          iconBtn("Copy stream key", IC.copy, 'data-lv-copykey="' + UI.esc(s.id) + '"', s.dest.key ? "" : T.noKey) +
          iconBtn("More actions", IC.more || "⋮", 'data-lv-menu-for="' + s.id + '"') +
        "</div>" +
        costBlock(s) +
      "</aside>" +
      '<div class="lv-dmain">' +
      '<section class="rp-card">' +
        '<div class="lv-card__h">' +
          '<h2 class="lv-card__t">' + (pl ? UI.esc(pl.name) : "No playlist") + "</h2>" +
          '<span class="lv-card__sub">' + st.count + (st.count === 1 ? " video · " : " videos · ") + UI.dur(st.sec) + " · " + UI.bytes(st.bytes) +
            (st.off ? " · " + st.off + " off" : "") + "</span>" +
          (qEdit ? '<span class="lv-card__acts lv-card__acts--r">' + qEdit + "</span>" : "") +
          '<span class="lv-card__acts">' + readyPanel(rd) +
            '<span class="lv-slot__tag">' + UI.esc(playLabel(s)) + "</span>" +
            '<span class="lv-slot__tag">' + (IC.shuffle || "") + (s.playback.shuffle ? "Shuffle on" : "Shuffle off") + "</span>" +
          "</span></div>" +
        '<div class="lv-card__b"><div class="lv-q is-view' + (s.playback.shuffle ? " is-shuffled" : "") + '" data-lv-queue>' + queueRows(s, pl, null, "view") + "</div></div>" +
      "</section>" +
      '<section class="rp-card" data-lv-times>' +
        '<div class="lv-card__h"><h2 class="lv-card__t">Scheduled runs</h2>' +
          '<span class="lv-card__sub">' + nT + (nT === 1 ? " time · " : " times · ") + TZ + " (" + TZL + ")</span>" +
          '<span class="lv-card__acts lv-card__acts--r">' + tAdd + btn("Open in calendar", "secondary", 'data-lv-act="calendar"', "", "tiny") + "</span></div>" +
        '<div class="lv-card__b">' + timesHtml(s, ro, editWhy) + "</div></section>" +
      analyticsCard(s) +
      logBlock(s, errorsOnly) +
      "</div></div>";
    if (editing("dest")) {
      modalShell("lvSecEdit", "Edit destination",
        '<div class="lv-form" data-lv-sec="dest">' + formDestGroup(T.destEditHint) + "</div>",
        secFoot("dest"), " lv-secmodal");
    } else secModalRemove();
    if (focusDate) focusSlotDate();
  }
  // Календарь открывается на дне окна и на канале стрима: человек попадает туда,
  // где окно видно, а не в текущую неделю чужого канала.
  function openCalendar(s, sl) {
    var date = sl ? partsIn(Date.parse(sl.start), TZ).date : partsIn(nowMs(), TZ).date;
    location.href = ctxUrl("live-calendar.html?date=" + encodeURIComponent(date) +
      (s ? "&dest=" + encodeURIComponent(destName(s)) : ""));
  }
  // конец окна с датой, если он в другой день: «21 Aug, 08:00 → 22 Aug, 08:00»
  function windowStr(sl, s) {
    if (openWindow(s)) return UI.dt(sl.start, TZ) + " → " + T.openEndVal.toLowerCase() + " (" + TZL + ")";
    var sameDay = UI.day(sl.start, TZ) === UI.day(sl.end, TZ);
    return UI.dt(sl.start, TZ) + " → " + (sameDay ? UI.time(sl.end, TZ) : UI.dt(sl.end, TZ)) + " (" + TZL + ")";
  }
  function cutLine(s, sl) {
    if (!s || !sl || (s.playback && s.playback.loop) || sl.unset) return "";
    var qs = plStats(content(s)).sec;
    if (!qs || qs * 1000 <= Date.parse(sl.end) - Date.parse(sl.start)) return "";
    return '<div class="lv-busyline lv-slot__warn">' + (IC.attention || "") +
      '<span class="an-hint an-hint--warn">The queue is longer than the window — the stream will be cut at ' + UI.time(sl.end, TZ) + ".</span></div>";
  }
  function busyLine(c) {
    return '<div class="lv-busyline lv-slot__warn">' + (IC.attention || "") +
      '<span class="an-hint an-hint--warn">' + UI.esc(c.msg) + "</span>" +
      (c.liveId ? '<a class="lv-link" href="live-stream.html?id=' + encodeURIComponent(c.liveId) + '">Open the stream</a>' : "") +
      "</div>";
  }
  function timesHtml(s, ro, editWhy) {
    var list = (s.schedules || []).slice().sort(function (a, b) { return Date.parse(a.start) - Date.parse(b.start); });
    var editing = !!(FORM && FORM.ctx === "time" && FORM.id === s.id);
    var rows = list.map(function (sl) {
      if (editing && FORM.timeId === sl.id) return timeEditRow(s);
      // уже сохранённое пересечение не скрывается: строка называет его, пока его не исправят
      var clash = channelBusy(Object.assign({}, s, { schedules: list.filter(function (x) { return x.id !== sl.id; }) }), sl);
      var pastSlot = Date.parse(sl.end) <= nowMs();
      var menuWhy = editWhy || (pastSlot ? T.pastRun : "");
      return '<div class="lv-slot' + (clash ? " lv-slot--conflict" : "") + '">' +
        '<span class="lv-slot__w"><span class="lv-slot__t">' + windowStr(sl, s) + "</span>" +
        "</span>" +
        '<span class="lv-slot__runs"><span class="lv-slot__m">' + (Date.parse(sl.start) <= nowMs() ? "Started" : "Starts") + "</span>" +
          '<span class="lv-slot__t">' + UI.until(sl.start, nowMs()) + "</span></span>" +
        (ro ? "" :
          '<button class="mc-more' + (menuWhy ? " is-off" : "") + '" type="button" ' +
            (menuWhy ? 'aria-disabled="true" data-tip="' + UI.esc(menuWhy) + '"' : 'data-lv-slotmenu="' + sl.id + '"') +
            ' aria-label="Time actions">' + (IC.more || "⋮") + "</button>") +
        cutLine(s, sl) +
        (clash ? busyLine(clash) : "") +
        "</div>";
    }).join("");
    if (editing && !FORM.timeId) rows += timeEditRow(s);
    if (!rows) return '<div class="an-blank"><p class="an-blank__text">No schedule yet — the stream runs until you stop it.</p></div>';
    return rows;
  }
  function timeEditRow(s) {
    var sl = FORM.schedules[0], ps = formPseudo();
    var busy = timeBusy(s);
    var eta = convEta(formQueuePl());
    var gate = sectionGate("time");
    return '<div class="lv-slot lv-slot--edit" data-lv-sec="time">' +
      '<div class="ai-grid lv-slot__row">' +
        field("Starts", dtField(sl, "start", ps)) +
        (formOpen() ? "" : field("Ends", dtField(sl, "end", ps))) +
        tzSelect(true) +
      "</div>" +
      (formEndWhy() ? '<span class="an-hint">' + UI.esc(formEndWhy() + " " + formEndFree()) + "</span>" : "") +
      cutLine(s, sl) +
      (eta ? '<div class="lv-busyline">' + (IC.attention || "") +
        '<span class="an-hint an-hint--warn">' + UI.esc(convEtaText(eta) +
          " The window can’t start before " + convEtaAt(eta, sl.start) + ".") + "</span></div>" : "") +
      (busy ? busyLine(busy) : "") +
      '<div class="lv-form__row">' + btn("Cancel", "secondary", "data-lv-seccancel") +
        '<button class="an-btn an-btn--primary an-btn--small' + (gate ? " is-off" : "") + '" type="button" data-lv-secsave="time"' +
          (gate ? ' aria-disabled="true" data-tip="' + UI.esc(gate) + '"' : "") + ">Save</button></div>" +
      "</div>";
  }


  // ============================================================ an-select: конфиги
  // Тригеры рисуются в разметке экранов, наборы опций собираются здесь по ключу.
  function selTrig(key, view, opts, arg) {
    return UI.selectHtml('data-lv-sel="' + key + '"' + (arg ? ' data-lv-selarg="' + UI.esc(arg) + '"' : ""), view, opts || {});
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
  function optByValue(list, v) {
    return list.filter(function (o) { return o.value === v; })[0] || null;
  }
  // key → конфиг попапа. Один обработчик на весь раздел.
  var SEL_CFG = {
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
    qplHead: function () {
      return { value: FORM.srcPl || "", options: plOpts(), label: "Playlist", search: "Search playlists",
        onPick: function (v) { formReplaceAsk(v); } };
    },
    listSum: function () {
      return { value: S.listSum === "avg" ? "avg" : "total", label: "Summary row", options: [
        { value: "total", label: "Totals" }, { value: "avg", label: "Averages" }
      ], onPick: function (v) { S.listSum = v; save(); renderList(); } };
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
    calDest: function () {
      var opts = calDests().map(function (nm) { return { value: nm, label: nm }; });
      if (opts.length > 1) { opts.push({ kind: "sep" }); opts.push({ value: "__all", label: "All destinations", sub: "Overview only" }); }
      return { value: calDest(), options: opts, label: "Destination", onPick: function (v) {
        CALV.dest = v; S.calDest = v; save(); renderCalendar();
      } };
    }
  };
  SEL_CFG.memberRole = function (id) {
    var p = person(id);
    return { value: p ? p.role : "user", label: "Role",
      options: ROLE_OPTS.map(function (o) {
        var blocked = lastOwner(p) && o.value !== "owner";
        return { value: o.value, label: o.label, off: blocked, reason: blocked ? T.needOwner : "" };
      }),
      onPick: function (v) { memberSetRole(p, v); } };
  };
  SEL_CFG.addRole = function () {
    return { value: ADD.role, label: "Role", options: ROLE_OPTS, onPick: function (v) {
      ADD.role = v;
      var inp = document.getElementById("lvMemEmail");
      if (inp) ADD.email = inp.value;
      memberAddAsk();
    } };
  };
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
  function plForeign(p) {
    var src = p && p.id ? playlist(p.id) || p : p;
    return isUser() && !!src && !!src.authorId && src.authorId !== CTX.me;
  }
  function usedTip(used) {
    return isMgr() && used.length
      ? ' tabindex="0" data-tip="' + UI.esc(used.map(function (s) { return s.name; }).join(", ")) + '"' : "";
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
      S.playlists.unshift(own(np2)); save();
      UI.toast("“" + name2 + "” saved as a playlist.");
      location.replace(ctxUrl("live-playlist.html?id=" + encodeURIComponent(np2.id)));
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
        '<div class="lv-plcard__rd">' + rdBadge(rd) + (inOrg() ? '<span class="lv-plcard__by">' + authorHtml(p.authorId) + "</span>" : "") + "</div>" +
        '<div class="lv-plcard__kv">' +
          // «3 of 4 videos» вместо «4 videos · 1 off»: одна величина вместо двух, строка не переносится
          "<span>" + (IC.film || "") + (st.off ? (st.total - st.off) + " of " + st.total + " videos"
            : st.total + (st.total === 1 ? " video" : " videos")) + "</span>" +
          "<span>" + (IC.clock || "") + UI.dur(st.sec) + "</span>" +
          "<span>" + (IC.save || "") + UI.bytes(st.bytes) + "</span>" +
        "</div>" +
        '<div class="lv-plcard__foot">' +
          (used.length
            ? '<span class="lv-next__more"' + usedTip(used) + ">" +
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
  var PL_RENAMING = false;
  function plRenameStart() {
    PL_RENAMING = true;
    renderPlEditor();
    var inp = document.querySelector("[data-lv-plrn]");
    if (inp) { inp.focus(); inp.select(); }
  }
  function plRenameEnd(commit) {
    if (!PL_RENAMING) return;
    var inp = document.querySelector("[data-lv-plrn]");
    var v = inp ? inp.value.trim() : "";
    PL_RENAMING = false;
    var pe = plTarget(), real = playlist(pe.id);
    if (commit && v && real && v !== real.name) {
      real.name = v; pe.name = v;
      real.updated = new Date(nowMs()).toISOString();
      save();
    }
    renderPlEditor();
  }
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
        detached: !!s.detached, custom: !s.srcPl, quick: !!s.quick,
        vr: !!s.vr, profile: resProfile(s.res || (s.quick ? resCap({ items: s.queue }).row : null) || (src && src.profile && src.profile.h),
          s.vert === true || s.vert === false ? s.vert : resCap({ items: s.queue }).vert, !!s.vr) };
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
      real.name = p.name;
      real.items = clone(p.items);
      real.updated = new Date(nowMs()).toISOString();
      PL_EDIT = null;
      plRecomputeStreams(real);
      save();
      UI.toast("Changes saved.");
      var backTo = plBackTo();
      if (backTo) { location.href = ctxUrl(backTo); return real; }
      render();
      return real;
    }
    p.id = "pl" + Date.now();
    p.updated = new Date(nowMs()).toISOString();
    S.playlists.unshift(own(p));
    PL_DRAFT = null;
    PL_EDIT = null;
    save();
    if (!silent) UI.toast("“" + p.name + "” saved.");
    history.replaceState(null, "", ctxUrl("live-playlist.html?id=" + encodeURIComponent(p.id)));
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
  var PL_LEAVE_KEY = "subsub_lv_pl_leave_skip";
  function plLeave(href) {
    var pe = PAGE === "playlist" ? plTarget() : null;
    if (pe && plDirtySaved(pe) && !UI.storeGet(PL_LEAVE_KEY, false)) { plLeaveAsk(pe, href); return; }
    if (!plDirty()) { location.href = ctxUrl(href); return; }
    var body = '<p class="an-modal__text">This playlist has ' +
      UI.plural(PL_DRAFT.items.length, "video", "videos") + " and hasn’t been saved yet.</p>";
    var m = modalShell("lvPlDiscard", "Discard this playlist?", body,
      btn("Keep editing", "secondary", "data-lv-close data-lv-focus") + btn("Discard", "danger", 'data-lv-do="pldiscard"'));
    m.querySelector('[data-lv-do="pldiscard"]').onclick = function () {
      PL_DRAFT = null; UI.closeModals(); location.href = ctxUrl(href);
    };
  }
  function plLeaveAsk(p, href) {
    var skipBtn = '<button class="lv-leave" type="button" data-lv-leaveskip aria-pressed="false">' +
      '<span class="an-check">' + (IC.check || "") + "</span><span>Don’t ask again</span></button>";
    var m = modalShell("lvPlLeave", "Leave without saving?",
      '<p class="an-modal__text">Your changes to “' + UI.esc(p.name) + "” will be lost if you leave without saving.</p>",
      skipBtn + btn("Cancel", "tertiary", "data-lv-close data-lv-focus") + btn("Leave", "secondary", 'data-lv-do="plleave"') +
      btn("Save and leave", "primary", 'data-lv-do="plsaveleave"'));
    var skip = m.querySelector("[data-lv-leaveskip]");
    skip.onclick = function () {
      var on = skip.getAttribute("aria-pressed") !== "true";
      skip.setAttribute("aria-pressed", on ? "true" : "false");
      skip.querySelector(".an-check").classList.toggle("is-checked", on);
    };
    var remember = function () { if (skip.getAttribute("aria-pressed") === "true") UI.storeSet(PL_LEAVE_KEY, true); };
    m.querySelector('[data-lv-do="plleave"]').onclick = function () {
      remember(); PL_EDIT = null; UI.closeModals(); location.href = ctxUrl(href);
    };
    m.querySelector('[data-lv-do="plsaveleave"]').onclick = function () {
      remember();
      var real = playlist(p.id);
      real.name = p.name;
      real.items = clone(p.items);
      real.updated = new Date(nowMs()).toISOString();
      PL_EDIT = null;
      plRecomputeStreams(real);
      save(); UI.closeModals(); location.href = ctxUrl(href);
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
            : PL_RENAMING
            ? '<input class="lv-dtitle__inp" type="text" value="' + UI.esc(p.name) + '" data-lv-plrn aria-label="Playlist name" />'
            : '<h1 class="lv-dtitle__n">' + UI.esc(p.name) + "</h1>" +
              '<button class="lv-dtitle__edit' + (plForeign(p) ? " is-off" : "") + '" type="button" ' +
                (plForeign(p) ? 'aria-disabled="true" data-tip="' + UI.esc(T.plForeign) + '"' : 'data-lv-plrename="' + p.id + '"') +
                ' aria-label="Rename playlist">' + (IC.pencil || "") + "</button>") +
          rdBadge(rd) +
          (live.length
            ? '<span class="ml-tag ml-tag--muted" tabindex="0" data-tip="Changes apply from the next run.">On air in ' +
              UI.plural(live.length, "stream", "streams") + "</span>"
            : "") +
          (draft ? '<span class="ml-tag ml-tag--muted">Not saved</span>'
            : dirty ? '<span class="ml-tag ml-tag--muted">Unsaved changes</span>'
            : '<span class="an-hint">All changes saved</span>') + "</div>" +
        '<div class="lv-dmeta"><span>' + st.count + (st.count === 1 ? " video" : " videos") + " · " + UI.dur(st.sec) + " · " + UI.bytes(st.bytes) +
          (st.off ? " · " + st.off + " off" : "") + "</span></div>" +
        '<div class="lv-dmeta">' + (inOrg() && !draft ? authorHtml((playlist(p.id) || p).authorId) : "") +
          '<span>' + (draft ? "Not saved yet" : used.length ? "Used in " + UI.plural(used.length, "stream", "streams") + (isUser() ? "" : ":") : "Not used in streams") + "</span>" +
          (!draft && used.length && !isUser()
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
            (plForeign(p) ? offBtn("Add video", "secondary", T.plForeign)
              : busyPl
              ? '<button class="an-btn an-btn--secondary an-btn--small is-off" type="button" aria-disabled="true" ' +
                'data-tip="Conversion is running — the content is locked.">Add video</button>'
              : btn("Add video", "secondary", 'data-lv-act="addvideo"')) + "</span></div>" +
        '<div class="lv-card__b"><div class="lv-q" data-lv-plqueue="' + (p.id || "draft") + '">' +
          (p.items.length ? queueRows(ghost, p, null, "tech", plForeign(p) ? T.plForeign : false)
            : '<div class="an-blank"><p class="an-blank__title">This playlist is empty</p>' +
              '<p class="an-blank__text">An empty playlist can’t be selected in a stream. Add at least one video.</p>' +
              '<div class="an-head__btns">' + (plForeign(p) ? offBtn("Add video", "primary", T.plForeign) : btn("Add video", "primary", 'data-lv-act="addvideo"')) + "</div></div>") +
        "</div></div></section>";
    var q = host.querySelector("[data-lv-plqueue]");
    if (q && !plForeign(p)) UI.dnd(q, function (order) { plReorder(p, order); });
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
        // в конвертацию идёт всё, что не совпадает с профилем цели: и другая ступень, и другая
        // ориентация или частота при той же ступени
        var stP = f ? fileState(f, profileOf(pl)) : "";
        if (f && f.q && (stP === "needconv" || (stP === "ready" && Math.min(f.q.w, f.q.h) !== sel))) {
          convStart(f, resProfile(sel, false)); n++;
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
    var foreign = plForeign(p);
    UI.menu(anchor, [
      { label: "Duplicate", icon: IC.copy, onClick: function () {
        var copy = clone(playlist(p.id));
        copy.id = "pl" + Date.now();
        copy.name = p.name + " (copy)";
        copy.updated = new Date(nowMs()).toISOString();
        S.playlists.unshift(own(copy)); save();
        UI.toast("“" + copy.name + "” created.");
      } },
      { label: "Prepare for streaming", icon: IC.restart,
        // часть файлов может быть нелечимой — остальные это конвертировать не мешает
        off: foreign || busyPl || !prepAny(p),
        reason: foreign ? T.plForeign : busyPl ? busyWhy : !prepAny(p) ? "Nothing to convert in this playlist." : "",
        onClick: function () { askPrepare(playlist(p.id) || p); } },
      { label: "Clear all", icon: IC.restart, off: foreign || busyPl, reason: foreign ? T.plForeign : busyWhy,
        onClick: function () { plClearAllAsk(p); } },
      { sep: true },
      { label: "Delete", icon: IC.trash, danger: true,
        off: foreign || busyPl || !!live.length,
        reason: foreign ? T.plForeign : busyPl ? busyWhy : live.length ? "The playlist is on air — stop the stream first." : "",
        onClick: function () { plDelete(playlist(p.id)); } }
    ]);
  }
  function plMenu(p, anchor) {
    var used = usedBy(p.id);
    var live = used.filter(function (s) { return running(s.status); });
    UI.menu(anchor, [
      { label: "Edit", icon: IC.edit, off: plForeign(p), reason: plForeign(p) ? T.plForeign : "",
        onClick: function () { location.href = ctxUrl("live-playlist.html?id=" + encodeURIComponent(p.id)); } },
      { label: "Duplicate", icon: IC.copy, onClick: function () {
        var copy = clone(p);
        copy.id = "pl" + Date.now();
        copy.name = p.name + " (copy)";
        copy.updated = new Date(nowMs()).toISOString();
        S.playlists.unshift(own(copy)); save(); render();
        UI.toast("“" + copy.name + "” created.");
      } },
      { label: "Start stream", icon: IC.play,
        off: !p.items.filter(function (i) { return !i.off; }).length,
        reason: T.needVideo,
        onClick: function () { plStart(p); } },
      { label: "Convert playlist", icon: IC.restart,
        off: plForeign(p) || readiness(p).state === "busy" || !prepAny(p),
        reason: plForeign(p) ? T.plForeign : readiness(p).state === "busy" ? "Conversion is running — the content is locked." : !prepAny(p) ? "Nothing to convert in this playlist." : "",
        onClick: function () { askPrepare(p); } },
      { label: "Rename", icon: IC.pencil, off: plForeign(p), reason: plForeign(p) ? T.plForeign : "", onClick: function () { plRename(p); } },
      { sep: true },
      { label: "Delete", icon: IC.trash, danger: true,
        off: plForeign(p) || !!live.length,
        reason: plForeign(p) ? T.plForeign : live.length ? "This playlist is on air — stop the stream first." : "",
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
        " will move to Draft" + (isUser() ? "" : ": " + UI.esc(used.map(function (s) { return s.name; }).join(", "))) +
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
      if (new URLSearchParams(location.search).get("id")) { location.href = ctxUrl("live-playlists.html"); return; }
      render();
    };
  }
  // Стрим из плейлиста: имя НЕ наследуется, оно только предлагается в поле формы.
  function plStart(p) {
    if (!p.items.filter(function (i) { return !i.off; }).length) { UI.toast(T.emptyPl); return; }
    location.href = ctxUrl("live-stream-create.html?playlist=" + encodeURIComponent(p.id));
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
    return !!(formQueue().length || (FORM.name || "").trim() ||
      (FORM.key || "").trim() || (FORM.link || "").trim());
  }
  function formSaveDraft() {
    var s = FORM.id ? stream(FORM.id) : null;
    if (!s || s.status !== "draft") {
      s = { id: "s" + Date.now(), runs: [], spentTotal: 0, metrics: {}, schedules: [] };
      S.streams.unshift(own(s));
    }
    s.status = "draft"; s.virtual_status = null;
    s.name = formName().trim() || FORM.nameSuggest || "Untitled stream";
    s.dest = { name: (s.dest && s.dest.name) || null, key: (FORM.key || "").trim(), link: (FORM.link || "").trim() };
    s.queue = clone(formQueue()); s.srcPl = FORM.srcPl || null; s.detached = !!FORM.detached;
    s.playback = formPlayback();
    s.res = formRes() || null; s.vert = formVert(); s.vr = formVr();
    s.draftForm = clone(FORM); s.draftStep = WZ.step; s.draftMax = WZ.max;
    save();
    UI.toast("“" + s.name + "” saved as a draft.");
    return s;
  }
  // Уход из мастера: правка существующего стрима уходит молча, как и раньше; недособранный
  // новый стрим или открытый черновик — спрашиваем, оставить ли его черновиком (Э9, диалог 13)
  function formLeave(href, exact) {
    var cur = FORM && FORM.id ? stream(FORM.id) : null;
    var reopened = !!(cur && cur.status === "draft");
    var existing = !!(cur && !reopened);
    var to = existing || exact ? href : "live-streams.html";
    if (existing || !formDirty()) { location.href = ctxUrl(to); return; }
    if (FORM.quick) { UI.storeDel(FORM_DRAFT_KEY); location.href = ctxUrl(to); return; }
    var body = '<p class="an-modal__text">' + (reopened
      ? "The draft keeps what you had before this visit unless you save it again."
      : UI.plural(plStats(formQueuePl()).count, "video", "videos") + " and the settings you’ve filled in can stay as a draft — it shows in the list with a <b>Draft</b> badge and opens here again.") + "</p>";
    var m = modalShell("lvLeave", reopened ? "Leave the draft?" : "Leave the setup?", body,
      btn("Keep editing", "secondary", "data-lv-close data-lv-focus") +
      btn(reopened ? "Discard changes" : "Discard", "danger", 'data-lv-do="leavediscard"') +
      btn(reopened ? "Save draft" : "Save as draft", "primary", 'data-lv-do="leavedraft"'));
    m.querySelector('[data-lv-do="leavedraft"]').onclick = function () {
      UI.closeModals(); UI.storeDel(FORM_DRAFT_KEY); formSaveDraft(); location.href = ctxUrl(to);
    };
    m.querySelector('[data-lv-do="leavediscard"]').onclick = function () {
      UI.closeModals(); UI.storeDel(FORM_DRAFT_KEY); location.href = ctxUrl(to);
    };
  }
  // Ссылки шелла (сайдбар, сабменю, шапка) уводят из мастера так же, как «Back»: недособранный
  // новый стрим или открытый черновик получают тот же вопрос, а после ответа — исходный адрес ссылки.
  document.addEventListener("click", function (e) {
    if (PAGE !== "form" || !FORM || e.defaultPrevented) return;
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a || a.closest("[data-lv-form]") || a.closest(".an-modal") || a.closest(".is-off") || a.getAttribute("aria-disabled")) return;
    var href = a.getAttribute("href");
    if (!href || href.charAt(0) === "#" || a.target === "_blank") return;
    var cur = FORM.id ? stream(FORM.id) : null;
    if ((cur && cur.status !== "draft") || !formDirty() || FORM.quick) return;
    e.preventDefault();
    formLeave(href, true);
  }, true);
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
      WZ.step = Math.min(WZ_STEPS.length, s.draftStep || 1);
      WZ.max = Math.min(WZ_STEPS.length, Math.max(WZ.max, s.draftMax || WZ.step));
      return;
    }
    // маршрут правки снят: ссылка на мастер с сохранённым стримом ведёт на его страницу
    if (s) { location.replace(ctxUrl("live-stream.html?id=" + encodeURIComponent(s.id))); return false; }
      FORM = {
        id: null, name: "", key: "", link: "",
        queue: [], srcPl: null, detached: false, loop: true, shuffle: false,
        res: null,
        cover: null, desc: "",
        startMode: "schedule", schedules: [], endMode: "none", loopLimit: 0, untilSlot: null, tz: TZ,
        autoStart: true
      };
      formAddSlot();
      var qp = new URLSearchParams(location.search);
      if (qp.get("mode") === "now") { FORM.startMode = "now"; FORM.quick = true; }
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
      if (qp.get("start")) {
        FORM.startMode = "schedule";
        FORM.schedPreset = true;
        var qs0 = Date.parse(qp.get("start"));
        FORM.schedules = [{ id: "sl" + Date.now(), start: new Date(qs0).toISOString(),
          end: qp.get("end") || new Date(qs0 + 2 * 3600e3).toISOString(), tz: TZ, endSet: !!qp.get("end") }];
      }
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
  // то же содержимое, но из состояния формы: черновик нового плейлиста, готовый плейлист или файл
  function formPl() { return formQueue().length ? formQueuePl() : null; }
  function formPseudo() {
    return {
      id: FORM.id || "form", name: FORM.name, vr: formVr(),
      dest: { key: FORM.key, link: FORM.link },
      queue: formQueue(), srcPl: FORM.srcPl, detached: !!FORM.detached,
      playlistId: null, fileId: null,
      cover: FORM.cover ? { src: FORM.cover, uploaded: true } : null,
      res: formRes() || null, vert: formVert(),
      playback: formPlayback(),
      status: "created", schedules: FORM.startMode === "schedule" ? FORM.schedules : [],
      spentTotal: 0, metrics: {}, runs: []
    };
  }
  // чего не хватает для отправки — одна причина на смысл
  function formBlock() {
    var a = acc();
    if (!formName().trim()) return { reason: "Paste the stream link to continue" };
    if (!FORM.key.trim()) return { reason: T.needKey };
    var kbf = keyBusy(FORM.key, FORM.id);
    if (kbf) return { reason: kbf.msg };
    if (formMissing()) return { reason: T.filesGone };
    var pl = formPl();
    if (!pl) return { reason: T.needVideo };
    var rdf = readiness(pl);
    if (rdf.state === "none") return { reason: T.readyNone };
    if (rdf.state === "cant" || rdf.state === "convfail") return { reason: rdf.text };
    if (FORM.startMode === "schedule" && !FORM.schedules.length) return { reason: "Add at least one time or switch to Quick stream" };
    if (FORM.startMode === "schedule") {
      var ps2 = formPseudo();
      for (var bi = 0; bi < FORM.schedules.length; bi++) {
        var busy2 = channelBusy(ps2, FORM.schedules[bi]);
        if (busy2) return { reason: busy2.msg };
      }
    }
    // нулевой баланс мешает запуску, но не созданию: расписание сохранить можно
    if (FORM.startMode === "now" && formAutoStart() && a.kind === "money" && a.balance <= 0) return balanceBlock();
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
  function formName() {
    return nameFromLink(FORM.link);
  }

  function tzSelect(spacer) {
    return '<div class="ai-field lv-ftz">' + (spacer ? '<label class="ai-lbl">Time zone</label>' : "") +
      selTrig("tz", UI.selectValue({ label: tzOffLabel(FORM.tz) }), { label: "Time zone" }) + "</div>";
  }
  function field(label, inner, hint) {
    return '<div class="ai-field"><label class="ai-lbl">' + label + "</label>" + inner +
      (hint ? '<span class="an-hint">' + hint + "</span>" : "") + "</div>";
  }
  // ---- Вариант «степпер»: слева карта шагов, справа текущий шаг с собственным
  // заголовком и кнопкой продолжения. Состояние шага живёт в памяти страницы.
  var WZ = { step: 1, max: 1 };
  var MAX_SLOTS = 10;
  var PL_LIMIT = 500 * 1024 * 1024 * 1024;
  function itemsBytes(items) {
    return (items || []).filter(inSet).reduce(function (a, i) { var f = file(i.fileId); return a + ((f && f.bytes) || 0); }, 0);
  }
  function fitLimit(items, ids) {
    var used = itemsBytes(items), ok = [], over = [];
    ids.forEach(function (id) {
      var f = file(id), b = (f && f.bytes) || 0;
      if (used + b > PL_LIMIT) over.push(id); else { ok.push(id); used += b; }
    });
    return { ok: ok, over: over };
  }
  // Порядок 16.09: контент первым, назначение и время одним шагом — назначение решает, какие поля
  // ниже существуют, а проверка пересечений читает ключ, поэтому он должен быть известен до времени
  var WZ_STEPS = [
    { k: "content", t: "Content", d: "Queue, order and playback.", ic: "video",
      h: "Choose what goes on air.", lead: "Pick a playlist, add files from the library or upload your own, then set how they play." },
    { k: "details", t: "Details", d: "Destination, name and time.", ic: "pencil",
      h: "Where it goes and when it runs.", lead: "Choose the destination, name the stream and set when it runs." },
    { k: "review", t: "Review & launch", d: "Check and create.", ic: "wallet",
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
  function formVr() {
    return anyVr(formQueue());
  }
  function formProfile() { return resProfile(formRes(), formVert(), formVr()); }
  // ориентация не выбирается: она та, что у большинства файлов очереди
  function formVert() { return resCap({ items: formQueue() }).vert; }
  // цель не может быть выше потолка очереди: при добавлении меньшего файла она опускается
  var RES_DEFAULT = 1080;
  function formRes() {
    // Пока человек не трогал выбор, цель следует за контентом: максимум, который
    // позволяет очередь, а на пустой очереди — 1080p. Тронул — держим его выбор:
    // файл ниже цели честно помечается «не выровнять».
    var cap = resCap({ items: formQueue() }).row;
    var floor = formVr() ? 2560 : 0;
    if (FORM.resTouched && RES_DIM[FORM.res] && FORM.res >= floor) return FORM.res;
    return Math.max(cap || RES_DEFAULT, floor);
  }
  function formQueuePl() {
    var src = formSrcPl();
    return { id: FORM.srcPl && !FORM.detached ? FORM.srcPl : null, srcId: FORM.srcPl || null,
      name: src ? src.name : "Custom queue", items: formQueue(), vr: formVr(),
      detached: !!FORM.detached, custom: !FORM.srcPl, profile: formProfile() };
  }
  function formMissing() {
    return formQueue().filter(function (i) { var f = file(i.fileId); return !i.off && (!f || f.state === "missing"); }).length;
  }
  function formAddedCount() {
    var src = formSrcPl();
    if (!src || !FORM.detached) return 0;
    var own = src.items.map(function (i) { return i.fileId; });
    return formQueue().filter(function (i) { return own.indexOf(i.fileId) === -1; }).length;
  }
  function formReplaceAsk(id) {
    var n = formAddedCount();
    if (!n) { formPickPlaylist(id); renderForm(); return; }
    var m = modalShell("lvPlReplace", "Replace the playlist?",
      '<p class="an-modal__text">' + UI.plural(n, "file", "files") + " you added on top will be removed from the queue.</p>",
      btn("Cancel", "secondary", "data-lv-close data-lv-focus") + btn("Replace", "primary", 'data-lv-do="plreplace"'));
    m.querySelector('[data-lv-do="plreplace"]').onclick = function () {
      UI.closeModals();
      formPickPlaylist(id);
      renderForm();
    };
  }
  function formPickPlaylist(id) {
    var p = playlist(id);
    if (!p) return;
    // берём максимум, который очередь позволяет: выше — апскейл, его не бывает
    var capP = resCap(p).row;
    if (capP) FORM.res = capP;
    FORM.queue = clone(p.items);          // копия: источник не разделяется со стримом
    FORM.srcPl = id; FORM.detached = false; FORM.limitErr = false;
    FORM.nameSuggest = p.name;
  }

  // чего не хватает на шаге: тултип кнопки повторяет строку готовности дословно
  // Клик по заблокированной кнопке не только повторяет причину тултипом, но и метит
  // незаполненные поля. Метка снимается при первом же вводе.
  var INV_KEYS = { "Stream link": "link", "Stream key": "key" };
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
    if (k === "details") {
      if (!FORM.link.trim()) out.push("Stream link");
      if (!FORM.key.trim()) out.push("Stream key");
      if (FORM.startMode === "schedule" && !FORM.schedules.length) out.push("Time");
    }
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
    if (k === "details" && FORM.startMode === "schedule") {
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
      var lc = listClash(ps, FORM.schedules);
      if (lc) return lc.msg;
      var horizon = slotBeyondHorizon(FORM.schedules);
      if (horizon) return horizon;
    }
    if (k === "details") {
      var kbd = keyBusy(FORM.key, FORM.id);
      if (kbd) return kbd.msg;
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
    if (k === "details") {
      var dest = FORM.key ? channelOf(FORM.link, FORM.key, FORM.id) || "Stream key" : "";
      if (!dest) return "";
      var sl = FORM.schedules[0];
      var when = FORM.startMode === "now" ? nowStartLabel() : sl ? UI.dt(sl.start, FORM.tz).replace(",", "") : "";
      return dest + (when ? " · " + when : "");
    }
    return "";
  }
  // read-only полоса под шагами: то, что в одностраничной раскладке жило липкой сводкой
  function wizStrip() {
    var pl = formQueuePl(), st = plStats(pl), c = cost(formPseudo());
    var rd = readiness(pl);
    var unknown = queueUnknown(pl) || !st.sec;
    var picked = FORM.startMode === "now" || WZ.max >= 2 || !!FORM.schedPreset;
    var runs = FORM.startMode === "schedule" ? next3All() : [];
    var win0 = FORM.startMode === "schedule" && !formOpen() ? c.windowH : 0;
    var perWin = win0 && st.sec ? Math.max(1, Math.floor(win0 * 3600 / st.sec)) : 0;
    if (FORM.loop && formEndRuns() > 0 && perWin) perWin = Math.min(formEndRuns(), perWin);
    var cyc = unknown || !picked ? "—"
      : UI.dur(st.sec) + (perWin ? " · " + UI.plural(FORM.loop ? perWin : 1, "run", "runs") : "");
    var next = !picked ? "—" : FORM.startMode === "now" ? (!formAutoStart() ? "When you press Start" : formConvWait() ? "After conversion" : "Right after creation")
      : runs.length ? UI.dt(runs[0].start, FORM.tz) : "—";
    var win = FORM.startMode === "schedule" ? c.windowH : 0;
    var cstK = FORM.loop ? "Price per hour" : win ? "Window cost" : "Stream cost";
    var cst = FORM.loop ? c.rateStr : unknown ? "—" : "≈" + UI.money(win ? c.windowCost : st.sec / 3600 * c.rate);
    return '<div class="lv-wiz__strip">' +
      '<div class="lv-wiz__srow"><span>Cycle</span><b>' + cyc + "</b></div>" +
      '<div class="lv-wiz__srow"><span>Next run</span><b>' + next + "</b></div>" +
      '<div class="lv-wiz__srow"><span>' + cstK + "</span><b>" + cst + "</b></div>" +
      "</div>";
  }

  // Загрузка в очередь: прогресс идёт сам, затем чтение метаданных, затем вердикт профиля.
  // Файл появляется в медиатеке — очередь ссылается на него, а не хранит копию.
  var UPL_N = 0;
  // выбранные в системном диалоге файлы: имя и размер настоящие, дальше идёт демо-прогресс
  function formQueueUpload(picked) {
    var list = picked && picked.length ? [].slice.call(picked) : [null];
    var skipped = 0, added = 0, over = 0, used = itemsBytes(formQueue());
    list.forEach(function (real) {
      if (real && String(real.type || "").indexOf("video/") !== 0) { skipped++; return; }
      UPL_N++; added++;
      var id = "up" + Date.now() + UPL_N;
      var f = { id: id, name: real ? real.name : "My Upload " + UPL_N + ".mp4",
        sec: 0, bytes: real ? real.size : 620 * 1024 * 1024,
        container: "mp4", state: "uploading", progress: 0, q: null, folderId: null, cover: null };
      F.files.push(f);
      if (DEMO) { S.extraFiles = S.extraFiles || []; S.extraFiles.push(f); save(); }
      if (used + f.bytes > PL_LIMIT) over++; else { used += f.bytes; FORM.queue.push({ fileId: id, off: false }); }
      formQueueTick(f);
    });
    if (!added) { UI.toast("Videos only — that file was skipped."); return; }
    FORM.limitErr = over > 0;
    formDetach();
    renderForm();
    if (over) { UI.toast(T.plLimit); return; }
    UI.toast(skipped ? "Upload started — " + UI.plural(skipped, "file", "files") + " skipped, videos only." : "Upload started.");
  }
  // Конвертация в прототипе действительно идёт: прогресс растёт по таймеру, в конце файл получает
  // профиль цели (кадр, частота, кодеки, звук, битрейт в норме) и становится Ready. Результат
  // хранится в состоянии, чтобы пережить перезагрузку. Пока файл конвертируется, страница
  // перерисовывается, но не под руками у человека: с фокусом в поле ввода перерисовки нет.
  var CONV_T = {}, CONV_MS = 6000;
  function convStart(f, prof) {
    if (!f || CONV_T[f.id]) return;
    f.state = "converting"; f.progress = 0;
    // прогресс считается от реального времени, а не от числа тиков: в фоновой вкладке таймеры душат
    var startedAt = Date.now();
    CONV_T[f.id] = setInterval(function () {
      f.progress = Math.min(100, Math.round((Date.now() - startedAt) / CONV_MS * 100));
      if (f.progress >= 100) { clearInterval(CONV_T[f.id]); delete CONV_T[f.id]; convDone(f, prof); }
      convRedraw();
    }, 500);
  }
  function convDone(f, prof) {
    var rng = rateRangeFor(prof.row || resRow(prof.h, prof.w), fpsCol(prof.fps), prof.vert);
    f.q = Object.assign({}, f.q || {}, { w: prof.w, h: prof.h, fps: prof.fps, vcodec: prof.vcodec,
      acodec: prof.acodec, ac: prof.ac, ar: prof.ar, audio: prof.audio });
    if (rng && f.sec) f.bytes = Math.round((rng[0] + rng[1]) / 2 * 1e6 / 8 * f.sec);
    f.state = "ready"; delete f.progress;
    S.conv = S.conv || {}; S.conv[f.id] = { q: f.q, bytes: f.bytes }; save();
  }
  // разметка пикера лежит в странице всегда, поэтому «пикер открыт» проверяется по видимости модалки
  function pickerOpen() { var pk = document.getElementById("lvPicker"); return !!(PICK && pk && getComputedStyle(pk).display !== "none"); }
  function convRedraw() {
    var a = document.activeElement;
    if (a && /^(INPUT|TEXTAREA)$/.test(a.tagName)) return;
    if (pickerOpen()) { pickRender(); return; }
    render();
  }
  // прогресс загрузки видно там, где человек сейчас: в открытом пикере или в очереди мастера
  function uploadRedraw() {
    if (pickerOpen()) { pickRender(); return; }
    if (FORM) renderForm();
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
      S.playlists.unshift(own(np));
      FORM.srcPl = np.id; FORM.detached = false;
      save(); UI.closeModals(); renderForm();
      UI.toast("“" + name + "” saved.");
    };
  }

  // ================= шаг 1 · Content =================
  function wizContent(quick) {
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
            '<span class="an-collsel-wrap lv-qpl"><button class="an-collsel" type="button" data-lv-sel="qplHead" aria-haspopup="listbox">' +
              '<span class="an-collsel__txt">' + UI.esc(src ? src.name : "Custom queue") + "</span>" + (IC.chevDown || "") + "</button></span>" +
            (FORM.detached && src ? '<span class="ml-tag ml-tag--brand" data-tip="The queue no longer matches “' + UI.esc(src.name) + '”." tabindex="0">Playlist detached</span>' +
              '<button class="lv-link" type="button" data-lv-qreset data-tip="Bring the queue back to “' + UI.esc(src.name) + '”.">Reset queue</button>' : "") +
            // сохранять нечего, пока очередь совпадает со своим плейлистом
            (!FORM.srcPl || FORM.detached
              ? '<button class="lv-link" type="button" data-lv-qsave>Save as playlist</button>' : "") +
            // шафл живёт в шапке очереди рядом с её именем: это свойство порядка, а не воспроизведения
            (q.length > 2
              ? '<label class="lv-pick__only lv-qhead__shuffle" data-tip="Shuffle reorders the queue on every loop, not just once."><span>Shuffle</span>' + UI.switchHtml('data-lv-f="shuffle"', FORM.shuffle, "Shuffle") + "</label>"
              : "") +
          "</span>" +
          // в шапке очереди подписи короткие: рядом стоят имя, ссылка и шафл, а строка одна
          '<span class="lv-qhead__acts">' +
            btn("Library", "secondary", "data-lv-qadd", IC.folder, "tiny") +
            btn("Upload video", "secondary", "data-lv-qupload", IC.upload, "tiny") +
            btn("Clear", "secondary", "data-lv-qclear", IC.trash, "tiny") +
          "</span></div>" +
        ""
      : "";
    var aggregate = q.length && rd.state !== "ready"
      ? '<div class="lv-sum__rd lv-sum__rd--' + (rd.state === "convert" || rd.state === "uploading" || rd.state === "processing" ? "warn" : "bad") +
        '" data-lv-ready>' + (IC.attention || "") + "<span>" + UI.esc(rd.text) + "</span>" +
        "</div>"
      : "";
    // три входа наполнения: пока очередь пуста они стоят рядом, потом живут в шапке
    // пока очередь пуста, вся область наполнения принимает файлы перетаскиванием
    var inputs = q.length ? "" : quick
      ? '<div class="lv-qdrop lv-qempty" data-lv-qdrop>' +
          '<span class="an-blank__ico">' + (IC.film || "") + "</span>" +
          '<p class="an-blank__title">No videos</p>' +
          '<p class="an-blank__text">Build a broadcast queue by selecting a single video or a full playlist to stream in a continuous sequence.</p>' +
          '<div class="lv-qempty__acts">' +
            btn("Upload video", "secondary", "data-lv-qupload", IC.upload) +
            btn("Add from library", "secondary", "data-lv-qadd", IC.folder) +
            (S.playlists.length ? selTrig("qpl", UI.selectValue(null, "Pick a playlist"), { label: "Playlist" }) : "") +
          "</div>" +
          '<span class="an-hint">Or drag and drop video files here.</span>' +
        "</div>"
      : '<div class="lv-qdrop" data-lv-qdrop><div class="lv-qsources">' +
        field("Pick a playlist", S.playlists.length
          ? selTrig("qpl", UI.selectValue(null, "Select playlist"), { label: "Playlist" })
          // плейлистов ещё нет — селектор виден, но заблокирован с причиной (ADR-0002)
          : '<span class="is-off" aria-disabled="true" data-tip="No playlists yet." tabindex="0">' +
            selTrig("qpl", UI.selectValue(null, "Select playlist"), { label: "Playlist" }) + "</span>") +
        '<div class="ai-field lv-field--btn">' +
          btn("Add from library", "secondary", "data-lv-qadd", IC.folder, "tiny") +
          btn("Upload video", "secondary", "data-lv-qupload", IC.upload, "tiny") + "</div>" +
      '</div><p class="an-hint">' + T.needVideo + "</p></div>";
    var pseudo = formPseudo();
    // Цель эфира: разрешение выбирает человек, частота приходит из файлов, битрейт —
    // из матрицы. Все бейджи в очереди считаются от этой ячейки.
    var pl0 = formQueuePl(), cap = resCap(pl0), capWhy = resCapWhy(cap);
    var prof = formProfile(), tFps = fpsOf(pl0);
    var rng = rateRangeFor(prof.row, fpsCol(tFps), prof.vert);
    var target = '<div class="ai-field lv-target"><label class="ai-lbl">Stream quality</label>' +
        '<div class="nc-seg" role="group" aria-label="Target resolution">' +
        PRESETS.map(function (r) {
          var vrOff = formVr() && r < 2560;
          var off = vrOff || !resFits(pl0, r, prof.vert);
          return '<button class="nc-seg__btn' + (prof.row === r ? " is-active" : "") + (off ? " is-off" : "") +
            '" type="button"' + (prof.row === r ? ' aria-current="true"' : "") +
            (off ? ' aria-disabled="true" data-tip="' + UI.esc(vrOff ? T.vrQuality : capWhy) + '"' : ' data-lv-res="' + r + '"') +
            ">" + resLabel(r) + "</button>";
        }).join("") + "</div>" +
        '<span class="an-hint">' + resDimLabel(prof.row, prof.vert) + " · " + tFps + " fps" +
          (q.length ? " from the files" : "") +
          (rng ? " · target bitrate " + rng[0].toFixed(1) + "–" + rng[1].toFixed(1) + " Mbps" : "") +
        "</span></div>";
    return '<div class="lv-wiz__step lv-form" data-lv-group="queue">' +
      // системный выбор файлов: кнопка Upload кликает по этому вводу
      '<input type="file" accept="video/*" multiple data-lv-qfile hidden />' +
      inputs + (FORM.limitErr && q.length ? '<div class="lv-sum__rd lv-sum__rd--bad" data-lv-limit>' + (IC.attention || "") + "<span>" + T.plLimit + "</span></div>" : "") + aggregate +
      // очередь живёт в серфейсе: шапка и строки — один объект, а не набор строк на фоне
      (q.length
        ? '<div class="lv-qsurf" data-lv-qdrop>' + head +
          (FORM.shuffle && q.length > 2 ? '<div class="lv-qnote">Order is ignored while Shuffle is on.</div>' : "") +
          '<div class="lv-q' + (FORM.shuffle ? " is-shuffled" : "") + (q.length === 1 ? " is-single" : "") +
          '" data-lv-queue data-lv-formq>' + queueRows(pseudo, pl, q, "slim") + "</div>" + foot + "</div>"
        : "") +
      // качество выбирается и до наполнения очереди: по умолчанию 1080p
      (quick ? "" : '<div class="lv-fprow">' + target + "</div>") +
      "</div>";
  }

  // ================= шаг 2 · Details =================
  function wizGroup(k, title, inner) {
    return '<section class="lv-fgroup" data-lv-group="' + k + '"><h2 class="lv-fgroup__t">' + title + "</h2>" + inner + "</section>";
  }
  function vrTag(l) { return '<span class="ml-tag ml-tag--sm ml-tag--brand lv-vrtag">' + (l || "360°") + "</span>"; }
  function formDestGroup(hint) {
    return '<div class="ai-grid ai-grid--2 lv-fpair">' +
        field("Stream link *",
          '<input class="an-input' + invCls("link") + '" type="text" value="' + UI.esc(FORM.link) +
            '" placeholder="https://youtube.com/live/…" data-lv-f="link" />', hint || "") +
        field("Stream key *", keyField() + '<div class="lv-keyalert" data-lv-keyalert>' + keyAlert() + "</div>") +
      "</div>";
  }
  function formPlaybackBlock() {
    var st = plStats(formQueuePl()), sched = FORM.startMode === "schedule";
    var mode = FORM.loop ? (FORM.endMode || "none") : "none";
    var hint = !FORM.loop
      ? (st.sec ? "One pass of the queue — " + UI.dur(st.sec) + "." : "The queue plays once and the stream ends.")
      : mode === "none"
        ? "Loop has no limit — the stream runs until you stop it."
        : mode === "loops"
          ? (st.sec ? UI.plural(FORM.loopLimit, "loop", "loops") + " ≈ " + UI.dur(st.sec * FORM.loopLimit) + "." : "")
          : (sched ? "The stream ends with the window: set the time in Ends below." : "The stream ends at this time even if the loop goes on.");
    return '<div class="ai-field lv-fplay" data-lv-group="playback"><label class="ai-lbl">Playback</label>' +
      '<div class="lv-form__row">' +
        seg("Playback mode", [{ k: "once", l: "Play once" }, { k: "loop", l: "Loop" }], FORM.loop ? "loop" : "once", "data-lv-loopmode") +
        (FORM.loop
          ? seg("Loop end", [{ k: "none", l: "No limit" }, { k: "loops", l: "Number of loops" }, { k: "until", l: "Until time" }], mode, "data-lv-endmode")
          : "") +
        (FORM.loop && mode === "loops"
          ? '<span class="lv-lim"><input class="an-input an-input--mini" type="number" min="1" value="' + FORM.loopLimit +
            '" data-lv-f="loopLimit" aria-label="Number of loops" /><span class="an-hint">loops</span></span>'
          : "") +
        (FORM.loop && mode === "until" && !sched && FORM.untilSlot
          ? '<span class="lv-funtil">' + dtField(FORM.untilSlot, "end", null) + "</span>"
          : "") +
      "</div>" +
      (hint ? '<span class="an-hint">' + UI.esc(hint) + "</span>" : "") +
    "</div>";
  }

  function formScheduleGroup(pseudo0) {
    var eta = convEta(formQueuePl());
    var first = FORM.schedules.length ? FORM.schedules[0].start : null;
    var convLine = eta
      ? '<div class="lv-busyline">' + (IC.attention || "") +
        '<span class="an-hint an-hint--warn">' + UI.esc(convEtaText(eta) + " " +
          (FORM.startMode === "now"
            ? (formAutoStart() ? "The stream goes live once it finishes." : "Conversion starts when you press Start.")
            : "The window can’t start before " + convEtaAt(eta, first) + ".")) + "</span></div>"
      : "";
    return '<div class="lv-form__row lv-form__row--tz">' + seg("Launch mode", [
        { k: "schedule", l: "Schedule stream" }, { k: "now", l: "Quick stream" }
      ], FORM.startMode, "data-lv-startmode") +
      (FORM.startMode === "schedule"
        ? tzSelect()
        : "") + "</div>" +
      formPlaybackBlock() +
      (FORM.startMode === "now"
        ? autoStartBox() + convLine
        : convLine +
          FORM.schedules.slice(0, formOpen() ? 1 : MAX_SLOTS).map(function (sl, i) {
            var c = selfClash(pseudo0, pseudo0.schedules, sl);
            return '<div class="ai-grid lv-slot__row' + (c ? " lv-slot--conflict" : "") + '">' +
              field("Starts", dtField(sl, "start", pseudo0)) +
              (formOpen() ? "" : field("Ends", dtField(sl, "end", pseudo0))) +
              (i > 0
                ? '<div class="ai-field lv-slot__del">' +
                  '<button class="mc-more" type="button" data-lv-slotdel="' + sl.id +
                    '" aria-label="Remove time">' + (IC.close || "") + "</button></div>"
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
          (formOpen() ? "" :
            '<div class="lv-form__row">' + addTimeBtn(FORM.schedules.length, "", "data-lv-slotadd") +
              '<span class="an-hint">Up to ' + F.account.horizonDays + " days ahead.</span></div>"));
  }
  function addTimeBtn(n, why, attr, size) {
    var reason = why || (n >= MAX_SLOTS ? T.maxSlots : "");
    return '<button class="an-btn an-btn--secondary an-btn--' + (size || "small") + (reason ? " is-off" : "") + '" type="button" ' +
      (reason ? 'aria-disabled="true" data-tip="' + UI.esc(reason) + '"' : attr) + ">" + (IC.plus || "") + "Add another time</button>";
  }
  function formKeyClash() {
    if (FORM.ctx && FORM.ctx !== "dest") return null;
    return keyBusy(FORM.key, FORM.id);
  }
  function keyAlert() {
    var c = formKeyClash();
    return c ? '<div class="lv-busyline lv-busyline--err">' + (IC.alert || "") +
      '<span class="lv-busyline__body"><span class="an-hint">' + UI.esc(c.msg) + "</span>" +
      (c.liveId ? '<a class="lv-link" href="live-stream.html?id=' + encodeURIComponent(c.liveId) + '">Open the stream</a>' : "") +
      "</span></div>" : "";
  }
  function keyField() {
    return '<div class="lv-keyf' + (FORM.key ? " is-filled" : "") + '">' +
      '<input class="an-input lv-fkey' + invCls("key") + '" type="text" value="' + UI.esc(FORM.key) +
        '" placeholder="e.g. abcd-1234-efgh-5678" data-lv-f="key" autocomplete="off" spellcheck="false" />' +
      '<span class="lv-keyf__mask" data-lv-keymask aria-hidden="true">' + keyTail(FORM.key) + "</span>" +
      copyKeyBtn("form") +
      "</div>";
  }
  function copyKeyBtn(src) {
    return '<button class="lv-extlink lv-keyf__copy" type="button" data-lv-copykey="' + UI.esc(src) + '"' +
      ' aria-label="Copy stream key" data-tip="Copy stream key">' + (IC.copy || "") + "</button>";
  }
  function copyKey(src) {
    var s = src === "form" ? null : stream(src);
    var key = String(s ? (s.dest && s.dest.key) || "" : (FORM && FORM.key) || "").trim();
    if (!key) { UI.toast("There is no stream key to copy."); return; }
    var done = function () { UI.toast("Stream key copied."); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(key).then(done, function () { copyFallback(key); done(); });
    else { copyFallback(key); done(); }
  }
  function copyFallback(text) {
    var ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    ta.remove();
  }
  function wizDetails(pseudo0) {
    return '<div class="lv-wiz__step lv-form">' +
      wizGroup("dest", "Destination", formDestGroup()) +
      wizGroup("schedule", "Schedule", formScheduleGroup(pseudo0)) +
      "</div>";
  }

  // ================= шаг 3 · Review & launch =================
  function keyTail(key) {
    var k = String(key || "").trim();
    return k ? "•••• " + UI.esc(k.slice(-4)) : "—";
  }
  function extLinkBtn(link) {
    var u = String(link || "").trim();
    if (!u) return "";
    var href = /^https?:\/\//i.test(u) ? u : "https://" + u;
    return '<a class="lv-extlink" href="' + UI.esc(href) + '" target="_blank" rel="noopener"' +
      ' aria-label="Open the stream link in a new tab" data-tip="Open the stream link">' + (IC.external || "") + "</a>";
  }
  function revBlock(title, inner, go) {
    return '<section class="lv-rev__g"><div class="lv-rev__h"><h3 class="lv-rev__t">' + title + "</h3>" +
      '<button class="lv-link" type="button" data-lv-wzgo="' + go + '">Change</button></div>' + inner + "</section>";
  }
  function wizReview() {
    var pl = formQueuePl(), st = plStats(pl), rd = readiness(pl);
    var ps = formPseudo(), c = cost(ps), a = c.account;
    var win = FORM.startMode === "schedule" ? c.windowH : 0;
    var runs = FORM.startMode === "schedule" ? next3All() : [];
    var unknown = queueUnknown(pl) || !st.sec;
    var play = formCycleText(st, win) + (FORM.shuffle ? " · shuffled" : "");
    var prof4 = formProfile();
    var rows = function (h) { return '<div class="lv-sum__rows lv-dots">' + h + "</div>"; };
    var nextRows = FORM.startMode === "now"
      ? kvRow(nowStartLabel(), "")
      : runs.length
        ? kvRow("First run", UI.dt(runs[0].start, FORM.tz).replace(",", "") + " → " +
            (formOpen() ? T.openEndVal.toLowerCase() : UI.time(runs[0].end, FORM.tz)) + " " + tzOffLabel(FORM.tz)) +
          kvRow("Times planned", String(FORM.schedules.length))
        : kvRow("First run", "No times yet");
    return '<div class="lv-wiz__step">' +
      revBlock("Content", rows(
        kvRow("Goes on air",
              (st.count ? st.count + (st.count === 1 ? " video" : " videos") : "Nothing") +
              (unknown ? "" : " · " + UI.dur(st.sec)) +
              (st.count ? " · " + resLabel(prof4.h) + " · " + fpsOf(pl) + " fps" : "")) +
        kvRow("Files are", rd.label) +
        (formMissing() ? kvRow("Not available", '<span class="ml-tag ml-tag--bad">' + UI.plural(formMissing(), "file", "files") + " removed from Media Library</span>") : "")), "1:queue") +
      revBlock("Destination", rows(
        kvRow("Stream name", '<span class="lv-revname">' + UI.esc(formName().trim() || "—") + extLinkBtn(FORM.link) + "</span>") +
        kvRow("Stream key", '<span class="lv-revname">' + keyTail(FORM.key) + (FORM.key.trim() ? copyKeyBtn("form") : "") + "</span>")), "2:dest") +
      revBlock("Cycle", rows(kvRow("Plays as", play)), "1:playback") +
      revBlock("Next runs", rows(nextRows), "2:schedule") +
      // стоимость — единственное число, которое человек не посчитает сам: блок стоит всегда
      revBlock("Cost", '<div class="lv-sum__rows lv-dots">' + (
        (FORM.loop
          ? kvRow("Price per hour", c.rateStr +
              (a.kind === "hours" ? " · ≈" + UI.hours(a.creditHours) + " of free credit" : "") +
              (!unknown && win && !formOpen() ? " · this " + winLen(win) + " window ≈" + UI.money(c.windowCost) : ""))
          : kvRow(unknown || !win ? "This stream costs" : "This " + winLen(win) + " window costs",
              (unknown ? "—" : "≈" + UI.money(win ? c.windowCost : st.sec / 3600 * c.rate)) +
              " · " + (a.kind === "hours" ? "≈" + UI.hours(a.creditHours) + " of free credit" : c.rateStr))) +
        (isUser() ? "" : kvRow(a.shared ? "Organization balance covers" : "Your balance covers", "≈" + UI.hours(c.balHours) + " of streaming"))) + "</div>" +
        (c.notEnough && !isUser()
          ? '<p class="lv-sum__note">Balance covers ≈' + UI.hours(c.balHours) + " of the " + winLen(c.windowH) + " window.</p>"
          : ""), "2:schedule") +
      "</div>";
  }

  function renderQuick(host) {
    var pseudo0 = formPseudo();
    var sched = FORM.startMode === "schedule", sl = FORM.schedules[0];
    var clash = sched && sl ? selfClash(pseudo0, pseudo0.schedules, sl) : null;
    var kclash = formKeyClash();
    var gate = wizBlocked(1) || wizBlocked(2) || (formBlock() || {}).reason || (clash ? clash.msg : "") || (kclash ? kclash.msg : "");
    document.title = "Quick stream — SubSub";
    host.innerHTML =
      '<button class="an-back" type="button" data-lv-wzleave>' + (IC.chevLeft || "") + "Back to streams</button>" +
      '<div class="lv-quick lv-form">' +
        '<div class="lv-quick__h"><h1 class="lv-wiz__h">Quick stream</h1>' +
          '<p class="lv-wiz__lead">Paste the stream link and key, add videos and go live — or pick a time.</p></div>' +
        '<section class="lv-fgroup lv-quick__g" data-lv-group="dest"><h2 class="lv-fgroup__t">Destination</h2>' +
          '<div class="lv-quick__dest">' +
            field("Stream link *", '<input class="an-input' + invCls("link") + '" type="text" value="' + UI.esc(FORM.link) +
              '" placeholder="https://youtube.com/live/…" data-lv-f="link" />') +
            field("Stream key *", keyField() + '<div class="lv-keyalert" data-lv-keyalert>' + keyAlert() + "</div>") +
          "</div></section>" +
        '<section class="lv-fgroup lv-quick__g" data-lv-group="schedule"><h2 class="lv-fgroup__t">Time</h2>' +
          '<label class="lv-pick__only lv-quick__sw"><span>Schedule for later</span>' + UI.switchHtml('data-lv-f="quickSched"', sched, "Schedule for later") + "</label>" +
          (sched && sl
            ? '<div class="ai-grid lv-slot__row' + (clash ? " lv-slot--conflict" : "") + '">' +
                field("Starts", dtField(sl, "start", pseudo0)) +
                field("Ends", dtField(sl, "end", pseudo0)) +
                tzSelect(true) +
              "</div>" + (clash ? busyLine(clash) : '<span class="an-hint">The stream ends when the window ends.</span>')
            : autoStartBox()) +
        "</section>" +
        '<section class="lv-fgroup lv-quick__g" data-lv-group="queue"><h2 class="lv-fgroup__t">Videos</h2>' + wizContent(true) + "</section>" +
        '<div class="lv-wiz__foot lv-quick__foot">' +
          btn("Cancel", "secondary", "data-lv-wzleave") +
          '<button class="an-btn an-btn--primary an-btn--small' + (gate ? " is-off" : "") + '" type="button" data-lv-quicksubmit' +
            (gate ? ' aria-disabled="true" data-tip="' + UI.esc(gate) + '"' : "") + ">" + (sched ? "Schedule" : formAutoStart() ? "Start now" : "Create stream") + "</button>" +
        "</div>" +
      "</div>";
    wizBindDnd(host);
  }
  function renderForm() {
    // на странице стрима тот же FORM правит секцию или очередь: перерисовывать нужно их, не мастер
    if (FORM && FORM.ctx === "queue") { queueEditorRender(); return; }
    if (FORM && FORM.ctx) { renderDetail(); return; }
    var host = document.querySelector("[data-lv-form]");
    if (!host) return;
    if (!FORM && formInit() === false) return;
    formSyncEnds();
    if (FORM.quick) { renderQuick(host); return; }
    var pseudo0 = formPseudo();
    document.title = "New stream — SubSub";

    var cur = WZ_STEPS[WZ.step - 1];
    var gate = wizBlocked(WZ.step);
    var bodies = [wizContent, function () { return wizDetails(pseudo0); }, wizReview];

    host.innerHTML =
      '<button class="an-back" type="button" data-lv-wzleave>' + (IC.chevLeft || "") + "Back to streams</button>" +
      '<div class="lv-wiz">' +
      '<aside class="lv-wiz__map">' + wizMapHtml() + "</aside>" +
      '<section class="lv-wiz__body">' +
        '<div class="lv-wiz__eyebrow">Step ' + WZ.step + " of " + WZ_STEPS.length + "</div>" +
        '<h1 class="lv-wiz__h">' + cur.h + "</h1>" +
        '<p class="lv-wiz__lead">' + cur.lead + "</p>" +
        bodies[WZ.step - 1]() +
        '<div class="lv-wiz__foot">' + wizFootHtml(gate) + "</div>" +
      "</section></div>";

    // очередь перетаскивается, если порядок вообще имеет смысл
    wizBindDnd(host);
  }
  // карта шагов и полоса значений: обновляются и при печати в поле, без перерисовки шага.
  // Непройденный шаг обещает содержимое второй строкой, пройденный показывает значение.
  function wizMapHtml() {
    return '<h2 class="lv-wiz__maptitle">New stream setup</h2>' +
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
  function wizFootHtml(gate) {
    return (WZ.step > 1 ? iconBtn("Back", IC.chevLeft, "data-lv-wzback") : "") +
      (WZ.step < WZ_STEPS.length
        ? '<button class="an-btn an-btn--primary an-btn--small' + (gate ? " is-off" : "") +
          '" type="button" data-lv-wznext' +
          (gate ? ' aria-disabled="true" data-tip="' + UI.esc(gate) + '"' : "") +
          ">Save and continue</button>"
        : btn("Cancel", "secondary", "data-lv-formcancel") +
          '<button class="an-btn an-btn--primary an-btn--small' + (gate ? " is-off" : "") +
          '" type="button" data-lv-formsubmit' +
          (gate ? ' aria-disabled="true" data-tip="' + UI.esc(gate) + '"' +
            (gate === T.balanceEmpty ? ' data-tip-act="' + T.topUp + '"' : "") : "") + ">Create stream</button>");
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
    var out = FORM.schedules.map(function (sl) { return { start: sl.start, end: sl.end }; });
    return out.sort(function (x, y) { return Date.parse(x.start) - Date.parse(y.start); }).slice(0, 3);
  }
  function formSubmit() {
    var b = formBlock();
    if (b) { UI.toast(b.reason); return; }
    var s = FORM.id ? stream(FORM.id) : null;
    // черновик при создании ведёт себя как новый стрим: статус, прогон и тост — как у нового
    var wasDraft = !!(s && s.status === "draft");
    if (!s) {
      s = { id: "s" + Date.now(), runs: [], spentTotal: 0, metrics: {} };
      S.streams.unshift(own(s));
    }
    if (wasDraft) { delete s.draftForm; delete s.draftStep; delete s.draftMax; s.runs = s.runs || []; }
    s.name = formName().trim() || s.name;
    s.dest = { name: channelOf(FORM.link, FORM.key, s.id) || null, key: FORM.key.trim(), link: FORM.link.trim() };
    s.playlistId = null;
    s.fileId = null;
    s.queue = clone(formQueue());
    s.srcPl = FORM.srcPl || null;
    s.detached = !!FORM.detached;
    s.cover = FORM.cover ? { src: FORM.cover, uploaded: true } : null;
    s.desc = FORM.desc || "";
    s.res = formRes() || null;
    s.vert = formVert();
    s.vr = formVr();
    s.playback = formPlayback();
    s.schedules = FORM.startMode === "schedule" ? clone(FORM.schedules) : [];
    s.virtual_status = FORM.startMode === "schedule" && FORM.schedules.length ? "scheduled" : null;
    var conv = formConvWait(), auto = formAutoStart();
    s.status = FORM.startMode === "now" && auto && !conv ? "live" : "created";
    s.runs = s.runs || [];
    if (FORM.startMode === "now" && (conv || !auto)) {
      if (!auto) s.runs.unshift({ id: s.id + "-r" + (s.runs.length + 1), index: s.runs.length + 1, start: null, end: null,
        spent: 0, events: [ev("created", "Created", { author: "You" })] });
    } else if (FORM.startMode === "now") {
      s.runs.unshift({ id: s.id + "-r" + (s.runs.length + 1), index: s.runs.length + 1,
        start: new Date(nowMs()).toISOString(), end: null,
        spent: 0, events: [ev("created", "Created", { author: "You" }), ev("live", "Went live")] });
    } else {
      s.runs.unshift({ id: s.id + "-r" + (s.runs.length + 1), index: s.runs.length + 1, start: null, end: null,
        spent: 0, events: [ev("scheduled", "Scheduled", { author: "You" })] });
    }
    save();
    if (conv && auto) {
      doStart(s);
      var r1 = runOf(s);
      if (r1) { r1.events.push(ev("created", "Created", { author: "You" })); save(); }
    } else {
      UI.toast(!auto ? "“" + s.name + "” created. Press Start now when you’re ready."
        : FORM.startMode === "now" ? "“" + s.name + "” is live." : "“" + s.name + "” scheduled.");
    }
    location.href = ctxUrl("live-stream.html?id=" + encodeURIComponent(s.id));
  }

  // ============================================================ Э6 · пикер медиатеки
  var PICK = null;
  // Профиль, относительно которого пикер показывает готовность: цель стрима, если
  // выбираем в очередь, профиль плейлиста — если пополняем плейлист.
  function pickProfile() {
    var t = PICK && PICK.target;
    if (!t) return null;
    if ((t.kind === "queue" || t.kind === "qreplace") && FORM) {
      return profileOf(formQueuePl());
    }
    if (t.kind === "qk" && QK && QK.items.length) {
      return profileOf({ items: QK.items.map(function (x) { return { fileId: x.fileId, off: false }; }), quick: true });
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
      matchProfile: target.kind === "replace", folder: null, sel: {}, q: "" };
    var pu = document.querySelector("#lvPicker [data-lv-pickupload]");
    if (pu) pu.hidden = target.kind === "qk";
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
    return f.q.w + "×" + f.q.h;
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
    if (f.q.fps < FPS_MIN || f.q.fps > FPS_MAX) {
      return f.q.fps + " fps is outside " + FPS_MIN + "–" + FPS_MAX + " — conversion can’t change that.";
    }
    if (!!f.q.vr !== !!prof.vr) {
      return f.q.vr
        ? "A 360° video can’t be aligned to a flat stream. Remove it, or keep only 360° videos in the queue."
        : "A flat video can’t be aligned to a 360° stream. Remove it from the queue.";
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
        : stx === "processing" ? "processing" : stx === "missing" ? "missing" : "ready"] || ["info", "Converting"];
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
      if (f.container !== "mp4") return false;
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
    if (PICK.target.kind === "qk") { qkAddLibrary(ids); UI.closeModals(); return; }
    if (PICK.target.kind === "queue") {                 // очередь стрима: шаг контента или редактор на странице
      var fitQ = fitLimit(formQueue(), ids);
      fitQ.ok.forEach(function (id) { FORM.queue.push({ fileId: id, off: false }); });
      FORM.limitErr = fitQ.over.length > 0;
      if (fitQ.ok.length) formDetach();
      if (FORM.ctx === "queue") UI.closeModal("lvPicker"); else UI.closeModals();
      renderForm();
      UI.toast(fitQ.over.length ? T.plLimit : UI.plural(ids.length, "video", "videos") + " added to the queue.");
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
      var fitP = fitLimit(p.items, ids.filter(function (id) { return !p.items.filter(function (i) { return i.fileId === id; }).length; }));
      if (fitP.over.length) {
        ids = ids.filter(function (id) { return fitP.over.indexOf(id) === -1; });
        setTimeout(function () { UI.toast(T.plLimit); }, 0);
      }
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
      ids.forEach(function (id) {
        if (!p.items.filter(function (i) { return i.fileId === id; }).length) p.items.push({ fileId: id, off: false });
      });
      p.updated = new Date(nowMs()).toISOString();
      save(); render();
    }
    UI.toast(skipped
      ? skipped + " files won’t be added: not video, still processing or with an unsupported frame rate."
      : UI.plural(ids.length, "video", "videos") + " added.");
  }


  // ============================================================ Э4 · календарь
  // Календарь показывает слоты, а не стримы: повтор разворачивается в отдельные полосы.
  var CALV = { scale: "week", anchor: null, tz: null, dest: null, statuses: [], authors: [], view: null, hour: null };
  var SCALE_LBL = { month: "Month", week: "Week", day: "Day" };
  function tzShort(z) { return z === "UTC" ? "UTC" : z.split("/").pop().replace(/_/g, " "); }
  var DAYMS = 24 * 3600e3;

  function calTz() { return CALV.tz || TZ; }
  function calDests() { return dests(); }
  function calDest() {
    if (CALV.dest === "__all" && calDests().length === 1) { CALV.dest = calDests()[0]; S.calDest = CALV.dest; }
    if (CALV.dest) return CALV.dest;
    if (S.calDest === "__all" && calDests().length === 1) S.calDest = calDests()[0];
    if (S.calDest && (S.calDest === "__all" || calDests().indexOf(S.calDest) !== -1)) { CALV.dest = S.calDest; return CALV.dest; }
    CALV.dest = calDests().length === 1 ? calDests()[0] : "__all";
    return CALV.dest;
  }
  function calAll() { return calDest() === "__all"; }
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
  // Без относительных слов («This week», «Today»): от них скакала ширина поля периода;
  // сегодняшний день и так подсвечен в сетке, а быстрые переходы живут в пресетах календаря.
  function calPeriodLabel(r, fromMs, toMs) {
    if (CALV.scale === "day") return UI.day(new Date(fromMs).toISOString(), calTz());
    if (CALV.scale === "week") {
      // недели читаются по числам: дни недели и так стоят в шапках колонок
      var f2 = UI.day(new Date(fromMs).toISOString(), calTz()).replace(/^[A-Z][a-z]{2} /, "");
      var t2 = UI.day(new Date(toMs - DAYMS).toISOString(), calTz()).replace(/^[A-Z][a-z]{2} /, "");
      var same = f2.split(" ")[1] === t2.split(" ")[1];
      return (same ? f2.split(" ")[0] + " — " + t2 : f2 + " — " + t2) + " · W" + isoWeek(r.from);
    }
    var mLbl = new Intl.DateTimeFormat("en-GB", { timeZone: calTz(), month: "long", year: "numeric" })
      .format(new Date(dayStartMs(calAnchor(), calTz())));
    return mLbl;
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
  // Луп без лимита не имеет конца: правило читается из стрима, а не из сохранённого окна,
  // поэтому и старые фикстуры, и стримы, сохранённые до этого правила, ведут себя одинаково.
  function expand(s, sl, fromMs, toMs) {
    var start = Date.parse(sl.start), end = Date.parse(sl.end);
    var open = openWindow(s) && (running(s.status) || start > nowMs());
    if (open) end = Math.max(toMs, start + DAYMS);
    if (!(end > start) || end < fromMs || start > toMs || start > nowMs() + F.account.horizonDays * DAYMS) return [];
    return [{ streamId: s.id, slotId: sl.id, start: start, end: end, occDate: partsIn(start, calTz()).date, open: open, endless: open }];
  }
  function calOccurrences(rangeFromMs, rangeToMs) {
    var out = [];
    vis().forEach(function (s) {
      if (!calAll() && destName(s) !== calDest()) return;
      if (CALV.authors.length && CALV.authors.indexOf(s.authorId) === -1) return;
      var sg = stGroup(CAL_ST_GROUPS, stKey(s));
      if (CALV.statuses.length && (!sg || CALV.statuses.indexOf(sg.k) === -1)) return;
      (s.schedules || []).forEach(function (sl) {
        expand(s, sl, rangeFromMs, rangeToMs).forEach(function (o) { out.push(o); });
      });
    });
    return out;
  }
  function calRunningNoWindow() {
    return vis().filter(function (s) {
      return running(s.status) && !(s.schedules || []).length &&
        (calAll() || destName(s) === calDest());
    });
  }

  function renderCalendar() {
    calDrawDrop();
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
      chWrap.hidden = !calDests().length;
      var host2 = chWrap.querySelector("[data-lv-calchansel]");
      var curCh = calAll() ? { label: "All destinations" } : { label: calDest() };
      if (host2) host2.innerHTML = selTrig("calDest", UI.selectValue({ label: curCh.label }), { label: "Destination" });
    }
    var tzWrap = document.querySelector("[data-lv-caltzwrap]");
    // в закрытом селекте только смещение: город с UTC не помещается, а в списке он и так рядом с каждым поясом
    if (tzWrap) tzWrap.innerHTML = selTrig("calTz", UI.selectValue({ label: tzOffLabel(calTz()) }), { label: "Time zone" });
    var range = document.querySelector("[data-lv-calrange]");
    if (range) range.textContent = calPeriodLabel(r, fromMs, toMs);
    var chips = document.querySelector("[data-lv-calchips]");
    if (chips) {
      var calF = CALV.statuses.length + CALV.authors.length;
      chips.innerHTML = CALV.statuses.map(function (st) {
        return chip("Status: " + stGroupLabel(CAL_ST_GROUPS, st), 'data-lv-calunchip="statuses:' + st + '"');
      }).join("") + CALV.authors.map(function (id) {
        return chip("Author: " + (authorName(id) || id), 'data-lv-calunchip="authors:' + id + '"');
      }).join("") + (calF ? '<button class="an-fchips__clear" type="button" data-lv-calclear>Clear all</button>' : "");
      // причина «только чтение» в обзоре живёт подсказкой на полосах, отдельной строки над таблицей нет
      chips.hidden = !calF;
    }
    // алерт остался один: нулевой баланс. Пересечений в расписании не бывает — их не дают создать
    var warn = document.querySelector("[data-lv-calwarn]");
    var a = acc(), zero = a.kind === "money" && a.balance <= 0;
    var alertKey = calDest() + "|" + r.from + "|" + CALV.scale + "|" + (zero ? "z" : "");
    if (warn) {
      warn.hidden = !zero || CALV.alertOff === alertKey;
      warn.setAttribute("data-lv-alertkey", alertKey);
      warn.className = "an-alert an-alert-dock an-alert--attention";
      warn.innerHTML = zero
        ? "<span>" + (isUser() ? T.orgBalanceOut : T.paused) + "</span>" +
          (isUser() ? "" : '<span class="an-alert__acts">' + btn(T.topUp, "primary", "data-lv-topup") + "</span>")
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
      // крестик убирает карточку до перезагрузки страницы: сетка под ней остаётся рабочей
      empty.hidden = !none || !!CALV.emptyDismissed;
      var liveNoWin = calRunningNoWindow();
      var noStreams = !vis().length, canPick = !calAll() && !noStreams;
      var hint = noStreams ? "Create your first stream and it will appear here."
        : canPick ? "Click an empty slot in the grid to schedule a stream."
        : "Pick a destination to schedule streams from the grid.";
      empty.innerHTML = !none ? ""
        : '<div class="an-blank lv-empty">' +
            '<button class="an-modal__x lv-empty__x" type="button" data-lv-calemptyclose aria-label="Close">' + (IC.close || "") + "</button>" +
            '<span class="an-blank__ico"><svg><use href="#ic-calendar"></use></svg></span>' +
            '<p class="an-blank__title">' + (noStreams ? "No streams yet" : "Nothing scheduled in this period") + "</p>" +
            '<p class="an-blank__text">' + hint + " You can plan up to " + F.account.horizonDays + " days ahead.</p>" +
            // эфир без окна в сетку не попадает: иначе пустой календарь при живом эфире читается как ошибка
            (liveNoWin.length
              ? '<p class="an-blank__text">“' + UI.esc(liveNoWin[0].name) + "” is live without a window, so it isn’t on the calendar.</p>"
              : "") +
            '<div class="an-head__btns">' +
              btn("Schedule stream", "primary", 'data-lv-new="schedule"', IC.calendar) + "</div></div>";
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
  var CL_COLS = "220px minmax(0,1fr) 200px 150px 120px 110px";
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
          var s = stream(o.streamId);
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
            '<span class="an-td lv-cltime">' + UI.time(new Date(o.start).toISOString(), calTz()) + " → " +
              (o.open ? '<span class="an-muted">until stopped</span>'
                : UI.time(new Date(o.end).toISOString(), calTz()) + (cross ? ' <span class="an-muted">next day</span>' : "")) + "</span>" +
            '<span class="an-td">' + UI.esc(s.name) + calAuthorInline(s) + "</span>" +
            '<span class="an-td">' + destHtml(s) + "</span>" +
            '<span class="an-td">' + stBadge(stKey(s)) + "</span>" +
            '<span class="an-td an-td--r"' + (onAirNow ? ' data-tip="Time on air so far."' : '') + ">" +
              (onAirNow ? UI.dur(airSec) : o.open ? '<span class="an-muted">—</span>' : UI.dur(sec)) + "</span>" +
            '<span class="an-td an-td--r">≈' + UI.money((sec / 3600) * rateNum(s)) + (o.open ? ' <span class="an-muted">/ day</span>' : "") + "</span>" +
            "</button>";
        }).join("");
    }).join("");
    var runRows = run.length
      ? '<div class="an-tr an-tr--avg lv-clday" style="grid-template-columns:' + CL_COLS + '">' +
        '<div class="an-td">Running now <span class="an-muted">· no end time</span></div>' +
        '<div class="an-td"></div><div class="an-td"></div></div>' +
        run.map(function (s) {
          return '<button class="an-tr an-tr--link" type="button" style="grid-template-columns:' + CL_COLS + '" ' +
            'data-lv-calopen="' + s.id + '">' +
            '<span class="an-td lv-cltime">' + UI.time(new Date(nowMs()).toISOString(), calTz()) + ' <span class="an-muted">on air</span></span>' +
            '<span class="an-td">' + UI.esc(s.name) + calAuthorInline(s) + "</span>" +
            '<span class="an-td">' + destHtml(s) + "</span>" +
            '<span class="an-td">' + stBadge(stKey(s)) + "</span>" +
            // у идущего стрима длительность — фактическое время в эфире, а стоимость без окна неизвестна
            '<span class="an-td an-td--r">' + UI.dur(Math.max(0, Math.round((nowMs() - Date.parse((runOf(s) || {}).start || new Date(nowMs()).toISOString())) / 1000))) + "</span>" +
            '<span class="an-td an-td--r"><span class="an-muted">—</span></span>' +
            "</button>";
        }).join("")
      : "";
    if (!rows && !runRows) return "";
    var head = ["Time", "Stream", "Destination", "Status", "Duration", "Cost"];
    return '<div class="an-table an-table--grid">' +
      '<div class="an-tr an-tr--head" style="grid-template-columns:' + CL_COLS + '">' +
        head.map(function (h, i) {
          return '<div class="an-th' + (i > 3 ? " an-th--r" : "") + '">' + h + "</div>";
        }).join("") + "</div>" +
      runRows + rows + "</div>";
  }
  // повтор виден в каждом виде календаря одинаково: та же иконка, что на полосе недели
  // строк имени столько, сколько влезает: иначе в узкой дорожке многоточие съедает полназвания
  function calFitLabels(host) {
    [].slice.call(host.querySelectorAll(".lv-bar[data-lv-occ]")).forEach(function (b) {
      var n = b.querySelector(".lv-bar__n");
      if (!n) return;
      // Высота полосы честная. Короткое окно — одна строка «имя · время», как в системных календарях;
      // совсем маленькое (15 минут при обычном масштабе) — без текста, имя и время в подсказке, увеличить можно кнопкой «+»
      b.classList.toggle("is-short", b.clientHeight < 30);
      b.classList.toggle("is-narrow", b.clientWidth < 84);
      var tiny = b.clientHeight < 18;
      b.classList.toggle("is-tiny", tiny);
      if (tiny && !b.hasAttribute("data-tip")) {
        var tEl = b.querySelector(".lv-bar__t"), mEl = b.querySelector(".lv-bar__mode");
        b.setAttribute("data-tip", n.textContent.trim() + (tEl ? " · " + tEl.textContent.trim() : "") + (mEl ? " · " + mEl.textContent.trim() : ""));
      }
      var mode = b.querySelector(".lv-bar__mode"), meta = b.querySelector(".lv-bar__c") && !b.classList.contains("is-narrow");
      b.classList.remove("is-cramped");
      if (mode && !tiny) {
        b.classList.toggle("is-cramped", b.classList.contains("is-short") ? n.scrollWidth > n.clientWidth + 1 : b.clientHeight < (meta ? 50 : 36));
      }
      var room = b.clientHeight - (b.querySelector(".lv-bar__c") ? 20 : 6) - (mode && !b.classList.contains("is-cramped") ? 16 : 0);
      n.style.setProperty("--lvlines", String(Math.max(1, Math.min(8, Math.floor(room / 15)))));
    });
  }

  // ---- бегущие без окна: отдельная полоса сверху
  // ---- недельный и дневной вид: ось времени слева, полосы по колонкам дней
  // Окно длиннее суток — подложка: полосатый фон на всю ширину колонки без заголовка, под
  // остальными полосами; длительность видна в подсказке и в карточке. В дорожках не участвует.
  function occLong(o) { return o.open || o.end - o.start > DAYMS; }
  function calLongBar(o, s, top, height, ro, past, contAfter) {
    var tip = s.name + " · " + UI.durHuman((o.end - o.start) / 1000) + " · " +
      UI.dt(new Date(o.start).toISOString(), calTz()).replace(",", "") + " → " + UI.dt(new Date(o.end).toISOString(), calTz()).replace(",", "");
    return '<button class="lv-bar lv-bar--' + stKey(s) + " lv-bar--long" + (ro ? " is-ro" : "") + (past ? " is-past" : "") + '" type="button" ' +
      'style="top:' + top.toFixed(2) + "%;height:" + Math.max(2.2, height).toFixed(2) + '%" ' +
      'data-lv-occ="' + o.streamId + "|" + o.slotId + "|" + o.occDate + '" data-tip="' + UI.esc(tip) + '" aria-label="' + UI.esc(tip) + '">' +
      (ro || past || contAfter || !canStretch(s) ? "" : '<span class="lv-bar__grip" data-lv-resize="' + o.streamId + "|" + o.slotId + '"></span>') +
      "</button>";
  }
  function barMeta(o, s, ro) {
    var parts = [];
    if (ro) parts.push(UI.esc(destName(s)));
    if (isMgr() && authorName(s.authorId)) parts.push(UI.esc(authorName(s.authorId)));
    var txt = parts.join(" · ");
    if (!txt) return "";
    return '<span class="lv-bar__c">' + txt + "</span>";
  }
  function tbarMeta(s, ro) {
    var parts = [];
    if (ro) parts.push(UI.esc(destName(s)));
    if (isMgr() && authorName(s.authorId)) parts.push(UI.esc(authorName(s.authorId)));
    return parts.join(" · ");
  }
  function canStretch(s) { return !!(s && s.playback && s.playback.loop); }
  function calModeLabel(s) {
    var e = endOf(s);
    if (!(s.playback && s.playback.loop)) return "Play once";
    return e.mode === "loops" && e.loops > 0 ? "Loop ×" + e.loops : e.mode === "until" && e.until ? "Until " + UI.time(e.until, calTz()) : "Loop";
  }
  function calModeBadge(s) { return '<span class="lv-bar__mode">' + UI.esc(calModeLabel(s)) + "</span>"; }
  function calAuthorInline(s) {
    return isMgr() && authorName(s.authorId) ? '<span class="lv-author__in">' + UI.esc(authorName(s.authorId)) + "</span>" : "";
  }
  function calTime(r, occ, dim) {
    var ro = calAll();                     // обзор всех каналов: окна не двигаем
    var hours = "";
    for (var h = 0; h < 24; h++) hours += '<div class="lv-cal__h"><span>' + String(h).padStart(2, "0") + ":00</span></div>";
    var nowP = partsIn(nowMs(), calTz());
    var rangeFrom = dayStartMs(r.days[0], calTz()), rangeTo = dayStartMs(r.days[r.days.length - 1], calTz()) + DAYMS;
    // Длинные окна (луп без конца или дольше суток) живут в верхней полосе, как многодневные события
    // в Google Calendar; в сетке от них остаётся подложка. Бесконечное окно тянется до следующего
    // запуска того же правила, а без него — за край видимого периода.
    var occV = occ.map(function (o) {
      if (!occLong(o)) return o;
      if (!o.open) return o;
      var next = occ.filter(function (x) { return x.slotId === o.slotId && x.streamId === o.streamId && x.start > o.start; })
        .sort(function (a2, b2) { return a2.start - b2.start; })[0];
      return Object.assign({}, o, { end: next ? next.start : Math.max(rangeTo, o.start + DAYMS), endless: !next });
    });
    // Эфир без окна (стрим запущен вручную) — та же бесконечная полоса в верхней строке от начала
    // прогона, а не отдельная зелёная строка над сеткой
    calRunningNoWindow().forEach(function (s) {
      var rs = Date.parse((runOf(s) || {}).start || new Date(nowMs()).toISOString());
      occV.push({ streamId: s.id, slotId: "run", start: rs, end: Math.max(rangeTo, rs + DAYMS),
        occDate: partsIn(rs, calTz()).date, open: true, endless: true });
    });
    // Запуски одного бесконечного правила стыкуются друг с другом (каждый идёт до следующего) —
    // это один непрерывный эфир, а не цепочка суточных полос: склеиваем их в одну полосу и одну подложку.
    var chained = [], lastOf = {};
    occV.slice().sort(function (a2, b2) { return a2.start - b2.start; }).forEach(function (o) {
      if (!(o.open && occLong(o))) { chained.push(o); return; }
      var key = o.streamId + "|" + o.slotId, prev = lastOf[key];
      if (prev && prev.end >= o.start) { prev.end = Math.max(prev.end, o.end); prev.endless = o.endless; return; }
      lastOf[key] = o; chained.push(o);
    });
    occV = chained;
    var longs = occV.filter(occLong).sort(function (a2, b2) { return a2.start - b2.start; });
    var laneEnds = [];
    var topBars = longs.map(function (o) {
      var s = stream(o.streamId);
      var c1 = r.days.indexOf(partsIn(Math.max(o.start, rangeFrom), calTz()).date);
      var c2 = r.days.indexOf(partsIn(Math.min(o.end, rangeTo) - 1, calTz()).date);
      if (c1 < 0) c1 = 0; if (c2 < 0) c2 = r.days.length - 1;
      // строка полосы выбирается по колонкам дней: две полосы одной строки не делят колонку
      var li = 0; while (laneEnds[li] !== undefined && laneEnds[li] >= c1) li++;
      laneEnds[li] = c2;
      var before = o.start < rangeFrom, after = o.end >= rangeTo || o.endless;
      var tip = s.name + (tbarMeta(s, ro) ? " · " + tbarMeta(s, ro) : "") + " · " + UI.dt(new Date(o.start).toISOString(), calTz()).replace(",", "") + " → " +
        (o.open ? T.openEndVal.toLowerCase() : UI.dt(new Date(o.end).toISOString(), calTz()).replace(",", "") + " · " + UI.durHuman((o.end - o.start) / 1000));
      return '<button class="lv-tbar lv-bar--' + stKey(s) + (before ? " is-before" : "") + (after ? " is-after" : "") + '" type="button" ' +
        'style="grid-column:' + (c1 + 1) + " / " + (c2 + 2) + ";grid-row:" + (li + 1) + '" ' +
        'data-lv-occ="' + o.streamId + "|" + o.slotId + "|" + o.occDate + '" data-tip="' + UI.esc(tip) + '" aria-label="' + UI.esc(tip) + '">' +
        '<span class="lv-tbar__n">' + UI.esc(s.name) + '</span><span class="lv-tbar__t">, ' + UI.time(new Date(o.start).toISOString(), calTz()) + "</span>" +
        calModeBadge(s) +
        (tbarMeta(s, ro) ? '<span class="lv-tbar__c">' + tbarMeta(s, ro) + "</span>" : "") +
        "</button>";
    }).join("");
    var topRows = laneEnds.length;
    var topH = topRows ? 6 + topRows * 18 + (topRows - 1) * 2 + 1 : 0;
    var top = '<div class="lv-cal__top' + (topRows ? "" : " is-empty") + '" style="height:' + topH + "px;grid-template-columns:repeat(" + r.days.length + ', minmax(0, 1fr))">' + topBars + "</div>";
    var cols = r.days.map(function (d, di) {
      var dFrom = dayStartMs(d, calTz()), dTo = dFrom + DAYMS;
      var dayOcc = occV.filter(function (o) { return o.start < dTo && o.end > dFrom; })
        .sort(function (a2, b2) { return a2.start - b2.start; });
      // Наложения — каскадом, как в системных календарях: каждая следующая пересекающаяся полоса
      // сдвинута вправо и лежит поверх предыдущей, правый край общий. Глубина каскада считается
      // внутри группы реально пересекающихся окон; многодневные подложки в ней не участвуют.
      var laneOcc = dayOcc.filter(function (o) { return !occLong(o); });
      var groups = [], cur = null;
      laneOcc.forEach(function (o) {
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
        // Геометрия: полоса, начавшаяся заметно позже нижней, ложится каскадом со сдвигом 12 px и
        // оставляет её заголовок видимым; начавшаяся почти вместе — делит ширину колонки, иначе от
        // нижней осталась бы щель в одну букву. Порог — высота одной строки заголовка в минутах.
        var nearMs = Math.max(30, Math.round(32 / (calHour() || 44) * 60)) * 60e3;
        g.items.forEach(function (o) {
          var under = g.items.filter(function (x) { return x._lane < o._lane && x.start < o.end && o.start < x.end; });
          var near = under.some(function (x) { return o.start - x.start < nearMs; });
          var base = under.reduce(function (m, x) { return x._pct > m._pct || (x._pct === m._pct && x._px > m._px) ? x : m; }, { _pct: 0, _px: 3 });
          if (near) {
            o._pct = o._lane / n * 100; o._px = 3; o._rpct = (n - 1 - o._lane) / n * 100;
            // нижние полосы тоже становятся колонками: иначе верхняя закрыла бы их заголовок
            under.forEach(function (x) { x._rpct = Math.max(x._rpct || 0, (n - 1 - x._lane) / n * 100); });
          } else { o._pct = base._pct; o._px = base._px + (under.length ? 12 : 0); o._rpct = o._rpct || 0; }
        });
      });
      var bars = dayOcc.map(function (o) {
        var s = stream(o.streamId);
        var top = Math.max(0, (o.start - dFrom) / DAYMS) * 100;
        var height = Math.min(100 - top, ((Math.min(o.end, dTo) - Math.max(o.start, dFrom)) / DAYMS) * 100);
        var cont = o.start < dFrom, contAfter = o.end > dTo;
        var past = o.start <= nowMs();                 // запуск уже начался или прошёл — это история
        if (occLong(o)) return calLongBar(o, s, top, height, ro, past, contAfter || o.open);
        var depth = o._lane || 0;
        return '<button class="lv-bar lv-bar--' + stKey(s) +
          (ro ? " is-ro" : "") + (past ? " is-past" : "") + (depth ? " is-over" : "") + '" type="button" ' +
          'style="top:' + top.toFixed(2) + "%;height:" + Math.max(1, height).toFixed(2) +
          "%;left:calc(" + (o._pct || 0).toFixed(2) + "% + " + (o._px || 3) + "px);right:calc(" + (o._rpct || 0).toFixed(2) + "% + 3px);z-index:" + (1 + depth) + '" ' +
          'data-lv-occ="' + o.streamId + "|" + o.slotId + "|" + o.occDate + '" ' +
          (ro ? ' data-tip="' + UI.esc(T.calAllRO) + '"' : past ? ' data-tip="' + UI.esc(T.pastRun) + '"' : "") +
          'aria-label="' + UI.esc(s.name + ", " + UI.dt(new Date(o.start).toISOString(), calTz())) + '">' +
          '<span class="lv-bar__n">' + (cont ? "↑ " : "") + UI.esc(s.name) + (contAfter ? " ↓" : "") + "</span>" +
          '<span class="lv-bar__t">' + UI.time(new Date(o.start).toISOString(), calTz()) + "</span>" +
          calModeBadge(s) +
          // канал на полосе нужен только в обзоре: при одном канале он и так в шапке
          barMeta(o, s, ro) +
          (ro || past || !canStretch(s) ? "" : '<span class="lv-bar__grip" data-lv-resize="' + o.streamId + "|" + o.slotId + '"></span>') +
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
        '<div class="lv-cal__colhead" style="grid-column:' + (di + 1) + '"><span class="lv-cal__dh">' +
          '<b class="lv-cal__dnum">' + Number(d.slice(8)) + '</b><span class="lv-cal__dwd">' + wd3(d) + "</span></span>" +
          (dSec ? '<span class="lv-cal__dtot">' + UI.dur(Math.round(dSec)) + "</span>" : "") + "</div>" +
        '<div class="lv-cal__cells" style="grid-column:' + (di + 1) + '" data-lv-calcells="' + d + '">' + nowLine + bars + "</div></div>";
    }).join("");
    return '<div class="lv-cal__grid"><div class="lv-cal__axis"><div class="lv-cal__colhead lv-cal__zoom">' +
        '<button class="an-btn an-btn--secondary an-btn--tiny" type="button" data-lv-calzoom="-" aria-label="Shorter rows">−</button>' +
        '<button class="an-btn an-btn--secondary an-btn--tiny" type="button" data-lv-calzoom="+" aria-label="Taller rows">+</button>' +
      '</div><div class="lv-cal__topaxis' + (topRows ? "" : " is-empty") + '" style="height:' + topH + 'px"></div><div class="lv-cal__hours">' + hours + "</div></div>" +
      '<div class="lv-cal__cols" style="grid-template-columns:repeat(' + r.days.length + ', minmax(120px, 1fr))">' + top + cols + "</div></div>";
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
    return '<div class="lv-cal__month"><div class="lv-cal__wds">' + wdays + "</div>" +
      '<div class="lv-cal__mgrid">' + cells + "</div></div>";
  }

  // ---- карточка слота
  function calCard(o, anchor) {
    var s = stream(o.streamId), sl = (s.schedules || []).filter(function (x) { return x.id === o.slotId; })[0];
    var pl = content(s);
    var hours = (o.end - o.start) / 3600e3;
    var pop = popEl();
    pop.innerHTML = '<p class="lv-pop__t">' + UI.esc(s.name) + "</p>" +
      '<div class="lv-kv">' +
        kv("Destination", UI.esc(destName(s))) +
        (isMgr() ? kv("Author", UI.esc(authorName(s.authorId)) || '<span class="an-muted">—</span>') : "") +
        kv("Window", UI.dt(new Date(o.start).toISOString(), calTz()) + " → " +
          (o.open ? T.openEndVal.toLowerCase()
            : UI.day(new Date(o.start).toISOString(), calTz()) === UI.day(new Date(o.end).toISOString(), calTz())
              ? UI.time(new Date(o.end).toISOString(), calTz())
              : UI.dt(new Date(o.end).toISOString(), calTz()))) +
        kv("Duration", o.open ? T.openEndVal : UI.durHuman(hours * 3600)) +
        kv("Playlist", UI.esc(pl ? pl.name : "—")) +
        kv(o.open ? "One day on air" : "Window cost", "≈" + UI.money(hours * rateNum(s))) +

      "</div>" +
      '<div class="lv-pop__foot">' +
        btn("Open", "secondary", 'data-lv-calopen="' + s.id + '"') +
        // без слота править нечего; прошедший запуск — история независимо от состояния стрима,
        // идущий стрим не редактируется — та же причина, что на карточке
        (!sl ? "" : why("edit", s) || o.start <= nowMs()
          ? '<button class="an-btn an-btn--secondary an-btn--small is-off" type="button" aria-disabled="true" data-tip="' + UI.esc(o.start <= nowMs() ? T.pastRun : why("edit", s)) + '">Edit</button>' +
            '<button class="an-btn an-btn--danger an-btn--small is-off" type="button" aria-disabled="true" data-tip="' + UI.esc(o.start <= nowMs() ? T.pastRun : why("edit", s)) + '">Remove time</button>'
          : btn("Edit", "secondary", 'data-lv-caledit="' + s.id + "|" + sl.id + '"') +
            btn("Remove time", "danger", 'data-lv-calslotdel="' + s.id + "|" + sl.id + '"')) +
      "</div>";
    placePop(pop, anchor);
  }

  // ---- перенос и растягивание
  var DRAG = null;
  function calDragStart(e, bar, mode) {
    var cells = bar.closest("[data-lv-calcells]");
    if (!cells) return;
    var el = bar.closest(".lv-bar") || bar;
    if (el.classList.contains("is-past")) return;
    var parts = (el.getAttribute("data-lv-occ") || bar.getAttribute("data-lv-resize")).split("|");
    var rect = cells.getBoundingClientRect();
    DRAG = { mode: mode, streamId: parts[0], slotId: parts[1], occDate: parts[2] || null,
             y0: e.clientY, x0: e.clientX, h: rect.height, top: rect.top, day: cells.getAttribute("data-lv-calcells"),
             bar: el, h0: el.style.height, moved: false, ghosts: [] };
    e.preventDefault();
  }
  // Точка под курсором в координатах сетки: день — из колонки под мышью (или той, где
  // схватили полосу), минута — по высоте колонок, шаг 15 минут. Так конец окна можно
  // утянуть в соседний день, а не только вниз по своей колонке.
  function calPointAt(e) {
    var d = DRAG, under = document.elementFromPoint(e.clientX, e.clientY);
    var col = under && under.closest && under.closest("[data-lv-calday]");
    var min = Math.round(((e.clientY - d.top) / d.h) * 1440 / 15) * 15;
    return { day: col ? col.getAttribute("data-lv-calday") : d.day, min: Math.max(0, Math.min(1440, min)) };
  }
  // абсолютное начало схваченного запуска: правило хранит первый запуск, запуск — свою дату
  function occStartMs(sl, occDate) {
    var day0 = dayStartMs(partsIn(Date.parse(sl.start), calTz()).date, calTz());
    return dayStartMs(occDate || partsIn(Date.parse(sl.start), calTz()).date, calTz()) + (Date.parse(sl.start) - day0);
  }
  function calResizeEndAt(pt, sl, occDate) {
    var st = occStartMs(sl, occDate);
    var want = dayStartMs(pt.day, calTz()) + pt.min * 60e3;
    return st + Math.max(15 * 60e3, want - st);
  }
  function calTipEl() {
    var t = document.getElementById("lvDragTip");
    if (!t) { t = document.createElement("span"); t.id = "lvDragTip"; t.className = "lv-bar__drag"; document.body.appendChild(t); }
    return t;
  }
  function calTipHide() { var t = document.getElementById("lvDragTip"); if (t) t.remove(); }
  function calGhostsClear() { (DRAG && DRAG.ghosts || []).forEach(function (g) { g.remove(); }); if (DRAG) DRAG.ghosts = []; }
  // Полоса едет за курсором с шагом 15 минут, а бадж у курсора называет новое окно и изменение
  // длины: без этого перенос выглядел так, будто ничего не происходит, пока не отпустишь кнопку.
  function calDragPreview(e) {
    var d = DRAG, s = stream(d.streamId), sl = s && (s.schedules || []).filter(function (x) { return x.id === d.slotId; })[0];
    if (!sl) return;
    var stepPx = d.h / 96;
    var dyMin = Math.round(((e.clientY - d.y0) / d.h) * 1440 / 15) * 15;
    var dyPx = dyMin / 15 * stepPx;
    var st = occStartMs(sl, d.occDate), len0 = Date.parse(sl.end) - Date.parse(sl.start);
    var start = st, end = st + len0, text;
    if (d.mode === "resize") {
      end = calResizeEndAt(calPointAt(e), sl, d.occDate);
      var colFrom = dayStartMs(d.day, calTz()), colTo = colFrom + DAYMS;
      d.bar.style.height = Math.max(2, (Math.min(end, colTo) - Math.max(start, colFrom)) / DAYMS * d.h) + "px";
      // хвост в следующих днях: призрачные полосы в тех колонках, что видны на экране
      calGhostsClear();
      for (var dayMs = colTo; dayMs < end; dayMs += DAYMS) {
        var cells = document.querySelector('[data-lv-calcells="' + partsIn(dayMs, calTz()).date + '"]');
        if (!cells) continue;
        var g = document.createElement("div");
        g.className = d.bar.className.replace("is-dragging", "") + " is-ghost";
        g.style.top = "0"; g.style.height = Math.max(2, (Math.min(end, dayMs + DAYMS) - dayMs) / DAYMS * 100) + "%";
        cells.appendChild(g); d.ghosts.push(g);
      }
      var delta = (end - start) - len0;
      text = UI.durHuman((end - start) / 1000) +
        (delta ? " (" + (delta > 0 ? "+" : "−") + UI.durHuman(Math.abs(delta) / 1000) + ")" : "") +
        " · ends " + (partsIn(end, calTz()).date === d.day ? UI.time(new Date(end).toISOString(), calTz()) : UI.dt(new Date(end).toISOString(), calTz()).replace(",", ""));
    } else {
      d.bar.style.transform = "translate(" + (e.clientX - d.x0) + "px," + dyPx + "px)";
      var p = calPointAt(e), shift = dyMin * 60e3;
      if (p.day !== d.day) shift += dayStartMs(p.day, calTz()) - dayStartMs(d.day, calTz());
      start += shift; end += shift;
      text = UI.dt(new Date(start).toISOString(), calTz()).replace(",", "") + " → " +
        UI.time(new Date(end).toISOString(), calTz()) +
        (shift ? " · " + shiftLabel(shift) : "");
    }
    var tip = calTipEl();
    tip.textContent = text;
    tip.style.background = getComputedStyle(d.bar).color;
    tip.style.left = (e.clientX + 14) + "px"; tip.style.top = (e.clientY + 18) + "px";
  }
  // Открытая карточка окна: нажатие на пустую сетку только закрывает её вместе с подложкой;
  // следующее нажатие работает как обычно (решение владельца 08.09).
  var CAL_DOWN = null;
  document.addEventListener("mousedown", function (e) {
    if (PAGE !== "calendar") return;
    CAL_DOWN = null;
    if (DRAWN && !(e.target.closest && e.target.closest(".lv-cal__drawbar"))) {
      var onEmpty = e.target.closest && e.target.closest("[data-lv-calcells]") && !e.target.closest("[data-lv-occ]");
      calDrawDrop();
      if (onEmpty) { e.preventDefault(); return; }
    }
    var popOpen = document.querySelector("[data-lv-pop]:not([hidden])");
    if (popOpen && !(e.target.closest && (e.target.closest("[data-lv-pop]") || e.target.closest("[data-lv-occ]")))) {
      var onGrid = e.target.closest && (e.target.closest("[data-lv-calcells]") || e.target.closest(".lv-cal__mcell"));
      if (onGrid) { closePop(); e.preventDefault(); return; }
    }
    var emptyCard = document.querySelector("[data-lv-calempty]");
    if (emptyCard && !emptyCard.hidden) return;
    if (calAll()) return;                                // обзор всех каналов — только чтение
    var grip = e.target.closest && e.target.closest("[data-lv-resize]");
    if (grip) { calDragStart(e, grip, "resize"); return; }
    var bar = e.target.closest && e.target.closest("[data-lv-occ]");
    if (bar && PAGE === "calendar" && CALV.scale !== "month") { calDragStart(e, bar, "move"); return; }
    if (CALV.scale !== "month" && e.target.closest && e.target.closest("[data-lv-calcells]")) CAL_DOWN = { x: e.clientX, y: e.clientY };
  });
  document.addEventListener("mousemove", function (e) {
    if (!DRAG) return;
    if (Math.abs(e.clientY - DRAG.y0) > 4 || Math.abs(e.clientX - DRAG.x0) > 4) {
      DRAG.moved = true;
      DRAG.bar.classList.add("is-dragging");
    }
    if (DRAG.moved) calDragPreview(e);
  });
  document.addEventListener("mouseup", function (e) {
    if (!DRAG) return;
    var d = DRAG, pt = calPointAt(e);
    calGhostsClear(); calTipHide();
    DRAG = null;
    d.bar.classList.remove("is-dragging");
    d.bar.style.transform = ""; d.bar.style.height = d.h0 || "";
    if (!d.moved) return;                                   // обычный клик — карточка слота
    var s = stream(d.streamId), sl = (s.schedules || []).filter(function (x) { return x.id === d.slotId; })[0];
    if (!sl) return;
    // сдвиг по вертикали — время, по горизонтали — день
    var dyMin = Math.round(((e.clientY - d.y0) / d.h) * 1440 / 15) * 15;
    var newDay = pt.day;
    if (d.mode === "resize") {
      var lenMs = calResizeEndAt(pt, sl, d.occDate) - occStartMs(sl, d.occDate);
      var newEnd = Date.parse(sl.start) + lenMs;
      if (newEnd === Date.parse(sl.end)) return;
      var busy = channelBusy(s, { id: sl.id, start: sl.start, end: new Date(newEnd).toISOString() });
      if (busy) { renderCalendar(); UI.toast(busy.msg); return; }
      // растянутое рукой окно — уже выбор человека: луп без конца становится окном с концом
      sl.end = new Date(newEnd).toISOString(); sl.endSet = true;
      save(); renderCalendar();
      UI.toast("Window is now " + UI.durHuman((Date.parse(sl.end) - Date.parse(sl.start)) / 1000) +
        " · ≈" + UI.money(((Date.parse(sl.end) - Date.parse(sl.start)) / 3600e3) * rateNum(s)) + ".");
      return;
    }
    var shift = dyMin * 60e3;
    // день считается от колонки, где схватили: полоса, перетекшая с прошлого дня, не должна уезжать на сутки
    if (newDay && newDay !== d.day) {
      shift += (dayStartMs(newDay, calTz()) - dayStartMs(d.day, calTz()));
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
  function calMoveAsk(s, sl, occDate, shift) {
    var day0 = dayStartMs(partsIn(Date.parse(sl.start), calTz()).date, calTz());
    var cand = { id: sl.id, tz: sl.tz || TZ,
      start: new Date(dayStartMs(occDate, calTz()) + (Date.parse(sl.start) - day0) + shift).toISOString(),
      end: new Date(dayStartMs(occDate, calTz()) + (Date.parse(sl.end) - day0) + shift).toISOString() };
    var busy = channelBusy(s, cand);
    if (busy) { renderCalendar(); UI.toast(busy.msg); return; }
    sl.start = cand.start; sl.end = cand.end;
    save(); renderCalendar();
    UI.toast("Window moved to " + UI.dt(cand.start, calTz()).replace(",", "") + ".");
  }
  function calNewAt(start) {
    location.href = ctxUrl("live-stream-create.html?start=" + encodeURIComponent(new Date(start).toISOString()));
  }
  var DRAWN = null;
  function calDrawAt(cells, start) {
    calDrawDrop();
    var a = (start - dayStartMs(cells.getAttribute("data-lv-calcells"), calTz())) / 60e3, b = Math.min(1440, a + 60);
    var ghost = document.createElement("div");
    ghost.className = "lv-cal__draw";
    ghost.style.top = (a / 1440 * 100).toFixed(2) + "%";
    ghost.style.height = ((b - a) / 1440 * 100).toFixed(2) + "%";
    ghost.innerHTML = '<span class="lv-cal__draw__t">New stream</span><span class="lv-cal__draw__w">' + UI.time(new Date(start).toISOString(), calTz()) + "</span>";
    cells.appendChild(ghost);
    ghost.classList.toggle("is-tiny", ghost.offsetHeight < 30);
    var bar = document.createElement("div");
    bar.className = "lv-cal__drawbar";
    bar.innerHTML = '<span class="lv-cal__drawbar__w">Starts ' + UI.dt(new Date(start).toISOString(), calTz()) + "</span>" +
      btn("Create stream", "primary", "data-lv-drawadd") +
      '<button class="mc-more" type="button" data-lv-drawcancel aria-label="Discard">' + (IC.close || "") + "</button>";
    document.body.appendChild(bar);
    DRAWN = { start: start, ghost: ghost, bar: bar };
    calDrawPlace();
    bar.querySelector("[data-lv-drawadd]").focus();
  }
  function calDrawPlace() {
    if (!DRAWN) return;
    var bar = DRAWN.bar, r = DRAWN.ghost.getBoundingClientRect(), w = bar.offsetWidth, h = bar.offsetHeight;
    bar.style.left = Math.round(Math.max(12, Math.min(r.left, window.innerWidth - w - 12))) + "px";
    var top = r.bottom + h + 12 <= window.innerHeight ? r.bottom + 6 : r.top - h - 6;
    bar.style.top = Math.round(Math.max(12, Math.min(top, window.innerHeight - h - 12))) + "px";
  }
  function calDrawDrop() {
    if (!DRAWN) return;
    DRAWN.ghost.remove();
    DRAWN.bar.remove();
    DRAWN = null;
  }
  document.addEventListener("scroll", function () { if (DRAWN) calDrawPlace(); }, true);
  window.addEventListener("resize", function () { if (DRAWN) calDrawPlace(); });
  document.addEventListener("keydown", function (e) { if (DRAWN && e.key === "Escape") calDrawDrop(); });
  document.addEventListener("click", function (e) {
    var down = CAL_DOWN;
    CAL_DOWN = null;
    if (!down || PAGE !== "calendar" || CALV.scale === "month" || calAll()) return;
    if (Math.abs(e.clientX - down.x) > 4 || Math.abs(e.clientY - down.y) > 4) return;
    var cells = e.target.closest && e.target.closest("[data-lv-calcells]");
    if (!cells || e.target.closest("[data-lv-occ]") || e.target.closest("[data-lv-resize]")) return;
    var r = cells.getBoundingClientRect(), ratio = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    var start = dayStartMs(cells.getAttribute("data-lv-calcells"), calTz()) + Math.floor((ratio * 1440) / 30) * 30 * 60e3;
    if (start < nowMs()) { UI.toast("That time has already passed."); return; }
    calDrawAt(cells, start);
  });
  function calFiltersPopover(anchor) {
    var pop = popEl();
    // канал теперь не фильтр, а режим просмотра — он живёт в шапке
    pop.innerHTML = '<p class="lv-pop__t">Status</p>' +
      CAL_ST_GROUPS.map(function (g) {
        return '<div class="lv-pop__row"><span>' + g.label + "</span>" +
          UI.switchHtml('data-lv-calf="statuses:' + g.k + '"', CALV.statuses.indexOf(g.k) !== -1, g.label) + "</div>";
      }).join("") +
      (isMgr() ? '<p class="lv-pop__t" style="margin-top:10px">Author</p>' +
        members().filter(function (p) { return streamAuthors().indexOf(p.id) !== -1; }).map(function (p) {
          return '<div class="lv-pop__row"><span' + (p.status === "removed" ? ' class="an-muted"' : "") + ">" + UI.esc(p.name) + "</span>" +
            UI.switchHtml('data-lv-calf="authors:' + p.id + '"', CALV.authors.indexOf(p.id) !== -1, p.name) + "</div>";
        }).join("") : "") +
      '<div class="lv-pop__foot">' + btn("Clear all", "secondary", "data-lv-calclear") + "</div>";
    placePop(pop, anchor);
  }


  // ============================================================ настройки организации (вариант org)
  var ORGV = { tab: null };
  var ORG_DRAFT = null;
  var MEMV = { q: "", role: "all", checked: [] };
  var ADD = { email: "", role: "user" };
  var ORG_TYPES = [
    { k: "individual", l: "Individual", d: "One person — you as a creator. No legal details needed." },
    { k: "business", l: "Business", d: "Company or sole trader. Legal details can be added for payouts." }
  ];
  var ROLE_OPTS = [{ value: "owner", label: "Owner" }, { value: "manager", label: "Manager" }, { value: "user", label: "User" }];
  function orgTab() {
    if (!ORGV.tab) {
      var t = new URLSearchParams(location.search).get("tab");
      ORGV.tab = t === "members" || t === "danger" ? t : "general";
    }
    if (ORGV.tab === "members" && !isMgr()) ORGV.tab = "general";
    return ORGV.tab;
  }
  function orgProfile() {
    if (!S.orgProfile) S.orgProfile = { name: CTX.org.name, type: CTX.org.type };
    return S.orgProfile;
  }
  function owners() { return members().filter(function (p) { return p.role === "owner" && p.status !== "removed"; }); }
  function lastOwner(p) { return !!p && p.role === "owner" && owners().length === 1; }
  function renderOrgSettings() {
    var host = document.querySelector("[data-lv-org]");
    if (!host) return;
    if (!inOrg()) { location.replace(ctxUrl("live-streams.html")); return; }
    var tab = orgTab();
    var tabs = [["general", "General"]].concat(isMgr() ? [["members", "Members"]] : []).concat([["danger", "Danger zone"]]);
    document.title = "Organization settings — SubSub";
    host.innerHTML =
      '<header class="an-head an-head--between"><div class="an-head__left"><h1 class="an-title">Organization settings</h1>' +
        '<span class="an-muted">' + UI.esc(orgProfile().name) + "</span></div></header>" +
      '<div class="nc-seg cc-seg lv-orgtabs" role="tablist" aria-label="Settings">' + tabs.map(function (x) {
        return '<button class="nc-seg__btn' + (tab === x[0] ? " is-active" : "") + (x[0] === "danger" ? " lv-orgtabs__danger" : "") + '" type="button" role="tab" data-lv-orgtab="' + x[0] + '"' +
          (tab === x[0] ? ' aria-selected="true"' : "") + ">" + (x[0] === "danger" ? (IC.attention || "") : "") + x[1] + "</button>";
      }).join("") + "</div>" +
      (tab === "general" ? orgGeneral() : tab === "members" ? orgMembers() : orgDanger());
  }
  function orgGeneral() {
    var pr = orgProfile(), d = ORG_DRAFT || pr;
    var typeOf = function (k) { return ORG_TYPES.filter(function (t) { return t.k === k; })[0] || ORG_TYPES[1]; };
    var form = isMgr()
      ? '<div class="lv-form">' +
          field("Organization name *", '<input class="an-input" type="text" value="' + UI.esc(d.name) + '" data-lv-orgf="name" aria-label="Organization name" />') +
          '<div class="ai-field"><span class="ai-lbl">Organization type</span><div class="lv-kv">' + ORG_TYPES.map(function (t) {
            var on = d.type === t.k;
            return '<label class="lv-radio' + (on ? " is-active" : "") + '"><input type="radio" name="lvOrgType" value="' + t.k + '"' + (on ? " checked" : "") + ' data-lv-orgf="type" />' +
              "<span>" + t.l + '<span class="lv-radio__d">' + t.d + "</span></span></label>";
          }).join("") + "</div></div>" +
          '<div class="lv-form__row">' + btn("Cancel", "secondary", "data-lv-orgcancel") + btn("Save changes", "primary", "data-lv-orgsave") + "</div>" +
        "</div>"
      : '<div class="lv-kv">' + kv("Organization name", UI.esc(pr.name)) + kv("Organization type", UI.esc(typeOf(pr.type).l)) + "</div>";
    return '<section class="rp-card lv-orgcard"><div class="lv-card__h"><h2 class="lv-card__t">General</h2></div>' +
      '<div class="lv-card__b">' + form + "</div></section>";
  }
  function orgSave() {
    var d = ORG_DRAFT || orgProfile();
    var name = String(d.name || "").trim();
    if (!name) { UI.toast("Name can’t be empty"); return; }
    S.orgProfile = { name: name, type: d.type };
    ORG_DRAFT = null;
    save(); renderOrgSettings(); orgShellNames();
    UI.toast("Organization settings saved.");
  }
  function memberHtml(p, you) {
    return '<span class="lv-chan lv-author"><span class="an-chan__ava" style="background:' + p.color + '">' + UI.esc(p.initial) + "</span>" +
      '<span class="lv-chan__col"><span class="lv-chan__n">' + UI.esc(p.name) + (you ? ' <span class="an-muted">(you)</span>' : "") + "</span>" +
      '<span class="lv-author__sub">' + UI.esc(p.email) + "</span></span></span>";
  }
  function orgMembers() {
    var segs = [["all", "All"], ["owner", "Owner"], ["manager", "Manager"], ["user", "User"]];
    return '<div class="ml-toolbar lv-orgbar">' +
        '<div class="an-search" style="max-width:360px">' + (IC.search || "") + '<input class="an-search__input" type="text" placeholder="Search by name or email" value="' + UI.esc(MEMV.q) + '" data-lv-memq aria-label="Search members" /></div>' +
        seg("Role", segs.map(function (x) { return { k: x[0], l: x[1] }; }), MEMV.role, "data-lv-memrole") +
        '<span class="lv-orgbar__spacer"></span>' +
        btn("Export CSV", "secondary", "data-lv-memexport", IC.download) +
        btn("Add member", "primary", "data-lv-memadd", IC.plus) +
      "</div>" +
      '<div class="an-tablewrap an-tablewrap--surface"><div class="an-table an-table--grid" data-lv-memtable>' + memberTable() + "</div></div>";
  }
  function memberTable() {
    var q = MEMV.q.toLowerCase();
    var rows = members().filter(function (p) { return p.status !== "removed"; })
      .filter(function (p) { return MEMV.role === "all" || p.role === MEMV.role; })
      .filter(function (p) { return !q || p.name.toLowerCase().indexOf(q) !== -1 || p.email.toLowerCase().indexOf(q) !== -1; });
    var tpl = "48px minmax(240px,2fr) 170px 120px 150px 56px";
    return '<div class="an-tr an-tr--head" style="grid-template-columns:' + tpl + '">' +
        ["", "Name", "Role", "Status", "Joined", ""].map(function (h, i) { return '<div class="an-th' + (i === 5 ? " an-th--pinr" : "") + '">' + h + "</div>"; }).join("") + "</div>" +
      (rows.length ? rows.map(function (p) {
        var you = p.id === CTX.me, on = MEMV.checked.indexOf(p.id) !== -1;
        return '<div class="an-tr" style="grid-template-columns:' + tpl + '" data-lv-memrow="' + p.id + '">' +
          '<div class="an-td"><button class="an-check' + (on ? " is-checked" : "") + '" type="button" role="checkbox" aria-checked="' + on + '" data-lv-memcheck="' + p.id + '" aria-label="Select ' + UI.esc(p.name) + '">' + (IC.check || "") + "</button></div>" +
          '<div class="an-td">' + memberHtml(p, you) + "</div>" +
          '<div class="an-td lv-memrole">' + selTrig("memberRole", UI.selectValue({ label: roleLabel(p.role) }), { label: "Role" }, p.id) + "</div>" +
          '<div class="an-td"><span class="ml-tag ml-tag--pill ml-tag--' + (p.status === "invited" ? "muted" : "ok") + '">' + (p.status === "invited" ? "Invited" : "Active") + "</span></div>" +
          '<div class="an-td">' + (p.joined ? UI.day(p.joined, TZ) : '<span class="an-muted">—</span>') + "</div>" +
          '<div class="an-td an-td--acts an-td--pinr"><button class="mc-more" type="button" data-lv-memmenu="' + p.id + '" aria-label="Actions for ' + UI.esc(p.name) + '">' + (IC.more || "⋮") + "</button></div>" +
        "</div>";
      }).join("") : '<div class="an-blank"><p class="an-blank__title">No members match your search.</p></div>');
  }
  function memberSetRole(p, v) {
    if (!p || p.role === v) return;
    if (lastOwner(p)) { UI.toast(T.needOwner); return; }
    p.role = v; save(); renderOrgSettings();
  }
  function memberMenu(p, anchor) {
    UI.menu(anchor, [
      { label: "Remove from organization", icon: IC.trash, danger: true,
        off: lastOwner(p), reason: lastOwner(p) ? T.needOwner : "",
        onClick: function () { if (p.id === CTX.me) orgLeaveAsk(); else memberRemoveAsk(p); } }
    ]);
  }
  function memberRemoveAsk(p) {
    var m = modalShell("lvMemRm", "Remove " + p.name + " from the organization?",
      '<p class="an-modal__text">' + UI.esc(p.name) + "’s streams stay and keep running. The author field keeps the name with a <b>removed</b> marker.</p>" +
      '<p class="an-modal__text">Their channels stay with the organization.</p>',
      btn("Cancel", "secondary", "data-lv-close data-lv-focus") + btn("Remove", "danger", 'data-lv-do="memrm"'));
    m.querySelector('[data-lv-do="memrm"]').onclick = function () {
      p.status = "removed";
      MEMV.checked = MEMV.checked.filter(function (x) { return x !== p.id; });
      save(); UI.closeModals(); renderOrgSettings();
    };
  }
  function memberAddAsk() {
    var body = '<label class="lv-pop__t" for="lvMemEmail">Email</label>' +
      '<input class="an-input" id="lvMemEmail" type="email" value="' + UI.esc(ADD.email) + '" placeholder="name@example.com" />' +
      '<label class="lv-pop__t" style="margin-top:12px">Role</label>' +
      selTrig("addRole", UI.selectValue({ label: roleLabel(ADD.role) }), { label: "Role" });
    var m = modalShell("lvMemAdd", "Add member", body,
      btn("Cancel", "secondary", "data-lv-close") + btn("Add member", "primary", 'data-lv-do="memadd" data-lv-focus'));
    m.querySelector('[data-lv-do="memadd"]').onclick = function () {
      var email = m.querySelector("#lvMemEmail").value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { UI.toast("Enter an email to continue"); return; }
      var nm = email.split("@")[0];
      nm = nm.charAt(0).toUpperCase() + nm.slice(1);
      members().push({ id: "u" + Date.now(), name: nm, email: email, role: ADD.role, status: "invited", joined: null,
        initial: nm.charAt(0).toUpperCase(), color: "var(--color-avatar-" + (members().length % 7) + ")" });
      ADD = { email: "", role: "user" };
      save(); UI.closeModals(); renderOrgSettings();
    };
  }
  function orgDanger() {
    var last = lastOwner(me());
    return '<section class="rp-card lv-orgcard"><div class="lv-card__h"><h2 class="lv-card__t">Leave organization</h2></div>' +
      '<div class="lv-card__b lv-orgleave"><p class="an-modal__text">' + T.leaveNote + "</p>" +
      (last ? offBtn("Leave organization", "danger", T.needOwner) : btn("Leave organization", "danger", "data-lv-orgleave")) + "</div></section>";
  }
  function orgLeaveAsk() {
    if (lastOwner(me())) { UI.toast(T.needOwner); return; }
    var m = modalShell("lvLeave", "Leave organization?", '<p class="an-modal__text">' + T.leaveNote + "</p>",
      btn("Cancel", "secondary", "data-lv-close data-lv-focus") + btn("Leave organization", "danger", 'data-lv-do="leave"'));
    m.querySelector('[data-lv-do="leave"]').onclick = function () {
      UI.closeModals();
      location.href = ctxUrl(acctUrl("personal"));
    };
  }

  // ---- shell: navigation, topbar and the account menu
  function acctUrl(ws) {
    var file = location.pathname.split("/").pop();
    var keep = ["live-streams.html", "live-calendar.html", "live-playlists.html", "live-stream-create.html"];
    return (keep.indexOf(file) !== -1 ? file : "live-streams.html") + "?ws=" + ws + (CTX.roleParam ? "&role=" + CTX.roleParam : "");
  }
  function orgShellNames() {
    var nameEl = document.querySelector(".user-chip__name"), roleEl = document.querySelector(".user-chip__role");
    if (nameEl) nameEl.textContent = inOrg() ? orgProfile().name : ORGF.personal.name;
    if (roleEl) roleEl.textContent = inOrg() ? "Organization" : "Personal";
    var ava = document.querySelector(".user-chip__avatar");
    if (ava) {
      ava.classList.toggle("lv-acct__ava--org", inOrg());
      ava.innerHTML = inOrg() ? UI.esc(orgProfile().name.charAt(0).toUpperCase()) : (IC.user || "");
    }
  }
  function orgShell() {
    if (!ORGF) return;
    var side = CTX.on ? document.querySelector(".sidebar__col") : null;
    if (side) {
      var homeEl = side.querySelector(".sidebar__home"), hr = side.querySelector(".sidebar__hr");
      if (homeEl) homeEl.remove();
      if (hr) hr.remove();
      var list = side.querySelector(".sidebar__list");
      var live = list && list.querySelector('label[for="space-streams"]');
      var liveLi = live && live.closest("li");
      if (list && liveLi) {
        [].slice.call(list.children).forEach(function (li) { if (li !== liveLi) li.remove(); });
        var inert = function (label, img, icon) {
          return '<li><span class="sidebar-item is-off" aria-disabled="true" data-tip="' + T.inert + '">' +
            (img ? '<img src="icons/' + img + '" alt="" />' : '<span class="sidebar-item__chip">' + icon + "</span>") +
            '<span class="sidebar-item__label">' + label + "</span></span></li>";
        };
        liveLi.insertAdjacentHTML("beforebegin", inert("Fan Funding", "product_fanfunding.webp") + inert("Wallet", "product_wallet.webp"));
        liveLi.insertAdjacentHTML("afterend", inert("Media Library", "product_media_library.webp") + (inOrg() ? inert("Admin", null, IC.shield || "") : ""));
      }
    }
    orgShellNames();
    var chipBtn = document.querySelector(".user-chip");
    if (chipBtn) { chipBtn.setAttribute("aria-haspopup", "dialog"); chipBtn.setAttribute("aria-expanded", "false"); chipBtn.setAttribute("data-lv-acct", ""); }
  }
  function acctMenu(anchor) {
    var pop = popEl();
    pop.className = "lv-pop lv-acct";
    var v = me() || { name: ORGF.personal.name, email: (F.notifications && F.notifications.email) || "" };
    var orgActive = inOrg();
    var roleIn = orgActive ? CTX.role : ORGF.org.people[1].role;
    var orgName = orgActive ? orgProfile().name : ORGF.org.name;
    var person = function (sm) { return '<span class="lv-acct__ava' + (sm ? " lv-acct__ava--sm" : "") + '">' + (IC.user || "") + "</span>"; };
    var chk = '<span class="lv-acct__chk">' + (IC.check || "") + "</span>";
    var item = function (icon, label, extra, cls, attrs) {
      return '<button class="lv-acct__item' + (cls || "") + '" type="button" ' + (attrs || "data-lv-noop") + ">" + (icon || "") + "<span>" + label + "</span>" + (extra || "") + "</button>";
    };
    pop.innerHTML =
      '<div class="lv-acct__me">' + person() +
        '<span class="lv-acct__meta"><span class="lv-acct__name">' + UI.esc(v.name) + '</span><span class="lv-acct__sub">' + UI.esc(v.email) + "</span></span></div>" +
      '<div class="lv-acct__h"><span>WORKSPACES</span><button class="lv-acct__how" type="button" data-lv-noop>How it works?</button></div>' +
      '<div class="lv-acct__ws-list">' +
        '<div class="lv-acct__wsrow' + (orgActive ? "" : " is-active") + '">' +
          '<button class="lv-acct__ws" type="button" data-lv-ws="personal">' + person(true) +
            '<span class="lv-acct__meta"><span class="lv-acct__wsn">' + UI.esc(ORGF.personal.name) + "</span></span>" + (orgActive ? "" : chk) + "</button></div>" +
        '<div class="lv-acct__wsrow' + (orgActive ? " is-active" : "") + '">' +
          '<button class="lv-acct__ws" type="button" data-lv-ws="org">' +
            '<span class="lv-acct__ava lv-acct__ava--sm lv-acct__ava--org">' + UI.esc(orgName.charAt(0).toUpperCase()) + "</span>" +
            '<span class="lv-acct__meta"><span class="lv-acct__wsn">' + UI.esc(orgName) + '</span><span class="lv-acct__sub">' + roleLabel(roleIn) + "</span></span>" +
            (orgActive ? chk : "") + "</button>" +
          (orgActive ? '<a class="lv-acct__gear" href="' + ctxUrl("/organizations/" + encodeURIComponent(CTX.org.slug) + "/settings") + '" aria-label="Organization settings" data-tip="Organization settings">' + (IC.settings || "") + "</a>" : "") +
        "</div>" +
        '<button class="lv-acct__create" type="button">' + (IC.plus || "") + "Create organization</button>" +
      "</div>" +
      '<div class="lv-acct__list">' + item(IC.settings, "Settings") + item(IC.gift, "Affiliate program") +
        item(IC.monitor, "Install app", '<span class="lv-acct__new">NEW</span>') + "</div>" +
      '<div class="lv-acct__foot">' +
        '<div class="lv-acct__lang" role="radiogroup" aria-label="Language">' +
          '<button class="lv-acct__langbtn is-active" type="button" role="radio" aria-checked="true"><span class="lv-acct__flag lv-acct__flag--us" aria-hidden="true"></span>EN</button>' +
          '<button class="lv-acct__langbtn" type="button" role="radio" aria-checked="false" data-lv-noop><span class="lv-acct__flag lv-acct__flag--ua" aria-hidden="true"></span>UA</button></div>' +
        item(IC.logout, "Log out", "", " lv-acct__item--danger") +
      "</div>";
    var place = function () {
      var r = anchor.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
      var left = Math.max(12, Math.min(r.right - w, window.innerWidth - w - 12));
      var top = r.bottom + 8 + h + 12 <= window.innerHeight ? r.bottom + 8 : Math.max(12, window.innerHeight - h - 12);
      pop.style.left = Math.round(left) + "px";
      pop.style.top = Math.round(top + window.scrollY) + "px";
    };
    pop.hidden = false;
    place();
    requestAnimationFrame(place);
    anchor.setAttribute("aria-expanded", "true");
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
      }).join("");
  }

  // ============================================================ Э8 · channel connection for extended analytics
  // The real flow goes through Google consent and comes back; the prototype simulates the return.
  function ytConnectAsk() {
    var m = modalShell("lvYTAdd", "Connect channel",
      '<p class="an-modal__text">Google asks for permission to read the channel’s analytics. Nothing on the channel is changed or published.</p>' +
      '<p class="an-modal__text">Extended analytics appears on the stream page once the channel is connected.</p>',
      btn("Cancel", "secondary", "data-lv-close data-lv-focus") +
      btn("Continue with Google", "primary", 'data-lv-do="ytconnect"'));
    m.querySelector('[data-lv-do="ytconnect"]').onclick = function () {
      UI.closeModals();
      S.ytLinked = true; save(); render();
      UI.toast("Channel connected — extended analytics is on its way.");
    };
  }

  // ============================================================ обработчики
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (UI.isOff(t.closest && t.closest(".is-off"))) return;

    var mst = t.closest && t.closest("[data-lv-mstrig]");
    if (mst) {
      var msw = mst.closest("[data-lv-ms]"), msk = msw.getAttribute("data-lv-ms"), wasOpen = MSOPEN === msk;
      msClose();
      if (!wasOpen) {
        msw.classList.add("is-open");
        msw.querySelector("[data-lv-msmenu]").hidden = false;
        mst.setAttribute("aria-expanded", "true");
        MSOPEN = msk;
        var msi = msw.querySelector("[data-lv-msq]");
        if (msi) msi.focus();
      }
      return;
    }
    var mso = t.closest && t.closest("[data-lv-msopt]");
    if (mso) {
      var mk = mso.closest("[data-lv-ms]").getAttribute("data-lv-ms"), mv = mso.getAttribute("data-lv-msopt"), marr = S.filters[mk];
      var mon = marr.indexOf(mv) === -1;
      S.filters[mk] = mon ? marr.concat([mv]) : marr.filter(function (x) { return x !== mv; });
      mso.classList.toggle("is-selected", mon);
      mso.setAttribute("aria-selected", mon ? "true" : "false");
      msSync(mk);
      save(); renderList();
      return;
    }
    if (MSOPEN && !(t.closest && t.closest("[data-lv-ms]"))) msClose();
    var menuBtn = t.closest && t.closest("[data-lv-menu-for]");
    if (menuBtn) {
      var s0 = stream(menuBtn.getAttribute("data-lv-menu-for"));
      if (s0) menuFor(s0, menuBtn, !!document.querySelector("[data-lv-detail]"));
      return;
    }

    var row = t.closest && t.closest("[data-lv-row-id]");
    if (row && !t.closest("[data-lv-menu-for]")) {
      location.href = ctxUrl(streamHref(stream(row.getAttribute("data-lv-row-id")) || { id: row.getAttribute("data-lv-row-id") }));
      return;
    }

    if (t.closest && t.closest("[data-lv-cols]")) { colsPopover(t.closest("[data-lv-cols]")); return; }
    if (t.closest && t.closest("[data-lv-filters]")) { filtersPopover(t.closest("[data-lv-filters]")); return; }
    // ---- уведомления и YouTube
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
    if (t.closest && t.closest("[data-lv-calclear]")) { CALV.statuses = []; CALV.authors = []; closePop(); renderCalendar(); return; }
    if (t.closest && t.closest("[data-lv-calemptyclose]")) { CALV.emptyDismissed = true; renderCalendar(); return; }
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
    if (copen) { location.href = ctxUrl("live-stream.html?id=" + encodeURIComponent(copen.getAttribute("data-lv-calopen"))); return; }
    var cedit = t.closest && t.closest("[data-lv-caledit]");
    if (cedit) {
      var ce = cedit.getAttribute("data-lv-caledit").split("|");
      location.href = ctxUrl("live-stream.html?id=" + encodeURIComponent(ce[0]) + "&edit=time&time=" + encodeURIComponent(ce[1]));
      return;
    }
    var cdel = t.closest && t.closest("[data-lv-calslotdel]");
    if (cdel) {
      var dp = cdel.getAttribute("data-lv-calslotdel").split("|");
      var ds = stream(dp[0]);
      ds.schedules = ds.schedules.filter(function (x) { return x.id !== dp[1]; });
      if (!ds.schedules.length && ds.virtual_status === "scheduled") ds.virtual_status = null;
      save(); closePop(); renderCalendar(); UI.toast("Time removed."); return;
    }
    var occEl = t.closest && t.closest("[data-lv-occ]");
    if (occEl) {
      // подложка длинного окна в сетке показывается только пока открыта его карточка
      var occKey = occEl.getAttribute("data-lv-occ");
      calUnderlays(null);
      if (occEl.classList.contains("lv-tbar") || occEl.classList.contains("lv-bar--long")) calUnderlays(occKey);
      var op = occKey.split("|");
      var os = stream(op[0]);
      // эфир без окна: карточка от начала прогона, без слота
      if (op[1] === "run") {
        var rs0 = Date.parse((runOf(os) || {}).start || new Date(nowMs()).toISOString());
        calCard({ streamId: os.id, slotId: "run", start: rs0, end: rs0 + DAYMS, occDate: op[2], open: true }, occEl);
        return;
      }
      var osl = (os.schedules || []).filter(function (x) { return x.id === op[1]; })[0];
      if (osl) {
        var occs = expand(os, osl, dayStartMs(op[2], calTz()), dayStartMs(op[2], calTz()) + DAYMS);
        var occ = occs.filter(function (x) { return x.occDate === op[2]; })[0] || occs[0];
        if (occ) calCard(occ, occEl);
      }
      return;
    }
    if (t.closest && t.closest("[data-lv-drawadd]")) { if (DRAWN) calNewAt(DRAWN.start); return; }
    if (t.closest && t.closest("[data-lv-drawcancel]")) { calDrawDrop(); return; }
    if (t.closest && t.closest("[data-lv-calcells]")) return;
    var mcell = t.closest && t.closest("[data-lv-calday]");
    if (mcell && CALV.scale === "month" && !t.closest("[data-lv-occ]")) return;   // в месяце окна не заводят кликом
    // ---- форма стрима
    var prep = t.closest && t.closest('[data-lv-act="prepare"]');
    if (prep && !document.querySelector("[data-lv-detail]")) {
      var plp = document.querySelector("[data-lv-pleditor]") ? plTarget() : formPl();
      if (plp) askPrepare(plp);
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
      if (!FORM.loop) FORM.endMode = "none";
      formSyncEnds(); renderForm();
      return;
    }
    var emd = t.closest && t.closest("[data-lv-endmode]");
    if (emd && FORM) {
      FORM.endMode = emd.getAttribute("data-lv-endmode");
      if (FORM.endMode === "loops" && !(FORM.loopLimit > 0)) FORM.loopLimit = 3;
      if (FORM.endMode === "until") FORM.untilSlot = { id: "until", start: new Date(nowMs()).toISOString(), end: formUntilDefault() };
      formSyncEnds(); renderForm();
      return;
    }
    var ck = t.closest && t.closest("[data-lv-copykey]");
    if (ck) { copyKey(ck.getAttribute("data-lv-copykey")); return; }
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
        FORM.queue = []; FORM.srcPl = null; FORM.detached = false; FORM.limitErr = false;
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
    if (t.closest && t.closest("[data-lv-quicksubmit]")) { formSubmit(); return; }
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
    // Change на шаге обзора: на шаг и к его группе — карты шагов для трёх групп одного шага мало
    var wgo = t.closest && t.closest("[data-lv-wzgo]");
    if (wgo && FORM) {
      var gp = wgo.getAttribute("data-lv-wzgo").split(":");
      WZ.step = Math.max(1, Math.min(WZ_STEPS.length, Number(gp[0]) || 1));
      renderForm();
      var tgt = document.querySelector('[data-lv-group="' + gp[1] + '"]');
      if (tgt) tgt.scrollIntoView({ block: "start" });
      return;
    }
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
    if (t.closest && t.closest("[data-lv-dttoday]") && DTP) {
      var slTd = formSlotRef(DTP.slId);
      if (slTd) {
        var oldTd = Date.parse(slTd[DTP.which]);
        var minsTd = oldTd - dayStartMs(partsIn(oldTd, FORM.tz).date, FORM.tz);
        var todayTd = partsIn(nowMs(), FORM.tz).date;
        DTP.view = todayTd.slice(0, 7);
        delete slTd.unset;
        dtSet(slTd, DTP.which, dayStartMs(todayTd, FORM.tz) + minsTd);
        var anTd = document.querySelector('[data-lv-dt="' + DTP.slId + ":" + DTP.which + '"]');
        if (anTd) dtPopRender(anTd); else closePop();
      }
      return;
    }
    var dtd = t.closest && t.closest("[data-lv-dtday]");
    if (dtd) {
      var sl9 = formSlotRef(DTP.slId);
      if (sl9) {
        var old = Date.parse(sl9[DTP.which]);
        var mins = old - dayStartMs(partsIn(old, FORM.tz).date, FORM.tz);
        DTP.view = dtd.getAttribute("data-lv-dtday").slice(0, 7);
        delete sl9.unset;
        dtSet(sl9, DTP.which, dayStartMs(dtd.getAttribute("data-lv-dtday"), FORM.tz) + mins);
      }
      closePop(); return;
    }
    var dtt = t.closest && t.closest("[data-lv-dttime]");
    if (dtt) {
      if (dtt.classList.contains("is-off")) return;
      var slT = formSlotRef(DTP.slId);
      if (slT) dtSet(slT, DTP.which, Number(dtt.getAttribute("data-lv-dttime")));
      closePop(); return;
    }
    if (t.closest && t.closest("[data-lv-autostart]")) {
      FORM.autoStart = FORM.autoStart === false;
      renderForm(); return;
    }
    var sm = t.closest && t.closest("[data-lv-startmode]");
    if (sm) {
      FORM.startMode = sm.getAttribute("data-lv-startmode");
      if (FORM.startMode === "schedule" && !FORM.schedules.length) formAddSlot();
      renderForm(); return;
    }
    if (t.closest && t.closest("[data-lv-slotadd]")) {
      if (FORM.schedules.length < MAX_SLOTS && !formOpen()) formAddSlot();
      renderForm(); return;
    }
    var sd = t.closest && t.closest("[data-lv-slotdel]");
    if (sd) {
      FORM.schedules = FORM.schedules.filter(function (x) { return x.id !== sd.getAttribute("data-lv-slotdel"); });
      renderForm(); return;
    }

    // ---- правки на странице стрима: секция, время, очередь
    var secE = t.closest && t.closest("[data-lv-secedit]");
    if (secE) {
      var sE = stream(new URLSearchParams(location.search).get("id")) || S.streams[0];
      if (sE) sectionOpen(sE, secE.getAttribute("data-lv-secedit"));
      return;
    }
    if (t.closest && t.closest("[data-lv-seccancel]")) { secModalClose(); return; }
    if (FORM && FORM.ctx === "dest" && t.closest && t.closest("#lvSecEdit") &&
        (t.closest("[data-lv-close]") || t.closest(".an-modal__overlay"))) { secModalClose(); return; }
    var secS = t.closest && t.closest("[data-lv-secsave]");
    if (secS && FORM) { sectionSave(secS.getAttribute("data-lv-secsave")); return; }
    if (t.closest && t.closest("[data-lv-qedit]")) {
      var sQ = stream(new URLSearchParams(location.search).get("id")) || S.streams[0];
      if (sQ) queueEditOpen(sQ);
      return;
    }
    if (t.closest && t.closest("[data-lv-qdone]") && FORM) { queueEditDone(); return; }
    if (t.closest && t.closest("[data-lv-qcancel]")) { FORM = null; UI.closeModals(); renderDetail(); return; }
    if (FORM && FORM.ctx === "queue" && t.closest && t.closest("#lvQEdit") &&
        (t.closest("[data-lv-close]") || t.closest(".an-modal__overlay"))) { FORM = null; return; }
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
      location.href = ctxUrl("live-playlist.html?id=" + encodeURIComponent(plr.getAttribute("data-lv-plrow")));
      return;
    }
    if (t.closest && t.closest("[data-lv-plnew]")) {
      // запись в списке появится только после первого сохранения
      location.href = ctxUrl("live-playlist.html");
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
    if (plrn) { if (playlist(plrn.getAttribute("data-lv-plrename"))) plRenameStart(); return; }
    if (t.closest && t.closest("[data-lv-export]")) { UI.toast("Export is prepared in the background — we’ll notify you when the file is ready."); return; }
    var scopeBtn = t.closest && t.closest("[data-lv-scopeset]");
    if (scopeBtn) { S.scope = scopeBtn.getAttribute("data-lv-scopeset"); save(); renderList(); return; }
    var acctBtn = t.closest && t.closest("[data-lv-acct]");
    if (acctBtn) {
      var popA = document.querySelector("[data-lv-pop]");
      if (popA && !popA.hidden && popA.classList.contains("lv-acct")) closePop(); else acctMenu(acctBtn);
      return;
    }
    var wsBtn = t.closest && t.closest("[data-lv-ws]");
    if (wsBtn) { location.href = ctxUrl(acctUrl(wsBtn.getAttribute("data-lv-ws"))); return; }
    if (t.closest && t.closest("[data-lv-noop]")) { e.preventDefault(); return; }
    var otab = t.closest && t.closest("[data-lv-orgtab]");
    if (otab) { ORGV.tab = otab.getAttribute("data-lv-orgtab"); ORG_DRAFT = null; renderOrgSettings(); return; }
    if (t.closest && t.closest("[data-lv-orgsave]")) { orgSave(); return; }
    if (t.closest && t.closest("[data-lv-orgcancel]")) { ORG_DRAFT = null; renderOrgSettings(); return; }
    if (t.closest && t.closest("[data-lv-orgleave]")) { orgLeaveAsk(); return; }
    var mrole = t.closest && t.closest("[data-lv-memrole]");
    if (mrole) { MEMV.role = mrole.getAttribute("data-lv-memrole"); renderOrgSettings(); return; }
    var mchk = t.closest && t.closest("[data-lv-memcheck]");
    if (mchk) {
      var mid = mchk.getAttribute("data-lv-memcheck");
      MEMV.checked = MEMV.checked.indexOf(mid) !== -1 ? MEMV.checked.filter(function (x) { return x !== mid; }) : MEMV.checked.concat([mid]);
      var tbl = document.querySelector("[data-lv-memtable]");
      if (tbl) tbl.innerHTML = memberTable();
      return;
    }
    if (t.closest && t.closest("[data-lv-memadd]")) { memberAddAsk(); return; }
    if (t.closest && t.closest("[data-lv-memexport]")) { UI.toast("Export is prepared in the background — we’ll notify you when the file is ready."); return; }
    var mmenu = t.closest && t.closest("[data-lv-memmenu]");
    if (mmenu) { var mp = person(mmenu.getAttribute("data-lv-memmenu")); if (mp) memberMenu(mp, mmenu); return; }
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
      S.filters = { status: [], dests: [], authors: [] };
      save(); closePop(); renderList(); return;
    }
    var nw = t.closest && t.closest("[data-lv-new]");
    if (nw) {
      var nm = nw.getAttribute("data-lv-new");
      location.href = ctxUrl("live-stream-create.html" + (nm === "now" || nm === "schedule" ? "?mode=" + nm : ""));
      return;
    }
    var nmenu = t.closest && t.closest("[data-lv-newmenu]");
    if (nmenu) {
      UI.menu(nmenu, [
        { label: "Schedule stream", icon: IC.calendar, onClick: function () { location.href = ctxUrl("live-stream-create.html?mode=schedule"); } },
        { label: "Quick stream", icon: IC.play, onClick: function () { location.href = ctxUrl("live-stream-create.html?mode=now"); } }
      ]);
      return;
    }
    if (t.closest && t.closest("[data-lv-topup]")) { location.href = ctxUrl("wallet.html?topup=1"); return; }
    if (t.closest && t.closest("[data-lv-plbackform]")) { plLeave(plBackTo() || "live-playlists.html"); return; }
    if (t.closest && t.closest("[data-an-back]")) { location.href = ctxUrl("live-streams.html"); return; }
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
      else if (a === "duplicate") doDuplicate(s);
      else if (a === "archive") askArchive(s);
      else if (a === "addtime") timeEditOpen(s, null);
      else if (a === "calendar") openCalendar(s, (s.schedules || [])[0]);
      else if (a === "addvideo") {
        if (PAGE === "playlist") { var pt = plTarget(); pickOpen({ kind: "playlist", id: pt.id || "__draft" }); }
        else UI.toast(T.needVideo);
      }
      else if (a === "prepare") askPrepare(content(s) || {});
      else if (a === "showbad") {
        var bad = readiness(content(s)).files || [];
        [].slice.call(document.querySelectorAll("[data-lv-row]")).forEach(function (r) {
          r.classList.toggle("is-missing", bad.indexOf(r.getAttribute("data-lv-row")) !== -1);
        });
        UI.toast(bad.length === 1 ? "1 file doesn’t match the others." : bad.length + " files don’t match the others.");
      }
      return;
    }
    // меню файла в очереди: клавиатурная альтернатива перетаскиванию
    var fm = t.closest && t.closest("[data-lv-fmenu]");
    if (fm && fm.closest("[data-lv-plqueue]")) {
      var pe2 = plById(fm.closest("[data-lv-plqueue]").getAttribute("data-lv-plqueue"));
      if (pe2) plFileMenu(pe2, fm.getAttribute("data-lv-fmenu"), fm);
      return;
    }
    if (fm && FORM) { formRowMenu(fm.getAttribute("data-lv-fmenu"), fm); return; }
    var slm = t.closest && t.closest("[data-lv-slotmenu]");
    if (slm) {
      var s3 = stream(new URLSearchParams(location.search).get("id"));
      var slid = slm.getAttribute("data-lv-slotmenu");
      UI.menu(slm, [
        { label: "Edit", icon: IC.edit, onClick: function () { timeEditOpen(s3, slid); } },
        { label: "Open in calendar", icon: IC.calendar, onClick: function () {
          openCalendar(s3, (s3.schedules || []).filter(function (x) { return x.id === slid; })[0]);
        } },
        { label: "Remove", icon: IC.trash, danger: true, onClick: function () { timeRemove(s3, slid); } }
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
    var tmp = p.items[i]; p.items[i] = p.items[j]; p.items[j] = tmp;
    p.updated = new Date(nowMs()).toISOString(); save(); render();
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
    var sl = formSlotRef(parts[0]);
    if (!sl) return;
    var k = parts[1];
    if (k === "start" || k === "end") {
      if (k === "end") sl.endSet = true;
      sl[k] = localIso(el.value) || sl[k]; formLight(); return;
    }
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
        (IC.calendar || "") + (sl.unset ? '<span class="an-muted">Select date</span>' : "<span>" + dayShort(iso, FORM.tz) + "</span>") + "</button>" +
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
    return FORM.endMode === "loops" && FORM.loopLimit > 0 ? FORM.loopLimit : 0;
  }
  function formOpen() { return !!FORM.loop && (FORM.endMode || "none") === "none"; }
  function formEnd() {
    if (!FORM.loop) return { mode: "none" };
    if (FORM.endMode === "loops") return { mode: "loops", loops: Math.max(1, FORM.loopLimit || 1) };
    if (FORM.endMode === "until") {
      if (FORM.startMode === "schedule" && FORM.schedules.length) return { mode: "until", until: FORM.schedules[0].end };
      if (FORM.untilSlot) return { mode: "until", until: FORM.untilSlot.end };
    }
    return { mode: "none" };
  }
  function formPlayback() { return { loop: FORM.loop, shuffle: FORM.shuffle, end: formEnd() }; }
  function formUntilDefault() {
    if (FORM.startMode === "schedule" && FORM.schedules.length) return FORM.schedules[0].end;
    return new Date(Math.ceil((nowMs() + 2 * 3600e3) / (15 * 60e3)) * 15 * 60e3).toISOString();
  }
  function formConvWait() { return FORM.startMode === "now" && !!convEta(formQueuePl()); }
  function formAutoStart() { return FORM.startMode !== "now" || FORM.autoStart !== false; }
  function nowStartLabel() {
    return !formAutoStart() ? "Starts when you press Start"
      : formConvWait() ? "Starts when conversion finishes" : "Starts right after creation";
  }
  function autoStartHtml(o) {
    return '<button class="lv-auto' + (o.off ? " is-off" : "") + '" type="button" role="checkbox" aria-checked="' + o.on + '" ' +
      (o.off ? 'aria-disabled="true"' : o.attr) + ">" +
      '<span class="an-check' + (o.on ? " is-checked" : "") + '">' + (IC.check || "") + "</span>" +
      '<span class="lv-auto__txt"><span class="lv-auto__l">' + o.label + "</span>" +
      (o.hint ? '<span class="an-hint">' + o.hint + "</span>" : "") + "</span></button>";
  }
  function autoStartBox() {
    return autoStartHtml({ on: FORM.autoStart !== false, attr: "data-lv-autostart", label: "Start automatically",
      hint: formConvWait()
        ? "The stream goes live as soon as conversion finishes — no need to come back and press Start."
        : "The stream goes live right after you create it." });
  }
  function formNowEnd() {
    var e = formEnd();
    if (!FORM.loop) return "ends when the queue ends";
    if (e.mode === "loops") return "ends after " + UI.plural(e.loops, "loop", "loops");
    if (e.mode === "until") return "ends at " + UI.dt(e.until, FORM.tz).replace(",", "");
    return "runs until you stop it";
  }
  function formCycleText(st, winH) {
    var e = formEnd(), sched = FORM.startMode === "schedule" && winH > 0;
    if (!FORM.loop) return "Play once · one pass" + (st.sec ? " (" + UI.dur(st.sec) + ")" : "");
    if (e.mode === "none") return "Loop · runs until you stop it";
    var ends = [];
    if (e.mode === "loops") ends.push("after " + UI.plural(e.loops, "loop", "loops") + (st.sec ? " (≈" + UI.dur(st.sec * e.loops) + ")" : ""));
    if (e.mode === "until") ends.push(sched ? "when the window ends (" + UI.time(e.until, FORM.tz) + ")" : "at " + UI.dt(e.until, FORM.tz).replace(",", ""));
    if (sched && e.mode === "loops") ends.push("when the window ends");
    return "Loop · ends " + ends.join(" or ") + (ends.length > 1 ? ", whichever comes first" : "");
  }
  function formSlotRef(id) {
    return FORM.schedules.filter(function (x) { return x.id === id; })[0] || (id === "until" && FORM.untilSlot ? FORM.untilSlot : null);
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
    return FORM.loop ? "Switch the loop end to Until time to choose the end yourself, or to No limit to run until you stop it."
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
    var fixed = formEndSec(), pass = formPassSec(), open = formOpen();
    FORM.schedules = FORM.schedules.slice(0, open ? 1 : MAX_SLOTS);
    FORM.schedules.forEach(function (sl) {
      // an open window keeps a one-day end in the data: cost counts one day, the calendar draws an endless bar
      if (open) { sl.end = new Date(Date.parse(sl.start) + DAYMS).toISOString(); return; }
      var broken = Date.parse(sl.end) <= Date.parse(sl.start);
      // сломанное окно лечим даже поверх своего выбора: конец раньше начала не бывает
      var len = fixed || (sl.endSet && !broken ? 0 : FORM.loop ? Math.max(pass, 7200) : pass);
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
    // другие времена этого же стрима: колесо не даёт залезть в их запуски. На странице стрима
    // остальные времена лежат на самом стриме, а не в FORM
    var ps = formPseudo();
    var day0 = dayStartMs(partsIn(Date.parse(sl[which]), FORM.tz).date, FORM.tz);
    var rFrom = day0 - DAYMS, rTo = day0 + 2 * DAYMS;
    var own = FORM.ctx === "time" ? ((stream(FORM.id) || {}).schedules || []) : FORM.schedules;
    (own || []).forEach(function (o) {
      if (o.id === sl.id) return;
      runsOf(ps, o, rFrom, rTo).forEach(function (r) {
        iv.push({ from: r.start, to: r.end,
          why: "Another run of this stream is on air " + UI.time(new Date(r.start).toISOString(), FORM.tz) +
            "–" + UI.time(new Date(r.end).toISOString(), FORM.tz) + "." });
      });
    });
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
    var sl = formSlotRef(slId);
    if (!sl) return;
    DTP = { slId: slId, which: which, view: partsIn(Date.parse(sl[which]), FORM.tz).date.slice(0, 7) };
    dtPopRender(anchor);
  }
  function dtPopRender(anchor) {
    var sl = formSlotRef(DTP.slId);
    var cur = partsIn(Date.parse(sl[DTP.which]), FORM.tz).date;
    var today = partsIn(nowMs(), FORM.tz).date;
    var away = DTP.view !== today.slice(0, 7);
    var cal = '<div class="an-dr__nav" style="grid-template-columns:32px 1fr ' + (away ? "32px " : "") + '32px">' +
      '<button class="an-dr__arrow" type="button" data-lv-dtnav="-1">' + (IC.chevLeft || "‹") + "</button>" +
      '<span class="an-dr__mon">' + monthName(DTP.view) + "</span>" +
      (away ? '<button class="an-dr__arrow" type="button" data-lv-dttoday aria-label="Today" data-tip="Today">' + (IC.restart || "") + "</button>" : "") +
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
    var sl = formSlotRef(TPP.slId);
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
    var sl = formSlotRef(TPP.slId);
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

  document.addEventListener("change", function (e) {
    if (e.target.closest && e.target.closest("[data-lv-pickfileinput]")) {
      pickUploadFiles(e.target.files);
      e.target.value = "";
      return;
    }
    if (e.target.closest && e.target.closest("[data-lv-qfile]") && FORM) {
      formQueueUpload(e.target.files);
      e.target.value = "";
    }
  });
  function dragHasFiles(e) {
    var ty = e.dataTransfer && e.dataTransfer.types;
    return !!ty && [].slice.call(ty).indexOf("Files") !== -1;
  }
  function dropZone(e) {
    var t = e.target && e.target.closest ? e.target : null;
    if (!t) return null;
    if (dragHasFiles(e) && t.closest("[data-lv-pickdrop]")) return t.closest("[data-lv-pickdrop]");
    return FORM && dragHasFiles(e) ? t.closest("[data-lv-qdrop]") : null;
  }
  document.addEventListener("dragover", function (e) {
    var z = dropZone(e);
    if (!z) return;
    e.preventDefault();
    z.classList.add("is-dragover");
  });
  document.addEventListener("dragleave", function (e) {
    var z = dropZone(e);
    if (z && !(e.relatedTarget && z.contains(e.relatedTarget))) z.classList.remove("is-over", "is-dragover");
  });
  document.addEventListener("drop", function (e) {
    var z = dropZone(e);
    if (!z) return;
    e.preventDefault();
    z.classList.remove("is-over", "is-dragover");
    var files = e.dataTransfer && e.dataTransfer.files;
    if (z.hasAttribute("data-lv-pickdrop")) { if (files && files.length) pickUploadFiles(files); return; }
    if (files && files.length) formQueueUpload(files);
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
    var kf = document.querySelector(".lv-keyf");
    if (kf) {
      kf.classList.toggle("is-filled", !!FORM.key);
      var km = kf.querySelector("[data-lv-keymask]");
      if (km) km.innerHTML = keyTail(FORM.key);
    }
    var ka = document.querySelector("[data-lv-keyalert]");
    if (ka) ka.innerHTML = keyAlert();
    if (FORM.ctx) {
      var sv = document.querySelector("[data-lv-secsave]");
      if (sv) UI.off(sv, !!sectionGate(FORM.ctx), sectionGate(FORM.ctx));
      return;
    }
    formSyncEnds();          // полоса значений считает по окну, поэтому оно всегда актуально
    var map = document.querySelector(".lv-wiz__map"), foot = document.querySelector(".lv-wiz__foot");
    if (!map || !foot) { renderForm(); return; }
    map.innerHTML = wizMapHtml();
    foot.innerHTML = wizFootHtml(wizBlocked(WZ.step));
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
    var fid = el.getAttribute("data-lv-file");
    if (fid) {
      var qroot = el.closest("[data-lv-plqueue]");
      if (qroot) {
        var pe = plById(qroot.getAttribute("data-lv-plqueue"));
        var pit = pe && pe.items.filter(function (i) { return i.fileId === fid; })[0];
        if (pit) { pit.off = !e.detail.on; renderPlEditor(); }
        return;
      }
      if (FORM) {
        var itF = formQueue().filter(function (i) { return i.fileId === fid; })[0];
        if (itF) { itF.off = !e.detail.on; formDetach(); renderForm(); }
      }
      return;
    }
    var ffs = el.getAttribute("data-lv-f");
    if (ffs && FORM) {
      if (ffs === "loop") { FORM.loop = e.detail.on; renderForm(); return; }
      if (ffs === "quickSched") {
        FORM.startMode = e.detail.on ? "schedule" : "now";
        FORM.endMode = e.detail.on ? "until" : "none";
        if (e.detail.on && !FORM.schedules.length) formAddSlot();
        formSyncEnds(); renderForm();
        return;
      }
      if (ffs === "shuffle") FORM.shuffle = e.detail.on;
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

  document.addEventListener("click", function (e) {
    if (PAGE !== "playlist" || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a || a.target === "_blank" || a.closest("[data-lv-pleditor] .lv-q") || /^#|^javascript:/.test(a.getAttribute("href"))) return;
    var pe = plTarget();
    if (!plDirtySaved(pe) && !plDirty()) return;
    e.preventDefault();
    e.stopPropagation();
    plLeave(a.getAttribute("href"));
  }, true);
  document.addEventListener("keydown", function (e) {
    if (!(e.target.matches && e.target.matches("[data-lv-plrn]"))) return;
    if (e.key === "Enter") { e.preventDefault(); plRenameEnd(true); }
    if (e.key === "Escape") { e.preventDefault(); plRenameEnd(false); }
  });
  document.addEventListener("focusout", function (e) {
    if (e.target.matches && e.target.matches("[data-lv-plrn]")) plRenameEnd(true);
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
    var msq = e.target.closest && e.target.closest("[data-lv-msq]");
    if (msq) {
      var ql = msq.value.trim().toLowerCase();
      [].forEach.call(msq.closest("[data-lv-ms]").querySelectorAll("[data-lv-msopt]"), function (o) {
        o.hidden = !!ql && o.textContent.toLowerCase().indexOf(ql) === -1;
      });
      return;
    }
    var mq = e.target.closest && e.target.closest("[data-lv-memq]");
    if (mq) {
      MEMV.q = mq.value.trim();
      var tbl2 = document.querySelector("[data-lv-memtable]");
      if (tbl2) tbl2.innerHTML = memberTable();
      return;
    }
    var of = e.target.closest && e.target.closest("[data-lv-orgf]");
    if (of) {
      ORG_DRAFT = ORG_DRAFT || clone(orgProfile());
      ORG_DRAFT[of.getAttribute("data-lv-orgf")] = of.value;
      if (of.type === "radio") renderOrgSettings();
      return;
    }
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
      if (key === "playlistId" || key === "tz") renderForm();
      else formLight();
      return;
    }
    var sl2 = e.target.closest && e.target.closest("[data-lv-slot]");
    if (sl2 && FORM) { formSlotEdit(sl2); return; }
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
      location.href = ctxUrl(streamHref(stream(row.getAttribute("data-lv-row-id")) || { id: row.getAttribute("data-lv-row-id") }));
    }
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

    // ============================================================ mobile mode (viewport below 768px)
  var MB = { seg: "now", chan: "__all", refreshedAt: Date.now(),
    offline: typeof navigator !== "undefined" && navigator.onLine === false, open: {}, pull: null };
  var M_DAY = 24 * 3600e3, M_START_DELAY = 10000;
  var M_LIVE_PAGES = ["streams", "stream", "form", "playlists", "playlist", "calendar", "settings", "org"];
  var MT = {
    offline: "You’re offline — actions need a connection.",
    waitUpload: "Wait for the upload to finish.",
    fix: "Fix on desktop.",
    finish: "Finish on desktop.",
    created: "Streams are created on desktop.",
    starting: "Waiting for the worker to confirm — it checks every 10 s.",
    stopping: "YouTube is ending the broadcast.",
    emptyNow: "Nothing is running right now.",
    emptyAll: "No other streams.",
    noSchedule: "No schedule — the stream runs until you stop it.",
    offSub: "This section is on desktop. Mobile shows only what’s on air.",
    createSub: "Set up the queue, destination and schedule on a computer.",
    noPushes: "This data set has no simulated notifications."
  };
  var M_OFF_PAGE = { playlists: "Playlists", playlist: "Playlists", calendar: "Calendar", settings: "Notification settings", org: "Organization settings" };

  function mMain() { return document.querySelector("[data-lv-mmain]"); }
  function mMount() {
    var main = document.querySelector("main.main");
    if (!main) return null;
    var host = main.querySelector("[data-lv-mmain]");
    if (!host) {
      host = document.createElement("div");
      host.className = "lv-m-main";
      host.setAttribute("data-lv-mmain", "");
      main.appendChild(host);
    }
    if (!document.querySelector("[data-lv-mfoot]")) {
      var foot = document.createElement("div");
      foot.className = "lv-m-foot";
      foot.setAttribute("data-lv-mfoot", "");
      foot.hidden = true;
      document.body.appendChild(foot);
    }
    document.body.classList.add("is-mob");
    return host;
  }
  function mUnmount() {
    var host = mMain(), foot = document.querySelector("[data-lv-mfoot]");
    if (host) host.remove();
    if (foot) foot.remove();
    mSheetClose();
    document.body.classList.remove("is-mob");
  }
  function renderMobile() {
    var host = mMount();
    if (!host) return;
    host.classList.toggle("is-qk", MB.view === "quick");
    if (MB.view === "quick") renderMQuick();
    else if (PAGE === "streams") renderMList();
    else if (PAGE === "stream") renderMStream();
    else renderMOff();
  }

  function mLastRun(s) { return (s.runs || []).filter(function (r) { return r.start; })[0] || null; }
  function mNextRun(s) {
    var best = null, n = nowMs();
    (s.schedules || []).forEach(function (sl) {
      runsOf(s, sl, n, horizonMs()).forEach(function (r) {
        if (r.end <= n) return;
        if (!best || r.start < best.start) best = { start: r.start, end: r.end, sl: sl };
      });
    });
    return best;
  }
  function mIn(ms) {
    var m = Math.max(0, Math.round(ms / 60000)), h = Math.floor(m / 60);
    m = m % 60;
    if (!h && !m) return "less than a minute";
    return (h ? h + "h" : "") + (h && m ? " " : "") + (m ? m + "m" : "");
  }
  function mWhen(ms) { return UI.dt(new Date(ms).toISOString(), TZ) + " (" + TZL + ")"; }
  function mWhenIn(ms) { return ms - nowMs() <= M_DAY ? "Starts in " + mIn(ms - nowMs()) : mWhen(ms); }
  function mSpent(s) {
    var r = runOf(s);
    if (!r || !r.start) return s.spentTotal || 0;
    return (r.spent || 0) + rateNum(s) * Math.max(0, Date.now() - M_LOAD) / 3600e3;
  }
  function mEstimate(s) {
    var st = plStats(content(s) || null), c = cost(s);
    var loops = s.playback && s.playback.loop ? loopsOf(s) : 1;
    if (!st.sec) return "Empty queue";
    if (loops) {
      var sec = st.sec * loops;
      return "Queue " + UI.durHuman(sec) + " · ≈" + UI.money(c.rate * sec / 3600) + " per run";
    }
    return "Queue " + UI.durHuman(st.sec) + " · loops until you stop it · ≈" + UI.money(c.perDay) + " / day";
  }
  function mBucket(s) {
    var k = stKey(s), n = nowMs();
    if (k === "archived") return null;
    if (k === "draft") return "all";
    if (k === "live" || k === "starting" || k === "preparing" || k === "stopping" || k === "ready" ||
        k === "uploading" || k === "fproc" || k === "needdest") return "now";
    if (k === "stopped") {
      var r = mLastRun(s), endMs = r && r.end ? Date.parse(r.end) : 0;
      return s.stopReason !== "you" && endMs && n - endMs <= M_DAY ? "now" : "all";
    }
    var nr = mNextRun(s);
    return nr && nr.start - n <= M_DAY ? "now" : "all";
  }
  var M_RANK = { live: 0, stopping: 1, starting: 2, preparing: 3, ready: 4, uploading: 4, fproc: 4, needdest: 4, needconv: 5, converting: 5, convfail: 5, cant: 5, scheduled: 6, stopped: 7 };
  function mTime(s) {
    var r = mLastRun(s);
    if (r) return Date.parse(r.end || r.start);
    var nr = mNextRun(s);
    if (nr) return nr.start;
    var evs = (s.runs || []).reduce(function (a, x) { return a.concat(x.events || []); }, []);
    return evs.length ? Date.parse(evs[0].at) : 0;
  }
  function mList(seg) {
    return vis().filter(function (s) {
      if (mBucket(s) !== seg) return false;
      return MB.chan === "__all" || destName(s) === MB.chan;
    }).sort(function (a, b) {
      if (seg === "now") {
        var ra = M_RANK[stKey(a)], rb = M_RANK[stKey(b)];
        var d = (ra == null ? 8 : ra) - (rb == null ? 8 : rb);
        if (d) return d;
        var na = mNextRun(a), nb = mNextRun(b);
        if (na && nb) return na.start - nb.start;
      }
      return mTime(b) - mTime(a);
    });
  }

  function mLine(txt, cls) { return '<p class="lv-m-line' + (cls ? " " + cls : "") + '">' + txt + "</p>"; }
  function mBar(ratio) {
    return '<div class="lv-m-bar" aria-hidden="true"><div class="lv-m-bar__f" style="width:' + Math.round(Math.max(0, Math.min(1, ratio)) * 100) + '%"></div></div>';
  }
  function mAction(s) {
    var k = stKey(s), off = MB.offline ? MT.offline : "";
    if (k === "uploading" || k === "fproc") {
      return { label: "Start now", mode: "primary", act: "start", id: s.id, why: off || (k === "uploading" ? MT.waitUpload : QT.procWait) };
    }
    if (k === "needdest") return { label: "Add destination", mode: "primary", act: "dest", id: s.id, why: off };
    if (k === "live" || k === "stopping") return { label: "Stop", mode: "danger", act: "stop", id: s.id, why: off || why("stop", s) };
    if (k === "ready") {
      var rd = readiness(content(s)), b = startBlock(s);
      var w = off || why("start", s) || (rd.state === "uploading" ? MT.waitUpload : b ? b.reason : "");
      return { label: "Start now", mode: "primary", act: "start", id: s.id, why: w,
        whyAct: !off && rd.state !== "uploading" && b && b.act ? b.act : "" };
    }
    if (k === "stopped" && s.stopReason === "balance" && !isUser()) return { label: T.topUp, mode: "primary", act: "topup", id: s.id, why: off };
    return null;
  }
  function mBtn(a) {
    if (!a) return "";
    var off = !!a.why;
    return '<div class="lv-m-act">' +
      '<button class="an-btn an-btn--' + a.mode + ' lv-m-btn' + (off ? " is-off" : "") + '" type="button" data-lv-mact="' + a.act +
        '" data-lv-mid="' + UI.esc(a.id) + '"' + (off ? ' aria-disabled="true"' : "") + ">" + UI.esc(a.label) + "</button>" +
      (off ? '<p class="lv-m-why">' + UI.esc(a.why) +
        (a.whyAct ? ' <button class="lv-m-link" type="button" data-lv-topup>' + UI.esc(a.whyAct) + "</button>" : "") + "</p>" : "") +
      "</div>";
  }
  function mStatus(s, k) {
    if (k === "live") {
      var r = runOf(s), sec = r && r.start ? (nowMs() - Date.parse(r.start)) / 1000 : 0;
      return '<div class="lv-m-card__st">' + stBadge("live") + '<span class="lv-m-timer" data-lv-mtimer="' + s.id + '">' + UI.dur(sec) + "</span></div>";
    }
    return '<div class="lv-m-card__st">' + stBadge(k, "", k === "uploading" ? qkUpLabel(s) : "") + "</div>";
  }
  function mStoppedLines(s) {
    var lr = mLastRun(s), dur = lr ? ((lr.end ? Date.parse(lr.end) : nowMs()) - Date.parse(lr.start)) / 1000 : 0;
    var bad = s.stopReason === "balance" || s.stopReason === "youtube";
    return mLine(UI.esc(stopReason(s) || "Stopped"), "lv-m-line--reason" + (bad ? " lv-m-line--bad" : "")) +
      mLine("Ran " + UI.durHuman(dur) + " · Spent " + UI.money(lr ? lr.spent : s.spentTotal));
  }
  function mBody(s, k) {
    if (k === "uploading") {
      var u = qkUpOf(s);
      return mLine(u.lost ? UI.plural(u.lost, "video needs", "videos need") + " picking again on the phone they came from." : QT.keepOpen,
        u.lost ? "lv-m-line--warn" : "lv-m-line--muted") + mBar(u.m ? u.done / u.m : 0);
    }
    if (k === "fproc" || k === "needdest") {
      var cs = k === "needdest" ? qkContentState(s) : null, u2 = cs === "uploading" ? qkUpOf(s) : null;
      return mLine(k === "fproc" ? QT.procLine : QT.needDest, k === "fproc" ? "lv-m-line--muted" : "lv-m-line--warn") +
        (u2 ? mLine("Uploading " + u2.n + " of " + u2.m, "lv-m-line--muted") + mBar(u2.m ? u2.done / u2.m : 0)
          : cs === "fproc" ? mLine(QT.procLine, "lv-m-line--muted") : "") +
        (s.autoStart ? mLine(QT.autoLine, "lv-m-line--muted") : "");
    }
    if (k === "live") return mLine('Spent so far <b data-lv-mspent="' + s.id + '">' + UI.money(mSpent(s)) + "</b>");
    if (k === "starting") return mLine(MT.starting);
    if (k === "stopping") return mLine(MT.stopping);
    if (k === "preparing") {
      var p = s.prep || {};
      return mLine(p.total ? "Fetching files · " + p.done + " of " + p.total : "Sending the files to the worker") + (p.total ? mBar(p.done / p.total) : "");
    }
    if (k === "ready") return mLine(mEstimate(s));
    if (k === "scheduled") {
      var nr = mNextRun(s), rd = readiness(content(s));
      return mLine(nr ? mWhenIn(nr.start) : "Not scheduled") +
        (rd.state !== "ready" ? mLine(UI.esc(rd.label), "lv-m-line--warn") : "");
    }
    if (k === "needconv" || k === "converting" || k === "convfail" || k === "cant") {
      var rd2 = readiness(content(s)), nr2 = mNextRun(s), tot = plStats(content(s) || null).count, bad = rd2.files.length;
      var blk = rd2.state !== "convert" ? rd2.label
        : tot === 1 ? "The file needs conversion" : bad + " of " + tot + " files " + (bad === 1 ? "needs" : "need") + " conversion";
      return mLine(UI.esc(blk), "lv-m-line--warn") +
        (nr2 ? mLine("Next run at risk · " + mWhen(nr2.start)) : "") +
        (k === "needconv" || k === "convfail" ? mLine("Deleted automatically on " + UI.day(autoDeleteIso(s), TZ) + " unless the files are converted.", "lv-m-line--warn") : "") +
        mLine(MT.fix, "lv-m-line--muted");
    }
    if (k === "stopped") return mStoppedLines(s);
    if (k === "draft") return mLine(MT.finish, "lv-m-line--muted");
    return "";
  }
  function mCard(s) {
    var k = stKey(s), a = k === "draft" ? null : mAction(s);
    return '<article class="lv-m-card lv-m-card--' + k + '" data-lv-mcard="' + s.id + '" tabindex="0" aria-label="' + UI.esc(s.name) + '">' +
      '<div class="lv-m-card__h">' + (k === "live" ? coverBox(coverOf(s), "lv-m-cover") : "") +
        '<div class="lv-m-card__t"><h2 class="lv-m-card__n">' + UI.esc(s.name) + (s.vr ? vrTag() : "") + "</h2>" + destHtml(s) + "</div></div>" +
      mStatus(s, k) + mBody(s, k) + mBtn(a) + "</article>";
  }

  function mUpdText() {
    var sec = Math.round((Date.now() - MB.refreshedAt) / 1000);
    if (MB.offline) return 'Offline · <span class="lv-m-upd__v">data from ' + UI.time(new Date(MB.refreshedAt).toISOString(), TZ) + "</span>";
    return 'Updated <span class="lv-m-upd__v">' + (sec < 60 ? "just now" : Math.floor(sec / 60) + " min ago") + "</span>";
  }
  // the refresh stamp and the prototype control sit in a strip under the shared header
  function mStrip() { return ""; }
  function mFoot(html) {
    var f = document.querySelector("[data-lv-mfoot]"), host = mMain();
    if (host) host.classList.toggle("is-footed", !!html);
    if (!f) return;
    f.innerHTML = html || "";
    f.hidden = !html;
  }
  function mBack() { return '<a class="lv-m-back" href="live-streams.html">' + (IC.chevLeft || "") + "Streams</a>"; }
  function mBlank(title, sub, back) {
    return '<div class="lv-m-blank"><h1 class="lv-m-h1">' + title + "</h1>" + (sub ? mLine(sub, "lv-m-line--muted") : "") +
      (back ? '<a class="an-btn an-btn--secondary lv-m-btn lv-m-blank__b" href="live-streams.html">Back to streams</a>' : "") + "</div>";
  }

  function renderMList() {
    var main = mMain();
    if (!main) return;
    document.title = "Streams — SubSub";
    if (!vis().some(function (s) { return stKey(s) !== "archived"; })) {
      main.innerHTML = '<div data-qk-banner>' + qkBannerHtml() + "</div>" + qkEmptyHtml();
      mFoot("");
      return;
    }
    var rows = mList(MB.seg);
    var chanLabel = MB.chan === "__all" ? "All destinations" : MB.chan;
    var body;
    if (rows.length) body = '<div class="lv-m-cards">' + rows.map(mCard).join("") + "</div>";
    else if (MB.seg === "now") {
      var nextS = null, nextR = null;
      vis().forEach(function (s) {
        if (stKey(s) !== "scheduled") return;
        var nr = mNextRun(s);
        if (nr && (!nextR || nr.start < nextR.start)) { nextR = nr; nextS = s; }
      });
      body = mBlank(MT.emptyNow, nextS ? "Next: " + UI.esc(nextS.name) + " · " + mWhenIn(nextR.start) : "No runs are scheduled.");
    } else body = mBlank(MT.emptyAll);
    main.innerHTML = mStrip() + '<div class="lv-m-pull" data-lv-mpull hidden>Pull to refresh</div>' +
      '<div data-qk-banner>' + qkBannerHtml() + "</div>" +
      '<div class="lv-m-seg" role="tablist" aria-label="Streams">' + ["now", "all"].map(function (k) {
        return '<button class="lv-m-seg__b' + (MB.seg === k ? " is-active" : "") + '" type="button" role="tab" aria-selected="' + (MB.seg === k) +
          '" data-lv-mseg="' + k + '">' + (k === "now" ? "Now" : "All") + "</button>";
      }).join("") + "</div>" +
      '<button class="lv-m-chanbtn" type="button" data-lv-mchan aria-haspopup="dialog">' + (IC.filter || "") + UI.esc(chanLabel) + (IC.chevDown || "") + "</button>" +
      body;
    mFoot(qkEntryHtml());
  }

  function mKv(k, v) { return '<div class="lv-m-kv"><span class="lv-m-kv__k">' + k + '</span><span class="lv-m-kv__v">' + v + "</span></div>"; }
  function mFold(key, title, sub, body) {
    var open = !!MB.open[key];
    return '<section class="lv-m-sec lv-m-fold' + (open ? " is-open" : "") + '" data-lv-mfold="' + key + '">' +
      '<button class="lv-m-fold__h" type="button" data-lv-mtoggle="' + key + '" aria-expanded="' + open + '">' +
        '<span class="lv-m-fold__t">' + title + '<span class="lv-m-fold__s">' + sub + "</span></span>" + (IC.chevDown || "") + "</button>" +
      '<div class="lv-m-fold__b"' + (open ? "" : " hidden") + ">" + body + "</div></section>";
  }
  function mMoney(s, k) {
    var c = cost(s), a = c.account;
    var spent = k === "live" ? '<span data-lv-mspent="' + s.id + '">' + UI.money(mSpent(s)) + "</span>" : UI.money(s.spentTotal || 0);
    var left = a.kind === "hours" ? "≈" + UI.hours(a.creditHours) + " of free credit"
      : c.rate > 0 ? "≈" + UI.hours(a.balance / c.rate) + " on " + UI.money(a.balance) : "—";
    return '<section class="lv-m-sec"><h2 class="lv-m-h2">Money</h2>' +
      mKv(k === "live" ? "Spent this run" : "Spent so far", spent) + mKv("Rate", c.rateStr) +
      (isUser() ? "" : mKv("Remaining", left) +
        '<button class="an-btn an-btn--secondary lv-m-btn" type="button" data-lv-topup>' + UI.esc(T.topUp) + "</button>") + "</section>";
  }
  function mRuns(s) {
    var n = nowMs();
    var list = (s.schedules || []).filter(function (sl) { return Date.parse(sl.end) > n; });
    var rows = list.map(function (sl) {
      return '<div class="lv-m-run"><span class="lv-m-run__w">' + UI.esc(windowStr(sl, s)) + "</span></div>";
    }).join("");
    return '<section class="lv-m-sec"><h2 class="lv-m-h2">Scheduled runs</h2>' + (rows || mLine(MT.noSchedule, "lv-m-line--muted")) + "</section>";
  }
  function mQueue(s) {
    var pl = content(s), st = plStats(pl);
    var items = ((pl && pl.items) || []).filter(function (i) { return !i.off; });
    var rows = items.map(function (i) {
      var f = file(i.fileId);
      return '<li class="lv-m-qr"><span class="lv-m-qr__n">' + UI.esc(f ? f.name : i.fileId) + '</span><span class="lv-m-qr__d">' + (f && f.sec ? UI.dur(f.sec) : "—") + "</span></li>";
    }).join("");
    var mode = playLabel(s);
    if (s.playback && s.playback.shuffle) mode += " · Shuffle";
    return mFold("queue", "Queue", st.count + (st.count === 1 ? " video · " : " videos · ") + UI.dur(st.sec) + " · " + mode,
      rows ? '<ul class="lv-m-ql">' + rows + "</ul>" : mLine("Empty queue", "lv-m-line--muted"));
  }
  function mLog(s) {
    var evs = [];
    (s.runs || []).forEach(function (r) { (r.events || []).forEach(function (e) { evs.push(e); }); });
    evs.sort(function (a, b) { return Date.parse(b.at) - Date.parse(a.at); });
    var rows = evs.map(function (e) {
      var kind = logKind(e);
      return '<li class="lv-m-ev' + (kind ? " lv-m-ev--" + kind : "") + '"><span class="lv-m-ev__t">' + UI.dt(e.at, TZ) + "</span>" +
        '<span class="lv-m-ev__x">' + UI.esc(e.text) + (e.author ? ' <span class="lv-m-ev__who">by ' + UI.esc(e.author) + "</span>" : "") + "</span></li>";
    }).join("");
    return mFold("log", "Event log", UI.plural(evs.length, "event", "events"),
      rows ? '<ul class="lv-m-evl">' + rows + "</ul>" : mLine("No events yet.", "lv-m-line--muted"));
  }
  function mFocus(f) {
    if (!f) return;
    var sel = f === "start" ? '[data-lv-mact="start"]' : f === "stop" ? '[data-lv-mact="stop"]' : f === "topup" ? '[data-lv-mact="topup"], [data-lv-topup]' : f === "dest" ? '[data-qk-f="link"]' : "";
    var el = sel && document.querySelector(sel);
    if (!el) return;
    el.classList.add("lv-m-focus");
    if (el.scrollIntoView) el.scrollIntoView({ block: "center" });
    setTimeout(function () { el.focus(); }, 0);
  }
  function renderMStream() {
    var main = mMain();
    if (!main) return;
    var qp = new URLSearchParams(location.search);
    var s = stream(qp.get("id"));
    if (s && !canSee(s)) {
      document.title = "Stream — SubSub";
      main.innerHTML = mStrip() + mBack() + mBlank(UI.esc(T.noAccess), "", true);
      mFoot("");
      return;
    }
    if (!s || stKey(s) === "archived") {
      document.title = "Stream — SubSub";
      main.innerHTML = mStrip() + mBack() + mBlank("Stream not found", "", true);
      mFoot("");
      return;
    }
    document.title = s.name + " — SubSub";
    var k = stKey(s);
    var hero = '<section class="lv-m-sec lv-m-hero">' + coverBox(coverOf(s), "lv-m-cover lv-m-cover--big") +
      '<h1 class="lv-m-h1">' + UI.esc(s.name) + "</h1>" +
      '<div class="lv-m-hero__chan">' + destHtml(s) +
        (s.dest && s.dest.link ? '<a class="lv-m-ext" href="' + UI.esc(s.dest.link) + '" data-lv-yt target="_blank" rel="noopener">' +
          (IC.youtube || "") + "Open on YouTube</a>" : "") + "</div>" + mStatus(s, k) +
      (k === "stopped" ? mStoppedLines(s) : k === "starting" ? mLine(MT.starting) : k === "stopping" ? mLine(MT.stopping) : "") +
      "</section>";
    if (k === "draft") {
      main.innerHTML = mStrip() + mBack() + hero + mLine(MT.finish, "lv-m-line--muted");
      mFoot("");
      return;
    }
    var qkUp = !!(QK && QK.streamId === s.id);
    main.innerHTML = mStrip() + mBack() + hero + (s.quick ? qkStreamSecs(s) : "") + mMoney(s, k) +
      (s.quick ? "" : mRuns(s)) + (qkUp ? "" : mQueue(s)) + mLog(s);
    qkBindGrips();
    mFoot(mBtn(mAction(s)));
    mFocus(qp.get("focus"));
  }
  function renderMOff() {
    var main = mMain();
    if (!main) return;
    var create = PAGE === "form", title = create ? MT.created : M_OFF_PAGE[PAGE] || "This page";
    document.title = (create ? "Streams" : title) + " — SubSub";
    main.innerHTML = mStrip() + mBlank(UI.esc(title), create ? MT.createSub : MT.offSub, true);
    mFoot("");
  }

  function mSheet(title, body) {
    mSheetClose();
    var el = document.createElement("div");
    el.className = "lv-m-sheet";
    el.setAttribute("data-lv-msheet", "");
    el.innerHTML = '<div class="lv-m-sheet__ov" data-lv-msheetclose></div>' +
      '<div class="lv-m-sheet__p" role="dialog" aria-modal="true" aria-label="' + UI.esc(title) + '">' +
        '<div class="lv-m-sheet__h"><h2 class="lv-m-sheet__t">' + UI.esc(title) + "</h2>" +
        '<button class="an-modal__x" type="button" data-lv-msheetclose aria-label="Close">' + (IC.close || "×") + "</button></div>" + body + "</div>";
    document.body.appendChild(el);
    var first = el.querySelector(".lv-m-sheet__row");
    if (first) setTimeout(function () { first.focus(); }, 0);
  }
  function mSheetClose() {
    var el = document.querySelector("[data-lv-msheet]");
    if (el) el.remove();
  }
  function mRow(attrs, ava, text, sub, on) {
    return '<li><button class="lv-m-sheet__row" type="button" ' + attrs + (on ? ' aria-current="true"' : "") + ">" + ava +
      '<span class="lv-m-sheet__txt">' + text + (sub ? '<span class="lv-m-sheet__sub">' + sub + "</span>" : "") + "</span>" + (on ? (IC.check || "✓") : "") + "</button></li>";
  }
  function mChanSheet() {
    var rows = mRow('data-lv-mpick="__all"', "", "All destinations", "", MB.chan === "__all") +
      dests().map(function (nm) {
        return mRow('data-lv-mpick="' + UI.esc(nm) + '"', destAva(nm), UI.esc(nm), "", MB.chan === nm);
      }).join("");
    mSheet("Destination", '<ul class="lv-m-sheet__list">' + rows + "</ul>");
  }
  function mStart(s) {
    var rd = readiness(content(s));
    var b = MB.offline ? { reason: MT.offline } : rd.state === "uploading" ? { reason: MT.waitUpload } : startBlock(s);
    if (b) { UI.toast(b.reason); return; }
    s.virtual_status = "starting";
    s.startingAt = new Date(nowMs()).toISOString();
    s.runs = s.runs || [];
    var r = runOf(s);
    if (!r || r.start) {
      s.runs.unshift({ id: s.id + "-r" + (s.runs.length + 1), index: s.runs.length + 1, start: null, end: null, spent: 0, events: [] });
      r = s.runs[0];
    }
    r.events.unshift(ev("scheduled", "Start requested", { author: "You" }));
    save(); render();
    UI.toast("“" + s.name + "” is starting — the worker confirms within 10 s.");
  }
  function mGoLive(s) {
    s.status = "live";
    s.virtual_status = null;
    delete s.startingAt;
    var r = runOf(s), startIso = new Date(nowMs()).toISOString();
    if (r && !r.start) { r.start = startIso; r.events.unshift(ev("live", "Went live")); }
    else s.runs.unshift({ id: s.id + "-r" + ((s.runs || []).length + 1), index: (s.runs || []).length + 1, start: startIso, end: null, spent: 0, events: [ev("live", "Went live")] });
    var pl = content(s), first = pl && pl.items.filter(function (i) { return !i.off; })[0];
    s.onAir = first ? { fileId: first.fileId, passedSec: 0 } : null;
  }
  function mRefresh() { MB.refreshedAt = Date.now(); render(); }
  function mTick() {
    qkTick();
    var flipped = false;
    S.streams.forEach(function (s) {
      if (s.virtual_status === "starting" && s.startingAt && nowMs() - Date.parse(s.startingAt) >= M_START_DELAY) { mGoLive(s); flipped = true; }
    });
    if (flipped) { save(); render(); return; }
    if (!MOB) return;
    [].slice.call(document.querySelectorAll("[data-lv-mtimer]")).forEach(function (el) {
      var s = stream(el.getAttribute("data-lv-mtimer")), r = s && runOf(s);
      if (r && r.start) el.textContent = UI.dur((nowMs() - Date.parse(r.start)) / 1000);
    });
    [].slice.call(document.querySelectorAll("[data-lv-mspent]")).forEach(function (el) {
      var s = stream(el.getAttribute("data-lv-mspent"));
      if (s) el.textContent = UI.money(mSpent(s));
    });
    var u = document.querySelector("[data-lv-mupd]");
    if (u) u.innerHTML = mUpdText();
  }
  function mInit() {
    if (M_LIVE_PAGES.indexOf(PAGE) === -1) return;
    qkInit();
    if (MQ_M) {
      var onMq = function (e) { MOB = e.matches; if (!MOB) mUnmount(); render(); };
      if (MQ_M.addEventListener) MQ_M.addEventListener("change", onMq); else MQ_M.addListener(onMq);
      // эмуляция устройства в DevTools меняет ширину без события change у matchMedia
      var onSize = function () { if (MQ_M.matches !== MOB) onMq({ matches: MQ_M.matches }); };
      window.addEventListener("resize", onSize);
      if (window.ResizeObserver) new ResizeObserver(onSize).observe(document.documentElement);
      setInterval(onSize, 500);
    }
    setInterval(mTick, 1000);
    setInterval(function () { if (MOB && PAGE === "streams" && MB.seg === "now" && !document.hidden) mRefresh(); }, 30000);
    document.addEventListener("visibilitychange", function () { if (MOB && !document.hidden) mRefresh(); });
    window.addEventListener("online", function () { MB.offline = false; if (MOB) mRefresh(); });
    window.addEventListener("offline", function () { MB.offline = true; if (MOB) mRefresh(); });
    var ind = function () { return document.querySelector("[data-lv-mpull]"); };
    var pageTop = function () { return (document.scrollingElement || document.documentElement).scrollTop <= 0; };
    document.addEventListener("touchstart", function (e) {
      MB.pull = MOB && e.target.closest && e.target.closest("[data-lv-mmain]") && pageTop() ? e.touches[0].clientY : null;
    }, { passive: true });
    document.addEventListener("touchmove", function (e) {
      if (MB.pull === null) return;
      var dy = e.touches[0].clientY - MB.pull, el = ind();
      if (el) { el.hidden = dy < 24; el.textContent = dy > 70 ? "Release to refresh" : "Pull to refresh"; }
    }, { passive: true });
    document.addEventListener("touchend", function (e) {
      if (MB.pull === null) return;
      var dy = e.changedTouches[0].clientY - MB.pull, el = ind();
      MB.pull = null;
      if (dy > 70) { if (el) el.textContent = "Refreshing…"; setTimeout(mRefresh, 350); }
      else if (el) el.hidden = true;
    });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      var c = e.target.closest && e.target.closest("[data-lv-mcard]");
      if (c && e.target === c) mGo("live-stream.html?id=" + encodeURIComponent(c.getAttribute("data-lv-mcard")));
    });
  }
  document.addEventListener("click", function (e) {
    if (!MOB) return;
    var t = e.target;
    if (!t.closest) return;
    var q = function (sel) { return t.closest(sel); };
    if (q("[data-lv-msheetclose]")) { mSheetClose(); return; }
    if (q("[data-lv-mchan]")) { mChanSheet(); return; }
    var pick = q("[data-lv-mpick]");
    if (pick) { MB.chan = pick.getAttribute("data-lv-mpick"); mSheetClose(); renderMList(); return; }
    var push = q("[data-lv-mpush]");
    if (push) {
      var list = (F.pushes || []).filter(function (p) { return stream(p.streamId); });
      var p = list[Number(push.getAttribute("data-lv-mpush"))];
      if (p) location.href = ctxUrl("live-stream.html?id=" + encodeURIComponent(p.streamId) + (p.focus ? "&focus=" + p.focus : ""));
      return;
    }
    var seg = q("[data-lv-mseg]");
    if (seg) { MB.seg = seg.getAttribute("data-lv-mseg"); renderMList(); return; }
    var tog = q("[data-lv-mtoggle]");
    if (tog) {
      var key = tog.getAttribute("data-lv-mtoggle"), sec = tog.closest("[data-lv-mfold]");
      MB.open[key] = !MB.open[key];
      if (sec) { sec.classList.toggle("is-open", MB.open[key]); var b = sec.querySelector(".lv-m-fold__b"); if (b) b.hidden = !MB.open[key]; }
      tog.setAttribute("aria-expanded", String(MB.open[key]));
      return;
    }
    var act = q("[data-lv-mact]");
    if (act) {
      if (UI.isOff(act)) return;
      var s = stream(act.getAttribute("data-lv-mid"));
      if (!s) return;
      var a = act.getAttribute("data-lv-mact");
      if (a === "stop") askStop(s);
      else if (a === "start") mStart(s);
      else if (a === "dest") { if (PAGE === "stream") mFocus("dest"); else mGo("live-stream.html?id=" + encodeURIComponent(s.id) + "&focus=dest"); }
      else if (a === "topup") location.href = ctxUrl("wallet.html?topup=1");
      return;
    }
    if (q("[data-lv-topup]") || q("[data-lv-yt]") || q("a[href]") || q("button")) return;
    var card = q("[data-lv-mcard]");
    if (card) mGo("live-stream.html?id=" + encodeURIComponent(card.getAttribute("data-lv-mcard")));
  });

  // ============================================================ mobile Quick stream
  // One stream, one ordered queue, Play once. Files upload one at a time while the tab is in the
  // foreground; a finished file is kept on the server, the file in flight is lost with the page.
  // The queue manifest lives in IndexedDB so a returning visitor re-picks only what did not finish.
  var QK = null, QK_N = 0, QK_T = null, QK_LAST = 0, QK_DB = null, QK_SAVE_T = null, QK_DRAG = null;
  var QK_MAX = 20, QK_LONG_MS = 10 * 60e3, QK_PROC_MS = 8000, QK_MEASURE_MS = 2500;
  var QK_EXT = { mp4: 1, mov: 1, m4v: 1, webm: 1 };
  // the prototype has no server: the transfer is simulated at a fixed uplink, ?net=slow|fast|<Mbps>
  var QK_NET = (function () {
    var v = new URLSearchParams(location.search).get("net"), n = { slow: 2, fast: 200 }[v] || Number(v);
    return (n > 0 ? n : 20) * 1e6 / 8;
  })();
  var QT = {
    entry: "Quick stream",
    emptyLine: "Pick videos on your phone and stream them to YouTube.",
    prep: "Prepare your YouTube channel",
    prepBody: "The first time a channel goes live, YouTube can take up to 24 hours to turn on live streaming. Turn it on in YouTube Studio now, so the channel is ready when your videos are.",
    lead: "Your videos play once, in this order, as one stream.",
    addMore: "Add more files",
    maxFiles: "Up to " + QK_MAX + " videos in a quick stream.",
    measuring: "Measuring the upload speed…",
    wakeOn: "The screen stays on until the upload finishes. Switching apps or locking the phone pauses it.",
    wakeOff: "Keep the screen on — locking the phone or switching apps pauses the upload.",
    studio: "Open YouTube Studio",
    studioAsk: "Open YouTube Studio?",
    studioGate: "Opening YouTube Studio now would discard the upload in progress.",
    studioBody: "On a phone the YouTube Studio app may open instead of the website. The app doesn’t show the stream key — if it opens, come back here and choose Continue on desktop.",
    desk: "Continue on desktop",
    deskKey: "We sent a link to your Telegram — open it on a computer to add the stream key.",
    deskUpload: "We sent a link to your Telegram — open it on a computer to upload the videos there.",
    start: "Start as soon as it’s ready",
    needDest: "Add the stream link and key to go live.",
    procWait: "The videos are still processing.",
    procLine: "Processing the videos — this goes on even if you close the app.",
    keepOpen: "Keep the app open until the upload finishes — switching apps pauses it.",
    autoLine: "Goes live as soon as it’s ready.",
    leaveT: "Leave while a video uploads?"
  };

  function qkExt(name) { var m = /\.([a-z0-9]+)$/i.exec(name || ""); return m ? m[1].toLowerCase() : ""; }
  function qkItem(uid) { return QK ? QK.items.filter(function (it) { return it.uid === uid; })[0] || null : null; }
  function qkActive() { return QK ? QK.items.filter(function (it) { return it.state === "uploading"; })[0] || null : null; }
  function qkInFlight() { return !!QK && QK.items.some(function (it) { return it.state === "queued" || it.state === "uploading"; }); }
  function qkPending() { return QK ? QK.items.filter(function (it) { return it.state !== "done"; }).length : 0; }
  function qkRepicks() { return QK ? QK.items.filter(function (it) { return it.state === "repick"; }) : []; }
  function qkAspect(it) { return it.h > it.w ? "9:16" : "16:9"; }
  function qkPct(it) { return it.size ? Math.min(100, Math.floor((it.sent || 0) / it.size * 100)) : 0; }
  function qkStartOn() { return !!QK && QK.items.length > 0 && !qkPending() && QK.autoStart !== false; }
  function qkHuman(ms) {
    var m = Math.max(1, Math.ceil(ms / 60000));
    if (m < 60) return UI.plural(m, "minute", "minutes");
    return Math.floor(m / 60) + " h" + (m % 60 ? " " + (m % 60) + " min" : "");
  }
  function qkNew() {
    QK = { id: "qk" + Date.now(), items: [], link: "", key: "", autoStart: null, streamId: null, draftId: null,
      meas: { bytes: 0, ms: 0, rate: 0 }, long: null, longAck: false, skipped: [], over: 0, reading: 0,
      wake: "", wl: null, wlReq: false, leaving: false, repickUid: null };
  }

  // ---- the stream status a quick stream adds before the usual ones
  function qkStreamState(s) {
    if (!s || !s.quick || s.status === "draft" || s.virtual_status) return null;
    if (s.status !== "created" && s.status !== "ready") return null;
    var d = s.dest || {};
    if (!String(d.key || "").trim() || !String(d.link || "").trim()) return "needdest";
    return qkContentState(s);
  }
  function qkContentState(s) {
    var fs = (s.queue || []).map(function (i) { return file(i.fileId); });
    if (fs.some(function (f) { return !f || f.state === "uploading" || f.state === "failed"; })) return "uploading";
    if (fs.some(function (f) { return f.state === "processing"; })) return "fproc";
    return null;
  }
  function qkUpOf(s) {
    var fs = (s.queue || []).map(function (i) { return file(i.fileId); }), m = fs.length;
    var done = fs.filter(function (f) { return f && f.state !== "uploading" && f.state !== "failed"; }).length;
    return { n: Math.min(m, done + 1), m: m, done: done, lost: fs.filter(function (f) { return !f || f.state === "failed"; }).length };
  }
  function qkUpLabel(s) { var u = qkUpOf(s); return "Uploading " + u.n + " of " + u.m; }

  // ---- reading a picked file: container by name or type, codec by whether the browser can decode it
  function qkProbe(fl) {
    return new Promise(function (res) {
      var url = URL.createObjectURL(fl), v = document.createElement("video"), done = false, meta = null, seekT = null;
      var fin = function (r) {
        if (done) return;
        done = true; clearTimeout(to); clearTimeout(seekT);
        v.removeAttribute("src"); try { v.load(); } catch (e) {}
        URL.revokeObjectURL(url); res(r);
      };
      var to = setTimeout(function () { fin(meta || { ok: false }); }, 12000);
      v.preload = "metadata"; v.muted = true; v.playsInline = true;
      v.onloadedmetadata = function () {
        if (!v.videoWidth || !v.videoHeight) { fin({ ok: false }); return; }
        meta = { ok: true, w: v.videoWidth, h: v.videoHeight, sec: isFinite(v.duration) ? Math.round(v.duration) : 0, thumb: null };
        seekT = setTimeout(function () { fin(meta); }, 3000);
        try { v.currentTime = Math.min(1, (v.duration || 0) / 2); } catch (e) { fin(meta); }
      };
      v.onseeked = function () {
        if (!meta) return;
        try {
          var k = 112 / Math.max(meta.w, meta.h), c = document.createElement("canvas");
          c.width = Math.round(meta.w * k); c.height = Math.round(meta.h * k);
          c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
          meta.thumb = c.toDataURL("image/jpeg", 0.7);
        } catch (e) {}
        fin(meta);
      };
      v.onerror = function () { fin({ ok: false }); };
      v.src = url;
    });
  }
  function qkAdd(list) {
    if (!QK) qkNew();
    var files = [].slice.call(list || []), room = Math.max(0, QK_MAX - QK.items.length - QK.reading);
    QK.over = Math.max(0, files.length - room);
    files = files.slice(0, room);
    QK.skipped = [];
    QK.reading += files.length;
    qkRefresh();
    Promise.all(files.map(function (fl) {
      var ok = !!QK_EXT[qkExt(fl.name)] || /^video\/(mp4|quicktime|x-m4v|webm)$/.test(fl.type || "");
      if (!ok) return Promise.resolve({ fl: fl, bad: "format" });
      return qkProbe(fl).then(function (m) { return { fl: fl, m: m, bad: m.ok ? "" : "read" }; });
    })).then(function (res) {
      if (!QK) return;
      QK.reading = Math.max(0, QK.reading - res.length);
      res.forEach(function (r) {
        if (r.bad) QK.skipped.push({ name: r.fl.name, why: r.bad });
        else qkPush(r.fl, r.m);
      });
      qkPump();
      qkChanged();
    });
  }
  function qkPush(fl, m) {
    QK_N++;
    var id = "qk" + Date.now() + "-" + QK_N;
    var f = { id: id, name: fl.name, sec: m.sec || 0, bytes: fl.size, container: "mp4", state: "uploading", progress: 0,
      q: null, folderId: null, cover: m.thumb || null, qk: { w: m.w, h: m.h } };
    F.files.push(f);
    S.qkFiles = S.qkFiles || [];
    S.qkFiles.push(f);
    QK.items.push({ uid: id, fileId: id, name: fl.name, size: fl.size, type: fl.type, lm: fl.lastModified,
      w: m.w, h: m.h, sec: m.sec || 0, thumb: m.thumb || null, state: "queued", sent: 0, file: fl });
    var s = QK.streamId && stream(QK.streamId);
    if (s) s.queue = (s.queue || []).concat([{ fileId: id, off: false }]);
    save();
  }
  // a returning visitor picks the missing files again; they are matched by name and size
  // files already in the media library join the queue as uploaded: nothing to transfer
  function qkAddLibrary(ids) {
    if (!QK) qkNew();
    var room = Math.max(0, QK_MAX - QK.items.length - QK.reading), added = 0;
    ids.slice(0, room).forEach(function (id) {
      var f = file(id);
      if (!f) return;
      QK_N++;
      var q = f.q || {};
      QK.items.push({ uid: "lib" + Date.now() + "-" + QK_N, fileId: id, name: f.name, size: f.bytes, type: "video/mp4", lm: 0,
        w: q.w || 1920, h: q.h || 1080, sec: f.sec || 0, thumb: f.cover || null, state: "done", sent: f.bytes, file: null });
      added++;
    });
    QK.over = Math.max(0, ids.length - room);
    var s = QK.streamId && stream(QK.streamId);
    if (s) s.queue = QK.items.map(function (x) { return { fileId: x.fileId, off: false }; });
    save();
    qkChanged();
    if (added) UI.toast(UI.plural(added, "video", "videos") + " added to the queue.");
  }
  function qkRepickWith(list) {
    var picked = [].slice.call(list || []), want = QK.repickUid ? [qkItem(QK.repickUid)] : qkRepicks(), miss = [];
    picked.forEach(function (fl) {
      var it = want.filter(function (x) { return x && x.state === "repick" && x.name === fl.name && x.size === fl.size; })[0];
      if (!it) { miss.push(fl.name); return; }
      it.file = fl; it.state = "queued"; it.sent = 0;
      var f = file(it.fileId);
      if (!f) {
        f = { id: it.fileId, name: it.name, sec: it.sec, bytes: it.size, container: "mp4", q: null, folderId: null,
          cover: it.thumb, qk: { w: it.w, h: it.h } };
        F.files.push(f); S.qkFiles = S.qkFiles || []; S.qkFiles.push(f);
      }
      f.state = "uploading"; f.progress = 0;
    });
    QK.repickUid = null;
    save();
    if (miss.length) UI.toast(miss.length === 1 ? "“" + miss[0] + "” isn’t one of the videos that didn’t finish." : UI.plural(miss.length, "file isn’t", "files aren’t") + " among the videos that didn’t finish.");
    qkPump();
    qkChanged();
  }
  function qkRemove(uid) {
    var it = qkItem(uid);
    if (!it) return;
    if (it.state === "uploading") { clearInterval(QK_T); QK_T = null; }
    QK.items = QK.items.filter(function (x) { return x.uid !== uid; });
    var f = file(it.fileId);
    if (f && it.state !== "done") { f.state = "failed"; delete f.progress; }
    var s = QK.streamId && stream(QK.streamId);
    if (s) s.queue = (s.queue || []).filter(function (q) { return q.fileId !== it.fileId; });
    save();
    qkPump();
    qkChanged();
  }
  function qkMove(uid, to) {
    var from = QK.items.indexOf(qkItem(uid));
    if (from < 0 || to < 0 || to >= QK.items.length || to === from) return;
    QK.items.splice(to, 0, QK.items.splice(from, 1)[0]);
    var s = QK.streamId && stream(QK.streamId);
    if (s) s.queue = QK.items.map(function (x) { return { fileId: x.fileId, off: false }; });
    save();
    qkChanged();
  }

  // ---- the upload runner: sequential, foreground only
  function qkPump() {
    if (!QK || document.hidden) { qkWakeSync(); return; }
    if (!qkActive()) {
      var nx = QK.items.filter(function (it) { return it.state === "queued" && it.file; })[0];
      if (nx) { nx.state = "uploading"; nx.sent = 0; }
    }
    if (qkActive() && !QK_T) { QK_LAST = Date.now(); QK_T = setInterval(qkStep, 250); }
    qkWakeSync();
  }
  function qkStep() {
    var it = qkActive();
    if (!it || document.hidden) { clearInterval(QK_T); QK_T = null; qkWakeSync(); return; }
    var now = Date.now(), dt = Math.min(1000, now - QK_LAST);
    QK_LAST = now;
    var add = QK_NET * (0.85 + Math.random() * 0.3) * dt / 1000;
    it.sent = Math.min(it.size, (it.sent || 0) + add);
    QK.meas.bytes += add; QK.meas.ms += dt;
    if (!QK.meas.rate && QK.meas.ms >= QK_MEASURE_MS) {
      QK.meas.rate = QK.meas.bytes / (QK.meas.ms / 1000);
      var left = qkLeftMs();
      if (left > QK_LONG_MS && !QK.longAck) { QK.long = { ms: left }; qkRefresh(); }
    } else if (QK.meas.rate && dt) QK.meas.rate = QK.meas.rate * 0.9 + add / (dt / 1000) * 0.1;
    var f = file(it.fileId);
    if (f) f.progress = qkPct(it);
    if (it.sent >= it.size) {
      clearInterval(QK_T); QK_T = null;
      qkBank(it);
      qkPump();
      qkChanged();
      return;
    }
    qkPaint();
  }
  function qkBank(it) {
    it.state = "done"; it.file = null;
    var f = file(it.fileId);
    if (f) { f.state = "processing"; delete f.progress; f.procUntil = Date.now() + QK_PROC_MS; }
    save();
  }
  function qkLeftMs() {
    if (!QK || !QK.meas.rate) return null;
    var b = 0;
    QK.items.forEach(function (it) { if (it.state === "queued" || it.state === "uploading") b += it.size - (it.sent || 0); });
    return b / QK.meas.rate * 1000;
  }
  // server-side processing runs on the clock, not on the tab: it finishes even while the app is closed
  function qkSettle() {
    var changed = false, n = Date.now();
    (S.qkFiles || []).forEach(function (f) {
      if (f.state !== "processing" || !f.procUntil || f.procUntil > n) return;
      var g = f.qk || { w: 1920, h: 1080 }, vert = isVert(g.w, g.h);
      var p = resProfile(Math.min(1080, resRow(g.h, g.w)), vert, false);
      var rng = rateRangeFor(p.row, fpsCol(p.fps), p.vert);
      f.q = { w: p.w, h: p.h, fps: p.fps, vcodec: p.vcodec, acodec: p.acodec, ac: p.ac, ar: p.ar, audio: p.audio };
      if (rng && f.sec) f.bytes = Math.round((rng[0] + rng[1]) / 2 * 1e6 / 8 * f.sec);
      f.state = "ready"; delete f.procUntil;
      changed = true;
    });
    if (changed) save();
    return changed;
  }
  function qkTg(s, text, quiet) {
    var r = runOf(s);
    if (r) r.events.unshift(ev("notify", "Telegram: " + text));
    if (!quiet && !document.hidden) UI.toast("Telegram: " + text);
  }
  function qkTick() {
    var ch = qkSettle();
    S.streams.forEach(function (s) {
      if (!s.quick || s.status === "draft") return;
      s.tg = s.tg || {};
      var k = stKey(s);
      if (k === "ready" && s.autoStart && !startBlock(s) && !MB.offline) {
        s.virtual_status = "starting";
        s.startingAt = new Date(nowMs()).toISOString();
        var r = runOf(s);
        if (r) r.events.unshift(ev("scheduled", "Started automatically — the stream was ready"));
        ch = true;
        return;
      }
      if (k === "ready" && !s.autoStart && !s.tg.ready) { s.tg.ready = true; qkTg(s, "“" + s.name + "” is ready to start."); ch = true; }
      if (k === "live" && !s.tg.live) { s.tg.live = true; qkTg(s, "“" + s.name + "” is live."); ch = true; }
    });
    if (QK && QK.streamId && !qkPending()) qkFinish();
    if (ch) { save(); qkRedraw(); }
  }
  function qkFinish() {
    if (QK && QK.wl) { try { QK.wl.release(); } catch (e) {} }
    QK = null;
    qkDrop();
  }

  // ---- IndexedDB manifest
  function qkDb(cb) {
    if (QK_DB) { cb(QK_DB); return; }
    if (!window.indexedDB) { cb(null); return; }
    var rq;
    try { rq = indexedDB.open("subsub_quick_stream", 1); } catch (e) { cb(null); return; }
    rq.onupgradeneeded = function () { rq.result.createObjectStore("manifest"); };
    rq.onsuccess = function () { QK_DB = rq.result; cb(QK_DB); };
    rq.onerror = function () { cb(null); };
  }
  function qkKey() { return KEY; }
  function qkPersist() { clearTimeout(QK_SAVE_T); QK_SAVE_T = setTimeout(qkPersistNow, 200); }
  function qkPersistNow() {
    clearTimeout(QK_SAVE_T);
    if (!QK) return;
    if (!QK.items.length && !QK.streamId) { qkDrop(); return; }
    var m = { id: QK.id, at: Date.now(), link: QK.link, key: QK.key, autoStart: QK.autoStart,
      streamId: QK.streamId, draftId: QK.draftId,
      items: QK.items.map(function (it) {
        return { uid: it.uid, fileId: it.fileId, name: it.name, size: it.size, type: it.type, lm: it.lm,
          w: it.w, h: it.h, sec: it.sec, thumb: it.thumb, state: it.state === "done" ? "done" : "pending" };
      }) };
    qkDb(function (db) {
      if (!db) return;
      try { db.transaction("manifest", "readwrite").objectStore("manifest").put(m, qkKey()); } catch (e) {}
    });
  }
  function qkDrop() {
    qkDb(function (db) {
      if (!db) return;
      try { db.transaction("manifest", "readwrite").objectStore("manifest").delete(qkKey()); } catch (e) {}
    });
  }
  function qkLoad(cb) {
    qkDb(function (db) {
      if (!db) { cb(null); return; }
      try {
        var rq = db.transaction("manifest").objectStore("manifest").get(qkKey());
        rq.onsuccess = function () { cb(rq.result || null); };
        rq.onerror = function () { cb(null); };
      } catch (e) { cb(null); }
    });
  }
  function qkRestore(m) {
    qkNew();
    QK.id = m.id; QK.link = m.link || ""; QK.key = m.key || ""; QK.autoStart = m.autoStart == null ? null : m.autoStart;
    QK.streamId = m.streamId && stream(m.streamId) ? m.streamId : null;
    QK.draftId = m.draftId && stream(m.draftId) && stream(m.draftId).status === "draft" ? m.draftId : null;
    QK.items = (m.items || []).map(function (x) {
      var f = file(x.fileId);
      var done = !!f && f.state !== "failed" && f.state !== "uploading";
      if (!done && f) { f.state = "failed"; delete f.progress; }
      return { uid: x.uid, fileId: x.fileId, name: x.name, size: x.size, type: x.type, lm: x.lm, w: x.w, h: x.h,
        sec: x.sec, thumb: x.thumb, state: done ? "done" : "repick", sent: 0, file: null };
    });
    if ((m.streamId && !QK.streamId) || (!QK.items.length && !QK.streamId) || (QK.streamId && !qkPending())) {
      QK = null; qkDrop(); return false;
    }
    save();
    return true;
  }

  // ---- Screen Wake Lock: held while files upload and the page is in front, shown in the interface
  function qkWakeWanted() { return !!QK && MOB && !document.hidden && qkInFlight(); }
  function qkWakeSync() {
    if (!QK) return;
    var want = qkWakeWanted();
    if (want && !QK.wl && !QK.wlReq) {
      if (!navigator.wakeLock || !navigator.wakeLock.request) { if (QK.wake !== "none") { QK.wake = "none"; qkPaint(); } return; }
      QK.wlReq = true;
      navigator.wakeLock.request("screen").then(function (l) {
        if (!QK) { l.release(); return; }
        QK.wlReq = false; QK.wl = l; QK.wake = "on";
        l.addEventListener("release", function () { if (QK && QK.wl === l) { QK.wl = null; QK.wake = "off"; qkPaint(); } });
        qkPaint();
      }, function () { if (QK) { QK.wlReq = false; QK.wake = "denied"; qkPaint(); } });
    } else if (!want && QK.wl) {
      var l = QK.wl;
      QK.wl = null; QK.wake = "off";
      try { l.release(); } catch (e) {}
    }
  }

  // ---- pieces of the screen
  function qkBadge(it) {
    if (it.state === "uploading") return '<span class="ml-tag ml-tag--info" data-qk-pct="' + it.uid + '">Uploading · ' + qkPct(it) + "%</span>";
    if (it.state === "repick") {
      return '<span class="ml-tag ml-tag--bad">Upload failed</span>' +
        '<button class="lv-m-link lv-qk-retry" type="button" data-qk-retry="' + it.uid + '">Retry upload</button>';
    }
    if (it.state !== "done") return "";
    var f = file(it.fileId);
    if (f && f.state === "processing") return '<span class="ml-tag ml-tag--muted">Processing</span>';
    return '<span class="ml-tag ml-tag--ok">Ready</span>';
  }
  function qkRowHtml(it) {
    var many = QK.items.length > 1;
    return '<li class="lv-qk-row" data-qk-row="' + it.uid + '">' +
      (many ? '<button class="lv-qk-grip" type="button" data-qk-grip="' + it.uid + '" aria-label="Move ' + UI.esc(it.name) +
        ' — drag, or use the arrow keys">' + (IC.grip || "") + "</button>" : "") +
      '<span class="lv-qk-thumb">' + (it.thumb ? '<img src="' + it.thumb + '" alt="" />' : (IC.film || "")) + "</span>" +
      '<div class="lv-qk-row__b"><span class="lv-qk-row__n">' + UI.esc(it.name) + "</span>" +
        '<span class="lv-qk-row__m"><span class="lv-qk-chip">' + qkAspect(it) + "</span>" +
          (it.w && it.h ? '<span class="lv-qk-chip">' + resLabel(resRow(it.h, it.w)) + "</span>" : "") +
          "<span>" + (it.sec ? UI.dur(it.sec) : "—") + " · " + UI.bytes(it.size) + "</span></span>" +
        '<span class="lv-qk-row__s">' + qkBadge(it) + "</span>" +
        (it.state === "uploading" ? '<div class="lv-m-bar"><div class="lv-m-bar__f" data-qk-barf="' + it.uid + '" style="width:' + qkPct(it) + '%"></div></div>' : "") +
      "</div>" +
      '<button class="lv-qk-x" type="button" data-qk-rm="' + it.uid + '" aria-label="Remove ' + UI.esc(it.name) + '">' + (IC.close || "×") + "</button>" +
    "</li>";
  }
  function qkAggHtml() {
    var its = QK ? QK.items : [], m = its.length;
    if (!m) return "";
    var done = 0, total = 0, sent = 0;
    its.forEach(function (it) {
      total += it.size;
      if (it.state === "done") { done++; sent += it.size; } else if (it.state === "uploading") sent += it.sent || 0;
    });
    if (done === m) return "";
    var act = qkActive(), rp = qkRepicks().length, left = qkLeftMs();
    var head = act ? "Uploading " + Math.min(m, done + 1) + " of " + m
      : rp ? UI.plural(rp, "video needs", "videos need") + " picking again" : "Waiting to upload";
    return '<div class="lv-qk-agg__h"><b>' + head + "</b><span>" + UI.bytes(sent) + " of " + UI.bytes(total) + "</span></div>" +
      mBar(total ? sent / total : 0) +
      (act ? mLine(left == null ? QT.measuring : "About " + qkHuman(left) + " left", "lv-m-line--muted") : "") +
      (qkInFlight() ? '<p class="lv-qk-wake' + (QK.wake === "on" ? " is-on" : "") + '">' +
        "<span>" + (QK.wake === "on" ? QT.wakeOn : QT.wakeOff) + "</span></p>" : "");
  }
  function qkNotesHtml() {
    var out = "", sk = QK.skipped || [], rp = qkRepicks();
    if (QK.reading) out += mLine("Reading " + UI.plural(QK.reading, "video", "videos") + "…", "lv-m-line--muted");
    if (sk.length) {
      out += '<div class="lv-qk-note lv-qk-note--warn">' + mLine(UI.plural(sk.length, "file wasn’t", "files weren’t") + " added:") +
        '<ul class="lv-qk-skip">' + sk.map(function (x) {
          return "<li><b>" + UI.esc(x.name) + "</b> — " + (x.why === "format" ? "this format can’t be streamed. Use MP4, MOV or WebM." : "this video can’t be read.") + "</li>";
        }).join("") + "</ul></div>";
    }
    if (QK.over) out += mLine(QT.maxFiles + " " + UI.plural(QK.over, "video wasn’t", "videos weren’t") + " added.", "lv-m-line--warn");
    if (rp.length) {
      out += '<div class="lv-qk-note lv-qk-note--warn">' +
        mLine(UI.plural(rp.length, "video", "videos") + " didn’t finish uploading. Pick " + (rp.length === 1 ? "it" : "them") + " again" +
          (rp.length < QK.items.length ? " — the finished ones are saved." : ".")) +
        '<button class="an-btn an-btn--primary lv-m-btn" type="button" data-qk-repick>' + (rp.length === 1 ? "Pick it again" : "Pick them again") + "</button></div>";
    }
    return out;
  }
  function qkLongHtml() {
    if (!QK.long || QK.longAck || !qkInFlight()) return "";
    return '<div class="lv-qk-note" role="status">' +
      mLine("This upload takes about " + qkHuman(QK.long.ms) + " on this connection.") +
      '<button class="an-btn an-btn--primary lv-m-btn" type="button" data-qk-longok>Upload anyway</button>' +
      '<button class="an-btn an-btn--secondary lv-m-btn" type="button" data-qk-desk="upload">' + QT.desk + "</button></div>";
  }
  function qkAddHtml() {
    var full = QK.items.length + QK.reading >= QK_MAX;
    return '<div class="lv-m-act">' + (full
      ? '<button class="an-btn an-btn--secondary lv-m-btn is-off" type="button" aria-disabled="true">' + (IC.plus || "") + QT.addMore + "</button>" +
        '<p class="lv-m-why">' + QT.maxFiles + "</p>"
      : '<div class="lv-qk-addrow"><button class="an-btn an-btn--' + (QK.items.length ? "secondary" : "primary") + ' lv-m-btn" type="button" data-qk-pick>' + (IC.plus || "") +
        (QK.items.length ? QT.addMore : "Add files") + "</button>" +
        (document.getElementById("lvPicker") ? '<button class="an-btn an-btn--secondary lv-m-btn lv-qk-lib" type="button" data-qk-lib aria-label="Add from Media Library" data-tip="Add from Media Library">' + (IC.folder || "") + "</button>" : "") +
        "</div>") + "</div>";
  }
  function qkQueueHtml() {
    var rows = QK.items.map(qkRowHtml).join("");
    return '<h2 class="lv-m-h2 lv-qk-h2">Stream queue' + (QK.items.length ? " (" + UI.plural(QK.items.length, "video", "videos") + ")" : "") + "</h2>" + qkNotesHtml() +
      (rows ? '<ul class="lv-qk-list" data-qk-list>' + rows + "</ul>" : QK.reading ? "" : mLine("No videos yet.", "lv-m-line--muted")) +
      '<div class="lv-qk-agg" data-qk-agg>' + qkAggHtml() + "</div>" + qkLongHtml() + qkAddHtml();
  }
  function qkKeyLive(key, selfId) {
    var k = String(key || "").trim();
    if (!k) return null;
    return S.streams.filter(function (o) {
      if (o.id === selfId || !o.dest || String(o.dest.key || "").trim() !== k) return false;
      var sk = stKey(o);
      return sk === "live" || sk === "starting" || sk === "stopping" || sk === "preparing";
    })[0] || null;
  }
  function qkKeyWhy(key, selfId) {
    var o = qkKeyLive(key, selfId);
    if (!o) return "";
    return canSee(o) ? "“" + o.name + "” is live on this key — one key carries one stream." : T.keyBusyAnon;
  }
  function qkClashHtml(key, selfId) {
    var o = qkKeyLive(key, selfId);
    if (!o) return "";
    return '<div class="lv-busyline lv-busyline--err">' + (IC.alert || "") + '<span class="lv-busyline__body">' +
      '<span class="an-hint">' + UI.esc(qkKeyWhy(key, selfId)) + "</span>" +
      (canSee(o) ? '<a class="lv-link" href="' + ctxUrl("live-stream.html?id=" + encodeURIComponent(o.id)) + '">Open the stream</a>' : "") +
      "</span></div>";
  }
  function qkNameLine(link) {
    var nm = nameFromLink(link);
    return nm ? "Stream name: " + UI.esc(nm) : "The stream is named after its link.";
  }
  function qkRoutesHtml() {
    var gate = qkInFlight();
    return '<p class="lv-qk-routes__t">Where to find the key</p>' +
      (gate
        ? '<button class="an-btn an-btn--secondary lv-m-btn is-off" type="button" aria-disabled="true">' + (IC.youtube || "") + QT.studio + "</button>" +
          '<p class="lv-m-why">' + QT.studioGate + "</p>"
        : '<button class="an-btn an-btn--secondary lv-m-btn" type="button" data-qk-studio>' + (IC.youtube || "") + QT.studio + "</button>");
  }
  function qkDestHtml(link, key, selfId, onStream) {
    return '<h2 class="lv-m-h2 lv-qk-h2">Destination</h2>' +
      '<label class="lv-qk-f"><span class="lv-qk-f__l">Stream link *</span>' +
        '<input class="an-input lv-qk-in" type="url" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false"' +
          ' placeholder="https://youtube.com/live/…" value="' + UI.esc(link) + '" data-qk-f="link" /></label>' +
      '<p class="lv-m-line lv-m-line--muted" data-qk-name>' + qkNameLine(link) + "</p>" +
      '<label class="lv-qk-f"><span class="lv-qk-f__l">Stream key *</span>' +
        '<input class="an-input lv-qk-in" type="text" autocomplete="off" autocapitalize="off" spellcheck="false"' +
          ' placeholder="e.g. abcd-1234-efgh-5678" value="' + UI.esc(key) + '" data-qk-f="key" /></label>' +
      '<div data-qk-clash>' + qkClashHtml(key, selfId) + "</div>" +
      '<div class="lv-qk-routes" data-qk-routes>' + qkRoutesHtml() + "</div>" +
      (onStream ? '<button class="an-btn an-btn--primary lv-m-btn" type="button" data-qk-savedest>Save destination</button>' : "");
  }
  function qkStartHtml() {
    var off = !QK.items.length || qkPending() > 0;
    return autoStartHtml({ on: !off && QK.autoStart !== false, off: off, attr: "data-qk-auto",
      label: QT.start, hint: "" });
  }
  function qkApprox(m) { return m.charAt(0) === "<" ? m : "≈" + m; }
  function qkCreateWhy() {
    if (MB.offline) return MT.offline;
    if (!QK.items.length) return QK.reading ? "Reading the videos…" : T.needVideo;
    var rp = qkRepicks().length;
    if (rp) return "Pick the " + (rp === 1 ? "video that didn’t" : "videos that didn’t") + " finish uploading again, or remove " + (rp === 1 ? "it" : "them") + ".";
    return qkKeyWhy(QK.key, QK.draftId);
  }
  function qkFootHtml() {
    var why = qkCreateWhy(), sec = 0;
    QK.items.forEach(function (it) { sec += it.sec || 0; });
    return (QK.items.length
      ? '<p class="lv-qk-price"><span>Plays once · ' + (sec ? UI.durHuman(sec) : "—") + "</span><b>" +
        (sec ? qkApprox(UI.money(rateNum(null) * sec / 3600)) : "—") + "</b></p>" : "") +
      '<button class="an-btn an-btn--primary lv-m-btn' + (why ? " is-off" : "") + '" type="button" data-qk-create' +
        (why ? ' aria-disabled="true"' : "") + ">Create stream</button>" +
      (why ? '<p class="lv-m-why">' + UI.esc(why) + "</p>" : "") +
      '<div class="lv-qk-footstart">' + qkStartHtml() + "</div>";
  }
  function qkBannerHtml() {
    if (!QK || QK.streamId || (!QK.items.length && !QK.reading)) return "";
    var m = QK.items.length, done = QK.items.filter(function (it) { return it.state === "done"; }).length, rp = qkRepicks().length;
    var line = rp ? UI.plural(rp, "video needs", "videos need") + " picking again"
      : qkActive() ? "Uploading " + Math.min(m, done + 1) + " of " + m
      : done === m ? "Videos uploaded — add the destination and create the stream" : "Waiting to upload";
    return '<div class="lv-qk-banner"><div class="lv-qk-banner__t"><b>Quick stream in progress</b><span>' + line + "</span></div>" +
      '<a class="an-btn an-btn--secondary lv-m-btn" href="' + ctxUrl("live-stream-create.html?mode=now") + '">Continue</a></div>';
  }
  function qkEntryHtml() {
    return '<a class="an-btn an-btn--primary lv-m-btn lv-qk-entry" href="' + ctxUrl("live-stream-create.html?mode=now") + '">' + (IC.plus || "") + QT.entry + "</a>";
  }
  function qkEmptyHtml() {
    return '<div class="lv-m-blank lv-qk-empty">' + mLine(QT.emptyLine) + qkEntryHtml() +
      '<button class="lv-m-link lv-qk-prep" type="button" data-qk-prep>' + QT.prep + "</button></div>";
  }

  // ---- screens
  function renderMQuick() {
    var main = mMain();
    if (!main) return;
    if (!QK) qkNew();
    document.title = "Quick stream — SubSub";
    main.innerHTML = '<a class="lv-m-back" href="' + ctxUrl("live-streams.html") + '">' + (IC.chevLeft || "") + "Streams</a>" +
      '<section class="lv-m-sec lv-m-hero"><h1 class="lv-m-h1">Quick stream</h1>' + mLine(QT.lead, "lv-m-line--muted") + "</section>" +
      '<section class="lv-m-sec lv-qk-q" data-qk-queue>' + qkQueueHtml() + "</section>" +
      '<section class="lv-m-sec" data-qk-dest>' + qkDestHtml(QK.link, QK.key, QK.draftId, false) + "</section>";
    mFoot(qkFootHtml());
    qkBindGrips();
  }
  // the stream page of a quick stream: the upload goes on here, and a missing destination is added here
  function qkStreamSecs(s) {
    var out = "";
    if (QK && QK.streamId === s.id) out += '<section class="lv-m-sec lv-qk-q" data-qk-queue>' + qkQueueHtml() + "</section>";
    if (qkStreamState(s) === "needdest" || (MB.dd && MB.dd.id === s.id)) {
      var dd = MB.dd && MB.dd.id === s.id ? MB.dd : { link: (s.dest && s.dest.link) || "", key: (s.dest && s.dest.key) || "" };
      out += '<section class="lv-m-sec" data-qk-dest>' + qkDestHtml(dd.link, dd.key, s.id, true) + "</section>";
    }
    return out;
  }
  function qkRefresh() {
    if (!MOB) return;
    var set = function (sel, html) { var el = document.querySelector(sel); if (el) el.innerHTML = html; };
    if (QK) {
      set("[data-qk-queue]", qkQueueHtml());
      set("[data-qk-routes]", qkRoutesHtml());
      set("[data-qk-start]", qkStartHtml());
      if (MB.view === "quick") mFoot(qkFootHtml());
    }
    set("[data-qk-banner]", qkBannerHtml());
    qkBindGrips();
  }
  function qkRedraw() {
    if (!MOB) return;
    var a = document.activeElement;
    if (a && /^(INPUT|TEXTAREA)$/.test(a.tagName)) { qkRefresh(); return; }
    render();
  }
  function qkChanged() { qkPersist(); qkSyncDraft(); qkRedraw(); }
  function qkPaint() {
    if (!MOB || !QK) return;
    var it = qkActive();
    if (it) {
      var p = qkPct(it);
      [].forEach.call(document.querySelectorAll('[data-qk-pct="' + it.uid + '"]'), function (el) { el.textContent = "Uploading · " + p + "%"; });
      [].forEach.call(document.querySelectorAll('[data-qk-barf="' + it.uid + '"]'), function (el) { el.style.width = p + "%"; });
    }
    var ag = document.querySelector("[data-qk-agg]");
    if (ag) ag.innerHTML = qkAggHtml();
    var bn = document.querySelector("[data-qk-banner]");
    if (bn) bn.innerHTML = qkBannerHtml();
  }

  // ---- sheets and actions
  function qkSheetBtns(primary, secondary) { return '<div class="lv-qk-sheetb">' + primary + secondary + "</div>"; }
  function qkStudioLink() {
    return '<a class="an-btn an-btn--primary lv-m-btn" href="https://studio.youtube.com/channel/UC/livestreaming" target="_blank" rel="noopener" data-qk-studiogo>' +
      (IC.external || "") + QT.studio + "</a>";
  }
  function qkPrepSheet() {
    mSheet(QT.prep, mLine(QT.prepBody) + qkSheetBtns(qkStudioLink(),
      '<button class="an-btn an-btn--secondary lv-m-btn" type="button" data-lv-msheetclose>Not now</button>'));
  }
  function qkStudioSheet() {
    mSheet(QT.studioAsk, mLine(QT.studioBody) + qkSheetBtns(qkStudioLink(),
      '<button class="an-btn an-btn--secondary lv-m-btn" type="button" data-lv-msheetclose>Cancel</button>'));
  }
  function qkLeaveAsk(url) {
    var it = qkActive() || QK.items.filter(function (x) { return x.state === "queued"; })[0];
    mSheet(QT.leaveT, mLine("“" + UI.esc(it ? it.name : "A video") + "” is still uploading. If you leave, it stops — finished videos stay, and you pick the rest again when you come back.") +
      qkSheetBtns('<button class="an-btn an-btn--primary lv-m-btn" type="button" data-lv-msheetclose>Stay</button>',
        '<button class="an-btn an-btn--secondary lv-m-btn" type="button" data-qk-leave="' + UI.esc(url) + '">Leave</button>'));
  }
  function qkFillDraft(s) {
    var link = QK.link.trim(), key = QK.key.trim();
    var queue = QK.items.map(function (it) { return { fileId: it.fileId, off: false }; });
    s.status = "draft"; s.virtual_status = null;
    s.name = nameFromLink(link) || "Untitled stream";
    s.dest = { name: null, key: key, link: link };
    s.queue = clone(queue); s.srcPl = null; s.detached = false; s.playlistId = null; s.fileId = null;
    s.playback = { loop: false, shuffle: false, end: { mode: "none" } };
    s.res = null; s.vert = resCap({ items: queue }).vert; s.vr = false; s.schedules = [];
    s.quick = true;
    s.draftForm = { id: s.id, name: "", key: key, link: link, queue: clone(queue), srcPl: null, detached: false,
      loop: false, shuffle: false, res: null, cover: null, desc: "", startMode: "now", schedules: [], endMode: "none",
      loopLimit: 0, untilSlot: null, tz: TZ, autoStart: QK.autoStart !== false, quick: true };
    s.draftStep = 1; s.draftMax = 1;
  }
  function qkSyncDraft() {
    if (!QK || !QK.draftId || QK.streamId) return;
    var s = stream(QK.draftId);
    if (s && s.status === "draft") { qkFillDraft(s); save(); }
  }
  // the desktop link needs something on the server to open: a draft before creation, the stream after it
  function qkHandoff(kind) {
    if (MB.offline) { UI.toast(MT.offline); return; }
    var s = QK && QK.streamId ? stream(QK.streamId) : null;
    if (!s && QK) {
      s = QK.draftId ? stream(QK.draftId) : null;
      if (!s) { s = { id: "s" + Date.now(), runs: [], spentTotal: 0, metrics: {}, schedules: [] }; S.streams.unshift(own(s)); QK.draftId = s.id; }
      qkFillDraft(s);
    } else if (!s) {
      s = stream(new URLSearchParams(location.search).get("id"));
    }
    if (s && s.status !== "draft") {
      s.runs = s.runs || [];
      if (!runOf(s)) s.runs.unshift({ id: s.id + "-r1", index: 1, start: null, end: null, spent: 0, events: [] });
      runOf(s).events.unshift(ev("notify", "Telegram: link to finish on desktop sent", { author: "You" }));
    }
    if (QK && kind === "upload") QK.longAck = true;
    save(); qkPersist();
    UI.toast(kind === "upload" ? QT.deskUpload : QT.deskKey);
    qkRefresh();
  }
  function qkCreate() {
    var why = qkCreateWhy();
    if (why) { UI.toast(why); return; }
    var s = QK.draftId ? stream(QK.draftId) : null;
    if (!s) { s = { id: "s" + Date.now(), runs: [], spentTotal: 0, metrics: {} }; S.streams.unshift(own(s)); }
    qkFillDraft(s);
    delete s.draftForm; delete s.draftStep; delete s.draftMax;
    s.dest.name = s.dest.link || s.dest.key ? channelOf(s.dest.link, s.dest.key, s.id) || null : null;
    s.status = "created"; s.cover = null; s.desc = "";
    s.autoStart = qkStartOn(); s.tg = {};
    s.runs = [{ id: s.id + "-r1", index: 1, start: null, end: null, spent: 0, events: [ev("created", "Created", { author: "You" })] }];
    QK.streamId = s.id; QK.draftId = null;
    save(); qkPersistNow();
    var k = stKey(s);
    UI.toast(k === "uploading" ? "“" + s.name + "” created — keep the app open until the upload finishes."
      : k === "needdest" ? "“" + s.name + "” created. Add the stream link and key to go live."
      : s.autoStart ? "“" + s.name + "” created — it goes live as soon as it’s ready."
      : "“" + s.name + "” created. Press Start now when you’re ready.");
    mGo("live-stream.html?id=" + encodeURIComponent(s.id));
  }
  function qkSaveDest() {
    var s = stream(new URLSearchParams(location.search).get("id"));
    if (!s) return;
    var li = document.querySelector('[data-qk-f="link"]'), ki = document.querySelector('[data-qk-f="key"]');
    var link = li ? li.value.trim() : "", key = ki ? ki.value.trim() : "";
    var why = qkKeyWhy(key, s.id);
    if (why) { UI.toast(why); return; }
    if (!link || !key) { UI.toast(T.needKey); return; }
    s.dest = { name: channelOf(link, key, s.id) || null, key: key, link: link };
    s.name = nameFromLink(link) || s.name;
    var r = runOf(s);
    if (r) r.events.unshift(ev("dest", "Destination added", { author: "You" }));
    MB.dd = null;
    save();
    UI.toast("Destination saved.");
    render();
  }
  function qkInput(kind) {
    var attr = kind === "repick" ? "data-qk-repickin" : "data-qk-in", el = document.querySelector("[" + attr + "]");
    if (el) return el;
    el = document.createElement("input");
    el.type = "file"; el.accept = "video/*,.mp4,.mov,.m4v,.webm"; el.multiple = true; el.hidden = true;
    el.setAttribute(attr, "");
    el.addEventListener("change", function () {
      var list = el.files;
      if (list && list.length) {
        if (kind === "repick") qkRepickWith(list);
        else {
          var fromList = PAGE === "streams" && MB.view !== "quick";
          qkAdd(list);
          if (fromList) mGo("live-stream-create.html?mode=now");
        }
      }
      el.value = "";
    });
    document.body.appendChild(el);
    return el;
  }

  // ---- reordering: vertical drag on the grip, arrow keys for the keyboard; no swipes anywhere
  function qkBindGrips() {
    [].forEach.call(document.querySelectorAll("[data-qk-grip]"), function (g) {
      if (g.getAttribute("data-qk-bound")) return;
      g.setAttribute("data-qk-bound", "1");
      g.addEventListener("pointerdown", qkDragStart);
      g.addEventListener("keydown", function (e) {
        if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
        e.preventDefault();
        var uid = g.getAttribute("data-qk-grip"), at = QK.items.indexOf(qkItem(uid));
        qkMove(uid, at + (e.key === "ArrowUp" ? -1 : 1));
        setTimeout(function () { var ng = document.querySelector('[data-qk-grip="' + uid + '"]'); if (ng) ng.focus(); }, 0);
      });
    });
  }
  function qkDragStart(e) {
    var g = e.currentTarget, row = g.closest("[data-qk-row]");
    if (!row || !QK) return;
    e.preventDefault();
    try { g.setPointerCapture(e.pointerId); } catch (err) {}
    var rows = [].slice.call(row.parentNode.children);
    QK_DRAG = { uid: g.getAttribute("data-qk-grip"), row: row, y0: e.clientY, rows: rows, from: rows.indexOf(row), to: rows.indexOf(row),
      mids: rows.map(function (r) { var b = r.getBoundingClientRect(); return b.top + b.height / 2; }), h: row.getBoundingClientRect().height + 4 };
    row.classList.add("is-drag");
    g.addEventListener("pointermove", qkDragMove);
    g.addEventListener("pointerup", qkDragEnd);
    g.addEventListener("pointercancel", qkDragEnd);
  }
  function qkDragMove(e) {
    var d = QK_DRAG;
    if (!d) return;
    var dy = e.clientY - d.y0, y = d.mids[d.from] + dy, to = 0;
    d.row.style.transform = "translateY(" + dy + "px)";
    d.mids.forEach(function (m, i) { if (i !== d.from && m < y) to++; });
    d.to = to;
    d.rows.forEach(function (r, i) {
      if (i === d.from) return;
      var sh = d.from < to && i > d.from && i <= to ? -d.h : d.from > to && i >= to && i < d.from ? d.h : 0;
      r.style.transform = sh ? "translateY(" + sh + "px)" : "";
    });
  }
  function qkDragEnd(e) {
    var d = QK_DRAG, g = e.currentTarget;
    QK_DRAG = null;
    g.removeEventListener("pointermove", qkDragMove);
    g.removeEventListener("pointerup", qkDragEnd);
    g.removeEventListener("pointercancel", qkDragEnd);
    if (!d) return;
    d.rows.forEach(function (r) { r.style.transform = ""; r.classList.remove("is-drag"); });
    if (d.to !== d.from) qkMove(d.uid, d.to);
  }

  // ---- in-document routing between the mobile Live screens, so an upload survives moving between them
  var M_ROUTES = { "live-streams.html": "streams", "live-stream.html": "stream", "live-stream-create.html": "form" };
  function mRouteOf(href) {
    var u;
    try { u = new URL(href, location.href); } catch (e) { return null; }
    if (u.origin !== location.origin) return null;
    var pg = M_ROUTES[u.pathname.split("/").pop()];
    if (!pg || (pg === "form" && u.searchParams.get("mode") !== "now")) return null;
    return pg;
  }
  function mApplyRoute() {
    var pg = mRouteOf(location.href);
    if (!pg) return;
    PAGE = pg;
    document.body.setAttribute("data-lv-page", PAGE);
    MB.view = PAGE === "form" ? "quick" : null;
    if (PAGE !== "stream") MB.dd = null;
    mSheetClose();
    render();
    mFocus(new URLSearchParams(location.search).get("focus"));
  }
  function mGo(url) {
    var to = ctxUrl(url);
    if (!QK || !mRouteOf(to)) { location.href = to; return; }
    history.pushState({ lvm: 1 }, "", to);
    window.scrollTo(0, 0);
    mApplyRoute();
  }
  function qkInit() {
    var qp = new URLSearchParams(location.search);
    if (PAGE === "form" && qp.get("mode") === "now") MB.view = "quick";
    (S.qkFiles || []).forEach(function (f) { if (f.state === "uploading") { f.state = "failed"; delete f.progress; } });
    qkSettle();
    qkLoad(function (m) {
      if (!m || (QK && (QK.items.length || QK.streamId))) return;
      if (!qkRestore(m)) return;
      if (MB.view === "quick" && QK.streamId) {
        history.replaceState(null, "", ctxUrl("live-stream.html?id=" + encodeURIComponent(QK.streamId)));
        mApplyRoute();
        return;
      }
      if (MOB) render();
    });
    window.addEventListener("popstate", function () { if (MOB && mRouteOf(location.href)) mApplyRoute(); });
    window.addEventListener("beforeunload", function (e) {
      if (QK && !QK.leaving && qkInFlight()) { e.preventDefault(); e.returnValue = ""; }
    });
    window.addEventListener("pagehide", qkPersistNow);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) { qkPump(); qkPaint(); return; }
      qkWakeSync();
      qkPersistNow();
      if (!MOB || PAGE !== "stream") return;
      var s = stream(new URLSearchParams(location.search).get("id"));
      if (s && s.quick && qkStreamState(s) === "needdest") {
        s.tg = s.tg || {};
        if (!s.tg.needdest) {
          s.tg.needdest = true;
          qkTg(s, "“" + s.name + "” needs a destination — the link opens the key step on desktop.", true);
          save();
        }
      }
    });
    document.addEventListener("input", function (e) {
      var t = e.target, k = t && t.getAttribute && t.getAttribute("data-qk-f");
      if (!k || !MOB) return;
      var li = document.querySelector('[data-qk-f="link"]'), ki = document.querySelector('[data-qk-f="key"]');
      var link = li ? li.value : "", key = ki ? ki.value : "", selfId = null;
      if (MB.view === "quick" && QK) {
        QK.link = link; QK.key = key; selfId = QK.draftId;
        qkPersist(); qkSyncDraft();
        mFoot(qkFootHtml());
      } else {
        selfId = new URLSearchParams(location.search).get("id");
        MB.dd = { id: selfId, link: link, key: key };
      }
      var nm = document.querySelector("[data-qk-name]"), cl = document.querySelector("[data-qk-clash]");
      if (nm) nm.innerHTML = qkNameLine(link);
      if (cl) cl.innerHTML = qkClashHtml(key, selfId);
    });
    // links that leave the mobile Live screens would lose the file in flight: ask first
    document.addEventListener("click", function (e) {
      if (!MOB || !QK || e.defaultPrevented) return;
      var a = e.target.closest && e.target.closest("a[href]");
      if (!a || a.target === "_blank") return;
      var href = a.getAttribute("href") || "";
      if (!href || href.charAt(0) === "#" || /^(mailto:|javascript:)/.test(href)) return;
      if (mRouteOf(a.href)) { e.preventDefault(); e.stopPropagation(); mGo(href); return; }
      if (qkInFlight()) { e.preventDefault(); e.stopPropagation(); qkLeaveAsk(a.href); }
    }, true);
    document.addEventListener("click", function (e) {
      if (!MOB) return;
      var t = e.target;
      if (!t.closest) return;
      var q = function (sel) { return t.closest(sel); }, el;
      if (q("[data-qk-pick]")) { qkInput("add").click(); return; }
      if (q("[data-qk-lib]")) {
        var pk = document.getElementById("lvPicker");
        if (pk && pk.parentNode !== document.body) document.body.appendChild(pk);
        pickOpen({ kind: "qk" });
        return;
      }
      if (q("[data-qk-repick]")) { QK.repickUid = null; qkInput("repick").click(); return; }
      if ((el = q("[data-qk-retry]"))) { QK.repickUid = el.getAttribute("data-qk-retry"); qkInput("repick").click(); return; }
      if ((el = q("[data-qk-rm]"))) { qkRemove(el.getAttribute("data-qk-rm")); return; }
      if (q("[data-qk-prep]")) { qkPrepSheet(); return; }
      if (q("[data-qk-studio]")) { qkStudioSheet(); return; }
      if (q("[data-qk-studiogo]")) { mSheetClose(); return; }
      if ((el = q("[data-qk-desk]"))) { qkHandoff(el.getAttribute("data-qk-desk")); return; }
      if (q("[data-qk-longok]")) { QK.longAck = true; qkRefresh(); return; }
      if (q("[data-qk-auto]")) { QK.autoStart = QK.autoStart === false; qkPersist(); qkSyncDraft(); qkRefresh(); return; }
      if ((el = q("[data-qk-create]"))) { if (UI.isOff(el)) { var w = qkCreateWhy(); if (w) UI.toast(w); return; } qkCreate(); return; }
      if ((el = q("[data-qk-leave]"))) { if (QK) QK.leaving = true; qkPersistNow(); location.href = el.getAttribute("data-qk-leave"); return; }
      if (q("[data-qk-savedest]")) { qkSaveDest(); return; }
    });
  }

// ============================================================ старт
  function render() {
    syncChrome();
    if (MOB && M_LIVE_PAGES.indexOf(PAGE) !== -1) { renderMobile(); return; }
    if (PAGE === "streams") renderList();
    else if (PAGE === "stream") renderDetail();
    else if (PAGE === "playlists") renderPlaylists();
    else if (PAGE === "playlist") renderPlEditor();
    else if (PAGE === "form") renderForm();
    else if (PAGE === "calendar") renderCalendar();
    else if (PAGE === "settings") renderSettings();
    else if (PAGE === "org") renderOrgSettings();
  }
  // Демо-параметры в адресе: удобно и для показа, и для снимков состояний одним URL.
  // ?demo=payg|trial|org|empty — режим счёта, ?loading=1 — состояние загрузки.
  function readQuery() {
    var p = new URLSearchParams(location.search);
    var dm = p.get("demo");
    if (dm && F.account.modes[dm]) S.account.mode = dm;
    // вход из карточки стрима: календарь открывается на нужном дне и канале
    if (PAGE === "calendar") {
      var dq = p.get("date"), cq = p.get("dest"), sq = p.get("scale");
      if (dq && /^\d{4}-\d{2}-\d{2}$/.test(dq)) CALV.anchor = dq;
      if (cq && (cq === "__all" || dests().indexOf(cq) !== -1)) CALV.dest = cq;
      if (sq && ["day", "week", "month"].indexOf(sq) !== -1) CALV.scale = sq;
      var vq = p.get("view");
      if (vq === "list" || vq === "cal") CALV.view = vq;
    }
    if (p.get("loading") === "1") S.loading = true;
    return p.get("loading") === "1";
  }
  function boot() {
    orgShell();
    mInit();
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
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a || !CTX.on) return;
    var h = a.getAttribute("href");
    if (h) a.setAttribute("href", ctxUrl(h));
  }, true);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

// Раздел Wallet: Balance (транзакции, пополнение, вывод), Payment methods, Usage.
// Поведение снято с dev.subsub.cc/wallet и pages/wallet/* репозитория; данные — WALLET_FIXTURES.
(function () {
  "use strict";
  var F = window.WALLET_FIXTURES, IC = window.WALLET_ICONS || {}, UI = window.LVUI;
  if (!F || !UI) return;
  // Демо-вариант порта (serve.js 8785 empty): новый аккаунт — пусто, верификация не пройдена.
  var DEMO = document.body.getAttribute("data-demo") === "empty" ? "empty" : "";
  if (DEMO) {
    F = JSON.parse(JSON.stringify(F));
    F.tx = []; F.methods = [];
    F.account = { balance: 0, pending: 0, currency: "USD", verified: false, reserved: 0 };
  }
  var KEY = "subsub_wallet_state" + (DEMO ? "_" + DEMO : "");
  var STATE_V = 2;
  var PAGE = document.body.getAttribute("data-wl-page") || "";
  var TZ = "Europe/Kyiv";

  function fresh() {
    return { v: STATE_V, balance: F.account.balance, pending: F.account.pending, hidden: false, tx: F.tx.slice(), methods: F.methods.slice() };
  }
  var S = UI.storeGet(KEY, null) || fresh();
  if (S.v !== STATE_V) S = fresh();
  function save() { UI.storeSet(KEY, S); }
  window.subsubWalletReset = function () { UI.storeDel(KEY); location.reload(); };

  // ---- справочники
  var TYPE_LABEL = {}, TYPE_ICON = {
    youtube: "youtube", youtube_shorts: "shorts", youtube_shopping: "shopping", withdraw: "withdraw",
    adjustment: "adjust", tax_adjustment: "tax", tax_adjustment_shorts: "tax", wallet_top_up: "topup",
    bonus: "gift", payg_charge: "receipt", media_usage: "folder", stream_usage: "broadcast"
  };
  F.types.forEach(function (t) { TYPE_LABEL[t[0]] = t[1]; });
  var PM = {}, PM_ICON = { card: "card", bank: "bank", paypal: "paypal", payoneer: "letterP", usdt: "coin", usdt_erc: "coin", usdc_erc: "coin" };
  F.payoutMethods.forEach(function (m) { PM[m.slug] = m; });
  var WD_STATUS = { pending: "Created", processing: "Processing", processed: "Done", cancelled: "Cancelled" };
  var T = {
    verifyTitle: "Verify your identity to proceed",
    verifyDesc: "To ensure the security of your transactions and withdrawals, identity verification is required. Please complete the verification process to unlock full access to Wallet features.",
    verifyBtn: "Get verified now",
    verifyToast: "Identity verification opens in Account settings → Security.",
    noTx: "You don't have any transactions yet",
    noMethods: "You don't have any payment methods yet",
    methodsEmpty: "Adding payment methods makes it easier and faster to complete your transactions. You can securely add your credit/debit card, PayPal, Payoneer account, or USDT wallet to simplify your payments.",
    withdrawOffVerify: "Verify your identity to withdraw funds.",
    withdrawOffEmpty: "Nothing to withdraw yet.",
    topUpOffAmount: "Enter an amount to continue.",
    tooMuch: "Enter smaller amount",
    reserved: function (r, a) { return r.toFixed(2) + " USD is reserved for streaming costs, so only " + a.toFixed(2) + " USD is available to withdraw right now"; }
  };

  function ico(name) { return IC[name] || ""; }
  function money(n) { return UI.money(Math.abs(n)); }
  function signed(n) { return (n < 0 ? "-" : "") + UI.money(Math.abs(n)); }
  function fmtDt(iso) {
    return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
  }
  function fmtDay(iso) {
    return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
  }
  function fmtNum(d) {
    var p = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(d), o = {};
    p.forEach(function (x) { o[x.type] = x.value; });
    return o.day + "." + o.month + "." + o.year;
  }
  function round2(n) { return Math.round(n * 100) / 100; }
  function nowIso() { return F.now; }
  function shortNumber(method, number) {
    number = String(number || "");
    if (method === "card") return "••••" + number.replace(/\s+/g, "").slice(-4);
    if (method === "bank") return number.slice(0, 2) + "••••" + number.slice(-2);
    if (method === "paypal" || method === "payoneer") {
      var at = number.indexOf("@");
      return at > 0 ? number.slice(0, Math.min(3, at)) + "•••" + number.slice(at) : number;
    }
    return number.length > 12 ? number.slice(0, 6) + "…" + number.slice(-4) : number;
  }
  function methodOf(id) { return S.methods.filter(function (m) { return m.id === id; })[0] || null; }
  function methodLabel(m) { return m ? (PM[m.method] ? PM[m.method].title : m.method) + " " + shortNumber(m.method, m.number) : "Card"; }
  function off(el, isOff, reason) {
    if (!el) return;
    el.classList.toggle("is-off", !!isOff);
    if (isOff) { el.setAttribute("aria-disabled", "true"); if (reason) el.setAttribute("data-tip", reason); }
    else { el.removeAttribute("aria-disabled"); el.removeAttribute("data-tip"); }
  }
  function btn(label, mode, attrs, icon) {
    return '<button class="an-btn an-btn--' + mode + ' an-btn--small" type="button" ' + (attrs || "") + ">" + (icon || "") + UI.esc(label) + "</button>";
  }
  // копирование реквизита: буфер обмена, запасной путь — скрытое поле с выделением
  function copyText(text) {
    function done() { UI.toast("Copied to clipboard."); }
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (e) { }
      ta.remove(); done();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, fallback); return; }
    fallback();
  }
  function modal(id, title, bodyHtml, footHtml, cls) {
    var m = document.getElementById(id);
    if (!m) { m = document.createElement("div"); m.className = "an-modal"; m.id = id; document.body.appendChild(m); }
    m.innerHTML = '<div class="an-modal__overlay" data-lv-close></div>' +
      '<div class="an-modal__dialog' + (cls ? " " + cls : "") + '" role="dialog" aria-modal="true" aria-label="' + UI.esc(title) + '">' +
        '<div class="an-modal__head"><h3 class="an-modal__title">' + UI.esc(title) + "</h3>" +
        '<button class="an-modal__x" type="button" data-lv-close aria-label="Close">' + ico("close") + "</button></div>" +
        '<div class="an-modal__body">' + bodyHtml + "</div>" +
        (footHtml ? '<div class="an-modal__foot">' + footHtml + "</div>" : "") +
      "</div>";
    UI.openModal(m);
    return m;
  }

  // ================= общее: чип в шапке, плашка верификации =================
  function renderChip() {
    var chip = document.querySelector("[data-wl-wallet]");
    if (chip) chip.textContent = UI.money(S.balance);
  }
  function renderVerify() {
    var h = document.querySelector("[data-wl-verify]");
    if (!h) return;
    h.hidden = !!F.account.verified;
    h.innerHTML = F.account.verified ? "" :
      '<section class="rp-card wl-verify"><span class="wl-verify__ico">' + ico("shield") + "</span>" +
        '<div class="wl-verify__t"><h3 class="wl-verify__h">' + T.verifyTitle + '</h3><p class="wl-verify__p">' + T.verifyDesc + "</p></div>" +
        btn(T.verifyBtn, "primary", "data-wl-verifyact") + "</section>";
  }

  // ================= Balance =================
  var FL = { dir: "all", types: [] };
  var SORT = { by: "date", dir: "desc" };
  var PG = { page: 1, per: 50 };
  // период — общий для таблицы и метрик; сегмент как у Growth period в Analytics: скользящие окна до «сегодня»
  var PER = { mode: "quarter", from: null, to: null };
  var PER_DAYS = { month: 30, quarter: 90, year: 365 };
  var PER_VS = { month: "vs last month", quarter: "vs last quarter", year: "vs last year", custom: "vs previous period", all: "all time" };
  function firstTxDay() {
    var t = today0();
    if (!S.tx.length) { t.setDate(t.getDate() - 365); return t; }
    var d = new Date(Math.min.apply(null, S.tx.map(function (x) { return Date.parse(x.date); })));
    d.setHours(0, 0, 0, 0); return d;
  }
  function today0() { var d = new Date(Date.parse(F.now)); d.setHours(0, 0, 0, 0); return d; }
  function perRange() {
    var t = today0();
    if (PER.mode === "custom" && PER.from && PER.to) return { from: PER.from, to: PER.to };
    if (PER.mode === "all") return { from: firstTxDay(), to: t };
    var from = new Date(t.getTime()); from.setDate(from.getDate() - (PER_DAYS[PER.mode] || 90) + 1);
    return { from: from, to: t };
  }
  function drFmt(d) { return ("0" + d.getDate()).slice(-2) + "." + ("0" + (d.getMonth() + 1)).slice(-2) + "." + d.getFullYear(); }
  function drParse(str) { var m = String(str).trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/); return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null; }
  function drKey(d) { return d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate(); }
  function renderPeriod() {
    var r = perRange(), val = document.querySelector("[data-wl-perval]");
    // в поле всегда даты, даже для «всего периода»; крестик возвращает период по умолчанию — квартал
    if (val) val.textContent = drFmt(r.from) + " – " + drFmt(r.to);
    var clr = document.querySelector("[data-wl-perclear]");
    if (clr) clr.hidden = PER.mode === "quarter";
    [].slice.call(document.querySelectorAll("[data-wl-perset]")).forEach(function (b) {
      var on = b.getAttribute("data-wl-perset") === PER.mode;
      b.classList.toggle("is-on", on); b.setAttribute("aria-checked", on ? "true" : "false");
    });
  }
  function setPeriod(mode, from, to) {
    PER = { mode: mode, from: from || null, to: to || null };
    PG.page = 1;
    renderPeriod(); renderMetrics(); renderTx();
  }
  // метрики периода: доходы, расходы, итог и баланс — с динамикой к предыдущему окну той же длины
  function sumsIn(b) {
    var inc = 0, exp = 0;
    S.tx.forEach(function (t) {
      var ms = Date.parse(t.date);
      if (ms < b[0] || ms > b[1]) return;
      if (t.amount > 0) inc += t.amount; else exp += t.amount;
    });
    return { inc: round2(inc), exp: round2(Math.abs(exp)), net: round2(inc + exp) };
  }
  function dynHtml(cur, prev, goodUp) {
    var vs = '<span>' + PER_VS[PER.mode] + "</span>";
    if (PER.mode === "all") return '<span class="wl-delta">—</span>' + vs;
    if (S.hidden) return '<span class="wl-delta">*****</span>' + vs;
    if (!prev && !cur) return '<span class="wl-delta">0%</span>' + vs;
    if (!prev) return '<span class="wl-delta">—</span><span>no data ' + PER_VS[PER.mode].replace(/^vs /, "") + "</span>";
    var pct = (cur - prev) / Math.abs(prev) * 100, up = pct >= 0, good = goodUp ? up : !up;
    var txt = (up ? "+" : "") + (Math.abs(pct) >= 100 ? Math.round(pct) : pct.toFixed(2).replace(/\.?0+$/, "")) + "%";
    return '<span class="wl-delta ' + (good ? "wl-delta--up" : "wl-delta--down") + '">' + ico(up ? "arrowUpRight" : "arrowDownRight") + txt + "</span>" + vs;
  }
  function renderMetrics() {
    var b = periodBounds(), len = b[1] - b[0] + 1, cur = sumsIn(b), prev = sumsIn([b[0] - len, b[0] - 1]);
    var el;
    if ((el = document.querySelector("[data-wl-inc]"))) el.textContent = S.hidden ? "*****" : UI.money(cur.inc);
    if ((el = document.querySelector("[data-wl-exp]"))) el.textContent = S.hidden ? "*****" : (cur.exp ? "-" : "") + UI.money(cur.exp);
    if ((el = document.querySelector("[data-wl-net]"))) el.textContent = S.hidden ? "*****" : signed(cur.net);
    if ((el = document.querySelector("[data-wl-incdyn]"))) el.innerHTML = dynHtml(cur.inc, prev.inc, true);
    if ((el = document.querySelector("[data-wl-expdyn]"))) el.innerHTML = dynHtml(cur.exp, prev.exp, false);
    if ((el = document.querySelector("[data-wl-netdyn]"))) el.innerHTML = dynHtml(cur.net, prev.net, true);
    // баланс на начало периода = текущий минус всё, что прошло за период
    var start = round2(S.balance - cur.net);
    if ((el = document.querySelector("[data-wl-baldyn]"))) el.innerHTML = dynHtml(S.balance, start, true);
  }
  // календарь на два месяца — тот же паттерн и классы, что у Growth period в Analytics
  var DR = { from: null, to: null, view: null, preset: "" };
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var WDS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
  function drPresets() {
    var t = today0(), y = t.getFullYear(), m = t.getMonth();
    function shift(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
    function weekStart(d) { var x = new Date(d.getTime()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
    var ws = weekStart(t);
    return [
      { id: "today", label: "Today", from: t, to: t },
      { id: "yesterday", label: "Yesterday", from: shift(t, -1), to: shift(t, -1) },
      { id: "thisweek", label: "This week", from: ws, to: t },
      { id: "lastweek", label: "Last week", from: shift(ws, -7), to: shift(ws, -1) },
      { id: "thismonth", label: "This month", from: new Date(y, m, 1), to: t },
      { id: "lastmonth", label: "Last month", from: new Date(y, m - 1, 1), to: new Date(y, m, 0) },
      { id: "thisyear", label: "This year", from: new Date(y, 0, 1), to: t },
      { id: "lastyear", label: "Last year", from: new Date(y - 1, 0, 1), to: new Date(y - 1, 11, 31) },
      { id: "alltime", label: "All time", from: new Date(2005, 0, 1), to: t }
    ];
  }
  function drOpen(open) {
    var wrap = document.querySelector("[data-wl-dr]");
    if (!wrap) return;
    if (open) {
      var r = perRange();
      DR.from = r.from; DR.to = r.to; DR.preset = "";
      DR.view = new Date(DR.to.getFullYear(), DR.to.getMonth() - 1, 1);
      drRender();
    }
    wrap.querySelector("[data-wl-drpop]").hidden = !open;
    wrap.classList.toggle("is-open", !!open);
    wrap.querySelector("[data-wl-drtrig]").setAttribute("aria-expanded", open ? "true" : "false");
  }
  function drRender() {
    var wrap = document.querySelector("[data-wl-dr]");
    if (!wrap || !DR.view) return;
    wrap.querySelector("[data-wl-drpresets]").innerHTML = drPresets().map(function (p) {
      return '<button class="an-dr__preset' + (p.id === DR.preset ? " is-on" : "") + '" type="button" data-wl-drpreset="' + p.id + '">' + p.label + "</button>";
    }).join("");
    var todayK = drKey(today0());
    [0, 1].forEach(function (i) {
      var mv = new Date(DR.view.getFullYear(), DR.view.getMonth() + i, 1);
      wrap.querySelector('[data-wl-drmon="' + i + '"]').textContent = MONTHS[mv.getMonth()] + " " + mv.getFullYear();
      var html = WDS.map(function (w) { return '<span class="an-dr__wd">' + w + "</span>"; }).join("");
      var lead = (mv.getDay() + 6) % 7;
      var start = new Date(mv.getFullYear(), mv.getMonth(), 1 - lead);
      var band = DR.from && DR.to && drKey(DR.from) !== drKey(DR.to);
      for (var c = 0; c < 42; c++) {
        var day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + c);
        var isStart = DR.from && drKey(day) === drKey(DR.from), isEnd = DR.to && drKey(day) === drKey(DR.to);
        var inRange = DR.from && DR.to && day > DR.from && day < DR.to;
        html += '<button class="an-dr__day' + (day.getMonth() !== mv.getMonth() ? " an-dr__day--out" : "") +
          (inRange ? " an-dr__day--in" : "") + (isStart || isEnd ? " an-dr__day--edge" : "") +
          (band && isStart ? " an-dr__day--start" : "") + (band && isEnd ? " an-dr__day--end" : "") +
          (drKey(day) === todayK ? " an-dr__day--today" : "") +
          '" type="button" data-wl-drday="' + drFmt(day) + '"><span class="an-dr__d">' + day.getDate() + "</span></button>";
      }
      wrap.querySelector('[data-wl-drgrid="' + i + '"]').innerHTML = html;
    });
    wrap.querySelector("[data-wl-drfrom]").value = DR.from ? drFmt(DR.from) : "";
    wrap.querySelector("[data-wl-drto]").value = DR.to ? drFmt(DR.to) : "";
  }
  function drPickDay(str) {
    var day = drParse(str);
    if (!day) return;
    if (!DR.from || (DR.from && DR.to)) { DR.from = day; DR.to = null; }
    else if (day < DR.from) { DR.to = DR.from; DR.from = day; }
    else DR.to = day;
    DR.preset = "";
    drRender();
  }
  function drUsePreset(id) {
    var p = drPresets().filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    DR.from = p.from; DR.to = p.to; DR.preset = id;
    DR.view = new Date(DR.to.getFullYear(), DR.to.getMonth() - 1, 1);
    drRender();
  }
  function drApply() {
    var wrap = document.querySelector("[data-wl-dr]");
    var f = drParse(wrap.querySelector("[data-wl-drfrom]").value) || DR.from;
    var t = drParse(wrap.querySelector("[data-wl-drto]").value) || DR.to || f;
    if (!f) return;
    if (t < f) { var sw = f; f = t; t = sw; }
    drOpen(false);
    setPeriod("custom", f, t);
  }

  function renderBalance() {
    var b = document.querySelector("[data-wl-balance]"), p = document.querySelector("[data-wl-pending]");
    if (b) b.textContent = S.hidden ? "*****" : S.balance.toFixed(2);
    if (p) p.textContent = S.hidden ? "*****" : UI.money(S.pending);
    var eye = document.querySelector("[data-wl-eye]");
    if (eye) { eye.innerHTML = S.hidden ? ico("eyeOff") : ico("eye"); eye.setAttribute("aria-pressed", S.hidden ? "true" : "false"); }
    var wd = document.querySelector("[data-wl-withdraw]");
    off(wd, !F.account.verified || S.balance <= 0, !F.account.verified ? T.withdrawOffVerify : T.withdrawOffEmpty);
    renderChip();
  }
  function periodBounds() {
    var r = perRange();
    return [r.from.getTime(), r.to.getTime() + 864e5 - 1];
  }
  function txFiltered() {
    var b = periodBounds();
    var rows = S.tx.filter(function (t) {
      if (FL.dir === "in" && t.amount < 0) return false;
      if (FL.dir === "out" && t.amount > 0) return false;
      if (FL.types.length && FL.types.indexOf(t.type) === -1) return false;
      var ms = Date.parse(t.date);
      return ms >= b[0] && ms <= b[1];
    });
    rows.sort(function (a, c) {
      var k = SORT.by === "amount" ? a.amount - c.amount : Date.parse(a.date) - Date.parse(c.date);
      return SORT.dir === "asc" ? k : -k;
    });
    return rows;
  }
  function filtersActive() { return FL.dir !== "all" || FL.types.length > 0; }
  var COLS = "minmax(0, 1fr) 170px 130px 130px 140px";
  function balanceAfter() {
    var list = S.tx.slice().sort(function (a, b) { return Date.parse(b.date) - Date.parse(a.date); });
    var run = S.balance, out = {};
    list.forEach(function (t) { out[t.id] = round2(run); run = round2(run - t.amount); });
    return out;
  }
  function sortBtn(by) {
    var on = SORT.by === by;
    return '<button class="wl-sort' + (on ? " is-on" : "") + '" type="button" data-wl-sort="' + by + '" aria-label="Sort by ' + by + '">' +
      (on && SORT.dir === "asc" ? ico("arrowUp") : ico("arrowDown")) + "</button>";
  }
  function isPendingWd(t) { return t.type === "withdraw" && (t.status === "pending" || t.status === "processing"); }
  function amountCls(t) { return isPendingWd(t) ? "wl-pend" : t.amount > 0 ? "wl-pos" : t.amount < 0 ? "wl-neg" : ""; }
  // статус платежа: у выводов — свой жизненный цикл, остальные операции проведены
  var ST_CLS = { pending: "warn", processing: "info", processed: "ok", cancelled: "bad" };
  function statusTag(t) {
    var k = t.type === "withdraw" && t.status ? t.status : "processed";
    return '<span class="ml-tag ml-tag--sm ml-tag--' + (ST_CLS[k] || "muted") + '">' + (WD_STATUS[k] || "Done") + "</span>";
  }
  function txIcon(t) { return '<span class="wl-tx__ico">' + (ico(TYPE_ICON[t.type]) || ico("alert")) + "</span>"; }
  function renderTx() {
    var host = document.querySelector("[data-wl-tx]");
    if (!host) return;
    var rows = txFiltered(), total = rows.length, pages = Math.max(1, Math.ceil(total / PG.per));
    if (PG.page > pages) PG.page = pages;
    var slice = rows.slice((PG.page - 1) * PG.per, PG.page * PG.per);
    document.querySelector("[data-wl-count]").textContent = total;
    document.querySelector("[data-wl-pages]").textContent = "Pages: " + pages;
    document.querySelector("[data-wl-pageno]").value = PG.page;
    document.querySelector("[data-wl-prev]").disabled = PG.page <= 1;
    document.querySelector("[data-wl-next]").disabled = PG.page >= pages;
    document.querySelector("[data-wl-perpagev]").textContent = PG.per;
    var fdot = document.querySelector("[data-wl-fdot]");
    if (fdot) fdot.hidden = !filtersActive();
    if (!total) {
      host.innerHTML = '<div class="an-blank"><span class="an-blank__ico">' + ico("wallet") + "</span>" +
        '<p class="an-blank__title">' + (S.tx.length ? "Nothing found" : "No transactions yet") + "</p>" +
        '<p class="an-blank__text">' + (S.tx.length ? "Try another filter or clear them all." : T.noTx) + "</p></div>";
      return;
    }
    var after = balanceAfter();
    host.innerHTML = '<div class="an-tr an-tr--head" style="grid-template-columns:' + COLS + '">' +
        '<div class="an-th wl-th--name">Transaction name</div><div class="an-th">Date ' + sortBtn("date") + '</div><div class="an-th">Status</div>' +
        '<div class="an-th wl-th--amount">Amount ' + sortBtn("amount") + '</div><div class="an-th wl-th--amount">Balance</div></div>' +
      slice.map(function (t) {
        return '<div class="an-tr wl-tx__row" role="button" tabindex="0" data-wl-open="' + t.id + '" style="grid-template-columns:' + COLS + '">' +
          '<div class="an-td wl-td--name">' + txIcon(t) + '<span class="wl-tx__name">' + UI.esc(t.name) + "</span></div>" +
          '<div class="an-td">' + fmtDt(t.date) + "</div>" +
          '<div class="an-td">' + statusTag(t) + "</div>" +
          '<div class="an-td wl-td--amount ' + amountCls(t) + '">' + (S.hidden ? "*****" : signed(t.amount)) + "</div>" +
          '<div class="an-td wl-td--amount wl-td--rest">' + (S.hidden ? "*****" : UI.money(after[t.id])) + "</div></div>";
      }).join("");
  }
  function renderFilters() {
    var ty = document.querySelector("[data-wl-types]");
    if (ty) ty.innerHTML = F.types.map(function (x) {
      var on = FL.types.indexOf(x[0]) !== -1;
      return '<button class="anf-chip' + (on ? " is-on" : "") + '" type="button" aria-pressed="' + on + '" data-wl-typev="' + x[0] + '">' + x[1] + "</button>";
    }).join("");
    [].slice.call(document.querySelectorAll("[data-wl-dirv]")).forEach(function (b) {
      var on = b.getAttribute("data-wl-dirv") === FL.dir;
      b.classList.toggle("is-on", on); b.setAttribute("aria-checked", on ? "true" : "false");
    });
  }
  function filtersOpen(open) {
    var a = document.querySelector("[data-wl-fpanel]");
    if (!a) return;
    a.classList.toggle("is-active", open);
    document.body.classList.toggle("filters-open", open);
    var b = document.querySelector("[data-wl-filters]");
    if (b) b.setAttribute("aria-expanded", open ? "true" : "false");
  }
  function applyFilters() { PG.page = 1; renderFilters(); renderTx(); }

  // ---- детали транзакции
  function txById(id) { return S.tx.filter(function (t) { return t.id === id; })[0] || null; }
  function rows(list) {
    return '<dl class="wl-rows">' + list.map(function (r) {
      return '<div class="wl-rows__r"><dt>' + UI.esc(String(r[0])) + "</dt><dd>" + (r[2] ? r[1] : UI.esc(String(r[1]))) + "</dd></div>";
    }).join("") + "</dl>";
  }
  function txRows(t) {
    var d = t.details || {};
    switch (t.type) {
      case "wallet_top_up": return rows([["Payment method", methodLabel(methodOf(d.methodId))], ["Status", "Done"], ["Reference", d.ref || "—"]]);
      case "withdraw": {
        var m = methodOf(d.methodId);
        return rows([["Payout method", m ? m.name + " · " + shortNumber(m.method, m.number) : "—"], ["Amount", money(t.amount)],
          ["Fee", money(d.fee || 0)], ["Payout", money(d.payout || 0)],
          ["Status", '<span class="ml-tag ml-tag--sm ml-tag--muted">' + (WD_STATUS[t.status] || "—") + "</span>", true]]);
      }
      case "youtube": case "youtube_shorts": case "youtube_shopping":
        return rows([["Period", d.period || "—"]].concat((d.channels || []).map(function (c) { return [c[0], money(c[1])]; })));
      case "stream_usage": case "payg_charge":
        return rows([["Billing model", d.billing || "Pay as you go"], ["Number of streams", d.streams != null ? d.streams : "—"], ["Period", d.period || "—"]]);
      case "media_usage":
        return rows([["Billing model", d.billing || "Pay as you go"], ["Number of files", d.files != null ? d.files : "—"], ["Storage", d.storage || "—"], ["Period", d.period || "—"]]);
      default: return d.note ? rows([["Note", d.note]]) : "";
    }
  }
  function txOpen(id) {
    var t = txById(id);
    if (!t) return;
    modal("wlTx", "Transaction details",
      '<section class="wl-txcard"><div class="wl-txcard__top"><span class="wl-txcard__ico">' + (ico(TYPE_ICON[t.type]) || ico("alert")) + "</span>" +
        '<span class="wl-txcard__date">' + fmtDay(t.date) + "</span></div>" +
        '<p class="wl-txcard__sum ' + amountCls(t) + '">' + signed(t.amount) + "</p>" +
        '<p class="wl-txcard__name">' + UI.esc(t.name) + "</p></section>" + txRows(t), "");
  }

  // ---- пополнение (Stripe в прототипе имитируется)
  var PRESETS = [1, 5, 10, 25, 50];
  function topUpOpen() {
    modal("wlTopUp", "Top up balance",
      '<div class="wl-field"><label class="anf-lbl" for="wlAmount">Enter amount</label>' +
        '<input class="an-input" id="wlAmount" type="text" inputmode="decimal" placeholder="Enter amount" autocomplete="off" data-wl-amount /></div>' +
      '<div class="wl-chips">' + PRESETS.map(function (v) { return '<button class="anf-chip" type="button" data-wl-preset="' + v + '">$' + v + "</button>"; }).join("") + "</div>",
      btn("Add funds", "primary", 'data-wl-topup-go aria-disabled="true" data-tip="' + T.topUpOffAmount + '"'));
    var go = document.querySelector("[data-wl-topup-go]");
    go.classList.add("is-off");
    var inp = document.querySelector("[data-wl-amount]");
    setTimeout(function () { inp.focus(); }, 0);
  }
  function topUpAmount() {
    var inp = document.querySelector("[data-wl-amount]");
    var v = parseFloat(String(inp ? inp.value : "").replace(",", "."));
    return isFinite(v) && v > 0 ? round2(v) : 0;
  }
  function topUpSync() { off(document.querySelector("[data-wl-topup-go]"), !topUpAmount(), T.topUpOffAmount); }
  function topUpGo() {
    var v = topUpAmount();
    if (!v) return;
    UI.closeModals();
    var card = S.methods.filter(function (m) { return m.method === "card"; })[0];
    setTimeout(function () {
      S.balance = round2(S.balance + v);
      S.tx.unshift({ id: "t" + Date.now(), type: "wallet_top_up", name: "Top Up", date: nowIso(), amount: v,
        details: { methodId: card ? card.id : null, status: "done", ref: "pi_" + Math.random().toString(36).slice(2, 12) } });
      save(); renderAll();
      modal("wlTopUpOk", "Balance successfully topped up by $" + v.toFixed(2),
        '<p class="an-modal__text">Funds are now available in your wallet</p>', btn("Got it", "primary", "data-lv-close data-lv-focus"), "an-modal__dialog--sm");
    }, 600);
  }

  // ---- вывод: два шага, как WithdrawalDialog в проде
  var WD = { step: 1, methodId: null, amount: 0 };
  function feeFor(m, amount) {
    var meta = PM[m.method] || { pct: 0, fix: 0 };
    var fee = amount * meta.pct / 100 + (meta.fix || 0);
    if (meta.min && fee < meta.min) fee = meta.min;
    return round2(fee);
  }
  function available() { return round2(Math.max(0, S.balance - (F.account.reserved || 0))); }
  function withdrawOpen() {
    WD = { step: 1, methodId: S.methods.length === 1 ? S.methods[0].id : null, amount: 0 };
    withdrawRender();
  }
  function pmIcon(m) { return '<span class="wl-pm__ico">' + ico(PM_ICON[m.method] || "card") + "</span>"; }
  function withdrawRender() {
    if (WD.step === 1) {
      var body = '<p class="an-modal__text">Choose payout method</p>' +
        (S.methods.length
          ? '<div class="wl-pmlist" role="radiogroup" aria-label="Payout method">' + S.methods.map(function (m) {
              var on = m.id === WD.methodId;
              return '<button class="wl-pmrow' + (on ? " is-on" : "") + '" type="button" role="radio" aria-checked="' + on + '" data-wl-wdm="' + m.id + '">' +
                pmIcon(m) + '<span class="wl-pmrow__t"><b>' + UI.esc(m.name) + '</b><small class="wl-pm__cur"><span class="an-muted">' + UI.esc(m.currency) + "</span><span>" + shortNumber(m.method, m.number) + "</span></small></span></button>";
            }).join("") + "</div>"
          : '<div class="an-blank"><p class="an-blank__text">' + T.noMethods + "</p></div>") +
        '<a class="wl-addhint" href="wallet-method-new.html"><span>Can\'t find a suitable payout method?</span><span class="an-btn an-btn--secondary an-btn--tiny">Add new</span></a>';
      modal("wlWd", "Withdrawal request", body, btn("Next", "primary", "data-wl-wdnext"));
      off(document.querySelector("[data-wl-wdnext]"), !WD.methodId, "Choose a payout method to continue.");
      return;
    }
    var m = methodOf(WD.methodId), avail = available(), reserved = F.account.reserved || 0;
    var body2 = '<div class="wl-wdcards">' +
        '<div class="wl-wdcard"><span class="wl-pm__ico">' + ico("wallet") + '</span><b>' + UI.money(S.balance) + '</b><small>Current balance</small></div>' +
        '<span class="wl-wdcards__arrow" aria-hidden="true">' + ico("chevRight") + "</span>" +
        '<div class="wl-wdcard">' + pmIcon(m) + '<b><span class="an-muted">' + UI.esc(m.currency) + "</span> | " + shortNumber(m.method, m.number) + "</b><small>" + UI.esc(m.name) + "</small></div>" +
      "</div>" +
      '<div class="wl-field"><label class="anf-lbl" for="wlWdAmount">Transfer</label>' +
        '<div class="wl-inputrow"><input class="an-input" id="wlWdAmount" type="text" inputmode="decimal" placeholder="0.00" autocomplete="off" value="' + (WD.amount ? WD.amount : "") + '" data-wl-wdamount />' +
        '<button class="an-btn an-btn--link an-btn--tiny" type="button" data-wl-wdmax>Max.</button></div>' +
        '<p class="wl-err" data-wl-wderr hidden>' + T.tooMuch + "</p></div>" +
      (reserved > 0 ? '<div class="an-alert an-alert--attention"><span class="wl-alertico">' + ico("info") + "</span><span>" + T.reserved(reserved, avail) + "</span></div>" : "") +
      '<dl class="wl-rows" data-wl-wdsum></dl>';
    modal("wlWd", "Withdrawal request", body2, btn("Prev", "secondary", "data-wl-wdprev") + btn("Withdraw", "primary", "data-wl-wdgo"), "an-modal__dialog--lg");
    withdrawSync();
    setTimeout(function () { var i = document.querySelector("[data-wl-wdamount]"); if (i) i.focus(); }, 0);
  }
  function withdrawSync() {
    var inp = document.querySelector("[data-wl-wdamount]");
    if (!inp) return;
    var v = parseFloat(String(inp.value).replace(",", ".")), m = methodOf(WD.methodId);
    var amount = isFinite(v) && v > 0 ? round2(v) : 0, avail = available();
    var fee = amount ? feeFor(m, amount) : 0, payout = round2(amount - fee);
    var tooMuch = amount > avail, bad = !amount || tooMuch || payout <= 0;
    WD.amount = amount;
    var err = document.querySelector("[data-wl-wderr]");
    if (err) err.hidden = !tooMuch;
    var sum = document.querySelector("[data-wl-wdsum]");
    if (sum) sum.innerHTML = [["Available balance", UI.money(avail)], ["Amount", amount ? UI.money(amount) : "—"],
      ["Fee", amount ? UI.money(fee) : "—"], ["Payout", amount && payout > 0 ? UI.money(payout) : "—"]].map(function (r) {
        return '<div class="wl-rows__r"><dt>' + r[0] + "</dt><dd>" + r[1] + "</dd></div>";
      }).join("");
    off(document.querySelector("[data-wl-wdgo]"), bad, tooMuch ? T.tooMuch : payout <= 0 && amount ? "The fee exceeds the amount." : "Enter an amount to continue.");
  }
  function withdrawGo() {
    var m = methodOf(WD.methodId);
    if (!m || !WD.amount || WD.amount > available()) return;
    var fee = feeFor(m, WD.amount);
    S.balance = round2(S.balance - WD.amount);
    S.tx.unshift({ id: "t" + Date.now(), type: "withdraw", name: "Withdrawal", date: nowIso(), amount: -WD.amount, status: "processing",
      details: { methodId: m.id, fee: fee, payout: round2(WD.amount - fee) } });
    save(); renderAll();
    UI.closeModals();
    modal("wlWdOk", "Payment has been successfully sent!",
      '<p class="an-modal__text">The withdrawal of ' + UI.money(WD.amount) + " to " + UI.esc(m.name) + " is processing — you will see it in Transactions.</p>",
      btn("Close", "primary", "data-lv-close data-lv-focus"), "an-modal__dialog--sm");
  }

  // ================= Payment methods =================
  function renderMethods() {
    var host = document.querySelector("[data-wl-pms]");
    if (!host) return;
    var add = document.querySelector("[data-wl-addwrap]");
    if (add) add.hidden = !F.account.verified || !S.methods.length;
    if (!S.methods.length) {
      host.innerHTML = '<div class="an-blank"><span class="an-blank__ico">' + ico("card") + "</span>" +
        '<p class="an-blank__title">' + T.noMethods + '</p><p class="an-blank__text">' + T.methodsEmpty + "</p>" +
        (F.account.verified ? '<div class="an-head__btns"><a class="an-btn an-btn--primary an-btn--small" href="wallet-method-new.html">' + ico("plus") + "Add payment method</a></div>" : "") +
        "</div>";
      return;
    }
    host.innerHTML = S.methods.map(function (m) {
      return '<article class="wl-pm">' +
        '<div class="wl-pm__head">' + pmIcon(m) + '<h3 class="wl-pm__name">' + UI.esc(m.name) + "</h3>" +
          '<button class="mc-more" type="button" data-wl-pmdel="' + m.id + '" aria-label="Delete ' + UI.esc(m.name) + '">' + ico("trash") + "</button></div>" +
        '<div class="wl-pm__num"><span class="wl-pm__numv wl-pm__cur"><span class="an-muted">' + UI.esc(m.currency) + "</span><span>" + shortNumber(m.method, m.number) + "</span></span>" +
          '<button class="wl-copy" type="button" data-wl-copy="' + UI.esc(m.number) + '" aria-label="Copy ' + UI.esc(m.name) + ' details">' + ico("copy") + "</button></div>" +
        '<div class="wl-pm__rows"><p class="wl-pm__row"><span>Country</span><span>' + UI.esc(m.country) + "</span></p>" +
          '<p class="wl-pm__row"><span>Date added</span><span>' + fmtDay(m.createdAt) + "</span></p></div>" +
      "</article>";
    }).join("");
  }
  function pmDeleteAsk(id) {
    var m = methodOf(id);
    if (!m) return;
    modal("wlPmDel", "Delete payment method?",
      '<p class="an-modal__text">Withdrawals to <b>' + UI.esc(m.name) + "</b> will no longer be available. You can add the method again at any time.</p>",
      btn("Cancel", "secondary", "data-lv-close data-lv-focus") + btn("Delete", "danger", 'data-wl-pmdel-go="' + id + '"'), "an-modal__dialog--sm");
  }
  function pmDelete(id) {
    S.methods = S.methods.filter(function (m) { return m.id !== id; });
    save(); UI.closeModals(); renderMethods();
    UI.toast("Payment method deleted.");
  }

  // ---- новый метод
  var NEW = { slug: null, values: {} };
  function fieldHtml(name, label, ph, required) {
    var id = "wlf_" + name;
    return '<div class="wl-field"><label class="anf-lbl" for="' + id + '">' + UI.esc(label) + (required ? ' <span class="wl-req" aria-hidden="true">*</span>' : "") + "</label>" +
      '<input class="an-input" id="' + id + '" type="text" placeholder="' + UI.esc(ph) + '" autocomplete="off" value="' + UI.esc(NEW.values[name] || "") + '" data-wl-nf="' + name + '"' + (required ? " required" : "") + " /></div>";
  }
  function renderNewList() {
    var host = document.querySelector("[data-wl-newlist]");
    if (!host) return;
    host.innerHTML = F.payoutMethods.map(function (m) {
      var on = m.slug === NEW.slug;
      return '<div class="wl-method' + (on ? " is-on" : "") + '">' +
        '<button class="wl-method__head" type="button" role="radio" aria-checked="' + on + '" data-wl-newm="' + m.slug + '">' +
          '<span class="wl-radio" aria-hidden="true"></span><span class="wl-pm__ico">' + ico(PM_ICON[m.slug] || "card") + "</span>" +
          '<span class="wl-method__t"><b>' + UI.esc(m.title) + "</b><small>" + UI.esc(m.fee) + "</small></span></button>" +
        (on ? '<div class="wl-method__fields">' +
            '<div class="wl-fields2">' + fieldHtml("country", "Country", "Select country", true) + fieldHtml("currency", "Currency", "USD", true) + "</div>" +
            fieldHtml("name", "Payment method name", "e.g. Personal PayPal", true) +
            (F.forms[m.slug] || []).map(function (f) { return fieldHtml(f[0], f[1], f[2], true); }).join("") +
          "</div>" : "") +
      "</div>";
    }).join("");
    var foot = document.querySelector("[data-wl-newfoot]");
    if (foot) foot.hidden = !NEW.slug;
    newSync();
  }
  function newRequiredMissing() {
    return [].slice.call(document.querySelectorAll("[data-wl-nf][required]")).filter(function (i) { return !String(i.value).trim(); })
      .map(function (i) { return i.previousElementSibling ? i.previousElementSibling.textContent.replace(/\s*\*\s*$/, "") : i.getAttribute("data-wl-nf"); });
  }
  function newSync() {
    var missing = newRequiredMissing();
    off(document.querySelector("[data-wl-newadd]"), !!missing.length, missing.length ? "Please fill in all required fields: " + missing.join(", ") : "");
  }
  function newAdd() {
    if (newRequiredMissing().length || !NEW.slug) return;
    var v = NEW.values, meta = PM[NEW.slug];
    var number = v.number || v.account || v.iban || "";
    S.methods.push({ id: "pm" + Date.now(), method: NEW.slug, name: v.name || meta.title, currency: (v.currency || "USD").toUpperCase(),
      number: number, country: v.country || "—", createdAt: F.now.slice(0, 10) });
    save();
    location.href = "wallet-methods.html?added=1";
  }

  // ================= Usage =================
  var US = { group: "day", range: "14d" };
  var RANGES = [["today", "Today"], ["yesterday", "Yesterday"], ["7d", "Last 7 days"], ["14d", "Last 14 days"], ["30d", "Last 30 days"],
    ["60d", "Last 60 days"], ["lastmonth", "Last month"], ["2months", "Last 2 months"], ["all", "All time"]];
  function dayStart(ms) { var d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function usageRange() {
    var now = Date.parse(F.now), today = dayStart(now), d = new Date(now), from, to;
    switch (US.range) {
      case "today": from = today; to = today; break;
      case "yesterday": from = today - 864e5; to = from; break;
      case "7d": from = today - 6 * 864e5; to = today; break;
      case "30d": from = today - 29 * 864e5; to = today; break;
      case "60d": from = today - 59 * 864e5; to = today; break;
      case "lastmonth": from = new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime(); to = new Date(d.getFullYear(), d.getMonth(), 0).getTime(); break;
      case "2months": from = new Date(d.getFullYear(), d.getMonth() - 2, 1).getTime(); to = new Date(d.getFullYear(), d.getMonth(), 0).getTime(); break;
      case "all": from = firstTxDay().getTime(); to = today; break;
      default: from = today - 13 * 864e5; to = today;
    }
    return { from: from, to: to };
  }
  // детерминированный расход по дням: стримы идут по расписанию, медиатека — ровный хвост хранения
  function dayUsage(ms) {
    if (DEMO) return { streams: 0, media: 0 };
    var i = Math.floor(ms / 864e5), dow = new Date(ms).getDay();
    var streams = 0.16 + 0.1 * Math.abs(Math.sin(i / 2.3)) + (dow === 5 || dow === 6 ? 0.22 : 0) + (i % 9 === 0 ? 0.31 : 0);
    var media = 0.075 + 0.012 * Math.cos(i / 3.1);
    return { streams: round2(streams), media: round2(media) };
  }
  function buckets() {
    var r = usageRange(), out = [], k, key, byKey = {};
    var days = [];
    for (var t = r.from; t <= r.to; t += 864e5) days.push(t);
    if (US.group === "hour") {
      var last = days[days.length - 1], u = dayUsage(last);
      for (var h = 0; h < 24; h++) {
        var w = (0.6 + 0.4 * Math.sin((h - 6) / 24 * Math.PI * 2)) / 24;
        out.push({ label: (h < 10 ? "0" : "") + h + ":00", streams: round2(u.streams * w * 1.02), media: round2(u.media / 24), from: last + h * 36e5 });
      }
      return out;
    }
    days.forEach(function (ms) {
      var d = new Date(ms), u = dayUsage(ms);
      if (US.group === "day") key = ms;
      else if (US.group === "week") { var mon = new Date(ms); mon.setDate(d.getDate() - ((d.getDay() + 6) % 7)); key = dayStart(mon.getTime()); }
      else key = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
      if (!byKey[key]) { byKey[key] = { from: key, streams: 0, media: 0 }; out.push(byKey[key]); }
      byKey[key].streams = round2(byKey[key].streams + u.streams);
      byKey[key].media = round2(byKey[key].media + u.media);
    });
    out.forEach(function (b) {
      var d = new Date(b.from);
      b.label = US.group === "month"
        ? new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" }).format(d)
        : (d.getDate() < 10 ? "0" : "") + d.getDate() + "." + (d.getMonth() < 9 ? "0" : "") + (d.getMonth() + 1);
    });
    return out;
  }
  function renderUsage() {
    var chart = document.querySelector("[data-wl-chart]");
    if (!chart) return;
    var r = usageRange();
    document.querySelector("[data-wl-rangelbl]").textContent = fmtNum(new Date(r.from)) + " - " + fmtNum(new Date(r.to));
    var rclr = document.querySelector("[data-wl-rangeclear]");
    if (rclr) rclr.hidden = US.range === "14d";                 // 14 дней — диапазон по умолчанию
    [].slice.call(document.querySelectorAll("[data-wl-groupv]")).forEach(function (b) {
      var on = b.getAttribute("data-wl-groupv") === US.group;
      b.classList.toggle("is-on", on); b.setAttribute("aria-checked", on ? "true" : "false");
    });
    // график по макету Figma «Line and bar chart», вариант с подписями оси: слева значения (40px, по правому
    // краю) и линии сетки от них до правого края, шесть уровней с круглым шагом, ломаные линии серий с лёгким
    // градиентом, подписи оси X и её название снизу; заголовок оси Y — повёрнутый текст слева от графика.
    var bs = buckets(), W = Math.max(320, chart.clientWidth || 800), LX = 48, YL = 40, PT = 11, PB = 158.5, XL = 167, H = 211;
    var rawMax = Math.max.apply(null, bs.map(function (b) { return Math.max(b.streams, b.media); }).concat([0.01]));
    function niceStep(v) {
      var p = Math.pow(10, Math.floor(Math.log(v) / Math.LN10)), k = v / p;
      return (k <= 1 ? 1 : k <= 2 ? 2 : k <= 2.5 ? 2.5 : k <= 5 ? 5 : 10) * p;
    }
    var best = null;
    [4, 5, 6].forEach(function (k) { var st = niceStep(rawMax / k), ym = st * k; if (!best || ym < best.yMax - 1e-9) best = { k: k, step: st, yMax: ym }; });
    var K = best.k, step = best.step, yMax = best.yMax, n = bs.length;
    function x(i) { return n > 1 ? LX + i * (W - LX) / (n - 1) : LX + (W - LX) / 2; }
    function y(v) { return PB - (PB - PT) * v / yMax; }
    function line(kind) {
      return bs.map(function (b, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + y(b[kind]).toFixed(1); }).join(" ");
    }
    function area(kind) { return line(kind) + " L" + W + " " + PB + " L" + LX + " " + PB + " Z"; }
    var levels = [];
    for (var gi = 0; gi <= K; gi++) levels.push(gi);
    var grid = levels.map(function (i) {
      var yy = PT + (PB - PT) * i / K, v = step * (K - i);
      return '<line class="wl-chart__grid" x1="' + LX + '" x2="' + W + '" y1="' + yy.toFixed(1) + '" y2="' + yy.toFixed(1) + '" />' +
        '<text class="wl-chart__y" x="' + YL + '" y="' + (yy + 4).toFixed(1) + '" text-anchor="end">$' + v.toFixed(2) + "</text>";
    }).join("");
    var every = Math.ceil(n / 14);
    var labels = bs.map(function (b, i) {
      if (i % every) return "";
      var lx = Math.min(Math.max(x(i), LX + 18), W - 22);
      return '<text class="wl-chart__x" x="' + lx.toFixed(1) + '" y="' + (XL + 13) + '" text-anchor="middle">' + b.label + "</text>";
    }).join("");
    var unit = { hour: "Hour", day: "Day", week: "Week", month: "Month" }[US.group] || "Day";
    labels += '<text class="wl-chart__axis" x="' + (LX + (W - LX) / 2).toFixed(1) + '" y="' + (XL + 18 + 8 + 13) + '" text-anchor="middle">' + unit + "</text>";
    var defs = '<defs>' +
      '<linearGradient id="wlgStreams" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="wl-chart__stop--streams" stop-opacity=".18" /><stop offset="1" class="wl-chart__stop--streams" stop-opacity=".02" /></linearGradient>' +
      '<linearGradient id="wlgMedia" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="wl-chart__stop--media" stop-opacity=".18" /><stop offset="1" class="wl-chart__stop--media" stop-opacity=".02" /></linearGradient></defs>';
    chart.innerHTML = '<svg class="wl-chart__svg" viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '" preserveAspectRatio="xMinYMin meet" role="img" aria-label="Usage chart">' + defs + grid +
      (n ? '<path class="wl-chart__area" fill="url(#wlgMedia)" d="' + area("media") + '" /><path class="wl-chart__area" fill="url(#wlgStreams)" d="' + area("streams") + '" />' +
        '<path class="wl-chart__line wl-chart__line--media" d="' + line("media") + '" /><path class="wl-chart__line wl-chart__line--streams" d="' + line("streams") + '" />' : "") +
      labels + "</svg>";
    var pend = bs.length ? bs[bs.length - 1] : { streams: 0, media: 0 };
    var ch = { streams: 0, media: 0 };
    bs.slice(0, -1).forEach(function (b) { ch.streams = round2(ch.streams + b.streams); ch.media = round2(ch.media + b.media); });
    var tbl = document.querySelector("[data-wl-usagetbl]"), cols = "minmax(0, 1fr) 160px 160px";
    function row(cls, name, sw, p, c) {
      return '<div class="an-tr' + (cls ? " " + cls : "") + '" style="grid-template-columns:' + cols + '"><div class="an-td">' + (sw ? '<i class="wl-sw wl-sw--' + sw + '"></i>' : "") + name +
        '</div><div class="an-td wl-td--amount">' + UI.money(p) + '</div><div class="an-td wl-td--amount">' + UI.money(c) + "</div></div>";
    }
    tbl.innerHTML = '<div class="an-tr an-tr--head" style="grid-template-columns:' + cols + '"><div class="an-th">Service</div><div class="an-th wl-th--amount">Pending</div><div class="an-th wl-th--amount">Charged</div></div>' +
      row("", "Streams", "streams", pend.streams, ch.streams) + row("", "Media Library", "media", pend.media, ch.media) +
      row("wl-tr--total", "Total", "", round2(pend.streams + pend.media), round2(ch.streams + ch.media));
  }

  // ================= рендер и события =================
  function renderAll() {
    renderChip(); renderVerify();
    if (PAGE === "balance") { renderBalance(); renderPeriod(); renderMetrics(); renderFilters(); renderTx(); }
    if (PAGE === "methods") renderMethods();
    if (PAGE === "method-new") renderNewList();
    if (PAGE === "usage") renderUsage();
  }

  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t.closest) return;
    var el;
    if (t.closest("[data-wl-verifyact]")) { UI.toast(T.verifyToast); return; }
    if (t.closest("[data-wl-eye]")) { S.hidden = !S.hidden; save(); renderBalance(); renderMetrics(); renderTx(); return; }
    if (t.closest("[data-wl-topup]")) { topUpOpen(); return; }
    if ((el = t.closest("[data-wl-preset]"))) {
      var inp = document.querySelector("[data-wl-amount]");
      if (inp) { inp.value = el.getAttribute("data-wl-preset"); topUpSync(); inp.focus(); }
      return;
    }
    if (t.closest("[data-wl-topup-go]")) { topUpGo(); return; }
    if (t.closest("[data-wl-withdraw]")) { withdrawOpen(); return; }
    if ((el = t.closest("[data-wl-wdm]"))) { WD.methodId = el.getAttribute("data-wl-wdm"); withdrawRender(); return; }
    if (t.closest("[data-wl-wdnext]")) { if (WD.methodId) { WD.step = 2; withdrawRender(); } return; }
    if (t.closest("[data-wl-wdprev]")) { WD.step = 1; withdrawRender(); return; }
    if (t.closest("[data-wl-wdmax]")) {
      var a = document.querySelector("[data-wl-wdamount]");
      if (a) { a.value = available().toFixed(2); withdrawSync(); }
      return;
    }
    if (t.closest("[data-wl-wdgo]")) { withdrawGo(); return; }
    if ((el = t.closest("[data-wl-open]"))) { txOpen(el.getAttribute("data-wl-open")); return; }
    if ((el = t.closest("[data-wl-sort]"))) {
      var by = el.getAttribute("data-wl-sort");
      if (SORT.by === by) SORT.dir = SORT.dir === "asc" ? "desc" : "asc"; else { SORT.by = by; SORT.dir = "desc"; }
      renderTx(); return;
    }
    if (t.closest("[data-wl-prev]")) { PG.page = Math.max(1, PG.page - 1); renderTx(); return; }
    if (t.closest("[data-wl-next]")) { PG.page += 1; renderTx(); return; }
    if ((el = t.closest("[data-wl-perpage]"))) {
      UI.menu(el, [10, 30, 50].map(function (n) { return { label: String(n), onClick: function () { PG.per = n; PG.page = 1; renderTx(); } }; }));
      return;
    }
    if (t.closest("[data-wl-filters]")) { filtersOpen(!document.body.classList.contains("filters-open")); return; }
    if (t.closest("[data-wl-fclose]")) { filtersOpen(false); return; }
    if (t.closest("[data-wl-fclear]")) { FL = { dir: "all", types: [] }; applyFilters(); return; }
    if ((el = t.closest("[data-wl-dirv]"))) { FL.dir = el.getAttribute("data-wl-dirv"); applyFilters(); return; }
    // --- период в шапке: сегмент, календарь, сброс ---
    if (t.closest("[data-wl-perclear]")) { setPeriod("quarter"); return; }
    if ((el = t.closest("[data-wl-perset]"))) {
      var mode = el.getAttribute("data-wl-perset");
      if (mode === "custom") drOpen(true); else setPeriod(mode);
      return;
    }
    if (t.closest("[data-wl-drtrig]")) { var popEl = document.querySelector("[data-wl-drpop]"); drOpen(!popEl || popEl.hidden); return; }
    if ((el = t.closest("[data-wl-drday]"))) { drPickDay(el.getAttribute("data-wl-drday")); return; }
    if ((el = t.closest("[data-wl-drpreset]"))) { drUsePreset(el.getAttribute("data-wl-drpreset")); return; }
    if (t.closest("[data-wl-drprev]")) { DR.view = new Date(DR.view.getFullYear(), DR.view.getMonth() - 1, 1); drRender(); return; }
    if (t.closest("[data-wl-drnext]")) { DR.view = new Date(DR.view.getFullYear(), DR.view.getMonth() + 1, 1); drRender(); return; }
    if (t.closest("[data-wl-drcancel]")) { drOpen(false); return; }
    if (t.closest("[data-wl-drapply]")) { drApply(); return; }
    if (t.closest("[data-wl-dr]")) return;
    var drPop = document.querySelector("[data-wl-drpop]");
    if (drPop && !drPop.hidden) drOpen(false);
    if ((el = t.closest("[data-wl-copy]"))) { copyText(el.getAttribute("data-wl-copy")); return; }
    if ((el = t.closest("[data-wl-typev]"))) {
      var v = el.getAttribute("data-wl-typev"), i = FL.types.indexOf(v);
      if (i === -1) FL.types.push(v); else FL.types.splice(i, 1);
      applyFilters(); return;
    }
    if (document.body.classList.contains("filters-open") && !t.closest("[data-wl-fpanel]") && !t.closest("[data-wl-filters]") && !t.closest(".an-modal")) filtersOpen(false);
    if ((el = t.closest("[data-wl-pmdel-go]"))) { pmDelete(el.getAttribute("data-wl-pmdel-go")); return; }
    if ((el = t.closest("[data-wl-pmdel]"))) { pmDeleteAsk(el.getAttribute("data-wl-pmdel")); return; }
    if ((el = t.closest("[data-wl-newm]"))) {
      var slug = el.getAttribute("data-wl-newm");
      if (NEW.slug !== slug) { NEW.slug = slug; NEW.values = { country: NEW.values.country || "Ukraine", currency: NEW.values.currency || "USD" }; renderNewList(); }
      return;
    }
    if (t.closest("[data-wl-newadd]")) { newAdd(); return; }
    if ((el = t.closest("[data-wl-groupv]"))) { US.group = el.getAttribute("data-wl-groupv"); renderUsage(); return; }
    if (t.closest("[data-wl-rangeclear]")) { US.range = "14d"; renderUsage(); return; }
    if ((el = t.closest("[data-wl-range]"))) {
      UI.menu(el, RANGES.map(function (r) { return { label: r[1], onClick: function () { US.range = r[0]; renderUsage(); } }; }));
      return;
    }
  });
  document.addEventListener("input", function (e) {
    var t = e.target;
    if (!t.closest) return;
    if (t.closest("[data-wl-amount]")) { topUpSync(); return; }
    if (t.closest("[data-wl-wdamount]")) { withdrawSync(); return; }
    if (t.closest("[data-wl-nf]")) { NEW.values[t.getAttribute("data-wl-nf")] = t.value; newSync(); return; }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && document.body.classList.contains("filters-open")) filtersOpen(false);
    if (e.key === "Escape") { var dp = document.querySelector("[data-wl-drpop]"); if (dp && !dp.hidden) drOpen(false); }
    if (e.key === "Enter" && e.target.closest) {
      if (e.target.closest("[data-wl-amount]")) topUpGo();
      else if (e.target.closest("[data-wl-wdamount]")) withdrawGo();
      else if (e.target.closest("[data-wl-open]")) txOpen(e.target.closest("[data-wl-open]").getAttribute("data-wl-open"));
      else if (e.target.closest("[data-wl-pageno]")) {
        var n = parseInt(e.target.value, 10);
        if (isFinite(n) && n >= 1) { PG.page = n; renderTx(); }
      }
    }
  });

  renderAll();
  var rsz = null;
  window.addEventListener("resize", function () { if (PAGE !== "usage") return; clearTimeout(rsz); rsz = setTimeout(renderUsage, 120); });
  // переходы из других разделов: Live ведёт на пополнение, форма метода — обратно в список
  var q = location.search;
  if (PAGE === "balance" && /[?&]topup=1\b/.test(q)) { topUpOpen(); history.replaceState(null, "", location.pathname); }
  if (PAGE === "methods" && /[?&]added=1\b/.test(q)) { UI.toast("Payment method added."); history.replaceState(null, "", location.pathname); }
})();

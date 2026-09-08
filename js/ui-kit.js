// Общие примитивы прототипа: тултипы, тосты, модалки, меню «⋮», тумблеры,
// перетаскивание списка и форматирование. Используются страницами Live.
//
// Почему отдельный файл, а не расширение js/analytics.js: прототип Analytics уже передан
// в разработку, и рефакторить его 6.7 тысяч строк ради общих примитивов — риск регресса
// в переданном. Дупликация ~150 строк осознанная, зафиксирована в ADR.
//
// Правила, которые этот файл обслуживает:
//   ADR-0002 — блокировка через .is-off + aria-disabled, нативный disabled не используем;
//   ADR-0003 — один тост на действие;
//   деструктивное действие в диалоге не первое и не в фокусе по умолчанию.
(function () {
  "use strict";

  var UI = {};
  window.LVUI = UI;
  // иконки примитивов ставит страница: они генерируются из дизайн-системы
  UI.chevIcon = (window.LIVE_ICONS || {}).chevDown || "";
  UI.checkIcon = (window.LIVE_ICONS || {}).check || "";

  // ============================================================ строки и числа
  UI.esc = function (s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  };

  // Деньги — не больше двух знаков. «$0.00008» в интерфейсе не показываем никогда:
  // всё, что меньше цента, читается как $0.01 с префиксом «<».
  UI.money = function (n) {
    if (n === null || n === undefined) return "—";
    var v = Number(n);
    if (!isFinite(v)) return "—";
    if (v > 0 && v < 0.01) return "<$0.01";
    return "$" + v.toFixed(2);
  };

  // Часы для баланса и прогноза: «≈10.4 h», «≈21 h»
  UI.hours = function (h) {
    if (h === null || h === undefined || !isFinite(h)) return "—";
    return (h >= 10 ? Math.round(h) : Math.round(h * 10) / 10) + " h";
  };

  UI.dur = function (sec) {
    sec = Math.max(0, Math.round(sec || 0));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    var p = function (n) { return String(n).padStart(2, "0"); };
    return p(h) + ":" + p(m) + ":" + p(s);
  };

  // «3 h 41 min» — для полосы состояния и лога. Меньше минуты показываем в секундах:
  // простой 42 s не должен округляться до «1 min» — это разные по смыслу числа.
  UI.durHuman = function (sec) {
    sec = Math.max(0, Math.round(sec || 0));
    if (sec < 60) return sec + " s";
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    if (h && m) return h + " h " + m + " min";
    if (h) return h + " h";
    return m + " min";
  };

  UI.bytes = function (b) {
    if (!b) return "0 B";
    var u = ["B", "KB", "MB", "GB", "TB"], i = 0, v = b;
    while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
    return (v >= 10 || i === 0 ? Math.round(v) : Math.round(v * 10) / 10) + " " + u[i];
  };

  UI.plural = function (n, one, many) { return n + " " + (n === 1 ? one : many); };

  // ============================================================ даты в зоне аккаунта
  // Зона берётся из фикстур аккаунта, а не из браузера — требование постановки.
  UI.dt = function (iso, tz) {
    if (!iso) return "—";
    try {
      return new Intl.DateTimeFormat("en-GB", {
        timeZone: tz, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false
      }).format(new Date(iso)).replace(",", ",");
    } catch (e) { return iso; }
  };
  UI.time = function (iso, tz) {
    if (!iso) return "—";
    try {
      return new Intl.DateTimeFormat("en-GB", {
        timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false
      }).format(new Date(iso));
    } catch (e) { return iso; }
  };
  UI.dayFull = function (iso, tz) {
    if (!iso) return "—";
    try {
      return new Intl.DateTimeFormat("en-GB", {
        timeZone: tz, weekday: "short", day: "numeric", month: "long", year: "numeric"
      }).format(new Date(iso));
    } catch (e) { return iso; }
  };
  UI.day = function (iso, tz) {
    if (!iso) return "—";
    try {
      return new Intl.DateTimeFormat("en-GB", {
        timeZone: tz, weekday: "short", day: "2-digit", month: "short"
      }).format(new Date(iso));
    } catch (e) { return iso; }
  };
  // «in 4 h 12 min» / «3 h 41 min ago» относительно зафиксированного «сейчас»
  UI.until = function (iso, nowMs) {
    var d = Date.parse(iso) - nowMs;
    return (d >= 0 ? "in " : "") + UI.durHuman(Math.abs(d) / 1000) + (d < 0 ? " ago" : "");
  };

  // ============================================================ тултипы
  // Свой движок, а не нативный title: нужна тёмная плашка со стрелкой, задержка скрытия
  // и действие внутри (Top up balance). Разметка переиспользует классы .an-tip.
  var tipT = null;
  function tipEl() {
    var t = document.querySelector("[data-lv-tip]");
    if (t) return t;
    t = document.createElement("div");
    t.className = "an-tip";
    t.setAttribute("data-lv-tip", "");
    t.setAttribute("role", "tooltip");
    t.hidden = true;
    t.innerHTML = '<span class="an-tip__arrow" data-lv-tip-arrow></span>' +
      '<span data-lv-tip-txt></span>' +
      '<button class="an-tip__act" type="button" data-lv-tip-act hidden></button>';
    document.body.appendChild(t);
    return t;
  }
  function tipShow(host) {
    var text = host.getAttribute("data-tip");
    if (!text) return;
    var tip = tipEl();
    clearTimeout(tipT);
    tip.querySelector("[data-lv-tip-txt]").textContent = text;
    var act = tip.querySelector("[data-lv-tip-act]");
    var actLabel = host.getAttribute("data-tip-act");
    act.hidden = !actLabel;
    if (actLabel) act.textContent = actLabel;
    tip.hidden = false;
    var r = host.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
    var left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8);
    var below = r.bottom + 10 + h < window.innerHeight;
    tip.style.left = Math.round(left) + "px";
    tip.style.top = Math.round(below ? r.bottom + 10 : r.top - h - 10) + "px";
    var arrow = tip.querySelector("[data-lv-tip-arrow]");
    arrow.style.left = Math.round(Math.min(Math.max(10, r.left + r.width / 2 - left - 4), w - 18)) + "px";
    arrow.style.top = below ? "-4px" : "";
    arrow.style.bottom = below ? "" : "-4px";
    tip.classList.add("is-on");
  }
  function tipHide(now) {
    var tip = document.querySelector("[data-lv-tip]");
    if (!tip) return;
    clearTimeout(tipT);
    // задержка нужна, чтобы курсор успел дойти до кнопки внутри тултипа
    tipT = setTimeout(function () { tip.classList.remove("is-on"); tip.hidden = true; }, now ? 0 : 140);
  }
  UI.tipHide = tipHide;

  document.addEventListener("mouseover", function (e) {
    var host = e.target.closest && e.target.closest("[data-tip]");
    if (host) { tipShow(host); return; }
    if (e.target.closest && e.target.closest("[data-lv-tip]")) { clearTimeout(tipT); return; }
    tipHide();
  });
  document.addEventListener("focusin", function (e) {
    var host = e.target.closest && e.target.closest("[data-tip]");
    if (host) tipShow(host);
  });
  document.addEventListener("focusout", function () { tipHide(); });
  window.addEventListener("scroll", function () { tipHide(true); }, true);

  // подсказка одним хелпером: пустой текст — снять
  UI.tip = function (el, text, actLabel) {
    if (!el) return;
    if (text) {
      el.setAttribute("data-tip", text);
      if (actLabel) el.setAttribute("data-tip-act", actLabel); else el.removeAttribute("data-tip-act");
    } else {
      el.removeAttribute("data-tip");
      el.removeAttribute("data-tip-act");
    }
    el.removeAttribute("title");
  };

  // ============================================================ блокировка (ADR-0002)
  UI.off = function (el, isOff, reason, actLabel) {
    if (!el) return;
    el.classList.toggle("is-off", !!isOff);
    if (isOff) el.setAttribute("aria-disabled", "true"); else el.removeAttribute("aria-disabled");
    // блокировка только классом и aria: нативный атрибут снимаем, если он откуда-то взялся
    if (el.tagName === "BUTTON" || el.tagName === "INPUT") el.removeAttribute("disabled");
    UI.tip(el, isOff ? (reason || "") : "", actLabel);
  };
  UI.isOff = function (el) { return !!el && el.classList.contains("is-off"); };

  // Один отсекатель кликов по заблокированным контролам на весь раздел.
  document.addEventListener("click", function (e) {
    var off = e.target.closest && e.target.closest('.is-off[aria-disabled="true"]');
    if (!off) return;
    var act = e.target.closest("[data-lv-tip-act]");
    if (act) return;
    e.preventDefault();
    e.stopPropagation();
  }, true);

  // действие внутри тултипа: единственное на весь Live — пополнение баланса
  document.addEventListener("click", function (e) {
    if (e.target.closest && e.target.closest("[data-lv-tip-act]")) {
      tipHide(true);
      UI.toast("Top-up page will open in the billing section.");
    }
  });

  // ============================================================ тосты (ADR-0003)
  var toastT = null;
  UI.toast = function (msg) {
    var t = document.querySelector("[data-lv-toast]");
    if (!t) {
      t = document.createElement("div");
      t.className = "an-toast";
      t.setAttribute("data-lv-toast", "");
      t.setAttribute("role", "status");
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.hidden = true; }, 3600);
  };

  // ============================================================ модалки
  UI.openModal = function (id) {
    var m = typeof id === "string" ? document.getElementById(id) : id;
    if (!m) return null;
    m.classList.add("is-open");
    document.body.style.overflow = "hidden";
    // фокус — на безопасный контрол: деструктивная кнопка по умолчанию не в фокусе
    var first = m.querySelector("[data-lv-focus]") ||
      m.querySelector(".an-btn:not(.an-btn--danger):not(.is-off)") ||
      m.querySelector("[data-lv-close]");
    if (first) setTimeout(function () { first.focus(); }, 0);
    return m;
  };
  UI.closeModals = function () {
    [].slice.call(document.querySelectorAll(".an-modal.is-open")).forEach(function (m) {
      m.classList.remove("is-open");
    });
    document.body.style.overflow = "";
  };
  document.addEventListener("click", function (e) {
    if (e.target.closest && (e.target.closest("[data-lv-close]") || e.target.closest(".an-modal__overlay"))) {
      UI.closeModals();
    }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (document.querySelector(".an-modal.is-open")) { UI.closeModals(); return; }
      UI.menuClose();
    }
  });

  // ============================================================ меню «⋮»
  // Пункты собираются данными, а недоступные показываются заблокированными с причиной —
  // скрывать их нельзя (ADR-0002). Клавиатура работает: пункты — обычные кнопки.
  function menuEl() {
    var m = document.querySelector("[data-lv-menu]");
    if (m) return m;
    m = document.createElement("div");
    m.className = "mc-menu";
    m.setAttribute("data-lv-menu", "");
    m.setAttribute("role", "menu");
    m.hidden = true;
    document.body.appendChild(m);
    return m;
  }
  UI.menuClose = function () {
    var m = document.querySelector("[data-lv-menu]");
    if (m) { m.hidden = true; m.innerHTML = ""; }
  };
  UI.menu = function (anchor, items) {
    var m = menuEl();
    m.innerHTML = items.map(function (i, idx) {
      if (i.sep) return '<hr class="mc-menu__sep" />';
      var cls = "mc-menu__item" + (i.danger ? " mc-menu__item--danger" : "") + (i.off ? " is-off" : "");
      var attrs = ' data-lv-mi="' + idx + '" role="menuitem" type="button"';
      if (i.off) {
        attrs += ' aria-disabled="true" data-tip="' + UI.esc(i.reason || "") + '"';
        if (i.act) attrs += ' data-tip-act="' + UI.esc(i.act) + '"';
      }
      return '<button class="' + cls + '"' + attrs + ">" + (i.icon || "") + UI.esc(i.label) + "</button>";
    }).join("");
    m.hidden = false;
    var r = anchor.getBoundingClientRect(), w = m.offsetWidth, h = m.offsetHeight;
    var left = Math.min(Math.max(8, r.right - w), window.innerWidth - w - 8);
    var below = r.bottom + h + 8 < window.innerHeight;
    m.style.left = Math.round(left) + "px";
    m.style.top = Math.round(below ? r.bottom + 6 : r.top - h - 6) + "px";
    m._items = items;
    var firstItem = m.querySelector(".mc-menu__item:not(.is-off)");
    if (firstItem) setTimeout(function () { firstItem.focus(); }, 0);
  };
  document.addEventListener("click", function (e) {
    var mi = e.target.closest && e.target.closest("[data-lv-mi]");
    var m = document.querySelector("[data-lv-menu]");
    if (mi && m && m._items) {
      var item = m._items[Number(mi.getAttribute("data-lv-mi"))];
      if (item && !item.off) {
        UI.menuClose();
        if (typeof item.onClick === "function") item.onClick();
      }
      return;
    }
    if (m && !m.hidden && !(e.target.closest && e.target.closest("[data-lv-menu]"))) UI.menuClose();
  });

  // ============================================================ тумблер
  // Нет в дизайн-системе прототипа, а нужен в шести местах: файл вкл/выкл, Loop, Shuffle,
  // Backup stream, матрица уведомлений. Роль switch + aria-checked.
  UI.switchHtml = function (attrs, on, label, off, reason) {
    return '<button class="lv-sw' + (on ? " is-on" : "") + (off ? " is-off" : "") +
      '" type="button" role="switch" aria-checked="' + (on ? "true" : "false") + '"' +
      (off ? ' aria-disabled="true" data-tip="' + UI.esc(reason || "") + '"' : "") +
      (label ? ' aria-label="' + UI.esc(label) + '"' : "") + " " + (attrs || "") +
      '><span class="lv-sw__dot"></span></button>';
  };
  document.addEventListener("click", function (e) {
    var sw = e.target.closest && e.target.closest(".lv-sw");
    if (!sw || UI.isOff(sw) || sw.classList.contains("is-locked")) return;
    var on = sw.getAttribute("aria-checked") !== "true";
    sw.setAttribute("aria-checked", on ? "true" : "false");
    sw.classList.toggle("is-on", on);
    sw.dispatchEvent(new CustomEvent("lv:switch", { bubbles: true, detail: { on: on } }));
  });


  // ============================================================ an-select
  // Нативный селект не умеет ни аватар в опции, ни вторую строку, ни поиск, ни
  // заблокированную опцию с причиной — поэтому свой примитив на кнопке и попапе.
  //
  // Клавиатура: ↑ ↓ Home End двигают активную опцию, Enter выбирает, Esc закрывает и
  // возвращает фокус на кнопку, ввод букв — type-ahead по началу подписи.
  var SEL = null;                       // { trig, cfg, opts, active, buf, bufT }

  // Тригер: рисуется в разметке экрана, конфиг приходит при открытии
  UI.selectHtml = function (attrs, view, opts) {
    opts = opts || {};
    return '<button class="an-select__trig' + (opts.off ? " is-off" : "") + '" type="button" ' +
      'aria-haspopup="listbox" aria-expanded="false"' +
      (opts.off ? ' aria-disabled="true" data-tip="' + UI.esc(opts.reason || "") + '"' : "") +
      (opts.label ? ' aria-label="' + UI.esc(opts.label) + '"' : "") + " " + (attrs || "") + ">" +
      '<span class="an-select__val">' + view + "</span>" +
      '<span class="an-select__chev" aria-hidden="true">' + (UI.chevIcon || "") + "</span></button>";
  };
  // как выглядит выбранное значение: аватар, подпись, вторая строка
  UI.selectValue = function (o, ph) {
    if (!o) return '<span class="an-select__ph">' + UI.esc(ph || "Select") + "</span>";
    return (o.avatar ? '<span class="an-chan__ava" style="background:' + o.avatar.color + '">' + UI.esc(o.avatar.initial) + "</span>" : "") +
      '<span class="an-select__txt"><span class="an-select__lbl">' + UI.esc(o.label) + "</span>" +
      (o.sub ? '<span class="an-select__sub">' + UI.esc(o.sub) + "</span>" : "") + "</span>";
  };

  function selPop() {
    var p = document.querySelector("[data-lv-selpop]");
    if (p) return p;
    p = document.createElement("div");
    p.className = "lv-pop an-select__pop";
    p.setAttribute("data-lv-selpop", "");
    p.hidden = true;
    document.body.appendChild(p);
    return p;
  }
  function selVisible() {
    return SEL ? SEL.opts.filter(function (o) { return !o.hidden; }) : [];
  }
  function selRender() {
    var pop = selPop(), cfg = SEL.cfg;
    var q = SEL.q || "";
    SEL.opts.forEach(function (o) {
      o.hidden = !!(q && o.kind !== "action" && o.label.toLowerCase().indexOf(q.toLowerCase()) === -1);
    });
    var vis = selVisible();
    if (SEL.active >= vis.length) SEL.active = vis.length - 1;
    if (SEL.active < -1) SEL.active = -1;
    var rows = vis.length
      ? vis.map(function (o, i) {
          if (o.kind === "sep") return '<hr class="mc-menu__sep" />';
          var act = i === SEL.active;
          return '<button class="an-select__opt' + (o.value === cfg.value ? " is-selected" : "") +
            (act ? " is-active" : "") + (o.off ? " is-off" : "") + (o.kind === "action" ? " an-select__opt--act" : "") +
            '" type="button" role="option" id="lvSelOpt' + i + '" aria-selected="' + (o.value === cfg.value) + '"' +
            (o.off ? ' aria-disabled="true" data-tip="' + UI.esc(o.reason || "") + '"' : "") +
            ' data-lv-selopt="' + i + '">' +
            (o.avatar ? '<span class="an-chan__ava" style="background:' + o.avatar.color + '">' + UI.esc(o.avatar.initial) + "</span>" : "") +
            (o.icon ? '<span class="an-select__ico">' + o.icon + "</span>" : "") +
            '<span class="an-select__txt"><span class="an-select__lbl">' + UI.esc(o.label) + "</span>" +
            (o.sub ? '<span class="an-select__sub">' + UI.esc(o.sub) + "</span>" : "") + "</span>" +
            (o.value === cfg.value ? '<span class="an-select__tick">' + (UI.checkIcon || "") + "</span>" : "") +
            "</button>";
        }).join("")
      : '<div class="an-select__empty">Nothing found</div>';
    pop.innerHTML =
      (cfg.search ? '<div class="an-select__srch"><input class="an-input" type="text" placeholder="' +
        UI.esc(cfg.search) + '" data-lv-selq aria-label="' + UI.esc(cfg.search) + '" value="' + UI.esc(q) + '" /></div>' : "") +
      '<div class="an-select__list" role="listbox" tabindex="-1" data-lv-sellist' +
        (cfg.label ? ' aria-label="' + UI.esc(cfg.label) + '"' : "") +
        (vis.length && SEL.active >= 0 ? ' aria-activedescendant="lvSelOpt' + SEL.active + '"' : "") + ">" + rows + "</div>";
    pop.hidden = false;
    // позиционирование по якорю; сторона — где больше места, список ужимается под него,
    // иначе попап прижимается к краю экрана и перекрывает сам триггер
    var r = SEL.trig.getBoundingClientRect();
    var w = Math.max(r.width, 240);
    pop.style.width = w + "px";
    pop.style.left = Math.round(Math.min(r.left, window.innerWidth - w - 12)) + "px";
    var list = pop.querySelector("[data-lv-sellist]");
    if (list) list.style.maxHeight = "";
    var h = pop.offsetHeight;
    var spaceBelow = window.innerHeight - r.bottom - 14;
    var spaceAbove = r.top - 14;
    var below = h + 6 <= spaceBelow || spaceBelow >= spaceAbove;
    var room = (below ? spaceBelow : spaceAbove) - 6;
    if (list && h > room) {
      var chrome = h - list.offsetHeight;
      list.style.maxHeight = Math.max(120, room - chrome) + "px";
      h = pop.offsetHeight;
    }
    pop.style.top = Math.round((below ? r.bottom + 6 : Math.max(8, r.top - h - 6)) + window.scrollY) + "px";
  }
  // cfg: { value, options, search, label, onPick }
  UI.select = function (trig, cfg) {
    if (UI.isOff(trig)) return;
    if (SEL && SEL.trig === trig) { UI.selectClose(); return; }
    // при открытии ни один пункт не подсвечен: подсветка «активного» выглядела как ховер без ховера;
    // курсор появляется от стрелок или набора текста, выбранное значение и так отмечено галочкой
    SEL = { trig: trig, cfg: cfg, opts: cfg.options.slice(), q: "", active: -1, buf: "", bufT: null };
    trig.setAttribute("aria-expanded", "true");
    selRender();
    var inp = document.querySelector("[data-lv-selq]");
    if (inp) setTimeout(function () { inp.focus(); }, 0);
    else {
      var list = document.querySelector("[data-lv-sellist]");
      if (list) setTimeout(function () { list.focus(); }, 0);
    }
  };
  UI.selectClose = function (focusTrig) {
    var pop = document.querySelector("[data-lv-selpop]");
    if (pop) { pop.hidden = true; pop.innerHTML = ""; }
    if (SEL) {
      SEL.trig.setAttribute("aria-expanded", "false");
      if (focusTrig) SEL.trig.focus();
      SEL = null;
    }
  };
  function selPick(i) {
    var o = selVisible()[i];
    if (!o || o.off || o.kind === "sep") return;
    var cb = SEL.cfg.onPick, trig = SEL.trig;
    var key = trig.getAttribute("data-lv-sel"), arg = trig.getAttribute("data-lv-selarg");
    UI.selectClose(true);
    if (typeof cb === "function") cb(o.value, o);
    // экран мог перерисоваться и увести фокус в никуда — возвращаем его на тот же тригер
    if (!document.contains(trig) && key) {
      var again = document.querySelector('[data-lv-sel="' + key + '"]' + (arg ? '[data-lv-selarg="' + arg + '"]' : ""));
      if (again) again.focus();
    }
  }
  function selMove(delta) {
    var vis = selVisible();
    if (!vis.length) return;
    var i = SEL.active < 0 ? (delta > 0 ? -1 : 0) : SEL.active;
    for (var step = 0; step < vis.length; step++) {
      i = (i + delta + vis.length) % vis.length;
      if (vis[i].kind !== "sep") break;
    }
    SEL.active = i;
    selRender();
    var el = document.querySelector('[data-lv-selopt="' + i + '"]');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
  }
  document.addEventListener("click", function (e) {
    var opt = e.target.closest && e.target.closest("[data-lv-selopt]");
    if (opt && SEL) { selPick(Number(opt.getAttribute("data-lv-selopt"))); return; }
    if (!SEL) return;
    if (e.target.closest && (e.target.closest("[data-lv-selpop]") || e.target === SEL.trig || SEL.trig.contains(e.target))) return;
    UI.selectClose();
  });
  document.addEventListener("input", function (e) {
    if (!SEL || !(e.target.closest && e.target.closest("[data-lv-selq]"))) return;
    SEL.q = e.target.value;
    SEL.active = 0;
    selRender();
    var inp = document.querySelector("[data-lv-selq]");
    if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
  });
  document.addEventListener("keydown", function (e) {
    // открытие с клавиатуры
    var trig = e.target.closest && e.target.closest(".an-select__trig");
    if (trig && !SEL && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      trig.click();
      return;
    }
    if (!SEL) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); UI.selectClose(true); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); selMove(1); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); selMove(-1); return; }
    if (e.key === "Home") { e.preventDefault(); SEL.active = 0; selRender(); return; }
    if (e.key === "End") { e.preventDefault(); SEL.active = selVisible().length - 1; selRender(); return; }
    if (e.key === "Enter") { e.preventDefault(); selPick(SEL.active); return; }
    if (e.key === "Tab") { UI.selectClose(); return; }
    // type-ahead: работает и без поля поиска
    if (!SEL.cfg.search && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      clearTimeout(SEL.bufT);
      SEL.buf += e.key.toLowerCase();
      SEL.bufT = setTimeout(function () { if (SEL) SEL.buf = ""; }, 600);
      var vis = selVisible();
      for (var i = 0; i < vis.length; i++) {
        if (vis[i].kind !== "sep" && vis[i].label.toLowerCase().indexOf(SEL.buf) === 0) {
          SEL.active = i; selRender();
          var el = document.querySelector('[data-lv-selopt="' + i + '"]');
          if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
          break;
        }
      }
    }
  }, true);
  window.addEventListener("scroll", function () { if (SEL) UI.selectClose(); }, true);

  // ============================================================ перетаскивание списка
  // Мышь — HTML5 drag, клавиатура — Move up / Move down из меню строки. Клавиатурная
  // альтернатива обязательна: перетаскивание с клавиатуры недоступно.
  UI.dnd = function (root, onReorder) {
    if (!root || root._lvDnd) return;
    root._lvDnd = true;
    var dragged = null;
    root.addEventListener("dragstart", function (e) {
      var row = e.target.closest("[data-lv-row]");
      if (!row || row.getAttribute("data-lv-fixed") === "1") { e.preventDefault(); return; }
      dragged = row;
      row.classList.add("is-dragging");
      try { e.dataTransfer.setData("text/plain", row.getAttribute("data-lv-row")); } catch (err) {}
      e.dataTransfer.effectAllowed = "move";
    });
    root.addEventListener("dragover", function (e) {
      if (!dragged) return;
      e.preventDefault();
      var row = e.target.closest("[data-lv-row]");
      if (!row || row === dragged) return;
      var r = row.getBoundingClientRect();
      var after = (e.clientY - r.top) > r.height / 2;
      row.parentNode.insertBefore(dragged, after ? row.nextSibling : row);
    });
    root.addEventListener("dragend", function () {
      if (!dragged) return;
      dragged.classList.remove("is-dragging");
      dragged = null;
      var order = [].slice.call(root.querySelectorAll("[data-lv-row]")).map(function (r) {
        return r.getAttribute("data-lv-row");
      });
      if (typeof onReorder === "function") onReorder(order);
    });
  };

  // ============================================================ разное
  UI.storeGet = function (key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  };
  UI.storeSet = function (key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  };
  UI.storeDel = function (key) { try { localStorage.removeItem(key); } catch (e) {} };
})();

// Механика сайдбара SubSub — только показать/скрыть саб-меню и collapse/expand.
// Никаких innerHTML-шаблонов: разметка статична в home.html, JS лишь переключает
// классы состояния и подставляет заголовок открытого пространства (textContent).
(function () {
  var sidebar = document.getElementById("sidebar");
  if (!sidebar) return;

  var radios = document.querySelectorAll('input[name="spaces-menu-type"]');
  var title = document.getElementById("submenuTitle");
  var collapseBtn = document.getElementById("collapseBtn");
  var expandBtn = document.getElementById("expandBtn");

  // value radio → человекочитаемое имя пространства (из i18n репозитория)
  var NAMES = {
    analytics: "Analytics",
    fanfunding: "Fan Funding",
    wallet: "Wallet",
    network: "Network",
    streams: "Live",
    mediaLibrary: "Media Library",
    content: "Content Export",
    admin: "Admin",
  };

  // Состояние держим на <body>, чтобы одновременно управлять и саб-панелью
  // (внутри .sidebar), и сдвигом основного контента (.main — сосед .sidebar).
  var state = document.body.classList;
  var menus = document.querySelectorAll(".submenu__menu");

  // Открыть саб-панель выбранного пространства (развёрнутое состояние).
  // Контент саб-меню статичен: просто показываем нужный готовый блок, прячем
  // остальные (никаких innerHTML-шаблонов). data-space на body — для бейджа.
  function openSpace(value) {
    title.textContent = NAMES[value] || "";
    document.body.setAttribute("data-space", value);
    for (var j = 0; j < menus.length; j++) {
      menus[j].hidden = menus[j].getAttribute("data-space") !== value;
    }
    state.add("is-open");
    state.remove("is-collapsed");
  }

  // Выбор пункта левого сайдбара → открыть его саб-меню (без навигации).
  // change — на клавиатуру/обычный выбор; click по label — чтобы повторный
  // клик по уже активному пункту (например в свёрнутом состоянии) тоже
  // переоткрывал панель. openSpace идемпотентна, двойной вызов безопасен.
  for (var i = 0; i < radios.length; i++) {
    radios[i].addEventListener("change", function () {
      if (this.checked) openSpace(this.value);
    });
    var label = radios[i].closest("label");
    if (label) {
      label.addEventListener("click", function () {
        var input = this.querySelector('input[name="spaces-menu-type"]');
        if (input) openSpace(input.value);
      });
    }
  }

  // Свернуть панель (‹): скрыть саб-меню, показать кнопку разворота
  collapseBtn.addEventListener("click", function () {
    state.add("is-collapsed");
  });

  // Развернуть (›): если пространство уже выбрано — открыть его; иначе выбрать
  // первое (Analytics) — как делает openMenu на проде из исходного состояния
  expandBtn.addEventListener("click", function () {
    var checked = document.querySelector('input[name="spaces-menu-type"]:checked');
    if (checked) {
      openSpace(checked.value);
    } else if (radios.length) {
      radios[0].checked = true;
      openSpace(radios[0].value);
    }
  });

  // ----- Телефон (<768): сайдбар выезжает по бургеру, как SpacesMenu прода -----
  var burger = document.getElementById("navBurger");
  var overlay = document.getElementById("navOverlay");
  var narrowMq = window.matchMedia ? window.matchMedia("(max-width: 767px)") : null;
  function narrow() { return !!(narrowMq && narrowMq.matches); }
  function mobOpen() {
    var checked = document.querySelector('input[name="spaces-menu-type"]:checked');
    if (checked) openSpace(checked.value);
    else if (radios.length) { radios[0].checked = true; openSpace(radios[0].value); }
    state.add("is-mobnav");
    if (overlay) overlay.hidden = false;
    if (burger) burger.setAttribute("aria-expanded", "true");
  }
  function mobClose() {
    state.remove("is-mobnav");
    if (overlay) overlay.hidden = true;
    if (burger) burger.setAttribute("aria-expanded", "false");
  }
  if (burger) burger.addEventListener("click", function (e) {
    e.stopPropagation();
    if (state.contains("is-mobnav")) mobClose(); else mobOpen();
  });
  if (overlay) overlay.addEventListener("click", mobClose);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") mobClose(); });

  // Разделы вне Live на телефоне ещё не адаптированы: вместо десктопной вёрстки — заглушка
  var mainEl = document.querySelector("main.main");
  var wip = null;
  function wipSync() {
    var on = narrow() && !document.body.hasAttribute("data-lv-page");
    if (!mainEl) return;
    if (on && !wip) {
      wip = document.createElement("div");
      wip.className = "an-blank";
      wip.setAttribute("data-nav-wip", "");
      wip.innerHTML = '<p class="an-blank__title">This part of the prototype is still in development.</p>' +
        '<p class="an-blank__text">The mobile version covers Live for now.</p>' +
        '<a class="an-btn an-btn--secondary an-btn--small" href="live-streams.html">Open Live</a>';
      mainEl.appendChild(wip);
      state.add("is-mobwip");
    } else if (!on && wip) {
      wip.remove(); wip = null;
      state.remove("is-mobwip");
    }
  }
  wipSync();

  var DESK = [
    { re: /^analytics-/, title: "Analytics lives on desktop", text: "Charts and reports need a bigger screen." },
    { re: /^wallet/, title: "Wallet lives on desktop", text: "Balance and payment methods need a bigger screen." },
    { re: /^media-library-/, title: "Media Library lives on desktop", text: "Managing files needs a bigger screen." },
    { re: /^styleguide/, title: "The styleguide lives on desktop", text: "Components and tokens need a bigger screen." },
    { re: /^live-playlist/, title: "Playlists live on desktop", text: "Building and editing playlists needs a bigger screen." },
    { re: /^live-calendar/, title: "The calendar lives on desktop", text: "Planning streams across days needs a bigger screen." },
    { re: /^live-stream-create/, title: "Stream setup lives on desktop", text: "Setting up the queue, destination and schedule needs a bigger screen." },
    { re: /^(settings-|org-settings)/, title: "Settings live on desktop", text: "These settings need a bigger screen." }
  ];
  var DESK_TAIL = " We’ll send you a link so you can pick up right where you left off.";
  var MOBILE_READY = ["live-streams.html", "live-stream.html"];
  var DESK_SOFT = {
    "live-streams.html": { key: "streams", title: "Full Live lives on desktop",
      text: "On your phone you can create a quick stream, start, stop and follow streams. Scheduling, playlists and the calendar need a bigger screen." }
  };
  function deskInfo(href) {
    var file = String(href || "").split(/[?#]/)[0].split("/").pop();
    if (!file || MOBILE_READY.indexOf(file) !== -1) return null;
    if (file === "live-stream-create.html" && /[?&]mode=now(&|$)/.test(String(href))) return null;
    for (var d = 0; d < DESK.length; d++) if (DESK[d].re.test(file)) return DESK[d];
    return null;
  }
  var deskItems = [].filter.call(document.querySelectorAll(".submenu .m-item[href]"), function (a) {
    return !!deskInfo(a.getAttribute("href"));
  });
  function deskSync() {
    var on = narrow();
    deskItems.forEach(function (a) { a.classList.toggle("is-desk", on); });
  }
  var sheet = null, toastT = null, landing = deskInfo(location.pathname + location.search), landingShown = false;
  function deskToast(msg) {
    if (window.LVUI && window.LVUI.toast) { window.LVUI.toast(msg); return; }
    var t = document.querySelector("[data-m-toast]");
    if (!t) {
      t = document.createElement("div");
      t.className = "an-toast";
      t.setAttribute("data-m-toast", "");
      t.setAttribute("role", "status");
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.hidden = true; }, 3600);
  }
  function deskCopy(text) {
    var done = function () { deskToast("Link copied."); };
    var fallback = function () {
      var ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (err) {}
      ta.remove();
      done();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  }
  function deskClose() { if (sheet) { sheet.remove(); sheet = null; } }
  function deskOpen(info, url) {
    deskClose();
    sheet = document.createElement("div");
    sheet.className = "m-sheet";
    sheet.setAttribute("data-m-sheet", "");
    sheet.innerHTML = '<div class="m-sheet__ov" data-m-sheetclose></div>' +
      '<div class="m-sheet__p" role="dialog" aria-modal="true" aria-labelledby="mSheetTitle">' +
        '<span class="m-sheet__grip" aria-hidden="true"></span>' +
        '<img class="m-sheet__img" src="images/mobile-desktop-only-x2.webp" width="120" height="120" alt="" />' +
        '<h2 class="m-sheet__t" id="mSheetTitle"></h2>' +
        '<p class="m-sheet__d"></p>' +
        '<div class="m-sheet__b">' +
          '<button class="an-btn an-btn--primary" type="button" data-m-sheetmail>Send link to my email</button>' +
          '<button class="an-btn an-btn--secondary" type="button" data-m-sheetcopy>Copy link</button>' +
          '<button class="an-btn an-btn--tertiary" type="button" data-m-sheetclose>Not now</button>' +
        "</div></div>";
    sheet.querySelector(".m-sheet__t").textContent = info.title;
    sheet.querySelector(".m-sheet__d").textContent = info.text + DESK_TAIL;
    sheet.addEventListener("click", function (e) {
      if (e.target.closest("[data-m-sheetmail]")) { deskClose(); deskToast("Link sent to your email."); return; }
      if (e.target.closest("[data-m-sheetcopy]")) { deskClose(); deskCopy(url); return; }
      if (e.target.closest("[data-m-sheetclose]")) deskClose();
    });
    document.body.appendChild(sheet);
    sheet.querySelector("[data-m-sheetmail]").focus();
  }
  function deskSeen(key) {
    try {
      if (sessionStorage.getItem("subsub_desk_" + key)) return true;
      sessionStorage.setItem("subsub_desk_" + key, "1");
    } catch (err) {}
    return false;
  }
  function deskLanding() {
    if (landingShown || !narrow()) return;
    var soft = DESK_SOFT[location.pathname.split("/").pop()];
    if (!landing && !soft) return;
    landingShown = true;
    if (landing) { deskOpen(landing, location.href); return; }
    if (!deskSeen(soft.key)) deskOpen(soft, location.href);
  }
  document.addEventListener("click", function (e) {
    if (!narrow()) return;
    var a = e.target.closest && e.target.closest(".submenu .m-item[href]");
    if (!a || a.classList.contains("is-locked")) return;
    var info = deskInfo(a.getAttribute("href"));
    if (!info) return;
    e.preventDefault();
    mobClose();
    deskOpen(info, a.href);
  }, true);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") deskClose(); });
  deskSync();
  deskLanding();

  if (narrowMq) {
    var onNarrow = function () { if (!narrow()) { mobClose(); deskClose(); } wipSync(); deskSync(); deskLanding(); };
    if (narrowMq.addEventListener) narrowMq.addEventListener("change", onNarrow); else narrowMq.addListener(onNarrow);
    window.addEventListener("resize", onNarrow);
    if (window.ResizeObserver) new ResizeObserver(onNarrow).observe(document.documentElement);
    setInterval(function () { if (narrow() !== state.contains("is-mobwip") && !document.body.hasAttribute("data-lv-page")) wipSync(); if (!narrow() && state.contains("is-mobnav")) mobClose(); }, 500);
  }

  // ----- Нотификации: поповер по колокольчику -----
  // Бейдж-счётчик = индикатор непрочитанного; dismiss/Close all обновляют его,
  // при пустом списке — «No notifications» (как в приложении).
  var notifBell = document.getElementById("notifBell");
  var notifPanel = document.getElementById("notifPanel");
  if (notifBell && notifPanel) {
    var badgeEl = document.querySelector("[data-notif-count]");
    var notifList = notifPanel.querySelector("[data-notif-list]");

    function updateNotif() {
      var n = notifList ? notifList.querySelectorAll(".notif-item").length : 0;
      if (badgeEl) { if (n) { badgeEl.textContent = n; badgeEl.hidden = false; } else { badgeEl.hidden = true; } }
      var empty = notifPanel.querySelector(".notif__empty");
      if (!n && !empty && notifList) {
        empty = document.createElement("div");
        empty.className = "notif__empty";
        empty.textContent = "No notifications";
        notifList.parentNode.insertBefore(empty, notifList.nextSibling);
      } else if (n && empty) { empty.remove(); }
    }
    function openNotif() { notifPanel.hidden = false; notifBell.setAttribute("aria-expanded", "true"); }
    function closeNotif() { notifPanel.hidden = true; notifBell.setAttribute("aria-expanded", "false"); }

    notifBell.addEventListener("click", function (e) {
      e.stopPropagation();
      if (notifPanel.hidden) openNotif(); else closeNotif();
    });
    notifPanel.addEventListener("click", function (e) {
      var dismiss = e.target.closest("[data-notif-dismiss]");
      if (dismiss) { e.preventDefault(); var it = dismiss.closest(".notif-item"); if (it) it.remove(); updateNotif(); return; }
      if (e.target.closest("[data-notif-closeall]")) { e.preventDefault(); if (notifList) notifList.innerHTML = ""; updateNotif(); return; }
      e.stopPropagation(); // клики внутри панели (в т.ч. по ссылкам View) её не закрывают
    });
    document.addEventListener("click", function (e) { if (!e.target.closest("#notif")) closeNotif(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeNotif(); });
    updateNotif();
  }
})();

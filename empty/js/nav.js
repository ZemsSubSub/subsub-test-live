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

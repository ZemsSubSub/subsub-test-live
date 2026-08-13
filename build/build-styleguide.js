// Служебная страница-каталог analytics-styleguide.html.
// Собирается из тех же фрагментов, что и продуктовые страницы: модалки, тосты, тултипы и
// состояния берутся из build-analytics.js через module.exports, а не переписываются копиями.
// В сайдбар не добавляется, открывается по прямому адресу.
const fs = require("fs");
const A = require("./build-analytics.js");
const IC = A.IC, M = A.modals;
const DIR = "E:/Dev SubSub/subsub_front_prototype_31.07.26/";

// ---- статусы элементов ----
const ST = {
  live: { cls: "sg-st--live", t: "есть в прототипе" },
  soon: { cls: "sg-st--soon", t: "новое, ещё не сделано" },
  copy: { cls: "sg-st--copy", t: "требует правки копирайта" },
  gone: { cls: "sg-st--gone", t: "выводится из интерфейса" },
  nopage: { cls: "sg-st--nopage", t: "страницы нет в прототипе" }
};
function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function strings(list) {
  if (!list || !list.length) return "";
  return '<ul class="sg-str">' + list.map(function (s) {
    return '<li><code>' + esc(s) + "</code></li>";
  }).join("") + "</ul>";
}
// «показать»: настоящий триггер продукта либо служебное открытие по id
function action(a) {
  if (!a) return "";
  if (a.attrs) return '<button class="an-btn an-btn--secondary an-btn--small" type="button" ' + a.attrs + ">" + (a.label || "Показать") + "</button>";
  if (a.open) return '<button class="an-btn an-btn--secondary an-btn--small" type="button" data-sg-open="' + a.open + '"' +
    (a.then ? ' data-sg-then="' + esc(a.then) + '"' : "") + ">" + (a.label || "Показать") + "</button>";
  if (a.toast) return '<button class="an-btn an-btn--secondary an-btn--small" type="button" data-sg-toast="' + esc(a.toast) + '">Показать тост</button>';
  if (a.href) return '<a class="an-btn an-btn--secondary an-btn--small" href="' + a.href + '">' + (a.label || "Открыть страницу") + "</a>";
  return "";
}
// Стабильный id из названия: по нему работают диплинки ?show=<id> и записи в JSON.
function slug(s) {
  return String(s).toLowerCase()
    .replace(/[«»“”"'’()]/g, "")
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "").slice(0, 60);
}
// Шаги воспроизведения: агенту нужен точный способ открыть состояние, без ховера.
function repro(c) {
  const a = c.action;
  if (!a) return c.demo ? "элемент отрисован на странице каталога, открывать нечего" : "";
  if (a.attrs) return 'click [' + a.attrs.replace(/\s+/g, "") + '] на analytics-styleguide.html';
  if (a.open) return 'открыть analytics-styleguide.html?show=' + slug(c.name) +
    ' либо click [data-sg-open="' + a.open + '"]' + (a.then ? ' и затем click ' + a.then : "");
  if (a.href) return 'открыть ' + a.href;
  return "";
}
function card(c) {
  const st = ST[c.status] || ST.live;
  c.id = c.id || slug(c.name);
  return '<article class="sg-card" id="' + (c.id || "") + '">' +
    '<header class="sg-card__head">' +
      '<h3 class="sg-card__t">' + esc(c.name) + "</h3>" +
      '<span class="sg-st ' + st.cls + '">' + st.t + "</span>" +
    "</header>" +
    (c.where ? '<p class="sg-card__meta"><b>Где:</b> ' + esc(c.where) + "</p>" : "") +
    (c.trigger ? '<p class="sg-card__meta"><b>Вызов:</b> ' + esc(c.trigger) + "</p>" : "") +
    (c.note ? '<p class="sg-card__note">' + c.note + "</p>" : "") +
    (c.demo ? '<div class="sg-demo">' + c.demo + "</div>" : "") +
    strings(c.strings) +
    (c.action ? '<div class="sg-card__act">' + action(c.action) + "</div>" : "") +
  "</article>";
}
function group(g) {
  return '<section class="sg-group" id="' + g.id + '">' +
    '<h2 class="sg-group__t">' + esc(g.title) + "</h2>" +
    (g.note ? '<p class="sg-group__note">' + g.note + "</p>" : "") +
    '<div class="sg-cards">' + g.cards.map(card).join("") + "</div>" +
  "</section>";
}

/* ================= данные каталога ================= */

const G1 = {
  id: "modals", title: "1. Модалки", cards: [
    { name: "Create collection — шаг 1", status: "live",
      where: "Basic data, My collections, Deep data, Videos data",
      trigger: "кнопка Create Collection",
      strings: ["Create collection", "Describe what you need and we'll find it, or paste channel links you already have.",
        "Collection name *", "Describe with AI", "Paste links", "Cancel", "Set filters", "Start sourcing"],
      action: { attrs: "data-ai-open" } },
    { name: "Create collection — шаг 2 «Narrow down results»", status: "live",
      where: "та же модалка, таб Describe with AI",
      trigger: "кнопка Set filters на первом шаге",
      note: "Было в задаче как НОВОЕ — сделано: три группы фильтров, промпт read-only, предпросмотр количества.",
      strings: ["Narrow down results", "SOURCING DESCRIPTION", "No description yet — sourcing will rely on filters only",
        "Audience & scale", "Activity", "Performance", "Subscribers", "Total views", "Videos published", "all time",
        "Last upload", "how recent", "Average views", "last 3 videos", "Min", "Max",
        "Any time", "Last 7 days", "Last 30 days", "Last 90 days", "Custom", "days",
        "Micro 1k–100k", "Mid 100k–1m", "Large 1m+",
        "≈ 55 channels in our base match these filters", "Back", "Edit filters"],
      action: { open: "aiModal", then: "[data-cc-filters-open]", label: "Открыть шаг 2" } },
    { name: "Create collection из выбранных каналов", status: "live",
      where: "Basic data, Deep data",
      trigger: "кнопка Create collection from N channels в плашке выбора",
      note: "Ни промпта, ни вставки ссылок: только имя и чипы выбранных каналов.",
      strings: ["Create collection", "The channels you selected will go into the new collection.", "Channels"],
      action: { href: "analytics-basic-data.html", label: "Открыть Basic data" } },
    { name: "Set up collection sourcing (режим refs)", status: "live",
      where: "Basic data",
      trigger: "Find similar channels в плашке выбора",
      note: "Референсы предзаполняются выбранными каналами, поэтому воспроизводится только с выбором в таблице.",
      strings: ["Set up collection sourcing", "Describe the channels you want — we'll find and collect them for you.",
        "Reference channels", "No reference channels yet — add one to draft the description automatically.",
        "Add channel", "Paste a channel link or type a name", "Start sourcing"],
      action: { href: "analytics-basic-data.html", label: "Открыть Basic data" } },
    { name: "Name collection (вложенная)", status: "live",
      where: "модалка Create collection",
      trigger: "пункт Create new collection в селекторе коллекции-получателя",
      strings: ["Name collection", "Collection name", "Cancel", "Create"],
      action: { open: "mcModal-create" } },
    { name: "Add channels to «X»", status: "live",
      where: "страница коллекции",
      trigger: "кнопка Add channels",
      note: "Второй таб (поиск по базе с чекбоксами) в задаче помечен НОВОЕ — в прототипе есть.",
      strings: ["Add channels", "Paste links", "Find in base", "YouTube channels links",
        "One-time addition of channels:", "Search by channel title", "Cancel", "Add channels"],
      action: { open: "ncModal" } },
    { name: "New channels (Add to base)", status: "gone",
      where: "ранее — Basic data",
      trigger: "кнопка Add to base (убрана из интерфейса)",
      note: "Разметка ещё живёт в сборке: та же модалка обслуживает Add channels на странице коллекции.",
      strings: ["New channels", "Add to base"],
      action: { open: "ncModal", label: "Показать разметку" } },
    { name: "New report — Market insights", status: "live",
      where: "Reports",
      trigger: "кнопка Create report на табе Market insights",
      strings: ["New report", "Report type", "Report name", "Collection", "Period", "Cancel", "Create report"],
      action: { attrs: "data-rep-open" } },
    { name: "New report — My performance", status: "copy",
      where: "Reports, таб My performance",
      trigger: "кнопка Create report",
      note: "Расхождение: при том же назначении состав и плейсхолдеры другие, чем у Market insights.",
      strings: ["New report", "Report name", "Channel", "Period"],
      action: { href: "analytics-reports.html?tab=performance", label: "Открыть Reports" } },
    { name: "Share collection", status: "live",
      where: "My collections, страница коллекции",
      trigger: "кнопка Share",
      strings: ["Share collection", "Search people", "Can view", "Can edit", "Remove access", "Not shared"],
      action: { href: "analytics-collection-edit.html?name=Gaming%20UA", label: "Открыть коллекцию" } },
    { name: "Duplicate collection", status: "soon",
      where: "My collections, страница коллекции",
      trigger: "пункт Duplicate collection",
      note: "Сейчас дубликат создаётся сразу, без модалки. По задаче нужно поле имени с дефолтом «<название> expanded».",
      strings: ["Duplicate collection", "Collection name", "Gaming UA expanded", "Cancel", "Duplicate"] },
    { name: "Columns visibility", status: "live",
      where: "Deep data",
      trigger: "кнопка Columns",
      strings: ["Columns", "Reset"],
      action: { href: "analytics-deep-data.html", label: "Открыть Deep data" } },
    { name: "Month-range picker", status: "nopage",
      where: "карточка канала — страницы analytics-channel.html в прототипе нет",
      trigger: "поле периода в карточке",
      note: "Элемент из прода: в прототипе карточки канала не существует, воспроизвести нечем.",
      strings: ["Cancel", "Apply"] },
    { name: "Календарь Growth period / Published at", status: "live",
      where: "Basic data, Deep data, Videos data, панель фильтров",
      trigger: "чип Custom или поле Published at",
      strings: ["Custom", "7 days", "30 days", "90 days", "Cancel", "Apply", "dd.mm.yyyy"],
      action: { href: "analytics-basic-data.html", label: "Открыть Basic data" } },
    { name: "Дропдаун SEARCH MODE", status: "gone",
      where: "ранее — поиск на Basic data",
      trigger: "переключатель режима поиска (убран)",
      note: "Поиск стал обычным, режимы убраны — оставляю в каталоге как выведенный элемент.",
      strings: ["Search mode", "Default", "AI semantic search"] },
    { name: "Селектор коллекции", status: "live",
      where: "Basic data, Deep data, Videos data",
      trigger: "пилюля Select collection",
      note: "Группы теперь по состоянию: Activated · Collecting data · Sourcing channels · Not activated. Плюс пункт создания.",
      strings: ["Select collection", "Search", "All collections", "Create collection",
        "Activated", "Collecting data", "Sourcing channels", "Not activated"],
      action: { href: "analytics-deep-data.html", label: "Открыть Deep data" } },
    { name: "Меню коллекции «⋮» — своя и чужая", status: "live",
      where: "My collections, страница коллекции",
      trigger: "кнопка с тремя точками",
      demo: '<div class="sg-two">' +
        '<div><span class="sg-two__k">своя</span><div class="sg-menu">' +
          '<span class="sg-menu__i">View collection</span><span class="sg-menu__i">Activate deep data</span>' +
          '<span class="sg-menu__i">Rename collection</span><span class="sg-menu__i">Duplicate collection</span>' +
          '<span class="sg-menu__i sg-menu__i--danger">Delete collection</span></div></div>' +
        '<div><span class="sg-two__k">чужая (sample)</span><div class="sg-menu">' +
          '<span class="sg-menu__i">View collection</span><span class="sg-menu__i">Duplicate collection</span>' +
          '<span class="sg-menu__i sg-menu__i--danger">Leave collection</span>' +
          '<span class="sg-menu__note">You can’t change a collection shared with you</span></div></div></div>',
      strings: ["View collection", "Activate deep data", "View deep data", "Rename collection",
        "Duplicate collection", "Deactivate collection", "Stop collecting", "Delete collection", "Leave collection"] }
  ]
};

const G2 = {
  id: "dialogs", title: "2. Диалоги подтверждения", cards: [
    { name: "Delete collection?", status: "live", where: "My collections, страница коллекции",
      trigger: "пункт Delete collection",
      strings: ["Delete collection?", "This action cannot be undone. The collection and its settings will be removed.",
        "Cancel", "Delete"],
      action: { open: "mcModal-delete" } },
    { name: "Deactivate collection?", status: "live", where: "My collections, страница коллекции",
      trigger: "пункт Deactivate collection",
      strings: ["Deactivate collection?", "Deep data of the collection will be deactivated. You can activate it again later.",
        "Cancel", "Deactivate"],
      action: { open: "mcModal-deactivate" } },
    { name: "Activate deep data?", status: "live", where: "My collections, страница коллекции, Deep data",
      trigger: "Activate deep data",
      note: "В задаче помечено НОВОЕ — сделано: подтверждение перед платным действием.",
      strings: ["Activate deep data?",
        "Deep data will be collected for 8 channels of «Gaming UA». Collecting takes a few minutes and counts against your plan limits.",
        "Cancel", "Activate"],
      action: { open: "mcModal-activate" } },
    { name: "Удаление одного канала из коллекции", status: "live", where: "страница коллекции",
      trigger: "корзина в строке",
      note: "В задаче помечено НОВОЕ — сделано, удаление идёт через подтверждение.",
      strings: ["Remove MrBeast from collection?",
        "The channel will be removed from «Gaming UA». You can add it back at any time.", "Cancel", "Remove"],
      action: { href: "analytics-collection-edit.html?name=Gaming%20UA", label: "Открыть коллекцию" } },
    { name: "Убрать из коллекции (N) — массовое", status: "live", where: "страница коллекции",
      trigger: "плашка выбора → Remove N channels",
      strings: ["Remove 3 channels from collection?", "Cancel", "Remove"],
      action: { href: "analytics-collection-edit.html?name=Gaming%20UA", label: "Открыть коллекцию" } },
    { name: "Активация во время подбора", status: "soon", where: "страница коллекции, Deep data",
      trigger: "Activate deep data, когда идёт подбор каналов",
      note: "Сейчас активация в этом состоянии просто заблокирована тултипом. По задаче нужен выбор из двух вариантов.",
      strings: ["Activate deep data while sourcing is running?",
        "Sourcing is still adding channels. You can stop it and collect deep data for what's already there, or queue activation until sourcing finishes.",
        "Stop sourcing and activate now", "Activate after sourcing", "Cancel"] },
    { name: "Добавление каналов в активированную коллекцию", status: "copy", where: "Basic data, Deep data, страница коллекции",
      trigger: "добавление каналов в коллекцию со собранной Deep data",
      note: "Диалог есть, но ветки другие: сейчас «Add anyway» и «Duplicate and add». По задаче нужны Deactivate и Duplicate, без «добавить всё равно».",
      strings: ["Add channels to an activated collection?",
        "Deep data for 2 channels will start from the day you add them, so history in «News UA - Big Media» stays incomplete. For full history duplicate the collection and activate deep data for the copy.",
        "Cancel", "Duplicate and add", "Add anyway"],
      action: { open: "awModal" } },
    { name: "Отмена подбора", status: "soon", where: "страница коллекции, список, пилюля в шапке",
      trigger: "Cancel у процесса подбора",
      note: "Сейчас отмена срабатывает сразу, без подтверждения.",
      strings: ["Stop sourcing channels?", "Channels found so far stay in the collection.",
        "Keep sourcing", "Stop sourcing"] },
    { name: "Дубликат sample-коллекции на Explorer", status: "soon", where: "My collections, страница коллекции",
      trigger: "Duplicate collection у sample-коллекции на плане Explorer",
      strings: ["Duplicate a sample collection?",
        "Deep data won't be available in your copy on the Explorer plan — sample collections are an exception.",
        "Cancel", "Duplicate anyway"] }
  ]
};

// Тексты выписаны из вызовов toast() в js/analytics.js — это то, что показывает прототип.
// Формулировки из брифа, которых в коде нет, собраны отдельно ниже.
const TOASTS_LIVE = [
  "Collection created — it's selected as destination",
  "Collection created successfully",
  "Collection renamed",
  "Collection saved successfully",
  "Collection deleted successfully",
  "Collection duplicated as «Gaming UA (copy)»",
  "Collection with this name already exists",
  "You left «News UA - Big Media»",
  "Channels added successfully",
  "2 channels added to Gaming UA",
  "3 channels removed from Gaming UA",
  "AI search started — new channels will be added to “Gaming UA”",
  "Sourcing cancelled — “Gaming UA”",
  "Sourcing finished — 6 channels added to “Gaming UA”",
  "Collecting deep data — “Gaming UA”",
  "Deep data is ready — “Gaming UA”",
  "Deep data collection cancelled — “Gaming UA”",
  "Deep data deactivated — “Gaming UA”",
  "Prompt rebuilt from the collection — edit it before starting",
  "Description auto-filled — edit it before starting",
  "“ТСН” pinned on top",
  "“ТСН” unpinned",
  "Collection shared with Anna Kovalenko",
  "Sharing with Anna Kovalenko revoked",
  "Link copied",
  "Failed to copy link",
  "Title copied",
  "Report download started",
  "Changes saved automatically",
  "Upgrade request sent — our team will contact you"
];
// Из брифа, но в коде таких строк нет: либо продовые формулировки, либо ещё не заведены.
const TOASTS_BRIEF = [
  "Sourcing started — channels will be added to \"X\"",
  "Sourcing started — we're finding channels",
  "Sourcing of \"X\" canceled",
  "Added N channels to \"X\" · M already there",
  "Channel removed from collection",
  "Deep data activated successfully",
  "Select a destination collection",
  "Add at least one reference channel",
  "Describe the channels or paste a channel link"
];
const TOASTS_VALID = [
  "Name the collection first",
  "Name can't be empty",
  "Describe the channels you're looking for",
  "Only 3 more channels fit — upgrade the plan for a bigger collection",
  "Collection limit reached — upgrade the plan to add more channels",
  "Collection limit reached on the Pro plan — upgrade to create more",
  "Channels can't be changed while deep data is being collected",
  "Sourcing is running — it fills the collection itself",
  "Deep data is available on Pro and above — upgrade to activate"
];
const TOASTS_NEW = [
  "Sourcing failed — nothing was added. Try again",
  "Deep data collection failed. Try again",
  "Sourcing stopped — collection is full on the Pro plan (25/25)"
];
const G3 = {
  id: "toasts", title: "3. Тосты",
  note: "Кнопка показывает настоящий тост тем же механизмом, что в продукте.",
  cards: [
    { name: "Существующие", status: "live", where: "весь раздел Analytics",
      demo: TOASTS_LIVE.map(function (s) {
        return '<button class="an-btn an-btn--plain an-btn--small sg-toastbtn" type="button" data-sg-toast="' + esc(s) + '">' + esc(s) + "</button>";
      }).join(""), strings: TOASTS_LIVE },
    { name: "Валидационные и блокирующие", status: "live", where: "модалки создания и добавления",
      demo: TOASTS_VALID.map(function (s) {
        return '<button class="an-btn an-btn--plain an-btn--small sg-toastbtn" type="button" data-sg-toast="' + esc(s) + '">' + esc(s) + "</button>";
      }).join(""), strings: TOASTS_VALID },
    { name: "Из брифа, но в коде нет", status: "copy", where: "—",
      note: "Эти формулировки пришли из описания прода. В прототипе показываются другие тексты — сверху. Нужно решить, какие оставить.",
      strings: TOASTS_BRIEF },
    { name: "Новые: ошибки и упор в лимит", status: "soon", where: "подбор каналов и сбор Deep data",
      note: "Состояний ошибки в прототипе нет — тексты на утверждение, поведение по документу состояний: коллекция всегда откатывается в Created.",
      demo: TOASTS_NEW.map(function (s) {
        return '<button class="an-btn an-btn--plain an-btn--small sg-toastbtn" type="button" data-sg-toast="' + esc(s) + '">' + esc(s) + "</button>";
      }).join(""), strings: TOASTS_NEW }
  ]
};

const G4 = {
  id: "banners", title: "4. Баннеры, плашки, индикаторы", cards: [
    { name: "Баннер плана в модалке", status: "live", where: "Create collection",
      trigger: "открытие модалки",
      note: "Правка из задачи сделана: для пустой коллекции «up to 25 channels», формат N of M только когда места заняты.",
      demo: '<div class="cc-limit" style="position:static"><span class="cc-limit__t"><b>Pro</b> plan: up to <b>25</b> channels in a collection.</span>' +
        '<button class="cc-limit__up" type="button">' + IC.rocket + "Upgrade plan</button></div>",
      strings: ["Pro plan: up to 25 channels in a collection.", "Pro plan: up to 5 of 25 left in “Gaming UA”.",
        "Pro plan: only 10 of 14 channels will be added.", "Upgrade plan"] },
    { name: "Инлайн-апселл при упоре в лимит коллекций", status: "live", where: "Create collection",
      trigger: "исчерпан лимит коллекций плана",
      demo: '<span class="cc-foot__why" style="position:static">' + IC.alert + "<span>Collection limit reached on Pro (5/5)</span></span>",
      strings: ["Collection limit reached on Pro (5/5)", "All 5 collections used on Pro — upgrade or add to an existing one"] },
    { name: "Плашка «коллекция в процессе»", status: "live", where: "страница коллекции",
      trigger: "идёт подбор каналов или сбор Deep data",
      demo: '<span class="mc-status mc-status--orange ce-sourcing" style="position:static">' + IC.progress +
        '<span class="mc-status__t">Sourcing channels</span><span class="mc-status__sep"></span>' +
        '<button class="mc-status__link" type="button">Cancel</button></span>',
      strings: ["Sourcing channels", "Collecting data", "Cancel"] },
    { name: "Плашка «активация запланирована»", status: "soon", where: "страница коллекции, список",
      trigger: "выбран вариант «Активировать после подбора»",
      strings: ["Activation queued — deep data starts when sourcing finishes"] },
    { name: "Пилюля процессов в шапке", status: "live", where: "все страницы Analytics",
      trigger: "идёт хотя бы один процесс",
      strings: ["Sourcing channels", "Collecting data", "Cancel", "View"],
      action: { href: "analytics-collections.html", label: "Открыть My collections" } },
    { name: "Счётчик мест «N of M channels»", status: "live", where: "страница коллекции",
      note: "Правка из задачи сделана: вместимость тарифная (Pro — 25), у Enterprise плашки нет вовсе.",
      demo: '<span class="ce-limit" style="position:static"><span class="ce-limit__v"><b>22</b> of <span>25</span> channels</span>' +
        '<span class="ce-limit__bar"><span class="ce-limit__fill" style="width:88%"></span></span>' +
        '<button class="an-btn an-btn--secondary an-btn--small ce-limit__up" type="button">' + IC.rocket + "Upgrade</button></span>",
      strings: ["22 of 25 channels", "Upgrade", "Collection is full on the Pro plan (25/25)"] },
    { name: "Блок последнего подбора", status: "live", where: "страница коллекции, Deep data",
      trigger: "у коллекции есть запуск подбора",
      note: "Формулировки про запуск, а не про состав: после ручных правок коллекция им уже не соответствует.",
      strings: ["Last sourcing", "Filters used", "subs ≥ 10,000", "videos ≥ 50", "Source more channels", "no filters"] },
    { name: "Чипы активных фильтров", status: "live", where: "Create collection, шаг 1",
      trigger: "заданы фильтры подбора",
      demo: '<span class="ff-chip">subs 10k–1m<button class="ff-chip__x" type="button">' + IC.close + "</button></span>" +
        '<span class="ff-chip">videos 50+<button class="ff-chip__x" type="button">' + IC.close + "</button></span>" +
        '<span class="ff-chip">last 30d<button class="ff-chip__x" type="button">' + IC.close + "</button></span>",
      strings: ["subs 10k–1m", "videos 50+", "views 5m+", "up to 1m", "last 30d", "Set filters", "Edit filters"] },
    { name: "Инфо-баннер на Reports", status: "live", where: "Reports",
      trigger: "открытие страницы, закрывается крестиком",
      strings: ["Ready reports are stored in Media Library — Content Export folder."],
      action: { href: "analytics-reports.html", label: "Открыть Reports" } }
  ]
};

const G5 = {
  id: "empty", title: "5. Пустые состояния и загрузка",
  note: "Три разных типа, которые нельзя путать: <b>загрузка</b> — данные идут, <b>пусто</b> — само не появится, <b>ноль результатов</b> — процесс закончился ни с чем.",
  cards: [
    { name: "No channels yet — обычная коллекция", status: "live", where: "страница коллекции",
      demo: '<div class="an-blank" style="padding:32px"><span class="an-blank__ico">' + IC.collections + "</span>" +
        '<h2 class="an-blank__title">No channels yet</h2>' +
        '<p class="an-blank__text">Add channels by link or from our base — or describe what you need and we\'ll find them. ' +
        'Deep data can be activated once the collection has at least one channel.</p>' +
        '<button class="an-btn an-btn--primary" type="button">' + IC.plus + "Add channels</button></div>",
      strings: ["No channels yet",
        "Add channels by link or from our base — or describe what you need and we'll find them. Deep data can be activated once the collection has at least one channel.",
        "Add channels"] },
    { name: "Скелетон-лоадер подбора", status: "live", where: "страница коллекции",
      note: "Не больше трёх строк-заглушек, реальные каналы приезжают выше. По задаче было НОВОЕ — сделано.",
      demo: '<div class="sg-skel"><div class="sg-skel__row"><span class="ce-skel__box"></span><span class="ce-skel__ava"></span>' +
        '<span class="ce-skel__bar" style="width:40%"></span></div>' +
        '<div class="sg-skel__row"><span class="ce-skel__box"></span><span class="ce-skel__ava"></span>' +
        '<span class="ce-skel__bar" style="width:52%"></span></div>' +
        '<div class="sg-skel__row"><span class="ce-skel__box"></span><span class="ce-skel__ava"></span>' +
        '<span class="ce-skel__bar" style="width:34%"></span></div></div>',
      strings: ["Sourcing channels", "Cancel"] },
    { name: "Ноль результатов подбора", status: "soon", where: "страница коллекции",
      note: "Сейчас после пустого подбора коллекция показывает обычное «No channels yet» — промпт не виден.",
      strings: ["No channels matched this description",
        "Sourcing finished, but nothing matched: “турецкие сериалы с озвучкой”. Loosen the filters or rewrite the description.",
        "Edit description", "Run sourcing again"] },
    { name: "Скелетон в ячейках метрик нового канала", status: "live", where: "страница коллекции",
      note: "Было НОВОЕ — сделано: у только что добавленного канала вместо прочерков заглушки.",
      demo: '<div class="sg-skel__row"><span class="ce-skel__ava"></span><b>Fortnite Focus</b>' +
        '<span class="ce-skel__bar" style="width:60px"></span><span class="ce-skel__bar" style="width:60px"></span></div>' },
    { name: "No channels found — Basic data", status: "live", where: "Basic data, Deep data",
      trigger: "поиск или фильтры без результатов",
      strings: ["No channels found", "Select a collection to see deep data"] },
    { name: "Пустая коллекция, выбранная на Basic data", status: "soon", where: "Basic data",
      strings: ["This collection has no channels yet", "Open the collection"] },
    { name: "Deep data: четыре состояния", status: "live", where: "Deep data",
      note: "Коллекция не активирована · идёт подбор · идёт сбор метрик · коллекция не выбрана.",
      strings: ["Deep data isn't activated",
        "Activate deep data for “Gaming UA” — we'll collect growth, engagement and performance for every channel in it.",
        "Activate deep data", "Collecting data",
        "We're collecting deep metrics for 8 channels of “Gaming UA”. You can leave the page — collection continues.",
        "Cancel collection", "Select a collection",
        "Deep data is shown per collection — pick one above to see its channels and metrics.", "Select collection",
        "No collections yet", "Create collection"],
      action: { href: "analytics-deep-data.html", label: "Открыть Deep data" } },
    { name: "My collections: нет своих коллекций", status: "live", where: "My collections",
      note: "Сделано: над списком сэмплов промо-блок «создайте свою». Полностью пустого списка не бывает — сэмплы выданы всем.",
      strings: ["Create your first collection",
        "Sample collections show how it works. Build your own to track the channels you care about.",
        "Create Collection", "You have no own collections yet", "Show all collections", "Nothing found", "Clear search"] },
    { name: "No results found — Shared with", status: "live", where: "My collections, фильтр Shared with",
      strings: ["No results found"] },
    { name: "Пустой список отчётов", status: "live", where: "Reports",
      note: "В прототипе текст без артикля: «No reports yet». Формулировка «You don't have a reports yet» — из прода, там артикль лишний.",
      strings: ["No reports yet", "You don't have a reports yet (прод)"] },
    { name: "Пейвол Deep data на Explorer", status: "live", where: "страница коллекции, Deep data",
      note: "Кнопка видна и заблокирована, тултип объясняет и предлагает апгрейд. По сэмплам Deep data открыта.",
      demo: '<button class="an-btn an-btn--secondary is-off" type="button" data-tip="Deep data is available on Pro and above" data-tip-up>' +
        IC.graph + "Activate deep data</button>",
      strings: ["Deep data is available on Pro and above", "Upgrade plan"] }
  ]
};

const G6 = {
  id: "tips", title: "6. Тултипы",
  note: "Наведи на элемент — тултип настоящий, тот же движок, что в продукте. Где упор в тариф, внутри есть действие апгрейда.",
  cards: [
    { name: "Блокировки состояний", status: "live", where: "страница коллекции, Basic data, Deep data",
      demo: [
        ["Sourcing is running — it fills the collection itself", "Add channels", false],
        ["Wait until channel sourcing finishes", "Activate deep data", false],
        ["Add at least one channel first", "Activate deep data", false],
        ["Channels can't be changed while deep data is being collected", "Remove channel", false],
        ["Wait until the running process finishes", "Duplicate collection", false]
      ].map(function (r) {
        return '<button class="an-btn an-btn--secondary an-btn--small is-off" type="button" data-tip="' + esc(r[0]) + '">' + esc(r[1]) + "</button>";
      }).join(""),
      strings: ["Sourcing is running — it fills the collection itself", "Wait until channel sourcing finishes",
        "Add at least one channel first", "Channels can't be changed while deep data is being collected",
        "Wait until the running process finishes", "Deep data isn't collected yet"] },
    { name: "Апселл-тултипы", status: "live", where: "страница коллекции, Deep data, модалка создания",
      demo: [
        ["Deep data is available on Pro and above", "Activate deep data"],
        ["Collection is full on the Pro plan (25/25)", "Add channels"]
      ].map(function (r) {
        return '<button class="an-btn an-btn--secondary an-btn--small is-off" type="button" data-tip="' + esc(r[0]) + '" data-tip-up>' + esc(r[1]) + "</button>";
      }).join(""),
      strings: ["Deep data is available on Pro and above", "Collection is full on the Pro plan (25/25)",
        "7 days is available on Pro and above", "Upgrade plan"] },
    { name: "Справочные «?» в карточке канала", status: "nopage", where: "карточка канала (в прототипе страницы нет)",
      note: "Из брифа по проду: 41 иконка без title и aria-describedby. В прототипе страницы карточки нет, проверять нечего.",
      strings: ["What this metric means", "How we calculate it"] },
    { name: "Бейджи скорингов SEO, CB, VIR", status: "nopage", where: "прод: Videos data и карточка канала",
      note: "В прототипе таких бейджей нет — ни в Videos data, ни на других страницах. Текст на будущее.",
      strings: ["SEO score", "Clickbait score", "Virality score"] },
    { name: "Highlight performance и Performance range", status: "soon", where: "панель фильтров",
      note: "Без пояснений вообще. Редизайн панели — отдельный трек, но подсказки нужны и сейчас.",
      strings: ["Highlight performance", "Performance range"] },
    { name: "Иконки в колонке ACTIONS на Reports", status: "copy", where: "Reports",
      note: "aria-label и title у части иконок есть (Download, Show in Media Library), но своих тултипов нет и корзина стоит вплотную к скачиванию.",
      strings: ["Download", "Show in Media Library", "Download report", "Delete report"] },
    { name: "Легенда хитмапа Publication time", status: "nopage", where: "карточка канала (в прототипе страницы нет)",
      note: "Из брифа по проду.",
      strings: ["Fewer uploads", "More uploads"] },
    { name: "Иконка-«монитор» в строке канала", status: "soon", where: "Basic data",
      note: "Ни aria-label, ни тултипа — назначение непонятно.",
      strings: ["Open channel page"] },
    { name: "Аббревиатуры колонок и суффикс all", status: "soon", where: "Basic data, Deep data",
      note: "Расшифровка живёт только в ховер-тултипе, на тач-устройствах недоступна; «all» нигде не объяснён.",
      strings: ["PVCO — paid views carried over", "MEV — median engagement views", "all — across all content types"] },
    { name: "Индикатор «+N» у топиков", status: "live", where: "Basic data, Deep data, страница коллекции",
      note: "Работает: клик по «+N» раскрывает полный список топиков, клик по топику ставит фильтр.",
      strings: ["+2"] }
  ]
};

function pill(kind, label, extra) {
  var ico = kind === "activated" ? IC.thumbUp : kind === "created" ? IC.check : IC.progress;
  var cls = kind === "activated" ? "mc-status--green" : kind === "created" ? "mc-status--gray" : "mc-status--orange";
  return '<span class="mc-status ' + cls + '">' + ico + '<span class="mc-status__t">' + label + "</span>" +
    (extra ? '<span class="mc-status__sep"></span><span class="mc-status__link">' + extra + "</span>" : "") + "</span>";
}
const G7 = {
  id: "new", title: "7. Новые и обновлённые элементы", cards: [
    { name: "Пилюли состояний коллекции", status: "live", where: "My collections, страница коллекции, селектор",
      note: "Прежний единый статус расщеплён на два процесса. Лейблы утверждены: Sourcing channels и Collecting data.",
      demo: '<div class="sg-row">' + pill("created", "Created", "Activate deep data") + pill("sourcing", "Sourcing channels", "Cancel") +
        pill("sourcing", "Collecting data", "Cancel") + pill("activated", "Activated", "View deep data") + "</div>",
      strings: ["Created", "Sourcing channels", "Collecting data", "Activated",
        "Activate deep data", "View deep data", "Cancel"] },
    { name: "Stop collecting и Deactivate рядом", status: "live", where: "меню коллекции",
      note: "Разные действия: первое прерывает незаконченный сбор, второе выключает готовые данные.",
      demo: '<div class="sg-row"><span class="sg-menu__i">' + IC.off + "Stop collecting</span>" +
        '<span class="sg-menu__i">' + IC.off + "Deactivate collection</span></div>",
      strings: ["Stop collecting", "Deactivate collection"] },
    { name: "Групповые заголовки колонок Basic data", status: "soon", where: "Basic data",
      strings: ["Subscribers", "Views", "Videos", "Derived"] },
    { name: "Growth period: значение, календарь, чипы", status: "live", where: "Basic data, Deep data, Videos data",
      note: "Активный чип отличается (состояние is-on). Не сделано другое: на Explorer чипы 7 и 90 должны быть заблокированы с апселлом.",
      strings: ["Growth period", "Custom", "90 days", "30 days", "7 days"] },
    { name: "Гейтинг чипов периода на Explorer", status: "soon", where: "Basic data, Deep data, Videos data",
      note: "На Explorer период фиксирован 30 днями: чипы 7 и 90 должны быть видны и заблокированы с апселлом.",
      strings: ["7 days is available on Pro and above", "Upgrade plan"] },
    { name: "Селектор коллекции с состояниями", status: "live", where: "Basic data, Deep data",
      note: "Первым пунктом All collections, группы по состоянию — до выбора видно, где Deep data готова.",
      strings: ["All collections", "Activated", "Collecting data", "Sourcing channels", "Not activated", "Create collection"] },
    { name: "Переключатель типа контента на Deep data", status: "live", where: "Deep data",
      note: "Один переключатель вместо семи дропдаунов в заголовках колонок.",
      strings: ["All content", "Videos", "Shorts", "Streams"] },
    { name: "Чекбоксы и плашка массовых действий", status: "live", where: "Basic data, Deep data, страница коллекции",
      demo: '<div class="sg-row"><button class="an-btn an-btn--primary an-btn--small" type="button">' + IC.plus +
        "Create collection from 2 channels</button>" +
        '<button class="an-btn an-btn--secondary an-btn--small" type="button">Add 2 channels to collection</button>' +
        '<button class="an-btn an-btn--secondary an-btn--small" type="button">' + IC.aiStarsSolid + "Find similar channels</button></div>",
      strings: ["Create collection from 2 channels", "Add 2 channels to collection", "Find similar channels",
        "Pin on top", "Unpin", "Remove 2 channels"] },
    { name: "Закрепление строки кнопкой", status: "live", where: "Deep data",
      note: "У обычной строки кнопка появляется по наведению, у закреплённой видна всегда; клик переключает.",
      demo: '<div class="sg-row"><span class="and-chan" style="width:220px"><span class="an-chan__name">ТСН</span>' +
        '<button class="and-pin" type="button" style="opacity:1" data-tip="Unpin">' + IC.pin + "</button></span></div>",
      strings: ["Pin on top", "Unpin", "“ТСН” pinned on top", "“ТСН” unpinned"] },
    { name: "Кликабельные баджи топиков и «+N»", status: "live", where: "Basic data, Deep data, страница коллекции",
      note: "Клик по топику ставит фильтр по теме, «+N» раскрывает список остальных.",
      strings: ["+2"] },
    { name: "Счётчик записей вместо «Pages: 74,046»", status: "soon", where: "Basic data, Deep data",
      strings: ["2.2m channels · showing 1–30", "Pages: 74,046"] },
    { name: "Sticky скроллбар и заморозка первой колонки", status: "live", where: "Basic data, Deep data",
      strings: [] },
    { name: "Поля-диапазоны от–до", status: "live", where: "Create collection, шаг 2",
      note: "Вместо односторонних минимумов с нулём как «выключено»: пустое поле — условие не задано.",
      demo: '<div class="ff-pair" style="max-width:320px"><input class="an-input ff-inp" placeholder="Min" value="10,000" />' +
        '<span class="ff-dash">–</span><input class="an-input ff-inp" placeholder="Max" /></div>',
      strings: ["Min", "Max"] },
    { name: "Селект Last upload с пресетами", status: "live", where: "Create collection, шаг 2",
      strings: ["Any time", "Last 7 days", "Last 30 days", "Last 90 days", "Custom", "days"] },
    { name: "Set filters / Edit filters и чипы", status: "live", where: "Create collection, шаг 1",
      strings: ["Set filters", "Edit filters"] },
    { name: "Предпросмотр количества", status: "live", where: "Create collection, шаг 2",
      note: "Считается по каталогу каналов; метрик videos и avg в моках нет, они в подсчёте не участвуют.",
      strings: ["≈ 40 channels match these filters", "≈ 1 channel in our base matches these filters"] },
    { name: "Формат чисел", status: "live", where: "Create collection, шаг 2",
      note: "Разделители разрядов и приём сокращений: 10k → 10,000, 1.5m → 1,500,000.",
      strings: ["10,000", "1,500,000"] },
    { name: "Прогресс-бар счётчика мест", status: "live", where: "страница коллекции",
      note: "Тарифная вместимость вместо фиксированных 30; у Enterprise плашки нет.",
      strings: ["22 of 25 channels", "Upgrade"] }
  ]
};

// Ссылки на прод — только для того, что там есть. У нового ставим null, иначе агент
// будет искать несуществующее и решит, что просто не нашёл.
const PROD = "https://app.subsub.io";
const PROD_BY_PLACE = [
  [/Basic data/i, PROD + "/analytics"],
  [/Deep data/i, PROD + "/analytics/deep"],
  [/My collections|страница коллекции|список/i, PROD + "/analytics/collections"],
  [/Videos data/i, PROD + "/analytics/videos"],
  [/Reports/i, PROD + "/reports/market"]
];
function prodLink(c) {
  if (c.status === "soon") return null;              // на проде этого ещё нет
  if (c.status === "nopage") return PROD + "/analytics";  // элемент прода, страницы у нас нет
  const where = c.where || "";
  for (var i = 0; i < PROD_BY_PLACE.length; i++) if (PROD_BY_PLACE[i][0].test(where)) return PROD_BY_PLACE[i][1];
  return null;
}

const GROUPS = [G1, G2, G3, G4, G5, G6, G7];

const inner = `
    <section class="an-page sg-page">
      <header class="sg-head">
        <h1 class="an-title">Analytics styleguide</h1>
        <p class="sg-lead">Служебная страница прототипа: модалки, диалоги, тосты, баннеры, пустые состояния и тултипы
          раздела Analytics и флоу коллекций. В сайдбар не добавлена, открывается по прямому адресу.
          Элементы собраны из тех же фрагментов, что и продуктовые страницы.</p>
        <div class="sg-legend">
          ${Object.keys(ST).map(function (k) {
            return '<span class="sg-st ' + ST[k].cls + '">' + ST[k].t + "</span>";
          }).join("")}
        </div>
        <nav class="sg-toc">
          ${GROUPS.map(function (g) { return '<a class="sg-toc__i" href="#' + g.id + '">' + g.title + "</a>"; }).join("")}
        </nav>
      </header>

      ${GROUPS.map(group).join("\n")}
    </section>

    ${M.aiModalHtml}
    ${M.acModalHtml}
    ${M.ncModalHtml}
    ${M.mcCreateModalHtml}
    ${M.awModalHtml}
    ${M.activateModalHtml}
    ${M.repModalHtml}

    <!-- диалоги подтверждения из списка коллекций: те же id, что в продукте -->
    <div class="an-modal" id="mcModal-delete"><div class="an-modal__overlay" data-mc-close></div>
      <div class="an-modal__dialog an-modal__dialog--sm">
        <div class="an-modal__head"><h2 class="an-modal__title">Delete collection?</h2>
          <button class="an-modal__x" type="button" data-mc-close aria-label="Close">${IC.closeBold}</button></div>
        <div class="an-modal__body"><p class="an-modal__text">This action cannot be undone. The collection and its
          settings will be removed.</p></div>
        <div class="an-modal__foot">
          <button class="an-btn an-btn--secondary an-btn--small" type="button" data-mc-close>Cancel</button>
          <button class="an-btn an-btn--primary an-btn--small" type="button" data-mc-close>Delete</button>
        </div>
      </div>
    </div>
    <div class="an-modal" id="mcModal-deactivate"><div class="an-modal__overlay" data-mc-close></div>
      <div class="an-modal__dialog an-modal__dialog--sm">
        <div class="an-modal__head"><h2 class="an-modal__title">Deactivate collection?</h2>
          <button class="an-modal__x" type="button" data-mc-close aria-label="Close">${IC.closeBold}</button></div>
        <div class="an-modal__body"><p class="an-modal__text">Deep data of the collection will be deactivated.
          You can activate it again later.</p></div>
        <div class="an-modal__foot">
          <button class="an-btn an-btn--secondary an-btn--small" type="button" data-mc-close>Cancel</button>
          <button class="an-btn an-btn--primary an-btn--small" type="button" data-mc-close>Deactivate</button>
        </div>
      </div>
    </div>

    <div class="an-toast" data-an-toast hidden></div>
    <div class="an-tip" data-an-tip hidden role="tooltip"><span class="an-tip__arrow" data-an-tip-arrow></span><span data-an-tip-txt></span><button class="an-tip__act" type="button" data-an-tip-up hidden>${IC.rocket}Upgrade plan</button></div>

    <script>
      // Служебная обвязка каталога: открыть модалку по id и показать тост тем же способом,
      // что в продукте. Компоненты не дублируем — только их запуск.
      document.addEventListener("click", function (e) {
        var open = e.target.closest("[data-sg-open]");
        if (open) {
          var m = document.getElementById(open.getAttribute("data-sg-open"));
          if (m) { m.classList.add("is-open"); document.body.style.overflow = "hidden"; }
          var then = open.getAttribute("data-sg-then");
          if (then) setTimeout(function () {
            var t = document.querySelector(then);
            if (t) t.dispatchEvent(new MouseEvent("click", { bubbles: true }));
          }, 60);
          return;
        }
        var toastBtn = e.target.closest("[data-sg-toast]");
        if (toastBtn) {
          var t = document.querySelector("[data-an-toast]");
          if (!t) return;
          t.textContent = toastBtn.getAttribute("data-sg-toast");
          t.hidden = false;
          clearTimeout(t._sg);
          t._sg = setTimeout(function () { t.hidden = true; }, 2600);
        }
      });

      // Диплинк ?show=<id>: открываем карточку и её элемент сразу при загрузке —
      // агенту не нужно кликать по цепочке и наводить курсор.
      (function deepLink() {
        var id = new URLSearchParams(location.search).get("show");
        if (!id) return;
        var card = document.getElementById(id);
        if (!card) return;
        card.classList.add("sg-card--target");
        card.scrollIntoView({ block: "center" });
        var btn = card.querySelector("[data-sg-open], [data-ai-open], [data-rep-open]");
        if (btn) setTimeout(function () { btn.dispatchEvent(new MouseEvent("click", { bubbles: true })); }, 120);
        var tipHost = card.querySelector("[data-tip]");
        if (!btn && tipHost) setTimeout(function () {
          tipHost.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
        }, 120);
      })();
    </script>`;

// шаблон тот же, что у продуктовых страниц: A.html — это home.html, в него buildPage
// подставляет сиды и js/analytics.js
fs.writeFileSync(DIR + "analytics-styleguide.html", A.buildPage(A.html, "Analytics styleguide", inner, "styleguide"));
// Машиночитаемый каталог: тот же источник, поэтому JSON не разъезжается со страницей.
const items = [];
GROUPS.forEach(function (g) {
  g.cards.forEach(function (c) {
    items.push({
      id: c.id || slug(c.name),
      group: g.id,
      groupTitle: g.title,
      name: c.name,
      status: c.status || "live",
      statusLabel: (ST[c.status] || ST.live).t,
      where: c.where || "",
      trigger: c.trigger || "",
      note: c.note ? c.note.replace(/<[^>]+>/g, "") : "",
      strings: c.strings || [],
      prototype: "http://localhost:8778/analytics-styleguide.html?show=" + (c.id || slug(c.name)),
      prod: prodLink(c),
      repro: repro(c)
    });
  });
});
const meta = {
  generated: "build/build-styleguide.js",
  page: "analytics-styleguide.html",
  servers: {
    pro: "http://localhost:8778 — про-план с демо-данными",
    newcomer: "http://localhost:8780 — новичок: Explorer, только sample-коллекции, ни отчётов, ни файлов"
  },
  demoApi: {
    "subsubState(name, state)": "created | sourcing | deep | activated — состояние коллекции",
    "subsubStates()": "состояния всех коллекций",
    "subsubPlan(plan)": "explorer | pro | business | enterprise",
    "subsubFast(true)": "процессы в 10 раз быстрее: канал раз в 1.5с, сбор 3с"
  },
  statuses: Object.keys(ST).map(function (k) { return { id: k, label: ST[k].t }; }),
  deepLink: "analytics-styleguide.html?show=<id> открывает элемент сразу, без ховера и кликов"
};
fs.writeFileSync(DIR + "analytics-styleguide.json", JSON.stringify({ meta: meta, items: items }, null, 2));
const n = items.length;
console.log("written: analytics-styleguide.html + .json (" + GROUPS.length + " групп, " + n + " элементов, " +
  items.reduce(function (a, i) { return a + i.strings.length; }, 0) + " строк)");

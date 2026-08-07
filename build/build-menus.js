const fs = require("fs");
const DIR = "E:/Dev SubSub/subsub_front_prototype_31.07.26/";
const sprite = fs.readFileSync(DIR + "icons-sprite.html", "utf8").trim();
let html = fs.readFileSync(DIR + "home.html", "utf8");

const CHEV = '<svg viewBox="0 0 16 8" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M0.18 0.26C0.45-0.05 0.92-0.09 1.24 0.18L7.75 5.76 14.26 0.18C14.58-0.09 15.05-0.05 15.32 0.26 15.59 0.58 15.55 1.05 15.24 1.32L8.24 7.32C7.96 7.56 7.54 7.56 7.26 7.32L0.26 1.32C-0.05 1.05-0.09 0.58 0.18 0.26Z" fill="currentColor"/></svg>';

function esc(s){ return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function ico(id){ return id ? `<span class="m-ico"><svg><use href="#ic-${id}"></use></svg></span>` : `<span class="m-ico"></span>`; }

// карта «пункт меню → собранная страница прототипа»
const PAGE_URL = {
  "Basic data": "analytics-basic-data.html",
  "Deep data": "analytics-deep-data.html",
  "My collections": "analytics-collections.html",
  "Reports": "analytics-reports.html",
  "Files": "media-library-files.html",
  "Streams": "live-streams.html",
};

function renderItems(items, nested){
  // Все пункты используют сетку [иконка|текст]. У вложенных иконки нет —
  // пустой слот, чтобы текст вставал по тому же левому краю, что и у верхних
  // (как на проде). Доп. отступ добавляется CSS только со 2-го уровня.
  return items.map(it => {
    const iconId = nested ? null : it.ic;
    if (it.group){
      const head = `<span class="m-group__title">${ico(iconId)}${esc(it.group)}</span>`;
      return `<div class="m-group">${head}<div class="m-group__items">${renderItems(it.items, true)}</div></div>`;
    }
    // Собранные страницы прототипа получают реальные ссылки — иначе с Media Library / Live /
    // Home нельзя перейти в Analytics и флоу распадаются. Остальные пункты — заглушки.
    return `<a class="m-item" href="${PAGE_URL[it.t] || "#"}">${ico(iconId)}${esc(it.t)}</a>`;
  }).join("");
}

function block(space, cfg){
  let inner = "";
  if (cfg.pages){
    inner += `<div class="m-section-label">Pages</div>`;
    inner += `<div class="m-switcher"><span class="m-switcher__avatar">Y</span><span class="m-switcher__name">Your page</span>${CHEV}</div>`;
  }
  inner += `<div class="m-list">${renderItems(cfg.items, false)}</div>`;
  if (cfg.create) inner += `<button class="m-create" type="button"><svg class="m-create__ico"><use href="#ic-pencil"></use></svg>Create</button>`;
  if (cfg.bottom) inner += `<a class="m-item m-bottom" href="#">${ico(cfg.bottom.ic)}${esc(cfg.bottom.t)}</a>`;
  if (cfg.starter) inner += `<div class="m-starter"><div class="m-starter__head"><span>Starter guide</span>${CHEV}</div></div>`;
  return `<div class="submenu__menu" data-space="${space}" hidden>${inner}</div>`;
}

const M = {
  analytics: { items:[
    {t:"Overview",ic:"rocket"},
    {group:"Market insights",ic:"chart",items:[{t:"Basic data"},{t:"Deep data"},{t:"Real-time trends"}]},
    {group:"My performance",ic:"chartpie",items:[{t:"Linked channels"},{group:"Data",items:[{t:"By channels"},{t:"By videos"},{t:"By tags"}]},{t:"Tag collections"}]},
    {t:"Reports",ic:"document"},
    {t:"My collections",ic:"collections"},
  ], bottom:{t:"Metrics glossary", ic:"book"} },
  fanfunding: { pages:true, items:[
    {t:"Overview",ic:"rocket"},{t:"Public page",ic:"publicpage"},{t:"Account",ic:"user"},{t:"Support",ic:"donate"},
    {t:"Membership",ic:"membership"},{t:"Audience",ic:"subs"},{t:"Graphic widgets",ic:"widgets"},{t:"Content",ic:"content"},
  ], create:true },
  wallet: { items:[{t:"Balance",ic:"wallet"},{t:"Payment methods",ic:"moneyreceive"}] },
  network: { items:[{t:"Overview",ic:"rocket"}] },
  streams: { items:[{t:"Overview",ic:"rocket"},{t:"Streams",ic:"stream"}] },
  mediaLibrary: { items:[{t:"Overview",ic:"rocket"},{t:"Files",ic:"folder"}] },
  content: { items:[{t:"Overview",ic:"rocket"}] },
  admin: { items:[
    {t:"Prevention",ic:"tfaoff"},{t:"Channels",ic:"widgets"},{t:"MCNs",ic:"youtube"},{t:"Orders",ic:"fileexport"},{t:"Contracts",ic:"created"},{t:"Transactions",ic:"moneyreceive"},
    {group:"Details",ic:"listbulleted",items:[{t:"Charges"},{t:"Shorts"},{t:"YouTube Shop Details"},{t:"AFP"}]},
    {group:"Adjustment",ic:"repair",items:[{t:"Adjustments"},{t:"US Tax"}]},
    {group:"Withdrawals",ic:"moneyreceive",items:[{t:"Withdrawal"},{t:"WCommissions"}]},
    {group:"Transfer finances",ic:"transfer",items:[{t:"Commission"}]},
    {group:"Paid Services",ic:"dollar",items:[{t:"Test Form"},{t:"Products"},{t:"Groups"},{t:"Prices"},{t:"Orders"},{t:"Subscriptions"}]},
    {t:"Users",ic:"user"},{t:"Channel-Manager",ic:"subs"},{t:"Sms",ic:"mail"},
    {group:"Help Center",ic:"alert",items:[{t:"Help Center"},{t:"Categories"},{t:"Questions"}]},
    {t:"Translations",ic:"channelpage"},{t:"Marketing Analytics",ic:"chartpie"},
    {group:"Notification",ic:"notifications",items:[{t:"Notification User"},{t:"Notification System"}]},
    {group:"Prevention",ic:"tfaoff",items:[{t:"Groups"},{t:"Words"}]},
    {group:"Reports",ic:"document",items:[{t:"importScv"},{t:"forAlisa"}]},
    {group:"Statistics",ic:"tax",items:[{t:"locale.statisticsOrder"}]},
    {t:"Index/Follow YouTube Channels",ic:"youtube"},{t:"YT Sourcing"},
    {group:"YouTube Comment",ic:"commentoss",items:[{t:"Credentials"},{t:"Tasks"}]},
    {t:"AdsPower Profiles"},
  ]},
};

// Admin убран из меню (пока). Конфиг M.admin оставлен на случай возврата.
const order = ["analytics","fanfunding","wallet","network","streams","mediaLibrary","content"];
const blocks = order.map(s => block(s, M[s])).join("\n          ");

// --- replace inner content of .submenu__body -------------------------------
const startTag = '<div class="submenu__body">';
const si = html.indexOf(startTag);
if (si === -1) throw new Error("submenu__body not found");
let i = si + startTag.length, depth = 1, endInner = -1;
const re = /<div\b|<\/div>/g; re.lastIndex = i;
let m;
while ((m = re.exec(html))){
  if (m[0] === "</div>"){ depth--; if (depth === 0){ endInner = m.index; break; } }
  else depth++;
}
if (endInner === -1) throw new Error("matching close not found");
html = html.slice(0, si + startTag.length)
     + "\n          <!-- Пункты сняты с прода; иконки по маппингу MenuIcon.vue; ссылки-заглушки href=#. -->\n          "
     + blocks + "\n        " + html.slice(endInner);

// --- inject/replace sprite after <body> ------------------------------------
const spriteWrap = '<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">\n' + sprite + '\n  </svg>';
if (/<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" style="display:none"[\s\S]*?<\/svg>/.test(html)){
  html = html.replace(/<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" style="display:none"[\s\S]*?<\/svg>/, spriteWrap);
} else {
  html = html.replace("<body>", "<body>\n  " + spriteWrap);
}

fs.writeFileSync(DIR + "home.html", html);
console.log("done; use-count:", (html.match(/<use /g)||[]).length, "symbols:", (html.match(/<symbol /g)||[]).length);

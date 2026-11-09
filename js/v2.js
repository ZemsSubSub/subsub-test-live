// Navigation v2 runtime. On every /v2/ page: the Support popover, the Account popover with the workspaces, and the Home count.
// On the v2 pages (main [data-nv-page]): Home, My channels (dashboard.html) and its channel page, Trending now
// and account-channels.html, rendered from window.V2_FIXTURES; the Ideas page is v2-ideas.js, built on V2_KIT.
// Other fixture states open with ?home=…, ?dialog=… and ?admin=1; the state then lives in sessionStorage,
// so it carries over to the other pages.
(function () {
  if (document.body.getAttribute("data-nav") !== "v2") return;
  var UI = window.LVUI || null;
  var F = window.V2_FIXTURES || null;
  var qp = new URLSearchParams(location.search);

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function use(id) { return '<svg><use href="#ic-' + id + '"></use></svg>'; }
  function ss(key, val) {
    try {
      if (val === undefined) return sessionStorage.getItem("v2." + key);
      if (val === null) sessionStorage.removeItem("v2." + key); else sessionStorage.setItem("v2." + key, val);
    } catch (e) {}
    return null;
  }
  function ssList(key) { try { return JSON.parse(ss(key) || "[]"); } catch (e) { return []; } }
  function ssPush(key, v) { var l = ssList(key); if (l.indexOf(v) === -1) l.push(v); ss(key, JSON.stringify(l)); }
  function toast(msg) {
    if (UI) { UI.toast(msg); return; }
    var t = document.querySelector("[data-nv-toast]");
    if (!t) {
      t = document.createElement("div");
      t.className = "an-toast";
      t.setAttribute("data-nv-toast", "");
      t.setAttribute("role", "status");
      document.body.appendChild(t);
    }
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { t.hidden = true; }, 3600);
  }
  function modal(id, title, body, foot, cls) {
    var m = document.getElementById(id);
    if (!m) {
      m = document.createElement("div");
      m.className = "an-modal";
      m.id = id;
      document.body.appendChild(m);
    }
    m.innerHTML = '<div class="an-modal__overlay" data-lv-close data-nv-close></div>' +
      '<div class="an-modal__dialog' + (cls || " an-modal__dialog--sm") + '" role="dialog" aria-modal="true" aria-label="' + esc(title) + '">' +
        '<div class="an-modal__head"><h3 class="an-modal__title">' + esc(title) + "</h3>" +
        '<button class="an-modal__x" type="button" data-lv-close data-nv-close aria-label="Close">' + use("nv-x") + "</button></div>" +
        '<div class="an-modal__body">' + body + "</div>" +
        (foot === null ? "" : '<div class="an-modal__foot">' + foot + "</div>") +
      "</div>";
    if (UI) return UI.openModal(m);
    m.classList.add("is-open");
    return m;
  }
  function closeModals() {
    if (UI) { UI.closeModals(); return; }
    [].slice.call(document.querySelectorAll(".an-modal.is-open")).forEach(function (m) { m.classList.remove("is-open"); });
  }
  var GLOGO = '<svg class="an-btn__glogo" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.19a5.29 5.29 0 0 1-2.3 3.47v2.89h3.72C21.79 18.92 23 15.9 23 12.27z"/><path fill="#34A853" d="M12 24c3.11 0 5.72-1.03 7.63-2.79l-3.72-2.89c-1.03.69-2.35 1.1-3.91 1.1-3 0-5.55-2.03-6.46-4.76H1.69v2.98A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.54 14.66a7.2 7.2 0 0 1 0-4.6V7.08H1.69a12 12 0 0 0 0 10.56l3.85-2.98z"/><path fill="#EA4335" d="M12 4.75c1.69 0 3.21.58 4.4 1.72l3.3-3.3C17.72 1.21 15.11 0 12 0A12 12 0 0 0 1.69 7.08l3.85 2.98C6.45 6.78 9 4.75 12 4.75z"/></svg>';
  function gbtn(label, attrs, size) {
    return '<button class="an-btn an-btn--google an-btn--' + (size || "small") + '" type="button" ' + (attrs || "") + ">" + GLOGO + esc(label) + "</button>";
  }
  function btn(label, mode, attrs, icon, size) {
    return '<button class="an-btn an-btn--' + mode + " an-btn--" + (size || "small") + '" type="button" ' + (attrs || "") + ">" +
      (icon ? use(icon) : "") + esc(label) + "</button>";
  }
  function day(offset) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + offset); return d; }
  function dateLabel(d) { return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
  function ago(offset) {
    if (offset === 0) return "today";
    if (offset === -1) return "yesterday";
    return -offset + " days ago";
  }
  function num(n) { return Number(n).toLocaleString("en-US"); }
  function stat(icon, text) { return '<span class="ml-tag ml-tag--sm ml-tag--pill ml-tag--muted">' + use(icon) + esc(text) + "</span>"; }
  function hm(min) { var h = Math.floor(min / 60), m = min % 60; return (h ? h + "h" : "") + (h && m ? " " : "") + (m || !h ? m + "m" : ""); }
  function compact(n) { return n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M" : n >= 1e4 ? (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K" : num(n); }
  function money(n) { return "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  // =========================================================== sidebar: collapse, groups, admin, popovers
  function collapsed() { return document.body.classList.contains("nv-collapsed"); }
  function syncCollapsed(on) {
    document.body.classList.toggle("nv-collapsed", on);
    [].slice.call(document.querySelectorAll(".nv-side .nv-item")).forEach(function (el) {
      var l = el.querySelector(".nv-item__l");
      if (on && l) el.setAttribute("title", l.textContent); else el.removeAttribute("title");
    });
    var c = document.querySelector("[data-nv-collapse]");
    if (c) c.setAttribute("aria-label", on ? "Expand sidebar" : "Collapse sidebar");
  }
  try { syncCollapsed(localStorage.getItem("nv_collapsed") === "1"); } catch (e) { syncCollapsed(false); }
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t.closest) return;
    if (t.closest("[data-nv-collapse]")) {
      var on = !collapsed();
      try { localStorage.setItem("nv_collapsed", on ? "1" : "0"); } catch (err) {}
      syncCollapsed(on);
      return;
    }
    var tg = t.closest("[data-nv-toggle]");
    if (tg) {
      var grp = tg.closest("[data-nv-grp]");
      if (collapsed()) { if (grp.getAttribute("data-nv-first")) location.href = grp.getAttribute("data-nv-first"); return; }
      var open = !grp.classList.contains("is-open");
      grp.classList.toggle("is-open", open);
      tg.setAttribute("aria-expanded", String(open));
    }
  });

  if (qp.get("admin")) ss("nv_admin", qp.get("admin") === "1" ? "1" : null);
  function syncAdmin() {
    [].slice.call(document.querySelectorAll("[data-nv-admin]")).forEach(function (el) { el.hidden = ss("nv_admin") !== "1"; });
  }
  syncAdmin();

  var ORG = F ? F.org : { name: "GenTech Studio", slug: "gentech-studio", role: "Manager" };
  var ME = F ? F.user : { name: "Yevhenii Zemskov", initials: "YZ", email: "zemskov@gen.tech" };
  var inOrg = qp.get("ws") === "org";
  function wsUrl(ws) {
    var p = new URLSearchParams(location.search);
    p.delete("role");
    if (ws === "org") p.set("ws", "org"); else p.delete("ws");
    var q = p.toString();
    return location.pathname + (q ? "?" + q : "") + location.hash;
  }

  var popAnchor = null;
  function popEl() {
    var p = document.querySelector("[data-nv-pop]");
    if (!p) {
      p = document.createElement("div");
      p.setAttribute("data-nv-pop", "");
      p.setAttribute("role", "dialog");
      p.hidden = true;
      document.body.appendChild(p);
    }
    p.className = "lv-pop lv-acct nv-pop";
    return p;
  }
  function popClose() {
    var p = document.querySelector("[data-nv-pop]");
    if (p) p.hidden = true;
    if (popAnchor) popAnchor.setAttribute("aria-expanded", "false");
    popAnchor = null;
  }
  function popOpen(anchor, html, label) {
    if (popAnchor === anchor) { popClose(); return; }
    popClose();
    var p = popEl();
    p.setAttribute("aria-label", label);
    p.innerHTML = html;
    p.hidden = false;
    popAnchor = anchor;
    anchor.setAttribute("aria-expanded", "true");
    var r = anchor.getBoundingClientRect(), w = p.offsetWidth, h = p.offsetHeight, left, top;
    if (anchor.closest(".header")) {
      left = Math.max(12, r.right - w);
      top = r.bottom + 8;
    } else {
      left = document.querySelector(".nv-side").getBoundingClientRect().right + 8;
      top = Math.max(12, Math.min(r.top, window.innerHeight - h - 12));
    }
    p.style.left = Math.round(left) + "px";
    p.style.top = Math.round(top + window.scrollY) + "px";
  }
  function wsPopHtml() {
    var chk = '<span class="lv-acct__chk">' + use("nv-check") + "</span>";
    return '<div class="lv-acct__h"><span>Workspaces</span><a class="lv-acct__how" href="#" data-track="action-ws-howto-open source-account-menu">How it works?</a></div>' +
      '<div class="lv-acct__ws-list">' +
        '<div class="lv-acct__wsrow' + (inOrg ? "" : " is-active") + '">' +
          '<a class="lv-acct__ws" href="' + esc(wsUrl("personal")) + '" data-track="action-org-context-switch source-account-menu target-personal">' +
            '<span class="lv-acct__ava lv-acct__ava--sm">' + use("nv-user") + "</span>" +
            '<span class="lv-acct__meta"><span class="lv-acct__wsn">' + esc(ME.name) + '</span><span class="lv-acct__sub">Personal</span></span>' + (inOrg ? "" : chk) + "</a></div>" +
        '<div class="lv-acct__wsrow' + (inOrg ? " is-active" : "") + '">' +
          '<a class="lv-acct__ws" href="' + esc(wsUrl("org")) + '" data-track="action-org-context-switch source-account-menu target-org">' +
            '<span class="lv-acct__ava lv-acct__ava--sm lv-acct__ava--org">' + esc(ORG.name.charAt(0)) + "</span>" +
            '<span class="lv-acct__meta"><span class="lv-acct__wsn">' + esc(ORG.name) + '</span><span class="lv-acct__sub">' + esc(ORG.role) + "</span></span>" + (inOrg ? chk : "") + "</a>" +
          (inOrg ? '<a class="lv-acct__gear" href="org-settings.html?ws=org&amp;slug=' + esc(ORG.slug) + '" aria-label="Organization settings" data-track="action-org-settings-open source-account-menu">' + use("nv-gear") + "</a>" : "") +
        "</div>" +
        '<a class="lv-acct__create" href="#" data-track="action-org-create-open source-account-menu">' + use("nv-plus") + "Create organization</a>" +
      "</div>";
  }
  function acctPopHtml() {
    var item = function (icon, label, id, href, extra, cls) {
      return '<a class="lv-acct__item' + (cls || "") + '" href="' + href + '" data-track="action-menu-item-open item-' + id + ' source-account-menu">' +
        use(icon) + "<span>" + label + "</span>" + (extra || "") + "</a>";
    };
    return '<div class="lv-acct__me"><span class="lv-acct__ava nv-foot__ava">' + esc(ME.initials) + "</span>" +
        '<span class="lv-acct__meta"><span class="lv-acct__name">' + esc(ME.name) + '</span><span class="lv-acct__sub">' + esc(ME.email) + "</span></span></div>" +
      wsPopHtml() +
      '<div class="lv-acct__list">' +
        item("nv-user", "Profile", "profile", "#") +
        item("nv-building", "Organization", "organization", "org-settings.html?ws=org&amp;slug=" + esc(ORG.slug)) +
        item("nv-monitor", "Install app", "install_app", "#", '<span class="ml-tag ml-tag--sm ml-tag--pill ml-tag--brand nv-acct__new">New</span>') +
      "</div>" +
      '<div class="lv-acct__foot">' + item("nv-logout", "Log out", "logout", "#", "", " lv-acct__item--danger") + "</div>";
  }
  function helpPopHtml() {
    return '<div class="lv-acct__list">' +
      '<a class="lv-acct__item" href="#" data-track="action-starter-guide-open source-help">' + use("nv-guide") + "<span>Starter guide</span></a>" +
      '<button class="lv-acct__item" type="button" data-nv-video data-track="action-product-video-open source-help">' + use("nv-play") + "<span>Product overview video</span></button>" +
      "</div>";
  }
  function videoModal() {
    modal("nvVideo", "SubSub in two minutes",
      '<div class="nv-video">' + use("nv-play") + "</div>" +
      '<p class="an-modal__text">A short tour of the products: analytics and ideas, Live, Media Library and your earnings.</p>', null, " an-modal__dialog--lg");
  }

  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t.closest) return;
    var acct = t.closest("[data-nv-acct]"), help = t.closest("[data-nv-help]");
    if (acct) { popOpen(acct, acctPopHtml(), "Account"); return; }
    if (help) { popOpen(help, helpPopHtml(), "Support"); return; }
    if (t.closest("[data-nv-video]")) { popClose(); videoModal(); return; }
    if (popAnchor && !t.closest("[data-nv-pop]")) popClose();
    if (!UI && t.closest("[data-nv-close]")) closeModals();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    popClose();
    if (!UI) closeModals();
  });

  // =========================================================== ideas run: finishes on any /v2/ page
  // A run started in this session lives in sessionStorage. When it ends away from the Ideas page,
  // the Ideas item in the sidebar gets a dot.
  var GEN_MS = 2600, GEN_STAGES = 3;
  var onGenDone = null;
  function genRun() { try { return JSON.parse(ss("nv_gen") || "null"); } catch (e) { return null; } }
  function onIdeasPage() { return !!document.querySelector('[data-nv-page="ideas"]'); }
  function genTick() {
    var run = genRun();
    if (!run || Date.now() - run.at < GEN_MS * GEN_STAGES) return run;
    ss("nv_gen", null);
    ss("nv_updated_" + run.ch, "0");
    ss("nv_new", JSON.stringify(run.ideas || []));
    if (!onIdeasPage()) ss("nv_ready", run.name);
    if (onGenDone) onGenDone();
    readySync();
    return null;
  }
  function readySync() {
    if (onIdeasPage()) ss("nv_ready", null);
    var name = ss("nv_ready");
    [].slice.call(document.querySelectorAll('.nv-side a[href="analytics-ideas.html"]')).forEach(function (el) {
      var dot = el.querySelector(".nv-dot");
      if (name && !dot) {
        dot = document.createElement("span");
        dot.className = "nv-dot";
        dot.setAttribute("aria-label", "New ideas");
        el.insertBefore(dot, el.querySelector(".nv-item__chev"));
      } else if (!name && dot) dot.remove();
    });
  }
  readySync();
  setInterval(genTick, 1000);

  // =========================================================== v2 pages
  if (!F) return;
  var host = document.querySelector("[data-nv-page]");
  var PAGE = host ? host.getAttribute("data-nv-page") : null;

  var DLG = PAGE !== "ideas" && F.dialogStates[qp.get("dialog")] ? qp.get("dialog") : null;
  if (qp.get("home") && F.states[qp.get("home")]) {
    ss("nv_home", qp.get("home"));
    ["nv_upgraded", "nv_removed", "nv_gen", "nv_new", "nv_ready", "nv_liked", "nv_hidden", "nv_reasons", "nv_dismissed", "nv_made", "nv_made_at", "nv_seen"].forEach(function (k) { ss(k, null); });
    Object.keys(F.channels).forEach(function (id) { ss("nv_updated_" + id, null); });
    var preset = F.states[qp.get("home")];
    if (preset.dismissed) ss("nv_dismissed", JSON.stringify(preset.dismissed));
    if (preset.hidden) ss("nv_hidden", JSON.stringify(preset.hidden));
  }
  if (DLG === "saved") ss("nv_similar_zems", JSON.stringify(F.channels.zems.savedSimilar));
  if (DLG === "running" && PAGE === "home") ss("nv_home", "generating");
  if (qp.get("channel") && PAGE === "dashboard") { try { localStorage.setItem("nv_dash_channel", qp.get("channel")); } catch (e) {} }
  var OWN_QP = PAGE === "ideas" ? ["home", "admin"] : ["home", "channel", "admin", "dialog"];
  if (OWN_QP.some(function (k) { return qp.has(k); })) {
    OWN_QP.forEach(function (k) { qp.delete(k); });
    history.replaceState(null, "", location.pathname + (qp.toString() ? "?" + qp.toString() : "") + location.hash);
  }

  function homeState() { var s = ss("nv_home"); return F.states[s] ? s : "multi"; }
  function conn(c) { return ssList("nv_upgraded").indexOf(c.id) !== -1 ? "oauth" : c.conn; }
  function channels() {
    var gone = ssList("nv_removed");
    return F.states[homeState()].channels.filter(function (id) { return gone.indexOf(id) === -1; })
      .map(function (id) { return F.channels[id]; });
  }
  function channel(id) { return F.channels[id] || null; }
  function connLabel(c) { return conn(c) === "oauth" ? "OAuth" : "Link"; }
  function connTag(c) {
    return conn(c) === "oauth" ? '<span class="ml-tag ml-tag--sm ml-tag--pill ml-tag--ok">OAuth</span>'
      : '<span class="ml-tag ml-tag--sm ml-tag--pill ml-tag--muted">Link</span>';
  }
  function ava(c) { return '<span class="an-chan__ava" style="background:' + c.color + '">' + esc(c.initial) + "</span>"; }
  function chanLabel(c) { return '<span class="an-chan__left nv-idea__chan">' + ava(c) + '<span class="an-chan__name">' + esc(c.name) + "</span></span>"; }

  // generation: a fixture state or a run started in this session; the stage advances with time
  function generation() {
    var hs = F.states[homeState()];
    if (PAGE === "home" && hs.generating) return { ch: hs.generating, stage: hs.first ? 0 : 1, first: !!hs.first, fixed: true };
    var run = genTick();
    if (!run) return null;
    return { ch: run.ch, stage: Math.min(GEN_STAGES - 1, Math.floor((Date.now() - run.at) / GEN_MS)), first: !!run.first };
  }
  function startGeneration(ch) {
    var hs = F.states[homeState()], first = !!(hs.first || hs.noIdeas);
    if (PAGE === "home" && hs.generating) ss("nv_home", "oauth");
    ss("nv_gen", JSON.stringify({
      ch: ch, name: channel(ch).name, at: Date.now(), first: first,
      ideas: F.ideas.filter(function (i) { return i.channel === ch; }).map(function (i) { return i.id; })
    }));
    ss("nv_ready", null);
    ss("nv_new", null);
    render();
  }
  var genKey = "";
  setInterval(function () {
    var g = generation(), k = g ? g.ch + g.stage : "";
    if (k === genKey) return;
    genKey = k;
    if (!document.querySelector(".an-modal.is-open") && !document.querySelector("[data-lv-selpop]:not([hidden])")) render();
    else if (document.getElementById("nvGenerate") && document.getElementById("nvGenerate").classList.contains("is-open")) genRender();
  }, 1000);
  onGenDone = function () { genKey = "done"; };
  function genRowHtml(gen, failed) {
    var name = channel(gen.ch).name, stage = F.generation.stages[gen.stage];
    if (failed) {
      return '<div class="nv-genrow nv-genrow--error" role="alert">' + use("nv-alert") +
        '<span class="nv-genrow__tx">Couldn’t finish at “' + esc(stage) + "”</span>" +
        btn("Try again", "secondary", 'data-nv-retry="' + gen.ch + '" data-track="action-ideas-retry source-ideas-status"', null, "tiny") + "</div>";
    }
    return '<div class="nv-genrow" role="status"><span class="an-blank__spin" aria-hidden="true"></span>' +
      '<span class="nv-genrow__tx">' + (gen.stage === 0 ? "Analyzing " + esc(name) : esc(stage.charAt(0).toUpperCase() + stage.slice(1)) + " for " + esc(name)) + "</span>" +
      '<span class="nv-genrow__eta">About ' + (gen.stage < 2 ? 2 : 1) + " min</span></div>";
  }
  function skelCards(n) {
    var card = '<div class="nv-idea nv-idea--skel" aria-hidden="true"><span class="lv-skel nv-skel--tag"></span>' +
      '<span class="lv-skel nv-skel--title"></span><span class="lv-skel"></span><span class="lv-skel nv-skel--short"></span></div>';
    return new Array(n + 1).join(card);
  }
  function updatedOffset(c) {
    var s = ss("nv_updated_" + c.id);
    if (s !== null) return Number(s);
    if (PAGE === "home" && F.states[homeState()].staleIdeas && c.updated != null) return -12;
    return c.updated;
  }
  function runsLeftN() { return Math.max(0, F.generation.runsLeft - Number(ss("nv_runs_used") || 0)); }
  function runsHtml() {
    var n = runsLeftN();
    return '<span class="nv-runs" tabindex="0" data-tip="Free during beta">' + (n ? UI.plural(n, "run", "runs") + " left this month" : "No runs left this month") + "</span>";
  }

  // ---- ideas data and feedback
  var JUST = {}, MORE = {};
  function likedList() { return ssList("nv_liked"); }
  function hiddenList() { return ssList("nv_hidden"); }
  function reasons() { try { return JSON.parse(ss("nv_reasons") || "{}"); } catch (e) { return {}; } }
  function ssDrop(key, v) { ss(key, JSON.stringify(ssList(key).filter(function (x) { return x !== v; }))); }
  function ideasFor(ids) {
    var run = genRun();
    return F.ideas.filter(function (i) {
      if (ids.indexOf(i.channel) === -1) return false;
      return !(run && run.first && run.ch === i.channel);
    });
  }
  function ideaById(id) { return F.ideas.filter(function (i) { return i.id === id; })[0] || null; }
  function formatTag(i) {
    return '<span class="ml-tag ml-tag--sm ml-tag--pill ml-tag--muted">' + (i.format === "short" ? "Short" : "Video") + "</span>";
  }
  function whyHtml(i, key, label, text) {
    var id = i.id + "-" + key, open = !!MORE[id];
    return '<div class="nv-why"><p class="nv-why__k">' + label + "</p>" +
      '<p class="nv-why__v nv-clamp' + (open ? " is-open" : "") + '" data-nv-clamp="' + id + '">' + esc(text) + "</p>" +
      '<button class="nv-more" type="button" data-nv-more="' + id + '" aria-expanded="' + open + '" hidden data-track="action-idea-more-toggle kind-' + key + '">' + (open ? "Less" : "More") + "</button></div>";
  }
  function iconBtn(icon, label, attrs, cls) {
    return '<button class="mc-more ' + cls + '" type="button" aria-label="' + label + '" data-tip="' + label + '" ' + attrs + ">" + use(icon) + "</button>";
  }
  function hiddenCard(i) {
    var r = reasons()[i.id];
    return '<article class="nv-idea nv-idea--hidden" id="idea-' + i.id + '">' +
      '<div class="nv-hid"><span class="nv-hid__t">Hidden</span><span class="nv-hid__name">' + esc(i.title) + "</span></div>" +
      '<div class="nv-chips" role="group" aria-label="Reason">' + F.dislikeReasons.map(function (x) {
        var on = r === x, slug = x.toLowerCase().replace(/[^a-z]+/g, "-");
        return '<button class="nv-chip' + (on ? " is-on" : "") + '" type="button" aria-pressed="' + on + '" data-nv-reason="' + i.id + '" data-nv-reason-v="' + esc(x) +
          '" data-track="field-idea-dislike-reason kind-' + slug + '">' + esc(x) + "</button>";
      }).join("") + "</div></article>";
  }

  // More toggles only where the text is clamped
  function applyLayout() {
    [].slice.call(document.querySelectorAll("[data-nv-clamp]")).forEach(function (el) {
      var b = el.parentNode.querySelector("[data-nv-more]");
      if (!b) return;
      b.hidden = !el.classList.contains("is-open") && el.scrollHeight <= el.clientHeight + 1;
    });
    observeNew();
  }
  var newObs = null;
  function observeNew() {
    if (!window.IntersectionObserver) return;
    if (newObs) newObs.disconnect();
    newObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var el = en.target;
        if (en.isIntersecting) { el.setAttribute("data-nv-seen", ""); return; }
        if (!el.hasAttribute("data-nv-seen") || en.boundingClientRect.bottom > 0) return;
        ssDrop("nv_new", el.getAttribute("data-nv-new"));
        el.removeAttribute("data-nv-new");
        var tag = el.querySelector("[data-nv-newtag]");
        if (tag) tag.remove();
        newObs.unobserve(el);
      });
    });
    [].slice.call(document.querySelectorAll("[data-nv-new]")).forEach(function (el) { newObs.observe(el); });
  }
  // a rail taller than the window sticks by its bottom edge, so its last card stays reachable with one page scroll
  function railFit() {
    var r = document.querySelector(".nv-home__rail");
    if (!r) return;
    var head = parseFloat(getComputedStyle(document.body).getPropertyValue("--header-height")) || 56;
    var top = head + 24, h = r.offsetHeight;
    r.style.top = (top + h + 24 > window.innerHeight ? window.innerHeight - h - 24 : top) + "px";
  }
  window.addEventListener("resize", function () { applyLayout(); railFit(); });
  var railObs = window.ResizeObserver ? new ResizeObserver(railFit) : null;
  window.addEventListener("pagehide", function () { if (PAGE === "ideas") ss("nv_new", null); });

  // =========================================================== shared: period, metrics, sparklines
  function period() { return ss("nv_period") === "d28" ? "d28" : "d7"; }
  function periodWords() { return period() === "d28" ? "the last 28 days" : "the last 7 days"; }
  function periodTabs(source) {
    var per = period();
    return '<div class="an-tabs an-tabs--head" role="tablist" aria-label="Period">' + [["d7", "7 days"], ["d28", "28 days"]].map(function (p) {
      return '<button class="an-tab' + (p[0] === per ? " is-active" : "") + '" type="button" role="tab" aria-selected="' + (p[0] === per) + '" data-nv-period="' + p[0] +
        '" data-track="action-dashboard-period kind-' + p[0].slice(1) + "d source-" + source + '">' + p[1] + "</button>";
    }).join("") + "</div>";
  }
  function pct(cur, prev) { return prev ? (cur - prev) / Math.abs(prev) * 100 : null; }
  function pctText(p) { return (p >= 0 ? "+" : "−") + Math.abs(p).toFixed(1) + "%"; }
  function delta(cur, prev, vsLabel) {
    var vs = "<span>" + (vsLabel || "vs previous period") + "</span>", p = pct(cur, prev);
    if (p == null) return '<span class="wl-delta">—</span>' + vs;
    var up = p >= 0, txt = (up ? "+" : "") + (Math.abs(p) >= 100 ? Math.round(p) : p.toFixed(1).replace(/\.0$/, "")) + "%";
    return '<span class="wl-delta ' + (up ? "wl-delta--up" : "wl-delta--down") + '">' + use(up ? "nv-up" : "nv-down") + txt + "</span>" + vs;
  }
  function sparkline(pts) {
    if (!pts || pts.length < 2) return '<span class="nv-spark" aria-hidden="true"></span>';
    var min = Math.min.apply(null, pts), max = Math.max.apply(null, pts), span = max - min || 1;
    var d = pts.map(function (v, n) {
      var x = n / (pts.length - 1) * 120, y = 36 - (v - min) / span * 32;
      return (n ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
    }).join(" ");
    return '<svg class="nv-spark" viewBox="0 0 120 40" preserveAspectRatio="none" aria-hidden="true">' +
      '<path d="' + d + '" fill="none" vector-effect="non-scaling-stroke" /></svg>';
  }
  function metric(label, value, dyn, pts, sim) {
    return '<div class="nv-met"><span class="nv-met__lbl">' + label + '</span><div class="nv-met__row"><b class="nv-met__v">' + value + "</b>" + sparkline(pts) + "</div>" +
      '<span class="wl-dyn">' + dyn + "</span>" + (sim || "") + "</div>";
  }
  // median change of the channel's reference set; trails by more than 5 points → warning colour
  function simLine(c, key, own) {
    var med = c.similar[period()][key], trail = own != null && own < med - 5;
    return '<span class="nv-met__sim' + (trail ? " is-trail" : "") + '">Similar channels: ' + pctText(med) + "</span>";
  }
  function duration(sec) { sec = Math.round(sec); return Math.floor(sec / 60) + ":" + ("0" + sec % 60).slice(-2); }
  function hours(h) { return (h >= 1e4 ? compact(h) : h < 10 ? String(Math.round(h * 10) / 10) : num(Math.round(h))) + " h"; }
  function chanChip(c) { return '<span class="an-chan__left nv-chan">' + ava(c) + '<span class="an-chan__name">' + esc(c.name) + "</span></span>"; }
  function channelMets(c, full) {
    var per = period(), s = c.summary[per], d = c.deep[per], oauth = conn(c) === "oauth";
    var sim = function (k, v) { return full ? simLine(c, k, v ? pct(v[0], v[1]) : null) : ""; };
    var out = metric("New subscribers", (s.subs[0] >= 0 ? "+" : "") + num(s.subs[0]), delta(s.subs[0], s.subs[1]), s.spark.subs, sim("subs", s.subs)) +
      metric("Views", compact(s.views[0]), delta(s.views[0], s.views[1]), s.spark.views, sim("views", s.views)) +
      (oauth ? metric("Estimated revenue", money(s.revenue[0]), delta(s.revenue[0], s.revenue[1]), s.spark.revenue, sim("revenue", s.revenue))
        : metric("Estimated revenue", "—", '<span class="nv-met__hint">Connect with Google to see revenue</span>', null, sim("revenue", null)));
    var six = full && oauth;
    if (six) {
      out += metric("Watch time", hours(d.watch[0]), delta(d.watch[0], d.watch[1]), d.spark.watch, sim("watch", d.watch)) +
        metric("Average view duration", duration(d.avd[0]), delta(d.avd[0], d.avd[1]), d.spark.avd, sim("avd", d.avd)) +
        metric("Returning viewers", d.returning[0].toFixed(1).replace(/\.0$/, "") + "%", delta(d.returning[0], d.returning[1]), d.spark.returning, sim("returning", d.returning));
    }
    return '<div class="nv-mets' + (six ? " nv-mets--6" : "") + '">' + out + "</div>" + (oauth ? "" : connectInline(c));
  }
  function connectInline(c) {
    return '<div class="nv-conninl"><p class="nv-conninl__tx">Revenue, watch time and retention appear once ' + esc(c.name) + " is connected with Google.</p>" +
      gbtn("Connect with Google", 'data-nv-google="' + c.id + '" data-track="action-channel-connect-google source-dashboard-channel"', "small") + "</div>";
  }
  function connectBlock(tag, source) {
    return '<section class="an-blank nv-hempty"><span class="an-blank__ico">' + use("nv-channels") + "</span>" +
      "<" + tag + ' class="an-blank__title">Connect your YouTube channel</' + tag + ">" +
      '<p class="an-blank__text">See your performance, get content ideas and go live from one place.</p>' +
      gbtn("Connect with Google", 'data-nv-google="new" data-track="action-channel-connect-google source-' + source + '"') + "</section>";
  }
  function account() {
    var k = PAGE === "home" && F.accounts[qp.get("account")] ? qp.get("account") : "default";
    return Object.assign({ key: k }, F.accounts[k]);
  }
  function walletBalance() {
    var a = account();
    if (a.key !== "default") return a.balance;
    try {
      var st = JSON.parse(localStorage.getItem("subsub_wallet_state") || "null");
      if (st && st.v === 2 && typeof st.balance === "number") return st.balance;
    } catch (e) {}
    return a.balance;
  }
  function runwayDays() {
    var spend = account().avgDailySpend7d;
    return spend > 0 ? Math.max(walletBalance(), 0) / spend : null;
  }
  function balanceLow() { var d = runwayDays(); return walletBalance() <= 0 || (d != null && d < 3); }
  function canTopUp() { return account().role !== "user"; }
  var TOP_UP = "wallet.html?topup=1";
  function syncBalanceChip() {
    var chip = document.querySelector(".balance-chip span");
    if (chip) chip.textContent = money(walletBalance());
  }

  // =========================================================== idea card actions: Save, Not relevant
  function saveBtns(i, saved, track) {
    return iconBtn(saved ? "nv-bookmark-on" : "nv-bookmark", "Save", 'aria-pressed="' + saved + '" data-nv-like="' + i.id + '" data-track="action-idea-' + (saved ? "unsave" : "save") + " " + track + '"', "nv-act" + (saved ? " is-on" : "")) +
      iconBtn("nv-dislike", "Not relevant", 'data-nv-dislike="' + i.id + '" data-track="action-idea-dislike ' + track + '"', "nv-act");
  }
  function roundRobin(list) {
    var by = {}, order = [], out = [], k = 0;
    list.forEach(function (i) { if (!by[i.channel]) { by[i.channel] = []; order.push(i.channel); } by[i.channel].push(i); });
    while (out.length < list.length) {
      order.forEach(function (ch) { if (by[ch][k]) out.push(by[ch][k]); });
      k++;
    }
    return out;
  }

  // =========================================================== Home: the inbox
  // Every item outside the earnings strip has an id; dismissed ids never come back.
  // The sidebar count covers what needs action: Needs attention rows and status outcomes not seen yet.
  function hs() { return F.states[homeState()]; }
  function isOpen(id) { return !hs().caught && ssList("nv_dismissed").indexOf(id) === -1; }
  function connected(id) { return channels().some(function (c) { return c.id === id; }); }
  function richIds() { return channels().filter(function (c) { return !c.small; }).map(function (c) { return c.id; }); }
  function trendById(id) { return F.trends.filter(function (t) { return t.id === id; })[0] || null; }
  function accountAttention() {
    var out = [], d = runwayDays();
    if (walletBalance() <= 0) out.push({ id: "attention-balance-out", kind: "balance-out", title: "Balance ran out", text: "Your streams have stopped.", cta: "Top up", href: TOP_UP, topUp: true });
    else if (d != null && d < 3) {
      out.push({ id: "attention-balance-low", kind: "balance-low", title: "Balance runs out in " + (d < 1 ? "less than a day" : "about " + UI.plural(Math.floor(d), "day", "days")),
        text: "Streams stop when the balance reaches $0.", cta: "Top up", href: TOP_UP, topUp: true });
    }
    account().streams.filter(function (s) { return s.status === "down"; }).forEach(function (s) {
      out.push({ id: "attention-down-" + s.id, kind: "stream-down", title: "“" + s.name + "” is down", text: "Off air since " + s.offAirSince + ".", cta: "Open stream", href: "live-stream.html?id=" + s.id });
    });
    return out.filter(function (a) { return isOpen(a.id); });
  }
  function attentionItems() {
    return accountAttention().concat((qp.get("account") ? [] : hs().attention || []).map(function (k) { return Object.assign({ id: "attention-" + k }, F.attention[k]); })
      .filter(function (a) { return (!a.channel || connected(a.channel)) && isOpen(a.id); }));
  }
  function madeList() { return ssList("nv_made").map(function (x) { var p = x.split(":"); return { trend: p[0], ch: p[1] }; }); }
  function trendTargets(t) { return channels().filter(function (c) { return !c.small && t.ideas[c.id]; }); }
  function trendMatches(t) { return trendTargets(t).filter(function (c) { return c.niches.indexOf(t.niche) !== -1; }); }
  function trendItems() {
    var made = madeList().map(function (m) { return m.trend; });
    return F.trends.filter(function (t) { return trendTargets(t).length && made.indexOf(t.id) === -1 && isOpen(t.id); });
  }
  function ideasMode() {
    var gen = generation(), rich = richIds();
    if (gen && gen.first && rich.indexOf(gen.ch) !== -1) return "skel";
    if (hs().noIdeas && !ss("nv_updated_" + hs().channels[0])) return "none";
    if (!rich.length) return "small";
    return "list";
  }
  function homeIdeas() {
    if (ideasMode() !== "list" || hs().caught) return [];
    var rich = richIds(), gone = hiddenList();
    var fromTrends = madeList().map(function (m) { var t = trendById(m.trend); return t && ideaById(t.ideas[m.ch]); })
      .filter(function (i) { return i && rich.indexOf(i.channel) !== -1; }).reverse();
    var base = roundRobin(ideasFor(rich).filter(function (i) { return i.kind === "proven"; })).slice(0, 4);
    return fromTrends.concat(base).filter(function (i) { return gone.indexOf(i.id) === -1; });
  }
  function insightItems() {
    var by = channels().map(function (c) { return c.signals.map(function (s) { return { id: "insight-" + c.id + "-" + s.kind, c: c, s: s }; }); }), list = [], k = 0;
    while (by.some(function (l) { return l[k]; })) { by.forEach(function (l) { if (l[k]) list.push(l[k]); }); k++; }
    return list.slice(0, 2).filter(function (x) { return isOpen(x.id); });
  }
  function nowItems() {
    var streams = account().streams;
    return F.now.filter(function (n) {
      var onAir = !n.stream || streams.some(function (s) { return s.name === n.stream && s.status === "live"; });
      return n.kind === "live" && onAir && connected(n.channel) && !hs().caught;
    });
  }
  function statusItems() {
    if (hs().caught || !channels().length) return [];
    var res = hs().resolved || {};
    return F.statuses.map(function (s) {
      var out = res[s.id];
      return out ? { id: s.id + "-" + out, s: s, o: s.outcomes[out] } : { id: s.id, s: s, o: null };
    }).filter(function (x) { return !x.o || isOpen(x.id); });
  }
  function unseenStatuses() {
    var seen = ssList("nv_seen");
    return statusItems().filter(function (x) { return x.o && seen.indexOf(x.id) === -1; });
  }
  function suggestItems() {
    var one = channels().length === 1, ff = account().fanFunding;
    return F.suggestions.filter(function (s) {
      if (s.ffNoPage && ff.hasPage) return false;
      if (s.ffNoMemberships && (!ff.hasPage || ff.memberships)) return false;
      return (!s.single || one) && isOpen(s.id);
    });
  }
  function connectItems() {
    return channels().filter(function (c) { return conn(c) !== "oauth" && isOpen("connect-" + c.id); });
  }
  function inboxCount() { return channels().length ? attentionItems().length + unseenStatuses().length : 0; }
  function homeBadge() {
    var link = document.querySelector('.nv-side a.nv-item[href="home.html"]');
    if (!link) return;
    var n = inboxCount(), b = link.querySelector("[data-nv-count]");
    if (!n) { if (b) b.remove(); return; }
    if (!b) {
      b = document.createElement("span");
      b.className = "ml-tag ml-tag--sm ml-tag--pill ml-tag--brand nv-new nv-count";
      b.setAttribute("data-nv-count", "");
      link.appendChild(b);
    }
    b.innerHTML = n + '<span class="sr-only"> ' + (n === 1 ? "item needs" : "items need") + " action</span>";
  }
  window.addEventListener("pagehide", function () {
    if (PAGE !== "home") return;
    unseenStatuses().forEach(function (x) { ssPush("nv_seen", x.id); });
  });
  function dismissBtn(id, kind) {
    return iconBtn("nv-x", "Dismiss", 'data-nv-dismiss="' + id + '" data-track="action-home-item-dismiss kind-' + kind + '"', "nv-dis");
  }
  function secHead(id, title, extra, right) {
    return '<div class="nv-hsec__h"><div class="nv-hsec__l"><h2 class="nv-hsec__t" id="' + id + '">' + title + "</h2>" + (extra || "") + "</div>" + (right || "") + "</div>";
  }

  var OWNER_ONLY = ' type="button" aria-disabled="true" data-tip="Ask an owner to top up">Top up</button>';
  function topUpAct() { return canTopUp() ? '<a class="nv-earn__act" href="' + TOP_UP + '">Top up</a>' : '<button class="nv-earn__act is-off"' + OWNER_ONLY; }
  function runwayHtml() {
    var d = runwayDays(), out = walletBalance() <= 0;
    if (d == null && !out) return "";
    var text = out ? "Balance ran out" : d < 1 ? "Less than a day left" : "About " + UI.plural(Math.floor(d), "day", "days") + " left";
    return balanceLow() ? '<span class="ml-tag ml-tag--sm ml-tag--pill ml-tag--warn">' + text + "</span>" : "<span>" + text + "</span>";
  }
  function tile(label, value, sub, act, mod) {
    return '<div class="nv-earn__c"><div class="nv-earn__h"><span class="nv-met__lbl">' + label + "</span>" + (act || "") + "</div>" +
      '<b class="nv-met__v' + (mod ? " " + mod : "") + '">' + value + "</b>" +
      (sub ? '<span class="wl-dyn">' + sub + "</span>" : "") + "</div>";
  }
  function balanceTile() { return tile("Balance", money(walletBalance()), runwayHtml(), topUpAct()); }
  function liveTile() {
    var list = account().streams;
    if (!list.length) return "";
    var on = list.filter(function (s) { return s.status === "live"; }), watching = 0;
    on.forEach(function (s) { watching += s.viewersNow || 0; });
    return tile("Live 24/7", on.length + " of " + list.length + " on air", stat("nv-eye", num(watching) + " watching now"),
      '<a class="nv-earn__act" href="live-streams.html">Open streams</a>', on.length < list.length ? "nv-met__v--bad" : "");
  }
  function donationsTile() {
    var ff = account().fanFunding, label = "Donations in the last 7 days";
    if (!ff.hasPage) return "";
    if (!ff.everReceived) return tile(label, "No donations yet", '<button class="nv-earn__act" type="button" data-nv-ffshare>Share your donation link</button>', "", "nv-earn__vt");
    if (ff.donations7d > 0) return tile(label, money(ff.donations7d), delta(ff.donations7d, ff.donationsPrev7d, "vs previous 7 days"));
    return tile(label, "$0", "<span>Last donation " + UI.plural(ff.lastDonationAt, "day", "days") + " ago</span>");
  }
  function earnStrip() {
    var tiles = [balanceTile(), liveTile(), donationsTile()].filter(Boolean);
    if (tiles.length < 2) return "";
    return '<section class="rp-card nv-earnw" aria-label="Balance and products"><div class="nv-earn">' + tiles.join("") + "</div></section>";
  }
  function headBalance() {
    if (liveTile() || donationsTile()) return "";
    return '<div class="nv-hbal"><span class="nv-hbal__l">Balance <b>' + money(walletBalance()) + "</b></span>" + runwayHtml() + topUpAct() + "</div>";
  }
  function attentionSection() {
    var list = attentionItems();
    if (!list.length) return "";
    return '<section class="nv-hsec" aria-labelledby="nvAttT">' + secHead("nvAttT", "Needs attention") +
      '<div class="rp-card">' + list.map(function (a) {
        var act = a.topUp && !canTopUp() ? '<button class="an-btn an-btn--secondary an-btn--tiny is-off"' + OWNER_ONLY : a.google ? gbtn(a.cta, 'data-nv-google="' + a.google + '" data-track="action-home-attention-act kind-' + a.kind + '"', "tiny")
          : '<a class="an-btn an-btn--secondary an-btn--tiny" href="' + esc(a.href) + '" data-track="action-home-attention-act kind-' + a.kind + '">' + esc(a.cta) + "</a>";
        return '<div class="nv-row nv-att">' + use("nv-alert") + '<div class="nv-row__tx"><b>' + esc(a.title) + "</b><span>" + esc(a.text) + "</span></div>" +
          '<div class="nv-row__acts">' + act + dismissBtn(a.id, "attention") + "</div></div>";
      }).join("") + "</div></section>";
  }
  function trendCard(t, onHome) {
    var m = trendMatches(t), made = madeList().filter(function (x) { return x.trend === t.id; })[0], act = "";
    var track = function (kind) { return onHome ? ' data-track="action-home-trend-make-idea kind-' + kind + '"' : ""; };
    if (!onHome && made) {
      act = '<a class="an-btn an-btn--secondary an-btn--tiny" href="analytics-ideas.html#idea-' + t.ideas[made.ch] + '">View idea</a>';
    } else if (m.length === 1) {
      act = btn("Make an idea for " + m[0].name, "secondary", 'data-nv-make="' + t.id + '" data-nv-make-ch="' + m[0].id + '"' + track("named"), "nv-sparkle", "tiny");
    } else if (trendTargets(t).length) {
      act = btn("Make an idea for my channel", "secondary", 'data-nv-make="' + t.id + '" aria-haspopup="menu"' + track("pick"), "nv-sparkle", "tiny");
    }
    return '<article class="nv-idea nv-trendc" id="' + t.id + '"><div class="nv-trendc__top"><span class="ml-tag ml-tag--sm ml-tag--pill ml-tag--muted">' + esc(t.niche) + "</span>" +
        (onHome ? dismissBtn(t.id, "trend") : "") + "</div>" +
      '<h3 class="nv-idea__title">' + esc(t.topic) + "</h3>" +
      '<p class="nv-trendc__m nv-meta">' + stat("nv-trend", "+" + t.growth + "% search interest") + "<span>Rising for " + UI.plural(t.days, "day", "days") + "</span></p>" +
      (act ? '<div class="nv-idea__acts">' + act + "</div>" : "") + "</article>";
  }
  function trendsSection() {
    var list = trendItems().slice(0, 3);
    if (!list.length) return "";
    return '<section class="nv-hsec" aria-labelledby="nvTrendT">' +
      secHead("nvTrendT", "Trending now", "", '<a class="an-btn an-btn--link an-btn--small" href="trending-now.html">All trends</a>') +
      '<div class="nv-trends">' + list.map(function (t) { return trendCard(t, true); }).join("") + "</div></section>";
  }
  function ideaCard(o) {
    var i = o.idea;
    return '<article class="nv-idea" id="' + o.domId + '">' +
      '<div class="nv-idea__top nv-idea__top--acts">' + formatTag(i) + (o.tags || "") + (o.chan ? chanLabel(o.chan) : "") +
        '<span class="nv-idea__quick">' + iconBtn("nv-copy", "Copy title", o.copy, "nv-act") + o.quick + "</span></div>" +
      '<h3 class="nv-idea__title">' + o.title + "</h3>" +
      '<p class="nv-idea__concept">' + esc(i.concept) + "</p>" +
      '<div class="nv-idea__why">' + (i.whyWorked ? whyHtml(i, "worked", "Why it worked", i.whyWorked) : "") +
        whyHtml(i, "fits", o.fitsLabel || "Why it fits", i.whyFits || i.angle) + "</div>" +
      (o.from || "") + "</article>";
  }
  function homeIdea(i, labeled) {
    var saved = likedList().indexOf(i.id) !== -1, k = "kind-" + i.kind;
    return ideaCard({
      idea: i, domId: "home-idea-" + i.id, chan: labeled ? channel(i.channel) : null,
      tags: i.kind === "trending" ? '<span class="ml-tag ml-tag--sm ml-tag--pill ml-tag--info">' + use("nv-trend") + "From a trend</span>" : "",
      quick: saveBtns(i, saved, "source-home " + k),
      title: '<a class="nv-idea__link" href="analytics-ideas.html#idea-' + i.id + '" data-track="action-idea-open source-home ' + k + '">' + esc(i.title) + "</a>",
      copy: 'data-nv-copy="' + i.id + '"'
    });
  }
  function ideasStamp(rich) {
    var at = Number(ss("nv_made_at") || 0);
    if (at) {
      var min = Math.floor((Date.now() - at) / 60000);
      return '<span class="nv-secmeta">Updated ' + (min < 1 ? "just now" : UI.plural(min, "minute", "minutes") + " ago") + "</span>";
    }
    var upd = rich.map(function (c) { return updatedOffset(c); }).filter(function (o) { return o != null; });
    if (!upd.length) return "";
    var oldest = Math.min.apply(null, upd);
    return '<span class="nv-secmeta">Generated ' + ago(oldest) + (oldest < -7 ? ". Refresh for current trends." : "") + "</span>";
  }
  function ideasSection() {
    var chs = channels(), gen = generation(), all = chs.length > 1, mode = ideasMode();
    var rich = chs.filter(function (c) { return !c.small; }), small = chs.filter(function (c) { return c.small; });
    var genHere = gen && chs.some(function (c) { return c.id === gen.ch; });
    var list = homeIdeas();
    if (hs().caught || (mode === "list" && !list.length && !genHere)) return "";
    var stamp = mode === "none" || mode === "skel" ? "" : ideasStamp(rich);
    var refresh = rich.length && mode !== "none" ? btn("Refresh", "link", 'data-nv-generate data-track="action-ideas-generate-open source-home-ideas"' +
      (genHere ? ' aria-disabled="true" data-tip="Already generating for this channel"' : ""), "nv-restore", "small").replace('class="an-btn', genHere ? 'class="is-off an-btn' : 'class="an-btn') : "";
    var row = genHere ? genRowHtml(gen) : "", body;
    if (mode === "skel") {
      body = row + '<div class="nv-ideas nv-ideas--home">' + skelCards(4) + "</div>";
    } else if (mode === "none") {
      body = '<section class="an-blank"><span class="an-blank__ico">' + use("nv-sparkle") + "</span>" +
        '<p class="an-blank__title">No ideas yet</p><p class="an-blank__text">Generate ideas from your audience and recent trends.</p>' +
        btn("Generate ideas", "primary", 'data-nv-generate data-track="action-ideas-generate-open source-home-empty"', "nv-sparkle") + "</section>";
    } else if (mode === "small") {
      var c0 = small[0];
      body = '<section class="an-blank"><p class="an-blank__text">' + esc(c0.name) + " has " + num(c0.subs) + " subscribers and " + c0.videos +
        " videos — not enough to learn from yet. Add a few channels like yours and we’ll build ideas from their best videos.</p>" +
        btn("Add similar channels", "secondary", 'data-nv-similar="' + c0.id + '" data-track="action-ideas-similar-add source-home-ideas"', "nv-plus") + "</section>";
    } else {
      body = row + '<div class="nv-ideas nv-ideas--home">' + list.map(function (i) { return homeIdea(i, all); }).join("") + "</div>" +
        (all && small.length ? '<p class="nv-note">' + esc(small.map(function (c) { return c.name; }).join(", ")) +
          ": not enough data for ideas yet. " + btn("Add similar channels", "link", 'data-nv-similar="' + small[0].id + '" data-track="action-ideas-similar-add source-home-ideas"', null, "tiny") + "</p>" : "");
    }
    return '<section class="nv-hsec" aria-labelledby="nvIdeasT">' +
      secHead("nvIdeasT", "Ideas", stamp + refresh, '<a class="an-btn an-btn--link an-btn--small" href="analytics-ideas.html" data-track="action-ideas-open source-home">All ideas</a>') +
      '<p class="nv-hsec__sub">Based on your audience and what works on similar channels.</p>' + body + "</section>";
  }
  function insightsSection() {
    var list = insightItems();
    if (!list.length) return "";
    return '<section class="nv-hsec" aria-labelledby="nvInsT">' + secHead("nvInsT", "Insights") +
      '<div class="rp-card">' + list.map(function (x) {
        return '<div class="nv-row nv-ins__row"><a class="nv-ins__link" href="' + esc(x.s.href) + '" data-track="action-home-insight-open kind-' + x.s.kind + '">' +
          chanChip(x.c) + '<span class="nv-ins__tx">' + esc(x.s.text) + "</span></a>" + dismissBtn(x.id, "insight") + "</div>";
      }).join("") + "</div></section>";
  }
  function railCard(title, rows) {
    return rows ? '<section class="rp-card"><div class="lv-card__h"><h2 class="lv-card__t">' + title + "</h2></div><div>" + rows + "</div></section>" : "";
  }
  function nowCard() {
    var multi = channels().length > 1;
    return railCard("Happening now", nowItems().map(function (n) {
      return '<div class="nv-nowr"><div class="nv-nowr__top"><span class="ml-tag ml-tag--sm ml-tag--pill lv-st lv-st--live"><span class="ml-tag__dot"></span>Live</span>' +
          '<a class="an-btn an-btn--secondary an-btn--tiny" href="' + n.href + '" data-track="action-home-now-open kind-' + n.kind + '">' + esc(n.cta) + "</a></div>" +
        '<b class="nv-nowr__t">' + esc(n.title) + "</b>" +
        '<span class="nv-nowr__m">' + (multi ? chanChip(channel(n.channel)) : "") + "<span>" + esc(n.text) + "</span>" + (n.watching ? stat("nv-eye", num(n.watching) + " watching") : "") + "</span></div>";
    }).join(""));
  }
  function suggestCard() {
    return railCard("Suggested for you", suggestItems().map(function (s) {
      var act = s.connect ? btn(s.cta, "secondary", 'data-nv-connect="source-home-suggested" data-track="action-home-suggestion-act item-' + s.id + '"', null, "tiny")
        : '<a class="an-btn an-btn--secondary an-btn--tiny" href="' + esc(s.href) + '" data-track="action-home-suggestion-act item-' + s.id + '">' + esc(s.cta) + "</a>";
      return '<div class="nv-nowr"><div class="nv-nowr__top"><b class="nv-nowr__t">' + esc(s.title) + "</b>" + dismissBtn(s.id, "suggestion") + "</div>" +
        '<span class="nv-nowr__m"><span>' + esc(s.text) + '</span></span><div class="nv-nowr__act">' + act + "</div></div>";
    }).join(""));
  }
  function connectCard() {
    return connectItems().map(function (c) {
      return '<section class="rp-card nv-conn"><div class="nv-conn__h">' + ava(c) + '<h2 class="lv-card__t">Connect ' + esc(c.name) + "</h2>" + dismissBtn("connect-" + c.id, "connect") + "</div>" +
        '<p class="nv-conn__tx">See its YouTube revenue next to your other channels and its retention on My channels.</p>' +
        "<div>" + gbtn("Connect with Google", 'data-nv-google="' + c.id + '" data-track="action-channel-connect-google source-home-rail"') + "</div></section>";
    }).join("");
  }
  function renderHome() {
    document.title = "Home — SubSub";
    var head = '<div class="nv-hhead"><h1 class="an-title" tabindex="-1">Home</h1>' + (channels().length ? headBalance() : "") + "</div>";
    if (!channels().length) { host.innerHTML = head + connectBlock("h2", "home-empty"); return; }
    var feed = attentionSection() + trendsSection() + ideasSection() + insightsSection();
    if (!feed) {
      feed = '<section class="an-blank nv-hempty"><span class="an-blank__ico">' + use("nv-check") + "</span>" +
        '<h2 class="an-blank__title">You are all caught up</h2>' +
        '<p class="an-blank__text">New trends, ideas and insights appear here as your channels collect data.</p></section>';
    }
    var rail = nowCard() + suggestCard() + connectCard();
    host.innerHTML = head +
      '<div class="nv-home' + (rail ? "" : " nv-home--solo") + '"><div class="nv-home__main">' + earnStrip() + feed + "</div>" +
      (rail ? '<div class="nv-home__rail">' + rail + "</div>" : "") + "</div>";
  }
  function dismiss(id) {
    var all = [].slice.call(document.querySelectorAll("[data-nv-dismiss]")), at = all.map(function (b) { return b.getAttribute("data-nv-dismiss"); }).indexOf(id);
    ssPush("nv_dismissed", id);
    render();
    var next = document.querySelectorAll("[data-nv-dismiss]");
    var el = next[Math.min(at, next.length - 1)] || host.querySelector("h1");
    if (el) el.focus();
  }
  function makeIdea(tid, ch) {
    var t = trendById(tid), i = t && ideaById(t.ideas[ch]);
    if (!i) return;
    ssPush("nv_made", tid + ":" + ch);
    ss("nv_made_at", String(Date.now()));
    render();
    var card = document.getElementById("home-idea-" + i.id);
    if (card) {
      card.scrollIntoView({ block: "center" });
      card.classList.add("is-hl");
      setTimeout(function () { card.classList.remove("is-hl"); }, 1600);
      var a = card.querySelector(".nv-idea__link");
      if (a) a.focus({ preventScroll: true });
    }
    var view = PAGE === "trends" && document.querySelector("#" + tid + " a.an-btn");
    if (view) view.focus();
    toast("Idea added for " + channel(ch).name + ".");
  }
  function makeMenu(anchor, tid) {
    var t = trendById(tid);
    UI.menu(anchor, trendTargets(t).map(function (c) {
      return { label: c.name, onClick: function () { makeIdea(tid, c.id); } };
    }));
  }

  // =========================================================== My channels (dashboard.html)
  function dashChannels() { return channels(); }
  function dashPick() {
    var chs = dashChannels(), s = null;
    try { s = localStorage.getItem("nv_dash_channel"); } catch (e) {}
    return chs.filter(function (c) { return c.id === s; })[0] || chs[0] || null;
  }
  function dashHead(left, source) {
    return '<div class="nv-hhead"><div class="nv-hhead__l">' + left + "</div>" + periodTabs(source) + "</div>";
  }
  function channelId(c) {
    return ava(c) + '<span class="nv-dch__tx"><b>' + esc(c.name) + "</b><span>" + esc(c.handle) + "</span></span>" + connTag(c);
  }
  function renderDashboard() {
    document.title = "My channels — SubSub";
    var variant = host.getAttribute("data-nv-variant"), chs = dashChannels();
    ss("nv_variant", variant);
    if (!chs.length) { host.innerHTML = connectBlock("h1", "dashboard-empty"); return; }
    if (variant === "cards") {
      if (chs.length === 1) { location.replace("dashboard-channel.html?id=" + chs[0].id); return; }
      host.innerHTML = dashHead('<h1 class="an-title">My channels</h1>', "dashboard") +
        '<div class="nv-dcards">' + chs.map(function (c) {
          return '<section class="rp-card nv-perf nv-dcard" aria-labelledby="dc-' + c.id + '"><div class="nv-dcard__h">' +
              '<span class="nv-dch" id="dc-' + c.id + '">' + channelId(c) + "</span>" +
              '<a class="an-btn an-btn--secondary an-btn--small" href="dashboard-channel.html?id=' + c.id + '" data-track="action-dashboard-channel-open source-dashboard-card">Open channel</a></div>' +
            channelMets(c, false) + "</section>";
        }).join("") + "</div>";
      return;
    }
    var c = dashPick(), pick;
    if (chs.length > 1) {
      pick = '<div class="nv-chsw">' + UI.selectHtml('data-nv-dsel data-track="action-dashboard-channel-switch source-dashboard-header"',
        UI.selectValue({ label: c.name, sub: connLabel(c), avatar: { color: c.color, initial: c.initial } }), { label: "Channel" }) + "</div>";
    } else {
      pick = '<span class="nv-dch">' + channelId(c) + "</span>";
    }
    host.innerHTML = dashHead('<h1 class="an-title">My channels</h1>' + pick, "dashboard") + channelBody(c);
    scrollToHash();
  }
  function dashSwitch(trig) {
    var chs = dashChannels(), opts = chs.map(function (c) {
      return { value: c.id, label: c.name, sub: compact(c.subs) + " subscribers", avatar: { color: c.color, initial: c.initial } };
    });
    opts.push({ kind: "sep" }, { value: "__connect", label: "Connect channel", kind: "action", icon: use("nv-plus") });
    UI.select(trig, {
      value: dashPick().id, label: "Channel", options: opts,
      onPick: function (v) {
        if (v === "__connect") { connectDialog("source-dashboard-switcher"); return; }
        try { localStorage.setItem("nv_dash_channel", v); } catch (e) {}
        render();
        var s = document.querySelector("[data-nv-dsel]");
        if (s) s.focus();
      }
    });
  }

  // =========================================================== channel view: dashboard-channel.html, and dashboard.html in the selector build
  var VSORT = { key: "published", dir: "desc" };
  var SORT_ICO = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7.16 14.83a.84.84 0 0 1-.16-.49c0-.41.31-.8.75-.8h8.5c.44 0 .75.39.75.8 0 .17-.05.34-.16.49-1.2 1.66-3.25 4.48-4.26 5.86a.74.74 0 0 1-1.18 0c-1-1.38-3.04-4.2-4.24-5.86Z" fill="currentColor"/>' +
    '<path d="M16.84 9.17c.11.15.16.32.16.49 0 .41-.31.8-.75.8H7.75c-.44 0-.75-.39-.75-.8 0-.17.05-.34.16-.49 1.2-1.66 3.25-4.48 4.26-5.86a.74.74 0 0 1 1.18 0c1 1.38 3.04 4.2 4.24 5.86Z" fill="currentColor"/></svg>';
  var SOURCES = [["ads", "YouTube ads", "Estimated, paid by Google through AdSense"], ["fan", "Fan Funding", "Memberships and support on your public page"],
    ["live", "Live", "Donations during SubSub streams"], ["network", "Network", "Your share from the Network"]];
  function sourcesCard(c) {
    var d = c.sources[period()], oauth = conn(c) === "oauth";
    var list = SOURCES.filter(function (s) { return (s[0] !== "ads" || oauth) && (s[0] !== "network" || c.network); });
    var total = list.reduce(function (a, s) { return a + d[s[0]]; }, 0), x = 0;
    var bar = total ? list.map(function (s) {
      var w = d[s[0]] / total * 100, r = w ? '<rect class="nv-src--' + s[0] + '" x="' + x.toFixed(2) + '" y="0" width="' + w.toFixed(2) + '" height="12" />' : "";
      x += w;
      return r;
    }).join("") : '<rect class="nv-src--none" x="0" y="0" width="100" height="12" />';
    var label = list.map(function (s) { return s[1] + " " + money(d[s[0]]); }).join(", ");
    return '<div class="rp-card nv-srcs"><p class="nv-srcs__t"><b>' + money(total) + "</b> over " + periodWords() + "</p>" +
      '<svg class="nv-srcbar" viewBox="0 0 100 12" preserveAspectRatio="none" role="img" aria-label="Earnings by source: ' + esc(label) + '">' + bar + "</svg>" +
      '<ul class="nv-srcl">' + list.map(function (s) {
        var v = d[s[0]];
        return '<li class="nv-srcl__i"><span class="nv-srcl__dot nv-src--' + s[0] + '" aria-hidden="true"></span>' +
          '<span class="nv-srcl__tx"><b>' + s[1] + "</b><span>" + s[2] + "</span></span>" +
          '<span class="nv-srcl__v"><b>' + money(v) + "</b><span>" + (total ? Math.round(v / total * 100) : 0) + "%</span></span></li>";
      }).join("") + "</ul>" +
      (oauth ? "" : '<p class="nv-note nv-srcs__note">YouTube ads appear once the channel is connected with Google.</p>') + "</div>";
  }
  function videosTable(c) {
    var oauth = conn(c) === "oauth";
    var cols = [["title", "Video", "nv-c--title"], ["published", "Published", "nv-c--num"], ["views", "Views", "nv-c--num"],
      ["avd", "Average view duration", "nv-c--num"], ["retention", "Retention", "nv-c--num"]];
    var val = function (v, k) { return k === "title" ? v.title.toLowerCase() : k === "published" ? v.published : (k === "avd" || k === "retention") && !oauth ? -1 : v[k]; };
    var rows = c.videos.slice().sort(function (a, b) {
      var x = val(a, VSORT.key), y = val(b, VSORT.key), r = x < y ? -1 : x > y ? 1 : 0;
      return VSORT.dir === "asc" ? r : -r;
    });
    var head = cols.map(function (col) {
      var on = VSORT.key === col[0];
      return '<div class="an-th ' + col[2] + '" role="columnheader" aria-sort="' + (on ? (VSORT.dir === "asc" ? "ascending" : "descending") : "none") + '">' +
        '<button class="an-sort nv-sortbtn' + (on ? " is-sorted" + (VSORT.dir === "asc" ? " is-asc" : "") : "") + '" type="button" data-nv-sort="' + col[0] +
        '" data-track="action-dashboard-videos-sort kind-' + col[0] + '">' + col[1] + SORT_ICO + "</button></div>";
    }).join("");
    var body = rows.map(function (v) {
      return '<div class="an-tr" role="row">' +
        '<div class="an-td nv-c--title" role="cell"><img class="nv-vthumb" src="' + esc(v.thumb) + '" alt="" /><span class="nv-vt">' + esc(v.title) +
          (v.short ? ' <span class="ml-tag ml-tag--sm ml-tag--pill ml-tag--muted">Short</span>' : "") + "</span></div>" +
        '<div class="an-td nv-c--num" role="cell">' + dateLabel(day(v.published)) + "</div>" +
        '<div class="an-td nv-c--num" role="cell">' + num(v.views) + "</div>" +
        '<div class="an-td nv-c--num" role="cell">' + (oauth ? duration(v.avd) : "—") + "</div>" +
        '<div class="an-td nv-c--num" role="cell">' + (oauth ? v.retention + "%" : "—") + "</div></div>";
    }).join("");
    return '<div class="rp-card"><div class="an-tablewrap"><div class="an-table an-table--fill nv-vtable" role="table" aria-label="Videos of ' + esc(c.name) + '">' +
      '<div class="an-thead" role="rowgroup"><div class="an-tr an-tr--head" role="row">' + head + "</div></div>" +
      '<div class="an-tbody" role="rowgroup">' + body + "</div></div></div>" +
      (oauth ? "" : '<p class="nv-note nv-vnote">Average view duration and retention appear once ' + esc(c.name) + " is connected with Google.</p>") + "</div>";
  }
  function streamRows(list, upcoming) {
    return list.map(function (s) {
      var meta = upcoming ? "<span>" + dateLabel(day(s.at)) + ", " + s.time + "</span>"
        : "<span>" + (s.live ? "On air " : dateLabel(day(s.at)) + ", ") + hm(s.duration) + "</span>" +
          stat("nv-eye", num(s.peak) + " peak viewers") + stat("nv-coin", money(s.donations) + " donated");
      return '<a class="nv-srow" href="live-stream.html?id=' + s.id + '" data-track="action-dashboard-stream-open kind-' + (upcoming ? "upcoming" : "recent") + '">' +
        (s.live ? '<span class="ml-tag ml-tag--sm ml-tag--pill lv-st lv-st--live"><span class="ml-tag__dot"></span>Live</span>' : "") +
        '<span class="nv-srow__tx"><b>' + esc(s.title) + '</b><span class="nv-meta">' + meta + "</span></span>" + use("nv-chevron") + "</a>";
    }).join("");
  }
  function streamsCard(c) {
    var up = c.streams.upcoming, rec = c.streams.recent;
    return '<div class="nv-sgrid">' +
      '<section class="rp-card"><div class="lv-card__h"><h3 class="lv-card__t">Upcoming</h3></div>' +
        (up.length ? streamRows(up, true) : '<p class="nv-note nv-sempty">No scheduled streams. <a class="an-btn an-btn--link an-btn--tiny" href="live-calendar.html" data-track="action-dashboard-stream-schedule">Schedule a stream</a></p>') + "</section>" +
      '<section class="rp-card"><div class="lv-card__h"><h3 class="lv-card__t">Recent</h3></div>' +
        (rec.length ? streamRows(rec, false) : '<p class="nv-note nv-sempty">No streams yet</p>') + "</section></div>";
  }
  function channelBody(c) {
    var sec = function (id, title, body) {
      return '<section class="nv-hsec" id="' + id + '" aria-labelledby="' + id + 'T">' + secHead(id + "T", title) + body + "</section>";
    };
    return sec("performance", "Performance", '<div class="rp-card nv-perf">' + channelMets(c, true) + "</div>") +
      sec("sources", "Earnings by source", sourcesCard(c)) +
      sec("videos", "Videos", videosTable(c)) +
      sec("streams", "Streams", streamsCard(c));
  }
  function scrollToHash() {
    if (!location.hash || scrollToHash.done) return;
    scrollToHash.done = true;
    var el = document.querySelector(location.hash);
    if (el) el.scrollIntoView();
  }
  function dashVariant() {
    var v = ss("nv_variant");
    if (v || renderChannel.asked) return v;
    renderChannel.asked = true;
    fetch("dashboard.html").then(function (r) { return r.text(); }).then(function (t) {
      var m = /data-nv-variant="(\w+)"/.exec(t);
      if (m) { ss("nv_variant", m[1]); render(); }
    }).catch(function () {});
    return null;
  }
  function renderChannel() {
    var chs = dashChannels();
    if (!chs.length) { document.title = "My channels — SubSub"; host.innerHTML = connectBlock("h1", "dashboard-empty"); return; }
    var c = chs.filter(function (x) { return x.id === qp.get("id"); })[0] || chs[0];
    document.title = c.name + " — My channels — SubSub";
    var back = dashVariant() === "cards" && chs.length > 1
      ? '<a class="an-btn an-btn--link an-btn--small nv-back" href="dashboard.html" data-track="action-dashboard-back source-channel">' + use("nv-chevron") + "All channels</a>" : "";
    host.innerHTML = back +
      dashHead('<h1 class="an-title nv-dch nv-dch--lg">' + ava(c) + '<span class="nv-dch__tx"><b>' + esc(c.name) + "</b><span>" + esc(c.handle) + "</span></span>" + connTag(c) + "</h1>", "channel") +
      channelBody(c);
    scrollToHash();
  }

  // =========================================================== Trending now
  function renderTrends() {
    host.innerHTML = '<header class="an-head"><h1 class="an-title">Trending now</h1></header>' +
      '<p class="an-modal__text">Topics gaining search interest across YouTube niches, with an idea for your channel one click away.</p>' +
      '<div class="nv-trends">' + F.trends.map(function (t) { return trendCard(t, false); }).join("") + "</div>";
  }

  // =========================================================== account-channels.html
  function renderChannels() {
    document.title = "My channels — SubSub";
    var chs = channels();
    var head = '<div class="an-head an-head--between"><div class="an-head__left"><h1 class="an-title">My channels</h1></div>' +
      '<div class="an-head__btns">' + btn("Connect channel", "primary", 'data-nv-connect="source-my-channels" data-track="action-channel-link-open source-my-channels"', "nv-plus") + "</div></div>" +
      '<p class="an-modal__text">Channels connected with Google (OAuth) show revenue and retention. Channels added by link show public data only.</p>';
    var list = chs.length
      ? '<section class="rp-card">' + chs.map(function (c) {
          return '<div class="nv-chrow">' + ava(c) + '<span class="nv-chrow__tx"><b>' + esc(c.name) + '</b><span class="nv-meta"><span>' + esc(c.handle) + "</span>" + stat("nv-users", compact(c.subs) + " subscribers") +
            "<span>Connected " + dateLabel(day(c.connected)) + "</span></span></span>" + connTag(c) +
            '<span class="nv-chrow__acts">' +
              (conn(c) !== "oauth" ? gbtn("Connect with Google", 'data-nv-google="' + c.id + '" data-track="action-channel-connect-google source-my-channels"', "tiny") : "") +
              btn("Disconnect", "link", 'data-nv-disconnect="' + c.id + '" data-track="action-channel-disconnect-open"', null, "tiny") +
            "</span></div>";
        }).join("") + "</section>"
      : '<section class="an-blank"><span class="an-blank__ico">' + use("nv-channels") + '</span><p class="an-blank__title">No channels yet</p>' +
        '<p class="an-blank__text">Connect a channel to see its performance on My channels and get ideas for it.</p>' +
        btn("Connect channel", "primary", 'data-nv-connect="source-my-channels-empty" data-track="action-channel-link-open source-my-channels-empty"', "nv-plus") + "</section>";
    host.innerHTML = head + list;
  }

  // =========================================================== dialogs
  function connectGoogle(id) {
    if (!channels().length) {
      ss("nv_home", "oauth"); ss("nv_removed", null);
      closeModals(); render();
      toast("Zems Racing connected with Google.");
      return;
    }
    var c = channel(id);
    if (c && conn(c) !== "oauth") {
      ssPush("nv_upgraded", c.id);
      closeModals(); render();
      toast(c.name + " connected with Google — revenue and retention are on.");
      return;
    }
    closeModals();
    toast("Channel connected with Google.");
  }
  function connectDialog(source, linkFirst) {
    var m = modal("nvConnect", "Connect channel",
      '<p class="an-modal__text">Google asks for permission to read the channel’s analytics. Nothing on the channel is changed or published.</p>' +
      "<div>" + gbtn("Continue with Google", 'data-nv-google="new" data-track="action-channel-connect-google source-connect-dialog"') + "</div>" +
      '<div class="ai-field"><label class="ai-lbl" for="nvChLink">Or add a channel link</label>' +
        '<input class="an-input" id="nvChLink" type="text" placeholder="youtube.com/@channel" autocomplete="off" data-track="field-channel-link" />' +
        '<span class="an-hint" data-nv-linkhint>Public data only: subscribers and views. Revenue stays hidden until you connect with Google.</span></div>',
      btn("Cancel", "secondary", 'data-lv-close data-nv-close data-track="action-channel-connect-cancel"') +
      btn("Add channel", "primary", 'data-nv-linkadd data-track="action-channel-link-submit ' + esc(source) + '"'));
    if (linkFirst) setTimeout(function () { var i = m.querySelector("#nvChLink"); if (i) i.focus(); }, 30);
  }
  function linkAdd() {
    var i = document.getElementById("nvChLink"), hint = document.querySelector("[data-nv-linkhint]");
    var v = (i && i.value || "").trim();
    if (!/youtube\.com\/|youtu\.be\/|^@\w/.test(v)) {
      if (i) i.classList.add("lv-inv");
      if (hint) { hint.textContent = "Paste a YouTube channel link, for example youtube.com/@channel."; hint.classList.add("an-hint--warn"); }
      return;
    }
    closeModals();
    if (!channels().length) { ss("nv_home", "link"); render(); toast("Hunt Squad added by link."); return; }
    toast("Channel added by link.");
  }

  // ---- Generate ideas dialog
  var GEN = null, MAX_LINKS = 5;
  var LINK_RE = /^(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/(?:@|c\/|channel\/|user\/)([\w.-]+)\/?$|^@([\w.-]+)$/i;
  function resolveLink(v) {
    v = (v || "").trim();
    if (!v) return null;
    var m = LINK_RE.exec(v);
    if (!m) return { err: true };
    var h = (m[1] || m[2]).toLowerCase(), d = F.directory[h];
    return d ? { handle: h, name: d.name, initial: d.initial, color: d.color }
      : { handle: h, name: "@" + h, initial: h.charAt(0).toUpperCase(), color: "var(--color-avatar-0)" };
  }
  function savedSimilar(ch) { try { return JSON.parse(ss("nv_similar_" + ch) || "null"); } catch (e) { return null; } }
  function rowsFor(ch, links) {
    var l = links || savedSimilar(ch) || [];
    if (!l.length) l = [""];
    return l.map(function (v) { return { v: v, r: resolveLink(v) }; });
  }
  function generateDialog(ch, focusLinks, links) {
    var chs = channels();
    var id = ch || (chs.filter(function (c) { return !c.small; })[0] || chs[0]).id;
    GEN = { ch: id, rows: rowsFor(id, links) };
    var m = modal("nvGenerate", "Generate ideas", "", "");
    genRender();
    if (focusLinks) setTimeout(function () { var i = m.querySelector("[data-nv-genlink]"); if (i) i.focus(); }, 30);
  }
  function linkRowHtml(row, i, n) {
    var r = row.r;
    return '<div class="nv-links__item"><div class="nv-links__row">' +
      '<input class="an-input' + (r && r.err ? " lv-inv" : "") + '" type="text" value="' + esc(row.v) + '" placeholder="youtube.com/@channel" aria-label="Similar channel ' + (i + 1) +
        '" data-nv-genlink="' + i + '" data-track="field-ideas-generate-similar" />' +
      (n > 1 || row.v ? '<button class="mc-more" type="button" data-nv-genrm="' + i + '" aria-label="Remove channel" data-track="action-ideas-generate-link-remove">' + use("nv-x") + "</button>" : "") +
      "</div>" +
      (r && r.err ? '<span class="nv-lnk nv-lnk--err" role="alert">Not a channel link. Example: youtube.com/@channel</span>'
        : r ? '<span class="nv-lnk"><span class="an-chan__ava" style="background:' + r.color + '">' + esc(r.initial) + "</span><span>" + esc(r.name) + "</span></span>" : "") +
      "</div>";
  }
  function genRender() {
    var m = document.getElementById("nvGenerate");
    if (!m || !GEN) return;
    var c = channel(GEN.ch), rows = GEN.rows, full = rows.length >= MAX_LINKS;
    var added = rows.filter(function (r) { return r.v.trim(); }).length;
    var used = rows.map(function (r) { return r.r && r.r.handle; }).filter(Boolean);
    var sugg = (c.suggested || []).filter(function (h) { return used.indexOf(h) === -1; }).slice(0, 4);
    var gen = generation(), busy = !!gen && gen.ch === GEN.ch, today = !busy && updatedOffset(c) === 0, noRuns = !runsLeftN();
    var note = busy ? '<div class="an-alert an-alert--attention"><span>Already generating for this channel</span></div>'
      : today ? '<div class="an-alert an-alert--attention"><span>Updated today — trends have barely changed</span></div>'
      : '<p class="nv-note">' + runsHtml() + "</p>";
    m.querySelector(".an-modal__body").innerHTML = '<div class="nv-gen">' +
      '<div class="ai-field"><span class="ai-lbl">Channel</span>' +
        UI.selectHtml('data-nv-gensel data-track="field-ideas-generate-channel"', UI.selectValue({ label: c.name, avatar: { color: c.color, initial: c.initial } }), { label: "Channel" }) + "</div>" +
      '<div class="ai-field"><div class="nv-gen__lbl"><span class="ai-lbl">Similar channels (optional)</span><span class="nv-gen__count" data-nv-gencount>' + added + " / " + MAX_LINKS + "</span></div>" +
        '<span class="an-hint">Ideas get better with 2–5 channels like yours. Leave empty to use only your channel’s videos.</span>' +
        '<div class="nv-links">' + rows.map(function (r, i) { return linkRowHtml(r, i, rows.length); }).join("") + "</div>" +
        (sugg.length && !full ? '<div class="nv-chips">' + sugg.map(function (h) {
          var d = F.directory[h];
          return '<button class="nv-chip" type="button" data-nv-gensugg="' + h + '" data-track="action-ideas-generate-similar-suggest item-' + h + '">' +
            use("nv-plus") + '<span class="an-chan__ava" style="background:' + d.color + '">' + esc(d.initial) + "</span>" + esc(d.name) + "</button>";
        }).join("") + "</div>" : "") +
        (full ? "" : '<div><button class="an-btn an-btn--link an-btn--small" type="button" data-nv-genadd data-track="action-ideas-generate-link-add">' + use("nv-plus") + "Add another channel</button></div>") +
      "</div>" + note + "</div>";
    var off = busy || noRuns;
    m.querySelector(".an-modal__foot").innerHTML =
      btn("Cancel", "secondary", 'data-lv-close data-nv-close data-track="action-ideas-generate-cancel"') +
      btn("Generate ideas", "primary", 'data-nv-genstart data-track="action-ideas-generate-run"' +
        (off ? ' aria-disabled="true" data-tip="' + (busy ? "Already generating for this channel" : "No runs left this month") + '"' : ""), "nv-sparkle")
        .replace('class="an-btn', off ? 'class="is-off an-btn' : 'class="an-btn');
  }
  function genSync() {
    [].slice.call(document.querySelectorAll("[data-nv-genlink]")).forEach(function (i) {
      var row = GEN.rows[Number(i.getAttribute("data-nv-genlink"))];
      if (row && row.v !== i.value) { row.v = i.value; row.r = null; }
    });
  }
  function genFocus(i) {
    var ins = document.querySelectorAll("[data-nv-genlink]"), el = ins[i == null ? ins.length - 1 : i];
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  }
  function genValidate(i) {
    genSync();
    var row = GEN.rows[i];
    if (!row) return;
    row.r = resolveLink(row.v);
    var item = document.querySelectorAll(".nv-links__item")[i];
    if (!item) return;
    var tmp = document.createElement("div");
    tmp.innerHTML = linkRowHtml(row, i, GEN.rows.length);
    var fresh = tmp.firstChild, old = item.querySelector(".nv-lnk");
    if (old) old.remove();
    if (fresh.querySelector(".nv-lnk")) item.appendChild(fresh.querySelector(".nv-lnk"));
    var input = item.querySelector("input");
    if (input) input.classList.toggle("lv-inv", !!(row.r && row.r.err));
    var cnt = document.querySelector("[data-nv-gencount]");
    if (cnt) cnt.textContent = GEN.rows.filter(function (r) { return r.v.trim(); }).length + " / " + MAX_LINKS;
  }
  function genStart() {
    genSync();
    GEN.rows.forEach(function (r) { r.r = resolveLink(r.v); });
    if (GEN.rows.some(function (r) { return r.r && r.r.err; })) { genRender(); return; }
    var links = GEN.rows.map(function (r) { return r.v.trim(); }).filter(Boolean);
    ss("nv_similar_" + GEN.ch, JSON.stringify(links));
    ss("nv_runs_used", String(Number(ss("nv_runs_used") || 0) + 1));
    var ch = GEN.ch;
    closeModals();
    startGeneration(ch);
  }

  // ---- like, dislike, copy
  var undoT = null, undoFn = null;
  function toastUndo(msg, fn) {
    var t = document.querySelector("[data-nv-undo]");
    if (!t) {
      t = document.createElement("div");
      t.className = "an-toast nv-toast";
      t.setAttribute("data-nv-undo", "");
      t.setAttribute("role", "status");
      document.body.appendChild(t);
    }
    var plain = document.querySelector("[data-lv-toast]");
    if (plain) plain.hidden = true;
    t.innerHTML = "<span>" + esc(msg) + '</span><button class="nv-toast__act" type="button" data-nv-undo-do data-track="action-idea-dislike-undo source-toast">Undo</button>';
    t.hidden = false;
    undoFn = fn;
    clearTimeout(undoT);
    undoT = setTimeout(function () { t.hidden = true; undoFn = null; }, 5000);
  }
  function undoClose() {
    var t = document.querySelector("[data-nv-undo]");
    if (t) t.hidden = true;
    clearTimeout(undoT); undoFn = null;
  }
  function dislike(id) {
    ssPush("nv_hidden", id);
    ssDrop("nv_liked", id);
    JUST[id] = true;
    render();
    toastUndo("Hidden", function () {
      ssDrop("nv_hidden", id);
      var r = reasons(); delete r[id]; ss("nv_reasons", JSON.stringify(r));
      delete JUST[id];
      render();
    });
  }
  function ideaMenu(anchor, id) {
    var i = ideaById(id);
    if (!i) return;
    var items = [{ label: "Copy title", icon: use("nv-copy"), onClick: function () { copyText(i.title); } }];
    UI.menu(anchor, items);
  }
  function disconnectDialog(id) {
    var c = channel(id);
    modal("nvDisconnect", "Disconnect " + c.name + "?",
      '<p class="an-modal__text">Its performance leaves My channels and its ideas leave Home and Ideas. You can connect it again at any time.</p>',
      btn("Cancel", "secondary", 'data-lv-close data-nv-close data-track="action-channel-disconnect-cancel"') +
      btn("Disconnect", "danger", 'data-nv-disconfirm="' + id + '" data-track="action-channel-disconnect-confirm"'), " an-modal__dialog--sm an-modal__dialog--confirm");
  }
  function copyText(text, el, msg) {
    var done = function () {
      if (!el) { toast(msg || "Title copied."); return; }
      var u = el.querySelector("use");
      clearTimeout(el._copied);
      el.classList.add("is-done");
      el.setAttribute("aria-label", "Title copied");
      el.setAttribute("data-tip", "Copied");
      if (u) u.setAttribute("href", "#ic-nv-check");
      el._copied = setTimeout(function () {
        el.classList.remove("is-done");
        el.setAttribute("aria-label", "Copy title");
        el.setAttribute("data-tip", "Copy title");
        if (u) u.setAttribute("href", "#ic-nv-copy");
      }, 2000);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, done); return; }
    var ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    ta.remove(); done();
  }

  // =========================================================== events
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t.closest) return;
    var el;
    if ((el = t.closest("[data-nv-dsel]"))) { dashSwitch(el); return; }
    if ((el = t.closest("[data-nv-dismiss]"))) { dismiss(el.getAttribute("data-nv-dismiss")); return; }
    if ((el = t.closest("[data-nv-make]"))) {
      if (el.getAttribute("data-nv-make-ch")) makeIdea(el.getAttribute("data-nv-make"), el.getAttribute("data-nv-make-ch"));
      else makeMenu(el, el.getAttribute("data-nv-make"));
      return;
    }
    if ((el = t.closest("[data-nv-sort]"))) {
      var key = el.getAttribute("data-nv-sort");
      VSORT = { key: key, dir: VSORT.key === key && VSORT.dir === "desc" ? "asc" : VSORT.key === key ? "desc" : key === "title" ? "asc" : "desc" };
      render();
      var sb = document.querySelector('[data-nv-sort="' + key + '"]');
      if (sb) sb.focus();
      return;
    }
    if ((el = t.closest("[data-nv-period]"))) { ss("nv_period", el.getAttribute("data-nv-period")); render(); return; }
    if ((el = t.closest("[data-nv-google]"))) { connectGoogle(el.getAttribute("data-nv-google")); return; }
    if ((el = t.closest("[data-nv-connect]"))) { connectDialog(el.getAttribute("data-nv-connect"), el.hasAttribute("data-nv-linkfirst")); return; }
    if (t.closest("[data-nv-linkadd]")) { linkAdd(); return; }
    if ((el = t.closest("[data-nv-similar]"))) { generateDialog(el.getAttribute("data-nv-similar"), true); return; }
    if (t.closest("[data-nv-generate]")) { generateDialog(null, false); return; }
    if ((el = t.closest("[data-nv-retry]"))) { startGeneration(el.getAttribute("data-nv-retry")); return; }
    if ((el = t.closest("[data-nv-more]"))) {
      var mk = el.getAttribute("data-nv-more"), cl = document.querySelector('[data-nv-clamp="' + mk + '"]');
      MORE[mk] = !MORE[mk];
      if (cl) cl.classList.toggle("is-open", MORE[mk]);
      el.textContent = MORE[mk] ? "Less" : "More";
      el.setAttribute("aria-expanded", String(MORE[mk]));
      return;
    }
    if ((el = t.closest("[data-nv-gensel]"))) {
      genSync();
      var opts = channels().map(function (c) { return { value: c.id, label: c.name, avatar: { color: c.color, initial: c.initial } }; });
      opts.push({ kind: "sep" }, { value: "__connect", label: "Connect channel", kind: "action", icon: use("nv-plus") });
      UI.select(el, {
        value: GEN.ch, label: "Channel", options: opts,
        onPick: function (v) {
          if (v === "__connect") { closeModals(); connectDialog("source-ideas-generate"); return; }
          GEN.ch = v; GEN.rows = rowsFor(v); genRender();
        }
      });
      return;
    }
    if (t.closest("[data-nv-genadd]")) { genSync(); GEN.rows.push({ v: "", r: null }); genRender(); genFocus(); return; }
    if ((el = t.closest("[data-nv-gensugg]"))) {
      genSync();
      var link = "youtube.com/@" + el.getAttribute("data-nv-gensugg"), empty = GEN.rows.filter(function (r) { return !r.v.trim(); })[0];
      if (empty) { empty.v = link; empty.r = resolveLink(link); } else if (GEN.rows.length < MAX_LINKS) GEN.rows.push({ v: link, r: resolveLink(link) });
      genRender();
      return;
    }
    if ((el = t.closest("[data-nv-genrm]"))) {
      genSync();
      GEN.rows.splice(Number(el.getAttribute("data-nv-genrm")), 1);
      if (!GEN.rows.length) GEN.rows.push({ v: "", r: null });
      genRender();
      return;
    }
    if ((el = t.closest("[data-nv-genstart]"))) { if (!UI.isOff(el)) genStart(); return; }
    if ((el = t.closest("[data-nv-like]"))) {
      var lid = el.getAttribute("data-nv-like");
      if (likedList().indexOf(lid) === -1) ssPush("nv_liked", lid); else ssDrop("nv_liked", lid);
      render();
      var lb = document.querySelector('[data-nv-like="' + lid + '"]');
      if (lb) lb.focus();
      return;
    }
    if ((el = t.closest("[data-nv-dislike]"))) {
      dislike(el.getAttribute("data-nv-dislike"));
      if (PAGE === "home") { var nx = document.querySelector("[data-nv-dislike]") || host.querySelector("h1"); if (nx) nx.focus(); }
      return;
    }
    if ((el = t.closest("[data-nv-reason]"))) {
      var rid = el.getAttribute("data-nv-reason"), rv = el.getAttribute("data-nv-reason-v"), rs = reasons();
      if (rs[rid] === rv) delete rs[rid]; else rs[rid] = rv;
      ss("nv_reasons", JSON.stringify(rs)); render(); return;
    }
    if (t.closest("[data-nv-undo-do]")) { var fn = undoFn; undoClose(); if (fn) fn(); return; }
    if ((el = t.closest("[data-nv-restore]"))) {
      var sid = el.getAttribute("data-nv-restore"), rr = reasons();
      ssDrop("nv_hidden", sid); delete rr[sid]; ss("nv_reasons", JSON.stringify(rr)); delete JUST[sid];
      render(); toast("Idea restored."); return;
    }
    if ((el = t.closest("[data-nv-menu]"))) { ideaMenu(el, el.getAttribute("data-nv-menu")); return; }
    if (t.closest("[data-nv-ffshare]")) { copyText("https://subsub.io/donate/zemsracing", null, "Donation link copied."); return; }
    if ((el = t.closest("[data-nv-copy]"))) {
      var idea = ideaById(el.getAttribute("data-nv-copy"));
      if (idea) copyText(idea.title, el);
      return;
    }
    if ((el = t.closest("[data-nv-disconnect]"))) { disconnectDialog(el.getAttribute("data-nv-disconnect")); return; }
    if ((el = t.closest("[data-nv-disconfirm]"))) {
      var c = channel(el.getAttribute("data-nv-disconfirm"));
      ssPush("nv_removed", c.id); closeModals(); render();
      toast(c.name + " disconnected.");
      return;
    }
  });
  document.addEventListener("input", function (e) {
    if (e.target.id === "nvChLink") e.target.classList.remove("lv-inv");
  });
  document.addEventListener("paste", function (e) {
    if (!e.target.hasAttribute || !e.target.hasAttribute("data-nv-genlink")) return;
    var i = Number(e.target.getAttribute("data-nv-genlink"));
    setTimeout(function () { genValidate(i); }, 0);
  });
  document.addEventListener("change", function (e) {
    if (e.target.hasAttribute && e.target.hasAttribute("data-nv-genlink")) genValidate(Number(e.target.getAttribute("data-nv-genlink")));
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    if (e.target.id === "nvChLink") { e.preventDefault(); linkAdd(); }
    else if (e.target.hasAttribute && e.target.hasAttribute("data-nv-genlink")) {
      e.preventDefault();
      var go = document.querySelector("[data-nv-genstart]");
      if (go && !UI.isOff(go)) genStart(); else genValidate(Number(e.target.getAttribute("data-nv-genlink")));
    }
  });

  function render() {
    if (host && UI) {
      if (PAGE === "home") {
        renderHome();
        railFit();
        var rail = document.querySelector(".nv-home__rail");
        if (railObs && rail) { railObs.disconnect(); railObs.observe(rail); }
      }
      else if (PAGE === "dashboard") renderDashboard();
      else if (PAGE === "channel") renderChannel();
      else if (PAGE === "ideas" && window.V2Ideas) window.V2Ideas.render();
      else if (PAGE === "channels") renderChannels();
      else if (PAGE === "trends") renderTrends();
    }
    homeBadge();
    syncBalanceChip();
  }
  window.V2_KIT = {
    F: F, qp: qp, host: host, esc: esc, use: use, ss: ss, ssList: ssList, toast: toast, toastUndo: toastUndo, modal: modal, closeModals: closeModals,
    btn: btn, iconBtn: iconBtn, day: day, dateLabel: dateLabel, ava: ava, formatTag: formatTag, whyHtml: whyHtml, ideaCard: ideaCard,
    skelCards: skelCards, applyLayout: applyLayout, copyText: copyText, resolveLink: resolveLink, runsHtml: runsHtml, runsLeftN: runsLeftN,
    connectDialog: connectDialog, stat: stat, account: account, walletBalance: walletBalance, runwayDays: runwayDays
  };
  if (PAGE === "home" && /\/$/.test(location.pathname) && channels().length) { location.replace("dashboard.html"); return; }
  render();
  if (DLG && host) setTimeout(function () { generateDialog("zems", false, DLG === "invalid" ? F.dialogInvalid : null); }, 50);
})();

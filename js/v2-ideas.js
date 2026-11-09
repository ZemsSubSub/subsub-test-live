// Ideas page: the search history on the left, the selected search or Saved ideas on the right, and the New search dialog.
// A search covers one or more channels, connected ones or any channel by link. Built on window.V2_KIT from v2.js and
// F.ideaRuns. The selection lives in the URL (?run=<id> or ?view=saved), idea and search state in sessionStorage.
// Fixture switch: ?ideas=default|running|failed|allhidden|saved|saved-empty|empty resets the session;
// ?dialog=new|link|pick|invalid|busy|edit|noruns opens the dialog in that state.
// Variant single (serve.js <port> single): every search covers exactly one channel, a connected one or one by link.
(function () {
  var K = window.V2_KIT, UI = window.LVUI;
  if (!K || !UI || !K.host || K.host.getAttribute("data-nv-page") !== "ideas") return;
  var F = K.F, R = F.ideaRuns, host = K.host, esc = K.esc, use = K.use, ss = K.ss, btn = K.btn;
  var SINGLE = document.body.getAttribute("data-ideas") !== "multi";
  var RUN_MS = 8000, MAX_CH = SINGLE ? 1 : 5, FORMATS = [["video", "Video"], ["short", "Short"]];
  var LINK_ERR = "Not a channel link. Example: youtube.com/@channel";
  var JUST = {}, FMT = {}, CHF = {}, HID = {};

  function json(k, d) { try { var v = JSON.parse(ss(k) || "null"); return v == null ? d : v; } catch (e) { return d; } }
  function put(k, v) { ss(k, JSON.stringify(v)); }
  function params() { return new URLSearchParams(location.search); }
  function setParams(p) { var q = p.toString(); history.replaceState(null, "", location.pathname + (q ? "?" + q : "") + location.hash); }

  // ---- fixture switch
  var FIX = { "default": "zems-2", running: "hunt-2", failed: "eugene-1", allhidden: "hunt-1", saved: "saved", "saved-empty": "saved", empty: "" };
  var DLG = null;
  (function () {
    var p = params(), fx = p.get("ideas");
    if (fx && Object.prototype.hasOwnProperty.call(FIX, fx)) {
      ["ir_state", "ir_new", "ir_deleted", "ir_seen", "ir_empty", "ir_nosave", "ir_filter", "nv_runs_used"].forEach(function (k) { ss(k, null); });
      if (fx === "empty") ss("ir_empty", "1");
      if (fx === "saved-empty") ss("ir_nosave", "1");
      ["ideas", "run", "view"].forEach(function (k) { p.delete(k); });
      if (FIX[fx] === "saved") p.set("view", "saved"); else if (FIX[fx]) p.set("run", FIX[fx]);
    }
    if (p.get("dialog")) { DLG = p.get("dialog"); p.delete("dialog"); }
    if (p.get("channel")) { ss("ir_filter", p.get("channel")); p.delete("channel"); }
    setParams(p);
  })();

  // ---- data
  function searchUrl(t) { return "https://www.youtube.com/results?search_query=" + encodeURIComponent(t); }
  var BASE = {};
  R.ideas.forEach(function (x) {
    var src = x.from ? F.ideas.filter(function (i) { return i.id === x.from; })[0] : x;
    var s = src.source || {};
    BASE[x.id] = {
      id: x.id, for: x.for || src.channel, format: src.format, title: src.title, concept: src.concept, whyWorked: src.whyWorked, whyFits: src.whyFits,
      source: { title: s.title, channel: s.channel, own: !!s.own, thumb: s.thumb, url: s.url || searchUrl(s.title) }
    };
  });
  // a search started in this session names its ideas <search>~<channel>~<fixture idea>
  function idea(id) {
    var parts = id.split("~"), b = BASE[parts[parts.length - 1]];
    if (!b || parts.length === 1) return b || null;
    var c = {};
    for (var key in b) c[key] = b[key];
    c.id = id;
    c.for = parts[1];
    return c;
  }
  function chan(id) {
    var c = F.channels[id] || F.directory[id];
    return c ? { id: id, name: c.name, initial: c.initial, color: c.color, own: !!F.channels[id] }
      : { id: id, name: "@" + id, initial: id.charAt(0).toUpperCase(), color: "var(--color-avatar-0)", own: false };
  }
  function ownChannels() { return Object.keys(F.channels).map(chan); }
  function names(ids) {
    var n = ids.map(function (id) { return chan(id).name; });
    return n.length < 3 ? n.join(" and ") : n.slice(0, -1).join(", ") + " and " + n[n.length - 1];
  }
  function title(r) {
    if (SINGLE) return chan(r.channels[0]).name;
    if (r.name) return r.name;
    if (r.context) { var t = r.context.split(/[.!?]/)[0].trim(); return t.length > 40 ? t.slice(0, 39).trim() + "…" : t; }
    return names(r.channels);
  }

  function initState() {
    var m = {}, nosave = !!ss("ir_nosave");
    R.ideas.forEach(function (x) {
      var s = {};
      if (x.state === "saved" && !nosave) s.saved = true;
      if (x.state === "hidden") { s.hidden = true; if (x.reason) s.reason = x.reason; }
      m[x.id] = s;
    });
    return m;
  }
  function states() { return json("ir_state", null) || initState(); }
  function st(id) { return states()[id] || {}; }
  function setSt(id, patch) {
    var m = states(), cur = m[id] || {};
    for (var k in patch) { if (patch[k] == null) delete cur[k]; else cur[k] = patch[k]; }
    m[id] = cur;
    put("ir_state", m);
  }

  function live(r) {
    if (!r.session || r.status !== "running" || Date.now() - r.at < RUN_MS) return r;
    var c = {};
    for (var k in r) c[k] = r[k];
    c.status = "done";
    c.ideas = r.pending;
    return c;
  }
  function runs() {
    var gone = json("ir_deleted", []), now = Date.now();
    var base = ss("ir_empty") ? [] : R.runs.map(function (r) {
      var c = {};
      for (var k in r) c[k] = r[k];
      c.at = now + r.created * 864e5 - 6e4;
      if (SINGLE && r.channels.length > 1) {
        c.channels = r.channels.slice(0, 1);
        c.ideas = r.ideas.filter(function (id) { return idea(id).for === c.channels[0]; });
      }
      return c;
    });
    return json("ir_new", []).concat(base)
      .filter(function (r) { return gone.indexOf(r.id) === -1; })
      .map(live)
      .sort(function (a, b) { return b.at - a.at; });
  }
  function runById(id) { return runs().filter(function (r) { return r.id === id; })[0] || null; }
  function busyFor(ch) { return runs().some(function (r) { return r.status === "running" && r.channels.indexOf(ch) !== -1; }); }
  function unseen(r) {
    if (r.status !== "done" || json("ir_seen", []).indexOf(r.id) !== -1) return false;
    return !!(r.unseen || r.session);
  }
  function seen(id) { var l = json("ir_seen", []); if (l.indexOf(id) === -1) { l.push(id); put("ir_seen", l); } }
  function dateOf(r) { return K.dateLabel(new Date(r.at)); }
  function savedList(list) {
    var out = [], f = filterVal(list);
    list.forEach(function (r) {
      if (r.status !== "done") return;
      r.ideas.forEach(function (id) {
        var s = st(id), i = idea(id);
        if (s.saved && !s.hidden && (f === "all" || i.for === f)) out.push({ i: i, r: r });
      });
    });
    return out;
  }

  // ---- selection and filter
  function selection(list) {
    var p = params();
    if (p.get("view") === "saved") return "saved";
    var id = p.get("run");
    if (id && list.some(function (r) { return r.id === id; })) return id;
    var f = filterVal(list), pool = list.filter(function (r) { return f === "all" || r.channels.indexOf(f) !== -1; });
    var first = pool.filter(function (r) { return r.status === "done"; })[0] || pool[0];
    return first ? first.id : null;
  }
  var beforeSaved = null;
  function select(v) {
    var p = params();
    if (p.get("run") && v === "saved") beforeSaved = p.get("run");
    p.delete("run"); p.delete("view");
    if (v === "saved") p.set("view", "saved"); else if (v) p.set("run", v);
    setParams(p);
    render();
  }
  function listChannels(list) {
    var ids = [];
    list.forEach(function (r) { r.channels.forEach(function (c) { if (ids.indexOf(c) === -1) ids.push(c); }); });
    return ids.map(chan);
  }
  function filterVal(list) {
    var f = ss("ir_filter");
    return f && list.some(function (r) { return r.channels.indexOf(f) !== -1; }) ? f : "all";
  }

  // ---- left pane
  function avaStack(ids) {
    var more = ids.length - 3;
    return '<span class="nv-avas" aria-hidden="true">' + ids.slice(0, 3).map(function (id) { return K.ava(chan(id)); }).join("") +
      (more > 0 ? '<span class="an-chan__ava nv-avas__more">+' + more + "</span>" : "") + "</span>";
  }
  function fitChannels() {
    host.querySelectorAll("[data-ir-chs]").forEach(function (el) {
      var more = +el.getAttribute("data-ir-more");
      if (!more) return;
      el.innerHTML = '<span class="nv-rrow__chn">' + esc(el.getAttribute("title")) + "</span>";
      var full = el.firstChild;
      if (full.scrollWidth <= full.clientWidth) return;
      el.innerHTML = '<span class="nv-rrow__chn">' + esc(el.getAttribute("data-ir-chs")) + '</span><span class="nv-rrow__more">+' + more + "</span>";
    });
  }
  window.addEventListener("resize", function () { if (host) fitChannels(); });
  function rowStatus(r) {
    if (r.status === "running") return '<span class="nv-rrow__st"><span class="an-blank__spin" aria-hidden="true"></span>Running</span>';
    if (r.status === "failed") return '<span class="nv-rrow__st nv-rrow__st--bad">Failed</span>';
    return '<span class="nv-rrow__st">' + UI.plural(r.ideas.length, "idea", "ideas") + "</span>";
  }
  function rowHtml(r, cur) {
    var on = r.id === cur;
    return '<a class="nv-rrow' + (on ? " is-current" : "") + '" href="?run=' + esc(r.id) + '" data-ir-sel="' + esc(r.id) + '"' + (on ? ' aria-current="true"' : "") + ">" +
      '<span class="nv-rrow__tx"><span class="nv-rrow__h"><span class="nv-rrow__n">' + esc(title(r)) + "</span>" +
        (unseen(r) && !on ? '<span class="nv-dot" role="img" aria-label="New ideas"></span>' : "") + rowStatus(r) + "</span>" +
        '<span class="nv-rrow__m">' + avaStack(r.channels) + '<span class="nv-rrow__chs" data-ir-chs="' + esc(chan(r.channels[0]).name) + '" data-ir-more="' + (r.channels.length - 1) + '" title="' + esc(names(r.channels)) + '"><span class="nv-rrow__chn">' + esc(names(r.channels)) + "</span></span><span>" + dateOf(r) + "</span></span></span></a>";
  }
  function sideHtml(list, cur) {
    var n = savedList(list).length, f = filterVal(list), chs = listChannels(list);
    var shown = list.filter(function (r) { return f === "all" || r.channels.indexOf(f) !== -1; });
    var curRun = cur !== "saved" ? list.filter(function (r) { return r.id === cur; })[0] : null;
    var pickView = curRun ? UI.selectValue({ label: title(curRun), sub: dateOf(curRun) }) : UI.selectValue({ label: "Saved ideas (" + n + ")" });
    var fView = f === "all" ? UI.selectValue({ label: "All channels" }) : UI.selectValue({ label: chan(f).name, avatar: chan(f) });
    return '<div class="nv-ir__pick">' + UI.selectHtml('data-ir-pick data-lv-sel="irPick"', pickView, { label: "Search" }) + "</div>" +
      '<div class="nv-ir__list">' +
        (chs.length > 1 ? '<div class="nv-ir__filter">' + UI.selectHtml('data-ir-filter data-lv-sel="irFilter"', fView, { label: "Channel" }) + "</div>" : "") +
        '<nav class="nv-ir__runs" aria-label="Searches">' + (shown.map(function (r) { return rowHtml(r, cur); }).join("") || '<p class="nv-note">No searches for this channel</p>') + "</nav>" +
      "</div>";
  }

  // ---- right pane
  function offBtn(label, mode, attrs, icon, reason) {
    var h = btn(label, mode, attrs + (reason ? ' aria-disabled="true" data-tip="' + esc(reason) + '"' : ""), icon);
    return reason ? h.replace('class="an-btn', 'class="is-off an-btn') : h;
  }
  function busyIn(ids) { return ids.filter(busyFor); }
  function againReason(r) {
    var b = busyIn(r.channels);
    if (b.length) return "A search for " + chan(b[0]).name + " is in progress";
    if (!K.runsLeftN()) return "No runs left this month";
    return "";
  }
  function chanChip(id) { var c = chan(id); return '<span class="an-chan__left nv-chan">' + K.ava(c) + '<span class="an-chan__name">' + esc(c.name) + "</span></span>"; }
  function optsLine(r) {
    var fm = FORMATS.filter(function (f) { return r.formats.indexOf(f[0]) !== -1; }).map(function (f) { return '<span class="ml-tag ml-tag--sm ml-tag--pill ml-tag--muted">' + f[1] + "</span>"; }).join("");
    return "<span>Searched on " + dateOf(r) + "</span>" + fm + "<span>" + esc(r.region) + ", " + esc(r.language) + "</span>";
  }
  function runHead(r) {
    var ctx = "", key = "ctx-" + r.id, running = r.status === "running";
    if (r.context && r.context !== title(r)) {
      ctx = '<div class="nv-rctx"><p class="nv-clamp" data-nv-clamp="' + key + '">' + esc(r.context) + "</p>" +
        '<button class="nv-more" type="button" data-nv-more="' + key + '" aria-expanded="false" hidden>More</button></div>';
    }
    return '<div class="nv-rhead"><div class="nv-rhead__l">' +
        '<h2 class="nv-rhead__t">' + esc(title(r)) + "</h2>" +
        '<div class="nv-meta nv-rhead__chs">' + r.channels.map(chanChip).join("") + "</div>" +
        '<div class="nv-rhead__opts nv-meta">' + optsLine(r) + "</div>" + ctx + "</div>" +
      '<div class="nv-rhead__acts">' +
        (running ? "" : (r.status === "failed" ? "" : offBtn("Search again", "secondary", 'data-ir-again="' + esc(r.id) + '"', "nv-restore", againReason(r))) +
          btn("Edit search", "secondary", 'data-ir-edit="' + esc(r.id) + '" aria-haspopup="dialog"')) +
        btn(running ? "Cancel search" : "Delete", "secondary", 'data-ir-del="' + esc(r.id) + '"') +
      "</div></div>";
  }
  function ideaCard(i, from, labeled) {
    var s = st(i.id), c = chan(i.for);
    if (s.hidden && JUST[i.id]) return hiddenCard(i, s);
    return K.ideaCard({
      idea: i, domId: "idea-" + esc(i.id), chan: labeled ? c : null,
      quick: K.iconBtn(s.saved ? "nv-bookmark-on" : "nv-bookmark", "Save", 'aria-pressed="' + !!s.saved + '" data-ir-save="' + esc(i.id) + '"', "nv-act" + (s.saved ? " is-on" : "")) +
        (from ? "" : K.iconBtn("nv-dislike", "Not relevant", 'data-ir-hide="' + esc(i.id) + '"', "nv-act")),
      title: esc(i.title),
      fitsLabel: c.own ? "Why it fits your channel" : "Why it fits this channel",
      from: from ? '<a class="nv-from" href="?run=' + esc(from.id) + '" data-ir-sel="' + esc(from.id) + '">From “' + esc(title(from)) + "” on " + dateOf(from) + "</a>" : "",
      copy: 'data-ir-copy="' + esc(i.id) + '"'
    });
  }
  function hiddenCard(i, s) {
    return '<article class="nv-idea nv-idea--hidden" id="idea-' + esc(i.id) + '">' +
      '<div class="nv-hid"><span class="nv-hid__t">Hidden</span><span class="nv-hid__name">' + esc(i.title) + "</span></div>" +
      '<div class="nv-chips" role="group" aria-label="Reason">' + F.dislikeReasons.map(function (x) {
        var on = s.reason === x;
        return '<button class="nv-chip' + (on ? " is-on" : "") + '" type="button" aria-pressed="' + on + '" data-ir-reason="' + esc(i.id) + '" data-ir-reason-v="' + esc(x) + '">' + esc(x) + "</button>";
      }).join("") + "</div></article>";
  }
  function hiddenBlock(r, hid) {
    if (!hid.length) return "";
    var open = !!HID[r.id];
    return '<div class="nv-hidden"><button class="nv-hidden__t" type="button" aria-expanded="' + open + '" aria-controls="irHidden" data-ir-hidden="' + esc(r.id) + '">' +
        use("nv-chevron") + "Hidden (" + hid.length + ")</button>" +
      '<div class="rp-card" id="irHidden"' + (open ? "" : " hidden") + ">" + hid.map(function (i) {
        var s = st(i.id);
        return '<div class="nv-hrow">' + K.formatTag(i) + '<span class="nv-hrow__t">' + esc(i.title) + "</span>" +
          (s.reason ? '<span class="ml-tag ml-tag--sm ml-tag--pill ml-tag--quiet">' + esc(s.reason) + "</span>" : "") +
          btn("Restore", "secondary", 'data-ir-restore="' + esc(i.id) + '"', "nv-restore", "tiny") + "</div>";
      }).join("") + "</div></div>";
  }
  function segFilter(state, key, label, attr, opts, items, field) {
    var avail = opts.filter(function (o) { return items.some(function (i) { return i[field] === o[0]; }); });
    var cur = avail.length > 1 && state[key] && avail.some(function (o) { return o[0] === state[key]; }) ? state[key] : "all";
    var html = avail.length > 1 ? '<div class="an-ctype" role="group" aria-label="' + label + '">' + [["all", "All"]].concat(avail).map(function (o) {
      var on = o[0] === cur;
      return '<button class="an-ctype__btn' + (on ? " is-on" : "") + '" type="button" aria-pressed="' + on + '" ' + attr + '="' + esc(o[0]) + '">' + esc(o[1]) + "</button>";
    }).join("") + "</div>" : "";
    return { html: html, items: items.filter(function (i) { return cur === "all" || i[field] === cur; }) };
  }
  function rbar(filters, savedOn) {
    var n = savedList(runs()).length;
    return '<div class="nv-rbar">' + (filters ? '<div class="nv-rbar__f">' + filters + "</div>" : "") +
      '<button class="an-btn an-btn--secondary an-btn--small nv-ir__saved" type="button" aria-pressed="' + savedOn + '" data-ir-saved>' + use("nv-bookmark") + "Saved (" + n + ")</button></div>";
  }
  function runBody(r) {
    if (r.status === "running") {
      var left = r.session ? Math.max(1, Math.ceil((RUN_MS - (Date.now() - r.at)) / (RUN_MS / 2))) : 2;
      return '<div class="nv-genrow" role="status"><span class="an-blank__spin" aria-hidden="true"></span>' +
        '<span class="nv-genrow__tx">Writing ideas for ' + esc(names(r.channels)) + '</span><span class="nv-genrow__eta">About ' + left + " min</span></div>" +
        '<div class="nv-ideas" aria-hidden="true">' + K.skelCards(4) + "</div>";
    }
    if (r.status === "failed") {
      return '<div class="nv-genrow nv-genrow--error" role="alert">' + use("nv-alert") +
        '<span class="nv-genrow__tx">Couldn’t finish at “' + esc(R.stages[r.stage]) + "”</span>" +
        offBtn("Try again", "secondary", 'data-ir-again="' + esc(r.id) + '"', null, againReason(r)).replace("an-btn--small", "an-btn--tiny") + "</div>";
    }
    var all = r.ideas.map(idea);
    var hid = all.filter(function (i) { return st(i.id).hidden && !JUST[i.id]; });
    var vis = all.filter(function (i) { return !st(i.id).hidden || JUST[i.id]; });
    if (!vis.length) {
      return rbar("", false) +
        '<section class="an-blank"><span class="an-blank__ico">' + use("nv-dislike") + "</span>" +
        '<p class="an-blank__title">All ideas in this search are hidden</p>' +
        '<div class="an-head__btns">' + btn("Show hidden", "secondary", 'data-ir-showhid="' + esc(r.id) + '"') +
          offBtn("Search again", "primary", 'data-ir-again="' + esc(r.id) + '"', "nv-restore", againReason(r)) + "</div></section>" +
        hiddenBlock(r, hid);
    }
    var multi = r.channels.length > 1;
    var byCh = segFilter(CHF, r.id, "Channel", "data-ir-chf", r.channels.map(function (id) { return [id, chan(id).name]; }), vis, "for");
    var byFmt = segFilter(FMT, r.id, "Format", "data-ir-fmt", FORMATS, byCh.items, "format");
    return rbar(byCh.html + byFmt.html, false) +
      '<div class="nv-ideas">' + byFmt.items.map(function (i) { return ideaCard(i, null, multi); }).join("") + "</div>" + hiddenBlock(r, hid);
  }
  function savedView(list) {
    var items = savedList(list), f = filterVal(list), from = {};
    items.forEach(function (x) { from[x.i.id] = x.r; });
    var byFmt = segFilter(FMT, "saved", "Format", "data-ir-fmt", FORMATS, items.map(function (x) { return x.i; }), "format");
    return '<div class="nv-rhead"><div class="nv-rhead__l"><h2 class="nv-rhead__t">Saved ideas' + (f !== "all" ? " for " + esc(chan(f).name) : "") + "</h2></div></div>" +
      rbar(byFmt.html, true) +
      (items.length ? '<div class="nv-ideas">' + byFmt.items.map(function (i) { return ideaCard(i, from[i.id], true); }).join("") + "</div>"
        : '<section class="an-blank"><span class="an-blank__ico">' + use("nv-bookmark") + '</span><p class="an-blank__text">Save ideas from any search to keep them here.</p></section>');
  }

  // ---- page
  var hashDone = false;
  function focusKey() {
    var a = document.activeElement;
    if (!a || !host.contains(a)) return null;
    for (var i = 0; i < a.attributes.length; i++) {
      var n = a.attributes[i].name;
      if (n.indexOf("data-ir-") === 0 && n !== "data-ir-reason-v") return "[" + n + '="' + a.attributes[i].value + '"]' + (a.getAttribute("data-ir-reason-v") ? '[data-ir-reason-v="' + a.getAttribute("data-ir-reason-v") + '"]' : "");
    }
    return null;
  }
  function render() {
    document.title = "Ideas — SubSub";
    var fk = focusKey(), list = runs();
    if (!hashDone && /^#idea-/.test(location.hash)) {
      var want = location.hash.slice(6), owner = list.filter(function (r) { return r.ideas.indexOf(want) !== -1; })[0];
      if (owner) { var p = params(); p.delete("view"); p.set("run", owner.id); setParams(p); }
    }
    var cur = selection(list), cp = params();
    if (cur && cur !== "saved" && cp.get("run") !== cur) { cp.delete("view"); cp.set("run", cur); setParams(cp); }
    var head = '<div class="an-head an-head--between"><div class="an-head__left"><h1 class="an-title">Ideas</h1></div>' +
      (list.length ? '<div class="an-head__btns">' + btn("New search", "primary", 'data-ir-new aria-haspopup="dialog"', "nv-plus") + "</div>" : "") + "</div>";
    if (!list.length) {
      host.innerHTML = head + '<section class="an-blank"><span class="an-blank__ico">' + use("nv-bulb") + "</span>" +
        '<p class="an-blank__title">No searches yet</p>' +
        '<p class="an-blank__text">A search studies one or more channels and channels like them, then writes video ideas from what worked for them.</p>' +
        btn("New search", "primary", 'data-ir-new aria-haspopup="dialog"', "nv-plus") + "</section>";
    } else {
      var r = cur === "saved" ? null : list.filter(function (x) { return x.id === cur; })[0];
      if (r && r.status === "done") seen(r.id);
      host.innerHTML = head + '<div class="nv-ir"><div class="nv-ir__side">' + sideHtml(list, cur) + "</div>" +
        '<section class="nv-ir__main" aria-label="' + (r ? "Search" : "Saved ideas") + '">' + (r ? runHead(r) + runBody(r) : savedView(list)) + "</section></div>";
    }
    K.applyLayout();
    fitChannels();
    if (fk) { var el = host.querySelector(fk); if (el) el.focus(); }
    if (!hashDone && location.hash) {
      hashDone = true;
      var target = /^#idea-/.test(location.hash) ? document.getElementById(location.hash.slice(1)) : null;
      if (target) {
        target.scrollIntoView({ block: "center" });
        target.classList.add("is-hl");
        setTimeout(function () { target.classList.remove("is-hl"); }, 1600);
      }
    }
  }
  var tickKey = null;
  setInterval(function () {
    var k = runs().map(function (r) { return r.id + r.status; }).join();
    if (tickKey === null) { tickKey = k; return; }
    if (k === tickKey) return;
    if (document.querySelector(".an-modal.is-open") || document.querySelector("[data-lv-selpop]:not([hidden])") || document.querySelector("[data-lv-menu]:not([hidden])")) return;
    tickKey = k;
    render();
  }, 1000);

  // ---- search actions
  function baseId(id) { var p = id.split("~"); return p[p.length - 1]; }
  function template(chs, formats) {
    var per = Math.max(3, Math.floor(10 / chs.length)), out = [], done = runs().filter(function (r) { return r.status === "done" && r.ideas.length; });
    chs.forEach(function (ch) {
      var mine = [];
      done.forEach(function (r) { r.ideas.forEach(function (id) { var i = idea(id); if (i && i.for === ch && mine.indexOf(baseId(id)) === -1) mine.push(baseId(id)); }); });
      if (!mine.length && done[0]) mine = done[0].ideas.map(baseId);
      var fit = mine.filter(function (id) { return BASE[id] && formats.indexOf(BASE[id].format) !== -1; });
      (fit.length >= 3 ? fit : mine).slice(0, per).forEach(function (id) { out.push(ch + "~" + id); });
    });
    return out.slice(0, 10);
  }
  function startRun(o) {
    var id = "s" + Date.now().toString(36);
    var run = { id: id, session: true, name: o.name || "", channels: o.channels.slice(), formats: o.formats.slice(),
      region: o.region, language: o.language, context: o.context || "", at: Date.now(), created: 0, status: "running", stage: 2, ideas: [] };
    run.pending = template(o.channels, o.formats).map(function (x) { return id + "~" + x; });
    var l = json("ir_new", []);
    l.unshift(run);
    put("ir_new", l);
    ss("nv_runs_used", String(Number(ss("nv_runs_used") || 0) + 1));
    if (ss("ir_filter") && o.channels.indexOf(ss("ir_filter")) === -1) ss("ir_filter", null);
    select(id);
    var h = host.querySelector(".nv-rhead__t");
    if (h) { h.setAttribute("tabindex", "-1"); h.focus(); }
  }
  function deleteRun(id, msg) {
    var list = runs(), idx = list.map(function (r) { return r.id; }).indexOf(id), next = list[idx + 1] || list[idx - 1];
    var gone = json("ir_deleted", []);
    gone.push(id);
    put("ir_deleted", gone);
    var p = params();
    if (p.get("run") === id || selection(list) === id) select(next ? next.id : null); else render();
    K.toastUndo(msg || "Search deleted", function () {
      put("ir_deleted", json("ir_deleted", []).filter(function (x) { return x !== id; }));
      select(id);
    });
  }
  function hideIdea(id) {
    setSt(id, { hidden: true, saved: null });
    JUST[id] = true;
    render();
    var chip = host.querySelector('[data-ir-reason="' + id + '"]');
    if (chip) chip.focus();
    K.toastUndo("Hidden", function () {
      setSt(id, { hidden: null, reason: null });
      delete JUST[id];
      render();
      var b = host.querySelector('[data-ir-hide="' + id + '"]');
      if (b) b.focus();
    });
  }

  // ---- New search dialog
  var D = null;
  function lastFor(ch) { return runs().filter(function (r) { return r.channels.indexOf(ch) !== -1; })[0] || null; }
  function localeOf(ch) { return R.locale[ch] || ["United States", "English"]; }
  function prefill() {
    var ch = D.channels[0], prev = ch ? lastFor(ch) : null, loc = localeOf(ch || "");
    D.formats = prev ? prev.formats.slice() : ["video", "short"];
    D.region = prev ? prev.region : loc[0];
    D.language = prev ? prev.language : loc[1];
  }
  function openDialog(from, opts) {
    opts = opts || {};
    D = { name: "", channels: [], chIn: "", chErr: "", fmtErr: false, context: "" };
    if (from) {
      D.name = from.name || ""; D.channels = from.channels.slice();
      D.formats = from.formats.slice();
      D.region = from.region; D.language = from.language; D.context = from.context || "";
    } else {
      var f = filterVal(runs());
      if (opts.channels) D.channels = opts.channels.slice(0, MAX_CH);
      else if (opts.ch !== null) D.channels = [opts.ch || (f !== "all" ? f : ownChannels()[0].id)];
      prefill();
      if (opts.chIn) { D.chIn = opts.chIn; D.chErr = LINK_ERR; }
    }
    if (SINGLE && D.channels[0] && !D.chIn) D.chIn = F.channels[D.channels[0]] ? chan(D.channels[0]).name : "youtube.com/@" + D.channels[0];
    K.modal("irRun", from ? "Edit search" : "New search", "", "", " an-modal__dialog--lg nv-rundlg");
    drender();
    dfocus(opts.ch === null || SINGLE ? "#irChIn" : "#irName");
  }
  function dsync() {
    var m = document.getElementById("irRun");
    if (!m) return;
    [["#irName", "name"], ["#irChIn", "chIn"], ["#irCtx", "context"]].forEach(function (x) {
      var el = m.querySelector(x[0]);
      if (el) D[x[1]] = el.value;
    });
  }
  function singlePicker() {
    return '<div class="ai-field"><label class="ai-lbl" for="irChIn">Channel</label><div class="nv-sim" id="irChField">' + comboHtml() + "</div></div>";
  }
  function comboHtml() {
    var sel = D.channels[0], c = sel ? chan(sel) : null;
    return '<div class="nv-combo' + (c ? " nv-combo--ava" : "") + '">' + (c ? '<span class="nv-combo__ava">' + K.ava(c) + "</span>" : "") +
        '<input class="an-input' + (D.chErr ? " lv-inv" : "") + '" id="irChIn" type="text" role="combobox" aria-expanded="false" aria-controls="irChList" aria-autocomplete="list" value="' + esc(D.chIn) +
          '" placeholder="Pick your channel or paste a link" autocomplete="off" />' +
        '<span class="nv-combo__chev" aria-hidden="true">' + use("nv-chevron") + "</span>" +
        '<div class="lv-pop an-select__pop nv-combo__pop" id="irChList" role="listbox" aria-label="Your channels" hidden></div></div>' +
      (D.chErr ? '<span class="nv-lnk nv-lnk--err" role="alert">' + esc(D.chErr) + "</span>"
        : D.chMissing ? '<span class="nv-lnk nv-lnk--err" role="alert">Pick a channel or paste a link.</span>' : "");
  }
  var ACT = -1;
  function looksLink(v) { return /[\/@.]/.test(v); }
  function comboOpts() {
    var input = document.getElementById("irChIn"), q = input ? input.value.trim().toLowerCase() : "";
    var sel = D.channels[0], all = ownChannels();
    if (sel && F.channels[sel] && q === chan(sel).name.toLowerCase()) q = "";
    var own = all.filter(function (c) { return !q || c.name.toLowerCase().indexOf(q) !== -1; });
    var opts = own.map(function (c) { return { id: c.id, c: c }; });
    if (!own.length && q && looksLink(q)) opts.push({ id: "link" });
    return opts;
  }
  function comboOpen() {
    var pop = document.getElementById("irChList"), input = document.getElementById("irChIn");
    if (!pop || !input) return;
    var opts = comboOpts(), sel = D.channels[0], q = input.value.trim();
    if (ACT >= opts.length) ACT = opts.length - 1;
    pop.innerHTML = '<div class="an-select__list">' + (opts.length ? opts.map(function (o, i) {
      var on = o.id === sel;
      return '<button class="an-select__opt' + (on ? " is-selected" : "") + (i === ACT ? " is-active" : "") + (o.id === "link" ? " an-select__opt--act" : "") +
        '" type="button" role="option" tabindex="-1" id="irChOpt' + i + '" aria-selected="' + on + '" data-ir-opt="' + esc(o.id) + '">' +
        (o.c ? K.ava(o.c) + '<span class="an-select__txt"><span class="an-select__lbl">' + esc(o.c.name) + "</span></span>"
          : '<span class="an-select__ico">' + use("nv-external") + '</span><span class="an-select__txt"><span class="an-select__lbl">Use this link</span></span>') +
        (on ? '<span class="an-select__tick">' + (UI.checkIcon || "") + "</span>" : "") + "</button>";
    }).join("") : '<div class="an-select__empty">No channel with this name</div>') + "</div>" +
      (q && looksLink(q) ? "" : '<p class="nv-combo__hint">Or paste a link to any channel</p>');
    pop.hidden = false;
    input.setAttribute("aria-expanded", "true");
    if (ACT >= 0) input.setAttribute("aria-activedescendant", "irChOpt" + ACT); else input.removeAttribute("aria-activedescendant");
  }
  function comboClose() {
    var pop = document.getElementById("irChList"), input = document.getElementById("irChIn");
    if (pop) pop.hidden = true;
    if (input) { input.setAttribute("aria-expanded", "false"); input.removeAttribute("aria-activedescendant"); }
    ACT = -1;
  }
  function comboPick(id) {
    if (id === "link") { dsync(); commitText(true); }
    else { D.channels = [id]; D.chIn = chan(id).name; D.chErr = ""; D.chMissing = false; prefill(); }
    ACT = -1;
    drender();
  }
  function commitText(withPrefill) {
    var v = (D.chIn || "").trim(), prev = D.channels[0];
    D.chErr = "";
    if (!v) { D.channels = []; return true; }
    var own = ownChannels().filter(function (c) { return c.name.toLowerCase() === v.toLowerCase(); })[0];
    if (own) { D.channels = [own.id]; D.chIn = own.name; }
    else {
      var r = K.resolveLink(v);
      if (!r || r.err) { D.channels = []; D.chErr = LINK_ERR; return false; }
      D.channels = [r.handle];
    }
    D.chMissing = false;
    if (withPrefill && D.channels[0] !== prev) prefill();
    return true;
  }
  function chip(id, attr) {
    var c = chan(id);
    return '<span class="nv-chip nv-sim__chip">' + K.ava(c) + esc(c.name) +
      '<button class="nv-sim__x" type="button" aria-label="Remove ' + esc(c.name) + '" ' + attr + '="' + esc(id) + '">' + use("nv-x") + "</button></span>";
  }
  function linkRow(id, value, err, label, addAttr) {
    return '<div class="nv-links__row"><input class="an-input' + (err ? " lv-inv" : "") + '" id="' + id + '" type="text" value="' + esc(value) +
        '" placeholder="youtube.com/@channel" autocomplete="off" aria-label="' + label + '" />' + btn("Add", "secondary", addAttr) + "</div>" +
      (err ? '<span class="nv-lnk nv-lnk--err" role="alert">' + esc(err) + "</span>" : "");
  }
  function drender() {
    var m = document.getElementById("irRun");
    if (!m || !D) return;
    var busy = busyIn(D.channels), noRuns = !K.runsLeftN();
    var chFull = D.channels.length >= MAX_CH;
    var freeOwn = ownChannels().filter(function (c) { return D.channels.indexOf(c.id) === -1; });
    m.querySelector(".an-modal__body").innerHTML = '<div class="nv-gen">' +
      (SINGLE ? "" : '<div class="ai-field"><label class="ai-lbl" for="irName">Name</label>' +
        '<input class="an-input" id="irName" type="text" value="' + esc(D.name) + '" placeholder="' + esc(D.channels.length ? names(D.channels) : "Optional") + '" autocomplete="off" /></div>') +
      (SINGLE ? singlePicker() :
      '<div class="ai-field"><div class="nv-gen__lbl"><span class="ai-lbl" id="irChL">Channels</span><span class="nv-gen__count">' + D.channels.length + " of " + MAX_CH + "</span></div>" +
        '<div class="nv-sim">' +
          (D.channels.length || (!chFull && freeOwn.length) ? '<div class="nv-chips" role="group" aria-labelledby="irChL">' +
            D.channels.map(function (id) { return chip(id, "data-ir-chrm"); }).join("") +
            (chFull ? "" : freeOwn.map(function (c) {
              return '<button class="nv-chip" type="button" data-ir-chadd="' + c.id + '">' + use("nv-plus") + K.ava(c) + esc(c.name) + "</button>";
            }).join("")) + "</div>" : "") +
          (chFull ? "" : linkRow("irChIn", D.chIn, D.chErr, "Add any channel by link", "data-ir-chlink")) +
          (D.chMissing ? '<span class="nv-lnk nv-lnk--err" role="alert">Add at least one channel.</span>' : "") +
        "</div></div>") +
      '<div class="ai-field"><span class="ai-lbl" id="irFmtL">Formats</span><div class="nv-fmts" role="group" aria-labelledby="irFmtL">' + FORMATS.map(function (f) {
        return '<label><input type="checkbox" value="' + f[0] + '" data-ir-fmtck' + (D.formats.indexOf(f[0]) !== -1 ? " checked" : "") + " />" + f[1] + "</label>";
      }).join("") + "</div>" + (D.fmtErr ? '<span class="nv-lnk nv-lnk--err" role="alert">Pick at least one format.</span>' : "") + "</div>" +
      '<div class="ai-grid ai-grid--2">' +
        '<div class="ai-field"><span class="ai-lbl">Region</span>' + UI.selectHtml('data-ir-region data-lv-sel="irRegion"', UI.selectValue({ label: D.region }), { label: "Region" }) + "</div>" +
        '<div class="ai-field"><span class="ai-lbl">Language</span>' + UI.selectHtml('data-ir-lang data-lv-sel="irLang"', UI.selectValue({ label: D.language }), { label: "Language" }) + "</div>" +
      "</div>" +
      '<div class="ai-field"><label class="ai-lbl" for="irCtx">Context</label><textarea class="an-input nc-textarea" id="irCtx" rows="3" placeholder="' + (SINGLE ? 'Where is the channel heading? Topics to avoid?' : 'Where are the channels heading? Topics to avoid?') + '">' + esc(D.context) + "</textarea></div>" +
      (busy.length ? '<div class="an-alert an-alert--attention" id="irBusy"><span>A search for ' + esc(names(busy)) + " is in progress. Start this one when it finishes.</span></div>" : "") +
      "</div>";
    var reason = busy.length ? "A search for " + names(busy) + " is in progress" : noRuns ? "No runs left this month" : "";
    m.querySelector(".an-modal__foot").innerHTML = '<span class="nv-rfoot">' + K.runsHtml() + "</span>" +
      btn("Cancel", "secondary", "data-lv-close data-nv-close") +
      offBtn("Start search", "primary", "data-ir-start" + (busy.length ? ' aria-describedby="irBusy"' : ""), null, reason);
  }
  function addChannel(id) {
    if (SINGLE) {
      if (D.channels[0] === id) return;
      D.channels = [id];
      D.chMissing = false;
      prefill();
      return;
    }
    if (D.channels.indexOf(id) !== -1 || D.channels.length >= MAX_CH) return;
    var wasEmpty = !D.channels.length;
    D.channels.push(id);
    D.chMissing = false;
    if (wasEmpty) prefill();
  }
  function addLink(field, errField, onOk) {
    var v = (D[field] || "").trim();
    if (!v) return true;
    var r = K.resolveLink(v);
    if (!r || r.err) { D[errField] = LINK_ERR; return false; }
    if (onOk(r.handle) === false) return false;
    D[field] = ""; D[errField] = "";
    return true;
  }
  function addChLink() {
    if (SINGLE) return commitText(false);
    return addLink("chIn", "chErr", function (h) { addChannel(h); });
  }
  function dfocus(sel) { setTimeout(function () { var el = document.querySelector("#irRun " + sel); if (el) el.focus(); }, 0); }
  function startFromDialog() {
    dsync();
    var ok = addChLink();
    D.chMissing = !D.channels.length;
    D.fmtErr = !D.formats.length;
    if (D.chMissing || D.fmtErr) ok = false;
    if (!ok) {
      drender();
      dfocus(D.chErr || D.chMissing ? "#irChIn" : "[data-ir-fmtck]");
      return;
    }
    var o = { name: D.name.trim(), channels: D.channels, formats: D.formats, region: D.region, language: D.language, context: D.context.trim() };
    K.closeModals();
    startRun(o);
  }

  // ---- events
  document.addEventListener("click", function (e) {
    var t = e.target, el;
    if (!t.closest) return;
    if ((el = t.closest("[data-ir-sel]"))) {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      select(el.getAttribute("data-ir-sel"));
      var row = host.querySelector('.nv-ir__list [data-ir-sel="' + el.getAttribute("data-ir-sel") + '"]');
      if (row && row.offsetParent) row.focus();
      return;
    }
    if (t.closest("[data-ir-saved]")) {
      var on = selection(runs()) === "saved";
      select(on ? (beforeSaved && runById(beforeSaved) ? beforeSaved : null) : "saved");
      var sb = host.querySelector("[data-ir-saved]");
      if (sb) sb.focus();
      return;
    }
    if ((el = t.closest("[data-ir-filter]"))) {
      var list = runs(), opts = [{ value: "all", label: "All channels", icon: use("nv-channels") }].concat(listChannels(list).map(function (c) {
        return { value: c.id, label: c.name, avatar: c };
      }));
      UI.select(el, { value: filterVal(list), label: "Channel", options: opts, onPick: function (v) { ss("ir_filter", v === "all" ? null : v); render(); } });
      return;
    }
    if ((el = t.closest("[data-ir-pick]"))) {
      var all = runs();
      UI.select(el, {
        value: selection(all), label: "Search",
        options: [{ value: "saved", label: "Saved ideas (" + savedList(all).length + ")", icon: use("nv-bookmark") }].concat(all.map(function (r) {
          return { value: r.id, label: title(r), sub: dateOf(r) };
        })),
        onPick: function (v) { select(v); }
      });
      return;
    }
    if (t.closest("[data-ir-new]")) { openDialog(null); return; }
    if ((el = t.closest("[data-ir-again]"))) {
      if (UI.isOff(el)) return;
      var ar = runById(el.getAttribute("data-ir-again"));
      if (ar) startRun(ar);
      return;
    }
    if ((el = t.closest("[data-ir-edit]"))) { if (!UI.isOff(el)) openDialog(runById(el.getAttribute("data-ir-edit"))); return; }
    if ((el = t.closest("[data-ir-del]"))) {
      var rid = el.getAttribute("data-ir-del"), mr = runById(rid);
      deleteRun(rid, mr && mr.status === "running" ? "Search cancelled" : null);
      return;
    }
    if ((el = t.closest("[data-ir-copy]"))) { K.copyText(idea(el.getAttribute("data-ir-copy")).title, el); return; }
    if ((el = t.closest("[data-ir-save]"))) {
      var sid = el.getAttribute("data-ir-save");
      setSt(sid, { saved: st(sid).saved ? null : true });
      render();
      if (!host.querySelector('[data-ir-save="' + sid + '"]')) { var h1 = host.querySelector(".nv-rhead__t"); if (h1) { h1.setAttribute("tabindex", "-1"); h1.focus(); } }
      return;
    }
    if ((el = t.closest("[data-ir-hide]"))) { hideIdea(el.getAttribute("data-ir-hide")); return; }
    if ((el = t.closest("[data-ir-reason]"))) {
      var hid = el.getAttribute("data-ir-reason"), rv = el.getAttribute("data-ir-reason-v");
      setSt(hid, { reason: st(hid).reason === rv ? null : rv });
      render();
      return;
    }
    if ((el = t.closest("[data-ir-restore]"))) {
      var rs = el.getAttribute("data-ir-restore");
      setSt(rs, { hidden: null, reason: null });
      delete JUST[rs];
      render();
      K.toast("Idea restored.");
      var hb = host.querySelector("[data-ir-restore]") || host.querySelector('[data-ir-save="' + rs + '"]');
      if (hb) hb.focus();
      return;
    }
    if ((el = t.closest("[data-ir-hidden]"))) { var hk = el.getAttribute("data-ir-hidden"); HID[hk] = !HID[hk]; render(); return; }
    if ((el = t.closest("[data-ir-showhid]"))) {
      HID[el.getAttribute("data-ir-showhid")] = true;
      render();
      var first = host.querySelector("[data-ir-restore]");
      if (first) first.focus();
      return;
    }
    if ((el = t.closest("[data-ir-fmt]"))) { FMT[selection(runs())] = el.getAttribute("data-ir-fmt"); render(); return; }
    if ((el = t.closest("[data-ir-chf]"))) { CHF[selection(runs())] = el.getAttribute("data-ir-chf"); render(); return; }

    if (!D || !t.closest("#irRun")) return;
    if ((el = t.closest("[data-ir-chadd]"))) {
      dsync(); addChannel(el.getAttribute("data-ir-chadd")); drender();
      dfocus(D.channels.length < MAX_CH ? "[data-ir-chadd], #irChIn" : "[data-ir-fmtck]");
      return;
    }
    if ((el = t.closest("[data-ir-chrm]"))) {
      dsync();
      var cr = el.getAttribute("data-ir-chrm");
      D.channels = D.channels.filter(function (h) { return h !== cr; });
      drender(); dfocus("#irChIn");
      return;
    }
    if (t.closest("[data-ir-chlink]")) { dsync(); addChLink(); drender(); dfocus("#irChIn"); return; }
    if ((el = t.closest("[data-ir-opt]"))) { comboPick(el.getAttribute("data-ir-opt")); return; }
    if (SINGLE && t.id === "irChIn") { comboOpen(); return; }
    if ((el = t.closest("[data-ir-region]")) || (el = t.closest("[data-ir-lang]"))) {
      dsync();
      var isRegion = el.hasAttribute("data-ir-region"), src = isRegion ? R.regions : R.languages;
      UI.select(el, {
        value: isRegion ? D.region : D.language, label: isRegion ? "Region" : "Language",
        options: src.map(function (x) { return { value: x, label: x }; }),
        onPick: function (v) { if (isRegion) D.region = v; else D.language = v; drender(); }
      });
      return;
    }
    if ((el = t.closest("[data-ir-start]"))) { if (!UI.isOff(el)) startFromDialog(); }
  });
  document.addEventListener("change", function (e) {
    var t = e.target;
    if (!D || !t.closest || !t.closest("#irRun")) return;
    if (SINGLE && t.id === "irChIn") {
      dsync(); commitText(false);
      var fld = document.getElementById("irChField");
      if (fld) fld.innerHTML = comboHtml();
      return;
    }
    if (t.hasAttribute("data-ir-fmtck")) {
      dsync();
      D.formats = [].slice.call(document.querySelectorAll("#irRun [data-ir-fmtck]:checked")).map(function (x) { return x.value; });
      D.fmtErr = false;
    }
  });
  document.addEventListener("input", function (e) {
    var t = e.target;
    if (!D) return;
    [["irChIn", "chErr"]].forEach(function (x) {
      if (t.id !== x[0] || !D[x[1]]) return;
      D[x[1]] = "";
      t.classList.remove("lv-inv");
      var er = t.parentNode.nextElementSibling;
      if (er && er.classList.contains("nv-lnk--err")) er.remove();
    });
  });
  document.addEventListener("keydown", function (e) {
    var t = e.target;
    if (!D || e.key !== "Enter" || !t.closest || !t.closest("#irRun")) return;
    if (t.id === "irChIn" && !SINGLE) { e.preventDefault(); dsync(); addChLink(); drender(); dfocus("#irChIn"); }
  });
  document.addEventListener("keydown", function (e) {
    var t = e.target;
    if (!SINGLE || !D || t.id !== "irChIn") return;
    var pop = document.getElementById("irChList"), open = pop && !pop.hidden, n = comboOpts().length;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      ACT = !open ? (e.key === "ArrowDown" ? 0 : n - 1) : (ACT + (e.key === "ArrowDown" ? 1 : -1) + n) % Math.max(n, 1);
      comboOpen();
    } else if (e.key === "Enter") {
      e.preventDefault();
      var o = open && ACT >= 0 ? comboOpts()[ACT] : null;
      if (o) comboPick(o.id);
      else { dsync(); commitText(true); comboClose(); drender(); dfocus("#irChIn"); }
    } else if (e.key === "Escape" && open) {
      e.preventDefault(); e.stopPropagation(); comboClose();
    }
  }, true);
  document.addEventListener("input", function (e) {
    if (!SINGLE || !D || e.target.id !== "irChIn") return;
    ACT = -1;
    comboOpen();
  });
  document.addEventListener("mousedown", function (e) {
    if (!SINGLE || !D || !e.target.closest) return;
    if (e.target.closest("#irChList")) { e.preventDefault(); return; }
    if (!e.target.closest(".nv-combo")) comboClose();
  });
  document.addEventListener("focusout", function (e) {
    if (SINGLE && e.target.id === "irChIn") comboClose();
  });

  window.V2Ideas = { render: render };
  render();

  if (DLG) setTimeout(function () {
    if (DLG === "edit") openDialog(runById("zems-2"));
    else if (DLG === "link") openDialog(null, { ch: null });
    else if (DLG === "pick") { openDialog(null); setTimeout(comboOpen, 40); }
    else if (DLG === "invalid") openDialog(null, { ch: null, chIn: "youtube.com/watch?v=Xb7k2pQ" });
    else if (DLG === "busy") openDialog(null, { channels: ["zems", "hunt"] });
    else if (DLG === "noruns") { ss("nv_runs_used", String(F.generation.runsLeft)); openDialog(null, { ch: "zems" }); }
    else openDialog(null, { ch: "zems" });
  }, 50);
})();

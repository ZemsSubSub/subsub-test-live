// Navigation v2: search palette. Opens with Cmd/Ctrl+K or the header field; one client-side index over the
// prototype's mock data (V2_FIXTURES at runtime, V2_SEARCH from build/build-search.js).
(function () {
  var K = window.V2_KIT, F = window.V2_FIXTURES, S = window.V2_SEARCH, UI = window.LVUI;
  if (!K || !F || !S) return;
  var esc = K.esc, use = K.use, qp = new URLSearchParams(location.search);
  var FILE = (location.pathname.split("/").pop() || "home.html").toLowerCase();
  var MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  var MOD = MAC ? "⌘" : "Ctrl ";
  var mobileMq = window.matchMedia ? window.matchMedia("(max-width: 959px)") : null;
  function mobile() { return !!(mobileMq && mobileMq.matches); }

  // =========================================================== text matching
  function norm(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[“”"’']/g, "").trim(); }
  function words(s) { return norm(s).split(/[\s\-_.,:;!?()\/|+#]+/).filter(Boolean); }
  function oneEdit(a, b) {
    if (a === b) return true;
    var la = a.length, lb = b.length;
    if (Math.abs(la - lb) > 1) return false;
    var i = 0, j = 0, diff = 0;
    while (i < la && j < lb) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++diff > 1) return false;
      if (la > lb) i++; else if (lb > la) j++; else if (a[i + 1] === b[j] && a[i] === b[j + 1]) { i += 2; j += 2; } else { i++; j++; }
    }
    return diff + (la - i) + (lb - j) <= 1;
  }
  function tokHits(tok, w) {
    if (w.indexOf(tok) === 0) return true;
    if (tok.length <= 4) return false;
    return oneEdit(tok, w) || (w.length > tok.length && oneEdit(tok, w.slice(0, tok.length)));
  }
  function allTok(toks, ws) { return toks.every(function (t) { return ws.some(function (w) { return tokHits(t, w); }); }); }

  // =========================================================== account and role
  var acct = K.account ? K.account() : { key: "default", role: "owner", streams: [], fanFunding: { hasPage: false } };
  if (qp.get("account") && F.accounts && F.accounts[qp.get("account")]) acct = Object.assign({ key: qp.get("account") }, F.accounts[qp.get("account")]);
  var IS_USER = acct.role === "user" || qp.get("role") === "user";
  function isAdmin() { return K.ss("nv_admin") === "1"; }
  function balanceNow() { return acct.key === "default" && K.walletBalance ? K.walletBalance() : acct.balance; }

  // =========================================================== recent, session-wide
  var SEED = ["stream:s1", "file:Forza Chill Ride 01.mp4", "channel:hunt"];
  function recent() { var l = K.ssList("nv_search_recent"); return l.length ? l : SEED.slice(); }
  function pushRecent(key) {
    var l = recent().filter(function (k) { return k !== key; });
    l.unshift(key);
    K.ss("nv_search_recent", JSON.stringify(l.slice(0, 5)));
  }
  var RECENT_TYPES = { stream: 1, schedule: 1, file: 1, channel: 1, idea: 1, report: 1 };

  // =========================================================== helpers for rows and previews
  function icoBox(icon) { return '<span class="nv-cmdk__ico">' + use(icon) + "</span>"; }
  function thumb(src) { return '<span class="nv-cmdk__thumb"><img src="' + esc(src) + '" alt="" /></span>'; }
  function liveDot() { return '<span class="ml-tag ml-tag--sm ml-tag--pill lv-st lv-st--live"><span class="ml-tag__dot"></span>Live</span>'; }
  function tag(text, tone) { return '<span class="ml-tag ml-tag--sm ml-tag--pill ml-tag--' + (tone || "muted") + '">' + esc(text) + "</span>"; }
  function dur(min) { var h = Math.floor(min / 60), m = min % 60; return h ? h + "h" + (m ? " " + m + "m" : "") : m + "m"; }
  function secDur(s) { return s == null ? null : s >= 3600 ? dur(Math.round(s / 60)) : Math.floor(s / 60) + "m " + (s % 60) + "s"; }
  function tc(s) { var m = Math.floor(s / 60), r = s % 60; return m + ":" + (r < 10 ? "0" : "") + r; }
  function num(n) { return n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M" : n >= 1e3 ? (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K" : String(n); }
  function when(iso) {
    var d = new Date(iso), now = new Date(S.now);
    var day = d.toDateString() === now.toDateString() ? "Today" : d.getTime() - now.getTime() < 2 * 864e5 && d > now ? "Tomorrow" :
      d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return day + " at " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }
  function pvHead(lead, title, meta) {
    return '<div class="nv-cmdk__pvh">' + lead + '<div class="nv-cmdk__pvt"><b>' + esc(title) + "</b>" + (meta ? "<span>" + meta + "</span>" : "") + "</div></div>";
  }
  function kv(rows) {
    return '<dl class="nv-cmdk__kv">' + rows.filter(function (r) { return r && r[1] != null && r[1] !== ""; }).map(function (r) {
      return "<dt>" + r[0] + "</dt><dd>" + r[1] + "</dd>";
    }).join("") + "</dl>";
  }
  function pvText(t) { return '<p class="nv-cmdk__pvx">' + esc(t) + "</p>"; }
  function go(href) { location.href = href; }
  function clickEl(sel) { var el = document.querySelector(sel); if (el) el.click(); }

  // =========================================================== index
  var GROUP = {
    now: "Now", recent: "Recent", suggested: "Suggested", action: "Actions", page: "Pages", channel: "My channels", video: "My videos",
    stream: "Streams", playlist: "Playlists", schedule: "Scheduled", file: "Files", idea: "Ideas", trend: "Trends", collection: "Collections",
    tracked: "Tracked", report: "Reports", transcript: "In transcripts", help: "Help", admin: "Admin", link: "Link", pick: "Choose a video", empty: ""
  };
  var SCOPE_OF = {
    action: "actions", page: "actions", admin: "actions", channel: "channels", video: "channels", tracked: "channels", collection: "channels", report: "channels",
    stream: "live", playlist: "live", schedule: "live", file: "media", transcript: "media", idea: "ideas", trend: "ideas", help: "help"
  };
  var SCOPES = [["all", "All"], ["actions", "Actions"], ["live", "Live"], ["media", "Media"], ["channels", "Channels"], ["ideas", "Ideas"], ["help", "Help"]];
  var TYPE_ORDER = ["action", "page", "stream", "schedule", "playlist", "file", "channel", "video", "idea", "trend", "tracked", "collection", "report", "transcript", "help", "admin"];

  var TOOLS = {
    transcribe: { label: "Transcribe", open: function (f) { go("media-library-files.html?" + (f.folder ? "folder=" + encodeURIComponent(f.folder) + "&" : "") + "transcribe=" + encodeURIComponent(f.name)); } },
    timecodes: { label: "Generate timecodes", open: function (f) { go("optimization-timecodes.html?file=" + encodeURIComponent(f.name)); } },
    seo: { label: "Run SEO analysis", open: function (f) { go("optimization-seo.html?file=" + encodeURIComponent(f.name)); } },
    violations: { label: "Check for violations", open: function (f) { go("protection.html?file=" + encodeURIComponent(f.name)); } }
  };

  function act(id, title, desc, run, opts) {
    opts = opts || {};
    return { key: "action:" + id, id: id, type: "action", title: title, sub: opts.sub || "", lead: icoBox(opts.icon || "nv-bolt"), verb: "Run", run: run,
      kw: (opts.kw || "") + " " + desc, money: !!opts.money, pv: function () { return pvHead(icoBox(opts.icon || "nv-bolt"), title) + pvText(desc) + (opts.keys ? kv([["Shortcut", "<kbd class=\"nv-kbd\">" + opts.keys + "</kbd>"]]) : ""); } };
  }
  function startTool(id) { return function () { state.step = id; state.q = ""; state.active = 0; renderAll(); return true; }; }
  function keysModal() {
    var rows = [["Open or close search", MOD + "K"], ["Move through results", "↑ ↓"], ["Open the result", "↵"], ["Secondary action", MOD + "↵"], ["Change the scope", "Tab"], ["Clear, then close", "Esc"]];
    K.modal("nvKeys", "Keyboard shortcuts", kv(rows.map(function (r) { return [esc(r[0]), '<kbd class="nv-kbd">' + esc(r[1]) + "</kbd>"]; })), null);
  }
  function copyDonation() { K.copyText("https://subsub.io/donate/zemsracing", null, "Donation link copied."); }

  function actions() {
    var ff = acct.fanFunding || {};
    var list = [
      act("stream-create", "Create stream", "Set up a new 24/7 stream from files or a playlist.", function () { go("live-stream-create.html"); }, { icon: "nv-live", kw: "live new" }),
      act("stream-schedule", "Schedule stream", "Pick a slot on the Live calendar for a stream.", function () { go("live-calendar.html"); }, { icon: "nv-calendar", kw: "live calendar plan" }),
      act("playlist-create", "Create playlist", "Group files into a playlist that streams can loop.", function () { go("live-playlists.html"); }, { icon: "nv-playlist", kw: "live" }),
      act("media-upload", "Upload files", "Add videos, audio or documents to Media Library.", function () { go("media-library-files.html"); }, { icon: "nv-media", kw: "media add" }),
      act("media-folder", "Create folder", "Make a new folder in Media Library.", function () { go("media-library-files.html"); }, { icon: "nv-folder", kw: "media" }),
      act("transcribe", "Transcribe a file", "Choose a video and get its transcript, then save it as SRT.", startTool("transcribe"), { icon: "nv-transcript", kw: "transcript subtitles srt" }),
      act("timecodes", "Generate timecodes", "Choose a video and get chapters with timecodes.", startTool("timecodes"), { icon: "nv-optimize", kw: "chapters optimization ai tools" }),
      act("seo", "Run SEO analysis", "Choose a video and get title, description and tag suggestions.", startTool("seo"), { icon: "nv-optimize", kw: "optimization ai tools" }),
      act("violations", "Check for violations", "Choose a video and check it for copyright and policy issues.", startTool("violations"), { icon: "nv-protect", kw: "protection violation check" }),
      act("ideas-generate", "Generate ideas", "Start a new ideas search for one of your channels.", function () { go("analytics-ideas.html?dialog=new"); }, { icon: "nv-bulb", kw: "ideas search" }),
      act("ideas-trend", "Make an idea from a trend", "Open Trending now and turn a trend into an idea.", function () { go("trending-now.html"); }, { icon: "nv-trend", kw: "ideas trends" }),
      act("explore", "Explore a channel", "Look up any YouTube channel in Channel explorer.", function () { go("analytics-basic-data.html"); }, { icon: "nv-explorer", kw: "research basic data" }),
      act("track-channel", "Track a channel", "Follow a channel's growth in Tracked channels.", function () { go("analytics-deep-data.html"); }, { icon: "nv-explorer", kw: "research deep data" }),
      act("track-video", "Track a video", "Follow a video's views in Tracked videos.", function () { go("analytics-videos-data.html"); }, { icon: "nv-movie", kw: "research videos data" }),
      act("collection-create", "Create collection", "Group channels you want to compare.", function () { go("analytics-collections.html"); }, { icon: "nv-collections", kw: "collections" }),
      act("report-create", "Create report", "Build a report on a collection or your channels.", function () { go("analytics-reports.html"); }, { icon: "nv-reports", kw: "reports" }),
      act("topup", "Top up balance", "Add funds to the workspace balance that every product uses.", function () { go("wallet.html?topup=1"); }, { icon: "nv-wallet", kw: "wallet balance billing money", money: true }),
      act("payment-method", "Add payment method", "Save a card for top-ups.", function () { go("wallet-method-new.html"); }, { icon: "nv-wallet", kw: "wallet card billing", money: true }),
      ff.hasPage
        ? act("donation-link", "Copy donation link", "Copy the link to your Fan Funding page.", function () { copyDonation(); }, { icon: "nv-link", kw: "fan funding donations share", money: true })
        : act("ff-create", "Create your Fan Funding page", "Let viewers support you with one-off donations and memberships.", function () { go("fan-funding.html"); }, { icon: "nv-fan", kw: "fan funding donations", money: true }),
      act("invite-friend", "Invite a friend", "Share your referral link and earn from their usage.", function () { go("referral-program.html"); }, { icon: "nv-gift", kw: "referral", money: true }),
      act("connect", "Connect a channel", "Add a YouTube channel with Google or a link.", function () { K.connectDialog("search-palette"); }, { icon: "nv-channels", kw: "youtube add channel" }),
      act("invite-member", "Invite a member", "Add a person to the workspace and pick their role.", function () { go("org-settings.html?ws=org&slug=gentech-studio"); }, { icon: "nv-users", kw: "workspace team people" }),
      act("switch-ws", "Switch workspace", "Move between your personal workspace and organizations.", function () { setTimeout(function () { clickEl("[data-nv-acct]"); }, 0); }, { icon: "nv-building", kw: "organization personal" }),
      act("collapse", "Collapse sidebar", "Show the sidebar as icons only.", function () { clickEl("[data-nv-collapse]"); }, { icon: "nv-collapse", kw: "sidebar" }),
      act("install", "Install app", "Add SubSub to your desktop from the browser.", function () { K.toast("Use the install option in your browser's menu."); }, { icon: "nv-monitor", kw: "desktop pwa" }),
      act("support", "Contact support", "Open Support: the starter guide, the product video and a way to reach us.", function () { setTimeout(function () { clickEl("[data-nv-help]"); }, 0); }, { icon: "nv-help", kw: "help" }),
      act("keys", "Keyboard shortcuts", "See every shortcut in SubSub.", function () { keysModal(); }, { icon: "nv-bolt", kw: "hotkeys", keys: MOD + "K" }),
      act("logout", "Log out", "Sign out of SubSub on this device.", function () { K.toast("Signed out."); }, { icon: "nv-logout", kw: "sign out exit" })
    ];
    return list.filter(function (a) { return !(a.money && IS_USER); });
  }
  function actionById(id) { return INDEX.filter(function (i) { return i.key === "action:" + id; })[0]; }

  var PAGE_DESC = {
    "home.html": "Your inbox: what needs attention, trends, ideas and insights.",
    "dashboard.html": "Every connected channel with revenue, views and retention.",
    "wallet.html": "The workspace balance, top-ups and usage.",
    "wallet-methods.html": "Cards saved for top-ups.",
    "analytics-reports.html": "Reports on collections and on your own channels.",
    "analytics-basic-data.html": "Look up any YouTube channel and compare its numbers.",
    "trending-now.html": "Topics growing in search right now.",
    "analytics-deep-data.html": "Channels you follow day by day.",
    "analytics-videos-data.html": "Videos you follow day by day.",
    "analytics-collections.html": "Groups of channels to compare and report on.",
    "analytics-ideas.html": "Video ideas from searches over your channels.",
    "live-streams.html": "Every 24/7 stream, on air or not.",
    "live-playlists.html": "Playlists that streams loop through.",
    "live-calendar.html": "Scheduled streams by day and week.",
    "media-library-files.html": "Your files and folders, and files shared with you.",
    "optimization-timecodes.html": "Chapters with timecodes for a video.",
    "optimization-transcript.html": "Transcripts for your videos.",
    "optimization-seo.html": "Title, description and tag suggestions.",
    "protection.html": "Copyright and policy checks for your videos.",
    "fan-funding.html": "Donations and memberships from your viewers.",
    "network.html": "Join the SubSub network and its benefits.",
    "referral-program.html": "Invite friends and earn from their usage.",
    "account-channels.html": "Channels connected to your account.",
    "settings-notifications.html": "Which notifications you get and where.",
    "org-settings.html": "Members, roles and settings of the organization."
  };
  var ALIASES = [
    ["basic data", "analytics-basic-data.html", "Formerly"], ["deep data", "analytics-deep-data.html", "Formerly"],
    ["videos data", "analytics-videos-data.html", "Formerly"], ["dashboard", "dashboard.html", "Formerly"],
    ["ai tools", "group:optimization", "Also:"], ["violation check", "protection.html", "Formerly"],
    ["balance", "wallet.html", "Also:"], ["billing", "wallet.html", "Also:"], ["money", "wallet.html", "Also:"], ["top up", "wallet.html", "Also:"]
  ];
  function pages() {
    var out = [], seen = {};
    function add(key, title, href, sub) {
      if (seen[key]) return;
      seen[key] = 1;
      var desc = PAGE_DESC[href.split("?")[0]] || "Open " + title + ".";
      out.push({ key: "page:" + key, type: "page", title: title, sub: sub || "", lead: icoBox("nv-page"), verb: "Open", href: href, kw: sub + " " + desc,
        aliases: ALIASES.filter(function (a) { return a[1] === key; }).map(function (a) { return { a: a[0], cap: a[2] + " " + a[0] }; }),
        pv: function () { return pvHead(icoBox("nv-page"), title, esc(sub)) + pvText(desc); } });
    }
    [].slice.call(document.querySelectorAll(".nv-side .nv-item[href], .nv-side .nv-grp")).forEach(function (el) {
      if (el.closest("[data-nv-admin]") && !isAdmin()) return;
      if (el.classList.contains("nv-grp")) {
        var g = el.querySelector(".nv-item__l").textContent.trim();
        add("group:" + el.getAttribute("data-nv-grp"), g, el.getAttribute("data-nv-first"), "");
        [].slice.call(el.querySelectorAll(".nv-sub__i")).forEach(function (s) { var h = s.getAttribute("href"); add(h, s.textContent.trim(), h, g); });
        return;
      }
      var l = el.querySelector(".nv-item__l"), h = el.getAttribute("href");
      if (l && h && h !== "#") add(h, l.textContent.trim(), h, "");
    });
    add("account-channels.html", "Connected channels", "account-channels.html", "Account");
    add("settings-notifications.html", "Notifications", "settings-notifications.html", "Account");
    add("org-settings.html", "Organization settings", "org-settings.html?ws=org&slug=gentech-studio", "Account");
    return out;
  }

  function channelItems() {
    var out = [];
    Object.keys(F.channels).forEach(function (id) {
      var c = F.channels[id], views7 = 0;
      (c.videos || []).forEach(function (v) { views7 += v.views7 || 0; });
      var connLabel = c.conn === "oauth" ? "Connected with Google" : "Public data from a link";
      out.push({ key: "channel:" + id, type: "channel", title: c.name, sub: c.handle, lead: K.ava(c), verb: "Open channel", href: "dashboard-channel.html?id=" + id,
        act2: { label: "Explore in Channel explorer", href: "analytics-basic-data.html?q=" + encodeURIComponent(c.name) }, kw: c.handle + " " + (c.niches || []).join(" "),
        pv: function () {
          return pvHead('<span class="nv-cmdk__ava">' + K.ava(c) + "</span>", c.name, esc(c.handle)) +
            kv([["Connection", esc(connLabel)], ["Subscribers", num(c.subs)], ["Views, 7 days", num(views7)]]);
        } });
      (c.videos || []).forEach(function (v) {
        out.push({ key: "video:" + v.id + ":" + id, type: "video", title: v.title, sub: c.name, lead: v.thumb ? thumb(v.thumb) : icoBox("nv-movie"), verb: "Open in channel page",
          href: "dashboard-channel.html?id=" + id + "#videos", act2: { label: "Generate timecodes", href: "optimization-timecodes.html?video=" + v.id }, kw: c.name + (v.short ? " short" : " video"),
          pv: function () {
            return pvHead(v.thumb ? thumb(v.thumb) : icoBox("nv-movie"), v.title, esc(c.name)) +
              kv([["Type", v.short ? "Short" : "Video"], ["Views", num(v.views)], ["Views, 7 days", num(v.views7)], ["Published", Math.abs(v.published) + " days ago"]]);
          } });
      });
    });
    return out;
  }
  function liveItems() {
    var out = [];
    S.streams.forEach(function (s) {
      var sched = s.state === "scheduled";
      var status = s.state === "live" ? "On air " + dur(s.uptime || 0) : sched ? "Starts " + when(s.start).replace(/^(Today|Tomorrow)/, function (m) { return m.toLowerCase(); }) : "Off air";
      var pv = function () {
        return pvHead(icoBox(sched ? "nv-calendar" : "nv-live"), s.name, esc(s.channel)) +
          kv([["Status", s.state === "live" ? liveDot() + " " + esc(status) : esc(status)], ["Viewers", s.state === "live" ? K.stat("nv-eye", num(s.viewers) + " watching") : null],
            ["Channel", esc(s.channel)], ["Playlist", s.playlist ? esc(s.playlist.name) : "Own queue"], ["Next run", s.start && sched ? esc(when(s.start)) : null]]);
      };
      if (sched) {
        out.push({ key: "schedule:" + s.id, type: "schedule", title: s.name, sub: status, lead: icoBox("nv-calendar"), verb: "Open in calendar", href: "live-calendar.html", kw: s.channel, pv: pv });
      } else {
        out.push({ key: "stream:" + s.id, type: "stream", title: s.name, sub: s.channel, right: s.state === "live" ? liveDot() : "", lead: icoBox("nv-live"), verb: "Open stream",
          href: "live-stream.html?id=" + s.id, act2: s.playlist ? { label: "Open playlist", href: "live-playlist.html?id=" + s.playlist.id } : null, kw: s.channel + " " + status + (s.playlist ? " " + s.playlist.name : ""), pv: pv });
      }
    });
    S.playlists.forEach(function (p) {
      var n = UI ? UI.plural(p.files, "file", "files") : p.files + " files";
      out.push({ key: "playlist:" + p.id, type: "playlist", title: p.name, sub: n, lead: icoBox("nv-playlist"), verb: "Open playlist", href: "live-playlist.html?id=" + p.id,
        act2: { label: "Create stream from it", href: "live-stream-create.html?playlist=" + p.id }, kw: "playlist",
        pv: function () { return pvHead(icoBox("nv-playlist"), p.name, esc(n)) + pvText("Streams loop through its files in order."); } });
    });
    return out;
  }
  var KIND_LABEL = { folder: "Folder", video: "Video", image: "Image", audio: "Audio", document: "Document", spreadsheet: "Spreadsheet", pdf: "PDF", code: "Code", other: "File" };
  function fileLead(f) { return f.cover ? thumb(f.cover) : icoBox(f.kind === "folder" ? "nv-folder" : f.kind === "video" ? "nv-movie" : "nv-file"); }
  function fileHref(f) {
    if (f.href) return f.href;
    if (f.kind === "folder") return "media-library-files.html?folder=" + f.fid;
    return "media-library-files.html" + (f.folder ? "?folder=" + f.folder : "");
  }
  var folderName = {};
  S.files.forEach(function (f) { if (f.kind === "folder") folderName[f.fid] = f.name; });
  function fileItems() {
    return S.files.map(function (f) {
      var where = f.shared ? "Shared by " + f.owner : f.folder ? "In " + folderName[f.folder] : "Media Library";
      var media = f.kind === "video" || f.kind === "audio";
      return { key: "file:" + f.name, type: "file", title: f.name, sub: f.kind === "folder" ? UI ? UI.plural(f.files, "file", "files") : f.files + " files" : where,
        right: f.shared ? tag("Shared") : "", lead: fileLead(f), verb: "Open", href: fileHref(f), file: f,
        act2: media && !f.shared ? { label: "Transcribe", run: function () { TOOLS.transcribe.open(f); } } : null, kw: KIND_LABEL[f.kind] + " " + where,
        pv: function () {
          return pvHead(fileLead(f), f.name, esc(where)) +
            kv([["Type", KIND_LABEL[f.kind]], ["Duration", secDur(f.sec)], ["Size", esc(f.size)],
              ["Used in", media ? (UI ? UI.plural(f.used, "stream", "streams") : f.used + " streams") : null],
              ["Transcript", media ? (f.transcribed ? tag("Transcribed", "ok") : "Not transcribed") : null]]);
        } };
    });
  }
  function ideaItems() {
    var out = [];
    F.ideas.forEach(function (i) {
      var c = F.channels[i.channel] || { name: "" };
      out.push({ key: "idea:" + i.id, type: "idea", title: i.title, sub: c.name, lead: icoBox("nv-bulb"), verb: "Open idea", href: "analytics-ideas.html#idea-" + i.id,
        act2: { label: "Save", run: function () { var l = K.ssList("nv_liked"); if (l.indexOf(i.id) === -1) l.push(i.id); K.ss("nv_liked", JSON.stringify(l)); K.toast("Idea saved."); } },
        kw: c.name + " " + i.concept,
        pv: function () {
          return pvHead(icoBox("nv-bulb"), i.title, (i.format === "short" ? tag("Short") : tag("Video")) + " " + esc(c.name)) +
            pvText(i.concept) + (i.whyFits || i.angle ? '<div class="nv-why"><p class="nv-why__k">Why it fits</p><p class="nv-why__v">' + esc(i.whyFits || i.angle) + "</p></div>" : "");
        } });
    });
    F.trends.forEach(function (t) {
      out.push({ key: "trend:" + t.id, type: "trend", title: t.topic, sub: t.niche, lead: icoBox("nv-trend"), verb: "Make an idea", href: "trending-now.html#" + t.id, kw: t.niche,
        pv: function () {
          return pvHead(icoBox("nv-trend"), t.topic, esc(t.niche)) +
            kv([["Niche", esc(t.niche)], ["Growth", K.stat("nv-trend", "+" + t.growth + "% search interest")], ["Window", "Rising for " + t.days + " days"]]);
        } });
    });
    return out;
  }
  function analyticsItems() {
    var out = [];
    S.tracked.forEach(function (c, n) {
      var ch = { name: c.name, initial: c.initial, color: "var(--color-avatar-" + (n % 6 + 1) + ")" };
      out.push({ key: "tracked:" + c.name, type: "tracked", title: c.name, sub: "Tracked channel", lead: K.ava(ch), verb: "Open", href: "analytics-deep-data.html",
        act2: { label: "Add to collection", href: "analytics-collections.html" }, kw: "channel",
        pv: function () { return pvHead('<span class="nv-cmdk__ava">' + K.ava(ch) + "</span>", c.name, "Tracked channel") + kv([["Subscribers", esc(c.subs)], ["Views", esc(c.views)]]); } });
    });
    S.trackedVideos.forEach(function (v) {
      out.push({ key: "tracked:" + v.title, type: "tracked", title: v.title, sub: "Tracked video", lead: icoBox("nv-movie"), verb: "Open", href: "analytics-videos-data.html",
        act2: { label: "Add to collection", href: "analytics-collections.html" }, kw: v.channel + " video",
        pv: function () { return pvHead(icoBox("nv-movie"), v.title, esc(v.channel)) + kv([["Views", esc(v.views)]]); } });
    });
    S.collections.forEach(function (c) {
      var n = UI ? UI.plural(c.qty, "channel", "channels") : c.qty + " channels";
      out.push({ key: "collection:" + c.name, type: "collection", title: c.name, sub: n, lead: icoBox("nv-collections"), verb: "Open",
        href: "analytics-collection-edit.html?name=" + encodeURIComponent(c.name), kw: "collection",
        pv: function () { return pvHead(icoBox("nv-collections"), c.name, esc(n)) + pvText("A group of channels to compare and report on."); } });
    });
    S.reports.forEach(function (r) {
      out.push({ key: "report:" + r.name, type: "report", title: r.name, sub: r.type, lead: icoBox("nv-reports"), verb: "Open", href: "analytics-reports.html?tab=" + r.tab, kw: r.type,
        pv: function () { return pvHead(icoBox("nv-reports"), r.name, esc(r.type)) + pvText(r.tab === "market" ? "A market insights report." : "A report on your own channels."); } });
    });
    return out;
  }
  function helpItems() {
    return S.help.map(function (h) {
      return { key: "help:" + h.id, type: "help", title: h.title, sub: "Help article", lead: icoBox("nv-guide"), verb: "Open",
        run: function () { setTimeout(function () { clickEl("[data-nv-help]"); }, 0); }, act2: { label: "Contact support", run: function () { setTimeout(function () { clickEl("[data-nv-help]"); }, 0); } }, kw: h.text,
        pv: function () { return pvHead(icoBox("nv-guide"), h.title, "Help article") + pvText(h.text); } };
    });
  }
  function adminItems() {
    if (!isAdmin()) return [];
    return S.admin.map(function (a) {
      return { key: "admin:" + a.id, type: "admin", title: a.title, sub: a.kind + ", " + a.sub, lead: icoBox("nv-shield"), verb: "Open", href: a.href, kw: a.kind + " " + a.sub,
        pv: function () { return pvHead(icoBox("nv-shield"), a.title, esc(a.kind)) + pvText(a.sub); } };
    });
  }

  var INDEX = null;
  function index() {
    if (!INDEX) INDEX = [].concat(actions(), pages(), channelItems(), liveItems(), fileItems(), ideaItems(), analyticsItems(), helpItems(), adminItems());
    return INDEX;
  }
  function byKey(key) { return index().filter(function (i) { return i.key === key; })[0]; }

  // =========================================================== empty query: Now, Recent, Suggested
  function nowItems() {
    var out = [], d = K.runwayDays ? K.runwayDays() : null, bal = balanceNow();
    if (K.runwayDays && acct.key !== "default") { var sp = acct.avgDailySpend7d; d = sp > 0 ? Math.max(bal, 0) / sp : null; }
    (acct.streams || []).filter(function (s) { return s.status === "down"; }).forEach(function (s) {
      out.push({ key: "now:down-" + s.id, type: "now", title: "“" + s.name + "” is down", sub: "Off air since " + s.offAirSince, lead: icoBox("nv-alert"), verb: "Open stream",
        href: "live-stream.html?id=" + s.id, pv: function () { return pvHead(icoBox("nv-alert"), "“" + s.name + "” is down", "Off air since " + esc(s.offAirSince)) + pvText("The stream is off YouTube. Open it to see what stopped it."); } });
    });
    if (bal <= 0 || (d != null && d < 3)) {
      var t = bal <= 0 ? "Balance ran out" : "Balance runs out in " + (d < 1 ? "less than a day" : "about " + (UI ? UI.plural(Math.floor(d), "day", "days") : Math.floor(d) + " days"));
      out.push({ key: "now:balance", type: "now", title: t, sub: "Streams stop when the balance reaches $0", lead: icoBox("nv-wallet"), verb: IS_USER ? "Open balance" : "Top up",
        href: IS_USER ? "wallet.html" : "wallet.html?topup=1", pv: function () { return pvHead(icoBox("nv-wallet"), t, "$" + bal.toFixed(2) + " left") + pvText("Streams stop when the balance reaches $0."); } });
    }
    if (!out.length && S.soon) {
      out.push({ key: "now:soon", type: "now", title: S.soon.name, sub: "Starts in " + S.soon.inMin + "m on " + S.soon.channel, lead: icoBox("nv-calendar"), verb: "Open in calendar", href: S.soon.href,
        pv: function () { return pvHead(icoBox("nv-calendar"), S.soon.name, esc(S.soon.channel)) + kv([["Status", "Scheduled"], ["Starts", "In " + S.soon.inMin + "m"], ["Channel", esc(S.soon.channel)]]); } });
    }
    return out.slice(0, 2);
  }
  var PAGE_SUGGEST = {
    "media-library-files.html": ["media-upload", "media-folder"],
    "live-streams.html": ["stream-create", "stream-schedule"], "live-stream.html": ["stream-create", "stream-schedule"],
    "analytics-ideas.html": ["ideas-generate"]
  };
  function suggested() {
    var ids = (PAGE_SUGGEST[FILE] || []).concat(["stream-create", "media-upload", "topup", "connect"]);
    var seen = {}, out = [];
    ids.forEach(function (id) { var a = actionById(id); if (a && !seen[id]) { seen[id] = 1; out.push(a); } });
    return out.slice(0, 4);
  }

  // =========================================================== query parsers: amount, YouTube link
  function parseAmount(q) {
    var m = /^(?:top ?up|add)\s*\$?\s*(\d+(?:[.,]\d{1,2})?)\s*\$?\s*(?:to\s+(?:the\s+)?balance)?$/.exec(norm(q));
    return m ? parseFloat(m[1].replace(",", ".")) : null;
  }
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100000; return h; }
  function parseLink(q) {
    var v = q.trim();
    var m = /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\/(\S+)$/i.exec(v);
    var path = m ? m[1] : /^@[\w.\-]+$/.test(v) ? v : null;
    if (!path) return null;
    if (/youtu\.be\//i.test(v)) return { video: path.split(/[?&#]/)[0] };
    var w = /(?:watch\?(?:.*&)?v=|shorts\/|live\/)([\w\-]+)/.exec(path);
    if (w) return { video: w[1] };
    var handle = path.replace(/^@/, "").replace(/^(?:c|user|channel)\//, "").split(/[\/?#&]/)[0].toLowerCase();
    return handle ? { handle: handle } : null;
  }
  function linkItems(link) {
    var own = null, items = [];
    Object.keys(F.channels).forEach(function (id) { var c = F.channels[id]; if (link.handle && c.handle.replace("@", "").toLowerCase() === link.handle) own = c; });
    if (link.handle) {
      var d = F.directory && F.directory[link.handle];
      var c = own || (d ? { name: d.name, initial: d.initial, color: d.color } : { name: "@" + link.handle, initial: link.handle.charAt(0).toUpperCase(), color: "var(--color-avatar-4)" });
      var subs = own ? own.subs : 12000 + hash(link.handle) * 9;
      var pv = function () { return pvHead('<span class="nv-cmdk__ava">' + K.ava(c) + "</span>", c.name, "@" + esc(link.handle)) + kv([["Subscribers", num(subs)], ["Source", own ? "One of your channels" : "YouTube channel"]]); };
      var acts = [];
      if (own) acts.push(["Open in My channels", "dashboard-channel.html?id=" + own.id, "nv-dashboard"]);
      acts.push(["Explore channel", "analytics-basic-data.html?q=" + encodeURIComponent(c.name), "nv-explorer"]);
      acts.push(["Track channel", "analytics-deep-data.html", "nv-explorer"]);
      acts.push(["Add to collection", "analytics-collections.html", "nv-collections"]);
      items.push({ key: "link:channel", type: "link", title: c.name, sub: num(subs) + " subscribers", lead: K.ava(c), verb: acts[0][0], href: acts[0][1], act2: { label: acts[1][0], href: acts[1][1] }, pv: pv });
      acts.forEach(function (a) { items.push({ key: "link:" + a[0], type: "link", title: a[0], sub: c.name, lead: icoBox(a[2]), verb: a[0], href: a[1], pv: pv }); });
      return items;
    }
    var ownV = null, ownC = null;
    Object.keys(F.channels).forEach(function (id) { (F.channels[id].videos || []).forEach(function (v) { if (v.id === link.video) { ownV = v; ownC = F.channels[id]; } }); });
    var title = ownV ? ownV.title : "YouTube video " + link.video, views = ownV ? ownV.views : 4000 + hash(link.video) * 7, cover = ownV ? ownV.thumb : "covers/generic.svg";
    var vpv = function () { return pvHead(thumb(cover), title, ownC ? esc(ownC.name) : "YouTube video") + kv([["Views", num(views)]]); };
    var vacts = [];
    if (ownC) vacts.push(["Open in My channels", "dashboard-channel.html?id=" + ownC.id + "#videos", "nv-dashboard"]);
    vacts.push(["Track video", "analytics-videos-data.html", "nv-movie"]);
    vacts.push(["Add to collection", "analytics-collections.html", "nv-collections"]);
    items.push({ key: "link:video", type: "link", title: title, sub: num(views) + " views", lead: thumb(cover), verb: vacts[0][0], href: vacts[0][1], act2: { label: vacts[1][0], href: vacts[1][1] }, pv: vpv });
    vacts.forEach(function (a) { items.push({ key: "link:" + a[0], type: "link", title: a[0], sub: title, lead: icoBox(a[2]), verb: a[0], href: a[1], pv: vpv }); });
    return items;
  }

  // =========================================================== ranking
  function scoreOf(item, q, toks) {
    var t = norm(item.title);
    item.cap = "";
    if (t.indexOf(q) === 0) return 5;
    if (allTok(toks, words(item.title))) return 4;
    var al = (item.aliases || []).filter(function (a) { return a.a.indexOf(q) === 0 || q.indexOf(a.a) === 0; })[0];
    if (al) { item.cap = al.cap; return 3; }
    if (item.kw && allTok(toks, words(item.kw + " " + item.sub))) return 2;
    return 0;
  }
  function transcriptHits(q) {
    if (q.length < 3) return [];
    var out = [];
    S.transcripts.forEach(function (tr) {
      tr.lines.forEach(function (ln) {
        var at = norm(ln[1]).indexOf(q);
        if (at === -1) return;
        var raw = ln[1], snip = esc(raw.slice(0, at)) + "<b>" + esc(raw.slice(at, at + q.length)) + "</b>" + esc(raw.slice(at + q.length));
        var f = S.files.filter(function (x) { return x.name === tr.file; })[0] || { name: tr.file, kind: "video", folder: tr.folder };
        out.push({ key: "transcript:" + tr.file + ":" + ln[0], type: "transcript", title: tr.file, subHtml: snip, right: '<span class="nv-cmdk__tc">' + tc(ln[0]) + "</span>",
          lead: icoBox("nv-transcript"), verb: "Open at " + tc(ln[0]), href: fileHref(f) + (fileHref(f).indexOf("?") === -1 ? "?" : "&") + "t=" + ln[0],
          act2: { label: "Copy timecode", run: function () { K.copyText(tc(ln[0]), null, "Timecode copied."); } }, score: 1,
          pv: function () { return pvHead(icoBox("nv-transcript"), tr.file, "At " + tc(ln[0])) + '<p class="nv-cmdk__pvx">' + snip + "</p>"; } });
      });
    });
    return out;
  }

  // =========================================================== state and results
  var state = { open: false, q: "", scope: "all", step: null, active: 0, flat: [], trigger: null, drop: false };
  var host = null;

  function results() {
    var q = norm(state.q), toks = words(state.q), groups = [], rec = recent();
    if (state.step) {
      var vids = S.files.filter(function (f) { return f.kind === "video" && !f.shared && (!q || allTok(toks, words(f.name))); });
      var tool = TOOLS[state.step];
      groups.push({ id: "pick", label: GROUP.pick, items: vids.map(function (f) {
        return { key: "pick:" + f.name, type: "pick", title: f.name, sub: f.folder ? "In " + folderName[f.folder] : "Media Library", lead: fileLead(f), verb: tool.label,
          run: function () { tool.open(f); }, pv: function () { return pvHead(fileLead(f), f.name, esc(tool.label)) + kv([["Duration", secDur(f.sec)], ["Size", esc(f.size)]]); } };
      }) });
      return groups;
    }
    var link = state.q.trim() ? parseLink(state.q) : null;
    if (link) return [{ id: "link", label: GROUP.link, items: linkItems(link) }];
    var amount = parseAmount(state.q);
    if (amount != null && amount > 0 && !IS_USER) {
      var label = "Top up $" + (amount % 1 ? amount.toFixed(2) : amount);
      return [{ id: "action", label: GROUP.action, items: [{ key: "amount", type: "action", title: label, sub: "Opens the top-up with the amount filled in", lead: icoBox("nv-wallet"), verb: label,
        run: function () { K.ss("nv_topup_amount", String(amount)); go("wallet.html?topup=1"); },
        pv: function () { return pvHead(icoBox("nv-wallet"), label, "Wallet") + pvText("Opens the top-up with $" + amount + " filled in. You confirm the payment there."); } }] }];
    }
    if (!q) {
      if (state.scope === "all") {
        var now = nowItems(), recentItems = rec.map(byKey).filter(Boolean);
        if (now.length) groups.push({ id: "now", label: GROUP.now, items: now });
        if (recentItems.length) groups.push({ id: "recent", label: GROUP.recent, items: recentItems });
        groups.push({ id: "suggested", label: GROUP.suggested, items: suggested() });
        return groups;
      }
      return grouped(index().filter(function (i) { return SCOPE_OF[i.type] === state.scope; }).map(function (i) { return { item: i, s: 1 }; }), true);
    }
    var scored = [];
    index().forEach(function (i) {
      var s = scoreOf(i, q, toks);
      if (s) scored.push({ item: i, s: s + (rec.indexOf(i.key) !== -1 ? 0.5 : 0) });
    });
    transcriptHits(q).forEach(function (t) { scored.push({ item: t, s: 1 }); });
    if (state.scope !== "all") scored = scored.filter(function (x) { return SCOPE_OF[x.item.type] === state.scope; });
    if (!scored.length) return [];
    return grouped(scored, state.scope !== "all");
  }
  function grouped(scored, full) {
    var by = {};
    scored.forEach(function (x) { (by[x.item.type] = by[x.item.type] || []).push(x); });
    return Object.keys(by).map(function (type) {
      var list = by[type].sort(function (a, b) { return b.s - a.s; });
      return { id: type, label: GROUP[type], best: list[0].s, total: list.length, items: list.map(function (x) { return x.item; }) };
    }).sort(function (a, b) { return b.best - a.best || TYPE_ORDER.indexOf(a.id) - TYPE_ORDER.indexOf(b.id); }).map(function (g) {
      if (!full && g.items.length > 4) { g.more = g.items.length; g.items = g.items.slice(0, 4); }
      return g;
    });
  }
  function emptyRows() {
    var q = state.q.trim();
    return [{ id: "empty", label: "", items: [
      { key: "empty:yt", type: "empty", title: "Search YouTube channels for “" + q + "”", lead: icoBox("nv-explorer"), verb: "Search", href: "analytics-basic-data.html?q=" + encodeURIComponent(q),
        pv: function () { return pvHead(icoBox("nv-explorer"), "Channel explorer", "") + pvText("Look up “" + q + "” among YouTube channels."); } },
      { key: "empty:help", type: "empty", title: "Search the help center", lead: icoBox("nv-guide"), verb: "Open", run: function () { setTimeout(function () { clickEl("[data-nv-help]"); }, 0); },
        pv: function () { return pvHead(icoBox("nv-guide"), "Help center", "") + pvText("Guides on Live, Media Library, ideas and the balance."); } },
      { key: "empty:support", type: "empty", title: "Contact support", lead: icoBox("nv-help"), verb: "Open", run: function () { setTimeout(function () { clickEl("[data-nv-help]"); }, 0); },
        pv: function () { return pvHead(icoBox("nv-help"), "Contact support", "") + pvText("Ask the SubSub team about anything that is not here."); } }
    ] }];
  }

  // =========================================================== rendering
  function shell() {
    host = document.createElement("div");
    host.className = "nv-cmdk";
    host.hidden = true;
    host.innerHTML = '<div class="an-modal__overlay" data-cmdk-close></div>' +
      '<div class="an-modal__dialog nv-cmdk__dlg" role="dialog" aria-modal="true" aria-label="Search">' +
        '<div class="nv-cmdk__bar">' + use("nv-search") + '<span class="nv-cmdk__step" data-cmdk-step hidden></span>' +
          '<input class="nv-cmdk__in" id="nvCmdkIn" type="text" role="combobox" aria-expanded="true" aria-controls="nvCmdkList" aria-autocomplete="list" ' +
            'autocomplete="off" spellcheck="false" placeholder="Search or jump to…" aria-label="Search SubSub" />' +
          '<button class="an-modal__x" type="button" data-cmdk-close aria-label="Close search">' + use("nv-x") + "</button></div>" +
        '<div class="nv-cmdk__scopes" role="group" aria-label="Search in">' + SCOPES.map(function (s) {
          return '<button class="nv-chip" type="button" tabindex="-1" aria-pressed="false" data-cmdk-scope="' + s[0] + '">' + s[1] + "</button>";
        }).join("") + "</div>" +
        '<div class="nv-cmdk__body"><div class="nv-cmdk__list" id="nvCmdkList" role="listbox" aria-label="Results"></div><div class="nv-cmdk__pv" data-cmdk-pv></div></div>' +
        '<div class="nv-cmdk__foot"><div class="nv-cmdk__keys" data-cmdk-keys></div><div class="nv-cmdk__btns" data-cmdk-btns></div></div>' +
      "</div>";
    document.body.appendChild(host);
    return host;
  }
  function rowHtml(item, n) {
    var sub = item.subHtml || (item.cap && state.q ? esc(item.cap) : esc(item.sub || ""));
    var more = mobile() && item.act2 ? K.iconBtn("nv-dots", "More actions", 'data-cmdk-more="' + n + '" tabindex="-1"', "nv-cmdk__more") : "";
    return '<div class="nv-cmdk__row' + (n === state.active ? " is-active" : "") + '" role="option" id="nvCmdkO' + n + '" aria-selected="' + (n === state.active) + '" data-cmdk-row="' + n + '">' +
      '<span class="nv-cmdk__lead">' + (item.lead || "") + "</span>" +
      '<span class="nv-cmdk__tx"><span class="nv-cmdk__t">' + esc(item.title) + "</span>" + (sub ? '<span class="nv-cmdk__s">' + sub + "</span>" : "") + "</span>" +
      (item.right || "") + more + "</div>";
  }
  function renderList() {
    var groups = results(), flat = [], html = "";
    if (!groups.length) groups = emptyRows();
    var empty = groups[0].id === "empty";
    if (empty) html += '<p class="nv-cmdk__none">No results for “' + esc(state.q.trim()) + "”</p>";
    groups.forEach(function (g, gi) {
      var rows = g.items.map(function (it) { flat.push(it); return rowHtml(it, flat.length - 1); }).join("");
      if (g.more) {
        flat.push({ key: "more:" + g.id, type: "more", title: "Show all " + g.more, scope: SCOPE_OF[g.id], run: function () { state.scope = SCOPE_OF[g.id]; state.active = 0; renderAll(); return true; } });
        rows += '<div class="nv-cmdk__row nv-cmdk__row--more' + (flat.length - 1 === state.active ? " is-active" : "") + '" role="option" id="nvCmdkO' + (flat.length - 1) + '" aria-selected="' + (flat.length - 1 === state.active) + '" data-cmdk-row="' + (flat.length - 1) + '">' +
          '<span class="nv-cmdk__t">Show all ' + g.more + "</span></div>";
      }
      html += '<div class="nv-cmdk__g" role="group"' + (g.label ? ' aria-labelledby="nvCmdkG' + gi + '"' : "") + ">" +
        (g.label ? '<p class="nv-cmdk__gh" id="nvCmdkG' + gi + '">' + esc(g.label) + "</p>" : "") + rows + "</div>";
    });
    state.flat = flat;
    if (state.active >= flat.length) state.active = 0;
    host.querySelector("#nvCmdkList").innerHTML = html;
    syncActive(false);
  }
  function syncActive(scroll) {
    var input = inputEl(), rows = host.querySelectorAll("[data-cmdk-row]");
    [].forEach.call(rows, function (r) {
      var on = Number(r.getAttribute("data-cmdk-row")) === state.active;
      r.classList.toggle("is-active", on);
      r.setAttribute("aria-selected", String(on));
      if (on && scroll) r.scrollIntoView({ block: "nearest" });
    });
    if (state.flat.length) input.setAttribute("aria-activedescendant", "nvCmdkO" + state.active); else input.removeAttribute("aria-activedescendant");
    var item = state.flat[state.active];
    host.querySelector("[data-cmdk-pv]").innerHTML = item && item.pv ? item.pv() : "";
    host.querySelector("[data-cmdk-keys]").innerHTML =
      '<span><kbd class="nv-kbd">↑</kbd><kbd class="nv-kbd">↓</kbd>Navigate</span><span><kbd class="nv-kbd">↵</kbd>Open</span>' +
      (item && item.act2 ? '<span><kbd class="nv-kbd">' + MOD + "↵</kbd>" + esc(item.act2.label) + "</span>" : "");
    host.querySelector("[data-cmdk-btns]").innerHTML = item && item.type !== "more" ?
      (item.act2 ? K.btn(item.act2.label, "secondary", "data-cmdk-sec tabindex=\"-1\"", null, "small") : "") +
      K.btn(item.verb || "Open", "primary", "data-cmdk-pri tabindex=\"-1\"", "nv-enter", "small") : "";
  }
  function renderScopes() {
    [].forEach.call(host.querySelectorAll("[data-cmdk-scope]"), function (b) {
      var on = b.getAttribute("data-cmdk-scope") === state.scope;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-pressed", String(on));
    });
    host.querySelector(".nv-cmdk__scopes").hidden = !!state.step;
  }
  function hdrIn() { return document.getElementById("nvSearchIn"); }
  function inputEl() { return state.drop ? hdrIn() : host.querySelector("#nvCmdkIn"); }
  function renderStep() {
    [].forEach.call(document.querySelectorAll("[data-cmdk-step]"), function (el) {
      el.hidden = !state.step;
      el.textContent = state.step ? TOOLS[state.step].label + " ›" : "";
    });
    inputEl().placeholder = state.step ? "Find a video" : "Search or jump to…";
  }
  function renderAll() {
    var input = inputEl();
    if (input.value !== state.q) input.value = state.q;
    renderStep();
    renderScopes();
    renderList();
    if (document.activeElement !== input) { QUIET = true; input.focus(); QUIET = false; }
  }

  // =========================================================== running results
  function runPrimary(item) {
    if (!item) return;
    if (item.run) { if (item.run() === true) return; close(false); return; }
    if (RECENT_TYPES[item.type]) pushRecent(item.key);
    close(false);
    if (item.href) go(item.href);
  }
  function runSecondary(item) {
    if (!item || !item.act2) return;
    if (RECENT_TYPES[item.type]) pushRecent(item.key);
    close(false);
    if (item.act2.run) item.act2.run(); else go(item.act2.href);
  }

  var QUIET = false;
  function canDrop() { var f = hdrIn(); return !mobile() && !!f && f.offsetWidth > 0; }
  function place() {
    var dlg = host.querySelector(".nv-cmdk__dlg"), field = document.querySelector("[data-nv-sfield]");
    host.classList.toggle("nv-cmdk--drop", state.drop);
    host.classList.toggle("nv-cmdk--sheet", !state.drop && mobile());
    if (!state.drop) { dlg.style.left = dlg.style.top = dlg.style.width = dlg.style.maxHeight = ""; return; }
    var r = field.getBoundingClientRect(), top = r.bottom + 6, left = Math.max(16, r.left);
    dlg.style.left = left + "px";
    dlg.style.top = top + "px";
    dlg.style.width = Math.min(880, window.innerWidth - left - 16) + "px";
    dlg.style.maxHeight = Math.min(640, window.innerHeight - top - 16) + "px";
  }
  window.addEventListener("resize", function () {
    if (!state.open) return;
    var d = canDrop();
    if (d !== state.drop) { state.drop = d; place(); renderAll(); document.body.style.overflow = d ? "" : "hidden"; } else place();
  });
  function open(trigger) {
    if (!host) shell();
    state.trigger = trigger || document.activeElement;
    state.open = true; state.scope = "all"; state.step = null; state.active = 0;
    state.drop = canDrop();
    state.q = state.drop ? hdrIn().value : "";
    host.hidden = false;
    place();
    if (!state.drop) document.body.style.overflow = "hidden";
    [].forEach.call(document.querySelectorAll("[data-nv-search], #nvSearchIn"), function (b) { b.setAttribute("aria-expanded", "true"); });
    renderAll();
  }
  function close(restore) {
    if (!host || !state.open) return;
    state.open = false;
    host.hidden = true;
    document.body.style.overflow = "";
    state.q = ""; state.step = null;
    var hi = hdrIn();
    if (hi) { hi.value = ""; hi.removeAttribute("aria-activedescendant"); hi.placeholder = "Search or jump to…"; }
    [].forEach.call(document.querySelectorAll("[data-cmdk-step]"), function (el) { el.hidden = true; });
    [].forEach.call(document.querySelectorAll("[data-nv-search], #nvSearchIn"), function (b) { b.setAttribute("aria-expanded", "false"); });
    if (restore !== false && state.trigger && state.trigger.focus) { QUIET = true; state.trigger.focus(); QUIET = false; }
    else if (state.drop && document.activeElement === hi) hi.blur();
  }

  document.addEventListener("keydown", function (e) {
    if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey) && !e.altKey) {
      e.preventDefault();
      if (state.open) close(); else open(document.activeElement);
      return;
    }
    if (!state.open) return;
    var n = state.flat.length;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!n) return;
      state.active = (state.active + (e.key === "ArrowDown" ? 1 : -1) + n) % n;
      syncActive(true);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (e.metaKey || e.ctrlKey) { var it = state.flat[state.active]; if (it && it.act2) { var sec = host.querySelector("[data-cmdk-sec]"); if (sec) sec.click(); } return; }
      var row = host.querySelector('[data-cmdk-row="' + state.active + '"]');
      if (row) row.click();
    } else if (e.key === "Escape") {
      e.preventDefault(); e.stopPropagation();
      if (state.q || state.step) { state.q = ""; state.step = null; state.active = 0; renderAll(); } else close();
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (state.step) return;
      var i = SCOPES.map(function (s) { return s[0]; }).indexOf(state.scope);
      state.scope = SCOPES[(i + (e.shiftKey ? -1 : 1) + SCOPES.length) % SCOPES.length][0];
      state.active = 0;
      renderAll();
    } else if (e.key === "Backspace" && state.step && !state.q) {
      e.preventDefault();
      state.step = null; state.active = 0; renderAll();
    }
  }, true);

  document.addEventListener("input", function (e) {
    if (e.target.id !== "nvCmdkIn" && e.target.id !== "nvSearchIn") return;
    if (!state.open) { open(e.target); return; }
    state.q = e.target.value;
    state.active = 0;
    renderList();
  });
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t.closest) return;
    var trig = t.closest("[data-nv-search]") || (t.closest("[data-nv-sfield]") && !state.open ? hdrIn() : null);
    if (trig) { e.preventDefault(); if (!state.open) open(hdrIn() && canDrop() ? hdrIn() : trig); return; }
    if (!state.open || !host.contains(t)) return;
    var more = t.closest("[data-cmdk-more]");
    if (more) {
      e.stopPropagation();
      var mi = state.flat[Number(more.getAttribute("data-cmdk-more"))];
      if (mi && UI && UI.menu) UI.menu(more, [{ label: mi.act2.label, onClick: function () { runSecondary(mi); } }]);
      return;
    }
    if (t.closest("[data-cmdk-close]")) { close(); return; }
    var sc = t.closest("[data-cmdk-scope]");
    if (sc) { state.scope = sc.getAttribute("data-cmdk-scope"); state.active = 0; renderAll(); return; }
    if (t.closest("[data-cmdk-sec]")) { runSecondary(state.flat[state.active]); return; }
    if (t.closest("[data-cmdk-pri]")) { var pr = host.querySelector('[data-cmdk-row="' + state.active + '"]'); if (pr) pr.click(); return; }
    var row = t.closest("[data-cmdk-row]");
    if (row) { state.active = Number(row.getAttribute("data-cmdk-row")); runPrimary(state.flat[state.active]); }
  });
  document.addEventListener("mousemove", function (e) {
    if (!state.open || mobile() || !e.target.closest) return;
    var row = e.target.closest("[data-cmdk-row]");
    if (!row) return;
    var n = Number(row.getAttribute("data-cmdk-row"));
    if (n !== state.active) { state.active = n; syncActive(false); }
  });
  document.addEventListener("focusin", function (e) {
    if (!QUIET && !state.open && e.target.id === "nvSearchIn") { open(e.target); return; }
    if (state.open && host && !host.contains(e.target) && e.target !== inputEl() && !(e.target.closest && e.target.closest("[data-lv-menu], .an-modal"))) inputEl().focus();
  });
  document.addEventListener("mousedown", function (e) {
    if (!state.open || !state.drop || !e.target.closest) return;
    if (host.contains(e.target) || e.target.closest("[data-nv-sfield], [data-lv-menu]")) return;
    close(false);
  });

  // =========================================================== header field label and hand-offs from the palette
  [].forEach.call(document.querySelectorAll(".nv-sbtn .nv-kbd"), function (k) { k.textContent = MOD + "K"; });
  var amt = K.ss("nv_topup_amount");
  if (amt && FILE === "wallet.html") {
    K.ss("nv_topup_amount", null);
    setTimeout(function () {
      var inp = document.querySelector("[data-wl-amount]");
      if (!inp) return;
      inp.value = amt;
      inp.dispatchEvent(new Event("input", { bubbles: true }));
    }, 60);
  }
  if (FILE === "analytics-basic-data.html" && qp.get("q")) {
    var sq = document.querySelector("[data-an-search]");
    if (sq) { sq.value = qp.get("q"); sq.dispatchEvent(new Event("input", { bubbles: true })); }
  }
  if (qp.get("search") != null) { open(); state.q = qp.get("search"); renderAll(); }
  window.V2Search = { open: open, close: close };
})();

// Analytics (basic-data) — косметический интерактив прототипа: ModePopover, выбор строк →
// футер, очистка поиска. Данные статичны; сортировка/пагинация не подключены к бэкенду.
(function () {
  function updateFooter() {
    var n = document.querySelectorAll("[data-an-check].is-checked").length;
    var footer = document.querySelector("[data-an-footer]");
    if (!footer) return;
    if (n > 0) {
      footer.hidden = false;
      var btn = footer.querySelector("[data-an-footer-btn]");
      if (btn) btn.textContent = "Add " + n + " channel" + (n === 1 ? "" : "s") + " to collection";
    } else {
      footer.hidden = true;
    }
    // состояние «select all» — считаем по видимым строкам страницы
    var vis = [].slice.call(document.querySelectorAll("[data-an-check]")).filter(function (b) {
      var r = b.closest(".an-tr");
      return !(r && r.hidden);
    });
    var allBtn = document.querySelector("[data-an-check-all]");
    var visOn = vis.filter(function (b) { return b.classList.contains("is-checked"); }).length;
    if (allBtn) allBtn.classList.toggle("is-checked", vis.length > 0 && visOn === vis.length);
  }
  // A3: подсветка выбранных строк
  function markSelected() {
    [].slice.call(document.querySelectorAll("[data-an-check]")).forEach(function (b) {
      var row = b.closest(".an-tr");
      if (row) row.classList.toggle("is-selected", b.classList.contains("is-checked"));
    });
  }

  document.addEventListener("click", function (e) {
    // ModePopover: открыть/закрыть
    var trig = e.target.closest("[data-an-mode-toggle]");
    var modeRoot = document.querySelector("[data-an-mode]");
    if (trig && modeRoot) {
      var menu = modeRoot.querySelector("[data-an-mode-menu]");
      var open = menu.hidden;
      menu.hidden = !open;
      modeRoot.classList.toggle("is-open", open);
      e.stopPropagation();
      return;
    }
    // выбор режима поиска
    var opt = e.target.closest("[data-an-mode-opt]");
    if (opt && modeRoot) {
      var opts = modeRoot.querySelectorAll("[data-an-mode-opt]");
      for (var i = 0; i < opts.length; i++) opts[i].classList.remove("is-selected");
      opt.classList.add("is-selected");
      var mode = opt.getAttribute("data-an-mode-opt");
      var label = modeRoot.querySelector(".an-mode__label");
      var input = document.querySelector("[data-an-search]");
      if (mode === "semantic") {
        if (label) label.textContent = "AI semantic search";
        if (input) input.placeholder = "Describe what you are looking for (e.g. travel, cooking, tech)";
      } else {
        if (label) label.textContent = "Traditional search";
        if (input) input.placeholder = "Search by YouTube channel name, link or UC";
      }
      var m = modeRoot.querySelector("[data-an-mode-menu]"); if (m) m.hidden = true;
      modeRoot.classList.remove("is-open");
      return;
    }
    // клик вне меню — закрыть
    if (modeRoot && !e.target.closest("[data-an-mode]")) {
      var mm = modeRoot.querySelector("[data-an-mode-menu]"); if (mm) mm.hidden = true;
      modeRoot.classList.remove("is-open");
    }

    // чекбоксы строк
    var cb = e.target.closest("[data-an-check]");
    if (cb) { cb.classList.toggle("is-checked"); markSelected(); updateFooter(); return; }
    // select all
    var cbAll = e.target.closest("[data-an-check-all]");
    if (cbAll) {
      var on = !cbAll.classList.contains("is-checked");
      cbAll.classList.toggle("is-checked", on);
      // выделяем только видимые строки текущей страницы — как на проде
      var boxes = document.querySelectorAll("[data-an-check]");
      for (var j = 0; j < boxes.length; j++) {
        var r = boxes[j].closest(".an-tr");
        if (r && r.hidden) continue;
        boxes[j].classList.toggle("is-checked", on);
      }
      markSelected();
      updateFooter();
      return;
    }
    // футер: очистить выбор
    if (e.target.closest("[data-an-footer-close]")) {
      var all = document.querySelectorAll("[data-an-check], [data-an-check-all]");
      for (var k = 0; k < all.length; k++) all[k].classList.remove("is-checked");
      markSelected();
      updateFooter();
      return;
    }
    // --- P1.13: панель фильтров ---
    if (e.target.closest("[data-an-filters-toggle]")) {
      flOpen(!document.body.classList.contains("filters-open"));
      return;
    }
    if (e.target.closest("[data-an-filters-close]")) { flOpen(false); return; }
    if (e.target.closest("[data-an-filters-clear]")) { flClear(); return; }
    var fTrig = e.target.closest("[data-anf-trig]");
    if (fTrig) {
      var sel = fTrig.closest(".anf-select"), menu = sel.querySelector("[data-anf-menu]");
      var willOpen = menu.hidden;
      // закрываем остальные
      [].slice.call(document.querySelectorAll(".anf-select")).forEach(function (o) {
        if (o !== sel) { o.classList.remove("is-open"); var m = o.querySelector("[data-anf-menu]"); if (m) m.hidden = true; }
      });
      menu.hidden = !willOpen;
      sel.classList.toggle("is-open", willOpen);
      fTrig.setAttribute("aria-expanded", willOpen ? "true" : "false");
      return;
    }
    var fOpt = e.target.closest("[data-anf-opt]");
    if (fOpt) {
      var selRoot = fOpt.closest(".anf-select");
      var valEl = selRoot.querySelector("[data-anf-val]");
      if (valEl) { valEl.textContent = fOpt.getAttribute("data-anf-opt"); valEl.classList.remove("is-ph"); }
      [].slice.call(selRoot.querySelectorAll(".anf-opt")).forEach(function (o) { o.classList.toggle("is-selected", o === fOpt); });
      var m2 = selRoot.querySelector("[data-anf-menu]"); if (m2) m2.hidden = true;
      selRoot.classList.remove("is-open");
      flApply();
      return;
    }
    var fSeg = e.target.closest("[data-anf-seg]");
    if (fSeg) {
      [].slice.call(fSeg.parentNode.querySelectorAll(".anf-seg__btn")).forEach(function (b) {
        b.classList.toggle("is-on", b === fSeg);
        b.setAttribute("aria-checked", b === fSeg ? "true" : "false");
      });
      flApply();
      return;
    }
    var pSet = e.target.closest("[data-an-period-set]");
    if (pSet) { flSetPeriod(pSet.getAttribute("data-an-period-set")); return; }
    // --- P1.6: срез метрики по типу контента (до сортировки: селектор внутри .an-sort) ---
    var slT = e.target.closest("[data-an-slice-trig]");
    if (slT) {
      var slCol = slT.getAttribute("data-an-slice-trig");
      var slW = slT.closest("[data-an-slice]");
      var slM = slW.querySelector("[data-an-slice-menu]");
      slMenu(slM && slM.hidden ? slCol : null);
      return;
    }
    var slO = e.target.closest("[data-an-slice-opt]");
    if (slO) { slSetCol(slO.getAttribute("data-col"), slO.getAttribute("data-an-slice-opt")); return; }
    if (!e.target.closest("[data-an-slice]")) slMenu(null);
    // --- P1.8: сводка Average / Total ---
    var gsT = e.target.closest("[data-an-gs-trig]");
    if (gsT) {
      var gsW = gsT.closest("[data-an-gs]");
      var gsM = gsW.querySelector("[data-an-gs-menu]");
      gsMenu(gsM ? gsM.hidden : true, gsW);
      return;
    }
    var gsO = e.target.closest("[data-an-gs-opt]");
    if (gsO) { gsSet(gsO.getAttribute("data-an-gs-opt")); return; }
    if (!e.target.closest("[data-an-gs]")) gsMenu(false);
    // --- P1.7: видимость колонок ---
    if (e.target.closest("[data-an-cols-trig]")) {
      var cvM = document.querySelector("[data-an-cols-menu]");
      cvMenu(cvM ? cvM.hidden : true);
      return;
    }
    if (e.target.closest("[data-an-cols-reset]")) { cvReset(); return; }
    var cvOpt = e.target.closest("[data-an-cols-opt]");
    if (cvOpt) { cvToggle(cvOpt.getAttribute("data-an-cols-opt")); return; }
    var cvX = e.target.closest("[data-an-colx]");
    if (cvX) { cvToggle(cvX.getAttribute("data-an-colx")); return; }   // × в шапке = снять колонку
    if (!e.target.closest("[data-an-cols]")) cvMenu(false);
    // --- P1.4: модалка «New channels» ---
    if (e.target.closest("[data-nc-open]")) { ncOpen(); return; }
    if (e.target.closest("[data-nc-close]")) { closeModal(document.getElementById("ncModal")); return; }
    if (e.target.closest("[data-nc-new-open]")) { ncNewForm(true); return; }
    if (e.target.closest("[data-nc-new-cancel]")) { ncNewForm(false); return; }
    if (e.target.closest("[data-nc-new-submit]")) { ncCreate(); return; }
    if (e.target.closest("[data-nc-submit]")) { ncSubmit(); return; }
    var ncIt = e.target.closest("[data-nc-item]");
    if (ncIt) {
      var ncNm = ncIt.getAttribute("data-nc-item");
      if (ncSel[ncNm]) delete ncSel[ncNm]; else ncSel[ncNm] = true;
      ncRender();
      return;
    }
    // --- P1.1: селектор коллекции у счётчика ---
    var csTrig = e.target.closest("[data-an-collsel-trig]");
    if (csTrig) {
      var csW = csTrig.closest("[data-an-collsel]");
      var csM = csW.querySelector("[data-an-collsel-menu]");
      csOpen(csW, csM.hidden);
      return;
    }
    if (e.target.closest("[data-an-collsel-all]")) {           // A3: All channels
      csPickAll(e.target.closest("[data-an-collsel]"));
      return;
    }
    var csOpt = e.target.closest("[data-an-collsel-opt]");
    if (csOpt) {
      csPick(csOpt.closest("[data-an-collsel]"), csOpt.getAttribute("data-an-collsel-opt"));
      return;
    }
    // --- A5: топики кликабельны, «+N» раскрывает остальные ---
    var tMore = e.target.closest("[data-an-topics-more]");
    if (tMore) {
      var all = (tMore.getAttribute("data-an-topics-more") || "").split("|").filter(Boolean);
      var box = tMore.parentNode;
      box.innerHTML = all.map(function (t) {
        return '<span class="an-topic" data-an-topic="' + escHtml(t) + '">' + escHtml(t) + "</span>";
      }).join("");
      box.classList.add("is-expanded");
      return;
    }
    var tOne = e.target.closest("[data-an-topic]");
    if (tOne) {
      var act2 = flActive();
      var tf = act2 && act2.querySelector('[data-anf-field="topic"] [data-anf-val]');
      if (tf) { tf.textContent = tOne.getAttribute("data-an-topic"); tf.classList.remove("is-ph"); }
      flApply();
      return;
    }
    // --- A8: футер «Add N channels to collection» ---
    if (e.target.closest("[data-an-footer-btn]")) { acOpen(); return; }
    if (e.target.closest("[data-ac-close]")) { closeModal(document.getElementById("acModal")); return; }
    if (e.target.closest("[data-ac-new-open]")) { acNewForm(true); return; }
    if (e.target.closest("[data-ac-new-cancel]")) { acNewForm(false); return; }
    if (e.target.closest("[data-ac-new-submit]")) { acCreate(); return; }
    if (e.target.closest("[data-ac-submit]")) { acSubmit(); return; }
    var acIt = e.target.closest("[data-ac-item]");
    if (acIt) {
      var acNm = acIt.getAttribute("data-ac-item");
      if (acSel[acNm]) delete acSel[acNm]; else acSel[acNm] = true;
      acRender();
      return;
    }
    if (!e.target.closest("[data-an-collsel]")) csWraps().forEach(function (w) { csOpen(w, false); });
    if (!e.target.closest(".anf-select")) {
      [].slice.call(document.querySelectorAll(".anf-select.is-open")).forEach(function (o) {
        o.classList.remove("is-open");
        var m = o.querySelector("[data-anf-menu]"); if (m) m.hidden = true;
      });
    }
    // --- P1.5: сортировка ---
    var sortEl = e.target.closest("[data-an-sort]");
    if (sortEl) {
      var sKey = tblKeyOf(sortEl);
      if (sKey) { tblSort(sKey, sortEl.getAttribute("data-an-sort")); return; }
    }
    // --- P1.5: пагинация ---
    var prevEl = e.target.closest("[data-an-prev]"), nextEl = e.target.closest("[data-an-next]");
    if (prevEl || nextEl) {
      var pKey = tblKeyOf(prevEl || nextEl);
      if (pKey) {
        TBL[pKey].page += prevEl ? -1 : 1;
        if (TBL[pKey].page < 1) TBL[pKey].page = 1;
        tblApply(pKey);
        return;
      }
    }
    // --- P1.5: размер страницы ---
    var ppTrig = e.target.closest("[data-an-perpage-trig]");
    if (ppTrig) {
      var ppKey = tblKeyOf(ppTrig);
      var menuEl = ppTrig.parentNode.querySelector("[data-an-perpage-menu]");
      tblPerPageMenu(ppKey, menuEl ? menuEl.hidden : true);
      return;
    }
    var ppOpt = e.target.closest("[data-an-perpage]");
    if (ppOpt) {
      var oKey = tblKeyOf(ppOpt);
      TBL[oKey].per = parseInt(ppOpt.getAttribute("data-an-perpage"), 10) || 30;
      TBL[oKey].page = 1;
      tblPerPageMenu(oKey, false);
      tblApply(oKey);
      return;
    }
    if (!e.target.closest("[data-an-perpage-wrap]")) {
      ["basic", "deep", "coll", "video"].forEach(function (k) { tblPerPageMenu(k, false); });
    }
    // очистка поиска
    if (e.target.closest("[data-an-search-clear]")) {
      var inp = document.querySelector("[data-an-search]");
      if (inp) inp.value = "";
      var cl = document.querySelector("[data-an-search-clear]"); if (cl) cl.hidden = true;
      return;
    }
  });

  // ================= A6: авто-переключение режима поиска =================
  // Ссылка/UC-id — это точный поиск, свободный текст — семантический. Ручной выбор
  // пользователя уважаем: после явного клика в меню авто-переключение отключаем.
  var modeManual = false, modeAutoRunning = false;
  document.addEventListener("click", function (e) {
    if (!modeAutoRunning && e.target.closest("[data-an-mode-opt]")) modeManual = true;
  }, true);
  function modeSet(mode) {
    var root = document.querySelector("[data-an-mode]");
    if (!root) return;
    var cur = root.querySelector("[data-an-mode-opt].is-selected");
    if (cur && cur.getAttribute("data-an-mode-opt") === mode) return;
    var opt = root.querySelector('[data-an-mode-opt="' + mode + '"]');
    if (!opt) return;
    modeAutoRunning = true;          // свой же клик не считаем ручным выбором
    opt.click();
    modeAutoRunning = false;
  }
  function modeAuto(val) {
    if (modeManual) return;
    var v = String(val || "").trim();
    if (!v) return;
    var exact = /^(https?:\/\/|www\.|youtube\.com|youtu\.be|@|UC[\w-]{10,})/i.test(v) || /youtube\.com|youtu\.be/i.test(v);
    modeSet(exact ? "traditional" : "semantic");
  }

  // P1.9: поиск по видео — мгновенно
  var vidSq = document.querySelector("[data-vid-search]");
  if (vidSq) vidSq.addEventListener("input", vidApply);

  // P1.4: счётчик ссылок и поиск по коллекциям — мгновенно
  var ncTa = document.querySelector("[data-nc-links]");
  if (ncTa) ncTa.addEventListener("input", ncSync);
  var ncSq = document.querySelector("[data-nc-search]");
  if (ncSq) ncSq.addEventListener("input", ncRender);
  var ncNi = document.querySelector("[data-nc-new-name]");
  if (ncNi) ncNi.addEventListener("keyup", function (e) { if (e.key === "Enter") ncCreate(); });
  // A8: поиск и Enter в модалке «Add channels to collection»
  var acSq = document.querySelector("[data-ac-search]");
  if (acSq) acSq.addEventListener("input", acRender);
  var acNi = document.querySelector("[data-ac-new-name]");
  if (acNi) acNi.addEventListener("keyup", function (e) { if (e.key === "Enter") acCreate(); });

  var input = document.querySelector("[data-an-search]");
  if (input) input.addEventListener("input", function () {
    var cl = document.querySelector("[data-an-search-clear]");
    if (cl) cl.hidden = input.value.length === 0;
    modeAuto(input.value);          // A6
  });


  // ================= P1.6: срезы метрик по типу контента =================
  // Значения всех срезов лежат в data-атрибутах ячейки (data-sl-videos="1.7k|pos"),
  // сводная строка — в data-avg-<срез> / data-total-<срез>. Выбор запоминается на колонку.
  var SL_KEY = "subsub_deep_slice";
  function slLoad() {
    try { var v = JSON.parse(localStorage.getItem(SL_KEY) || "{}"); return v && typeof v === "object" ? v : {}; }
    catch (e) { return {}; }
  }
  function slSave(col, slice) {
    var st = slLoad();
    st[col] = slice;
    try { localStorage.setItem(SL_KEY, JSON.stringify(st)); } catch (e) {}
  }
  function slMenu(col) {
    [].slice.call(document.querySelectorAll("[data-an-slice]")).forEach(function (w) {
      var on = col && w.getAttribute("data-an-slice") === col;
      var m = w.querySelector("[data-an-slice-menu]");
      if (m) m.hidden = !on;
      w.classList.toggle("is-open", !!on);
    });
  }
  function slSetCol(col, slice, quiet) {
    var body = tblBody("deep");
    if (!body) return;
    var opt = document.querySelector('[data-an-slice-opt="' + slice + '"][data-col="' + col + '"]');
    var lbl = document.querySelector('[data-an-slice-lbl="' + col + '"]');
    if (lbl && opt && slice !== "all") lbl.textContent = opt.getAttribute("data-lbl");
    if (lbl && slice === "all" && opt) lbl.textContent = opt.getAttribute("data-lbl");
    [].slice.call(document.querySelectorAll('[data-an-slice-opt][data-col="' + col + '"]')).forEach(function (b) {
      b.classList.toggle("is-selected", b.getAttribute("data-an-slice-opt") === slice);
    });
    [].slice.call(body.querySelectorAll('.an-tbody > .an-tr:not(.an-tr--avg) [data-col="' + col + '"]')).forEach(function (cell) {
      var raw = cell.getAttribute("data-sl-" + slice);
      if (!raw) return;
      var parts = raw.split("|"), heat = cell.querySelector(".an-heat");
      if (!heat) return;
      heat.textContent = parts[0];
      heat.classList.toggle("an-heat--pos", parts[1] === "pos");
      heat.classList.toggle("an-heat--neg", parts[1] !== "pos");
    });
    [].slice.call(body.querySelectorAll('.an-tr--avg [data-col="' + col + '"]')).forEach(function (cell) {
      var a = cell.getAttribute("data-avg-" + slice), t = cell.getAttribute("data-total-" + slice);
      if (a != null) cell.setAttribute("data-avg", a);
      if (t != null) cell.setAttribute("data-total", t);
    });
    if (!quiet) { slSave(col, slice); gsApply(gsMode()); slMenu(null); }
  }
  function slInit() {
    if (!tblBody("deep")) return;
    var st = slLoad();
    Object.keys(st).forEach(function (col) { slSetCol(col, st[col], true); });
  }

  // ================= P1.8: сводная строка Average / Total =================
  // В режиме Total прод гасит хитмап («Insights unavailable in Total mode»), повторяем.
  var GS_KEY = "subsub_deep_gs";
  function gsMode() {
    try { return localStorage.getItem(GS_KEY) === "total" ? "total" : "average"; } catch (e) { return "average"; }
  }
  function gsApply(mode) {
    var body = tblBody("deep");
    if (!body) return;
    [].slice.call(body.querySelectorAll(".an-tr--avg [data-avg]")).forEach(function (cell) {
      cell.textContent = mode === "total" ? cell.getAttribute("data-total") : cell.getAttribute("data-avg");
    });
    body.classList.toggle("is-total", mode === "total");
    [].slice.call(body.querySelectorAll("[data-an-gs-val]")).forEach(function (el) {
      el.textContent = mode === "total" ? "Total" : "Average";
    });
    [].slice.call(body.querySelectorAll("[data-an-gs-opt]")).forEach(function (b) {
      b.classList.toggle("is-selected", b.getAttribute("data-an-gs-opt") === mode);
    });
  }
  function gsMenu(open, wrap) {
    [].slice.call(document.querySelectorAll("[data-an-gs]")).forEach(function (w) {
      var m = w.querySelector("[data-an-gs-menu]");
      if (m) m.hidden = !(open && w === wrap);
    });
  }
  function gsSet(mode) {
    try { localStorage.setItem(GS_KEY, mode); } catch (e) {}
    gsApply(mode);
    gsMenu(false);
  }
  function gsInit() { if (tblBody("deep")) gsApply(gsMode()); }

  // ================= P1.7: видимость колонок Deep data =================
  // Отличие от прода: там изменения применяются при закрытии поповера, здесь — сразу
  // (иначе в прототипе клик по чекбоксу выглядит как «не работает»).
  var CV_KEY = "subsub_deep_cols";
  function cvDefaults() {
    var out = {};
    [].slice.call(document.querySelectorAll("[data-an-cols-opt]")).forEach(function (b) {
      out[b.getAttribute("data-an-cols-opt")] = b.classList.contains("is-checked");
    });
    return out;
  }
  var cvDefault = null;
  function cvLoad() {
    try { var v = JSON.parse(localStorage.getItem(CV_KEY) || "null"); return v && typeof v === "object" ? v : null; }
    catch (e) { return null; }
  }
  function cvSave(v) { try { localStorage.setItem(CV_KEY, JSON.stringify(v)); } catch (e) {} }
  function cvApply(state) {
    var body = tblBody("deep");
    if (!body) return;
    Object.keys(state).forEach(function (id) {
      var on = !!state[id];
      [].slice.call(body.querySelectorAll('[data-col="' + id + '"]')).forEach(function (cell) {
        cell.classList.toggle("is-colhidden", !on);
      });
      var box = document.querySelector('[data-an-cols-opt="' + id + '"]');
      if (box) box.classList.toggle("is-checked", on);
    });
  }
  function cvInit() {
    if (!document.querySelector("[data-an-cols]")) return;
    cvDefault = cvDefaults();
    var st = cvLoad();
    if (st) cvApply(st);
  }
  function cvToggle(id) {
    var st = cvLoad() || cvDefaults();
    st[id] = !st[id];
    cvSave(st);
    cvApply(st);
  }
  function cvReset() {
    if (!cvDefault) return;
    var st = {};
    Object.keys(cvDefault).forEach(function (k) { st[k] = cvDefault[k]; });
    cvSave(st);
    cvApply(st);
    cvMenu(false);
  }
  function cvMenu(open) {
    var m = document.querySelector("[data-an-cols-menu]");
    if (m) m.hidden = !open;
  }

  // ================= P1.1: селектор коллекции у счётчика =================
  // Один компонент на Basic и Deep, но смысл разный: на Basic это тот же фильтр,
  // что поле Collection в панели (держим их синхронно), на Deep — переключение набора
  // строк (в разметке лежат строки всех активированных коллекций, помечены data-coll).
  function csWraps() { return [].slice.call(document.querySelectorAll("[data-an-collsel]")); }
  function csList(key) {
    var all = (typeof aiAllColls === "function" ? aiAllColls() : []);
    // deep data (оба таба) открывается только по активированным коллекциям (как на проде)
    if (key !== "deep" && key !== "video") return all;
    var have = {};
    tblAllRows(key).forEach(function (r) { have[r.getAttribute("data-coll") || ""] = true; });
    return all.filter(function (c) { return have[c.name]; });
  }
  function csVal(wrap) { return wrap.querySelector("[data-an-collsel-val]"); }
  function csCurrent(wrap) {
    var v = csVal(wrap);
    return v && !v.classList.contains("an-collsel__txt--ph") ? v.textContent.trim() : "";
  }
  function csFill(wrap, q) {
    var box = wrap.querySelector("[data-an-collsel-opts]");
    if (!box) return;
    var key = wrap.getAttribute("data-an-collsel");
    var cur = csCurrent(wrap), s = (q || "").toLowerCase();
    var list = csList(key).filter(function (c) {
      return !s || c.name.toLowerCase().indexOf(s) !== -1;
    });
    // A3: на Basic data первым пунктом «All channels» — сброс фильтра по коллекции
    var head = (key === "basic" && !s)
      ? '<button class="anf-opt' + (cur ? "" : " is-selected") + '" type="button" role="option" data-an-collsel-all>All channels</button>'
      : "";
    box.innerHTML = head + (list.map(function (c) {
      return '<button class="anf-opt' + (c.name === cur ? " is-selected" : "") + '" type="button" role="option" ' +
             'data-an-collsel-opt="' + escHtml(c.name) + '">' + escHtml(c.name) + "</button>";
    }).join("") || (head ? "" : '<div class="anf-empty">No collections</div>'));
  }
  // A3: сброс к «All channels» — снимаем и поле Collection в панели
  function csPickAll(wrap) {
    csSetLabel(wrap, "");
    csOpen(wrap, false);
    var act = flActive();
    var f = act && act.querySelector('[data-anf-field="collection"] [data-anf-val]');
    if (f) {
      var ph = f.getAttribute("data-anf-ph");
      if (ph) f.textContent = ph;
      f.classList.add("is-ph");
    }
    flApply();
  }
  function csOpen(wrap, open) {
    csWraps().forEach(function (w) {
      var m = w.querySelector("[data-an-collsel-menu]"), t = w.querySelector("[data-an-collsel-trig]");
      var on = w === wrap && !!open;
      if (m) m.hidden = !on;
      w.classList.toggle("is-open", on);
      if (t) t.setAttribute("aria-expanded", on ? "true" : "false");
    });
    if (open && wrap) {
      csFill(wrap, "");
      var si = wrap.querySelector("[data-an-collsel-search]");
      if (si) { si.value = ""; si.focus(); }
    }
  }
  function csSetLabel(wrap, name) {
    var v = csVal(wrap);
    if (!v) return;
    if (name) { v.textContent = name; v.classList.remove("an-collsel__txt--ph"); }
    else { v.textContent = v.getAttribute("data-an-collsel-ph") || ""; v.classList.add("an-collsel__txt--ph"); }
  }
  function csPick(wrap, name) {
    var key = wrap.getAttribute("data-an-collsel");
    csSetLabel(wrap, name);
    csOpen(wrap, false);
    if (key === "deep") csApplyDeep(name);
    else if (key === "video") csApplyVideo(name);
    else csApplyBasic(name);
  }
  // Basic: коллекция — это фильтр, поэтому пишем значение в панель и применяем её целиком
  function csApplyBasic(name) {
    var act = flActive();
    if (act) {
      var f = act.querySelector('[data-anf-field="collection"]');
      if (f) {
        var v = f.querySelector("[data-anf-val]");
        if (v) { v.textContent = name; v.classList.remove("is-ph"); }
      }
    }
    flApply();
  }
  // Deep: коллекция задаёт набор строк — пишем её в панель и применяем панель целиком
  function csApplyDeep(name) {
    var act = flActive();
    var f = act && act.querySelector('[data-anf-field="collection"] [data-anf-val]');
    if (f) { f.textContent = name; f.classList.remove("is-ph"); }
    var badge = document.querySelector("[data-ai-badge]");
    if (badge) {
      var rec = csList("deep").filter(function (c) { return c.name === name; })[0];
      badge.hidden = !(rec && rec.isAi);
    }
    flApply();
  }
  // P1.9: таб Videos — свой набор строк на коллекцию + поиск по названию/каналу
  function vidApply() {
    var w = document.querySelector('[data-an-collsel="video"]');
    var coll = w ? csCurrent(w) : "";
    var q = (document.querySelector("[data-vid-search]") || {}).value || "";
    q = q.trim().toLowerCase();
    tblAllRows("video").forEach(function (row) {
      var ok = !coll || (row.getAttribute("data-coll") || "") === coll;
      if (ok && q) {
        var t = row.querySelector(".vid-title__t"), ch = row.querySelector(".vid-title__chan");
        var hay = ((t ? t.textContent : "") + " " + (ch ? ch.textContent : "")).toLowerCase();
        if (hay.indexOf(q) === -1) ok = false;
      }
      if (ok) row.removeAttribute("data-filtered"); else row.setAttribute("data-filtered", "");
    });
    TBL.video.page = 1;
    tblApply("video");
  }
  function csApplyVideo(name) {
    var act = flActive();
    var f = act && act.querySelector('[data-anf-field="collection"] [data-anf-val]');
    if (f) { f.textContent = name; f.classList.remove("is-ph"); }
    vidApply();
    flDot();
  }

  // обратная синхронизация: значение поля Collection в панели → подпись селектора
  function csSyncFromPanel() {
    var w = document.querySelector('[data-an-collsel="basic"]');
    if (!w) return;
    var act = flActive();
    var f = act && act.querySelector('[data-anf-field="collection"] [data-anf-val]');
    csSetLabel(w, f && !f.classList.contains("is-ph") ? f.textContent.trim() : "");
  }
  csWraps().forEach(function (w) {
    var si = w.querySelector("[data-an-collsel-search]");
    if (si) si.addEventListener("input", function () { csFill(w, si.value); });
  });
  // на Deep коллекция выбрана всегда — поле Collection в панели показывает её же
  function csSyncToPanel() {
    var w = document.querySelector('[data-an-collsel="deep"]') || document.querySelector('[data-an-collsel="video"]');
    if (!w) return;
    var name = csCurrent(w);
    if (!name) return;
    var act = flActive();
    var f = act && act.querySelector('[data-anf-field="collection"] [data-anf-val]');
    if (f) { f.textContent = name; f.classList.remove("is-ph"); }
  }

  // ================= P1.5: клиентская сортировка + пагинация =================
  // Работает по статическим строкам в DOM: сортировка переставляет узлы, пагинация
  // скрывает лишние. Строки, скрытые другими фильтрами (data-filtered), в выборку не попадают.
  var TBL = {
    basic: { per: 30, sizes: [30, 50, 100], sort: null, page: 1 },
    deep:  { per: 30, sizes: [30, 50, 100], sort: null, page: 1 },
    coll:  { per: 15, sizes: [15, 30, 50],  sort: null, page: 1 },
    video: { per: 10, sizes: [10, 25, 50],  sort: null, page: 1 }   // P1.9: на проде 10
  };
  function tblBody(key) { return document.querySelector('[data-an-table-body="' + key + '"]'); }
  function tblPagi(key) { return document.querySelector('[data-an-table="' + key + '"]'); }
  function tblAllRows(key) {
    var b = tblBody(key);
    return b ? [].slice.call(b.querySelectorAll(".an-tbody > .an-tr")) : [];
  }
  // строки, доступные для показа (не отфильтрованные), без сводной строки Average/Total
  function tblRows(key) {
    return tblAllRows(key).filter(function (r) {
      return !r.hasAttribute("data-filtered") && !r.classList.contains("an-tr--avg");
    });
  }
  function tblColIndex(key, colId) {
    var b = tblBody(key);
    if (!b) return -1;
    var cells = [].slice.call(b.querySelectorAll(".an-thead .an-tr--head > [data-col]"));
    for (var i = 0; i < cells.length; i++) if (cells[i].getAttribute("data-col") === colId) return i;
    return -1;
  }
  // «314m» → 314000000, «+3.6m» → 3600000, «19.11.2005» → таймстемп, иначе строка
  function tblVal(row, idx) {
    var cell = row.children[idx];
    var t = cell ? String(cell.textContent || "").trim() : "";
    if (!t || t === "—" || t === "–") return -Infinity;
    var d = t.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (d) return new Date(+d[3], +d[2] - 1, +d[1]).getTime();
    var n = t.replace(/[+,\s]/g, "").match(/^([\d.]+)(bn|m|k)?$/i);
    if (n) {
      var v = parseFloat(n[1]) || 0, u = (n[2] || "").toLowerCase();
      if (u === "bn") v *= 1e9; else if (u === "m") v *= 1e6; else if (u === "k") v *= 1e3;
      return v;
    }
    return t.toLowerCase();
  }
  function tblSort(key, colId) {
    var st = TBL[key]; if (!st) return;
    // первый клик — desc, дальше переключаем (как на проде)
    st.sort = (st.sort && st.sort.col === colId)
      ? { col: colId, dir: st.sort.dir === "desc" ? "asc" : "desc" }
      : { col: colId, dir: "desc" };
    st.page = 1;
    var idx = tblColIndex(key, colId);
    if (idx < 0) return;
    var body = tblBody(key).querySelector(".an-tbody");
    var rows = tblAllRows(key).filter(function (r) { return !r.classList.contains("an-tr--avg"); });
    var dir = st.sort.dir === "asc" ? 1 : -1;
    rows.map(function (r, i) { return { r: r, i: i, v: tblVal(r, idx) }; })
      .sort(function (a, b) {
        if (a.v === b.v) return a.i - b.i;                 // стабильность
        if (typeof a.v === "string" || typeof b.v === "string")
          return String(a.v).localeCompare(String(b.v)) * dir;
        return (a.v > b.v ? 1 : -1) * dir;
      })
      .forEach(function (o) { body.appendChild(o.r); });
    tblMarkSort(key);
    tblApply(key);
  }
  function tblMarkSort(key) {
    var b = tblBody(key); if (!b) return;
    var st = TBL[key];
    [].slice.call(b.querySelectorAll("[data-an-sort]")).forEach(function (el) {
      var on = st.sort && st.sort.col === el.getAttribute("data-an-sort");
      el.classList.toggle("is-sorted", !!on);
      el.classList.toggle("is-asc", !!on && st.sort.dir === "asc");
      el.setAttribute("aria-sort", on ? (st.sort.dir === "asc" ? "ascending" : "descending") : "none");
    });
  }
  // показ страницы + пересчёт счётчиков
  function tblApply(key) {
    var st = TBL[key]; if (!st) return;
    var rows = tblRows(key);
    var pages = Math.max(1, Math.ceil(rows.length / st.per));
    if (st.page > pages) st.page = pages;
    var from = (st.page - 1) * st.per, to = from + st.per;
    tblAllRows(key).forEach(function (r) {
      // сводная строка видна всегда — кроме сводок «чужих» коллекций (P1.1)
      if (r.classList.contains("an-tr--avg")) { r.hidden = r.hasAttribute("data-filtered"); return; }
      r.hidden = true;
    });
    rows.slice(from, to).forEach(function (r) { r.hidden = false; });
    if (typeof markSelected === "function") markSelected();
    var pagi = tblPagi(key);
    if (pagi) {
      var pagesEl = pagi.querySelector(".an-pagi__pages");
      if (pagesEl) pagesEl.textContent = "Pages: " + pages.toLocaleString("en-US");
      var input = pagi.querySelector("[data-an-page]");
      if (input) input.value = String(st.page);
      var prev = pagi.querySelector("[data-an-prev]"), next = pagi.querySelector("[data-an-next]");
      if (prev) prev.disabled = st.page <= 1;
      if (next) next.disabled = st.page >= pages;
      var trig = pagi.querySelector("[data-an-perpage-trig]");
      if (trig) trig.childNodes[0].nodeValue = st.per + " ";
    }
    tblUpdateTotal(key, rows.length);
  }
  // A7: «2.2m channels · showing 1–30» — какой диапазон видно на текущей странице
  function tblUpdateShown(key, rows) {
    var pagi = tblPagi(key); if (!pagi) return;
    var el = pagi.querySelector("[data-an-shown]"); if (!el) return;
    var st = TBL[key];
    if (!rows) { el.textContent = "nothing to show"; return; }
    var from = (st.page - 1) * st.per + 1, to = Math.min(rows, st.page * st.per);
    el.textContent = "showing " + from.toLocaleString("en-US") + "–" + to.toLocaleString("en-US");
  }
  // счётчик рядом с лейблом: на Basic оставляем «2.2m» (это размер базы), в остальных — число строк
  function tblUpdateTotal(key, n) {
    tblUpdateShown(key, n);
    if (key === "basic") return;
    var pagi = tblPagi(key); if (!pagi) return;
    var tot = pagi.querySelector(".an-pagi__total");
    if (tot) tot.textContent = String(n);
  }
  function tblPerPageMenu(key, open) {
    var pagi = tblPagi(key); if (!pagi) return;
    var wrap = pagi.querySelector("[data-an-perpage-wrap]"), menu = pagi.querySelector("[data-an-perpage-menu]");
    if (!wrap || !menu) return;
    if (open) {
      menu.innerHTML = TBL[key].sizes.map(function (n) {
        return '<button class="an-perpage__opt' + (n === TBL[key].per ? " is-selected" : "") +
               '" type="button" role="option" data-an-perpage="' + n + '">' + n + "</button>";
      }).join("");
    }
    menu.hidden = !open;
    wrap.classList.toggle("is-open", !!open);
  }
  function tblKeyOf(el) {
    var host = el.closest("[data-an-table]") || el.closest("[data-an-table-body]");
    return host ? (host.getAttribute("data-an-table") || host.getAttribute("data-an-table-body")) : null;
  }
  function tblInitAll() {
    ["basic", "deep", "coll", "video"].forEach(function (key) {
      if (tblBody(key)) tblApply(key);
    });
  }

  // ================= P1.9: табы Channels / Videos (?tab=) =================
  function tabCurrent() {
    var t = (new URLSearchParams(location.search).get("tab") || "channels").toLowerCase();
    return t === "videos" ? "videos" : "channels";
  }
  function tabInit() {
    var panels = [].slice.call(document.querySelectorAll("[data-an-tab-panel]"));
    if (!panels.length) return;
    var cur = tabCurrent();
    panels.forEach(function (p) { p.hidden = p.getAttribute("data-an-tab-panel") !== cur; });
    [].slice.call(document.querySelectorAll("[data-an-tab]")).forEach(function (a) {
      a.classList.toggle("is-active", a.getAttribute("data-an-tab") === cur);
    });
  }


  // ================= P1.13: панель фильтров + P1.2 Growth period =================
  // Прод-поведение: drawer открыт по умолчанию, применение мгновенное, Apply нет.
  // Значения читаем прямо из DOM панели — отдельного стора не держим.
  var FL_TABLE = { basic: "basic", deep: "deep", deepVideos: "deep", coll: "coll" };
  function flPanels() { return [].slice.call(document.querySelectorAll("[data-an-filters]")); }
  function flActive() {                       // активная панель страницы (у Deep их две — по табу)
    var list = flPanels();
    if (!list.length) return null;
    var tab = (new URLSearchParams(location.search).get("tab") || "channels").toLowerCase();
    var wanted = list.length > 1 ? (tab === "videos" ? "deepVideos" : "deep") : list[0].getAttribute("data-an-filters");
    for (var i = 0; i < list.length; i++) if (list[i].getAttribute("data-an-filters") === wanted) return list[i];
    return list[0];
  }
  function flSyncActive() {
    var act = flActive();
    flPanels().forEach(function (el) { el.classList.toggle("is-active", el === act); });
  }
  function flOpen(open) {
    document.body.classList.toggle("filters-open", !!open);
    flSyncActive();
  }
  // список коллекций в поле Collection заполняем динамически: часть создана на клиенте
  function flFillCollections() {
    var act = flActive(); if (!act) return;
    var box = act.querySelector('[data-anf-field="collection"] [data-anf-opts]');
    if (!box) return;
    // на Deep data выбирать можно только активированные коллекции — как в селекторе у счётчика
    var key = FL_TABLE[act.getAttribute("data-an-filters")];
    var names = csList(key === "deep" ? "deep" : "basic").map(function (c) { return c.name; });
    box.innerHTML = names.map(function (n) {
      return '<button class="anf-opt" type="button" role="option" data-anf-opt="' + escHtml(n) + '">' + escHtml(n) + "</button>";
    }).join("") || '<div class="anf-empty">No collections</div>';
  }
  // текущие значения панели
  function flValues() {
    var act = flActive(), out = {};
    if (!act) return out;
    [].slice.call(act.querySelectorAll("[data-anf-field]")).forEach(function (f) {
      var id = f.getAttribute("data-anf-field");
      var val = f.querySelector("[data-anf-val]");
      var txt = f.querySelector("[data-anf-text]");
      var from = f.querySelector("[data-anf-from]"), to = f.querySelector("[data-anf-to]");
      var seg = f.querySelector(".anf-seg__btn.is-on");
      if (val && !val.classList.contains("is-ph")) out[id] = val.textContent.trim();
      if (txt && txt.value.trim()) out[id] = txt.value.trim();
      if (from && from.value) out[id + "From"] = parseFloat(from.value);
      if (to && to.value) out[id + "To"] = parseFloat(to.value);
      if (seg) out[id] = seg.getAttribute("data-anf-seg");
    });
    return out;
  }
  // непустой фильтр → красная точка на кнопке Filters (как на проде)
  function flDot() {
    var v = flValues(), dirty = false;
    var act = flActive(), key = act ? FL_TABLE[act.getAttribute("data-an-filters")] : null;
    for (var k in v) {
      if (k === "highlight") continue;                       // визуальный элемент
      if (k === "ctype" && v[k] === "All") continue;          // дефолт сегмента
      if (k === "period") continue;                           // период всегда заполнен
      if (k === "collection" && key === "deep") continue;      // на Deep коллекция выбрана всегда
      dirty = true;
    }
    var dot = document.querySelector("[data-an-filters-dot]");
    if (dot) dot.hidden = !dirty;
  }
  // ---- мгновенное применение ----
  function flApply() {
    var key = null, act = flActive();
    if (act) key = FL_TABLE[act.getAttribute("data-an-filters")];
    var v = flValues();
    if (key === "basic") flApplyBasic(v);
    else if (key === "coll") flApplyColl(v);
    else if (key === "deep") flApplyDeep(v);
    if (key === "basic") csSyncFromPanel();   // селектор у счётчика показывает тот же фильтр (P1.1)
    flDot();
    if (key && typeof tblApply === "function") { TBL[key].page = 1; tblApply(key); }
  }
  function chInfo(name) {                     // справка по каналу из сида
    var pool = (typeof aiChannelPool === "function" ? aiChannelPool() : []);
    for (var i = 0; i < pool.length; i++) if (pool[i].name === name) return pool[i];
    return null;
  }
  function flApplyBasic(v) {
    var rows = tblAllRows("basic");
    var collChannels = null;
    if (v.collection && typeof aiChannelsOf === "function") collChannels = aiChannelsOf(v.collection);
    rows.forEach(function (row) {
      var nameEl = row.querySelector(".an-chan__name");
      var nm = nameEl ? nameEl.textContent.trim() : "";
      var info = chInfo(nm) || {};
      var topics = [].slice.call(row.querySelectorAll("[data-an-topic]")).map(function (t) { return t.getAttribute("data-an-topic"); });
      if (info.topics) topics = info.topics;                  // включая скрытые под «+N»
      var ok = true;
      if (v.topic && topics.indexOf(v.topic) === -1) ok = false;
      if (v.title && nm.toLowerCase().indexOf(v.title.toLowerCase()) === -1) ok = false;
      if (v.country && info.country !== v.country) ok = false;
      if (v.language && info.language !== v.language) ok = false;
      if (collChannels && collChannels.indexOf(nm) === -1) ok = false;
      if (ok) row.removeAttribute("data-filtered"); else row.setAttribute("data-filtered", "");
    });
  }
  function flApplyDeep(v) {
    // коллекция задаёт набор строк, остальные поля фильтруют внутри него (P1.1)
    var w = document.querySelector('[data-an-collsel="deep"]');
    if (v.collection && w) csSetLabel(w, v.collection);
    var coll = v.collection || (w ? csCurrent(w) : "");
    tblAllRows("deep").forEach(function (row) {
      var mine = !coll || (row.getAttribute("data-coll") || "") === coll;
      var ok = mine;
      if (!row.classList.contains("an-tr--avg")) {
        var t = row.querySelector(".and-chan");
        var nm = t ? t.textContent.trim() : "";
        if (v.title && nm.toLowerCase().indexOf(v.title.toLowerCase()) === -1) ok = false;
      }
      if (ok) row.removeAttribute("data-filtered"); else row.setAttribute("data-filtered", "");
    });
  }
  function flApplyColl(v) {
    tblAllRows("coll").forEach(function (row) {
      var nm = row.getAttribute("data-name") || "";
      var statusEl = row.querySelector(".mc-status__t");
      var st = statusEl ? statusEl.textContent.trim() : "";
      var qtyEl = row.querySelectorAll(".an-td")[2];
      var qty = qtyEl ? parseInt(String(qtyEl.textContent).replace(/\D/g, ""), 10) : NaN;
      var chips = [].slice.call(row.querySelectorAll(".mc-chip")).map(function (c) { return c.textContent.trim(); }).join(" ").toLowerCase();
      var ok = true;
      // P1.10: Samples — это public-коллекции (владелец не ты), Own — свои
      if (v.ctype === "Samples" && !row.hasAttribute("data-sample")) ok = false;
      if (v.ctype === "Own" && row.hasAttribute("data-sample")) ok = false;
      if (v.status && st !== v.status) ok = false;
      if (v.channels && chips.indexOf(v.channels.toLowerCase()) === -1) ok = false;
      if (v.qtyFrom != null && !isNaN(qty) && qty < v.qtyFrom) ok = false;
      if (v.qtyTo != null && !isNaN(qty) && qty > v.qtyTo) ok = false;
      // P1.12: фильтр по конкретному пользователю из дропдауна
      if (v.shared) {
        var shared = (row.getAttribute("data-shared") || "").split("|");
        if (shared.indexOf(v.shared) === -1) ok = false;
      }
      if (ok) row.removeAttribute("data-filtered"); else row.setAttribute("data-filtered", "");
      if (!nm) row.removeAttribute("data-filtered");
    });
  }
  // ---- Clear all: сбрасываем всё, включая сегменты (в проде Collection type не сбрасывается — баг, не воспроизводим) ----
  function flClear() {
    var act = flActive(); if (!act) return;
    [].slice.call(act.querySelectorAll("[data-anf-val]")).forEach(function (el) {
      var ph = el.getAttribute("data-anf-ph");
      if (ph) el.textContent = ph;
      el.classList.add("is-ph");
    });
    [].slice.call(act.querySelectorAll("[data-anf-text],[data-anf-from],[data-anf-to],[data-anf-search]")).forEach(function (i) { i.value = ""; });
    [].slice.call(act.querySelectorAll(".anf-select")).forEach(function (sel) {
      var menu = sel.querySelector("[data-anf-menu]"); if (menu) menu.hidden = true;
      sel.classList.remove("is-open");
      [].slice.call(sel.querySelectorAll(".anf-opt")).forEach(function (o) { o.classList.remove("is-selected"); });
    });
    [].slice.call(act.querySelectorAll(".anf-seg")).forEach(function (seg) {
      var btns = [].slice.call(seg.querySelectorAll(".anf-seg__btn"));
      btns.forEach(function (b, i) { b.classList.toggle("is-on", i === 0); b.setAttribute("aria-checked", i === 0 ? "true" : "false"); });
    });
    flApply();
  }
  // ---- P1.2: Growth period. Подменяет ячейки прироста из window.SUBSUB_GROWTH ----
  var flPeriod = "30";
  function flSetPeriod(pd) {
    var G = window.SUBSUB_GROWTH || {};
    if (!G[pd]) return;
    flPeriod = pd;
    // в поле показываем диапазон дат — как на проде (BaseDateRangePicker)
    var ranges = (window.SUBSUB_DICT || {}).periodRanges || {};
    var labels = (window.SUBSUB_DICT || {}).periodLabels || {};
    [].slice.call(document.querySelectorAll("[data-an-period-val]")).forEach(function (el) {
      // в тулбаре (A4) показываем «Last 30 days», в панели фильтров — диапазон дат
      var wantLabel = el.hasAttribute("data-an-period-label");
      el.textContent = (wantLabel ? labels[pd] : ranges[pd]) || labels[pd] || ("Last " + pd + " days");
    });
    [].slice.call(document.querySelectorAll("[data-an-period-set]")).forEach(function (b) {
      b.classList.toggle("is-on", b.getAttribute("data-an-period-set") === pd);
    });
    // порядок строк мог измениться сортировкой — сопоставляем по имени канала
    var idxByName = {};
    (window.SUBSUB_CHANNELS || []).forEach(function (c, i) { idxByName[c.name] = i; });
    var iSubsG = tblColIndex("basic", "subsg"), iViewsG = tblColIndex("basic", "viewsg"), iVps = tblColIndex("basic", "vps");
    tblAllRows("basic").forEach(function (row) {
      var nameEl = row.querySelector(".an-chan__name");
      var i = nameEl ? idxByName[nameEl.textContent.trim()] : undefined;
      if (i == null || !G[pd][i]) return;
      var g = G[pd][i];
      function setCell(idx, val, delta) {
        var cell = row.children[idx]; if (!cell) return;
        if (delta) {
          var tag = cell.querySelector("[class*='an-delta']");
          if (tag) { tag.textContent = val; return; }
        }
        cell.textContent = val;
      }
      setCell(iSubsG, g[0], true);
      setCell(iViewsG, g[1], true);
      setCell(iVps, g[2], false);
    });
  }
  function flInit() {
    if (!flPanels().length) return;
    flSyncActive();
    flFillCollections();
    csSyncToPanel();                           // на Deep поле Collection = текущая коллекция
    flOpen(true);                              // как на проде — открыт по умолчанию
    flDot();
  }

  // ================= MY COLLECTIONS: флоу действий =================
  var mcRow = null;      // строка, для которой открыто меню/диалог
  var mcMode = "create"; // create | edit

  function toast(msg) {
    var t = document.querySelector("[data-an-toast]");
    if (!t) return;
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(t._tid);
    t._tid = setTimeout(function () { t.hidden = true; }, 2600);
  }
  function openModal(id) {
    var m = document.getElementById(id);
    if (m) { m.classList.add("is-open"); document.body.style.overflow = "hidden"; }
  }
  function closeModals() {
    var open = document.querySelectorAll(".an-modal.is-open");
    for (var i = 0; i < open.length; i++) closeModal(open[i]);
  }
  // закрываем ОДНУ модалку: при вложенности Esc и клик вне гасят только верхнюю,
  // модалка sourcing под ней сохраняет введённое состояние
  function closeModal(el) {
    if (!el) return;
    el.classList.remove("is-open");
    if (el.id === "aiModal" && typeof aiTeardown === "function") aiTeardown();
    if (el.id === "mcModal-create") aiFromSourcing = false;
    if (!document.querySelector(".an-modal.is-open")) document.body.style.overflow = "";
  }
  // верхняя открытая модалка (по z-index)
  function topModal() {
    var open = document.querySelectorAll(".an-modal.is-open"), top = null, z = -1;
    for (var i = 0; i < open.length; i++) {
      var cz = parseInt(getComputedStyle(open[i]).zIndex, 10) || 0;
      if (cz >= z) { z = cz; top = open[i]; }
    }
    return top;
  }
  function closeMcMenu() {
    var m = document.getElementById("mcMenu");
    if (m) m.hidden = true;
  }
  function rowStatus(row) {
    var b = row ? row.querySelector("[data-mc-more]") : null;
    return b ? b.getAttribute("data-status") : null;
  }
  // ссылка на страницу открытой коллекции (для AI-коллекций добавляем ai=<id>, чтобы показать Query/фильтры)
  function mcCollectionUrl(row) {
    if (!row) return "analytics-collection-edit.html";
    var url = "analytics-collection-edit.html?name=" + encodeURIComponent(row.getAttribute("data-name") || "");
    if (row.hasAttribute("data-ai-row")) {
      var nm = row.getAttribute("data-name");
      var list = aiLoad();
      for (var i = 0; i < list.length; i++) if (list[i].name === nm) { url += "&ai=" + encodeURIComponent(list[i].id); break; }
    }
    return url;
  }
  // пилюля статуса по состоянию (та же разметка, что в билде)
  function statusHtml(status) {
    var THUMB = document.querySelector("[data-mc-ico-thumb]");
    var pill = document.querySelector('.mc-status--green');
    if (status === "activated") {
      var ico = pill ? pill.querySelector("svg").outerHTML : "";
      return '<span class="mc-status mc-status--green">' + ico + '<span class="mc-status__t">Activated</span>' +
             '<span class="mc-status__sep"></span><a class="mc-status__link" href="analytics-deep-data.html">View deep data</a></span>';
    }
    if (status === "pending") {
      var pIco = document.querySelector(".mc-status--orange svg");
      return '<span class="mc-status mc-status--orange">' + (pIco ? pIco.outerHTML : "") + '<span class="mc-status__t">Collecting data</span></span>';
    }
    var gIco = document.querySelector(".mc-status--gray svg");
    return '<span class="mc-status mc-status--gray">' + (gIco ? gIco.outerHTML : "") + '<span class="mc-status__t">Deactivated</span>' +
           '<span class="mc-status__sep"></span><button class="mc-status__link" type="button" data-mc-activate>Activate deep data</button></span>';
  }
  function setRowStatus(row, status) {
    if (!row) return;
    var cell = row.children[1];
    var holder = cell ? cell.querySelector(".mc-statuscell") : null;
    if (holder) holder.innerHTML = statusHtml(status);
    var more = row.querySelector("[data-mc-more]");
    if (more) more.setAttribute("data-status", status);
  }
  function updateCollCount() {
    var n = document.querySelectorAll("[data-mc-row]").length;
    var tot = document.querySelector(".an-pagi__total");
    if (tot) tot.textContent = String(n);
  }

  document.addEventListener("click", function (e) {
    // ⋮ — открыть меню у строки (пункты по статусу, как на проде)
    var moreBtn = e.target.closest("[data-mc-more]");
    if (moreBtn) {
      e.stopPropagation();
      var menu = document.getElementById("mcMenu");
      if (!menu) return;
      mcRow = moreBtn.closest("[data-mc-row]");
      var st = moreBtn.getAttribute("data-status");
      // View deep data + Deactivate — только у активной коллекции
      menu.querySelector('[data-mc-act="view"]').hidden = st !== "activated";
      menu.querySelector('[data-mc-act="deactivate"]').hidden = st !== "activated";
      menu.hidden = false;
      var r = moreBtn.getBoundingClientRect();
      var mw = menu.offsetWidth || 200;
      menu.style.top = Math.min(r.bottom + 5, window.innerHeight - menu.offsetHeight - 8) + "px";
      menu.style.left = Math.max(8, r.right - mw) + "px";
      return;
    }
    // пункт меню
    var act = e.target.closest("[data-mc-act]");
    if (act) {
      var type = act.getAttribute("data-mc-act");
      closeMcMenu();
      if (type === "view") { window.location.href = "analytics-deep-data.html"; return; }
      if (type === "edit") {                       // как на проде — отдельная страница коллекции
        window.location.href = mcCollectionUrl(mcRow);
        return;
      }
      if (type === "share") { openModal("mcModal-share"); return; }
      if (type === "deactivate") { openModal("mcModal-deactivate"); return; }
      if (type === "delete") { openModal("mcModal-delete"); return; }
      return;
    }
    // клик вне меню — закрыть
    if (!e.target.closest("#mcMenu")) closeMcMenu();

    // Create Collection
    if (e.target.closest("[data-mc-create-open]")) {
      mcMode = "create"; mcRow = null;
      var ct = document.querySelector("[data-mc-create-title]"); if (ct) ct.textContent = "Create collection";
      var ni = document.querySelector("[data-mc-name]"); if (ni) ni.value = "";
      var cs = document.querySelector("[data-mc-create-submit]"); if (cs) cs.textContent = "Create";
      openModal("mcModal-create");
      return;
    }
    // submit Create/Save
    if (e.target.closest("[data-mc-create-submit]")) {
      var val = (document.querySelector("[data-mc-name]") || {}).value || "";
      if (mcMode === "edit") {
        if (mcRow && val.trim()) {
          var nmEl = mcRow.querySelector(".mc-name");
          if (nmEl) nmEl.textContent = val.trim();
          mcRow.setAttribute("data-name", val.trim());
        }
        closeModals(); toast("Collection saved successfully");
      } else {
        var newName = val.trim() || "New collection";
        aiCreatePlain(newName);                       // коллекция живёт в состоянии, а не только в DOM
        aiRenderCollections();
        if (aiFromSourcing) {                         // вызвана из sourcing — выбираем её назначением
          aiDest = newName;
          aiJustCreated = newName;
          closeModal(document.getElementById("mcModal-create"));
          aiRenderDest(); aiSync();
          toast("Collection created — it's selected as destination");
        } else {
          closeModals(); toast("Collection created successfully");
        }
      }
      return;
    }
    // подтверждения
    if (e.target.closest("[data-mc-delete-confirm]")) {
      if (mcRow) {
        // AI collection живёт в localStorage — иначе строка вернётся после перезагрузки
        if (mcRow.hasAttribute("data-ai-row")) {
          var delId = aiIdByName(mcRow.getAttribute("data-name"));
          if (delId) aiRemove(delId);
        }
        mcRow.remove(); mcRow = null; updateCollCount();
      }
      closeModals(); toast("Collection deleted successfully");
      return;
    }
    if (e.target.closest("[data-mc-deactivate-confirm]")) {
      setRowStatus(mcRow, "inactive");
      closeModals(); toast("Collection deactivated successfully");
      return;
    }
    // Activate deep data (в пилюле статуса) → pending → activated
    var actBtn = e.target.closest("[data-mc-activate]");
    if (actBtn) {
      var row = actBtn.closest("[data-mc-row]");
      setRowStatus(row, "pending");
      toast("Deep data activated successfully");
      // AI collection: статус живёт в localStorage, иначе после перезагрузки откатится
      var isAi = row && row.hasAttribute("data-ai-row");
      var aiName = isAi ? row.getAttribute("data-name") : null;
      setTimeout(function () {
        if (isAi) {
          var l = aiLoad();
          l.forEach(function (x) { if (x.name === aiName) x.status = "activated"; });
          aiSave(l);
          aiRenderCollections();
        } else {
          setRowStatus(row, "activated");
        }
      }, 2500);
      return;
    }
    // клик по названию коллекции в списке → страница открытой коллекции
    var nameCell = e.target.closest(".mc-name");
    if (nameCell && nameCell.closest("[data-mc-row]")) {
      window.location.href = mcCollectionUrl(nameCell.closest("[data-mc-row]"));
      return;
    }
    // закрытие модалок
    if (e.target.closest("[data-mc-close]")) { closeModal(e.target.closest(".an-modal")); return; }
  });

  // новая строка коллекции (после Create)
  function addCollectionRow(name) {
    var tbody = document.querySelector("[data-mc-tbody]");
    if (!tbody) return;
    var sample = tbody.querySelector("[data-mc-row]");
    if (!sample) return;
    var row = sample.cloneNode(true);
    row.setAttribute("data-name", name);
    var nm = row.querySelector(".mc-name"); if (nm) nm.textContent = name;
    // статус → created (только что создана)
    var holder = row.children[1].querySelector(".mc-statuscell");
    var gIco = document.querySelector(".mc-status--gray svg");
    if (holder) holder.innerHTML = '<span class="mc-status mc-status--gray">' + (gIco ? gIco.outerHTML : "") +
      '<span class="mc-status__t">Created</span><span class="mc-status__sep"></span>' +
      '<button class="mc-status__link" type="button" data-mc-activate>Activate deep data</button></span>';
    var more = row.querySelector("[data-mc-more]");
    if (more) { more.setAttribute("data-status", "created"); more.setAttribute("data-name", name); }
    // сбросить прочие поля
    row.children[2].textContent = "0";
    var chips = row.children[3].querySelector(".mc-chips"); if (chips) chips.innerHTML = '<span class="mc-chip">No channels</span>';
    row.children[4].textContent = "28.07.2026";
    var own = row.children[5].querySelector(".mc-owner__name"); if (own) own.textContent = "You";
    row.children[6].innerHTML = noShareHtml();
    tbody.insertBefore(row, tbody.firstChild);
    updateCollCount();
    row.classList.remove("ml-row--flash"); void row.offsetWidth; row.classList.add("ml-row--flash");
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      closeMcMenu();
      aiSelectToggle(false);
      closeModal(topModal());        // закрываем только верхнюю (вложенную) модалку
    }
  });

  // ================= AI-КОЛЛЕКЦИЯ (deep sourcing) =================
  // Мок без бэкенда: состояние в localStorage, «сборка» имитируется таймером (readyAt),
  // поэтому прогресс не теряется при переходах между страницами прототипа.
  var AI_KEY = "subsub_ai_collections";
  var AI_BUILD_MS = 5000;         // имитация долгого действия
  var AI_ICO = {
    progress: '<svg viewBox="0 0 24 24" fill="none"><path d="M14.8356 3.24829H9.16564C5.87564 3.24829 5.62189 6.20579 7.39814 7.81579L16.6031 16.1808C18.3794 17.7908 18.1256 20.7483 14.8356 20.7483H9.16564C5.87564 20.7483 5.62189 17.7908 7.39814 16.1808L16.6031 7.81579C18.3794 6.20579 18.1256 3.24829 14.8356 3.24829Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M20.5334 4.285C21.0807 4.72253 21.1578 5.50641 20.7054 6.03585L10.3685 18.1353C10.1302 18.412 9.83512 18.631 9.50152 18.7798C9.1679 18.9288 8.80418 19.0039 8.43679 18.9998C8.06339 18.9954 7.69473 18.9091 7.36071 18.7475C7.02782 18.5866 6.73682 18.3549 6.50939 18.07L3.27113 14.0428C2.83519 13.5007 2.93616 12.7193 3.49666 12.2977C4.05716 11.876 4.86493 11.9737 5.30087 12.5158L8.46828 16.4549L18.7232 4.45145C19.1756 3.92201 19.9861 3.84749 20.5334 4.285Z" fill="currentColor"/></svg>',
    thumb: '<svg viewBox="0 0 24 24" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M10.3601 3.53447C10.5044 3.20946 10.8263 3 11.1817 3C13.0189 3 14.5083 4.49088 14.5083 6.32998V8.66996H18.4597C19.1962 8.66324 19.8988 8.97979 20.3822 9.53629C20.8668 10.0942 21.0823 10.837 20.9715 11.568L19.8548 18.8579C19.6669 20.0984 18.596 21.0113 17.3431 20.9999L5.79161 20.9997C4.39147 21.0201 3.19594 19.9903 3.00811 18.6004C3.00271 18.5604 3 18.5201 3 18.4797V12.8098C3 12.7694 3.00271 12.7291 3.00811 12.6891C3.18783 11.3591 4.33367 10.179 5.7916 10.2H7.40059L10.3601 3.53447ZM8.84404 11.3809V19.1999L17.3577 19.2C17.7164 19.204 18.0232 18.9429 18.077 18.5879L19.1937 11.2979C19.2253 11.0891 19.1638 10.8768 19.0253 10.7174C18.8868 10.558 18.6854 10.4675 18.4744 10.4699L13.6092 10.47C13.1126 10.47 12.7101 10.067 12.7101 9.56996V6.32998C12.7101 5.67551 12.2996 5.11701 11.7222 4.89844L8.84404 11.3809ZM7.04587 19.1998V12H5.78446C5.34836 11.9924 4.89358 12.3581 4.79817 12.8794V18.4093C4.88522 18.8718 5.29361 19.2083 5.76856 19.1999L7.04587 19.1998Z" fill="currentColor"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    stars: '<svg viewBox="0 0 16 16" fill="none"><path d="M6.65952 6.11513L7.24284 4.07484C7.46142 3.31113 8.54378 3.31113 8.76236 4.07484L9.34502 6.11513C9.38191 6.2442 9.45108 6.36173 9.54599 6.45665C9.64091 6.55157 9.75845 6.62074 9.88751 6.65763L11.9278 7.24029C12.6915 7.45887 12.6915 8.54123 11.9278 8.75981L9.88751 9.34246C9.75845 9.37935 9.64091 9.44852 9.54599 9.54344C9.45108 9.63836 9.38191 9.7559 9.34502 9.88496L8.76236 11.9253C8.54378 12.689 7.46142 12.689 7.24284 11.9253L6.66018 9.88496C6.62329 9.7559 6.55412 9.63836 6.4592 9.54344C6.36429 9.44852 6.24675 9.37935 6.11768 9.34246L4.07739 8.75981C3.31368 8.54123 3.31368 7.45887 4.07739 7.24029L6.11768 6.65763C6.24675 6.62074 6.36429 6.55157 6.4592 6.45665C6.55412 6.36173 6.62329 6.2442 6.66018 6.11513M12.0213 10.9673C12.2116 10.4123 13.0115 10.4117 13.2011 10.9673L13.2182 11.0246L13.4131 11.8067L14.1952 12.0023C14.8273 12.1603 14.8273 13.057 14.1952 13.215L13.4131 13.4105L13.2182 14.1927C13.0602 14.8241 12.1628 14.8241 12.0048 14.1927L11.8093 13.4105L11.0272 13.215C10.3951 13.057 10.3951 12.1596 11.0272 12.0023L11.8093 11.8067L12.0048 11.0246L12.0213 10.9673ZM2.8041 1.74947C3.0003 1.17603 3.84762 1.19513 4.00102 1.80675L4.1959 2.5889L4.97804 2.78443C5.61008 2.94244 5.61008 3.83914 4.97804 3.99715L4.1959 4.19269L4.00102 4.97483C3.84301 5.60621 2.94565 5.60621 2.78764 4.97483L2.59211 4.19269L1.80996 3.99715C1.17793 3.83914 1.17793 2.94178 1.80996 2.78443L2.59211 2.5889L2.78764 1.80675L2.8041 1.74947Z" fill="currentColor"/></svg>'
  };
  var aiTimers = {};

  function aiLoad() {
    try { var v = JSON.parse(localStorage.getItem(AI_KEY) || "[]"); return Array.isArray(v) ? v : []; }
    catch (e) { return []; }
  }
  function aiSave(list) {
    try { localStorage.setItem(AI_KEY, JSON.stringify(list)); } catch (e) { /* прототип: тихо */ }
  }
  function aiNum(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  // чипы применённых фильтров в формате прод-YT Sourcing (нулевые/пустые пропускаем)
  function aiChips(f) {
    var out = [];
    if (f.subs > 0) out.push("subs ≥ " + aiNum(f.subs));
    if (f.videos > 0) out.push("videos ≥ " + aiNum(f.videos));
    if (f.views > 0) out.push("views ≥ " + aiNum(f.views));
    if (f.avg > 0) out.push("avg ≥ " + aiNum(f.avg));
    if (f.lastDays > 0) out.push("last ≤ " + f.lastDays + "d");
    return out;
  }
  function aiById(id) {
    var l = aiLoad();
    for (var i = 0; i < l.length; i++) if (String(l[i].id) === String(id)) return l[i];
    return null;
  }
  // отмена сборки / удаление AI-коллекции: гасим таймер и убираем запись из состояния
  function aiRemove(id) {
    if (aiTimers[id]) { clearTimeout(aiTimers[id]); delete aiTimers[id]; }
    aiSave(aiLoad().filter(function (c) { return String(c.id) !== String(id); }));
    aiRenderPill();
    aiRenderCollections();
  }
  function aiIdByName(name) {
    var l = aiLoad();
    for (var i = 0; i < l.length; i++) if (l[i].name === name) return l[i].id;
    return null;
  }

  // --- топбар: пилюля «Sourcing channels…» + поповер со списком ---
  function aiRenderPill() {
    var dd = document.getElementById("ddProcessing");
    if (!dd) return;
    var pending = aiLoad().filter(function (c) { return c.status === "pending"; });
    if (!pending.length) { dd.hidden = true; return; }
    dd.hidden = false;
    var cnt = dd.querySelector("[data-dd-count]");
    if (cnt) { cnt.textContent = String(pending.length); cnt.hidden = pending.length === 1; }
    var list = dd.querySelector("[data-dd-list]");
    if (list) {
      list.innerHTML = pending.map(function (c, i) {
        return '<li><div class="dd__item"><span class="dd__name">' + escHtml(c.name) + '</span>' +
               '<span class="dd__acts">' +
                 '<button class="dd__cancel" type="button" data-dd-cancel="' + escHtml(c.id) + '">Cancel</button>' +
                 '<a class="dd__view" href="analytics-deep-data.html?ai=' + encodeURIComponent(c.id) + '">View</a>' +
               '</span></div>' +
               (i < pending.length - 1 ? '<hr class="dd__sep" />' : '') + '</li>';
      }).join("");
    }
  }
  // «Not shared» для строк, которые рисует клиент: иконку копируем из серверной разметки
  function noShareHtml() {
    var proto = document.querySelector(".mc-noshare");
    return proto ? proto.outerHTML : '<span class="mc-noshare">Not shared</span>';
  }
  function escHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // --- «сборка» коллекции: pending → created по readyAt (устойчиво к переходам) ---
  function aiTick() {
    var list = aiLoad(), changed = false, now = Date.now();
    list.forEach(function (c) {
      if (c.status !== "pending") return;
      if (c.readyAt && c.readyAt <= now) { c.status = "created"; changed = true; }
      else if (c.readyAt && !aiTimers[c.id]) {
        aiTimers[c.id] = setTimeout(function () {
          delete aiTimers[c.id];
          var l2 = aiLoad();
          var done = null;
          l2.forEach(function (x) { if (String(x.id) === String(c.id)) { x.status = "created"; done = x; } });
          var msg = "Sourcing finished — “" + c.name + "” is ready";
          if (done && done.mode === "append") {
            var res = aiAppendFound(done.target, done);   // дедуп внутри
            msg = "Added " + res.added + " channel" + (res.added === 1 ? "" : "s") + " to “" + done.target + "”" +
                  (res.skipped ? " · " + res.skipped + " already there" : "");
          } else if (done) {
            done.channels = AI_FOUND.slice();
          }
          aiSave(l2);
          aiRenderPill(); aiRenderCollections();
          toast(msg);
        }, Math.max(300, c.readyAt - now));
      }
    });
    if (changed) aiSave(list);
    aiRenderPill();
  }

  // ================= P1.4: модалка «New channels» (Add to base) =================
  // Коллекции не выбраны → каналы уходят только в базу (на проде это addChannelsToBase).
  // Выбраны → те же ссылки дописываются в каждую выбранную коллекцию.
  var NC_MAX = 30;
  var NC_ICON_ON = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 3h12a1 1 0 0 1 1 1v16.2a.8.8 0 0 1-1.24.66L12 17.4l-5.76 3.46A.8.8 0 0 1 5 20.2V4a1 1 0 0 1 1-1z"/></svg>';
  var NC_ICON_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M6 3.8h12a.7.7 0 0 1 .7.7v15.7L12 16.5 5.3 20.2V4.5a.7.7 0 0 1 .7-.7z"/></svg>';
  var ncSel = {};            // выбранные коллекции: name → true
  function ncEl(sel) { var m = document.getElementById("ncModal"); return m ? m.querySelector(sel) : null; }
  // ссылки: одна строка = один канал; имя канала берём из хэндла или последнего сегмента
  function ncLinks() {
    var ta = ncEl("[data-nc-links]");
    if (!ta) return [];
    return ta.value.split(/[\s,]+/).map(function (s) { return s.trim(); }).filter(Boolean);
  }
  function ncNameFromLink(url) {
    var m = String(url).match(/@([^/?#]+)/);
    if (m) return "@" + m[1];
    var parts = String(url).replace(/[?#].*$/, "").replace(/\/+$/, "").split("/");
    return parts[parts.length - 1] || url;
  }
  function ncRender() {
    var box = ncEl("[data-nc-items]");
    if (!box) return;
    var q = (ncEl("[data-nc-search]") || {}).value || "";
    var all = (typeof aiAllColls === "function" ? aiAllColls() : []);
    var wrap = ncEl("[data-nc-search-wrap]");
    if (wrap) wrap.hidden = all.length < 10;      // поиск появляется от 10 коллекций (как на проде)
    var list = all.filter(function (c) { return !q || c.name.toLowerCase().indexOf(q.toLowerCase()) !== -1; });
    box.innerHTML = list.map(function (c) {
      var on = !!ncSel[c.name];
      return '<button class="nc-item' + (on ? " is-on" : "") + '" type="button" data-nc-item="' + escHtml(c.name) + '">' +
        (on ? NC_ICON_ON : NC_ICON_OFF) +
        '<span class="nc-item__name">' + escHtml(c.name) + "</span>" +
        '<span class="nc-item__qty">Channels in collection:&nbsp;' + (aiChannelsOf(c.name).length + (on ? ncLinks().length : 0)) + "</span>" +
      "</button>";
    }).join("") || '<div class="nc-empty">You have no collection yet.</div>';
  }
  function ncSync() {
    var n = ncLinks().length;
    var cnt = ncEl("[data-nc-count]"); if (cnt) cnt.textContent = String(n);
    var lim = ncEl("[data-nc-limit]"); if (lim) lim.hidden = n <= NC_MAX;
    var sub = ncEl("[data-nc-submit]"); if (sub) sub.disabled = n === 0 || n > NC_MAX;
    ncRender();
  }
  // на странице коллекции цель одна — сама коллекция, списка выбора нет (P1.11)
  function ncCollPage() {
    var m = document.getElementById("ncModal");
    return !!(m && m.hasAttribute("data-nc-collpage"));
  }
  function ncPageColl() {
    var n = document.querySelector("[data-ce-name]");
    return n ? (n.value || "").trim() : "";
  }
  function ncOpen() {
    ncSel = {};
    var ta = ncEl("[data-nc-links]"); if (ta) ta.value = "";
    var sq = ncEl("[data-nc-search]"); if (sq) sq.value = "";
    if (ncCollPage()) {
      var t = ncEl("[data-nc-title]"), nm = ncPageColl();
      if (t) t.textContent = nm ? "Add channels to " + nm : "Add channels";
    }
    ncNewForm(false);
    ncSync();
    openModal("ncModal");
    if (ta) ta.focus();
  }
  function ncNewForm(open) {
    var f = ncEl("[data-nc-new-form]"), b = ncEl("[data-nc-new-open]");
    if (f) f.hidden = !open;
    if (b) b.hidden = !!open;
    var i = ncEl("[data-nc-new-name]");
    if (i) { i.value = ""; if (open) i.focus(); }
  }
  function ncCreate() {
    var i = ncEl("[data-nc-new-name]");
    var name = i ? i.value.trim() : "";
    if (!name) return;
    if (aiAllColls().some(function (c) { return c.name === name; })) { toast("Collection with this name already exists"); return; }
    aiCreatePlain(name);
    ncSel[name] = true;                            // созданную сразу считаем выбранной
    ncNewForm(false);
    ncSync();
    toast("Collection created successfully");
  }
  // допись произвольных каналов (не из sourcing) в коллекцию
  function ncAppend(target, names) {
    var have = aiChannelsOf(target), extra = aiExtraLoad();
    var slot = extra[target] || { channels: [] };
    names.forEach(function (n) {
      if (have.indexOf(n) === -1 && slot.channels.indexOf(n) === -1) slot.channels.push(n);
    });
    extra[target] = slot;
    aiExtraSave(extra);
    var list = aiLoad(), touched = false;
    list.forEach(function (x) {
      if (x.mode !== "append" && x.name === target) { x.channels = aiChannelsOf(target); touched = true; }
    });
    if (touched) aiSave(list);
  }
  function ncSubmit() {
    var links = ncLinks();
    if (!links.length || links.length > NC_MAX) return;
    var names = links.map(ncNameFromLink);
    // на странице коллекции добавляем в неё же и дорисовываем строки таблицы
    if (ncCollPage()) {
      var coll = ncPageColl();
      if (coll) ncAppend(coll, names);
      if (typeof ceAddRows === "function") ceAddRows(names);
      closeModal(document.getElementById("ncModal"));
      toast("Channels added successfully");
      return;
    }
    var targets = Object.keys(ncSel).filter(function (n) { return ncSel[n]; });
    targets.forEach(function (t) { ncAppend(t, names); });
    closeModal(document.getElementById("ncModal"));
    toast(targets.length
      ? "Channels added successfully"
      : links.length + (links.length === 1 ? " channel" : " channels") + " sent to base");
    if (typeof aiRenderCollections === "function") aiRenderCollections();
  }

  // ================= A8: «Add N channels to collection» из футера выбора =================
  var acSel = {};
  function acEl(sel) { var m = document.getElementById("acModal"); return m ? m.querySelector(sel) : null; }
  function acChecked() {
    return [].slice.call(document.querySelectorAll("[data-an-check].is-checked")).map(function (b) {
      var row = b.closest(".an-tr"), n = row && row.querySelector(".an-chan__name");
      return n ? n.textContent.trim() : "";
    }).filter(Boolean);
  }
  function acRender() {
    var box = acEl("[data-ac-items]");
    if (!box) return;
    var picked = acChecked().length;
    var q = (acEl("[data-ac-search]") || {}).value || "";
    var all = (typeof aiAllColls === "function" ? aiAllColls() : []);
    var wrap = acEl("[data-ac-search-wrap]");
    if (wrap) wrap.hidden = all.length < 10;
    var list = all.filter(function (c) { return !q || c.name.toLowerCase().indexOf(q.toLowerCase()) !== -1; });
    box.innerHTML = list.map(function (c) {
      var on = !!acSel[c.name];
      return '<button class="nc-item' + (on ? " is-on" : "") + '" type="button" data-ac-item="' + escHtml(c.name) + '">' +
        (on ? NC_ICON_ON : NC_ICON_OFF) +
        '<span class="nc-item__name">' + escHtml(c.name) + "</span>" +
        '<span class="nc-item__qty">Channels in collection:&nbsp;' + (aiChannelsOf(c.name).length + (on ? picked : 0)) + "</span>" +
      "</button>";
    }).join("") || '<div class="nc-empty">You have no collection yet.</div>';
    var sub = acEl("[data-ac-submit]");
    if (sub) {
      var n = Object.keys(acSel).length;
      sub.disabled = !n || !picked;
      sub.textContent = picked ? "Add " + picked + (picked === 1 ? " channel" : " channels") : "Add channels";
    }
  }
  function acNewForm(open) {
    var f = acEl("[data-ac-new-form]"), b = acEl("[data-ac-new-open]");
    if (f) f.hidden = !open;
    if (b) b.hidden = !!open;
    var i = acEl("[data-ac-new-name]");
    if (i) { i.value = ""; if (open) i.focus(); }
  }
  function acCreate() {
    var i = acEl("[data-ac-new-name]"), name = i ? i.value.trim() : "";
    if (!name) return;
    if (aiAllColls().some(function (c) { return c.name === name; })) { toast("Collection with this name already exists"); return; }
    aiCreatePlain(name);
    acSel[name] = true;
    acNewForm(false);
    acRender();
    toast("Collection created successfully");
  }
  function acOpen() {
    var picked = acChecked();
    if (!picked.length) return;
    acSel = {};
    var t = acEl("[data-ac-title]");
    if (t) t.textContent = "Add " + picked.length + (picked.length === 1 ? " channel" : " channels") + " to collection";
    var sq = acEl("[data-ac-search]"); if (sq) sq.value = "";
    acNewForm(false);
    acRender();
    openModal("acModal");
  }
  function acSubmit() {
    var picked = acChecked();
    var targets = Object.keys(acSel).filter(function (n) { return acSel[n]; });
    if (!picked.length || !targets.length) return;
    targets.forEach(function (t) { ncAppend(t, picked); });
    closeModal(document.getElementById("acModal"));
    // выбор снимаем — как на проде после успешного добавления
    [].slice.call(document.querySelectorAll("[data-an-check], [data-an-check-all]")).forEach(function (b) { b.classList.remove("is-checked"); });
    markSelected();
    updateFooter();
    if (typeof aiRenderCollections === "function") aiRenderCollections();
    toast(picked.length + (picked.length === 1 ? " channel" : " channels") + " added to " +
          (targets.length === 1 ? targets[0] : targets.length + " collections"));
  }

  // допись найденных каналов в существующую коллекцию: дубликаты не добавляем
  function aiAppendFound(target, rec) {
    var have = aiChannelsOf(target), added = [], skipped = 0;
    AI_FOUND.forEach(function (n) {
      if (have.indexOf(n) === -1 && added.indexOf(n) === -1) added.push(n);
      else skipped++;
    });
    var extra = aiExtraLoad();
    var slot = extra[target] || { channels: [] };
    added.forEach(function (n) { if (slot.channels.indexOf(n) === -1) slot.channels.push(n); });
    // источник добавленных каналов — показываем в представлении коллекции
    slot.sourcing = { query: rec.query, filters: rec.filters };
    extra[target] = slot;
    aiExtraSave(extra);
    // если целевая коллекция живёт в состоянии — синхронизируем её каналы
    var list = aiLoad(), touched = false;
    list.forEach(function (x) {
      if (x.mode !== "append" && x.name === target) {
        x.channels = aiChannelsOf(target);
        if (!x.query) x.query = rec.query;
        touched = true;
      }
    });
    if (touched) aiSave(list);
    return { added: added.length, skipped: skipped };
  }

  // --- My collections: строки AI-коллекций (сверху списка) ---
  function aiStatusHtml(status, id) {
    if (status === "pending") {
      // свой статус подбора — не путаем с «Collecting data» у активации Deep Data
      return '<span class="mc-status mc-status--orange">' + AI_ICO.progress + '<span class="mc-status__t">Sourcing…</span></span>';
    }
    if (status === "activated") {
      return '<span class="mc-status mc-status--green">' + AI_ICO.thumb + '<span class="mc-status__t">Activated</span>' +
             '<span class="mc-status__sep"></span><a class="mc-status__link" href="analytics-deep-data.html?ai=' + encodeURIComponent(id) + '">View deep data</a></span>';
    }
    return '<span class="mc-status mc-status--gray">' + AI_ICO.check + '<span class="mc-status__t">Created</span>' +
           '<span class="mc-status__sep"></span><button class="mc-status__link" type="button" data-mc-activate>Activate deep data</button></span>';
  }
  // чипы Includes: до 2 каналов + «+N»
  function aiChipsHtml(c) {
    if (c.status === "pending") return '<span class="an-muted">—</span>';
    var ch = c.channels || [];
    if (!ch.length) return '<span class="an-muted">No channels yet</span>';
    var out = ch.slice(0, 2).map(function (n) { return '<span class="mc-chip">' + escHtml(n) + '</span>'; }).join("");
    if (ch.length > 2) out += '<span class="mc-chip">+' + (ch.length - 2) + '</span>';
    return out;
  }
  // существующие коллекции, в которые сейчас идёт подбор: временно показываем «Sourcing…»,
  // после завершения возвращаем исходный статус и обновляем Quantity/Includes
  function aiPaintTargets() {
    var busy = aiSourcingNames(), rows = document.querySelectorAll("[data-mc-row]");
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (row.hasAttribute("data-ai-row")) continue;           // AI-строки рисует aiRenderCollections
      var nm = row.getAttribute("data-name");
      var holder = row.children[1] ? row.children[1].querySelector(".mc-statuscell") : null;
      if (!holder) continue;
      if (busy[nm]) {
        if (row._origStatus == null) row._origStatus = holder.innerHTML;
        holder.innerHTML = aiStatusHtml("pending");
      } else if (row._origStatus != null) {
        holder.innerHTML = row._origStatus;
        row._origStatus = null;
      }
      // Quantity/Includes для дописанных коллекций пересчитываем ВСЕГДА (в т.ч. после перезагрузки),
      // иначе строка показывала бы прежние числа
      if (!busy[nm]) aiPaintAppended(row, nm);
    }
  }
  // базовый размер коллекции (из сида билда) + дописанные подбором каналы
  function aiPaintAppended(row, nm) {
    var extra = aiExtraLoad()[nm];
    if (!extra || !extra.channels || !extra.channels.length) return;
    var base = null;
    aiBaseColls().forEach(function (c) { if (c.name === nm) base = c; });
    var tds = row.querySelectorAll(".an-td");
    var total = (base ? base.qty : 0) + extra.channels.length;
    if (tds[2]) tds[2].textContent = String(total);
    var chips = tds[3] ? tds[3].querySelector(".mc-chips") : null;
    if (chips) {
      var head = (base ? base.channels : []).slice(0, 2);
      chips.innerHTML = head.map(function (n) { return '<span class="mc-chip">' + escHtml(n) + '</span>'; }).join("") +
        (total > head.length ? '<span class="mc-chip">+' + (total - head.length) + '</span>' : "");
    }
  }

  function aiRenderCollections() {
    var tbody = document.querySelector("[data-mc-tbody]");
    if (!tbody) return;
    var old = tbody.querySelectorAll("[data-ai-row]");
    for (var i = 0; i < old.length; i++) old[i].remove();
    var list = aiLoad();
    // идём от старых к новым и вставляем каждую строку в начало → новые оказываются сверху
    for (var j = 0; j < list.length; j++) {
      var c = list[j];
      if (c.mode === "append") continue;          // допись в существующую — своей строки нет
      var row = document.createElement("div");
      row.className = "an-tr";
      row.setAttribute("data-mc-row", "");
      row.setAttribute("data-ai-row", "");
      row.setAttribute("data-name", c.name);
      row.innerHTML =
        '<div class="an-td" style="width:240px">' +
          (c.isAi === false ? "" : '<span class="ai-badge mc-name__ai">' + AI_ICO.stars + 'AI</span>') +
          '<span class="mc-name">' + escHtml(c.name) + '</span></div>' +
        '<div class="an-td" style="width:320px"><div class="mc-statuscell">' + aiStatusHtml(c.status, c.id) + '</div></div>' +
        '<div class="an-td" style="width:120px">' + (c.status === "pending" ? "—" : String((c.channels || []).length)) + '</div>' +
        // Includes — каналы коллекции; у AI-коллекции их ещё нет (фильтры показываем в её представлении)
        '<div class="an-td an-td--grow" style="width:350px"><div class="mc-chips">' +
          aiChipsHtml(c) + '</div></div>' +
        '<div class="an-td" style="width:140px">' + escHtml(c.created) + '</div>' +
        '<div class="an-td" style="width:160px"><span class="mc-owner"><span class="mc-ava" style="background:var(--color-avatar-1)">Y</span><span class="mc-owner__name">You</span></span></div>' +
        // «Not shared» — как в сборке: иконку берём из уже отрисованной строки
        '<div class="an-td" style="width:120px">' + noShareHtml() + '</div>' +
        '<div class="an-td" style="width:120px"><button class="mc-more" type="button" aria-label="Actions" data-mc-more data-status="' +
          escHtml(c.status) + '" data-name="' + escHtml(c.name) + '">' +
          (document.querySelector("[data-mc-more]") ? document.querySelector("[data-mc-more]").innerHTML : "") + '</button></div>';
      tbody.insertBefore(row, tbody.firstChild);
    }
    aiPaintTargets();
    if (typeof tblApply === "function" && tblBody("coll")) tblApply("coll");
    var tot = document.querySelector(".an-pagi__total");
    if (tot && document.querySelector("[data-mc-tbody]")) tot.textContent = String(document.querySelectorAll("[data-mc-row]").length);
  }

  // --- Deep data: блок Query + фильтры + бейдж (только для AI-коллекций) ---
  function aiRenderCollectionView() {
    var block = document.querySelector("[data-ai-block]");
    var badge = document.querySelector("[data-ai-badge]");
    if (!block && !badge) return;
    var qs = new URLSearchParams(window.location.search);
    var id = qs.get("ai"), nameParam = qs.get("name");
    var c = id ? aiById(id) : null;
    var isAiColl = !!c && c.isAi !== false;
    if (!c && nameParam) {                       // обычная коллекция, куда дописали каналы подбором
      var extra = aiExtraLoad()[nameParam];
      if (extra && extra.sourcing) {
        c = { name: nameParam, query: extra.sourcing.query, filters: extra.sourcing.filters };
        var own = aiCollByName(nameParam);
        isAiColl = !!(own && own.isAi);
      }
    }
    if (!c) { if (block) block.hidden = true; if (badge) badge.hidden = true; return; }
    if (badge) badge.hidden = !isAiColl;         // бейдж только у коллекций, созданных автоподбором
    var nameEl = document.querySelector("[data-ai-collname]");
    if (nameEl) nameEl.textContent = c.name;
    if (block) {
      block.hidden = false;
      var q = block.querySelector("[data-ai-block-query]");
      if (q) q.textContent = c.query;
      var chips = block.querySelector("[data-ai-block-chips]");
      if (chips) {
        var arr = aiChips(c.filters);
        chips.innerHTML = arr.length
          ? arr.map(function (t) { return '<span class="ai-chip">' + escHtml(t) + '</span>'; }).join("")
          : '<span class="ai-chip">no filters</span>';
      }
    }
  }

  // --- модалка ---
  function aiEl(sel) { return document.querySelector(sel); }
  function aiTxt(sel) { var e = aiEl(sel); return e ? String(e.value || "").trim() : ""; }

  // ===== поле описания: 4 состояния (покой → фокус/ввод → генерация → готово) =====
  // Примеры и «думающие» сообщения показываем ТОЛЬКО как placeholder/вспомогательный текст,
  // чтобы пользователь не мог их случайно стереть (в value они не попадают).
  var AI_PH_IDLE = [
    "e.g. Fortnite gamers with a US audience",
    "e.g. Turkish TV series channels",
    "e.g. channels that cook Thai food",
    "e.g. budget-phone tech reviewers"
  ];
  var AI_PH_THINK = ["Reading the channel…", "Finding similar creators…", "Picking examples…", "Almost there…"];
  var aiPhTimer = null, aiThinkTimer = null, aiGenTimer = null;
  var aiPhIdx = 0, aiThinkIdx = 0, aiGenBusy = false;

  function aiTa() { return aiEl("[data-ai-query]"); }

  // ===== REFERENCE CHANNELS — единый контейнер примеров =====
  // Питает описание: как только есть хотя бы один референс, запускается тот же подбор
  // (лоадер + «думающие» сообщения). Добавление/удаление перезапускает подбор.
  var aiRefs = [];
  var AI_REF_COLORS = ["--color-avatar-1", "--color-avatar-3", "--color-avatar-5"];
  function aiRefKey(n) { return String(n).trim().toLowerCase(); }
  function aiRefAdd(name, initial, color) {
    var nm = String(name || "").trim();
    if (!nm) return false;
    for (var i = 0; i < aiRefs.length; i++) if (aiRefKey(aiRefs[i].name) === aiRefKey(nm)) return false; // без дублей
    aiRefs.push({
      name: nm,
      initial: (initial || nm.replace(/^@/, "").charAt(0) || "?").toUpperCase(),
      color: color || AI_REF_COLORS[aiRefs.length % AI_REF_COLORS.length]
    });
    return true;
  }
  // поле ввода референса: раскрыть / свернуть обратно в кнопку
  function aiRefFormToggle(open) {
    var btn = aiEl("[data-ai-ref-open]"), form = aiEl("[data-ai-ref-form]"), inp = aiEl("[data-ai-refseed]");
    if (!btn || !form) return;
    form.hidden = !open;
    btn.hidden = !!open;
    if (open && inp) { inp.value = ""; inp.focus(); }
    var emptyHint = aiEl("[data-ai-refs-empty]");
    if (emptyHint) emptyHint.hidden = !!open || aiRefs.length > 0;   // при открытом поле подсказка лишняя
    if (!open && inp) inp.value = "";
    aiSync();
  }
  // каналы для подсказок (те же, что в таблице Basic data — их отдаёт билд)
  function aiChannelPool() {
    var c = window.SUBSUB_CHANNELS;
    return Object.prototype.toString.call(c) === "[object Array]" ? c : [];
  }
  // Ввод названия → выпадающий список каналов; ввод ссылки → просто активная кнопка «Add».
  function aiRefSuggest() {
    var inp = aiEl("[data-ai-refseed]"), box = aiEl("[data-ai-ref-sug]");
    if (!inp || !box) return;
    var v = String(inp.value || "").trim();
    if (!v || aiSeedIsUrl(v)) { box.hidden = true; box.innerHTML = ""; return; }   // ссылка — подсказки не нужны
    var q = v.toLowerCase();
    var hits = aiChannelPool().filter(function (c) {
      if (c.name.toLowerCase().indexOf(q) === -1) return false;
      for (var i = 0; i < aiRefs.length; i++) if (aiRefKey(aiRefs[i].name) === aiRefKey(c.name)) return false; // уже добавлен
      return true;
    }).slice(0, 6);
    if (!hits.length) {
      box.innerHTML = '<div class="ai-refs__sugempty">No channels found</div>';
      box.hidden = false;
      return;
    }
    box.innerHTML = hits.map(function (c) {
      return '<button class="ai-refs__sugopt" type="button" role="option" data-ai-ref-pick="' + escHtml(c.name) + '"' +
             ' data-initial="' + escHtml(c.initial || "") + '" data-color="' + escHtml(c.color || "") + '">' +
             '<span class="ai-ref__ava" style="background:var(' + (c.color || "--color-avatar-1") + ')">' + escHtml(c.initial || "?") + '</span>' +
             '<span>' + escHtml(c.name) + '</span></button>';
    }).join("");
    box.hidden = false;
    if (inp) inp.setAttribute("aria-expanded", "true");
  }
  function aiRefSugHide() {
    var box = aiEl("[data-ai-ref-sug]");
    if (box) { box.hidden = true; box.innerHTML = ""; }
    var i2 = aiEl("[data-ai-refseed]"); if (i2) i2.setAttribute("aria-expanded", "false");
  }
  function aiRenderRefs() {
    var box = aiEl("[data-ai-refs-list]"), empty = aiEl("[data-ai-refs-empty]");
    if (!box) return;
    box.innerHTML = aiRefs.map(function (r, i) {
      return '<span class="ai-ref">' +
        '<span class="ai-ref__ava" style="background:var(' + r.color + ')">' + escHtml(r.initial) + '</span>' +
        '<span class="ai-ref__name">' + escHtml(r.name) + '</span>' +
        '<button class="ai-ref__x" type="button" data-ai-ref-del="' + i + '" aria-label="Remove ' + escHtml(r.name) + '">' + AI_ICO.x + '</button>' +
      '</span>';
    }).join("");
    if (empty) empty.hidden = aiRefs.length > 0;
  }
  // черновик описания по набору референсов
  // режим модалки: single (ссылка + Auto-fill) / refs (секция Reference channels)
  function aiMode() {
    var m = document.getElementById("aiModal");
    return (m && m.getAttribute("data-ai-mode")) || "single";
  }
  function aiSetMode(mode) {
    var m = document.getElementById("aiModal");
    if (m) m.setAttribute("data-ai-mode", mode);
  }
  // черновик по одной ссылке (режим single) — варьируем по домену/хендлу
  function aiDraftFromSeed(seed) {
    var handle = (seed.match(/@([\w.\-]+)/) || [])[1] || "";
    var host = (seed.match(/^(?:https?:\/\/)?(?:www\.)?([^\/\s]+)/i) || [])[1] || "";
    var who = handle ? "@" + handle : (host || "this channel");
    if (/twitch|tiktok|instagram/i.test(host)) {
      return "Creators like " + who + " — same format and audience, cross-posting to YouTube. " +
             "Regular uploads, engaged comments; skip clip-farm and reupload accounts.";
    }
    return "Channels similar to " + who + " — same niche, format and audience language. " +
           "Mid-size creators publishing regularly with steady growth; exclude compilations and reuploads.";
  }
  function aiDraftFromRefs() {
    if (!aiRefs.length) return "";
    var names = aiRefs.map(function (r) { return r.name; });
    var head = names.length === 1
      ? "Channels similar to " + names[0]
      : "Channels similar to " + names.slice(0, 3).join(", ") + (names.length > 3 ? " and " + (names.length - 3) + " more" : "");
    return head + " — same niche, format and audience language. " +
           "Mid-size creators publishing regularly with steady growth; exclude compilations and reuploads.";
  }
  // изменение набора референсов → перезапуск подбора описания
  function aiRefsChanged() {
    aiRenderRefs();
    aiSync();
    if (aiRefs.length) aiGenStart();
    else if (aiGenBusy) aiGenCancel();
  }
  function aiGenCancel() {
    if (aiThinkTimer) { clearInterval(aiThinkTimer); aiThinkTimer = null; }
    if (aiGenTimer) { clearTimeout(aiGenTimer); aiGenTimer = null; }
    aiPhFadeCancel();
    aiGenBusy = false;
    var foot = aiEl("[data-ai-foot]"), row = aiEl("[data-ai-genrow]");
    if (foot) foot.classList.remove("is-gen");
    if (row) { row.hidden = true; row.setAttribute("aria-busy", "false"); }
    if (foot) foot.hidden = true;
    aiPhIdle();
  }
  function aiSeedIsUrl(v) {
    if (!v) return false;
    return /^https?:\/\/\S+$/i.test(v) || /\.[a-z]{2,}(\/|$)/i.test(v) || /^@[\w.\-]{2,}$/.test(v);
  }
  // мягкая смена плейсхолдера: fade out → подмена текста → fade in.
  // Отложенную запись держим в переменной, иначе она приземлится уже после
  // остановки ротации и перетрёт актуальный плейсхолдер.
  var aiPhFadeTimer = null;
  function aiPhFadeCancel() {
    if (aiPhFadeTimer) { clearTimeout(aiPhFadeTimer); aiPhFadeTimer = null; }
    var ta = aiTa();
    if (ta) ta.classList.remove("ph-out");
  }
  function aiPhSet(text) {
    var ta = aiTa();
    if (!ta) return;
    if (aiPhFadeTimer) clearTimeout(aiPhFadeTimer);
    ta.classList.add("ph-out");
    aiPhFadeTimer = setTimeout(function () {
      aiPhFadeTimer = null;
      ta.placeholder = text;
      ta.classList.remove("ph-out");
    }, 250);
  }
  function aiPhStop() { if (aiPhTimer) { clearTimeout(aiPhTimer); aiPhTimer = null; } aiPhFadeCancel(); }

  // Состояние 1 — покой: примеры ПРОПЕЧАТЫВАЮТСЯ (typewriter) с мигающей кареткой,
  // держатся, стираются и уступают место следующему. Всё это только placeholder,
  // в value не попадает. Цепочка на setTimeout — никаких висящих интервалов.
  var AI_TYPE_CHAR = 42, AI_TYPE_ERASE = 22, AI_TYPE_HOLD = 1800, AI_BLINK = 450, AI_CARET = "|";
  function aiPhFull() { return AI_PH_IDLE[aiPhIdx % AI_PH_IDLE.length]; }
  // печатаем, только пока модалка открыта, поле пустое и не в фокусе, генерации нет
  function aiPhAlive() {
    var ta = aiTa(), m = document.getElementById("aiModal");
    if (!ta || !m || !m.classList.contains("is-open")) return false;
    if (aiGenBusy) return false;
    if (ta.value.trim()) { ta.placeholder = ""; return false; }
    if (document.activeElement === ta) {          // фокус: не оставляем обрывок с кареткой
      ta.placeholder = aiPhFull();
      return false;
    }
    return true;
  }
  function aiPhType() {
    var full = aiPhFull(), i = 0;
    (function step() {
      if (!aiPhAlive()) return;
      i++;
      aiTa().placeholder = full.slice(0, i) + AI_CARET;
      if (i < full.length) { aiPhTimer = setTimeout(step, AI_TYPE_CHAR); return; }
      aiPhHold(full);
    })();
  }
  function aiPhHold(full) {
    var on = true, waited = 0;
    (function blink() {
      if (!aiPhAlive()) return;
      on = !on;
      aiTa().placeholder = full + (on ? AI_CARET : " ");
      waited += AI_BLINK;
      if (waited < AI_TYPE_HOLD) { aiPhTimer = setTimeout(blink, AI_BLINK); return; }
      aiPhErase(full);
    })();
  }
  function aiPhErase(full) {
    var i = full.length;
    (function step() {
      if (!aiPhAlive()) return;
      i--;
      aiTa().placeholder = full.slice(0, i) + AI_CARET;
      if (i > 0) { aiPhTimer = setTimeout(step, AI_TYPE_ERASE); return; }
      aiPhIdx++;
      aiPhTimer = setTimeout(aiPhType, 260);       // короткая пауза перед следующим примером
    })();
  }
  function aiPhIdle() {
    aiPhStop();
    var ta = aiTa();
    if (!ta || aiGenBusy) return;
    if (ta.value.trim()) { ta.placeholder = ""; return; }   // текст введён — плейсхолдер не нужен
    aiPhType();
  }
  // фокус на пустом поле — оставляем один статичный пример (без полупечатанного обрывка)
  function aiPhFreeze() {
    aiPhStop();
    var ta = aiTa();
    if (ta && !ta.value.trim()) ta.placeholder = aiPhFull();
  }
  // состояние 3 — генерация: «думающие» сообщения + свёрнутая строка автозаполнения
  function aiGenStart() {
    var ta = aiTa(), foot = aiEl("[data-ai-foot]"), row = aiEl("[data-ai-genrow]"), st = aiEl("[data-ai-genstatus]");
    if (!ta || !foot || !row) return;
    aiGenBusy = true;
    aiPhStop();
    aiThinkIdx = 0;
    ta.placeholder = AI_PH_THINK[0];
    if (st) st.textContent = AI_PH_THINK[0];
    aiThinkTimer = setInterval(function () {                 // ~1.2с
      aiThinkIdx++;
      var msg = AI_PH_THINK[aiThinkIdx % AI_PH_THINK.length];
      aiPhSet(msg);
      if (st) st.textContent = msg;
    }, 1200);
    foot.hidden = false;                          // в refs строка-лоадер появляется только на время подбора
    row.hidden = false;
    row.setAttribute("aria-busy", "true");
    void row.offsetHeight;                        // reflow: чтобы transition стартовал с opacity 0
    foot.classList.add("is-gen");
    aiGenTimer = setTimeout(aiGenDone, 4000 + Math.round(Math.random() * 2000)); // 4–6с
  }
  // состояние 4 — готово: черновик в textarea, строка автозаполнения возвращается
  function aiGenDone() {
    var ta = aiTa(), foot = aiEl("[data-ai-foot]"), row = aiEl("[data-ai-genrow]");
    if (aiThinkTimer) { clearInterval(aiThinkTimer); aiThinkTimer = null; }
    aiPhFadeCancel();            // снимаем отложенную запись «думающего» сообщения
    aiGenTimer = null;
    aiGenBusy = false;
    if (ta) {
      ta.value = aiMode() === "refs" ? aiDraftFromRefs() : aiDraftFromSeed(aiTxt("[data-ai-seed]"));
      ta.placeholder = "";
    }
    if (foot) foot.classList.remove("is-gen");
    if (row) {
      row.setAttribute("aria-busy", "false");
      setTimeout(function () {
        row.hidden = true;
        if (foot && aiMode() === "refs") foot.hidden = true;   // в single строка ссылки остаётся
      }, 260);
    }
    aiSync();                                                // ссылка сохранена — можно перегенерировать
    toast("Description auto-filled — edit it before starting");
  }
  // черновик: два варианта, слегка варьируем по домену/хендлу ссылки
  function aiDraft(seed) {
    var handle = (seed.match(/@([\w.\-]+)/) || [])[1] || "";
    var host = (seed.match(/^(?:https?:\/\/)?(?:www\.)?([^\/\s]+)/i) || [])[1] || "";
    var who = handle ? "@" + handle : (host || "this channel");
    if (/twitch|tiktok|instagram/i.test(host)) {
      return "Creators like " + who + " — same format and audience, cross-posting to YouTube. " +
             "Regular uploads, engaged comments; skip clip-farm and reupload accounts.";
    }
    return "Channels similar to " + who + " — same niche, format and audience language. " +
           "Mid-size creators publishing regularly with steady growth; exclude compilations and reuploads.";
  }
  // закрытие модалки: гасим все таймеры и возвращаем строку автозаполнения в покой
  function aiTeardown() {
    aiPhStop();
    if (aiThinkTimer) { clearInterval(aiThinkTimer); aiThinkTimer = null; }
    if (aiGenTimer) { clearTimeout(aiGenTimer); aiGenTimer = null; }
    aiGenBusy = false;
    var foot = aiEl("[data-ai-foot]"), row = aiEl("[data-ai-genrow]");
    if (foot) foot.classList.remove("is-gen");
    if (row) { row.hidden = true; row.setAttribute("aria-busy", "false"); }
  }
  // остановка ротации при фокусе/вводе (состояние 2) и возврат к покою на blur
  // Enter в поле референса добавляет ссылку, Esc — сворачивает поле обратно в кнопку
  document.addEventListener("keydown", function (e) {
    if (!e.target.closest || !e.target.closest("[data-ai-refseed]")) return;
    if (e.key === "Enter") {
      e.preventDefault();
      var addBtn = aiEl("[data-ai-ref-add]");
      if (addBtn && !addBtn.disabled) addBtn.click();
      return;
    }
    if (e.key === "Escape") {
      e.stopPropagation();                          // не закрываем всю модалку
      aiRefSugHide();
      aiRefFormToggle(false);
    }
  });

  document.addEventListener("focusin", function (e) {
    if (e.target.closest("[data-ai-query]")) aiPhFreeze();   // ничего не печатается во время набора
  });
  document.addEventListener("focusout", function (e) {
    if (e.target.closest("[data-ai-query]") && !aiGenBusy) aiPhIdle();
  });

  // «Start sourcing» активна при заполненном имени И (описание ИЛИ reference-ссылка).
  // Auto-fill активна только когда ссылка непустая И похожа на URL.
  function aiSync() {
    var submit = aiEl("[data-ai-submit]");
    var auto = aiEl("[data-ai-ref-add]");
    if (!submit && !auto) return;
    var name = aiTxt("[data-ai-name]");
    var query = aiTxt("[data-ai-query]");
    var seed = aiTxt("[data-ai-seed]");
    var destOk = aiAllColls().length ? !!aiDest : !!name;   // случай 2 — выбор, случай 1 — имя
    // single: описание ИЛИ ссылка; refs: описание ИЛИ хотя бы один референс
    var hasSource = aiMode() === "refs" ? !!aiRefs.length : !!seed;
    if (submit) submit.disabled = !(destOk && (query || hasSource));
    // refs: «Add» активна только для ссылки (имя выбирается из подсказок)
    if (auto) auto.disabled = !aiSeedIsUrl(aiTxt("[data-ai-refseed]"));
    // single: «Auto-fill» активна при похожей на URL ссылке
    var detect = aiEl("[data-ai-detect]");
    if (detect && !aiGenBusy) detect.disabled = !aiSeedIsUrl(seed);
    aiAdvSummary();
  }
  // мини-сводка не-дефолтных фильтров у свёрнутой секции
  function aiAdvSummary() {
    var box = aiEl("[data-ai-advsum]");
    if (!box) return;
    var f = aiFormFilters();
    var parts = [];
    if (f.subs !== 10000) parts.push("Min subs " + aiNum(f.subs));
    else if (f.subs > 0) parts.push(null);            // дефолт — не показываем
    if (f.videos > 0) parts.push("Videos ≥ " + aiNum(f.videos));
    if (f.views > 0) parts.push("Views ≥ " + aiNum(f.views));
    if (f.avg > 0) parts.push("Avg ≥ " + aiNum(f.avg));
    if (f.lastDays > 0) parts.push("Last ≤ " + f.lastDays + "d");
    parts = parts.filter(Boolean);
    box.textContent = parts.length ? parts.join(" · ") : "";
    box.hidden = !parts.length;
  }

  // ===== НАЗНАЧЕНИЕ: куда попадут найденные каналы =====
  // Источник списка — те же коллекции, что в My collections: базовые (из window, их отдаёт билд)
  // + созданные на клиенте (в localStorage, с флагом isAi).
  var AI_EXTRA_KEY = "subsub_coll_extra";     // допись каналов и мета sourcing по имени коллекции
  var AI_FOUND = ["Fortnite Focus", "ProGamer UA", "24 Канал", "Clutch Moments", "Squad Highlights", "Battle Royale Daily"];
  var aiDest = null;            // выбранная коллекция-назначение
  var aiJustCreated = null;     // создана через вложенную модалку в этом сеансе → считаем новой
  var aiFromSourcing = false;   // модалка создания открыта поверх sourcing

  function aiExtraLoad() { try { return JSON.parse(localStorage.getItem(AI_EXTRA_KEY) || "{}") || {}; } catch (e) { return {}; } }
  function aiExtraSave(o) { try { localStorage.setItem(AI_EXTRA_KEY, JSON.stringify(o)); } catch (e) {} }
  function aiToday() {
    var d = new Date();
    return ("0" + d.getDate()).slice(-2) + "." + ("0" + (d.getMonth() + 1)).slice(-2) + "." + d.getFullYear();
  }
  function aiBaseColls() {
    var b = window.SUBSUB_BASE_COLLECTIONS;
    return Object.prototype.toString.call(b) === "[object Array]" ? b : [];
  }
  // обычная (не-AI) коллекция, созданная пользователем
  function aiCreatePlain(name) {
    var list = aiLoad();
    list.push({ id: "c" + Date.now(), name: name, isAi: false, mode: "new", status: "created",
                channels: [], created: aiToday(), query: "", filters: { subs: 10000, videos: 0, views: 0, avg: 0, lastDays: 0 } });
    aiSave(list);
  }
  // полный список коллекций для дропдауна (записи «допись в существующую» отдельной коллекцией не считаем)
  function aiAllColls() {
    var out = aiBaseColls().map(function (c) {
      return { name: c.name, status: c.status, isAi: false, base: true, qty: c.qty || 0, channels: (c.channels || []).slice() };
    });
    aiLoad().forEach(function (r) {
      if (r.mode === "append") return;
      out.push({ name: r.name, status: r.status, isAi: r.isAi !== false, base: false,
                 qty: (r.channels || []).length, channels: (r.channels || []).slice() });
    });
    // адресация дописи идёт по имени, поэтому одинаковые имена в списке недопустимы
    var seen = {};
    return out.filter(function (c) {
      if (seen[c.name]) return false;
      seen[c.name] = true;
      return true;
    });
  }
  function aiCollByName(name) {
    var l = aiAllColls();
    for (var i = 0; i < l.length; i++) if (l[i].name === name) return l[i];
    return null;
  }
  // коллекции, в которые ПРЯМО СЕЙЧАС идёт подбор → в списке дизейблим
  function aiSourcingNames() {
    var names = {};
    aiLoad().forEach(function (r) {
      if (r.status !== "pending") return;
      names[r.mode === "append" ? r.target : r.name] = true;
    });
    return names;
  }
  // актуальные каналы коллекции: базовые + дописанные
  function aiChannelsOf(name) {
    var c = aiCollByName(name), extra = aiExtraLoad()[name];
    var list = c ? c.channels.slice() : [];
    if (extra && extra.channels) extra.channels.forEach(function (n) { if (list.indexOf(n) === -1) list.push(n); });
    return list;
  }

  // случай 1 (коллекций нет) — поле имени; случай 2 — дропдаун
  function aiRenderDest() {
    var pick = aiEl("[data-ai-dest-pick]"), neu = aiEl("[data-ai-dest-new]");
    if (!pick || !neu) return;
    var list = aiAllColls(), has = list.length > 0;
    pick.hidden = !has;
    neu.hidden = has;
    if (!has) return;
    var box = aiEl("[data-ai-select-list]");
    if (box) {
      var busy = aiSourcingNames();
      box.innerHTML = list.map(function (c) {
        var dis = !!busy[c.name];
        return '<button class="ai-select__opt' + (aiDest === c.name ? " is-selected" : "") + '" type="button" role="option"' +
               ' aria-selected="' + (aiDest === c.name) + '" data-ai-opt="' + escHtml(c.name) + '"' + (dis ? " disabled" : "") + '>' +
               '<span>' + escHtml(c.name) + '</span>' +
               (dis ? '<span class="ai-select__note">Sourcing…</span>' : "") + '</button>';
      }).join("");
    }
    var val = aiEl("[data-ai-select-val]");
    if (val) {
      if (aiDest) { val.textContent = aiDest; val.classList.remove("is-ph"); }
      else { val.textContent = "Select collection"; val.classList.add("is-ph"); }
    }
  }
  function aiSelectToggle(open) {
    var root = aiEl("[data-ai-select]"), menu = aiEl("[data-ai-select-menu]"), trig = aiEl("[data-ai-select-trig]");
    if (!root || !menu) return;
    var willOpen = (open === undefined) ? menu.hidden : !!open;
    menu.hidden = !willOpen;
    root.classList.toggle("is-open", willOpen);
    if (trig) trig.setAttribute("aria-expanded", willOpen ? "true" : "false");
  }

  function aiFormFilters() {
    return {
      subs: aiVal("[data-ai-subs]", 10000),
      videos: aiVal("[data-ai-videos]", 0),
      views: aiVal("[data-ai-views]", 0),
      avg: aiVal("[data-ai-avg]", 0),
      lastDays: aiVal("[data-ai-last]", 0)
    };
  }

  function aiOpen() {
    var m = document.getElementById("aiModal");
    if (!m) return;
    m.classList.add("is-open");
    document.body.style.overflow = "hidden";
    aiDest = null; aiJustCreated = null;
    aiRefs = [];
    aiSetMode("single");                      // по умолчанию — вариант с полем ссылки
    aiRefFormToggle(false);
    var seed0 = aiEl("[data-ai-seed]"); if (seed0) seed0.value = "";
    var ta0 = aiTa(); if (ta0) ta0.value = "";
    aiRenderRefs();
    aiRenderDest();
    aiSync();
    aiPhIdle();                                  // состояние 1 — ротация примеров
    var n = m.querySelector("[data-ai-name]"); if (n) n.focus();
  }
  // любое изменение полей модалки пересчитывает состояния кнопок и сводку
  document.addEventListener("input", function (e) {
    if (!e.target.closest("#aiModal")) return;
    // состояние 2 — набор в описании: ротацию гасим сразу
    // P1.13: применение без кнопки Apply
    if (e.target.closest("[data-anf-text],[data-anf-from],[data-anf-to]")) { flApply(); return; }
    var fSearch = e.target.closest("[data-anf-search]");
    if (fSearch) {
      var q = fSearch.value.trim().toLowerCase();
      var opts = fSearch.closest("[data-anf-menu]").querySelectorAll(".anf-opt");
      for (var oi = 0; oi < opts.length; oi++) {
        var t = opts[oi].textContent.toLowerCase();
        opts[oi].hidden = !!q && t.indexOf(q) === -1;
      }
      return;
    }
    if (e.target.closest("[data-ai-refseed]")) aiRefSuggest();
    if (e.target.closest("[data-ai-query]")) {
      aiPhStop();
      if (e.target.value.trim()) e.target.placeholder = "";
    }
    aiSync();
  });
  function aiVal(sel, def) {
    var el = document.querySelector(sel);
    if (!el) return def;
    var v = parseInt(el.value, 10);
    return isNaN(v) || v < 0 ? 0 : v;
  }
  function aiSubmit() {
    var query = aiTxt("[data-ai-query]");
    var seedVal = aiTxt("[data-ai-seed]");
    // назначение: выбранная коллекция (если они есть) либо имя новой (первая коллекция)
    var hasCollsNow = aiAllColls().length > 0;
    var destName = hasCollsNow ? aiDest : aiTxt("[data-ai-name]");
    // назначение обязательно + описание ИЛИ reference-ссылка (пустую форму не запускаем)
    var srcOk = aiMode() === "refs" ? !!aiRefs.length : !!seedVal;
    if (!destName || !(query || srcOk)) {
      toast(!destName
        ? (hasCollsNow ? "Select a destination collection" : "Name the collection first")
        : (aiMode() === "refs" ? "Add at least one reference channel" : "Describe the channels or paste a channel link"));
      return;
    }
    var now = Date.now();
    var d = new Date(now);
    var rec = {
      id: "ai" + now,
      name: destName,
      // если описание не заполняли — фиксируем ссылку как исходный Query
      // если описание пустое — фиксируем источник (ссылку или референсы) как Query
      query: query || (aiMode() === "refs" && aiRefs.length
        ? "Channels similar to " + aiRefs.map(function (r) { return r.name; }).join(", ")
        : "Channels similar to " + seedVal),
      seed: seedVal,
      filters: aiFormFilters(),
      status: "pending",
      readyAt: now + AI_BUILD_MS,
      created: ("0" + d.getDate()).slice(-2) + "." + ("0" + (d.getMonth() + 1)).slice(-2) + "." + d.getFullYear()
    };
    var list = aiLoad();
    var hasColls = aiAllColls().length > 0;
    if (!hasColls) {
      list.push(rec);                                  // случай 1: создаём первую коллекцию
    } else if (aiDest === aiJustCreated) {
      // только что создана через вложенную модалку → ведёт себя как новая AI-коллекция
      var conv = null;
      for (var ci = 0; ci < list.length; ci++) if (list[ci].name === aiDest) conv = list[ci];
      if (conv) {
        conv.isAi = true; conv.mode = "new"; conv.status = "pending"; conv.readyAt = rec.readyAt;
        conv.query = rec.query; conv.seed = rec.seed; conv.filters = rec.filters; conv.channels = [];
      } else { rec.name = aiDest; list.push(rec); }
    } else {
      // существующая коллекция: новую не создаём, дописываем каналы в неё
      list.push({ id: rec.id, mode: "append", target: aiDest, name: aiDest, isAi: false,
                  query: rec.query, seed: rec.seed, filters: rec.filters,
                  status: "pending", readyAt: rec.readyAt, created: rec.created });
    }
    aiSave(list);
    closeModal(document.getElementById("aiModal"));
    toast(hasColls && aiDest !== aiJustCreated
      ? "Sourcing started — channels will be added to “" + aiDest + "”"
      : "Sourcing started — we're finding channels");
    aiTick();               // поднимет пилюлю и заведёт таймер
    aiRenderCollections();
  }

  document.addEventListener("click", function (e) {
    // отмена подбора из попапа «Sourcing in progress»
    var cancelBtn = e.target.closest("[data-dd-cancel]");
    if (cancelBtn) {
      var cid = cancelBtn.getAttribute("data-dd-cancel");
      var rec = aiById(cid);
      aiRemove(cid);
      toast(rec ? "Sourcing of “" + rec.name + "” canceled" : "Sourcing canceled");
      return;
    }
    if (e.target.closest("[data-ai-open]")) { aiOpen(); return; }
    // второй вход: «Find similar channels» из панели массовых действий Basic data —
    // та же модалка, но референсы предзаполнены выбранными в таблице каналами
    if (e.target.closest("[data-ai-similar]")) {
      var picked = [];
      var boxes = document.querySelectorAll("[data-an-check].is-checked");
      for (var pi = 0; pi < boxes.length; pi++) {
        var row = boxes[pi].closest(".an-tr");
        if (!row) continue;
        var nmEl = row.querySelector(".an-chan__name"), avEl = row.querySelector(".an-chan__ava");
        if (!nmEl) continue;
        picked.push({
          name: nmEl.textContent.trim(),
          initial: avEl ? avEl.textContent.trim() : "",
          color: avEl ? (avEl.getAttribute("style") || "").replace(/.*var\(([^)]+)\).*/, "$1") : ""
        });
      }
      if (!picked.length) return;
      aiOpen();
      aiSetMode("refs");                      // вход с выбранными каналами — секция референсов
      picked.forEach(function (p) { aiRefAdd(p.name, p.initial, p.color || null); });
      aiRenderRefs();
      // подсказка имени новой коллекции (пользователь может переписать)
      var nameInp = aiEl("[data-ai-name]");
      if (nameInp && !nameInp.value) {
        nameInp.value = "Similar to " + picked[0].name + (picked.length > 1 ? " +" + (picked.length - 1) : "");
      }
      aiSync();
      if (aiRefs.length) aiGenStart();          // описание подбирается сразу из референсов
      return;
    }
    // дропдаун назначения
    if (e.target.closest("[data-ai-select-trig]")) { aiSelectToggle(); return; }
    var opt = e.target.closest("[data-ai-opt]");
    if (opt) {
      if (opt.disabled) return;                       // идёт подбор — выбрать нельзя
      aiDest = opt.getAttribute("data-ai-opt");
      aiSelectToggle(false);
      aiRenderDest();
      aiSync();
      return;
    }
    // «Create new collection» (пункт списка и чёрная кнопка «+») → вложенная модалка
    if (e.target.closest("[data-ai-newcoll]")) {
      aiSelectToggle(false);
      aiFromSourcing = true;
      mcMode = "create";
      var ct = document.querySelector("[data-mc-create-title]"); if (ct) ct.textContent = "Create collection";
      var cn = document.querySelector("[data-mc-name]");
      // подсказка имени из референсов (пользователь может переписать)
      if (cn) cn.value = aiRefs.length
        ? "Similar to " + aiRefs[0].name + (aiRefs.length > 1 ? " +" + (aiRefs.length - 1) : "")
        : "";
      var cb = document.querySelector("[data-mc-create-submit]"); if (cb) cb.textContent = "Create";
      openModal("mcModal-create");
      var f = document.querySelector("[data-mc-name]"); if (f) f.focus();
      return;
    }
    // клик вне дропдауна — закрыть
    if (!e.target.closest("[data-ai-select]")) aiSelectToggle(false);
    // клик вне поля добавления референса — убрать подсказки, пустое поле свернуть
    if (!e.target.closest("[data-ai-ref-form]") && !e.target.closest("[data-ai-ref-open]")) {
      aiRefSugHide();
      var formEl = aiEl("[data-ai-ref-form]"), seedEl = aiEl("[data-ai-refseed]");
      if (formEl && !formEl.hidden && seedEl && !String(seedEl.value || "").trim()) aiRefFormToggle(false);
    }
    if (e.target.closest("[data-ai-close]")) { closeModal(e.target.closest(".an-modal")); return; }
    if (e.target.closest("[data-ai-submit]")) { aiSubmit(); return; }
    // Auto-fill (режим single): подбор описания по вставленной ссылке
    var detectBtn = e.target.closest("[data-ai-detect]");
    if (detectBtn) {
      if (detectBtn.disabled || aiGenBusy) return;
      if (!aiSeedIsUrl(aiTxt("[data-ai-seed]"))) return;
      aiGenStart();
      return;
    }
    // «Add channel» — раскрыть поле ввода (в покое видна только кнопка)
    if (e.target.closest("[data-ai-ref-open]")) {
      aiRefFormToggle(true);
      return;
    }
    // выбор канала из подсказок
    var pick = e.target.closest("[data-ai-ref-pick]");
    if (pick) {
      var okPick = aiRefAdd(pick.getAttribute("data-ai-ref-pick"), pick.getAttribute("data-initial"), pick.getAttribute("data-color") || null);
      aiRefSugHide();
      aiRefFormToggle(false);
      if (okPick) aiRefsChanged();
      return;
    }
    // добавить референс-канал (ссылка или имя) → перезапуск подбора описания
    if (e.target.closest("[data-ai-ref-add]")) {
      var raw = aiTxt("[data-ai-refseed]");
      if (!raw) return;
      var nm = (raw.match(/@([\w.\-]+)/) || [])[1];
      if (!nm && /^https?:\/\//i.test(raw)) nm = (raw.split("?")[0].split("/").filter(Boolean).pop() || raw);
      var added = aiRefAdd(nm ? "@" + String(nm).replace(/^@/, "") : raw);
      aiRefSugHide();
      aiRefFormToggle(false);                       // возвращаемся к кнопке «Add channel»
      if (added) aiRefsChanged(); else { aiSync(); toast("This channel is already in references"); }
      return;
    }
    // удалить референс → тоже перезапуск подбора
    var refDel = e.target.closest("[data-ai-ref-del]");
    if (refDel) {
      aiRefs.splice(parseInt(refDel.getAttribute("data-ai-ref-del"), 10), 1);
      aiRefsChanged();
      return;
    }
  });

  // страница открытой коллекции: имя из ?name= (заголовок формы)
  // P1.11: строки для добавленных каналов — цифр по ним нет, ставим «—»
  function ceAddRows(names) {
    var body = document.querySelector(".ce-table .an-tbody") ||
               (document.querySelector("[data-ce-row]") && document.querySelector("[data-ce-row]").parentNode);
    if (!body) return;
    var pool = (typeof aiChannelPool === "function" ? aiChannelPool() : []);
    var proto = document.querySelector("[data-ce-remove]");
    var trash = proto ? proto.innerHTML : "";
    names.forEach(function (nm) {
      var info = null;
      for (var i = 0; i < pool.length; i++) if (pool[i].name === nm) info = pool[i];
      var ini = (info && info.initial) || nm.replace(/^@/, "").charAt(0).toUpperCase();
      var col = (info && info.color) || "--color-avatar-3";
      var html = '<div class="an-tr" data-ce-row>' +
        '<div class="an-td" style="width:240px"><span class="ce-chan"><span class="mc-ava ce-ava" style="background:var(' + col + ')">' + escHtml(ini) + '</span>' +
          '<span class="ce-chan__name">' + escHtml(nm) + '</span></span></div>' +
        '<div class="an-td ce-num" style="width:120px">' + escHtml(info ? info.views : "—") + '</div>' +
        '<div class="an-td ce-num" style="width:120px">' + escHtml(info ? info.subs : "—") + '</div>' +
        '<div class="an-td" style="width:200px"><a class="ce-view" href="#" tabindex="-1">View channel</a></div>' +
        '<div class="an-td" style="width:100px"><button class="ce-trash" type="button" aria-label="Remove channel" data-ce-remove>' + trash + '</button></div>' +
      '</div>';
      body.insertAdjacentHTML("beforeend", html);
    });
  }
  function ceInit() {
    var inp = document.querySelector("[data-ce-name]");
    if (!inp) return;
    var nm = new URLSearchParams(window.location.search).get("name");
    if (nm) inp.value = nm;
    // удаление канала из коллекции (мок)
    document.addEventListener("click", function (e) {
      var rm = e.target.closest("[data-ce-remove]");
      if (!rm) return;
      var row = rm.closest("[data-ce-row]");
      if (row) { row.remove(); toast("Channel removed from collection"); }
    });
  }

  aiTick();
  aiRenderCollections();
  tabInit();                         // P1.9: активный таб из ?tab=
  tblInitAll();                      // P1.5: первая отрисовка страниц
  cvInit();                          // P1.7: видимость колонок из localStorage
  slInit();                          // P1.6: выбранные срезы по типу контента
  gsInit();                          // P1.8: режим сводной строки
  flInit();                          // P1.13: панель открыта по умолчанию
  aiRenderCollectionView();
  ceInit();
})();

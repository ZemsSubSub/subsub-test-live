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
    // состояние «select all»
    var all = document.querySelectorAll("[data-an-check]").length;
    var allBtn = document.querySelector("[data-an-check-all]");
    if (allBtn) allBtn.classList.toggle("is-checked", all > 0 && n === all);
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
    if (cb) { cb.classList.toggle("is-checked"); updateFooter(); return; }
    // select all
    var cbAll = e.target.closest("[data-an-check-all]");
    if (cbAll) {
      var on = !cbAll.classList.contains("is-checked");
      cbAll.classList.toggle("is-checked", on);
      var boxes = document.querySelectorAll("[data-an-check]");
      for (var j = 0; j < boxes.length; j++) boxes[j].classList.toggle("is-checked", on);
      updateFooter();
      return;
    }
    // футер: очистить выбор
    if (e.target.closest("[data-an-footer-close]")) {
      var all = document.querySelectorAll("[data-an-check], [data-an-check-all]");
      for (var k = 0; k < all.length; k++) all[k].classList.remove("is-checked");
      updateFooter();
      return;
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
      ["basic", "deep", "coll"].forEach(function (k) { tblPerPageMenu(k, false); });
    }
    // очистка поиска
    if (e.target.closest("[data-an-search-clear]")) {
      var inp = document.querySelector("[data-an-search]");
      if (inp) inp.value = "";
      var cl = document.querySelector("[data-an-search-clear]"); if (cl) cl.hidden = true;
      return;
    }
  });

  var input = document.querySelector("[data-an-search]");
  if (input) input.addEventListener("input", function () {
    var cl = document.querySelector("[data-an-search-clear]");
    if (cl) cl.hidden = input.value.length === 0;
  });


  // ================= P1.5: клиентская сортировка + пагинация =================
  // Работает по статическим строкам в DOM: сортировка переставляет узлы, пагинация
  // скрывает лишние. Строки, скрытые другими фильтрами (data-filtered), в выборку не попадают.
  var TBL = {
    basic: { per: 30, sizes: [30, 50, 100], sort: null, page: 1 },
    deep:  { per: 30, sizes: [30, 50, 100], sort: null, page: 1 },
    coll:  { per: 15, sizes: [15, 30, 50],  sort: null, page: 1 }
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
      if (r.classList.contains("an-tr--avg")) return;      // сводная строка всегда видна
      r.hidden = true;
    });
    rows.slice(from, to).forEach(function (r) { r.hidden = false; });
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
  // счётчик рядом с лейблом: на Basic оставляем «2.2m» (это размер базы), в остальных — число строк
  function tblUpdateTotal(key, n) {
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
    ["basic", "deep", "coll"].forEach(function (key) {
      if (tblBody(key)) tblApply(key);
    });
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
    var shared = row.children[6].querySelector(".mc-shared"); if (shared) shared.innerHTML = "";
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
        '<div class="an-td" style="width:120px"><span class="mc-shared"></span></div>' +
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
  tblInitAll();                      // P1.5: первая отрисовка страниц
  aiRenderCollectionView();
  ceInit();
})();

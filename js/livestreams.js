// Live → Streams — лёгкий интерактив прототипа. Данные статичны (пример-значения),
// поэтому здесь только косметика: визуальный тоггл направления сортировки в заголовках.
(function () {
  document.addEventListener("click", function (e) {
    var th = e.target.closest(".ls-th--sort");
    if (th) {
      var svg = th.querySelector(".ls-sort");
      if (svg) {
        var desc = th.getAttribute("data-sort-desc") === "1";
        th.setAttribute("data-sort-desc", desc ? "0" : "1");
        svg.style.transform = desc ? "" : "rotate(180deg)";
        svg.style.color = "var(--color-black)";
      }
      return;
    }
  });
})();

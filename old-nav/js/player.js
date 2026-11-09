// Переиспользуемый кастомный видеоплеер (как на проде, стиль Plyr).
// Работает для ЛЮБОГО блока .ml-video на странице (модалка превью в Files И
// публичная страница шаренной ссылки). Только показ/управление реальным <video>;
// никаких шаблонов. Соотношение сторон окна подстраивается под реальное видео.
(function () {
  var IC_PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
  var IC_PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="3.5" height="14" rx="1"/><rect x="14.5" y="5" width="3.5" height="14" rx="1"/></svg>';

  function fmt(s) {
    if (!isFinite(s) || s < 0) s = 0;
    s = Math.floor(s);
    return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2);
  }

  function wire(box) {
    if (box.__wired) return;
    box.__wired = true;
    var vid = box.querySelector(".ml-video-el");
    if (!vid) return;
    var fill = box.querySelector("[data-vfill]");
    var dot = box.querySelector("[data-vdot]");
    var timeEl = box.querySelector("[data-vtime]");
    var playBtn = box.querySelector("[data-vplay]");
    var volFill = box.querySelector("[data-vvolfill]");
    // контейнер, задающий соотношение сторон окна (тёмное тело превьюера)
    var ratioBox = box.closest(".ml-viewer__body") || box.parentElement;

    function updProgress() {
      var p = vid.duration ? (vid.currentTime / vid.duration) * 100 : 0;
      if (fill) fill.style.width = p + "%";
      if (dot) dot.style.left = p + "%";
      if (timeEl) timeEl.textContent = fmt(vid.currentTime) + " / " + fmt(vid.duration);
    }
    function updVol() { if (volFill) volFill.style.width = (vid.muted ? 0 : vid.volume * 100) + "%"; }
    function updRatio() {
      // окно видео = соотношению сторон самого видео (без чёрных полей)
      if (ratioBox && vid.videoWidth && vid.videoHeight) {
        ratioBox.style.aspectRatio = vid.videoWidth + " / " + vid.videoHeight;
      }
    }

    vid.addEventListener("timeupdate", updProgress);
    vid.addEventListener("loadedmetadata", function () { updProgress(); updVol(); updRatio(); });
    vid.addEventListener("play", function () { if (playBtn) playBtn.innerHTML = IC_PAUSE; });
    vid.addEventListener("pause", function () { if (playBtn) playBtn.innerHTML = IC_PLAY; });
    vid.addEventListener("volumechange", updVol);

    box.addEventListener("click", function (e) {
      if (e.target.closest("[data-vplay]") || e.target === vid) { vid.paused ? vid.play() : vid.pause(); return; }
      if (e.target.closest("[data-vback]")) { vid.currentTime = Math.max(0, vid.currentTime - 10); return; }
      if (e.target.closest("[data-vfwd]")) { vid.currentTime = Math.min(vid.duration || 0, vid.currentTime + 10); return; }
      if (e.target.closest("[data-vmute]")) { vid.muted = !vid.muted; return; }
      if (e.target.closest("[data-vfull]")) {
        var target = ratioBox || box;
        if (target.requestFullscreen) target.requestFullscreen();
        else if (vid.requestFullscreen) vid.requestFullscreen();
        return;
      }
      var tr = e.target.closest("[data-vtrack]");
      if (tr) {
        var r = tr.getBoundingClientRect();
        var ratio = (e.clientX - r.left) / r.width;
        if (vid.duration) vid.currentTime = vid.duration * Math.max(0, Math.min(1, ratio));
        return;
      }
    });

    updProgress(); updVol(); updRatio();
    // экспонируем на элемент — media.js дергает при закрытии модалки
    box.__resetPlay = function () { if (playBtn) playBtn.innerHTML = IC_PLAY; if (fill) fill.style.width = "0%"; if (dot) dot.style.left = "0%"; };
  }

  function init() {
    var boxes = document.querySelectorAll(".ml-video");
    for (var i = 0; i < boxes.length; i++) wire(boxes[i]);
  }
  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();

const fs = require("fs");
const DIR = "E:/Dev SubSub/subsub_front_prototype_31.07.26/";
let html = fs.readFileSync(DIR + "home.html", "utf8");
const mlSprite = fs.readFileSync(DIR + "ml-sprite.html", "utf8").trim();

function esc(s){ return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
const use = (id) => `<svg><use href="#${id}"></use></svg>`;

// canPreview: все категории кроме other (и папок) — как в useFilePreviewer.ts.
// transcript (.srt) — результат транскрибации, тоже превьюабельный (список реплик с таймкодами).
const PREVIEWABLE = new Set(["video", "image", "audio", "document", "spreadsheet", "pdf", "code", "transcript"]);

// ---- preview cell by kind -------------------------------------------------
function preview(kind){
  const dp = PREVIEWABLE.has(kind) ? " data-preview" : "";
  if (kind === "folder")
    return `<div class="ml-preview ml-preview--folder"><svg class="ml-preview__icon"><use href="#ml-folder"></use></svg></div>`;
  // video — прямоугольный кадр на весь слот; остальные типы — квадратная иконка по центру серого прямоугольника
  if (kind === "video")
    return `<div class="ml-preview ml-preview--video"${dp}><div class="ml-preview__play"><span>${use("ml-play")}</span></div></div>`;
  const iconByKind = { image:"ml-image", audio:"ml-audio", document:"ml-file", spreadsheet:"ml-spreadsheet", pdf:"ml-pdf", code:"ml-code", transcript:"ml-transcript", other:"ml-file" };
  return `<div class="ml-preview ml-preview--${kind}"${dp}><svg class="ml-preview__icon"><use href="#${iconByKind[kind]}"></use></svg></div>`;
}

function nameCell(r){
  const dp = PREVIEWABLE.has(r.kind) ? " data-preview" : "";
  if (r.kind === "folder")
    return `<div class="ml-name">${preview("folder")}<div class="ml-name__folder"><span class="ml-name__text">${esc(r.name)}</span><span class="ml-name__meta"><span>${esc(r.meta[0])}</span><span class="dot"></span><span>${esc(r.meta[1])}</span></span></div></div>`;
  return `<div class="ml-name">${preview(r.kind)}<span class="ml-name__text"${dp}>${esc(r.name)}</span></div>`;
}

function row(r){
  const author = `<span class="ml-you">You</span>`; // прототип: все элементы принадлежат "You"
  const srcAttr = r.file ? ` data-src="files/${r.file}"` : "";
  const folderAttr = r.folderId ? ` data-enter-folder="${r.folderId}"` : ""; // клик по папке → войти
  const extraAttr = r.attr ? " " + r.attr : "";
  const hiddenAttr = r.hidden ? " hidden" : "";
  return `<tr class="ml-row${r.folderId ? " ml-row--folder" : ""}" data-kind="${r.kind}" data-name="${esc(r.name)}"${srcAttr}${folderAttr}${extraAttr}${hiddenAttr}>
        <td class="c-check"><input class="ml-check" type="checkbox" aria-label="Select" /></td>
        <td class="c-drag"><svg class="ml-drag"><use href="#ml-drag"></use></svg></td>
        <td class="c-name">${nameCell(r)}</td>
        <td class="c-created">${r.created}</td>
        <td class="c-storage">${r.size}</td>
        <td class="c-author">${author}</td>
        <td class="c-shared"><span class="ml-notshared"><svg><use href="#ml-eyeslash"></use></svg>Not shared</span></td>
        <td class="c-actions c-actions-cell"><button class="ml-more" type="button" aria-label="Actions"><svg><use href="#ml-more"></use></svg></button></td>
      </tr>`;
}

// Rows: folder + real prod examples (2 videos, PDF) + one of every FILE_CATEGORY type.
// Реальные файлы лежат в files/ (см. gen-files.js). data-src → путь для превью/скачивания.
const ROWS = [
  { kind:"folder", name:"Analytics", folderId:"analytics", meta:["3 files","0 folders"], created:"13.07.2026", size:"18.2 MB" },
  { kind:"folder", name:"Music", folderId:"music", meta:["4 files","0 folders"], created:"12.07.2026", size:"58.4 MB" },
  { kind:"video", name:"video_2026-07-10_12-44-13_original.mp4", file:"sample-video.webm", created:"10.07.2026", size:"341.24 KB" },
  { kind:"video", name:"Hunt Showdown 2025.02.26 - 21.04.40.06.противник убит.DVR.mp4", file:"sample-video.webm", created:"08.07.2026", size:"293.73 MB" },
  { kind:"image", name:"cover-photo.png", file:"cover-photo.png", created:"12.07.2026", size:"89.9 KB" },
  { kind:"audio", name:"podcast-episode-04.wav", file:"podcast-episode-04.wav", created:"11.07.2026", size:"62.5 KB" },
  { kind:"document", name:"contract-draft.docx", file:"contract-draft.docx", created:"11.07.2026", size:"184.50 KB" },
  { kind:"spreadsheet", name:"revenue-report.xlsx", file:"revenue-report.xlsx", created:"10.07.2026", size:"92.15 KB" },
  { kind:"pdf", name:"Yevhenii Z. Portfolio PDF.pdf", file:"portfolio.pdf", created:"13.07.2026", size:"13.56 MB" },
  { kind:"code", name:"upload-script.js", file:"upload-script.js", created:"09.07.2026", size:"323 B" },
  { kind:"other", name:"project-archive.zip", file:"project-archive.zip", created:"09.07.2026", size:"15.80 MB" },
];

// Содержимое папки Analytics (для «проваливания» внутрь). Файлы — реальные из files/.
const ROWS_ANALYTICS = [
  { kind:"pdf", name:"Q3-overview.pdf", file:"portfolio.pdf", created:"12.07.2026", size:"4.10 MB" },
  { kind:"spreadsheet", name:"channel-stats.xlsx", file:"revenue-report.xlsx", created:"11.07.2026", size:"92.15 KB" },
  { kind:"image", name:"thumbnail-ab-test.png", file:"cover-photo.png", created:"10.07.2026", size:"89.9 KB" },
];

// Содержимое папки Music (аудио; реальный файл — podcast-episode-04.wav для превью-плеера).
const ROWS_MUSIC = [
  { kind:"audio", name:"intro-jingle.wav", file:"podcast-episode-04.wav", created:"12.07.2026", size:"1.10 MB" },
  { kind:"audio", name:"podcast-episode-04.wav", file:"podcast-episode-04.wav", created:"11.07.2026", size:"62.5 KB" },
  { kind:"audio", name:"background-loop.wav", file:"podcast-episode-04.wav", created:"10.07.2026", size:"3.40 MB" },
  { kind:"audio", name:"outro-sting.wav", file:"podcast-episode-04.wav", created:"09.07.2026", size:"0.90 MB" },
];

const sortIco = `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 6.5L8 3.5L11 6.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 9.5L8 12.5L11 9.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// ---- inline control icons (video bar / pdf toolbar) -----------------------
const IC = {
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
  rewind: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 6 5 12l6 6zM18 6l-6 6 6 6z"/></svg>',
  forward: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 6l6 6-6 6zM6 6l6 6-6 6z"/></svg>',
  volume: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 0 1 0 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  fullscreen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  hamburger: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
  print: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M7 9V4h10v5M7 18H5v-6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6h-2M7 14h10v6H7z"/></svg>',
  rotate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4"/></svg>',
  // глобус — действие «Translate» в превью транскрипта
  translate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.4 3.8 5.5 3.8 9S14.5 18.6 12 21c-2.5-2.4-3.8-5.5-3.8-9S9.5 5.4 12 3z"/></svg>',
  youtube: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23 12s0-3.9-.49-5.8a3 3 0 0 0-2.11-2.12C18.5 3.6 12 3.6 12 3.6s-6.5 0-8.4.48A3 3 0 0 0 1.5 6.2C1 8.1 1 12 1 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.12C5.5 20.4 12 20.4 12 20.4s6.5 0 8.4-.48a3 3 0 0 0 2.11-2.12C23 15.9 23 12 23 12ZM9.75 15.5v-7L15.8 12l-6.05 3.5Z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
  paperclip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 11.5 12 20a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.65 1.65 0 0 1-2.35-2.35l7.6-7.6"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  arrowL: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
  arrowR: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  google: '<svg viewBox="0 0 24 24"><path fill="#4285F4" d="M23 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.19a5.29 5.29 0 0 1-2.3 3.47v2.89h3.72C21.79 18.92 23 15.9 23 12.27z"/><path fill="#34A853" d="M12 24c3.11 0 5.72-1.03 7.63-2.79l-3.72-2.89c-1.03.69-2.35 1.1-3.91 1.1-3 0-5.55-2.03-6.46-4.76H1.69v2.98A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.54 14.66a7.2 7.2 0 0 1 0-4.6V7.08H1.69a12 12 0 0 0 0 10.56l3.85-2.98z"/><path fill="#EA4335" d="M12 4.75c1.69 0 3.21.58 4.4 1.72l3.3-3.3C17.72 1.21 15.11 0 12 0A12 12 0 0 0 1.69 7.08l3.85 2.98C6.45 6.78 9 4.75 12 4.75z"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L11.5 4.5"/><path d="M14 11a5 5 0 0 0-7.07 0l-2.83 2.83a5 5 0 0 0 7.07 7.07L12.5 19.5"/></svg>',
};

// Единый СВЕТЛЫЙ хедер модалки: цветной icon-badge по типу + имя + action-bar + close.
// publish=true → добавляет видимую кнопку «Send to YouTube Studio» (для видео; единственный акцентный CTA).
function head(kind, publish) {
  const badgeIcon = { video:"ml-video", audio:"ml-audio", image:"ml-image", pdf:"ml-pdf", document:"ml-file", spreadsheet:"ml-spreadsheet", code:"ml-code", transcript:"ml-transcript" }[kind];
  const pub = publish
    ? `<button class="ml-vbtn ml-vbtn--publish" type="button" data-action="send">${IC.youtube}Send to YouTube Studio</button>`
    : "";
  return `<div class="ml-viewer__head">
          <span class="ml-viewer__badge ml-viewer__badge--${kind}"><svg><use href="#${badgeIcon}"></use></svg></span>
          <span class="ml-viewer__title" data-title></span>
          <div class="ml-viewer__actions">
            ${pub}
            <button class="ml-vbtn" type="button" data-action="share">${use("ml-share")}Share</button>
            <button class="ml-vbtn" type="button" data-action="download">${use("ml-download")}Download</button>
            <button class="ml-viewer__close" type="button" data-close aria-label="Close">${use("ml-close")}</button>
          </div>
        </div>`;
}

// ---- actions popover (⋮) — сгруппировано + разделители (см. media.js) -------
const popover = `
    <div class="ml-actions" id="mlActions" role="menu">
      <div class="ml-actions__group">
        <button class="ml-action" type="button" data-when="file" data-action="share">${use("ml-share")}Share</button>
        <button class="ml-action" type="button" data-when="file" data-action="download">${use("ml-download")}Download</button>
        <button class="ml-action" type="button" data-when="file">${IC.link}Copy file link</button>
      </div>
      <div class="ml-actions__sep"></div>
      <div class="ml-actions__group">
        <button class="ml-action" type="button" data-when="any">${use("ml-edit")}Rename</button>
        <button class="ml-action" type="button" data-when="any">${use("ml-movefolder")}Move to folder</button>
      </div>
      <div class="ml-actions__sep"></div>
      <div class="ml-actions__group">
        <button class="ml-action" type="button" data-when="video" data-action="send">${IC.youtube}Send to YouTube Studio</button>
        <button class="ml-action" type="button" data-when="video" data-action="metadata">${use("ml-file")}Generate metadata</button>
        <button class="ml-action" type="button" data-when="video">${use("ml-refresh")}Convert</button>
        <button class="ml-action" type="button" data-when="av" data-action="transcribe" data-transcribe-mode="create">${use("ml-transcript")}<span data-transcribe-label>Transcribe</span></button>
      </div>
      <div class="ml-actions__sep"></div>
      <div class="ml-actions__group">
        <button class="ml-action ml-action--danger" type="button" data-when="any">${use("ml-delete")}Delete</button>
      </div>
    </div>`;

// ---- preview modals (единый светлый хедер) --------------------------------
function viewerModal(kind, body, opts){
  opts = opts || {};
  const bodyCls = opts.bodyClass ? " " + opts.bodyClass : "";
  return `
    <div class="ml-modal" id="mlModal-${kind}"><div class="ml-modal__overlay"></div>
      <div class="ml-modal__dialog"><div class="ml-viewer">
        ${head(kind, opts.publish)}
        <div class="ml-viewer__body${bodyCls}">${body}</div>
      </div></div>
    </div>`;
}

// Видео — светлый хедер + кнопка Publish; тело тёмное; кастомная панель управления
// в стиле прод-плеера (Plyr): play/pause, rewind, forward, прогресс, время, громкость, fullscreen.
const videoBody = `
        <div class="ml-video">
          <video class="ml-video-el" playsinline preload="metadata"></video>
          <div class="ml-video__bar">
            <button type="button" data-vplay aria-label="Play/Pause">${IC.play}</button>
            <button type="button" data-vback aria-label="Rewind 10s">${IC.rewind}</button>
            <button type="button" data-vfwd aria-label="Forward 10s">${IC.forward}</button>
            <div class="ml-video__track" data-vtrack><div class="fill" data-vfill></div><div class="dot" data-vdot></div></div>
            <span class="ml-video__time" data-vtime>0:00 / 0:00</span>
            <button type="button" data-vmute aria-label="Mute">${IC.volume}</button>
            <div class="ml-video__vol" data-vvol><div class="fill" data-vvolfill></div></div>
            <button type="button" data-vfull aria-label="Fullscreen">${IC.fullscreen}</button>
          </div>
        </div>`;
const videoModal = viewerModal("video", videoBody, { publish: true, bodyClass: "ml-viewer__body--dark" });

// Нативный просмотр PDF — встроенная в браузер читалка через <iframe> (src ставит media.js)
const pdfBody = `<iframe class="ml-pdf-frame" title="PDF preview"></iframe>`;

const imageBody = `<div class="ml-img-body"><img class="ml-img-el" alt="" /></div>`;

const docxBody = `
        <div class="ml-docx"><div class="ml-docx__page">
          <div class="ln h"></div>
          <div class="ln s"></div><div class="ln"></div><div class="ln m"></div>
          <div class="ln s"></div><div class="ln"></div><div class="ln m"></div>
          <div class="ln s"></div><div class="ln"></div>
        </div></div>`;

const sheetRows = Array.from({ length: 12 }, (_, i) =>
  `<tr><th>${i + 1}</th><td></td><td></td><td></td><td></td><td></td></tr>`
).join("");
const sheetBody = `
        <div class="ml-sheet"><table>
          <thead><tr><th></th><th>A</th><th>B</th><th>C</th><th>D</th><th>E</th></tr></thead>
          <tbody>${sheetRows}</tbody>
        </table></div>`;

// Реальное содержимое файла кода (встраиваем на этапе сборки — без runtime fetch,
// чтобы работало и при открытии через file://).
const codeRaw = fs.readFileSync(DIR + "files/upload-script.js", "utf8").replace(/\s+$/, "");
const codeLines = codeRaw.split("\n").map(esc);
const codeBody = `
        <div class="ml-code">
          <div class="ml-code__gutter">${codeLines.map((_, i) => `<div>${i + 1}</div>`).join("")}</div>
          <div class="ml-code__lines">${codeLines.map((l) => `<div>${l || "&nbsp;"}</div>`).join("")}</div>
        </div>`;

// Аудио — компактный модал с тем же единым светлым хедером.
const audioModal = `
    <div class="ml-modal" id="mlModal-audio"><div class="ml-modal__overlay"></div>
      <div class="ml-modal__dialog ml-audio-dialog"><div class="ml-audio">
        ${head("audio", false)}
        <div class="ml-audio__body">
          <div class="ml-audio__art">${use("ml-audio")}</div>
          <audio class="ml-audio-el" controls preload="metadata"></audio>
        </div>
      </div></div>
    </div>`;

// Модалка «Metadata» (перенос прод-модалки паблишинга): AI-метаданные с Copy у каждого
// поля, Title с вариантами (1/N) + стрелки, Hashtags, Timecodes, выбор канала (Publish to)
// с дропдауном/empty-state и мок «Sign in with Google». Флоу: loading → форма → success.
const copyBtn = (field) =>
  `<button class="ml-copy" type="button" data-copy="${field}">${IC.copy}<span data-copy-label>Copy</span></button>`;
const chanOpt = (initial, name) =>
  `<button class="ml-chan__opt" type="button" data-chan-opt data-name="${name}"><span class="ml-chan__ava">${initial}</span>${name}</button>`;

const publishModal = `
    <div class="ml-modal" id="mlModal-publish"><div class="ml-modal__overlay"></div>
      <div class="ml-modal__dialog ml-publish-dialog"><div class="ml-publish">
        <div class="ml-viewer__head ml-publish__head">
          <span class="ml-publish__title" data-pub-title>Metadata</span>
          <button class="ml-regen" type="button" data-pub-regen>${IC.rotate}Regenerate</button>
          <button class="ml-viewer__close" type="button" data-close aria-label="Close">${use("ml-close")}</button>
        </div>
        <div class="ml-publish__body">
          <div class="ml-publish__step" data-step="1">
            <div class="ml-publish__loading">
              <div class="ml-publish__spinner"></div>
              <p>Generating metadata…</p>
              <span class="sub">AI is analyzing your video to draft an SEO title, description, tags and timecodes.</span>
            </div>
          </div>
          <div class="ml-publish__step" data-step="2">
            <div class="ml-field">
              <div class="ml-field__head"><label>Title</label>
                <div class="ml-field__head-right"><span class="ml-field__count"><span data-title-idx>1</span> / <span data-title-total>3</span></span>${copyBtn("title")}</div>
              </div>
              <div class="ml-title-row">
                <button class="ml-title-nav" type="button" data-title-prev aria-label="Previous variant">${IC.arrowL}</button>
                <input type="text" data-title-input readonly value="How to Use SubSub Media Library — Full Walkthrough" />
                <button class="ml-title-nav" type="button" data-title-next aria-label="Next variant">${IC.arrowR}</button>
              </div>
            </div>
            <div class="ml-field">
              <div class="ml-field__head"><label>Description</label>${copyBtn("desc")}</div>
              <textarea data-copy-desc readonly>Walk through the SubSub Media Library: upload files of any type, preview them inline, share with your team, and publish straight to YouTube — no extra tools needed. Perfect for creators who want one place to manage every asset.</textarea>
            </div>
            <div class="ml-field">
              <div class="ml-field__head"><label>Tags</label>${copyBtn("tags")}</div>
              <div class="ml-field__tags" data-copy-tags><span class="ml-tag">subsub</span><span class="ml-tag">media library</span><span class="ml-tag">creator tools</span><span class="ml-tag">youtube</span><span class="ml-tag">tutorial</span><span class="ml-tag">content workflow</span><span class="ml-tag">video management</span></div>
            </div>
            <div class="ml-field">
              <div class="ml-field__head"><label>Hashtags</label>${copyBtn("hashtags")}</div>
              <div class="ml-field__tags ml-field__tags--hash" data-copy-hashtags><span class="ml-hashtag">#SubSub</span><span class="ml-hashtag">#MediaLibrary</span><span class="ml-hashtag">#CreatorTools</span><span class="ml-hashtag">#YouTubeTips</span><span class="ml-hashtag">#ContentWorkflow</span><span class="ml-hashtag">#VideoManagement</span></div>
            </div>
            <div class="ml-field">
              <div class="ml-field__head"><label>Timecodes</label>${copyBtn("timecodes")}</div>
              <div class="ml-timecodes" data-copy-timecodes>
                <div class="ml-tc"><span class="ml-tc__t">0:00</span><span>Intro</span></div>
                <div class="ml-tc"><span class="ml-tc__t">0:42</span><span>Uploading your first files</span></div>
                <div class="ml-tc"><span class="ml-tc__t">1:23</span><span>Previewing any file type</span></div>
                <div class="ml-tc"><span class="ml-tc__t">2:35</span><span>Sharing &amp; permissions</span></div>
                <div class="ml-tc"><span class="ml-tc__t">3:58</span><span>Publishing to YouTube</span></div>
              </div>
            </div>
            <div data-pub-channel>
            <hr class="ml-publish__sep" />
            <div class="ml-field">
              <label>Send to</label>
              <div class="ml-chan" data-chan-populated>
                <button class="ml-chan__toggle" type="button" data-chan-toggle>
                  <span class="ml-chan__ava" data-chan-ava>Z</span>
                  <span class="ml-chan__name" data-chan-current>Zems Racing</span>
                  <span class="ml-chan__chev">${IC.chevron}</span>
                </button>
                <div class="ml-chan__menu" data-chan-menu hidden>
                  ${chanOpt("Z", "Zems Racing")}
                  ${chanOpt("B", "Big Air Racing")}
                  ${chanOpt("G", "GenTech Studio")}
                  <div class="ml-chan__sep"></div>
                  <button class="ml-chan__connect" type="button" data-chan-connect>${IC.plus}Connect another channel</button>
                </div>
              </div>
              <div class="ml-chan-empty" data-chan-empty hidden>
                <p class="ml-chan-empty__msg">No connected channels yet</p>
                <button class="ml-pbtn ml-pbtn--primary" type="button" data-chan-connect>${IC.plus}Connect channel</button>
              </div>
            </div>
            </div>
          </div>
          <div class="ml-publish__step" data-step="3">
            <div class="ml-publish__success">
              <span class="ok">${IC.check}</span>
              <h3>Sent to YouTube Studio</h3>
              <p>Your video was sent to YouTube Studio as a draft. Finish and publish it from there.</p>
              <div class="row">
                <button class="ml-pbtn ml-pbtn--yt" type="button">${IC.youtube}Open in YouTube Studio</button>
              </div>
            </div>
          </div>
        </div>
        <!-- Закреплённый футер (вне скролла; виден только на шаге формы). CTA зависит от режима:
             send → «Send to YouTube Studio» (красная YT), metadata → «Save metadata» (primary). -->
        <div class="ml-publish__foot" data-pub-foot hidden>
          <button class="ml-pbtn ml-pbtn--ghost" type="button" data-close>Cancel</button>
          <button class="ml-pbtn ml-pbtn--yt ml-publish__cta" type="button" data-pub-send>${IC.youtube}Send to YouTube Studio</button>
          <button class="ml-pbtn ml-pbtn--primary" type="button" data-pub-save hidden>Save metadata</button>
        </div>
        <!-- Мок «Sign in with Google» (оверлей поверх модалки; без реальной авторизации) -->
        <div class="ml-gsignin" data-gsignin hidden>
          <div class="ml-gsignin__card">
            <span class="ml-gsignin__logo">${IC.google}</span>
            <h3>Connect a channel</h3>
            <p>Sign in with Google to connect a YouTube channel. Demo only — no real sign-in.</p>
            <button class="ml-gbtn" type="button" data-gsignin-go>${IC.google}<span>Sign in with Google</span></button>
            <button class="ml-pbtn ml-pbtn--ghost" type="button" data-gsignin-cancel>Cancel</button>
          </div>
        </div>
      </div></div>
    </div>`;

// Модалка шеринга — СТРУКТУРА по референсу («Share this file» + Copy link, поле поиска
// с выпадающими подсказками участников + «Already added»), но СТИЛИ светлые (как было).
// Без ролей (can view/can edit) — у строк доступа только Revoke (как раньше).
const GLOBE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3.4 9h17.2M3.4 15h17.2" stroke-linecap="round"/></svg>';
const PORTRAIT = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12.2a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2Z"/><path d="M4.8 19.2c0-3.05 3.23-4.9 7.2-4.9s7.2 1.85 7.2 4.9V20H4.8v-.8Z"/></svg>';

const shareUser = (color, name, email, owner) =>
  `<div class="ml-share__acc"${owner ? " data-owner" : ""}><span class="ml-share__avatar" style="background:${color}">${PORTRAIT}</span><div class="ml-share__acc-info"><span class="ml-share__acc-name">${name}</span><span class="ml-share__acc-email">${email}</span></div>${owner ? `<span class="ml-share__acc-role">owner</span>` : `<button class="ml-share__revoke" type="button" data-revoke>Revoke</button>`}</div>`;
const shareResult = (color, name, email) =>
  `<button class="ml-share__result" type="button" data-share-pick data-name="${name}" data-email="${email}" data-color="${color}"><span class="ml-share__result-ava" style="background:${color}">${PORTRAIT}</span><span class="ml-share__result-meta"><span class="nm">${name}</span><span class="em">${email}</span></span><span class="ml-share__result-added">Already added</span></button>`;

const shareModal = `
    <div class="ml-modal" id="mlModal-share"><div class="ml-modal__overlay"></div>
      <div class="ml-modal__dialog ml-share-dialog"><div class="ml-share">
        <div class="ml-share__head">
          <span class="ml-share__title">Share this file</span>
          <button class="ml-share__copy" type="button" data-share-copy data-link="https://app.subsub.io/media/shared/8f3a2c1e">${IC.link}<span data-copy-label>Copy link</span></button>
          <button class="ml-share__x" type="button" data-close aria-label="Close">${use("ml-close")}</button>
        </div>
        <div class="ml-share__body">
          <div class="ml-share__invite">
            <div class="ml-share__search">
              <input type="text" placeholder="Add people by name or email" data-share-search />
              <div class="ml-share__results" data-share-results hidden>
                ${shareResult("var(--color-avatar-5)", "MariiaS", "mariia.t@subsub.cc")}
                ${shareResult("var(--color-avatar-3)", "Mariia", "mariya.tonkoshkur@gmail.com")}
                ${shareResult("var(--color-avatar-1)", "Max Ivanov", "max@subsub.cc")}
                ${shareResult("var(--color-avatar-2)", "Marko Tkachenko", "marko@subsub.cc")}
                ${shareResult("var(--color-avatar-4)", "Anna Koval", "anna@subsub.cc")}
                ${shareResult("var(--color-avatar-6)", "Dmytro Bondar", "dmytro@subsub.cc")}
                <div class="ml-share__noresults" data-share-noresults hidden>No people found</div>
              </div>
            </div>
            <button class="ml-share__invitebtn" type="button" data-share-invite-btn disabled>Invite</button>
          </div>
          <div class="ml-share__list" data-share-list>
            <div class="ml-share__acc">
              <span class="ml-share__acc-ic ml-share__acc-ic--sys">${GLOBE}</span>
              <div class="ml-share__acc-info"><span class="ml-share__acc-name">Anyone with the link</span><span class="ml-share__acc-email">Can view</span></div>
              <button class="ml-share__revoke" type="button" data-revoke>Revoke</button>
            </div>
            ${shareUser("var(--color-avatar-3)", "Arthur Verbetskyi", "arthur@subsub.cc", false)}
            ${shareUser("var(--color-avatar-5)", "Mariia", "mariya.tonkoshkur@gmail.com", true)}
            ${shareUser("var(--color-avatar-1)", "Oleg Kravets", "oleg@subsub.cc", false)}
            ${shareUser("var(--color-avatar-5)", "Vlad", "vlad@subsub.cc", false)}
          </div>
        </div>
      </div></div>
    </div>`;

// Маленькое подтверждение отзыва доступа (поверх модалки шеринга).
const revokeConfirm = `
    <div class="ml-confirm-modal" id="mlRevokeConfirm">
      <div class="ml-confirm-modal__overlay" data-revoke-cancel></div>
      <div class="ml-confirm">
        <div class="ml-confirm__head">
          <span class="ml-confirm__title">Remove <span data-revoke-name></span>?</span>
          <button class="ml-confirm__x" type="button" data-revoke-cancel aria-label="Close">${use("ml-close")}</button>
        </div>
        <p class="ml-confirm__text">They may not be able to access this file anymore.</p>
        <div class="ml-confirm__foot">
          <button class="ml-pbtn ml-pbtn--ghost" type="button" data-revoke-cancel>Cancel</button>
          <button class="ml-pbtn ml-pbtn--red" type="button" data-revoke-confirm>Remove</button>
        </div>
      </div>
    </div>`;

// Модалка «Transcribe» — простой мок: выбор языка транскрипции + «Start transcription».
// Без реальной логики: по «Start» закрывается и запускает мок-процесс (бейдж + попап), как Convert.
// Язык исходной транскрипции (Auto-detect по умолчанию — первым) и языки перевода (без Auto-detect).
// Единый список языков транскрипта. Источник модель определяет сама — пользователь выбирает
// только целевой(ые) язык(и) готового транскрипта (при необходимости модель переводит).
const LANGS = ["English", "Ukrainian", "Spanish", "German", "French", "Portuguese", "Italian", "Polish", "Japanese"];
const transcribeModal = `
    <div class="ml-modal" id="mlModal-transcribe"><div class="ml-modal__overlay"></div>
      <div class="ml-modal__dialog ml-transcribe-dialog"><div class="ml-transcribe">
        <div class="ml-viewer__head ml-transcribe__head">
          <span class="ml-viewer__badge ml-viewer__badge--transcript"><svg><use href="#ml-transcript"></use></svg></span>
          <span class="ml-transcribe__title">Transcribe file</span>
          <button class="ml-viewer__close" type="button" data-close aria-label="Close">${use("ml-close")}</button>
        </div>
        <div class="ml-transcribe__body">
          <p class="ml-transcribe__file" data-transcribe-file>video.mp4</p>
          <label class="ml-transcribe__label">Transcription language</label>
          <div class="ml-multi" data-tr-multi>
            <button class="ml-multi__toggle" type="button" data-tr-toggle>
              <span class="ml-multi__value"><span class="ml-multi__placeholder" data-tr-placeholder>Select language(s)</span><span class="ml-multi__chips" data-tr-chips></span></span>
              <span class="ml-multi__chev">${IC.chevron}</span>
            </button>
            <div class="ml-multi__menu" data-tr-menu hidden>
              <div class="ml-multi__search">${use("ml-search")}<input type="text" placeholder="Search languages" data-tr-search /></div>
              <div class="ml-multi__opts" data-tr-opts>
                ${LANGS.map((l) => `<label class="ml-multi__opt"><input type="checkbox" data-tr-lang="${l}" /><span>${l}</span></label>`).join("")}
                <div class="ml-multi__noresults" data-tr-noresults hidden>No languages found</div>
              </div>
            </div>
          </div>
          <p class="ml-transcribe__hint" data-tr-caption>Pick the language(s) you want the transcript in — the model auto-detects the spoken language and translates as needed.</p>

          <p class="ml-transcribe__hint">Each language is saved as a separate transcript in a folder named after your video, inside <strong>Transcriptions</strong>.</p>
        </div>
        <div class="ml-transcribe__foot">
          <button class="ml-pbtn ml-pbtn--ghost" type="button" data-close>Cancel</button>
          <button class="ml-pbtn ml-pbtn--primary" type="button" data-transcribe-start>Start transcription</button>
        </div>
      </div></div>
    </div>`;

// Модалка превью транскрипта (.srt) — единый светлый паттерн. В action-bar: Copy (реальное
// копирование всего текста в буфер) и Download .srt (реальная генерация .srt-файла).
const TRANSCRIPT_LINES = [
  ["00:00", "Welcome back to the channel — today we're diving into the SubSub Media Library."],
  ["00:12", "First, let's upload a few files. You can drag and drop anything right here."],
  ["00:28", "Notice how each file type gets its own preview — video, audio, PDFs, even code."],
  ["00:47", "To share a file, just hit the three-dot menu and pick Share."],
  ["01:05", "You can invite teammates by email or grab a public link in one click."],
  ["01:23", "Need captions? Use Transcribe to turn any video into a timecoded transcript."],
  ["01:44", "The transcript lands in your Transcriptions folder as a downloadable .srt file."],
  ["02:03", "And that's it — one place to manage, preview, and publish every asset."],
  ["02:19", "Thanks for watching. Don't forget to like and subscribe!"],
];
const transcriptModal = `
    <div class="ml-modal" id="mlModal-transcript"><div class="ml-modal__overlay"></div>
      <div class="ml-modal__dialog ml-transcript-dialog"><div class="ml-viewer">
        <!-- шапка: только имя и переключение языка -->
        <div class="ml-viewer__head">
          <span class="ml-viewer__badge ml-viewer__badge--transcript"><svg><use href="#ml-transcript"></use></svg></span>
          <span class="ml-viewer__title" data-title></span>
          <div class="ml-langsel" data-langsel>
            <button class="ml-langsel__trig" type="button" data-langsel-trig aria-haspopup="listbox" aria-expanded="false">
              <span data-langsel-val>Ukrainian</span><span class="ml-langsel__chev">${IC.chevron}</span>
            </button>
            <div class="ml-langsel__menu" data-langsel-menu hidden role="listbox"></div>
          </div>
          <button class="ml-viewer__close" type="button" data-close aria-label="Close">${use("ml-close")}</button>
        </div>
        <div class="ml-viewer__body ml-transcript__body">
          <div class="ml-transcript" data-transcript-text>
            ${TRANSCRIPT_LINES.map(([t, s]) => `<div class="ml-tl"><span class="ml-tl__t">${t}</span><span class="ml-tl__s">${esc(s)}</span></div>`).join("\n            ")}
          </div>
        </div>
        <!-- футер: действия. Primary — «Save as…», остальные secondary -->
        <div class="ml-viewer__foot">
          <button class="ml-vbtn" type="button" data-transcript-copy>${IC.copy}<span data-copy-label>Copy</span></button>
          <button class="ml-vbtn" type="button" data-transcript-regen>${IC.rotate}<span>Regenerate</span></button>
          <div class="ml-dlas ml-dlas--up" data-dlas>
            <button class="ml-vbtn ml-vbtn--primary ml-dlas__toggle" type="button" data-dlas-toggle>${use("ml-download")}<span>Save as…</span><span class="ml-dlas__chev">${IC.chevron}</span></button>
            <div class="ml-dlas__menu" data-dlas-menu hidden>
              <button class="ml-dlas__opt" type="button" data-dl="srt">SRT<span class="ml-dlas__ext">.srt</span></button>
              <button class="ml-dlas__opt" type="button" data-dl="pdf">PDF<span class="ml-dlas__ext">.pdf</span></button>
              <button class="ml-dlas__opt" type="button" data-dl="txt">TXT<span class="ml-dlas__ext">.txt</span></button>
            </div>
          </div>
        </div>
      </div></div>
    </div>`;

// Превью .txt-файла метаданных (результат «Save metadata» / отправки в Studio). Единый светлый
// паттерн; тело — простой читаемый текст (заполняется в media.js из сохранённого содержимого).
const metatxtModal = `
    <div class="ml-modal" id="mlModal-metatxt"><div class="ml-modal__overlay"></div>
      <div class="ml-modal__dialog ml-transcript-dialog"><div class="ml-viewer">
        <div class="ml-viewer__head">
          <span class="ml-viewer__badge ml-viewer__badge--document"><svg><use href="#ml-file"></use></svg></span>
          <span class="ml-viewer__title" data-title></span>
          <div class="ml-viewer__actions">
            <button class="ml-vbtn" type="button" data-meta-copy>${IC.copy}<span data-copy-label>Copy</span></button>
            <button class="ml-vbtn" type="button" data-meta-download>${use("ml-download")}Download .txt</button>
            <button class="ml-viewer__close" type="button" data-close aria-label="Close">${use("ml-close")}</button>
          </div>
        </div>
        <div class="ml-viewer__body ml-metatxt__body">
          <pre class="ml-metatxt" data-meta-text></pre>
        </div>
      </div></div>
    </div>`;

// Модалка выбора «Max words per segment» перед экспортом SRT (открывается поверх модалки
// результата по «Save as → SRT»). Дефолт 8; «Export SRT» форматирует готовый транскрипт.
const srtWordsModal = `
    <div class="ml-modal" id="mlModal-srtwords"><div class="ml-modal__overlay"></div>
      <div class="ml-modal__dialog ml-transcribe-dialog"><div class="ml-transcribe">
        <div class="ml-viewer__head ml-transcribe__head">
          <span class="ml-viewer__badge ml-viewer__badge--transcript"><svg><use href="#ml-transcript"></use></svg></span>
          <span class="ml-transcribe__title">Save as SRT</span>
          <button class="ml-viewer__close" type="button" data-srtwords-close aria-label="Close">${use("ml-close")}</button>
        </div>
        <div class="ml-transcribe__body">
          <label class="ml-transcribe__label">Max words per segment</label>
          <div class="ml-dlas__stepper ml-srtwords__stepper">
            <button type="button" data-mw-dec aria-label="Decrease">−</button>
            <input type="number" data-mw value="8" min="1" max="30" />
            <button type="button" data-mw-inc aria-label="Increase">+</button>
          </div>
          <p class="ml-transcribe__hint">Each subtitle segment will contain at most this many words. Shorter segments = more, quicker captions.</p>
        </div>
        <div class="ml-transcribe__foot">
          <button class="ml-pbtn ml-pbtn--ghost" type="button" data-srtwords-close>Cancel</button>
          <button class="ml-pbtn ml-pbtn--primary" type="button" data-srtwords-export>Export SRT</button>
        </div>
      </div></div>
    </div>`;

// Модалка «Translate transcript» — открывается из превью транскрипта (action «Translate»)
// поверх него: мультиселект языков (тот же паттерн, что в транскрибации) → перевод как
// отдельные .srt рядом с оригиналом.
const translateModal = `
    <div class="ml-modal" id="mlModal-translate"><div class="ml-modal__overlay"></div>
      <div class="ml-modal__dialog ml-transcribe-dialog"><div class="ml-transcribe">
        <div class="ml-viewer__head ml-transcribe__head">
          <span class="ml-viewer__badge ml-viewer__badge--transcript"><svg><use href="#ml-transcript"></use></svg></span>
          <span class="ml-transcribe__title">Translate transcript</span>
          <button class="ml-viewer__close" type="button" data-translate-close aria-label="Close">${use("ml-close")}</button>
        </div>
        <div class="ml-transcribe__body">
          <p class="ml-transcribe__file" data-translate-file></p>
          <label class="ml-transcribe__label">Translate into</label>
          <div class="ml-multi" data-tl-multi>
            <button class="ml-multi__toggle" type="button" data-tl-toggle>
              <span class="ml-multi__value"><span class="ml-multi__placeholder" data-tl-placeholder>Select language(s)</span><span class="ml-multi__chips" data-tl-chips></span></span>
              <span class="ml-multi__chev">${IC.chevron}</span>
            </button>
            <div class="ml-multi__menu" data-tl-menu hidden>
              <div class="ml-multi__search">${use("ml-search")}<input type="text" placeholder="Search languages" data-tl-search /></div>
              <div class="ml-multi__opts" data-tl-opts>
                ${LANGS.map((l) => `<label class="ml-multi__opt"><input type="checkbox" data-tl-lang="${l}" /><span>${l}</span></label>`).join("")}
                <div class="ml-multi__noresults" data-tl-noresults hidden>No languages found</div>
              </div>
            </div>
          </div>
          <p class="ml-transcribe__hint">Each language is saved as a separate transcript next to the original, inside <strong>Transcriptions</strong>.</p>
        </div>
        <div class="ml-transcribe__foot">
          <button class="ml-pbtn ml-pbtn--ghost" type="button" data-translate-close>Cancel</button>
          <button class="ml-pbtn ml-pbtn--primary" type="button" data-translate-start disabled>Translate</button>
        </div>
      </div></div>
    </div>`;

const modals =
  videoModal +
  viewerModal("pdf", pdfBody) +
  viewerModal("image", imageBody) +
  audioModal +
  viewerModal("document", docxBody) +
  viewerModal("spreadsheet", sheetBody) +
  viewerModal("code", codeBody) +
  publishModal +
  shareModal +
  revokeConfirm +
  transcribeModal +
  transcriptModal +
  metatxtModal +
  srtWordsModal +
  translateModal;

const mainInner = `
    <section class="ml-page">
      <header class="ml-header">
        <h1 class="ml-title">Media Library</h1>
        <div class="ml-header__actions">
          <button class="ml-btn ml-btn--primary" type="button">${use("ml-upload")}<span>Upload</span></button>
          <button class="ml-btn ml-btn--secondary" type="button">${use("ml-folder")}<span>Create folder</span></button>
        </div>
      </header>

      <div class="ml-toolbar">
        <div class="ml-search">${use("ml-search")}<input type="text" placeholder="Search..." /></div>
        <!-- Фильтр по типу файла: дропдаун с чекбоксами (чисто фронтовая фильтрация строк) -->
        <div class="ml-filter" data-filter>
          <button class="ml-filter__toggle" type="button" data-filter-toggle>
            <span class="ml-filter__ico">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h18M6 12h12M10 19h4"/></svg>
              <span class="ml-filter__dot" data-filter-dot hidden></span>
            </span>
            <span>Type</span>
            <svg class="ml-filter__chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          <div class="ml-filter__menu" data-filter-menu hidden>
            <label class="ml-filter__opt"><input type="checkbox" data-filter-kind="folder" /><span>Folders</span></label>
            <label class="ml-filter__opt"><input type="checkbox" data-filter-kind="video" /><span>Video</span></label>
            <label class="ml-filter__opt"><input type="checkbox" data-filter-kind="image" /><span>Image</span></label>
            <label class="ml-filter__opt"><input type="checkbox" data-filter-kind="audio" /><span>Audio</span></label>
            <label class="ml-filter__opt"><input type="checkbox" data-filter-kind="document" /><span>Document</span></label>
            <label class="ml-filter__opt"><input type="checkbox" data-filter-kind="spreadsheet" /><span>Spreadsheet</span></label>
            <label class="ml-filter__opt"><input type="checkbox" data-filter-kind="pdf" /><span>PDF</span></label>
            <label class="ml-filter__opt"><input type="checkbox" data-filter-kind="code" /><span>Code</span></label>
            <label class="ml-filter__opt"><input type="checkbox" data-filter-kind="other" /><span>Other</span></label>
            <div class="ml-filter__sep"></div>
            <button class="ml-filter__clear" type="button" data-filter-clear>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
              Reset filter
            </button>
          </div>
        </div>
        <div class="ml-tabs">
          <button class="ml-tab is-active" type="button">All media</button>
          <button class="ml-tab" type="button">My media</button>
          <button class="ml-tab" type="button">Shared media</button>
        </div>
      </div>

      <!-- Хлебные крошки — строятся динамически в js/media.js (renderCrumbs), поддерживают вложенность -->
      <nav class="ml-crumbs" data-crumbs hidden></nav>

      <div class="ml-subrow">
        <div class="ml-subrow__head">
          <span class="ml-subrow__label">All media</span>
          <span class="ml-subrow__count" data-count>5 folders · 353 files</span>
        </div>
      </div>

      <div class="ml-table-wrap">
        <table class="ml-table">
          <thead>
            <tr>
              <th class="c-check"><input class="ml-check" type="checkbox" aria-label="Select all" /></th>
              <th class="c-drag"></th>
              <th class="c-name c-name-h">Name</th>
              <th class="c-created"><span class="ml-th-sort">Created ${sortIco}</span></th>
              <th class="c-storage"><span class="ml-th-sort">Storage ${sortIco}</span></th>
              <th class="c-author">Author</th>
              <th class="c-shared">Shared with</th>
              <th class="c-actions"></th>
            </tr>
          </thead>
          <tbody data-level="root">
            ${ROWS.map(row).join("\n            ")}
            ${row({ kind:"folder", name:"Transcriptions", folderId:"transcriptions", meta:["0 files","0 folders"], created:"17.07.2026", size:"0 B", hidden:true, attr:"data-transcriptions-folder" })}
            ${row({ kind:"folder", name:"Metadata", folderId:"metadata", meta:["1 file","0 folders"], created:"17.07.2026", size:"2 KB", attr:"data-metadata-folder" })}
          </tbody>
          <tbody data-level="folder" data-folder="analytics" hidden>
            ${ROWS_ANALYTICS.map(row).join("\n            ")}
          </tbody>
          <tbody data-level="folder" data-folder="music" hidden>
            ${ROWS_MUSIC.map(row).join("\n            ")}
          </tbody>
          <!-- Содержимое папки Transcriptions — .srt-строки добавляются динамически при завершении транскрибации -->
          <tbody data-level="folder" data-folder="transcriptions" hidden></tbody>
          <!-- Содержимое папки Metadata — один семпл-.txt по умолчанию (виден сразу); новые добавляются/перезаписываются при «Save metadata» / отправке в Studio -->
          <tbody data-level="folder" data-folder="metadata" hidden>
            ${row({ kind:"document", name:"video_2026-06-30_intro-teaser - metadata.txt", created:"30.06.2026", size:"2 KB", attr:"data-metatxt" })}
          </tbody>
        </table>
      </div>

      <!-- инфинайт-скролл: лоадер во время подгрузки + сентинел (наблюдатель) -->
      <div class="ml-loadmore" data-loadmore hidden><span class="ml-loadmore__spinner"></span></div>
      <div class="ml-infinite-sentinel" data-infinite-sentinel aria-hidden="true"></div>
    </section>
  `;
// Меню действий + модалки — выносятся на уровень body (после </main>), чтобы position:fixed
// центрировался относительно всего окна, а не области .main (у которой margin-left под сайдбар).
const overlays = popover + "\n" + modals;

// ---- transforms on the home.html shell ------------------------------------
html = html.replace("<title>Home — SubSub</title>", "<title>Media Library — SubSub</title>");
// Home no longer active (we're not on /home)
html = html.replace('class="sidebar-item sidebar-item--home is-active"', 'class="sidebar-item sidebar-item--home"');
// Media Library space pre-selected
html = html.replace('id="space-mediaLibrary" value="mediaLibrary" />', 'id="space-mediaLibrary" value="mediaLibrary" checked />');
// Open state + active space on <body>
html = html.replace("<body>", '<body class="is-open" data-space="mediaLibrary">');
// Inject media-library icon sprite (once) right after the opening body tag
html = html.replace('<body class="is-open" data-space="mediaLibrary">',
  '<body class="is-open" data-space="mediaLibrary">\n  <svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">\n' + mlSprite + '\n  </svg>');
// Submenu title text (JS sets it on click; hardcode for initial load)
html = html.replace('<p class="submenu__title" id="submenuTitle"></p>', '<p class="submenu__title" id="submenuTitle">Media Library</p>');
// Unhide the Media Library submenu block on load
html = html.replace('<div class="submenu__menu" data-space="mediaLibrary" hidden>', '<div class="submenu__menu" data-space="mediaLibrary">');
// Mark "Files" as the current page inside the Media Library submenu block
// (unique across the doc: menu item with ic-folder icon + text "Files")
html = html.replace('<a class="m-item" href="media-library-files.html"><span class="m-ico"><svg><use href="#ic-folder"></use></svg></span>Files</a>',
  '<a class="m-item is-current" href="media-library-files.html"><span class="m-ico"><svg><use href="#ic-folder"></use></svg></span>Files</a>');

// Include media.js (interactivity: actions popover + preview modals) after nav.js
html = html.replace('<script src="js/nav.js"></script>',
  '<script src="js/nav.js"></script>\n  <script src="js/media.js"></script>\n  <script src="js/player.js"></script>');

// Replace <main> inner content (только страница)
const ms = html.indexOf('<main class="main">');
const me = html.indexOf("</main>", ms);
html = html.slice(0, ms + '<main class="main">'.length) + mainInner + "\n  " + html.slice(me);
// Модалки/меню — сразу после </main>, как прямые потомки body (портал-паттерн)
const meEnd = html.indexOf("</main>") + "</main>".length;
html = html.slice(0, meEnd) + "\n" + overlays + "\n" + html.slice(meEnd);

fs.writeFileSync(DIR + "media-library-files.html", html);
console.log("written; rows:", ROWS.length, "ml-symbols:", (html.match(/id="ml-/g)||[]).length, "isCurrent:", html.includes('m-item is-current'));

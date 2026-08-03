const fs = require("fs");
const dir = "E:/Dev SubSub/subsub_platform_front/layers/core/components/base/icons/";

const MAP = {
  folder: "OutlineFolderIcon",
  video: "OutlineIconVideo",
  image: "OutlineIconImage",
  audio: "OutlineIconAudio",
  pdf: "OutlineIconPdf",
  spreadsheet: "OutlineIconSpreadsheet",
  code: "OutlineIconCode",
  file: "OutlineIconFile",
  transcript: "OutlineIconTranscript",
  play: "FilledIconPlay",
  eyeslash: "FilledIconEyeSlash",
  upload: "OutlineIconUpload",
  more: "OutlineIconMore",
  drag: "DragNDropIcon",
  search: "OutlineIconSearch",
  arrowdown: "BoldOutlineIconShortArrowDown",
  arrowleft: "BoldOutlineIconShortArrowLeft",
  // actions menu (⋮)
  download: "OutlineIconDownload",
  copy: "OutlineIconCopy",
  movefolder: "OutlineIconMoveToFolder",
  edit: "OutlineIconEdit",
  refresh: "OutlineIconRefresh",
  share: "OutlineIconShare",
  delete: "OutlineIconDelete",
  close: "BoldOutlineIconClose",
};

let out = "";
const missing = [];
for (const [id, comp] of Object.entries(MAP)) {
  let src;
  try { src = fs.readFileSync(dir + comp + ".vue", "utf8"); }
  catch (e) { missing.push(comp + "(no file)"); continue; }
  const m = src.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
  const vbm = src.match(/viewBox="([^"]+)"/i);
  if (!m) { missing.push(comp + "(no svg)"); continue; }
  const vb = vbm ? vbm[1] : "0 0 24 24";
  let inner = m[1].replace(/\s+/g, " ").replace(/> </g, "><").trim();
  // Делаем иконки themeable: жёсткий чёрный (#000/#19191A) → currentColor, чтобы можно
  // было красить их через CSS color (чёрные в строках таблицы, акцентные в бейджах модалок).
  inner = inner.replace(/="black"/g, '="currentColor"').replace(/="#19191A"/gi, '="currentColor"');
  // fill="none" по умолчанию (как на корневом <svg>): outline-иконки не зальются.
  out += `<symbol id="ml-${id}" viewBox="${vb}" fill="none">${inner}</symbol>\n`;
}
fs.writeFileSync("E:/Dev SubSub/subsub_front_prototype_31.07.26/ml-sprite.html", out);
console.log((out.match(/<symbol/g)||[]).length + " symbols; missing: " + (missing.join(",") || "none"));

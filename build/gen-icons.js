const fs = require("fs");
const dir = "E:/Dev SubSub/subsub_platform_front/layers/core/components/base/icons/";

// symbol id -> icon component file
const MAP = {
  "rocket": "FilledIconRocket",
  "chart": "FilledIconChart",
  "chartpie": "FilledIconChartPie",
  "document": "FilledIconDocument",
  "collections": "FilledIconCollections",
  "publicpage": "FilledIconPublicPage",
  "user": "FilledIconUser",
  "donate": "FilledIconDonate",
  "membership": "FilledIconMembership",
  "subs": "FilledIconSubs",
  "widgets": "FilledIconWidgets",
  "content": "FilledIconContent",
  "wallet": "FilledIconWallet",
  "moneyreceive": "FilledIconMoneyReceive",
  "stream": "OutlineIconStream",
  "folder": "FilledIconFolder",
  "tfaoff": "FilledIconTFAOff",
  "youtube": "FilledIconYoutube",
  "fileexport": "OutlineIconFileExport",
  "created": "OutlineIconCreated",
  "listbulleted": "OutlineIconListBulleted",
  "repair": "BoldOutlineIconRepair",
  "transfer": "OutlineIconTransfer",
  "dollar": "FilledIconDollar",
  "mail": "OutlineIconMail",
  "alert": "OutlineIconAlert",
  "channelpage": "BoldOutlineIconChannelPage",
  "tax": "OutlineIconTax",
  "commentoss": "OutlineIconCommentoss",
  "notifications": "OutlineIconNotifications",
  "book": "BoldIconBook",
  "pencil": "OutlineIconPencil",
};

let out = "";
for (const [id, comp] of Object.entries(MAP)) {
  let src;
  try { src = fs.readFileSync(dir + comp + ".vue", "utf8"); }
  catch (e) { out += `<!-- MISSING ${comp} -->\n`; continue; }
  const m = src.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
  const vbm = src.match(/viewBox="([^"]+)"/i);
  if (!m) { out += `<!-- NOSVG ${comp} -->\n`; continue; }
  const vb = vbm ? vbm[1] : "0 0 24 24";
  // inner content, collapse whitespace between tags
  let inner = m[1].replace(/\s+/g, " ").replace(/> </g, "><").trim();
  out += `<symbol id="ic-${id}" viewBox="${vb}">${inner}</symbol>\n`;
}
fs.writeFileSync("E:/Dev SubSub/subsub_front_prototype_31.07.26/icons-sprite.html", out);
const missing = Object.keys(MAP).filter(id => !out.includes('id="ic-'+id+'"'));
console.log(out.length + " chars, symbols: " + (out.match(/<symbol/g)||[]).length + ", missing: " + (missing.join(",")||"none"));

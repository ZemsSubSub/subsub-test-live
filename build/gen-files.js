const fs = require("fs");
const zlib = require("zlib");
const OUT = "E:/Dev SubSub/subsub_front_prototype_31.07.26/files/";
fs.mkdirSync(OUT, { recursive: true });

// ---- CRC32 ----------------------------------------------------------------
const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

// ---- PNG (diagonal gradient) ---------------------------------------------
function makePNG(w, h) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  let o = 0;
  for (let y = 0; y < h; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < w; x++) {
      const u = x / w, v = y / h;
      raw[o++] = Math.round(246 - u * 90 + v * 10);   // r
      raw[o++] = Math.round(150 + u * 20 - v * 40);   // g
      raw[o++] = Math.round(133 + u * 90 + v * 60);   // b
      raw[o++] = 255;
    }
  }
  const idat = zlib.deflateSync(raw);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type, "ascii");
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
    return Buffer.concat([len, t, data, crc]);
  };
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}
fs.writeFileSync(OUT + "cover-photo.png", makePNG(480, 320));

// ---- WAV (soft 440Hz tone, tremolo) --------------------------------------
function makeWAV() {
  const sr = 8000, secs = 4, n = sr * secs;
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const s = Math.sin(2 * Math.PI * 440 * t) * 0.3 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 1.5 * t));
    data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(s * 32767))), i * 2);
  }
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVE", 8);
  h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}
fs.writeFileSync(OUT + "podcast-episode-04.wav", makeWAV());

// ---- PDF (multi-page, Helvetica text) ------------------------------------
function makePDF() {
  const W = 612, H = 792;
  const pages = [
    { title: "Yevhenii Z.", sub: "Senior UI Designer" },
    { title: "Selected work", sub: "Media Library redesign, 2026" },
    { title: "Contact", sub: "hello@example.com" },
  ];
  const objects = [null];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  let n = 4; const kids = [];
  for (const p of pages) {
    const cs = `BT /F1 42 Tf 72 ${H - 150} Td (${p.title}) Tj ET\nBT /F1 18 Tf 72 ${H - 190} Td (${p.sub}) Tj ET`;
    const contentNo = n++;
    objects[contentNo] = `<< /Length ${Buffer.byteLength(cs)} >>\nstream\n${cs}\nendstream`;
    const pageNo = n++;
    objects[pageNo] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentNo} 0 R >>`;
    kids.push(`${pageNo} 0 R`);
  }
  objects[2] = `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pages.length} >>`;
  let pdf = "%PDF-1.4\n"; const off = [];
  for (let i = 1; i < n; i++) { off[i] = Buffer.byteLength(pdf, "binary"); pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`; }
  const xref = Buffer.byteLength(pdf, "binary");
  pdf += `xref\n0 ${n}\n0000000000 65535 f \n`;
  for (let i = 1; i < n; i++) pdf += String(off[i]).padStart(10, "0") + " 00000 n \n";
  pdf += `trailer\n<< /Size ${n} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "binary");
}
fs.writeFileSync(OUT + "portfolio.pdf", makePDF());

// ---- code sample ----------------------------------------------------------
fs.writeFileSync(OUT + "upload-script.js",
`// upload-script.js — sample from SubSub Media Library prototype
import fs from "fs";
import { api } from "./client";

async function upload(file) {
  const data = fs.readFileSync(file);
  const res = await api.put("/media", data);
  return res.id;
}

upload("cover-photo.png").then((id) => console.log("uploaded", id));
`);

// ---- ZIP (store method) → zip / docx / xlsx ------------------------------
function zip(entries) {
  const locals = [], central = []; let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, "utf8");
    const data = Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data, "utf8");
    const crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(name.length, 26);
    const local = Buffer.concat([lh, name, data]); locals.push(local);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6);
    cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(data.length, 20); cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(name.length, 28); cd.writeUInt32LE(offset, 42);
    central.push(Buffer.concat([cd, name])); offset += local.length;
  }
  const cdBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12); eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cdBuf, eocd]);
}

fs.writeFileSync(OUT + "project-archive.zip", zip([
  { name: "README.txt", data: "SubSub Media Library prototype — sample archive.\n" },
  { name: "notes.txt", data: "This ZIP is a placeholder 'other' file type.\n" },
]));

fs.writeFileSync(OUT + "contract-draft.docx", zip([
  { name: "[Content_Types].xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>` },
  { name: "_rels/.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>` },
  { name: "word/document.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Contract draft — SubSub Media Library prototype sample document.</w:t></w:r></w:p></w:body></w:document>` },
]));

fs.writeFileSync(OUT + "revenue-report.xlsx", zip([
  { name: "[Content_Types].xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>` },
  { name: "_rels/.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
  { name: "xl/workbook.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Revenue" sheetId="1" r:id="rId1"/></sheets></workbook>` },
  { name: "xl/_rels/workbook.xml.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>` },
  { name: "xl/worksheets/sheet1.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Month</t></is></c><c r="B1" t="inlineStr"><is><t>Revenue</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>Jan</t></is></c><c r="B2"><v>12000</v></c></row></sheetData></worksheet>` },
]));

// ---- video: reuse repo's blank.mp4 ---------------------------------------
fs.copyFileSync(
  "E:/Dev SubSub/subsub_platform_front/apps/app.subsub/public/static-resources/blank.mp4",
  OUT + "sample-video.mp4"
);

const list = fs.readdirSync(OUT).map((f) => f + " (" + fs.statSync(OUT + f).size + "b)");
console.log("created in files/:\n  " + list.join("\n  "));

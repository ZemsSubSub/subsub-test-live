const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = "E:/Dev SubSub/subsub_front_prototype_31.07.26";
const PORT = 8778;
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".zip": "application/zip",
};

http
  .createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split("?")[0]);
    if (urlPath === "/") urlPath = "/home.html";
    const filePath = path.join(ROOT, urlPath);
    fs.stat(filePath, (err, stat) => {
      if (err || !stat.isFile()) {
        res.writeHead(404);
        res.end("Not found: " + urlPath);
        return;
      }
      const type = TYPES[path.extname(filePath)] || "application/octet-stream";
      const total = stat.size;
      const range = req.headers.range;
      // Range-запросы (нужны браузеру для перемотки видео/аудио)
      if (range) {
        const m = /bytes=(\d*)-(\d*)/.exec(range);
        let start = m && m[1] ? parseInt(m[1], 10) : 0;
        let end = m && m[2] ? parseInt(m[2], 10) : total - 1;
        if (isNaN(start)) start = 0;
        if (isNaN(end) || end >= total) end = total - 1;
        if (start > end) { start = 0; end = total - 1; }
        res.writeHead(206, {
          "Content-Type": type,
          "Content-Length": end - start + 1,
          "Content-Range": "bytes " + start + "-" + end + "/" + total,
          "Accept-Ranges": "bytes",
          "Cache-Control": "no-cache",
        });
        if (req.method === "HEAD") { res.end(); return; }
        fs.createReadStream(filePath, { start, end }).pipe(res);
        return;
      }
      res.writeHead(200, {
        "Content-Type": type,
        "Content-Length": total,
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-cache",
      });
      if (req.method === "HEAD") { res.end(); return; }
      fs.createReadStream(filePath).pipe(res);
    });
  })
  .listen(PORT, () => console.log("serving on " + PORT));

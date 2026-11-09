// upload-script.js — sample from SubSub Media Library prototype
import fs from "fs";
import { api } from "./client";

async function upload(file) {
  const data = fs.readFileSync(file);
  const res = await api.put("/media", data);
  return res.id;
}

upload("cover-photo.png").then((id) => console.log("uploaded", id));

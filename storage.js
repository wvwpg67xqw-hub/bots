import fs from "fs";

export function loadJSON(file) {
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

export function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

import fs from "fs";

export function ensureDirectory(path: string): void {
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path, { recursive: true });
  }
}

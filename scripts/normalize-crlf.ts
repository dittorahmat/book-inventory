import { readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";

const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".json", ".md", ".css", ".html", ".sql", ".toml"]);
const IGNORE_DIRS = new Set(["node_modules", ".git", "dist", ".cache", "data"]);

let totalFixed = 0;

function walk(dir: string) {
  for (const entry of readdirSync(dir)) {
    if (IGNORE_DIRS.has(entry)) continue;
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath);
    } else {
      const ext = fullPath.slice(fullPath.lastIndexOf("."));
      if (EXTENSIONS.has(ext)) {
        const content = readFileSync(fullPath, "utf8");
        if (content.includes("\r\n")) {
          writeFileSync(fullPath, content.replace(/\r\n/g, "\n"), "utf8");
          totalFixed++;
        }
      }
    }
  }
}

walk(".");
console.log(`CRLF normalization complete: ${totalFixed} files converted to LF.`);

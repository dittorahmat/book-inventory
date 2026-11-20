// Gate upload berkas klien (AGENTS.md Mandat Anti-Kambuh §0.89):
// Memindai seluruh pemanggilan readAsDataURL di src/components dan src/views
// untuk memastikan terdapat validasi batas ukuran berkas (size guard <= 5MB)
// sebelum pembacaan FileReader dimulai guna mencegah OOM dan tab crash di browser.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const TARGET_DIRS = ["src/components", "src/views"];

function getSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...getSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
      files.push(full.replace(/\\/g, "/"));
    }
  }
  return files;
}

const allFiles = TARGET_DIRS.flatMap(getSourceFiles);
const violations: Array<{ file: string; line: number }> = [];

for (const file of allFiles) {
  const content = readFileSync(file, "utf8");
  if (!content.includes("readAsDataURL")) continue;

  const lines = content.split(/\r?\n/);
  lines.forEach((lineText, idx) => {
    if (lineText.includes("readAsDataURL")) {
      // Ambil 30 baris sebelumnya untuk memeriksa apakah ada pengecekan file.size / .size
      const startIdx = Math.max(0, idx - 30);
      const surrounding = lines.slice(startIdx, idx).join("\n");
      const hasSizeCheck = /\.size\b/.test(surrounding);

      if (!hasSizeCheck) {
        violations.push({ file, line: idx + 1 });
      }
    }
  });
}

if (violations.length > 0) {
  console.error("Client-file-guard gate FAILED — ditemukan pemanggilan readAsDataURL tanpa pengecekan .size berkas:");
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line} → belum memvalidasi batas ukuran berkas (maksimal 5MB)`);
  }
  console.error("Tambahkan pengecekan file.size <= 5MB sebelum memanggil readAsDataURL (§0.89).");
  process.exit(1);
}

console.log(`Client-file-guard gate OK: seluruh ${violations.length === 0 ? "pemanggilan readAsDataURL" : ""} di komponen & view memiliki guard batas ukuran file.`);

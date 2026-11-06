// Memeriksa bahwa tombol submit form di antarmuka portal dan modal staf
// tidak dinonaktifkan secara pasif karena input belum lengkap (disabled={...}),
// melainkan tetap aktif dan memvalidasi via feedback loop visual saat diklik,
// sesuai Mandat Anti-Kambuh docs/rules/portal-client.md §0.63.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir: string, fileList: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, fileList);
    } else if (/\.(tsx)$/.test(entry) && !entry.endsWith(".test.tsx")) {
      fileList.push(full);
    }
  }
  return fileList;
}

const targetDirs = [
  join(process.cwd(), "src", "components", "portal"),
  join(process.cwd(), "src", "components", "students"),
  join(process.cwd(), "src", "components", "orders"),
];

const files = targetDirs.flatMap((dir) => walk(dir));
const violations: Array<{ file: string; line: number; text: string }> = [];

// Pola terlarang: tombol submit yang didisable karena kondisi kelengkapan form
// Pengecualian sah: state asinkron murni (isSubmitting, submitting, saving, isBusy, loading, dll)
// atau kontrak otomasi serah terima (!isCodeMatched pada OrderHandoverModal)
const FORBIDDEN_PATTERNS = [
  /disabled=\{[^}]*(!canContinue|isMissingProof|!allocationCheck\.ok)[^}]*\}/,
  /disabled=\{[^}]*(!searchSchoolId|!schoolId|query\.trim\(\)\.length)[^}]*\}/,
];

for (const file of files) {
  const content = readFileSync(file, "utf8");
  const lines = content.split(/\r?\n/);
  lines.forEach((lineText, idx) => {
    // Pengecualian khusus kontrak otomasi demo §0.43 pada OrderHandoverModal
    if (file.endsWith("OrderHandoverModal.tsx") && lineText.includes("isCodeMatched")) return;

    for (const pat of FORBIDDEN_PATTERNS) {
      if (pat.test(lineText)) {
        violations.push({
          file: file.replace(/\\/g, "/"),
          line: idx + 1,
          text: lineText.trim(),
        });
      }
    }
  });
}

if (violations.length > 0) {
  console.error("Form-button-feedback gate GAGAL: Tombol submit dinonaktifkan secara pasif karena input kurang:");
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line} → ${v.text}`);
  }
  console.error("\nSesuai §0.63: Hapus disabled pasif. Tombol submit wajib tetap responsif dan menampilkan pesan kesalahan spesifik saat diklik.");
  process.exit(1);
} else {
  console.log("Form-button-feedback gate OK: seluruh tombol submit form responsif dan menerapkan interactive validation feedback loop.");
}

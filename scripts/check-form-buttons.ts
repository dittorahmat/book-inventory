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
  join(process.cwd(), "src", "components", "uniform"),
  join(process.cwd(), "src", "components", "packages"),
  join(process.cwd(), "src", "components", "books"),
  join(process.cwd(), "src", "components", "procurement"),
  join(process.cwd(), "src", "components", "inventory"),
  join(process.cwd(), "src", "components", "internal-orders"),
  join(process.cwd(), "src", "components", "settings"),
];

const files = targetDirs.flatMap((dir) => walk(dir));
const violations: Array<{ file: string; line: number; text: string }> = [];
const feedbackViolations: Array<{ file: string; detail: string }> = [];

// Pola terlarang: tombol submit yang didisable karena kondisi kelengkapan form
// Pengecualian sah: state asinkron murni (isSubmitting, submitting, saving, isBusy, loading, busy, dll)
// atau kontrak otomasi serah terima (!isCodeMatched pada OrderHandoverModal)
const FORBIDDEN_PATTERNS = [
  /disabled=\{[^}]*(!canContinue|isMissingProof|!allocationCheck\.ok)[^}]*\}/,
  /disabled=\{[^}]*(!searchSchoolId|!schoolId|query\.trim\(\)\.length)[^}]*\}/,
  /disabled=\{[^}]*(!stVariant|!rjVariant|!hasSchoolSelected|!has[A-Z]\w*Selected)[^}]*\}/,
  /disabled=\{[^}]*(!isFormValid|!canSave|!canSubmit|!isComplete)[^}]*\}/,
  /disabled=\{[^}]*(!picked|!sizeSelected)[^}]*\}/,
];

// Komponen lama yang belum direfaktor ke FormFieldFeedback/FormSummaryAlert (grandfathered baseline)
const GRANDFATHERED_FEEDBACK = new Set([
  "src/components/students/BatchPromoteModal.tsx",
  "src/components/orders/FinanceDiscretionModal.tsx",
  "src/components/procurement/CreateVendorReturnModal.tsx",
  "src/components/internal-orders/CreateInternalShipmentModal.tsx",
]);

for (const file of files) {
  const content = readFileSync(file, "utf8");
  const lines = content.split(/\r?\n/);
  const normalizedPath = file.replace(/\\/g, "/");
  const relativePath = normalizedPath.includes("/src/")
    ? `src/${normalizedPath.split("/src/")[1]}`
    : normalizedPath.replace(/^.*src\//, "src/");

  // Deteksi kepatuhan feedback loop form mutasi / modal baru (menggunakan FormFieldFeedback / FormSummaryAlert)
  const isFormOrModal = /Modal\.tsx$|Form\.tsx$/.test(file);
  const hasSubmitHandler = /handleSubmit|onSubmit|onClick=\{.*(?:handleSave|handleCreate|handleSubmit)/.test(content);
  const hasValidationChecks = /if\s*\([^)]*(?:!\w+|trim\(\)\s*===|<= 0)[^)]*\)\s*\{[^}]*(?:setError|setFormError|fieldErrors)/.test(content);

  if (isFormOrModal && hasSubmitHandler && hasValidationChecks && !GRANDFATHERED_FEEDBACK.has(relativePath)) {
    const importsFeedback = content.includes("FormFieldFeedback") || content.includes("FormSummaryAlert");
    if (!importsFeedback) {
      feedbackViolations.push({
        file: normalizedPath,
        detail: "Form/modal memiliki validasi input tapi tidak mengimpor FormFieldFeedback atau FormSummaryAlert.",
      });
    }
  }

  lines.forEach((lineText, idx) => {
    // Pengecualian khusus kontrak otomasi demo §0.43 pada OrderHandoverModal
    if (file.endsWith("OrderHandoverModal.tsx") && lineText.includes("isCodeMatched")) return;

    for (const pat of FORBIDDEN_PATTERNS) {
      if (pat.test(lineText)) {
        violations.push({
          file: normalizedPath,
          line: idx + 1,
          text: lineText.trim(),
        });
      }
    }
  });
}

if (violations.length > 0 || feedbackViolations.length > 0) {
  if (violations.length > 0) {
    console.error("Form-button-feedback gate GAGAL: Tombol submit dinonaktifkan secara pasif karena input kurang:");
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line} → ${v.text}`);
    }
    console.error("\nSesuai §0.63: Hapus disabled pasif. Tombol submit wajib tetap responsif dan menampilkan pesan kesalahan spesifik saat diklik.");
  }

  if (feedbackViolations.length > 0) {
    console.error("\nForm-feedback-component gate GAGAL: Modal/Form mutasi wajib mengonsumsi FormFieldFeedback / FormSummaryAlert (§0.63):");
    for (const fv of feedbackViolations) {
      console.error(`  ${fv.file} → ${fv.detail}`);
    }
  }

  process.exit(1);
} else {
  console.log("Form-button-feedback gate OK: seluruh tombol submit form responsif dan menerapkan interactive validation feedback loop.");
}

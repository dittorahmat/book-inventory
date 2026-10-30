// Gate helper kanonik (§8/§9 AGENTS.md): helper yang sudah punya modul kanonik
// wajib DIPAKAI dari modul itu, dilarang didefinisikan ulang secara lokal.
// Hanya baris BARU yang diperiksa (utang lama tidak disentuh), pola sama dengan
// `check:no-any`. Vektor nyata: salinan lokal `escapeHtml` di
// order-paid-notify.ts yang meng-escape 3 karakter sementara yang kanonik
// meng-escape 5 — duplikat yang berperilaku beda dan tak tertangkap gate mana pun.
// `--base=<ref>` (atau env GATE_BASE_REF) membuat gate juga memeriksa baris
// yang ditambahkan pada diff PR — di CI checkout bersih diff lokal selalu kosong.
import { baseRefFromArgv, changedLines } from "./lib/changed-lines";

interface CanonicalHelper {
  /** Nama helper; definisi lokal baru dengan nama ini ditolak. */
  name: string;
  /** File satu-satunya yang boleh mendefinisikannya. */
  owner: string;
  /** Modul yang wajib diimpor alih-alih menyalin. */
  module: string;
}

const CANONICAL: CanonicalHelper[] = [
  { name: "escapeHtml", owner: "src/server/services/email/po-template.ts", module: "services/email/po-template" },
  { name: "formatRupiah", owner: "src/lib/transfer-pricing.ts", module: "lib/transfer-pricing" },
  { name: "toIntRupiah", owner: "src/lib/transfer-pricing.ts", module: "lib/transfer-pricing" },
  { name: "readJson", owner: "src/lib/api.ts", module: "lib/api" },
  { name: "isoTimeFragment", owner: "src/server/lib/document-number.ts", module: "lib/document-number" },
  { name: "epochTimeFragment", owner: "src/server/lib/document-number.ts", module: "lib/document-number" },
  { name: "documentNumber", owner: "src/server/lib/document-number.ts", module: "lib/document-number" },
  { name: "randomSerial", owner: "src/server/lib/document-number.ts", module: "lib/document-number" },
  { name: "getDefaultTabForRole", owner: "src/lib/staff-roles.ts", module: "lib/staff-roles" },
  { name: "getRoleBadgeLabel", owner: "src/lib/staff-roles.ts", module: "lib/staff-roles" },
  { name: "getVisibleTabsForRole", owner: "src/components/layout/staff-tabs.ts", module: "components/layout/staff-tabs" },
  { name: "invoiceTotal", owner: "src/lib/order-money.ts", module: "lib/order-money" },
  { name: "dueOf", owner: "src/lib/order-money.ts", module: "lib/order-money" },
  { name: "buildReceiptDraft", owner: "src/server/services/payment-ledger.ts", module: "services/payment-ledger" },
  { name: "receiptWriteQueries", owner: "src/server/services/payment-ledger.ts", module: "services/payment-ledger" },
  { name: "creditParts", owner: "src/server/services/payment-ledger.ts", module: "services/payment-ledger" },
  { name: "listPaymentRows", owner: "src/server/services/payment-ledger.ts", module: "services/payment-ledger" },
  { name: "paymentRowStatus", owner: "src/server/services/payment-ledger.ts", module: "services/payment-ledger" },
  { name: "allocationViolation", owner: "src/lib/order-allocation.ts", module: "lib/order-allocation" },
  { name: "canHandoverBookOrder", owner: "src/lib/order-handover-guard.ts", module: "lib/order-handover-guard" },
  { name: "evaluateStudentEligibility", owner: "src/server/services/student-eligibility.ts", module: "services/student-eligibility" },
  { name: "adjustVariantStockQuery", owner: "src/server/services/uniform/stock.ts", module: "services/uniform/stock" },
  { name: "adjustPackageStockQuery", owner: "src/server/services/uniform/stock.ts", module: "services/uniform/stock" },
  { name: "setVariantStockQuery", owner: "src/server/services/uniform/stock.ts", module: "services/uniform/stock" },
];

/** Tipe kanonik; deklarasi ulang tipe ini di luar file owner dilarang. */
interface CanonicalType {
  name: string;
  owner: string;
  module: string;
}

const CANONICAL_TYPES: CanonicalType[] = [
  { name: "ActiveTab", owner: "src/components/layout/staff-tabs.ts", module: "components/layout/staff-tabs" },
  { name: "StaffRole", owner: "src/server/services/access-scope.ts", module: "server/services/access-scope" },
];

const definitionOf = (name: string): RegExp =>
  new RegExp(`^(?:export\\s+)?(?:async\\s+)?(?:const|let|var|function)\\s+${name}\\b`);

const typeDefinitionOf = (name: string): RegExp =>
  new RegExp(`^(?:export\\s+)?type\\s+${name}\\s*=`);

/** Re-implementasi escape HTML manual (jejak `.replace(/&/g, "&amp;")`). */
const HTML_ESCAPE_REIMPL = /\.replace\(\s*\/&\s*\/g\s*,\s*["'`]&amp;/;

const isScanned = (file: string): boolean => /\.(ts|tsx)$/.test(file) && !/\.test\.(ts|tsx)$/.test(file);

const lines = changedLines("src", isScanned, { base: baseRefFromArgv(process.argv) });
if (lines === null) {
  console.log("Canonical-helper gate SKIP: bukan repo git — lewati.");
  process.exit(0);
}

const hits: string[] = [];
for (const { file, line } of lines) {
  if (!isScanned(file)) continue;
  const text = line.trim();
  if (text.startsWith("//") || text.startsWith("*") || text.startsWith("/*")) continue;

  for (const helper of CANONICAL) {
    if (file === helper.owner) continue;
    if (definitionOf(helper.name).test(text)) {
      hits.push(`${file}: mendefinisikan ulang \`${helper.name}\` — impor dari ${helper.module} (baris: ${text})`);
    }
  }
  for (const typeDef of CANONICAL_TYPES) {
    if (file === typeDef.owner) continue;
    if (typeDefinitionOf(typeDef.name).test(text)) {
      hits.push(`${file}: mendefinisikan ulang tipe kanonik \`${typeDef.name}\` — impor dari ${typeDef.module} (baris: ${text})`);
    }
  }
  if (file !== "src/server/services/email/po-template.ts" && HTML_ESCAPE_REIMPL.test(text)) {
    hits.push(`${file}: escape HTML manual — pakai \`escapeHtml\` dari services/email/po-template (baris: ${text})`);
  }
}

if (hits.length > 0) {
  console.error("Canonical-helper gate FAILED (satu helper, satu modul — AGENTS.md §8/§9):");
  for (const hit of hits) console.error(`  ${hit}`);
  process.exit(1);
}

console.log("Canonical-helper gate OK: tanpa salinan lokal helper kanonik di baris baru.");

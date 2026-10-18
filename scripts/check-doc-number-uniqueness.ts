// Gate nomor dokumen (§8/§10): setiap prefix yang dibangkitkan `documentNumber()`
// harus terdaftar bersama kolom targetnya, dan kolom itu WAJIB punya constraint
// UNIQUE — kecuali didokumentasikan sengaja tidak unik.
//
// Vektor nyata (Okt 2026): `students.nis` hanya ber-index NON-unik, sehingga
// `REG-<waktu>` yang bertabrakan menghasilkan NIS kembar TANPA error apa pun —
// ~50 duplikat per 10rb pendaftaran portal. Tak ada gate yang menangkap kelas
// ini; hanya audit manual. Gate ini menutupnya: prefix baru di kode langsung
// merah sampai pemiliknya memutuskan kolom + status unik-nya.
//
// Batasan yang disadari: pemindai literal hanya melihat
// `documentNumber("<PREFIX>"`. Prefix yang dioper sebagai variabel (USO, CLM)
// tetap terdaftar di sini sehingga assertion uniqueness-nya tetap berjalan.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

interface DocColumn {
  prefix: string;
  /** Variabel tabel di `src/db/schema.ts`, mis. `transferShipments`. */
  table: string;
  /** Field kolom di `src/db/schema.ts`, mis. `shipmentNumber`. */
  column: string;
  /** Alasan kolom ini SENGAJA tidak unik; kosong/absen = wajib UNIQUE. */
  nonUniqueReason?: string;
}

const GENERATED_COLUMNS: DocColumn[] = [
  { prefix: "ORD", table: "studentBookOrders", column: "orderNumber" },
  { prefix: "DIR", table: "studentBookOrders", column: "orderNumber" },
  { prefix: "TRF", table: "transferShipments", column: "shipmentNumber" },
  { prefix: "PO", table: "purchaseOrders", column: "poNumber" },
  { prefix: "IPO", table: "internalPurchaseOrders", column: "poNumber" },
  { prefix: "RTV", table: "vendorReturns", column: "returnNumber" },
  { prefix: "USO", table: "uniformOrders", column: "orderNumber" },
  { prefix: "UPO", table: "uniformPos", column: "poNumber" },
  { prefix: "RFD-U", table: "uniformRefunds", column: "refundNumber" },
  { prefix: "CLM", table: "uniformClaims", column: "claimNumber" },
  { prefix: "TGH", table: "branchCharges", column: "chargeNumber" },
  { prefix: "REG", table: "students", column: "nis" },
  {
    prefix: "SJ-SERAH",
    table: "studentBookOrders",
    column: "handoverDeliveryNumber",
    nonUniqueReason: "nomor serah-terima bukan identitas dokumen; boleh berulang antar order",
  },
  {
    prefix: "RECEIPT",
    table: "paymentReceipts",
    column: "referenceNumber",
    nonUniqueReason: "nomor referensi pembayaran milik bank/kasir; keunikan dijaga komposit (bank, referensi)",
  },
];

/** Prefix yang dioper lewat variabel, jadi tak terlihat pemindai literal. */
const DYNAMIC_PREFIXES = new Set(["USO", "CLM"]);

const SCHEMA = "src/db/schema.ts";
const LITERAL_PREFIX = /documentNumber\(\s*"([^"]+)"/g;

const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)) out.push(full.replace(/\\/g, "/"));
  }
  return out;
};

// Potong schema.ts per deklarasi tabel agar pencarian unik ter-scope ke tabelnya.
const blocks = new Map<string, string>();
for (const part of readFileSync(SCHEMA, "utf8").split(/^export const /m).slice(1)) {
  const name = part.slice(0, part.indexOf("=")).trim();
  if (name) blocks.set(name, part);
}

/** Unik bila kolomnya `.unique()` ATAU muncul di `unique(...).on(...)` komposit. */
const declaresUnique = (block: string, column: string): boolean => {
  const decl = new RegExp(`^[ \\t]*${column}:\\s`, "m").exec(block);
  if (decl) {
    const end = block.indexOf("\n", decl.index);
    if (/\.unique\(\)/.test(block.slice(decl.index, end < 0 ? undefined : end))) return true;
  }
  return new RegExp(`unique\\([^)]*\\)\\s*\\.on\\([^)]*\\bt\\.${column}\\b`).test(block);
};

const derived = new Set<string>();
for (const file of walk("src")) {
  for (const m of readFileSync(file, "utf8").matchAll(LITERAL_PREFIX)) derived.add(m[1]);
}

const registered = new Set(GENERATED_COLUMNS.map((d) => d.prefix));
const problems: string[] = [];

// 1. Fail-closed: prefix literal baru wajib terdaftar (kolom + status unik).
for (const prefix of [...derived].sort()) {
  if (!registered.has(prefix)) {
    problems.push(
      `prefix "${prefix}" dipakai di src/ tapi belum terdaftar di GENERATED_COLUMNS — tentukan kolom targetnya dan apakah wajib UNIQUE.`
    );
  }
}

// 2. Kolom target wajib UNIQUE, kecuali beralasan.
for (const { prefix, table, column, nonUniqueReason } of GENERATED_COLUMNS) {
  const block = blocks.get(table);
  if (!block) {
    problems.push(`prefix "${prefix}": tabel \`${table}\` tak ada di ${SCHEMA}.`);
    continue;
  }
  if (!new RegExp(`^[ \\t]*${column}:\\s`, "m").test(block)) {
    problems.push(`prefix "${prefix}": kolom \`${table}.${column}\` tak ada di ${SCHEMA}.`);
    continue;
  }
  if (nonUniqueReason?.trim()) continue;
  if (!declaresUnique(block, column)) {
    problems.push(
      `prefix "${prefix}": \`${table}.${column}\` TIDAK unik — tambah \`.unique()\`/\`unique()\` atau isi \`nonUniqueReason\`.`
    );
  }
}

// 3. Registry tak boleh basi (sedimen).
for (const { prefix } of GENERATED_COLUMNS) {
  if (!derived.has(prefix) && !DYNAMIC_PREFIXES.has(prefix)) {
    problems.push(`prefix "${prefix}" terdaftar tapi tak lagi dibangkitkan di src/ — hapus entrinya.`);
  }
}

if (problems.length > 0) {
  console.error("Doc-number gate FAILED — penomoran dokumen tanpa penjaga keunikan:");
  for (const p of problems) console.error(`  ${p}`);
  console.error("Aturan: nomor dokumen yang dibangkitkan waktu WAJIB mendarat di kolom ber-UNIQUE (§10.2 audit tabrakan).");
  process.exit(1);
}

console.log(`Doc-number gate OK: ${GENERATED_COLUMNS.length} prefix terdaftar, ${derived.size} literal terpindai.`);

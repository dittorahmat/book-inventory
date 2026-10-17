// Gate pemetaan error D1 (§10.4 AGENTS.md): setiap berkas yang menulis lewat
// seam atomik `runWriteBatch()` WAJIB memetakan error constraint D1 ke 4xx
// berpesan jelas — lewat `d1WriteErrorStatus()` dari `lib/d1-write.ts`.
// Tanpa itu, `UNIQUE constraint` / `FOREIGN KEY constraint` naik ke `onError`
// dan berubah jadi 500 generik: persis yang dilarang §10.4, dan yang membuat
// insiden Okt 2026 (baris anak gagal ditulis) tampak seperti kerusakan server
// alih-alih kesalahan data yang bisa diperbaiki pengguna.
//
// Kenapa `runWriteBatch` yang jadi penanda, bukan semua tulis: seam itu berarti
// "saya sedang menulis banyak baris secara atomik", yaitu titik di mana kegagalan
// constraint paling mungkin terjadi dan paling mahal disalah-artikan. Kalau
// seluruh 48 berkas penulis diperiksa, gate-nya berisik dan akan dimatikan.
//
// Pengecualian yang disengaja (upsert setelan/kanal notifikasi, atau alur yang
// sudah dijaga pra-cek) didaftarkan di REGISTERED_UNMAPPED beserta alasannya.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Penanda pemetaan kanonik (§10.4). */
const MAPPER = "d1WriteErrorStatus";

/** Seam tulis atomik — penanda berkas yang wajib memetakan. */
const BATCH_SEAM = /runWriteBatch\s*\(/;

interface Unmapped {
  /** Path relatif ber-garis-miring, mis. `src/server/services/foo.ts`. */
  file: string;
  /** Alasan berkas ini boleh tidak memakai pemetaan kanonik. */
  reason: string;
}

const REGISTERED_UNMAPPED: Unmapped[] = [
  {
    file: "src/server/routes/books.ts",
    reason:
      "dua catch di sekitar replaceBookSuppliers sudah mengembalikan 400 dengan pesan domain (baris ~178/~209); catch itu juga membawa error domain 'Supplier tidak ditemukan', jadi memetakan lewat helper kanonik butuh membelah dua jalur error tanpa manfaat nyata.",
  },
  {
    file: "src/server/services/email/factory.ts",
    reason:
      "upsert setelan email (system_settings, onConflictDoUpdate) — tidak ada constraint milik pengguna untuk dipetakan; kegagalan = infra, 500 + ref justru jawaban yang benar.",
  },
  {
    file: "src/server/services/whatsapp.ts",
    reason: "sama seperti email/factory.ts: upsert setelan kanal WhatsApp ke system_settings.",
  },
  {
    file: "src/server/services/purchase-order/lifecycle.ts",
    reason:
      "hapus PO dijaga pra-cek (baris ~193: tolak bila barang sudah diterima), jadi FK violation seharusnya tak terjadi; sisa kegagalan = infra/bug, bukan kesalahan pengguna.",
  },
];

const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name) && !/\.d\.ts$/.test(entry.name))
      out.push(full.replace(/\\/g, "/"));
  }
  return out;
};

const batchFiles = walk("src").filter((file) => BATCH_SEAM.test(readFileSync(file, "utf8")));
const mapped = new Set(batchFiles.filter((file) => readFileSync(file, "utf8").includes(MAPPER)));

const problems: string[] = [];

// 1. Fail-closed: berkas seam atomik baru wajib memetakan, atau terdaftar beralasan.
for (const file of batchFiles) {
  if (mapped.has(file)) continue;
  const entry = REGISTERED_UNMAPPED.find((u) => u.file === file);
  if (!entry) {
    problems.push(
      `${file}: memakai runWriteBatch() tanpa ${MAPPER}() — error constraint D1 akan jatuh ke 500 generik (§10.4). Petakan lewat d1WriteErrorStatus(), atau daftarkan di REGISTERED_UNMAPPED dengan alasan.`
    );
  } else if (!entry.reason.trim()) {
    problems.push(`${file}: entri REGISTERED_UNMAPPED tanpa alasan — pengecualian wajib beralasan.`);
  }
}

// 2. Registry tak boleh basi: berkas yang sudah memetakan atau tak ada lagi.
for (const { file } of REGISTERED_UNMAPPED) {
  if (!batchFiles.includes(file)) problems.push(`${file}: terdaftar di REGISTERED_UNMAPPED tapi tak memakai runWriteBatch() lagi — hapus entrinya.`);
  else if (mapped.has(file)) problems.push(`${file}: terdaftar di REGISTERED_UNMAPPED tapi sudah memetakan lewat ${MAPPER}() — hapus entrinya.`);
}

if (problems.length > 0) {
  console.error("D1-error-mapping gate FAILED — error constraint D1 tanpa pemetaan 4xx (§10.4):");
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}

console.log(
  `D1-error-mapping gate OK: ${batchFiles.length} berkas seam tulis, ${mapped.size} memetakan lewat ${MAPPER}(), ${REGISTERED_UNMAPPED.length} pengecualian beralasan.`
);

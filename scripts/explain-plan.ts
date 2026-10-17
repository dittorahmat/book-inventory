// EXPLAIN QUERY PLAN gate (§11 AGENTS.md): gagalkan (exit 1) bila query
// partisi memakai SCAN tanpa indeks. Dijalankan via `bun run check:plans`
// memakai database lokal. Katalog kecil (books, book_packages + LIMIT)
// boleh SCAN dan didaftarkan di ALLOWED_SCAN.
import { Database } from "bun:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

interface PlannedQuery {
  name: string;
  sql: string;
  allowScan: boolean;
}

const QUERIES: PlannedQuery[] = [
  { name: "book_items by school", sql: "SELECT * FROM book_items WHERE current_school_id = 'x'", allowScan: false },
  { name: "package_items by school", sql: "SELECT * FROM package_items WHERE current_school_id = 'x'", allowScan: false },
  { name: "purchase_orders by target school", sql: "SELECT * FROM purchase_orders WHERE target_school_id = 'x'", allowScan: false },
  { name: "students by school", sql: "SELECT * FROM students WHERE school_id = 'x'", allowScan: false },
  { name: "student_book_orders by school", sql: "SELECT * FROM student_book_orders WHERE school_id = 'x'", allowScan: false },
  { name: "lookup-order partitioned join", sql: "SELECT student_book_orders.id FROM student_book_orders INNER JOIN students ON student_book_orders.student_id = students.id INNER JOIN schools ON student_book_orders.school_id = schools.id LEFT JOIN book_packages ON student_book_orders.package_id = book_packages.id WHERE student_book_orders.school_id = 'x' AND (lower(student_book_orders.order_number) LIKE '%q%' OR lower(students.nis) LIKE '%q%' OR lower(students.name) LIKE '%q%') LIMIT 10", allowScan: false },
  { name: "students partitioned search lower()", sql: "SELECT * FROM students WHERE school_id = 'x' AND status = 'active' AND (lower(name) LIKE '%q%' OR lower(nis) LIKE '%q%' OR lower(parent_name) LIKE '%q%') LIMIT 50", allowScan: false },
  { name: "student-orders partitioned search lower()", sql: "SELECT student_book_orders.id FROM student_book_orders INNER JOIN students ON student_book_orders.student_id = students.id WHERE student_book_orders.school_id = 'x' AND (lower(students.name) LIKE '%q%' OR lower(students.nis) LIKE '%q%' OR lower(student_book_orders.order_number) LIKE '%q%') LIMIT 50", allowScan: false },
  { name: "uniform-orders partitioned search lower()", sql: "SELECT uniform_orders.id FROM uniform_orders INNER JOIN students ON uniform_orders.student_id = students.id WHERE uniform_orders.school_id = 'x' AND uniform_orders.shipment_status = 'belum_dikirim' AND (lower(students.name) LIKE '%q%' OR lower(students.nis) LIKE '%q%' OR lower(uniform_orders.order_number) LIKE '%q%') LIMIT 50", allowScan: false },
  { name: "transfer_shipments from/to school", sql: "SELECT * FROM transfer_shipments WHERE from_school_id = 'x' OR to_school_id = 'x'", allowScan: false },
  { name: "book_returns via scoped students", sql: "SELECT book_returns.* FROM book_returns INNER JOIN students ON book_returns.student_id = students.id WHERE students.school_id = 'x'", allowScan: false },
  { name: "book_package_items by package", sql: "SELECT * FROM book_package_items WHERE package_id IN ('a','b')", allowScan: false },
  { name: "books by id IN-list (category attribution)", sql: "SELECT id, category FROM books WHERE id IN ('a','b')", allowScan: false },
  { name: "internal_shipment_items by shipment", sql: "SELECT * FROM internal_shipment_items WHERE shipment_id = 'x'", allowScan: false },
  { name: "package catalog (small, LIMIT)", sql: "SELECT * FROM book_packages LIMIT 50", allowScan: true },
  { name: "book catalog (small)", sql: "SELECT * FROM books LIMIT 50", allowScan: true },
  { name: "uniform_orders by school", sql: "SELECT * FROM uniform_orders WHERE school_id = 'x'", allowScan: false },
  { name: "uniform lookup partitioned join", sql: "SELECT uniform_orders.id FROM uniform_orders INNER JOIN students ON uniform_orders.student_id = students.id WHERE uniform_orders.school_id = 'x' AND (uniform_orders.order_number LIKE '%q%' OR students.nis LIKE '%q%' OR students.name LIKE '%q%') LIMIT 10", allowScan: false },
  { name: "uniform_order_items by order", sql: "SELECT * FROM uniform_order_items WHERE order_id IN ('a','b')", allowScan: false },
  { name: "uniform_exchanges via scoped orders", sql: "SELECT uniform_exchanges.* FROM uniform_exchanges INNER JOIN uniform_orders ON uniform_exchanges.order_id = uniform_orders.id WHERE uniform_orders.school_id = 'x'", allowScan: false },
  { name: "uniform_claims by school", sql: "SELECT * FROM uniform_claims WHERE school_id = 'x'", allowScan: false },
  { name: "internal POs by school", sql: "SELECT * FROM internal_purchase_orders WHERE school_id = 'x'", allowScan: false },
  { name: "internal PO items by PO", sql: "SELECT * FROM internal_purchase_order_items WHERE internal_po_id IN ('a','b')", allowScan: false },
  { name: "internal shipments by PO", sql: "SELECT * FROM internal_shipments WHERE internal_po_id = 'x'", allowScan: false },
  { name: "internal shipment items by shipment", sql: "SELECT * FROM internal_shipment_items WHERE shipment_id IN ('a','b')", allowScan: false },
];

// Sumber kebenaran daftar QUERIES di atas tidak bisa ditebak dari SQL-nya, jadi
// gate ini juga mengaudit SUMBER: file yang membangun pencarian substring
// terpartisi wajib terdaftar di sini. Tanpa ini, endpoint pencarian baru di
// file baru lolos gate dengan status hijau — "bukti plan" yang tidak pernah
// diminta (§11.5).
const REGISTERED_SEARCH_SOURCES = new Set([
  "src/server/lib/partitioned-search.ts", // pemilik pola `%q%` + lower()
  "src/server/services/public-order.ts",
  "src/server/services/uniform/orders.ts",
  "src/server/routes/students.ts",
  "src/server/routes/student-orders.ts",
  "src/server/routes/public-orders.ts",
  "src/server/routes/public-uniform-orders.ts",
]);

const SEARCH_MARKER = /matchLower\(|matchAnyLower\(|%\$\{/;

// §11 kelengkapan (kelas cacat #109): setiap kolom ber-partisi (`…schoolId`)
// WAJIB jadi kolom PERTAMA sebuah indeks, karena read list `WHERE <kolom> = ?`
// tanpa indeks pendahulu akan SCAN begitu volume cabang naik. Gate ini
// melengkapi audit substring di atas: pembacaan partisi biasa (eq/inArray, tanpa
// pola `%q%`) dulu tak pernah dipaksa mendaftar, sehingga #109 lolos hijau dan
// hanya ketahuan lewat probe manual.
//
// Kolom yang SENGAJA tanpa indeks didaftarkan di sini beserta alasan + buktinya.
const REGISTERED_UNPARTITIONED: Record<string, string> = {
  "users.school_id":
    "users dibaca lewat email (unik) dan id (sesi); school_id hanya muncul sebagai proyeksi (`GET /api/users`) + join ke schools.id yang memakai PK schools — tak pernah jadi predikat WHERE, dan tabelnya kecil (akun staf).",
};

const walkSources = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkSources(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)) out.push(full.replace(/\\/g, "/"));
  }
  return out;
};

// Mem-bangun skema dari file migrasi ke DB memori agar gate deterministik di
// mana pun (CI fresh checkout belum punya ./data/inventory.db). EXPLAIN
// QUERY PLAN hanya butuh indeks, bukan data.
const sqlite = new Database(":memory:");
try {
  const migrationFiles = readdirSync("./drizzle")
    .filter((f) => /^0\d{3}_.*\.sql$/.test(f))
    .sort();
  if (migrationFiles.length === 0) {
    throw new Error("Plan gate gagal: tidak ada file migrasi di drizzle/.");
  }
  for (const file of migrationFiles) {
    const sql = readFileSync(join("./drizzle", file), "utf8");
    for (const stmt of sql.split("--> statement-breakpoint")) {
      const trimmed = stmt.trim();
      if (trimmed) sqlite.run(trimmed);
    }
  }
} catch (err) {
  sqlite.close();
  throw err;
}
const VERBOSE = process.argv.includes("--verbose");
let failed = 0;
for (const q of QUERIES) {
  const rows = sqlite.query(`EXPLAIN QUERY PLAN ${q.sql}`).all() as Array<{ detail: string }>;
  const details = rows.map((r) => r.detail);
  const scans = details.filter((d) => d.includes("SCAN"));
  if (scans.length > 0 && !q.allowScan) {
    failed += 1;
    console.error(`SCAN tanpa indeks: ${q.name}\n  ${scans.join("\n  ")}`);
  } else if (VERBOSE) {
    console.log(`OK: ${q.name} -> ${details.join(" | ")}`);
  }
}
// Diperiksa lewat PRAGMA dari DB migrasi — kebenaran DB, bukan teks schema —
// sehingga drift schema-vs-migrasi (indeks dideklarasikan tapi migrasinya tak
// pernah dibuat) ikut tertangkap.
const schemaBlocks = new Map<string, string>();
for (const part of readFileSync("src/db/schema.ts", "utf8").split(/^export const /m).slice(1)) {
  const name = part.slice(0, part.indexOf("=")).trim();
  if (name) schemaBlocks.set(name, part);
}

const partitionColumns = (): Array<{ table: string; column: string }> => {
  const out: Array<{ table: string; column: string }> = [];
  for (const part of schemaBlocks.values()) {
    const table = /sqliteTable\(\s*"([^"]+)"/.exec(part)?.[1];
    if (!table) continue;
    for (const m of part.matchAll(/^\s*\w*[sS]choolId:\s*text\("([^"]+)"/gm)) out.push({ table, column: m[1] });
  }
  return out;
};

/** Kolom UNIK satu tabel: `.unique()` tunggal, atau unique(...) satu kolom saja. */
const uniqueFieldsOf = (block: string): string[] => {
  const out: string[] = [];
  for (const m of block.matchAll(/^\s*(\w+):\s*[^,\n]*\.unique\(\)/gm)) out.push(m[1]);
  for (const m of block.matchAll(/unique\(\s*"[^"]*"\s*\)\s*\.on\(([^)]*)\)/g)) {
    const cols = m[1].split(",").map((c) => c.trim().replace(/^t\./, ""));
    if (cols.length === 1) out.push(cols[0]);
  }
  return out;
};

/** Nama indeks pertama yang kolom pertamanya `column`, atau null. */
const leadingIndex = (table: string, column: string): string | null => {
  const indexes = sqlite.query(`PRAGMA index_list('${table}')`).all() as Array<{ name: string }>;
  for (const index of indexes) {
    const info = sqlite.query(`PRAGMA index_info('${index.name}')`).all() as Array<{ name: string | null }>;
    if (info[0]?.name === column) return index.name;
  }
  return null;
};

const columns = partitionColumns();
const partitionProblems: string[] = [];
for (const { table, column } of columns) {
  const key = `${table}.${column}`;
  const index = leadingIndex(table, column);
  const reason = REGISTERED_UNPARTITIONED[key];
  if (reason !== undefined && !reason.trim()) {
    partitionProblems.push(`${key}: entri REGISTERED_UNPARTITIONED tanpa alasan — pengecualian wajib beralasan.`);
  } else if (!index && reason === undefined) {
    partitionProblems.push(
      `${key}: kolom partisi tanpa indeks yang dimulai kolom itu — read list \`WHERE ${column} = ?\` akan SCAN saat volume naik. Tambah index() di schema.ts + migrasi, atau daftarkan di REGISTERED_UNPARTITIONED dengan alasan + bukti.`
    );
  } else if (index && reason !== undefined) {
    partitionProblems.push(`${key}: terdaftar di REGISTERED_UNPARTITIONED tapi sudah berindeks (${index}) — hapus entrinya.`);
  }
}
const knownColumns = columns.map((c) => `${c.table}.${c.column}`);
for (const key of Object.keys(REGISTERED_UNPARTITIONED)) {
  if (!knownColumns.includes(key)) {
    partitionProblems.push(`${key}: terdaftar di REGISTERED_UNPARTITIONED tapi kolom partisinya tak ada lagi di schema.ts — hapus entrinya.`);
  }
}

// §11.2 batas baca: endpoint route yang membaca tabel ber-partisi wajib dibatasi
// `.limit()` — kecuali membaca baris tunggal lewat kunci primer atau kolom UNIK.
// Tanpa ini daftar admin (`GET /api/users`, tanpa WHERE/LIMIT) tumbuh mengikuti
// jumlah staf, dan tak ada gate yang melihatnya: §11.5 hanya mengaudit query yang
// sudah terdaftar, sedangkan aturan indeks di atas hanya menjaga kolom partisi.
//
// Sengaja HANYA route. Pemanggil service sudah membatasi masukannya (inArray dari
// kueri yang telah dibatasi, baca per kunci unik, agregasi laporan) — terukur,
// memeriksa service melahirkan 40 temuan dengan ~30 positif palsu, dan gate
// berisik akan dimatikan. Batasan yang disadari: baca tak-terbatas di dalam
// service tidak tertangkap di sini.
const REGISTERED_UNBOUNDED_READS: Record<string, string> = {
  "src/server/routes/bookItems.ts::bookItems":
    "GET /api/book-items sengaja mendaftar SELURUH eksemplar satu sekolah agar operator memilih manual di picker transfer (alokasi FIFO sendiri dikerjakan server-side oleh `shipment/plan`). Membatasinya butuh paginasi — keputusan produk, bukan refactor diam-diam.",
};

// Nama VARIABEL tabel (dipakai kode: `.from(bookItems)`), bukan nama SQL
// (`book_items`) — kecocokannya beda, dan salah satu membuat gate ini vakum.
const partitionTables = [...schemaBlocks.entries()]
  .filter(([, block]) => /^\s*\w*[sS]choolId\s*:/m.test(block))
  .map(([name]) => name);
const routeFiles = readdirSync("src/server/routes")
  .filter((f) => /\.ts$/.test(f) && !/\.test\.ts$/.test(f))
  .map((f) => `src/server/routes/${f}`)
  .sort();

const boundedProblems: string[] = [];
const seenUnbounded: string[] = [];
for (const path of routeFiles) {
  const text = readFileSync(path, "utf8");
  for (const table of partitionTables) {
    for (const m of text.matchAll(new RegExp(`\\.from\\(\\s*${table}\\s*\\)`, "g"))) {
      // Potong rantai sampai `;` berikutnya (aproksimasi; cukup untuk gaya rantai Drizzle di repo ini).
      const semi = text.indexOf(";", m.index);
      const chain = text.slice(m.index, semi < 0 ? text.length : semi);
      const unique = uniqueFieldsOf(schemaBlocks.get(table) ?? "");
      const bounded =
        /\.limit\(/.test(chain) ||
        new RegExp(`eq\\(\\s*${table}\\.id\\s*,`).test(chain) ||
        unique.some((f) => new RegExp(`eq\\(\\s*${table}\\.${f}\\s*,`).test(chain));
      if (bounded) continue;
      const key = `${path}::${table}`;
      seenUnbounded.push(key);
      if (REGISTERED_UNBOUNDED_READS[key] === undefined) {
        boundedProblems.push(
          `${path}: baca dari ${table} tanpa .limit() — endpoint daftar tumbuh tanpa batas (§11.2). Tambah .limit(50) (+ filter), atau daftarkan di REGISTERED_UNBOUNDED_READS dengan alasan.`
        );
      }
    }
  }
}
for (const [key, reason] of Object.entries(REGISTERED_UNBOUNDED_READS)) {
  if (!seenUnbounded.includes(key)) {
    boundedProblems.push(`${key}: terdaftar di REGISTERED_UNBOUNDED_READS tapi tak ada lagi baca tak-terbatas di sana — hapus entrinya.`);
  } else if (!reason.trim()) {
    boundedProblems.push(`${key}: entri REGISTERED_UNBOUNDED_READS tanpa alasan — pengecualian wajib beralasan.`);
  }
}

sqlite.close();

const unregistered = walkSources("src").filter(
  (file) => SEARCH_MARKER.test(readFileSync(file, "utf8")) && !REGISTERED_SEARCH_SOURCES.has(file)
);
if (unregistered.length > 0) {
  console.error("Sumber pencarian substring belum terdaftar di QUERIES (§11.5):");
  for (const file of unregistered) console.error(`  ${file}`);
  console.error("Tambahkan query-nya ke QUERIES (dengan EXPLAIN QUERY PLAN yang terbukti SEARCH USING INDEX)");
  console.error("lalu daftarkan file-nya di REGISTERED_SEARCH_SOURCES.");
  process.exit(1);
}

if (failed > 0) {
  console.error(`${failed} query memakai SCAN tanpa indeks (§11).`);
  process.exit(1);
}
if (partitionProblems.length > 0) {
  console.error("Kolom partisi tanpa indeks pendahulu (§11 kelengkapan — kelas cacat #109):");
  for (const p of partitionProblems) console.error(`  ${p}`);
  process.exit(1);
}
if (boundedProblems.length > 0) {
  console.error("Baca tak-terbatas pada route (§11.2 — endpoint daftar wajib dibatasi LIMIT):");
  for (const p of boundedProblems) console.error(`  ${p}`);
  process.exit(1);
}
console.log(
  `Plan gate OK: ${QUERIES.length} query partisi SEARCH USING INDEX (pakai --verbose untuk detail per query); ${columns.length} kolom partisi berindeks pendahulu, ${Object.keys(REGISTERED_UNPARTITIONED).length} pengecualian; ${routeFiles.length} berkas route diperiksa batas baca, ${Object.keys(REGISTERED_UNBOUNDED_READS).length} pengecualian beralasan.`
);

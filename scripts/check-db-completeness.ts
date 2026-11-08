// Database completeness overview script
// Digunakan untuk mengecek ketersediaan data historis kritis (misal nomor telepon wali, email, stream)
// sebelum merancang alur portal atau asumsi verifikasi data.
import { Database } from "bun:sqlite";

const path = process.env.DB_PATH || "./data/inventory.db";

try {
  const db = new Database(path, { readonly: true, create: false });
  try {
    const [stats] = db
      .query(
        `SELECT
          COUNT(*) as total,
          COUNT(parent_phone) as withParentPhone,
          COUNT(parent_email) as withParentEmail,
          COUNT(parent_name) as withParentName,
          COUNT(stream) as withStream
        FROM students`
      )
      .all() as Array<{
        total: number;
        withParentPhone: number;
        withParentEmail: number;
        withParentName: number;
        withStream: number;
      }>;

    const pct = (val: number, tot: number) => (tot > 0 ? ((val / tot) * 100).toFixed(1) : "0");

    console.log("=== Ringkasan Kelengkapan Data Siswa (students) ===");
    console.log(`Total Siswa Terdaftar : ${stats.total}`);
    console.log(`Dengan No HP/WA Ortu : ${stats.withParentPhone} (${pct(stats.withParentPhone, stats.total)}%)`);
    console.log(`Dengan Email Ortu    : ${stats.withParentEmail} (${pct(stats.withParentEmail, stats.total)}%)`);
    console.log(`Dengan Nama Ortu     : ${stats.withParentName} (${pct(stats.withParentName, stats.total)}%)`);
    console.log(`Dengan Peminatan SMA : ${stats.withStream} (${pct(stats.withStream, stats.total)}%)`);
  } finally {
    db.close();
  }
} catch {
  console.log("Database ./data/inventory.db belum dibuat atau tidak ditemukan.");
}

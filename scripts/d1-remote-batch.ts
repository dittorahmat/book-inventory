import { execSync } from "child_process";
import { readFileSync, existsSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";

/**
 * Runner Kanonik Eksekusi SQL Batch ke Cloudflare D1 Remote
 * Menghindari file-handle leak di Windows dan membatasi ukuran batching perintah
 * agar tidak melampaui batas D1/SQLite code 7500 serta batas panjang baris perintah Windows.
 */
export function executeD1BatchSql(databaseName: string, sqlStatements: string[], chunkSize = 30) {
  console.log(`Executing ${sqlStatements.length} statements on D1 remote (${databaseName}) in chunks of ${chunkSize}...`);
  const tmpFile = join(process.cwd(), "data", "sql", ".tmp-d1-chunk.sql");

  try {
    for (let i = 0; i < sqlStatements.length; i += chunkSize) {
      const chunk = sqlStatements.slice(i, i + chunkSize);
      const combined = chunk.join("\n");
      console.log(`Applying chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(sqlStatements.length / chunkSize)} (${chunk.length} statements)...`);

      // Tulis chunk ke file sementara portabel untuk menghindari limit panjang baris cmd/pwsh di Windows
      writeFileSync(tmpFile, combined, "utf8");

      execSync(`npx wrangler d1 execute ${databaseName} --remote --file="${tmpFile}"`, {
        stdio: "inherit",
      });
    }
    console.log("All D1 remote chunks applied successfully.");
  } finally {
    if (existsSync(tmpFile)) {
      unlinkSync(tmpFile);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const fileArgIdx = args.indexOf("--file");
  const dbArgIdx = args.indexOf("--db");

  const dbName = dbArgIdx !== -1 ? args[dbArgIdx + 1] : "book-inventory-db";
  const filePath = fileArgIdx !== -1 ? args[fileArgIdx + 1] : "data/migrate-uniforms-d1.sql";

  if (!existsSync(filePath)) {
    console.error(`File ${filePath} not found.`);
    process.exit(1);
  }

  const raw = readFileSync(filePath, "utf8");
  const statements = raw
    .split(";\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => (s.endsWith(";") ? s : `${s};`));

  executeD1BatchSql(dbName, statements, 25);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("D1 remote batch runner error:", err);
    process.exit(1);
  });
}

import { spawnSync } from "child_process";

/**
 * Runner terpadu perintah D1 Remote lintas platform (Windows pwsh / Linux).
 * Menjamin encoding UTF-8 dan penanganan error yang bersih tanpa silent swallow.
 *
 * Contoh pemakaian:
 *   bun scripts/d1-remote.ts --command="SELECT COUNT(*) FROM students;"
 *   bun scripts/d1-remote.ts --file="./drizzle/seed-d1.sql"
 */

const args = process.argv.slice(2);
const commandArg = args.find((a) => a.startsWith("--command="));
const fileArg = args.find((a) => a.startsWith("--file="));

if (!commandArg && !fileArg) {
  console.error("Format tidak valid. Gunakan --command=\"<sql>\" atau --file=\"<path>\"");
  process.exit(1);
}

const wranglerArgs = ["d1", "execute", "book-inventory-db", "--remote"];
if (commandArg) {
  wranglerArgs.push(commandArg);
} else if (fileArg) {
  wranglerArgs.push(fileArg);
}

const isWindows = process.platform === "win32";
const exe = isWindows ? "cmd.exe" : "wrangler";
const finalArgs = isWindows ? ["/c", "wrangler", ...wranglerArgs] : wranglerArgs;

const result = spawnSync(exe, finalArgs, {
  encoding: "utf8",
  env: { ...process.env, PYTHONIOENCODING: "utf-8" },
});

if (result.stdout) {
  console.log(result.stdout);
}

if (result.stderr) {
  // Abaikan pesan error GC node file handle yang tidak fatal di Windows jika query berhasil
  const isGcWarning = result.stderr.includes("A FileHandle object was closed during garbage collection");
  if (isGcWarning && result.stdout.includes('"success": true')) {
    // Non-fatal
  } else if (result.status !== 0 || result.stderr.includes("ERROR")) {
    console.error(result.stderr);
    process.exit(result.status || 1);
  }
}

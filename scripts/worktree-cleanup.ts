import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const branchOrDir = process.argv[2];

if (!branchOrDir) {
  console.error("Usage: bun scripts/worktree-cleanup.ts <branch-name-or-worktree-path>");
  process.exit(1);
}

const targetDir = existsSync(branchOrDir)
  ? resolve(branchOrDir)
  : resolve(rootDir, `../book-inventory-${branchOrDir.replace(/[/\\:]/g, "-")}`);

console.log(`[worktree-cleanup] Membersihkan worktree di '${targetDir}'...`);

if (existsSync(targetDir)) {
  try {
    execFileSync("git", ["worktree", "remove", targetDir, "--force"], {
      cwd: rootDir,
      stdio: "inherit",
    });
    console.log(`[worktree-cleanup] Worktree berhasil dilepas: ${targetDir}`);
  } catch (err) {
    console.warn(`[worktree-cleanup] Peringatan saat 'git worktree remove':`, err);
  }
} else {
  console.log(`[worktree-cleanup] Direktori ${targetDir} tidak ditemukan, menjalankan prune.`);
  execFileSync("git", ["worktree", "prune"], {
    cwd: rootDir,
    stdio: "inherit",
  });
}

// Coba hapus branch lokal jika diberikan nama branch dan bukan path file murni
if (!existsSync(branchOrDir)) {
  try {
    execFileSync("git", ["branch", "-D", branchOrDir], {
      cwd: rootDir,
      stdio: "inherit",
    });
    console.log(`[worktree-cleanup] Branch lokal '${branchOrDir}' berhasil dihapus.`);
  } catch {
    // Abaikan jika branch sudah terhapus atau belum dibuat
  }
}

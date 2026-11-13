import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const branchOrDir = process.argv[2];

if (!branchOrDir || branchOrDir === "--help" || branchOrDir === "-h") {
  console.log("Usage: bun scripts/worktree-cleanup.ts <branch-name-or-worktree-path>");
  console.log("Contoh: bun scripts/worktree-cleanup.ts feat/my-feature");
  process.exit(branchOrDir ? 0 : 1);
}

// Cari path worktree yang diasosiasikan dengan branch dari git worktree list
let detectedDir: string | null = null;
try {
  const porcelain = execFileSync("git", ["worktree", "list", "--porcelain"], {
    cwd: rootDir,
    encoding: "utf8",
  });
  const entries = porcelain.split("\n\n").filter(Boolean);
  for (const entry of entries) {
    const lines = entry.split("\n");
    let wtPath = "";
    let wtBranch = "";
    for (const line of lines) {
      if (line.startsWith("worktree ")) wtPath = line.substring("worktree ".length).trim();
      if (line.startsWith("branch ")) wtBranch = line.substring("branch ".length).trim();
    }
    const cleanBranch = wtBranch.replace("refs/heads/", "");
    if (cleanBranch === branchOrDir || wtPath === resolve(branchOrDir)) {
      detectedDir = wtPath;
      break;
    }
  }
} catch {
  // Fallback ke path heuristik
}

const targetDir = detectedDir
  ? resolve(detectedDir)
  : existsSync(branchOrDir)
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

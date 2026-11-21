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

const isForce = process.argv.includes("--force") || process.env.ALLOW_WORKTREE_CLEANUP === "1";

// Cari path worktree yang diasosiasikan dengan branch dari git worktree list
let detectedDir: string | null = null;
let detectedBranch: string | null = null;
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
    const targetNorm = resolve(branchOrDir).toLowerCase();
    const wtPathNorm = resolve(wtPath).toLowerCase();
    if (cleanBranch === branchOrDir || wtPathNorm === targetNorm) {
      detectedDir = wtPath;
      detectedBranch = cleanBranch;
      break;
    }
  }
} catch {
  // Fallback ke path heuristik
}

// Guardrail §0.87.6: Cegah cleanup dini jika Pull Request branch masih OPEN di GitHub
if (!isForce && detectedBranch && detectedBranch !== "main" && detectedBranch !== "master") {
  try {
    const prJson = execFileSync("gh", ["pr", "view", detectedBranch, "--json", "number,state"], {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const parsed = JSON.parse(prJson.trim());
    if (parsed.state === "OPEN") {
      console.error(
        `\n[worktree-cleanup] DITOLAK: Pull Request #${parsed.number} untuk branch '${detectedBranch}' masih berstatus OPEN.\n` +
        `Sesuai AGENTS.md §6.5 & §0.87.6, worktree dilarang dilepas sebelum PR direview dan di-merge.\n` +
        `Gunakan flag --force jika memang ingin melepaskan paksa.\n`
      );
      process.exit(1);
    }
  } catch (err: any) {
    if (err?.status === 1 && typeof err?.stdout === "string" && err.stdout.includes("[worktree-cleanup] DITOLAK")) {
      throw err;
    }
    // Jika gh CLI mengembalikan exit code 1 karena block, pastikan exit
    if (err?.status === 1 && err?.output) {
      const outStr = String(err.output);
      if (outStr.includes("DITOLAK")) process.exit(1);
    }
  }
}

const targetDir = detectedDir
  ? resolve(detectedDir)
  : existsSync(branchOrDir)
  ? resolve(branchOrDir)
  : resolve(rootDir, `../book-inventory-${branchOrDir.replace(/[/\\:]/g, "-")}`);

console.log(`[worktree-cleanup] Membersihkan worktree di '${targetDir}'...`);

if (existsSync(targetDir)) {
  try {
    // Pada Windows, bersihkan junction symlink di dalam targetDir terlebih dahulu agar git worktree remove lancar
    if (process.platform === "win32") {
      try {
        const psUnlink = `Get-ChildItem -LiteralPath '${targetDir}' -Force -ErrorAction SilentlyContinue | Where-Object { $_.Attributes -band [System.IO.FileAttributes]::ReparsePoint } | ForEach-Object { [System.IO.Directory]::Delete($_.FullName, $false) }`;
        execFileSync("powershell", ["-NoProfile", "-Command", psUnlink], { stdio: "ignore" });
      } catch {
        // Abaikan jika tidak ada reparse point
      }
    }
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

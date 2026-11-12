import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const branchName = process.argv[2];
const targetDirInput = process.argv[3];

if (!branchName) {
  console.error("Usage: bun scripts/worktree-setup.ts <branch-name> [target-dir]");
  process.exit(1);
}

const targetDir = targetDirInput
  ? resolve(targetDirInput)
  : resolve(rootDir, `../book-inventory-${branchName.replace(/[/\\:]/g, "-")}`);

console.log(`[worktree-setup] Menyiapkan worktree '${branchName}' di '${targetDir}'...`);

if (!existsSync(targetDir)) {
  let branchExists = false;
  try {
    execFileSync("git", ["show-ref", "--verify", "--quiet", `refs/heads/${branchName}`], { cwd: rootDir });
    branchExists = true;
  } catch {
    branchExists = false;
  }

  const worktreeArgs = branchExists
    ? ["worktree", "add", targetDir, branchName]
    : ["worktree", "add", "-b", branchName, targetDir, "main"];

  execFileSync("git", worktreeArgs, {
    cwd: rootDir,
    stdio: "inherit",
  });
} else {
  console.log(`[worktree-setup] Direktori ${targetDir} sudah ada, melewati 'git worktree add'.`);
}

const sourceNodeModules = resolve(rootDir, "node_modules");
const targetNodeModules = resolve(targetDir, "node_modules");

if (existsSync(sourceNodeModules) && !existsSync(targetNodeModules)) {
  console.log(`[worktree-setup] Menghubungkan node_modules via junction...`);
  if (process.platform === "win32") {
    execFileSync("cmd", ["/c", "mklink", "/J", targetNodeModules, sourceNodeModules], {
      stdio: "inherit",
    });
  } else {
    execFileSync("ln", ["-s", sourceNodeModules, targetNodeModules], {
      stdio: "inherit",
    });
  }
}

const sourceDataDir = resolve(rootDir, "data");
const targetDataDir = resolve(targetDir, "data");
if (existsSync(sourceDataDir) && !existsSync(targetDataDir)) {
  console.log(`[worktree-setup] Menghubungkan folder data via junction...`);
  if (process.platform === "win32") {
    execFileSync("cmd", ["/c", "mklink", "/J", targetDataDir, sourceDataDir], {
      stdio: "inherit",
    });
  } else {
    execFileSync("ln", ["-s", sourceDataDir, targetDataDir], {
      stdio: "inherit",
    });
  }
}

console.log(`[worktree-setup] Worktree siap digunakan di: ${targetDir}`);

import { spawnSync } from "child_process";
import { existsSync } from "fs";
import { resolve, join } from "path";

// Helper runner kanonik untuk menjalankan perintah di direktori worktree:
// Penggunaan: bun scripts/worktree-exec.ts <worktree_dir> <cmd...>
// Contoh: bun run wt book1 test demand.test.ts
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error("Usage: bun run wt <worktree_name> <command> [args...]");
  process.exit(1);
}

const [worktreeName, cmd, ...cmdArgs] = args;

// Resolusi path target worktree:
// Prioritaskan direktori sibling (../worktreeName) jika ada (standar AGENTS.md: D:\development\book1),
// fallback ke subdirektori (./worktreeName).
let targetDir = worktreeName;
if (!worktreeName.includes("/") && !worktreeName.includes("\\")) {
  const siblingPath = resolve(join(process.cwd(), "..", worktreeName));
  const subPath = resolve(join(process.cwd(), worktreeName));
  if (existsSync(siblingPath)) {
    targetDir = siblingPath;
  } else {
    targetDir = subPath;
  }
} else {
  targetDir = resolve(worktreeName);
}

// Eksekusi perintah: jika cmd adalah 'git' atau binary system lain, spawn langsung;
// jika perintah bun (run, test, x, dsb.) atau script npm, gunakan 'bun'.
const isBunCommand = ["run", "test", "x", "install", "add", "remove", "pm"].includes(cmd);
const executable = isBunCommand ? "bun" : cmd;
const execArgs = isBunCommand ? [cmd, ...cmdArgs] : cmdArgs;

const result = spawnSync(executable, execArgs, {
  cwd: targetDir,
  stdio: "inherit",
  shell: false,
});

process.exit(result.status ?? 0);

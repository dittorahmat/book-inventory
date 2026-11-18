import { spawnSync } from "child_process";

// Helper runner kanonik untuk menjalankan perintah di direktori worktree:
// Penggunaan: bun scripts/worktree-exec.ts <worktree_dir> <cmd...>
// Contoh: bun run wt book1 test src/lib/book-import-parser.test.ts
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error("Usage: bun run wt <worktree_name> <command> [args...]");
  process.exit(1);
}

const [worktreeName, cmd, ...cmdArgs] = args;
const targetDir = worktreeName.includes("/") || worktreeName.includes("\\")
  ? worktreeName
  : `${process.cwd()}/${worktreeName}`;

console.log(`[wt-exec] Running in '${targetDir}': ${cmd} ${cmdArgs.join(" ")}`);

const result = spawnSync("bun", [cmd, ...cmdArgs], {
  cwd: targetDir,
  stdio: "inherit",
  shell: true,
});

process.exit(result.status ?? 0);

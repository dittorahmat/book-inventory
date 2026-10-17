// Baris BARU di bawah satu path (staged + unstaged + file untracked), untuk
// gate berbasis diff: `check:no-any` dan `check:canonical-helpers`. Satu tempat
// supaya plumbing `git diff -U0` tidak disalin ke tiap gate (§8).
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

export interface ChangedLine {
  file: string;
  line: string;
}

const norm = (path: string): string => path.replace(/\\/g, "/");

const sh = (cmd: string): string | null => {
  try {
    return execSync(cmd, { encoding: "utf8" });
  } catch {
    return null;
  }
};

/**
 * `null` bila bukan repo git (gate harus lewat, bukan gagal).
 * `isScanned` hanya menyaring file untracked (diff git sudah terbatas `root`).
 */
export function changedLines(root: string, isScanned: (file: string) => boolean): ChangedLine[] | null {
  const staged = sh(`git diff --cached -U0 -- ${root}`);
  const unstaged = sh(`git diff -U0 -- ${root}`);
  if (staged === null || unstaged === null) return null;

  const out: ChangedLine[] = [];
  for (const diff of [staged, unstaged]) {
    let file = "";
    for (const raw of diff.split("\n")) {
      if (raw.startsWith("+++ b/")) file = norm(raw.slice(6));
      else if (raw.startsWith("+") && !raw.startsWith("+++")) out.push({ file, line: raw.slice(1) });
    }
  }

  const status = sh(`git status --porcelain -- ${root}`) ?? "";
  for (const entry of status.split("\n")) {
    const match = entry.match(/^\?\?\s+(.+)$/);
    if (!match) continue;
    const file = norm(match[1].trim());
    if (!isScanned(file)) continue;
    try {
      for (const line of readFileSync(file, "utf8").split("\n")) out.push({ file, line });
    } catch {
      continue; // file hilang antara `git status` dan baca — lewati.
    }
  }
  return out;
}

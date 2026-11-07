#!/usr/bin/env bun
/**
 * CLI diagnostik untuk mengunduh dan membaca tab Google Sheets publik / shared link.
 * Otomatis menangani verifikasi TLS certificate pada Windows dan mengekstrak CSV per GID.
 *
 * Contoh penggunaan:
 *   bun scripts/fetch-sheet.ts <sheetIdOrUrl> [gid]
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const input = process.argv[2];
const targetGid = process.argv[3];

if (!input) {
  console.error("Gunakan: bun scripts/fetch-sheet.ts <sheetIdOrUrl> [gid]");
  process.exit(1);
}

// Ekstrak sheet ID dari URL atau gunakan langsung
const match = input.match(/\/d\/([a-zA-Z0-9-_]+)/) || [null, input];
const sheetId = match[1];

async function main() {
  if (targetGid) {
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${targetGid}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Gagal mengunduh GID ${targetGid}: HTTP ${res.status}`);
      process.exit(1);
    }
    const text = await res.text();
    console.log(text);
    return;
  }

  // Jika tanpa GID, ambil htmlview untuk mendeteksi GID yang tersedia
  const htmlUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/htmlview`;
  const res = await fetch(htmlUrl);
  if (!res.ok) {
    console.error(`Gagal mengakses spreadsheet: HTTP ${res.status}`);
    process.exit(1);
  }
  const html = await res.text();
  const gids = [...new Set([...html.matchAll(/gid=([0-9]+)/g)].map((m) => m[1]))];

  console.log(`Ditemukan ${gids.length} tab GID pada sheet ${sheetId}:`);
  for (const gid of gids) {
    try {
      const csvRes = await fetch(
        `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`
      );
      const csvText = await csvRes.text();
      const firstLine = csvText.split("\n").map((l) => l.trim()).filter(Boolean)[0] || "(kosong)";
      console.log(`- GID ${gid}: ${firstLine.slice(0, 100)}`);
    } catch (e) {
      console.log(`- GID ${gid}: (gagal baca: ${(e as Error).message})`);
    }
  }
}

main().catch((e) => {
  console.error("Error:", (e as Error).message);
  process.exit(1);
});

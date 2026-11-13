/**
 * Helper kanonik untuk penamaan dan format ruang kelas / rombel siswa.
 * Menggabungkan jenjang dan nama rombel murni menjadi label kelas utuh.
 */
export function formatClassroomName(gradeLevel: string, rombel?: string | null): string {
  if (!rombel || !rombel.trim()) {
    return `Kelas ${gradeLevel}`;
  }
  const clean = rombel.trim();
  // Jika rombel sudah diawali oleh angka jenjang (contoh: "1 INTER 1", "2 MQ 2"), jangan gandakan
  if (clean.startsWith(`${gradeLevel} `) || clean === gradeLevel) {
    return clean;
  }
  return `${gradeLevel} ${clean}`;
}

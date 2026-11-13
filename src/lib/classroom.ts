/**
 * Helper kanonik untuk penamaan dan format ruang kelas / rombel siswa.
 * Menggabungkan jenjang dan nama rombel murni menjadi label kelas utuh.
 */
export function formatClassroomName(gradeLevel: string, rombel?: string | null): string {
  if (!rombel || !rombel.trim()) {
    return `Kelas ${gradeLevel}`;
  }
  return `${gradeLevel} ${rombel.trim()}`;
}

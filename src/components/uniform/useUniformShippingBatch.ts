import { useState } from "react";
import { downloadUniformCsv, importUniformShipping } from "./uniform-admin-api";

export function useUniformShippingBatch(schoolId: string, paidOnly: boolean, onReload: () => Promise<void>) {
  const [importText, setImportText] = useState("");
  const [importShipped, setImportShipped] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  const handleExport = async (type: "packing" | "ekspedisi" | "excel-ekspedisi" | "excel-internal") => {
    await downloadUniformCsv({ schoolId: schoolId || "", format: type, paidOnly });
  };

  const handleImport = async (onError: (msg: string) => void) => {
    const lines = importText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const rawRows = lines[0]?.toLowerCase().startsWith("nis") ? lines.slice(1) : lines;
    const parsed = rawRows
      .map((line) => {
        const [nis = "", resi = "", ongkir = ""] = line.split(/[;\t,]/).map((c) => c.trim());
        return { nis, resi: resi || undefined, ongkir: ongkir ? Number(ongkir) || 0 : 0 };
      })
      .filter((r) => r.nis);

    if (parsed.length === 0 || !schoolId) {
      onError("Isi data CSV (nis;resi;ongkir) dan pilih sekolah.");
      return;
    }
    setImportBusy(true);
    setImportResult(null);
    try {
      const res = await importUniformShipping({ schoolId, markShipped: importShipped, rows: parsed });
      setImportResult(
        `${res.updated.length} diperbarui, ${res.rejected.length} ditolak${
          res.rejected.length > 0 ? `: ${res.rejected.map((r) => `${r.nis} (${r.reason})`).join("; ")}` : ""
        }.`
      );
      await onReload();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Gagal mengimpor data.");
    } finally {
      setImportBusy(false);
    }
  };

  return {
    importText,
    setImportText,
    importShipped,
    setImportShipped,
    importBusy,
    importResult,
    handleExport,
    handleImport,
  };
}

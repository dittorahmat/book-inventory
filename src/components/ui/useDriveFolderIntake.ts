import { useState } from "react";
import { apiEnvelope } from "../../lib/api";
import type { DriveFolderItem } from "./DriveFileList";

interface UseDriveFolderIntakeOptions<TValid, TSkipped> {
  endpoint: string;
  onSingleSheetParsed: (data: { validItems: TValid[]; skippedRows: TSkipped[]; sheetName: string }) => void;
}

export function useDriveFolderIntake<TValid, TSkipped>({
  endpoint,
  onSingleSheetParsed,
}: UseDriveFolderIntakeOptions<TValid, TSkipped>) {
  const [sheetsUrl, setSheetsUrl] = useState<string>("");
  const [folderFiles, setFolderFiles] = useState<DriveFolderItem[]>([]);
  const [isParsingDrive, setIsParsingDrive] = useState<boolean>(false);
  const [driveError, setDriveError] = useState<string | null>(null);

  const fetchDriveUrl = async (urlToFetch?: string) => {
    const targetUrl = (urlToFetch ?? sheetsUrl).trim();
    if (!targetUrl) {
      setDriveError("Masukkan URL Google Drive folder atau Sheets terlebih dahulu.");
      return;
    }

    setIsParsingDrive(true);
    setDriveError(null);
    setFolderFiles([]);

    try {
      const resp = await apiEnvelope<{
        success: boolean;
        type: "folder" | "sheet";
        data: {
          files?: DriveFolderItem[];
          validBooks?: TValid[];
          validStudents?: TValid[];
          skippedRows?: TSkipped[];
          sheetName?: string;
        };
      }>(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl }),
      });

      if (resp.type === "folder" && resp.data.files) {
        setFolderFiles(resp.data.files);
      } else if (resp.type === "sheet") {
        const validItems = (resp.data.validBooks || resp.data.validStudents || []) as TValid[];
        onSingleSheetParsed({
          validItems,
          skippedRows: resp.data.skippedRows || [],
          sheetName: resp.data.sheetName || "",
        });
      }
    } catch (err: unknown) {
      setDriveError(err instanceof Error ? err.message : "Gagal memproses Google Drive URL");
    } finally {
      setIsParsingDrive(false);
    }
  };

  const selectFolderFile = async (file: DriveFolderItem) => {
    setIsParsingDrive(true);
    setDriveError(null);
    try {
      const fileUrl = `https://docs.google.com/spreadsheets/d/${file.id}/edit`;
      const resp = await apiEnvelope<{
        success: boolean;
        type: "sheet";
        data: {
          validBooks?: TValid[];
          validStudents?: TValid[];
          skippedRows?: TSkipped[];
          sheetName?: string;
        };
      }>(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: fileUrl }),
      });

      const validItems = (resp.data.validBooks || resp.data.validStudents || []) as TValid[];
      onSingleSheetParsed({
        validItems,
        skippedRows: resp.data.skippedRows || [],
        sheetName: resp.data.sheetName || "",
      });
    } catch (err: unknown) {
      setDriveError(err instanceof Error ? err.message : `Gagal memuat berkas ${file.name}`);
    } finally {
      setIsParsingDrive(false);
    }
  };

  return {
    sheetsUrl,
    setSheetsUrl,
    folderFiles,
    setFolderFiles,
    isParsingDrive,
    driveError,
    setDriveError,
    fetchDriveUrl,
    selectFolderFile,
  };
}

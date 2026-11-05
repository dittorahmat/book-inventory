import { useState, useRef } from "react";
import { Play, Square, CheckCircle2, AlertTriangle, Loader2, FileSpreadsheet, RotateCcw } from "lucide-react";
import type { DriveFolderItem } from "./DriveFileList";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type BatchItemStatus = "idle" | "processing" | "success" | "warning" | "error";

export interface BatchItemResult {
  fileId: string;
  status: BatchItemStatus;
  message?: string;
  count?: number;
}

interface DriveFolderBatchRunnerProps {
  files: DriveFolderItem[];
  onProcessFile: (file: DriveFolderItem) => Promise<{ count: number; warning?: string }>;
  onComplete: () => void;
  title?: string;
  rawItemsCount?: number;
  uniqueItemsCount?: number;
}

export function DriveFolderBatchRunner({
  files,
  onProcessFile,
  onComplete,
  title = "Proses Semua Berkas Folder",
  rawItemsCount,
  uniqueItemsCount,
}: DriveFolderBatchRunnerProps) {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [results, setResults] = useState<Record<string, BatchItemResult>>({});
  const [totalItemsCount, setTotalItemsCount] = useState<number>(0);
  const isCancelledRef = useRef<boolean>(false);

  if (files.length === 0) return null;

  const completedCount = Object.values(results).filter(
    (r) => r.status === "success" || r.status === "warning" || r.status === "error"
  ).length;

  const percent = Math.round((completedCount / files.length) * 100);

  const effectiveRawCount = typeof rawItemsCount === "number" && rawItemsCount > 0 ? rawItemsCount : totalItemsCount;

  const handleStart = async () => {
    setIsRunning(true);
    isCancelledRef.current = false;
    setResults({});
    setTotalItemsCount(0);

    let accumulatedTotal = 0;

    for (let i = 0; i < files.length; i++) {
      if (isCancelledRef.current) break;

      const file = files[i];
      setCurrentIndex(i);

      setResults((prev) => ({
        ...prev,
        [file.id]: { fileId: file.id, status: "processing" },
      }));

      try {
        const res = await onProcessFile(file);
        if (isCancelledRef.current) break;

        accumulatedTotal += res.count;
        setTotalItemsCount(accumulatedTotal);

        setResults((prev) => ({
          ...prev,
          [file.id]: {
            fileId: file.id,
            status: res.warning ? "warning" : "success",
            count: res.count,
            message: res.warning || `${res.count} baris dibaca`,
          },
        }));

        // Jeda waktu (pacing delay) antar-file agar Google tidak melakukan throttling / 503
        if (i < files.length - 1 && !isCancelledRef.current) {
          await delay(800);
        }
      } catch (err: unknown) {
        if (isCancelledRef.current) break;
        const errMsg = err instanceof Error ? err.message : "Gagal memproses";
        setResults((prev) => ({
          ...prev,
          [file.id]: {
            fileId: file.id,
            status: "error",
            message: errMsg,
          },
        }));
      }
    }

    setIsRunning(false);
    if (!isCancelledRef.current && accumulatedTotal > 0) {
      onComplete();
    }
  };

  const handleRetryFile = async (file: DriveFolderItem) => {
    if (isRunning) return;
    setResults((prev) => ({
      ...prev,
      [file.id]: { fileId: file.id, status: "processing" },
    }));

    try {
      const res = await onProcessFile(file);
      setTotalItemsCount((prev) => prev + res.count);
      setResults((prev) => ({
        ...prev,
        [file.id]: {
          fileId: file.id,
          status: res.warning ? "warning" : "success",
          count: res.count,
          message: res.warning || `${res.count} baris dibaca`,
        },
      }));
      if (res.count > 0) {
        onComplete();
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Gagal memproses";
      setResults((prev) => ({
        ...prev,
        [file.id]: {
          fileId: file.id,
          status: "error",
          message: errMsg,
        },
      }));
    }
  };

  const handleCancel = () => {
    isCancelledRef.current = true;
    setIsRunning(false);
  };

  return (
    <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl space-y-3 text-xs">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-semibold text-[#050505]">{title}</span>
          <span className="text-[11px] text-[#65676B] ml-2">({files.length} berkas)</span>
        </div>
        {!isRunning ? (
          <button
            type="button"
            onClick={handleStart}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1877F2] hover:bg-[#166fe5] text-white font-semibold rounded-lg shadow-sm transition-all text-xs"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {completedCount > 0 ? "Mulai Ulang Semua" : "Mulai Proses Semua"}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleCancel}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg shadow-sm transition-all text-xs"
          >
            <Square className="w-3 h-3 fill-current" />
            Hentikan
          </button>
        )}
      </div>

      {(isRunning || completedCount > 0) && (
        <div className="space-y-2">
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-medium text-[#65676B]">
              <span>
                {isRunning ? (
                  <span className="inline-flex items-center gap-1 text-[#1877F2] font-semibold">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Sedang memproses ({currentIndex + 1}/{files.length}): {files[currentIndex]?.name}
                  </span>
                ) : (
                  <span className="text-emerald-700 font-semibold">
                    Selesai diproses ({completedCount}/{files.length} berkas)
                  </span>
                )}
              </span>
              <span className="font-semibold text-[#050505]">{percent}%</span>
            </div>
            <div className="w-full h-2 bg-blue-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1877F2] transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1 text-[11px] text-[#65676B] pt-1">
            <div>
              Total akumulasi data terbaca: <strong className="text-[#050505]">{effectiveRawCount}</strong> baris
            </div>
            {typeof uniqueItemsCount === "number" && uniqueItemsCount > 0 && uniqueItemsCount < effectiveRawCount && (
              <div className="text-emerald-700 font-medium">
                → Disaring menjadi <strong>{uniqueItemsCount}</strong> item unik ({effectiveRawCount - uniqueItemsCount} duplikat otomatis diabaikan)
              </div>
            )}
            {typeof uniqueItemsCount === "number" && uniqueItemsCount > 0 && uniqueItemsCount === effectiveRawCount && (
              <div className="text-[#65676B]">
                (Seluruh {uniqueItemsCount} item unik tanpa duplikat)
              </div>
            )}
          </div>

          <div className="max-h-36 overflow-y-auto border border-blue-200 bg-white rounded-lg divide-y divide-[#E4E6EB]">
            {files.map((file) => {
              const res = results[file.id];
              return (
                <div key={file.id} className="p-2 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 truncate pr-2">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-[#65676B] shrink-0" />
                    <span className="truncate text-[#050505] font-medium">{file.name}</span>
                  </div>
                  <div className="shrink-0 flex items-center gap-1">
                    {!res && <span className="text-[#65676B]">Menunggu...</span>}
                    {res?.status === "processing" && (
                      <span className="text-[#1877F2] flex items-center gap-1 font-medium">
                        <Loader2 className="w-3 h-3 animate-spin" /> Membaca...
                      </span>
                    )}
                    {res?.status === "success" && (
                      <span className="text-emerald-700 flex items-center gap-1 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> {res.message}
                      </span>
                    )}
                    {res?.status === "warning" && (
                      <span className="text-amber-700 flex items-center gap-1 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5" /> {res.message}
                      </span>
                    )}
                    {res?.status === "error" && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-rose-600 font-semibold">Gagal: {res.message}</span>
                        {!isRunning && (
                          <button
                            type="button"
                            onClick={() => handleRetryFile(file)}
                            className="p-1 rounded text-rose-600 hover:bg-rose-100 transition-colors"
                            title="Coba lagi berkas ini"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

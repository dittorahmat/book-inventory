import "../../test-dom";
import { afterEach, describe, it, expect } from "bun:test";
const { cleanup, render, screen, fireEvent, waitFor } = await import("@testing-library/react");
import { DriveFolderBatchRunner } from "./DriveFolderBatchRunner";
import type { DriveFolderItem } from "./DriveFileList";

afterEach(() => {
  cleanup();
});

describe("DriveFolderBatchRunner", () => {
  const dummyFiles: DriveFolderItem[] = [
    { id: "file-1", name: "Kelas 1 Buku.xlsx", type: "spreadsheet" },
    { id: "file-2", name: "Kelas 2 Buku.xlsx", type: "spreadsheet" },
  ];

  it("renders null when files array is empty", () => {
    const { container } = render(
      <DriveFolderBatchRunner
        files={[]}
        onProcessFile={async () => ({ count: 10 })}
        onComplete={() => {}}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders trigger button and title", () => {
    render(
      <DriveFolderBatchRunner
        files={dummyFiles}
        onProcessFile={async () => ({ count: 10 })}
        onComplete={() => {}}
      />
    );
    expect(screen.getByText("Proses Semua Berkas Folder")).toBeDefined();
    expect(screen.getByText("Mulai Proses Semua")).toBeDefined();
  });

  it("processes all files sequentially and calls onComplete", async () => {
    let completed = false;
    const processedIds: string[] = [];

    render(
      <DriveFolderBatchRunner
        files={dummyFiles}
        onProcessFile={async (f) => {
          processedIds.push(f.id);
          return { count: 5 };
        }}
        onComplete={() => {
          completed = true;
        }}
      />
    );

    const startBtn = screen.getByText("Mulai Proses Semua");
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(completed).toBe(true);
    });

    expect(processedIds).toEqual(["file-1", "file-2"]);
    expect(screen.getByText("100%")).toBeDefined();
  });

  it("does not call onComplete when all files produce 0 items or fail", async () => {
    let completed = false;

    render(
      <DriveFolderBatchRunner
        files={dummyFiles}
        onProcessFile={async () => {
          throw new Error("File corrupt");
        }}
        onComplete={() => {
          completed = true;
        }}
      />
    );

    const startBtn = screen.getByText("Mulai Proses Semua");
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(screen.getByText("100%")).toBeDefined();
    });

    expect(completed).toBe(false);
  });

  it("displays clear breakdown when uniqueItemsCount has duplicates", async () => {
    render(
      <DriveFolderBatchRunner
        files={dummyFiles}
        uniqueItemsCount={6}
        onProcessFile={async () => ({ count: 5 })}
        onComplete={() => {}}
      />
    );

    const startBtn = screen.getByText("Mulai Proses Semua");
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(screen.getByText("100%")).toBeDefined();
    });

    // Total rows = 10, unique = 6, duplicates = 4
    expect(screen.getByText(/Total akumulasi data terbaca:/)).toBeDefined();
    expect(screen.getByText(/Disaring menjadi/)).toBeDefined();
    expect(screen.getByText(/4 duplikat otomatis diabaikan/)).toBeDefined();
  });
});

import { describe, expect, it } from "bun:test";
import { MemoryStorageService, S3CompatibleStorageService } from "./storage";

describe("Storage Service Abstraction", () => {
  it("uploads and retrieves file URLs via MemoryStorageService", async () => {
    const storage = new MemoryStorageService("/media");
    const testData = new TextEncoder().encode("fake image data");
    
    const url = await storage.upload("covers/test.jpg", testData, "image/jpeg");
    expect(url).toBe("/media/covers/test.jpg");
    expect(storage.getUrl("covers/test.jpg")).toBe("/media/covers/test.jpg");

    const file = await storage.getFile("covers/test.jpg");
    expect(file).toBeDefined();
    expect(file?.contentType).toBe("image/jpeg");

    await storage.delete("covers/test.jpg");
    const deleted = await storage.getFile("covers/test.jpg");
    expect(deleted).toBeNull();
  });

  it("formats URLs correctly for S3/R2 storage service", async () => {
    const s3Storage = new S3CompatibleStorageService("book-covers", "https://r2.schoolbooks.org");
    const url = s3Storage.getUrl("covers/math-grade7.png");
    expect(url).toBe("https://r2.schoolbooks.org/covers/math-grade7.png");
  });
});

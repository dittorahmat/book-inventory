import { describe, expect, it } from "bun:test";
import { MemoryStorageService, CloudflareR2StorageService } from "./storage";

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

  it("formats URLs correctly for R2 storage service", async () => {
    const r2 = new CloudflareR2StorageService({ put: async () => {}, get: async () => null, delete: async () => {} }, "https://r2.schoolbooks.org");
    expect(r2.getUrl("covers/math-grade7.png")).toBe("https://r2.schoolbooks.org/covers/math-grade7.png");
  });
});

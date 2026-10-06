export interface StorageFile {
  data: ReadableStream | ArrayBuffer | Uint8Array;
  contentType: string;
}

export interface StorageService {
  upload(key: string, file: Uint8Array | ArrayBuffer | Buffer, contentType: string): Promise<string>;
  getUrl(key: string): string;
  delete(key: string): Promise<void>;
  getFile(key: string): Promise<StorageFile | null>;
}

export class MemoryStorageService implements StorageService {
  private files = new Map<string, { data: Uint8Array; contentType: string }>();
  private baseUrl: string;

  constructor(baseUrl = "/api/media") {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async upload(key: string, file: Uint8Array | ArrayBuffer | Buffer, contentType: string): Promise<string> {
    const data = file instanceof Uint8Array ? file : new Uint8Array(file);
    this.files.set(key, { data, contentType });
    return this.getUrl(key);
  }

  getUrl(key: string): string {
    return `${this.baseUrl}/${key}`;
  }

  async delete(key: string): Promise<void> {
    this.files.delete(key);
  }

  async getFile(key: string): Promise<StorageFile | null> {
    const file = this.files.get(key);
    if (!file) return null;
    return { data: file.data, contentType: file.contentType };
  }
}

export class CloudflareR2StorageService implements StorageService {
  private bucket: any; // R2Bucket binding
  private publicUrl: string;

  constructor(bucket: any, publicUrl = "/api/media") {
    this.bucket = bucket;
    this.publicUrl = publicUrl.replace(/\/$/, "");
  }

  async upload(key: string, file: Uint8Array | ArrayBuffer | Buffer, contentType: string): Promise<string> {
    await this.bucket.put(key, file, {
      httpMetadata: { contentType },
    });
    return this.getUrl(key);
  }

  getUrl(key: string): string {
    return `${this.publicUrl}/${key}`;
  }

  async delete(key: string): Promise<void> {
    await this.bucket.delete(key);
  }

  async getFile(key: string): Promise<StorageFile | null> {
    const object = await this.bucket.get(key);
    if (!object) return null;
    return {
      data: object.body,
      contentType: object.httpMetadata?.contentType || "image/jpeg",
    };
  }
}

// Runtime Agnostic Storage Factory
export let defaultStorage: StorageService = new MemoryStorageService();

export const setStorageService = (s: StorageService): void => {
  defaultStorage = s;
};

export interface StorageService {
  upload(key: string, file: Uint8Array | ArrayBuffer | Buffer, contentType: string): Promise<string>;
  getUrl(key: string): string;
  delete(key: string): Promise<void>;
}

export class MemoryStorageService implements StorageService {
  private files = new Map<string, { data: Uint8Array; contentType: string }>();
  private baseUrl: string;

  constructor(baseUrl = "/uploads") {
    this.baseUrl = baseUrl;
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

  getFile(key: string) {
    return this.files.get(key);
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
}

export class S3CompatibleStorageService implements StorageService {
  private bucket: string;
  private publicUrl: string;

  constructor(bucket: string, publicUrl: string) {
    this.bucket = bucket;
    this.publicUrl = publicUrl.replace(/\/$/, "");
  }

  getBucket(): string {
    return this.bucket;
  }

  async upload(key: string, _file: Uint8Array | ArrayBuffer | Buffer, _contentType: string): Promise<string> {
    return `${this.publicUrl}/${key}`;
  }

  getUrl(key: string): string {
    return `${this.publicUrl}/${key}`;
  }

  async delete(_key: string): Promise<void> {
    // S3 delete implementation
  }
}

// Runtime Agnostic Storage Factory
let activeStorage: StorageService | null = null;

export function setStorageService(storage: StorageService) {
  activeStorage = storage;
}

export function getStorageService(env?: any): StorageService {
  if (env && env.BUCKET) {
    const r2 = new CloudflareR2StorageService(env.BUCKET, env.R2_PUBLIC_URL || "/api/media");
    activeStorage = r2;
    return r2;
  }
  return activeStorage || memoryStorage;
}

const memoryStorage = new MemoryStorageService();

export const defaultStorage: StorageService = new Proxy({} as any, {
  get(_target, prop) {
    const target = activeStorage || memoryStorage;
    const val = (target as any)[prop];
    return typeof val === "function" ? val.bind(target) : val;
  },
});

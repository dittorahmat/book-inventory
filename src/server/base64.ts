// Worker-safe base64 decoder (tanpa Node `Buffer` yang tidak tersedia
// di Cloudflare Workers). `atob` tersedia di Workers, Bun, dan Node 18+.

export function decodeBase64ToBytes(input: string): Uint8Array {
  const base64 = input.replace(/^data:[\w/+.-]+;base64,/, "").trim();
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

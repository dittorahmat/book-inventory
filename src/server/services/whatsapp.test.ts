import { describe, expect, it } from "bun:test";
import { InMemoryWhatsAppSender, normalizeIndonesianPhone } from "./whatsapp";

describe("WhatsApp sender seam", () => {
  it("normalizes Indonesian phone numbers", () => {
    expect(normalizeIndonesianPhone("08123456789")).toBe("628123456789");
    expect(normalizeIndonesianPhone("+62 812-3456-789")).toBe("628123456789");
    expect(normalizeIndonesianPhone("628123456789")).toBe("628123456789");
  });

  it("in-memory adapter records sends and injects one failure", async () => {
    const sender = new InMemoryWhatsAppSender();
    const ok = await sender.send({ to: "0812", text: "halo" });
    expect(ok.success).toBe(true);
    expect(ok.messageId).toMatch(/^wa-mem-/);
    expect(sender.sent.length).toBe(1);

    sender.failOnce("gateway padam");
    const failed = await sender.send({ to: "0812", text: "halo lagi" });
    expect(failed.success).toBe(false);
    expect(failed.error).toBe("gateway padam");

    const recovered = await sender.send({ to: "0812", text: "pulih" });
    expect(recovered.success).toBe(true);
    expect(sender.sent.length).toBe(2);
  });
});

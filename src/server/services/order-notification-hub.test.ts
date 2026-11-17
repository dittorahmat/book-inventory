import { describe, expect, it } from "bun:test";
import { db } from "../../db";
import { InMemoryWhatsAppSender } from "./whatsapp";
import { dispatchOrderNotification } from "./order-notification-hub";

describe("OrderNotificationHub Seam", () => {
  it("menolak jika nomor telepon tujuan kosong", async () => {
    const sender = new InMemoryWhatsAppSender();
    const res = await dispatchOrderNotification(
      db,
      {
        type: "payment_verified",
        input: {
          studentName: "Ahmad",
          orderNumber: "ORD-1",
          kind: "buku",
          amount: 500000,
        },
        recipientPhone: "   ",
      },
      sender
    );

    expect(res.success).toBe(false);
    expect(res.error).toContain("kosong");
    expect(sender.sent.length).toBe(0);
  });

  it("berhasil mengirimkan event payment_verified via InMemoryWhatsAppSender", async () => {
    const sender = new InMemoryWhatsAppSender();
    const res = await dispatchOrderNotification(
      db,
      {
        type: "payment_verified",
        input: {
          studentName: "Ahmad",
          orderNumber: "ORD-1",
          kind: "buku",
          amount: 500000,
          nis: "12345",
          pickupCode: "PK-123",
        },
        recipientPhone: "081234567890",
      },
      sender
    );

    expect(res.success).toBe(true);
    expect(sender.sent.length).toBe(1);
    expect(sender.sent[0].text).toContain("Ahmad");
    expect(sender.sent[0].text).toContain("PK-123");
  });

  it("berhasil mengirimkan event uniform_shipped dengan instruksi resi", async () => {
    const sender = new InMemoryWhatsAppSender();
    const res = await dispatchOrderNotification(
      db,
      {
        type: "uniform_shipped",
        input: {
          studentName: "Budi",
          orderNumber: "USO-100",
          shippingResi: "JNEX12345",
          isPaid: true,
        },
        recipientPhone: "08987654321",
      },
      sender
    );

    expect(res.success).toBe(true);
    expect(sender.sent.length).toBe(1);
    expect(sender.sent[0].text).toContain("JNEX12345");
    expect(sender.sent[0].text).toContain("Budi");
  });
});

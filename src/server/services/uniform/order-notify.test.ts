import { describe, expect, it } from "bun:test";
import {
  buildUniformOrderWhatsAppText,
  DEFAULT_UNIFORM_ORDER_WA_TEMPLATE,
  UNIFORM_ORDER_WA_TEMPLATE_KEY,
} from "./order-notify";

describe("Uniform order WhatsApp template & text generator", () => {
  it("uses canonical setting key and default template", () => {
    expect(UNIFORM_ORDER_WA_TEMPLATE_KEY).toBe("uniform_order_wa_template");
    expect(DEFAULT_UNIFORM_ORDER_WA_TEMPLATE).toContain("Terima kasih sudah memesan seragam");
    expect(DEFAULT_UNIFORM_ORDER_WA_TEMPLATE).toContain("{student_name}");
    expect(DEFAULT_UNIFORM_ORDER_WA_TEMPLATE).toContain("{order_number}");
  });

  it("replaces placeholders correctly in default template", () => {
    const text = buildUniformOrderWhatsAppText({
      parentName: "Budi",
      studentName: "Ahmad",
      orderNumber: "ORD-UNI-001",
      schoolName: "Al-Wildan 1",
    });

    expect(text).toContain("Budi");
    expect(text).toContain("Ahmad");
    expect(text).toContain("ORD-UNI-001");
    expect(text).toContain("Al-Wildan 1");
  });

  it("supports custom template from settings", () => {
    const customTemplate = "Salam {parent_name}, pesanan {order_number} untuk {student_name} telah kami catat.";
    const text = buildUniformOrderWhatsAppText({
      parentName: "Siti",
      studentName: "Fatimah",
      orderNumber: "ORD-UNI-999",
      schoolName: "Al-Wildan 3",
      template: customTemplate,
    });

    expect(text).toBe("Salam Siti, pesanan ORD-UNI-999 untuk Fatimah telah kami catat.");
  });
});

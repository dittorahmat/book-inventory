import { describe, expect, it } from "bun:test";
import { renderPurchaseOrderEmail, escapeHtml } from "./po-template";

describe("renderPurchaseOrderEmail", () => {
  const sample = {
    poNumber: "PO-202609-0099",
    orderDate: "2026-09-28",
    expectedArrivalDate: "2026-10-05",
    schoolName: "Al Wildan 1 (Islamic School Pusat)",
    supplierName: "PT Mentari Books Utama",
    items: [
      { title: "Cambridge Primary Mathematics Learner's Book 2", isbn: "978-1108746496", quantityOrdered: 50, unitPrice: 95000 },
      { title: "Cambridge Primary Science Learner's Book 2", isbn: "978-1108742733", quantityOrdered: 50, unitPrice: 90000 },
    ],
    totalAmount: 9250000,
    notes: "Kirim ke gudang pusat <b>segera</b> & konfirmasi.",
  };

  it("memuat semua field wajib PO", () => {
    const { subject, html, text } = renderPurchaseOrderEmail(sample);
    for (const needle of [
      "PO-202609-0099",
      "2026-09-28",
      "2026-10-05",
      "Al Wildan 1 (Islamic School Pusat)",
      "PT Mentari Books Utama",
      "Cambridge Primary Mathematics",
      "978-1108746496",
      "Rp 9.250.000",
    ]) {
      expect(html).toContain(needle);
    }
    expect(subject).toContain("PO-202609-0099");
    expect(text).toContain("PO-202609-0099");
    expect(text).toContain("Total Estimasi: Rp 9.250.000");
  });

  it("meng-escape HTML pada catatan dan nama", () => {
    const { html } = renderPurchaseOrderEmail(sample);
    expect(html).not.toContain("<b>segera</b>");
    expect(html).toContain("&lt;b&gt;segera&lt;/b&gt;");
    expect(html).toContain("&amp; konfirmasi.");
    expect(escapeHtml(`<script>alert("x")</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;"
    );
  });

  it("menghilangkan baris opsional bila kosong", () => {
    const { html, text } = renderPurchaseOrderEmail({
      ...sample,
      expectedArrivalDate: null,
      notes: null,
    });
    expect(html).not.toContain("Estimasi Tiba");
    expect(html).not.toContain("Catatan:");
    expect(text).not.toContain("Estimasi Tiba");
  });

  it("merender subtotal baris neto setelah diskon persen", () => {
    const { html } = renderPurchaseOrderEmail({
      ...sample,
      items: [
        { title: "Buku Diskon", isbn: "978-0000000000", quantityOrdered: 50, unitPrice: 95000, discountPercent: 10 },
      ],
      totalAmount: 4275000,
    });
    // 50 × 95.000 − 10% = Rp 4.275.000 (bukan Rp 4.750.000 kotor)
    expect(html).toContain("Rp 4.275.000");
    expect(html).not.toContain("Rp 4.750.000");
  });
});

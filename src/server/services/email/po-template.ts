export interface PoEmailItem {
  title: string;
  isbn: string;
  quantityOrdered: number;
  unitPrice: number;
}

export interface PoEmailData {
  poNumber: string;
  orderDate: string;
  expectedArrivalDate?: string | null;
  schoolName: string;
  supplierName: string;
  items: PoEmailItem[];
  totalAmount: number;
  notes?: string | null;
}

import { formatRupiah } from "../../../lib/transfer-pricing";

export function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

/** Template HTML email PO: satu sumber kebenaran isi email untuk supplier. */
export function renderPurchaseOrderEmail(po: PoEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Purchase Order ${po.poNumber} — Al Wildan School Logistics`;

  const rows = po.items
    .map(
      (it, idx) => `
        <tr>
          <td style="padding: 8px; border: 1px solid #E4E6EB; text-align: center;">${idx + 1}</td>
          <td style="padding: 8px; border: 1px solid #E4E6EB;">${escapeHtml(it.title)}</td>
          <td style="padding: 8px; border: 1px solid #E4E6EB; font-family: monospace;">${escapeHtml(it.isbn)}</td>
          <td style="padding: 8px; border: 1px solid #E4E6EB; text-align: center;">${it.quantityOrdered}</td>
          <td style="padding: 8px; border: 1px solid #E4E6EB; text-align: right;">${formatRupiah(it.unitPrice)}</td>
          <td style="padding: 8px; border: 1px solid #E4E6EB; text-align: right;">${formatRupiah(it.quantityOrdered * it.unitPrice)}</td>
        </tr>`
    )
    .join("");

  const html = `
<div style="font-family: sans-serif; color: #050505; max-width: 640px; margin: 0 auto;">
  <div style="border-bottom: 3px solid #1877F2; padding-bottom: 12px; margin-bottom: 16px;">
    <h2 style="margin: 0;">Al Wildan School Logistics</h2>
    <p style="margin: 4px 0 0; color: #65676B; font-size: 12px;">Purchase Order Pengadaan Buku</p>
  </div>
  <p>Yth. <strong>${escapeHtml(po.supplierName)}</strong>,</p>
  <p>Dengan hormat, kami mengajukan pesanan pengadaan buku sebagai berikut:</p>
  <table style="font-size: 13px; margin: 12px 0;">
    <tr><td style="color: #65676B;">Nomor PO</td><td style="padding-left: 12px;"><strong>${escapeHtml(po.poNumber)}</strong></td></tr>
    <tr><td style="color: #65676B;">Tanggal Order</td><td style="padding-left: 12px;">${escapeHtml(po.orderDate)}</td></tr>
    ${
      po.expectedArrivalDate
        ? `<tr><td style="color: #65676B;">Estimasi Tiba</td><td style="padding-left: 12px;">${escapeHtml(po.expectedArrivalDate)}</td></tr>`
        : ""
    }
    <tr><td style="color: #65676B;">Sekolah Tujuan</td><td style="padding-left: 12px;">${escapeHtml(po.schoolName)}</td></tr>
  </table>
  <table style="border-collapse: collapse; width: 100%; font-size: 13px;">
    <thead>
      <tr style="background: #F0F2F5;">
        <th style="padding: 8px; border: 1px solid #E4E6EB;">No</th>
        <th style="padding: 8px; border: 1px solid #E4E6EB;">Judul Buku</th>
        <th style="padding: 8px; border: 1px solid #E4E6EB;">ISBN</th>
        <th style="padding: 8px; border: 1px solid #E4E6EB;">Jumlah</th>
        <th style="padding: 8px; border: 1px solid #E4E6EB;">Harga Satuan</th>
        <th style="padding: 8px; border: 1px solid #E4E6EB;">Subtotal</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p style="text-align: right; font-size: 14px;">Total Estimasi: <strong>${formatRupiah(po.totalAmount)}</strong></p>
  ${
    po.notes
      ? `<p style="font-size: 13px;"><strong>Catatan:</strong> ${escapeHtml(po.notes)}</p>`
      : ""
  }
  <p style="font-size: 13px;">Mohon konfirmasi ketersediaan dan jadwal pengiriman. Terima kasih.</p>
  <p style="font-size: 12px; color: #65676B;">Hormat kami,<br/>Tim Logistik Al Wildan Islamic School</p>
</div>`;

  const text = [
    `Al Wildan School Logistics — Purchase Order ${po.poNumber}`,
    `Yth. ${po.supplierName}`,
    `Tanggal Order: ${po.orderDate}`,
    ...(po.expectedArrivalDate ? [`Estimasi Tiba: ${po.expectedArrivalDate}`] : []),
    `Sekolah Tujuan: ${po.schoolName}`,
    ``,
    ...po.items.map(
      (it, idx) =>
        `${idx + 1}. ${it.title} (ISBN: ${it.isbn}) x${it.quantityOrdered} @ ${formatRupiah(it.unitPrice)}`
    ),
    ``,
    `Total Estimasi: ${formatRupiah(po.totalAmount)}`,
    ...(po.notes ? [`Catatan: ${po.notes}`] : []),
  ].join("\n");

  return { subject, html, text };
}

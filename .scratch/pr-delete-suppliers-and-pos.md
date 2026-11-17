## Ringkasan Perubahan
Menambahkan fitur penghapusan data master supplier dan Purchase Order (PO Eksternal Buku, PO Eksternal Konveksi Seragam, dan PO Internal Cabang) dengan proteksi integritas relasional ketat (hard delete ber-guard):
1. **Delete Master Supplier** (#489): Single-writer `deleteSupplier`, endpoint `DELETE /api/procurement/suppliers/:id`, dan tombol aksi hapus di antarmuka `SupplierMasterSection.tsx`.
2. **Delete PO Internal Cabang (IPO)** (#490): Single-writer `deleteInternalPurchaseOrder`, endpoint `DELETE /api/internal-orders/:id`, dan tombol aksi hapus di antarmuka PO Internal.
3. **Delete PO Konveksi/Seragam** (#491): Single-writer `deleteUniformPo`, endpoint `DELETE /api/uniforms/purchase-orders/:id`, dan tombol aksi hapus di antarmuka PO Seragam.

Closes #489, closes #490, closes #491.

-- 1. Master Books
INSERT OR IGNORE INTO books (id, isbn, title, author, publisher, category, publish_year, created_at, updated_at) VALUES
('b-math-1', '978-1108746489', 'Cambridge Primary Mathematics Learner''s Book 1', 'Cherri Moseley', 'Cambridge University Press', 'Cambridge International', 2021, datetime('now'), datetime('now')),
('b-sci-1', '978-1108742726', 'Cambridge Primary Science Learner''s Book 1', 'Jon Board', 'Cambridge University Press', 'Cambridge International', 2021, datetime('now'), datetime('now')),
('b-eng-1', '978-1108719292', 'Cambridge Global English Learner''s Book 1', 'Elly Schottman', 'Cambridge University Press', 'Cambridge International', 2021, datetime('now'), datetime('now')),
('b-pai-1', '978-6022444985', 'Pendidikan Agama Islam dan Budi Pekerti Kelas 1', 'Drs. M. Daud', 'Kementerian Agama & Kemendikbud', 'Agama & Karakter', 2022, datetime('now'), datetime('now')),
('b-bindo-1', '978-6022444992', 'Bahasa Indonesia: Aku Bisa! Kelas 1', 'Sofie Dewayani', 'Pusat Kurikulum dan Perbukuan', 'Nasional', 2022, datetime('now'), datetime('now')),
('b-ppkn-1', '978-6022445005', 'Pendidikan Pancasila Kelas 1', 'Elisa Seftriyana', 'Kemendikbudristek', 'Nasional', 2022, datetime('now'), datetime('now')),
('b-arab-1', '978-6022445012', 'Bahasa Arab Dasar untuk Anak Shalih Kelas 1', 'Tim Asatidzah Al Wildan', 'Pustaka Al Wildan', 'Diniyyah', 2023, datetime('now'), datetime('now')),
('b-tahfidz-1', '978-6022445029', 'Buku Panduan Mutaba''ah Tahfidz Al-Qur''an Juz 30', 'Lembaga Tahfidz Al Wildan', 'Pustaka Al Wildan', 'Tahfidz', 2023, datetime('now'), datetime('now')),
('b-math-2', '978-1108746496', 'Cambridge Primary Mathematics Learner''s Book 2', 'Cherri Moseley', 'Cambridge University Press', 'Cambridge International', 2021, datetime('now'), datetime('now')),
('b-sci-2', '978-1108742733', 'Cambridge Primary Science Learner''s Book 2', 'Jon Board', 'Cambridge University Press', 'Cambridge International', 2021, datetime('now'), datetime('now')),
('b-eng-2', '978-1108719308', 'Cambridge Global English Learner''s Book 2', 'Elly Schottman', 'Cambridge University Press', 'Cambridge International', 2021, datetime('now'), datetime('now')),
('b-pai-2', '978-6022445036', 'Pendidikan Agama Islam dan Budi Pekerti Kelas 2', 'Drs. M. Daud', 'Kementerian Agama & Kemendikbud', 'Agama & Karakter', 2022, datetime('now'), datetime('now'));

-- 2. Book Packages (Bundles)
INSERT OR IGNORE INTO book_packages (id, code, name, grade_level, curriculum_type, academic_year, price, description, created_at, updated_at) VALUES
('pkg-sd1-int', 'PKG-SD1-INT', 'Paket Kelas 1 SD Internasional (Cambridge + Diniyyah)', '1', 'international', '2026/2027', 1850000, 'Paket lengkap 8 buku Cambridge + PAI + Bahasa Arab + Tahfidz.', datetime('now'), datetime('now')),
('pkg-sd1-nas', 'PKG-SD1-NAS', 'Paket Kelas 1 SD Nasional Plus', '1', 'national', '2026/2027', 950000, 'Paket kurikulum nasional terpadu dengan penguatan PAI dan Tahfidz.', datetime('now'), datetime('now')),
('pkg-sd2-int', 'PKG-SD2-INT', 'Paket Kelas 2 SD Internasional (Cambridge)', '2', 'international', '2026/2027', 1950000, 'Paket lanjutan Cambridge Mathematics, Science, English, dan PAI Kelas 2.', datetime('now'), datetime('now'));

-- 3. Package BOM Components
INSERT OR IGNORE INTO book_package_items (id, package_id, book_id, quantity, created_at) VALUES
('bom-sd1int-b-math-1', 'pkg-sd1-int', 'b-math-1', 1, datetime('now')),
('bom-sd1int-b-sci-1', 'pkg-sd1-int', 'b-sci-1', 1, datetime('now')),
('bom-sd1int-b-eng-1', 'pkg-sd1-int', 'b-eng-1', 1, datetime('now')),
('bom-sd1int-b-pai-1', 'pkg-sd1-int', 'b-pai-1', 1, datetime('now')),
('bom-sd1int-b-bindo-1', 'pkg-sd1-int', 'b-bindo-1', 1, datetime('now')),
('bom-sd1int-b-ppkn-1', 'pkg-sd1-int', 'b-ppkn-1', 1, datetime('now')),
('bom-sd1int-b-arab-1', 'pkg-sd1-int', 'b-arab-1', 1, datetime('now')),
('bom-sd1int-b-tahfidz-1', 'pkg-sd1-int', 'b-tahfidz-1', 1, datetime('now')),
('bom-sd1nas-b-pai-1', 'pkg-sd1-nas', 'b-pai-1', 1, datetime('now')),
('bom-sd1nas-b-bindo-1', 'pkg-sd1-nas', 'b-bindo-1', 1, datetime('now')),
('bom-sd1nas-b-ppkn-1', 'pkg-sd1-nas', 'b-ppkn-1', 1, datetime('now')),
('bom-sd1nas-b-tahfidz-1', 'pkg-sd1-nas', 'b-tahfidz-1', 1, datetime('now'));

-- 4. Ready Package Items (Bundles in Stock)
INSERT OR IGNORE INTO package_items (id, package_id, current_school_id, barcode, status, notes, created_at, updated_at) VALUES
('pki-sd1int-01', 'pkg-sd1-int', 'school-alw-1', 'PKG-ALW1-2026-0001', 'in_stock', 'Ready assembled bundle', datetime('now'), datetime('now')),
('pki-sd1int-02', 'pkg-sd1-int', 'school-alw-1', 'PKG-ALW1-2026-0002', 'in_stock', 'Ready assembled bundle', datetime('now'), datetime('now')),
('pki-sd1int-03', 'pkg-sd1-int', 'school-alw-1', 'PKG-ALW1-2026-0003', 'in_stock', 'Ready assembled bundle', datetime('now'), datetime('now')),
('pki-sd1int-04', 'pkg-sd1-int', 'school-alw-1', 'PKG-ALW1-2026-0004', 'in_stock', 'Ready assembled bundle', datetime('now'), datetime('now')),
('pki-sd1int-05', 'pkg-sd1-int', 'school-alw-1', 'PKG-ALW1-2026-0005', 'in_stock', 'Ready assembled bundle', datetime('now'), datetime('now'));

-- 5. Students
INSERT OR IGNORE INTO students (id, school_id, nis, name, gender, grade_level, curriculum_type, academic_year, parent_name, parent_email, parent_phone, status, is_scholarship, created_at, updated_at) VALUES
('std-hendra-1', 'school-alw-1', '2024101001', 'Hendra Wahyudi', 'male', '1', 'international', '2025/2026', 'Drs. Wahyudi Pratama', 'wahyudi.pratama@gmail.com', '+6281234567890', 'promoted', 0, datetime('now'), datetime('now')),
('std-aisyah-2', 'school-alw-1', '2024101002', 'Aisyah Nur Salsabila', 'female', '1', 'international', '2026/2027', 'Ir. Bambang Trihatmojo', 'bambang.tri@gmail.com', '+6281298765432', 'active', 0, datetime('now'), datetime('now')),
('std-farhan-3', 'school-alw-1', '2024101003', 'Muhammad Farhan Al-Ghifari', 'male', '1', 'international', '2026/2027', 'Ustadz Ghifari', 'ghifari.al@gmail.com', '+6281311223344', 'active', 1, datetime('now'), datetime('now')),
('std-nathan-4', 'school-alw-1', '2024101004', 'Nathaniel Arya', 'male', '1', 'national', '2026/2027', 'Dewi Sartika', 'dewi.sartika@gmail.com', '+6281555667788', 'active', 0, datetime('now'), datetime('now'));

-- 6. Student Book Orders & Payments & Returns
INSERT OR IGNORE INTO student_book_orders (id, order_number, student_id, school_id, package_id, order_type, payment_status, fulfillment_status, total_amount, paid_amount, handover_delivery_number, handover_date, handover_recipient, notes, created_at, updated_at) VALUES
('ord-aisyah-done', 'ORD-202609-001', 'std-aisyah-2', 'school-alw-1', 'pkg-sd1-int', 'regular', 'paid', 'picked_up', 1850000, 1850000, 'SJ-SERAH-202609-0012', datetime('now'), 'Ir. Bambang Trihatmojo (Ayah)', 'Lunas transfer BCA, diserahkan di loket logistik', datetime('now'), datetime('now')),
('ord-nathan-partial', 'ORD-202609-002', 'std-nathan-4', 'school-alw-1', 'pkg-sd1-nas', 'regular', 'partial', 'waiting_preparation', 950000, 500000, NULL, NULL, NULL, 'Ortu transfer gabungan SPP Rp 2.500.000 + Buku Rp 500.000 (Sisa Rp 450.000)', datetime('now'), datetime('now')),
('ord-farhan-sch', 'ORD-202609-003', 'std-farhan-3', 'school-alw-1', 'pkg-sd1-int', 'scholarship', 'scholarship_pending', 'waiting_preparation', 0, 0, NULL, NULL, NULL, 'Melampirkan rekomendasi beasiswa tahfidz 30 Juz', datetime('now'), datetime('now')),
('ord-hendra-unpaid', 'ORD-202609-004', 'std-hendra-1', 'school-alw-1', 'pkg-sd2-int', 'regular', 'unpaid', 'waiting_preparation', 1950000, 0, NULL, NULL, NULL, 'Siswa naik kelas, menunggu pembayaran ortu', datetime('now'), datetime('now'));

INSERT OR IGNORE INTO order_payments (id, order_id, transfer_amount, book_allocation_amount, bank_name, reference_number, notes, created_at) VALUES
('pay-aisyah-1', 'ord-aisyah-done', 1850000, 1850000, 'BCA', 'BCA-TRX-881920', 'Pembayaran lunas buku', datetime('now')),
('pay-nathan-1', 'ord-nathan-partial', 3000000, 500000, 'Mandiri', 'MND-TRX-551299', 'Transfer gabungan SPP dan cicilan buku', datetime('now'));

INSERT OR IGNORE INTO book_returns (id, order_id, student_id, defective_book_id, reason, photo_proof_url, status, created_at, updated_at) VALUES
('ret-demo-1', 'ord-aisyah-done', 'std-aisyah-2', 'b-math-1', 'Halaman 20 sampai 35 robek dan cetakan matematika buram tidak terbaca', '/api/media/returns/demo-buku-rusak.jpg', 'reported', datetime('now'), datetime('now'));

-- 7. Suppliers & PO
INSERT OR IGNORE INTO suppliers (id, code, name, contact_person, email, phone, address, created_at, updated_at) VALUES
('sup-erlangga', 'SUP-ERL', 'PT Penerbit Erlangga Mahameru', 'Drs. Hendro Wibowo', 'order@erlangga.co.id', '+62 21 8717888', 'Jl. H. Baping Raya No. 100, Ciracas, Jakarta Timur', datetime('now'), datetime('now')),
('sup-cambridge-mentari', 'SUP-MEN', 'PT Mentari Books Utama (Cambridge Official Distributor)', 'Lina Marlina, M.Ed', 'cambridge@mentaribooks.com', '+62 21 5890888', 'Rukan Puri Mutiara Blok A No. 15, Kembangan, Jakarta Barat', datetime('now'), datetime('now'));

INSERT OR IGNORE INTO purchase_orders (id, po_number, supplier_id, target_school_id, status, order_date, expected_arrival_date, total_amount, notes, created_at, updated_at) VALUES
('po-demo-001', 'PO-202609-0088', 'sup-cambridge-mentari', 'school-alw-1', 'partially_received', '2026-09-20', '2026-09-28', 18500000, 'Pengadaan awal Cambridge Math & Science Semester 1', datetime('now'), datetime('now'));

INSERT OR IGNORE INTO purchase_order_items (id, purchase_order_id, book_id, quantity_ordered, quantity_received, unit_price, created_at) VALUES
('poi-demo-1', 'po-demo-001', 'b-math-1', 100, 40, 95000, datetime('now')),
('poi-demo-2', 'po-demo-001', 'b-sci-1', 100, 40, 90000, datetime('now'));

-- 8. SMTP Settings
INSERT OR IGNORE INTO system_settings (key, value, description, updated_at) VALUES
('smtp_host', 'smtp.gmail.com', 'Default SMTP Host', datetime('now'));

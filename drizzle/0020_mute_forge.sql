ALTER TABLE `student_book_orders` ADD `home_address_snapshot` text;--> statement-breakpoint
ALTER TABLE `student_book_orders` ADD `satuan_shipment_status` text DEFAULT 'belum_dikirim' NOT NULL;--> statement-breakpoint
ALTER TABLE `student_book_orders` ADD `satuan_shipped_at` text;--> statement-breakpoint
CREATE INDEX `orders_school_satuan_ship_idx` ON `student_book_orders` (`school_id`,`satuan_shipment_status`);
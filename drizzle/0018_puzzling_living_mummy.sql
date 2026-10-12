CREATE TABLE `uniform_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`claim_number` text NOT NULL,
	`school_id` text NOT NULL,
	`period` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`total_qty` integer DEFAULT 0 NOT NULL,
	`total_amount` integer DEFAULT 0 NOT NULL,
	`locked_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniform_claims_claim_number_unique` ON `uniform_claims` (`claim_number`);--> statement-breakpoint
CREATE INDEX `uniform_claims_school_period_idx` ON `uniform_claims` (`school_id`,`period`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniform_claims_school_period_unq` ON `uniform_claims` (`school_id`,`period`);--> statement-breakpoint
CREATE TABLE `uniform_exchanges` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`student_id` text NOT NULL,
	`old_variant_id` text NOT NULL,
	`old_size` text NOT NULL,
	`new_variant_id` text NOT NULL,
	`new_size` text NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'requested' NOT NULL,
	`handled_by_user_id` text,
	`resolved_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `uniform_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`old_variant_id`) REFERENCES `uniform_variants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`new_variant_id`) REFERENCES `uniform_variants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`handled_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `uniform_exchanges_status_idx` ON `uniform_exchanges` (`status`);--> statement-breakpoint
CREATE INDEX `uniform_exchanges_order_idx` ON `uniform_exchanges` (`order_id`);--> statement-breakpoint
CREATE TABLE `uniform_order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`package_id` text,
	`variant_id` text,
	`size` text DEFAULT '—' NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`unit_price_snapshot` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `uniform_orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`package_id`) REFERENCES `uniform_packages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`variant_id`) REFERENCES `uniform_variants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `uniform_order_items_order_idx` ON `uniform_order_items` (`order_id`);--> statement-breakpoint
CREATE TABLE `uniform_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`order_number` text NOT NULL,
	`student_id` text NOT NULL,
	`school_id` text NOT NULL,
	`academic_year` text NOT NULL,
	`home_address_snapshot` text NOT NULL,
	`shipment_status` text DEFAULT 'belum_dikirim' NOT NULL,
	`shipped_at` text,
	`total_amount` integer DEFAULT 0 NOT NULL,
	`paid_amount` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniform_orders_order_number_unique` ON `uniform_orders` (`order_number`);--> statement-breakpoint
CREATE INDEX `uniform_orders_school_number_idx` ON `uniform_orders` (`school_id`,`order_number`);--> statement-breakpoint
CREATE INDEX `uniform_orders_school_shipment_idx` ON `uniform_orders` (`school_id`,`shipment_status`);--> statement-breakpoint
CREATE INDEX `uniform_orders_student_idx` ON `uniform_orders` (`student_id`);--> statement-breakpoint
CREATE TABLE `uniform_package_bom` (
	`id` text PRIMARY KEY NOT NULL,
	`package_id` text NOT NULL,
	`variant_id` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`package_id`) REFERENCES `uniform_packages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`variant_id`) REFERENCES `uniform_variants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `uniform_bom_package_idx` ON `uniform_package_bom` (`package_id`);--> statement-breakpoint
CREATE TABLE `uniform_packages` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`academic_year` text NOT NULL,
	`price` integer DEFAULT 0 NOT NULL,
	`description` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniform_packages_code_unique` ON `uniform_packages` (`code`);--> statement-breakpoint
CREATE TABLE `uniform_po_items` (
	`id` text PRIMARY KEY NOT NULL,
	`po_id` text NOT NULL,
	`variant_id` text NOT NULL,
	`size` text DEFAULT '—' NOT NULL,
	`quantity_ordered` integer NOT NULL,
	`quantity_received` integer DEFAULT 0 NOT NULL,
	`unit_price` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`po_id`) REFERENCES `uniform_pos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`variant_id`) REFERENCES `uniform_variants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `uniform_po_items_po_idx` ON `uniform_po_items` (`po_id`);--> statement-breakpoint
CREATE TABLE `uniform_pos` (
	`id` text PRIMARY KEY NOT NULL,
	`po_number` text NOT NULL,
	`supplier_id` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`order_date` text NOT NULL,
	`total_amount` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniform_pos_po_number_unique` ON `uniform_pos` (`po_number`);--> statement-breakpoint
CREATE INDEX `uniform_pos_supplier_idx` ON `uniform_pos` (`supplier_id`);--> statement-breakpoint
CREATE TABLE `uniform_refunds` (
	`id` text PRIMARY KEY NOT NULL,
	`refund_number` text NOT NULL,
	`order_id` text NOT NULL,
	`student_id` text NOT NULL,
	`amount` integer DEFAULT 0 NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'requested' NOT NULL,
	`handled_by_user_id` text,
	`resolved_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `uniform_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`handled_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniform_refunds_refund_number_unique` ON `uniform_refunds` (`refund_number`);--> statement-breakpoint
CREATE INDEX `uniform_refunds_order_idx` ON `uniform_refunds` (`order_id`);--> statement-breakpoint
CREATE INDEX `uniform_refunds_status_idx` ON `uniform_refunds` (`status`);--> statement-breakpoint
CREATE TABLE `uniform_sizes` (
	`id` text PRIMARY KEY NOT NULL,
	`variant_id` text NOT NULL,
	`size` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`variant_id`) REFERENCES `uniform_variants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `uniform_sizes_variant_idx` ON `uniform_sizes` (`variant_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniform_sizes_variant_size_unq` ON `uniform_sizes` (`variant_id`,`size`);--> statement-breakpoint
CREATE TABLE `uniform_stock` (
	`id` text PRIMARY KEY NOT NULL,
	`variant_id` text NOT NULL,
	`size` text DEFAULT '—' NOT NULL,
	`quantity` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`variant_id`) REFERENCES `uniform_variants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `uniform_stock_variant_idx` ON `uniform_stock` (`variant_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniform_stock_variant_size_unq` ON `uniform_stock` (`variant_id`,`size`);--> statement-breakpoint
CREATE TABLE `uniform_variants` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`gender` text NOT NULL,
	`jenjang` text NOT NULL,
	`academic_year` text NOT NULL,
	`price` integer DEFAULT 0 NOT NULL,
	`size_chart_url` text,
	`description` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniform_variants_code_unique` ON `uniform_variants` (`code`);--> statement-breakpoint
CREATE INDEX `uniform_variants_kind_gender_jenjang_idx` ON `uniform_variants` (`kind`,`gender`,`jenjang`);
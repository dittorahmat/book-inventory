PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_internal_shipments` (
	`id` text PRIMARY KEY NOT NULL,
	`internal_po_id` text,
	`destination_school_id` text,
	`delivery_note_number` text NOT NULL,
	`transfer_shipment_id` text,
	`shipped_date` text NOT NULL,
	`received_date` text,
	`status` text DEFAULT 'in_transit' NOT NULL,
	`shipped_by_user_id` text,
	`received_by_user_id` text,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`internal_po_id`) REFERENCES `internal_purchase_orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`destination_school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`transfer_shipment_id`) REFERENCES `transfer_shipments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`shipped_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`received_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_internal_shipments`("id", "internal_po_id", "destination_school_id", "delivery_note_number", "transfer_shipment_id", "shipped_date", "received_date", "status", "shipped_by_user_id", "received_by_user_id", "notes", "created_at", "updated_at") SELECT "id", "internal_po_id", "destination_school_id", "delivery_note_number", "transfer_shipment_id", "shipped_date", "received_date", "status", "shipped_by_user_id", "received_by_user_id", "notes", "created_at", "updated_at" FROM `internal_shipments`;--> statement-breakpoint
DROP TABLE `internal_shipments`;--> statement-breakpoint
ALTER TABLE `__new_internal_shipments` RENAME TO `internal_shipments`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `internal_shipments_delivery_note_number_unique` ON `internal_shipments` (`delivery_note_number`);--> statement-breakpoint
CREATE INDEX `internal_shipments_destination_idx` ON `internal_shipments` (`destination_school_id`);--> statement-breakpoint
CREATE INDEX `internal_shipments_transfer_idx` ON `internal_shipments` (`transfer_shipment_id`);--> statement-breakpoint
CREATE INDEX `internal_shipments_po_idx` ON `internal_shipments` (`internal_po_id`);
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_transfer_shipment_items` (
	`id` text PRIMARY KEY NOT NULL,
	`shipment_id` text NOT NULL,
	`item_type` text DEFAULT 'loose' NOT NULL,
	`book_item_id` text,
	`package_id` text,
	`quantity` integer DEFAULT 1 NOT NULL,
	`unit_price_snapshot` integer DEFAULT 0 NOT NULL,
	`received_condition` text,
	`notes` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`shipment_id`) REFERENCES `transfer_shipments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_item_id`) REFERENCES `book_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_transfer_shipment_items`("id", "shipment_id", "item_type", "book_item_id", "package_id", "quantity", "unit_price_snapshot", "received_condition", "notes", "created_at") SELECT "id", "shipment_id", 'loose', "book_item_id", NULL, 1, 0, "received_condition", "notes", "created_at" FROM `transfer_shipment_items`;--> statement-breakpoint
DROP TABLE `transfer_shipment_items`;--> statement-breakpoint
ALTER TABLE `__new_transfer_shipment_items` RENAME TO `transfer_shipment_items`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `books` ADD `price` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `transfer_shipments` ADD `total_declared_value` integer DEFAULT 0 NOT NULL;
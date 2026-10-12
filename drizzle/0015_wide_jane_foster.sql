ALTER TABLE `internal_shipment_items` ADD `received_condition` text;--> statement-breakpoint
ALTER TABLE `internal_shipment_items` ADD `received_notes` text;--> statement-breakpoint
ALTER TABLE `internal_shipments` ADD `transfer_shipment_id` text REFERENCES transfer_shipments(id);--> statement-breakpoint
ALTER TABLE `purchase_order_receipt_items` ADD `condition` text DEFAULT 'good' NOT NULL;
CREATE INDEX `internal_po_items_po_idx` ON `internal_purchase_order_items` (`internal_po_id`);--> statement-breakpoint
CREATE INDEX `internal_po_school_idx` ON `internal_purchase_orders` (`school_id`);--> statement-breakpoint
CREATE INDEX `internal_shipments_po_idx` ON `internal_shipments` (`internal_po_id`);
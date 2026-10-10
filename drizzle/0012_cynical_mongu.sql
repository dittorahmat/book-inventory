CREATE INDEX `shipment_lines_shipment_idx` ON `transfer_shipment_items` (`shipment_id`);--> statement-breakpoint
CREATE INDEX `shipments_from_status_idx` ON `transfer_shipments` (`from_school_id`,`status`);--> statement-breakpoint
CREATE INDEX `shipments_to_status_idx` ON `transfer_shipments` (`to_school_id`,`status`);
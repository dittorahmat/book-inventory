CREATE TABLE `uniform_package_stock` (
	`id` text PRIMARY KEY NOT NULL,
	`package_id` text NOT NULL,
	`quantity` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`package_id`) REFERENCES `uniform_packages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniform_package_stock_package_unq` ON `uniform_package_stock` (`package_id`);--> statement-breakpoint
ALTER TABLE `uniform_package_bom` ADD `size` text DEFAULT '—' NOT NULL;
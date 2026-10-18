ALTER TABLE `branch_charges` ADD `finalized_at` text;--> statement-breakpoint
ALTER TABLE `uniform_claims` ADD `goods_amount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `uniform_claims` ADD `shipping_amount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `uniform_claims` SET `goods_amount` = `total_amount`;--> statement-breakpoint
UPDATE `branch_charges` SET `finalized_at` = `chargeable_at` WHERE `status` = 'final';
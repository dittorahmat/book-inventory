-- Cloudflare D1 Migration for Better-Auth support
CREATE TABLE IF NOT EXISTS `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS `sessions_token_unique` ON `sessions` (`token`);

CREATE TABLE IF NOT EXISTS `verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer
);

-- Recreate users table to match better-auth schema
PRAGMA foreign_keys=OFF;
DROP TABLE IF EXISTS `__new_users`;
CREATE TABLE `__new_users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT 0 NOT NULL,
	`image` text,
	`role` text DEFAULT 'branch_admin' NOT NULL,
	`school_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action
);

INSERT INTO `__new_users`("id", "name", "email", "role", "school_id", "created_at", "updated_at")
SELECT "id", "name", "email", "role", "school_id", 0, 0 FROM `users`;

DROP TABLE `users`;
ALTER TABLE `__new_users` RENAME TO `users`;
CREATE UNIQUE INDEX IF NOT EXISTS `users_email_unique` ON `users` (`email`);
PRAGMA foreign_keys=ON;

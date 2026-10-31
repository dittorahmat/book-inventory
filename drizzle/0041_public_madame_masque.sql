ALTER TABLE `uniform_exchanges` ADD `courier_resi` text;--> statement-breakpoint
ALTER TABLE `uniform_exchanges` ADD `replacement_resi` text;--> statement-breakpoint
ALTER TABLE `uniform_exchanges` ADD `estimated_ship_date` text;
--> statement-breakpoint
-- Pindahkan pelacakan penukaran lama dari JSON `uniform_exchange_sports_*`
-- ke kolom baris exchange (non-destruktif; baris KV tidak dihapus).
UPDATE `uniform_exchanges`
SET
	`courier_resi` = coalesce(
		`courier_resi`,
		(SELECT nullif(json_extract(s.value, '$.courierResi'), '')
		 FROM `system_settings` s
		 WHERE s.`key` = 'uniform_exchange_sports_' || `uniform_exchanges`.`id` AND json_valid(s.value))
	),
	`replacement_resi` = coalesce(
		`replacement_resi`,
		(SELECT nullif(json_extract(s.value, '$.replacementResi'), '')
		 FROM `system_settings` s
		 WHERE s.`key` = 'uniform_exchange_sports_' || `uniform_exchanges`.`id` AND json_valid(s.value))
	),
	`estimated_ship_date` = coalesce(
		`estimated_ship_date`,
		(SELECT nullif(json_extract(s.value, '$.estimatedShipDate'), '')
		 FROM `system_settings` s
		 WHERE s.`key` = 'uniform_exchange_sports_' || `uniform_exchanges`.`id` AND json_valid(s.value))
	)
WHERE EXISTS (
	SELECT 1 FROM `system_settings` s
	WHERE s.`key` = 'uniform_exchange_sports_' || `uniform_exchanges`.`id`
		AND json_valid(s.value)
);
CREATE TABLE `weekly_report_subscriptions` (
	`organization_id` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`last_sent_at` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `weekly_report_subscriptions_enabled_idx` ON `weekly_report_subscriptions` (`enabled`);--> statement-breakpoint
INSERT INTO `weekly_report_subscriptions` (`organization_id`, `enabled`)
SELECT `id`, 1 FROM `organization`;

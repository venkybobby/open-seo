CREATE TABLE `tenants` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`agency_name` text NOT NULL,
	`logo_url` text,
	`primary_color` text,
	`custom_domain` text,
	`stripe_customer_id` text,
	`plan` text DEFAULT 'freelancer' NOT NULL,
	`dataforseo_key_encrypted` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_slug_uidx` ON `tenants` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_custom_domain_uidx` ON `tenants` (`custom_domain`);--> statement-breakpoint
CREATE INDEX `tenants_status_idx` ON `tenants` (`status`);--> statement-breakpoint
CREATE TABLE `organization_tenants` (
	`organization_id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `organization_tenants_tenant_idx` ON `organization_tenants` (`tenant_id`);--> statement-breakpoint
INSERT INTO `tenants` (`id`, `slug`, `agency_name`, `plan`, `status`)
VALUES ('default', 'default', 'OpenSEO', 'agency_pro', 'active');
--> statement-breakpoint
INSERT INTO `organization_tenants` (`organization_id`, `tenant_id`)
SELECT `id`, 'default' FROM `organization`;

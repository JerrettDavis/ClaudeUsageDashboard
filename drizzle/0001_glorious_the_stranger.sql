ALTER TABLE `sessions` ADD `cwd` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `git_branch` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `version` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `last_summary` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `files_modified` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `folders_accessed` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `file_count` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `sessions` ADD `tool_usage_count` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `sessions` ADD `last_activity` integer;--> statement-breakpoint
CREATE INDEX `sessions_provider_idx` ON `sessions` (`provider_id`);--> statement-breakpoint
CREATE INDEX `sessions_start_time_idx` ON `sessions` (`start_time`);--> statement-breakpoint
CREATE INDEX `sessions_status_idx` ON `sessions` (`status`);--> statement-breakpoint
CREATE INDEX `sessions_last_activity_idx` ON `sessions` (`last_activity`);
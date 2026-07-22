ALTER TABLE `site_config` ADD COLUMN `background_preset` text NOT NULL DEFAULT 'white';
ALTER TABLE `site_config` ADD COLUMN `content_width` text NOT NULL DEFAULT 'medium';
ALTER TABLE `site_config` ADD COLUMN `text_style` text NOT NULL DEFAULT 'classic';

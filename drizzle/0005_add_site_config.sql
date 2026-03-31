CREATE TABLE IF NOT EXISTS `site_config` (
  `id`                          integer PRIMARY KEY NOT NULL DEFAULT 1,
  `site_title`                  text NOT NULL DEFAULT 'My Blog',
  `site_tagline`                text NOT NULL DEFAULT '',
  `site_logo_key`               text NOT NULL DEFAULT '',
  `copyright_notice`            text NOT NULL DEFAULT '',
  `author_name`                 text NOT NULL DEFAULT '',
  `author_email`                text NOT NULL DEFAULT '',
  `twitter_url`                 text NOT NULL DEFAULT '',
  `github_url`                  text NOT NULL DEFAULT '',
  `linkedin_url`                text NOT NULL DEFAULT '',
  `mastodon_url`                text NOT NULL DEFAULT '',
  `og_image_url`                text NOT NULL DEFAULT '',
  `favicon_url`                 text NOT NULL DEFAULT '',
  `robots_meta`                 text NOT NULL DEFAULT 'index,follow',
  `analytics_id`                text NOT NULL DEFAULT '',
  `unsplash_attribution_source` text NOT NULL DEFAULT '',
  CONSTRAINT `site_config_single_row` CHECK (`id` = 1)
);
--> statement-breakpoint
INSERT OR IGNORE INTO `site_config` (`id`) VALUES (1);

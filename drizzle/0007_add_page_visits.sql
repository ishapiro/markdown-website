CREATE TABLE IF NOT EXISTS `page_visits` (
  `id`               integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id`          integer REFERENCES `users`(`id`),
  `visitor_id`       text,
  `path`             text NOT NULL,
  `started_at`       integer NOT NULL,
  `duration_seconds` integer,
  `referrer`         text,
  `utm_source`       text,
  `utm_medium`       text,
  `utm_campaign`     text,
  `country`          text,
  `city`             text
);
CREATE INDEX IF NOT EXISTS `page_visits_path_idx`       ON `page_visits` (`path`);
CREATE INDEX IF NOT EXISTS `page_visits_started_at_idx` ON `page_visits` (`started_at`);
CREATE INDEX IF NOT EXISTS `page_visits_user_id_idx`    ON `page_visits` (`user_id`);

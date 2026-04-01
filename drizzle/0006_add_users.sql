CREATE TABLE IF NOT EXISTS `users` (
  `id`            integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `email`         text NOT NULL,
  `name`          text,
  `google_sub`    text,
  `role`          text NOT NULL DEFAULT 'user'
                  CHECK(`role` IN ('user', 'author', 'admin')),
  `about`         text,
  `avatar_url`    text,
  `created_at`    integer NOT NULL,
  `last_login_at` integer
);
CREATE UNIQUE INDEX IF NOT EXISTS `users_email_unique`
  ON `users` (`email`);
CREATE UNIQUE INDEX IF NOT EXISTS `users_google_sub_unique`
  ON `users` (`google_sub`) WHERE `google_sub` IS NOT NULL;

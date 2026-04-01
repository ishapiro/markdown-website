import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const notes = sqliteTable('notes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  parentPath: text('parent_path').notNull().default('/'),
  contentPreview: text('content_preview').default(''),
  r2Key: text('r2_key').notNull(),
  sortOrder: integer('sort_order'),  // nullable; lower numbers sort first
  isPublished: integer('is_published', { mode: 'boolean' }).notNull().default(true),
  isFolder: integer('is_folder', { mode: 'boolean' }).notNull().default(false),
  showDate: integer('show_date', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

export type Note = typeof notes.$inferSelect
export type NewNote = typeof notes.$inferInsert

export const tags = sqliteTable('tags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
})

export const noteTags = sqliteTable('note_tags', {
  noteId: integer('note_id').notNull().references(() => notes.id),
  tagId: integer('tag_id').notNull().references(() => tags.id),
})

export const siteConfig = sqliteTable('site_config', {
  id: integer('id').primaryKey().default(1),
  siteTitle: text('site_title').notNull().default('My Blog'),
  siteTagline: text('site_tagline').notNull().default(''),
  siteLogoKey: text('site_logo_key').notNull().default(''),
  copyrightNotice: text('copyright_notice').notNull().default(''),
  authorName: text('author_name').notNull().default(''),
  authorEmail: text('author_email').notNull().default(''),
  twitterUrl: text('twitter_url').notNull().default(''),
  githubUrl: text('github_url').notNull().default(''),
  linkedinUrl: text('linkedin_url').notNull().default(''),
  mastodonUrl: text('mastodon_url').notNull().default(''),
  ogImageUrl: text('og_image_url').notNull().default(''),
  faviconUrl: text('favicon_url').notNull().default(''),
  robotsMeta: text('robots_meta').notNull().default('index,follow'),
  analyticsId: text('analytics_id').notNull().default(''),
  unsplashAttributionSource: text('unsplash_attribution_source').notNull().default(''),
  homePage: text('home_page').notNull().default('/home'),
})

export type SiteConfig = typeof siteConfig.$inferSelect
export type SiteConfigUpdate = Omit<typeof siteConfig.$inferInsert, 'id'>

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  name: text('name'),
  googleSub: text('google_sub').unique(),
  role: text('role', { enum: ['user', 'author', 'admin'] }).notNull().default('user'),
  about: text('about'),
  avatarUrl: text('avatar_url'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

export const pageVisits = sqliteTable('page_visits', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').references(() => users.id),
  visitorId: text('visitor_id'),
  path: text('path').notNull(),
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
  durationSeconds: integer('duration_seconds'),
  referrer: text('referrer'),
  utmSource: text('utm_source'),
  utmMedium: text('utm_medium'),
  utmCampaign: text('utm_campaign'),
  country: text('country'),
  city: text('city'),
})

export type PageVisit = typeof pageVisits.$inferSelect

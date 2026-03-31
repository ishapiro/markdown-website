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

# Cogitations — Markdown Blog & Wiki Platform

A full-featured, Markdown-based blogging and personal knowledge base platform built with Nuxt 3, deployed on Cloudflare Workers. Content is stored as Markdown notes in a hierarchical folder structure, served from a SQLite database (Cloudflare D1), with media files in Cloudflare R2 object storage.

Live at: `cogitations.com` / `blog.cogitations.com`

---

## Tech Stack

- **Framework:** Nuxt 3 + Vue 3 (Composition API, `<script setup>`)
- **Styling:** Tailwind CSS
- **Database:** Cloudflare D1 (SQLite) via Drizzle ORM
- **File Storage:** Cloudflare R2
- **Deployment:** Cloudflare Workers
- **AI:** Google Gemini (streaming assistant + image generation)
- **Auth:** Google OAuth + password-based emergency admin access

---

## Features

- **Content management** — create, edit, and organize Markdown notes in a folder hierarchy
- **Rich Markdown editor** — CodeMirror-based editor with WikiLink support (`[[Note Title]]`) and Obsidian-style image embeds (`![[image.jpg]]`)
- **Full-text search** — SQLite FTS across all published content
- **AI assistant** — streaming Gemini chat and AI image generation inside the editor
- **Image management** — upload to R2, search Unsplash, generate with AI; resize/edit image properties
- **User management** — multi-role system (user / author / admin) with Google OAuth
- **Analytics dashboard** — page visit tracking with geo-location, UTM params, and session duration
- **Site configuration** — title, tagline, logo, SEO settings, Google Analytics, home page, author info

---

## Setup

Copy `.dev.vars.example` to `.dev.vars` and fill in all values:

```
NUXT_ADMIN_PASSWORD=          # Emergency admin password
NUXT_SYSTEM_GEMINI_KEY=       # Google Gemini API key
NUXT_UNSPLASH_ACCESS_KEY=     # Unsplash API key
NUXT_GOOGLE_CLIENT_ID=        # Google OAuth client ID
NUXT_GOOGLE_CLIENT_SECRET=    # Google OAuth client secret
NUXT_SESSION_SECRET=          # JWT secret (openssl rand -base64 32)
NUXT_OAUTH_REDIRECT_ORIGIN=   # Optional: override OAuth redirect URL
```

Install dependencies:

```bash
npm install
```

---

## npm Scripts

### Development & Deployment

| Command | Description |
|---|---|
| `npm run dev` | Build + start local Wrangler dev server on port 3001 |
| `npm run build` | Build for Cloudflare Workers (output to `.output/`) |
| `npm run preview` | Start Wrangler dev server against an existing build |
| `npm run deploy` | Build and deploy to Cloudflare Workers |

### Database — Local

| Command | Description |
|---|---|
| `npm run db:generate` | Generate Drizzle migration files from schema changes |
| `npm run db:migrate` | Apply pending migrations to the **local** D1 database |
| `npm run db:studio` | Open Drizzle Studio UI against the local SQLite database |
| `npm run db:backup` | Snapshot the local database to `db-backups/` |
| `npm run db:restore` | Restore the local database from a backup |
| `npm run db:restore:list` | List available local database backups |

### Database — Remote (Cloudflare D1)

| Command | Description |
|---|---|
| `npm run db:migrate:remote` | Apply pending migrations to the **remote** Cloudflare D1 database |
| `npm run db:studio:remote` | Open Drizzle Studio UI connected to the remote D1 database |

### Cloudflare R2 Storage

| Command | Description |
|---|---|
| `npm run push:cloudflare` | Push local files/assets to the Cloudflare R2 bucket |
| `npm run backup:cloudflare` | Backup the R2 bucket contents locally |
| `npm run backup:cloudflare:list` | List available R2 backups |
| `npm run restore:cloudflare` | Restore R2 bucket from a local backup |
| `npm run restore:cloudflare:list` | List available R2 restore points |

### Other

| Command | Description |
|---|---|
| `npm run migrate` | Run the standalone `migrate.mjs` migration helper |

---

## Project Structure

```
markdown-website/
├── components/       # Vue components (editor, sidebar, admin UI)
├── composables/      # Shared Vue composables
├── drizzle/          # Drizzle migration files
├── layouts/          # Nuxt layouts (default, admin)
├── middleware/        # Route auth guards
├── pages/            # File-based routing
│   ├── index.vue            # Redirects to configured home note
│   ├── [...slug].vue        # Public Markdown note renderer
│   └── admin/
│       ├── index.vue        # Main editor + sidebar
│       ├── login.vue        # Login (password + Google OAuth)
│       ├── users.vue        # User management
│       └── analytics.vue    # Analytics dashboard
├── server/
│   ├── api/
│   │   ├── admin/    # Admin-only API routes
│   │   └── ...       # Public API routes (notes, search, navigation)
│   └── utils/
│       └── db/       # Drizzle schema and database helpers
├── public/           # Static assets
├── .dev.vars.example # Environment variable template
├── drizzle.config.ts # Drizzle ORM configuration
├── nuxt.config.ts    # Nuxt configuration
└── wrangler.toml     # Cloudflare Workers configuration
```

---

## Database Schema

Tables managed by Drizzle ORM (defined in `server/utils/db/schema.ts`):

- **notes** — content, slug, publish state, folder, sort order, metadata
- **folders** — hierarchical folder structure
- **users** — user accounts with roles (user / author / admin)
- **sessions** — JWT session tracking
- **visits** — page visit analytics (geo, UTM, duration)
- **site_config** — key/value site settings

---

## API Overview

**Public routes** (no auth required):
- `GET /api/config` — site configuration
- `GET /api/navigation` — folder/note tree
- `GET /api/notes/[...slug]` — fetch a published note
- `GET /api/search` — full-text search
- `GET /api/images/[...key]` — serve image from R2
- `POST /api/tracking/visit` — record a page visit

**Admin routes** (`/api/admin/*`, require admin session):
- Notes CRUD, folder management, file uploads
- User management
- Site configuration
- AI assistant (`/api/admin/ask`) and image generation
- Unsplash search and save
- Search reindex, analytics

---

## Deployment

The app deploys as a Cloudflare Worker with:
- **D1 database** binding: `cogitations-db`
- **R2 bucket** binding: `cogitations-vault`
- **Custom domains**: `cogitations.com`, `blog.cogitations.com`

```bash
npm run deploy
```

For first-time deployment, run remote migrations after deploying:

```bash
npm run db:migrate:remote
```

# DYL Real-Estate Services API

Express + Postgres backend for DYL Real-Estate Services — auth, property
listings, blog posts, and the admin console. This is the same backend used
by both the React apps and the static HTML/CSS/JS sites; either frontend
just needs this running and pointed at the right URL.

## Quick start

You need a Postgres database to point this at — a local install, Docker, or
a free hosted instance (Neon, Vercel Postgres, Supabase, Railway, etc all
work).

```bash
npm install
cp .env.example .env      # then set DATABASE_URL to your Postgres instance
npm run migrate            # creates the schema
npm run seed               # optional: adds demo listings, a demo owner account, and sample blog posts
npm start                  # → http://localhost:4000
```

Leave this running in its own terminal — the frontend(s) call out to it for
every request.

## Deploying on Vercel

This is already set up for it: `vercel.json` routes every request to
`api/index.js`, which just exports the same Express app used locally (Vercel
invokes it directly, no wrapper needed).

1. Provision a Postgres database (Vercel Postgres, Neon, Supabase, etc.) and
   grab its connection string.
2. In the Vercel project settings for this repo, set the **Root Directory**
   to `backend/`, and add these Environment Variables: `DATABASE_URL`,
   `JWT_SECRET`, `JWT_EXPIRES_IN`, `CLIENT_ORIGIN`, `ADMIN_ORIGIN` (set the
   last two to your deployed frontend URLs, once you have them, to lock
   CORS down).
3. Run `npm run migrate` once against that same `DATABASE_URL` (from your
   own machine, with it set in your local `.env`) to create the schema —
   Vercel doesn't run this for you automatically.
4. Deploy. Your API will be live at `https://<your-project>.vercel.app/api/...`.
5. Point your frontend(s) at that URL (see `js/config.js` in each site).

## Default accounts (after `npm run seed`)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@dylrealestateservices.com` | `ChangeMe123!` (or your `SEED_ADMIN_PASSWORD`) |
| Demo user | `owner@dylrealestateservices.com` | `Password123!` |

**Change these before deploying anywhere real** — they're seeded from
`.env` (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`), so edit `.env` before
first run if you want different defaults.

## CORS

By default `CLIENT_ORIGIN` / `ADMIN_ORIGIN` are commented out in
`.env.example`, so the API accepts requests from any origin — this is what
lets you open the static site with VS Code's Live Server (or anything else)
without a CORS error. Before deploying somewhere real, uncomment those two
lines in `.env` and set them to your actual frontend URLs to lock it down.

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | — | Create an account |
| POST | `/api/auth/login` | — | Log in, returns JWT |
| GET | `/api/auth/me` | user | Current user from token |
| GET | `/api/properties` | — | Search/filter/paginate active listings |
| GET | `/api/properties/:id` | — | Listing detail |
| POST | `/api/properties` | user | Create a listing (starts "pending") |
| PUT/DELETE | `/api/properties/:id` | owner/admin | Edit or remove a listing |
| POST | `/api/properties/:id/save` | user | Toggle save/unsave |
| GET | `/api/properties/me/listings` \| `/me/saved` | user | Your listings / saved list |
| POST | `/api/properties/:id/inquiries` | — | Contact a seller |
| GET | `/api/posts` | — | Published blog posts, paginated |
| GET | `/api/posts/:slug` | — | Single published post |
| GET | `/api/admin/stats` | admin | Dashboard counts |
| GET | `/api/admin/properties` | admin | All listings, any status |
| PATCH | `/api/admin/properties/:id/verify` | admin | Approve/reject a title |
| GET/POST | `/api/admin/posts` | admin | List all posts (incl. drafts) / create |
| PUT/DELETE | `/api/admin/posts/:id` | admin | Edit, publish/unpublish, or remove a post |
| GET/PATCH/DELETE | `/api/admin/users...` | admin | Manage accounts |

## Data

Postgres, pointed at by `DATABASE_URL` in `.env`. `npm run migrate` applies
everything in `database/migrations/` and tracks what's already been
applied (safe to re-run). To reset everything, drop and recreate the
database, then run `npm run migrate` and `npm run seed` again.

## Troubleshooting

- **`MissingDatabaseConnectionError` on startup** — `DATABASE_URL` isn't set
  in `.env`, or points at a database that isn't reachable.
- **"Failed to fetch" / CORS error in the browser console** — the backend
  isn't running, or `CLIENT_ORIGIN`/`ADMIN_ORIGIN` are set in `.env` and
  don't match the origin your frontend is actually served from. Comment
  those two lines out for local/demo use.
- **Frontend shows no data** — check `npm start` is still running in its
  terminal, and that the frontend's API URL (`VITE_API_URL` for the React
  apps, `window.VERI_ESTATE_API_URL` or `js/config.js` for the static sites)
  points at `http://localhost:4000/api` (or wherever this is actually running).
- **Port 4000 already in use** — set `PORT=` to something else in `.env`,
  then update the frontend's API URL to match.

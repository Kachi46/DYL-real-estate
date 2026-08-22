# VeriEstate

A verified real-estate listings platform for Nigeria: buyers browse
title-checked land, residential, and commercial listings; sellers submit
listings for review; admins verify (or reject) title documents and run a
live blog for platform updates.

```
veri-estate-site/
├── backend/       Express + Postgres API — the only moving part with a server
├── user-site/     Public site — plain HTML/CSS/JS, no build step
└── admin-site/    Admin console — plain HTML/CSS/JS, no build step
```

Both frontends are static files. Open them with Live Server, any static
host, or literally double-click the `.html` file — the only thing that
needs an actual process running is `backend/`.

## Run it (3 steps)

**1. Start the API.** In a terminal, in `backend/`:

```bash
npm install
cp .env.example .env
npm run seed      # demo listings, blog posts, and accounts
npm start
```

Leave this running — you should see `VeriEstate API running on
http://localhost:4000`. Every page in both sites calls out to this.

**2. Open `user-site/index.html`** with Live Server (or any static server).
Browse listings, register, save properties, submit a listing, read the blog.

**3. Open `admin-site/login.html`** the same way. Log in with:

- Email: `admin@veriestate.com`
- Password: `ChangeMe123!`

Verify listings, publish blog posts, manage users — changes show up on the
public site immediately (same database, same API).

That's the whole system. No build tooling, no bundler, nothing to
compile — the two frontends are files you can open directly.

## Why CORS won't get in your way

`backend/.env.example` ships with `CLIENT_ORIGIN`/`ADMIN_ORIGIN` commented
out, so the API accepts requests from any origin by default — this is what
lets Live Server (which picks its own port, e.g. `127.0.0.1:5500`) talk to
the backend without configuration. Before deploying this anywhere public,
uncomment those two lines in `.env` and set them to your real frontend
URLs to lock it down.

## What's implemented

**Public site**
- Home — hero search, featured verified listings
- Listings — filter by state/type/sale-rent/verified-only, URL-synced, paginated
- Property detail — full spec sheet, save toggle, inquiry form
- Blog — published posts, paginated, full post view
- Register / login (JWT, stored in `localStorage`)
- Dashboard — your listings, saved properties, submit a new listing

**Admin console**
- Dashboard — live counts (listings, pending/verified/rejected, users, inquiries)
- Listings — verify / reject (with a note) / delete, filterable by status
- Blog — write, edit, publish/unpublish, delete posts
- Users — promote/demote admin role, delete accounts

**API** — full REST backend in `backend/`, Postgres, JWT auth, bcrypt
password hashing, input validation on every write endpoint. Full setup and
endpoint reference in `backend/README.md`.

**On-page connection check** — every page in both sites pings the backend
on load and shows a visible red banner if it can't connect, naming the
exact URL it tried. No browser console needed to notice the backend isn't
running.

## Verified test pass

Before this was packaged, every flow below was exercised against a live
server (not just read — actually run):

- [x] Register → login → token persists → `/auth/me` round-trips
- [x] Browse/filter/paginate listings; verified-only filter
- [x] Submit a listing → shows "pending" → admin verifies → shows "verified" on the public site
- [x] Admin rejects a listing with a note → note is visible to admin, listing marked rejected
- [x] Save/unsave a property; saved list reflects it
- [x] Send an inquiry on a listing
- [x] Admin publishes a blog post → appears live on `/blog` immediately; unpublish removes it
- [x] Admin promotes/demotes a user's role; can't delete own account
- [x] CORS: a request from `Origin: http://127.0.0.1:5500` (Live Server's default) succeeds against the default `.env`
- [x] All static JS passes `node --check`; both sites serve every page with correct titles/assets
- [x] Backend deliberately stopped → every page still loads (it's just files) and the connection-check banner script/CSS are present and correctly reference the live health endpoint
- [x] Backend running → the exact URL the banner check calls (`/api/health`) returns 200, so no banner appears, and login/CORS still work

## If something doesn't work

**You don't need the browser console for this anymore.** Every page now
checks the backend on load and shows a red banner at the top if it can't
connect — so "is the backend actually running?" is visible on the page
itself instead of something you have to go dig for.

- **Red banner: "Can't reach the backend server..."** → the backend isn't
  running, or isn't running on the URL the frontend expects. Check the
  terminal from step 1 is still alive and shows `VeriEstate API running on
  http://localhost:4000`. If you changed the port, update `VERI_ESTATE_API_URL`
  in `js/config.js` in both `user-site` and `admin-site` to match.
- **No banner, but login still fails** → this is a real auth error (wrong
  password, etc.) — it'll show inline on the login form itself.
- **Port 4000 in use** → change `PORT=` in `backend/.env`, then update
  `js/config.js` in both sites to match.
- **Want to reset all data** → stop the server, delete
  `backend/data/veriestate.db*`, run `npm run seed` again.

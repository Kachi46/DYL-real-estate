const { getDatabase } = require("@netlify/database");

// @netlify/database's getDatabase() only looks for the NETLIFY_DB_URL
// env var that Netlify's own build/dev environment injects automatically.
// Outside of that environment (plain `npm start`, CI, another host) there
// is no such var, so getDatabase() throws MissingDatabaseConnectionError
// even with a perfectly valid Postgres instance available.
//
// Accept a plain DATABASE_URL (the conventional name almost every Postgres
// host - Neon, Supabase, Railway, local Postgres - gives you) and pass it
// through as an explicit override so the backend can run standalone.
const connectionString =
  process.env.DATABASE_URL ||
  process.env.NETLIFY_DATABASE_URL ||
  process.env.NETLIFY_DB_URL;

if (!connectionString) {
  throw new Error(
    "No database connection string found. Set DATABASE_URL in backend/.env " +
      "to a Postgres connection string (see backend/.env.example), or run " +
      "this inside `netlify dev` so NETLIFY_DB_URL is injected automatically."
  );
}

const db = getDatabase({ connectionString });

module.exports = db;

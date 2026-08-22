require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const connectionString =
  process.env.DATABASE_URL ||
  process.env.NETLIFY_DATABASE_URL ||
  process.env.NETLIFY_DB_URL;

if (!connectionString) {
  console.error(
    "No database connection string found. Set DATABASE_URL in backend/.env " +
      "(see backend/.env.example) before running migrations."
  );
  process.exit(1);
}

const MIGRATIONS_DIR = path.join(
  __dirname,
  "..",
  "netlify",
  "database",
  "migrations"
);

async function run() {
  const pool = new Pool({ connectionString });

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    const appliedRows = await pool.query("SELECT name FROM _migrations");
    const applied = new Set(appliedRows.rows.map((r) => r.name));

    const migrationDirs = fs
      .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    let ranAny = false;

    for (const dir of migrationDirs) {
      if (applied.has(dir)) {
        console.log(`Skipping ${dir} (already applied)`);
        continue;
      }

      const sqlPath = path.join(MIGRATIONS_DIR, dir, "migration.sql");
      if (!fs.existsSync(sqlPath)) {
        console.warn(`  No migration.sql in ${dir}, skipping.`);
        continue;
      }

      const sql = fs.readFileSync(sqlPath, "utf8");
      console.log(`Applying ${dir}...`);

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO _migrations (name) VALUES ($1)", [
          dir,
        ]);
        await client.query("COMMIT");
        console.log(`  Applied ${dir}`);
        ranAny = true;
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    }

    if (!ranAny) {
      console.log("Database schema already up to date.");
    }
  } finally {
    await pool.end();
  }
}

run().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});

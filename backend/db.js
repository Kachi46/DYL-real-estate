// Plain `pg` Postgres client - no vendor-specific dependency, works
// identically anywhere (local, Vercel, or any other host) as long as
// DATABASE_URL points at a reachable Postgres database.
//
// Exposes a minimal tagged-template query builder (`sql`) so the rest of
// the codebase can keep writing `db.sql\`SELECT ... WHERE id = ${id}\``
// instead of manually managing $1/$2 placeholders. It supports the three
// things this codebase actually uses:
//   1. Plain interpolation:      sql`WHERE id = ${id}`
//   2. Composing fragments:      sql`${whereClause} AND ${condition}`
//   3. Explicit identifiers:     sql.identifier("some_column")
const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "No database connection string found. Set DATABASE_URL in your .env " +
      "to a Postgres connection string (see .env.example), and set it as " +
      "an Environment Variable in your hosting provider's project settings " +
      "for deployments."
  );
}

const pool = new Pool({ connectionString });

// Represents a piece of SQL text plus its bound parameters. Also acts as
// a thenable: `await sql\`...\`` runs the query and resolves to its rows,
// matching how every route in this codebase already calls it. When NOT
// awaited - e.g. passed as an interpolated value into another sql`` call -
// it's detected via `instanceof SqlFragment` and its text/params are
// spliced directly into the parent query instead of being bound as a
// single parameter value.
class SqlFragment {
  constructor(text, values) {
    this.text = text;
    this.values = values;
    this._promise = null;
  }

  _execute() {
    if (!this._promise) {
      this._promise = pool
        .query(this.text, this.values)
        .then((result) => result.rows);
    }
    return this._promise;
  }

  then(onFulfilled, onRejected) {
    return this._execute().then(onFulfilled, onRejected);
  }

  catch(onRejected) {
    return this._execute().catch(onRejected);
  }

  finally(onFinally) {
    return this._execute().finally(onFinally);
  }
}

function sql(strings, ...values) {
  let text = "";
  const params = [];

  strings.forEach((str, i) => {
    text += str;

    if (i >= values.length) return;

    const value = values[i];

    if (value instanceof SqlFragment) {
      // Renumber the nested fragment's own $1, $2... placeholders to
      // continue from however many params this outer query already has,
      // then fold its params into ours.
      const offset = params.length;
      text += value.text.replace(
        /\$(\d+)/g,
        (_, n) => `$${offset + Number(n)}`
      );
      params.push(...value.values);
    } else {
      params.push(value);
      text += `$${params.length}`;
    }
  });

  return new SqlFragment(text, params);
}

sql.identifier = function identifier(name) {
  // Column/table names passed here always come from a fixed allowlist in
  // the calling code, never raw user input - but this is still escaped
  // defensively (double-quoted, with embedded quotes doubled) rather than
  // trusted blindly.
  const escaped = String(name).replace(/"/g, '""');
  return new SqlFragment(`"${escaped}"`, []);
};

module.exports = { sql, pool };

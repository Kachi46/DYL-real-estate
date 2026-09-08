const jwt = require("jsonwebtoken");
const db = require("../db");

async function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // A valid signature only proves the token was ours - it doesn't
    // prove it's still supposed to work. Comparing against the current
    // token_version means a password change/reset instantly kills every
    // token issued before it, instead of leaving them valid until they
    // naturally expire up to 7 days later. This costs one indexed lookup
    // per authenticated request, which is the trade-off for JWTs being
    // revocable at all.
    const rows = await db.sql`
      SELECT token_version FROM users WHERE id = ${payload.id} LIMIT 1
    `;
    const user = rows[0];

    if (!user || (payload.token_version || 0) !== (user.token_version || 0)) {
      return res.status(401).json({ error: "Invalid or expired token." });
    }

    req.user = payload; // { id, role, email, name, token_version }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required." });
  }
  next();
}

// Attaches req.user if a valid, still-current token is present, but
// doesn't block the request otherwise.
async function optionalAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next();

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const rows = await db.sql`
      SELECT token_version FROM users WHERE id = ${payload.id} LIMIT 1
    `;
    const user = rows[0];

    if (user && (payload.token_version || 0) === (user.token_version || 0)) {
      req.user = payload;
    }
  } catch (err) {
    // ignore invalid/revoked token for optional auth
  }
  next();
}

module.exports = { authenticate, requireAdmin, optionalAuth };

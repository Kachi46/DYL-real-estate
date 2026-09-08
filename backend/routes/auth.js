const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const db = require("../db");
const { authenticate } = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimit");
const { sendMail } = require("../lib/mailer");
const { validatePassword } = require("../lib/passwordPolicy");

const router = express.Router();

function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function sendResetEmail(email, resetUrl) {
  await sendMail({
    to: email,
    subject: "Reset your DYL Real-Estate Services password",
    text: `Reset your password using this link. It expires in one hour:\n\n${resetUrl}`,
    html: `<p>Reset your password using the link below. It expires in one hour.</p><p><a href="${resetUrl}">Reset password</a></p>`,
  });
}

async function sendVerificationEmail(email, verifyUrl) {
  await sendMail({
    to: email,
    subject: "Verify your DYL Real-Estate Services email",
    text: `Confirm your email using this link. It expires in 24 hours:\n\n${verifyUrl}`,
    html: `<p>Confirm your email using the link below. It expires in 24 hours.</p><p><a href="${verifyUrl}">Verify email</a></p>`,
  });
}

// Shared by registration and resend-verification so both create the token
// the same way: same hashing, same 24h expiry, same "clear old ones
// first" behavior as the password-reset flow already does.
async function issueVerificationEmail(user) {
  const token = crypto.randomBytes(32).toString("hex");
  await db.sql`DELETE FROM email_verification_tokens WHERE user_id = ${user.id} OR expires_at < NOW()`;
  await db.sql`
    INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
    VALUES (${user.id}, ${hashResetToken(token)}, NOW() + INTERVAL '24 hours')
  `;
  const base = (process.env.CLIENT_ORIGIN || "http://localhost:5500/user-site").replace(/\/$/, "");
  await sendVerificationEmail(user.email, `${base}/verify-email.html?token=${token}`);
}

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      user_type: user.user_type,
      email: user.email,
      name: user.name,
      token_version: user.token_version || 0,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

function publicUser(user) {
  const { password_hash, ...rest } = user;
  return rest;
}

// Verifies a Google ID token by asking Google directly whether it's valid,
// rather than doing JWT signature verification ourselves - simpler, and it
// means Google's key rotation is never our problem. Confirms both that the
// token is genuinely Google's AND that it was issued for *this* app
// (the `aud` check) - without that second check, a token from a
// completely different Google app would be accepted.
async function verifyGoogleIdToken(idToken) {
  if (!idToken) return null;

  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
  );

  if (!response.ok) return null;

  const payload = await response.json();

  if (payload.aud !== process.env.GOOGLE_CLIENT_ID) return null;
  if (payload.email_verified !== "true" && payload.email_verified !== true) {
    return null;
  }

  return {
    google_id: payload.sub,
    email: payload.email,
    name: payload.name || payload.email.split("@")[0],
  };
}

// Finds the user this verified Google profile belongs to, linking it to an
// existing email/password account on first Google sign-in, or creating a
// brand new account if the email has never been seen before. Kept separate
// from verifyGoogleIdToken so the database logic can be tested directly
// with a trusted payload, independent of the network call to Google.
async function findOrCreateGoogleUser({ google_id, email, name }) {
  const byGoogleId = await db.sql`
    SELECT * FROM users WHERE google_id = ${google_id} LIMIT 1
  `;
  if (byGoogleId.length > 0) return byGoogleId[0];

  const byEmail = await db.sql`
    SELECT * FROM users WHERE email = ${email} LIMIT 1
  `;

  if (byEmail.length > 0) {
    // Existing email/password account signing in with Google for the
    // first time - link it rather than creating a duplicate account.
    const linked = await db.sql`
      UPDATE users SET google_id = ${google_id}, email_verified = true
      WHERE id = ${byEmail[0].id}
      RETURNING *
    `;
    return linked[0];
  }

  const [first_name, ...rest] = name.split(" ");
  const last_name = rest.join(" ") || first_name;

  const created = await db.sql`
    INSERT INTO users (
      name, first_name, last_name, email, google_id, user_type, email_verified
    )
    VALUES (
      ${name}, ${first_name}, ${last_name}, ${email}, ${google_id}, ${"user"}, ${true}
    )
    RETURNING *
  `;
  return created[0];
}

router.post(
  "/register",
  authLimiter,
  [
    body("first_name")
      .trim()
      .notEmpty()
      .withMessage("First name is required."),
    body("last_name").trim().notEmpty().withMessage("Last name is required."),
    body("email")
      .isEmail()
      .withMessage("A valid email is required.")
      .normalizeEmail(),
    body("password").custom((value, { req }) => {
      const error = validatePassword(value, {
        email: req.body.email,
        name: `${req.body.first_name || ""} ${req.body.last_name || ""}`,
      });
      if (error) throw new Error(error);
      return true;
    }),
    body("user_type")
      .optional()
      .isIn(["user", "landlord", "agent", "developer"])
      .withMessage("Invalid account type."),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
      }

      const {
        first_name,
        last_name,
        email,
        password,
        phone,
        user_type,
        email_opt_in,
      } = req.body;

      const existing = await db.sql`
        SELECT id
        FROM users
        WHERE email = ${email}
        LIMIT 1
      `;

      if (existing.length > 0) {
        return res
          .status(409)
          .json({ error: "An account with this email already exists." });
      }

      const hash = bcrypt.hashSync(password, 10);
      const fullName = `${first_name} ${last_name}`.trim();

      const users = await db.sql`
        INSERT INTO users (
          name,
          first_name,
          last_name,
          email,
          password_hash,
          phone,
          user_type,
          email_opt_in
        )
        VALUES (
          ${fullName},
          ${first_name},
          ${last_name},
          ${email},
          ${hash},
          ${phone || null},
          ${user_type || "user"},
          ${Boolean(email_opt_in)}
        )
        RETURNING *
      `;

      const user = users[0];
      const token = signToken(user);

      // Best-effort: an SMTP hiccup shouldn't fail registration itself -
      // the account is real and usable either way, and resend-verification
      // covers the case where this email never arrives.
      try {
        await issueVerificationEmail(user);
      } catch (emailErr) {
        console.error("Failed to send verification email:", emailErr);
      }

      return res.status(201).json({
        token,
        user: publicUser(user),
      });
    } catch (err) {
      next(err);
    }
  }
);

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

router.post(
  "/login",
  authLimiter,
  [
    body("email")
      .isEmail()
      .withMessage("A valid email is required.")
      .normalizeEmail(),
    body("password").notEmpty().withMessage("Password is required."),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
      }

      const { email, password } = req.body;

      const users = await db.sql`
        SELECT *
        FROM users
        WHERE email = ${email}
        LIMIT 1
      `;

      const user = users[0];

      // Independent of the IP-based authLimiter above: that one stops a
      // single attacker from hammering this endpoint, but does nothing
      // against a distributed attempt against one specific account from
      // many different IPs. This counter tracks failures per-account
      // instead, so it catches that case too.
      if (user && user.locked_until && new Date(user.locked_until) > new Date()) {
        const minutesLeft = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
        return res.status(423).json({
          error: `Too many failed attempts. Try again in about ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}.`,
        });
      }

      if (
        !user ||
        !user.password_hash ||
        !bcrypt.compareSync(password, user.password_hash)
      ) {
        if (user) {
          const attempts = (user.failed_login_attempts || 0) + 1;
          const shouldLock = attempts >= MAX_FAILED_LOGIN_ATTEMPTS;

          await db.sql`
            UPDATE users
            SET
              failed_login_attempts = ${shouldLock ? 0 : attempts},
              locked_until = ${shouldLock ? new Date(Date.now() + LOCKOUT_MINUTES * 60000) : null}
            WHERE id = ${user.id}
          `;

          if (shouldLock) {
            return res.status(423).json({
              error: `Too many failed attempts. Try again in about ${LOCKOUT_MINUTES} minutes.`,
            });
          }
        }

        // Deliberately the same generic message whether the email doesn't
        // exist or the password was wrong - and no hint here about how
        // many attempts are left, since that itself would tell an
        // attacker how close they are to triggering (or need to space out
        // to avoid) the lockout.
        return res
          .status(401)
          .json({ error: "Invalid email or password." });
      }

      if (user.failed_login_attempts || user.locked_until) {
        await db.sql`
          UPDATE users
          SET failed_login_attempts = 0, locked_until = NULL
          WHERE id = ${user.id}
        `;
      }

      const token = signToken(user);

      return res.json({
        token,
        user: publicUser(user),
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/change-password",
  authenticate,
  [
    body("current_password").notEmpty().withMessage("Current password is required."),
    body("new_password").custom((value, { req }) => {
      const error = validatePassword(value, { email: req.user?.email, name: req.user?.name });
      if (error) throw new Error(error);
      return true;
    }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

      const users = await db.sql`SELECT * FROM users WHERE id = ${req.user.id} LIMIT 1`;
      const user = users[0];
      if (!user || !user.password_hash || !bcrypt.compareSync(req.body.current_password, user.password_hash)) {
        return res.status(401).json({ error: "Current password is incorrect." });
      }

      // Bumping token_version invalidates every token issued before this
      // point (e.g. a session left open on another device). The request
      // making this change re-signs immediately below so its own caller
      // isn't logged out by their own password change.
      const updated = await db.sql`
        UPDATE users
        SET password_hash = ${bcrypt.hashSync(req.body.new_password, 10)},
            token_version = token_version + 1
        WHERE id = ${req.user.id}
        RETURNING *
      `;

      return res.json({
        message: "Password updated successfully.",
        token: signToken(updated[0]),
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/forgot-password",
  authLimiter,
  [
    body("email").isEmail().withMessage("A valid email is required.").normalizeEmail(),
    body("client").optional().isIn(["user", "admin"]).withMessage("Invalid reset client."),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

      const users = await db.sql`SELECT id, email, role FROM users WHERE email = ${req.body.email} LIMIT 1`;
      const user = users[0];
      if (user && (req.body.client !== "admin" || user.role === "admin")) {
        const token = crypto.randomBytes(32).toString("hex");
        await db.sql`DELETE FROM password_reset_tokens WHERE user_id = ${user.id} OR expires_at < NOW()`;
        await db.sql`
          INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
          VALUES (${user.id}, ${hashResetToken(token)}, NOW() + INTERVAL '1 hour')
        `;
        const resetBase = req.body.client === "admin"
          ? process.env.ADMIN_ORIGIN || "http://localhost:5500/admin-site"
          : process.env.CLIENT_ORIGIN || "http://localhost:5500/user-site";
        await sendResetEmail(user.email, `${resetBase.replace(/\/$/, "")}/reset-password.html?token=${token}`);
      }

      return res.json({ message: "If an account exists for that email, a reset link has been sent." });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/reset-password",
  authLimiter,
  [
    body("token").trim().notEmpty().withMessage("Reset token is required."),
    body("new_password").isLength({ min: 1 }).withMessage("New password is required."),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

      // Looked up (not yet claimed) first so the password can be
      // validated against this account's own email/name before the
      // token is burned - claiming it up front and only then finding
      // out the chosen password is too weak would leave the person
      // holding a dead link and no way to retry.
      const pending = await db.sql`
        SELECT prt.user_id, u.email, u.name
        FROM password_reset_tokens prt
        JOIN users u ON u.id = prt.user_id
        WHERE prt.token_hash = ${hashResetToken(req.body.token)}
          AND prt.used_at IS NULL AND prt.expires_at > NOW()
        LIMIT 1
      `;
      if (pending.length === 0) return res.status(400).json({ error: "This reset link is invalid or expired." });

      const passwordError = validatePassword(req.body.new_password, {
        email: pending[0].email,
        name: pending[0].name,
      });
      if (passwordError) return res.status(400).json({ error: passwordError });

      // The actual single-use enforcement: re-checks used_at/expires_at
      // atomically at claim time, so a concurrent request (or the link
      // expiring in the gap since the lookup above) still can't reset
      // the password twice.
      const claimed = await db.sql`
        UPDATE password_reset_tokens
        SET used_at = NOW()
        WHERE token_hash = ${hashResetToken(req.body.token)}
          AND used_at IS NULL AND expires_at > NOW()
        RETURNING user_id
      `;
      if (claimed.length === 0) return res.status(400).json({ error: "This reset link is invalid or expired." });

      await db.sql`
        UPDATE users
        SET password_hash = ${bcrypt.hashSync(req.body.new_password, 10)},
            token_version = token_version + 1
        WHERE id = ${claimed[0].user_id}
      `;
      return res.json({ message: "Password reset successfully." });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/verify-email",
  authLimiter,
  [body("token").trim().notEmpty().withMessage("Verification token is required.")],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

      const claimed = await db.sql`
        UPDATE email_verification_tokens
        SET used_at = NOW()
        WHERE token_hash = ${hashResetToken(req.body.token)}
          AND used_at IS NULL AND expires_at > NOW()
        RETURNING user_id
      `;
      if (claimed.length === 0) {
        return res.status(400).json({ error: "This verification link is invalid or expired." });
      }

      await db.sql`UPDATE users SET email_verified = true WHERE id = ${claimed[0].user_id}`;
      return res.json({ message: "Email verified successfully." });
    } catch (err) {
      next(err);
    }
  }
);

router.post("/resend-verification", authLimiter, authenticate, async (req, res, next) => {
  try {
    const users = await db.sql`SELECT * FROM users WHERE id = ${req.user.id} LIMIT 1`;
    const user = users[0];
    if (!user) return res.status(404).json({ error: "User not found." });

    if (user.email_verified) {
      return res.json({ message: "This email is already verified." });
    }

    await issueVerificationEmail(user);
    return res.json({ message: "Verification email sent." });
  } catch (err) {
    next(err);
  }
});

router.post("/google", authLimiter, async (req, res, next) => {
  try {
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(503).json({
        error: "Google sign-in isn't configured on this server yet.",
      });
    }

    const profile = await verifyGoogleIdToken(req.body.credential);

    if (!profile) {
      return res
        .status(401)
        .json({ error: "Could not verify that Google sign-in." });
    }

    const user = await findOrCreateGoogleUser(profile);
    const token = signToken(user);

    return res.json({
      token,
      user: publicUser(user),
    });
  } catch (err) {
    next(err);
  }
});

router.get("/me", authenticate, async (req, res, next) => {
  try {
    const users = await db.sql`
      SELECT *
      FROM users
      WHERE id = ${req.user.id}
      LIMIT 1
    `;

    const user = users[0];

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    return res.json({
      user: publicUser(user),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports._findOrCreateGoogleUser = findOrCreateGoogleUser;
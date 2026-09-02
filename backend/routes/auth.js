const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const { body, validationResult } = require("express-validator");
const db = require("../db");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

const mailer = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
    })
  : null;

function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function sendResetEmail(email, resetUrl) {
  if (!mailer) {
    console.log(`Password reset link for ${email}: ${resetUrl}`);
    return;
  }

  await mailer.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: "Reset your DYL Real-Estate Services password",
    text: `Reset your password using this link. It expires in one hour:\n\n${resetUrl}`,
    html: `<p>Reset your password using the link below. It expires in one hour.</p><p><a href="${resetUrl}">Reset password</a></p>`,
  });
}

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      user_type: user.user_type,
      email: user.email,
      name: user.name,
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
      UPDATE users SET google_id = ${google_id}
      WHERE id = ${byEmail[0].id}
      RETURNING *
    `;
    return linked[0];
  }

  const [first_name, ...rest] = name.split(" ");
  const last_name = rest.join(" ") || first_name;

  const created = await db.sql`
    INSERT INTO users (
      name, first_name, last_name, email, google_id, user_type
    )
    VALUES (
      ${name}, ${first_name}, ${last_name}, ${email}, ${google_id}, ${"user"}
    )
    RETURNING *
  `;
  return created[0];
}

router.post(
  "/register",
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
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters."),
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

      return res.status(201).json({
        token,
        user: publicUser(user),
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/login",
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

      if (
        !user ||
        !user.password_hash ||
        !bcrypt.compareSync(password, user.password_hash)
      ) {
        return res
          .status(401)
          .json({ error: "Invalid email or password." });
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
    body("new_password")
      .isLength({ min: 6 })
      .withMessage("New password must be at least 6 characters."),
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

      await db.sql`
        UPDATE users SET password_hash = ${bcrypt.hashSync(req.body.new_password, 10)}
        WHERE id = ${req.user.id}
      `;
      return res.json({ message: "Password updated successfully." });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/forgot-password",
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
  [
    body("token").trim().notEmpty().withMessage("Reset token is required."),
    body("new_password").isLength({ min: 6 }).withMessage("New password must be at least 6 characters."),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

      const claimed = await db.sql`
        UPDATE password_reset_tokens
        SET used_at = NOW()
        WHERE token_hash = ${hashResetToken(req.body.token)}
          AND used_at IS NULL AND expires_at > NOW()
        RETURNING user_id
      `;
      if (claimed.length === 0) return res.status(400).json({ error: "This reset link is invalid or expired." });

      await db.sql`UPDATE users SET password_hash = ${bcrypt.hashSync(req.body.new_password, 10)} WHERE id = ${claimed[0].user_id}`;
      return res.json({ message: "Password reset successfully." });
    } catch (err) {
      next(err);
    }
  }
);

router.post("/google", async (req, res, next) => {
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
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const db = require("../db");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

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

// Verifies a reCAPTCHA token against Google's siteverify endpoint. Returns
// true (skips verification) when no RECAPTCHA_SECRET_KEY is configured,
// so registration isn't blocked before that key exists - the moment it's
// set as an env var, this starts actually enforcing it, with no other
// code changes needed.
async function verifyRecaptcha(token) {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;

  if (!secretKey) {
    return true;
  }

  if (!token) {
    return false;
  }

  const params = new URLSearchParams({ secret: secretKey, response: token });

  const response = await fetch(
    "https://www.google.com/recaptcha/api/siteverify",
    { method: "POST", body: params }
  );
  const result = await response.json();

  return Boolean(result.success);
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
        recaptcha_token,
      } = req.body;

      const captchaOk = await verifyRecaptcha(recaptcha_token);

      if (!captchaOk) {
        return res
          .status(400)
          .json({ error: "reCAPTCHA verification failed. Please try again." });
      }

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

      if (!user || !bcrypt.compareSync(password, user.password_hash)) {
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
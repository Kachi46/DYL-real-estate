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
      user_type: user.user_type || "seeker",
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

router.post(
  "/register",
  [
    body("name").trim().notEmpty().withMessage("Name is required."),
    body("email")
      .isEmail()
      .withMessage("A valid email is required.")
      .normalizeEmail(),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters."),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
      }

      const { name, email, password, phone } = req.body;

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

      const users = await db.sql`
        INSERT INTO users (
          name,
          email,
          password_hash,
          phone
        )
        VALUES (
          ${name},
          ${email},
          ${hash},
          ${phone || null}
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
  console.error("REGISTER ERROR:", err);
  console.error("REGISTER ERROR MESSAGE:", err.message);
  console.error("REGISTER ERROR CAUSE:", err.cause);
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
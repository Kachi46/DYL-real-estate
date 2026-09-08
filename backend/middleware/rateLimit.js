const rateLimit = require("express-rate-limit");

// Tight limiter for credential-guessing surfaces: login, register,
// forgot-password, reset-password. Keyed by IP; 10 attempts per 15
// minutes is generous for a real user, painful for a brute-force script.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again in a few minutes." },
});

// Looser limiter for public write endpoints that don't require auth
// (inquiries, inspection bookings) - these can't be locked behind a
// token, so they're the easiest thing on the API to spam.
const publicWriteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});

module.exports = { authLimiter, publicWriteLimiter };

// Runs before the test framework and any test file's imports, so
// process.env is populated before server.js (and anything it requires)
// gets loaded. Real secrets never need to exist for tests: the database
// is mocked per-suite and this is the only value the auth code actually
// reads at runtime (jwt.sign/verify).
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";
process.env.JWT_EXPIRES_IN = "1h";
// Left unset on purpose in most suites so the Google-sign-in route's
// "not configured" branch is exercised; individual tests set it locally
// when they need the configured path instead.
delete process.env.GOOGLE_CLIENT_ID;
delete process.env.SMTP_HOST;

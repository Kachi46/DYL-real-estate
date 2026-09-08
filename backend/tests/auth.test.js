const bcrypt = require("bcryptjs");
const { createMockDb } = require("./setup/mockDb");

// Replaces `../db` for every module in this test file's require graph -
// server.js, routes/auth.js, and middleware/auth.js all resolve "../db"
// (or "./db") to the same file, so mocking it once here covers all three.
// The mock instance itself is created fresh inside beforeEach via
// jest.resetModules() + re-require, so state never leaks between tests.
jest.mock("../db", () => {
  const { createMockDb } = require("./setup/mockDb");
  return global.__mockDb || (global.__mockDb = createMockDb());
});

const request = require("supertest");
const bcryptForSeed = bcrypt;

function seedUser(overrides = {}) {
  return {
    id: 1,
    name: "Ada Lovelace",
    first_name: "Ada",
    last_name: "Lovelace",
    email: "ada@example.com",
    password_hash: bcryptForSeed.hashSync("correct-horse", 10),
    phone: null,
    user_type: "user",
    email_opt_in: false,
    role: "user",
    token_version: 0,
    email_verified: false,
    google_id: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

let app;

beforeEach(() => {
  jest.resetModules();
  global.__mockDb = createMockDb({ users: [seedUser()], nextUserId: 2 });
  app = require("../server");
});

describe("POST /api/auth/register", () => {
  it("creates a new account and returns a token", async () => {
    const res = await request(app).post("/api/auth/register").send({
      first_name: "Grace",
      last_name: "Hopper",
      email: "grace@example.com",
      password: "secretpw",
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe("grace@example.com");
    expect(res.body.user.password_hash).toBeUndefined();
    expect(res.body.user.email_verified).toBe(false);
  });

  it("rejects a duplicate email", async () => {
    const res = await request(app).post("/api/auth/register").send({
      first_name: "Ada",
      last_name: "Lovelace",
      email: "ada@example.com",
      password: "secretpw",
    });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it("rejects a short password before touching the database", async () => {
    const res = await request(app).post("/api/auth/register").send({
      first_name: "Grace",
      last_name: "Hopper",
      email: "grace2@example.com",
      password: "abc",
    });

    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  it("logs in with correct credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "ada@example.com", password: "correct-horse" });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe("ada@example.com");
  });

  it("rejects a wrong password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "ada@example.com", password: "wrong-password" });

    expect(res.status).toBe(401);
  });

  it("rejects an unknown email without revealing whether the account exists", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "whatever1" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid email or password.");
  });
});

describe("GET /api/auth/me", () => {
  it("requires a token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns the current user for a valid token", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "ada@example.com", password: "correct-horse" });

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${login.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("ada@example.com");
  });

  it("rejects a garbage token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/change-password", () => {
  it("changes the password and invalidates the old token", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "ada@example.com", password: "correct-horse" });
    const oldToken = login.body.token;

    const change = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${oldToken}`)
      .send({ current_password: "correct-horse", new_password: "new-password-1" });

    expect(change.status).toBe(200);
    const newToken = change.body.token;
    expect(newToken).toBeDefined();
    expect(newToken).not.toBe(oldToken);

    // The token issued before the password change should now be rejected -
    // this is the whole point of the token_version mechanism.
    const meWithOldToken = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${oldToken}`);
    expect(meWithOldToken.status).toBe(401);

    // But the freshly issued token still works.
    const meWithNewToken = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${newToken}`);
    expect(meWithNewToken.status).toBe(200);

    // And logging in again requires the *new* password.
    const reLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "ada@example.com", password: "new-password-1" });
    expect(reLogin.status).toBe(200);
  });

  it("rejects the wrong current password", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "ada@example.com", password: "correct-horse" });

    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${login.body.token}`)
      .send({ current_password: "totally-wrong", new_password: "new-password-1" });

    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/forgot-password and /reset-password", () => {
  it("always returns a generic message, whether or not the email exists", async () => {
    const known = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "ada@example.com" });
    const unknown = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "nobody@example.com" });

    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body.message).toBe(unknown.body.message);
  });

  it("rejects reset attempts with a bad token", async () => {
    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "not-a-real-token", new_password: "new-password-1" });

    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/verify-email", () => {
  it("rejects an invalid verification token", async () => {
    const res = await request(app)
      .post("/api/auth/verify-email")
      .send({ token: "not-a-real-token" });

    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/google", () => {
  it("returns 503 when Google sign-in isn't configured", async () => {
    // server.js's dotenv.config() reloads whatever is in .env every time
    // the module graph is freshly required in beforeEach, so this has to
    // be cleared right before the request rather than in the shared env
    // setup file.
    delete process.env.GOOGLE_CLIENT_ID;

    const res = await request(app)
      .post("/api/auth/google")
      .send({ credential: "whatever" });

    expect(res.status).toBe(503);
  });
});

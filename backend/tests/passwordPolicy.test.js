const bcrypt = require("bcryptjs");
const { createMockDb } = require("./setup/mockDb");

jest.mock("../db", () => {
  const { createMockDb } = require("./setup/mockDb");
  return global.__mockDb || (global.__mockDb = createMockDb());
});

const request = require("supertest");

const USER = {
  id: 80,
  name: "Jonathan Okafor",
  email: "jonathan.okafor@example.com",
  password_hash: bcrypt.hashSync("original-pw-1", 10),
  role: "user",
  token_version: 0,
  email_verified: true,
};

let app;

beforeEach(() => {
  jest.resetModules();
  global.__mockDb = createMockDb({ users: [USER], nextUserId: 81 });
  app = require("../server");
});

describe("password policy — registration", () => {
  it("rejects a password under 8 characters", async () => {
    const res = await request(app).post("/api/auth/register").send({
      first_name: "New", last_name: "Person", email: "new1@example.com", password: "abc1234",
    });
    expect(res.status).toBe(400);
  });

  it("accepts a password at exactly 8 characters", async () => {
    const res = await request(app).post("/api/auth/register").send({
      first_name: "New", last_name: "Person", email: "new2@example.com", password: "abcd1234",
    });
    expect(res.status).toBe(201);
  });

  it("rejects a password over 72 bytes (bcrypt's silent truncation point)", async () => {
    const res = await request(app).post("/api/auth/register").send({
      first_name: "New", last_name: "Person", email: "new3@example.com", password: "x".repeat(73),
    });
    expect(res.status).toBe(400);
  });

  it("rejects a well-known common password", async () => {
    const res = await request(app).post("/api/auth/register").send({
      first_name: "New", last_name: "Person", email: "new4@example.com", password: "password123",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/too common/i);
  });

  it("rejects a password containing the registrant's email local-part", async () => {
    const res = await request(app).post("/api/auth/register").send({
      first_name: "Jane", last_name: "Doe", email: "janedoe99@example.com", password: "janedoe991234",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name or email/i);
  });

  it("rejects a password containing the registrant's name", async () => {
    const res = await request(app).post("/api/auth/register").send({
      first_name: "Zephyrine", last_name: "Adeyemi", email: "zaf@example.com", password: "zephyrine2026",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name or email/i);
  });

  it("accepts a strong, unrelated password", async () => {
    const res = await request(app).post("/api/auth/register").send({
      first_name: "Chidi", last_name: "Nwosu", email: "chidi.nwosu@example.com", password: "correct-horse-battery",
    });
    expect(res.status).toBe(201);
  });
});

describe("password policy — change-password", () => {
  async function loginAsUser() {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: USER.email, password: "original-pw-1" });
    return res.body.token;
  }

  it("rejects a new password containing the account's own name", async () => {
    const token = await loginAsUser();
    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ current_password: "original-pw-1", new_password: "jonathan-2026" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name or email/i);
  });

  it("accepts an unrelated strong new password", async () => {
    const token = await loginAsUser();
    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ current_password: "original-pw-1", new_password: "totally-unrelated-9" });

    expect(res.status).toBe(200);
  });
});

describe("password policy — reset-password", () => {
  it("rejects a weak new password without burning the reset token, so the same token still works with a better one", async () => {
    // Trigger the reset flow to get a real token onto the mock's
    // password_reset_tokens table (the email itself is just logged in
    // this test environment - the /forgot-password response never
    // includes the raw token).
    const originalLog = console.log;
    let loggedLine = "";
    console.log = (...args) => { loggedLine += args.join(" "); originalLog(...args); };
    await request(app).post("/api/auth/forgot-password").send({ email: USER.email });
    console.log = originalLog;

    const match = loggedLine.match(/token=([a-f0-9]+)/);
    expect(match).toBeTruthy();
    const resetToken = match[1];

    const weakAttempt = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: resetToken, new_password: "jonathanokafor" });
    expect(weakAttempt.status).toBe(400);
    expect(weakAttempt.body.error).toMatch(/name or email/i);

    // The token should still be usable - a rejected password shouldn't
    // have consumed it.
    const strongAttempt = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: resetToken, new_password: "an-unrelated-strong-pw" });
    expect(strongAttempt.status).toBe(200);

    // And now it really is used up.
    const reuseAttempt = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: resetToken, new_password: "some-other-strong-pw" });
    expect(reuseAttempt.status).toBe(400);
  });
});

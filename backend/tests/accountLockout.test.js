const bcrypt = require("bcryptjs");
const { createMockDb } = require("./setup/mockDb");

jest.mock("../db", () => {
  const { createMockDb } = require("./setup/mockDb");
  return global.__mockDb || (global.__mockDb = createMockDb());
});

const request = require("supertest");

const USER = {
  id: 5,
  name: "Locked Account Test",
  email: "lockout@example.com",
  password_hash: bcrypt.hashSync("right-password-1", 10),
  role: "user",
  token_version: 0,
  email_verified: true,
};

const ADMIN = {
  id: 1,
  name: "Site Admin",
  email: "admin2@example.com",
  password_hash: bcrypt.hashSync("admin-pass-2", 10),
  role: "admin",
  token_version: 0,
  email_verified: true,
};

let app;

beforeEach(() => {
  jest.resetModules();
  global.__mockDb = createMockDb({ users: [USER, ADMIN], nextUserId: 6 });
  app = require("../server");
});

describe("account-level login lockout", () => {
  it("locks the account after repeated wrong passwords, independent of the IP-based limiter", async () => {
    // The IP-based authLimiter's own cap is well above 5, so these 5
    // failures alone should never trip it - only the account lockout.
    let last;
    for (let i = 0; i < 5; i += 1) {
      last = await request(app)
        .post("/api/auth/login")
        .send({ email: USER.email, password: "wrong-password" });
    }

    expect(last.status).toBe(423);
    expect(last.body.error).toMatch(/too many failed attempts/i);

    // Even the *correct* password is now rejected while locked.
    const stillLocked = await request(app)
      .post("/api/auth/login")
      .send({ email: USER.email, password: "right-password-1" });
    expect(stillLocked.status).toBe(423);
  });

  it("resets the failure counter after a successful login", async () => {
    // A couple of failures, then a successful login - the counter should
    // not carry over to the next unrelated string of failed attempts.
    await request(app).post("/api/auth/login").send({ email: USER.email, password: "wrong-password" });
    await request(app).post("/api/auth/login").send({ email: USER.email, password: "wrong-password" });

    const success = await request(app)
      .post("/api/auth/login")
      .send({ email: USER.email, password: "right-password-1" });
    expect(success.status).toBe(200);

    // Two more failures right after a successful login shouldn't be
    // anywhere near the 5-attempt threshold.
    await request(app).post("/api/auth/login").send({ email: USER.email, password: "wrong-password" });
    const stillUnlocked = await request(app)
      .post("/api/auth/login")
      .send({ email: USER.email, password: "wrong-password" });
    expect(stillUnlocked.status).toBe(401);
  });
});

describe("GET /api/admin/audit-log", () => {
  it("records an entry when an admin verifies a listing, and it's readable back", async () => {
    global.__mockDb.__properties.push({
      id: 200, title: "Test Flat", owner_id: USER.id, status: "active",
      verification_status: "pending", verification_notes: null,
    });

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: ADMIN.email, password: "admin-pass-2" });

    await request(app)
      .patch("/api/admin/properties/200/verify")
      .set("Authorization", `Bearer ${login.body.token}`)
      .send({ verification_status: "verified" });

    const auditRes = await request(app)
      .get("/api/admin/audit-log")
      .set("Authorization", `Bearer ${login.body.token}`);

    expect(auditRes.status).toBe(200);
    expect(auditRes.body.data.length).toBeGreaterThan(0);
    const entry = auditRes.body.data.find((a) => a.action === "property.verification_status_changed");
    expect(entry).toBeDefined();
    expect(entry.admin_email).toBe(ADMIN.email);
    expect(entry.target_id).toBe("200");
  });

  it("requires an admin token", async () => {
    const res = await request(app).get("/api/admin/audit-log");
    expect(res.status).toBe(401);
  });

  it("filters by target_type", async () => {
    global.__mockDb.__properties.push({
      id: 201, title: "Another Flat", owner_id: USER.id, status: "active",
      verification_status: "pending", verification_notes: null,
    });

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: ADMIN.email, password: "admin-pass-2" });
    const token = login.body.token;

    // One property action and one user action, so the filter has
    // something real to narrow down.
    await request(app)
      .patch("/api/admin/properties/201/verify")
      .set("Authorization", `Bearer ${token}`)
      .send({ verification_status: "verified" });
    await request(app)
      .patch(`/api/admin/users/${USER.id}/role`)
      .set("Authorization", `Bearer ${token}`)
      .send({ role: "admin" });

    const propertyOnly = await request(app)
      .get("/api/admin/audit-log?target_type=property")
      .set("Authorization", `Bearer ${token}`);

    expect(propertyOnly.status).toBe(200);
    expect(propertyOnly.body.data.length).toBeGreaterThan(0);
    expect(propertyOnly.body.data.every((a) => a.target_type === "property")).toBe(true);
  });
});

const bcrypt = require("bcryptjs");
const { createMockDb } = require("./setup/mockDb");

jest.mock("../db", () => {
  const { createMockDb } = require("./setup/mockDb");
  return global.__mockDb || (global.__mockDb = createMockDb());
});

// Intercepting at lib/mailer (rather than nodemailer itself) lets these
// tests assert on exactly what the app decided to send - subject, body,
// recipient - without caring how it would actually be delivered.
// Same global-singleton trick as the db mock above: jest.resetModules()
// in beforeEach would otherwise hand routes a *different* fresh mock
// instance than whatever this file references, so the reference is
// re-fetched from the module in beforeEach after resetting the global.
jest.mock("../lib/mailer", () => ({
  sendMail: global.__mockSendMail || (global.__mockSendMail = jest.fn().mockResolvedValue(undefined)),
}));

const request = require("supertest");

let app;
let sendMail;

const OWNER = {
  id: 10,
  name: "Olu Owner",
  email: "owner@example.com",
  password_hash: bcrypt.hashSync("owner-pass-1", 10),
  role: "user",
  user_type: "landlord",
  token_version: 0,
  email_verified: true,
};

const ADMIN = {
  id: 1,
  name: "Site Admin",
  email: "admin@example.com",
  password_hash: bcrypt.hashSync("admin-pass-1", 10),
  role: "admin",
  user_type: "user",
  token_version: 0,
  email_verified: true,
};

const PROPERTY = {
  id: 100,
  title: "Nice Duplex in Lekki",
  city: "Lagos",
  state: "Lagos",
  owner_id: OWNER.id,
  status: "active",
  verification_status: "pending",
  verification_notes: null,
};

beforeEach(() => {
  jest.resetModules();
  global.__mockSendMail = jest.fn().mockResolvedValue(undefined);
  global.__mockDb = createMockDb({ users: [OWNER, ADMIN], properties: [PROPERTY], nextUserId: 11 });
  app = require("../server");
  sendMail = require("../lib/mailer").sendMail;
});

async function loginAs(email, password) {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res.body.token;
}

describe("owner notification emails", () => {
  it("emails the owner when someone submits an inquiry", async () => {
    const res = await request(app).post("/api/properties/100/inquiries").send({
      name: "Prospective Buyer",
      email: "buyer@example.com",
      phone: "08012345678",
      message: "Is this still available?",
    });

    expect(res.status).toBe(201);
    expect(sendMail).toHaveBeenCalledTimes(1);
    const call = sendMail.mock.calls[0][0];
    expect(call.to).toBe(OWNER.email);
    expect(call.subject).toMatch(/New inquiry/);
    expect(call.text).toMatch(/Is this still available\?/);
  });

  it("emails the owner when someone books an inspection", async () => {
    const futureDate = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

    const res = await request(app).post("/api/properties/100/inspections").send({
      name: "Prospective Tenant",
      email: "tenant@example.com",
      phone: "08099999999",
      inspection_date: futureDate,
      inspection_time: "10:30",
    });

    expect(res.status).toBe(201);
    expect(sendMail).toHaveBeenCalledTimes(1);
    const call = sendMail.mock.calls[0][0];
    expect(call.to).toBe(OWNER.email);
    expect(call.subject).toMatch(/New inspection request/);
  });

  it("does not leak the owner's email/name into the public inspection response", async () => {
    const futureDate = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

    const res = await request(app).post("/api/properties/100/inspections").send({
      name: "Prospective Tenant",
      email: "tenant@example.com",
      phone: "08099999999",
      inspection_date: futureDate,
      inspection_time: "11:00",
    });

    expect(res.body.data.property.owner_email).toBeUndefined();
    expect(res.body.data.property.owner_name).toBeUndefined();
  });

  it("emails the owner when an admin verifies the listing", async () => {
    const adminToken = await loginAs(ADMIN.email, "admin-pass-1");

    const res = await request(app)
      .patch("/api/admin/properties/100/verify")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ verification_status: "verified" });

    expect(res.status).toBe(200);
    expect(sendMail).toHaveBeenCalledTimes(1);
    const call = sendMail.mock.calls[0][0];
    expect(call.to).toBe(OWNER.email);
    expect(call.subject).toMatch(/verified/i);
  });

  it("emails the owner with the rejection reason when an admin rejects the listing", async () => {
    const adminToken = await loginAs(ADMIN.email, "admin-pass-1");

    const res = await request(app)
      .patch("/api/admin/properties/100/verify")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ verification_status: "rejected", verification_notes: "Title document is illegible." });

    expect(res.status).toBe(200);
    const call = sendMail.mock.calls[0][0];
    expect(call.to).toBe(OWNER.email);
    expect(call.subject).toMatch(/needs changes/);
    expect(call.text).toMatch(/Title document is illegible\./);
  });

  it("does not email anyone when an admin resets a listing back to pending", async () => {
    const adminToken = await loginAs(ADMIN.email, "admin-pass-1");

    const res = await request(app)
      .patch("/api/admin/properties/100/verify")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ verification_status: "pending" });

    expect(res.status).toBe(200);
    expect(sendMail).not.toHaveBeenCalled();
  });
});

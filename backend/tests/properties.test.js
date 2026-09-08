const bcrypt = require("bcryptjs");
const { createMockDb } = require("./setup/mockDb");

jest.mock("../db", () => {
  const { createMockDb } = require("./setup/mockDb");
  return global.__mockDb || (global.__mockDb = createMockDb());
});

const request = require("supertest");

const OWNER = {
  id: 20,
  name: "Property Owner",
  email: "owner2@example.com",
  password_hash: bcrypt.hashSync("owner-pass-2", 10),
  role: "user",
  token_version: 0,
  email_verified: true,
};

const OTHER_USER = {
  id: 21,
  name: "Someone Else",
  email: "other@example.com",
  password_hash: bcrypt.hashSync("other-pass-1", 10),
  role: "user",
  token_version: 0,
  email_verified: true,
};

const ADMIN = {
  id: 22,
  name: "Admin",
  email: "admin3@example.com",
  password_hash: bcrypt.hashSync("admin-pass-3", 10),
  role: "admin",
  token_version: 0,
  email_verified: true,
};

const VALID_PROPERTY = {
  title: "Charming 2-bed flat",
  description: "A lovely flat close to the water.",
  property_type: "residential",
  price: 25000000,
  state: "Lagos",
  city: "Lekki",
};

let app;

beforeEach(() => {
  jest.resetModules();
  global.__mockDb = createMockDb({
    users: [OWNER, OTHER_USER, ADMIN],
    nextUserId: 23,
    properties: [
      {
        id: 300, title: "Existing Listing", description: "desc", property_type: "residential",
        listing_type: "sale", price: 10000000, currency: "NGN", state: "Lagos", city: "Ikeja",
        owner_id: OWNER.id, status: "active", verification_status: "verified", verification_notes: null,
        images: "[]", created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      },
      {
        id: 301, title: "Rejected Listing", description: "desc", property_type: "residential",
        listing_type: "sale", price: 5000000, currency: "NGN", state: "Lagos", city: "Yaba",
        owner_id: OWNER.id, status: "active", verification_status: "rejected", verification_notes: "Bad docs",
        images: "[]", created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      },
    ],
    nextPropertyId: 302,
  });
  app = require("../server");
});

async function loginAs(email, password) {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res.body.token;
}

describe("POST /api/properties", () => {
  it("requires authentication", async () => {
    const res = await request(app).post("/api/properties").send(VALID_PROPERTY);
    expect(res.status).toBe(401);
  });

  it("creates a listing owned by the authenticated user, pending verification", async () => {
    const token = await loginAs(OWNER.email, "owner-pass-2");

    const res = await request(app)
      .post("/api/properties")
      .set("Authorization", `Bearer ${token}`)
      .send(VALID_PROPERTY);

    expect(res.status).toBe(201);
    expect(res.body.data.owner_id).toBe(OWNER.id);
    expect(res.body.data.verification_status).toBe("pending");
    expect(res.body.data.title).toBe(VALID_PROPERTY.title);
  });

  it("rejects a missing required field", async () => {
    const token = await loginAs(OWNER.email, "owner-pass-2");

    const { title, ...withoutTitle } = VALID_PROPERTY;
    const res = await request(app)
      .post("/api/properties")
      .set("Authorization", `Bearer ${token}`)
      .send(withoutTitle);

    expect(res.status).toBe(400);
  });
});

describe("GET /api/properties/:id", () => {
  it("returns 404 for a nonexistent property", async () => {
    const res = await request(app).get("/api/properties/999999");
    expect(res.status).toBe(404);
  });

  it("hides a rejected listing from the public", async () => {
    const res = await request(app).get("/api/properties/301");
    expect(res.status).toBe(404);
  });

  it("still shows a rejected listing to its owner", async () => {
    const token = await loginAs(OWNER.email, "owner-pass-2");
    const res = await request(app)
      .get("/api/properties/301")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(301);
  });

  it("still shows a rejected listing to an admin", async () => {
    const token = await loginAs(ADMIN.email, "admin-pass-3");
    const res = await request(app)
      .get("/api/properties/301")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe("PUT /api/properties/:id", () => {
  it("lets the owner update their listing", async () => {
    const token = await loginAs(OWNER.email, "owner-pass-2");
    const res = await request(app)
      .put("/api/properties/300")
      .set("Authorization", `Bearer ${token}`)
      .send({ price: 11000000 });

    expect(res.status).toBe(200);
    expect(Number(res.body.data.price)).toBe(11000000);
  });

  it("resets verification_status to pending when a non-admin edits a verified listing", async () => {
    const token = await loginAs(OWNER.email, "owner-pass-2");
    const res = await request(app)
      .put("/api/properties/300")
      .set("Authorization", `Bearer ${token}`)
      .send({ price: 12000000 });

    expect(res.status).toBe(200);
    expect(res.body.data.verification_status).toBe("pending");
  });

  it("does not reset verification_status when an admin edits it", async () => {
    const token = await loginAs(ADMIN.email, "admin-pass-3");
    const res = await request(app)
      .put("/api/properties/300")
      .set("Authorization", `Bearer ${token}`)
      .send({ price: 13000000 });

    expect(res.status).toBe(200);
    expect(res.body.data.verification_status).toBe("verified");
  });

  it("blocks a user who doesn't own the listing", async () => {
    const token = await loginAs(OTHER_USER.email, "other-pass-1");
    const res = await request(app)
      .put("/api/properties/300")
      .set("Authorization", `Bearer ${token}`)
      .send({ price: 1 });

    expect(res.status).toBe(403);
  });

  it("returns 404 for a nonexistent listing", async () => {
    const token = await loginAs(OWNER.email, "owner-pass-2");
    const res = await request(app)
      .put("/api/properties/999999")
      .set("Authorization", `Bearer ${token}`)
      .send({ price: 1 });

    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/properties/:id", () => {
  it("blocks a user who doesn't own the listing", async () => {
    const token = await loginAs(OTHER_USER.email, "other-pass-1");
    const res = await request(app)
      .delete("/api/properties/300")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("lets the owner delete their own listing", async () => {
    const token = await loginAs(OWNER.email, "owner-pass-2");
    const res = await request(app)
      .delete("/api/properties/300")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(204);

    const check = await request(app).get("/api/properties/300");
    expect(check.status).toBe(404);
  });

  it("lets an admin delete any listing", async () => {
    const token = await loginAs(ADMIN.email, "admin-pass-3");
    const res = await request(app)
      .delete("/api/properties/300")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(204);
  });
});

describe("POST /api/properties/:id/save and GET /api/properties/me/saved", () => {
  it("toggles save/unsave and reflects it in the saved list", async () => {
    const token = await loginAs(OTHER_USER.email, "other-pass-1");

    const save = await request(app)
      .post("/api/properties/300/save")
      .set("Authorization", `Bearer ${token}`);
    expect(save.status).toBe(200);
    expect(save.body.saved).toBe(true);

    const savedList = await request(app)
      .get("/api/properties/me/saved")
      .set("Authorization", `Bearer ${token}`);
    expect(savedList.body.data.map((p) => p.id)).toContain(300);

    const unsave = await request(app)
      .post("/api/properties/300/save")
      .set("Authorization", `Bearer ${token}`);
    expect(unsave.status).toBe(200);
    expect(unsave.body.saved).toBe(false);

    const savedListAfter = await request(app)
      .get("/api/properties/me/saved")
      .set("Authorization", `Bearer ${token}`);
    expect(savedListAfter.body.data.map((p) => p.id)).not.toContain(300);
  });

  it("404s when saving a nonexistent property", async () => {
    const token = await loginAs(OTHER_USER.email, "other-pass-1");
    const res = await request(app)
      .post("/api/properties/999999/save")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

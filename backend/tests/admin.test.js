const bcrypt = require("bcryptjs");
const { createMockDb } = require("./setup/mockDb");

jest.mock("../db", () => {
  const { createMockDb } = require("./setup/mockDb");
  return global.__mockDb || (global.__mockDb = createMockDb());
});

const request = require("supertest");

const ADMIN = {
  id: 1, name: "Site Admin", email: "admin4@example.com",
  password_hash: bcrypt.hashSync("admin-pass-4", 10),
  role: "admin", token_version: 0, email_verified: true,
};

const REGULAR_USER = {
  id: 2, name: "Regular User", email: "regular@example.com",
  password_hash: bcrypt.hashSync("regular-pass-1", 10),
  role: "user", token_version: 0, email_verified: true,
};

const OWNER_WITH_LISTINGS = {
  id: 3, name: "Owner With Listings", email: "hasListings@example.com",
  password_hash: bcrypt.hashSync("has-listings-1", 10),
  role: "user", token_version: 0, email_verified: true,
};

let app;

beforeEach(() => {
  jest.resetModules();
  global.__mockDb = createMockDb({
    users: [ADMIN, REGULAR_USER, OWNER_WITH_LISTINGS],
    nextUserId: 4,
    properties: [
      {
        id: 500, title: "Owned Listing", description: "desc", property_type: "residential",
        listing_type: "sale", price: 1000000, currency: "NGN", state: "Lagos", city: "Ikeja",
        owner_id: OWNER_WITH_LISTINGS.id, status: "active", verification_status: "pending",
        verification_notes: null, images: "[]",
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      },
    ],
    nextPropertyId: 501,
  });
  app = require("../server");
});

async function loginAs(email, password) {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res.body.token;
}

describe("admin route access control", () => {
  it("blocks a non-admin from every admin route", async () => {
    const token = await loginAs(REGULAR_USER.email, "regular-pass-1");
    const res = await request(app)
      .get("/api/admin/stats")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("blocks an unauthenticated request", async () => {
    const res = await request(app).get("/api/admin/stats");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/admin/properties", () => {
  it("lists properties with pagination metadata", async () => {
    const token = await loginAs(ADMIN.email, "admin-pass-4");
    const res = await request(app)
      .get("/api/admin/properties")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.pagination).toEqual(expect.objectContaining({ page: 1, total: 1 }));
  });

  it("filters by verification_status", async () => {
    const token = await loginAs(ADMIN.email, "admin-pass-4");
    const res = await request(app)
      .get("/api/admin/properties?verification_status=verified")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(0);
  });
});

describe("PATCH /api/admin/users/:id/role", () => {
  it("blocks an admin from changing their own role", async () => {
    const token = await loginAs(ADMIN.email, "admin-pass-4");
    const res = await request(app)
      .patch(`/api/admin/users/${ADMIN.id}/role`)
      .set("Authorization", `Bearer ${token}`)
      .send({ role: "user" });

    expect(res.status).toBe(400);
  });

  it("lets an admin promote another user", async () => {
    const token = await loginAs(ADMIN.email, "admin-pass-4");
    const res = await request(app)
      .patch(`/api/admin/users/${REGULAR_USER.id}/role`)
      .set("Authorization", `Bearer ${token}`)
      .send({ role: "admin" });

    expect(res.status).toBe(200);

    const loginAsNewAdmin = await loginAs(REGULAR_USER.email, "regular-pass-1");
    const statsRes = await request(app)
      .get("/api/admin/stats")
      .set("Authorization", `Bearer ${loginAsNewAdmin}`);
    expect(statsRes.status).toBe(200);
  });
});

describe("PATCH /api/admin/users/:id/type", () => {
  it("lets an admin change a user to landlord", async () => {
    const token = await loginAs(ADMIN.email, "admin-pass-4");
    const res = await request(app)
      .patch(`/api/admin/users/${REGULAR_USER.id}/type`)
      .set("Authorization", `Bearer ${token}`)
      .send({ user_type: "landlord" });

    expect(res.status).toBe(200);

    const usersRes = await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${token}`);
    expect(usersRes.body.data.find((user) => user.id === REGULAR_USER.id).user_type).toBe("landlord");
  });

  it("rejects account types removed from the site", async () => {
    const token = await loginAs(ADMIN.email, "admin-pass-4");
    const res = await request(app)
      .patch(`/api/admin/users/${REGULAR_USER.id}/type`)
      .set("Authorization", `Bearer ${token}`)
      .send({ user_type: "agent" });

    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/admin/users/:id", () => {
  it("blocks an admin from deleting their own account", async () => {
    const token = await loginAs(ADMIN.email, "admin-pass-4");
    const res = await request(app)
      .delete(`/api/admin/users/${ADMIN.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it("blocks deleting a user who still owns listings", async () => {
    const token = await loginAs(ADMIN.email, "admin-pass-4");
    const res = await request(app)
      .delete(`/api/admin/users/${OWNER_WITH_LISTINGS.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/still owns/i);
  });

  it("deletes a user with no owned content", async () => {
    const token = await loginAs(ADMIN.email, "admin-pass-4");
    const res = await request(app)
      .delete(`/api/admin/users/${REGULAR_USER.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(204);
  });
});

describe("blog post admin CRUD", () => {
  it("creates a draft post with a generated slug", async () => {
    const token = await loginAs(ADMIN.email, "admin-pass-4");
    const res = await request(app)
      .post("/api/admin/posts")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "My New Post!", content: "Some content here." });

    expect(res.status).toBe(201);
    expect(res.body.data.slug).toBe("my-new-post");
    expect(res.body.data.published).toBe(false);
  });

  it("de-duplicates slugs for posts with the same title", async () => {
    const token = await loginAs(ADMIN.email, "admin-pass-4");

    const first = await request(app)
      .post("/api/admin/posts")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Same Title", content: "First." });
    const second = await request(app)
      .post("/api/admin/posts")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Same Title", content: "Second." });

    expect(first.body.data.slug).toBe("same-title");
    expect(second.body.data.slug).toBe("same-title-2");
  });

  it("lets an admin publish and then unpublish a post", async () => {
    const token = await loginAs(ADMIN.email, "admin-pass-4");

    const created = await request(app)
      .post("/api/admin/posts")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Toggle Me", content: "Content." });

    const published = await request(app)
      .put(`/api/admin/posts/${created.body.data.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ published: true });
    expect(published.body.data.published).toBe(true);
    expect(published.body.data.published_at).toBeTruthy();

    const unpublished = await request(app)
      .put(`/api/admin/posts/${created.body.data.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ published: false });
    expect(unpublished.body.data.published).toBe(false);
    expect(unpublished.body.data.published_at).toBeFalsy();
  });

  it("deletes a post", async () => {
    const token = await loginAs(ADMIN.email, "admin-pass-4");
    const created = await request(app)
      .post("/api/admin/posts")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "To Delete", content: "Bye." });

    const res = await request(app)
      .delete(`/api/admin/posts/${created.body.data.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(204);
  });
});

const { createMockDb } = require("./setup/mockDb");

jest.mock("../db", () => {
  const { createMockDb } = require("./setup/mockDb");
  return global.__mockDb || (global.__mockDb = createMockDb());
});

const request = require("supertest");

const OWNER = { id: 60, name: "Search Test Owner", email: "searchowner@example.com", role: "user", token_version: 0 };

const PROPERTIES = [
  {
    id: 700, title: "Modern Duplex in Lekki", description: "A stunning waterfront duplex.",
    property_type: "residential", listing_type: "sale", price: 45000000, currency: "NGN",
    state: "Lagos", city: "Lekki", owner_id: OWNER.id, status: "active",
    verification_status: "verified", verification_notes: null, images: "[]", video_id: "abc123",
    created_at: "2026-01-05T00:00:00.000Z",
  },
  {
    id: 701, title: "Cozy Studio in Yaba", description: "Great for young professionals.",
    property_type: "residential", listing_type: "rent", price: 1200000, currency: "NGN",
    state: "Lagos", city: "Yaba", owner_id: OWNER.id, status: "active",
    verification_status: "pending", verification_notes: null, images: "[]", video_id: null,
    created_at: "2026-01-04T00:00:00.000Z",
  },
  {
    id: 702, title: "Office Space in Abuja", description: "Prime commercial location.",
    property_type: "commercial", listing_type: "rent", price: 8000000, currency: "NGN",
    state: "FCT", city: "Abuja", owner_id: OWNER.id, status: "active",
    verification_status: "verified", verification_notes: null, images: "[]", video_id: null,
    created_at: "2026-01-03T00:00:00.000Z",
  },
  {
    id: 703, title: "Rejected Bungalow", description: "Bad title documents.",
    property_type: "residential", listing_type: "sale", price: 3000000, currency: "NGN",
    state: "Lagos", city: "Ikeja", owner_id: OWNER.id, status: "active",
    verification_status: "rejected", verification_notes: "Fake title docs", images: "[]", video_id: null,
    created_at: "2026-01-02T00:00:00.000Z",
  },
  {
    id: 704, title: "Sold Terrace House", description: "No longer available.",
    property_type: "residential", listing_type: "sale", price: 20000000, currency: "NGN",
    state: "Lagos", city: "Lekki", owner_id: OWNER.id, status: "sold",
    verification_status: "verified", verification_notes: null, images: "[]", video_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
  },
];

let app;

beforeEach(() => {
  jest.resetModules();
  global.__mockDb = createMockDb({ users: [OWNER], properties: PROPERTIES, nextPropertyId: 705 });
  app = require("../server");
});

describe("GET /api/properties (public search)", () => {
  it("excludes rejected listings by default", async () => {
    const res = await request(app).get("/api/properties");
    const ids = res.body.data.map((p) => p.id);
    expect(ids).not.toContain(703);
  });

  it("excludes non-active listings (e.g. sold)", async () => {
    const res = await request(app).get("/api/properties");
    const ids = res.body.data.map((p) => p.id);
    expect(ids).not.toContain(704);
  });

  it("returns everything else, sorted newest first", async () => {
    const res = await request(app).get("/api/properties");
    expect(res.body.data.map((p) => p.id)).toEqual([700, 701, 702]);
  });

  it("filters by free-text search across title/description/city/state", async () => {
    const res = await request(app).get("/api/properties?q=Lekki");
    expect(res.body.data.map((p) => p.id)).toEqual([700]);
  });

  it("matches free-text search against description too", async () => {
    const res = await request(app).get("/api/properties?q=waterfront");
    expect(res.body.data.map((p) => p.id)).toEqual([700]);
  });

  it("filters by state", async () => {
    const res = await request(app).get("/api/properties?state=FCT");
    expect(res.body.data.map((p) => p.id)).toEqual([702]);
  });

  it("filters by city", async () => {
    const res = await request(app).get("/api/properties?city=Yaba");
    expect(res.body.data.map((p) => p.id)).toEqual([701]);
  });

  it("filters by property_type", async () => {
    const res = await request(app).get("/api/properties?property_type=commercial");
    expect(res.body.data.map((p) => p.id)).toEqual([702]);
  });

  it("filters by listing_type", async () => {
    const res = await request(app).get("/api/properties?listing_type=rent");
    expect(res.body.data.map((p) => p.id).sort()).toEqual([701, 702]);
  });

  it("filters by min_price and max_price together", async () => {
    const res = await request(app).get("/api/properties?min_price=2000000&max_price=10000000");
    expect(res.body.data.map((p) => p.id)).toEqual([702]);
  });

  it("filters to verified_only", async () => {
    const res = await request(app).get("/api/properties?verified_only=true");
    expect(res.body.data.map((p) => p.id).sort()).toEqual([700, 702]);
  });

  it("filters to has_video", async () => {
    const res = await request(app).get("/api/properties?has_video=true");
    expect(res.body.data.map((p) => p.id)).toEqual([700]);
  });

  it("combines multiple filters (AND, not OR)", async () => {
    const res = await request(app).get("/api/properties?state=Lagos&listing_type=rent");
    expect(res.body.data.map((p) => p.id)).toEqual([701]);
  });

  it("returns an empty result set when nothing matches, not an error", async () => {
    const res = await request(app).get("/api/properties?city=Kano");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.total).toBe(0);
  });

  it("paginates results and reports accurate totals", async () => {
    const res = await request(app).get("/api/properties?limit=2&page=1");
    expect(res.body.data.length).toBe(2);
    expect(res.body.pagination).toEqual(
      expect.objectContaining({ page: 1, limit: 2, total: 3, totalPages: 2 })
    );

    const page2 = await request(app).get("/api/properties?limit=2&page=2");
    expect(page2.body.data.length).toBe(1);
    expect(page2.body.data[0].id).toBe(702);
  });

  it("caps the page size at 50 regardless of what's requested", async () => {
    const res = await request(app).get("/api/properties?limit=999");
    expect(res.body.pagination.limit).toBe(50);
  });
});

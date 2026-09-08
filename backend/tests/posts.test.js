const { createMockDb } = require("./setup/mockDb");

jest.mock("../db", () => {
  const { createMockDb } = require("./setup/mockDb");
  return global.__mockDb || (global.__mockDb = createMockDb());
});

const request = require("supertest");

const AUTHOR = { id: 40, name: "Blog Author", email: "author@example.com", role: "user", token_version: 0 };

let app;

beforeEach(() => {
  jest.resetModules();
  global.__mockDb = createMockDb({
    users: [AUTHOR],
    posts: [
      {
        id: 1, title: "Published Post", slug: "published-post", excerpt: "excerpt",
        content: "# Hello\n\nSome **content**.", cover_image: null, published: 1,
        author_id: AUTHOR.id, published_at: new Date().toISOString(),
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      },
      {
        id: 2, title: "Draft Post", slug: "draft-post", excerpt: "excerpt",
        content: "still being written", cover_image: null, published: 0,
        author_id: AUTHOR.id, published_at: null,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      },
    ],
    nextPostId: 3,
  });
  app = require("../server");
});

describe("GET /api/posts", () => {
  it("only returns published posts", async () => {
    const res = await request(app).get("/api/posts");
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].slug).toBe("published-post");
  });

  it("includes pagination metadata", async () => {
    const res = await request(app).get("/api/posts");
    expect(res.body.pagination).toEqual(
      expect.objectContaining({ page: 1, total: 1 })
    );
  });
});

describe("GET /api/posts/:slug", () => {
  it("returns a published post by slug", async () => {
    const res = await request(app).get("/api/posts/published-post");
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe("Published Post");
  });

  it("404s for a draft post's slug (not publicly reachable)", async () => {
    const res = await request(app).get("/api/posts/draft-post");
    expect(res.status).toBe(404);
  });

  it("404s for an unknown slug", async () => {
    const res = await request(app).get("/api/posts/does-not-exist");
    expect(res.status).toBe(404);
  });
});

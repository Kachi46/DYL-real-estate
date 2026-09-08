const { createMockDb } = require("./setup/mockDb");

jest.mock("../db", () => {
  const { createMockDb } = require("./setup/mockDb");
  return global.__mockDb || (global.__mockDb = createMockDb());
});

const request = require("supertest");

let app;

beforeEach(() => {
  jest.resetModules();
  global.__mockDb = createMockDb({ users: [] });
  app = require("../server");
});

describe("auth rate limiting", () => {
  it("starts rejecting login attempts once the limiter's cap is hit", async () => {
    const attempt = () =>
      request(app)
        .post("/api/auth/login")
        .send({ email: "nobody@example.com", password: "wrong-password" });

    const responses = [];
    // Send more requests than any reasonable limiter cap would allow -
    // the exact number in middleware/rateLimit.js can change without this
    // test needing to track it exactly, as long as *something* trips.
    for (let i = 0; i < 25; i += 1) {
      responses.push(await attempt());
    }

    const statuses = responses.map((r) => r.status);
    expect(statuses).toContain(401); // real attempts still return normal auth failures
    expect(statuses).toContain(429); // until the limiter kicks in
  });
});

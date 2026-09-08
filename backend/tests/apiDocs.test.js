const { createMockDb } = require("./setup/mockDb");

jest.mock("../db", () => {
  const { createMockDb } = require("./setup/mockDb");
  return global.__mockDb || (global.__mockDb = createMockDb());
});

const request = require("supertest");

let app;

beforeEach(() => {
  jest.resetModules();
  global.__mockDb = createMockDb();
  app = require("../server");
});

describe("API documentation", () => {
  it("serves the raw OpenAPI spec as JSON", async () => {
    const res = await request(app).get("/api/openapi.json");
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe("3.0.3");
    expect(res.body.info.title).toBe("DYL Real-Estate Services API");
    expect(Object.keys(res.body.paths).length).toBeGreaterThan(20);
  });

  it("serves the interactive Swagger UI", async () => {
    const res = await request(app).get("/api/docs/");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/html/);
    expect(res.text).toMatch(/swagger-ui/i);
  });
});

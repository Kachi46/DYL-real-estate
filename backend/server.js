require("dotenv").config();

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const { reportError } = require("./lib/errorReporting");

require("./db");

const authRoutes = require("./routes/auth");
const propertyRoutes = require("./routes/properties");
const adminRoutes = require("./routes/admin");
const postRoutes = require("./routes/posts");
const swaggerUi = require("swagger-ui-express");
const yaml = require("js-yaml");
const fs = require("fs");
const path = require("path");

const app = express();

// Sets a standard set of protective headers (X-Frame-Options, X-Content-
// Type-Options, a conservative Content-Security-Policy, etc). CSP's
// default-src 'self' is disabled here because this API only ever returns
// JSON, never renders HTML - the frontends are entirely separate static
// sites this server doesn't serve, so a CSP tuned for HTML pages has
// nothing to protect here and would just be dead config to maintain.
app.use(helmet({ contentSecurityPolicy: false }));

const PORT = process.env.PORT || 4000;

const allowedOrigins = [
  process.env.CLIENT_ORIGIN,
  process.env.ADMIN_ORIGIN,
].filter(Boolean);

// Browsers reject `Access-Control-Allow-Origin: *` combined with
// `Access-Control-Allow-Credentials: true` outright, so setting
// credentials: true unconditionally here was a no-op in the "no origins
// configured" default state - it silently failed rather than actually
// widening access. Only turn credentials on once real origins are set.
app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : "*",
    credentials: allowedOrigins.length > 0,
  })
);

app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "dyl-real-estate-services-backend",
    time: new Date().toISOString(),
  });
});

// API documentation (OpenAPI 3.0). Read once at startup - the spec is a
// static file that only changes when the code changes, so there's no
// reason to re-parse it on every request the way a per-request read
// would. Both the interactive UI and the raw spec are exposed: the UI
// for browsing/trying requests, the raw file for anyone who wants to
// feed it into their own tooling (Postman, a generated client, etc).
const openapiSpec = yaml.load(
  fs.readFileSync(path.join(__dirname, "docs", "openapi.yaml"), "utf8")
);
app.get("/api/openapi.json", (req, res) => res.json(openapiSpec));
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));

app.use("/api/auth", authRoutes);
app.use("/api/properties", propertyRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/posts", postRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found." });
});

// Central error handler
app.use((err, req, res, _next) => {
  reportError(err, req);
  res
    .status(err.status || 500)
    .json({ error: err.message || "Internal server error." });
});

// Local development
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`DYL Real-Estate Services API running on http://localhost:${PORT}`);
  });
}

// Exported for Vercel's serverless runtime (see api/index.js) and for
// requiring in tests. Local dev runs it via the app.listen() block above.
module.exports = app;
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

require("./db");

const authRoutes = require("./routes/auth");
const propertyRoutes = require("./routes/properties");
const adminRoutes = require("./routes/admin");
const postRoutes = require("./routes/posts");

const app = express();

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
    service: "veri-estate-backend",
    time: new Date().toISOString(),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/properties", propertyRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/posts", postRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found." });
});

// Central error handler
app.use((err, req, res, next) => {
  console.error(err);
  res
    .status(err.status || 500)
    .json({ error: err.message || "Internal server error." });
});

// Local development
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`VeriEstate API running on http://localhost:${PORT}`);
  });
}

// Exported for Vercel's serverless runtime (see api/index.js) and for
// requiring in tests. Local dev runs it via the app.listen() block above.
module.exports = app;
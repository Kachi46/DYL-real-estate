// Vercel entrypoint. Vercel's Node.js runtime can invoke an Express app
// directly as a request handler (app is callable as (req, res)), so no
// extra wrapper is needed.
const app = require("../server");

module.exports = app;

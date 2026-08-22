// Vercel entrypoint. Vercel's Node.js runtime can invoke an Express app
// directly as a request handler (app is callable as (req, res)), so no
// serverless-http wrapper is needed here - that was only required for
// Netlify Functions' handler signature.
const app = require("../server");

module.exports = app;

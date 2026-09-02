// This is the frontend's equivalent of a .env file. Static HTML/JS sites
// like this one aren't built with a bundler, so there's no build step to
// read a real .env at - the browser just runs these files as-is. Instead,
// this sets a global variable that config.js picks up.
//
// LOCAL DEV: leave VERI_ESTATE_API_URL blank. config.js falls back to
// http://localhost:4000/api automatically, which is what you want while
// running the backend on your own machine.
//
// DEPLOYED (e.g. this site hosted on GitHub Pages, Vercel, Netlify...):
// set VERI_ESTATE_API_URL to your deployed backend's URL, including the
// /api suffix. Without this, the live site will try to call
// http://localhost:4000/api from every visitor's browser, which does
// not exist for them - that's why nothing loads.
window.VERI_ESTATE_API_URL = "https://dly-real-estate-backend.vercel.app/api"; // e.g. "https://your-backend.vercel.app/api"

// Set this to the deployed public-site URL when the admin and public sites
// are hosted as separate projects. The hostname fallback handles the
// default admin-site.vercel.app / user-site.vercel.app setup automatically.
window.VERI_ESTATE_PUBLIC_SITE_URL = "https://veri-estate-user-site.vercel.app";

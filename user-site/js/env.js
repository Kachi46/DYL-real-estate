// This is the frontend's equivalent of a .env file. Static HTML/JS sites
// like this one aren't built with a bundler, so there's no build step to
// read a real .env at - the browser just runs these files as-is. Instead,
// this sets a couple of global variables that config.js picks up.
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


// window.VERI_ESTATE_API_URL = "http://localhost:4000/api";
window.VERI_ESTATE_API_URL = "http://localhost:4000/api";

// Optional: only needed if you've set up "Sign in with Google" (see
// backend/.env.example -> GOOGLE_CLIENT_ID). Leave blank to keep the
// Google sign-in buttons in their honest "not configured yet" state.
window.GOOGLE_CLIENT_ID = "111642357056-rc5r61sb3v4l0i1jbpulh49j8gml05o9.apps.googleusercontent.com";

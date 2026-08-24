// To force a specific API URL, set window.VERI_ESTATE_API_URL before this
// script loads (e.g. via a small inline <script> in each HTML page when
// deploying somewhere other than localhost). Defaults to localhost for
// local development.
const API_BASE_URL = window.VERI_ESTATE_API_URL || "http://localhost:4000/api";

// Google "Sign in with Google" client ID (not secret - safe to be public,
// it's meant to be embedded in the page). Set window.GOOGLE_CLIENT_ID
// before this script loads once you have one from Google Cloud Console.
// Google sign-in buttons stay in their honest "not configured yet" state
// until this is set - no code changes needed once it is.
const GOOGLE_CLIENT_ID = window.GOOGLE_CLIENT_ID || "";

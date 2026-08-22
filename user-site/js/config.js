// Tries local backend first; falls back to the deployed API.
// To force a specific URL set window.VERI_ESTATE_API_URL before this script loads.
const API_BASE_URL = window.VERI_ESTATE_API_URL || "http://localhost:4000/api";

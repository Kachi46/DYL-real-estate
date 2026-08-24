// Extracts the 11-character YouTube video ID from any of the URL shapes
// people actually paste: watch?v=, youtu.be/, /embed/, /shorts/, or a bare
// ID. Returns null if it isn't recognizably a YouTube link, so callers can
// reject it with a clear validation error instead of silently storing junk.
function extractYouTubeId(input) {
  if (!input || typeof input !== "string") return null;

  const trimmed = input.trim();
  if (!trimmed) return null;

  // A bare 11-character ID pasted directly (YouTube IDs use base64url chars).
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "");

  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  }

  if (host === "youtube.com" || host === "m.youtube.com") {
    if (url.pathname === "/watch") {
      const id = url.searchParams.get("v");
      return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }

    const embedMatch = url.pathname.match(
      /^\/(embed|shorts|live)\/([A-Za-z0-9_-]{11})/
    );
    if (embedMatch) return embedMatch[2];
  }

  return null;
}

module.exports = { extractYouTubeId };

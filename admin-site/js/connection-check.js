// Pings the backend on every page load. If it's unreachable, shows a fixed
// banner at the top of the page — no browser console needed to notice
// something's wrong.
(function () {
  function showBanner(message) {
    if (document.getElementById("connection-banner")) return;
    const el = document.createElement("div");
    el.id = "connection-banner";
    el.className = "connection-banner";
    el.innerHTML = `
      <span>⚠️ ${message}</span>
      <button type="button" aria-label="Dismiss">&times;</button>
    `;
    el.querySelector("button").addEventListener("click", () => el.remove());
    document.body.prepend(el);
  }

  async function checkConnection() {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(API_BASE_URL.replace(/\/api\/?$/, "") + "/api/health", {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error("bad-status");
    } catch (err) {
      showBanner(
        `Can't reach the backend server at <strong>${Util.escapeHtml(API_BASE_URL)}</strong>. ` +
          `Make sure it's running — in the <code>backend</code> folder, run <code>npm start</code> — then reload this page.`
      );
    }
  }

  document.addEventListener("DOMContentLoaded", checkConnection);
})();

document.addEventListener("admin-ready", async () => {
  const content = document.getElementById("dashboard-content");
  try {
    const stats = await Api.get("/admin/stats");
    content.innerHTML = `
      <div class="stat-grid">
        <div class="stat-card"><p class="label">Total listings</p><p class="value">${stats.totalProperties}</p></div>
        <div class="stat-card"><p class="label">Pending verification</p><p class="value gold">${stats.pendingVerification}</p></div>
        <div class="stat-card"><p class="label">Verified</p><p class="value">${stats.verified}</p></div>
        <div class="stat-card"><p class="label">Rejected</p><p class="value red">${stats.rejected}</p></div>
        <div class="stat-card"><p class="label">Registered users</p><p class="value">${stats.totalUsers}</p></div>
        <div class="stat-card"><p class="label">Inquiries received</p><p class="value">${stats.totalInquiries}</p></div>
      </div>
      ${stats.pendingVerification > 0 ? `
        <div class="callout">
          <p><strong>${stats.pendingVerification}</strong> listing${stats.pendingVerification === 1 ? "" : "s"} waiting on title document review.</p>
          <a href="listings.html?verification_status=pending" class="btn btn-primary">Review now</a>
        </div>` : ""}
    `;
  } catch (err) {
    content.innerHTML = `<p class="loading-text">Couldn't load stats right now.</p>`;
  }
});

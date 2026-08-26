const NAV_ITEMS = [
  { href: "index.html", label: "Dashboard", match: "dashboard" },
  { href: "listings.html", label: "Listings", match: "listings" },
  { href: "posts.html", label: "Blog", match: "posts" },
  { href: "users.html", label: "Users", match: "users" },
  { href: "profile.html", label: "Edit Profile", match: "profile" },
];

function renderSidebar(admin) {
  const root = document.getElementById("sidebar-root");
  if (!root) return;
  const current = document.body.dataset.page;

  root.innerHTML = `
    <div class="sidebar-brand">
      <img src="./seal.svg" alt="Logo" height="32" width="32" />
      <div>
        <p class="name">DYL Real Estate Services</p>
        <p class="tag">Admin</p>
      </div>
    </div>
    <nav class="sidebar-nav">
      ${NAV_ITEMS.map((item) => `<a href="${item.href}" class="${item.match === current ? "active" : ""}">${Util.escapeHtml(item.label)}</a>`).join("")}
    </nav>
    <div class="sidebar-footer">
      <p class="admin-name">${Util.escapeHtml(admin.name)}</p>
      <p class="admin-email">${Util.escapeHtml(admin.email)}</p>
      <button id="admin-logout-btn">Log out</button>
    </div>
    <a class="support-badge" href="https://wa.me/2348000000000?text=${encodeURIComponent("Hello DYL Real Estate Services, I need assistance.")}" target="_blank" rel="noopener noreferrer">Online support</a>
  `;

  document.getElementById("admin-logout-btn").addEventListener("click", () => {
    Api.clearToken();
    window.location.href = "login.html";
  });
}

async function initAdminShell() {
  if (!Api.getToken()) {
    window.location.href = "login.html";
    return;
  }
  try {
    const res = await Api.get("/auth/me");
    if (res.user.role !== "admin") {
      Api.clearToken();
      window.location.href = "login.html";
      return;
    }
    renderSidebar(res.user);
    window.currentAdmin = res.user;
    document.dispatchEvent(new CustomEvent("admin-ready", { detail: res.user }));
  } catch (err) {
    Api.clearToken();
    window.location.href = "login.html";
  }
}

document.addEventListener("DOMContentLoaded", initAdminShell);

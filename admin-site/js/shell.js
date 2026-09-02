const ThemeManager = {
  getThemeSetting() {
    return localStorage.getItem("theme-setting") || "light";
  },
  getEffectiveTheme(setting) {
    if (setting === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return setting;
  },
  apply(setting) {
    localStorage.setItem("theme-setting", setting);
    const effective = this.getEffectiveTheme(setting);
    document.documentElement.setAttribute("data-theme", effective);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute("content", effective === "dark" ? "#071510" : "#ffffff");
    }
    this.updateButtons(setting);
  },
  updateButtons(activeSetting) {
    document.querySelectorAll(".theme-segment-btn").forEach((btn) => {
      const val = btn.dataset.themeVal;
      btn.classList.toggle("active", val === activeSetting);
    });
  },
  init() {
    const setting = this.getThemeSetting();
    this.apply(setting);
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (this.getThemeSetting() === "system") {
        this.apply("system");
      }
    });
  }
};

ThemeManager.init();

const NAV_ITEMS = [
  { href: "index.html", label: "Dashboard", match: "dashboard" },
  { href: "listings.html", label: "Listings", match: "listings" },
  { href: "inspections.html", label: "Inspections", match: "inspections" },
  { href: "posts.html", label: "Blog", match: "posts" },
  { href: "users.html", label: "Users", match: "users" },
  { href: "profile.html", label: "Edit Profile", match: "profile" },
];

function renderSidebar(admin) {
  const root = document.getElementById("sidebar-root");
  if (!root) return;
  const current = document.body.dataset.page;

  root.insertAdjacentHTML("beforebegin", `
    <button type="button" class="admin-menu-toggle" id="admin-menu-toggle" aria-controls="sidebar-root" aria-expanded="false" aria-label="Open admin menu">
      <span></span><span></span><span></span>
    </button>
  `);

  root.innerHTML = `
    <div class="sidebar-brand">
      <img src="./img/logo.png" alt="DYL Real-Estate Services logo" height="32" width="32" />
      <div>
        <p class="name">DYL Real-Estate Services</p>
        <p class="tag">Admin</p>
      </div>
    </div>

    <nav class="sidebar-nav">
      ${NAV_ITEMS.map((item) => `<a href="${item.href}" class="${item.match === current ? "active" : ""}">${Util.escapeHtml(item.label)}</a>`).join("")}
    </nav>

    <!-- Profile Setting Card (screenshot style) -->
    <div class="profile-card-panel">
      <div class="profile-card-header">
        <div class="profile-user-info">
          <p class="profile-card-name">${Util.escapeHtml(admin.name)}</p>
          <p class="profile-card-email">${Util.escapeHtml(admin.email)}</p>
        </div>
        <a href="profile.html" class="profile-settings-btn" title="Settings">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
        </a>
      </div>

      <div class="profile-card-menu">
        <a href="https://wa.me/2348000000000?text=${encodeURIComponent("Feedback regarding DYL Real-Estate Services Admin")}" target="_blank" rel="noopener noreferrer" class="profile-menu-item">
          <span>Feedback</span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>
        </a>

        <div class="profile-menu-item theme-item">
          <span>Theme</span>
          <div class="theme-segment-control" id="theme-segment-control">
            <button type="button" class="theme-segment-btn" data-theme-val="system" title="System Theme">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
            </button>
            <button type="button" class="theme-segment-btn" data-theme-val="light" title="Light Theme">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
            </button>
            <button type="button" class="theme-segment-btn" data-theme-val="dark" title="Dark Theme">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
            </button>
          </div>
        </div>

        <a href="../user-site/index.html" class="profile-menu-item" target="_blank">
          <span>Home Page</span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
        </a>

        <a href="posts.html" class="profile-menu-item">
          <span>Changelog</span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
        </a>

        <a href="https://wa.me/2348000000000?text=${encodeURIComponent("Hello DYL Real-Estate Services, I need assistance.")}" class="profile-menu-item" target="_blank" rel="noopener noreferrer">
          <span>Help</span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="4"></circle><line x1="4.93" y1="4.93" x2="9.17" y2="9.17"></line><line x1="14.83" y1="14.83" x2="19.07" y2="19.07"></line><line x1="14.83" y1="9.17" x2="19.07" y2="4.93"></line><line x1="4.93" y1="19.07" x2="9.17" y2="14.83"></line></svg>
        </a>

        <a href="../user-site/trust.html" class="profile-menu-item" target="_blank">
          <span>Docs</span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
        </a>

        <button type="button" class="profile-menu-item logout-item" id="admin-logout-btn">
          <span>Log Out</span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
        </button>
      </div>

      <a class="profile-card-action-btn" href="../user-site/index.html" target="_blank">View Public Site</a>
    </div>
  `;

  // Attach theme segment events
  ThemeManager.updateButtons(ThemeManager.getThemeSetting());
  document.querySelectorAll(".theme-segment-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const val = btn.dataset.themeVal;
      ThemeManager.apply(val);
    });
  });

  document.getElementById("admin-logout-btn").addEventListener("click", () => {
    Api.clearToken();
    window.location.href = "login.html";
  });

  const menuToggle = document.getElementById("admin-menu-toggle");
  menuToggle.addEventListener("click", () => {
    const isOpen = root.classList.toggle("is-open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
    menuToggle.setAttribute("aria-label", isOpen ? "Close admin menu" : "Open admin menu");
  });

  root.querySelectorAll(".sidebar-nav a").forEach((link) => {
    link.addEventListener("click", () => {
      root.classList.remove("is-open");
      menuToggle.setAttribute("aria-expanded", "false");
      menuToggle.setAttribute("aria-label", "Open admin menu");
    });
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


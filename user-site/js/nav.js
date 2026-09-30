const ThemeManager = {
  getThemeSetting() {
    return localStorage.getItem("theme-setting") || localStorage.getItem("theme") || "light";
  },
  getEffectiveTheme(setting) {
    if (setting === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return setting;
  },
  apply(setting) {
    const theme = this.getEffectiveTheme(setting);
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme-setting", setting);
    localStorage.setItem("theme", theme);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute("content", theme === "dark" ? "#071510" : "#ffffff");
    }
    this.updateControls(setting);
  },
  updateControls(activeSetting) {
    document.querySelectorAll(".theme-segment-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.themeVal === activeSetting);
    });
  },
  init() {
    const setting = this.getThemeSetting();
    this.apply(setting);
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (this.getThemeSetting() === "system") this.apply("system");
    });
  }
};

// Immediately apply theme to avoid flash
ThemeManager.init();

function renderNavbar() {
  const root = document.getElementById("navbar-root");
  if (!root) return;

  const token = Api.getToken();

  root.innerHTML = `
    <div class="navbar-inner">
      <a class="brand" href="index.html">
        <img src="./img/logo.png" alt="DYL Real-Estate Services logo" height="32" width="32" />
        <span class="brand-text">DYL Real-Estate Services</span>
      </a>

      <nav class="nav-links">
        <a href="listings.html?listing_type=sale" class="nav-link">Buy</a>
        <a href="listings.html?listing_type=rent" class="nav-link">Rent</a>

        <div class="nav-dropdown">
          <button type="button" class="nav-dropdown-btn" aria-haspopup="true" aria-expanded="false">
            Properties
            <svg class="dropdown-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </button>
          <div class="nav-dropdown-menu">
            <a href="listings.html?property_type=residential">Residential Homes</a>
            <a href="listings.html?property_type=land">Land & Plots</a>
            <a href="listings.html?property_type=commercial">Commercial Spaces</a>
            <a href="listings.html?listing_type=rent&property_type=residential">Shortlet Apartments</a>
            <div class="nav-dropdown-divider"></div>
            <a href="listings.html?verified_only=true" class="highlight-link">
              <span class="verified-dot"></span> Title-Verified Only
            </a>
          </div>
        </div>

        <div class="nav-dropdown">
          <button type="button" class="nav-dropdown-btn" aria-haspopup="true" aria-expanded="false">
            Explore
            <svg class="dropdown-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </button>
          <div class="nav-dropdown-menu">
            <a href="index.html#locations">Area Guide</a>
            <a href="blog.html">Market Insights & Blog</a>
            <a href="mortgage.html">Mortgage Calculator</a>
            <a href="book-inspection.html">Book Inspection</a>
            <a href="trust.html">Trust & Legal</a>
            <a href="about.html">About DYL</a>
          </div>
        </div>

        <a href="tel:+2348000000000" class="nav-link nav-call-link" title="Call DYL Property Desk">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
          <span>Call</span>
        </a>

        <a href="dashboard.html" id="nav-dashboard-link" class="nav-link" style="display:none;">My Dashboard</a>
      </nav>

      <div class="nav-actions-wrapper">
        <a href="listings.html" class="nav-search-btn" title="Search properties" aria-label="Search properties">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        </a>

        <div class="nav-actions" id="nav-actions"></div>

        <button type="button" class="mobile-menu-btn" id="mobile-menu-toggle" aria-label="Toggle Navigation Menu" aria-expanded="false">
          <span class="hamburger-line"></span>
          <span class="hamburger-line"></span>
          <span class="hamburger-line"></span>
        </button>
      </div>
    </div>

  `;

  root.insertAdjacentHTML("afterend", `
    <div class="mobile-nav-backdrop" id="mobile-nav-backdrop"></div>
    <div class="mobile-nav-drawer" id="mobile-nav-drawer">
      <div class="mobile-drawer-header">
        <a class="brand" href="index.html">
          <img src="./img/logo.png" alt="DYL Real-Estate Services logo" height="26" width="26" />
          <span>DYL Services</span>
        </a>
        <button type="button" class="mobile-drawer-close" id="mobile-drawer-close" aria-label="Close menu">&times;</button>
      </div>

      <div class="mobile-drawer-body">
        <a href="tel:+2348000000000" class="mobile-call-banner">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
          <span>Call DYL Property Desk</span>
          <strong>+234 800 000 0000</strong>
        </a>

        <div class="mobile-nav-group">
          <p class="mobile-nav-heading">Properties</p>
          <a href="listings.html?listing_type=sale">Buy Property</a>
          <a href="listings.html?listing_type=rent">Rent Property</a>
          <a href="listings.html?property_type=residential">Residential Homes</a>
          <a href="listings.html?property_type=land">Land &amp; Plots</a>
          <a href="listings.html?property_type=commercial">Commercial Spaces</a>
          <a href="listings.html?listing_type=rent&property_type=residential">Shortlet Apartments</a>
          <a href="listings.html?verified_only=true" class="mobile-highlight">✓ Verified Listings Only</a>
        </div>

        <div class="mobile-nav-group">
          <p class="mobile-nav-heading">Explore & Services</p>
          <a href="index.html#locations">Area Guide</a>
          <a href="book-inspection.html">Book an Inspection</a>
          <a href="mortgage.html">Mortgage Calculator</a>
          <a href="blog.html">Market News & Blog</a>
          <a href="trust.html">Trust & Legal Verification</a>
          <a href="about.html">About Us</a>
          <a href="contact.html">Contact Us</a>
          <a href="https://wa.me/2348000000000?text=${encodeURIComponent("Hello DYL Real-Estate Services, I need assistance.")}" target="_blank" rel="noopener noreferrer">Chat on WhatsApp</a>
        </div>
      </div>
    </div>
    <nav class="mobile-bottom-nav" aria-label="Quick links">
      <a href="index.html">Home</a>
      <a href="listings.html?listing_type=sale">Buy</a>
      <a href="listings.html?listing_type=rent">Rent</a>
      <a href="tel:+2348000000000">Call</a>
      <a href="dashboard.html">Post</a>
      <a href="book-inspection.html">Inspection</a>
    </nav>
    <a class="support-badge" href="tel:+2348000000000" title="Call Property Desk"><span class="support-dot"></span> Call Desk</a>
  `);

  const actions = document.getElementById("nav-actions");

  function renderActionButtons(user = null) {
    if (!user) {
      actions.innerHTML = `
        <a href="login.html" class="nav-login-link">Log in</a>
        <a href="dashboard.html" class="btn btn-gold nav-post-btn">
          <span>Post Property</span>
        </a>
      `;
    } else {
      actions.innerHTML = `
        <span class="user-greeting">Hi, ${Util.escapeHtml(user.name.split(" ")[0])}</span>
        <button class="btn btn-outline nav-logout-btn" id="logout-btn">Log out</button>
      `;
      const logoutBtn = document.getElementById("logout-btn");
      if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
          Api.clearToken();
          window.location.href = "index.html";
        });
      }
    }
  }

  const dropdowns = Array.from(root.querySelectorAll(".nav-dropdown"));
  const closeDropdowns = () => {
    dropdowns.forEach((dropdown) => {
      dropdown.classList.remove("is-open");
      dropdown.querySelector(".nav-dropdown-btn")?.setAttribute("aria-expanded", "false");
    });
  };

  dropdowns.forEach((dropdown) => {
    const button = dropdown.querySelector(".nav-dropdown-btn");
    button.addEventListener("click", () => {
      const shouldOpen = !dropdown.classList.contains("is-open");
      closeDropdowns();
      if (shouldOpen) {
        dropdown.classList.add("is-open");
        button.setAttribute("aria-expanded", "true");
      }
    });

    dropdown.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && dropdown.classList.contains("is-open")) {
        closeDropdowns();
        button.focus();
      }
    });
  });

  document.addEventListener("click", (event) => {
    if (!dropdowns.some((dropdown) => dropdown.contains(event.target))) {
      closeDropdowns();
    }
  });

  document.addEventListener("focusin", (event) => {
    if (!dropdowns.some((dropdown) => dropdown.contains(event.target))) {
      closeDropdowns();
    }
  });

  // Mobile menu drawer toggle
  const mobileToggle = document.getElementById("mobile-menu-toggle");
  const mobileDrawer = document.getElementById("mobile-nav-drawer");
  const mobileBackdrop = document.getElementById("mobile-nav-backdrop");
  const mobileClose = document.getElementById("mobile-drawer-close");

  const closeMobileMenu = () => {
    if (mobileDrawer) mobileDrawer.classList.remove("open");
    if (mobileBackdrop) mobileBackdrop.classList.remove("open");
    if (mobileToggle) mobileToggle.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  };

  const openMobileMenu = () => {
    if (mobileDrawer) mobileDrawer.classList.add("open");
    if (mobileBackdrop) mobileBackdrop.classList.add("open");
    if (mobileToggle) mobileToggle.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  };

  if (mobileToggle) {
    mobileToggle.addEventListener("click", () => {
      if (mobileDrawer && mobileDrawer.classList.contains("open")) {
        closeMobileMenu();
      } else {
        openMobileMenu();
      }
    });
  }

  if (mobileClose) mobileClose.addEventListener("click", closeMobileMenu);
  if (mobileBackdrop) mobileBackdrop.addEventListener("click", closeMobileMenu);

  if (!token) {
    renderActionButtons(null);
    return;
  }

  // We have a token — verify it and show the user's name.
  Api.get("/auth/me")
    .then((res) => {
      const dashboardLink = document.getElementById("nav-dashboard-link");
      if (dashboardLink) dashboardLink.style.display = "";
      renderActionButtons(res.user);
      renderUserSettings(res.user);
    })
    .catch(() => {
      Api.clearToken();
      renderActionButtons(null);
    });
}

function renderUserSettings(user) {
  document.body.insertAdjacentHTML("beforeend", `
    <button type="button" class="user-settings-trigger" id="user-settings-trigger" aria-expanded="false" aria-controls="user-settings-panel">
      <span class="settings-trigger-icon" aria-hidden="true">⚙</span>
      <span>Settings</span>
    </button>
    <aside class="user-settings-panel" id="user-settings-panel" aria-label="Account settings" hidden>
      <div class="user-settings-header">
        <div>
          <p class="settings-eyebrow">Your account</p>
          <h2>${Util.escapeHtml(user.name)}</h2>
          <p>${Util.escapeHtml(user.email)}</p>
        </div>
        <button type="button" class="settings-close" id="user-settings-close" aria-label="Close settings">&times;</button>
      </div>
      <div class="user-settings-links">
        <a href="dashboard.html#settings">Account settings <span>›</span></a>
        <a href="dashboard.html">My dashboard <span>›</span></a>
        <a href="dashboard.html#settings">Change password <span>›</span></a>
      </div>
      <div class="user-settings-theme">
        <div>
          <strong>Appearance</strong>
          <span>Choose how the site looks.</span>
        </div>
        <div class="theme-segment-control" aria-label="Theme preference">
          <button type="button" class="theme-segment-btn" data-theme-val="system" title="Use your device theme">Device</button>
          <button type="button" class="theme-segment-btn" data-theme-val="light" title="Always use light theme">Light</button>
          <button type="button" class="theme-segment-btn" data-theme-val="dark" title="Always use dark theme">Dark</button>
        </div>
      </div>
      <p class="settings-status ${user.email_verified ? "is-success" : "is-warning"}">
        ${user.email_verified ? "Email verified" : "Email not verified. Verify it from your dashboard."}
      </p>
    </aside>
  `);

  const trigger = document.getElementById("user-settings-trigger");
  const panel = document.getElementById("user-settings-panel");
  const close = () => {
    panel.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  };
  trigger.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    trigger.setAttribute("aria-expanded", String(!panel.hidden));
  });
  document.getElementById("user-settings-close").addEventListener("click", close);
  panel.querySelectorAll("a").forEach((link) => link.addEventListener("click", close));
  panel.querySelectorAll(".theme-segment-btn").forEach((button) => {
    button.addEventListener("click", () => ThemeManager.apply(button.dataset.themeVal));
  });
  ThemeManager.updateControls(ThemeManager.getThemeSetting());
}

function renderFooter() {
  const root = document.getElementById("footer-root");
  if (!root) return;
  root.innerHTML = `
    <div class="container">
      <div class="footer-top">
        <div style="max-width:22rem;">
          <p class="font-display" style="font-size:1.2rem;font-weight:600;color:#fff;margin:0;">DYL Real-Estate Services</p>
          <p style="margin-top:0.5rem;font-size:0.875rem;color:var(--forest-300);line-height:1.6;">
            Every listing on DYL Real-Estate Services passes through title document review before it earns
            our verification seal. Search land and residential properties across Nigeria with 100% confidence.
          </p>
        </div>
        <div class="footer-cols" style="grid-template-columns: repeat(3, 1fr); gap:2rem;">
          <div>
            <h4>Popular Locations</h4>
            <ul>
              <li><a href="listings.html?q=Lekki">Property in Lekki</a></li>
              <li><a href="listings.html?q=Ikeja">Property in Ikeja</a></li>
              <li><a href="listings.html?q=Ikoyi">Property in Ikoyi</a></li>
              <li><a href="listings.html?q=Abuja">Property in Abuja</a></li>
              <li><a href="listings.html?q=Port+Harcourt">Property in Port Harcourt</a></li>
            </ul>
          </div>
          <div>
            <h4>Categories</h4>
            <ul>
              <li><a href="listings.html?property_type=residential">Residential Homes</a></li>
              <li><a href="listings.html?property_type=land">Land &amp; Plots</a></li>
              <li><a href="listings.html?property_type=commercial">Commercial Spaces</a></li>
              <li><a href="listings.html?listing_type=sale">Houses for Sale</a></li>
              <li><a href="listings.html?listing_type=rent">Flats for Rent</a></li>
            </ul>
          </div>
          <div>
            <h4>Platform</h4>
            <ul>
              <li><a href="index.html#steps">Verification Process</a></li>
              <li><a href="trust.html">Trust and legal</a></li>
              <li><a href="about.html">About us</a></li>
              <li><a href="services.html">Services</a></li>
              <li><a href="testimonials.html">Testimonials</a></li>
              <li><a href="book-inspection.html">Book an inspection</a></li>
              <li><a href="contact.html">Contact us</a></li>
              <li><a href="faq.html">FAQ</a></li>
              <li><a href="mortgage.html">Mortgage calculator</a></li>
              <li><a href="dashboard.html">List Your Property</a></li>
              <li><a href="blog.html">Real Estate News</a></li>
              <li><a href="listings.html?verified_only=true">Verified Only</a></li>
            </ul>
          </div>
        </div>
      </div>
      <p class="footer-bottom">© <span id="footer-year"></span> DYL Real-Estate Services. Nigeria's title-verified property portal.</p>
    </div>
  `;
  document.getElementById("footer-year").textContent = new Date().getFullYear();
}

document.addEventListener("DOMContentLoaded", () => {
  renderNavbar();
  renderFooter();
});

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
        <img src="./img/logo.png" alt="DYL Real-Estate Services logo" height="28" width="28" />
        <span>DYL Real-Estate Services</span>
      </a>

      <nav class="nav-links">
        <a href="listings.html?listing_type=sale">Buy</a>
        <a href="listings.html?listing_type=rent">Rent</a>
        <a href="listings.html?property_type=residential">New Project</a>
        <span class="nav-divider">|</span>
        <a href="listings.html?listing_type=rent&property_type=residential">Shortlet</a>
        <a href="agents.html">Agents</a>
        <a href="index.html#locations">Area Guide</a>
        <a href="blog.html">Blogs</a>
        <a href="dashboard.html" id="nav-dashboard-link" style="display:none;">My Dashboard</a>
      </nav>

      <div class="nav-actions" id="nav-actions"></div>
    </div>
    <nav class="mobile-bottom-nav" aria-label="More pages">
      <a href="trust.html">Trust and legal</a>
      <a href="about.html">About us</a>
      <a href="services.html">Services</a>
      <a href="listings.html">Properties / listings</a>
      <a href="agents.html">Agent profile</a>
      <a href="book-inspection.html">Book an inspection</a>
      <a href="mortgage.html">Mortgage calculator</a>
      <a href="faq.html">FAQ</a>
      <a href="testimonials.html">Testimonials</a>
      <a href="blog.html">Blog / market news</a>
      <a href="terms.html">Terms and conditions</a>
      <a href="privacy.html">Privacy policy</a>
      <a href="contact.html">Contact us</a>
      <a href="mailto:admin@dylrealestateservices.com">Contact us by email</a>
      <a href="tel:+2348000000000">Call customer service</a>
      <a href="https://wa.me/2348000000000?text=${encodeURIComponent("Hello DYL Real-Estate Services, I need assistance.")}" target="_blank" rel="noopener noreferrer">Chat on WhatsApp</a>
    </nav>
    <a class="support-badge" href="https://wa.me/2348000000000?text=${encodeURIComponent("Hello DYL Real-Estate Services, I need assistance.")}" target="_blank" rel="noopener noreferrer"><span class="support-dot"></span> Support</a>
  `;

  const actions = document.getElementById("nav-actions");

  if (!token) {
    actions.innerHTML = `
      <a href="login.html" style="font-size:0.85rem;font-weight:500;color:var(--forest-700);">Log in</a>
      <a href="dashboard.html" class="btn btn-gold">Post Property</a>
    `;
    return;
  }

  // We have a token — verify it and show the user's name.
  Api.get("/auth/me")
    .then((res) => {
      document.getElementById("nav-dashboard-link").style.display = "";
      actions.innerHTML = `
        <span class="user-greeting">Hi, ${Util.escapeHtml(res.user.name.split(" ")[0])}</span>
        <button class="btn btn-outline" id="logout-btn" style="padding:0.45rem 0.85rem;">Log out</button>
      `;
      renderUserSettings(res.user);
      document.getElementById("logout-btn").addEventListener("click", () => {
        Api.clearToken();
        window.location.href = "index.html";
      });
    })
    .catch(() => {
      Api.clearToken();
      actions.innerHTML = `
        <a href="login.html" style="font-size:0.85rem;font-weight:500;color:var(--forest-700);">Log in</a>
        <a href="dashboard.html" class="btn btn-gold">Post Property</a>
      `;
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

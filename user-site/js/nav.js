const ThemeManager = {
  getTheme() {
    return localStorage.getItem("theme") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  },
  apply(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute("content", theme === "dark" ? "#071510" : "#f8f6f1");
    }
    this.updateButton(theme);
  },
  toggle() {
    const next = this.getTheme() === "dark" ? "light" : "dark";
    this.apply(next);
  },
  updateButton(theme) {
    const btn = document.getElementById("theme-toggle-btn");
    if (!btn) return;
    const isDark = theme === "dark";
    btn.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
    btn.setAttribute("title", isDark ? "Switch to light mode" : "Switch to dark mode");
    btn.innerHTML = isDark
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
  },
  init() {
    this.apply(this.getTheme());
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
      <button type="button" class="menu-toggle" id="menu-toggle" aria-expanded="false" aria-controls="mobile-menu" aria-label="Open menu"><span></span><span></span><span></span></button>
    </div>
    <div class="mobile-menu" id="mobile-menu" hidden>
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
    </div>
    <a class="support-badge" href="https://wa.me/2348000000000?text=${encodeURIComponent("Hello DYL Real-Estate Services, I need assistance.")}" target="_blank" rel="noopener noreferrer"><span class="support-dot"></span> Support</a>
  `;

  const menuToggle = document.getElementById("menu-toggle");
  const mobileMenu = document.getElementById("mobile-menu");

  if (menuToggle && mobileMenu) {
    const setMenuState = (isOpen) => {
      menuToggle.setAttribute("aria-expanded", String(isOpen));
      menuToggle.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
      mobileMenu.hidden = !isOpen;
      mobileMenu.classList.toggle("open", isOpen);
    };

    setMenuState(false);
    menuToggle.addEventListener("click", () => {
      const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
      setMenuState(!isOpen);
    });
  }

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
        <span style="font-size:0.85rem;color:var(--forest-700);" class="hide-mobile">Hi, ${Util.escapeHtml(res.user.name.split(" ")[0])}</span>
        <a href="dashboard.html" class="btn btn-gold">Post Property</a>
        <button class="btn btn-outline" id="logout-btn" style="padding:0.45rem 0.85rem;">Log out</button>
      `;
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

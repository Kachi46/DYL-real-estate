const propertyId = Util.qs("id");
const root = document.getElementById("detail-root");

let currentUser = null;
let saved = false;

function bookmarkIconHtml(filled) {
  return `<svg viewBox="0 0 20 20" width="15" height="15" fill="${filled ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.6" style="display:inline-block;vertical-align:-2px;margin-right:0.4rem;">
    <path d="M5 3.5A1.5 1.5 0 0 1 6.5 2h7A1.5 1.5 0 0 1 15 3.5v13.4a.6.6 0 0 1-.94.5L10 14.2l-4.06 3.2a.6.6 0 0 1-.94-.5V3.5z" stroke-linejoin="round" />
  </svg>`;
}

async function init() {
  if (!propertyId) {
    root.innerHTML = notFoundHtml();
    return;
  }

  if (Api.getToken()) {
    try { currentUser = (await Api.get("/auth/me")).user; } catch (e) { Api.clearToken(); }
  }

  let property;
  try {
    property = (await Api.get(`/properties/${propertyId}`)).data;
  } catch (err) {
    root.innerHTML = notFoundHtml();
    return;
  }

  render(property);
}

function notFoundHtml() {
  return `
    <div class="text-center" style="padding:6rem 0;">
      <p class="font-display" style="font-size:1.5rem;color:var(--forest-900);">Listing not found</p>
      <a href="listings.html" style="color:var(--gold-600);display:inline-block;margin-top:1rem;">← Back to listings</a>
    </div>`;
}

function mapEmbedHtml(p) {
  // Built entirely from this property's own stored data — no fallback
  // coordinates, no placeholder pin. city/state are required fields on
  // every listing, so there's always at least a city-level query; address
  // (when the owner supplied one) narrows it further.
  const parts = [p.address, p.city, p.state, "Nigeria"].filter(Boolean);

  if (parts.length === 0) {
    return `<div class="location-map-fallback">No location details available for this listing.</div>`;
  }

  const query = encodeURIComponent(parts.join(", "));

  return `<iframe
    src="https://maps.google.com/maps?q=${query}&z=14&output=embed"
    title="Map showing ${Util.escapeHtml(parts.join(', '))}"
    loading="lazy"
    referrerpolicy="no-referrer-when-downgrade"
  ></iframe>`;
}

function render(p) {
  const image = (p.images && p.images[0]) || "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200";
  const saveBtn = currentUser
    ? `<button class="btn btn-outline" id="save-btn" style="flex-shrink:0;">${bookmarkIconHtml(false)}Save</button>`
    : "";

  root.innerHTML = `
    <div class="detail-grid">
      <div>
        <div class="detail-media">
          <img src="${Util.escapeHtml(image)}" alt="${Util.escapeHtml(p.title)}" />
          ${Util.badgeHtml(p.verification_status, "lg")}
        </div>

        <div class="detail-header">
          <div>
            <h1>${Util.escapeHtml(p.title)}</h1>
            <p class="loc">${p.address ? Util.escapeHtml(p.address) + ", " : ""}${Util.escapeHtml(p.city)}, ${Util.escapeHtml(p.state)}</p>
          </div>
          ${saveBtn}
        </div>

        <div class="stat-row">
          <div><p class="stat-label">Type</p><p class="stat-value">${Util.escapeHtml(p.property_type)}</p></div>
          <div><p class="stat-label">Listing</p><p class="stat-value">For ${Util.escapeHtml(p.listing_type)}</p></div>
          ${p.size_sqm ? `<div><p class="stat-label">Size</p><p class="stat-value">${p.size_sqm} sqm</p></div>` : ""}
          ${p.bedrooms != null ? `<div><p class="stat-label">Bedrooms</p><p class="stat-value">${p.bedrooms}</p></div>` : ""}
          ${p.bathrooms != null ? `<div><p class="stat-label">Bathrooms</p><p class="stat-value">${p.bathrooms}</p></div>` : ""}
          ${p.title_document ? `<div><p class="stat-label">Title document</p><p class="stat-value">${Util.escapeHtml(p.title_document)}</p></div>` : ""}
        </div>

        <div class="desc">
          <h2>Description</h2>
          <p>${Util.escapeHtml(p.description)}</p>
        </div>

        ${p.youtube_watch_url ? `
          <div class="location-block">
            <h2>Video tour</h2>
            <a class="video-tour-link" href="${p.youtube_watch_url}" target="_blank" rel="noopener noreferrer">
              <img src="${p.youtube_thumbnail_url}" alt="Video tour of ${Util.escapeHtml(p.title)}" loading="lazy" />
              <span class="video-tour-link-badge">▶ Watch on YouTube</span>
            </a>
          </div>` : ""}

        <div class="location-block">
          <h2>Location</h2>
          <div class="location-map-frame">
            ${mapEmbedHtml(p)}
          </div>
        </div>

        ${p.verification_status === "verified" ? `
          <div class="verified-note">
            This listing's title document has been reviewed by the VeriEstate team and matched against the seller's claim.
            ${p.verification_notes ? `<br /><span style="color:var(--forest-500);">${Util.escapeHtml(p.verification_notes)}</span>` : ""}
          </div>` : ""}
      </div>

      <div>
        <div class="sidebar-card">
          <p class="sidebar-price">${Util.formatPrice(p.price, p.currency, p.listing_type)}</p>
          
          <div class="agent-card">
            <div class="agent-profile">
              <div class="agent-avatar">DYL</div>
              <div class="agent-info">
                <p class="agent-name">DYL Property Desk</p>
                <p class="agent-role">Verified Listing Agent</p>
              </div>
            </div>
            <div class="agent-actions">
              <a href="https://wa.me/2348000000000?text=${encodeURIComponent(`Hello DYL Real Estate, I am interested in property listing #${p.id}: "${p.title}" located in ${p.city}, ${p.state} priced at ${Util.formatPrice(p.price, p.currency, p.listing_type)}. Is it available for inspection?`)}" target="_blank" rel="noopener" class="btn btn-whatsapp btn-block">
                💬 Chat on WhatsApp
              </a>
              <a href="tel:+2348000000000" class="btn btn-call btn-block">
                📞 Call Agent
              </a>
            </div>
          </div>

          <div id="inquiry-area"></div>
        </div>
      </div>
    </div>
  `;

  if (currentUser) {
    document.getElementById("save-btn").addEventListener("click", toggleSave);
  }

  renderInquiryForm();
}

async function toggleSave() {
  const btn = document.getElementById("save-btn");
  btn.disabled = true;
  try {
    const res = await Api.post(`/properties/${propertyId}/save`);
    saved = res.saved;
    btn.innerHTML = `${bookmarkIconHtml(saved)}${saved ? "Saved" : "Save"}`;
  } finally {
    btn.disabled = false;
  }
}

function renderInquiryForm() {
  const area = document.getElementById("inquiry-area");
  area.innerHTML = `
    <p style="font-size:0.875rem;font-weight:600;color:var(--forest-800);margin-bottom:0.75rem;">Interested in this property?</p>
    <div id="inquiry-error"></div>
    <form class="inquiry-form" id="inquiry-form">
      <input required id="inq-name" placeholder="Your name" value="${currentUser ? Util.escapeHtml(currentUser.name) : ""}" />
      <input required type="email" id="inq-email" placeholder="Email address" value="${currentUser ? Util.escapeHtml(currentUser.email) : ""}" />
      <input id="inq-phone" placeholder="Phone (optional)" />
      <textarea required id="inq-message" rows="3" placeholder="Tell the lister what you'd like to know…"></textarea>
      <button type="submit" class="btn btn-primary btn-block mt-2">Send inquiry</button>
    </form>
  `;

  document.getElementById("inquiry-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById("inquiry-error");
    errorEl.innerHTML = "";
    const payload = {
      name: document.getElementById("inq-name").value,
      email: document.getElementById("inq-email").value,
      phone: document.getElementById("inq-phone").value,
      message: document.getElementById("inq-message").value,
    };
    try {
      await Api.post(`/properties/${propertyId}/inquiries`, payload);
      area.innerHTML = `<p class="alert alert-info">Your inquiry has been sent. The lister will reach out to the contact details you provided.</p>`;
    } catch (err) {
      errorEl.innerHTML = `<p class="alert alert-error">${Util.escapeHtml(err.message)}</p>`;
    }
  });
}

init();

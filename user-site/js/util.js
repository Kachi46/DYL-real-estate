const Util = {
  escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  },

  formatPrice(price, currency, listingType) {
    const formatted = new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: currency || "NGN",
      maximumFractionDigits: 0,
    }).format(price);
    return listingType === "rent" ? `${formatted} / year` : formatted;
  },

  qs(name) {
    return new URLSearchParams(window.location.search).get(name);
  },

  badgeHtml(status, size) {
    const map = {
      verified: { label: "Title Verified", cls: "badge-verified" },
      pending: { label: "Verification Pending", cls: "badge-pending" },
      rejected: { label: "Not Verified", cls: "badge-rejected" },
    };
    const cfg = map[status] || { label: status, cls: "badge-pending" };
    const sizeCls = size === "lg" ? "badge-lg" : "";
    const check =
      status === "verified"
        ? `<svg viewBox="0 0 20 20" fill="none" width="14" height="14"><circle cx="10" cy="10" r="9" stroke="currentColor" stroke-width="1.4" stroke-dasharray="1.6 1.6"/><path d="M6 10.2 8.6 13 14 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`
        : "";
    return `<span class="badge ${cfg.cls} ${sizeCls}">${check}${Util.escapeHtml(cfg.label)}</span>`;
  },

  propertyCardHtml(p) {
    const image = (p.images && p.images[0]) || "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800";
    
    let specsHtml = "";
    if (p.bedrooms != null || p.bathrooms != null || p.size_sqm) {
      specsHtml = `<div class="spec-chip-list">`;
      if (p.bedrooms != null) specsHtml += `<span class="spec-chip">🛏️ ${p.bedrooms} Beds</span>`;
      if (p.bathrooms != null) specsHtml += `<span class="spec-chip">🛁 ${p.bathrooms} Baths</span>`;
      if (p.size_sqm) specsHtml += `<span class="spec-chip">📐 ${p.size_sqm} sqm</span>`;
      specsHtml += `</div>`;
    }

    return `
      <a class="card" href="property.html?id=${p.id}">
        <div class="card-media">
          <img src="${Util.escapeHtml(image)}" alt="${Util.escapeHtml(p.title)}" loading="lazy" />
          <div class="card-badge-tl">${Util.badgeHtml(p.verification_status)}</div>
          <div class="card-type">${Util.escapeHtml(p.property_type)}</div>
        </div>
        <div class="card-body">
          <p class="card-title">${Util.escapeHtml(p.title)}</p>
          <p class="card-loc">📍 ${Util.escapeHtml(p.city)}, ${Util.escapeHtml(p.state)}</p>
          ${specsHtml}
          <p class="card-price">${Util.formatPrice(p.price, p.currency, p.listing_type)}</p>
        </div>
      </a>
    `;
  },

  formatDate(dateStr) {
    return new Date(dateStr.replace(" ", "T") + "Z").toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  },

  postCardHtml(post) {
    return `
      <a class="card" href="post.html?slug=${encodeURIComponent(post.slug)}">
        ${post.cover_image ? `
          <div class="blog-card-media">
            <img src="${Util.escapeHtml(post.cover_image)}" alt="${Util.escapeHtml(post.title)}" loading="lazy" />
          </div>` : ""}
        <div class="card-body">
          <p class="blog-meta">${Util.formatDate(post.published_at)}</p>
          <p class="card-title">${Util.escapeHtml(post.title)}</p>
          ${post.excerpt ? `<p class="card-loc">${Util.escapeHtml(post.excerpt)}</p>` : ""}
          <p class="blog-author">By ${Util.escapeHtml(post.author_name)}</p>
        </div>
      </a>
    `;
  },
};

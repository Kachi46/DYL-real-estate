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

  // Blog post `content` is authored as Markdown in the admin console.
  // `marked` turns it into HTML; `DOMPurify` strips anything dangerous
  // (script tags, inline event handlers, etc) out of that HTML before
  // it's ever put in the DOM - post content ultimately comes from an
  // admin account, but sanitizing it anyway costs nothing and means a
  // compromised/careless admin session can't inject a working script tag
  // into a page every visitor loads.
  renderMarkdown(markdown) {
    if (!markdown) return "";
    if (typeof marked === "undefined" || typeof DOMPurify === "undefined") {
      // CDN scripts failed to load (offline, ad-blocker, etc) - fall back
      // to escaped plain text rather than showing nothing.
      return `<p>${Util.escapeHtml(markdown)}</p>`;
    }
    return DOMPurify.sanitize(marked.parse(markdown));
  },

  formatDate(dateStr) {
    if (!dateStr) return "";
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }
    const cleanStr = String(dateStr).replace(" ", "T");
    const parsedFallback = new Date(cleanStr.endsWith("Z") ? cleanStr : cleanStr + "Z");
    if (!isNaN(parsedFallback.getTime())) {
      return parsedFallback.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }
    return String(dateStr);
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

  // Renders a Prev/Next bar from the `{ page, limit, total, totalPages }`
  // shape paginated endpoints return. Returns "" when there's only one
  // page, so callers can always append this without an extra check.
  paginationBar(pagination) {
    if (!pagination || pagination.totalPages <= 1) return "";
    const { page, totalPages, total } = pagination;
    return `
      <div class="pagination-bar">
        <button class="btn btn-outline" data-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>← Prev</button>
        <span class="pagination-info">Page ${page} of ${totalPages} · ${total} total</span>
        <button class="btn btn-outline" data-page="${page + 1}" ${page >= totalPages ? "disabled" : ""}>Next →</button>
      </div>
    `;
  },
  wirePagination(container, onPageChange) {
    container.querySelectorAll("[data-page]").forEach((btn) => {
      if (btn.disabled) return;
      btn.addEventListener("click", () => onPageChange(Number(btn.dataset.page)));
    });
  },
};

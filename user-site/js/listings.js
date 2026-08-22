const els = {
  q: document.getElementById("f-q"),
  state: document.getElementById("f-state"),
  type: document.getElementById("f-type"),
  listing: document.getElementById("f-listing"),
  minPrice: document.getElementById("f-min-price"),
  maxPrice: document.getElementById("f-max-price"),
  verified: document.getElementById("f-verified"),
  results: document.getElementById("results"),
  pagination: document.getElementById("pagination"),
};

function getFiltersFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return {
    q: params.get("q") || "",
    state: params.get("state") || "",
    property_type: params.get("property_type") || "",
    listing_type: params.get("listing_type") || "",
    min_price: params.get("min_price") || "",
    max_price: params.get("max_price") || "",
    verified_only: params.get("verified_only") || "",
    page: params.get("page") || "1",
  };
}

function applyFiltersToInputs(filters) {
  if (els.q) els.q.value = filters.q;
  if (els.state) els.state.value = filters.state;
  if (els.type) els.type.value = filters.property_type;
  if (els.listing) els.listing.value = filters.listing_type;
  if (els.minPrice) els.minPrice.value = filters.min_price;
  if (els.maxPrice) els.maxPrice.value = filters.max_price;
  if (els.verified) els.verified.checked = filters.verified_only === "true";
}

function updateUrl(overrides) {
  const current = getFiltersFromUrl();
  const next = { ...current, ...overrides };
  if (!("page" in overrides)) next.page = "1";
  const params = new URLSearchParams();
  Object.entries(next).forEach(([k, v]) => { if (v) params.set(k, v); });
  window.location.search = params.toString();
}

async function loadResults() {
  const filters = getFiltersFromUrl();
  applyFiltersToInputs(filters);
  els.results.innerHTML = `<p class="loading-text">Loading listings…</p>`;
  els.pagination.innerHTML = "";

  try {
    const res = await Api.get("/properties", filters);
    if (res.data.length === 0) {
      els.results.innerHTML = `
        <div class="empty-state">
          <p>No listings match those filters yet.</p>
          <p class="small">Try widening your search — new listings are added regularly.</p>
        </div>`;
      return;
    }
    els.results.innerHTML = `<div class="property-grid">${res.data.map(Util.propertyCardHtml).join("")}</div>`;

    const { page, totalPages } = res.pagination;
    if (totalPages > 1) {
      let html = "";
      for (let p = 1; p <= totalPages; p++) {
        html += `<button data-page="${p}" class="${p === page ? "active" : ""}">${p}</button>`;
      }
      els.pagination.innerHTML = html;
      els.pagination.querySelectorAll("button").forEach((btn) => {
        btn.addEventListener("click", () => updateUrl({ page: btn.dataset.page }));
      });
    }
  } catch (err) {
    els.results.innerHTML = `<p class="loading-text">Couldn't load listings right now.</p>`;
  }
}

els.q?.addEventListener("change", (e) => updateUrl({ q: e.target.value }));
els.state?.addEventListener("change", (e) => updateUrl({ state: e.target.value }));
els.type?.addEventListener("change", (e) => updateUrl({ property_type: e.target.value }));
els.listing?.addEventListener("change", (e) => updateUrl({ listing_type: e.target.value }));
els.minPrice?.addEventListener("change", (e) => updateUrl({ min_price: e.target.value }));
els.maxPrice?.addEventListener("change", (e) => updateUrl({ max_price: e.target.value }));
els.verified?.addEventListener("change", (e) => updateUrl({ verified_only: e.target.checked ? "true" : "" }));

loadResults();

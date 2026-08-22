// Hero search tabs handler
const tabBtns = document.querySelectorAll("#hero-search-tabs .search-tab-btn");
const listingTypeInput = document.getElementById("home-search-listing-type");

tabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    if (listingTypeInput) {
      listingTypeInput.value = btn.dataset.listingType || "";
    }
  });
});

document.getElementById("home-search-form")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const q = document.getElementById("home-search-q")?.value.trim() || "";
  const state = document.getElementById("home-search-state")?.value || "";
  const type = document.getElementById("home-search-type")?.value || "";
  const listingType = listingTypeInput?.value || "";
  const minPrice = document.getElementById("home-search-min-price")?.value || "";
  const maxPrice = document.getElementById("home-search-max-price")?.value || "";
  const verifiedOnly = document.getElementById("home-search-verified")?.checked;

  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (state) params.set("state", state);
  if (type) params.set("property_type", type);
  if (listingType) params.set("listing_type", listingType);
  if (minPrice) params.set("min_price", minPrice);
  if (maxPrice) params.set("max_price", maxPrice);
  if (verifiedOnly) params.set("verified_only", "true");

  window.location.href = "listings.html?" + params.toString();
});

// Interactive Video Tour Modal Lightbox
const videoModal = document.getElementById("video-tour-modal");
const videoFrame = document.getElementById("video-player-frame");
const closeVideoBtn = document.getElementById("close-video-modal");
const videoCards = document.querySelectorAll(".video-thumb-wrapper");

videoCards.forEach((card) => {
  card.addEventListener("click", () => {
    const videoUrl = card.dataset.videoUrl;
    if (videoModal && videoFrame) {
      videoFrame.innerHTML = `<iframe src="${videoUrl}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
      videoModal.classList.add("active");
    }
  });
});

if (closeVideoBtn) {
  closeVideoBtn.addEventListener("click", closeVideoPlayer);
}

if (videoModal) {
  videoModal.addEventListener("click", (e) => {
    if (e.target === videoModal) closeVideoPlayer();
  });
}

function closeVideoPlayer() {
  if (videoModal) videoModal.classList.remove("active");
  if (videoFrame) videoFrame.innerHTML = "";
}

async function loadFeatured() {
  const grid = document.getElementById("featured-grid");
  try {
    const res = await Api.get("/properties", { verified_only: "true", limit: 6 });
    if (res.data.length === 0) {
      grid.innerHTML = `<p class="loading-text">No verified listings yet — check back soon.</p>`;
      return;
    }
    grid.innerHTML = res.data.map(Util.propertyCardHtml).join("");
  } catch (err) {
    grid.innerHTML = `<p class="loading-text">Couldn't load listings right now.</p>`;
  }
}

loadFeatured();

function marketRowHtml(item, direction, isFirst) {
  const isGain = direction === "gain";
  const pillClass = isGain ? "pill-gain" : "pill-loss";
  const arrow = isGain ? "▲" : "▼";
  const sign = item.percent_change > 0 ? "+" : "";
  const pct = `${sign}${item.percent_change.toFixed(2)}% ${arrow}`;
  const highlightCls = isGain && isFirst ? " highlight-gain" : "";

  return `
    <a class="market-row${highlightCls}" href="property.html?id=${item.id}">
      <div class="market-item-info">
        <span class="market-item-name">${Util.escapeHtml(item.title)}</span>
        <span class="market-item-type">${Util.escapeHtml(item.city)}, ${Util.escapeHtml(item.state)} · ${Util.escapeHtml(item.property_type)}</span>
      </div>
      <div class="market-item-right">
        <span class="${pillClass}">${pct}</span>
        <span class="market-price">${Util.formatPrice(item.price, item.currency, item.listing_type)}</span>
      </div>
    </a>
  `;
}

async function loadMarketMovers() {
  const gainersList = document.getElementById("market-gainers-list");
  const losersList = document.getElementById("market-losers-list");
  const gainersPeriod = document.getElementById("market-gainers-period");
  const losersPeriod = document.getElementById("market-losers-period");

  try {
    const res = await Api.get("/properties/market/movers");
    const { gainers, losers } = res.data;
    const periodLabel = `Last ${res.window_days} days`;

    if (gainersPeriod) gainersPeriod.textContent = periodLabel;
    if (losersPeriod) losersPeriod.textContent = periodLabel;

    gainersList.innerHTML = gainers.length
      ? gainers.map((item, i) => marketRowHtml(item, "gain", i === 0)).join("")
      : `<p class="loading-text">No price increases recorded in this window yet.</p>`;

    losersList.innerHTML = losers.length
      ? losers.map((item, i) => marketRowHtml(item, "loss", i === 0)).join("")
      : `<p class="loading-text">No price drops recorded in this window yet.</p>`;
  } catch (err) {
    gainersList.innerHTML = `<p class="loading-text">Couldn't load market data right now.</p>`;
    losersList.innerHTML = `<p class="loading-text">Couldn't load market data right now.</p>`;
  }
}

loadMarketMovers();

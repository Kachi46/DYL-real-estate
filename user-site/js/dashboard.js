if (!Api.getToken()) {
  window.location.href = "login.html";
}

let myListings = [];
let mySaved = [];
let listingsPagination = null;
let savedPagination = null;
let listingsPage = 1;
let savedPage = 1;

const tabs = ["listings", "saved", "add"];

function showTab(tab) {
  tabs.forEach((t) => {
    document.getElementById(`panel-${t}`).style.display = t === tab ? "" : "none";
    document.getElementById(`tab-${t}`).classList.toggle("active", t === tab);
  });
  if (tab === "add" && !document.getElementById("listing-form")) {
    renderAddForm();
  }
}

tabs.forEach((t) => {
  document.getElementById(`tab-${t}`).addEventListener("click", () => showTab(t));
});

function renderListings() {
  document.getElementById("tab-listings").textContent = `My Listings (${listingsPagination?.total ?? myListings.length})`;
  const panel = document.getElementById("panel-listings");
  if (myListings.length === 0) {
    panel.innerHTML = `
      <div class="empty-state">
        <p>You haven't listed a property yet.</p>
        <button class="btn btn-primary mt-2" id="empty-add-btn">List a property</button>
      </div>`;
    document.getElementById("empty-add-btn").addEventListener("click", () => showTab("add"));
    return;
  }
  panel.innerHTML = `<div class="property-grid">${myListings
    .map((p) => `
      <div>
        ${Util.propertyCardHtml(p)}
      </div>
    `)
    .join("")}</div>${Util.paginationBar(listingsPagination)}`;
  Util.wirePagination(panel, (page) => {
    listingsPage = page;
    refreshListings();
  });
}

function renderSaved() {
  document.getElementById("tab-saved").textContent = `Saved (${savedPagination?.total ?? mySaved.length})`;
  const panel = document.getElementById("panel-saved");
  if (mySaved.length === 0) {
    panel.innerHTML = `
      <div class="empty-state">
        <p>Nothing saved yet.</p>
        <p class="small"><a href="listings.html" style="color:var(--gold-600);font-weight:600;">Browse listings</a> and tap the Save button on ones you like.</p>
      </div>`;
    return;
  }
  panel.innerHTML = `<div class="property-grid">${mySaved.map(Util.propertyCardHtml).join("")}</div>${Util.paginationBar(savedPagination)}`;
  Util.wirePagination(panel, (page) => {
    savedPage = page;
    refreshSaved();
  });
}

function renderVerifyBanner(user) {
  const el = document.getElementById("verify-banner");
  if (!el) return;
  if (!user || user.email_verified) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = `
    <p class="alert alert-info" style="display:flex;gap:.75rem;align-items:center;flex-wrap:wrap;">
      Please verify your email address.
      <button class="btn btn-outline" id="resend-verify-btn" style="padding:.25rem .75rem;">Resend verification email</button>
    </p>`;
  document.getElementById("resend-verify-btn").addEventListener("click", async (event) => {
    const btn = event.currentTarget;
    btn.disabled = true;
    try {
      const result = await Api.post("/auth/resend-verification");
      btn.parentElement.textContent = result.message;
    } catch (err) {
      btn.disabled = false;
    }
  });
}

async function refreshListings() {
  const res = await Api.get("/properties/me/listings", { page: listingsPage });
  if (res.data.length === 0 && listingsPage > 1 && res.pagination?.total > 0) {
    listingsPage -= 1;
    return refreshListings();
  }
  myListings = res.data;
  listingsPagination = res.pagination;
  renderListings();
}

async function refreshSaved() {
  const res = await Api.get("/properties/me/saved", { page: savedPage });
  if (res.data.length === 0 && savedPage > 1 && res.pagination?.total > 0) {
    savedPage -= 1;
    return refreshSaved();
  }
  mySaved = res.data;
  savedPagination = res.pagination;
  renderSaved();
}

async function refreshData() {
  try {
    const [, , meRes] = await Promise.all([
      refreshListings(),
      refreshSaved(),
      Api.get("/auth/me"),
    ]);
    renderVerifyBanner(meRes.user);
  } catch (err) {
    if (err.status === 401) {
      Api.clearToken();
      window.location.href = "login.html";
    }
  }
}

function renderAddForm() {
  const panel = document.getElementById("panel-add");
  panel.innerHTML = `
    <div id="add-listing-error"></div>
    <div id="add-listing-success"></div>
    <form class="listing-form" id="listing-form">
      <label class="field col-span-full">
        Title
        <input required id="l-title" />
      </label>
      <label class="field col-span-full">
        Description
        <textarea required rows="3" id="l-description"></textarea>
      </label>
      <label class="field">
        Property type
        <select id="l-type">
          <option value="residential">Residential</option>
          <option value="land">Land</option>
          <option value="commercial">Commercial</option>
        </select>
      </label>
      <label class="field">
        Listing type
        <select id="l-listing-type">
          <option value="sale">For sale</option>
          <option value="rent">For rent</option>
        </select>
      </label>
      <label class="field">
        Price (NGN)
        <input required type="number" min="0" id="l-price" />
      </label>
      <label class="field">
        Size (sqm)
        <input type="number" min="0" id="l-size" />
      </label>
      <label class="field">
        State
        <input required id="l-state" value="Enugu" />
      </label>
      <label class="field">
        City
        <input required id="l-city" />
      </label>
      <label class="field">
        Latitude
        <input type="number" step="any" min="-90" max="90" id="l-latitude" placeholder="e.g. 6.5244" />
      </label>
      <label class="field">
        Longitude
        <input type="number" step="any" min="-180" max="180" id="l-longitude" placeholder="e.g. 3.3792" />
      </label>
      <p class="field-hint col-span-full">Add the property's GPS coordinates for a more accurate map pin. You can copy them from Google Maps.</p>
      <div class="seller-map-wrap col-span-full">
        <p class="field-label">Location preview</p>
        <div id="seller-map-preview" class="location-map-frame location-map-empty">Enter latitude and longitude to preview the map.</div>
      </div>
      <label class="field col-span-full">
        Address (optional)
        <input id="l-address" />
      </label>
      <label class="field">
        Bedrooms
        <input type="number" min="0" id="l-bedrooms" />
      </label>
      <label class="field">
        Bathrooms
        <input type="number" min="0" id="l-bathrooms" />
      </label>
      <label class="field col-span-full">
        Image URLs (comma-separated)
        <input id="l-images" placeholder="https://…, https://…" />
      </label>
      <label class="field col-span-full">
        Title document type (e.g. Certificate of Occupancy, Deed of Assignment)
        <input id="l-title-doc" />
      </label>
      <label class="field col-span-full">
        YouTube video tour link (optional)
        <input id="l-video-url" placeholder="https://youtube.com/watch?v=… or https://youtu.be/…" />
        <span class="hint">Paste a link to a video tour you've uploaded to YouTube. Visitors will be sent to YouTube to watch it.</span>
      </label>
      <button type="submit" class="btn btn-primary col-span-full" id="listing-submit">Submit listing for review</button>
    </form>
  `;

  document.getElementById("listing-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById("add-listing-error");
    const successEl = document.getElementById("add-listing-success");
    const submitBtn = document.getElementById("listing-submit");
    errorEl.innerHTML = "";
    successEl.innerHTML = "";
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting…";

    const num = (id) => {
      const v = document.getElementById(id).value;
      return v === "" ? undefined : Number(v);
    };

    const payload = {
      title: document.getElementById("l-title").value,
      description: document.getElementById("l-description").value,
      property_type: document.getElementById("l-type").value,
      listing_type: document.getElementById("l-listing-type").value,
      price: num("l-price"),
      size_sqm: num("l-size"),
      state: document.getElementById("l-state").value,
      city: document.getElementById("l-city").value,
      latitude: document.getElementById("l-latitude").value || undefined,
      longitude: document.getElementById("l-longitude").value || undefined,
      address: document.getElementById("l-address").value || undefined,
      bedrooms: num("l-bedrooms"),
      bathrooms: num("l-bathrooms"),
      images: document.getElementById("l-images").value
        ? document.getElementById("l-images").value.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
      title_document: document.getElementById("l-title-doc").value || undefined,
      video_url: document.getElementById("l-video-url").value.trim() || undefined,
    };

    try {
      await Api.post("/properties", payload);
      successEl.innerHTML = `<p class="alert alert-info">Listing submitted — it will show as "Verification Pending" until the DYL Real-Estate Services team reviews the title document.</p>`;
      document.getElementById("listing-form").reset();
      await refreshData();
      setTimeout(() => showTab("listings"), 900);
    } catch (err) {
      errorEl.innerHTML = `<p class="alert alert-error">${Util.escapeHtml(err.message)}</p>`;
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit listing for review";
    }
  });

  const updateSellerMap = () => {
    const latitude = document.getElementById("l-latitude").value;
    const longitude = document.getElementById("l-longitude").value;
    const preview = document.getElementById("seller-map-preview");
    if (!latitude || !longitude) {
      preview.className = "location-map-frame location-map-empty";
      preview.textContent = "Enter latitude and longitude to preview the map.";
      return;
    }
    preview.className = "location-map-frame";
    preview.innerHTML = `<iframe src="https://maps.google.com/maps?q=${encodeURIComponent(latitude)},${encodeURIComponent(longitude)}&z=14&output=embed" title="Seller location preview" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`;
  };
  document.getElementById("l-latitude").addEventListener("input", updateSellerMap);
  document.getElementById("l-longitude").addEventListener("input", updateSellerMap);
}

refreshData();

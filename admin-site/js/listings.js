function statusFromUrl() {
  return new URLSearchParams(window.location.search).get("verification_status") || "";
}

let rejectingId = null;

async function loadListings() {
  const table = document.getElementById("listings-table");
  const status = statusFromUrl();
  document.getElementById("status-filter").value = status;
  table.innerHTML = `<p class="loading-text" style="padding:1.5rem;">Loading…</p>`;

  try {
    const res = await Api.get("/admin/properties", status ? { verification_status: status } : {});
    renderTable(res.data);
  } catch (err) {
    table.innerHTML = `<p class="loading-text" style="padding:1.5rem;">Couldn't load listings.</p>`;
  }
}

function renderTable(properties) {
  const table = document.getElementById("listings-table");
  if (properties.length === 0) {
    table.innerHTML = `<p class="loading-text" style="padding:1.5rem;">No listings match this filter.</p>`;
    return;
  }

  const rows = properties.map((p) => {
    let html = `
      <tr>
        <td>
          <p class="row-title">${Util.escapeHtml(p.title)}</p>
          <p class="row-sub">${Util.escapeHtml(p.city)}, ${Util.escapeHtml(p.state)}</p>
        </td>
        <td style="text-transform:capitalize;">${Util.escapeHtml(p.property_type)}</td>
        <td>${Util.formatPrice(p.price, p.currency)}</td>
        <td>${p.title_document ? Util.escapeHtml(p.title_document) : "—"}</td>
        <td>${Util.statusPill(p.verification_status)}</td>
        <td class="actions">
          ${p.verification_status !== "verified" ? `<button class="pill-btn pill-btn-primary" data-action="verify" data-id="${p.id}">Verify</button>` : ""}
          ${p.verification_status !== "rejected" ? `<button class="pill-btn pill-btn-danger-outline" data-action="reject" data-id="${p.id}">Reject</button>` : ""}
          <button class="pill-btn pill-btn-outline" data-action="delete" data-id="${p.id}">Delete</button>
        </td>
      </tr>
    `;
    if (rejectingId === p.id) {
      html += `
        <tr class="reject-row">
          <td colspan="6">
            <div class="reject-row-inner">
              <input id="reject-notes-${p.id}" placeholder="Reason for rejection (shown internally)…" autofocus />
              <button class="pill-btn" style="background:#dc2626;color:#fff;" data-action="confirm-reject" data-id="${p.id}">Confirm reject</button>
            </div>
          </td>
        </tr>
      `;
    }
    return html;
  }).join("");

  table.innerHTML = `
    <table class="data-table">
      <thead>
        <tr><th>Listing</th><th>Type</th><th>Price</th><th>Title doc</th><th>Status</th><th></th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  table.querySelectorAll("button[data-action]").forEach((btn) => {
    const id = Number(btn.dataset.id);
    btn.addEventListener("click", () => handleAction(btn.dataset.action, id));
  });
}

async function handleAction(action, id) {
  try {
    if (action === "verify") {
      await Api.patch(`/admin/properties/${id}/verify`, { verification_status: "verified" });
      loadListings();
    } else if (action === "reject") {
      rejectingId = rejectingId === id ? null : id;
      loadListings();
    } else if (action === "confirm-reject") {
      const notes = document.getElementById(`reject-notes-${id}`).value;
      await Api.patch(`/admin/properties/${id}/verify`, { verification_status: "rejected", verification_notes: notes });
      rejectingId = null;
      loadListings();
    } else if (action === "delete") {
      if (!window.confirm("Delete this listing permanently? This cannot be undone.")) return;
      await Api.del(`/properties/${id}`);
      loadListings();
    }
  } catch (err) {
    window.alert(err.message || "That action couldn't be completed.");
  }
}

document.getElementById("status-filter").addEventListener("change", (e) => {
  const params = new URLSearchParams();
  if (e.target.value) params.set("verification_status", e.target.value);
  window.location.search = params.toString();
});

document.addEventListener("admin-ready", loadListings);

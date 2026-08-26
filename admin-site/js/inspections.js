async function loadInspections() {
  const table = document.getElementById("inspections-table");
  try {
    const result = await Api.get("/admin/inspections");
    if (result.data.length === 0) {
      table.innerHTML = '<p class="loading-text" style="padding:1.5rem;">No inspection requests yet.</p>';
      return;
    }
    table.innerHTML = `<table class="data-table"><thead><tr><th>Property</th><th>Customer</th><th>Requested slot</th><th>Status</th><th></th></tr></thead><tbody>${result.data.map((item) => `
      <tr>
        <td><p class="row-title">${Util.escapeHtml(item.property_title)}</p><p class="row-sub">${Util.escapeHtml(item.city)}, ${Util.escapeHtml(item.state)}</p></td>
        <td><p class="row-title">${Util.escapeHtml(item.name)}</p><p class="row-sub">${Util.escapeHtml(item.email)} · ${Util.escapeHtml(item.phone)}</p></td>
        <td>${new Date(`${item.inspection_date}T${item.inspection_time}`).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</td>
        <td><span class="status-pill status-${Util.escapeHtml(item.status)}">${Util.escapeHtml(item.status)}</span></td>
        <td class="actions">${item.status !== "confirmed" ? `<button class="pill-btn pill-btn-primary" data-status="confirmed" data-id="${item.id}">Confirm</button>` : ""}${item.status !== "cancelled" ? `<button class="pill-btn pill-btn-danger-outline" data-status="cancelled" data-id="${item.id}">Cancel</button>` : ""}</td>
      </tr>`).join("")}</tbody></table>`;
    table.querySelectorAll("button[data-status]").forEach((button) => button.addEventListener("click", async () => {
      button.disabled = true;
      try { await Api.patch(`/admin/inspections/${button.dataset.id}`, { status: button.dataset.status }); loadInspections(); }
      catch (err) { window.alert(err.message || "Could not update inspection."); button.disabled = false; }
    }));
  } catch (err) {
    table.innerHTML = '<p class="loading-text" style="padding:1.5rem;">Could not load inspection requests.</p>';
  }
}

document.addEventListener("admin-ready", loadInspections);
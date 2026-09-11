const ACTION_LABELS = {
  "property.verification_status_changed": "Changed listing verification status",
  "user.role_changed": "Changed user role",
  "user.account_type_changed": "Changed user account type",
  "user.deleted": "Deleted user",
  "inspection.status_changed": "Changed inspection status",
  "post.created": "Created post",
  "post.updated": "Updated post",
  "post.deleted": "Deleted post",
};

const TARGET_TYPE_LABELS = {
  property: "Listing",
  user: "User",
  inspection_booking: "Inspection",
  post: "Post",
};

let currentAuditPage = 1;

function detailsText(details) {
  if (!details || typeof details !== "object") return "";
  return Object.entries(details)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => `${key.replace(/_/g, " ")}: ${value}`)
    .join(" · ");
}

async function loadAuditLog() {
  const table = document.getElementById("audit-log-table");
  const targetType = document.getElementById("target-type-filter").value;
  table.innerHTML = `<p class="loading-text" style="padding:1.5rem;">Loading…</p>`;

  try {
    const res = await Api.get("/admin/audit-log", {
      target_type: targetType || undefined,
      page: currentAuditPage,
    });

    if (res.data.length === 0 && currentAuditPage > 1 && res.pagination?.total > 0) {
      currentAuditPage -= 1;
      return loadAuditLog();
    }

    renderAuditLog(res.data, res.pagination);
  } catch (err) {
    table.innerHTML = `<p class="loading-text" style="padding:1.5rem;">Couldn't load the audit log.</p>`;
  }
}

function renderAuditLog(entries, pagination) {
  const table = document.getElementById("audit-log-table");

  if (entries.length === 0) {
    table.innerHTML = `<p class="loading-text" style="padding:1.5rem;">No activity recorded yet.</p>`;
    return;
  }

  const rows = entries.map((entry) => `
    <tr>
      <td>
        <p class="row-title">${Util.escapeHtml(entry.admin_name || "Unknown admin")}</p>
        <p class="row-sub">${Util.escapeHtml(entry.admin_email || "")}</p>
      </td>
      <td>${Util.escapeHtml(ACTION_LABELS[entry.action] || entry.action)}</td>
      <td>
        <p class="row-title">${Util.escapeHtml(TARGET_TYPE_LABELS[entry.target_type] || entry.target_type)} #${Util.escapeHtml(entry.target_id)}</p>
        ${entry.details ? `<p class="row-sub">${Util.escapeHtml(detailsText(entry.details))}</p>` : ""}
      </td>
      <td>${new Date(entry.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</td>
    </tr>
  `).join("");

  table.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Admin</th><th>Action</th><th>Target</th><th>When</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${Util.paginationBar(pagination)}
  `;

  Util.wirePagination(table, (page) => {
    currentAuditPage = page;
    loadAuditLog();
  });
}

document.getElementById("target-type-filter").addEventListener("change", () => {
  currentAuditPage = 1;
  loadAuditLog();
});

document.addEventListener("admin-ready", loadAuditLog);

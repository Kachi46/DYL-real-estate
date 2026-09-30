let currentUsersPage = 1;

// Guard: only super_admin can access this page
document.addEventListener("admin-ready", (e) => {
  if (e.detail.role !== "super_admin") {
    document.getElementById("users-table").innerHTML =
      `<p class="loading-text" style="padding:1.5rem;color:var(--danger);">
         ⛔ Access denied. Only Super Admins can manage users.
       </p>`;
    return;
  }
  loadUsers();
});

async function loadUsers() {
  const table = document.getElementById("users-table");
  try {
    const res = await Api.get("/admin/users", { page: currentUsersPage });
    if (res.data.length === 0 && currentUsersPage > 1 && res.pagination?.total > 0) {
      currentUsersPage -= 1;
      return loadUsers();
    }
    renderUsers(res.data, res.pagination);
  } catch (err) {
    table.innerHTML = `<p class="loading-text" style="padding:1.5rem;">Couldn't load users.</p>`;
  }
}

function renderUsers(users, pagination) {
  const table = document.getElementById("users-table");
  const isSA = isSuperAdmin(); // defined in shell.js

  const rows = users.map((u) => {
    const isSelf = window.currentAdmin && u.id === window.currentAdmin.id;
    const isBanned = u.status === "banned";

    // Role promotion: super_admin can make someone admin or promote to super_admin
    const roleOptions = isSA && !isSelf ? `
      <button class="pill-btn pill-btn-outline" data-action="toggle-role"
        data-id="${u.id}" data-role="${u.role}" data-name="${Util.escapeHtml(u.name)}">
        ${u.role === "admin" ? "Revoke Admin" : u.role === "super_admin" ? "Demote to Admin" : "Make Admin"}
      </button>` : "";

    const banBtn = !isSelf ? `
      <button class="pill-btn ${isBanned ? "pill-btn-outline" : "pill-btn-warning-outline"}"
        data-action="${isBanned ? "unban" : "ban"}"
        data-id="${u.id}" data-name="${Util.escapeHtml(u.name)}">
        ${isBanned ? "Unban" : "Ban"}
      </button>` : "";

    const deleteBtn = !isSelf ? `
      <button class="pill-btn pill-btn-danger-outline"
        data-action="delete" data-id="${u.id}" data-name="${Util.escapeHtml(u.name)}">
        Delete
      </button>` : "";

    const statusCell = isBanned
      ? `<span class="status-pill status-pill--banned">Banned</span>`
      : Util.statusPill(u.role);

    return `
      <tr class="${isBanned ? "row--banned" : ""}">
        <td class="row-title">${Util.escapeHtml(u.name)}${isSelf ? ' <span class="you-badge">You</span>' : ""}</td>
        <td>${Util.escapeHtml(u.email)}</td>
        <td>${u.phone ? Util.escapeHtml(u.phone) : "—"}</td>
        <td>
          <select class="user-type-select" data-action="change-type"
            data-id="${u.id}" data-name="${Util.escapeHtml(u.name)}"
            aria-label="Account type for ${Util.escapeHtml(u.name)}"
            ${isSelf ? "disabled" : ""}>
            <option value="user"${u.user_type === "user" ? " selected" : ""}>User</option>
            <option value="landlord"${u.user_type === "landlord" ? " selected" : ""}>Landlord</option>
          </select>
        </td>
        <td>${statusCell}</td>
        <td>${new Date(u.created_at).toLocaleDateString()}</td>
        <td class="actions">
          ${roleOptions}
          ${banBtn}
          ${deleteBtn}
        </td>
      </tr>
    `;
  }).join("");

  table.innerHTML = `
    <table class="data-table">
      <thead><tr>
        <th>Name</th><th>Email</th><th>Phone</th>
        <th>Account type</th><th>Status / Role</th><th>Joined</th><th></th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${Util.paginationBar(pagination)}
  `;

  Util.wirePagination(table, (page) => {
    currentUsersPage = page;
    loadUsers();
  });

  table.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => handleAction(btn));
  });
  table.querySelectorAll("select[data-action='change-type']").forEach((select) => {
    select.dataset.previousType = select.value;
    select.addEventListener("change", () => handleAction(select));
  });
}

async function handleAction(btn) {
  const id = Number(btn.dataset.id);
  const action = btn.dataset.action;
  const name = btn.dataset.name;

  if (action === "toggle-role") {
    if (!isSuperAdmin()) {
      window.alert("Only Super Admins can change roles.");
      return;
    }
    if (window.currentAdmin && id === window.currentAdmin.id) {
      window.alert("You can't change your own role while logged in.");
      return;
    }
    // Cycle: user → admin → super_admin → user
    const currentRole = btn.dataset.role;
    let nextRole;
    if (currentRole === "super_admin") nextRole = "admin";
    else if (currentRole === "admin") nextRole = "user";
    else nextRole = "admin";

    if (!window.confirm(`Change ${name}'s role to "${nextRole}"?`)) return;
    try {
      await Api.patch(`/admin/users/${id}/role`, { role: nextRole });
      loadUsers();
    } catch (err) {
      window.alert(err.message || "Couldn't update that user's role.");
    }

  } else if (action === "ban") {
    if (!window.confirm(`Ban ${name}? They will be unable to log in.`)) return;
    try {
      await Api.patch(`/admin/users/${id}/status`, { status: "banned" });
      loadUsers();
    } catch (err) {
      window.alert(err.message || "Couldn't ban that user.");
    }

  } else if (action === "unban") {
    if (!window.confirm(`Unban ${name} and restore their access?`)) return;
    try {
      await Api.patch(`/admin/users/${id}/status`, { status: "active" });
      loadUsers();
    } catch (err) {
      window.alert(err.message || "Couldn't unban that user.");
    }

  } else if (action === "change-type") {
    const previousType = btn.dataset.previousType;
    const nextType = btn.value;
    if (nextType === previousType) return;
    if (!window.confirm(`Change ${name}'s account type to "${nextType}"?`)) {
      btn.value = previousType;
      return;
    }
    try {
      await Api.patch(`/admin/users/${id}/type`, { user_type: nextType });
      btn.dataset.previousType = nextType;
      loadUsers();
    } catch (err) {
      btn.value = previousType;
      window.alert(err.message || "Couldn't update that account type.");
    }

  } else if (action === "delete") {
    if (!isSuperAdmin()) {
      window.alert("Only Super Admins can delete accounts.");
      return;
    }
    if (window.currentAdmin && id === window.currentAdmin.id) {
      window.alert("You can't delete your own account while logged in.");
      return;
    }
    if (!window.confirm(`Permanently delete ${name}'s account? This cannot be undone.`)) return;
    try {
      await Api.del(`/admin/users/${id}`);
      loadUsers();
    } catch (err) {
      window.alert(err.message || "Couldn't delete that account.");
    }
  }
}

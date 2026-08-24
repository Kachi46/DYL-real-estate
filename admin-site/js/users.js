async function loadUsers() {
  const table = document.getElementById("users-table");
  try {
    const res = await Api.get("/admin/users");
    renderUsers(res.data);
  } catch (err) {
    table.innerHTML = `<p class="loading-text" style="padding:1.5rem;">Couldn't load users.</p>`;
  }
}

function renderUsers(users) {
  const table = document.getElementById("users-table");
  const rows = users.map((u) => `
    <tr>
      <td class="row-title">${Util.escapeHtml(u.name)}</td>
      <td>${Util.escapeHtml(u.email)}</td>
      <td>${u.phone ? Util.escapeHtml(u.phone) : "—"}</td>
      <td>${u.user_type ? Util.escapeHtml(u.user_type) : "—"}</td>
      <td>${Util.statusPill(u.role)}</td>
      <td>${new Date(u.created_at).toLocaleDateString()}</td>
      <td class="actions">
        <button class="pill-btn pill-btn-outline" data-action="toggle-role" data-id="${u.id}" data-role="${u.role}" data-name="${Util.escapeHtml(u.name)}">
          ${u.role === "admin" ? "Revoke admin" : "Make admin"}
        </button>
        <button class="pill-btn pill-btn-danger-outline" data-action="delete" data-id="${u.id}" data-name="${Util.escapeHtml(u.name)}">Delete</button>
      </td>
    </tr>
  `).join("");

  table.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Account type</th><th>Role</th><th>Joined</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  table.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => handleAction(btn));
  });
}

async function handleAction(btn) {
  const id = Number(btn.dataset.id);
  const action = btn.dataset.action;
  const name = btn.dataset.name;

  if (action === "toggle-role") {
    if (window.currentAdmin && id === window.currentAdmin.id) {
      window.alert("You can't change your own role while logged in.");
      return;
    }
    const nextRole = btn.dataset.role === "admin" ? "user" : "admin";
    if (!window.confirm(`Change ${name}'s role to "${nextRole}"?`)) return;
    try {
      await Api.patch(`/admin/users/${id}/role`, { role: nextRole });
      loadUsers();
    } catch (err) {
      window.alert(err.message || "Couldn't update that user's role.");
    }
  } else if (action === "delete") {
    if (window.currentAdmin && id === window.currentAdmin.id) {
      window.alert("You can't delete your own account while logged in.");
      return;
    }
    if (!window.confirm(`Delete ${name}'s account permanently?`)) return;
    try {
      await Api.del(`/admin/users/${id}`);
      loadUsers();
    } catch (err) {
      window.alert(err.message || "Couldn't delete that account.");
    }
  }
}

document.addEventListener("admin-ready", loadUsers);

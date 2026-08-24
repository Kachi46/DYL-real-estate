const view = document.getElementById("posts-view");
let posts = [];

async function loadPosts() {
  view.innerHTML = `<p class="loading-text">Loading…</p>`;
  try {
    const res = await Api.get("/admin/posts");
    posts = res.data;
    renderListView();
  } catch (err) {
    view.innerHTML = `<p class="loading-text">Couldn't load posts.</p>`;
  }
}

function renderListView() {
  const rows = posts.map((p) => `
    <tr>
      <td class="row-title">${Util.escapeHtml(p.title)}</td>
      <td>${Util.escapeHtml(p.author_name)}</td>
      <td>${Util.statusPill(p.published ? "verified" : "pending")}</td>
      <td>${new Date(p.updated_at.replace(" ", "T") + "Z").toLocaleDateString()}</td>
      <td class="actions">
        <button class="pill-btn pill-btn-outline" data-action="toggle" data-id="${p.id}">${p.published ? "Unpublish" : "Publish"}</button>
        <button class="pill-btn pill-btn-primary" data-action="edit" data-id="${p.id}">Edit</button>
        <button class="pill-btn pill-btn-danger-outline" data-action="delete" data-id="${p.id}">Delete</button>
      </td>
    </tr>
  `).join("");

  view.innerHTML = `
    <div class="admin-toolbar">
      <div>
        <h1>Blog</h1>
        <p class="admin-sub">Publish updates that show up live on the public blog.</p>
      </div>
      <button class="btn btn-primary" id="new-post-btn">+ New post</button>
    </div>
    <div class="data-table-wrap">
      ${posts.length === 0
        ? `<p class="loading-text" style="padding:1.5rem;">No posts yet — write your first update.</p>`
        : `<table class="data-table">
            <thead><tr><th>Title</th><th>Author</th><th>Status</th><th>Updated</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table>`}
    </div>
  `;

  document.getElementById("new-post-btn").addEventListener("click", () => renderEditorView(null));
  view.querySelectorAll("button[data-action]").forEach((btn) => {
    const id = Number(btn.dataset.id);
    const post = posts.find((p) => p.id === id);
    btn.addEventListener("click", () => handleAction(btn.dataset.action, post));
  });
}

async function handleAction(action, post) {
  try {
    if (action === "edit") {
      renderEditorView(post);
    } else if (action === "toggle") {
      await Api.put(`/admin/posts/${post.id}`, { published: !post.published });
      loadPosts();
    } else if (action === "delete") {
      if (!window.confirm(`Delete "${post.title}" permanently?`)) return;
      await Api.del(`/admin/posts/${post.id}`);
      loadPosts();
    }
  } catch (err) {
    window.alert(err.message || "That action couldn't be completed.");
  }
}

function renderEditorView(post) {
  const isNew = !post;
  view.innerHTML = `
    <div class="admin-toolbar">
      <h1>${isNew ? "New post" : "Edit post"}</h1>
      <button class="pill-btn pill-btn-outline" id="back-btn">← Back to posts</button>
    </div>
    <div id="editor-error"></div>
    <form class="post-editor" id="post-form">
      <label class="field">
        Title
        <input required id="pf-title" value="${isNew ? "" : Util.escapeHtml(post.title)}" />
      </label>
      <label class="field">
        Excerpt (shown on the blog list)
        <input id="pf-excerpt" value="${isNew ? "" : Util.escapeHtml(post.excerpt || "")}" />
      </label>
      <label class="field">
        Cover image URL (optional)
        <input id="pf-cover" placeholder="https://…" value="${isNew ? "" : Util.escapeHtml(post.cover_image || "")}" />
      </label>
      <label class="field">
        Content
        <textarea required id="pf-content">${isNew ? "" : Util.escapeHtml(post.content)}</textarea>
      </label>
      <label class="checkbox-field">
        <input type="checkbox" id="pf-published" ${!isNew && post.published ? "checked" : ""} />
        Published (visible on the public blog)
      </label>
      <div class="editor-actions">
        <button type="submit" class="btn btn-primary" id="pf-submit">Save post</button>
        <button type="button" class="btn btn-outline" id="pf-cancel">Cancel</button>
      </div>
    </form>
  `;

  document.getElementById("back-btn").addEventListener("click", renderListView);
  document.getElementById("pf-cancel").addEventListener("click", renderListView);

  document.getElementById("post-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById("editor-error");
    const submitBtn = document.getElementById("pf-submit");
    errorEl.innerHTML = "";
    submitBtn.disabled = true;
    submitBtn.textContent = "Saving…";

    const payload = {
      title: document.getElementById("pf-title").value,
      excerpt: document.getElementById("pf-excerpt").value,
      content: document.getElementById("pf-content").value,
      cover_image: document.getElementById("pf-cover").value,
      published: document.getElementById("pf-published").checked,
    };

    try {
      if (isNew) {
        await Api.post("/admin/posts", payload);
      } else {
        await Api.put(`/admin/posts/${post.id}`, payload);
      }
      await loadPosts();
    } catch (err) {
      errorEl.innerHTML = `<p class="alert alert-error">${Util.escapeHtml(err.message)}</p>`;
      submitBtn.disabled = false;
      submitBtn.textContent = "Save post";
    }
  });
}

document.addEventListener("admin-ready", loadPosts);

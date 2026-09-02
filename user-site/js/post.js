const slug = new URLSearchParams(window.location.search).get("slug");
const postRoot = document.getElementById("post-root");

async function loadPost() {
  if (!slug) {
    postRoot.innerHTML = notFoundHtml();
    return;
  }
  try {
    const res = await Api.get(`/posts/${encodeURIComponent(slug)}`);
    render(res.data);
  } catch (err) {
    postRoot.innerHTML = notFoundHtml();
  }
}

function notFoundHtml() {
  return `
    <div class="text-center" style="padding:4rem 0;">
      <p class="font-display" style="font-size:1.5rem;color:var(--forest-900);">Post not found</p>
      <a href="blog.html" style="color:var(--gold-600);display:inline-block;margin-top:1rem;">← Back to the blog</a>
    </div>`;
}

function render(post) {
  document.title = `${post.title} — DYL Real Estate Services Blog`;
  postRoot.innerHTML = `
    <p class="post-meta">${Util.formatDate(post.published_at)} · By ${Util.escapeHtml(post.author_name)}</p>
    <h1>${Util.escapeHtml(post.title)}</h1>
    ${post.cover_image ? `
      <div class="post-cover">
        <img src="${Util.escapeHtml(post.cover_image)}" alt="${Util.escapeHtml(post.title)}" />
      </div>` : ""}
    <div class="post-body">${Util.escapeHtml(post.content)}</div>
  `;
}

loadPost();

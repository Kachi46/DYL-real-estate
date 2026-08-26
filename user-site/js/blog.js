function getPageFromUrl() {
  return new URLSearchParams(window.location.search).get("page") || "1";
}

async function loadBlogList() {
  const results = document.getElementById("blog-results");
  const pagination = document.getElementById("blog-pagination");
  const page = getPageFromUrl();

  try {
    const res = await Api.get("/posts", { page });
    if (res.data.length === 0) {
      pagination.innerHTML = "";
      results.innerHTML = `<p class="loading-text">No posts published yet — check back soon.</p>`;
      return;
    }
    results.innerHTML = `<div class="blog-grid">${res.data.map(Util.postCardHtml).join("")}</div>`;

    const { page: current, totalPages } = res.pagination;
    pagination.innerHTML = "";
    if (totalPages > 1) {
      let html = "";
      for (let p = 1; p <= totalPages; p++) {
        html += `<button data-page="${p}" class="${p === current ? "active" : ""}">${p}</button>`;
      }
      pagination.innerHTML = html;
      pagination.querySelectorAll("button").forEach((btn) => {
        btn.addEventListener("click", () => {
          window.location.search = `page=${btn.dataset.page}`;
        });
      });
    }
  } catch (err) {
    pagination.innerHTML = "";
    results.innerHTML = `<p class="loading-text">Couldn't load posts right now.</p>`;
  }
}

loadBlogList();
setInterval(loadBlogList, 60000);

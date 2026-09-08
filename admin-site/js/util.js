const Util = {
  escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  },
  formatPrice(price, currency) {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: currency || "NGN",
      maximumFractionDigits: 0,
    }).format(price);
  },
  statusPill(status) {
    return `<span class="status-pill status-${Util.escapeHtml(status)}">${Util.escapeHtml(status)}</span>`;
  },
  renderMarkdown(markdown) {
    if (!markdown) return "";
    if (typeof marked === "undefined" || typeof DOMPurify === "undefined") {
      return `<p>${Util.escapeHtml(markdown)}</p>`;
    }
    return DOMPurify.sanitize(marked.parse(markdown));
  },
  // Renders a Prev/Next bar from the `{ page, limit, total, totalPages }`
  // shape every paginated admin endpoint now returns. Returns "" when
  // there's nothing to page through, so callers can just always append
  // this without an extra `if` at the call site.
  paginationBar(pagination) {
    if (!pagination || pagination.totalPages <= 1) return "";
    const { page, totalPages, total } = pagination;
    return `
      <div class="pagination-bar">
        <button class="pill-btn pill-btn-outline" data-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>← Prev</button>
        <span class="pagination-info">Page ${page} of ${totalPages} · ${total} total</span>
        <button class="pill-btn pill-btn-outline" data-page="${page + 1}" ${page >= totalPages ? "disabled" : ""}>Next →</button>
      </div>
    `;
  },
  // Wires up the Prev/Next buttons rendered above within `container`,
  // calling `onPageChange(pageNumber)` when a valid, non-disabled page
  // button is clicked.
  wirePagination(container, onPageChange) {
    container.querySelectorAll("[data-page]").forEach((btn) => {
      if (btn.disabled) return;
      btn.addEventListener("click", () => onPageChange(Number(btn.dataset.page)));
    });
  },
};

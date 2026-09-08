// Shared by every list endpoint that needs LIMIT/OFFSET pagination -
// previously several admin endpoints (and the owner's own listings/saved
// endpoints) just fetched every row with no LIMIT at all, which is fine
// at a few dozen rows and a real problem once a table has thousands.
function parsePagination(query, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

function paginationMeta(page, limit, total) {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

module.exports = { parsePagination, paginationMeta };

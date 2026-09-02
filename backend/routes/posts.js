const express = require("express");
const db = require("../db");

const router = express.Router();

function parsePost(row) {
  return {
    ...row,
    published: !!row.published,
  };
}

// GET /api/posts
// Published posts only, paginated, newest first
router.get("/", async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 9,
    } = req.query;

    const pageNum = Math.max(
      1,
      parseInt(page, 10) || 1
    );

    const pageSize = Math.min(
      30,
      Math.max(1, parseInt(limit, 10) || 9)
    );

    const offset = (pageNum - 1) * pageSize;

    const countRows = await db.sql`
      SELECT COUNT(*)::int AS count
      FROM posts
      WHERE published = ${1}
    `;

    const total = countRows[0]?.count || 0;

    const rows = await db.sql`
      SELECT
        p.id,
        p.title,
        p.slug,
        p.excerpt,
        p.cover_image,
        p.published_at,
        p.created_at,
        p.published,
        u.name AS author_name
      FROM posts p
      JOIN users u
        ON u.id = p.author_id
      WHERE p.published = ${1}
      ORDER BY p.published_at DESC
      LIMIT ${pageSize}
      OFFSET ${offset}
    `;

    return res.json({
      data: rows.map(parsePost),
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/posts/:slug
// A single published post
router.get("/:slug", async (req, res, next) => {
  try {
    const rows = await db.sql`
      SELECT
        p.*,
        u.name AS author_name
      FROM posts p
      JOIN users u
        ON u.id = p.author_id
      WHERE p.slug = ${req.params.slug}
        AND p.published = ${1}
      LIMIT 1
    `;

    const row = rows[0];

    if (!row) {
      return res
        .status(404)
        .json({ error: "Post not found." });
    }

    return res.json({
      data: parsePost(row),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
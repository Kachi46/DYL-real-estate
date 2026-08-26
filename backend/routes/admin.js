const express = require("express");
const { body, validationResult } = require("express-validator");
const db = require("../db");
const { authenticate, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// All admin routes require a valid admin token.
router.use(authenticate, requireAdmin);

function parseProperty(row) {
  return {
    ...row,
    images:
      typeof row.images === "string"
        ? JSON.parse(row.images || "[]")
        : row.images || [],
  };
}

function parsePost(row) {
  return {
    ...row,
    published: !!row.published,
  };
}

// GET /api/admin/stats
// Dashboard summary numbers
router.get("/stats", async (req, res, next) => {
  try {
    const [
      totalPropertiesResult,
      pendingResult,
      verifiedResult,
      rejectedResult,
      totalUsersResult,
      totalInquiriesResult,
    ] = await Promise.all([
      db.sql`
        SELECT COUNT(*)::int AS count
        FROM properties
      `,
      db.sql`
        SELECT COUNT(*)::int AS count
        FROM properties
        WHERE verification_status = ${"pending"}
      `,
      db.sql`
        SELECT COUNT(*)::int AS count
        FROM properties
        WHERE verification_status = ${"verified"}
      `,
      db.sql`
        SELECT COUNT(*)::int AS count
        FROM properties
        WHERE verification_status = ${"rejected"}
      `,
      db.sql`
        SELECT COUNT(*)::int AS count
        FROM users
      `,
      db.sql`
        SELECT COUNT(*)::int AS count
        FROM inquiries
      `,
    ]);

    const totalProperties = totalPropertiesResult[0]?.count || 0;
    const pending = pendingResult[0]?.count || 0;
    const verified = verifiedResult[0]?.count || 0;
    const rejected = rejectedResult[0]?.count || 0;
    const totalUsers = totalUsersResult[0]?.count || 0;
    const totalInquiries = totalInquiriesResult[0]?.count || 0;

    return res.json({
      totalProperties,
      pendingVerification: pending,
      verified,
      rejected,
      totalUsers,
      totalInquiries,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/properties
// List all listings, including non-active,
// with optional verification status filter
router.get("/properties", async (req, res, next) => {
  try {
    const { verification_status } = req.query;

    let rows;

    if (verification_status) {
      rows = await db.sql`
        SELECT *
        FROM properties
        WHERE verification_status = ${verification_status}
        ORDER BY created_at DESC
      `;
    } else {
      rows = await db.sql`
        SELECT *
        FROM properties
        ORDER BY created_at DESC
      `;
    }

    return res.json({
      data: rows.map(parseProperty),
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/properties/:id/verify
// Approve/reject a listing's verification
router.patch(
  "/properties/:id/verify",
  [
    body("verification_status").isIn([
      "verified",
      "rejected",
      "pending",
    ]),
    body("verification_notes")
      .optional()
      .isString(),
  ],
  async (req, res, next) => {
    try {
      if (!/^\d+$/.test(req.params.id)) {
        return res.status(400).json({ error: "Invalid property ID." });
      }

      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res
          .status(400)
          .json({ error: errors.array()[0].msg });
      }

      const existingRows = await db.sql`
        SELECT id
        FROM properties
        WHERE id = ${req.params.id}
        LIMIT 1
      `;

      if (existingRows.length === 0) {
        return res
          .status(404)
          .json({ error: "Property not found." });
      }

      const {
        verification_status,
        verification_notes,
      } = req.body;

      await db.sql`
        UPDATE properties
        SET
          verification_status = ${verification_status},
          verification_notes = ${verification_notes || null},
          updated_at = NOW()
        WHERE id = ${req.params.id}
      `;

      const rows = await db.sql`
        SELECT *
        FROM properties
        WHERE id = ${req.params.id}
        LIMIT 1
      `;

      return res.json({
        data: parseProperty(rows[0]),
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/admin/users
// List all users
router.get("/users", async (req, res, next) => {
  try {
    const rows = await db.sql`
      SELECT
        id,
        name,
        first_name,
        last_name,
        email,
        role,
        user_type,
        phone,
        email_opt_in,
        (google_id IS NOT NULL) AS has_google_login,
        created_at
      FROM users
      ORDER BY created_at DESC
    `;

    return res.json({
      data: rows,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/users/:id/role
// Promote/demote a user
router.patch(
  "/users/:id/role",
  [body("role").isIn(["user", "admin"])],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res
          .status(400)
          .json({ error: errors.array()[0].msg });
      }

      if (!/^\d+$/.test(req.params.id)) {
        return res.status(400).json({ error: "Invalid user ID." });
      }

      // Mirrors the self-delete guard below: without this, an admin can
      // revoke their own admin role (the UI's "Revoke admin" button has no
      // self-check either), and if they're the only admin, that locks
      // everyone out of the admin console with no way back in short of
      // editing the database directly.
      if (Number(req.params.id) === Number(req.user.id)) {
        return res.status(400).json({
          error: "You can't change your own role while logged in.",
        });
      }

      const existingRows = await db.sql`
        SELECT id
        FROM users
        WHERE id = ${req.params.id}
        LIMIT 1
      `;

      if (existingRows.length === 0) {
        return res
          .status(404)
          .json({ error: "User not found." });
      }

      await db.sql`
        UPDATE users
        SET role = ${req.body.role}
        WHERE id = ${req.params.id}
      `;

      return res.json({
        message: "User role updated.",
      });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/admin/users/:id
router.delete("/users/:id", async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id)) {
      return res.status(400).json({ error: "Invalid user ID." });
    }

    // The frontend blocks this too, but that's advisory only - the API
    // must not rely on the client to enforce it.
    if (Number(req.params.id) === Number(req.user.id)) {
      return res.status(400).json({
        error: "You can't delete your own account while logged in.",
      });
    }

    const existingRows = await db.sql`
      SELECT id
      FROM users
      WHERE id = ${req.params.id}
      LIMIT 1
    `;

    if (existingRows.length === 0) {
      return res
        .status(404)
        .json({ error: "User not found." });
    }

    // properties.owner_id and posts.author_id are both ON DELETE CASCADE,
    // so deleting this user would silently wipe every listing they own
    // (verified/live ones included, plus their inquiries, saved-bookmark
    // entries, and price history) and every post they've authored. That's
    // real content, not throwaway account data - block the delete rather
    // than let it cascade invisibly, and tell the admin what to do instead.
    const [ownedProperties, authoredPosts] = await Promise.all([
      db.sql`
        SELECT COUNT(*)::int AS count
        FROM properties
        WHERE owner_id = ${req.params.id}
      `,
      db.sql`
        SELECT COUNT(*)::int AS count
        FROM posts
        WHERE author_id = ${req.params.id}
      `,
    ]);

    const propertyCount = ownedProperties[0]?.count || 0;
    const postCount = authoredPosts[0]?.count || 0;

    if (propertyCount > 0 || postCount > 0) {
      const parts = [];
      if (propertyCount > 0) {
        parts.push(
          `${propertyCount} listing${propertyCount === 1 ? "" : "s"}`
        );
      }
      if (postCount > 0) {
        parts.push(`${postCount} blog post${postCount === 1 ? "" : "s"}`);
      }

      return res.status(409).json({
        error:
          `This account still owns ${parts.join(" and ")}. ` +
          "Reassign or remove that content first - deleting the " +
          "account would delete it too.",
      });
    }

    await db.sql`
      DELETE FROM users
      WHERE id = ${req.params.id}
    `;

    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/inquiries
// List all inquiries, optionally filtered by property
router.get("/inquiries", async (req, res, next) => {
  try {
    const { property_id } = req.query;

    if (property_id !== undefined && !/^\d+$/.test(property_id)) {
      return res.status(400).json({ error: "Invalid property ID." });
    }

    let rows;

    if (property_id) {
      rows = await db.sql`
        SELECT *
        FROM inquiries
        WHERE property_id = ${property_id}
        ORDER BY created_at DESC
      `;
    } else {
      rows = await db.sql`
        SELECT *
        FROM inquiries
        ORDER BY created_at DESC
      `;
    }

    return res.json({
      data: rows,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/inspections
router.get("/inspections", async (req, res, next) => {
  try {
    const rows = await db.sql`
      SELECT b.*, p.title AS property_title, p.city, p.state
      FROM inspection_bookings b
      JOIN properties p ON p.id = b.property_id
      ORDER BY b.inspection_date ASC, b.inspection_time ASC, b.created_at DESC
    `;
    return res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/inspections/:id
router.patch(
  "/inspections/:id",
  [body("status").isIn(["pending", "confirmed", "cancelled"])],
  async (req, res, next) => {
    try {
      if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: "Invalid inspection ID." });
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
      const rows = await db.sql`
        UPDATE inspection_bookings
        SET status = ${req.body.status}
        WHERE id = ${req.params.id}
        RETURNING *
      `;
      if (rows.length === 0) return res.status(404).json({ error: "Inspection request not found." });
      return res.json({ data: rows[0] });
    } catch (err) {
      if (err.code === "23505") return res.status(409).json({ error: "That time is already booked for this property." });
      next(err);
    }
  }
);

// --------------------------------------------------
// Blog post management
// --------------------------------------------------

function slugify(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function uniqueSlug(base, ignoreId = null) {
  const baseSlug = base || "post";
  let slug = baseSlug;
  let n = 1;

  while (true) {
    const rows = await db.sql`
      SELECT id
      FROM posts
      WHERE slug = ${slug}
      LIMIT 1
    `;

    const existing = rows[0];

    if (!existing || Number(existing.id) === Number(ignoreId)) {
      return slug;
    }

    n += 1;
    slug = `${baseSlug}-${n}`;
  }
}

// GET /api/admin/posts
// All posts, including drafts
router.get("/posts", async (req, res, next) => {
  try {
    const rows = await db.sql`
      SELECT
        p.*,
        u.name AS author_name
      FROM posts p
      JOIN users u
        ON u.id = p.author_id
      ORDER BY p.created_at DESC
    `;

    return res.json({
      data: rows.map(parsePost),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/posts
// Create a post (draft by default)
router.post(
  "/posts",
  [
    body("title")
      .trim()
      .notEmpty()
      .withMessage("Title is required."),
    body("content")
      .trim()
      .notEmpty()
      .withMessage("Content is required."),
    body("published")
      .optional()
      .isBoolean(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res
          .status(400)
          .json({ error: errors.array()[0].msg });
      }

      const {
        title,
        excerpt,
        content,
        cover_image,
        published = false,
      } = req.body;

      const slug = await uniqueSlug(slugify(title));

      const rows = await db.sql`
        INSERT INTO posts (
          title,
          slug,
          excerpt,
          content,
          cover_image,
          published,
          author_id,
          published_at
        )
        VALUES (
          ${title},
          ${slug},
          ${excerpt || null},
          ${content},
          ${cover_image || null},
          ${published ? 1 : 0},
          ${req.user.id},
          ${published ? new Date() : null}
        )
        RETURNING *
      `;

      const post = rows[0];

      const result = await db.sql`
        SELECT
          p.*,
          u.name AS author_name
        FROM posts p
        JOIN users u
          ON u.id = p.author_id
        WHERE p.id = ${post.id}
        LIMIT 1
      `;

      return res.status(201).json({
        data: parsePost(result[0]),
      });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/admin/posts/:id
// Update a post; re-slugs if title changes
router.put(
  "/posts/:id",
  [
    body("title")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("Title cannot be empty."),
    body("content")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("Content cannot be empty."),
    body("published")
      .optional()
      .isBoolean(),
  ],
  async (req, res, next) => {
    try {
      if (!/^\d+$/.test(req.params.id)) {
        return res.status(400).json({ error: "Invalid post ID." });
      }

      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res
          .status(400)
          .json({ error: errors.array()[0].msg });
      }

      const existingRows = await db.sql`
        SELECT *
        FROM posts
        WHERE id = ${req.params.id}
        LIMIT 1
      `;

      const existing = existingRows[0];

      if (!existing) {
        return res
          .status(404)
          .json({ error: "Post not found." });
      }

      const {
        title,
        excerpt,
        content,
        cover_image,
        published,
      } = req.body;

      const nextTitle =
        title !== undefined ? title : existing.title;

      const nextSlug =
        title !== undefined &&
        title !== existing.title
          ? await uniqueSlug(
              slugify(title),
              existing.id
            )
          : existing.slug;

      const nextPublished =
        published !== undefined
          ? !!published
          : !!existing.published;

      let nextPublishedAt = existing.published_at;

      // If the post is being published for the first time,
      // set the publication timestamp.
      if (nextPublished && !existing.published) {
        nextPublishedAt = new Date();
      }

      // If explicitly unpublishing, clear published_at.
      if (!nextPublished) {
        nextPublishedAt = null;
      }

      await db.sql`
        UPDATE posts
        SET
          title = ${nextTitle},
          slug = ${nextSlug},
          excerpt = ${
            excerpt !== undefined
              ? excerpt
              : existing.excerpt
          },
          content = ${
            content !== undefined
              ? content
              : existing.content
          },
          cover_image = ${
            cover_image !== undefined
              ? cover_image
              : existing.cover_image
          },
          published = ${nextPublished ? 1 : 0},
          published_at = ${nextPublishedAt},
          updated_at = NOW()
        WHERE id = ${req.params.id}
      `;

      const rows = await db.sql`
        SELECT
          p.*,
          u.name AS author_name
        FROM posts p
        JOIN users u
          ON u.id = p.author_id
        WHERE p.id = ${req.params.id}
        LIMIT 1
      `;

      return res.json({
        data: parsePost(rows[0]),
      });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/admin/posts/:id
router.delete(
  "/posts/:id",
  async (req, res, next) => {
    try {
      if (!/^\d+$/.test(req.params.id)) {
        return res.status(400).json({ error: "Invalid post ID." });
      }

      const existingRows = await db.sql`
        SELECT id
        FROM posts
        WHERE id = ${req.params.id}
        LIMIT 1
      `;

      if (existingRows.length === 0) {
        return res
          .status(404)
          .json({ error: "Post not found." });
      }

      await db.sql`
        DELETE FROM posts
        WHERE id = ${req.params.id}
      `;

      return res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
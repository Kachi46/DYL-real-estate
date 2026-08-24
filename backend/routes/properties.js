const express = require("express");
const { body, validationResult } = require("express-validator");
const db = require("../db");
const { authenticate, optionalAuth } = require("../middleware/auth");
const { extractYouTubeId } = require("../lib/youtube");

const router = express.Router();

function parseProperty(row) {
  return {
    ...row,
    images:
      typeof row.images === "string"
        ? JSON.parse(row.images || "[]")
        : row.images || [],
    // Convenience fields so the frontend never has to build these itself -
    // both point at YouTube's own domains, not anything hosted by us.
    youtube_watch_url: row.video_id
      ? `https://www.youtube.com/watch?v=${row.video_id}`
      : null,
    youtube_thumbnail_url: row.video_id
      ? `https://img.youtube.com/vi/${row.video_id}/hqdefault.jpg`
      : null,
  };
}

// GET /api/properties
// Public listing with filters, search, pagination
router.get("/", async (req, res, next) => {
  try {
    const {
      q,
      state,
      city,
      property_type,
      listing_type,
      min_price,
      max_price,
      verified_only,
      has_video,
      page = 1,
      limit = 12,
    } = req.query;

    const conditions = [
      db.sql`status = ${"active"}`,
    ];

    if (q) {
      const like = `%${q}%`;

      conditions.push(
        db.sql`(
          title ILIKE ${like}
          OR description ILIKE ${like}
          OR city ILIKE ${like}
          OR state ILIKE ${like}
        )`
      );
    }

    if (state) {
      conditions.push(db.sql`state = ${state}`);
    }

    if (city) {
      conditions.push(db.sql`city = ${city}`);
    }

    if (property_type) {
      conditions.push(db.sql`property_type = ${property_type}`);
    }

    if (listing_type) {
      conditions.push(db.sql`listing_type = ${listing_type}`);
    }

    if (min_price !== undefined && min_price !== "") {
      conditions.push(db.sql`price >= ${Number(min_price)}`);
    }

    if (max_price !== undefined && max_price !== "") {
      conditions.push(db.sql`price <= ${Number(max_price)}`);
    }

    if (verified_only === "true") {
      conditions.push(
        db.sql`verification_status = ${"verified"}`
      );
    }

    if (has_video === "true") {
      conditions.push(db.sql`video_id IS NOT NULL`);
    }

    const whereClause = conditions.reduce(
      (query, condition, index) =>
        index === 0
          ? db.sql`WHERE ${condition}`
          : db.sql`${query} AND ${condition}`,
      db.sql``
    );

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(
      50,
      Math.max(1, parseInt(limit, 10) || 12)
    );
    const offset = (pageNum - 1) * pageSize;

    const countRows = await db.sql`
      SELECT COUNT(*)::int AS count
      FROM properties
      ${whereClause}
    `;

    const total = countRows[0]?.count || 0;

    const rows = await db.sql`
      SELECT *
      FROM properties
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${pageSize}
      OFFSET ${offset}
    `;

    return res.json({
      data: rows.map(parseProperty),
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

// GET /api/properties/market/movers
// Real gainers/losers computed from recorded price_history — only
// properties with an actual documented price change show up here.
router.get("/market/movers", async (req, res, next) => {
  try {
    const days = Math.min(
      365,
      Math.max(1, parseInt(req.query.days, 10) || 90)
    );
    const limit = Math.min(
      10,
      Math.max(1, parseInt(req.query.limit, 10) || 4)
    );

    const rows = await db.sql`
      WITH windowed AS (
        SELECT
          ph.property_id,
          ph.price,
          ph.recorded_at,
          ROW_NUMBER() OVER (
            PARTITION BY ph.property_id ORDER BY ph.recorded_at ASC
          ) AS rn_asc,
          ROW_NUMBER() OVER (
            PARTITION BY ph.property_id ORDER BY ph.recorded_at DESC
          ) AS rn_desc
        FROM price_history ph
        WHERE ph.recorded_at >= NOW() - make_interval(days => ${days})
      ),
      bounds AS (
        SELECT
          first_point.property_id,
          first_point.price AS first_price,
          last_point.price AS last_price,
          last_point.recorded_at AS last_recorded_at,
          point_counts.total AS point_count
        FROM (SELECT * FROM windowed WHERE rn_asc = 1) first_point
        JOIN (SELECT * FROM windowed WHERE rn_desc = 1) last_point
          ON last_point.property_id = first_point.property_id
        JOIN (
          SELECT property_id, COUNT(*) AS total
          FROM windowed
          GROUP BY property_id
        ) point_counts
          ON point_counts.property_id = first_point.property_id
      )
      SELECT
        p.id,
        p.title,
        p.property_type,
        p.listing_type,
        p.currency,
        p.city,
        p.state,
        b.first_price,
        b.last_price AS price,
        b.last_recorded_at,
        ((b.last_price - b.first_price) / b.first_price) * 100
          AS percent_change
      FROM bounds b
      JOIN properties p ON p.id = b.property_id
      WHERE b.point_count >= 2
        AND b.first_price > 0
        AND b.last_price != b.first_price
        AND p.status = ${"active"}
      ORDER BY percent_change DESC
    `;

    const gainers = rows
      .filter((r) => r.percent_change > 0)
      .slice(0, limit);

    const losers = rows
      .filter((r) => r.percent_change < 0)
      .sort((a, b) => a.percent_change - b.percent_change)
      .slice(0, limit);

    return res.json({
      data: { gainers, losers },
      window_days: days,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/properties/:id
// Public detail view
router.get("/:id", async (req, res, next) => {
  try {
    const rows = await db.sql`
      SELECT *
      FROM properties
      WHERE id = ${req.params.id}
      LIMIT 1
    `;

    const row = rows[0];

    if (!row) {
      return res
        .status(404)
        .json({ error: "Property not found." });
    }

    return res.json({
      data: parseProperty(row),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/properties
// Create a listing
router.post(
  "/",
  authenticate,
  [
    body("title").trim().notEmpty(),
    body("description").trim().notEmpty(),
    body("property_type").isIn([
      "land",
      "residential",
      "commercial",
    ]),
    body("listing_type")
      .optional()
      .isIn(["sale", "rent"]),
    body("price").isFloat({ min: 0 }),
    body("state").trim().notEmpty(),
    body("city").trim().notEmpty(),
    body("video_url")
      .optional({ checkFalsy: true })
      .custom((value) => {
        if (!extractYouTubeId(value)) {
          throw new Error(
            "That doesn't look like a valid YouTube link."
          );
        }
        return true;
      }),
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
        description,
        property_type,
        listing_type = "sale",
        price,
        currency = "NGN",
        state,
        city,
        address,
        size_sqm,
        bedrooms,
        bathrooms,
        images = [],
        title_document,
        video_url,
      } = req.body;

      const video_id = video_url ? extractYouTubeId(video_url) : null;

      const rows = await db.sql`
        INSERT INTO properties (
          title,
          description,
          property_type,
          listing_type,
          price,
          currency,
          state,
          city,
          address,
          size_sqm,
          bedrooms,
          bathrooms,
          images,
          title_document,
          video_id,
          owner_id
        )
        VALUES (
          ${title},
          ${description},
          ${property_type},
          ${listing_type},
          ${Number(price)},
          ${currency},
          ${state},
          ${city},
          ${address || null},
          ${size_sqm !== undefined && size_sqm !== null
            ? Number(size_sqm)
            : null},
          ${bedrooms !== undefined && bedrooms !== null
            ? Number(bedrooms)
            : null},
          ${bathrooms !== undefined && bathrooms !== null
            ? Number(bathrooms)
            : null},
          ${JSON.stringify(images)},
          ${title_document || null},
          ${video_id},
          ${req.user.id}
        )
        RETURNING *
      `;

      const created = rows[0];

      // Seed the price history so this listing has a baseline point to
      // measure future changes against.
      await db.sql`
        INSERT INTO price_history (property_id, price, recorded_at)
        VALUES (${created.id}, ${created.price}, ${created.created_at})
      `;

      return res.status(201).json({
        data: parseProperty(created),
      });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/properties/:id
// Update - owner or admin only
router.put("/:id", authenticate, async (req, res, next) => {
  try {
    const existingRows = await db.sql`
      SELECT *
      FROM properties
      WHERE id = ${req.params.id}
      LIMIT 1
    `;

    const existing = existingRows[0];

    if (!existing) {
      return res
        .status(404)
        .json({ error: "Property not found." });
    }

    if (
      existing.owner_id !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        error:
          "You do not have permission to edit this listing.",
      });
    }

    const allowedFields = [
      "title",
      "description",
      "property_type",
      "listing_type",
      "price",
      "currency",
      "state",
      "city",
      "address",
      "size_sqm",
      "bedrooms",
      "bathrooms",
      "title_document",
      "status",
    ];

    const updates = [];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push({
          field,
          value: req.body[field],
        });
      }
    }

    if (req.body.images !== undefined) {
      updates.push({
        field: "images",
        value: JSON.stringify(req.body.images),
      });
    }

    if (req.body.video_url !== undefined) {
      if (req.body.video_url === "" || req.body.video_url === null) {
        // Explicitly clearing the video.
        updates.push({ field: "video_id", value: null });
      } else {
        const video_id = extractYouTubeId(req.body.video_url);

        if (!video_id) {
          return res.status(400).json({
            error: "That doesn't look like a valid YouTube link.",
          });
        }

        updates.push({ field: "video_id", value: video_id });
      }
    }

    if (req.user.role !== "admin") {
      updates.push({
        field: "verification_status",
        value: "pending",
      });
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: "No valid fields to update.",
      });
    }

    const setParts = updates.map(({ field, value }) => {
      const identifier = db.sql.identifier(field);
      return db.sql`${identifier} = ${value}`;
    });

    setParts.push(
      db.sql`updated_at = NOW()`
    );

    const setClause = setParts.reduce(
      (query, part, index) =>
        index === 0
          ? part
          : db.sql`${query}, ${part}`,
      db.sql``
    );

    await db.sql`
      UPDATE properties
      SET ${setClause}
      WHERE id = ${req.params.id}
    `;

    const priceUpdate = updates.find(
      (u) => u.field === "price"
    );

    if (
      priceUpdate &&
      Number(priceUpdate.value) !== Number(existing.price)
    ) {
      await db.sql`
        INSERT INTO price_history (property_id, price)
        VALUES (${req.params.id}, ${Number(priceUpdate.value)})
      `;
    }

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
});

// DELETE /api/properties/:id
// Owner or admin only
router.delete("/:id", authenticate, async (req, res, next) => {
  try {
    const existingRows = await db.sql`
      SELECT *
      FROM properties
      WHERE id = ${req.params.id}
      LIMIT 1
    `;

    const existing = existingRows[0];

    if (!existing) {
      return res
        .status(404)
        .json({ error: "Property not found." });
    }

    if (
      existing.owner_id !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        error:
          "You do not have permission to delete this listing.",
      });
    }

    await db.sql`
      DELETE FROM properties
      WHERE id = ${req.params.id}
    `;

    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// POST /api/properties/:id/save
// Save/unsave a listing
router.post("/:id/save", authenticate, async (req, res, next) => {
  try {
    const propertyRows = await db.sql`
      SELECT id
      FROM properties
      WHERE id = ${req.params.id}
      LIMIT 1
    `;

    if (propertyRows.length === 0) {
      return res
        .status(404)
        .json({ error: "Property not found." });
    }

    const existingRows = await db.sql`
      SELECT *
      FROM saved_properties
      WHERE user_id = ${req.user.id}
        AND property_id = ${req.params.id}
      LIMIT 1
    `;

    if (existingRows.length > 0) {
      await db.sql`
        DELETE FROM saved_properties
        WHERE user_id = ${req.user.id}
          AND property_id = ${req.params.id}
      `;

      return res.json({ saved: false });
    }

    await db.sql`
      INSERT INTO saved_properties (
        user_id,
        property_id
      )
      VALUES (
        ${req.user.id},
        ${req.params.id}
      )
    `;

    return res.json({ saved: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/properties/me/saved
// Current user's saved listings
router.get("/me/saved", authenticate, async (req, res, next) => {
  try {
    const rows = await db.sql`
      SELECT p.*
      FROM properties p
      JOIN saved_properties sp
        ON sp.property_id = p.id
      WHERE sp.user_id = ${req.user.id}
      ORDER BY sp.created_at DESC
    `;

    return res.json({
      data: rows.map(parseProperty),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/properties/me/listings
// Current user's own listings
router.get(
  "/me/listings",
  authenticate,
  async (req, res, next) => {
    try {
      const rows = await db.sql`
        SELECT *
        FROM properties
        WHERE owner_id = ${req.user.id}
        ORDER BY created_at DESC
      `;

      return res.json({
        data: rows.map(parseProperty),
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/properties/:id/inquiries
// Send an inquiry about a listing
router.post(
  "/:id/inquiries",
  optionalAuth,
  [
    body("name").trim().notEmpty(),
    body("email").isEmail(),
    body("message").trim().notEmpty(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res
          .status(400)
          .json({ error: errors.array()[0].msg });
      }

      const propertyRows = await db.sql`
        SELECT id
        FROM properties
        WHERE id = ${req.params.id}
        LIMIT 1
      `;

      if (propertyRows.length === 0) {
        return res
          .status(404)
          .json({ error: "Property not found." });
      }

      const {
        name,
        email,
        phone,
        message,
      } = req.body;

      await db.sql`
        INSERT INTO inquiries (
          property_id,
          user_id,
          name,
          email,
          phone,
          message
        )
        VALUES (
          ${req.params.id},
          ${req.user ? req.user.id : null},
          ${name},
          ${email},
          ${phone || null},
          ${message}
        )
      `;

      return res.status(201).json({
        message: "Inquiry sent successfully.",
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;

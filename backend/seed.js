require("dotenv").config();

const bcrypt = require("bcryptjs");
const db = require("./db");

async function seed() {
  console.log("Starting VeriEstate PostgreSQL seed...");

  // --------------------------------------------------
  // Demo owner
  // --------------------------------------------------

  const demoOwnerEmail = "owner@veriestate.com";

  let ownerRows = await db.sql`
    SELECT *
    FROM users
    WHERE email = ${demoOwnerEmail}
    LIMIT 1
  `;

  let owner = ownerRows[0];

  if (!owner) {
    const hash = bcrypt.hashSync("Password123!", 10);

    ownerRows = await db.sql`
      INSERT INTO users (
        name,
        email,
        password_hash,
        role,
        phone
      )
      VALUES (
        ${"Demo Owner"},
        ${demoOwnerEmail},
        ${hash},
        ${"user"},
        ${"+2348000000000"}
      )
      RETURNING *
    `;

    owner = ownerRows[0];

    console.log(
      `Created demo owner -> ${demoOwnerEmail} / Password123!`
    );
  } else {
    console.log(
      `Demo owner already exists -> ${demoOwnerEmail}`
    );
  }

  // --------------------------------------------------
  // Sample properties
  // --------------------------------------------------

  const sampleProperties = [
    {
      title: "2-Bedroom Terrace Duplex, New Haven",
      description:
        "A well-finished 2-bedroom terrace duplex in a serene, gated estate in Lekki Phase 1. Fitted kitchen, POP ceiling, and 24/7 estate security.",
      property_type: "residential",
      listing_type: "sale",
      price: 85000000,
      state: "Enugu",
      city: "New Haven",
      address: "New Haven, Enugu",
      latitude: 6.457,
      longitude: 7.514,
      size_sqm: 220,
      bedrooms: 2,
      bathrooms: 3,
      images: [
        "https://images.unsplash.com/photo-1600585154340-be6161a56a0c",
      ],
      verification_status: "verified",
    },

    {
      title: "Dry Serviced Land, Independence Layout",
      description:
        "600sqm of dry, gazetted land with a Governor's Consent title in a fast-developing part of Sangotedo. Fenced and gated, close to major access road.",
      property_type: "land",
      listing_type: "sale",
      price: 15000000,
      state: "Enugu",
      city: "Independence Layout",
      address: "Independence Layout, Enugu",
      latitude: 6.43,
      longitude: 7.51,
      size_sqm: 600,
      bedrooms: null,
      bathrooms: null,
      images: [
        "https://images.unsplash.com/photo-1500382017468-9049fed747ef",
      ],
      verification_status: "verified",
    },

    {
      title: "3-Bedroom Flat for Rent, Enugu GRA",
      description:
        "Spacious 3-bedroom flat in the heart of Yaba, walking distance to major tech hubs. All rooms ensuite, ample parking space.",
      property_type: "residential",
      listing_type: "rent",
      price: 2500000,
      state: "Enugu",
      city: "Enugu GRA",
      address: "Enugu GRA, Enugu",
      latitude: 6.441,
      longitude: 7.493,
      size_sqm: 140,
      bedrooms: 3,
      bathrooms: 3,
      images: [
        "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2",
      ],
      verification_status: "pending",
    },

    {
      title: "Commercial Plot, Trans-Ekulu",
      description:
        "1,000sqm commercial land right on the Lekki-Epe Expressway in Ajah, ideal for retail or office development. C of O in progress.",
      property_type: "commercial",
      listing_type: "sale",
      price: 45000000,
      state: "Enugu",
      city: "Trans-Ekulu",
      address: "Trans-Ekulu, Enugu",
      latitude: 6.469,
      longitude: 7.531,
      size_sqm: 1000,
      bedrooms: null,
      bathrooms: null,
      images: [
        "https://images.unsplash.com/photo-1512917774080-9991f1c4c750",
      ],
      verification_status: "pending",
    },
  ];

  const existingPropertyRows = await db.sql`
    SELECT COUNT(*)::int AS count
    FROM properties
  `;

  const existingPropertyCount =
    existingPropertyRows[0]?.count || 0;

  if (existingPropertyCount === 0) {
    for (const item of sampleProperties) {
      await db.sql`
        INSERT INTO properties (
          title,
          description,
          property_type,
          listing_type,
          price,
          state,
          city,
          address,
          size_sqm,
          bedrooms,
          bathrooms,
          images,
          verification_status,
          owner_id
        )
        VALUES (
          ${item.title},
          ${item.description},
          ${item.property_type},
          ${item.listing_type},
          ${item.price},
          ${item.state},
          ${item.city},
          ${item.address},
          ${item.size_sqm ?? null},
          ${item.bedrooms ?? null},
          ${item.bathrooms ?? null},
          ${JSON.stringify(item.images || [])},
          ${item.verification_status},
          ${owner.id}
        )
      `;
    }

    console.log(
      `Seeded ${sampleProperties.length} sample properties.`
    );
  } else {
    console.log(
      "Properties table already has data - skipping seed."
    );
  }

  // --------------------------------------------------
  // Admin account
  // --------------------------------------------------

  const adminEmail =
    process.env.SEED_ADMIN_EMAIL ||
    "admin@veriestate.com";

  const adminPassword =
    process.env.SEED_ADMIN_PASSWORD ||
    "ChangeMe123!";

  let adminRows = await db.sql`
    SELECT id, name, email, role
    FROM users
    WHERE role = ${"admin"}
    LIMIT 1
  `;

  let admin = adminRows[0];

  if (!admin) {
    const hash = bcrypt.hashSync(adminPassword, 10);

    adminRows = await db.sql`
      INSERT INTO users (
        name,
        email,
        password_hash,
        role
      )
      VALUES (
        ${"VeriEstate Admin"},
        ${adminEmail},
        ${hash},
        ${"admin"}
      )
      RETURNING id, name, email, role
    `;

    admin = adminRows[0];

    console.log(
      `Created admin -> ${adminEmail}`
    );
  } else {
    console.log(
      `Admin already exists -> ${admin.email}`
    );
  }

  // --------------------------------------------------
  // Sample blog posts
  // --------------------------------------------------

  function slugify(title) {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  const samplePosts = [
    {
      title:
        "How VeriEstate checks a land title before it goes live",

      excerpt:
        "A walkthrough of the three-step review every listing passes before it earns the seal.",

      content:
        "Every listing submitted to VeriEstate goes through a document review before it's visible to buyers.\n\n" +
        "First, the seller uploads the title document — a Certificate of Occupancy, Governor's Consent, or Deed of Assignment. " +
        "Second, our team cross-checks the document details against public land registry records where available, looking for " +
        "mismatched names, altered dates, or duplicate plot numbers. Third, listings that pass receive the VeriEstate seal; " +
        "anything still under review is clearly marked pending so buyers always know where a listing stands.\n\n" +
        "We publish outcomes transparently: rejected listings stay marked as rejected rather than being quietly removed, so " +
        "the review process stays visible end to end.",

      cover_image:
        "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1200",
    },

    {
      title:
        "Five questions to ask before paying for land in Lagos",

      excerpt:
        "Practical checks any buyer can do before money changes hands — verified listing or not.",

      content:
        "Verification helps, but a few habits protect you no matter where you're buying.\n\n" +
        "Ask for the original title document, not a photocopy, and confirm the name on it matches the seller's ID. " +
        "Ask whether the land has any pending litigation — a quick search at the state land registry can surface this. " +
        "Ask who else has a claim to the land; family land disputes are one of the most common sources of title fraud in Lagos. " +
        "Ask for a physical inspection with a surveyor, not just photos. And ask why the price is what it is — prices well " +
        "below the surrounding market are a signal worth investigating further, not a bargain to move quickly on.",

      cover_image:
        "https://images.unsplash.com/photo-1524230507669-5ff97982bb5e?w=1200",
    },

    {
      title:
        "Platform update: pending-listing turnaround time",

      excerpt:
        "What to expect while your submitted listing waits for review, and how to speed it up.",

      content:
        "We've had a few sellers ask how long verification takes after they submit a listing, so here's the current picture.\n\n" +
        "Most listings move from 'pending' to a decision within a few business days once the title document is attached. " +
        "The most common thing that slows a review down is an incomplete or illegible document upload — make sure the file " +
        "you attach is the actual title document, not a receipt or an agent's letter. If a listing is rejected, the reason " +
        "is left in the notes on that listing so you know exactly what to fix before resubmitting.",

      cover_image:
        "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200",
    },
  ];

  const existingPostRows = await db.sql`
    SELECT COUNT(*)::int AS count
    FROM posts
  `;

  const existingPostCount =
    existingPostRows[0]?.count || 0;

  if (existingPostCount === 0 && admin) {
    for (const item of samplePosts) {
      await db.sql`
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
          ${item.title},
          ${slugify(item.title)},
          ${item.excerpt},
          ${item.content},
          ${item.cover_image},
          ${1},
          ${admin.id},
          ${new Date()}
        )
      `;
    }

    console.log(
      `Seeded ${samplePosts.length} sample blog posts.`
    );
  } else {
    console.log(
      "Posts table already has data - skipping post seed."
    );
  }

  console.log("VeriEstate seed completed successfully.");
}

seed().catch((err) => {
  console.error("Seed failed:");
  console.error(err);
  process.exit(1);
});
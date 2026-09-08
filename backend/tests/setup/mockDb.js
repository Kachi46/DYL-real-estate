// A fake in-memory stand-in for `../db`'s tagged-template `sql` query
// builder. Route tests `jest.mock("../db", () => createMockDb(...))`
// this instead of talking to a real Postgres database.
//
// The real db.js's `sql` returns a lazy, thenable `SqlFragment` so that
// nested `sql` calls (`sql\`${whereClause} AND ${condition}\``) can be
// *composed* into one query's text/params without each nested call
// running a query of its own - only the outermost `await` actually
// executes anything. This mock mirrors that composition behavior
// exactly (same text-splicing algorithm minus real $N placeholder
// numbering, since nothing here talks to a real Postgres wire
// protocol), then dispatches the fully-composed text once it's finally
// awaited.
//
// Dispatch itself is done by matching distinguishing substrings in that
// composed text rather than parsing SQL - intentionally a little
// verbose, but it means tests exercise the *real* route code
// (validation, bcrypt, JWT signing, business logic, fragment
// composition) end to end, with only the database swapped out. Branches
// are ordered most-specific first, since several queries share
// substrings (e.g. every users query has "FROM users").
function createMockDb(seed = {}) {
  const users = seed.users ? seed.users.map((u) => ({ ...u })) : [];
  let nextUserId = seed.nextUserId || (users.length ? Math.max(...users.map((u) => u.id)) + 1 : 1);
  const passwordResetTokens = [];
  const emailVerificationTokens = [];
  const properties = seed.properties ? seed.properties.map((p) => ({ ...p })) : [];
  let nextPropertyId = seed.nextPropertyId || (properties.length ? Math.max(...properties.map((p) => Number(p.id))) + 1 : 1);
  const savedProperties = [];
  const priceHistory = [];
  const posts = seed.posts ? seed.posts.map((p) => ({ ...p })) : [];
  let nextPostId = seed.nextPostId || (posts.length ? Math.max(...posts.map((p) => Number(p.id))) + 1 : 1);
  const inquiries = [];
  const inspectionBookings = [];
  let nextInspectionId = 1;
  const adminActions = [];
  let nextAdminActionId = 1;

  const byEmail = (email) => users.find((u) => u.email === email);
  const byId = (id) => users.find((u) => String(u.id) === String(id));
  const propertyById = (id) => properties.find((p) => String(p.id) === String(id));

  function dispatch(text, values) {
    // --- writes to users ---------------------------------------------
    if (text.includes("INSERT INTO users") && text.includes("password_hash")) {
      const [name, first_name, last_name, email, password_hash, phone, user_type, email_opt_in] = values;
      const user = {
        id: nextUserId++,
        name, first_name, last_name, email, password_hash, phone,
        user_type, email_opt_in, role: "user", token_version: 0,
        email_verified: false, google_id: null,
        failed_login_attempts: 0, locked_until: null,
        created_at: new Date().toISOString(),
      };
      users.push(user);
      return [user];
    }

    if (text.includes("INSERT INTO users") && text.includes("google_id")) {
      const [name, first_name, last_name, email, google_id, user_type, email_verified] = values;
      const user = {
        id: nextUserId++,
        name, first_name, last_name, email, google_id, user_type,
        email_verified, password_hash: null, role: "user", token_version: 0,
        failed_login_attempts: 0, locked_until: null,
        created_at: new Date().toISOString(),
      };
      users.push(user);
      return [user];
    }

    if (text.includes("UPDATE users") && text.includes("google_id") && text.includes("RETURNING")) {
      const [google_id, id] = values;
      const user = byId(id);
      if (user) { user.google_id = google_id; user.email_verified = true; }
      return user ? [user] : [];
    }

    if (text.includes("UPDATE users") && text.includes("password_hash") && text.includes("token_version") && text.includes("RETURNING")) {
      const [password_hash, id] = values;
      const user = byId(id);
      if (user) { user.password_hash = password_hash; user.token_version += 1; }
      return user ? [user] : [];
    }

    if (text.includes("UPDATE users") && text.includes("password_hash") && text.includes("token_version")) {
      const [password_hash, id] = values;
      const user = byId(id);
      if (user) { user.password_hash = password_hash; user.token_version += 1; }
      return [];
    }

    if (text.includes("UPDATE users") && text.includes("failed_login_attempts = 0, locked_until = NULL")) {
      const [id] = values;
      const user = byId(id);
      if (user) { user.failed_login_attempts = 0; user.locked_until = null; }
      return [];
    }

    if (text.includes("UPDATE users") && text.includes("failed_login_attempts") && text.includes("locked_until")) {
      const [failed_login_attempts, locked_until, id] = values;
      const user = byId(id);
      if (user) { user.failed_login_attempts = failed_login_attempts; user.locked_until = locked_until; }
      return [];
    }

    if (text.includes("UPDATE users") && text.includes("email_verified")) {
      const [id] = values;
      const user = byId(id);
      if (user) user.email_verified = true;
      return [];
    }

    if (text.includes("UPDATE users") && text.includes("role")) {
      const [role, id] = values;
      const user = byId(id);
      if (user) user.role = role;
      return [];
    }

    if (text.includes("DELETE FROM users")) {
      const [id] = values;
      const idx = users.findIndex((u) => String(u.id) === String(id));
      if (idx >= 0) users.splice(idx, 1);
      return [];
    }

    // --- reads on users -------------------------------------------------
    if (text.includes("SELECT id, email, role") && text.includes("WHERE email")) {
      const user = byEmail(values[0]);
      return user ? [{ id: user.id, email: user.email, role: user.role }] : [];
    }

    if (text.includes("SELECT id, email") && text.includes("FROM users") && text.includes("WHERE id")) {
      const user = byId(values[0]);
      return user ? [{ id: user.id, email: user.email }] : [];
    }

    if (text.includes("SELECT id") && text.includes("FROM users") && text.includes("WHERE email")) {
      const user = byEmail(values[0]);
      return user ? [{ id: user.id }] : [];
    }

    if (text.includes("SELECT id") && text.includes("FROM users") && text.includes("WHERE id")) {
      const user = byId(values[0]);
      return user ? [{ id: user.id }] : [];
    }

    if (text.includes("SELECT token_version FROM users")) {
      const user = byId(values[0]);
      return user ? [{ token_version: user.token_version }] : [];
    }

    if (text.includes("COUNT(*)") && text.includes("FROM users")) {
      return [{ count: users.length }];
    }

    if (text.includes("SELECT") && text.includes("FROM users") && text.includes("ORDER BY created_at DESC") && !text.includes("WHERE")) {
      const sorted = [...users].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return sorted.map((u) => ({
        id: u.id, name: u.name, first_name: u.first_name, last_name: u.last_name,
        email: u.email, role: u.role, user_type: u.user_type, phone: u.phone,
        email_opt_in: u.email_opt_in, has_google_login: !!u.google_id, created_at: u.created_at,
      }));
    }

    if (text.includes("SELECT *") && text.includes("FROM users") && text.includes("WHERE email")) {
      const user = byEmail(values[0]);
      return user ? [user] : [];
    }

    if (text.includes("SELECT *") && text.includes("FROM users") && text.includes("WHERE google_id")) {
      const user = users.find((u) => u.google_id === values[0]);
      return user ? [user] : [];
    }

    if (text.includes("SELECT *") && text.includes("FROM users") && text.includes("WHERE id")) {
      const user = byId(values[0]);
      return user ? [user] : [];
    }

    // --- email verification tokens --------------------------------------
    if (text.includes("DELETE FROM email_verification_tokens")) return [];
    if (text.includes("INSERT INTO email_verification_tokens")) {
      const [user_id, token_hash] = values;
      emailVerificationTokens.push({ user_id, token_hash, used_at: null, expires_at: Date.now() + 86400000 });
      return [];
    }
    if (text.includes("UPDATE email_verification_tokens") && text.includes("used_at")) {
      const [token_hash] = values;
      const record = emailVerificationTokens.find(
        (t) => t.token_hash === token_hash && !t.used_at && t.expires_at > Date.now()
      );
      if (!record) return [];
      record.used_at = Date.now();
      return [{ user_id: record.user_id }];
    }

    // --- password reset tokens -------------------------------------------
    if (text.includes("DELETE FROM password_reset_tokens")) return [];
    if (text.includes("INSERT INTO password_reset_tokens")) {
      const [user_id, token_hash] = values;
      passwordResetTokens.push({ user_id, token_hash, used_at: null, expires_at: Date.now() + 3600000 });
      return [];
    }
    if (text.includes("FROM password_reset_tokens") && text.includes("JOIN users")) {
      const [token_hash] = values;
      const record = passwordResetTokens.find(
        (t) => t.token_hash === token_hash && !t.used_at && t.expires_at > Date.now()
      );
      if (!record) return [];
      const user = byId(record.user_id);
      return user ? [{ user_id: record.user_id, email: user.email, name: user.name }] : [];
    }
    if (text.includes("UPDATE password_reset_tokens") && text.includes("used_at")) {
      const [token_hash] = values;
      const record = passwordResetTokens.find(
        (t) => t.token_hash === token_hash && !t.used_at && t.expires_at > Date.now()
      );
      if (!record) return [];
      record.used_at = Date.now();
      return [{ user_id: record.user_id }];
    }

    // --- properties: owner-joined lookups used by notifications ----------
    if (text.includes("SELECT p.*") && text.includes("owner_email") && text.includes("FROM properties p")) {
      const property = propertyById(values[0]);
      if (!property) return [];
      const owner = byId(property.owner_id);
      return [{ ...property, owner_email: owner?.email, owner_name: owner?.name }];
    }

    if (text.includes("p.city") && text.includes("owner_email") && text.includes("FROM properties p")) {
      const property = propertyById(values[0]);
      if (!property || property.status !== values[1]) return [];
      const owner = byId(property.owner_id);
      return [{
        id: property.id, title: property.title, city: property.city, state: property.state,
        owner_email: owner?.email, owner_name: owner?.name,
      }];
    }

    if (text.includes("owner_email") && text.includes("FROM properties p")) {
      const property = propertyById(values[0]);
      if (!property) return [];
      const owner = byId(property.owner_id);
      return [{ id: property.id, title: property.title, owner_email: owner?.email, owner_name: owner?.name }];
    }

    // --- public property search (GET /properties) ------------------------
    // The public search route composes a WHERE clause out of up to 9
    // optional conditions (text search, state/city/type filters, price
    // range, verified-only, has-video) on top of two conditions that are
    // always present. That always-present pair - filtering to active
    // status and excluding rejected listings - is what distinguishes this
    // route's queries from every other "FROM properties" query in the
    // app, so it's used as the dispatch signature here.
    if (text.includes("FROM properties") && text.includes("status = ?") && text.includes("verification_status != ?")) {
      const { matched, nextCursor } = evaluatePropertySearch(text, values);

      if (text.includes("COUNT(*)")) {
        return [{ count: matched.length }];
      }

      const sorted = matched.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      const limit = values[nextCursor];
      const offset = values[nextCursor + 1];
      return sorted.slice(offset, offset + limit);
    }

    // --- properties: plain reads/writes ----------------------------------
    if (text.includes("COUNT(*)") && text.includes("FROM properties") && text.includes("owner_id")) {
      const [ownerId] = values;
      return [{ count: properties.filter((p) => String(p.owner_id) === String(ownerId)).length }];
    }

    if (text.includes("COUNT(*)") && text.includes("FROM properties")) {
      const verificationValue = values.find((v) => ["pending", "verified", "rejected"].includes(v));
      const filtered = verificationValue
        ? properties.filter((p) => p.verification_status === verificationValue)
        : properties;
      return [{ count: filtered.length }];
    }

    if (text.includes("SELECT *") && text.includes("FROM properties") && text.includes("WHERE id") && !text.includes("JOIN")) {
      const property = propertyById(values[0]);
      return property ? [property] : [];
    }

    if (text.includes("SELECT *") && text.includes("FROM properties") && text.includes("owner_id") && text.includes("WHERE")) {
      const [ownerId] = values;
      return properties
        .filter((p) => String(p.owner_id) === String(ownerId))
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    }

    if (text.includes("SELECT *") && text.includes("FROM properties") && text.includes("verification_status")) {
      const [status] = values;
      return properties
        .filter((p) => p.verification_status === status)
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    }

    if (text.includes("SELECT *") && text.includes("FROM properties") && !text.includes("JOIN")) {
      return [...properties].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    }

    if (text.includes("SELECT id") && text.includes("FROM properties") && text.includes("WHERE id")) {
      const property = propertyById(values[0]);
      return property ? [{ id: property.id }] : [];
    }

    if (text.includes("UPDATE properties") && text.includes("verification_status") && text.includes("verification_notes")) {
      const [verification_status, verification_notes, id] = values;
      const property = propertyById(id);
      if (property) { property.verification_status = verification_status; property.verification_notes = verification_notes; }
      return [];
    }

    // --- inspection slot conflicts / inserts -----------------------------
    if (text.includes("SELECT id FROM inspection_bookings")) {
      const [property_id, date, time] = values;
      const conflict = inspectionBookings.find(
        (b) => String(b.property_id) === String(property_id) && b.inspection_date === date &&
          b.inspection_time === time && ["pending", "confirmed"].includes(b.status)
      );
      return conflict ? [{ id: conflict.id }] : [];
    }

    if (text.includes("INSERT INTO inquiries")) {
      const [property_id, user_id, name, email, phone, message] = values;
      inquiries.push({ property_id, user_id, name, email, phone, message });
      return [];
    }

    if (text.includes("INSERT INTO inspection_bookings")) {
      const [property_id, user_id, name, email, phone, inspection_date, inspection_time, notes] = values;
      const booking = {
        id: nextInspectionId++, property_id, user_id, name, email, phone,
        inspection_date, inspection_time, notes, status: "pending",
      };
      inspectionBookings.push(booking);
      return [{ id: booking.id, inspection_date, inspection_time, status: booking.status }];
    }

    if (text.includes("COUNT(*)") && text.includes("FROM inspection_bookings")) {
      return [{ count: inspectionBookings.length }];
    }

    if (text.includes("FROM inspection_bookings") && text.includes("JOIN properties")) {
      return inspectionBookings.map((b) => {
        const property = propertyById(b.property_id);
        return { ...b, property_title: property?.title, city: property?.city, state: property?.state };
      });
    }

    if (text.includes("UPDATE inspection_bookings") && text.includes("status")) {
      const [status, id] = values;
      const booking = inspectionBookings.find((b) => String(b.id) === String(id));
      if (!booking) return [];
      booking.status = status;
      return [booking];
    }

    if (text.includes("COUNT(*)") && text.includes("FROM inquiries")) {
      return [{ count: inquiries.length }];
    }

    if (text.includes("INSERT INTO properties") && text.includes("owner_id")) {
      const [
        title, description, property_type, listing_type, price, currency,
        state, city, address, latitude, longitude, size_sqm, bedrooms,
        bathrooms, images, title_document, video_id, owner_id,
      ] = values;
      const property = {
        id: nextPropertyId++, title, description, property_type, listing_type,
        price, currency, state, city, address, latitude, longitude, size_sqm,
        bedrooms, bathrooms, images, title_document, video_id, owner_id,
        status: "active", verification_status: "pending", verification_notes: null,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      };
      properties.push(property);
      return [property];
    }

    // Generic handler for the PUT /:id route's dynamically-built SET
    // clause (each field set via db.sql.identifier(field), composed
    // together) - rather than one branch per possible field combination,
    // this reads the quoted "field" names straight out of the composed
    // text (in the same left-to-right order their values appear) and
    // applies them positionally. The final value is always the WHERE id.
    if (text.includes("UPDATE properties") && text.includes("SET") && /"\w+"\s*=/.test(text)) {
      const fieldNames = [...text.matchAll(/"(\w+)"\s*=/g)].map((m) => m[1]);
      const id = values[values.length - 1];
      const property = propertyById(id);
      if (property) {
        fieldNames.forEach((field, i) => { property[field] = values[i]; });
        property.updated_at = new Date().toISOString();
      }
      return [];
    }

    if (text.includes("INSERT INTO price_history")) {
      const [property_id, price] = values;
      priceHistory.push({ property_id, price, recorded_at: new Date().toISOString() });
      return [];
    }

    if (text.includes("DELETE FROM properties")) {
      const [id] = values;
      const idx = properties.findIndex((p) => String(p.id) === String(id));
      if (idx >= 0) properties.splice(idx, 1);
      return [];
    }

    // --- saved properties -------------------------------------------------
    if (text.includes("COUNT(*)") && text.includes("FROM saved_properties")) {
      const [user_id] = values;
      return [{ count: savedProperties.filter((s) => String(s.user_id) === String(user_id)).length }];
    }

    if (text.includes("SELECT *") && text.includes("FROM saved_properties")) {
      const [user_id, property_id] = values;
      return savedProperties.filter(
        (s) => String(s.user_id) === String(user_id) && String(s.property_id) === String(property_id)
      );
    }

    if (text.includes("DELETE FROM saved_properties")) {
      const [user_id, property_id] = values;
      const idx = savedProperties.findIndex(
        (s) => String(s.user_id) === String(user_id) && String(s.property_id) === String(property_id)
      );
      if (idx >= 0) savedProperties.splice(idx, 1);
      return [];
    }

    if (text.includes("INSERT INTO saved_properties")) {
      const [user_id, property_id] = values;
      savedProperties.push({ user_id, property_id, created_at: new Date().toISOString() });
      return [];
    }

    if (text.includes("FROM properties p") && text.includes("JOIN saved_properties")) {
      const [user_id] = values;
      return savedProperties
        .filter((s) => String(s.user_id) === String(user_id))
        .map((s) => propertyById(s.property_id))
        .filter(Boolean);
    }

    // --- posts: public reads ----------------------------------------------
    if (text.includes("COUNT(*)") && text.includes("FROM posts") && text.includes("published")) {
      return [{ count: posts.filter((p) => !!p.published).length }];
    }

    if (text.includes("p.id") && text.includes("p.title") && text.includes("p.slug") && text.includes("JOIN users") && text.includes("p.published")) {
      const published = posts
        .filter((p) => !!p.published)
        .sort((a, b) => new Date(b.published_at || 0) - new Date(a.published_at || 0));
      return published.map((p) => {
        const author = byId(p.author_id);
        return {
          id: p.id, title: p.title, slug: p.slug, excerpt: p.excerpt,
          cover_image: p.cover_image, published_at: p.published_at,
          created_at: p.created_at, published: p.published, author_name: author?.name,
        };
      });
    }

    if (text.includes("SELECT") && text.includes("p.*") && text.includes("author_name") && text.includes("p.slug =") && text.includes("p.published")) {
      const [slug] = values;
      const post = posts.find((p) => p.slug === slug && !!p.published);
      if (!post) return [];
      const author = byId(post.author_id);
      return [{ ...post, author_name: author?.name }];
    }

    // --- posts: admin management --------------------------------------
    if (text.includes("SELECT id") && text.includes("FROM posts") && text.includes("WHERE slug")) {
      const [slug] = values;
      const post = posts.find((p) => p.slug === slug);
      return post ? [{ id: post.id }] : [];
    }

    if (text.includes("INSERT INTO posts")) {
      const [title, slug, excerpt, content, cover_image, published, author_id, published_at] = values;
      const post = {
        id: nextPostId++, title, slug, excerpt, content, cover_image,
        published, author_id, published_at,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      };
      posts.push(post);
      return [post];
    }

    if (text.includes("SELECT") && text.includes("p.*") && text.includes("author_name") && text.includes("p.id =")) {
      const [id] = values;
      const post = posts.find((p) => String(p.id) === String(id));
      if (!post) return [];
      const author = byId(post.author_id);
      return [{ ...post, author_name: author?.name }];
    }

    if (text.includes("SELECT *") && text.includes("FROM posts") && text.includes("WHERE id")) {
      const [id] = values;
      const post = posts.find((p) => String(p.id) === String(id));
      return post ? [post] : [];
    }

    if (text.includes("UPDATE posts") && text.includes("SET")) {
      const [title, slug, excerpt, content, cover_image, published, published_at, id] = values;
      const post = posts.find((p) => String(p.id) === String(id));
      if (post) {
        Object.assign(post, { title, slug, excerpt, content, cover_image, published, published_at, updated_at: new Date().toISOString() });
      }
      return [];
    }

    if (text.includes("SELECT id, title") && text.includes("FROM posts") && text.includes("WHERE id")) {
      const [id] = values;
      const post = posts.find((p) => String(p.id) === String(id));
      return post ? [{ id: post.id, title: post.title }] : [];
    }

    if (text.includes("DELETE FROM posts")) {
      const [id] = values;
      const idx = posts.findIndex((p) => String(p.id) === String(id));
      if (idx >= 0) posts.splice(idx, 1);
      return [];
    }

    if (text.includes("COUNT(*)") && text.includes("FROM posts")) {
      return [{ count: posts.length }];
    }

    if (text.includes("p.*") && text.includes("author_name") && text.includes("FROM posts p") && text.includes("ORDER BY p.created_at DESC")) {
      const sorted = [...posts].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return sorted.map((p) => {
        const author = byId(p.author_id);
        return { ...p, author_name: author?.name };
      });
    }

    // --- admin_actions audit log -----------------------------------------
    if (text.includes("INSERT INTO admin_actions")) {
      const [admin_id, action, target_type, target_id, details] = values;
      adminActions.push({
        id: nextAdminActionId++, admin_id, action, target_type, target_id,
        details: details ? JSON.parse(details) : null,
        created_at: new Date().toISOString(),
      });
      return [];
    }

    if (text.includes("FROM admin_actions") && text.includes("COUNT(*)")) {
      return [{ count: filterAdminActions(text, values).length }];
    }

    if (text.includes("FROM admin_actions")) {
      return filterAdminActions(text, values)
        .slice()
        .reverse()
        .map((a) => {
          const admin = byId(a.admin_id);
          return { ...a, admin_name: admin?.name, admin_email: admin?.email };
        });
    }

    throw new Error(`mockDb: no handler for query: ${text.slice(0, 160)}`);
  }

  // The audit-log route builds its WHERE clause conditionally
  // (target_type, target_id, or both) via the same fragment-composition
  // pattern as the public properties search - rather than special-case
  // every combination, this reads which columns appear in the composed
  // text (in the order their conditions were pushed) and matches them
  // positionally against the params, the same way the generic UPDATE
  // handler above reads dynamic identifiers.
  function filterAdminActions(text, values) {
    const filterFields = [];
    if (text.includes("a.target_type =")) filterFields.push("target_type");
    if (text.includes("a.target_id =")) filterFields.push("target_id");

    if (filterFields.length === 0) return adminActions;

    return adminActions.filter((entry) =>
      filterFields.every((field, i) => String(entry[field]) === String(values[i]))
    );
  }

  // Parses the public search route's composed WHERE clause (see the
  // dispatch branch above) into a set of predicates and applies them.
  // Splitting on top-level " AND " is safe here: the only nested boolean
  // logic - the title/description/city/state search - uses " OR " inside
  // parens, and no individual condition's text contains " AND ".
  // Returns `nextCursor`, the params index right after the last filter
  // value consumed, so the caller can read LIMIT/OFFSET (for the SELECT
  // variant) or know there's nothing left to read (for the COUNT variant).
  function evaluatePropertySearch(text, values) {
    const whereStart = text.indexOf("WHERE");
    const orderIdx = text.indexOf("ORDER BY");
    const whereText = text.slice(whereStart + "WHERE".length, orderIdx === -1 ? text.length : orderIdx).trim();
    const segments = whereText.split(" AND ").map((s) => s.trim()).filter(Boolean);

    let cursor = 0;
    const predicates = [];

    for (const segment of segments) {
      if (segment.startsWith("status = ")) {
        const val = values[cursor++];
        predicates.push((p) => p.status === val);
      } else if (segment.startsWith("verification_status != ")) {
        const val = values[cursor++];
        predicates.push((p) => p.verification_status !== val);
      } else if (segment.startsWith("verification_status = ")) {
        const val = values[cursor++];
        predicates.push((p) => p.verification_status === val);
      } else if (segment.startsWith("state = ")) {
        const val = values[cursor++];
        predicates.push((p) => p.state === val);
      } else if (segment.startsWith("city = ")) {
        const val = values[cursor++];
        predicates.push((p) => p.city === val);
      } else if (segment.startsWith("property_type = ")) {
        const val = values[cursor++];
        predicates.push((p) => p.property_type === val);
      } else if (segment.startsWith("listing_type = ")) {
        const val = values[cursor++];
        predicates.push((p) => p.listing_type === val);
      } else if (segment.startsWith("price >= ")) {
        const val = Number(values[cursor++]);
        predicates.push((p) => Number(p.price) >= val);
      } else if (segment.startsWith("price <= ")) {
        const val = Number(values[cursor++]);
        predicates.push((p) => Number(p.price) <= val);
      } else if (segment.includes("video_id IS NOT NULL")) {
        predicates.push((p) => p.video_id != null);
      } else if (segment.startsWith("(") && segment.includes("ILIKE")) {
        // Four placeholders (title/description/city/state), all sharing
        // the same "%needle%" value.
        const placeholderCount = (segment.match(/\?/g) || []).length;
        const rawLike = String(values[cursor] ?? "");
        cursor += placeholderCount;
        const needle = rawLike.replace(/^%/, "").replace(/%$/, "").toLowerCase();
        predicates.push((p) =>
          [p.title, p.description, p.city, p.state].some(
            (field) => field && String(field).toLowerCase().includes(needle)
          )
        );
      }
    }

    const matched = properties.filter((p) => predicates.every((pred) => pred(p)));
    return { matched, nextCursor: cursor };
  }

  // Mirrors backend/db.js's SqlFragment: a lazy, thenable wrapper around
  // composed SQL text + params. Nested `sql` calls splice their text
  // directly into the parent (matching the real fragment-composition
  // behavior) instead of each one executing independently - only
  // `dispatch()` on final `await` does anything.
  class MockSqlFragment {
    constructor(text, params) {
      this.text = text;
      this.params = params;
    }
    then(onFulfilled, onRejected) {
      return Promise.resolve()
        .then(() => dispatch(this.text, this.params))
        .then(onFulfilled, onRejected);
    }
    catch(onRejected) {
      return this.then(undefined, onRejected);
    }
    finally(onFinally) {
      return this.then(
        (v) => { onFinally(); return v; },
        (e) => { onFinally(); throw e; }
      );
    }
  }

  function sqlImpl(strings, ...values) {
    let text = "";
    const params = [];

    strings.forEach((str, i) => {
      text += str;
      if (i >= values.length) return;
      const value = values[i];
      if (value instanceof MockSqlFragment) {
        text += value.text;
        params.push(...value.params);
      } else {
        params.push(value);
        text += "?";
      }
    });

    return new MockSqlFragment(text, params);
  }

  const sql = jest.fn(sqlImpl);
  sql.identifier = (name) => new MockSqlFragment(`"${String(name).replace(/"/g, '""')}"`, []);

  return {
    sql,
    __users: users,
    __properties: properties,
    __inquiries: inquiries,
    __inspectionBookings: inspectionBookings,
    __adminActions: adminActions,
  };
}

module.exports = { createMockDb };

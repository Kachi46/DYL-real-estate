const db = require("../db");

// Best-effort by design, same reasoning as lib/notifications.js: the
// admin action itself (the verify decision, the role change, etc) has
// already succeeded by the time this is called, so a logging failure
// must never turn a successful admin action into a failed request.
// Every call site wraps this in its own try/catch for that reason.
async function logAdminAction({ adminId, action, targetType, targetId, details }) {
  await db.sql`
    INSERT INTO admin_actions (admin_id, action, target_type, target_id, details)
    VALUES (${adminId}, ${action}, ${targetType}, ${targetId ? String(targetId) : null}, ${details ? JSON.stringify(details) : null})
  `;
}

module.exports = { logAdminAction };

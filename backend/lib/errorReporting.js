// Replaces bare `console.error(err)` with structured, log-aggregator-
// friendly output (one JSON object per line - what Datadog, CloudWatch,
// Vercel's log drains, etc. all expect), plus an optional hook into
// Sentry if the deployment wants it.
//
// Sentry itself is intentionally NOT a hard dependency: most of this
// codebase's actual users won't have a Sentry account, and adding an
// unused error-tracking SDK to package.json for everyone is a worse
// default than a documented opt-in. To enable it:
//   1. npm install @sentry/node
//   2. Set SENTRY_DSN in your environment
// Without both of those, this silently no-ops and structured console
// logging still happens either way.
let sentryClient = null;
let triedLoadingSentry = false;

function getSentryClient() {
  if (triedLoadingSentry) return sentryClient;
  triedLoadingSentry = true;

  if (!process.env.SENTRY_DSN) return null;

  try {
    // Optional, loaded only if SENTRY_DSN is configured (see comment above).
    const Sentry = require("@sentry/node");
    Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV || "development" });
    sentryClient = Sentry;
  } catch (loadErr) {
    console.error(
      "[errorReporting] SENTRY_DSN is set but @sentry/node isn't installed. " +
        "Run `npm install @sentry/node` to enable it. Falling back to console logging only."
    );
  }

  return sentryClient;
}

function reportError(err, req) {
  const structured = {
    level: "error",
    timestamp: new Date().toISOString(),
    message: err.message,
    status: err.status || 500,
    method: req?.method,
    path: req?.originalUrl || req?.path,
    // req.user is only present on authenticated requests (set by the
    // authenticate middleware) - never log the request body, since it
    // may contain a password or other sensitive field.
    userId: req?.user?.id,
    stack: err.stack,
  };

  console.error(JSON.stringify(structured));

  const sentry = getSentryClient();
  if (sentry) {
    sentry.captureException(err, { extra: { path: structured.path, userId: structured.userId } });
  }
}

module.exports = { reportError };

// Length over complexity: NIST 800-63B's current guidance (and most
// modern security practice) is that forced complexity rules ("must
// contain a symbol") mostly just push people toward predictable
// patterns like "Passw0rd!" - a longer minimum length plus blocking
// known-weak passwords does more for actual security than a character-
// class checklist.
const MIN_LENGTH = 8;

// bcrypt (via bcryptjs) silently truncates at 72 bytes - anything beyond
// that is ignored when hashing, so two different passwords sharing the
// same 72-byte prefix would hash identically. Capping input length here
// makes that impossible rather than leaving it as a silent footgun.
const MAX_BYTES = 72;

// Not exhaustive - a real "have this been breached" check (e.g. the
// HaveIBeenPwned k-anonymity API) would catch far more, but that means
// an external network call on every password set and is a reasonable
// follow-up rather than a blocker here. This denylist catches the most
// common weak passwords, but should stay small enough that it doesn't
// take an amount of time noticeably different from every other password.
const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "12345678", "123456789",
  "1234567890", "qwerty123", "qwertyuiop", "letmein123", "iloveyou1",
  "admin1234", "welcome123", "abc123456", "football1", "baseball1",
  "dragon123", "monkey123", "sunshine1", "princess1", "111111111",
  "000000000", "trustno1", "superman1", "master123", "hello1234",
  "freedom123", "whatever1", "changeme1", "letmein12", "passw0rd1",
  "p@ssw0rd1", "starwars1", "shadow123", "michael123", "jennifer1",
]);

// Returns null if `password` is acceptable, or a user-facing error
// string if not. `email` and `name` are optional context — pass
// whichever you have available at the call site (register has both from
// the request body; change-password has both from the authenticated
// user; reset-password looks the user up first) so the password can be
// checked against the account's own identifying details. Fragments
// under 3 characters are skipped (e.g. an initial) since blocking those
// would reject too many legitimate passwords by coincidence.
function validatePassword(password, { email, name } = {}) {
  if (typeof password !== "string" || password.length < MIN_LENGTH) {
    return `Password must be at least ${MIN_LENGTH} characters.`;
  }

  if (Buffer.byteLength(password, "utf8") > MAX_BYTES) {
    return `Password must be ${MAX_BYTES} characters or fewer.`;
  }

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return "That password is too common. Please choose a less predictable one.";
  }

  const lower = password.toLowerCase();
  const fragments = [];
  if (email) fragments.push(String(email).split("@")[0]);
  if (name) fragments.push(...String(name).split(/\s+/));

  const meaningful = fragments.map((f) => f.toLowerCase()).filter((f) => f.length >= 3);
  if (meaningful.some((fragment) => lower.includes(fragment))) {
    return "Password shouldn't contain your name or email.";
  }

  return null;
}

module.exports = { validatePassword, MIN_LENGTH, MAX_BYTES };

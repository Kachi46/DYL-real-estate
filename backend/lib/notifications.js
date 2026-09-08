const { sendMail } = require("./mailer");

const clientBase = () =>
  (process.env.CLIENT_ORIGIN || "http://localhost:5500/user-site").replace(/\/$/, "");

// Inquiry messages, booking notes, and names all come from a public,
// unauthenticated form - escaping them before they go into an HTML email
// body is the same reasoning as escaping anything else user-submitted
// before it reaches a rendered surface, even though the "page" here is
// someone's inbox rather than the website itself.
function esc(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Sent when an admin verifies or rejects a listing. Previously this state
// change was silent - an owner would only find out by opening their
// dashboard and noticing the badge had changed, so a listing sitting in
// "rejected" (fixable, e.g. a blurry title document) could go unnoticed
// indefinitely.
async function notifyListingStatusChange({ ownerEmail, ownerName, listingTitle, status, notes }) {
  if (!ownerEmail) return;

  const dashboardUrl = `${clientBase()}/dashboard.html`;

  if (status === "verified") {
    await sendMail({
      to: ownerEmail,
      subject: `Your listing "${listingTitle}" has been verified`,
      text: `Hi ${ownerName || "there"},\n\nGood news - your listing "${listingTitle}" has passed review and is now live and visible to buyers/tenants.\n\nView it in your dashboard: ${dashboardUrl}`,
      html: `<p>Hi ${esc(ownerName) || "there"},</p><p>Good news — your listing <strong>"${esc(listingTitle)}"</strong> has passed review and is now live and visible to buyers/tenants.</p><p><a href="${dashboardUrl}">View it in your dashboard</a></p>`,
    });
  } else if (status === "rejected") {
    const reasonText = notes ? `\n\nReviewer's note: ${notes}` : "";
    const reasonHtml = notes ? `<p><strong>Reviewer's note:</strong> ${esc(notes)}</p>` : "";
    await sendMail({
      to: ownerEmail,
      subject: `Your listing "${listingTitle}" needs changes`,
      text: `Hi ${ownerName || "there"},\n\nYour listing "${listingTitle}" wasn't approved in its current form.${reasonText}\n\nYou can update it and it will be reviewed again: ${dashboardUrl}`,
      html: `<p>Hi ${esc(ownerName) || "there"},</p><p>Your listing <strong>"${esc(listingTitle)}"</strong> wasn't approved in its current form.</p>${reasonHtml}<p>You can update it and it will be reviewed again: <a href="${dashboardUrl}">${dashboardUrl}</a></p>`,
    });
  }
  // "pending" (e.g. an admin resetting status for re-review) is a neutral,
  // internal state change - nothing actionable for the owner, so no email.
}

async function notifyNewInquiry({ ownerEmail, ownerName, listingTitle, inquiry }) {
  if (!ownerEmail) return;

  await sendMail({
    to: ownerEmail,
    subject: `New inquiry on "${listingTitle}"`,
    text: `Hi ${ownerName || "there"},\n\n${inquiry.name} (${inquiry.email}${inquiry.phone ? `, ${inquiry.phone}` : ""}) sent a message about "${listingTitle}":\n\n"${inquiry.message}"\n\nReply directly to their email to follow up.`,
    html: `<p>Hi ${esc(ownerName) || "there"},</p><p><strong>${esc(inquiry.name)}</strong> (${esc(inquiry.email)}${inquiry.phone ? `, ${esc(inquiry.phone)}` : ""}) sent a message about <strong>"${esc(listingTitle)}"</strong>:</p><blockquote>${esc(inquiry.message)}</blockquote><p>Reply directly to their email to follow up.</p>`,
  });
}

async function notifyNewInspectionRequest({ ownerEmail, ownerName, listingTitle, booking }) {
  if (!ownerEmail) return;

  await sendMail({
    to: ownerEmail,
    subject: `New inspection request for "${listingTitle}"`,
    text: `Hi ${ownerName || "there"},\n\n${booking.name} (${booking.email}, ${booking.phone}) requested to inspect "${listingTitle}" on ${booking.inspection_date} at ${booking.inspection_time}.${booking.notes ? `\n\nTheir note: ${booking.notes}` : ""}\n\nConfirm or reschedule from your dashboard.`,
    html: `<p>Hi ${esc(ownerName) || "there"},</p><p><strong>${esc(booking.name)}</strong> (${esc(booking.email)}, ${esc(booking.phone)}) requested to inspect <strong>"${esc(listingTitle)}"</strong> on ${esc(booking.inspection_date)} at ${esc(booking.inspection_time)}.</p>${booking.notes ? `<p><strong>Their note:</strong> ${esc(booking.notes)}</p>` : ""}<p>Confirm or reschedule from your dashboard.</p>`,
  });
}

module.exports = { notifyListingStatusChange, notifyNewInquiry, notifyNewInspectionRequest };

/**
 * HTML email templates for outbound agent replies.
 */

const brandColor = "#3ECF8E";

interface OutboundEmailOptions {
  body: string;
  senderName: string;
  signature?: string;
}

/**
 * Render the HTML email body for an outbound agent reply.
 */
export function renderOutboundEmail({
  body,
  senderName,
  signature,
}: OutboundEmailOptions): string {
  const escapedBody = escapeHtml(body).replace(/\n/g, "<br />");
  const signatureBlock = signature
    ? `<div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 13px; color: #6b7280;">${signature}</div>`
    : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 560px; margin: 0 auto; padding: 24px 16px;">
    <div style="background: white; border-radius: 8px; border: 1px solid #e5e7eb; overflow: hidden;">
      <div style="padding: 24px;">
        <p style="color: #6b7280; font-size: 13px; margin: 0 0 16px;">
          <strong style="color: #1f2937;">${escapeHtml(senderName)}</strong> replied:
        </p>
        <div style="color: #1f2937; font-size: 14px; line-height: 1.6;">
          ${escapedBody}
        </div>
        ${signatureBlock}
      </div>
    </div>
    <p style="color: #9ca3af; font-size: 11px; text-align: center; margin-top: 16px; line-height: 1.4;">
      Reply to this email to continue the conversation.
      <br />
      Powered by <span style="color: ${brandColor};">GudDesk</span>
    </p>
  </div>
</body>
</html>`.trim();
}

/**
 * Render the HTML email body for a CSAT survey sent via email.
 */
export function renderSurveyEmail({
  question,
  conversationId,
  appUrl,
}: {
  question: string;
  conversationId: string;
  appUrl: string;
}): string {
  const stars = [1, 2, 3, 4, 5]
    .map((n) => {
      const url = `${appUrl}/api/widget/surveys/respond?conversationId=${conversationId}&rating=${n}`;
      return `<a href="${url}" style="text-decoration: none; font-size: 28px; padding: 4px 6px; color: ${n <= 3 ? "#d1d5db" : brandColor};" title="${n} stars">★</a>`;
    })
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 480px; margin: 0 auto; padding: 24px 16px;">
    <div style="background: white; border-radius: 8px; border: 1px solid #e5e7eb; overflow: hidden; text-align: center; padding: 32px 24px;">
      <p style="color: #1f2937; font-size: 16px; font-weight: 600; margin: 0 0 8px;">
        ${escapeHtml(question)}
      </p>
      <p style="color: #6b7280; font-size: 13px; margin: 0 0 24px;">
        Click a star to rate your experience
      </p>
      <div style="margin: 0 auto;">
        ${stars}
      </div>
    </div>
    <p style="color: #9ca3af; font-size: 11px; text-align: center; margin-top: 16px;">
      Powered by <span style="color: ${brandColor};">GudDesk</span>
    </p>
  </div>
</body>
</html>`.trim();
}

// ── Helpers ──────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

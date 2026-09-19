/**
 * Email threading utilities.
 *
 * Generates Message-ID headers and builds In-Reply-To / References
 * headers for proper email threading in mail clients.
 */

import { prisma } from "@/lib/db";

const DOMAIN = "mail.guddesk.com";

/**
 * Generate an RFC 2822 Message-ID for a new outbound email.
 */
export function generateMessageId(
  conversationId: string,
  messageId: string,
): string {
  return `<msg-${messageId}@${DOMAIN}>`;
}

/**
 * Generate the initial Message-ID for a conversation thread.
 * Used as the root of the email thread.
 */
export function generateThreadId(conversationId: string): string {
  return `<thread-${conversationId}@${DOMAIN}>`;
}

/**
 * Build In-Reply-To and References headers for an outbound email.
 *
 * Queries previous messages in the conversation that have emailMessageId
 * set, and builds the appropriate headers for email threading.
 */
export async function buildReplyHeaders(
  conversationId: string,
): Promise<{
  inReplyTo: string | undefined;
  references: string | undefined;
}> {
  // Get previous messages with email IDs, ordered chronologically
  const previousMessages = await prisma.message.findMany({
    where: {
      conversationId,
      emailMessageId: { not: null },
    },
    select: { emailMessageId: true },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  if (previousMessages.length === 0) {
    // First email in thread — use the thread ID as reference
    const threadId = generateThreadId(conversationId);
    return {
      inReplyTo: threadId,
      references: threadId,
    };
  }

  const messageIds = previousMessages
    .map((m) => m.emailMessageId!)
    .filter(Boolean);

  // In-Reply-To: the most recent message
  const inReplyTo = messageIds[messageIds.length - 1];

  // References: thread root + all previous (up to a reasonable limit)
  const threadId = generateThreadId(conversationId);
  const references = [threadId, ...messageIds.slice(-10)].join(" ");

  return { inReplyTo, references };
}

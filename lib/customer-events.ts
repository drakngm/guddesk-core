import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Track a customer event for the activity timeline.
 *
 * This is a fire-and-forget operation — errors are logged but not thrown
 * to avoid breaking the parent operation.
 *
 * @param workspaceId - The workspace the customer belongs to
 * @param visitorId - The customer (visitor) ID
 * @param type - Event type identifier (e.g. "conversation.created", "customer.updated")
 * @param title - Human-readable summary (e.g. "Started a conversation")
 * @param metadata - Optional extra data (e.g. { conversationId, oldValue, newValue })
 */
export async function trackCustomerEvent(
  workspaceId: string,
  visitorId: string,
  type: string,
  title: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.customerEvent.create({
      data: {
        workspaceId,
        visitorId,
        type,
        title,
        metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
      },
    });
  } catch (error) {
    console.error("Track customer event error:", error);
  }
}

/**
 * Event type constants for consistency.
 */
export const EVENT_TYPES = {
  // Customer lifecycle
  CUSTOMER_IDENTIFIED: "customer.identified",
  CUSTOMER_UPDATED: "customer.updated",

  // Company
  COMPANY_ASSIGNED: "company.assigned",
  COMPANY_REMOVED: "company.removed",

  // Conversations
  CONVERSATION_CREATED: "conversation.created",
  CONVERSATION_CLOSED: "conversation.closed",
  CONVERSATION_REOPENED: "conversation.reopened",

  // Messages
  MESSAGE_SENT: "message.sent",
  MESSAGE_RECEIVED: "message.received",
} as const;

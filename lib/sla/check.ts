/**
 * SLA breach detection.
 *
 * Called by the cron job to find conversations that have breached
 * their SLA deadlines and haven't been marked as breached yet.
 */

import { prisma } from "@/lib/db";

export interface SlaBreach {
  conversationId: string;
  workspaceId: string;
  assigneeId: string | null;
  visitorId: string;
  breachType: "first_response" | "resolution";
  dueAt: Date;
  subject: string | null;
}

/**
 * Find all SLA breaches across all workspaces (or a specific workspace).
 *
 * A breach is detected when:
 *   - First response: firstResponseDueAt < now AND firstResponseAt IS NULL
 *   - Resolution: resolutionDueAt < now AND status is NOT CLOSED
 *
 * Only conversations without a slaBreachedAt are considered (to avoid
 * re-notifying on already-breached conversations).
 */
export async function checkSlaBreaches(
  workspaceId?: string,
): Promise<SlaBreach[]> {
  const now = new Date();
  const breaches: SlaBreach[] = [];

  const whereBase = {
    ...(workspaceId ? { workspaceId } : {}),
    slaPolicyId: { not: null as string | null },
    slaBreachedAt: null,
  };

  // First response breaches
  const firstResponseBreaches = await prisma.conversation.findMany({
    where: {
      ...whereBase,
      firstResponseDueAt: { lt: now },
      firstResponseAt: null,
      status: { not: "CLOSED" },
    },
    select: {
      id: true,
      workspaceId: true,
      assigneeId: true,
      visitorId: true,
      firstResponseDueAt: true,
      subject: true,
    },
    take: 100, // process in batches
  });

  for (const c of firstResponseBreaches) {
    breaches.push({
      conversationId: c.id,
      workspaceId: c.workspaceId,
      assigneeId: c.assigneeId,
      visitorId: c.visitorId,
      breachType: "first_response",
      dueAt: c.firstResponseDueAt!,
      subject: c.subject,
    });
  }

  // Resolution breaches
  const resolutionBreaches = await prisma.conversation.findMany({
    where: {
      ...whereBase,
      resolutionDueAt: { lt: now },
      status: { not: "CLOSED" },
    },
    select: {
      id: true,
      workspaceId: true,
      assigneeId: true,
      visitorId: true,
      resolutionDueAt: true,
      subject: true,
    },
    take: 100,
  });

  for (const c of resolutionBreaches) {
    // Avoid duplicate if already in first_response list
    if (!breaches.find((b) => b.conversationId === c.id)) {
      breaches.push({
        conversationId: c.id,
        workspaceId: c.workspaceId,
        assigneeId: c.assigneeId,
        visitorId: c.visitorId,
        breachType: "resolution",
        dueAt: c.resolutionDueAt!,
        subject: c.subject,
      });
    }
  }

  return breaches;
}

/**
 * Mark a conversation as breached (prevents re-notification).
 */
export async function markAsBreached(conversationId: string): Promise<void> {
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { slaBreachedAt: new Date() },
  });
}

import { prisma } from "@/lib/db";

/**
 * Generate daily performance snapshots for each agent in a workspace.
 */
export async function generateAgentSnapshots(
  workspaceId: string,
  date: Date,
) {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    select: { id: true, userId: true },
  });

  for (const member of members) {
    // Count conversations where this agent sent at least one message that day
    const conversations = await prisma.conversation.findMany({
      where: {
        workspaceId,
        assigneeId: member.id,
        messages: {
          some: {
            senderId: member.userId,
            type: { in: ["AGENT", "NOTE"] },
            createdAt: { gte: dayStart, lte: dayEnd },
          },
        },
      },
      select: { id: true, firstResponseAt: true, closedAt: true, createdAt: true },
    });

    // Count messages sent by this agent
    const messagesCount = await prisma.message.count({
      where: {
        conversation: { workspaceId },
        senderId: member.userId,
        type: { in: ["AGENT"] },
        createdAt: { gte: dayStart, lte: dayEnd },
      },
    });

    // Average first response time for conversations assigned to this agent closed today
    const closedConvs = await prisma.conversation.findMany({
      where: {
        workspaceId,
        assigneeId: member.id,
        closedAt: { gte: dayStart, lte: dayEnd },
        firstResponseAt: { not: null },
      },
      select: { createdAt: true, firstResponseAt: true, closedAt: true },
    });

    let avgFirstResponseMs: number | null = null;
    let avgResolutionMs: number | null = null;

    if (closedConvs.length > 0) {
      const firstResponseTimes = closedConvs
        .filter((c) => c.firstResponseAt)
        .map((c) => c.firstResponseAt!.getTime() - c.createdAt.getTime());

      if (firstResponseTimes.length > 0) {
        avgFirstResponseMs = Math.round(
          firstResponseTimes.reduce((a, b) => a + b, 0) / firstResponseTimes.length,
        );
      }

      const resolutionTimes = closedConvs
        .filter((c) => c.closedAt)
        .map((c) => c.closedAt!.getTime() - c.createdAt.getTime());

      if (resolutionTimes.length > 0) {
        avgResolutionMs = Math.round(
          resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length,
        );
      }
    }

    // CSAT for this agent
    const csatResponses = await prisma.surveyResponse.findMany({
      where: {
        workspaceId,
        assigneeId: member.id,
        type: "CSAT",
        respondedAt: { gte: dayStart, lte: dayEnd },
      },
      select: { rating: true },
    });

    const csatAverage =
      csatResponses.length > 0
        ? csatResponses.reduce((sum, r) => sum + r.rating, 0) / csatResponses.length
        : null;

    await prisma.agentPerformanceSnapshot.upsert({
      where: { memberId_date: { memberId: member.id, date: dayStart } },
      create: {
        workspaceId,
        memberId: member.id,
        date: dayStart,
        conversationsHandled: conversations.length,
        messagesCount,
        avgFirstResponseMs,
        avgResolutionMs,
        csatAverage,
        csatCount: csatResponses.length,
      },
      update: {
        conversationsHandled: conversations.length,
        messagesCount,
        avgFirstResponseMs,
        avgResolutionMs,
        csatAverage,
        csatCount: csatResponses.length,
      },
    });
  }
}

export interface AgentPerformanceData {
  members: AgentMetrics[];
  totals: {
    conversationsHandled: number;
    messagesCount: number;
    avgFirstResponseMs: number | null;
    avgResolutionMs: number | null;
  };
}

export interface AgentMetrics {
  memberId: string;
  name: string;
  image: string | null;
  conversationsHandled: number;
  messagesCount: number;
  avgFirstResponseMs: number | null;
  avgResolutionMs: number | null;
  csatAverage: number | null;
  csatCount: number;
}

/**
 * Get aggregated agent performance data for the past N days.
 */
export async function getAgentPerformanceData(
  workspaceId: string,
  days = 30,
): Promise<AgentPerformanceData> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const snapshots = await prisma.agentPerformanceSnapshot.findMany({
    where: { workspaceId, date: { gte: since } },
  });

  // Group by member
  const memberMap = new Map<string, typeof snapshots>();
  for (const snap of snapshots) {
    const existing = memberMap.get(snap.memberId) ?? [];
    existing.push(snap);
    memberMap.set(snap.memberId, existing);
  }

  // Resolve member names
  const memberIds = [...memberMap.keys()];
  const membersDb = await prisma.workspaceMember.findMany({
    where: { id: { in: memberIds } },
    include: { user: { select: { name: true, image: true } } },
  });

  const memberLookup = new Map(membersDb.map((m) => [m.id, m]));

  const members: AgentMetrics[] = [];
  let totalConv = 0;
  let totalMsg = 0;
  const allResponseTimes: number[] = [];
  const allResolutionTimes: number[] = [];

  for (const [memberId, snaps] of memberMap) {
    const member = memberLookup.get(memberId);
    const convs = snaps.reduce((s, r) => s + r.conversationsHandled, 0);
    const msgs = snaps.reduce((s, r) => s + r.messagesCount, 0);

    const responseTimes = snaps.filter((s) => s.avgFirstResponseMs).map((s) => s.avgFirstResponseMs!);
    const resolutionTimes = snaps.filter((s) => s.avgResolutionMs).map((s) => s.avgResolutionMs!);
    const csatRatings = snaps.filter((s) => s.csatAverage && s.csatCount > 0);
    const totalCsatCount = snaps.reduce((s, r) => s + r.csatCount, 0);

    const avgFR = responseTimes.length > 0
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : null;
    const avgRes = resolutionTimes.length > 0
      ? Math.round(resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length)
      : null;
    const csatAvg = csatRatings.length > 0
      ? csatRatings.reduce((s, r) => s + (r.csatAverage! * r.csatCount), 0) /
        totalCsatCount
      : null;

    totalConv += convs;
    totalMsg += msgs;
    if (avgFR) allResponseTimes.push(avgFR);
    if (avgRes) allResolutionTimes.push(avgRes);

    members.push({
      memberId,
      name: member?.user.name ?? "Unknown",
      image: member?.user.image ?? null,
      conversationsHandled: convs,
      messagesCount: msgs,
      avgFirstResponseMs: avgFR,
      avgResolutionMs: avgRes,
      csatAverage: csatAvg ? Math.round(csatAvg * 10) / 10 : null,
      csatCount: totalCsatCount,
    });
  }

  // Sort by conversations handled desc
  members.sort((a, b) => b.conversationsHandled - a.conversationsHandled);

  return {
    members,
    totals: {
      conversationsHandled: totalConv,
      messagesCount: totalMsg,
      avgFirstResponseMs: allResponseTimes.length > 0
        ? Math.round(allResponseTimes.reduce((a, b) => a + b, 0) / allResponseTimes.length)
        : null,
      avgResolutionMs: allResolutionTimes.length > 0
        ? Math.round(allResolutionTimes.reduce((a, b) => a + b, 0) / allResolutionTimes.length)
        : null,
    },
  };
}

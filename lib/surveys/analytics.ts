/**
 * Survey analytics aggregation.
 */

import { prisma } from "@/lib/db";

interface DateRange {
  from: Date;
  to: Date;
}

export interface CsatAnalytics {
  averageScore: number | null;
  totalResponses: number;
  distribution: { rating: number; count: number }[];
  trend: { date: string; avgScore: number; count: number }[];
  perAgent: { assigneeId: string; agentName: string; avgScore: number; count: number }[];
  recentResponses: {
    id: string;
    rating: number;
    comment: string | null;
    conversationId: string | null;
    respondedAt: Date;
  }[];
}

export interface NpsAnalytics {
  npsScore: number | null; // -100 to 100
  totalResponses: number;
  promoters: number; // 9-10
  passives: number; // 7-8
  detractors: number; // 0-6
  trend: { date: string; npsScore: number; count: number }[];
}

/**
 * Get CSAT analytics for a workspace within a date range.
 */
export async function getCsatAnalytics(
  workspaceId: string,
  range: DateRange,
): Promise<CsatAnalytics> {
  const where = {
    workspaceId,
    type: "CSAT" as const,
    respondedAt: { gte: range.from, lte: range.to },
  };

  // Average score
  const aggregate = await prisma.surveyResponse.aggregate({
    where,
    _avg: { rating: true },
    _count: { id: true },
  });

  // Distribution (1-5)
  const responses = await prisma.surveyResponse.findMany({
    where,
    select: { rating: true },
  });

  const distribution = [1, 2, 3, 4, 5].map((rating) => ({
    rating,
    count: responses.filter((r) => r.rating === rating).length,
  }));

  // Per-agent breakdown
  const agentGroups = await prisma.surveyResponse.groupBy({
    by: ["assigneeId"],
    where: { ...where, assigneeId: { not: null } },
    _avg: { rating: true },
    _count: { id: true },
  });

  // Fetch agent names
  const agentIds = agentGroups
    .map((g) => g.assigneeId)
    .filter(Boolean) as string[];

  const members = agentIds.length > 0
    ? await prisma.workspaceMember.findMany({
        where: { id: { in: agentIds } },
        include: { user: { select: { name: true } } },
      })
    : [];

  const memberMap = new Map(members.map((m) => [m.id, m.user.name ?? "Agent"]));

  const perAgent = agentGroups.map((g) => ({
    assigneeId: g.assigneeId!,
    agentName: memberMap.get(g.assigneeId!) ?? "Unknown",
    avgScore: g._avg.rating ?? 0,
    count: g._count.id,
  }));

  // Recent responses
  const recentResponses = await prisma.surveyResponse.findMany({
    where,
    orderBy: { respondedAt: "desc" },
    take: 20,
    select: {
      id: true,
      rating: true,
      comment: true,
      conversationId: true,
      respondedAt: true,
    },
  });

  // Trend (daily averages) — simple approach with raw query data
  const allResponses = await prisma.surveyResponse.findMany({
    where,
    select: { rating: true, respondedAt: true },
    orderBy: { respondedAt: "asc" },
  });

  const trendMap = new Map<string, { total: number; count: number }>();
  for (const r of allResponses) {
    const date = r.respondedAt.toISOString().split("T")[0];
    const entry = trendMap.get(date) ?? { total: 0, count: 0 };
    entry.total += r.rating;
    entry.count += 1;
    trendMap.set(date, entry);
  }

  const trend = Array.from(trendMap.entries()).map(([date, { total, count }]) => ({
    date,
    avgScore: Math.round((total / count) * 10) / 10,
    count,
  }));

  return {
    averageScore: aggregate._avg.rating
      ? Math.round(aggregate._avg.rating * 10) / 10
      : null,
    totalResponses: aggregate._count.id,
    distribution,
    trend,
    perAgent,
    recentResponses,
  };
}

/**
 * Get NPS analytics for a workspace within a date range.
 */
export async function getNpsAnalytics(
  workspaceId: string,
  range: DateRange,
): Promise<NpsAnalytics> {
  const where = {
    workspaceId,
    type: "NPS" as const,
    respondedAt: { gte: range.from, lte: range.to },
  };

  const responses = await prisma.surveyResponse.findMany({
    where,
    select: { rating: true, respondedAt: true },
  });

  const promoters = responses.filter((r) => r.rating >= 9).length;
  const passives = responses.filter((r) => r.rating >= 7 && r.rating <= 8).length;
  const detractors = responses.filter((r) => r.rating <= 6).length;
  const total = responses.length;

  const npsScore =
    total > 0
      ? Math.round(((promoters - detractors) / total) * 100)
      : null;

  // Trend
  const trendMap = new Map<string, { promoters: number; detractors: number; total: number }>();
  for (const r of responses) {
    const date = r.respondedAt.toISOString().split("T")[0];
    const entry = trendMap.get(date) ?? { promoters: 0, detractors: 0, total: 0 };
    entry.total += 1;
    if (r.rating >= 9) entry.promoters += 1;
    else if (r.rating <= 6) entry.detractors += 1;
    trendMap.set(date, entry);
  }

  const trend = Array.from(trendMap.entries()).map(([date, { promoters: p, detractors: d, total: t }]) => ({
    date,
    npsScore: t > 0 ? Math.round(((p - d) / t) * 100) : 0,
    count: t,
  }));

  return {
    npsScore,
    totalResponses: total,
    promoters,
    passives,
    detractors,
    trend,
  };
}

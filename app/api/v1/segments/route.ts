import { NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import {
  withApiAuth,
  withHeaders,
  apiOk,
  apiError,
  parsePagination,
  prismaPagination,
  buildPaginationResult,
} from "@/lib/api-utils";

// ---------------------------------------------------------------------------
// GET /api/v1/segments  —  List customer segments
// Requires: READ_ONLY or higher
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const result = await withApiAuth(req, { permission: "READ_ONLY" });
  if (!result.ok) return result.response;
  const { ctx, rateLimitHeaders } = result;

  try {
    const pagination = parsePagination(req);

    const where = { workspaceId: ctx.workspaceId };

    const [segments, total] = await Promise.all([
      prisma.customerSegment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        ...prismaPagination(pagination),
      }),
      prisma.customerSegment.count({ where }),
    ]);

    const { items, meta } = buildPaginationResult(segments, pagination, total);

    return withHeaders(apiOk(items, meta), rateLimitHeaders);
  } catch (error) {
    console.error("List segments error:", error);
    return withHeaders(apiError("Failed to list segments", 500), rateLimitHeaders);
  }
}

// ---------------------------------------------------------------------------
// POST /api/v1/segments  —  Create a segment
// Body: { name, description?, conditions, color? }
// Requires: READ_WRITE or higher
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const result = await withApiAuth(req, { permission: "READ_WRITE" });
  if (!result.ok) return result.response;
  const { ctx, rateLimitHeaders } = result;

  try {
    const body = await req.json();
    const { name, description, conditions, color } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return withHeaders(apiError("name is required", 400), rateLimitHeaders);
    }

    if (!conditions || !Array.isArray(conditions) || conditions.length === 0) {
      return withHeaders(
        apiError("conditions is required and must be a non-empty array", 400),
        rateLimitHeaders,
      );
    }

    const segment = await prisma.customerSegment.create({
      data: {
        workspaceId: ctx.workspaceId,
        name: name.trim(),
        description: typeof description === "string" ? description.trim() : null,
        conditions,
        color: typeof color === "string" ? color : null,
      },
    });

    return withHeaders(apiOk(segment, undefined, 201), rateLimitHeaders);
  } catch (error) {
    console.error("Create segment error:", error);
    return withHeaders(apiError("Failed to create segment", 500), rateLimitHeaders);
  }
}

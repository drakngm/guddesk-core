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
// GET /api/v1/customers/:customerId/events  —  List customer timeline events
// Query: ?limit=&cursor=&type=
// Requires: READ_ONLY or higher
// ---------------------------------------------------------------------------
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ customerId: string }> },
) {
  const { customerId } = await params;

  const result = await withApiAuth(req, { permission: "READ_ONLY" });
  if (!result.ok) return result.response;
  const { ctx, rateLimitHeaders } = result;

  try {
    // Verify customer belongs to this workspace
    const customer = await prisma.visitor.findUnique({
      where: { id: customerId },
      select: { workspaceId: true },
    });

    if (!customer || customer.workspaceId !== ctx.workspaceId) {
      return withHeaders(apiError("Customer not found", 404), rateLimitHeaders);
    }

    const typeFilter = req.nextUrl.searchParams.get("type");
    const where: Record<string, unknown> = {
      visitorId: customerId,
      workspaceId: ctx.workspaceId,
    };
    if (typeFilter) where.type = typeFilter;

    const pagination = parsePagination(req);

    const [events, total] = await Promise.all([
      prisma.customerEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        ...prismaPagination(pagination),
      }),
      prisma.customerEvent.count({ where }),
    ]);

    const { items, meta } = buildPaginationResult(events, pagination, total);

    return withHeaders(apiOk(items, meta), rateLimitHeaders);
  } catch (error) {
    console.error("List customer events error:", error);
    return withHeaders(apiError("Failed to list events", 500), rateLimitHeaders);
  }
}

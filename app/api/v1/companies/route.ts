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
// GET /api/v1/companies  —  List companies
// Query: ?workspaceId=&domain=&limit=&cursor=
// Requires: READ_ONLY or higher
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const result = await withApiAuth(req, { permission: "READ_ONLY" });
  if (!result.ok) return result.response;
  const { ctx, rateLimitHeaders } = result;

  try {
    const params = req.nextUrl.searchParams;
    const domain = params.get("domain");

    const where: Record<string, unknown> = { workspaceId: ctx.workspaceId };
    if (domain) where.domain = domain;

    const pagination = parsePagination(req);

    const [companies, total] = await Promise.all([
      prisma.company.findMany({
        where,
        select: {
          id: true,
          name: true,
          domain: true,
          website: true,
          logoUrl: true,
          industry: true,
          metadata: true,
          createdAt: true,
          _count: { select: { visitors: true } },
        },
        orderBy: { createdAt: "desc" },
        ...prismaPagination(pagination),
      }),
      prisma.company.count({ where }),
    ]);

    const { items, meta } = buildPaginationResult(companies, pagination, total);

    return withHeaders(apiOk(items, meta), rateLimitHeaders);
  } catch (error) {
    console.error("List companies error:", error);
    return withHeaders(apiError("Failed to list companies", 500), rateLimitHeaders);
  }
}

// ---------------------------------------------------------------------------
// POST /api/v1/companies  —  Create a company
// Body: { name, domain?, website?, logoUrl?, industry?, metadata? }
// Requires: READ_WRITE or higher
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const result = await withApiAuth(req, { permission: "READ_WRITE" });
  if (!result.ok) return result.response;
  const { ctx, rateLimitHeaders } = result;

  try {
    const body = await req.json();
    const { name, domain, website, logoUrl, industry, metadata } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return withHeaders(
        apiError("name is required", 400),
        rateLimitHeaders,
      );
    }

    const company = await prisma.company.create({
      data: {
        workspaceId: ctx.workspaceId,
        name: name.trim(),
        domain: typeof domain === "string" ? domain.trim().toLowerCase() : null,
        website: typeof website === "string" ? website.trim() : null,
        logoUrl: typeof logoUrl === "string" ? logoUrl.trim() : null,
        industry: typeof industry === "string" ? industry.trim() : null,
        metadata: metadata ?? null,
      },
      select: {
        id: true,
        name: true,
        domain: true,
        website: true,
        logoUrl: true,
        industry: true,
        metadata: true,
        createdAt: true,
      },
    });

    return withHeaders(apiOk(company, undefined, 201), rateLimitHeaders);
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.message.includes("Unique constraint")
    ) {
      return withHeaders(
        apiError("A company with this domain already exists in this workspace", 409),
        rateLimitHeaders,
      );
    }
    console.error("Create company error:", error);
    return withHeaders(apiError("Failed to create company", 500), rateLimitHeaders);
  }
}

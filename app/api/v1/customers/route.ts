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
// GET /api/v1/customers  —  List customers (visitors)
// Query: ?workspaceId=&email=&limit=&cursor=
// Requires: READ_ONLY or higher
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const result = await withApiAuth(req, { permission: "READ_ONLY" });
  if (!result.ok) return result.response;
  const { ctx, rateLimitHeaders } = result;

  try {
    const params = req.nextUrl.searchParams;
    const email = params.get("email");

    const where: Record<string, unknown> = { workspaceId: ctx.workspaceId };
    if (email) where.email = email;

    const pagination = parsePagination(req);

    const [customers, total] = await Promise.all([
      prisma.visitor.findMany({
        where,
        select: {
          id: true,
          externalId: true,
          name: true,
          email: true,
          avatarUrl: true,
          metadata: true,
          lastSeenAt: true,
          createdAt: true,
          _count: { select: { conversations: true } },
        },
        orderBy: { createdAt: "desc" },
        ...prismaPagination(pagination),
      }),
      prisma.visitor.count({ where }),
    ]);

    const { items, meta } = buildPaginationResult(customers, pagination, total);

    return withHeaders(apiOk(items, meta), rateLimitHeaders);
  } catch (error) {
    console.error("List customers error:", error);
    return withHeaders(apiError("Failed to list customers", 500), rateLimitHeaders);
  }
}

// ---------------------------------------------------------------------------
// POST /api/v1/customers  —  Create or update a customer (visitor)
// Body: { externalId?, name?, email?, avatarUrl?, metadata? }
// If externalId is provided and exists, updates the existing record.
// Requires: READ_WRITE or higher
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const result = await withApiAuth(req, { permission: "READ_WRITE" });
  if (!result.ok) return result.response;
  const { ctx, rateLimitHeaders } = result;

  try {
    const body = await req.json();
    const { externalId, name, email, avatarUrl, metadata } = body;

    // Must have at least a name or email
    if (!name && !email && !externalId) {
      return withHeaders(
        apiError("At least one of name, email, or externalId is required", 400),
        rateLimitHeaders,
      );
    }

    // Upsert by externalId if provided
    if (externalId && typeof externalId === "string") {
      const customer = await prisma.visitor.upsert({
        where: {
          workspaceId_externalId: {
            workspaceId: ctx.workspaceId,
            externalId,
          },
        },
        create: {
          workspaceId: ctx.workspaceId,
          externalId,
          name: typeof name === "string" ? name.trim() : null,
          email: typeof email === "string" ? email.trim().toLowerCase() : null,
          avatarUrl: typeof avatarUrl === "string" ? avatarUrl : null,
          metadata: metadata ?? null,
        },
        update: {
          ...(name !== undefined && { name: typeof name === "string" ? name.trim() : null }),
          ...(email !== undefined && {
            email: typeof email === "string" ? email.trim().toLowerCase() : null,
          }),
          ...(avatarUrl !== undefined && { avatarUrl: typeof avatarUrl === "string" ? avatarUrl : null }),
          ...(metadata !== undefined && { metadata }),
        },
        select: {
          id: true,
          externalId: true,
          name: true,
          email: true,
          avatarUrl: true,
          metadata: true,
          lastSeenAt: true,
          createdAt: true,
        },
      });

      return withHeaders(apiOk(customer), rateLimitHeaders);
    }

    // Create a new visitor
    const customer = await prisma.visitor.create({
      data: {
        workspaceId: ctx.workspaceId,
        externalId: null,
        name: typeof name === "string" ? name.trim() : null,
        email: typeof email === "string" ? email.trim().toLowerCase() : null,
        avatarUrl: typeof avatarUrl === "string" ? avatarUrl : null,
        metadata: metadata ?? null,
      },
      select: {
        id: true,
        externalId: true,
        name: true,
        email: true,
        avatarUrl: true,
        metadata: true,
        createdAt: true,
      },
    });

    return withHeaders(apiOk(customer, undefined, 201), rateLimitHeaders);
  } catch (error) {
    console.error("Create/update customer error:", error);
    return withHeaders(apiError("Failed to create/update customer", 500), rateLimitHeaders);
  }
}

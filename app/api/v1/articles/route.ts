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
// GET /api/v1/articles  —  List articles
// Query: ?workspaceId=&collectionId=&published=true|false&limit=&cursor=
// Requires: READ_ONLY or higher
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const result = await withApiAuth(req, { permission: "READ_ONLY" });
  if (!result.ok) return result.response;
  const { ctx, rateLimitHeaders } = result;

  try {
    const params = req.nextUrl.searchParams;
    const collectionId = params.get("collectionId");
    const published = params.get("published");

    const where: Record<string, unknown> = { workspaceId: ctx.workspaceId };
    if (collectionId) where.collectionId = collectionId;
    if (published === "true") where.isPublished = true;
    if (published === "false") where.isPublished = false;

    const pagination = parsePagination(req);

    const [articles, total] = await Promise.all([
      prisma.article.findMany({
        where,
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          isPublished: true,
          publishedAt: true,
          viewCount: true,
          helpfulCount: true,
          notHelpfulCount: true,
          createdAt: true,
          updatedAt: true,
          collection: {
            select: { id: true, name: true, slug: true },
          },
          author: {
            select: { id: true, name: true, image: true },
          },
        },
        orderBy: { updatedAt: "desc" },
        ...prismaPagination(pagination),
      }),
      prisma.article.count({ where }),
    ]);

    const { items, meta } = buildPaginationResult(articles, pagination, total);

    return withHeaders(apiOk(items, meta), rateLimitHeaders);
  } catch (error) {
    console.error("List articles error:", error);
    return withHeaders(apiError("Failed to list articles", 500), rateLimitHeaders);
  }
}

// ---------------------------------------------------------------------------
// POST /api/v1/articles  —  Create an article
// Body: { title, slug?, body, excerpt?, collectionId?, isPublished? }
// Requires: READ_WRITE or higher
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const result = await withApiAuth(req, { permission: "READ_WRITE" });
  if (!result.ok) return result.response;
  const { ctx, rateLimitHeaders } = result;

  try {
    const reqBody = await req.json();
    const { title, slug, body, excerpt, collectionId, isPublished } = reqBody;

    if (!title || typeof title !== "string" || !title.trim()) {
      return withHeaders(apiError("title is required", 400), rateLimitHeaders);
    }

    if (!body || typeof body !== "string" || !body.trim()) {
      return withHeaders(apiError("body is required", 400), rateLimitHeaders);
    }

    // Generate slug from title if not provided
    const articleSlug =
      typeof slug === "string" && slug.trim()
        ? slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-")
        : title
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");

    // Check slug uniqueness within workspace
    const existing = await prisma.article.findUnique({
      where: {
        workspaceId_slug: {
          workspaceId: ctx.workspaceId,
          slug: articleSlug,
        },
      },
      select: { id: true },
    });

    if (existing) {
      return withHeaders(
        apiError("An article with this slug already exists in this workspace", 409),
        rateLimitHeaders,
      );
    }

    // If collectionId provided, verify it belongs to this workspace
    if (collectionId) {
      const collection = await prisma.collection.findUnique({
        where: { id: collectionId },
        select: { workspaceId: true },
      });
      if (!collection || collection.workspaceId !== ctx.workspaceId) {
        return withHeaders(apiError("Collection not found", 404), rateLimitHeaders);
      }
    }

    const shouldPublish = isPublished === true;

    const article = await prisma.article.create({
      data: {
        workspaceId: ctx.workspaceId,
        title: title.trim(),
        slug: articleSlug,
        body: body.trim(),
        excerpt: typeof excerpt === "string" ? excerpt.trim() : null,
        collectionId: collectionId || null,
        isPublished: shouldPublish,
        publishedAt: shouldPublish ? new Date() : null,
        authorId: ctx.auth.userId,
      },
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        isPublished: true,
        publishedAt: true,
        createdAt: true,
        collection: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    return withHeaders(apiOk(article, undefined, 201), rateLimitHeaders);
  } catch (error) {
    console.error("Create article error:", error);
    return withHeaders(apiError("Failed to create article", 500), rateLimitHeaders);
  }
}

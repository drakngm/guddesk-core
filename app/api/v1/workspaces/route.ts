import { NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import {
  authenticateApiKey,
  hasPermission,
} from "@/lib/api-auth";
import { apiOk, apiError, checkRateLimit, withHeaders } from "@/lib/api-utils";

// ---------------------------------------------------------------------------
// GET /api/v1/workspaces  —  List workspaces the API key owner belongs to
// Requires: READ_ONLY or higher
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const authContext = await authenticateApiKey(req);
  if (!authContext) {
    return apiError(
      "Invalid API key. Pass it as Authorization: Bearer <key> or x-api-key header.",
      401,
    );
  }

  if (!hasPermission(authContext, "READ_ONLY")) {
    return apiError("Insufficient permissions", 403);
  }

  const rateResult = await checkRateLimit(authContext.apiKeyId, authContext.userId);
  if (!rateResult.allowed) return rateResult.response;

  try {
    // If the key is scoped to a single workspace, only return that one
    if (authContext.workspaceId) {
      const workspace = await prisma.workspace.findUnique({
        where: { id: authContext.workspaceId },
        select: {
          id: true,
          name: true,
          slug: true,
          logo: true,
          plan: true,
          createdAt: true,
        },
      });

      return withHeaders(apiOk(workspace ? [workspace] : []), rateResult.headers);
    }

    // Key has access to all workspaces — list all user memberships
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: authContext.userId },
      select: {
        role: true,
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
            plan: true,
            createdAt: true,
          },
        },
      },
      orderBy: { workspace: { name: "asc" } },
    });

    const workspaces = memberships.map((m) => ({
      ...m.workspace,
      role: m.role,
    }));

    return withHeaders(apiOk(workspaces), rateResult.headers);
  } catch (error) {
    console.error("List workspaces error:", error);
    return withHeaders(apiError("Failed to list workspaces", 500), rateResult.headers);
  }
}

// ---------------------------------------------------------------------------
// POST /api/v1/workspaces  —  Create a new workspace
// Requires: FULL_ACCESS + key must be "all workspaces" scoped
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const authContext = await authenticateApiKey(req);
  if (!authContext) {
    return apiError(
      "Invalid API key. Pass it as Authorization: Bearer <key> or x-api-key header.",
      401,
    );
  }

  if (!hasPermission(authContext, "FULL_ACCESS")) {
    return apiError("This API key does not have full access permissions", 403);
  }

  const rateResult = await checkRateLimit(authContext.apiKeyId, authContext.userId);
  if (!rateResult.allowed) return rateResult.response;

  // Only "all workspaces" keys can create new workspaces
  if (authContext.workspaceId) {
    return withHeaders(
      apiError(
        "Workspace-scoped API keys cannot create new workspaces. Use an 'All Workspaces' key.",
        403,
      ),
      rateResult.headers,
    );
  }

  try {
    const body = await req.json();
    const { name, slug } = body;

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return withHeaders(apiError("name is required (min 2 characters)", 400), rateResult.headers);
    }

    if (!slug || typeof slug !== "string" || !/^[a-z0-9-]+$/.test(slug)) {
      return withHeaders(
        apiError(
          "slug is required and must contain only lowercase letters, numbers, and hyphens",
          400,
        ),
        rateResult.headers,
      );
    }

    // Check slug availability
    const existing = await prisma.workspace.findUnique({ where: { slug } });
    if (existing) {
      return withHeaders(apiError("This slug is already taken", 409), rateResult.headers);
    }

    // Create workspace with the API key owner as OWNER
    const workspace = await prisma.workspace.create({
      data: {
        name: name.trim(),
        slug,
        members: {
          create: {
            userId: authContext.userId,
            role: "OWNER",
          },
        },
        widgetSettings: {
          create: {
            workspaceName: name.trim(),
          },
        },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        createdAt: true,
      },
    });

    return withHeaders(apiOk(workspace, undefined, 201), rateResult.headers);
  } catch (error) {
    console.error("Create workspace error:", error);
    return withHeaders(apiError("Failed to create workspace", 500), rateResult.headers);
  }
}

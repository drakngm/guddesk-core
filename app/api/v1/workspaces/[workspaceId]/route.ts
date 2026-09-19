import { NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { authenticateApiKey, hasPermission } from "@/lib/api-auth";
import { apiOk, apiError, checkRateLimit, withHeaders } from "@/lib/api-utils";

// ---------------------------------------------------------------------------
// GET /api/v1/workspaces/:workspaceId  —  Get workspace details
// Requires: READ_ONLY or higher
// ---------------------------------------------------------------------------
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;
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
    // If key is scoped to a workspace, it must match
    if (authContext.workspaceId && authContext.workspaceId !== workspaceId) {
      return withHeaders(apiError("Workspace not found", 404), rateResult.headers);
    }

    // Verify user membership
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId: authContext.userId },
      },
      select: { role: true },
    });

    if (!membership) {
      return withHeaders(apiError("Workspace not found", 404), rateResult.headers);
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        plan: true,
        createdAt: true,
        _count: {
          select: {
            members: true,
            conversations: true,
            articles: true,
          },
        },
      },
    });

    if (!workspace) {
      return withHeaders(apiError("Workspace not found", 404), rateResult.headers);
    }

    return withHeaders(
      apiOk({ ...workspace, role: membership.role }),
      rateResult.headers,
    );
  } catch (error) {
    console.error("Get workspace error:", error);
    return withHeaders(apiError("Failed to get workspace", 500), rateResult.headers);
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/v1/workspaces/:workspaceId  —  Update workspace
// Requires: READ_WRITE or higher + OWNER or ADMIN role
// ---------------------------------------------------------------------------
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;
  const authContext = await authenticateApiKey(req);
  if (!authContext) {
    return apiError(
      "Invalid API key. Pass it as Authorization: Bearer <key> or x-api-key header.",
      401,
    );
  }

  if (!hasPermission(authContext, "READ_WRITE")) {
    return apiError("This API key does not have write permissions", 403);
  }

  const rateResult = await checkRateLimit(authContext.apiKeyId, authContext.userId);
  if (!rateResult.allowed) return rateResult.response;

  try {
    if (authContext.workspaceId && authContext.workspaceId !== workspaceId) {
      return withHeaders(apiError("Workspace not found", 404), rateResult.headers);
    }

    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId: authContext.userId },
      },
      select: { role: true },
    });

    if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
      return withHeaders(
        apiError("You must be an Owner or Admin to update this workspace", 403),
        rateResult.headers,
      );
    }

    const body = await req.json();
    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.trim().length < 2) {
        return withHeaders(apiError("name must be at least 2 characters", 400), rateResult.headers);
      }
      updateData.name = body.name.trim();
    }

    if (body.slug !== undefined) {
      if (typeof body.slug !== "string" || !/^[a-z0-9-]+$/.test(body.slug)) {
        return withHeaders(
          apiError("slug must contain only lowercase letters, numbers, and hyphens", 400),
          rateResult.headers,
        );
      }
      const existing = await prisma.workspace.findUnique({
        where: { slug: body.slug },
        select: { id: true },
      });
      if (existing && existing.id !== workspaceId) {
        return withHeaders(apiError("This slug is already taken", 409), rateResult.headers);
      }
      updateData.slug = body.slug;
    }

    if (body.logo !== undefined) {
      updateData.logo = body.logo;
    }

    if (Object.keys(updateData).length === 0) {
      return withHeaders(apiError("No fields to update", 400), rateResult.headers);
    }

    const workspace = await prisma.workspace.update({
      where: { id: workspaceId },
      data: updateData,
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        plan: true,
        createdAt: true,
      },
    });

    return withHeaders(apiOk(workspace), rateResult.headers);
  } catch (error) {
    console.error("Update workspace error:", error);
    return withHeaders(apiError("Failed to update workspace", 500), rateResult.headers);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/v1/workspaces/:workspaceId  —  Delete workspace
// Requires: FULL_ACCESS + must be OWNER
// ---------------------------------------------------------------------------
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;
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

  try {
    if (authContext.workspaceId && authContext.workspaceId !== workspaceId) {
      return withHeaders(apiError("Workspace not found", 404), rateResult.headers);
    }

    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId: authContext.userId },
      },
      select: { role: true },
    });

    if (!membership || membership.role !== "OWNER") {
      return withHeaders(
        apiError("Only the workspace owner can delete a workspace", 403),
        rateResult.headers,
      );
    }

    await prisma.workspace.delete({ where: { id: workspaceId } });

    return withHeaders(apiOk({ deleted: true }), rateResult.headers);
  } catch (error) {
    console.error("Delete workspace error:", error);
    return withHeaders(apiError("Failed to delete workspace", 500), rateResult.headers);
  }
}

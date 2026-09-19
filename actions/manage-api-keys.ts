"use server";

import { createHash, randomBytes } from "crypto";

import { ApiKeyPermission } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

function generateApiKey(): string {
  const token = randomBytes(32).toString("base64url");
  return `gd_${token}`;
}

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Create an API key for the authenticated user.
 * workspaceId is optional — null means "all workspaces".
 */
export async function createApiKey(data: {
  name: string;
  permission: ApiKeyPermission;
  workspaceId?: string | null;
  expiresAt?: string | null;
}) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { status: "error" as const, message: "Not authenticated" };
    }

    const { name, permission, workspaceId, expiresAt } = data;

    if (!name || name.trim().length === 0) {
      return { status: "error" as const, message: "Name is required" };
    }

    if (!["READ_ONLY", "READ_WRITE", "FULL_ACCESS"].includes(permission)) {
      return {
        status: "error" as const,
        message: "Invalid permission level",
      };
    }

    // If scoped to a workspace, verify the user is a member
    if (workspaceId) {
      const membership = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId: session.user.id,
          },
        },
      });
      if (!membership) {
        return {
          status: "error" as const,
          message: "You are not a member of this workspace",
        };
      }
    }

    // Enforce per-user limits based on best plan
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: session.user.id },
      select: { workspace: { select: { plan: true } } },
    });
    const hasPro = memberships.some((m) => m.workspace.plan === "PRO");
    const limit = hasPro ? 50 : 10;
    const currentCount = await prisma.apiKey.count({
      where: { userId: session.user.id },
    });
    if (currentCount >= limit) {
      return {
        status: "error" as const,
        message: `You've reached the maximum of ${limit} API keys for your plan`,
      };
    }

    const rawKey = generateApiKey();
    const keyHash = hashKey(rawKey);
    const keyPrefix = rawKey.slice(0, 8);

    const apiKey = await prisma.apiKey.create({
      data: {
        userId: session.user.id,
        workspaceId: workspaceId || null,
        name: name.trim(),
        keyHash,
        keyPrefix,
        permission,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    revalidatePath("/dashboard/settings/api-keys");
    return {
      status: "success" as const,
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        permission: apiKey.permission,
        rawKey,
      },
    };
  } catch (error) {
    console.error("Create API key error:", error);
    return { status: "error" as const, message: "Failed to create API key" };
  }
}

/**
 * Update an API key owned by the authenticated user.
 */
export async function updateApiKey(
  apiKeyId: string,
  data: {
    name?: string;
    permission?: ApiKeyPermission;
    isEnabled?: boolean;
    workspaceId?: string | null;
  },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { status: "error" as const, message: "Not authenticated" };
    }

    // Verify key belongs to the user
    const existing = await prisma.apiKey.findUnique({
      where: { id: apiKeyId },
      select: { userId: true },
    });

    if (!existing || existing.userId !== session.user.id) {
      return { status: "error" as const, message: "API key not found" };
    }

    // If updating workspace scope, verify membership
    if (data.workspaceId !== undefined && data.workspaceId !== null) {
      const membership = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: data.workspaceId,
            userId: session.user.id,
          },
        },
      });
      if (!membership) {
        return {
          status: "error" as const,
          message: "You are not a member of this workspace",
        };
      }
    }

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.permission !== undefined) updateData.permission = data.permission;
    if (data.isEnabled !== undefined) updateData.isEnabled = data.isEnabled;
    if (data.workspaceId !== undefined)
      updateData.workspaceId = data.workspaceId || null;

    await prisma.apiKey.update({
      where: { id: apiKeyId },
      data: updateData,
    });

    revalidatePath("/dashboard/settings/api-keys");
    return { status: "success" as const };
  } catch (error) {
    console.error("Update API key error:", error);
    return { status: "error" as const, message: "Failed to update API key" };
  }
}

/**
 * Delete an API key owned by the authenticated user.
 */
export async function deleteApiKey(apiKeyId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { status: "error" as const, message: "Not authenticated" };
    }

    // Verify key belongs to the user
    const existing = await prisma.apiKey.findUnique({
      where: { id: apiKeyId },
      select: { userId: true },
    });

    if (!existing || existing.userId !== session.user.id) {
      return { status: "error" as const, message: "API key not found" };
    }

    await prisma.apiKey.delete({ where: { id: apiKeyId } });

    revalidatePath("/dashboard/settings/api-keys");
    return { status: "success" as const };
  } catch (error) {
    console.error("Delete API key error:", error);
    return { status: "error" as const, message: "Failed to delete API key" };
  }
}

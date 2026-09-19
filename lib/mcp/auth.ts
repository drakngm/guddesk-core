/**
 * Standalone MCP auth adapter.
 *
 * Replicates the core logic from lib/api-auth.ts but without the "server-only"
 * import or NextRequest dependency, so it can be used from both the Next.js
 * HTTP route and the standalone stdio CLI.
 */

import { createHash } from "crypto";

import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface McpAuthContext {
  userId: string;
  workspaceId: string;
  permission: string;
  apiKeyId: string;
}

// ---------------------------------------------------------------------------
// Authenticate
// ---------------------------------------------------------------------------

/**
 * Authenticate an MCP connection using a raw API key string.
 *
 * The key must be workspace-scoped (MCP clients can't interactively select
 * a workspace, so account-level "all workspaces" keys are rejected).
 *
 * Returns the auth context or null if authentication fails.
 */
export async function authenticateMcp(
  rawKey: string,
): Promise<McpAuthContext | null> {
  if (!rawKey || !rawKey.startsWith("gd_")) return null;

  const hash = createHash("sha256").update(rawKey).digest("hex");

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash: hash },
    select: {
      id: true,
      userId: true,
      workspaceId: true,
      permission: true,
      isEnabled: true,
      expiresAt: true,
    },
  });

  if (!apiKey) return null;
  if (!apiKey.isEnabled) return null;
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;

  // MCP requires a workspace-scoped key
  if (!apiKey.workspaceId) return null;

  // Fire-and-forget: update lastUsedAt
  void prisma.apiKey
    .update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {});

  return {
    userId: apiKey.userId,
    workspaceId: apiKey.workspaceId,
    permission: apiKey.permission,
    apiKeyId: apiKey.id,
  };
}

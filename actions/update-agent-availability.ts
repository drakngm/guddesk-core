"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { safeTrigger } from "@/lib/pusher-server";
import { requireWorkspaceMember } from "@/lib/workspace";
import type { AgentAvailability } from "@prisma/client";

export async function updateAvailability(
  workspaceId: string,
  availability: AgentAvailability,
) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const membership = await requireWorkspaceMember(workspaceId, session.user.id);

    await prisma.workspaceMember.update({
      where: { id: membership.id },
      data: {
        availability,
        lastActiveAt: new Date(),
      },
    });

    // Broadcast availability change to workspace
    await safeTrigger(
      `private-workspace-${workspaceId}`,
      "agent:availability-changed",
      {
        memberId: membership.id,
        userId: session.user.id,
        availability,
      },
      "updateAvailability",
    );

    return { status: "success" as const };
  } catch (error) {
    if (error instanceof Error) {
      return { status: "error" as const, message: error.message };
    }
    return { status: "error" as const, message: "Failed to update availability" };
  }
}

/**
 * Update which conversation the agent is currently viewing.
 * Used for collision detection.
 */
export async function updateCurrentViewing(
  workspaceId: string,
  conversationId: string | null,
) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const membership = await requireWorkspaceMember(workspaceId, session.user.id);

    await prisma.workspaceMember.update({
      where: { id: membership.id },
      data: {
        currentViewingId: conversationId,
        lastActiveAt: new Date(),
      },
    });

    return { status: "success" as const };
  } catch (error) {
    return { status: "error" as const, message: "Failed to update viewing status" };
  }
}

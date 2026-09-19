"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { requireWorkspaceRole } from "@/lib/workspace";
import {
  installAgent,
  uninstallAgent,
  updateAgent,
  type InstallAgentInput,
  type UpdateAgentInput,
} from "@/lib/agents";

// ---------------------------------------------------------------------------
// Install Agent
// ---------------------------------------------------------------------------

export async function installAgentAction(
  workspaceId: string,
  data: InstallAgentInput,
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { status: "error" as const, message: "Not authenticated" };
    }

    await requireWorkspaceRole(workspaceId, session.user.id, [
      "OWNER",
      "ADMIN",
    ]);

    const result = await installAgent(workspaceId, session.user.id, data);

    revalidatePath("/workspace");
    return {
      status: "success" as const,
      agent: result.agent,
      webhookSecret: result.webhookSecret,
      apiKeyRaw: result.apiKeyRaw,
    };
  } catch (error) {
    console.error("Install agent error:", error);
    return {
      status: "error" as const,
      message:
        error instanceof Error ? error.message : "Failed to install agent",
    };
  }
}

// ---------------------------------------------------------------------------
// Uninstall Agent
// ---------------------------------------------------------------------------

export async function uninstallAgentAction(
  agentId: string,
  workspaceId: string,
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { status: "error" as const, message: "Not authenticated" };
    }

    await requireWorkspaceRole(workspaceId, session.user.id, [
      "OWNER",
      "ADMIN",
    ]);

    await uninstallAgent(agentId, workspaceId);

    revalidatePath("/workspace");
    return { status: "success" as const };
  } catch (error) {
    console.error("Uninstall agent error:", error);
    return {
      status: "error" as const,
      message:
        error instanceof Error ? error.message : "Failed to uninstall agent",
    };
  }
}

// ---------------------------------------------------------------------------
// Update Agent
// ---------------------------------------------------------------------------

export async function updateAgentAction(
  agentId: string,
  workspaceId: string,
  data: UpdateAgentInput,
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { status: "error" as const, message: "Not authenticated" };
    }

    await requireWorkspaceRole(workspaceId, session.user.id, [
      "OWNER",
      "ADMIN",
    ]);

    const updated = await updateAgent(agentId, workspaceId, data);

    revalidatePath("/workspace");
    return { status: "success" as const, agent: updated };
  } catch (error) {
    console.error("Update agent error:", error);
    return {
      status: "error" as const,
      message:
        error instanceof Error ? error.message : "Failed to update agent",
    };
  }
}

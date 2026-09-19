"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function adminDisconnectIntegration(data: {
  integrationId: string;
  type: "slack" | "widget" | "help-center";
  workspaceId: string;
}) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      throw new Error("Unauthorized");
    }

    const adminId = session.user.id;
    const { integrationId, type, workspaceId } = data;

    // Verify the workspace exists
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    });

    if (!workspace) {
      return { status: "error" as const, message: "Workspace not found" };
    }

    // Delete the integration based on type
    switch (type) {
      case "slack":
        await prisma.slackIntegration.delete({
          where: { id: integrationId },
        });
        break;
      case "widget":
        await prisma.widgetSettings.delete({
          where: { id: integrationId },
        });
        break;
      case "help-center":
        await prisma.helpCenterSettings.delete({
          where: { id: integrationId },
        });
        break;
      default:
        return { status: "error" as const, message: "Invalid integration type" };
    }

    // Audit log
    await prisma.adminAuditLog.create({
      data: {
        adminId,
        action: "disconnect_integration",
        targetType: "WORKSPACE",
        targetId: workspaceId,
        metadata: {
          integrationType: type,
          integrationId,
          workspaceName: workspace.name,
        },
      },
    });

    revalidatePath("/admin/integrations");
    revalidatePath(`/admin/workspaces/${workspaceId}`);
    return { status: "success" as const };
  } catch {
    return { status: "error" as const, message: "Something went wrong" };
  }
}

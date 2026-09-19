"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { deleteWorkspaceSchema } from "@/lib/validations/admin";

export async function deleteWorkspace(data: {
  workspaceId: string;
  confirmName: string;
}) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      throw new Error("Unauthorized");
    }

    const adminId = session.user.id;
    const { workspaceId, confirmName } = deleteWorkspaceSchema.parse(data);

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    });

    if (!workspace) {
      return { status: "error" as const, message: "Workspace not found" };
    }

    if (workspace.name !== confirmName) {
      return {
        status: "error" as const,
        message: "Workspace name does not match",
      };
    }

    // Prisma cascades handle all related data deletion
    await prisma.$transaction([
      prisma.adminAuditLog.create({
        data: {
          adminId,
          action: "delete_workspace",
          targetType: "WORKSPACE",
          targetId: workspaceId,
          metadata: { workspaceName: workspace.name },
        },
      }),
      prisma.workspace.delete({ where: { id: workspaceId } }),
    ]);

    revalidatePath("/admin/workspaces");
    return { status: "success" as const };
  } catch {
    return { status: "error" as const, message: "Something went wrong" };
  }
}

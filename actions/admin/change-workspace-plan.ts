"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { changeWorkspacePlanSchema } from "@/lib/validations/admin";

export async function changeWorkspacePlan(data: {
  workspaceId: string;
  plan: "FREE" | "PRO";
}) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      throw new Error("Unauthorized");
    }

    const adminId = session.user.id;
    const { workspaceId, plan } = changeWorkspacePlanSchema.parse(data);

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { plan: true, name: true },
    });

    if (!workspace) {
      return { status: "error" as const, message: "Workspace not found" };
    }

    if (workspace.plan === plan) {
      return { status: "error" as const, message: `Workspace is already on ${plan} plan` };
    }

    await prisma.$transaction([
      prisma.workspace.update({
        where: { id: workspaceId },
        data: {
          plan,
          // Clear Stripe subscription if gifting PRO (no Stripe involved)
          // Keep it if downgrading (Stripe webhook handles its own cleanup)
        },
      }),
      prisma.adminAuditLog.create({
        data: {
          adminId,
          action: "change_plan",
          targetType: "WORKSPACE",
          targetId: workspaceId,
          metadata: { oldPlan: workspace.plan, newPlan: plan, workspaceName: workspace.name },
        },
      }),
    ]);

    revalidatePath("/admin/workspaces");
    revalidatePath(`/admin/workspaces/${workspaceId}`);
    return { status: "success" as const };
  } catch {
    return { status: "error" as const, message: "Something went wrong" };
  }
}

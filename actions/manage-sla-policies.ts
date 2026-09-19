"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { requireWorkspaceRole } from "@/lib/workspace";
import { revalidatePath } from "next/cache";

export async function createSlaPolicy(
  workspaceId: string,
  data: {
    name: string;
    firstResponseMinutes: number;
    resolutionMinutes: number;
    priority?: number | null;
    isDefault?: boolean;
  },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { status: "error" as const, message: "Unauthorized" };
    }
    await requireWorkspaceRole(workspaceId, session.user.id, ["OWNER", "ADMIN"]);

    if (!data.name?.trim()) {
      return { status: "error" as const, message: "Policy name is required" };
    }
    if (data.firstResponseMinutes < 1 || data.resolutionMinutes < 1) {
      return { status: "error" as const, message: "Target times must be at least 1 minute" };
    }
    if (data.firstResponseMinutes > data.resolutionMinutes) {
      return { status: "error" as const, message: "First response target cannot exceed resolution target" };
    }

    const policy = await prisma.slaPolicy.create({
      data: {
        workspaceId,
        name: data.name.trim(),
        firstResponseMinutes: data.firstResponseMinutes,
        resolutionMinutes: data.resolutionMinutes,
        priority: data.priority ?? null,
        isDefault: data.isDefault ?? false,
      },
    });

    revalidatePath("/workspace");
    return { status: "success" as const, policyId: policy.id };
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return {
        status: "error" as const,
        message: "An SLA policy already exists for this priority level",
      };
    }
    console.error("Create SLA policy error:", error);
    return { status: "error" as const, message: "Failed to create SLA policy" };
  }
}

export async function updateSlaPolicy(
  workspaceId: string,
  policyId: string,
  data: {
    name?: string;
    firstResponseMinutes?: number;
    resolutionMinutes?: number;
    isDefault?: boolean;
  },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { status: "error" as const, message: "Unauthorized" };
    }
    await requireWorkspaceRole(workspaceId, session.user.id, ["OWNER", "ADMIN"]);

    const existing = await prisma.slaPolicy.findUnique({
      where: { id: policyId },
      select: { workspaceId: true },
    });
    if (!existing || existing.workspaceId !== workspaceId) {
      return { status: "error" as const, message: "Policy not found" };
    }

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.firstResponseMinutes !== undefined) updateData.firstResponseMinutes = data.firstResponseMinutes;
    if (data.resolutionMinutes !== undefined) updateData.resolutionMinutes = data.resolutionMinutes;
    if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;

    await prisma.slaPolicy.update({
      where: { id: policyId },
      data: updateData,
    });

    revalidatePath("/workspace");
    return { status: "success" as const };
  } catch (error) {
    console.error("Update SLA policy error:", error);
    return { status: "error" as const, message: "Failed to update SLA policy" };
  }
}

export async function deleteSlaPolicy(workspaceId: string, policyId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { status: "error" as const, message: "Unauthorized" };
    }
    await requireWorkspaceRole(workspaceId, session.user.id, ["OWNER", "ADMIN"]);

    const existing = await prisma.slaPolicy.findUnique({
      where: { id: policyId },
      select: { workspaceId: true },
    });
    if (!existing || existing.workspaceId !== workspaceId) {
      return { status: "error" as const, message: "Policy not found" };
    }

    // Unlink conversations from this policy
    await prisma.conversation.updateMany({
      where: { slaPolicyId: policyId },
      data: { slaPolicyId: null },
    });

    await prisma.slaPolicy.delete({ where: { id: policyId } });

    revalidatePath("/workspace");
    return { status: "success" as const };
  } catch (error) {
    console.error("Delete SLA policy error:", error);
    return { status: "error" as const, message: "Failed to delete SLA policy" };
  }
}

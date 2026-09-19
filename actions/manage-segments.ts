"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { requireWorkspaceMember } from "@/lib/workspace";
import { revalidatePath } from "next/cache";
import type { SegmentCondition } from "@/lib/segments/evaluate";

export async function createSegment(
  workspaceId: string,
  data: {
    name: string;
    description?: string | null;
    conditions: SegmentCondition[];
    color?: string | null;
  },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { status: "error" as const, message: "Unauthorized" };
    }
    await requireWorkspaceMember(workspaceId, session.user.id);

    if (!data.name?.trim()) {
      return { status: "error" as const, message: "Segment name is required" };
    }

    if (!data.conditions || data.conditions.length === 0) {
      return { status: "error" as const, message: "At least one condition is required" };
    }

    const segment = await prisma.customerSegment.create({
      data: {
        workspaceId,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        conditions: data.conditions as unknown as object,
        color: data.color || null,
      },
    });

    revalidatePath("/workspace");
    return { status: "success" as const, segmentId: segment.id };
  } catch (error) {
    console.error("Create segment error:", error);
    return { status: "error" as const, message: "Failed to create segment" };
  }
}

export async function updateSegment(
  workspaceId: string,
  segmentId: string,
  data: {
    name?: string;
    description?: string | null;
    conditions?: SegmentCondition[];
    color?: string | null;
  },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { status: "error" as const, message: "Unauthorized" };
    }
    await requireWorkspaceMember(workspaceId, session.user.id);

    const existing = await prisma.customerSegment.findUnique({
      where: { id: segmentId },
      select: { workspaceId: true },
    });
    if (!existing || existing.workspaceId !== workspaceId) {
      return { status: "error" as const, message: "Segment not found" };
    }

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.description !== undefined) updateData.description = data.description?.trim() || null;
    if (data.conditions !== undefined) updateData.conditions = data.conditions as unknown as object;
    if (data.color !== undefined) updateData.color = data.color;

    await prisma.customerSegment.update({
      where: { id: segmentId },
      data: updateData,
    });

    revalidatePath("/workspace");
    return { status: "success" as const };
  } catch (error) {
    console.error("Update segment error:", error);
    return { status: "error" as const, message: "Failed to update segment" };
  }
}

export async function deleteSegment(workspaceId: string, segmentId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { status: "error" as const, message: "Unauthorized" };
    }
    await requireWorkspaceMember(workspaceId, session.user.id);

    const existing = await prisma.customerSegment.findUnique({
      where: { id: segmentId },
      select: { workspaceId: true },
    });
    if (!existing || existing.workspaceId !== workspaceId) {
      return { status: "error" as const, message: "Segment not found" };
    }

    await prisma.customerSegment.delete({ where: { id: segmentId } });

    revalidatePath("/workspace");
    return { status: "success" as const };
  } catch (error) {
    console.error("Delete segment error:", error);
    return { status: "error" as const, message: "Failed to delete segment" };
  }
}

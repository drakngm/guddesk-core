"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { requireWorkspaceMember } from "@/lib/workspace";
import { revalidatePath } from "next/cache";
import { trackCustomerEvent } from "@/lib/customer-events";

export async function updateCustomer(
  workspaceId: string,
  customerId: string,
  data: {
    name?: string | null;
    email?: string | null;
    avatarUrl?: string | null;
    companyId?: string | null;
    metadata?: Record<string, unknown> | null;
  },
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return { status: "error" as const, message: "Unauthorized" };
    }

    await requireWorkspaceMember(workspaceId, session.user.id);

    // Verify the customer belongs to this workspace
    const existing = await prisma.visitor.findUnique({
      where: { id: customerId },
      select: { id: true, workspaceId: true },
    });

    if (!existing || existing.workspaceId !== workspaceId) {
      return { status: "error" as const, message: "Customer not found" };
    }

    // Build the update payload — only include fields that were provided
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;
    if (data.companyId !== undefined) updateData.companyId = data.companyId;
    if (data.metadata !== undefined) updateData.metadata = data.metadata;

    if (Object.keys(updateData).length === 0) {
      return { status: "error" as const, message: "No fields to update" };
    }

    await prisma.visitor.update({
      where: { id: customerId },
      data: updateData,
    });

    // Track customer events
    const changedFields = Object.keys(updateData).filter((k) => k !== "metadata");
    if (changedFields.length > 0 || data.metadata !== undefined) {
      trackCustomerEvent(
        workspaceId,
        customerId,
        "customer.updated",
        `Profile updated: ${changedFields.length > 0 ? changedFields.join(", ") : "metadata"}`,
        { updatedFields: Object.keys(updateData), updatedBy: session.user.id },
      );
    }

    if (data.companyId !== undefined) {
      if (data.companyId) {
        const company = await prisma.company.findUnique({
          where: { id: data.companyId },
          select: { name: true },
        });
        trackCustomerEvent(
          workspaceId,
          customerId,
          "company.assigned",
          `Assigned to ${company?.name ?? "company"}`,
          { companyId: data.companyId, assignedBy: session.user.id },
        );
      } else {
        trackCustomerEvent(
          workspaceId,
          customerId,
          "company.removed",
          "Removed from company",
          { removedBy: session.user.id },
        );
      }
    }

    revalidatePath(`/workspace`);
    return { status: "success" as const };
  } catch (error) {
    console.error("Update customer error:", error);
    return {
      status: "error" as const,
      message: error instanceof Error ? error.message : "Failed to update customer",
    };
  }
}

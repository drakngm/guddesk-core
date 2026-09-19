"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { requireWorkspaceRole } from "@/lib/workspace";
import { revalidatePath } from "next/cache";

export async function createTicketForm(
  workspaceId: string,
  data: {
    name: string;
    description?: string | null;
    fieldKeys: string[];
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
      return { status: "error" as const, message: "Form name is required" };
    }

    // If marking as default, unset other defaults
    if (data.isDefault) {
      await prisma.ticketForm.updateMany({
        where: { workspaceId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const form = await prisma.ticketForm.create({
      data: {
        workspaceId,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        fieldKeys: data.fieldKeys,
        isDefault: data.isDefault ?? false,
      },
    });

    revalidatePath("/workspace");
    return { status: "success" as const, formId: form.id };
  } catch (error) {
    console.error("Create ticket form error:", error);
    return { status: "error" as const, message: "Failed to create ticket form" };
  }
}

export async function updateTicketForm(
  workspaceId: string,
  formId: string,
  data: {
    name?: string;
    description?: string | null;
    fieldKeys?: string[];
    isDefault?: boolean;
    isEnabled?: boolean;
  },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { status: "error" as const, message: "Unauthorized" };
    }
    await requireWorkspaceRole(workspaceId, session.user.id, ["OWNER", "ADMIN"]);

    const existing = await prisma.ticketForm.findUnique({
      where: { id: formId },
      select: { workspaceId: true },
    });
    if (!existing || existing.workspaceId !== workspaceId) {
      return { status: "error" as const, message: "Form not found" };
    }

    // If marking as default, unset other defaults
    if (data.isDefault) {
      await prisma.ticketForm.updateMany({
        where: { workspaceId, isDefault: true, id: { not: formId } },
        data: { isDefault: false },
      });
    }

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.description !== undefined) updateData.description = data.description?.trim() || null;
    if (data.fieldKeys !== undefined) updateData.fieldKeys = data.fieldKeys;
    if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;
    if (data.isEnabled !== undefined) updateData.isEnabled = data.isEnabled;

    await prisma.ticketForm.update({
      where: { id: formId },
      data: updateData,
    });

    revalidatePath("/workspace");
    return { status: "success" as const };
  } catch (error) {
    console.error("Update ticket form error:", error);
    return { status: "error" as const, message: "Failed to update ticket form" };
  }
}

export async function deleteTicketForm(workspaceId: string, formId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { status: "error" as const, message: "Unauthorized" };
    }
    await requireWorkspaceRole(workspaceId, session.user.id, ["OWNER", "ADMIN"]);

    const existing = await prisma.ticketForm.findUnique({
      where: { id: formId },
      select: { workspaceId: true },
    });
    if (!existing || existing.workspaceId !== workspaceId) {
      return { status: "error" as const, message: "Form not found" };
    }

    // Unlink conversations from this form
    await prisma.conversation.updateMany({
      where: { ticketFormId: formId },
      data: { ticketFormId: null },
    });

    await prisma.ticketForm.delete({ where: { id: formId } });

    revalidatePath("/workspace");
    return { status: "success" as const };
  } catch (error) {
    console.error("Delete ticket form error:", error);
    return { status: "error" as const, message: "Failed to delete ticket form" };
  }
}

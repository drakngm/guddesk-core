"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { requireWorkspaceMember } from "@/lib/workspace";
import { revalidatePath } from "next/cache";
import type { CustomFieldType } from "@prisma/client";

export async function createCustomField(
  workspaceId: string,
  data: {
    name: string;
    key: string;
    fieldType: CustomFieldType;
    entityType: "customer" | "company";
    isRequired?: boolean;
    enumOptions?: string[];
    displayOrder?: number;
  },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { status: "error" as const, message: "Unauthorized" };
    }
    await requireWorkspaceMember(workspaceId, session.user.id);

    if (!data.name?.trim()) {
      return { status: "error" as const, message: "Field name is required" };
    }

    if (!data.key?.trim()) {
      return { status: "error" as const, message: "Field key is required" };
    }

    // Validate key format: lowercase, alphanumeric, underscores
    const keyRegex = /^[a-z][a-z0-9_]*$/;
    if (!keyRegex.test(data.key.trim())) {
      return {
        status: "error" as const,
        message: "Key must start with a letter and contain only lowercase letters, numbers, and underscores",
      };
    }

    // For ENUM type, require at least one option
    if (data.fieldType === "ENUM" && (!data.enumOptions || data.enumOptions.length === 0)) {
      return { status: "error" as const, message: "Enum fields require at least one option" };
    }

    const field = await prisma.customField.create({
      data: {
        workspaceId,
        name: data.name.trim(),
        key: data.key.trim(),
        fieldType: data.fieldType,
        entityType: data.entityType,
        isRequired: data.isRequired ?? false,
        enumOptions: data.fieldType === "ENUM" ? (data.enumOptions ?? []) : [],
        displayOrder: data.displayOrder ?? 0,
      },
    });

    revalidatePath("/workspace");
    return { status: "success" as const, fieldId: field.id };
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.message.includes("Unique constraint")
    ) {
      return {
        status: "error" as const,
        message: `A ${data.entityType} field with key "${data.key}" already exists`,
      };
    }
    console.error("Create custom field error:", error);
    return { status: "error" as const, message: "Failed to create custom field" };
  }
}

export async function updateCustomField(
  workspaceId: string,
  fieldId: string,
  data: {
    name?: string;
    isRequired?: boolean;
    enumOptions?: string[];
    displayOrder?: number;
  },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { status: "error" as const, message: "Unauthorized" };
    }
    await requireWorkspaceMember(workspaceId, session.user.id);

    const existing = await prisma.customField.findUnique({
      where: { id: fieldId },
      select: { workspaceId: true },
    });
    if (!existing || existing.workspaceId !== workspaceId) {
      return { status: "error" as const, message: "Custom field not found" };
    }

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.isRequired !== undefined) updateData.isRequired = data.isRequired;
    if (data.enumOptions !== undefined) updateData.enumOptions = data.enumOptions;
    if (data.displayOrder !== undefined) updateData.displayOrder = data.displayOrder;

    await prisma.customField.update({
      where: { id: fieldId },
      data: updateData,
    });

    revalidatePath("/workspace");
    return { status: "success" as const };
  } catch (error) {
    console.error("Update custom field error:", error);
    return { status: "error" as const, message: "Failed to update custom field" };
  }
}

export async function deleteCustomField(workspaceId: string, fieldId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { status: "error" as const, message: "Unauthorized" };
    }
    await requireWorkspaceMember(workspaceId, session.user.id);

    const existing = await prisma.customField.findUnique({
      where: { id: fieldId },
      select: { workspaceId: true },
    });
    if (!existing || existing.workspaceId !== workspaceId) {
      return { status: "error" as const, message: "Custom field not found" };
    }

    await prisma.customField.delete({ where: { id: fieldId } });

    revalidatePath("/workspace");
    return { status: "success" as const };
  } catch (error) {
    console.error("Delete custom field error:", error);
    return { status: "error" as const, message: "Failed to delete custom field" };
  }
}

"use server";

import { auth } from "@/auth";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireWorkspaceMember } from "@/lib/workspace";
import { revalidatePath } from "next/cache";

export async function createCompany(
  workspaceId: string,
  data: {
    name: string;
    domain?: string | null;
    website?: string | null;
    logoUrl?: string | null;
    industry?: string | null;
    metadata?: Record<string, unknown> | null;
  },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { status: "error" as const, message: "Unauthorized" };
    }
    await requireWorkspaceMember(workspaceId, session.user.id);

    if (!data.name?.trim()) {
      return { status: "error" as const, message: "Company name is required" };
    }

    const company = await prisma.company.create({
      data: {
        workspaceId,
        name: data.name.trim(),
        domain: data.domain?.trim().toLowerCase() || null,
        website: data.website?.trim() || null,
        logoUrl: data.logoUrl?.trim() || null,
        industry: data.industry?.trim() || null,
        metadata: data.metadata ? (data.metadata as Prisma.InputJsonValue) : undefined,
      },
    });

    revalidatePath("/workspace");
    return { status: "success" as const, companyId: company.id };
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.message.includes("Unique constraint")
    ) {
      return { status: "error" as const, message: "A company with this domain already exists in this workspace" };
    }
    console.error("Create company error:", error);
    return { status: "error" as const, message: "Failed to create company" };
  }
}

export async function updateCompany(
  workspaceId: string,
  companyId: string,
  data: {
    name?: string;
    domain?: string | null;
    website?: string | null;
    logoUrl?: string | null;
    industry?: string | null;
    metadata?: Record<string, unknown> | null;
  },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { status: "error" as const, message: "Unauthorized" };
    }
    await requireWorkspaceMember(workspaceId, session.user.id);

    const existing = await prisma.company.findUnique({
      where: { id: companyId },
      select: { workspaceId: true },
    });
    if (!existing || existing.workspaceId !== workspaceId) {
      return { status: "error" as const, message: "Company not found" };
    }

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.domain !== undefined) updateData.domain = data.domain?.trim().toLowerCase() || null;
    if (data.website !== undefined) updateData.website = data.website?.trim() || null;
    if (data.logoUrl !== undefined) updateData.logoUrl = data.logoUrl?.trim() || null;
    if (data.industry !== undefined) updateData.industry = data.industry?.trim() || null;
    if (data.metadata !== undefined) updateData.metadata = data.metadata;

    await prisma.company.update({
      where: { id: companyId },
      data: updateData,
    });

    revalidatePath("/workspace");
    return { status: "success" as const };
  } catch (error) {
    console.error("Update company error:", error);
    return { status: "error" as const, message: "Failed to update company" };
  }
}

export async function deleteCompany(workspaceId: string, companyId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { status: "error" as const, message: "Unauthorized" };
    }
    await requireWorkspaceMember(workspaceId, session.user.id);

    const existing = await prisma.company.findUnique({
      where: { id: companyId },
      select: { workspaceId: true },
    });
    if (!existing || existing.workspaceId !== workspaceId) {
      return { status: "error" as const, message: "Company not found" };
    }

    // Unlink visitors first (set companyId to null), then delete
    await prisma.visitor.updateMany({
      where: { companyId },
      data: { companyId: null },
    });

    await prisma.company.delete({ where: { id: companyId } });

    revalidatePath("/workspace");
    return { status: "success" as const };
  } catch (error) {
    console.error("Delete company error:", error);
    return { status: "error" as const, message: "Failed to delete company" };
  }
}

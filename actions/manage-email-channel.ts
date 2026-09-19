"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { requireWorkspaceRole } from "@/lib/workspace";
import { revalidatePath } from "next/cache";

interface UpsertEmailChannelInput {
  isEnabled: boolean;
  fromName?: string;
  fromAddress?: string;
  signature?: string;
  autoReopen?: boolean;
}

export async function upsertEmailChannelConfig(
  workspaceId: string,
  input: UpsertEmailChannelInput,
) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    await requireWorkspaceRole(workspaceId, session.user.id, ["ADMIN"]);

    const { isEnabled, fromName, fromAddress, signature, autoReopen } = input;

    // Look up the workspace appId for the support address
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { appId: true, slug: true },
    });

    if (!workspace) throw new Error("Workspace not found");

    const supportAddress = `support+${workspace.appId}@mail.guddesk.com`;

    const config = await prisma.emailChannelConfig.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        isEnabled,
        supportAddress,
        fromName: fromName ?? null,
        fromAddress: fromAddress ?? null,
        signature: signature ?? null,
        autoReopen: autoReopen ?? true,
      },
      update: {
        isEnabled,
        supportAddress,
        fromName: fromName ?? null,
        fromAddress: fromAddress ?? null,
        signature: signature ?? null,
        autoReopen: autoReopen ?? true,
      },
    });

    revalidatePath(`/workspace/${workspace.slug}/settings/email-channel`);
    return { status: "success" as const, config };
  } catch (error) {
    if (error instanceof Error) {
      return { status: "error" as const, message: error.message };
    }
    return { status: "error" as const, message: "Failed to update email channel config" };
  }
}

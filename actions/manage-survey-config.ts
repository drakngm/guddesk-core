"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { requireWorkspaceRole } from "@/lib/workspace";
import { revalidatePath } from "next/cache";
import type { SurveyType, SurveyTriggerType } from "@prisma/client";

export async function upsertSurveyConfig(
  workspaceId: string,
  data: {
    type: SurveyType;
    isEnabled: boolean;
    trigger?: SurveyTriggerType;
    delayMinutes?: number;
    questionText?: string;
    thankYouText?: string;
  },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { status: "error" as const, message: "Unauthorized" };
    }
    await requireWorkspaceRole(workspaceId, session.user.id, ["OWNER", "ADMIN"]);

    if (data.delayMinutes !== undefined && (data.delayMinutes < 0 || data.delayMinutes > 10080)) {
      return { status: "error" as const, message: "Delay must be between 0 and 10080 minutes (7 days)" };
    }

    await prisma.surveyConfig.upsert({
      where: {
        workspaceId_type: { workspaceId, type: data.type },
      },
      create: {
        workspaceId,
        type: data.type,
        isEnabled: data.isEnabled,
        trigger: data.trigger ?? "ON_CLOSE",
        delayMinutes: data.delayMinutes ?? 0,
        questionText: data.questionText?.trim() || "How would you rate your experience?",
        thankYouText: data.thankYouText?.trim() || "Thank you for your feedback!",
      },
      update: {
        isEnabled: data.isEnabled,
        ...(data.trigger !== undefined && { trigger: data.trigger }),
        ...(data.delayMinutes !== undefined && { delayMinutes: data.delayMinutes }),
        ...(data.questionText !== undefined && { questionText: data.questionText.trim() }),
        ...(data.thankYouText !== undefined && { thankYouText: data.thankYouText.trim() }),
      },
    });

    revalidatePath("/workspace");
    return { status: "success" as const };
  } catch (error) {
    console.error("Upsert survey config error:", error);
    return { status: "error" as const, message: "Failed to save survey configuration" };
  }
}

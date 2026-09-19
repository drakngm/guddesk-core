"use server";

import { auth } from "@/auth";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireWorkspaceRole } from "@/lib/workspace";
import { revalidatePath } from "next/cache";
import type { WeekSchedule } from "@/lib/sla/business-hours";

export async function upsertBusinessHours(
  workspaceId: string,
  data: {
    timezone: string;
    schedule: WeekSchedule;
    holidays: string[];
  },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { status: "error" as const, message: "Unauthorized" };
    }
    await requireWorkspaceRole(workspaceId, session.user.id, ["OWNER", "ADMIN"]);

    if (!data.timezone) {
      return { status: "error" as const, message: "Timezone is required" };
    }

    // Validate schedule: at least one working day
    const hasWorkingDay = Object.values(data.schedule).some(
      (day) => day && day.start && day.end,
    );
    if (!hasWorkingDay) {
      return { status: "error" as const, message: "At least one working day is required" };
    }

    // Validate holiday date format
    for (const holiday of data.holidays) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(holiday)) {
        return { status: "error" as const, message: `Invalid holiday date format: ${holiday}` };
      }
    }

    await prisma.businessHours.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        timezone: data.timezone,
        schedule: data.schedule as unknown as Prisma.InputJsonValue,
        holidays: data.holidays as unknown as Prisma.InputJsonValue,
      },
      update: {
        timezone: data.timezone,
        schedule: data.schedule as unknown as Prisma.InputJsonValue,
        holidays: data.holidays as unknown as Prisma.InputJsonValue,
      },
    });

    revalidatePath("/workspace");
    return { status: "success" as const };
  } catch (error) {
    console.error("Upsert business hours error:", error);
    return { status: "error" as const, message: "Failed to save business hours" };
  }
}

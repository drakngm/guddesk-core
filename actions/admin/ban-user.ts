"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { banUserSchema } from "@/lib/validations/admin";

export async function banUser(data: { userId: string; reason?: string }) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      throw new Error("Unauthorized");
    }

    const adminId = session.user.id;
    const { userId, reason } = banUserSchema.parse(data);

    // Prevent banning yourself
    if (userId === adminId) {
      return { status: "error" as const, message: "Cannot ban yourself" };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isBanned: true, role: true },
    });

    if (!user) {
      return { status: "error" as const, message: "User not found" };
    }

    // Prevent banning other admins
    if (user.role === "ADMIN") {
      return { status: "error" as const, message: "Cannot ban admin users" };
    }

    const nowBanned = !user.isBanned;

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          isBanned: nowBanned,
          bannedAt: nowBanned ? new Date() : null,
        },
      }),
      prisma.adminAuditLog.create({
        data: {
          adminId,
          action: nowBanned ? "ban_user" : "unban_user",
          targetType: "USER",
          targetId: userId,
          metadata: reason ? { reason } : undefined,
        },
      }),
    ]);

    revalidatePath("/admin/users");
    return { status: "success" as const, banned: nowBanned };
  } catch {
    return { status: "error" as const, message: "Something went wrong" };
  }
}

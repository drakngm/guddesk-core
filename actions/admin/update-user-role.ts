"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { adminUpdateUserRoleSchema } from "@/lib/validations/admin";

export async function adminUpdateUserRole(data: {
  userId: string;
  role: "ADMIN" | "USER";
}) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      throw new Error("Unauthorized");
    }

    const adminId = session.user.id;
    const { userId, role } = adminUpdateUserRoleSchema.parse(data);

    // Prevent changing your own role
    if (userId === adminId) {
      return { status: "error" as const, message: "Cannot change your own role" };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) {
      return { status: "error" as const, message: "User not found" };
    }

    if (user.role === role) {
      return { status: "error" as const, message: `User already has ${role} role` };
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { role },
      }),
      prisma.adminAuditLog.create({
        data: {
          adminId,
          action: "change_role",
          targetType: "USER",
          targetId: userId,
          metadata: { oldRole: user.role, newRole: role },
        },
      }),
    ]);

    revalidatePath("/admin/users");
    return { status: "success" as const };
  } catch {
    return { status: "error" as const, message: "Something went wrong" };
  }
}

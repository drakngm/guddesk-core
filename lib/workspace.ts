import "server-only";

import { WorkspaceRole } from "@prisma/client";
import { cache } from "react";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export const getCurrentWorkspace = cache(async () => {
  const session = await auth();
  if (!session?.user?.activeWorkspaceId) return null;

  const workspace = await prisma.workspace.findUnique({
    where: { id: session.user.activeWorkspaceId },
  });

  return workspace;
});

export const getUserWorkspaces = cache(async (userId: string) => {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
          logo: true,
          plan: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return memberships.map((m) => ({
    ...m.workspace,
    role: m.role,
    memberId: m.id,
  }));
});

export const getWorkspaceBySlug = cache(async (slug: string) => {
  const workspace = await prisma.workspace.findUnique({
    where: { slug },
  });

  return workspace;
});

export const getWorkspaceMembership = cache(
  async (workspaceId: string, userId: string) => {
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId },
      },
    });

    return membership;
  },
);

export async function requireWorkspaceMember(workspaceId: string, userId: string) {
  const membership = await getWorkspaceMembership(workspaceId, userId);
  if (!membership) {
    throw new Error("Not a member of this workspace");
  }
  return membership;
}

export async function requireWorkspaceRole(
  workspaceId: string,
  userId: string,
  allowedRoles: WorkspaceRole[],
) {
  const membership = await requireWorkspaceMember(workspaceId, userId);
  if (!allowedRoles.includes(membership.role)) {
    throw new Error("Insufficient permissions");
  }
  return membership;
}

export async function getWorkspaceMembers(workspaceId: string) {
  return prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function getWorkspaceInvitations(workspaceId: string) {
  return prisma.workspaceInvitation.findMany({
    where: { workspaceId, status: "PENDING" },
    include: {
      invitedBy: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

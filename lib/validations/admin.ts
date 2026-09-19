import { z } from "zod";

export const banUserSchema = z.object({
  userId: z.string().min(1),
  reason: z.string().max(500).optional(),
});

export const changeWorkspacePlanSchema = z.object({
  workspaceId: z.string().min(1),
  plan: z.enum(["FREE", "PRO"]),
});

export const adminUpdateUserRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["ADMIN", "USER"]),
});

export const deleteWorkspaceSchema = z.object({
  workspaceId: z.string().min(1),
  confirmName: z.string().min(1),
});

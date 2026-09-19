"use server";

import { randomBytes } from "crypto";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { requireWorkspaceRole } from "@/lib/workspace";
import { retryDelivery, sendTestPing } from "@/lib/webhooks";
import { revalidatePath } from "next/cache";
import type { WebhookDeliveryStatus } from "@prisma/client";

export async function createWebhookEndpoint(
  workspaceId: string,
  data: { url: string; description?: string },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { status: "error" as const, message: "Not authenticated" };
    }

    await requireWorkspaceRole(workspaceId, session.user.id, ["OWNER", "ADMIN"]);

    const { url, description } = data;

    if (!url || !url.startsWith("https://")) {
      return { status: "error" as const, message: "Webhook URL must use HTTPS" };
    }

    try {
      new URL(url);
    } catch {
      return { status: "error" as const, message: "Invalid URL format" };
    }

    const secret = randomBytes(32).toString("hex");

    const endpoint = await prisma.webhookEndpoint.create({
      data: {
        workspaceId,
        url,
        secret,
        description: description || null,
      },
    });

    revalidatePath("/workspace");
    return {
      status: "success" as const,
      endpoint: {
        id: endpoint.id,
        url: endpoint.url,
        secret: endpoint.secret,
        description: endpoint.description,
      },
    };
  } catch (error) {
    console.error("Create webhook error:", error);
    return { status: "error" as const, message: "Failed to create webhook endpoint" };
  }
}

export async function updateWebhookEndpoint(
  endpointId: string,
  workspaceId: string,
  data: {
    url?: string;
    description?: string;
    isEnabled?: boolean;
    onMessageCreated?: boolean;
    onConversationCreated?: boolean;
    onConversationClosed?: boolean;
    onConversationAssigned?: boolean;
  },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { status: "error" as const, message: "Not authenticated" };
    }

    await requireWorkspaceRole(workspaceId, session.user.id, ["OWNER", "ADMIN"]);

    // Verify endpoint belongs to workspace
    const endpoint = await prisma.webhookEndpoint.findUnique({
      where: { id: endpointId },
      select: { workspaceId: true },
    });

    if (!endpoint || endpoint.workspaceId !== workspaceId) {
      return { status: "error" as const, message: "Webhook endpoint not found" };
    }

    if (data.url !== undefined) {
      if (!data.url.startsWith("https://")) {
        return { status: "error" as const, message: "Webhook URL must use HTTPS" };
      }
      try {
        new URL(data.url);
      } catch {
        return { status: "error" as const, message: "Invalid URL format" };
      }
    }

    await prisma.webhookEndpoint.update({
      where: { id: endpointId },
      data,
    });

    revalidatePath("/workspace");
    return { status: "success" as const };
  } catch (error) {
    console.error("Update webhook error:", error);
    return { status: "error" as const, message: "Failed to update webhook endpoint" };
  }
}

export async function deleteWebhookEndpoint(
  endpointId: string,
  workspaceId: string,
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { status: "error" as const, message: "Not authenticated" };
    }

    await requireWorkspaceRole(workspaceId, session.user.id, ["OWNER", "ADMIN"]);

    // Verify endpoint belongs to workspace
    const endpoint = await prisma.webhookEndpoint.findUnique({
      where: { id: endpointId },
      select: { workspaceId: true },
    });

    if (!endpoint || endpoint.workspaceId !== workspaceId) {
      return { status: "error" as const, message: "Webhook endpoint not found" };
    }

    await prisma.webhookEndpoint.delete({ where: { id: endpointId } });

    revalidatePath("/workspace");
    return { status: "success" as const };
  } catch (error) {
    console.error("Delete webhook error:", error);
    return { status: "error" as const, message: "Failed to delete webhook endpoint" };
  }
}

// ── Delivery Logs ─────────────────────────────────────────────────────────

export async function getWebhookDeliveries(
  endpointId: string,
  workspaceId: string,
  opts?: {
    cursor?: string;
    status?: WebhookDeliveryStatus;
    limit?: number;
  },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { status: "error" as const, message: "Not authenticated" };
    }

    await requireWorkspaceRole(workspaceId, session.user.id, ["OWNER", "ADMIN"]);

    // Verify endpoint belongs to workspace
    const endpoint = await prisma.webhookEndpoint.findUnique({
      where: { id: endpointId },
      select: { workspaceId: true },
    });

    if (!endpoint || endpoint.workspaceId !== workspaceId) {
      return { status: "error" as const, message: "Endpoint not found" };
    }

    const limit = opts?.limit ?? 50;

    const deliveries = await prisma.webhookDelivery.findMany({
      where: {
        endpointId,
        ...(opts?.status ? { status: opts.status } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1, // +1 to detect hasMore
      ...(opts?.cursor
        ? { cursor: { id: opts.cursor }, skip: 1 }
        : {}),
      select: {
        id: true,
        event: true,
        status: true,
        attemptCount: true,
        maxAttempts: true,
        httpStatus: true,
        durationMs: true,
        errorMessage: true,
        createdAt: true,
        completedAt: true,
      },
    });

    const hasMore = deliveries.length > limit;
    const items = hasMore ? deliveries.slice(0, limit) : deliveries;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return {
      status: "success" as const,
      deliveries: items,
      nextCursor,
      hasMore,
    };
  } catch (error) {
    console.error("Get webhook deliveries error:", error);
    return { status: "error" as const, message: "Failed to fetch deliveries" };
  }
}

export async function getWebhookDeliveryDetail(
  deliveryId: string,
  workspaceId: string,
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { status: "error" as const, message: "Not authenticated" };
    }

    await requireWorkspaceRole(workspaceId, session.user.id, ["OWNER", "ADMIN"]);

    const delivery = await prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: {
        endpoint: {
          select: { workspaceId: true, url: true },
        },
      },
    });

    if (!delivery || delivery.endpoint.workspaceId !== workspaceId) {
      return { status: "error" as const, message: "Delivery not found" };
    }

    return {
      status: "success" as const,
      delivery: {
        id: delivery.id,
        endpointId: delivery.endpointId,
        endpointUrl: delivery.endpoint.url,
        event: delivery.event,
        payload: delivery.payload,
        status: delivery.status,
        attemptCount: delivery.attemptCount,
        maxAttempts: delivery.maxAttempts,
        httpStatus: delivery.httpStatus,
        responseBody: delivery.responseBody,
        errorMessage: delivery.errorMessage,
        durationMs: delivery.durationMs,
        nextRetryAt: delivery.nextRetryAt,
        createdAt: delivery.createdAt,
        completedAt: delivery.completedAt,
      },
    };
  } catch (error) {
    console.error("Get webhook delivery detail error:", error);
    return { status: "error" as const, message: "Failed to fetch delivery detail" };
  }
}

export async function retryWebhookDelivery(
  deliveryId: string,
  workspaceId: string,
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { status: "error" as const, message: "Not authenticated" };
    }

    await requireWorkspaceRole(workspaceId, session.user.id, ["OWNER", "ADMIN"]);

    const delivery = await prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: {
        endpoint: { select: { workspaceId: true } },
      },
    });

    if (!delivery || delivery.endpoint.workspaceId !== workspaceId) {
      return { status: "error" as const, message: "Delivery not found" };
    }

    if (delivery.status === "SUCCESS") {
      return { status: "error" as const, message: "Delivery already succeeded" };
    }

    // Reset to PENDING and bump maxAttempts to allow retry
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: "PENDING",
        maxAttempts: delivery.attemptCount + 2, // allow at least one more
      },
    });

    // Execute retry immediately
    await retryDelivery(deliveryId);

    return { status: "success" as const };
  } catch (error) {
    console.error("Retry webhook delivery error:", error);
    return { status: "error" as const, message: "Failed to retry delivery" };
  }
}

export async function testWebhookEndpoint(
  endpointId: string,
  workspaceId: string,
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { status: "error" as const, message: "Not authenticated" };
    }

    await requireWorkspaceRole(workspaceId, session.user.id, ["OWNER", "ADMIN"]);

    // Verify endpoint belongs to workspace
    const endpoint = await prisma.webhookEndpoint.findUnique({
      where: { id: endpointId },
      select: { workspaceId: true },
    });

    if (!endpoint || endpoint.workspaceId !== workspaceId) {
      return { status: "error" as const, message: "Endpoint not found" };
    }

    const result = await sendTestPing(endpointId);

    return {
      status: "success" as const,
      testResult: result,
    };
  } catch (error) {
    console.error("Test webhook endpoint error:", error);
    return { status: "error" as const, message: "Failed to send test ping" };
  }
}

export async function rotateWebhookSecret(
  endpointId: string,
  workspaceId: string,
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { status: "error" as const, message: "Not authenticated" };
    }

    await requireWorkspaceRole(workspaceId, session.user.id, ["OWNER", "ADMIN"]);

    // Verify endpoint belongs to workspace
    const endpoint = await prisma.webhookEndpoint.findUnique({
      where: { id: endpointId },
      select: { workspaceId: true },
    });

    if (!endpoint || endpoint.workspaceId !== workspaceId) {
      return { status: "error" as const, message: "Endpoint not found" };
    }

    const newSecret = randomBytes(32).toString("hex");

    await prisma.webhookEndpoint.update({
      where: { id: endpointId },
      data: { secret: newSecret },
    });

    revalidatePath("/workspace");

    return {
      status: "success" as const,
      secret: newSecret, // One-time display
    };
  } catch (error) {
    console.error("Rotate webhook secret error:", error);
    return { status: "error" as const, message: "Failed to rotate secret" };
  }
}

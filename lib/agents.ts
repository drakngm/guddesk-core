import "server-only";

import { createHash, randomBytes } from "crypto";

import { AgentType, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Helpers (same patterns as manage-api-keys.ts / manage-webhooks.ts)
// ---------------------------------------------------------------------------

function generateApiKey(): string {
  const token = randomBytes(32).toString("base64url");
  return `gd_${token}`;
}

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

function generateWebhookSecret(): string {
  return randomBytes(32).toString("hex");
}

// ---------------------------------------------------------------------------
// Install Agent
// ---------------------------------------------------------------------------

export interface InstallAgentInput {
  name: string;
  description?: string | null;
  type?: AgentType;
  webhookUrl: string;
  iconUrl?: string | null;
  creatorName?: string | null;
  creatorUrl?: string | null;
  config?: unknown;
  priority?: number;
  events?: {
    onMessageCreated?: boolean;
    onConversationCreated?: boolean;
    onConversationClosed?: boolean;
    onConversationAssigned?: boolean;
  };
}

export interface InstallAgentResult {
  agent: {
    id: string;
    name: string;
    description: string | null;
    type: AgentType;
    iconUrl: string | null;
    creatorName: string | null;
    creatorUrl: string | null;
    isEnabled: boolean;
    priority: number;
    installedAt: Date;
    webhookEndpointId: string | null;
    apiKeyId: string | null;
  };
  /** One-time: the webhook signing secret. Store it — it won't be shown again. */
  webhookSecret: string;
  /** One-time: the raw API key. Store it — it won't be shown again. */
  apiKeyRaw: string;
}

/**
 * Install an agent into a workspace.
 *
 * Atomically creates:
 * 1. A WebhookEndpoint for the agent to receive events
 * 2. A dedicated ApiKey for the agent to call the GudDesk API
 * 3. The Agent record linking both
 *
 * Returns one-time credentials that must be stored by the caller.
 */
export async function installAgent(
  workspaceId: string,
  userId: string,
  input: InstallAgentInput,
): Promise<InstallAgentResult> {
  const {
    name,
    description,
    type = "CUSTOM",
    webhookUrl,
    iconUrl,
    creatorName,
    creatorUrl,
    config,
    priority = 0,
    events,
  } = input;

  // Validate webhook URL
  if (!webhookUrl || !webhookUrl.startsWith("https://")) {
    throw new Error("Webhook URL must use HTTPS");
  }
  try {
    new URL(webhookUrl);
  } catch {
    throw new Error("Invalid webhook URL format");
  }

  const webhookSecret = generateWebhookSecret();
  const rawApiKey = generateApiKey();
  const apiKeyHash = hashKey(rawApiKey);
  const apiKeyPrefix = rawApiKey.slice(0, 8);

  const result = await prisma.$transaction(async (tx) => {
    // 1. Create the webhook endpoint
    const webhookEndpoint = await tx.webhookEndpoint.create({
      data: {
        workspaceId,
        url: webhookUrl,
        secret: webhookSecret,
        description: `Agent: ${name.trim()}`,
        isEnabled: true,
        onMessageCreated: events?.onMessageCreated ?? true,
        onConversationCreated: events?.onConversationCreated ?? true,
        onConversationClosed: events?.onConversationClosed ?? false,
        onConversationAssigned: events?.onConversationAssigned ?? false,
      },
    });

    // 2. Create a dedicated API key for the agent
    const apiKey = await tx.apiKey.create({
      data: {
        userId,
        workspaceId,
        name: `Agent: ${name.trim()}`,
        keyHash: apiKeyHash,
        keyPrefix: apiKeyPrefix,
        permission: "READ_WRITE",
      },
    });

    // 3. Create the agent linking both
    const agent = await tx.agent.create({
      data: {
        workspaceId,
        name: name.trim(),
        description: description?.trim() || null,
        type: type === "BUILT_IN" ? "BUILT_IN" : type === "MARKETPLACE" ? "MARKETPLACE" : "CUSTOM",
        iconUrl: iconUrl || null,
        creatorName: creatorName?.trim() || null,
        creatorUrl: creatorUrl?.trim() || null,
        webhookEndpointId: webhookEndpoint.id,
        apiKeyId: apiKey.id,
        config: config ?? Prisma.DbNull,
        priority,
      },
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
        iconUrl: true,
        creatorName: true,
        creatorUrl: true,
        isEnabled: true,
        priority: true,
        installedAt: true,
        webhookEndpointId: true,
        apiKeyId: true,
      },
    });

    return agent;
  });

  return {
    agent: result,
    webhookSecret,
    apiKeyRaw: rawApiKey,
  };
}

// ---------------------------------------------------------------------------
// Uninstall Agent
// ---------------------------------------------------------------------------

/**
 * Uninstall an agent from a workspace.
 *
 * Atomically deletes:
 * 1. The Agent record
 * 2. Its linked WebhookEndpoint
 * 3. Its linked ApiKey
 */
export async function uninstallAgent(
  agentId: string,
  workspaceId: string,
): Promise<void> {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: {
      workspaceId: true,
      webhookEndpointId: true,
      apiKeyId: true,
    },
  });

  if (!agent || agent.workspaceId !== workspaceId) {
    throw new Error("Agent not found");
  }

  await prisma.$transaction(async (tx) => {
    // Delete the agent first (clears FK references via SetNull)
    await tx.agent.delete({ where: { id: agentId } });

    // Delete the linked webhook endpoint
    if (agent.webhookEndpointId) {
      await tx.webhookEndpoint.delete({
        where: { id: agent.webhookEndpointId },
      }).catch(() => {
        // Already deleted or doesn't exist — fine
      });
    }

    // Delete the linked API key
    if (agent.apiKeyId) {
      await tx.apiKey.delete({
        where: { id: agent.apiKeyId },
      }).catch(() => {
        // Already deleted or doesn't exist — fine
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Update Agent
// ---------------------------------------------------------------------------

export interface UpdateAgentInput {
  name?: string;
  description?: string | null;
  iconUrl?: string | null;
  creatorName?: string | null;
  creatorUrl?: string | null;
  config?: unknown;
  isEnabled?: boolean;
  priority?: number;
  /** Update the agent's webhook URL */
  webhookUrl?: string;
  /** Update event subscriptions on the agent's webhook */
  events?: {
    onMessageCreated?: boolean;
    onConversationCreated?: boolean;
    onConversationClosed?: boolean;
    onConversationAssigned?: boolean;
  };
}

/**
 * Update an agent's configuration and/or its linked webhook endpoint.
 */
export async function updateAgent(
  agentId: string,
  workspaceId: string,
  input: UpdateAgentInput,
) {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: {
      workspaceId: true,
      webhookEndpointId: true,
    },
  });

  if (!agent || agent.workspaceId !== workspaceId) {
    throw new Error("Agent not found");
  }

  // Build agent update data
  const agentData: Record<string, unknown> = {};
  if (input.name !== undefined) {
    if (typeof input.name !== "string" || !input.name.trim()) {
      throw new Error("name must be a non-empty string");
    }
    agentData.name = input.name.trim();
  }
  if (input.description !== undefined) {
    agentData.description = typeof input.description === "string"
      ? input.description.trim()
      : null;
  }
  if (input.iconUrl !== undefined) agentData.iconUrl = input.iconUrl || null;
  if (input.creatorName !== undefined) {
    agentData.creatorName = input.creatorName?.trim() || null;
  }
  if (input.creatorUrl !== undefined) {
    agentData.creatorUrl = input.creatorUrl?.trim() || null;
  }
  if (input.config !== undefined) agentData.config = input.config;
  if (input.isEnabled !== undefined) agentData.isEnabled = Boolean(input.isEnabled);
  if (input.priority !== undefined) {
    if (typeof input.priority !== "number") {
      throw new Error("priority must be a number");
    }
    agentData.priority = input.priority;
  }

  // Build webhook update data
  const webhookData: Record<string, unknown> = {};
  if (input.webhookUrl !== undefined) {
    if (!input.webhookUrl.startsWith("https://")) {
      throw new Error("Webhook URL must use HTTPS");
    }
    try {
      new URL(input.webhookUrl);
    } catch {
      throw new Error("Invalid webhook URL format");
    }
    webhookData.url = input.webhookUrl;
  }
  if (input.events) {
    if (input.events.onMessageCreated !== undefined)
      webhookData.onMessageCreated = input.events.onMessageCreated;
    if (input.events.onConversationCreated !== undefined)
      webhookData.onConversationCreated = input.events.onConversationCreated;
    if (input.events.onConversationClosed !== undefined)
      webhookData.onConversationClosed = input.events.onConversationClosed;
    if (input.events.onConversationAssigned !== undefined)
      webhookData.onConversationAssigned = input.events.onConversationAssigned;
  }

  await prisma.$transaction(async (tx) => {
    // Update agent
    if (Object.keys(agentData).length > 0) {
      await tx.agent.update({
        where: { id: agentId },
        data: agentData,
      });

      // Also update the linked webhook description and API key name if agent name changed
      if (agentData.name && agent.webhookEndpointId) {
        await tx.webhookEndpoint.update({
          where: { id: agent.webhookEndpointId },
          data: { description: `Agent: ${agentData.name}` },
        }).catch(() => {});
      }
    }

    // Update webhook endpoint
    if (Object.keys(webhookData).length > 0 && agent.webhookEndpointId) {
      await tx.webhookEndpoint.update({
        where: { id: agent.webhookEndpointId },
        data: webhookData,
      });
    }
  });

  // Return the updated agent
  return prisma.agent.findUnique({
    where: { id: agentId },
    select: {
      id: true,
      name: true,
      description: true,
      type: true,
      iconUrl: true,
      creatorName: true,
      creatorUrl: true,
      config: true,
      isEnabled: true,
      priority: true,
      installedAt: true,
      updatedAt: true,
      webhookEndpoint: {
        select: {
          id: true,
          url: true,
          isEnabled: true,
          onMessageCreated: true,
          onConversationCreated: true,
          onConversationClosed: true,
          onConversationAssigned: true,
        },
      },
    },
  });
}

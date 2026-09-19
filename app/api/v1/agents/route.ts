import { NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import {
  withApiAuth,
  withHeaders,
  apiOk,
  apiError,
  parsePagination,
  prismaPagination,
  buildPaginationResult,
} from "@/lib/api-utils";
import { installAgent } from "@/lib/agents";

// ---------------------------------------------------------------------------
// GET /api/v1/agents  —  List installed agents in a workspace
// Query: ?workspaceId=&type=BUILT_IN|MARKETPLACE|CUSTOM&enabled=true|false&limit=&cursor=
// Requires: READ_ONLY or higher
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const result = await withApiAuth(req, { permission: "READ_ONLY" });
  if (!result.ok) return result.response;
  const { ctx, rateLimitHeaders } = result;

  try {
    const params = req.nextUrl.searchParams;
    const type = params.get("type");
    const enabled = params.get("enabled");

    const where: Record<string, unknown> = { workspaceId: ctx.workspaceId };
    if (type === "BUILT_IN" || type === "CUSTOM" || type === "MARKETPLACE") {
      where.type = type;
    }
    if (enabled === "true") where.isEnabled = true;
    if (enabled === "false") where.isEnabled = false;

    const pagination = parsePagination(req);

    const [agents, total] = await Promise.all([
      prisma.agent.findMany({
        where,
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
          createdAt: true,
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
        orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
        ...prismaPagination(pagination),
      }),
      prisma.agent.count({ where }),
    ]);

    const { items, meta } = buildPaginationResult(agents, pagination, total);

    return withHeaders(apiOk(items, meta), rateLimitHeaders);
  } catch (error) {
    console.error("List agents error:", error);
    return withHeaders(apiError("Failed to list agents", 500), rateLimitHeaders);
  }
}

// ---------------------------------------------------------------------------
// POST /api/v1/agents  —  Install a new agent
// Body: { name, webhookUrl, description?, type?, config?, priority?, events?, iconUrl?, creatorName?, creatorUrl? }
// Requires: READ_WRITE or higher
//
// Atomically creates: Agent + WebhookEndpoint + dedicated ApiKey
// Returns one-time credentials (webhook secret + API key) — store them!
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const result = await withApiAuth(req, { permission: "READ_WRITE" });
  if (!result.ok) return result.response;
  const { ctx, rateLimitHeaders } = result;

  try {
    const body = await req.json();

    if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
      return withHeaders(apiError("name is required", 400), rateLimitHeaders);
    }

    if (!body.webhookUrl || typeof body.webhookUrl !== "string") {
      return withHeaders(
        apiError("webhookUrl is required", 400),
        rateLimitHeaders,
      );
    }

    const installResult = await installAgent(
      ctx.workspaceId,
      ctx.auth.userId,
      {
        name: body.name,
        description: body.description,
        type: body.type,
        webhookUrl: body.webhookUrl,
        iconUrl: body.iconUrl,
        creatorName: body.creatorName,
        creatorUrl: body.creatorUrl,
        config: body.config,
        priority: typeof body.priority === "number" ? body.priority : undefined,
        events: body.events,
      },
    );

    return withHeaders(
      apiOk(
        {
          ...installResult.agent,
          credentials: {
            webhookSecret: installResult.webhookSecret,
            apiKey: installResult.apiKeyRaw,
          },
        },
        undefined,
        201,
      ),
      rateLimitHeaders,
    );
  } catch (error) {
    console.error("Install agent error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to install agent";
    const status = message.includes("HTTPS") || message.includes("URL") ? 400 : 500;
    return withHeaders(apiError(message, status), rateLimitHeaders);
  }
}

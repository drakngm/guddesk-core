/**
 * MCP HTTP Transport Endpoint
 *
 * Implements the MCP Streamable HTTP transport at /api/mcp.
 * Supports GET (SSE stream), POST (JSON-RPC messages), and DELETE (session close).
 *
 * Authentication: Bearer token in the Authorization header (GudDesk API key).
 * Mode: Stateless — each request creates a fresh server + transport.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { authenticateMcp } from "@/lib/mcp/auth";
import { createMcpServer } from "@/lib/mcp/server";

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

async function handleMcpRequest(req: Request): Promise<Response> {
  // Extract API key from Authorization header
  const authHeader = req.headers.get("authorization");
  const apiKey = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;

  if (!apiKey) {
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Missing Authorization header. Use: Bearer gd_..." },
        id: null,
      }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const auth = await authenticateMcp(apiKey);
  if (!auth) {
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Invalid or expired API key" },
        id: null,
      }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  // Create a per-request server + transport (stateless mode)
  const server: McpServer = createMcpServer(auth);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless — no session management
  });

  await server.connect(transport);

  return transport.handleRequest(req);
}

// ---------------------------------------------------------------------------
// Exports — Next.js App Router handlers
// ---------------------------------------------------------------------------

export { handleMcpRequest as GET, handleMcpRequest as POST, handleMcpRequest as DELETE };

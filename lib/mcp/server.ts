/**
 * MCP Server factory.
 *
 * Creates a McpServer instance with all GudDesk tools registered,
 * scoped to the authenticated user's workspace.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { McpAuthContext } from "./auth";
import { registerConversationTools } from "./tools/conversations";
import { registerMessageTools } from "./tools/messages";
import { registerCustomerTools } from "./tools/customers";
import { registerArticleTools } from "./tools/articles";
import { registerWorkspaceTools } from "./tools/workspace";
import { registerAgentTools } from "./tools/agents";
import { registerCompanyTools } from "./tools/companies";
import { registerSegmentTools } from "./tools/segments";

/**
 * Create a fully-configured MCP server for the given auth context.
 *
 * Auth is resolved once at connection time and shared by all tool handlers.
 */
export function createMcpServer(auth: McpAuthContext): McpServer {
  const server = new McpServer({
    name: "guddesk",
    version: "1.0.0",
  });

  // Register all tool modules
  registerConversationTools(server, auth);
  registerMessageTools(server, auth);
  registerCustomerTools(server, auth);
  registerArticleTools(server, auth);
  registerWorkspaceTools(server, auth);
  registerAgentTools(server, auth);
  registerCompanyTools(server, auth);
  registerSegmentTools(server, auth);

  return server;
}

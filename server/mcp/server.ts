import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Request, Response } from "express";
import { registerEstimateTools } from "./tools/estimates.js";
import { registerPresentationTools } from "./tools/presentations.js";
import { createAuditLog } from "../lib/mcp-storage.js";

function buildMcpServer(tokenId: string, tokenPrefix: string, ip: string): McpServer {
  const server = new McpServer({
    name: "skale-club",
    version: "1.0.0",
  });

  const audit = createAuditLog;
  registerEstimateTools(server, audit, tokenId, tokenPrefix, ip);
  registerPresentationTools(server, audit, tokenId, tokenPrefix, ip);

  return server;
}

export async function handleMcpRequest(req: Request, res: Response, tokenId: string, tokenPrefix: string) {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() ?? req.socket.remoteAddress ?? "";

  const mcpServer = buildMcpServer(tokenId, tokenPrefix, ip);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  res.on("close", () => {
    transport.close();
    mcpServer.close();
  });

  await mcpServer.connect(transport);
  await transport.handleRequest(req, res, req.body);
}

const ACCEPT_ERROR = "Not Acceptable: Client must accept text/event-stream";
const METHOD_ERROR = "Method not allowed.";

function rejection(status: number, message: string, headers: Record<string, string> = {}) {
  return {
    status,
    headers,
    body: { jsonrpc: "2.0", error: { code: -32000, message }, id: null },
  };
}

/**
 * Answers the requests the MCP transport would refuse anyway, with the same response.
 *
 * The transport reports these through its onerror hook, and Sentry's MCP instrumentation turns
 * that into an unhandled error. Clients probe the endpoint this way as routine (HEAD, then GET
 * with no SSE Accept header), so each probe filed an event against a server that had answered
 * correctly (SKALECLUB-BACKEND-H). A test pins this to the SDK's own responses.
 */
export function rejectUnservableMcpRequest(method: string, accept: string | undefined) {
  if (!["GET", "POST", "DELETE"].includes(method)) {
    return rejection(405, METHOD_ERROR, { Allow: "GET, POST, DELETE" });
  }
  if (method === "GET" && !accept?.includes("text/event-stream")) {
    return rejection(406, ACCEPT_ERROR);
  }
  return null;
}

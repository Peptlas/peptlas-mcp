// The MCP server over Streamable HTTP, stateless: clients on the 2025 handshake and on the
// 2026-07-28 revision alike. Nothing is stored and tool arguments are never logged.
import { createMcpHandler } from '@modelcontextprotocol/server';
import { createServer, DOCS_URL } from './server.mjs';

export const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
  'access-control-allow-headers': 'content-type, accept, authorization, mcp-protocol-version, mcp-session-id, mcp-method, mcp-name, last-event-id',
  'access-control-expose-headers': 'mcp-session-id, mcp-protocol-version',
  'access-control-max-age': '86400',
};

function withCors(response) {
  const r = new Response(response.body, response);
  for (const [k, v] of Object.entries(CORS)) r.headers.set(k, v);
  return r;
}

/**
 * A fetch handler bound to one atlas loader. The atlas can't change inside a deployment,
 * so it is loaded once and the handler reused for every later request.
 * @param {() => Promise<any>} loadAtlas
 * @returns {(request: Request) => Promise<Response>}
 */
export function createMcpFetch(loadAtlas) {
  let handler;
  return async (request) => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    // A person who opens the endpoint in a browser gets the instructions, not a protocol error.
    if (request.method === 'GET' && (request.headers.get('accept') ?? '').includes('text/html')) {
      return Response.redirect(DOCS_URL, 302);
    }
    if (!handler) {
      const atlas = await loadAtlas();
      handler = createMcpHandler(() => createServer(atlas), { responseMode: 'json' });
    }
    return withCors(await handler.fetch(request));
  };
}

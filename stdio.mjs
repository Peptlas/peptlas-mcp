#!/usr/bin/env node
// The same server over stdio, for clients that only run local servers. It loads the
// current atlas from peptlas.com once at start-up; the hosted endpoint needs no install.
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { createServer } from './src/server.mjs';

const ATLAS = 'https://peptlas.com/data/atlas.json';
const res = await fetch(ATLAS);
if (!res.ok) {
  console.error(`peptlas-mcp: could not load ${ATLAS} (${res.status})`);
  process.exit(1);
}
await createServer(await res.json()).connect(new StdioServerTransport());

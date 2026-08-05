#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';
import { buildServer } from './server.js';

async function main(): Promise<void> {
  // stdout is the MCP protocol channel — every diagnostic goes to stderr instead.
  const config = loadConfig();
  const server = buildServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('lighterpack-mcp server running on stdio.');
}

main().catch((err: unknown) => {
  console.error('Fatal error starting lighterpack-mcp:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});

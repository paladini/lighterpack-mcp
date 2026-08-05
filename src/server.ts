import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Config } from './config.js';
import { LighterPackClient } from './lighterpack/client.js';
import { SyncEngine } from './lighterpack/sync-engine.js';
import { registerAllTools } from './tools/index.js';

export function buildServer(config: Config): McpServer {
  const client = new LighterPackClient({ baseUrl: config.baseUrl });
  const engine = new SyncEngine({ client, username: config.username, password: config.password });

  const server = new McpServer({ name: 'lighterpack-mcp', version: '0.1.0' });
  registerAllTools(server, engine);
  return server;
}

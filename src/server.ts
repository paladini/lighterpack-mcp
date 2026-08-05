import { LighterPackClient } from '@paladini/lighterpack';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Config } from './config.js';
import { registerAllTools } from './tools/index.js';

export function buildServer(config: Config): McpServer {
  const lp = new LighterPackClient({ username: config.username, password: config.password, baseUrl: config.baseUrl });

  const server = new McpServer({ name: 'lighterpack-mcp', version: '0.1.0' });
  registerAllTools(server, lp);
  return server;
}

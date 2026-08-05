import type { LighterPackClient } from '@paladini/lighterpack';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerBatchTools } from './batch.js';
import { registerCategoryTools } from './categories.js';
import { registerItemFlagTools } from './item-flags.js';
import { registerItemTools } from './items.js';
import { registerLibraryTools } from './library.js';
import { registerListTools } from './lists.js';

export function registerAllTools(server: McpServer, lp: LighterPackClient): void {
  registerLibraryTools(server, lp);
  registerListTools(server, lp);
  registerCategoryTools(server, lp);
  registerItemTools(server, lp);
  registerItemFlagTools(server, lp);
  registerBatchTools(server, lp);
}

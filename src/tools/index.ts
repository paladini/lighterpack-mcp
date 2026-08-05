import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SyncEngine } from '../lighterpack/sync-engine.js';
import { registerBatchTools } from './batch.js';
import { registerCategoryTools } from './categories.js';
import { registerItemFlagTools } from './item-flags.js';
import { registerItemTools } from './items.js';
import { registerLibraryTools } from './library.js';
import { registerListTools } from './lists.js';

export function registerAllTools(server: McpServer, engine: SyncEngine): void {
  registerLibraryTools(server, engine);
  registerListTools(server, engine);
  registerCategoryTools(server, engine);
  registerItemTools(server, engine);
  registerItemFlagTools(server, engine);
  registerBatchTools(server, engine);
}

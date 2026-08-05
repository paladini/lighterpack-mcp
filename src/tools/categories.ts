import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { formatCategory, runTool } from '../formatting/responses.js';
import { addCategory, getList, removeCategory, renameCategory, reorderCategories, setCategoryColor } from '../lighterpack/mutations.js';
import type { SyncEngine } from '../lighterpack/sync-engine.js';
import { hexColorSchema } from './schemas.js';

export function registerCategoryTools(server: McpServer, engine: SyncEngine): void {
  server.registerTool(
    'add_category',
    {
      title: 'Add a category to a list',
      inputSchema: {
        listId: z.number().int(),
        name: z.string().default(''),
        color: hexColorSchema.optional(),
      },
    },
    async ({ listId, name, color }) =>
      runTool(async () =>
        engine.mutate((lib) => {
          const category = addCategory(lib, listId, { name, color });
          return formatCategory(lib, category, getList(lib, listId).optionalFields);
        }),
      ),
  );

  server.registerTool(
    'rename_category',
    {
      title: 'Rename a category',
      inputSchema: { categoryId: z.number().int(), name: z.string() },
    },
    async ({ categoryId, name }) =>
      runTool(async () =>
        engine.mutate((lib) => {
          renameCategory(lib, categoryId, name);
          return { categoryId, name };
        }),
      ),
  );

  server.registerTool(
    'set_category_color',
    {
      title: 'Set or clear a category color',
      description: 'Sets a category\'s swatch color (hex, e.g. "#ff8800"). Omit color to clear it and let LighterPack auto-assign one.',
      inputSchema: { categoryId: z.number().int(), color: hexColorSchema.optional() },
    },
    async ({ categoryId, color }) =>
      runTool(async () =>
        engine.mutate((lib) => {
          setCategoryColor(lib, categoryId, color);
          return { categoryId, color: color ?? null };
        }),
      ),
  );

  server.registerTool(
    'remove_category',
    {
      title: 'Remove a category',
      description: "Removes a category from a list. Fails if it's the list's last category unless force is true.",
      inputSchema: { listId: z.number().int(), categoryId: z.number().int(), force: z.boolean().default(false) },
    },
    async ({ listId, categoryId, force }) =>
      runTool(async () => {
        await engine.mutate((lib) => removeCategory(lib, listId, categoryId, force));
        return { message: `Category ${categoryId} removed from list ${listId}.` };
      }),
  );

  server.registerTool(
    'reorder_categories',
    {
      title: 'Reorder a list\'s categories',
      description: "Sets the display order of a list's categories. categoryIds must contain exactly the list's existing category ids, just reordered.",
      inputSchema: { listId: z.number().int(), categoryIds: z.array(z.number().int()) },
    },
    async ({ listId, categoryIds }) =>
      runTool(async () => {
        await engine.mutate((lib) => reorderCategories(lib, listId, categoryIds));
        return { listId, categoryIds };
      }),
  );
}

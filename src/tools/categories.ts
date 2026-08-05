import type { LighterPackClient } from '@paladini/lighterpack';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { runTool } from '../formatting/responses.js';
import { hexColorSchema } from './schemas.js';

export function registerCategoryTools(server: McpServer, lp: LighterPackClient): void {
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
    async ({ listId, name, color }) => runTool(async () => lp.categories.add(listId, { name, color })),
  );

  server.registerTool(
    'rename_category',
    {
      title: 'Rename a category',
      inputSchema: { categoryId: z.number().int(), name: z.string() },
    },
    async ({ categoryId, name }) =>
      runTool(async () => {
        await lp.categories.rename(categoryId, name);
        return { categoryId, name };
      }),
  );

  server.registerTool(
    'set_category_color',
    {
      title: 'Set or clear a category color',
      description: 'Sets a category\'s swatch color (hex, e.g. "#ff8800"). Omit color to clear it and let LighterPack auto-assign one.',
      inputSchema: { categoryId: z.number().int(), color: hexColorSchema.optional() },
    },
    async ({ categoryId, color }) =>
      runTool(async () => {
        await lp.categories.setColor(categoryId, color);
        return { categoryId, color: color ?? null };
      }),
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
        await lp.categories.remove(listId, categoryId, force);
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
        await lp.categories.reorder(listId, categoryIds);
        return { listId, categoryIds };
      }),
  );
}

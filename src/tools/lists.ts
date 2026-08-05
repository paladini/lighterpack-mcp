import type { LighterPackClient } from '@paladini/lighterpack';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { runTool } from '../formatting/responses.js';
import { listOptionalFieldsPatchSchema } from './schemas.js';

export function registerListTools(server: McpServer, lp: LighterPackClient): void {
  server.registerTool(
    'create_list',
    {
      title: 'Create a packing list',
      description: 'Creates a new, empty packing list.',
      inputSchema: {
        name: z.string().default(''),
        description: z.string().default(''),
      },
    },
    async ({ name, description }) => runTool(async () => lp.lists.create({ name, description })),
  );

  server.registerTool(
    'list_lists',
    {
      title: 'List all packing lists',
      description: 'Returns a summary (name, category count, total weight/price) of every packing list in the account.',
      inputSchema: {},
    },
    async () => runTool(async () => lp.lists.list()),
  );

  server.registerTool(
    'get_list',
    {
      title: 'Get a packing list',
      description: 'Returns full detail for one packing list: every category, every item (with weight, price, qty, worn/consumable/star flags), and computed totals.',
      inputSchema: { listId: z.number().int() },
    },
    async ({ listId }) => runTool(async () => lp.lists.get(listId)),
  );

  server.registerTool(
    'rename_list',
    {
      title: 'Rename a packing list',
      inputSchema: { listId: z.number().int(), name: z.string() },
    },
    async ({ listId, name }) => runTool(async () => lp.lists.rename(listId, name)),
  );

  server.registerTool(
    'set_list_description',
    {
      title: 'Set a packing list description',
      inputSchema: { listId: z.number().int(), description: z.string() },
    },
    async ({ listId, description }) => runTool(async () => lp.lists.setDescription(listId, description)),
  );

  server.registerTool(
    'set_list_optional_fields',
    {
      title: 'Toggle a list\'s optional columns',
      description: 'Toggles which optional columns show for a list: item images, prices, worn, consumable, list description, and total pack weight. Only the keys you pass are changed.',
      inputSchema: { listId: z.number().int(), fields: listOptionalFieldsPatchSchema },
    },
    async ({ listId, fields }) => runTool(async () => lp.lists.setOptionalFields(listId, fields)),
  );

  server.registerTool(
    'copy_list',
    {
      title: 'Copy a packing list',
      description: 'Duplicates a list and its categories. The copy references the SAME item rows as the original (shared items — editing one updates both); use fork_item afterwards to detach a specific item.',
      inputSchema: { listId: z.number().int(), newName: z.string().optional() },
    },
    async ({ listId, newName }) => runTool(async () => lp.lists.copy(listId, newName)),
  );

  server.registerTool(
    'delete_list',
    {
      title: 'Delete a packing list',
      description: 'Deletes a list and all its categories. Fails if this is the only remaining list in the account. Items that are also referenced by other lists are left intact.',
      inputSchema: { listId: z.number().int() },
    },
    async ({ listId }) =>
      runTool(async () => {
        await lp.lists.delete(listId);
        return { message: `List ${listId} deleted.` };
      }),
  );

  server.registerTool(
    'generate_share_link',
    {
      title: 'Generate a public share link',
      description: 'Mints a public, read-only share link for a list (https://lighterpack.com/r/<code>). Anyone with the link can view the list without an account.',
      inputSchema: { listId: z.number().int() },
    },
    async ({ listId }) =>
      runTool(async () => {
        const shareUrl = await lp.lists.generateShareLink(listId);
        return { shareUrl };
      }),
  );
}

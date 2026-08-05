import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { formatListDetail, formatListSummary, runTool } from '../formatting/responses.js';
import {
  copyList,
  createList,
  deleteList,
  getList,
  renameList,
  setListDescription,
  setListExternalId,
  setListOptionalFields,
} from '../lighterpack/mutations.js';
import type { SyncEngine } from '../lighterpack/sync-engine.js';
import { listOptionalFieldsPatchSchema } from './schemas.js';

export function registerListTools(server: McpServer, engine: SyncEngine): void {
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
    async ({ name, description }) =>
      runTool(async () => engine.mutate((lib) => formatListSummary(lib, createList(lib, { name, description })))),
  );

  server.registerTool(
    'list_lists',
    {
      title: 'List all packing lists',
      description: 'Returns a summary (name, category count, total weight/price) of every packing list in the account.',
      inputSchema: {},
    },
    async () => runTool(async () => engine.read((lib) => lib.lists.map((list) => formatListSummary(lib, list)))),
  );

  server.registerTool(
    'get_list',
    {
      title: 'Get a packing list',
      description: 'Returns full detail for one packing list: every category, every item (with weight, price, qty, worn/consumable/star flags), and computed totals.',
      inputSchema: { listId: z.number().int() },
    },
    async ({ listId }) => runTool(async () => engine.read((lib) => formatListDetail(lib, getList(lib, listId)))),
  );

  server.registerTool(
    'rename_list',
    {
      title: 'Rename a packing list',
      inputSchema: { listId: z.number().int(), name: z.string() },
    },
    async ({ listId, name }) =>
      runTool(async () => engine.mutate((lib) => formatListSummary(lib, renameList(lib, listId, name)))),
  );

  server.registerTool(
    'set_list_description',
    {
      title: 'Set a packing list description',
      inputSchema: { listId: z.number().int(), description: z.string() },
    },
    async ({ listId, description }) =>
      runTool(async () => engine.mutate((lib) => formatListSummary(lib, setListDescription(lib, listId, description)))),
  );

  server.registerTool(
    'set_list_optional_fields',
    {
      title: 'Toggle a list\'s optional columns',
      description: 'Toggles which optional columns show for a list: item images, prices, worn, consumable, list description, and total pack weight. Only the keys you pass are changed.',
      inputSchema: { listId: z.number().int(), fields: listOptionalFieldsPatchSchema },
    },
    async ({ listId, fields }) =>
      runTool(async () => engine.mutate((lib) => formatListSummary(lib, setListOptionalFields(lib, listId, fields)))),
  );

  server.registerTool(
    'copy_list',
    {
      title: 'Copy a packing list',
      description: 'Duplicates a list and its categories. The copy references the SAME item rows as the original (shared items — editing one updates both); use fork_item afterwards to detach a specific item.',
      inputSchema: { listId: z.number().int(), newName: z.string().optional() },
    },
    async ({ listId, newName }) =>
      runTool(async () => engine.mutate((lib) => formatListSummary(lib, copyList(lib, listId, newName)))),
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
        await engine.mutate((lib) => deleteList(lib, listId));
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
        const slug = await engine.mintShareSlug();
        await engine.mutate((lib) => setListExternalId(lib, listId, slug));
        return { shareUrl: `https://lighterpack.com/r/${slug}` };
      }),
  );
}

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { formatItem, runTool } from '../formatting/responses.js';
import {
  decrementItemQuantity,
  getItem,
  incrementItemQuantity,
  setItemConsumable,
  setItemQuantity,
  setItemStar,
  setItemWorn,
} from '../lighterpack/mutations.js';
import type { SyncEngine } from '../lighterpack/sync-engine.js';
import { starSchema } from './schemas.js';

export function registerItemFlagTools(server: McpServer, engine: SyncEngine): void {
  server.registerTool(
    'set_item_quantity',
    {
      title: 'Set an item\'s quantity',
      inputSchema: { categoryId: z.number().int(), itemId: z.number().int(), qty: z.number().min(0) },
    },
    async ({ categoryId, itemId, qty }) =>
      runTool(async () =>
        engine.mutate((lib) => {
          const categoryItem = setItemQuantity(lib, categoryId, itemId, qty);
          return formatItem(getItem(lib, itemId), categoryItem);
        }),
      ),
  );

  server.registerTool(
    'increment_item_quantity',
    {
      title: 'Increase an item\'s quantity',
      inputSchema: { categoryId: z.number().int(), itemId: z.number().int(), by: z.number().min(0).default(1) },
    },
    async ({ categoryId, itemId, by }) =>
      runTool(async () =>
        engine.mutate((lib) => {
          const categoryItem = incrementItemQuantity(lib, categoryId, itemId, by);
          return formatItem(getItem(lib, itemId), categoryItem);
        }),
      ),
  );

  server.registerTool(
    'decrement_item_quantity',
    {
      title: 'Decrease an item\'s quantity',
      description: 'Decreases quantity, floored at 0 (never negative).',
      inputSchema: { categoryId: z.number().int(), itemId: z.number().int(), by: z.number().min(0).default(1) },
    },
    async ({ categoryId, itemId, by }) =>
      runTool(async () =>
        engine.mutate((lib) => {
          const categoryItem = decrementItemQuantity(lib, categoryId, itemId, by);
          return formatItem(getItem(lib, itemId), categoryItem);
        }),
      ),
  );

  server.registerTool(
    'set_item_worn',
    {
      title: 'Mark an item as worn/not worn',
      description: 'Worn and consumable are mutually exclusive: setting worn=true automatically clears consumable on this item placement.',
      inputSchema: { categoryId: z.number().int(), itemId: z.number().int(), worn: z.boolean() },
    },
    async ({ categoryId, itemId, worn }) =>
      runTool(async () =>
        engine.mutate((lib) => {
          const categoryItem = setItemWorn(lib, categoryId, itemId, worn);
          return formatItem(getItem(lib, itemId), categoryItem);
        }),
      ),
  );

  server.registerTool(
    'set_item_consumable',
    {
      title: 'Mark an item as consumable/not consumable',
      description: 'Worn and consumable are mutually exclusive: setting consumable=true automatically clears worn on this item placement.',
      inputSchema: { categoryId: z.number().int(), itemId: z.number().int(), consumable: z.boolean() },
    },
    async ({ categoryId, itemId, consumable }) =>
      runTool(async () =>
        engine.mutate((lib) => {
          const categoryItem = setItemConsumable(lib, categoryId, itemId, consumable);
          return formatItem(getItem(lib, itemId), categoryItem);
        }),
      ),
  );

  server.registerTool(
    'set_item_star',
    {
      title: 'Set an item\'s star/favorite level',
      description: 'Sets the star level for this item placement: 0 = unstarred, 1 = favorite, up to 3 (LighterPack\'s star is a 3-level rating, not a plain on/off flag).',
      inputSchema: { categoryId: z.number().int(), itemId: z.number().int(), star: starSchema },
    },
    async ({ categoryId, itemId, star }) =>
      runTool(async () =>
        engine.mutate((lib) => {
          const categoryItem = setItemStar(lib, categoryId, itemId, star);
          return formatItem(getItem(lib, itemId), categoryItem);
        }),
      ),
  );
}

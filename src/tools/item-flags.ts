import type { LighterPackClient } from '@paladini/lighterpack';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { runTool } from '../formatting/responses.js';
import { starSchema } from './schemas.js';

export function registerItemFlagTools(server: McpServer, lp: LighterPackClient): void {
  server.registerTool(
    'set_item_quantity',
    {
      title: 'Set an item\'s quantity',
      inputSchema: { categoryId: z.number().int(), itemId: z.number().int(), qty: z.number().min(0) },
    },
    async ({ categoryId, itemId, qty }) => runTool(async () => lp.items.setQuantity(categoryId, itemId, qty)),
  );

  server.registerTool(
    'increment_item_quantity',
    {
      title: 'Increase an item\'s quantity',
      inputSchema: { categoryId: z.number().int(), itemId: z.number().int(), by: z.number().min(0).default(1) },
    },
    async ({ categoryId, itemId, by }) => runTool(async () => lp.items.incrementQuantity(categoryId, itemId, by)),
  );

  server.registerTool(
    'decrement_item_quantity',
    {
      title: 'Decrease an item\'s quantity',
      description: 'Decreases quantity, floored at 0 (never negative).',
      inputSchema: { categoryId: z.number().int(), itemId: z.number().int(), by: z.number().min(0).default(1) },
    },
    async ({ categoryId, itemId, by }) => runTool(async () => lp.items.decrementQuantity(categoryId, itemId, by)),
  );

  server.registerTool(
    'set_item_worn',
    {
      title: 'Mark an item as worn/not worn',
      description: 'Worn and consumable are mutually exclusive: setting worn=true automatically clears consumable on this item placement.',
      inputSchema: { categoryId: z.number().int(), itemId: z.number().int(), worn: z.boolean() },
    },
    async ({ categoryId, itemId, worn }) => runTool(async () => lp.items.setWorn(categoryId, itemId, worn)),
  );

  server.registerTool(
    'set_item_consumable',
    {
      title: 'Mark an item as consumable/not consumable',
      description: 'Worn and consumable are mutually exclusive: setting consumable=true automatically clears worn on this item placement.',
      inputSchema: { categoryId: z.number().int(), itemId: z.number().int(), consumable: z.boolean() },
    },
    async ({ categoryId, itemId, consumable }) => runTool(async () => lp.items.setConsumable(categoryId, itemId, consumable)),
  );

  server.registerTool(
    'set_item_star',
    {
      title: 'Set an item\'s star/favorite level',
      description: 'Sets the star level for this item placement: 0 = unstarred, 1 = favorite, up to 3 (LighterPack\'s star is a 3-level rating, not a plain on/off flag).',
      inputSchema: { categoryId: z.number().int(), itemId: z.number().int(), star: starSchema },
    },
    async ({ categoryId, itemId, star }) => runTool(async () => lp.items.setStar(categoryId, itemId, star)),
  );
}

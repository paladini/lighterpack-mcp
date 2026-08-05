import type { LighterPackClient } from '@paladini/lighterpack';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { runTool } from '../formatting/responses.js';
import { hexColorSchema, starSchema, weightUnitSchema } from './schemas.js';

const itemInputSchema = z.object({
  existingItemId: z.number().int().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  weight: z.number().min(0).optional(),
  weightUnit: weightUnitSchema.default('g'),
  price: z.number().min(0).optional(),
  url: z.string().optional(),
  imageUrl: z.string().optional(),
  qty: z.number().min(0).default(1),
  worn: z.boolean().optional(),
  consumable: z.boolean().optional(),
  star: starSchema.optional(),
});

export function registerBatchTools(server: McpServer, lp: LighterPackClient): void {
  server.registerTool(
    'add_items_batch',
    {
      title: 'Add multiple items to a category at once',
      description: 'Adds several items to one category in a single save round-trip — much more efficient than calling add_item_to_category repeatedly.',
      inputSchema: { categoryId: z.number().int(), items: z.array(itemInputSchema).min(1) },
    },
    async ({ categoryId, items }) => runTool(async () => lp.batch.addItems(categoryId, items)),
  );

  server.registerTool(
    'create_list_with_items',
    {
      title: 'Create a whole list with categories and items at once',
      description: 'Scaffolds a complete new list — categories and their items — in a single save round-trip.',
      inputSchema: {
        name: z.string(),
        description: z.string().default(''),
        categories: z
          .array(
            z.object({
              name: z.string(),
              color: hexColorSchema.optional(),
              items: z.array(itemInputSchema).default([]),
            }),
          )
          .min(1),
      },
    },
    async ({ name, description, categories }) =>
      runTool(async () => lp.batch.createListWithItems({ name, description, categories })),
  );

  const batchUpdateEntrySchema = z.object({
    itemId: z.number().int(),
    categoryId: z.number().int().optional().describe('Required if flags (qty/worn/consumable/star) are being changed — flags live on the item\'s placement in a specific category.'),
    fields: z
      .object({
        name: z.string().optional(),
        description: z.string().optional(),
        price: z.number().min(0).optional(),
        weight: z.number().min(0).optional(),
        weightUnit: weightUnitSchema.optional(),
        url: z.string().optional(),
        imageUrl: z.string().optional(),
      })
      .optional(),
    flags: z
      .object({
        qty: z.number().min(0).optional(),
        worn: z.boolean().optional(),
        consumable: z.boolean().optional(),
        star: starSchema.optional(),
      })
      .optional(),
  });

  server.registerTool(
    'batch_update_items',
    {
      title: 'Update multiple items at once',
      description: 'Applies field edits (name/description/price/weight/url/imageUrl) and/or flag edits (qty/worn/consumable/star) across many items in a single save round-trip.',
      inputSchema: { updates: z.array(batchUpdateEntrySchema).min(1) },
    },
    async ({ updates }) => runTool(async () => lp.batch.updateItems(updates)),
  );
}

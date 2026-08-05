import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { formatItem, formatListDetail, runTool } from '../formatting/responses.js';
import { ValidationError } from '../lighterpack/errors.js';
import {
  addCategory,
  addItemToCategory,
  createList,
  getCategory,
  getItem,
  setItemConsumable,
  setItemQuantity,
  setItemStar,
  setItemWorn,
  updateItem,
} from '../lighterpack/mutations.js';
import type { SyncEngine } from '../lighterpack/sync-engine.js';
import type { WeightUnit } from '../lighterpack/weight.js';
import { weightToMg } from '../lighterpack/weight.js';
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

type ItemInput = z.infer<typeof itemInputSchema>;

function toNewItemFields(input: ItemInput) {
  return {
    existingItemId: input.existingItemId,
    name: input.name,
    description: input.description,
    weightMg: input.weight !== undefined ? weightToMg(input.weight, input.weightUnit) : undefined,
    authorUnit: input.weightUnit,
    price: input.price,
    url: input.url,
    imageUrl: input.imageUrl,
    qty: input.qty,
    worn: input.worn,
    consumable: input.consumable,
    star: input.star,
  };
}

export function registerBatchTools(server: McpServer, engine: SyncEngine): void {
  server.registerTool(
    'add_items_batch',
    {
      title: 'Add multiple items to a category at once',
      description: 'Adds several items to one category in a single save round-trip — much more efficient than calling add_item_to_category repeatedly.',
      inputSchema: { categoryId: z.number().int(), items: z.array(itemInputSchema).min(1) },
    },
    async ({ categoryId, items }) =>
      runTool(async () =>
        engine.mutate((lib) =>
          items.map((input) => {
            const { item, categoryItem } = addItemToCategory(lib, categoryId, toNewItemFields(input));
            return formatItem(item, categoryItem);
          }),
        ),
      ),
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
      runTool(async () =>
        engine.mutate((lib) => {
          const list = createList(lib, { name, description });
          for (const categoryInput of categories) {
            const category = addCategory(lib, list.id, { name: categoryInput.name, color: categoryInput.color });
            for (const itemInput of categoryInput.items) {
              addItemToCategory(lib, category.id, toNewItemFields(itemInput));
            }
          }
          return formatListDetail(lib, list);
        }),
      ),
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
    async ({ updates }) =>
      runTool(async () =>
        engine.mutate((lib) =>
          updates.map((update) => {
            if (update.fields) {
              if (update.fields.weight !== undefined && update.fields.weightUnit === undefined) {
                throw new ValidationError(`weightUnit is required alongside weight for item ${update.itemId}.`);
              }
              updateItem(lib, update.itemId, {
                name: update.fields.name,
                description: update.fields.description,
                price: update.fields.price,
                weightMg: update.fields.weight !== undefined ? weightToMg(update.fields.weight, update.fields.weightUnit as WeightUnit) : undefined,
                authorUnit: update.fields.weightUnit,
                url: update.fields.url,
                imageUrl: update.fields.imageUrl,
              });
            }
            if (update.flags) {
              if (update.categoryId === undefined) {
                throw new ValidationError(`categoryId is required to update flags for item ${update.itemId}.`);
              }
              if (update.flags.qty !== undefined) setItemQuantity(lib, update.categoryId, update.itemId, update.flags.qty);
              if (update.flags.worn !== undefined) setItemWorn(lib, update.categoryId, update.itemId, update.flags.worn);
              if (update.flags.consumable !== undefined) setItemConsumable(lib, update.categoryId, update.itemId, update.flags.consumable);
              if (update.flags.star !== undefined) setItemStar(lib, update.categoryId, update.itemId, update.flags.star);
            }
            const categoryItem =
              update.categoryId !== undefined
                ? getCategory(lib, update.categoryId).categoryItems.find((ci) => ci.itemId === update.itemId)
                : undefined;
            return formatItem(getItem(lib, update.itemId), categoryItem);
          }),
        ),
      ),
  );
}

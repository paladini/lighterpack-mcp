import { readFile } from 'node:fs/promises';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { formatItem, runTool } from '../formatting/responses.js';
import {
  addItemToCategory,
  deleteItem,
  forkItem,
  removeItemFromCategory,
  updateItem,
} from '../lighterpack/mutations.js';
import type { SyncEngine } from '../lighterpack/sync-engine.js';
import { ValidationError } from '../lighterpack/errors.js';
import { weightToMg } from '../lighterpack/weight.js';
import { starSchema, weightUnitSchema } from './schemas.js';

const IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export function registerItemTools(server: McpServer, engine: SyncEngine): void {
  server.registerTool(
    'add_item_to_category',
    {
      title: 'Add an item to a category',
      description: 'Adds a new item to a category, or — if existingItemId is given — links an already-existing item into this category as a shared item (editing it later updates every category it appears in).',
      inputSchema: {
        categoryId: z.number().int(),
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
      },
    },
    async ({ categoryId, existingItemId, name, description, weight, weightUnit, price, url, imageUrl, qty, worn, consumable, star }) =>
      runTool(async () =>
        engine.mutate((lib) => {
          const { item, categoryItem } = addItemToCategory(lib, categoryId, {
            existingItemId,
            name,
            description,
            weightMg: weight !== undefined ? weightToMg(weight, weightUnit) : undefined,
            authorUnit: weightUnit,
            price,
            url,
            imageUrl,
            qty,
            worn,
            consumable,
            star,
          });
          return formatItem(item, categoryItem);
        }),
      ),
  );

  server.registerTool(
    'update_item',
    {
      title: 'Update an item\'s fields',
      description: 'Patches any subset of an item\'s own fields — name, description, price, weight, link (url), or image URL. This is how you rename an item, change its price, or add a link. Only the fields you pass are changed. Note the item may be shared across multiple categories/lists; this updates it everywhere it appears.',
      inputSchema: {
        itemId: z.number().int(),
        name: z.string().optional(),
        description: z.string().optional(),
        price: z.number().min(0).optional(),
        weight: z.number().min(0).optional(),
        weightUnit: weightUnitSchema.optional(),
        url: z.string().optional(),
        imageUrl: z.string().optional(),
      },
    },
    async ({ itemId, name, description, price, weight, weightUnit, url, imageUrl }) =>
      runTool(async () => {
        if (weight !== undefined && weightUnit === undefined) {
          throw new ValidationError('weightUnit is required when weight is provided.');
        }
        return engine.mutate((lib) => {
          const item = updateItem(lib, itemId, {
            name,
            description,
            price,
            weightMg: weight !== undefined ? weightToMg(weight, weightUnit!) : undefined,
            authorUnit: weightUnit,
            url,
            imageUrl,
          });
          return formatItem(item);
        });
      }),
  );

  server.registerTool(
    'remove_item_from_category',
    {
      title: 'Remove an item from one category',
      description: 'Unlinks an item from a single category. The item row itself (and its placement in any other category) is untouched. Use delete_item to remove it everywhere.',
      inputSchema: { categoryId: z.number().int(), itemId: z.number().int() },
    },
    async ({ categoryId, itemId }) =>
      runTool(async () => {
        await engine.mutate((lib) => removeItemFromCategory(lib, categoryId, itemId));
        return { message: `Item ${itemId} removed from category ${categoryId}.` };
      }),
  );

  server.registerTool(
    'delete_item',
    {
      title: 'Delete an item entirely',
      description: 'Deletes an item from the library and unlinks it from every category/list that references it. This cannot be undone.',
      inputSchema: { itemId: z.number().int() },
    },
    async ({ itemId }) =>
      runTool(async () => {
        await engine.mutate((lib) => deleteItem(lib, itemId));
        return { message: `Item ${itemId} deleted.` };
      }),
  );

  server.registerTool(
    'fork_item',
    {
      title: 'Fork a shared item',
      description: 'Detaches a shared item into an independent copy for one specific list, so future edits to the original no longer affect this list\'s copy.',
      inputSchema: { itemId: z.number().int(), listId: z.number().int() },
    },
    async ({ itemId, listId }) => runTool(async () => engine.mutate((lib) => formatItem(forkItem(lib, itemId, listId)))),
  );

  server.registerTool(
    'set_item_image_url',
    {
      title: 'Set an item\'s image from a URL',
      description: 'Points an item at an externally-hosted image URL (no upload involved). Use upload_item_image instead to upload a local/binary image.',
      inputSchema: { itemId: z.number().int(), imageUrl: z.string().url() },
    },
    async ({ itemId, imageUrl }) => runTool(async () => engine.mutate((lib) => formatItem(updateItem(lib, itemId, { imageUrl })))),
  );

  server.registerTool(
    'upload_item_image',
    {
      title: 'Upload a photo for an item',
      description: 'Uploads a local image file (JPEG/PNG/WebP, 5MB max) to LighterPack and sets it as the item\'s photo. Provide either filePath (read from disk) or imageBase64 (raw base64-encoded bytes) plus mimeType.',
      inputSchema: {
        itemId: z.number().int(),
        filePath: z.string().optional(),
        imageBase64: z.string().optional(),
        mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']).optional(),
      },
    },
    async ({ itemId, filePath, imageBase64, mimeType }) =>
      runTool(async () => {
        if (!filePath && !imageBase64) {
          throw new ValidationError('Provide either filePath or imageBase64.');
        }
        let buffer: Buffer;
        let filename: string;
        let resolvedMimeType: string;

        if (filePath) {
          buffer = await readFile(filePath);
          filename = filePath.split(/[/\\]/).pop() ?? 'image';
          const ext = filename.split('.').pop()?.toLowerCase() ?? '';
          resolvedMimeType = mimeType ?? IMAGE_MIME_BY_EXTENSION[ext] ?? '';
          if (!resolvedMimeType) {
            throw new ValidationError(`Could not infer an image MIME type from "${filename}" — pass mimeType explicitly.`);
          }
        } else {
          if (!mimeType) throw new ValidationError('mimeType is required when uploading via imageBase64.');
          buffer = Buffer.from(imageBase64!, 'base64');
          resolvedMimeType = mimeType;
          filename = `item-${itemId}.${resolvedMimeType.split('/')[1]}`;
        }

        const imageUrl = await engine.uploadImage({ buffer, filename, mimeType: resolvedMimeType });
        return engine.mutate((lib) => formatItem(updateItem(lib, itemId, { imageUrl })));
      }),
  );
}

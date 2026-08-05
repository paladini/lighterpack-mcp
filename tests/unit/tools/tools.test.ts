import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '../../../src/lighterpack/errors.js';
import { createEmptyLibrary } from '../../../src/lighterpack/mutations.js';
import { SyncEngine, type LighterPackClientPort } from '../../../src/lighterpack/sync-engine.js';
import type { Library } from '../../../src/lighterpack/types.js';
import { registerAllTools } from '../../../src/tools/index.js';

/** A minimal stand-in for the real LighterPack server: same sync_token contract, in-memory. */
class FakeLighterPackBackend implements LighterPackClientPort {
  private library: Library;
  private syncToken = 0;
  private shareSlugCounter = 0;

  constructor(initialLibrary: Library) {
    this.library = initialLibrary;
  }

  async signIn() {
    return { username: 'tester', library: JSON.stringify(this.library), syncToken: this.syncToken };
  }

  async saveLibrary(input: { syncToken: number; data: string }) {
    if (input.syncToken !== this.syncToken) {
      throw new ApiError('Your list is out of date - please refresh your browser.', 400);
    }
    this.library = JSON.parse(input.data) as Library;
    this.syncToken += 1;
    return { syncToken: this.syncToken };
  }

  async uploadImage() {
    return { imageUrl: '/userimages/fake.webp' };
  }

  async generateExternalId() {
    this.shareSlugCounter += 1;
    return { externalId: `slug${this.shareSlugCounter}` };
  }
}

interface ToolTextResult {
  isError?: boolean;
  content: { type: string; text?: string }[];
}

function parseText<T = Record<string, unknown>>(result: ToolTextResult): T {
  const text = result.content[0]?.text;
  if (text === undefined) throw new Error('Tool result had no text content.');
  return JSON.parse(text) as T;
}

describe('MCP tools (end-to-end over the real protocol)', () => {
  let client: Client;
  let server: McpServer;

  beforeEach(async () => {
    const backend = new FakeLighterPackBackend(createEmptyLibrary());
    const engine = new SyncEngine({ client: backend, username: 'tester', password: 'hunter2' });
    server = new McpServer({ name: 'lighterpack-mcp-test', version: '0.0.0' });
    registerAllTools(server, engine);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'test-client', version: '0.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  });

  afterEach(async () => {
    await client.close();
    await server.close();
  });

  async function callTool(name: string, args: Record<string, unknown> = {}): Promise<ToolTextResult> {
    return (await client.callTool({ name, arguments: args })) as unknown as ToolTextResult;
  }

  it('get_account_info reflects the freshly-registered library', async () => {
    const result = await callTool('get_account_info');
    const body = parseText<{ listCount: number; categoryCount: number; itemCount: number }>(result);
    expect(body).toMatchObject({ listCount: 1, categoryCount: 1, itemCount: 1 });
  });

  it('creates a list, adds a category, and adds an item — then reads it back via get_list', async () => {
    const list = parseText<{ listId: number }>(await callTool('create_list', { name: 'Desert trip' }));
    const category = parseText<{ categoryId: number }>(await callTool('add_category', { listId: list.listId, name: 'Shelter' }));
    const item = parseText<{ itemId: number; weightGrams: number }>(
      await callTool('add_item_to_category', {
        categoryId: category.categoryId,
        name: 'Tent',
        weight: 850,
        weightUnit: 'g',
        price: 199.99,
      }),
    );
    expect(item.weightGrams).toBe(850);

    const detail = parseText<{ categories: { categoryId: number; items: { itemId: number; name: string }[] }[] }>(
      await callTool('get_list', { listId: list.listId }),
    );
    const shelterCategory = detail.categories.find((c) => c.categoryId === category.categoryId);
    expect(shelterCategory?.items.some((i) => i.itemId === item.itemId && i.name === 'Tent')).toBe(true);
  });

  it('rename_list, set_list_description, and set_list_optional_fields all persist', async () => {
    const list = parseText<{ listId: number }>(await callTool('create_list', {}));
    await callTool('rename_list', { listId: list.listId, name: 'Renamed' });
    await callTool('set_list_description', { listId: list.listId, description: 'A trip.' });
    await callTool('set_list_optional_fields', { listId: list.listId, fields: { price: true } });

    const detail = parseText<{ name: string; description: string; optionalFields: { price: boolean } }>(
      await callTool('get_list', { listId: list.listId }),
    );
    expect(detail.name).toBe('Renamed');
    expect(detail.description).toBe('A trip.');
    expect(detail.optionalFields.price).toBe(true);
  });

  it('refuses to remove the last category in a list without force, and surfaces it as isError', async () => {
    const lists = parseText<{ listId: number }[]>(await callTool('list_lists'));
    const detail = parseText<{ categories: { categoryId: number }[] }>(await callTool('get_list', { listId: lists[0]!.listId }));
    const onlyCategoryId = detail.categories[0]!.categoryId;

    const result = await callTool('remove_category', { listId: lists[0]!.listId, categoryId: onlyCategoryId });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toMatch(/last category/i);
  });

  it('worn and consumable are mutually exclusive through the item-flags tools', async () => {
    const lists = parseText<{ listId: number }[]>(await callTool('list_lists'));
    const detail = parseText<{ categories: { categoryId: number; items: { itemId: number }[] }[] }>(
      await callTool('get_list', { listId: lists[0]!.listId }),
    );
    const categoryId = detail.categories[0]!.categoryId;
    const itemId = detail.categories[0]!.items[0]!.itemId;

    await callTool('set_item_consumable', { categoryId, itemId, consumable: true });
    const worn = parseText<{ worn: boolean; consumable: boolean }>(await callTool('set_item_worn', { categoryId, itemId, worn: true }));
    expect(worn.worn).toBe(true);
    expect(worn.consumable).toBe(false);
  });

  it('set_item_star accepts 0-3 and rejects out-of-range values at the schema layer', async () => {
    const lists = parseText<{ listId: number }[]>(await callTool('list_lists'));
    const detail = parseText<{ categories: { categoryId: number; items: { itemId: number }[] }[] }>(
      await callTool('get_list', { listId: lists[0]!.listId }),
    );
    const categoryId = detail.categories[0]!.categoryId;
    const itemId = detail.categories[0]!.items[0]!.itemId;

    const starred = parseText<{ star: number }>(await callTool('set_item_star', { categoryId, itemId, star: 2 }));
    expect(starred.star).toBe(2);

    const rejected = await callTool('set_item_star', { categoryId, itemId, star: 5 });
    expect(rejected.isError).toBe(true);
  });

  it('add_items_batch adds several items in one call', async () => {
    const list = parseText<{ listId: number }>(await callTool('create_list', {}));
    const category = parseText<{ categoryId: number }>(await callTool('add_category', { listId: list.listId, name: 'Cooking' }));

    const added = parseText<{ name: string }[]>(
      await callTool('add_items_batch', {
        categoryId: category.categoryId,
        items: [
          { name: 'Stove', weight: 100, weightUnit: 'g' },
          { name: 'Pot', weight: 300, weightUnit: 'g' },
        ],
      }),
    );
    expect(added.map((i) => i.name)).toEqual(['Stove', 'Pot']);
  });

  it('create_list_with_items scaffolds a full list in one call', async () => {
    const result = parseText<{ name: string; categories: { name: string; items: { name: string }[] }[] }>(
      await callTool('create_list_with_items', {
        name: 'Full trip',
        categories: [
          { name: 'Shelter', items: [{ name: 'Tent', weight: 800, weightUnit: 'g' }] },
          { name: 'Sleep', items: [{ name: 'Bag', weight: 600, weightUnit: 'g' }, { name: 'Pad', weight: 400, weightUnit: 'g' }] },
        ],
      }),
    );
    expect(result.name).toBe('Full trip');
    expect(result.categories.map((c) => c.name)).toEqual(['Shelter', 'Sleep']);
    expect(result.categories[1]!.items.map((i) => i.name)).toEqual(['Bag', 'Pad']);
  });

  it('batch_update_items edits fields and flags for multiple items in one call', async () => {
    const list = parseText<{ listId: number }>(await callTool('create_list', {}));
    const category = parseText<{ categoryId: number }>(await callTool('add_category', { listId: list.listId, name: 'Gear' }));
    const added = parseText<{ itemId: number }[]>(
      await callTool('add_items_batch', {
        categoryId: category.categoryId,
        items: [{ name: 'A', weight: 1, weightUnit: 'g' }, { name: 'B', weight: 1, weightUnit: 'g' }],
      }),
    );

    const updated = parseText<{ itemId: number; price: number; qty: number }[]>(
      await callTool('batch_update_items', {
        updates: [
          { itemId: added[0]!.itemId, fields: { price: 10 }, flags: { qty: 3 }, categoryId: category.categoryId },
          { itemId: added[1]!.itemId, fields: { price: 20 } },
        ],
      }),
    );
    expect(updated[0]).toMatchObject({ price: 10, qty: 3 });
    expect(updated[1]).toMatchObject({ price: 20 });
  });

  it('generate_share_link mints a slug and writes it onto the list', async () => {
    const list = parseText<{ listId: number }>(await callTool('create_list', { name: 'Shareable' }));
    const shared = parseText<{ shareUrl: string }>(await callTool('generate_share_link', { listId: list.listId }));
    expect(shared.shareUrl).toMatch(/^https:\/\/lighterpack\.com\/r\/\S+$/);

    const detail = parseText<{ shareUrl: string }>(await callTool('get_list', { listId: list.listId }));
    expect(detail.shareUrl).toBe(shared.shareUrl);
  });

  it('fork_item detaches a shared item so editing the original no longer affects the fork', async () => {
    const list = parseText<{ listId: number }>(await callTool('create_list', {}));
    const catA = parseText<{ categoryId: number }>(await callTool('add_category', { listId: list.listId, name: 'A' }));
    const item = parseText<{ itemId: number }>(await callTool('add_item_to_category', { categoryId: catA.categoryId, name: 'Shared knife' }));

    const list2 = parseText<{ listId: number }>(await callTool('create_list', { name: 'Second list' }));
    const catB = parseText<{ categoryId: number }>(await callTool('add_category', { listId: list2.listId, name: 'B' }));
    await callTool('add_item_to_category', { categoryId: catB.categoryId, existingItemId: item.itemId });

    const forked = parseText<{ itemId: number }>(await callTool('fork_item', { itemId: item.itemId, listId: list2.listId }));
    expect(forked.itemId).not.toBe(item.itemId);

    await callTool('update_item', { itemId: item.itemId, name: 'Renamed original' });
    const secondListDetail = parseText<{ categories: { items: { itemId: number; name: string }[] }[] }>(
      await callTool('get_list', { listId: list2.listId }),
    );
    const forkedItem = secondListDetail.categories[0]!.items.find((i) => i.itemId === forked.itemId);
    expect(forkedItem?.name).toBe('Shared knife'); // untouched by the rename on the original
  });

  it('delete_item removes it from every category that referenced it', async () => {
    const list = parseText<{ listId: number }>(await callTool('create_list', {}));
    const cat = parseText<{ categoryId: number }>(await callTool('add_category', { listId: list.listId, name: 'Cat' }));
    const item = parseText<{ itemId: number }>(await callTool('add_item_to_category', { categoryId: cat.categoryId, name: 'Doomed' }));

    await callTool('delete_item', { itemId: item.itemId });

    const detail = parseText<{ categories: { items: { itemId: number }[] }[] }>(await callTool('get_list', { listId: list.listId }));
    expect(detail.categories[0]!.items.some((i) => i.itemId === item.itemId)).toBe(false);
  });
});

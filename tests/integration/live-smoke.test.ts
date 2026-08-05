// Opt-in end-to-end test against the REAL lighterpack.com API (or LIGHTERPACK_BASE_URL,
// for self-hosted instances). Requires LIGHTERPACK_USERNAME/PASSWORD for an account it's
// safe to create and delete a list in. Run with: RUN_INTEGRATION=1 npm run test:integration
// (npm run verify-live-login sets up a disposable test account and writes .env for you.)

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LighterPackClient } from '@paladini/lighterpack';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config.js';
import { registerAllTools } from '../../src/tools/index.js';

function loadDotEnvIfPresent(): void {
  const envPath = fileURLToPath(new URL('../../.env', import.meta.url));
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotEnvIfPresent();

interface ToolTextResult {
  isError?: boolean;
  content: { type: string; text?: string }[];
}

function parseText<T = Record<string, unknown>>(result: ToolTextResult): T {
  const text = result.content[0]?.text;
  if (text === undefined) throw new Error(`Tool result had no text content: ${JSON.stringify(result)}`);
  return JSON.parse(text) as T;
}

describe.skipIf(process.env.RUN_INTEGRATION !== '1')('LighterPack live integration smoke test', () => {
  let client: Client;
  let server: McpServer;

  beforeAll(async () => {
    const config = loadConfig();
    const lp = new LighterPackClient({ username: config.username, password: config.password, baseUrl: config.baseUrl });

    server = new McpServer({ name: 'lighterpack-mcp-integration', version: '0.0.0' });
    registerAllTools(server, lp);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'integration-test-client', version: '0.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  });

  afterAll(async () => {
    await client?.close();
    await server?.close();
  });

  async function callTool(name: string, args: Record<string, unknown> = {}): Promise<ToolTextResult> {
    return (await client.callTool({ name, arguments: args })) as unknown as ToolTextResult;
  }

  it(
    'create_list -> add_category -> add_items_batch -> set flags -> generate_share_link -> delete_list',
    async () => {
      const list = parseText<{ listId: number; name: string }>(
        await callTool('create_list', { name: `mcp-integration-test-${Date.now()}` }),
      );
      expect(list.listId).toBeGreaterThan(0);

      const category = parseText<{ categoryId: number }>(await callTool('add_category', { listId: list.listId, name: 'Gear' }));

      const items = parseText<{ itemId: number; name: string; weightGrams: number }[]>(
        await callTool('add_items_batch', {
          categoryId: category.categoryId,
          items: [
            { name: 'Tent', weight: 850, weightUnit: 'g', price: 199.99 },
            { name: 'Rain jacket', weight: 300, weightUnit: 'g', worn: true },
          ],
        }),
      );
      expect(items).toHaveLength(2);
      expect(items[0]!.weightGrams).toBe(850);

      const wornItem = items.find((i) => i.name === 'Rain jacket')!;
      const wornResult = parseText<{ worn: boolean; consumable: boolean }>(
        await callTool('set_item_worn', { categoryId: category.categoryId, itemId: wornItem.itemId, worn: true }),
      );
      expect(wornResult.worn).toBe(true);
      expect(wornResult.consumable).toBe(false);

      const shared = parseText<{ shareUrl: string }>(await callTool('generate_share_link', { listId: list.listId }));
      expect(shared.shareUrl).toMatch(/^https:\/\/lighterpack\.com\/r\/\S+$/);

      const detail = parseText<{ totals: { weightGrams: number } }>(await callTool('get_list', { listId: list.listId }));
      expect(detail.totals.weightGrams).toBeCloseTo(1150, 0);

      const cleanup = await callTool('delete_list', { listId: list.listId });
      expect(cleanup.isError).toBeFalsy();
    },
    30_000,
  );
});

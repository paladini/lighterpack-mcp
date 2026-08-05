import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { setCurrencySymbol, setItemUnit, setTotalUnit } from '../lighterpack/mutations.js';
import type { SyncEngine } from '../lighterpack/sync-engine.js';
import { runTool } from '../formatting/responses.js';
import { weightUnitSchema } from './schemas.js';

export function registerLibraryTools(server: McpServer, engine: SyncEngine): void {
  server.registerTool(
    'get_account_info',
    {
      title: 'Get LighterPack account info',
      description: 'Returns the signed-in username and a summary of the whole library: how many lists, categories, and items exist, plus library-wide settings (units, currency symbol).',
      inputSchema: {},
    },
    async () =>
      runTool(async () =>
        engine.read((lib) => ({
          listCount: lib.lists.length,
          categoryCount: lib.categories.length,
          itemCount: lib.items.length,
          totalUnit: lib.totalUnit,
          itemUnit: lib.itemUnit,
          currencySymbol: lib.currencySymbol,
        })),
      ),
  );

  server.registerTool(
    'refresh_library',
    {
      title: 'Refresh library from LighterPack',
      description: 'Forces a re-fetch of the entire library from the LighterPack server, discarding the local cache. Use this if you suspect the data changed elsewhere (e.g. the user editing lighterpack.com directly) mid-session.',
      inputSchema: {},
    },
    async () =>
      runTool(async () => {
        await engine.refresh();
        return { message: 'Library refreshed.' };
      }),
  );

  server.registerTool(
    'set_total_unit',
    {
      title: 'Set list total display unit',
      description: "Sets the unit LighterPack's own UI uses to display list totals (oz/lb/g/kg). This does not affect the units this MCP server reports back to you — tool responses always use grams.",
      inputSchema: { unit: weightUnitSchema },
    },
    async ({ unit }) =>
      runTool(async () => {
        await engine.mutate((lib) => setTotalUnit(lib, unit));
        return { message: `Total display unit set to ${unit}.` };
      }),
  );

  server.registerTool(
    'set_item_unit',
    {
      title: 'Set default unit for new items',
      description: "Sets the unit LighterPack's own UI pre-fills when a person adds a new item there. Items you add through this MCP server always take an explicit weight_unit per call, so this only affects lighterpack.com's own editing UI.",
      inputSchema: { unit: weightUnitSchema },
    },
    async ({ unit }) =>
      runTool(async () => {
        await engine.mutate((lib) => setItemUnit(lib, unit));
        return { message: `Default item unit set to ${unit}.` };
      }),
  );

  server.registerTool(
    'set_currency_symbol',
    {
      title: 'Set currency symbol',
      description: 'Sets the currency symbol (1-4 characters, e.g. "$", "€", "R$") shown next to prices.',
      inputSchema: { symbol: z.string().min(1).max(4) },
    },
    async ({ symbol }) =>
      runTool(async () => {
        await engine.mutate((lib) => setCurrencySymbol(lib, symbol));
        return { message: `Currency symbol set to "${symbol}".` };
      }),
  );
}

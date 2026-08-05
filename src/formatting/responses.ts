import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { ApiError, LighterPackAuthError, NotFoundError, SyncConflictError, ValidationError } from '../lighterpack/errors.js';
import { calculateCategorySubtotal, calculateListTotals } from '../lighterpack/mutations.js';
import type { Category, CategoryItem, Item, Library, List } from '../lighterpack/types.js';
import { mgToWeight } from '../lighterpack/weight.js';

export function toolResult(data: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

export function toolError(err: unknown): CallToolResult {
  return { content: [{ type: 'text', text: describeError(err) }], isError: true };
}

function describeError(err: unknown): string {
  if (err instanceof NotFoundError || err instanceof ValidationError) return err.message;
  if (err instanceof SyncConflictError) return `Conflict: ${err.message}`;
  if (err instanceof LighterPackAuthError) return `Authentication failed: ${err.message}`;
  if (err instanceof ApiError) return `LighterPack API error (${err.status}): ${err.message}`;
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}

/** Runs `fn` and converts the outcome into an MCP tool result, success or error alike. */
export async function runTool(fn: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    return toolResult(await fn());
  } catch (err) {
    return toolError(err);
  }
}

const GRAMS_DECIMALS = 100;

function toGrams(mg: number): number {
  return Math.round(mgToWeight(mg, 'g') * GRAMS_DECIMALS) / GRAMS_DECIMALS;
}

export function formatItem(item: Item, categoryItem?: CategoryItem): Record<string, unknown> {
  return {
    itemId: item.id,
    name: item.name,
    description: item.description,
    weightGrams: toGrams(item.weight),
    weightMg: item.weight,
    authorUnit: item.authorUnit,
    price: item.price,
    url: item.url || undefined,
    imageUrl: item.imageUrl || undefined,
    ...(categoryItem
      ? {
          qty: categoryItem.qty,
          worn: !!categoryItem.worn,
          consumable: categoryItem.consumable,
          star: categoryItem.star,
        }
      : {}),
  };
}

export function formatCategory(library: Library, category: Category, optionalFields: List['optionalFields']): Record<string, unknown> {
  const subtotal = calculateCategorySubtotal(library, category, optionalFields);
  return {
    categoryId: category.id,
    name: category.name,
    color: category.color,
    items: category.categoryItems.map((ci) => {
      const item = library.items.find((i) => i.id === ci.itemId);
      return item ? formatItem(item, ci) : { itemId: ci.itemId, error: 'referenced item is missing from the library' };
    }),
    subtotal: {
      weightGrams: toGrams(subtotal.subtotalWeight),
      wornWeightGrams: toGrams(subtotal.subtotalWornWeight),
      consumableWeightGrams: toGrams(subtotal.subtotalConsumableWeight),
      price: round2(subtotal.subtotalPrice),
      consumablePrice: round2(subtotal.subtotalConsumablePrice),
      qty: subtotal.subtotalQty,
    },
  };
}

export function formatListDetail(library: Library, list: List): Record<string, unknown> {
  const totals = calculateListTotals(library, list);
  return {
    listId: list.id,
    name: list.name,
    description: list.description,
    shareUrl: list.externalId ? `https://lighterpack.com/r/${list.externalId}` : undefined,
    optionalFields: list.optionalFields,
    categories: list.categoryIds
      .map((id) => library.categories.find((c) => c.id === id))
      .filter((c): c is Category => !!c)
      .map((c) => formatCategory(library, c, list.optionalFields)),
    totals: {
      weightGrams: toGrams(totals.totalWeight),
      wornWeightGrams: toGrams(totals.totalWornWeight),
      consumableWeightGrams: toGrams(totals.totalConsumableWeight),
      baseWeightGrams: toGrams(totals.totalBaseWeight),
      packWeightGrams: toGrams(totals.totalPackWeight),
      price: round2(totals.totalPrice),
      consumablePrice: round2(totals.totalConsumablePrice),
      qty: totals.totalQty,
    },
  };
}

export function formatListSummary(library: Library, list: List): Record<string, unknown> {
  const totals = calculateListTotals(library, list);
  return {
    listId: list.id,
    name: list.name,
    description: list.description,
    isDefault: library.defaultListId === list.id,
    shareUrl: list.externalId ? `https://lighterpack.com/r/${list.externalId}` : undefined,
    categoryCount: list.categoryIds.length,
    totalWeightGrams: toGrams(totals.totalWeight),
    totalPrice: round2(totals.totalPrice),
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

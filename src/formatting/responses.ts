import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { ApiError, LighterPackAuthError, NotFoundError, SyncConflictError, ValidationError } from '@paladini/lighterpack';

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

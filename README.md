# lighterpack-mcp

[![CI](https://github.com/paladini/lighterpack-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/paladini/lighterpack-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node >=20](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](package.json)

An [MCP](https://modelcontextprotocol.io) server that lets AI agents create and manage [LighterPack](https://lighterpack.com) packing lists — add gear, track weights, organize categories, and share lists, all through natural conversation.

> **Unofficial.** This project is not affiliated with or endorsed by LighterPack. It talks to LighterPack's own web API (the same one lighterpack.com's browser client uses) — see [Architecture](#architecture) below.

## What is this?

[LighterPack](https://lighterpack.com) is a free tool backpackers and travelers use to plan and share packing lists — tracking item weights, prices, and categories to optimize what they bring. This MCP server exposes LighterPack's list/category/item model as ~35 tools, so an MCP-compatible AI agent (Claude Desktop, Claude Code, etc.) can build and edit packing lists on your behalf: *"Create a 3-day backpacking list with a Shelter category containing my tent and rain jacket, mark the jacket as worn, and give me a share link."*

## Quick start

Requires Node.js ≥20 and a [LighterPack](https://lighterpack.com) account.

```bash
npx @paladini/lighterpack-mcp
```

Add it to your MCP client's config (example for Claude Desktop, `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "lighterpack": {
      "command": "npx",
      "args": ["-y", "@paladini/lighterpack-mcp"],
      "env": {
        "LIGHTERPACK_USERNAME": "your-username",
        "LIGHTERPACK_PASSWORD": "your-password"
      }
    }
  }
}
```

## Configuration

| Env var | Required | Default | Description |
|---|---|---|---|
| `LIGHTERPACK_USERNAME` | Yes | — | Your LighterPack account username. |
| `LIGHTERPACK_PASSWORD` | Yes | — | Your LighterPack account password. |
| `LIGHTERPACK_BASE_URL` | No | `https://lighterpack.com` | Point at a self-hosted LighterPack instance ([it's open source too](https://github.com/galenmaly/lighterpack)). |

One account per server instance — there's no tool to switch accounts mid-session, by design.

## Tool reference

Weights are always in **grams** at the tool boundary (`weight` / `weightUnit` inputs, `weightGrams` outputs), regardless of what unit LighterPack's own UI happens to display. Internally LighterPack always stores weight in milligrams, so nothing is lost either way.

### Library / account

| Tool | Description |
|---|---|
| `get_account_info` | Signed-in username plus list/category/item counts and library-wide settings. |
| `refresh_library` | Force a re-fetch from LighterPack, discarding the local cache. |
| `set_total_unit` | Unit LighterPack's UI uses to display list totals. |
| `set_item_unit` | Default unit LighterPack's UI pre-fills for new items. |
| `set_currency_symbol` | Currency symbol shown next to prices (1-4 chars). |

### Lists

| Tool | Description |
|---|---|
| `create_list` | Create a new, empty packing list. |
| `list_lists` | Summary of every list (name, category count, totals). |
| `get_list` | Full detail for one list: categories, items, computed totals. |
| `rename_list` | Rename a list. |
| `set_list_description` | Set a list's description. |
| `set_list_optional_fields` | Toggle optional columns: images, price, worn, consumable, list description, pack weight. |
| `copy_list` | Duplicate a list (categories copied, items shared with the original). |
| `delete_list` | Delete a list (fails if it's the only one). |
| `generate_share_link` | Mint a public read-only share link (`lighterpack.com/r/<code>`). |

### Categories

| Tool | Description |
|---|---|
| `add_category` | Add a category to a list. |
| `rename_category` | Rename a category. |
| `set_category_color` | Set or clear a category's swatch color. |
| `remove_category` | Remove a category (fails on a list's last category unless `force`). |
| `reorder_categories` | Set a list's category display order. |

### Items

| Tool | Description |
|---|---|
| `add_item_to_category` | Add a new item to a category, or link an existing item (shared item). |
| `update_item` | Patch name, description, price, weight, link, or image URL. |
| `remove_item_from_category` | Unlink an item from one category (keeps the item elsewhere). |
| `delete_item` | Delete an item everywhere it's referenced. Cannot be undone. |
| `fork_item` | Detach a shared item into an independent copy for one list. |
| `set_item_image_url` | Point an item at an external image URL. |
| `upload_item_image` | Upload a local/binary photo (JPEG/PNG/WebP, 5MB max) and attach it. |

### Item flags (per category placement)

| Tool | Description |
|---|---|
| `set_item_quantity` | Set exact quantity. |
| `increment_item_quantity` / `decrement_item_quantity` | Adjust quantity by N (floored at 0). |
| `set_item_worn` | Mark worn/not worn (auto-clears `consumable` — they're mutually exclusive). |
| `set_item_consumable` | Mark consumable/not consumable (auto-clears `worn`). |
| `set_item_star` | Set the favorite/priority level: 0 (none) to 3 — LighterPack's star is a 3-level rating, not a plain flag. |

### Batch / composite

| Tool | Description |
|---|---|
| `add_items_batch` | Add several items to one category in a single save round-trip. |
| `create_list_with_items` | Scaffold a whole list — categories and items — in one call. |
| `batch_update_items` | Apply field and/or flag edits across many items in one call. |

Deliberately out of scope: account registration/deletion, password/email changes, and password recovery — high-risk, low-value for an agent to hold.

## Architecture

LighterPack has no granular REST API — there's no "create list" or "add item" endpoint. Instead, a user's entire library (every list, category, and item) is a single JSON document, synced via `POST /saveLibrary` with an optimistic-concurrency token (`sync_token`). That fetch → mutate → save cycle, the sync_token retry logic, and the business rules (worn/consumable exclusivity, id sequencing, shared items, etc. — ported from LighterPack's own [open-source client](https://github.com/galenmaly/lighterpack)) all live in [`@paladini/lighterpack`](https://github.com/paladini/lighterpack-sdk), a standalone TypeScript SDK this server depends on. This repo is intentionally thin: `src/tools/*` just registers each MCP tool (Zod input schema + agent-facing description) and calls the corresponding SDK method (`lp.lists.*`, `lp.categories.*`, `lp.items.*`, `lp.batch.*`), returning the SDK's already-formatted view objects (weights in grams, computed totals, etc.) as the tool result.

## Limitations

- No realtime push — if you (or someone else) edits the list on lighterpack.com while an agent session is open, call `refresh_library` to pick up the change.
- One LighterPack account per server instance.
- Account creation/deletion and credential changes are intentionally not exposed as tools.

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for dev setup, testing, and how to add a new tool.

## License

[MIT](LICENSE)

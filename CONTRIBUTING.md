# Contributing

Thanks for considering a contribution to `lighterpack-mcp`! This is a small, focused project — most contributions will be new tools, bug fixes, or documentation improvements.

## Dev setup

```bash
git clone https://github.com/paladini/lighterpack-mcp.git
cd lighterpack-mcp
npm install
npm run build
```

Useful scripts:

| Command | What it does |
|---|---|
| `npm run dev` | Run the server directly with `tsx` (no build step). |
| `npm run typecheck` | `tsc --noEmit` across `src/`, `tests/`, and `scripts/`. |
| `npm run lint` / `npm run lint:fix` | ESLint. |
| `npm test` | Unit tests (`tests/unit/**`) — fast, no network. |
| `npm run test:integration` | Opt-in live test against a real LighterPack account — see below. |
| `npm run verify-live-login` | Registers a disposable LighterPack test account and writes its credentials to `.env`. |
| `npm run inspector` | Launches [MCP Inspector](https://github.com/modelcontextprotocol/inspector) against the built server for manual testing. |

## Testing

Two tiers:

- **Unit tests** (`tests/unit/`) never touch the network. `mutations.ts` is tested against in-memory fixtures; `client.ts` and `sync-engine.ts` are tested with a mocked HTTP layer / mocked client; the `tools/*` suite spins up a real `McpServer` + `Client` over an in-memory transport pair and drives every tool through the actual MCP protocol.
- **Integration test** (`tests/integration/live-smoke.test.ts`) hits the real LighterPack API end-to-end (create → edit → share → delete). It's skipped by default and gated behind `RUN_INTEGRATION=1` plus real `LIGHTERPACK_USERNAME`/`LIGHTERPACK_PASSWORD` — run `npm run verify-live-login` first if you don't have a disposable test account handy. It is **not** part of CI (no credentials are stored in this repo).

## How to add a new tool

1. Add the pure business logic to [`src/lighterpack/mutations.ts`](src/lighterpack/mutations.ts) (or extend an existing function) — this is the single source of truth for what's a valid mutation. Add a unit test in `tests/unit/mutations.test.ts` covering the new behavior, including any edge cases (invalid input, not-found ids, business-rule guards).
2. Register the tool in the appropriate file under `src/tools/` (`library.ts`, `lists.ts`, `categories.ts`, `items.ts`, `item-flags.ts`, or `batch.ts`), with a `zod` input schema and a clear `description` — this is what the calling agent sees, so make it specific about units, side effects, and any business rules (e.g. "worn and consumable are mutually exclusive").
3. If the tool returns data, format it through `src/formatting/responses.ts` helpers (`formatItem`, `formatCategory`, `formatListDetail`, etc.) rather than returning raw internal types — keeps output units (grams, not milligrams) and shapes consistent across tools.
4. Add a case to `tests/unit/tools/tools.test.ts` that calls the tool through the real MCP protocol (not just the mutation function) and asserts on the result.
5. Add a row to the tool reference table in `README.md`.

**`mutations.ts` is the highest-value review surface in this codebase.** It's an independent reimplementation of the business rules in LighterPack's own [`client/dataTypes.js`](https://github.com/galenmaly/lighterpack/blob/main/client/dataTypes.js) (worn/consumable exclusivity, star range, id sequencing, shared-item semantics, last-category/last-list guards). A subtle divergence there won't fail loudly — it'll silently write data LighterPack's own UI didn't expect. If you're touching it, cross-check against the upstream source and lean on the existing test coverage as a spec.

## Code style

- TypeScript, `strict: true`. Prefer explicit types on function boundaries; let inference handle the rest.
- No comments explaining *what* code does — name things clearly instead. A comment is for a non-obvious *why* (a business rule, a workaround, an upstream quirk).
- Run `npm run lint:fix` and `npm run typecheck` before opening a PR.

## Pull requests

- Keep PRs focused — one tool, one fix, or one doc improvement per PR is easier to review than a grab-bag.
- Update the README tool table if you add/change a tool's behavior.
- CI runs lint, typecheck, unit tests, and build on every PR. Please make sure it's green.

## Reporting bugs / requesting features

Use the issue templates — they ask for the specific tool called, its arguments, and whether you're on lighterpack.com or a self-hosted instance, which is usually the fastest way to a root cause.

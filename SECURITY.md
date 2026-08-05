# Security Policy

## Reporting a vulnerability

This server handles your LighterPack password (via the `LIGHTERPACK_PASSWORD`
environment variable) and holds an authenticated session cookie in memory for
the life of the process. If you find a security issue — credential handling,
injection, SSRF via `LIGHTERPACK_BASE_URL`, or anything else — please report it
privately rather than opening a public issue:

- Open a [GitHub security advisory](../../security/advisories/new) on this
  repository, or
- Email the maintainer listed on the npm package page.

Please include steps to reproduce and the potential impact. We'll acknowledge
reports within a few days.

## Scope

In scope: this server's own code (`src/`, `scripts/`). LighterPack's own
service (lighterpack.com) is out of scope for this repository — report issues
with LighterPack itself via [its own repository](https://github.com/galenmaly/lighterpack)
or contact info.

## Supported versions

Only the latest published version on npm is supported. Please upgrade before
reporting an issue that may already be fixed.

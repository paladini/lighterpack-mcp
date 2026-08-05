import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config.js';

describe('loadConfig', () => {
  it('loads username/password and defaults baseUrl', () => {
    const config = loadConfig({ LIGHTERPACK_USERNAME: 'tester', LIGHTERPACK_PASSWORD: 'hunter2' });
    expect(config).toEqual({ username: 'tester', password: 'hunter2', baseUrl: 'https://lighterpack.com' });
  });

  it('honors a custom LIGHTERPACK_BASE_URL for self-hosted instances', () => {
    const config = loadConfig({ LIGHTERPACK_USERNAME: 'tester', LIGHTERPACK_PASSWORD: 'hunter2', LIGHTERPACK_BASE_URL: 'https://lp.example.com' });
    expect(config.baseUrl).toBe('https://lp.example.com');
  });

  it('throws a clear, actionable error when credentials are missing', () => {
    expect(() => loadConfig({})).toThrow(/LIGHTERPACK_USERNAME is required/);
    expect(() => loadConfig({ LIGHTERPACK_USERNAME: 'tester' })).toThrow(/LIGHTERPACK_PASSWORD is required/);
  });

  it('rejects a malformed base URL', () => {
    expect(() =>
      loadConfig({ LIGHTERPACK_USERNAME: 'tester', LIGHTERPACK_PASSWORD: 'hunter2', LIGHTERPACK_BASE_URL: 'not-a-url' }),
    ).toThrow(/valid URL/);
  });
});

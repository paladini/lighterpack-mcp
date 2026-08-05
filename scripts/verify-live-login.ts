// One-off bootstrap: registers a fresh LighterPack test account and confirms
// the full register -> signIn round-trip works against the real site. Prints
// the generated credentials and writes them to .env so the rest of the
// implementation (and the opt-in integration suite) can use them.
//
// Usage: npm run verify-live-login

import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { LighterPackClient } from '../src/lighterpack/client.js';

function randomUsername(): string {
  return `lpmcptest${randomBytes(4).toString('hex')}`;
}

function randomPassword(): string {
  // 24 random bytes -> 32-char base64url string: well above the 5-60 char
  // requirement, no ambiguous characters to worry about copy-pasting.
  return randomBytes(24).toString('base64url');
}

async function main(): Promise<void> {
  const username = randomUsername();
  const password = randomPassword();
  const email = 'fnpaladini+lighterpacktest@gmail.com';

  const client = new LighterPackClient();

  console.error(`Registering test account "${username}"...`);
  const registerResult = await client.register({ username, email, password });

  if (registerResult.username !== username) {
    throw new Error(`Expected username "${username}" back from /register, got "${registerResult.username}".`);
  }
  if (typeof registerResult.syncToken !== 'number') {
    throw new Error(`Expected a numeric sync_token from /register, got ${JSON.stringify(registerResult.syncToken)}.`);
  }
  const parsedLibrary = JSON.parse(registerResult.library) as { lists?: unknown[] };
  if (!Array.isArray(parsedLibrary.lists)) {
    throw new Error(`Expected /register's library field to parse into an object with a lists array, got: ${registerResult.library}`);
  }
  console.error(`Register OK — sync_token=${registerResult.syncToken}, ${parsedLibrary.lists.length} list(s) in the fresh library.`);

  console.error('Confirming a separate signIn() with the same credentials also works...');
  const freshClient = new LighterPackClient();
  const signInResult = await freshClient.signIn({ username, password });
  if (signInResult.username !== username) {
    throw new Error(`Expected username "${username}" back from /signin, got "${signInResult.username}".`);
  }
  console.error(`signIn OK — sync_token=${signInResult.syncToken}.`);

  const envPath = new URL('../.env', import.meta.url);
  const envLine = [
    `LIGHTERPACK_USERNAME=${username}`,
    `LIGHTERPACK_PASSWORD=${password}`,
  ].join('\n');

  if (existsSync(envPath)) {
    const existing = readFileSync(envPath, 'utf8');
    if (existing.includes('LIGHTERPACK_USERNAME=')) {
      console.error('.env already has LIGHTERPACK_USERNAME set — leaving it untouched. Credentials printed below instead.');
      console.error(`\n${envLine}\n`);
    } else {
      writeFileSync(envPath, `${existing.trimEnd()}\n${envLine}\n`);
      console.error(`Appended credentials to ${envPath.pathname}`);
    }
  } else {
    writeFileSync(envPath, `${envLine}\n`);
    console.error(`Wrote credentials to ${envPath.pathname}`);
  }

  console.error('\nDone. This test account can be used for the opt-in integration suite (RUN_INTEGRATION=1) and for manual verification at https://lighterpack.com.');
}

main().catch((err: unknown) => {
  console.error('verify-live-login failed:', err);
  process.exitCode = 1;
});

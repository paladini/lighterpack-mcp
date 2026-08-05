import { z } from 'zod';

const configSchema = z.object({
  username: z.string({ required_error: 'LIGHTERPACK_USERNAME is required.' }).min(1, 'LIGHTERPACK_USERNAME is required.'),
  password: z.string({ required_error: 'LIGHTERPACK_PASSWORD is required.' }).min(1, 'LIGHTERPACK_PASSWORD is required.'),
  baseUrl: z.string().url('LIGHTERPACK_BASE_URL must be a valid URL.').default('https://lighterpack.com'),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = configSchema.safeParse({
    username: env.LIGHTERPACK_USERNAME,
    password: env.LIGHTERPACK_PASSWORD,
    baseUrl: env.LIGHTERPACK_BASE_URL || undefined,
  });

  if (!result.success) {
    const messages = result.error.issues.map((issue) => issue.message).join(' ');
    throw new Error(
      `lighterpack-mcp configuration error: ${messages} Set LIGHTERPACK_USERNAME and LIGHTERPACK_PASSWORD as environment variables (see .env.example).`,
    );
  }

  return result.data;
}

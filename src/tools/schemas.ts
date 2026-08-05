import { WEIGHT_UNITS } from '@paladini/lighterpack';
import { z } from 'zod';

export const weightUnitSchema = z.enum(WEIGHT_UNITS);

export const starSchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);

export const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color like "#ff8800".');

export const listOptionalFieldsPatchSchema = z.object({
  images: z.boolean().optional(),
  price: z.boolean().optional(),
  worn: z.boolean().optional(),
  consumable: z.boolean().optional(),
  listDescription: z.boolean().optional(),
  packWeight: z.boolean().optional(),
});

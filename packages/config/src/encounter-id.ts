import { z } from 'zod';

export type EncounterIdExecutionMode = 'shadow' | 'production';

export const EncounterIdConfigSchema = z.object({
  executionMode: z.enum(['shadow', 'production']).default('shadow'),
  generateFromDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .default('2026-06-24'),
  transferGenerateFromDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .default('2026-06-20'),
});

export type EncounterIdConfig = z.infer<typeof EncounterIdConfigSchema>;

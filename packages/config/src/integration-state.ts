import { z } from 'zod';

export const IntegrationStateConfigSchema = z.object({
  /** Database id from platform config (defaults to localDatabase.id) */
  databaseId: z.string().optional(),
  autoMigrate: z.boolean().default(true),
  maxRetries: z.number().int().nonnegative().default(3),
  deadLetterAfterRetries: z.number().int().positive().default(5),
});

export type IntegrationStateConfig = z.infer<typeof IntegrationStateConfigSchema>;

import { z } from 'zod';

export type ClientRegistryExecutionMode = 'shadow' | 'production';

export const ClientRegistryConfigSchema = z.object({
  executionMode: z.enum(['shadow', 'production']).default('shadow'),
  requireReferral: z.boolean().default(true),
  excludeTemporaryDocuments: z.boolean().default(true),
  maxClientsPerBatch: z.number().int().positive().default(15),
});

export type ClientRegistryConfig = z.infer<typeof ClientRegistryConfigSchema>;

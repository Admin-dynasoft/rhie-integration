import { z } from 'zod';

export type VisitEncounterExecutionMode = 'shadow' | 'production';

export const VisitEncounterConfigSchema = z.object({
  executionMode: z.enum(['shadow', 'production']).default('shadow'),
});

export type VisitEncounterConfig = z.infer<typeof VisitEncounterConfigSchema>;

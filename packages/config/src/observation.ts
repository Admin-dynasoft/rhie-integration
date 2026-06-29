import { z } from 'zod';

export type ObservationExecutionMode = 'shadow' | 'production';

export const ObservationConfigSchema = z.object({
  executionMode: z.enum(['shadow', 'production']).default('shadow'),
});

export type ObservationConfig = z.infer<typeof ObservationConfigSchema>;

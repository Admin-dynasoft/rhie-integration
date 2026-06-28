import { z } from 'zod';

export const EnvironmentDiscoveryConfigSchema = z.object({
  enabled: z.boolean().default(true),
  mode: z.enum(['auto', 'local', 'online']).default('auto'),
  cachePath: z.string().default('./data/discovered-environment.json'),
  centralDatabase: z.string().default('medisoft_hie'),
  excludeDatabases: z.array(z.string()).default([]),
});

export type EnvironmentDiscoveryConfig = z.infer<typeof EnvironmentDiscoveryConfigSchema>;

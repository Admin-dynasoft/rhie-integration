import { z } from 'zod';

export const ReplicationMonitorConfigSchema = z.object({
  pollIntervalMs: z.number().int().positive().default(10000),
  maxLagSeconds: z.number().int().nonnegative().default(30),
  healthPort: z.number().int().positive().default(9088),
  /** When Online DB is not a MySQL replica (dev), treat as healthy */
  treatNonReplicaAsHealthy: z.boolean().default(true),
  /** When replication lag exceeds maxLagSeconds, recommend local mode */
  preferLocalOnLag: z.boolean().default(true),
});

export type ReplicationMonitorConfig = z.infer<typeof ReplicationMonitorConfigSchema>;

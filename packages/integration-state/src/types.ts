export type IntegrationUploadStatus =
  | 'pending'
  | 'processing'
  | 'success'
  | 'failed'
  | 'dead_letter';

export type IntegrationPipelineStage =
  | 'client_registry'
  | 'encounter_id'
  | 'visit_encounter'
  | 'transfer_encounter'
  | 'observation'
  | 'medication'
  | 'laboratory';

export type IntegrationHistoryEventType =
  | 'created'
  | 'processing_started'
  | 'upload_attempt'
  | 'upload_success'
  | 'upload_failed'
  | 'retry_scheduled'
  | 'dead_lettered'
  | 'status_sync';

export interface IntegrationStateRecord {
  id: number;
  facilityCode: string;
  pipelineStage: IntegrationPipelineStage | string;
  entityType: string;
  entityKey: string;
  idempotencyKey: string;
  status: IntegrationUploadStatus;
  retryCount: number;
  rhieResourceId: string | null;
  rhieResourceType: string | null;
  lastErrorMessage: string | null;
  lastAttemptAt: Date | null;
  lastSuccessAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateIntegrationStateInput {
  facilityCode: string;
  pipelineStage: IntegrationPipelineStage | string;
  entityType: string;
  entityKey: string;
  idempotencyKey?: string;
  rhieResourceType?: string;
}

export interface IntegrationHistoryEntry {
  id: number;
  integrationStateId: number;
  eventType: IntegrationHistoryEventType | string;
  status: string;
  message: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface DeadLetterRecord {
  id: number;
  integrationStateId: number;
  facilityCode: string;
  pipelineStage: string;
  idempotencyKey: string;
  reason: string;
  payload: Record<string, unknown> | null;
  movedAt: Date;
}

export interface AppendHistoryInput {
  integrationStateId: number;
  eventType: IntegrationHistoryEventType | string;
  status: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

import type { EncounterIdConfig } from '@rhie/config';
import type { Logger } from '@rhie/logger';
import { rhieSanitizeUpid, rhieUpidIsExcluded } from '@rhie/shared';
import type { BatchResult } from '@rhie/worker-framework';
import {
  EncounterPayloadBuilder,
  serializeEncounterPayload,
} from './encounter-payload.builder.js';
import { generateEncounterUuid, phpTimestamp } from './uuid.js';
import type {
  EncounterGeneratorName,
  GeneratorResult,
  NcdEncounterRow,
} from './types.js';
import { EncounterRepository } from '../repository/encounter.repository.js';

export interface EncounterProcessorDeps {
  repository: EncounterRepository;
  payloadBuilder: EncounterPayloadBuilder;
  logger: Logger;
  config: EncounterIdConfig;
  uuidFactory?: () => string;
  now?: () => Date;
}

export class EncounterProcessor {
  private readonly uuidFactory: () => string;
  private readonly now: () => Date;

  constructor(private readonly deps: EncounterProcessorDeps) {
    this.uuidFactory = deps.uuidFactory ?? generateEncounterUuid;
    this.now = deps.now ?? (() => new Date());
  }

  async processAllGenerators(): Promise<BatchResult> {
    const { generateFromDate, transferGenerateFromDate } = this.deps.config;

    const generators: Array<{
      name: EncounterGeneratorName;
      run: () => Promise<GeneratorResult>;
    }> = [
      { name: 'visit', run: () => this.generateVisitEncounters(generateFromDate) },
      { name: 'transfer', run: () => this.generateTransferEncounters(transferGenerateFromDate) },
      {
        name: 'consultation',
        run: () =>
          this.generateOrdersEncounters(generateFromDate, 'consultation', 'CONSULTATION_ENCOUNTER'),
      },
      { name: 'complaint', run: () => this.generateComplaintEncounters(generateFromDate) },
      { name: 'vital_sign', run: () => this.generateVitalSignEncounters(generateFromDate) },
      { name: 'lab_request', run: () => this.generateLabRequestEncounters(generateFromDate) },
      {
        name: 'medicine',
        run: () => this.generateOrdersEncounters(generateFromDate, 'med', 'MEDICINE_ENCOUNTER'),
      },
      { name: 'lab', run: () => this.generateLabEncounters(generateFromDate) },
      { name: 'diagnostic', run: () => this.generateDiagEncounters(generateFromDate) },
      { name: 'ncd_vital', run: () => this.generateVitalNCDsEncounters(generateFromDate) },
      { name: 'ncd_plaintes', run: () => this.generatePlaintesNCDsEncounters(generateFromDate) },
      {
        name: 'ncd_diagnostic',
        run: () => this.generateDiagnosticNCDsEncounters(generateFromDate),
      },
      { name: 'referral', run: () => this.generateReferralEncounters(generateFromDate) },
    ];

    let processed = 0;
    let failed = 0;
    let skipped = 0;

    for (const generator of generators) {
      try {
        this.deps.logger.debug(
          { event: 'generator_start', generator: generator.name },
          `Starting ${generator.name} encounter generation`,
        );

        const result = await generator.run();
        processed += result.processed;
        failed += result.failed;
        skipped += result.skipped;

        this.deps.logger.debug(
          {
            event: 'generator_complete',
            generator: generator.name,
            ...result,
          },
          `Completed ${generator.name} encounter generation`,
        );
      } catch (error) {
        failed += 1;
        this.deps.logger.error(
          {
            event: 'generator_error',
            generator: generator.name,
            error: error instanceof Error ? error.message : String(error),
          },
          `${generator.name} encounter generation failed`,
        );
      }
    }

    return { processed, failed, skipped };
  }

  private isShadowMode(): boolean {
    return this.deps.config.executionMode === 'shadow';
  }

  private sanitizeUpid(raw: string): string | null {
    const upid = rhieSanitizeUpid(raw) ?? '';
    if (upid === '' || rhieUpidIsExcluded(upid)) {
      return null;
    }
    return upid;
  }

  private groupByKey<T>(rows: T[], keyFn: (row: T) => string): Map<string, T[]> {
    const grouped = new Map<string, T[]>();
    for (const row of rows) {
      const key = keyFn(row);
      const existing = grouped.get(key);
      if (existing) {
        existing.push(row);
      } else {
        grouped.set(key, [row]);
      }
    }
    return grouped;
  }

  private async persistMainEncounter(
    generator: EncounterGeneratorName,
    payload: ReturnType<EncounterPayloadBuilder['buildMainEncounter']>,
    afterInsert?: () => Promise<void>,
  ): Promise<'processed' | 'skipped'> {
    if (this.isShadowMode()) {
      this.deps.logger.info(
        {
          event: 'shadow_payload_built',
          generator,
          table: 'encounter_main',
          payload: serializeEncounterPayload(payload),
        },
        'Shadow mode — main encounter insert skipped',
      );
      return 'processed';
    }

    await this.deps.repository.insertMainEncounter(payload);
    if (afterInsert) {
      await afterInsert();
    }

    this.deps.logger.debug(
      {
        event: 'encounter_inserted',
        generator,
        table: 'encounter_main',
        encountId: payload.encountId,
        type: payload.type,
      },
      'Main encounter inserted',
    );

    return 'processed';
  }

  private async persistPatientEncounter(
    generator: EncounterGeneratorName,
    payload: ReturnType<EncounterPayloadBuilder['buildPatientEncounter']>,
    afterInsert?: () => Promise<void>,
  ): Promise<'processed' | 'skipped'> {
    if (this.isShadowMode()) {
      this.deps.logger.info(
        {
          event: 'shadow_payload_built',
          generator,
          table: 'encounter_patients',
          payload: serializeEncounterPayload(payload),
        },
        'Shadow mode — patient encounter insert skipped',
      );
      return 'processed';
    }

    await this.deps.repository.insertPatientEncounter(payload);
    if (afterInsert) {
      await afterInsert();
    }

    this.deps.logger.debug(
      {
        event: 'encounter_inserted',
        generator,
        table: 'encounter_patients',
        encountId: payload.encountId,
        type: payload.type,
        sourceId: payload.sourceId,
      },
      'Patient encounter inserted',
    );

    return 'processed';
  }

  async generateVisitEncounters(startDate: string): Promise<GeneratorResult> {
    const rows = await this.deps.repository.fetchVisitEncounters(startDate);
    const grouped = this.groupByKey(rows, (row) => `${row.client_id}_${row.date}`);

    let processed = 0;
    let skipped = 0;

    for (const group of grouped.values()) {
      const first = group[0];
      const upid = this.sanitizeUpid(first.upid);
      if (!upid) {
        skipped += 1;
        continue;
      }

      const exists = await this.deps.repository.mainEncounterExists(
        upid,
        first.client_id,
        first.date,
        'VISIT_ENCOUNTER',
      );

      if (exists) {
        skipped += 1;
        continue;
      }

      const uploadedAt = phpTimestamp(this.now());
      const payload = this.deps.payloadBuilder.buildMainEncounter({
        encountId: this.uuidFactory(),
        type: 'VISIT_ENCOUNTER',
        upid,
        clientId: first.client_id,
        date: first.date,
        time: first.time,
        rhieUploadedAt: uploadedAt,
      });

      const result = await this.persistMainEncounter('visit', payload, async () => {
        await this.deps.repository.markVisitAsUploaded(first.client_id);
      });

      if (result === 'processed') processed += 1;
      else skipped += 1;
    }

    return { processed, failed: 0, skipped };
  }

  async generateTransferEncounters(startDate: string): Promise<GeneratorResult> {
    const rows = await this.deps.repository.fetchTransferEncounters(startDate);
    const grouped = this.groupByKey(rows, (row) => `${row.client_id}_${row.date}`);

    let processed = 0;
    let skipped = 0;

    for (const group of grouped.values()) {
      const first = group[0];
      const upid = this.sanitizeUpid(first.upid);
      if (!upid) {
        skipped += 1;
        continue;
      }

      const exists = await this.deps.repository.mainEncounterExists(
        upid,
        first.client_id,
        first.date,
        'E_TRANSFER',
      );

      if (exists) {
        skipped += 1;
        continue;
      }

      const uploadedAt = phpTimestamp(this.now());
      const payload = this.deps.payloadBuilder.buildMainEncounter({
        encountId: this.uuidFactory(),
        type: 'E_TRANSFER',
        upid,
        clientId: first.client_id,
        date: first.date,
        time: first.time,
        rhieUploadedAt: uploadedAt,
      });

      const result = await this.persistMainEncounter('transfer', payload);
      if (result === 'processed') processed += 1;
      else skipped += 1;
    }

    return { processed, failed: 0, skipped };
  }

  async generateOrdersEncounters(
    startDate: string,
    orderType: string,
    typeDisplay: string,
  ): Promise<GeneratorResult> {
    const generator: EncounterGeneratorName =
      orderType === 'consultation' ? 'consultation' : 'medicine';

    const rows = await this.deps.repository.fetchOrdersEncounters(orderType, startDate);
    const grouped = this.groupByKey(rows, (row) => `${row.client_id}_${row.date}`);

    let processed = 0;
    let skipped = 0;

    for (const group of grouped.values()) {
      const first = group[0];
      const upid = this.sanitizeUpid(first.upid);
      if (!upid) {
        skipped += group.length;
        continue;
      }

      for (const order of group) {
        const uploadedAt = phpTimestamp(this.now());
        const payload = this.deps.payloadBuilder.buildPatientEncounter({
          encountId: this.uuidFactory(),
          type: typeDisplay,
          upid,
          clientId: order.client_id,
          sourceId: order.order_id,
          sourceTable: 'orders',
          date: order.date,
          time: order.time,
          rhieUploadedAt: uploadedAt,
        });

        const result = await this.persistPatientEncounter(generator, payload, async () => {
          await this.deps.repository.markOrderAsUploaded(order.order_id);
        });

        if (result === 'processed') processed += 1;
        else skipped += 1;
      }
    }

    return { processed, failed: 0, skipped };
  }

  async generateLabEncounters(startDate: string): Promise<GeneratorResult> {
    const rows = await this.deps.repository.fetchLabResults(startDate);
    const grouped = this.groupByKey(rows, (row) => `${row.client_id}_${row.date}`);

    let processed = 0;
    let skipped = 0;

    for (const group of grouped.values()) {
      const first = group[0];
      const upid = this.sanitizeUpid(first.upid);
      if (!upid) {
        skipped += group.length;
        continue;
      }

      for (const lab of group) {
        const uploadedAt = phpTimestamp(this.now());
        const payload = this.deps.payloadBuilder.buildPatientEncounter({
          encountId: this.uuidFactory(),
          type: 'lab',
          upid,
          clientId: lab.client_id,
          sourceId: lab.test_id,
          sourceTable: 'lab_results',
          date: lab.date,
          time: lab.time,
          rhieUploadedAt: uploadedAt,
        });

        const result = await this.persistPatientEncounter('lab', payload, async () => {
          await this.deps.repository.markLabAsUploaded(lab.test_id);
        });

        if (result === 'processed') processed += 1;
        else skipped += 1;
      }
    }

    return { processed, failed: 0, skipped };
  }

  async generateLabRequestEncounters(startDate: string): Promise<GeneratorResult> {
    const rows = await this.deps.repository.fetchLabRequests(startDate);
    const grouped = this.groupByKey(rows, (row) => `${row.client_id}_${row.date}`);

    let processed = 0;
    let skipped = 0;

    for (const group of grouped.values()) {
      const first = group[0];
      const upid = this.sanitizeUpid(first.upid);
      if (!upid) {
        skipped += group.length;
        continue;
      }

      for (const labRequest of group) {
        const uploadedAt = phpTimestamp(this.now());
        const payload = this.deps.payloadBuilder.buildPatientEncounter({
          encountId: this.uuidFactory(),
          type: 'lab_request',
          upid,
          clientId: labRequest.client_id,
          sourceId: labRequest.order_id,
          sourceTable: 'orders',
          date: labRequest.date,
          time: labRequest.time,
          rhieUploadedAt: uploadedAt,
        });

        const result = await this.persistPatientEncounter('lab_request', payload, async () => {
          await this.deps.repository.markOrderAsUploaded(labRequest.order_id);
        });

        if (result === 'processed') processed += 1;
        else skipped += 1;
      }
    }

    return { processed, failed: 0, skipped };
  }

  async generateDiagEncounters(startDate: string): Promise<GeneratorResult> {
    const rows = await this.deps.repository.fetchDiagEncounters(startDate);
    const grouped = this.groupByKey(rows, (row) => `${row.client_id}_${row.source_date}`);

    let processed = 0;
    let skipped = 0;
    const currentTime = phpTimestamp(this.now());

    for (const group of grouped.values()) {
      const first = group[0];
      const upid = this.sanitizeUpid(first.upid);
      if (!upid) {
        skipped += group.length;
        continue;
      }

      const date = first.source_date;

      const exists = await this.deps.repository.mainEncounterExists(
        upid,
        first.client_id,
        date,
        'consultation',
      );

      if (!exists) {
        const mainPayload = this.deps.payloadBuilder.buildMainEncounter({
          encountId: this.uuidFactory(),
          type: 'consultation',
          upid,
          clientId: first.client_id,
          date,
          time: currentTime,
          rhieUploadedAt: currentTime,
        });

        const mainResult = await this.persistMainEncounter('diagnostic', mainPayload);
        if (mainResult === 'processed') processed += 1;
        else skipped += 1;
      }

      for (const diag of group) {
        const payload = this.deps.payloadBuilder.buildPatientEncounter({
          encountId: this.uuidFactory(),
          type: 'diagnostic',
          upid,
          clientId: diag.client_id,
          sourceId: diag.source_id,
          sourceTable: 'diag_client',
          date: diag.source_date,
          time: currentTime,
          rhieUploadedAt: currentTime,
        });

        const result = await this.persistPatientEncounter('diagnostic', payload, async () => {
          await this.deps.repository.markDiagAsUploaded(diag.client_id, date);
        });

        if (result === 'processed') processed += 1;
        else skipped += 1;
      }
    }

    return { processed, failed: 0, skipped };
  }

  async generateComplaintEncounters(startDate: string): Promise<GeneratorResult> {
    const rows = await this.deps.repository.fetchComplaintEncounters(startDate);
    const grouped = this.groupByKey(rows, (row) => `${row.patient_id}_${row.source_date}`);

    let processed = 0;
    let skipped = 0;
    const currentTime = phpTimestamp(this.now());

    for (const group of grouped.values()) {
      const first = group[0];
      const upid = this.sanitizeUpid(first.upid);
      if (!upid) {
        skipped += group.length;
        continue;
      }

      for (const plainte of group) {
        const payload = this.deps.payloadBuilder.buildPatientEncounter({
          encountId: this.uuidFactory(),
          type: 'complaint',
          upid,
          clientId: plainte.patient_id,
          sourceId: plainte.source_id,
          sourceTable: 'vital_sign',
          date: plainte.source_date,
          time: currentTime,
          rhieUploadedAt: currentTime,
        });

        const result = await this.persistPatientEncounter('complaint', payload, async () => {
          await this.deps.repository.markComplaintAsUploaded(plainte.patient_id, plainte.source_date);
        });

        if (result === 'processed') processed += 1;
        else skipped += 1;
      }
    }

    return { processed, failed: 0, skipped };
  }

  async generateVitalSignEncounters(startDate: string): Promise<GeneratorResult> {
    const rows = await this.deps.repository.fetchVitalSignEncounters(startDate);
    const grouped = this.groupByKey(rows, (row) => `${row.patient_id}_${row.source_date}`);

    let processed = 0;
    let skipped = 0;
    const currentTime = phpTimestamp(this.now());

    for (const group of grouped.values()) {
      const first = group[0];
      const upid = this.sanitizeUpid(first.upid);
      if (!upid) {
        skipped += group.length;
        continue;
      }

      const date = first.source_date;

      const exists = await this.deps.repository.mainEncounterExists(
        upid,
        first.patient_id,
        date,
        'encountervital',
      );

      if (!exists) {
        const mainPayload = this.deps.payloadBuilder.buildMainEncounter({
          encountId: this.uuidFactory(),
          type: 'encounter_vital',
          upid,
          clientId: first.patient_id,
          date,
          time: currentTime,
          rhieUploadedAt: currentTime,
        });

        const mainResult = await this.persistMainEncounter('vital_sign', mainPayload);
        if (mainResult === 'processed') processed += 1;
        else skipped += 1;
      }

      for (const vitalSign of group) {
        const payload = this.deps.payloadBuilder.buildPatientEncounter({
          encountId: this.uuidFactory(),
          type: 'vital_sign',
          upid,
          clientId: vitalSign.patient_id,
          sourceId: vitalSign.source_id,
          sourceTable: 'vital_sign',
          date: vitalSign.source_date,
          time: currentTime,
          rhieUploadedAt: currentTime,
        });

        const result = await this.persistPatientEncounter('vital_sign', payload, async () => {
          await this.deps.repository.markVitalSignAsUploaded(vitalSign.patient_id, date);
        });

        if (result === 'processed') processed += 1;
        else skipped += 1;
      }
    }

    return { processed, failed: 0, skipped };
  }

  private async generateNcdEncounters(
    generator: EncounterGeneratorName,
    startDate: string,
    fetchRows: (date: string) => Promise<NcdEncounterRow[]>,
    mainCheckType: string,
    mainInsertType: string,
    patientType: string,
  ): Promise<GeneratorResult> {
    const rows = await fetchRows(startDate);
    const grouped = this.groupByKey(rows, (row) => `${row.client_id}_${row.source_date}`);

    let processed = 0;
    let skipped = 0;
    const currentTime = phpTimestamp(this.now());

    for (const group of grouped.values()) {
      const first = group[0];
      const upid = this.sanitizeUpid(first.upid);
      if (!upid) {
        skipped += group.length;
        continue;
      }

      const date = first.source_date;

      const exists = await this.deps.repository.mainEncounterExists(
        upid,
        first.client_id,
        date,
        mainCheckType,
      );

      if (!exists) {
        const mainPayload = this.deps.payloadBuilder.buildMainEncounter({
          encountId: this.uuidFactory(),
          type: mainInsertType,
          upid,
          clientId: first.client_id,
          date,
          time: currentTime,
          rhieUploadedAt: currentTime,
        });

        const mainResult = await this.persistMainEncounter(generator, mainPayload);
        if (mainResult === 'processed') processed += 1;
        else skipped += 1;
      }

      for (const row of group) {
        const payload = this.deps.payloadBuilder.buildPatientEncounter({
          encountId: this.uuidFactory(),
          type: patientType,
          upid,
          clientId: row.client_id,
          sourceId: row.source_id,
          sourceTable: 'ncds',
          date: row.source_date,
          time: currentTime,
          rhieUploadedAt: currentTime,
        });

        const result = await this.persistPatientEncounter(generator, payload, async () => {
          await this.deps.repository.markNcdAsUploaded(row.client_id, date);
        });

        if (result === 'processed') processed += 1;
        else skipped += 1;
      }
    }

    return { processed, failed: 0, skipped };
  }

  async generateVitalNCDsEncounters(startDate: string): Promise<GeneratorResult> {
    return this.generateNcdEncounters(
      'ncd_vital',
      startDate,
      (date) => this.deps.repository.fetchNcdVitalEncounters(date),
      'encounterNCDsvital',
      'encounterNCDsvital',
      'vital_ncds',
    );
  }

  async generatePlaintesNCDsEncounters(startDate: string): Promise<GeneratorResult> {
    return this.generateNcdEncounters(
      'ncd_plaintes',
      startDate,
      (date) => this.deps.repository.fetchNcdPlaintesEncounters(date),
      'encounterNCDsPlaintes',
      'encounterNCDsPlaintes',
      'plainte_ncds',
    );
  }

  async generateDiagnosticNCDsEncounters(startDate: string): Promise<GeneratorResult> {
    return this.generateNcdEncounters(
      'ncd_diagnostic',
      startDate,
      (date) => this.deps.repository.fetchNcdDiagnosticEncounters(date),
      'encounterNCDsDiagnostic',
      'encounterNCDsDiagnostic',
      'diagnostic_ncds',
    );
  }

  async generateReferralEncounters(startDate: string): Promise<GeneratorResult> {
    const rows = await this.deps.repository.fetchReferralEncounters(startDate);
    const grouped = this.groupByKey(rows, (row) => `${row.client_id}_${row.source_date}`);

    let processed = 0;
    let skipped = 0;
    const currentTime = phpTimestamp(this.now());

    for (const group of grouped.values()) {
      const first = group[0];
      const upid = this.sanitizeUpid(first.upid);
      if (!upid) {
        skipped += group.length;
        continue;
      }

      for (const referral of group) {
        const payload = this.deps.payloadBuilder.buildPatientEncounter({
          encountId: this.uuidFactory(),
          type: 'referral',
          upid,
          clientId: referral.client_id,
          sourceId: referral.source_id,
          sourceTable: 'diag_client',
          date: referral.source_date,
          time: currentTime,
          rhieUploadedAt: currentTime,
        });

        const result = await this.persistPatientEncounter('referral', payload);
        if (result === 'processed') processed += 1;
        else skipped += 1;
      }
    }

    return { processed, failed: 0, skipped };
  }
}

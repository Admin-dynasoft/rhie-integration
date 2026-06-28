import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateReplicationHealth, buildSnapshot } from './types.js';

describe('evaluateReplicationHealth', () => {
  it('treats non-replica as healthy when configured', () => {
    const result = evaluateReplicationHealth(
      {
        isReplica: false,
        ioRunning: 'unknown',
        sqlRunning: 'unknown',
        lagSeconds: null,
        lastError: null,
        sourceHost: null,
        sourcePort: null,
      },
      { maxLagSeconds: 30, treatNonReplicaAsHealthy: true },
    );

    assert.equal(result.status, 'not_replica');
    assert.equal(result.healthy, true);
  });

  it('marks unhealthy when replication threads are stopped', () => {
    const result = evaluateReplicationHealth(
      {
        isReplica: true,
        ioRunning: 'no',
        sqlRunning: 'yes',
        lagSeconds: 0,
        lastError: null,
        sourceHost: 'local',
        sourcePort: 3306,
      },
      { maxLagSeconds: 30, treatNonReplicaAsHealthy: false },
    );

    assert.equal(result.status, 'unhealthy');
    assert.equal(result.healthy, false);
  });

  it('marks degraded when lag exceeds threshold', () => {
    const result = evaluateReplicationHealth(
      {
        isReplica: true,
        ioRunning: 'yes',
        sqlRunning: 'yes',
        lagSeconds: 120,
        lastError: null,
        sourceHost: 'local',
        sourcePort: 3306,
      },
      { maxLagSeconds: 30, treatNonReplicaAsHealthy: false },
    );

    assert.equal(result.status, 'degraded');
    assert.equal(result.healthy, false);
  });
});

describe('buildSnapshot', () => {
  it('aggregates global health from facilities', () => {
    const snapshot = buildSnapshot(
      [
        {
          facilityCode: 'HC-A',
          onlineDatabaseId: 'online-hc-a',
          onlineDatabaseName: 'HC A',
          localDatabaseId: 'local-primary',
          localReachable: true,
          onlineReachable: true,
          status: 'healthy',
          ioRunning: 'yes',
          sqlRunning: 'yes',
          lagSeconds: 1,
          healthy: true,
          lastCheck: new Date().toISOString(),
        },
        {
          facilityCode: 'HC-B',
          onlineDatabaseId: 'online-hc-b',
          onlineDatabaseName: 'HC B',
          localDatabaseId: 'local-primary',
          localReachable: true,
          onlineReachable: true,
          status: 'degraded',
          ioRunning: 'yes',
          sqlRunning: 'yes',
          lagSeconds: 90,
          healthy: false,
          lastCheck: new Date().toISOString(),
        },
      ],
      30,
    );

    assert.equal(snapshot.globalHealthy, false);
    assert.equal(snapshot.globalStatus, 'degraded');
    assert.ok(snapshot.facilities['HC-A']);
    assert.ok(snapshot.facilities['HC-B']);
  });
});

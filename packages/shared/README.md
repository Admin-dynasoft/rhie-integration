# @rhie/shared

## Purpose

Core worker framework and service lifecycle management.

## Responsibilities

- `ContinuousWorker` — infinite poll/process/sleep loop
- `ServiceLifecycle` — bootstraps services, spawns workers, graceful shutdown
- Processing mode checks via coordinator state file
- Error types for integration failures

## Workflow

1. Service calls `bootstrapService()`
2. Config loaded, databases registered, RHIE client created
3. Workers spawned (one per facility for online, one for local)
4. Each worker loops: check mode → poll DB → process → sleep
5. SIGTERM/SIGINT triggers graceful shutdown

## Configuration

Uses `@rhie/config` worker and monitoring settings.

## Dependencies

- `@rhie/config`, `@rhie/database`, `@rhie/logger`, `@rhie/monitoring`, `@rhie/rhie-client`

export class EnvironmentDiscoveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvironmentDiscoveryError';
  }
}

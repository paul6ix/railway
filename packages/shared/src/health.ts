export type HealthStatus = 'ok' | 'degraded';

export interface HealthResponse {
  /** `ok` when both the database and the Discord gateway are up. */
  status: HealthStatus;
  database: 'ok' | 'error';
  discord: 'connected' | 'disconnected';
  uptimeSeconds: number;
}

type AuditPayload = {
  request?: Request;
  actor?: unknown;
  module: string;
  action: string;
  entityType?: string;
  status: 'success' | 'failed';
  sourceSystem?: string;
  metadata?: Record<string, unknown>;
};

export async function logAuditEvent(_payload: AuditPayload): Promise<void> {
  // Keep a compatible no-op logger for routes that expect audit tracing.
  return;
}

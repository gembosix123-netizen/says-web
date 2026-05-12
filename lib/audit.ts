import type { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export type AuditStatus = 'success' | 'failed' | 'denied';

export interface SessionAuditUser {
  id?: string;
  username?: string;
  name?: string;
  role?: string;
  branch?: string;
}

export interface AuditChange {
  field: string;
  oldValue?: unknown;
  newValue?: unknown;
}

export interface AuditEventInput {
  request?: NextRequest;
  actor?: SessionAuditUser | null;
  module: string;
  action: string;
  entityType?: string;
  entityId?: string;
  branch?: string;
  status?: AuditStatus;
  reason?: string;
  referenceNo?: string;
  sourceSystem?: string;
  metadata?: Record<string, unknown>;
  changes?: AuditChange[];
}

export function getSessionUserFromRequest(request: NextRequest): SessionAuditUser | null {
  try {
    const session = request.cookies.get('session');
    if (!session?.value) return null;

    let value = session.value;
    try {
      value = decodeURIComponent(value);
    } catch {
      // no-op
    }

    const parsed = JSON.parse(value) as SessionAuditUser;
    return parsed;
  } catch {
    return null;
  }
}

export function buildAuditChanges(
  oldData: Record<string, unknown> | null | undefined,
  newData: Record<string, unknown> | null | undefined,
  ignoredFields: string[] = []
): AuditChange[] {
  const oldSafe = oldData || {};
  const newSafe = newData || {};
  const keys = new Set([...Object.keys(oldSafe), ...Object.keys(newSafe)]);
  const ignoreSet = new Set(ignoredFields);

  const changes: AuditChange[] = [];

  for (const key of keys) {
    if (ignoreSet.has(key)) continue;
    const oldValue = oldSafe[key];
    const newValue = newSafe[key];

    if (JSON.stringify(oldValue) === JSON.stringify(newValue)) {
      continue;
    }

    changes.push({
      field: key,
      oldValue,
      newValue,
    });
  }

  return changes;
}

export async function logAuditEvent(input: AuditEventInput): Promise<void> {
  try {
    if (!supabaseAdmin) return;

    const actor = input.actor ?? (input.request ? getSessionUserFromRequest(input.request) : null);
    const eventKey = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const { data: eventRow, error } = await supabaseAdmin
      .from('audit_events')
      .insert({
        event_key: eventKey,
        actor_id: actor?.id || null,
        actor_username: actor?.username || null,
        actor_name: actor?.name || null,
        actor_role: actor?.role || null,
        actor_branch: actor?.branch || null,
        module: input.module,
        action: input.action,
        entity_type: input.entityType || null,
        entity_id: input.entityId || null,
        branch: input.branch || actor?.branch || null,
        status: input.status || 'success',
        reason: input.reason || null,
        reference_no: input.referenceNo || null,
        source_system: input.sourceSystem || 'web',
        metadata: input.metadata || {},
      })
      .select('id')
      .single();

    if (error || !eventRow?.id) {
      const code = (error as { code?: string } | null)?.code;
      const msg = `${error?.message || ''}`;
      const missingAuditTable =
        code === 'PGRST205' ||
        /audit_events|schema cache/i.test(msg) ||
        /could not find the table/i.test(msg);
      if (missingAuditTable) {
        console.warn(
          '[audit] Jadual audit_events tiada — langkau log audit. Jalankan migrations/20260226_add_audit_tables.sql pada Supabase. / audit_events table missing; audit skipped.'
        );
        return;
      }
      console.error('Failed to write audit event:', error);
      return;
    }

    if (!input.changes || input.changes.length === 0) {
      return;
    }

    const payload = input.changes.map((change) => ({
      event_id: eventRow.id,
      field_name: change.field,
      old_value: change.oldValue === undefined ? null : change.oldValue,
      new_value: change.newValue === undefined ? null : change.newValue,
    }));

    const { error: changesError } = await supabaseAdmin
      .from('audit_event_changes')
      .insert(payload);

    if (changesError) {
      const code = (changesError as { code?: string }).code;
      const msg = `${changesError.message || ''}`;
      if (
        code === 'PGRST205' ||
        /audit_event_changes|schema cache/i.test(msg) ||
        /could not find the table/i.test(msg)
      ) {
        console.warn('[audit] Jadual audit_event_changes tiada — langkau. / audit_event_changes missing; skipped.');
        return;
      }
      console.error('Failed to write audit event changes:', changesError);
    }
  } catch (error) {
    console.error('Audit logging error:', error);
  }
}

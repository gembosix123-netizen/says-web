import type { SupabaseClient } from '@supabase/supabase-js';

export const STOCK_GRANT_MAX_DURATION_MINUTES = 60;
export const STOCK_GRANT_MAX_CHANGES_PER_SESSION = 50;
export const STOCK_GRANT_MIN_REASON_LENGTH = 5;

export type StockEditGrantStatus = 'pending' | 'active' | 'expired' | 'revoked' | 'denied';

export type StockEditGrantRow = {
  id: string;
  requester_id: string;
  requester_name: string | null;
  requester_branch: string | null;
  approver_id: string | null;
  approver_name: string | null;
  status: StockEditGrantStatus;
  duration_minutes: number;
  requested_duration_minutes: number | null;
  requested_at: string;
  approved_at: string | null;
  expires_at: string | null;
  closed_at: string | null;
  reason_request: string | null;
  reason_approve: string | null;
  change_count: number;
  created_at: string;
  updated_at: string;
};

/** Mark active grants past expires_at as expired (lazy cleanup). */
export async function expireStaleStockGrants(supabase: SupabaseClient): Promise<void> {
  const now = new Date().toISOString();
  await supabase
    .from('stock_edit_grants')
    .update({ status: 'expired', closed_at: now, updated_at: now })
    .eq('status', 'active')
    .lt('expires_at', now);
}

export async function findActiveGrantForRequester(
  supabase: SupabaseClient,
  requesterId: string
): Promise<StockEditGrantRow | null> {
  await expireStaleStockGrants(supabase);
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('stock_edit_grants')
    .select('*')
    .eq('requester_id', requesterId)
    .eq('status', 'active')
    .gt('expires_at', now)
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as StockEditGrantRow;
}

export async function incrementGrantChangeCount(
  supabase: SupabaseClient,
  grantId: string
): Promise<void> {
  const { data: row } = await supabase
    .from('stock_edit_grants')
    .select('change_count')
    .eq('id', grantId)
    .single();

  const next = Number(row?.change_count ?? 0) + 1;
  const now = new Date().toISOString();
  await supabase
    .from('stock_edit_grants')
    .update({ change_count: next, updated_at: now })
    .eq('id', grantId);
}

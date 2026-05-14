import { redirect } from 'next/navigation';

/** URL lama / bookmark — satu skrin kelulusan HQ dengan tab stok. */
export default function StockGrantsRedirectPage() {
  redirect('/admin/approvals?tab=stok');
}

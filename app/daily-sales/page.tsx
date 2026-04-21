import { redirect } from 'next/navigation';

export default function DailySalesRedirect() {
  redirect('/sales/daily-report');
}

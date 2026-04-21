import { redirect } from 'next/navigation';

export default function StaffManagementRedirectPage() {
  redirect('/admin/users');
}

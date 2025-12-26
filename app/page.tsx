import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import SalesWizard from '@/components/SalesWizard';

export default async function Home() {
  const cookieStore = await cookies();
  const session = cookieStore.get('session');

  if (!session) {
    redirect('/login');
  }

  let role = '';
  try {
      const sessionData = JSON.parse(session.value);
      role = sessionData.role;
  } catch (e) {
      redirect('/login');
  }

  if (role === 'Admin') {
    redirect('/admin');
  }

  // Sales Role
  return <SalesWizard role={role} />;
}

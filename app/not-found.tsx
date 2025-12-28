import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-50 p-4 text-center">
      <h2 className="text-4xl font-bold text-slate-900">404</h2>
      <p className="mt-2 text-lg text-slate-600">Halaman tidak ditemui</p>
      <p className="mb-8 text-sm text-slate-500">Maaf, halaman yang anda cari tidak wujud.</p>
      <Link href="/">
        <Button>Kembali ke Utama</Button>
      </Link>
    </div>
  );
}

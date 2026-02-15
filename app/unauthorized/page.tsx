import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900/50 backdrop-blur-xl border border-red-900/30 p-8 rounded-3xl text-center">
        <div className="mb-6">
          <AlertTriangle className="mx-auto text-red-500" size={64} />
        </div>
        
        <h1 className="text-2xl font-bold text-white mb-4">Access Denied</h1>
        <p className="text-slate-400 mb-6">
          You don't have permission to access this resource.
        </p>
        
        <Link 
          href="/" 
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
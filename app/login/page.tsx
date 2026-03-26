'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, User as UserIcon } from 'lucide-react';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@/lib/validations';

export default function Login() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginInput) => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const responseData = await res.json();

      if (res.ok) {
        // Store user info (but not sensitive tokens if using httpOnly cookies)
        localStorage.setItem('user', JSON.stringify({ 
          id: responseData.id,
          name: responseData.name, 
          role: responseData.role,
          branch: responseData.branch 
        }));
        
        // Redirect based on role
        if (responseData.role === 'Admin') {
            router.push('/admin'); 
        } else {
            router.push('/');
        }
      } else {
        setError(responseData.error || 'Invalid credentials');
      }
    } catch (err) {
      console.error(err);
      setError('Connection failed. Ensure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = handleSubmit(onSubmit);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute top-[40%] right-[0%] w-[40%] h-[40%] bg-indigo-900/20 rounded-full blur-[100px] animate-pulse delay-1000" />
      </div>

      <div className="w-full max-w-md bg-slate-900/95 backdrop-blur-sm border border-slate-800 p-8 rounded-2xl shadow-2xl relative z-10">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
             <div className="w-32 h-32 relative flex items-center justify-center">
                 <Image 
                    src="/logo.svg" 
                    alt="Yanong's Logo" 
                    width={150} 
                    height={150} 
                    className="object-contain"
                    priority
                 />
             </div>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">SISTEM SAYS</h1>
          <p className="text-slate-400 mt-2">Sales & Audit Management System</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1 ml-1">Username</label>
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                <input 
                  type="text" 
                  {...register('username')}
                  autoComplete="username"
                  suppressHydrationWarning
                  className="w-full pl-12 h-12 bg-slate-950 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-slate-600 transition-all"
                  placeholder="Enter username"
                />
              </div>
              {errors.username && (
                <p className="text-red-400 text-xs mt-1 ml-1">{errors.username.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1 ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                <input 
                  type="password" 
                  {...register('password')}
                  autoComplete="current-password"
                  suppressHydrationWarning
                  className="w-full pl-12 h-12 bg-slate-950 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-slate-600 transition-all"
                  placeholder="Enter password"
                />
              </div>
              {errors.password && (
                <p className="text-red-400 text-xs mt-1 ml-1">{errors.password.message}</p>
              )}
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-900/20 border border-red-900/50 text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full h-12 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-800 text-center">
          <p className="text-xs text-slate-500">
            Demo: <span className="text-slate-400 font-mono bg-slate-800 px-1 rounded">founder</span> / <span className="text-slate-400 font-mono bg-slate-800 px-1 rounded">Founder2024!</span>
          </p>
        </div>
      </div>
    </div>
  );
}

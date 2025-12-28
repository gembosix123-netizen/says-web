"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

export default function LoginPage() {
  const { t } = useLanguage();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });

        const data = await res.json();

        if (res.ok) {
            if (data.role === 'Admin') {
                router.push('/admin');
            } else {
                router.push('/');
            }
        } else {
            setError(data.error || 'Invalid credentials');
        }
    } catch (err) {
        setError('Something went wrong');
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 relative overflow-hidden">
      
      {/* Abstract Background Shapes */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-blue-600 rounded-full blur-[100px] opacity-20 animate-pulse" />
        <div className="absolute top-[40%] right-[0%] w-[40%] h-[40%] bg-purple-600 rounded-full blur-[100px] opacity-20 animate-pulse delay-1000" />
      </div>

      <div className="absolute top-4 right-4 z-20">
        <LanguageSwitcher />
      </div>
      
      <Card className="w-full max-w-md space-y-8 p-10 border-slate-700/50 bg-white/95 backdrop-blur-sm shadow-2xl relative z-10 rounded-2xl">
        <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-purple-600 mb-4 shadow-lg">
                <span className="text-white font-bold text-2xl">S</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{t('login_title')}</h1>
            <p className="text-slate-500">{t('login_subtitle')}</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6 mt-8">
            <div className="space-y-5">
                <Input 
                    label={t('username')}
                    placeholder={t('enter_username')}
                    value={username} 
                    onChange={e => setUsername(e.target.value)}
                    required
                    className="bg-slate-50 border-slate-200 focus:border-blue-500 focus:ring-blue-500"
                />
                <div className="space-y-1">
                    <Input 
                        label={t('password')}
                        type="password" 
                        placeholder={t('enter_password')}
                        value={password} 
                        onChange={e => setPassword(e.target.value)}
                        required
                        className="bg-slate-50 border-slate-200 focus:border-blue-500 focus:ring-blue-500"
                    />
                </div>
            </div>

            {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-100 flex items-center gap-2 text-red-600 text-sm animate-in fade-in slide-in-from-top-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 flex-shrink-0">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                    </svg>
                    {error}
                </div>
            )}

            <Button 
                type="submit" 
                className="w-full py-3.5 text-lg font-bold shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all"
                variant="secondary"
                disabled={loading}
            >
                {loading ? (
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        {t('loading')}
                    </div>
                ) : t('login_button')}
            </Button>
        </form>
        
        <div className="mt-8 pt-6 border-t border-slate-100">
            <div className="text-center text-xs text-slate-400 space-y-1">
                <p>Demo Credentials:</p>
                <div className="flex justify-center gap-4 font-mono">
                    <span className="bg-slate-100 px-2 py-1 rounded">Admin1 / password1</span>
                    <span className="bg-slate-100 px-2 py-1 rounded">sales1 / password</span>
                </div>
            </div>
        </div>
      </Card>
    </div>
  );
}

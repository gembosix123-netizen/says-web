'use client';
import { Database, Server, HardDrive, Activity } from 'lucide-react';

export default function DatabaseMonitoring() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
        <div className="bg-slate-900/50 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-slate-800">
            <h2 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
                <Database className="text-blue-500" />
                Database Monitoring
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-slate-400 text-sm">Status</span>
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    </div>
                    <p className="text-xl font-bold text-white">Operational</p>
                    <p className="text-xs text-slate-500 mt-1">Upstash Redis / JSON Fallback</p>
                </div>

                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                     <div className="flex justify-between items-start mb-2">
                        <span className="text-slate-400 text-sm">Latency</span>
                        <Activity size={16} className="text-blue-500"/>
                    </div>
                    <p className="text-xl font-bold text-white">24ms</p>
                    <p className="text-xs text-slate-500 mt-1">Average response time</p>
                </div>

                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                     <div className="flex justify-between items-start mb-2">
                        <span className="text-slate-400 text-sm">Storage</span>
                        <HardDrive size={16} className="text-purple-500"/>
                    </div>
                    <p className="text-xl font-bold text-white">45%</p>
                    <p className="text-xs text-slate-500 mt-1">1.2GB / 2.5GB Used</p>
                </div>

                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                     <div className="flex justify-between items-start mb-2">
                        <span className="text-slate-400 text-sm">Connections</span>
                        <Server size={16} className="text-orange-500"/>
                    </div>
                    <p className="text-xl font-bold text-white">12</p>
                    <p className="text-xs text-slate-500 mt-1">Active Sessions</p>
                </div>
            </div>

            <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-800">
                    <h3 className="font-bold text-white">Recent Database Operations</h3>
                </div>
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-900 text-slate-400">
                        <tr>
                            <th className="px-6 py-3">Timestamp</th>
                            <th className="px-6 py-3">Operation</th>
                            <th className="px-6 py-3">Collection</th>
                            <th className="px-6 py-3">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300">
                        {[1,2,3,4,5].map((_, i) => (
                            <tr key={i} className="hover:bg-slate-900/50">
                                <td className="px-6 py-3 font-mono text-xs">{new Date(Date.now() - i * 60000).toISOString()}</td>
                                <td className="px-6 py-3"><span className="px-2 py-0.5 rounded bg-blue-900/30 text-blue-400 text-xs font-bold">READ</span></td>
                                <td className="px-6 py-3">users</td>
                                <td className="px-6 py-3 text-green-400">Success</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
}

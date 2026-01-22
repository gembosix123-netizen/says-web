'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Transaction, Product } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Download, Calendar, TrendingUp, TrendingDown, DollarSign, Package } from 'lucide-react';

interface MonthlyReportProps {
  transactions: Transaction[];
  products: Product[];
}

export default function MonthlyReport({ transactions, products }: MonthlyReportProps) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const reportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Filter transactions for the selected month
  const monthlyTransactions = useMemo(() => {
    return transactions.filter(t => t.createdAt?.startsWith(selectedMonth));
  }, [transactions, selectedMonth]);

  // Calculate Summary Metrics
  const summary = useMemo(() => {
    const totalRevenue = monthlyTransactions.reduce((sum, t) => sum + t.total, 0);
    // Assuming 30% profit margin as cost is not in Product type
    const netProfit = totalRevenue * 0.3; 
    
    // Previous Month Comparison
    const [year, month] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(year, month - 2); // month is 1-indexed in split, 0-indexed in Date
    const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    
    const prevTransactions = transactions.filter(t => t.createdAt?.startsWith(prevMonthStr));
    const prevRevenue = prevTransactions.reduce((sum, t) => sum + t.total, 0);
    
    const growth = prevRevenue === 0 ? 100 : ((totalRevenue - prevRevenue) / prevRevenue) * 100;

    return {
      totalRevenue,
      netProfit,
      growth,
      transactionCount: monthlyTransactions.length
    };
  }, [monthlyTransactions, transactions, selectedMonth]);

  // Top Selling Products Data
  const topProductsData = useMemo(() => {
    const productSales: Record<string, number> = {};
    monthlyTransactions.forEach(t => {
      t.items.forEach(item => {
        productSales[item.id] = (productSales[item.id] || 0) + item.quantity;
      });
    });

    return Object.entries(productSales)
      .map(([id, qty]) => ({
        name: products.find(p => p.id === id)?.name || 'Unknown',
        sales: qty
      }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 5);
  }, [monthlyTransactions, products]);

  // Daily Sales Trends Data
  const salesTrendData = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    
    const data = new Array(daysInMonth).fill(0).map((_, i) => {
      const day = i + 1;
      return {
        date: `${day}`, // Just day number for cleaner x-axis
        fullDate: `${selectedMonth}-${String(day).padStart(2, '0')}`,
        amount: 0
      };
    });

    monthlyTransactions.forEach(t => {
      if (t.createdAt) {
        const day = parseInt(t.createdAt.split('-')[2]);
        if (day > 0 && day <= daysInMonth) {
          data[day - 1].amount += t.total;
        }
      }
    });

    return data;
  }, [monthlyTransactions, selectedMonth]);

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);

    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        backgroundColor: '#000000', // Dark theme background
        useCORS: true
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Monthly_Report_${selectedMonth}.pdf`);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export PDF');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800 backdrop-blur-sm">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Calendar className="text-red-500" />
            Monthly Report
        </h2>
        
        <div className="flex items-center gap-4">
            <input 
                type="month" 
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-slate-800 text-white border border-slate-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-red-500 outline-none"
            />
            
            <button 
                onClick={handleExportPDF}
                disabled={isExporting}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
                {isExporting ? 'Generating...' : <><Download size={18} /> Export PDF</>}
            </button>
        </div>
      </div>

      {/* Report Content - Wrapped for PDF Generation */}
      <div ref={reportRef} className="space-y-6 bg-black p-4 rounded-xl">
        
        {/* 1) Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Total Revenue */}
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-lg relative overflow-hidden group">
                <div className="absolute right-0 top-0 w-32 h-32 bg-green-500/10 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
                <div className="relative">
                    <p className="text-slate-400 text-sm font-medium mb-1">Total Revenue</p>
                    <h3 className="text-3xl font-bold text-green-400">{formatCurrency(summary.totalRevenue)}</h3>
                    <div className="flex items-center gap-2 mt-4 text-sm text-slate-500">
                        <DollarSign size={16} />
                        <span>Based on {summary.transactionCount} transactions</span>
                    </div>
                </div>
            </div>

            {/* Net Profit (Estimated) */}
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-lg relative overflow-hidden group">
                 <div className="absolute right-0 top-0 w-32 h-32 bg-blue-500/10 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
                 <div className="relative">
                    <p className="text-slate-400 text-sm font-medium mb-1">Net Profit (Est. 30%)</p>
                    <h3 className="text-3xl font-bold text-blue-400">{formatCurrency(summary.netProfit)}</h3>
                    <div className="flex items-center gap-2 mt-4 text-sm text-slate-500">
                        <TrendingUp size={16} />
                        <span>Profit Margin Calculation</span>
                    </div>
                 </div>
            </div>

            {/* Growth % */}
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-lg relative overflow-hidden group">
                <div className={`absolute right-0 top-0 w-32 h-32 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110 ${summary.growth >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}`} />
                <div className="relative">
                    <p className="text-slate-400 text-sm font-medium mb-1">Monthly Growth</p>
                    <div className="flex items-end gap-2">
                        <h3 className={`text-3xl font-bold ${summary.growth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {summary.growth >= 0 ? '+' : ''}{summary.growth.toFixed(1)}%
                        </h3>
                    </div>
                    <div className="flex items-center gap-2 mt-4 text-sm text-slate-500">
                        {summary.growth >= 0 ? <TrendingUp size={16} className="text-emerald-500" /> : <TrendingDown size={16} className="text-red-500" />}
                        <span>vs Last Month</span>
                    </div>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 2) Top Selling Products (Bar Chart) */}
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-lg">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                    <Package className="text-orange-500" />
                    Top Selling Products
                </h3>
                <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topProductsData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                            <XAxis type="number" stroke="#94a3b8" />
                            <YAxis dataKey="name" type="category" stroke="#94a3b8" width={100} />
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                                itemStyle={{ color: '#f8fafc' }}
                                cursor={{ fill: '#334155', opacity: 0.4 }}
                            />
                            <Bar dataKey="sales" fill="#f97316" radius={[0, 4, 4, 0]} barSize={20} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* 3) Daily Sales Trends (Line Graph) */}
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-lg">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                    <TrendingUp className="text-blue-500" />
                    Daily Sales Trend
                </h3>
                <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={salesTrendData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                            <XAxis dataKey="date" stroke="#94a3b8" />
                            <YAxis stroke="#94a3b8" />
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                                labelStyle={{ color: '#94a3b8' }}
                            />
                            <Line 
                                type="monotone" 
                                dataKey="amount" 
                                stroke="#3b82f6" 
                                strokeWidth={3}
                                dot={{ fill: '#3b82f6', r: 4 }}
                                activeDot={{ r: 6, fill: '#60a5fa' }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
}

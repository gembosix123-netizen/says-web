import React from 'react';
import { useSales } from '@/context/SalesContext';
import { useLanguage } from '@/context/LanguageContext';
import { CheckCircle, Printer, ArrowLeft } from '@/components/Icons';
import { Button } from '@/components/ui/Button';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency } from '@/lib/utils';
import { useRouter } from 'next/navigation';

export default function SuccessScreen() {
  const { resetSalesProcess, cart, selectedCustomer, calculateGrandTotal } = useSales();
  const { t } = useLanguage();
  const router = useRouter();

  const handlePrintReceipt = () => {
    const doc = new jsPDF();
    const total = calculateGrandTotal();
    
    // Header
    doc.setFontSize(22);
    doc.text(t('brand_client') || 'HAJA YANONS INDUSTRIES', 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('Your Business Address Here', 14, 28);
    
    // Receipt details
    doc.setTextColor(0);
    doc.setFontSize(14);
    doc.text((t('receipt') || 'RECEIPT'), 140, 20);
    doc.setFontSize(10);
    doc.text((t('date') || 'Date') + `: ${new Date().toLocaleDateString()}`, 140, 28);

    // Bill To
    doc.text((t('bill_to') || 'Bill To') + ':', 14, 45);
    doc.setFontSize(12);
    doc.text(selectedCustomer?.name || 'Customer', 14, 52);
    doc.setFontSize(10);
    doc.text(selectedCustomer?.address || '', 14, 58);

    // Table
    const tableColumn = ["Item", "Unit", "Price", "Qty", "Total"];
    const tableRows = cart.map(item => [
      item.name,
      item.unit,
      formatCurrency(item.price),
      item.quantity,
      formatCurrency(item.price * item.quantity)
    ]);

    autoTable(doc, {
      startY: 70,
      head: [tableColumn],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] }, // slate-900
    });

    // Total
    const finalY = (doc as any).lastAutoTable.finalY || 70;
    doc.setFontSize(14);
    doc.text(`${t('total') || 'Total'}: ${formatCurrency(total)}`, 140, finalY + 15);

    doc.save(`Receipt_${Date.now()}.pdf`);
  };

  const handleBackToDashboard = () => {
      resetSalesProcess();
      // Ensure we navigate back to the main dashboard logic
      window.location.reload(); // Simple refresh to clear state completely if needed, or use router
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 p-6 text-center">
        <div className="relative">
            <div className="absolute inset-0 bg-green-500/20 blur-3xl rounded-full animate-pulse" />
            <div className="w-32 h-32 bg-green-500/10 rounded-full flex items-center justify-center relative border border-green-500/20">
                <CheckCircle className="text-green-400" size={64} />
            </div>
        </div>
        
        <div className="space-y-2">
            <h2 className="text-3xl font-bold text-white tracking-tight">{t('visit_completed') || 'Jualan Berjaya!'}</h2>
            <p className="text-slate-400">{t('transaction_saved') || 'Transaction has been recorded successfully.'}</p>
        </div>

        <div className="w-full max-w-md bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex justify-between items-center text-sm border-b border-slate-800 pb-4">
                <span className="text-slate-400">Customer</span>
                <span className="font-bold text-white">{selectedCustomer?.name}</span>
            </div>
            <div className="flex justify-between items-center text-sm border-b border-slate-800 pb-4">
                <span className="text-slate-400">Total Amount</span>
                <span className="font-bold text-emerald-400 text-lg">{formatCurrency(calculateGrandTotal())}</span>
            </div>
            
            <Button 
                variant="outline" 
                onClick={handlePrintReceipt}
                className="w-full py-3 border-slate-700 hover:bg-slate-800 text-slate-300 flex items-center justify-center rounded-xl"
            >
                <Printer className="mr-2" /> {t('print_receipt')}
            </Button>
            
            <Button 
                onClick={handleBackToDashboard}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-900/20 flex items-center justify-center"
            >
                <ArrowLeft className="mr-2" size={20} /> {t('back_to_route') || 'Back to Dashboard'}
            </Button>
        </div>
    </div>
  );
}

import React from 'react';
import { useSales } from '@/context/SalesContext';
import { useLanguage } from '@/context/LanguageContext';
import { CheckCircle, Printer } from '@/components/Icons';
import { Button } from '@/components/ui/Button';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency } from '@/lib/utils';

export default function SuccessScreen() {
  const { resetSalesProcess, cart, selectedCustomer, calculateGrandTotal } = useSales();
  const { t } = useLanguage();

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

  return (
    <div className="flex flex-col items-center justify-center h-[80vh] space-y-8 p-6 text-center">
        <div className="w-32 h-32 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="text-green-600" size={64} />
        </div>
        <div>
            <h2 className="text-3xl font-bold text-slate-900">{t('visit_completed')}</h2>
            <p className="text-slate-600 mt-2">{t('transaction_saved')}</p>
        </div>

        <div className="space-y-4 w-full max-w-sm">
            <Button 
                variant="outline" 
                onClick={handlePrintReceipt}
                className="w-full py-4 border-2 border-slate-300 rounded-xl font-bold text-slate-700 flex items-center justify-center"
            >
                <Printer className="mr-2" /> {t('print_receipt')}
            </Button>
            <Button 
                onClick={resetSalesProcess}
                className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg"
            >
                {t('back_to_route')}
            </Button>
        </div>
    </div>
  );
}

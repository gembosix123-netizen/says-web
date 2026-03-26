'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { 
  ArrowLeft, 
  Plus, 
  Minus, 
  Trash2, 
  Search,
  ShoppingCart,
  Check,
  User,
  Package,
  Printer,
  CheckCircle
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/lib/supabase';

const MAX_PAYMENT_PROOF_IMAGES = 4;

type PaymentProofItem = {
  id: string;
  file: File;
  previewUrl: string;
};

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  unit?: string;
  current_stock?: number;
  category?: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
}

interface CartItem {
  product: Product;
  quantity: number;
}

function normalizeBranchCode(branch = 'XX') {
  const compact = branch
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();

  if (!compact) return 'XX';

  const parts = compact.split(/\s+/).filter(Boolean);
  const initials = parts.map((part) => part[0]).join('').slice(0, 4);
  return initials || compact.slice(0, 4);
}

function generateDocumentNumber(prefix: string, branch: string) {
  const branchCode = normalizeBranchCode(branch);
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const timestamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `${prefix}-${branchCode}-${today}-${timestamp}-${rand}`;
}

function getPaymentLabel(paymentMethod: string) {
  const labels: Record<string, string> = {
    cash: 'Tunai',
    bill_to_bill: 'Kredit (Bill-to-Bill)',
    bank_transfer: 'Pindahan Bank',
    qr_code: 'QR Code',
    card: 'Kad',
  };

  return labels[paymentMethod] || paymentMethod;
}

function getReferenceLabel(paymentMethod: string) {
  const labels: Record<string, string> = {
    bill_to_bill: 'No. Invois / Rujukan Kredit',
    bank_transfer: 'No. Rujukan Pemindahan',
    qr_code: 'No. Transaksi QR',
  };

  return labels[paymentMethod] || 'No. Rujukan';
}

function getDocumentTitle(paymentMethod: string) {
  const labels: Record<string, string> = {
    cash: 'RESIT',
    bill_to_bill: 'INVOIS KREDIT',
    bank_transfer: 'SLIP BAYARAN',
    qr_code: 'SLIP BAYARAN',
    card: 'SLIP BAYARAN',
  };

  return labels[paymentMethod] || 'DOKUMEN TRANSAKSI';
}

function getDownloadLabel(paymentMethod: string) {
  const labels: Record<string, string> = {
    cash: 'Muat Turun Resit PDF',
    bill_to_bill: 'Muat Turun Invois Kredit PDF',
    bank_transfer: 'Muat Turun Slip Bayaran PDF',
    qr_code: 'Muat Turun Slip Bayaran PDF',
    card: 'Muat Turun Slip Bayaran PDF',
  };

  return labels[paymentMethod] || 'Muat Turun Dokumen PDF';
}

function requiresPaymentProof(paymentMethod: string) {
  return paymentMethod === 'bank_transfer' || paymentMethod === 'qr_code';
}

async function toDataUrlFromUrl(url: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const blob = await response.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function uploadPaymentProof(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const filename = `payment-proof/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from('sales-receipts')
    .upload(filename, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data: publicUrlData } = supabase.storage
    .from('sales-receipts')
    .getPublicUrl(filename);

  return publicUrlData.publicUrl;
}

export default function NewSalePage() {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1: Select Customer, 2: Add Products, 3: Payment
  const [userBranch, setUserBranch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchCustomer, setSearchCustomer] = useState('');
  const [searchProduct, setSearchProduct] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [billingRefNo, setBillingRefNo] = useState('');
  const [transferRefNo, setTransferRefNo] = useState('');
  const [qrTxnRefNo, setQrTxnRefNo] = useState('');
  const [paymentProofs, setPaymentProofs] = useState<PaymentProofItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successData, setSuccessData] = useState<{
    invoiceNo: string;
    receiptNo: string | null;
    referenceNo: string | null;
    referenceLabel: string | null;
    proofUploaded: boolean;
    customerName: string;
    total: number;
    paymentMethod: string;
    items: CartItem[];
    proofImageUrls: string[];
  } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [customersRes, productsRes, userRes] = await Promise.all([
        fetch('/api/customers').then(res => res.json()),
        fetch('/api/inventory/van').then(res => res.json()),
        fetch('/api/auth/me').then(res => res.json())
      ]);

      if (Array.isArray(customersRes)) setCustomers(customersRes);
      if (userRes?.branch) {
        setUserBranch(String(userRes.branch));
      }
      const rawProducts = Array.isArray(productsRes?.products) ? productsRes.products : [];
      if (Array.isArray(rawProducts)) {
        setProducts(rawProducts.map((product) => {
          const resolvedStock = Number(product.stock ?? product.current_stock ?? 0);

          return {
            id: String(product.id || ''),
            name: String(product.name || 'Unnamed Product'),
            price: Number(product.price || 0),
            unit: String(product.unit || 'unit'),
            stock: Number.isFinite(resolvedStock) ? resolvedStock : 0,
          };
        }));
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userBranch && !invoiceNo) {
      setInvoiceNo(generateDocumentNumber('INV', userBranch));
    }
  }, [userBranch, invoiceNo]);

  useEffect(() => {
    if (!userBranch) return;

    if (paymentMethod === 'bill_to_bill' && !billingRefNo) {
      setBillingRefNo(generateDocumentNumber('B2B', userBranch));
    }

    if (paymentMethod === 'bank_transfer' && !transferRefNo) {
      setTransferRefNo(generateDocumentNumber('TRF', userBranch));
    }

    if (paymentMethod === 'qr_code' && !qrTxnRefNo) {
      setQrTxnRefNo(generateDocumentNumber('QR', userBranch));
    }
  }, [paymentMethod, userBranch, billingRefNo, transferRefNo, qrTxnRefNo]);

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchCustomer.toLowerCase()) ||
    c.phone?.includes(searchCustomer)
  );

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
    p.category?.toLowerCase().includes(searchProduct.toLowerCase())
  );

  const getAvailableStock = (productId: string) => {
    const product = products.find((item) => item.id === productId);
    return product?.stock || 0;
  };

  const getInCartQuantity = (productId: string) => {
    const existing = cart.find((item) => item.product.id === productId);
    return existing?.quantity || 0;
  };

  const getRemainingStock = (productId: string) => Math.max(0, getAvailableStock(productId) - getInCartQuantity(productId));

  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.product.id === product.id);
    const remainingStock = getRemainingStock(product.id);

    if (remainingStock <= 0) {
      alert(`${product.name} sudah habis dalam baki stok van semasa.`);
      return;
    }

    if (existing) {
      if (existing.quantity + 1 > product.stock) {
        alert(`Stok ${product.name} tidak mencukupi. Baki semasa ${product.stock}.`);
        return;
      }

      setCart(cart.map(item => 
        item.product.id === product.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    if (delta > 0) {
      const existing = cart.find((item) => item.product.id === productId);
      const availableStock = getAvailableStock(productId);

      if (existing && existing.quantity + delta > availableStock) {
        alert(`Stok ${existing.product.name} tidak mencukupi. Baki semasa ${availableStock}.`);
        return;
      }
    }

    setCart(cart.map(item => {
      if (item.product.id === productId) {
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

  const regenerateInvoiceNo = () => {
    setInvoiceNo(generateDocumentNumber('INV', userBranch || 'XX'));
  };

  const regenerateReferenceNo = () => {
    if (paymentMethod === 'bill_to_bill') {
      setBillingRefNo(generateDocumentNumber('B2B', userBranch || 'XX'));
      return;
    }

    if (paymentMethod === 'bank_transfer') {
      setTransferRefNo(generateDocumentNumber('TRF', userBranch || 'XX'));
      return;
    }

    if (paymentMethod === 'qr_code') {
      setQrTxnRefNo(generateDocumentNumber('QR', userBranch || 'XX'));
    }
  };

  const handlePrintReceipt = async (data: NonNullable<typeof successData>) => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    try {
      const logoImg = new Image();
      logoImg.crossOrigin = 'anonymous';
      const logoLoaded = await new Promise<boolean>((resolve) => {
        logoImg.onload = () => {
          if (logoImg.naturalWidth > 0 && logoImg.naturalHeight > 0) {
            resolve(true);
          } else {
            resolve(false);
          }
        };
        logoImg.onerror = () => resolve(false);
        logoImg.src = '/logo_print.png';
      });
      
      if (logoLoaded && logoImg.naturalWidth > 0 && logoImg.naturalHeight > 0) {
        const canvas = document.createElement('canvas');
        canvas.width = logoImg.naturalWidth;
        canvas.height = logoImg.naturalHeight;
        canvas.getContext('2d')?.drawImage(logoImg, 0, 0);

        const maxLogoWidth = 28;
        const maxLogoHeight = 20;
        const aspectRatio = logoImg.naturalWidth / logoImg.naturalHeight;
        let logoWidth = maxLogoWidth;
        let logoHeight = logoWidth / aspectRatio;

        if (logoHeight > maxLogoHeight) {
          logoHeight = maxLogoHeight;
          logoWidth = logoHeight * aspectRatio;
        }

        doc.addImage(canvas.toDataURL('image/png'), 'PNG', 14, 16, logoWidth, logoHeight);
      }
    } catch {
      // proceed without logo
    }

    doc.setFillColor(15, 23, 42);
    doc.roundedRect(12, 12, pageWidth - 24, 40, 5, 5, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('HAJA YANONGS INDUSTRIES', 48, 24);
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(203, 213, 225);
    doc.text('Dokumen jualan rasmi dijana secara automatik', 48, 30);
    doc.text('Sales receipt prepared for field operations', 48, 35);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text(getDocumentTitle(data.paymentMethod), pageWidth - 14, 23, { align: 'right' });
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(203, 213, 225);
    doc.text(`Tarikh: ${new Date().toLocaleDateString('ms-MY')}`, pageWidth - 14, 31, { align: 'right' });
    doc.text(`No. Invois: ${data.invoiceNo}`, pageWidth - 14, 36, { align: 'right' });
    doc.text(`No. Resit: ${data.receiptNo || '-'}`, pageWidth - 14, 41, { align: 'right' });

    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(12, 60, pageWidth - 24, 26, 3, 3, 'FD');
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.text('BIL KEPADA', 15, 67);
    doc.text('BUTIRAN PEMBAYARAN', pageWidth / 2 + 8, 67);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(11);
    doc.text(data.customerName, 15, 75);
    doc.setFontSize(9);
    doc.text(`Kaedah: ${getPaymentLabel(data.paymentMethod)}`, pageWidth / 2 + 8, 75);
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(
      `${data.referenceLabel || 'Rujukan'}: ${data.referenceNo || '-'}`,
      pageWidth / 2 + 8,
      81
    );

    autoTable(doc, {
      startY: 92,
      margin: { left: 12, right: 12 },
      head: [['Produk', 'Unit', 'Harga (RM)', 'Kuantiti', 'Jumlah (RM)']],
      body: data.items.map((item) => [
        item.product.name,
        item.product.unit || 'unit',
        item.product.price.toFixed(2),
        item.quantity.toString(),
        (item.product.price * item.quantity).toFixed(2),
      ]),
      theme: 'grid',
      styles: {
        fontSize: 8.5,
        cellPadding: 3.5,
        lineColor: [226, 232, 240],
        lineWidth: 0.3,
        textColor: [15, 23, 42],
        halign: 'left',
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: {
        fillColor: [255, 255, 255],
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 78, halign: 'left' },
        1: { cellWidth: 20, halign: 'center' },
        2: { halign: 'right', cellWidth: 28 },
        3: { halign: 'center', cellWidth: 24 },
        4: { halign: 'right', cellWidth: 34 },
      },
    });
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || 92;
    let currentY = finalY + 8;

    doc.setFillColor(15, 23, 42);
    doc.roundedRect(pageWidth - 76, currentY, 64, 22, 3, 3, 'F');
    doc.setTextColor(203, 213, 225);
    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    doc.text('JUMLAH BAYARAN', pageWidth - 70, currentY + 6);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text(`RM ${data.total.toFixed(2)}`, pageWidth - 14, currentY + 16, { align: 'right' });
    currentY += 28;

    doc.setFontSize(7);
    doc.setTextColor(107, 114, 128);
    doc.setFont(undefined, 'normal');
    doc.text('Dokumen ini sah tanpa tandatangan. Disediakan untuk kegunaan operasi jualan lapangan.', 12, pageHeight - 8);
    doc.save(`${getDocumentTitle(data.paymentMethod).replace(/\s+/g, '_')}_${data.receiptNo || data.invoiceNo || Date.now()}.pdf`);
  };

  const handleSubmit = async () => {
    if (!selectedCustomer || cart.length === 0) return;

    const resolvedInvoiceNo = invoiceNo.trim() || generateDocumentNumber('INV', userBranch || 'XX');
    const resolvedBillingRefNo = paymentMethod === 'bill_to_bill'
      ? billingRefNo.trim() || generateDocumentNumber('B2B', userBranch || 'XX')
      : null;
    const resolvedTransferRefNo = paymentMethod === 'bank_transfer'
      ? transferRefNo.trim() || generateDocumentNumber('TRF', userBranch || 'XX')
      : null;
    const resolvedQrTxnRefNo = paymentMethod === 'qr_code'
      ? qrTxnRefNo.trim() || generateDocumentNumber('QR', userBranch || 'XX')
      : null;

    if (requiresPaymentProof(paymentMethod) && paymentProofs.length === 0) {
      alert('Sila muat naik bukti pembayaran untuk transaksi QR atau bank transfer.');
      return;
    }

    setSubmitting(true);
    try {
      let uploadedProofUrls: string[] = [];

      if (paymentProofs.length > 0) {
        try {
          uploadedProofUrls = await Promise.all(paymentProofs.map((proof) => uploadPaymentProof(proof.file)));
        } catch (uploadError) {
          console.error('Error uploading payment proof:', uploadError);
          throw new Error('Gagal memuat naik bukti pembayaran');
        }
      }

      const primaryProofUrl = uploadedProofUrls[0] || null;

      const salePayload = {
        invoice: resolvedInvoiceNo,
        customer_id: selectedCustomer.id,
        customer_name: selectedCustomer.name,
        total_amount: totalAmount,
        payment_method: paymentMethod,
        receipt_no: null,
        billing_ref_no: resolvedBillingRefNo,
        transfer_ref_no: resolvedTransferRefNo,
        qr_txn_ref_no: resolvedQrTxnRefNo,
        return_amount: 0,
        exchange_amount: 0,
        foc_amount: 0,
        receipt_url: primaryProofUrl,
        proof_photo_url: primaryProofUrl,
        proof_photo_urls: uploadedProofUrls,
        items: cart.map((item) => ({
          productId: item.product.id,
          name: item.product.name,
          quantity: item.quantity,
          price: item.product.price,
          subtotal: item.product.price * item.quantity,
          unit: 'unit',
          discount: 0,
          type: 'sale' as const
        }))
      };

      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(salePayload)
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const details = Array.isArray(result?.details)
          ? result.details.join(', ')
          : result?.details;
        throw new Error(details || result?.error || 'Ralat semasa menyimpan jualan');
      }

      // Store result and show success screen
      const resolvedReferenceNo =
        result?.billingRefNo ??
        result?.transferRefNo ??
        result?.qrTxnRefNo ??
        resolvedBillingRefNo ??
        resolvedTransferRefNo ??
        resolvedQrTxnRefNo ??
        null;
      const soldQuantities = cart.reduce<Record<string, number>>((acc, item) => {
        acc[item.product.id] = (acc[item.product.id] || 0) + item.quantity;
        return acc;
      }, {});

      setProducts((currentProducts) =>
        currentProducts.map((product) => {
          const soldQty = soldQuantities[product.id] || 0;
          return soldQty > 0
            ? { ...product, stock: Math.max(0, product.stock - soldQty) }
            : product;
        })
      );

      setSuccessData({
        invoiceNo: result?.invoice ?? resolvedInvoiceNo,
        receiptNo: result?.receiptNo ?? null,
        referenceNo: paymentMethod === 'cash' ? null : resolvedReferenceNo,
        referenceLabel: paymentMethod === 'cash' ? null : getReferenceLabel(paymentMethod),
        proofUploaded: uploadedProofUrls.length > 0,
        customerName: selectedCustomer.name,
        total: totalAmount,
        paymentMethod,
        items: [...cart],
        proofImageUrls: Array.isArray(result?.proofPhotoUrls) && result.proofPhotoUrls.length > 0
          ? result.proofPhotoUrls
          : uploadedProofUrls,
      });
      setStep(4);
    } catch (err: unknown) {
      console.error('Error creating sale:', err);
      const message = err instanceof Error ? err.message : 'Ralat semasa menyimpan jualan';
      alert(`Ralat semasa menyimpan jualan: ${message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white">Memuatkan...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/sales')}
            className="text-white/60 hover:text-white"
          >
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white">Jualan Baru</h1>
            <p className="text-white/60">Langkah {Math.min(step, 3)} daripada 3</p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3].map((s) => (
            <React.Fragment key={s}>
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
                  step >= s 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-slate-700 text-white/40'
                }`}
              >
                {step > s ? <Check size={20} /> : s}
              </div>
              {s < 3 && (
                <div className={`w-16 h-1 rounded ${step > s ? 'bg-blue-500' : 'bg-slate-700'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step 4: Success Screen */}
        {step === 4 && successData && (
          <div className="flex flex-col items-center justify-center py-12 space-y-6">
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full animate-pulse" />
              <div className="w-28 h-28 bg-emerald-500/10 rounded-full flex items-center justify-center relative border border-emerald-500/20">
                <CheckCircle className="text-emerald-400" size={56} />
              </div>
            </div>
            <div className="text-center space-y-1">
              <h2 className="text-3xl font-bold text-white">Jualan Berjaya!</h2>
              <p className="text-white/60">Transaksi telah berjaya disimpan.</p>
            </div>
            <Card className="w-full max-w-md p-6 space-y-4">
              <div className="flex justify-between items-center text-sm border-b border-slate-700 pb-3 gap-4">
                <span className="text-white/60">No. Invois</span>
                <span className="font-mono text-blue-300 text-right break-all">{successData.invoiceNo}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-b border-slate-700 pb-3">
                <span className="text-white/60">Pelanggan</span>
                <span className="font-bold text-white">{successData.customerName}</span>
              </div>
              {successData.receiptNo && (
                <div className="flex justify-between items-center text-sm border-b border-slate-700 pb-3">
                  <span className="text-white/60">No. Resit</span>
                  <span className="font-mono text-blue-300">{successData.receiptNo}</span>
                </div>
              )}
              {successData.referenceNo && successData.referenceLabel && (
                <div className="flex justify-between items-center text-sm border-b border-slate-700 pb-3 gap-4">
                  <span className="text-white/60">{successData.referenceLabel}</span>
                  <span className="font-mono text-blue-300 text-right break-all">{successData.referenceNo}</span>
                </div>
              )}
              {successData.proofUploaded && (
                <div className="flex justify-between items-center text-sm border-b border-slate-700 pb-3">
                  <span className="text-white/60">Bukti Bayaran</span>
                  <span className="text-emerald-400">{successData.proofImageUrls.length} gambar</span>
                </div>
              )}
              <div className="flex justify-between items-center text-sm border-b border-slate-700 pb-3">
                <span className="text-white/60">Kaedah Bayaran</span>
                <span className="text-white">{getPaymentLabel(successData.paymentMethod)}</span>
              </div>
              <div className="flex justify-between items-center text-lg font-bold">
                <span className="text-white">Jumlah</span>
                <span className="text-emerald-400">RM {successData.total.toFixed(2)}</span>
              </div>
              <Button
                variant="outline"
                className="w-full border-slate-700 hover:bg-slate-800 text-slate-300 flex items-center justify-center"
                onClick={() => handlePrintReceipt(successData)}
              >
                <Printer className="mr-2" size={18} /> {getDownloadLabel(successData.paymentMethod)}
              </Button>
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                onClick={() => router.replace('/sales')}
              >
                <ArrowLeft className="mr-2" size={18} /> Kembali ke Jualan
              </Button>
            </Card>
          </div>
        )}

        {/* Step Content */}
        {step !== 4 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Step 1: Select Customer */}
            {step === 1 && (
              <Card className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <User className="text-blue-400" size={24} />
                  <h2 className="text-xl font-bold text-white">Pilih Pelanggan</h2>
                </div>
                
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={20} />
                  <input
                    type="text"
                    placeholder="Cari pelanggan..."
                    value={searchCustomer}
                    onChange={(e) => setSearchCustomer(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredCustomers.map((customer) => (
                    <div
                      key={customer.id}
                      className={`p-4 rounded-lg cursor-pointer transition-all ${
                        selectedCustomer?.id === customer.id
                          ? 'bg-blue-500/20 border-2 border-blue-500'
                          : 'bg-slate-800 border-2 border-transparent hover:border-slate-600'
                      }`}
                      onClick={() => setSelectedCustomer(customer)}
                    >
                      <p className="font-semibold text-white">{customer.name}</p>
                      <p className="text-white/60 text-sm">{customer.phone}</p>
                      {customer.address && (
                        <p className="text-white/40 text-sm mt-1">{customer.address}</p>
                      )}
                    </div>
                  ))}
                </div>

                <Button
                  variant="primary"
                  size="lg"
                  className="w-full mt-4"
                  disabled={!selectedCustomer}
                  onClick={() => setStep(2)}
                >
                  Seterusnya
                </Button>
              </Card>
            )}

            {/* Step 2: Add Products */}
            {step === 2 && (
              <Card className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Package className="text-purple-400" size={24} />
                  <h2 className="text-xl font-bold text-white">Tambah Produk</h2>
                </div>

                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={20} />
                  <input
                    type="text"
                    placeholder="Cari produk..."
                    value={searchProduct}
                    onChange={(e) => setSearchProduct(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                  {filteredProducts.map((product) => {
                    const remainingStock = getRemainingStock(product.id);

                    return (
                    <div
                      key={product.id}
                      className={`p-4 rounded-lg border transition-all ${
                        remainingStock > 0
                          ? 'bg-slate-800 border-slate-700 hover:border-purple-500/50'
                          : 'bg-slate-900 border-slate-800 opacity-70'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold text-white">{product.name}</p>
                          <p className="text-purple-400 font-bold">RM {product.price?.toFixed(2)}</p>
                          <p className="text-white/30 text-xs uppercase tracking-wide mt-1">{product.unit || 'unit'}</p>
                        </div>
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={remainingStock <= 0}
                          onClick={() => addToCart(product)}
                        >
                          <Plus size={16} />
                        </Button>
                      </div>
                      <p className={`text-xs ${remainingStock > 0 ? 'text-white/40' : 'text-red-400'}`}>
                        {remainingStock > 0 ? `Baki stok van: ${remainingStock}` : 'Stok habis'}
                      </p>
                    </div>
                    );
                  })}
                </div>

                {!loading && filteredProducts.length === 0 && (
                  <div className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-8 text-center text-white/50">
                    Tiada stok dalam van untuk dijual.
                  </div>
                )}

                <div className="flex gap-3 mt-4">
                  <Button
                    variant="secondary"
                    size="lg"
                    className="flex-1"
                    onClick={() => setStep(1)}
                  >
                    Kembali
                  </Button>
                  <Button
                    variant="primary"
                    size="lg"
                    className="flex-1"
                    disabled={cart.length === 0}
                    onClick={() => setStep(3)}
                  >
                    Seterusnya
                  </Button>
                </div>
              </Card>
            )}

            {/* Step 3: Payment */}
            {step === 3 && (
              <Card className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <ShoppingCart className="text-emerald-400" size={24} />
                  <h2 className="text-xl font-bold text-white">Pembayaran</h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1 gap-3">
                      <label className="block text-white/60 text-sm">
                        No. Invois
                      </label>
                      <button
                        type="button"
                        onClick={regenerateInvoiceNo}
                        className="text-xs text-blue-300 hover:text-blue-200"
                      >
                        Jana semula
                      </button>
                    </div>
                    <input
                      type="text"
                      value={invoiceNo}
                      onChange={(e) => setInvoiceNo(e.target.value)}
                      placeholder="Akan dijana automatik"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                    />
                    <p className="text-xs text-white/40 mt-1">Cadangan nombor invois dijana automatik dan masih boleh diubah.</p>
                  </div>

                  <div>
                    <label className="block text-white/60 text-sm mb-2">Kaedah Pembayaran</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { value: 'cash', label: 'Tunai' },
                        { value: 'bill_to_bill', label: 'Kredit (Bill-to-Bill)' },
                        { value: 'bank_transfer', label: 'Bank Transfer' },
                        { value: 'qr_code', label: 'QR Code' },
                      ].map((m) => (
                        <button
                          key={m.value}
                          className={`p-3 rounded-lg border-2 transition-all text-sm ${
                            paymentMethod === m.value
                              ? 'border-emerald-500 bg-emerald-500/20 text-white'
                              : 'border-slate-700 bg-slate-800 text-white/60 hover:border-slate-600'
                          }`}
                          onClick={() => setPaymentMethod(m.value)}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Conditional reference number fields */}
                  {paymentMethod === 'cash' && (
                    <div>
                      <label className="block text-white/60 text-sm mb-1">
                        No. Resit
                      </label>
                      <div className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white/70 text-sm">
                        Akan dijana automatik semasa jualan disimpan.
                      </div>
                    </div>
                  )}
                  {paymentMethod === 'bill_to_bill' && (
                    <div>
                      <div className="flex items-center justify-between mb-1 gap-3">
                        <label className="block text-white/60 text-sm">
                          No. Invois / Rujukan Kredit
                        </label>
                        <button
                          type="button"
                          onClick={regenerateReferenceNo}
                          className="text-xs text-blue-300 hover:text-blue-200"
                        >
                          Jana semula
                        </button>
                      </div>
                      <input
                        type="text"
                        value={billingRefNo}
                        onChange={(e) => setBillingRefNo(e.target.value)}
                        placeholder="cth: B2B-KK-202603-001"
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                      />
                      <p className="text-xs text-white/40 mt-1">Nombor ini dijana automatik untuk memudahkan staf, tetapi masih boleh diubah.</p>
                    </div>
                  )}
                  {paymentMethod === 'bank_transfer' && (
                    <div>
                      <div className="flex items-center justify-between mb-1 gap-3">
                        <label className="block text-white/60 text-sm">
                          No. Rujukan Pemindahan
                        </label>
                        <button
                          type="button"
                          onClick={regenerateReferenceNo}
                          className="text-xs text-blue-300 hover:text-blue-200"
                        >
                          Jana semula
                        </button>
                      </div>
                      <input
                        type="text"
                        value={transferRefNo}
                        onChange={(e) => setTransferRefNo(e.target.value)}
                        placeholder="cth: TRF-20260326-001"
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                      />
                      <p className="text-xs text-white/40 mt-1">Gunakan nombor cadangan ini atau ubah ikut slip bank sebenar.</p>
                    </div>
                  )}
                  {paymentMethod === 'qr_code' && (
                    <div>
                      <div className="flex items-center justify-between mb-1 gap-3">
                        <label className="block text-white/60 text-sm">
                          No. Transaksi QR
                        </label>
                        <button
                          type="button"
                          onClick={regenerateReferenceNo}
                          className="text-xs text-blue-300 hover:text-blue-200"
                        >
                          Jana semula
                        </button>
                      </div>
                      <input
                        type="text"
                        value={qrTxnRefNo}
                        onChange={(e) => setQrTxnRefNo(e.target.value)}
                        placeholder="cth: QR-20260326-001"
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                      />
                      <p className="text-xs text-white/40 mt-1">Boleh terus guna nombor cadangan atau ganti dengan nombor transaksi QR sebenar.</p>
                    </div>
                  )}

                  {requiresPaymentProof(paymentMethod) && (
                    <div>
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <label className="block text-white/60 text-sm">
                        Bukti Pembayaran <span className="text-red-400">*</span>
                        </label>
                        <span className="text-xs text-white/40">{paymentProofs.length}/{MAX_PAYMENT_PROOF_IMAGES} gambar</span>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          if (files.length === 0) return;

                          const availableSlots = MAX_PAYMENT_PROOF_IMAGES - paymentProofs.length;
                          const selectedFiles = files.slice(0, availableSlots).filter((file) => file.type.startsWith('image/'));

                          if (selectedFiles.length === 0) {
                            e.target.value = '';
                            return;
                          }

                          setPaymentProofs((currentProofs) => [
                            ...currentProofs,
                            ...selectedFiles.map((file) => ({
                              id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                              file,
                              previewUrl: URL.createObjectURL(file),
                            })),
                          ]);

                          e.target.value = '';
                        }}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm file:mr-3 file:border-0 file:bg-blue-600 file:px-3 file:py-1 file:text-white file:rounded-md"
                      />
                      <p className="text-xs text-white/40 mt-1">Muat naik 1 hingga 4 gambar screenshot atau slip pembayaran untuk bank transfer atau QR.</p>
                      {paymentProofs.length > 0 && (
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          {paymentProofs.map((proof, index) => (
                            <div key={proof.id} className="rounded-lg overflow-hidden border border-slate-700 bg-slate-900">
                              <img src={proof.previewUrl} alt={`Bukti pembayaran ${index + 1}`} className="w-full h-36 object-cover" />
                              <div className="flex items-center justify-between px-3 py-2 text-xs text-white/70">
                                <span>Gambar {index + 1}</span>
                                <button
                                  type="button"
                                  className="text-red-300 hover:text-red-200"
                                  onClick={() => {
                                    setPaymentProofs((currentProofs) => {
                                      const target = currentProofs.find((item) => item.id === proof.id);
                                      if (target) {
                                        URL.revokeObjectURL(target.previewUrl);
                                      }

                                      return currentProofs.filter((item) => item.id !== proof.id);
                                    });
                                  }}
                                >
                                  Buang
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="bg-slate-800 rounded-lg p-4">
                    <h3 className="font-semibold text-white mb-3">Ringkasan Pesanan</h3>
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-white/60">
                        <span>Pelanggan:</span>
                        <span className="text-white">{selectedCustomer?.name}</span>
                      </div>
                      <div className="flex justify-between text-white/60">
                        <span>Item:</span>
                        <span className="text-white">{cart.length} produk</span>
                      </div>
                      <div className="flex justify-between text-white/60">
                        <span>Kuantiti:</span>
                        <span className="text-white">{cart.reduce((sum, i) => sum + i.quantity, 0)} unit</span>
                      </div>
                    </div>
                    <div className="border-t border-slate-700 pt-3">
                      <div className="flex justify-between text-lg font-bold">
                        <span className="text-white">Jumlah:</span>
                        <span className="text-emerald-400">RM {totalAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <Button
                    variant="secondary"
                    size="lg"
                    className="flex-1"
                    onClick={() => setStep(2)}
                  >
                    Kembali
                  </Button>
                  <Button
                    variant="primary"
                    size="lg"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    disabled={submitting}
                    onClick={handleSubmit}
                  >
                    {submitting ? 'Menyimpan...' : 'Selesai Jualan'}
                  </Button>
                </div>
              </Card>
            )}
          </div>

          {/* Cart Sidebar */}
          <div className="lg:col-span-1">
            <Card className="p-6 sticky top-6">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <ShoppingCart size={20} className="text-blue-400" />
                Troli ({cart.length})
              </h3>

              {cart.length === 0 ? (
                <p className="text-white/40 text-center py-8">Troli kosong</p>
              ) : (
                <>
                  <div className="space-y-3 max-h-64 overflow-y-auto mb-4">
                    {cart.map((item) => (
                      <div key={item.product.id} className="bg-slate-800 rounded-lg p-3">
                        <div className="flex justify-between items-start mb-2">
                          <p className="font-medium text-white text-sm">{item.product.name}</p>
                          <button
                            onClick={() => removeFromCart(item.product.id)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateQuantity(item.product.id, -1)}
                              className="w-6 h-6 rounded bg-slate-700 flex items-center justify-center text-white hover:bg-slate-600"
                            >
                              <Minus size={12} />
                            </button>
                            <span className="text-white w-8 text-center">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.product.id, 1)}
                              className="w-6 h-6 rounded bg-slate-700 flex items-center justify-center text-white hover:bg-slate-600"
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                          <p className="text-blue-400 font-semibold text-sm">
                            RM {(item.product.price * item.quantity).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-slate-700 pt-4">
                    <div className="flex justify-between text-lg font-bold">
                      <span className="text-white">Jumlah:</span>
                      <span className="text-emerald-400">RM {totalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </>
              )}
            </Card>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

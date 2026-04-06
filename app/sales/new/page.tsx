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
  CheckCircle,
  RotateCcw,
  Camera,
  X,
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
  area?: string;
  district?: string;
  town?: string;
  branch?: string;
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface ReturnItem {
  uid: string;
  productId: string;
  productName: string;
  quantity: number;
  reason: string;
  photos: File[];
  photoPreviews: string[];
}

const RETURN_REASONS = [
  'Rosak / Pecah',
  'Tamat Tempoh',
  'Produk Salah Hantar',
  'Lebihan Stok',
  'Kualiti Tidak Memuaskan',
  'Pelanggan Tidak Pesan',
  'Lain-lain',
];

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

function requiresPaymentProof(_paymentMethod: string) {
  // Semua kaedah bayaran WAJIB bukti gambar
  return true;
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

async function uploadReturnPhoto(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const filename = `exchange-returns/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from('sales-receipts')
    .upload(filename, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    });

  if (uploadError) throw uploadError;

  const { data: publicUrlData } = supabase.storage
    .from('sales-receipts')
    .getPublicUrl(filename);

  return publicUrlData.publicUrl;
}

export default function NewSalePage() {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1: Select Customer, 2: Add Products, 3: Payment
  const [userBranch, setUserBranch] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
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
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [serviceStepError, setServiceStepError] = useState('');
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
    returnedItems: Array<{ productName: string; quantity: number; reason: string }>;
  } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];

    try {
      const saved = localStorage.getItem('sales_area_today');
      if (!saved) return;

      const parsed = JSON.parse(saved);
      if (parsed?.date === today && parsed?.area) {
        setSelectedArea(String(parsed.area));
      }
    } catch {
      // Ignore malformed local storage payload.
    }
  }, []);

  const normalizeAreaValue = (value?: string | null) =>
    String(value || '')
      .trim()
      .replace(/\s+/g, ' ')
      .toUpperCase();

  const customerArea = (customer: Customer) =>
    customer.area || customer.district || customer.town || customer.branch || '';

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

  const filteredCustomers = customers.filter((customer) => {
    const matchesArea = !selectedArea || normalizeAreaValue(customerArea(customer)) === normalizeAreaValue(selectedArea);
    if (!matchesArea) return false;

    return (
      customer.name.toLowerCase().includes(searchCustomer.toLowerCase()) ||
      customer.phone?.includes(searchCustomer) ||
      customer.address?.toLowerCase().includes(searchCustomer.toLowerCase()) ||
      customerArea(customer).toLowerCase().includes(searchCustomer.toLowerCase())
    );
  });

  useEffect(() => {
    if (!selectedCustomer) return;

    const stillVisible = filteredCustomers.some((customer) => customer.id === selectedCustomer.id);
    if (!stillVisible) {
      setSelectedCustomer(null);
    }
  }, [filteredCustomers, selectedCustomer]);

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

  const addReturnItem = () => {
    setReturnItems((prev) => [
      ...prev,
      {
        uid: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        productId: '',
        productName: '',
        quantity: 1,
        reason: '',
        photos: [],
        photoPreviews: [],
      },
    ]);
  };

  const removeReturnItem = (uid: string) => {
    setReturnItems((prev) => {
      const target = prev.find((i) => i.uid === uid);
      if (target) target.photoPreviews.forEach((url) => URL.revokeObjectURL(url));
      return prev.filter((i) => i.uid !== uid);
    });
  };

  const updateReturnItem = (uid: string, field: string, value: unknown) => {
    setReturnItems((prev) =>
      prev.map((item) =>
        item.uid !== uid
          ? item
          : {
              ...item,
              [field]: value,
              ...(field === 'productId'
                ? { productName: products.find((p) => p.id === String(value))?.name || '' }
                : {}),
            }
      )
    );
  };

  const addReturnPhotos = (uid: string, files: File[]) => {
    if (files.length === 0) return;
    const previews = files.map((f) => URL.createObjectURL(f));
    setReturnItems((prev) =>
      prev.map((item) =>
        item.uid !== uid
          ? item
          : { ...item, photos: [...item.photos, ...files], photoPreviews: [...item.photoPreviews, ...previews] }
      )
    );
  };

  const removeReturnPhoto = (uid: string, index: number) => {
    setReturnItems((prev) =>
      prev.map((item) => {
        if (item.uid !== uid) return item;
        const preview = item.photoPreviews[index];
        if (preview) URL.revokeObjectURL(preview);
        return {
          ...item,
          photos: item.photos.filter((_, i) => i !== index),
          photoPreviews: item.photoPreviews.filter((_, i) => i !== index),
        };
      })
    );
  };

  const handleProceedFromService = () => {
    for (const item of returnItems) {
      if (!item.productId) {
        setServiceStepError('Sila pilih produk untuk semua item return.');
        return;
      }
      if (!item.reason) {
        setServiceStepError('Sila pilih sebab untuk semua item return.');
        return;
      }
      if (item.photos.length === 0) {
        setServiceStepError('Setiap item return mesti ada gambar produk.');
        return;
      }
    }
    setServiceStepError('');
    setStep(3);
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
    doc.setFont('helvetica', 'bold');
    doc.text('HAJA YANONGS INDUSTRIES', 48, 24);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    doc.text('Dokumen jualan rasmi dijana secara automatik', 48, 30);
    doc.text('Sales receipt prepared for field operations', 48, 35);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(getDocumentTitle(data.paymentMethod), pageWidth - 14, 23, { align: 'right' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    doc.text(`Tarikh: ${new Date().toLocaleDateString('ms-MY')}`, pageWidth - 14, 31, { align: 'right' });
    doc.text(`No. Invois: ${data.invoiceNo}`, pageWidth - 14, 36, { align: 'right' });
    doc.text(`No. Resit: ${data.receiptNo || '-'}`, pageWidth - 14, 41, { align: 'right' });

    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(12, 60, pageWidth - 24, 26, 3, 3, 'FD');
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('BIL KEPADA', 15, 67);
    doc.text('BUTIRAN PEMBAYARAN', pageWidth / 2 + 8, 67);
    doc.setFont('helvetica', 'normal');
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

    // Returns / Refund table
    if (data.returnedItems && data.returnedItems.length > 0) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(180, 83, 9); // amber-700
      doc.text('REKOD RETURN / REFUND', 12, currentY + 4);
      currentY += 8;

      autoTable(doc, {
        startY: currentY,
        margin: { left: 12, right: 12 },
        head: [['Produk', 'Kuantiti', 'Sebab Return']],
        body: data.returnedItems.map((ri) => [
          ri.productName,
          ri.quantity.toString(),
          ri.reason,
        ]),
        theme: 'grid',
        styles: {
          fontSize: 8,
          cellPadding: 3,
          lineColor: [251, 191, 36],
          lineWidth: 0.3,
          textColor: [15, 23, 42],
        },
        headStyles: {
          fillColor: [180, 83, 9],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8.5,
        },
        bodyStyles: { fillColor: [255, 251, 235] },
        columnStyles: {
          0: { cellWidth: 90 },
          1: { cellWidth: 24, halign: 'center' },
          2: { halign: 'left' },
        },
      });

      currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY + 8;
    }

    doc.setFillColor(15, 23, 42);
    doc.roundedRect(pageWidth - 76, currentY, 64, 22, 3, 3, 'F');
    doc.setTextColor(203, 213, 225);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('JUMLAH BAYARAN', pageWidth - 70, currentY + 6);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`RM ${data.total.toFixed(2)}`, pageWidth - 14, currentY + 16, { align: 'right' });
    currentY += 28;

    doc.setFontSize(7);
    doc.setTextColor(107, 114, 128);
    doc.setFont('helvetica', 'normal');
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

      const salesArea = (() => {
        try {
          const saved = localStorage.getItem('sales_area_today');
          if (saved) { const p = JSON.parse(saved); return p.area || ''; }
        } catch { /* ignore */ }
        return '';
      })();

      const salePayload = {
        invoice: resolvedInvoiceNo,
        customer_id: selectedCustomer.id,
        customer_name: selectedCustomer.name,
        area: salesArea,
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
        returnedItems: returnItems.map((i) => ({
          productName: i.productName,
          quantity: i.quantity,
          reason: i.reason,
        })),
      });

      // Submit return items from the Service step
      if (returnItems.length > 0) {
        for (const item of returnItems) {
          try {
            const uploadedReturnPhotos = await Promise.all(item.photos.map(uploadReturnPhoto));
            await fetch('/api/exchange-returns', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sale_id: result?.id || null,
                invoice: resolvedInvoiceNo,
                product_id: item.productId,
                product_name: item.productName,
                quantity: item.quantity,
                type: 'return',
                reason: item.reason,
                proof_photo_urls: uploadedReturnPhotos,
                notes: `Return dari jualan ${resolvedInvoiceNo}. Pelanggan: ${selectedCustomer.name}`,
              }),
            });
          } catch (returnErr) {
            console.error('Error submitting return item:', returnErr);
            // Non-blocking — sale still succeeds even if return submission fails
          }
        }
      }

      setStep(5);
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
            <p className="text-white/60">Langkah {step} daripada 5</p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center justify-center gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <React.Fragment key={s}>
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                    step >= s
                      ? s === 5 && step === 5 ? 'bg-emerald-500 text-white' : 'bg-blue-500 text-white'
                      : 'bg-slate-700 text-white/40'
                  }`}
                >
                  {step > s ? <Check size={16} /> : s === 5 && step === 5 ? <Check size={16} /> : s}
                </div>
                {s < 5 && (
                  <div className={`w-8 h-1 rounded ${step > s ? 'bg-blue-500' : 'bg-slate-700'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
          <div className="flex items-center justify-center gap-1">
            {['Pelanggan', 'Service', 'Produk', 'Bayaran', 'Berjaya'].map((label, i) => (
              <React.Fragment key={i}>
                <span className={`text-xs w-9 text-center leading-tight ${
                  step === i + 1 ? 'text-blue-300 font-semibold' : 'text-white/30'
                }`}>{label}</span>
                {i < 4 && <div className="w-8" />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Step 5: Jualan Berjaya */}
        {step === 5 && successData && (
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
        {step !== 5 && (
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

                {selectedArea && (
                  <div className="mb-4 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">
                    Menapis pelanggan untuk kawasan <span className="font-semibold text-white">{selectedArea}</span>
                  </div>
                )}

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
                      {customerArea(customer) && (
                        <p className="text-blue-300 text-xs mt-1 uppercase tracking-wide">{customerArea(customer)}</p>
                      )}
                      {customer.address && (
                        <p className="text-white/40 text-sm mt-1">{customer.address}</p>
                      )}
                    </div>
                  ))}
                  {filteredCustomers.length === 0 && (
                    <div className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-6 text-center text-sm text-white/50">
                      Tiada pelanggan dijumpai untuk kawasan ini.
                    </div>
                  )}
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

            {/* Step 2: Service - Baki Stok & Return */}
            {step === 2 && (
              <Card className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <RotateCcw className="text-amber-400" size={24} />
                  <h2 className="text-xl font-bold text-white">Semak Baki &amp; Return</h2>
                </div>

                {/* Baki Stok Van */}
                <div className="mb-6">
                  <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Baki Stok Van Semasa</h3>
                  <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
                    {products.map((product) => (
                      <div key={product.id} className="bg-slate-800 rounded-lg px-3 py-2 flex justify-between items-center gap-2">
                        <span className="text-white text-sm truncate">{product.name}</span>
                        <span className={`text-sm font-bold flex-shrink-0 ${product.stock > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {product.stock} {product.unit || 'unit'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Return / Refund Section */}
                <div className="border-t border-slate-700 pt-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">Return / Refund Produk</h3>
                    <button
                      type="button"
                      onClick={addReturnItem}
                      className="flex items-center gap-1.5 text-sm bg-amber-600 hover:bg-amber-500 text-white rounded-lg px-3 py-1.5 transition-colors"
                    >
                      <Plus size={14} /> Tambah
                    </button>
                  </div>

                  {returnItems.length === 0 ? (
                    <p className="text-white/40 text-sm text-center py-6 border border-dashed border-slate-700 rounded-lg">
                      Tiada return. Tekan &quot;Tambah&quot; jika ada produk yang perlu di-return.
                    </p>
                  ) : (
                    <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
                      {returnItems.map((item, index) => (
                        <div key={item.uid} className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-amber-400 font-semibold text-sm">Return #{index + 1}</span>
                            <button
                              type="button"
                              onClick={() => removeReturnItem(item.uid)}
                              className="text-red-400 hover:text-red-300 transition-colors"
                            >
                              <X size={16} />
                            </button>
                          </div>

                          {/* Product */}
                          <div className="mb-3">
                            <label className="text-white/50 text-xs mb-1 block">Produk</label>
                            <select
                              value={item.productId}
                              onChange={(e) => updateReturnItem(item.uid, 'productId', e.target.value)}
                              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
                            >
                              <option value="">-- Pilih Produk --</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                          </div>

                          {/* Quantity */}
                          <div className="mb-3">
                            <label className="text-white/50 text-xs mb-1 block">Kuantiti</label>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => updateReturnItem(item.uid, 'quantity', Math.max(1, item.quantity - 1))}
                                className="w-8 h-8 rounded bg-slate-700 flex items-center justify-center text-white hover:bg-slate-600"
                              >
                                <Minus size={14} />
                              </button>
                              <span className="text-white w-10 text-center font-bold">{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() => updateReturnItem(item.uid, 'quantity', item.quantity + 1)}
                                className="w-8 h-8 rounded bg-slate-700 flex items-center justify-center text-white hover:bg-slate-600"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          </div>

                          {/* Reason */}
                          <div className="mb-3">
                            <label className="text-white/50 text-xs mb-1 block">Sebab Return</label>
                            <select
                              value={item.reason}
                              onChange={(e) => updateReturnItem(item.uid, 'reason', e.target.value)}
                              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
                            >
                              <option value="">-- Pilih Sebab --</option>
                              {RETURN_REASONS.map((r) => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                          </div>

                          {/* Photo */}
                          <div>
                            <label className="text-white/50 text-xs mb-1 block">
                              Gambar Produk <span className="text-red-400">*</span>
                            </label>
                            {item.photoPreviews.length > 0 && (
                              <div className="grid grid-cols-3 gap-2 mb-2">
                                {item.photoPreviews.map((preview, pi) => (
                                  <div key={pi} className="relative rounded-lg overflow-hidden border border-slate-600">
                                    <img src={preview} alt={`Gambar ${pi + 1}`} className="w-full h-20 object-cover" />
                                    <button
                                      type="button"
                                      onClick={() => removeReturnPhoto(item.uid, pi)}
                                      className="absolute top-1 right-1 w-5 h-5 bg-red-600/80 rounded-full flex items-center justify-center text-white"
                                    >
                                      <X size={10} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            <label className="flex items-center gap-2 cursor-pointer bg-slate-900 border border-dashed border-slate-600 hover:border-amber-500 rounded-lg px-3 py-2 text-white/50 hover:text-white text-sm transition-all">
                              <Camera size={16} />
                              <span>Snap / Pilih Gambar</span>
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                multiple
                                className="hidden"
                                onChange={(e) => {
                                  addReturnPhotos(item.uid, Array.from(e.target.files || []));
                                  e.target.value = '';
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {serviceStepError && (
                    <p className="text-red-400 text-sm mt-3">{serviceStepError}</p>
                  )}
                </div>

                <div className="flex gap-3 mt-6">
                  <Button variant="secondary" size="lg" className="flex-1" onClick={() => setStep(1)}>
                    Kembali
                  </Button>
                  <Button variant="primary" size="lg" className="flex-1" onClick={handleProceedFromService}>
                    Seterusnya
                  </Button>
                </div>
              </Card>
            )}

            {/* Step 3: Tambah Produk */}
            {step === 3 && (
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
                    onClick={() => setStep(2)}
                  >
                    Kembali
                  </Button>
                  <Button
                    variant="primary"
                    size="lg"
                    className="flex-1"
                    disabled={cart.length === 0}
                    onClick={() => setStep(4)}
                  >
                    Seterusnya
                  </Button>
                </div>
              </Card>
            )}

            {/* Step 4: Bayaran */}
            {step === 4 && (
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
                    onClick={() => setStep(3)}
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

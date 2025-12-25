"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

type Language = 'ms' | 'en';

type Translations = {
  [key: string]: {
    ms: string;
    en: string;
  };
};

// Master Dictionary
const dictionary: Translations = {
  // Common
  back: { ms: 'Kembali', en: 'Back' },
  next: { ms: 'Seterusnya', en: 'Next' },
  save: { ms: 'Simpan', en: 'Save' },
  clear: { ms: 'Padam', en: 'Clear' },
  cancel: { ms: 'Batal', en: 'Cancel' },
  loading: { ms: 'Memuatkan...', en: 'Loading...' },
  error: { ms: 'Ralat', en: 'Error' },
  success: { ms: 'Berjaya', en: 'Success' },
  
  // Login
  login_title: { ms: 'Log Masuk SAYS', en: 'SAYS Login' },
  login_subtitle: { ms: 'Sila log masuk untuk meneruskan', en: 'Please login to continue' },
  username: { ms: 'Nama Pengguna', en: 'Username' },
  password: { ms: 'Kata Laluan', en: 'Password' },
  enter_username: { ms: 'Masukkan nama pengguna', en: 'Enter username' },
  enter_password: { ms: 'Masukkan kata laluan', en: 'Enter password' },
  login_button: { ms: 'Log Masuk', en: 'Login' },
  login_failed: { ms: 'Log masuk gagal', en: 'Login failed' },
  login_error: { ms: 'Ralat berlaku. Sila cuba lagi.', en: 'An error occurred. Please try again.' },
  default_admin: { ms: 'Admin Lalai', en: 'Default Admin' },
  default_sales: { ms: 'Sales Lalai', en: 'Default Sales' },

  // Admin
  admin_dashboard: { ms: 'Papan Pemuka Admin', en: 'Admin Dashboard' },
  manage_customers_products: { ms: 'Urus Pelanggan & Produk', en: 'Manage Customers & Products' },
  customers: { ms: 'Pelanggan', en: 'Customers' },
  products: { ms: 'Produk', en: 'Products' },
  add_customer: { ms: 'Tambah Pelanggan Baru', en: 'Add New Customer' },
  edit_customer: { ms: 'Kemaskini Pelanggan', en: 'Edit Customer' },
  shop_name: { ms: 'Nama Kedai', en: 'Shop Name' },
  address: { ms: 'Alamat', en: 'Address' },
  debt_balance: { ms: 'Baki Hutang (RM)', en: 'Outstanding Balance (RM)' },
  select_sales: { ms: '-- Pilih Sales Person (Opsyenal) --', en: '-- Select Sales Person (Optional) --' },
  customer_list: { ms: 'Senarai Pelanggan', en: 'Customer List' },
  add_product: { ms: 'Tambah Produk Baru', en: 'Add New Product' },
  edit_product: { ms: 'Kemaskini Produk', en: 'Edit Product' },
  product_name: { ms: 'Nama Produk', en: 'Product Name' },
  unit_label: { ms: 'Unit (cth: pkt, btl)', en: 'Unit (e.g., pkt, btl)' },
  price_label: { ms: 'Harga (RM)', en: 'Price (RM)' },
  product_list: { ms: 'Senarai Produk', en: 'Product List' },
  update: { ms: 'Kemaskini', en: 'Update' },
  customer_saved: { ms: 'Pelanggan berjaya disimpan!', en: 'Customer saved successfully!' },
  customer_save_fail: { ms: 'Gagal menyimpan pelanggan.', en: 'Failed to save customer.' },
  product_saved: { ms: 'Produk berjaya disimpan!', en: 'Product saved successfully!' },
  product_save_fail: { ms: 'Gagal menyimpan produk.', en: 'Failed to save product.' },
  admin_sales_label: { ms: 'Sales: ', en: 'Sales: ' },
  lat: { ms: 'Lat', en: 'Lat' },
  lon: { ms: 'Long', en: 'Lon' },

  // Sales Wizard (Existing)
  dashboard_title: { ms: 'Laluan Hari Ini', en: "Today's Route" },
  visit_history: { ms: 'Lawatan Selesai', en: 'Completed Visits' },
  start_visit: { ms: 'Mula Lawatan', en: 'Start Visit' },
  check_in_at: { ms: 'Check-In di', en: 'Check-In at' },
  confirm_checkin: { ms: 'SAHKAN KEHADIRAN', en: 'CONFIRM CHECK-IN' },
  search_product: { ms: 'Cari produk...', en: 'Search products...' },
  visit_completed: { ms: 'Lawatan Selesai!', en: 'Visit Completed!' },
  transaction_saved: { ms: 'Transaksi berjaya disimpan.', en: 'Transaction successfully saved.' },
  print_receipt: { ms: 'Cetak Resit', en: 'Print Receipt' },
  back_to_route: { ms: 'Kembali ke Laluan', en: 'Back to Route' },
  welcome_title: { ms: 'Selamat Datang', en: 'Welcome' },
  welcome_subtitle: { ms: 'Sila pilih pelanggan untuk memulakan lawatan.', en: 'Select a customer to start visit.' },
  system_title: { ms: 'Sistem Jualan Digital', en: 'Digital Sales System' },
  step: { ms: 'Langkah', en: 'Step' },
  select_customer: { ms: 'Pilih Pelanggan', en: 'Select Customer' },
  search_store: { ms: 'Cari kedai...', en: 'Search store...' },
  debt: { ms: 'Hutang', en: 'Debt' },
  balance: { ms: 'Baki', en: 'Balance' },
  add_sales_items: { ms: 'Menambah Item Jualan', en: 'Add Sale Items' },
  current_total: { ms: 'Jumlah Semasa', en: 'Current Total' },
  next_payment: { ms: 'Seterusnya (Bayaran)', en: 'Next (Payment)' },
  amount_to_pay: { ms: 'Jumlah Perlu Dibayar', en: 'Amount to Pay' },
  payment_method: { ms: 'Kaedah Bayaran', en: 'Payment Method' },
  method_cash: { ms: 'Tunai', en: 'Cash' },
  method_transfer: { ms: 'Transfer', en: 'Transfer' },
  method_credit: { ms: 'Kredit', en: 'Credit' },
  others_optional: { ms: 'Lain-lain (Pilihan)', en: 'Others (Optional)' },
  return_label: { ms: 'Pulangan (Return)', en: 'Returns' },
  exchange_label: { ms: 'Tukar Barang (Exchange)', en: 'Exchange' },
  foc_label: { ms: 'FOC (Percuma)', en: 'FOC' },
  confirm_submit: { ms: 'SAHKAN & HANTAR', en: 'CONFIRM & SUBMIT' },
  customer_label: { ms: 'Pelanggan:', en: 'Customer:' },
  total_items: { ms: 'Jumlah Item:', en: 'Total Items:' },
  total: { ms: 'Total:', en: 'Total:' },
  signature_title: { ms: 'Tandatangan Pelanggan', en: 'Customer Signature' },
  proof_delivery: { ms: 'Bukti Penghantaran', en: 'Proof of Delivery' },
  gps_unavailable: { ms: 'GPS tidak aktif', en: 'GPS not available' },
  open_maps: { ms: 'Buka Maps', en: 'Open Maps' },
  brand_client: { ms: 'Haja Yanong Industries', en: 'Haja Yanong Industries' },
  developed_by: { ms: 'Developed by A.P NETSA', en: 'Developed by A.P NETSA' },
  visited: { ms: 'SELESAI', en: 'DONE' },
  pending: { ms: 'BELUM', en: 'PENDING' },
  orders: { ms: 'Pesanan:', en: 'Orders:' },
  unit: { ms: 'unit', en: 'units' },

  // Order Management (Phase 2)
  visits: { ms: 'Lawatan', en: 'Visits' },
  history: { ms: 'Sejarah', en: 'History' },
  order_management: { ms: 'Pengurusan Pesanan', en: 'Order Management' },
  search_orders: { ms: 'Cari pesanan...', en: 'Search orders...' },
  date: { ms: 'Tarikh', en: 'Date' },
  status: { ms: 'Status', en: 'Status' },
  assigned_shop: { ms: 'Kedai Ditugaskan', en: 'Assigned Shop' },
  actions: { ms: 'Tindakan', en: 'Actions' },
  manage: { ms: 'Urus', en: 'Manage' },
  no_orders: { ms: 'Tiada pesanan ditemui.', en: 'No orders found.' },
  update_status: { ms: 'Kemaskini Status', en: 'Update Status' },
  assign_shop: { ms: 'Tugaskan Kedai', en: 'Assign Shop' },
  select_shop: { ms: 'Pilih Kedai...', en: 'Select Shop...' },
  save_changes: { ms: 'Simpan Perubahan', en: 'Save Changes' },
  order_history: { ms: 'Sejarah Pesanan', en: 'Order History' },
  items_count: { ms: 'item', en: 'items' },
  assigned_to: { ms: 'Ditugaskan kepada:', en: 'Assigned to:' },
  cancel_button: { ms: 'Batal', en: 'Cancel' },
  get_location: { ms: 'Dapatkan Lokasi Semasa', en: 'Get Current Location' },
  map: { ms: 'Peta', en: 'Map' },
  location_found: { ms: 'Lokasi ditemui!', en: 'Location found!' },
  location_error: { ms: 'Gagal mendapatkan lokasi.', en: 'Failed to get location.' },
  
  // Phase 3
  print_invoice: { ms: 'Cetak Invois', en: 'Print Invoice' },
  gps_required: { ms: 'Sila aktifkan GPS untuk mulakan pesanan.', en: 'Please enable GPS to start order.' },
  view_location: { ms: 'Lihat Lokasi', en: 'View Location' },
  sales_person: { ms: 'Jurujual', en: 'Salesperson' },
  invoice_no: { ms: 'No. Invois', en: 'Invoice No' },
  invoice_date: { ms: 'Tarikh Invois', en: 'Invoice Date' },
  bill_to: { ms: 'Kepada', en: 'Bill To' },
  receipt: { ms: 'Resit', en: 'Receipt' },

  // Phase 4: Stock Audit & Analytics
  stock_audit: { ms: 'Audit Stok Fizikal', en: 'Physical Stock Audit' },
  stock_audit_desc: { ms: 'Sila masukkan baki stok fizikal yang terdapat di premis pelanggan.', en: 'Please enter physical stock balance at customer premise.' },
  submit_audit: { ms: 'Hantar Audit', en: 'Submit Audit' },
  skip: { ms: 'Langkau', en: 'Skip' },
  suggestion_restock: { ms: 'Cadangan: Tambah Stok', en: 'Suggestion: Restock' },
  analytics: { ms: 'Laporan & Analitik', en: 'Analytics & Reports' },
  top_products: { ms: 'Top 5 Produk Terlaris', en: 'Top 5 Best Selling Products' },
  top_agents: { ms: 'Top Sales Agent', en: 'Top Sales Agents' },
  sales_trend: { ms: 'Trend Jualan', en: 'Sales Trend' },
  low_stock_alerts: { ms: 'Amaran Stok Rendah', en: 'Low Stock Alerts' }
};

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>('ms');

  const t = (key: string) => {
    if (dictionary[key]) {
      return dictionary[key][lang];
    }
    console.warn(`Translation missing for key: ${key}`);
    return key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

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
  low_stock_alerts: { ms: 'Amaran Stok Rendah', en: 'Low Stock Alerts' },

  // Monthly Reports
  monthly_reports: { ms: 'Laporan Bulanan', en: 'Monthly Reports' },
  sales_analysis: { ms: 'Analisis jualan terperinci dan metrik prestasi mengikut cawangan', en: 'Detailed sales analysis and performance metrics by branch' },
  select_month: { ms: 'Pilih Bulan', en: 'Select Month' },
  select_branch: { ms: 'Pilih Cawangan', en: 'Select Branch' },
  all_branches: { ms: 'Semua Cawangan', en: 'All Branches' },
  total_revenue: { ms: 'Jumlah Hasil', en: 'Total Revenue' },
  avg_transaction: { ms: 'Transaksi Purata', en: 'Avg Transaction' },
  active_branches: { ms: 'Cawangan Aktif', en: 'Active Branches' },
  loading_report: { ms: 'Memuatkan data laporan...', en: 'Loading report data...' },
  no_data_available: { ms: 'Tiada data tersedia untuk bulan dan cawangan ini.', en: 'No data available for this month and branch.' },
  daily_sales_trend: { ms: 'Trend Jualan Harian', en: 'Daily Sales Trend' },
  top_products_chart: { ms: 'Produk Terlaris', en: 'Top Products' },
  branch_summary: { ms: 'Ringkasan Cawangan', en: 'Branch Summary' },
  revenue: { ms: 'Hasil', en: 'Revenue' },
  transactions: { ms: 'Transaksi', en: 'Transactions' },
  quantity: { ms: 'Kuantiti', en: 'Quantity' },
  export_pdf: { ms: 'Eksport PDF', en: 'Export PDF' },
  generating: { ms: 'Menjana...', en: 'Generating...' },

  // User Management
  user_management: { ms: 'Pengurusan Pengguna', en: 'User Management' },
  register_user: { ms: 'Daftarkan Pengguna Baru', en: 'Register New User' },
  full_name: { ms: 'Nama Penuh', en: 'Full Name' },
  confirm_password: { ms: 'Sahkan Kata Laluan', en: 'Confirm Password' },
  password_must_match: { ms: 'Kata laluan mesti sama', en: 'Passwords must match' },
  user_role: { ms: 'Peranan Pengguna', en: 'User Role' },
  admin_role: { ms: 'Admin', en: 'Admin' },
  sales_role: { ms: 'Sales', en: 'Sales' },
  user_branch: { ms: 'Cawangan', en: 'Branch' },
  kota_kinabalu: { ms: 'Kota Kinabalu', en: 'Kota Kinabalu' },
  kinabatangan: { ms: 'Kinabatangan', en: 'Kinabatangan' },
  hq: { ms: 'Ibu Pejabat', en: 'HQ' },
  register_button: { ms: 'Daftar Pengguna', en: 'Register User' },
  user_list: { ms: 'Senarai Pengguna', en: 'User List' },
  joined_date: { ms: 'Tarikh Bergabung', en: 'Joined Date' },
  edit_delete: { ms: 'Kemaskini / Padam', en: 'Edit / Delete' },
  branch_access_warning: { ms: 'Anda hanya boleh mengakses pengguna untuk cawangan anda sendiri.', en: 'You can only access users for your own branch.' },
  user_created_success: { ms: 'Pengguna berjaya didaftarkan!', en: 'User registered successfully!' },
  user_create_failed: { ms: 'Gagal mendaftarkan pengguna.', en: 'Failed to register user.' },
  user_deleted_success: { ms: 'Pengguna berjaya dihapuskan.', en: 'User deleted successfully.' },
  user_delete_failed: { ms: 'Gagal menghapuskan pengguna.', en: 'Failed to delete user.' },
  confirm_delete: { ms: 'Adakah anda pasti untuk menghapuskan pengguna ini?', en: 'Are you sure you want to delete this user?' },

  // Admin Navigation & Headers
  admin_section: { ms: 'Bahagian Admin', en: 'Admin Section' },
  dashboard: { ms: 'Papan Pemuka', en: 'Dashboard' },
  reports: { ms: 'Laporan', en: 'Reports' },
  audit_center: { ms: 'Pusat Audit', en: 'Audit Center' },
  settings: { ms: 'Tetapan', en: 'Settings' },
  logout: { ms: 'Log Keluar', en: 'Logout' },
  user_info: { ms: 'Info Pengguna', en: 'User Info' },
  logged_in_as: { ms: 'Log masuk sebagai:', en: 'Logged in as:' },
  admin_panel: { ms: 'Panel Admin', en: 'Admin Panel' },
  founder_dashboard: { ms: 'Papan Pemuka Pengasas', en: 'Founder Dashboard' },
  branch: { ms: 'Cawangan', en: 'Branch' },
  role: { ms: 'Peranan', en: 'Role' },
  main_admin: { ms: 'Admin Utama', en: 'Main Admin' },
  store_management: { ms: 'Pengurusan Kedai', en: 'Store Management' },
  product_management: { ms: 'Pengurusan Produk', en: 'Product Management' },
  sales_history: { ms: 'Sejarah Jualan', en: 'Sales History' },
  audits: { ms: 'Audit', en: 'Audits' },
  commissions: { ms: 'Komisen', en: 'Commissions' },

  // Navigation & Admin Section Labels
  overview: { ms: 'Gambaran Keseluruhan', en: 'Overview' },
  global_monitor: { ms: 'Pemantau Global', en: 'Global Monitor' },
  van_loading: { ms: 'Muatan Van', en: 'Van Loading' },
  staff_mgmt: { ms: 'Pengurusan Kakitangan', en: 'Staff Management' },
  database_nav: { ms: 'Pangkalan Data', en: 'Database' },
  backdated_import: { ms: 'Import Data Lama', en: 'Backdated Import' },

  // Additional Admin & User Info
  per_transaction: { ms: 'Setiap transaksi', en: 'Per transaction' },
  active_branches_count: { ms: 'Cawangan aktif', en: 'Active branches' },

  // Admin Dashboard Headers (for server-component pages)
  admin_welcome_subtitle: { ms: 'Selamat kembali, inilah perkembangan jualan lapangan anda hari ini.', en: "Welcome back, here's what's happening with your field sales today." },
  kk_dashboard_title: { ms: 'Papan Pemuka Kota Kinabalu', en: 'Kota Kinabalu Dashboard' },
  kk_dashboard_subtitle: { ms: 'Pemantauan jualan masa nyata untuk cawangan Kota Kinabalu.', en: 'Real-time sales monitoring for Kota Kinabalu branch.' },
  kb_dashboard_title: { ms: 'Papan Pemuka Kinabatangan', en: 'Kinabatangan Dashboard' },
  kb_dashboard_subtitle: { ms: 'Pemantauan jualan masa nyata untuk cawangan Kinabatangan.', en: 'Real-time sales monitoring for Kinabatangan branch.' },

  // AnalyticsDashboard
  filter_by_branch: { ms: 'Tapis Mengikut Cawangan', en: 'Filter by Branch' },
  master_sales_report: { ms: 'Laporan Jualan Utama', en: 'Master Sales Report' },
  showing_data_for: { ms: 'Menunjukkan data untuk', en: 'Showing data for' },
  all_time: { ms: 'Semua Masa', en: 'All Time' },
  total_transactions_label: { ms: 'Jumlah Transaksi', en: 'Total Transactions' },
  avg_order_value: { ms: 'Nilai Pesanan Purata', en: 'Avg. Order Value' },
  active_agents: { ms: 'Ejen Aktif', en: 'Active Agents' },
  exchange_return_tracking: { ms: 'Pengesanan Pertukaran & Pulangan (Buangan)', en: 'Exchange & Return Tracking (Disposal)' },
  no_returns: { ms: 'Tiada rekod pulangan', en: 'No returns recorded' },
  sold: { ms: 'terjual', en: 'sold' },
  ranking_for: { ms: 'Kedudukan untuk', en: 'Ranking for' },
  no_sales_data: { ms: 'Tiada data jualan', en: 'No sales data' },
  no_data: { ms: 'Tiada data', en: 'No data' },
  last_7_days: { ms: '7 Hari Lepas', en: 'Last 7 Days' },
  current_stock: { ms: 'Stok Semasa', en: 'Current Stock' },
  customer_loc: { ms: 'Pelanggan/Lokasi', en: 'Customer/Loc' },
  no_low_stock: { ms: 'Tiada amaran stok rendah', en: 'No low stock alerts' },
  product: { ms: 'Produk', en: 'Product' },
  type_label: { ms: 'Jenis', en: 'Type' },
  qty: { ms: 'Kuantiti', en: 'Qty' },
  reason: { ms: 'Sebab', en: 'Reason' },

  // Backdated Import
  backdated_import_desc: { ms: 'Import data jualan dari bulan-bulan sebelum sistem dikuatkuasakan. Guna template CSV yang disediakan.', en: 'Import historical sales data from months before the system was enforced. Use the provided CSV template.' },
  official_csv_template: { ms: 'Template CSV Rasmi', en: 'Official CSV Template' },
  official_template_desc: { ms: 'Isi template ini dalam Excel. Boleh upload terus sebagai .xlsx atau export ke CSV dahulu.', en: 'Fill this template in Excel. You can upload directly as .xlsx or export to CSV first.' },
  customer_list_system: { ms: 'Senarai Nama Customer Dalam Sistem', en: 'Customer Name List In System' },
  no_customer_data: { ms: 'Tiada data customer.', en: 'No customer data.' },
  customer_name_warning: { ms: 'Nama dalam kolum customer_name CSV mesti sama persis dengan senarai di atas supaya ID dapat dipadankan.', en: 'Names in the customer_name column must exactly match the list above for ID matching.' },
  drag_drop_file: { ms: 'Drag & drop fail CSV atau Excel di sini', en: 'Drag & drop your CSV or Excel file here' },
  drop_hint: { ms: 'atau klik butang di bawah — Terima: .xlsx / .csv — maksimum 500 baris', en: 'or click below — Accepts: .xlsx / .csv — max 500 rows' },
  release_here: { ms: 'Lepaskan fail di sini!', en: 'Release file here!' },
  choose_file_btn: { ms: 'Pilih Fail', en: 'Choose File' },
  rows_detected: { ms: 'baris dikesan', en: 'rows detected' },
  discard_file: { ms: 'Buang fail', en: 'Discard file' },
  all_rows_valid: { ms: 'Semua baris sah', en: 'All rows valid' },
  errors_found_label: { ms: 'ralat ditemui', en: 'errors found' },
  row_label: { ms: 'Baris', en: 'Row' },
  records_label: { ms: 'rekod', en: 'records' },
  import_success_title: { ms: 'Import Berjaya!', en: 'Import Successful!' },
  load_new_file: { ms: 'Muat Fail Baru', en: 'Load New File' },
  import_another: { ms: 'Import Fail Lain', en: 'Import Another File' },
  validating: { ms: 'Menyemak...', en: 'Validating...' },
  saving: { ms: 'Menyimpan...', en: 'Saving...' },
  confirm_import: { ms: 'Sahkan Import', en: 'Confirm Import' },

  // Global Monitor
  global_monitor_subtitle: { ms: 'Analisis prestasi perbandingan: Kota Kinabalu vs Kinabatangan', en: 'Comparative performance analysis: Kota Kinabalu vs Kinabatangan' },
  kk_only: { ms: 'Kota Kinabalu Sahaja', en: 'Kota Kinabalu Only' },
  kb_only: { ms: 'Kinabatangan Sahaja', en: 'Kinabatangan Only' },
  total_orders: { ms: 'Jumlah Pesanan', en: 'Total Orders' },
  revenue_distribution: { ms: 'Agihan Hasil', en: 'Revenue Distribution' },

  // Users Page
  add_user: { ms: 'Tambah Pengguna', en: 'Add User' },
  delete_reason_required: { ms: 'Sebab Padam (Wajib)', en: 'Delete Reason (Required)' },
  ref_no_optional: { ms: 'No. Rujukan (Pilihan)', en: 'Reference No (Optional)' },
  create_user_btn: { ms: 'Cipta Pengguna', en: 'Create User' },
  staff_directory: { ms: 'Direktori Kakitangan', en: 'Staff Directory' },
  loading_users: { ms: 'Memuatkan pengguna...', en: 'Loading users...' },
  no_users_found: { ms: 'Tiada pengguna dijumpai dalam cawangan anda', en: 'No users found in your branch' },
  name_col: { ms: 'Nama', en: 'Name' },
  joined_col: { ms: 'Tarikh Sertai', en: 'Joined' },
  actions_col: { ms: 'Tindakan', en: 'Actions' },
  viewing_users_from: { ms: 'Melihat pengguna dari:', en: 'Viewing users from:' },
  access_limited: { ms: 'Anda mempunyai akses terhad kepada pengurusan pengguna', en: 'You have limited access to user management' },
  branch_admin_note: { ms: 'Akaun Admin hanya boleh mengurus pengguna dalam cawangan yang ditetapkan', en: 'Admin accounts can only manage users in their assigned branch' },

  // CustomerManagement
  edit_shop: { ms: 'Edit Kedai', en: 'Edit Shop' },
  add_new_shop: { ms: 'Tambah Kedai Baru', en: 'Add New Shop' },
  shop_list: { ms: 'Senarai Kedai', en: 'Shop List' },
  search_shops: { ms: 'Cari kedai...', en: 'Search shops...' },
  phone_number: { ms: 'Nombor Telefon', en: 'Phone Number' },
  no_address: { ms: 'Tiada Alamat', en: 'No Address' },
  delete_shop: { ms: 'Padam Kedai', en: 'Delete Shop' },
  delete_shop_confirm: { ms: 'Adakah anda pasti untuk memadam', en: 'Are you sure you want to delete' }
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

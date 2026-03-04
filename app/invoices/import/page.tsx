'use client';

import { useRef, useState } from 'react';
import Papa from 'papaparse';
import Link from 'next/link';

interface ImportResult {
  successful: number;
  failed: number;
  errors: Array<{ invoiceNo: string; error: string }>;
}

export default function BulkImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [preview, setPreview] = useState(false);
  const [overwrite, setOverwrite] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setResult(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data && results.data.length > 0) {
          setCsvData(results.data as any[]);
          setPreview(true);
        } else {
          setError('No data found in CSV file');
        }
      },
      error: (error) => {
        setError(`CSV parsing error: ${error.message}`);
      }
    });
  };

  const handleImport = async () => {
    if (!csvData || csvData.length === 0) {
      setError('No data to import');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Transform CSV data to match API format
      const invoices = csvData.map((row) => ({
        invoice_no: row.invoice_no,
        invoice_date: row.invoice_date,
        due_date: row.due_date,
        customer_id: row.customer_id,
        subtotal: parseFloat(row.subtotal || 0),
        discount: parseFloat(row.discount || 0),
        tax: parseFloat(row.tax || 0),
        total: parseFloat(row.total),
        payment_status: row.payment_status || 'UNPAID',
        amount_paid: parseFloat(row.amount_paid || 0),
        notes: row.notes || null,
        is_backdate: true,
        backdate_reason: 'Historical data import from CSV',
        items: row.items ? JSON.parse(row.items) : []
      }));

      const response = await fetch('/api/invoices/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoices,
          overwrite
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Import failed');
      }

      const importResult: ImportResult = await response.json();
      setResult(importResult);
      setPreview(false);
      setCsvData([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    const template = `invoice_no,invoice_date,due_date,customer_id,subtotal,discount,tax,total,payment_status,amount_paid,notes
INV-2025-001,2025-01-15,2025-02-15,cust-001,500,0,50,550,PAID,550,First invoice
INV-2025-002,2025-01-20,2025-02-20,cust-002,1000,100,100,1100,PARTIAL,600,Second invoice
INV-2025-003,2025-02-01,2025-03-01,cust-003,750,0,75,825,UNPAID,0,Pending payment`;

    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(template));
    element.setAttribute('download', 'invoice_import_template.csv');
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/invoices" className="text-blue-600 hover:text-blue-900 mb-4 inline-block">
            ← Back to Invoices
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Bulk Import Invoices</h1>
          <p className="text-gray-600 mt-2">Import historical invoice data from CSV file</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            {error}
          </div>
        )}

        {result && (
          <div className="mb-6 p-6 bg-green-50 border border-green-200 rounded-lg">
            <h3 className="font-semibold text-green-900 mb-4">Import Complete!</h3>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <p className="text-sm text-green-700">Successful</p>
                <p className="text-2xl font-bold text-green-600">{result.successful}</p>
              </div>
              <div>
                <p className="text-sm text-red-700">Failed</p>
                <p className="text-2xl font-bold text-red-600">{result.failed}</p>
              </div>
              <div>
                <p className="text-sm text-gray-700">Total</p>
                <p className="text-2xl font-bold text-gray-900">{result.successful + result.failed}</p>
              </div>
            </div>

            {result.errors && result.errors.length > 0 && (
              <div className="mt-4">
                <p className="font-semibold text-red-900 mb-2">Errors:</p>
                <div className="bg-white rounded p-4 max-h-48 overflow-y-auto text-sm text-red-800 space-y-2">
                  {result.errors.map((err, idx) => (
                    <div key={idx}>
                      <span className="font-medium">{err.invoiceNo}:</span> {err.error}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Link
              href="/invoices"
              className="inline-block mt-6 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
            >
              View All Invoices
            </Link>
          </div>
        )}

        {/* Main Container */}
        {!result && (
          <div className="bg-white rounded-lg shadow p-8">
            {!preview ? (
              <>
                {/* Upload Area */}
                <div className="mb-8">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-400 transition">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg transition mb-4"
                    >
                      Choose CSV File
                    </button>
                    <p className="text-gray-600 mt-4">or drag and drop CSV file here</p>
                  </div>
                </div>

                {/* Instructions */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
                  <h3 className="font-semibold text-blue-900 mb-4">CSV Format Required:</h3>
                  <div className="bg-white rounded p-4 font-mono text-sm text-gray-800 overflow-x-auto">
                    <pre>{`invoice_no,invoice_date,due_date,customer_id,subtotal,discount,tax,total,payment_status,amount_paid,notes
INV-2025-001,2025-01-15,2025-02-15,cust-001,500,0,50,550,PAID,550,First invoice
INV-2025-002,2025-01-20,2025-02-20,cust-002,1000,100,100,1100,PARTIAL,600,Second invoice`}</pre>
                  </div>
                </div>

                {/* Required Fields */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
                  <h3 className="font-semibold text-yellow-900 mb-3">Required Fields:</h3>
                  <ul className="text-sm text-yellow-800 space-y-2">
                    <li>✓ <strong>invoice_no</strong> - Unique invoice number (e.g., INV-2025-001)</li>
                    <li>✓ <strong>invoice_date</strong> - Date in YYYY-MM-DD format</li>
                    <li>✓ <strong>due_date</strong> - Due date in YYYY-MM-DD format</li>
                    <li>✓ <strong>customer_id</strong> - Must match customer ID in system</li>
                    <li>✓ <strong>total</strong> - Invoice total amount (required)</li>
                  </ul>
                  <h3 className="font-semibold text-yellow-900 mt-4 mb-2">Optional Fields:</h3>
                  <ul className="text-sm text-yellow-800 space-y-2">
                    <li>○ payment_status: UNPAID (default), PARTIAL, or PAID</li>
                    <li>○ amount_paid: Amount already paid (default: 0)</li>
                    <li>○ notes: Additional notes</li>
                  </ul>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={handleDownloadTemplate}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition font-medium"
                  >
                    Download Template CSV
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Preview */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Preview ({csvData.length} records found)
                  </h3>

                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left font-semibold">Invoice No</th>
                          <th className="px-4 py-2 text-left font-semibold">Date</th>
                          <th className="px-4 py-2 text-left font-semibold">Customer ID</th>
                          <th className="px-4 py-2 text-right font-semibold">Total</th>
                          <th className="px-4 py-2 text-left font-semibold">Status</th>
                          <th className="px-4 py-2 text-right font-semibold">Paid</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {csvData.slice(0, 10).map((row, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-2 font-medium">{row.invoice_no}</td>
                            <td className="px-4 py-2">{row.invoice_date}</td>
                            <td className="px-4 py-2">{row.customer_id}</td>
                            <td className="px-4 py-2 text-right">{row.total}</td>
                            <td className="px-4 py-2">{row.payment_status}</td>
                            <td className="px-4 py-2 text-right">{row.amount_paid}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {csvData.length > 10 && (
                    <p className="text-gray-600 mt-2 text-sm">... and {csvData.length - 10} more records</p>
                  )}
                </div>

                {/* Options */}
                <div className="bg-gray-50 rounded-lg p-4 mb-8">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={overwrite}
                      onChange={(e) => setOverwrite(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="ml-3 text-gray-700">
                      <strong>Overwrite existing invoices</strong>
                      <span className="text-gray-600 ml-2">(if invoice_no already exists)</span>
                    </span>
                  </label>
                </div>

                {/* Actions */}
                <div className="flex gap-4">
                  <button
                    onClick={() => setPreview(false)}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg transition font-medium"
                  >
                    ← Change File
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={loading}
                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg transition font-medium"
                  >
                    {loading ? 'Importing...' : 'Confirm & Import'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

import { NextRequest, NextResponse } from 'next/server';
import { normalizeRole } from '@/lib/roles';
import { getSessionUserFromRequest } from '@/lib/session';
import { canExportReports } from '@/lib/permissions';

interface ReportBranchSummary {
  branch: string;
  totalRevenue: number;
  transactionCount: number;
  avgTransaction: number;
}

interface ReportProduct {
  name: string;
  quantity: number;
}

interface PdfReportData {
  totalRevenue: number;
  totalTransactions: number;
  branchSummaries: ReportBranchSummary[];
  topProducts: ReportProduct[];
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = getSessionUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = normalizeRole(currentUser.role);
    if (!canExportReports(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { month, branch, reportData } = body as { month: string; branch: string; reportData: PdfReportData };

    if (!month || !reportData) {
      return NextResponse.json({ error: 'Missing required data' }, { status: 400 });
    }

    // Format data for PDF
    const formatCurrency = (value: number) => {
      return `RM ${value.toFixed(2)}`;
    };

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Monthly Report ${month}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: white;
            color: #333;
            line-height: 1.6;
          }
          .container {
            max-width: 900px;
            margin: 0 auto;
            padding: 40px 20px;
          }
          .header {
            text-align: center;
            border-bottom: 3px solid #1e40af;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .header h1 {
            color: #1e40af;
            font-size: 32px;
            margin-bottom: 5px;
          }
          .header p {
            color: #666;
            font-size: 14px;
          }
          .summary {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            margin-bottom: 30px;
          }
          .summary-card {
            background: #f3f4f6;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #1e40af;
          }
          .summary-card-label {
            font-size: 12px;
            color: #666;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .summary-card-value {
            font-size: 28px;
            font-weight: bold;
            color: #1e40af;
            margin-bottom: 5px;
          }
          .summary-card-detail {
            font-size: 12px;
            color: #999;
          }
          .section {
            margin-bottom: 30px;
          }
          .section-title {
            font-size: 18px;
            font-weight: bold;
            color: #1e40af;
            margin-bottom: 15px;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 10px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          thead {
            background: #f3f4f6;
          }
          th {
            padding: 12px;
            text-align: left;
            font-weight: 600;
            color: #1e40af;
            border-bottom: 2px solid #d1d5db;
          }
          td {
            padding: 10px 12px;
            border-bottom: 1px solid #e5e7eb;
          }
          tr:nth-child(even) {
            background: #f9fafb;
          }
          .text-right {
            text-align: right;
          }
          .footer {
            text-align: center;
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            font-size: 12px;
            color: #999;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>SALES REPORT - ${month}</h1>
            <p>Monthly Sales Analysis${branch !== 'all' ? ` - ${branch}` : ' - All Branches'}</p>
          </div>

          <div class="summary">
            <div class="summary-card">
              <div class="summary-card-label">TOTAL REVENUE</div>
              <div class="summary-card-value">${formatCurrency(reportData.totalRevenue)}</div>
              <div class="summary-card-detail">${reportData.totalTransactions} transactions</div>
            </div>
            <div class="summary-card">
              <div class="summary-card-label">AVG TRANSACTION</div>
              <div class="summary-card-value">${formatCurrency(reportData.totalRevenue / reportData.totalTransactions || 0)}</div>
              <div class="summary-card-detail">Per transaction</div>
            </div>
            <div class="summary-card">
              <div class="summary-card-label">BRANCHES</div>
              <div class="summary-card-value">${reportData.branchSummaries.length}</div>
              <div class="summary-card-detail">Active branches</div>
            </div>
          </div>

          ${reportData.branchSummaries.length > 0 ? `
          <div class="section">
            <div class="section-title">BRANCH SUMMARY</div>
            <table>
              <thead>
                <tr>
                  <th>Branch</th>
                  <th class="text-right">Revenue</th>
                  <th class="text-right">Transactions</th>
                  <th class="text-right">Avg Transaction</th>
                </tr>
              </thead>
              <tbody>
                ${reportData.branchSummaries.map((b) => `
                  <tr>
                    <td>${b.branch}</td>
                    <td class="text-right">${formatCurrency(b.totalRevenue)}</td>
                    <td class="text-right">${b.transactionCount}</td>
                    <td class="text-right">${formatCurrency(b.avgTransaction)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}

          ${reportData.topProducts.length > 0 ? `
          <div class="section">
            <div class="section-title">TOP PRODUCTS</div>
            <table>
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th class="text-right">Quantity Sold</th>
                </tr>
              </thead>
              <tbody>
                ${reportData.topProducts.slice(0, 10).map((p) => `
                  <tr>
                    <td>${p.name}</td>
                    <td class="text-right">${p.quantity}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}

          <div class="footer">
            <p>Generated on ${new Date().toLocaleString('en-MY')}</p>
            <p>This report is confidential and for authorized personnel only.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Return HTML as file (browser will handle PDF conversion)
    // Users can print as PDF or save as HTML
    return new NextResponse(htmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="Report_${month}_${branch}.html"`,
      },
    });
  } catch (error) {
    console.error('Error in POST /api/reports/export-pdf:', error);
    return NextResponse.json({ error: 'Failed to export PDF' }, { status: 500 });
  }
}

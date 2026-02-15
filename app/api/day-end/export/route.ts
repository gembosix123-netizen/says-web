import { NextRequest, NextResponse } from 'next/server';

async function getCurrentUser(request: Request) {
  try {
    const session = (request as any).cookies.get('session');
    if (!session) return null;
    const data = JSON.parse(session.value);
    return data;
  } catch (e) {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { date, branch, summary, cashCount, reconciliationNotes } = body;

    if (!date || !summary) {
      return NextResponse.json({ error: 'Missing required data' }, { status: 400 });
    }

    const formatCurrency = (value: number) => `RM ${value.toFixed(2)}`;
    const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-MY');
    const formatTime = (dateStr: string) => new Date(dateStr).toLocaleTimeString('en-MY');

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Day End Report - ${date}</title>
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
          .header .date-info {
            color: #666;
            font-size: 14px;
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
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            margin-bottom: 20px;
          }
          .summary-card {
            background: #f3f4f6;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #1e40af;
          }
          .summary-card-label {
            font-size: 12px;
            color: #666;
            margin-bottom: 5px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .summary-card-value {
            font-size: 24px;
            font-weight: bold;
            color: #1e40af;
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
          .reconciliation-box {
            background: #f3f4f6;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #10b981;
            margin-bottom: 15px;
          }
          .reconciliation-item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
          }
          .footer {
            text-align: center;
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            font-size: 12px;
            color: #999;
          }
          .signature-box {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 30px;
            margin-top: 40px;
          }
          .signature-line {
            border-top: 1px solid #333;
            padding-top: 10px;
            text-align: center;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>DAY END CLOSING REPORT</h1>
            <div class="date-info">
              <p><strong>${branch}</strong> Branch | ${formatDate(date)}</p>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Daily Summary</div>
            <div class="summary-grid">
              <div class="summary-card">
                <div class="summary-card-label">Total Transactions</div>
                <div class="summary-card-value">${summary.totalTransactions}</div>
              </div>
              <div class="summary-card">
                <div class="summary-card-label">Total Revenue</div>
                <div class="summary-card-value">${formatCurrency(summary.totalRevenue)}</div>
              </div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Payment Breakdown</div>
            <table>
              <thead>
                <tr>
                  <th>Payment Method</th>
                  <th class="text-right">Amount</th>
                  <th class="text-right">Percentage</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Cash</td>
                  <td class="text-right">${formatCurrency(summary.paymentBreakdown.cash)}</td>
                  <td class="text-right">${((summary.paymentBreakdown.cash / summary.totalRevenue) * 100).toFixed(1)}%</td>
                </tr>
                <tr>
                  <td>Card</td>
                  <td class="text-right">${formatCurrency(summary.paymentBreakdown.card)}</td>
                  <td class="text-right">${((summary.paymentBreakdown.card / summary.totalRevenue) * 100).toFixed(1)}%</td>
                </tr>
                <tr>
                  <td>Transfer</td>
                  <td class="text-right">${formatCurrency(summary.paymentBreakdown.transfer)}</td>
                  <td class="text-right">${((summary.paymentBreakdown.transfer / summary.totalRevenue) * 100).toFixed(1)}%</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="section">
            <div class="section-title">Cash Reconciliation</div>
            <div class="reconciliation-box">
              <div class="reconciliation-item">
                <strong>System Cash Total:</strong>
                <span>${formatCurrency(summary.paymentBreakdown.cash)}</span>
              </div>
              <div class="reconciliation-item">
                <strong>Actual Cash Count:</strong>
                <span>${formatCurrency(cashCount || 0)}</span>
              </div>
              <div class="reconciliation-item" style="font-weight: bold; border-top: 1px solid #d1d5db; padding-top: 8px; margin-top: 8px;">
                <span>Discrepancy:</span>
                <span>${formatCurrency((cashCount || 0) - summary.paymentBreakdown.cash)}</span>
              </div>
            </div>
            ${reconciliationNotes ? `<p style="font-weight: 500;">Notes: ${reconciliationNotes}</p>` : ''}
          </div>

          ${summary.salesmanPerformance && Object.keys(summary.salesmanPerformance).length > 0 ? `
          <div class="section">
            <div class="section-title">Salesman Performance</div>
            <table>
              <thead>
                <tr>
                  <th>Salesman</th>
                  <th class="text-right">Transactions</th>
                  <th class="text-right">Revenue</th>
                  <th class="text-right">Commission</th>
                </tr>
              </thead>
              <tbody>
                ${Object.values(summary.salesmanPerformance).map((sm: any) => `
                  <tr>
                    <td>${sm.name}</td>
                    <td class="text-right">${sm.transactions}</td>
                    <td class="text-right">${formatCurrency(sm.revenue)}</td>
                    <td class="text-right">${formatCurrency(sm.commission)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}

          ${summary.topProducts && summary.topProducts.length > 0 ? `
          <div class="section">
            <div class="section-title">Top 5 Products</div>
            <table>
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th class="text-right">Quantity</th>
                  <th class="text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                ${summary.topProducts.slice(0, 5).map((p: any) => `
                  <tr>
                    <td>${p.name}</td>
                    <td class="text-right">${p.quantity}</td>
                    <td class="text-right">${formatCurrency(p.revenue)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}

          <div class="footer">
            <p>Generated on ${formatDate(new Date().toISOString())} at ${formatTime(new Date().toISOString())}</p>
            <p style="margin-top: 10px;">This report is confidential. All transactions are now locked and cannot be modified.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return new NextResponse(htmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="DayEndReport_${date}_${branch}.html"`,
      },
    });
  } catch (error) {
    console.error('Error in POST /api/day-end/export:', error);
    return NextResponse.json({ error: 'Failed to export report' }, { status: 500 });
  }
}

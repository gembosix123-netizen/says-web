import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { StockAudit } from '@/types';

export async function GET() {
  const audits = (await db.stockAudits.getAll()) as StockAudit[];
  return NextResponse.json(audits);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Transform 'counts' Record<string, number> to 'items' array if needed (Backward Compatibility)
    let items = body.items;
    if (!items && body.counts) {
        items = Object.entries(body.counts).map(([productId, physicalStock]) => ({
            productId,
            productName: 'Unknown', // Ideally fetch from products DB, but for now this prevents crash
            physicalStock: Number(physicalStock)
        }));
    }

    const newAudit: StockAudit = {
      id: body.id || `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      customerId: body.customerId,
      salesmanId: body.salesmanId,
      items: items || [],
      createdAt: new Date().toISOString(),
    };
    
    await db.stockAudits.save(newAudit);
    return NextResponse.json(newAudit);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create audit' }, { status: 500 });
  }
}

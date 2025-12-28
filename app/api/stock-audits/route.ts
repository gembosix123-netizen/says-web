import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { StockAudit } from '@/types';

export async function GET() {
  const audits = await db.stockAudits.getAll();
  return NextResponse.json(audits);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const newAudit: StockAudit = {
      id: body.id || `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...body,
      createdAt: new Date().toISOString(),
    };
    
    await db.stockAudits.save(newAudit);
    return NextResponse.json(newAudit);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create audit' }, { status: 500 });
  }
}

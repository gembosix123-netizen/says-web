import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const payouts = await db.payouts.getAll();
    return NextResponse.json({ success: true, data: payouts });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch payouts' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, userName, amount, paidBy } = body;

    const newPayout = {
      id: Math.random().toString(36).substring(7),
      userId,
      userName,
      amount,
      paidAt: new Date().toISOString(),
      paidBy: paidBy || 'System'
    };

    await db.payouts.save(newPayout);
    return NextResponse.json({ success: true, data: newPayout });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to create payout' }, { status: 500 });
  }
}

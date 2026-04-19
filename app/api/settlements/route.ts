import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Settlement } from '@/types';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  const userId = searchParams.get('userId');
  
  let settlements = await db.settlements.getAll();
  
  if (date) {
    settlements = settlements.filter(s => s.date === date);
  }
  if (userId) {
    settlements = settlements.filter(s => s.userId === userId);
  }
  
  return NextResponse.json(settlements);
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { userId, userName, totalCash, totalCredit, totalSales, vanStock, branch } = data;

    if (!userId) {
        return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const today = new Date().toISOString().split('T')[0];
    
    // Check if already settled today
    const existing = (await db.settlements.getAll()).find(s => s.userId === userId && s.date === today);
    if (existing) {
        return NextResponse.json({ error: 'Already settled for today' }, { status: 400 });
    }

    const newSettlement: Settlement = {
        id: Date.now().toString(),
        userId,
        userName,
        date: today,
        totalCash,
        totalCredit,
        totalSales,
        vanStock,
        status: 'Submitted',
        branch: branch || undefined,
        submittedAt: new Date().toISOString()
    };

    await db.settlements.save(newSettlement);
    return NextResponse.json({ success: true, settlement: newSettlement });

  } catch (error) {
    console.error('Settlement error:', error);
    return NextResponse.json({ error: 'Failed to submit settlement' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
    return NextResponse.json({ error: 'Manual verification removed. Settlement is stored as history automatically.' }, { status: 405 });
}

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Transaction } from '@/types';

export async function GET() {
  const transactions = await db.transactions.getAll();
  // Sort by createdAt desc
  const sorted = transactions.sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : (a.checkInTime ? new Date(a.checkInTime).getTime() : 0);
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : (b.checkInTime ? new Date(b.checkInTime).getTime() : 0);
    return timeB - timeA;
  });
  return NextResponse.json(sorted);
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const newTransaction: Transaction = {
        ...data,
        id: Date.now().toString(),
        status: 'Pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    await db.transactions.save(newTransaction);
    return NextResponse.json({ success: true, id: newTransaction.id });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save transaction' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
    try {
        const data = await request.json();
        const { id, ...updates } = data;
        
        if (!id) {
            return NextResponse.json({ error: 'ID required' }, { status: 400 });
        }

        const existing = await db.transactions.getById(id);
        if (!existing) {
             return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
        }

        const updated = {
            ...existing,
            ...updates,
            updatedAt: new Date().toISOString()
        };

        await db.transactions.save(updated);
        return NextResponse.json({ success: true, data: updated });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 });
    }
}


import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Order } from '@/types';

export async function GET() {
  const orders = await db.orders.getAll();
  return NextResponse.json(orders);
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const newOrder: Order = {
        ...data,
        id: data.id || 'o' + Date.now().toString(),
    };
    await db.orders.save(newOrder);
    return NextResponse.json({ success: true, order: newOrder });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save order' }, { status: 500 });
  }
}

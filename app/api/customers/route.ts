import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Customer } from '@/types';

export async function GET() {
  return NextResponse.json(db.customers.getAll());
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const newCustomer: Customer = {
        ...data,
        id: data.id || Date.now().toString(),
    };
    db.customers.save(newCustomer);
    return NextResponse.json({ success: true, customer: newCustomer });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save customer' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
    try {
        const data = await request.json();
        db.customers.save(data);
        return NextResponse.json({ success: true, customer: data });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    
    if (db.customers.delete(id)) {
        return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

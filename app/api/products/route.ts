import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Product } from '@/types';

export async function GET() {
  return NextResponse.json(db.products.getAll());
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const newProduct: Product = {
        ...data,
        id: data.id || 'p' + Date.now().toString(),
    };
    db.products.save(newProduct);
    return NextResponse.json({ success: true, product: newProduct });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save product' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
    try {
        const data = await request.json();
        db.products.save(data);
        return NextResponse.json({ success: true, product: data });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    
    if (db.products.delete(id)) {
        return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Store } from '@/types';

async function getSessionRole(request: Request) {
  try {
    const session = (request as any).cookies.get('session');
    if (!session) return null;
    const data = JSON.parse(session.value);
    return data.role || null;
  } catch (e) {
    return null;
  }
}

export async function GET() {
  const stores = await db.stores.getAll();
  return NextResponse.json(stores);
}

export async function POST(request: Request) {
  try {
    const role = await getSessionRole(request);
    if (role !== 'Admin' && role !== 'Main Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const data = await request.json();
    const newStore: Store = {
      id: data.id || 's' + Date.now().toString(),
      name: data.name,
      address: data.address || '',
      branch: data.branch || 'HQ',
      createdAt: new Date().toISOString(),
    };

    await db.stores.save(newStore as any);
    return NextResponse.json({ success: true, store: newStore });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save store' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const role = await getSessionRole(request);
    if (role !== 'Admin' && role !== 'Main Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const data = await request.json();
    await db.stores.save(data);
    return NextResponse.json({ success: true, store: data });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update store' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const role = await getSessionRole(request);
    if (role !== 'Admin' && role !== 'Main Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const ok = await db.stores.delete(id);
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete store' }, { status: 500 });
  }
}

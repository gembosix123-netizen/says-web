import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'User ID required' }, { status: 400 });
  }

  const vanInv = await db.vanInventories.getById(userId);
  
  if (!vanInv) {
    return NextResponse.json({ items: [] });
  }

  return NextResponse.json(vanInv);
}

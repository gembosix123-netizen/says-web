import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: Request) {
  console.log('[API] /api/inventory/load HIT');
  try {
    const body = await request.json();
    console.log('[API] Payload:', JSON.stringify(body));
    
    const { userId, items } = body; 
    
    if (!userId || !items) {
        console.error('[API] Missing userId or items');
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Get current inventory
    const inventoryId = `van_${userId}`;
    console.log(`[API] Fetching inventory for ${inventoryId}`);
    
    let currentInv = await db.vanInventories.getById(inventoryId);
    console.log('[API] Existing Inventory:', currentInv ? 'Found' : 'Not Found');

    if (!currentInv) {
        currentInv = {
            id: inventoryId,
            userId,
            items: {},
            lastUpdated: new Date().toISOString()
        };
    }

    // 2. Update Stock
    items.forEach((item: any) => {
        const currentQty = currentInv!.items[item.productId] || 0;
        currentInv!.items[item.productId] = currentQty + item.quantity;
    });
    currentInv.lastUpdated = new Date().toISOString();
    console.log('[API] Updated Inventory:', JSON.stringify(currentInv));

    // 3. Save to DB
    console.log('[API] Saving to DB...');
    await db.vanInventories.save(currentInv);
    console.log('[API] Save success');

    return NextResponse.json({ success: true, stock: currentInv });
  } catch (error: any) {
    console.error('[API] CRITICAL ERROR:', error);
    return NextResponse.json({ error: error.message || 'Failed to load stock' }, { status: 500 });
  }
}
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const { userId, items } = body; 
    
    if (!userId || !items) {
        console.error('[API] Missing userId or items');
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Get current inventory
    const inventoryId = `van_${userId}`;
    let currentInv = await db.vanInventories.getById(inventoryId);

    if (!currentInv) {
        currentInv = {
            id: inventoryId,
            userId,
            items: {},
            lastUpdated: new Date().toISOString()
        };
    }

    // 2. Update Stock
    items.forEach((item: { productId: string; quantity: number }) => {
        const currentQty = currentInv!.items[item.productId] || 0;
        currentInv!.items[item.productId] = currentQty + item.quantity;
    });
    currentInv.lastUpdated = new Date().toISOString();

    // 3. Save to DB
    await db.vanInventories.save(currentInv);

    await logAuditEvent({
      module: 'van_inventory',
      action: 'load_van_stock',
      entityType: 'van_inventory',
      entityId: inventoryId,
      status: 'success',
      sourceSystem: 'db_json',
      metadata: {
        userId,
        loadedItems: items,
      },
    });

    return NextResponse.json({ success: true, stock: currentInv });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Failed to load stock';
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
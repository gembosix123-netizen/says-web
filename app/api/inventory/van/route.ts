import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { VanInventory } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');

    if (!userId || userId === 'undefined' || userId === 'null') {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const inventoryId = `van_${userId}`;
    const inventory = (await db.vanInventories.getById(inventoryId)) as VanInventory | null;
    
    return NextResponse.json(inventory || { 
        id: inventoryId, 
        userId, 
        items: {}, 
        lastUpdated: new Date().toISOString() 
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 });
  }
}

interface UpdateInventoryBody {
  userId: string;
  items: Record<string, number>;
}

export async function PUT(request: NextRequest) {
    try {
        const body = (await request.json()) as UpdateInventoryBody;
        const { userId, items } = body; 

        if (!userId || !items) {
             return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }

        const inventoryId = `van_${userId}`;
        const currentInv = (await db.vanInventories.getById(inventoryId)) as VanInventory || {
            id: inventoryId,
            userId,
            items: {},
            lastUpdated: new Date().toISOString()
        };

        // Deduct items
        Object.entries(items).forEach(([pid, qty]) => {
            const currentQty = currentInv.items[pid] || 0;
            currentInv.items[pid] = Math.max(0, currentQty - qty);
        });

        currentInv.lastUpdated = new Date().toISOString();
        await db.vanInventories.save(currentInv);

        return NextResponse.json(currentInv);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update inventory' }, { status: 500 });
    }
}
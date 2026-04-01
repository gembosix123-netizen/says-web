import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionUserFromRequest } from '@/lib/session';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const { userId, items, actor_branch, actor_name } = body; 
    
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

    // 4. Sync: deduct from products.current_stock in Supabase (freezer → van)
    if (supabaseAdmin) {
      for (const item of items as { productId: string; quantity: number }[]) {
        const { data: product } = await supabaseAdmin
          .from('products')
          .select('current_stock, name')
          .eq('id', item.productId)
          .single();

        const newStock = Math.max(0, (product?.current_stock || 0) - item.quantity);
        await supabaseAdmin
          .from('products')
          .update({ current_stock: newStock })
          .eq('id', item.productId);

        // 5. Log freezer_to_van movement
        await supabaseAdmin.from('inventory_movements').insert({
          branch: actor_branch || 'HQ',
          actor_id: userId,
          actor_name: actor_name || null,
          movement_type: 'freezer_to_van',
          product_id: item.productId,
          product_name: product?.name || null,
          qty: item.quantity,
          from_bucket: 'freezer',
          to_bucket: 'van',
          source_ref: inventoryId,
          movement_date: new Date().toISOString(),
        });
      }
    }

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
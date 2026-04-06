import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit';
import { supabaseAdmin } from '@/lib/supabase';

const toSafePositiveInt = (value: unknown) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const { userId, items, actor_branch, actor_name } = body; 
    
    if (!userId || !items) {
        console.error('[API] Missing userId or items');
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const normalizedItems = Array.isArray(items)
      ? Object.entries(
          items.reduce<Record<string, number>>((acc, item: { productId?: string; quantity?: number }) => {
            const productId = String(item?.productId || '');
            const quantity = toSafePositiveInt(item?.quantity);
            if (!productId || quantity <= 0) return acc;
            acc[productId] = (acc[productId] || 0) + quantity;
            return acc;
          }, {})
        ).map(([productId, quantity]) => ({ productId, quantity }))
      : [];

    if (normalizedItems.length === 0) {
      return NextResponse.json({ error: 'No valid items to load' }, { status: 400 });
    }

    const stockByProductId = new Map<string, { current_stock: number; name: string | null }>();

    if (supabaseAdmin) {
      for (const item of normalizedItems) {
        const { data: product } = await supabaseAdmin
          .from('products')
          .select('current_stock, name')
          .eq('id', item.productId)
          .single();

        stockByProductId.set(item.productId, {
          current_stock: Number(product?.current_stock || 0),
          name: product?.name || null,
        });
      }
    } else {
      const localProducts = await db.products.getAll();
      for (const item of normalizedItems) {
        const product = localProducts.find((entry) => entry.id === item.productId);
        stockByProductId.set(item.productId, {
          current_stock: Number(product?.stock || 0),
          name: product?.name || null,
        });
      }
    }

    const exceededItem = normalizedItems.find((item) => item.quantity > (stockByProductId.get(item.productId)?.current_stock || 0));
    if (exceededItem) {
      const product = stockByProductId.get(exceededItem.productId);
      return NextResponse.json(
        {
          error: `Kuantiti ${product?.name || 'produk'} melebihi stok freezer. Baki semasa: ${product?.current_stock || 0}`,
        },
        { status: 400 }
      );
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
  normalizedItems.forEach((item) => {
        const currentQty = currentInv!.items[item.productId] || 0;
        currentInv!.items[item.productId] = currentQty + item.quantity;
    });
    currentInv.lastUpdated = new Date().toISOString();

    // 3. Save to DB
    await db.vanInventories.save(currentInv);

    // 4. Sync: deduct from products.current_stock in Supabase (freezer → van)
    if (supabaseAdmin) {
      for (const item of normalizedItems) {
        const product = stockByProductId.get(item.productId);
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
        loadedItems: normalizedItems,
      },
    });

    return NextResponse.json({ success: true, stock: currentInv });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Failed to load stock';
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
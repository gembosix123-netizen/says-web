import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Product, VanInventory } from '@/types';

export async function POST(request: Request) {
  try {
    const { userId, items } = await request.json(); // items: { productId, quantity }[]

    if (!userId || !items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    // 1. Validate Master Stock
    const allProducts = await db.products.getAll();
    const productUpdates: Product[] = [];

    for (const item of items) {
      const product = allProducts.find((p) => p.id === item.productId);
      if (!product) {
        return NextResponse.json({ error: `Product not found: ${item.productId}` }, { status: 400 });
      }
      if (product.stock < item.quantity) {
        return NextResponse.json({ error: `Insufficient stock for ${product.name}. Available: ${product.stock}` }, { status: 400 });
      }
      
      // Prepare update (decrement master stock)
      productUpdates.push({
        ...product,
        stock: product.stock - item.quantity
      });
    }

    // 2. Execute Updates (Transaction-like)
    // Update Master Stock
    for (const p of productUpdates) {
      await db.products.save(p);
    }

    // Update Van Inventory
    let vanInv = await db.vanInventories.getById(userId);
    if (!vanInv) {
      vanInv = {
        id: userId,
        userId: userId,
        items: [],
        updatedAt: new Date().toISOString()
      };
    }

    // Merge items
    for (const item of items) {
      const existingItem = vanInv.items.find((i) => i.productId === item.productId);
      if (existingItem) {
        existingItem.quantity += item.quantity;
      } else {
        vanInv.items.push({ productId: item.productId, quantity: item.quantity });
      }
    }
    vanInv.updatedAt = new Date().toISOString();
    
    await db.vanInventories.save(vanInv);

    return NextResponse.json({ success: true, vanInventory: vanInv });

  } catch (error) {
    console.error('Loading error:', error);
    return NextResponse.json({ error: 'Failed to process loading' }, { status: 500 });
  }
}

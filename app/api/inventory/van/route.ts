import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { VanInventory } from '@/types';
import { checkAuth } from '@/lib/auth-check';
import { supabaseAdmin } from '@/lib/supabase';
import { logAuditEvent } from '@/lib/audit';

type ProductRecord = {
  id: string;
  name: string;
  unit?: string | null;
  price?: number | string | null;
  factory_price?: number | string | null;
  cost?: number | string | null;
};

const isPrivilegedRole = (role: string) => role === 'Admin' || role === 'Main Admin';

const toSafeNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const sanitizeVanItems = (items: Record<string, unknown> | undefined) =>
  Object.entries(items || {}).reduce<Record<string, number>>((acc, [productId, quantity]) => {
    const safeQty = toSafeNumber(quantity);
    acc[productId] = safeQty > 0 ? safeQty : 0;
    return acc;
  }, {});

const getActiveProducts = async (): Promise<ProductRecord[]> => {
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('products')
      .select('id,name,unit,price,factory_price,cost')
      .eq('is_active', true);

    if (!error && Array.isArray(data)) {
      return data as ProductRecord[];
    }
  }

  const localProducts = await db.products.getAll();
  return (localProducts || []).map((item) => {
    const row = item as unknown as Record<string, unknown>;
    return {
      id: item.id,
      name: item.name,
      unit: item.unit,
      price: item.price,
      factory_price: row.factory_price as number | string | null | undefined,
      cost: row.cost as number | string | null | undefined,
    };
  });
};

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await checkAuth(request);
    if (error) return error;
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requestedUserId = request.nextUrl.searchParams.get('userId');
    const canViewOthers = isPrivilegedRole(user.role);

    if (requestedUserId && requestedUserId !== user.id && !canViewOthers) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const userId = requestedUserId && canViewOthers ? requestedUserId : user.id;

    if (!userId || userId === 'undefined' || userId === 'null') {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const inventoryId = `van_${userId}`;
    const inventory = (await db.vanInventories.getById(inventoryId)) as VanInventory | null;
    const baseInventory = inventory || {
      id: inventoryId,
      userId,
      items: {},
      lastUpdated: new Date().toISOString(),
    };

    const sanitizedItems = sanitizeVanItems(baseInventory.items as Record<string, unknown>);
    const products = await getActiveProducts();
    const productsById = new Map(products.map((product) => [product.id, product]));

    // Load branch/salesman price overrides from Supabase (single price and/or H/M/L tiers)
    const branchTierByProduct: Record<string, { h: number; m: number; l: number }> = {};
    const branchPriceByProduct: Record<string, number> = {};
    const smTierByProduct: Record<string, { h: number; m: number; l: number }> = {};
    const smPriceByProduct: Record<string, number> = {};

    const hasFullTiers = (row: {
      price_high?: unknown;
      price_medium?: unknown;
      price_low?: unknown;
    }) =>
      row.price_high != null &&
      row.price_medium != null &&
      row.price_low != null;

    if (supabaseAdmin) {
      const { data: salesmanPrices } = await supabaseAdmin
        .from('product_prices')
        .select('product_id, price, price_high, price_medium, price_low')
        .eq('salesman_id', userId);

      const { data: branchPrices } = user.branch
        ? await supabaseAdmin
            .from('product_prices')
            .select('product_id, price, price_high, price_medium, price_low')
            .eq('branch', user.branch)
            .is('salesman_id', null)
        : { data: [] };

      for (const row of branchPrices || []) {
        const pid = row.product_id as string;
        if (hasFullTiers(row)) {
          branchTierByProduct[pid] = {
            h: toSafeNumber(row.price_high),
            m: toSafeNumber(row.price_medium),
            l: toSafeNumber(row.price_low),
          };
        } else {
          branchPriceByProduct[pid] = toSafeNumber(row.price);
        }
      }
      for (const row of salesmanPrices || []) {
        const pid = row.product_id as string;
        if (hasFullTiers(row)) {
          smTierByProduct[pid] = {
            h: toSafeNumber(row.price_high),
            m: toSafeNumber(row.price_medium),
            l: toSafeNumber(row.price_low),
          };
        } else {
          smPriceByProduct[pid] = toSafeNumber(row.price);
        }
      }
    }

    const vanProducts = Object.entries(sanitizedItems)
      .filter(([, quantity]) => quantity > 0)
      .map(([productId, quantity]) => {
        const product = productsById.get(productId);
        if (!product) return null;

        const listDefault = toSafeNumber(product.price);

        const tiers = smTierByProduct[productId] || branchTierByProduct[productId];
        const singleOverride =
          smPriceByProduct[productId] !== undefined
            ? smPriceByProduct[productId]
            : branchPriceByProduct[productId];

        const effectivePrice = tiers ? tiers.m : (singleOverride !== undefined ? singleOverride : listDefault);
        const hasTierPricing = Boolean(tiers);

        return {
          id: product.id,
          name: product.name,
          unit: product.unit || 'unit',
          price: effectivePrice,
          price_high: hasTierPricing ? tiers.h : effectivePrice,
          price_medium: hasTierPricing ? tiers.m : effectivePrice,
          price_low: hasTierPricing ? tiers.l : effectivePrice,
          has_tier_pricing: hasTierPricing,
          factory_price: product.factory_price,
          cost: product.cost,
          stock: quantity,
        };
      })
      .filter(Boolean);
    
    return NextResponse.json({
        id: baseInventory.id,
        userId: baseInventory.userId,
        items: sanitizedItems,
        lastUpdated: baseInventory.lastUpdated,
        products: vanProducts,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 });
  }
}

interface UpdateInventoryBody {
  userId: string;
  items: Record<string, number>;
}

export async function PUT(request: NextRequest) {
    try {
        const { user, error } = await checkAuth(request);
        if (error) return error;
        if (!user) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = (await request.json()) as UpdateInventoryBody;
        const canUpdateOthers = isPrivilegedRole(user.role);
        const resolvedUserId = body.userId && canUpdateOthers ? body.userId : user.id;
        const items = body.items;

        if (!resolvedUserId || !items || typeof items !== 'object') {
             return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }

        if (body.userId && body.userId !== user.id && !canUpdateOthers) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const inventoryId = `van_${resolvedUserId}`;
        const currentInv = (await db.vanInventories.getById(inventoryId)) as VanInventory || {
            id: inventoryId,
            userId: resolvedUserId,
            items: {},
            lastUpdated: new Date().toISOString()
        };

        currentInv.items = sanitizeVanItems(currentInv.items as Record<string, unknown>);

        // Deduct items
        const exceededItem = Object.entries(items).find(([pid, qty]) => {
            const currentQty = toSafeNumber(currentInv.items[pid]);
            const deductQty = toSafeNumber(qty);
            return deductQty > currentQty;
        });

        if (exceededItem) {
          const [productId] = exceededItem;
          return NextResponse.json(
            {
              error: `Kuantiti pulangan melebihi baki van untuk produk ${productId}. Baki semasa: ${toSafeNumber(currentInv.items[productId])}`,
            },
            { status: 400 }
          );
        }

        Object.entries(items).forEach(([pid, qty]) => {
            const currentQty = toSafeNumber(currentInv.items[pid]);
            const deductQty = toSafeNumber(qty);

            if (deductQty <= 0) {
              return;
            }

            currentInv.items[pid] = currentQty - deductQty;
        });

        currentInv.lastUpdated = new Date().toISOString();
        await db.vanInventories.save(currentInv);

        await logAuditEvent({
          request,
          actor: user,
          module: 'van_inventory',
          action: 'deduct_van_stock',
          entityType: 'van_inventory',
          entityId: inventoryId,
          branch: user.branch,
          status: 'success',
          sourceSystem: 'db_json',
          metadata: {
            affectedUserId: resolvedUserId,
            deductedItems: items,
          },
        });

        return NextResponse.json(currentInv);
    } catch {
        return NextResponse.json({ error: 'Failed to update inventory' }, { status: 500 });
    }
}
/**
 * Products API Endpoint
 * ====================
 * 
 * GET  /api/products     - Get all products
 * POST /api/products     - Create product (Admin+)
 * PUT  /api/products/:id - Update product (Admin+)
 * DELETE /api/products/:id - Delete product (Main Admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createProductSchema, updateProductSchema } from '@/lib/validations';
import { normalizeRole } from '@/lib/roles';
import { getSessionUserFromRequest } from '@/lib/session';
import { canManageProducts } from '@/lib/permissions';

const generateProductId = () => {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `prod_${Date.now()}_${randomPart}`;
};

const normalizeProductResponse = (product: Record<string, any>) => {
  const resolvedSku = product.sku ?? product.code ?? null;
  const resolvedStock = Number(product.current_stock ?? product.stock ?? 0);

  return {
    ...product,
    sku: resolvedSku,
    code: resolvedSku,
    stock: Number.isFinite(resolvedStock) ? resolvedStock : 0,
    current_stock: Number.isFinite(resolvedStock) ? resolvedStock : 0,
  };
};

const buildProductUpdatePayload = (body: Record<string, any>, product: Record<string, any>) => {
  const payload: Record<string, any> = {};

  if (body.name !== undefined) payload.name = body.name;
  if (body.price !== undefined) payload.price = body.price;
  if (body.cost !== undefined && 'cost' in product) payload.cost = body.cost;
  if (body.unit !== undefined) payload.unit = body.unit;
  if (body.category !== undefined && 'category' in product) payload.category = body.category;
  if (body.description !== undefined && 'description' in product) payload.description = body.description;

  const skuValue = body.sku ?? body.code;
  if (skuValue !== undefined) {
    if ('code' in product) payload.code = skuValue;
    else if ('sku' in product) payload.sku = skuValue;
  }

  const stockValue = body.current_stock ?? body.stock;
  if (stockValue !== undefined) {
    if ('current_stock' in product) payload.current_stock = stockValue;
    else if ('stock' in product) payload.stock = stockValue;
  }

  const isActiveValue = body.is_active ?? body.isActive;
  if (isActiveValue !== undefined) {
    if ('is_active' in product) payload.is_active = isActiveValue;
    else if ('isActive' in product) payload.isActive = isActiveValue;
  }

  if ('updated_at' in product) payload.updated_at = new Date().toISOString();

  return payload;
};

const buildProductCreatePayload = (
  body: Record<string, any>,
  validatedData: Record<string, any>,
  options: {
    skuKey: 'code' | 'sku';
    stockKey?: 'current_stock' | 'stock';
    activeKey?: 'is_active' | 'isActive';
  }
) => {
  const payload: Record<string, any> = {
    id: body.id || generateProductId(),
    name: validatedData.name,
    price: validatedData.price,
    unit: validatedData.unit,
  };

  payload[options.skuKey] = validatedData.code || validatedData.sku;
  if (options.stockKey) {
    payload[options.stockKey] = Number(body.current_stock ?? body.stock ?? 0);
  }
  if (options.activeKey) {
    payload[options.activeKey] = validatedData.isActive;
  }

  return payload;
};

// ============================================================================
// GET HANDLER
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const currentUser = getSessionUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    // Get single product
    if (id) {
      const { data: product, error } = await supabaseAdmin
        .from('products')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !product) {
        return NextResponse.json(
          { error: 'Product not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(normalizeProductResponse(product));
    }

    // Get all products with active-column schema fallback.
    let products: any[] | null = null;
    let error: any = null;

    const activeQuery = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('is_active', true);
    products = activeQuery.data;
    error = activeQuery.error;

    if (error) {
      const activeCamelQuery = await supabaseAdmin
        .from('products')
        .select('*')
        .eq('isActive', true);
      products = activeCamelQuery.data;
      error = activeCamelQuery.error;
    }

    if (error) {
      const noActiveFilterQuery = await supabaseAdmin
        .from('products')
        .select('*');
      products = noActiveFilterQuery.data;
      error = noActiveFilterQuery.error;
    }

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch products' },
        { status: 500 }
      );
    }

    return NextResponse.json((products || []).map((product) => normalizeProductResponse(product as Record<string, any>)));

  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST HANDLER (Create)
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const currentUser = getSessionUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = normalizeRole(currentUser.role);
    if (!canManageProducts(role)) {
      return NextResponse.json({ error: 'Unauthorized - admin only' }, { status: 403 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    const body = await request.json();

    // Validate product data with Zod
    const validation = createProductSchema.safeParse(body);
    if (!validation.success) {
      const errors = validation.error.issues.map((err: any) => `${err.path.join('.')}: ${err.message}`);
      return NextResponse.json(
        { error: 'Ralat pengesahan', details: errors },
        { status: 400 }
      );
    }

    const validatedData = validation.data;

    // Create product with schema fallback (supports `current_stock`/`stock` and `code`/`sku`).
    const createPayloadVariants = [
      { skuKey: 'code' as const, stockKey: 'current_stock' as const, activeKey: 'is_active' as const },
      { skuKey: 'code' as const, stockKey: 'stock' as const, activeKey: 'is_active' as const },
      { skuKey: 'sku' as const, stockKey: 'stock' as const, activeKey: 'is_active' as const },
      { skuKey: 'sku' as const, stockKey: 'current_stock' as const, activeKey: 'is_active' as const },
      { skuKey: 'code' as const, activeKey: 'is_active' as const },
      { skuKey: 'sku' as const, activeKey: 'is_active' as const },
      { skuKey: 'code' as const, stockKey: 'stock' as const, activeKey: 'isActive' as const },
      { skuKey: 'sku' as const, stockKey: 'stock' as const, activeKey: 'isActive' as const },
      { skuKey: 'code' as const, activeKey: 'isActive' as const },
      { skuKey: 'sku' as const, activeKey: 'isActive' as const },
      { skuKey: 'code' as const, stockKey: 'current_stock' as const },
      { skuKey: 'code' as const, stockKey: 'stock' as const },
      { skuKey: 'sku' as const, stockKey: 'stock' as const },
      { skuKey: 'sku' as const, stockKey: 'current_stock' as const },
      { skuKey: 'code' as const },
      { skuKey: 'sku' as const },
    ];

    let createdRows: any[] | null = null;
    let createError: any = null;

    for (const variant of createPayloadVariants) {
      let createPayload = buildProductCreatePayload(body, validatedData, variant);

      for (let attempt = 0; attempt < 8; attempt++) {
        const { data, error } = await supabaseAdmin
          .from('products')
          .insert([createPayload])
          .select();

        if (!error) {
          createdRows = data || [];
          createError = null;
          break;
        }

        createError = error;

        const message = String(error?.message || '');
        const lowerMsg = message.toLowerCase();
        const looksLikeMissingColumn =
          (lowerMsg.includes('column') && lowerMsg.includes('does not exist')) ||
          (lowerMsg.includes('could not find') && lowerMsg.includes('column')) ||
          lowerMsg.includes('schema cache');

        if (!looksLikeMissingColumn) {
          break;
        }

        const missingColumnMatch = message.match(/'([^']+)'\s+column/i);
        const missingColumn = missingColumnMatch?.[1];

        if (!missingColumn || !(missingColumn in createPayload)) {
          break;
        }

        const nextPayload = { ...createPayload };
        delete nextPayload[missingColumn];
        createPayload = nextPayload;
      }

      if (!createError) {
        break;
      }
    }

    if (createError) {
      console.error('Supabase error:', createError);
      return NextResponse.json(
        { error: 'Failed to create product', details: createError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: 'Product created successfully',
        productId: createdRows?.[0]?.id,
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT HANDLER (Update)
// ============================================================================

export async function PUT(request: NextRequest) {
  try {
    const currentUser = getSessionUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = normalizeRole(currentUser.role);
    if (!canManageProducts(role)) {
      return NextResponse.json({ error: 'Unauthorized - admin only' }, { status: 403 });
    }

    const body = await request.json();
    const productId = body.id || body.productId;

    if (!productId) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    // Check product exists
    const { data: product, error: fetchError } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (fetchError || !product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    const updatePayload = buildProductUpdatePayload(body, product);

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { error: 'Tiada data untuk dikemaskini' },
        { status: 400 }
      );
    }

    // Update product
    const { error: updateError } = await supabaseAdmin
      .from('products')
      .update(updatePayload)
      .eq('id', productId);

    if (updateError) {
      console.error('Error updating product:', updateError);
      return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
    }

    return NextResponse.json(
      { message: 'Product updated successfully' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE HANDLER
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const currentUser = getSessionUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = normalizeRole(currentUser.role);
    if (!canManageProducts(role)) {
      return NextResponse.json({ error: 'Unauthorized - admin only' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const productId = searchParams.get('id');

    if (!productId) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    // Check product exists
    const { data: product, error: fetchError } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (fetchError || !product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Soft delete product with schema fallbacks
    let deleteError: any = null;

    // Preferred: is_active + updated_at
    const firstAttempt = await supabaseAdmin
      .from('products')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', productId);

    deleteError = firstAttempt.error;

    // Fallback 1: older schema without updated_at
    if (deleteError) {
      const secondAttempt = await supabaseAdmin
        .from('products')
        .update({ is_active: false })
        .eq('id', productId);
      deleteError = secondAttempt.error;
    }

    // Fallback 2: very old schema without is_active -> hard delete
    if (deleteError) {
      const thirdAttempt = await supabaseAdmin
        .from('products')
        .delete()
        .eq('id', productId);
      deleteError = thirdAttempt.error;
    }

    if (deleteError) {
      console.error('Error deleting product:', deleteError);
      return NextResponse.json({ error: deleteError.message || 'Failed to delete product' }, { status: 500 });
    }

    return NextResponse.json(
      { message: 'Product deleted successfully' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

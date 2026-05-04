/**
 * Products API Endpoint
 * ====================
 * 
 * GET  /api/products     - Get all products
 * POST /api/products     - Create product (Admin+)
 * PUT  /api/products/:id - Update product (Admin+)
 * DELETE /api/products/:id - Delete product (Main Admin only)
 */

import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createProductSchema, updateProductSchema } from '@/lib/validations';
import { normalizeRole } from '@/lib/roles';
import { getSessionUserFromRequest } from '@/lib/session';
import { canManageProducts } from '@/lib/permissions';
import { logAuditEvent } from '@/lib/audit';
import {
  expireStaleStockGrants,
  findActiveGrantForRequester,
  incrementGrantChangeCount,
  STOCK_GRANT_MAX_CHANGES_PER_SESSION,
  STOCK_GRANT_MIN_REASON_LENGTH,
} from '@/lib/stock-edit-grants';

type BranchName = 'Kota Kinabalu' | 'Kinabatangan' | 'HQ';

const generateProductId = () => {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `prod_${Date.now()}_${randomPart}`;
};

const normalizeBranch = (value: unknown): BranchName | null => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return null;
  if (raw === 'kota kinabalu' || raw === 'kota-kinabalu' || raw === 'kk') return 'Kota Kinabalu';
  if (raw === 'kinabatangan' || raw === 'kb') return 'Kinabatangan';
  if (raw === 'hq') return 'HQ';
  return null;
};

const isMissingBranchColumnError = (error: any): boolean => {
  const msg = String(error?.message || '').toLowerCase();
  return msg.includes('branch') && msg.includes('column') && (msg.includes('does not exist') || msg.includes('schema cache'));
};

const normalizeProductResponse = (product: Record<string, any>) => {
  const resolvedSku = product.sku ?? product.code ?? null;
  const resolvedStock = Number(product.current_stock ?? product.stock ?? 0);
  const resolvedFactoryPrice = Number(product.factory_price ?? product.cost ?? product.price ?? 0);

  return {
    ...product,
    sku: resolvedSku,
    code: resolvedSku,
    stock: Number.isFinite(resolvedStock) ? resolvedStock : 0,
    current_stock: Number.isFinite(resolvedStock) ? resolvedStock : 0,
    factory_price: Number.isFinite(resolvedFactoryPrice) ? resolvedFactoryPrice : 0,
  };
};

const buildProductUpdatePayload = (body: Record<string, any>, product: Record<string, any>) => {
  const payload: Record<string, any> = {};

  if (body.name !== undefined) payload.name = body.name;
  if (body.price !== undefined) payload.price = body.price;
  if (body.factoryPrice !== undefined) {
    if ('factory_price' in product) payload.factory_price = body.factoryPrice;
    else if ('cost' in product) payload.cost = body.factoryPrice;
  }
  if (body.cost !== undefined && 'cost' in product) payload.cost = body.cost;
  if (body.unit !== undefined) payload.unit = body.unit;
  if (body.category !== undefined && 'category' in product) payload.category = body.category;
  if (body.description !== undefined && 'description' in product) payload.description = body.description;
  const branchValue = normalizeBranch(body.branch);
  if (branchValue && 'branch' in product) payload.branch = branchValue;

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

  if (body.factoryPrice !== undefined) {
    payload.factory_price = Number(body.factoryPrice ?? 0);
    payload.cost = Number(body.factoryPrice ?? 0);
  }

  payload[options.skuKey] = validatedData.code || validatedData.sku;
  if (options.stockKey) {
    payload[options.stockKey] = Number(body.current_stock ?? body.stock ?? 0);
  }
  if (options.activeKey) {
    payload[options.activeKey] = validatedData.isActive;
  }

  return payload;
};

type SessionData = {
  id: string;
  role: string;
  name: string;
  branch: string;
};

function getSessionData(request: NextRequest): SessionData | null {
  const session = request.cookies.get('session');
  if (!session?.value) return null;

  let sessionValue = session.value;
  try {
    sessionValue = decodeURIComponent(sessionValue);
  } catch {
    // ignore if not encoded
  }

  try {
    return JSON.parse(sessionValue);
  } catch {
    return null;
  }
}

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

    const role = normalizeRole(currentUser.role);
    const userBranch = normalizeBranch(currentUser.branch);
    const searchParams = request.nextUrl.searchParams;
    const requestedBranch = normalizeBranch(searchParams.get('branch'));
    const branchScope = role === 'Main Admin' ? requestedBranch : userBranch;
    if (role !== 'Main Admin' && !branchScope) {
      return NextResponse.json({ error: 'Branch assignment required for this account' }, { status: 403 });
    }
    const id = searchParams.get('id');
    const branchParam = searchParams.get('branch');

    // Get single product
    if (id) {
      let byIdQuery = supabaseAdmin
        .from('products')
        .select('*')
        .eq('id', id);
      if (branchScope) byIdQuery = byIdQuery.eq('branch', branchScope);
      const { data: product, error } = await byIdQuery.single();

      if (error || !product) {
        if (isMissingBranchColumnError(error)) {
          return NextResponse.json({ error: 'Products branch isolation is not configured. Run migration 20260410_products_branch_isolation.sql' }, { status: 500 });
        }
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

    let activeQueryBuilder = supabaseAdmin
      .from('products')
      .select('*')
      .eq('is_active', true);
    if (branchScope) activeQueryBuilder = activeQueryBuilder.eq('branch', branchScope);
    const activeQuery = await activeQueryBuilder;
    products = activeQuery.data;
    error = activeQuery.error;

    if (error) {
      let activeCamelQueryBuilder = supabaseAdmin
        .from('products')
        .select('*')
        .eq('isActive', true);
      if (branchScope) activeCamelQueryBuilder = activeCamelQueryBuilder.eq('branch', branchScope);
      const activeCamelQuery = await activeCamelQueryBuilder;
      products = activeCamelQuery.data;
      error = activeCamelQuery.error;
    }

    if (error) {
      let noActiveFilterBuilder = supabaseAdmin
        .from('products')
        .select('*');
      if (branchScope) noActiveFilterBuilder = noActiveFilterBuilder.eq('branch', branchScope);
      const noActiveFilterQuery = await noActiveFilterBuilder;
      products = noActiveFilterQuery.data;
      error = noActiveFilterQuery.error;
    }

    if (error) {
      if (isMissingBranchColumnError(error)) {
        return NextResponse.json({ error: 'Products branch isolation is not configured. Run migration 20260410_products_branch_isolation.sql' }, { status: 500 });
      }
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
    const actorBranch = normalizeBranch(currentUser.branch);
    const requestedBranch = normalizeBranch(body.branch);
    const writeBranch = role === 'Main Admin' ? (requestedBranch || actorBranch) : actorBranch;
    if (!writeBranch) {
      return NextResponse.json({ error: 'Branch wajib untuk cipta produk' }, { status: 400 });
    }
    if (role !== 'Main Admin' && requestedBranch && requestedBranch !== actorBranch) {
      return NextResponse.json({ error: 'Tidak dibenarkan cipta produk untuk branch lain' }, { status: 403 });
    }

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
      createPayload.branch = writeBranch;

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

        if (missingColumn === 'branch') {
          return NextResponse.json(
            { error: 'Products branch isolation is not configured. Run migration 20260410_products_branch_isolation.sql' },
            { status: 500 }
          );
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
    const userBranch = normalizeBranch(currentUser.branch);
    if (role !== 'Main Admin' && !userBranch) {
      return NextResponse.json({ error: 'Branch assignment required for this account' }, { status: 403 });
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

    const needsMainAdminPassword =
      body.name !== undefined ||
      body.sku !== undefined ||
      body.price !== undefined ||
      body.factoryPrice !== undefined ||
      body.unit !== undefined ||
      body.category !== undefined ||
      body.description !== undefined ||
      body.branch !== undefined ||
      body.is_active !== undefined;

    if (needsMainAdminPassword) {
      if (role !== 'Main Admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }

      if (!body.password) {
        return NextResponse.json({ error: 'Password required for product edit' }, { status: 400 });
      }

      const { data: user, error: userError } = await supabaseAdmin
        .from('users')
        .select('password')
        .eq('id', currentUser.id)
        .single();

      if (userError || !user || !user.password) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const passwordHash = String(user.password);
      const isBcrypt = passwordHash.startsWith('$2a$') || passwordHash.startsWith('$2b$') || passwordHash.startsWith('$2y$');
      const passwordValid = isBcrypt
        ? await bcrypt.compare(body.password, passwordHash)
        : body.password === passwordHash;

      if (!passwordValid) {
        return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
      }
    }

    // Check product exists
    let fetchProductQuery = supabaseAdmin
      .from('products')
      .select('*')
      .eq('id', productId);
    if (role !== 'Main Admin' && userBranch) fetchProductQuery = fetchProductQuery.eq('branch', userBranch);
    const { data: product, error: fetchError } = await fetchProductQuery.single();

    if (fetchError || !product) {
      if (isMissingBranchColumnError(fetchError)) {
        return NextResponse.json({ error: 'Products branch isolation is not configured. Run migration 20260410_products_branch_isolation.sql' }, { status: 500 });
      }
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

    const oldStock = Number(product.current_stock ?? product.stock ?? 0);
    let newStock = oldStock;
    if ('current_stock' in updatePayload) newStock = Number(updatePayload.current_stock);
    else if ('stock' in updatePayload) newStock = Number(updatePayload.stock);

    const stockFieldUpdated = 'current_stock' in updatePayload || 'stock' in updatePayload;
    const stockChanged =
      stockFieldUpdated && Number.isFinite(newStock) && newStock !== oldStock;

    const ctxRaw = typeof body.stock_adjust_context === 'string' ? body.stock_adjust_context.trim() : '';
    const ALLOWED_STOCK_CTX = new Set(['freezer_in', 'van_to_freezer']);
    if (ctxRaw && !ALLOWED_STOCK_CTX.has(ctxRaw)) {
      return NextResponse.json({ error: 'stock_adjust_context tidak sah' }, { status: 400 });
    }
    const exemptFromStockGrant = ctxRaw === 'freezer_in' || ctxRaw === 'van_to_freezer';

    const reasonTrim =
      typeof body.reason === 'string' ? body.reason.trim() : '';

    let activeGrantId: string | null = null;

    if (stockChanged) {
      if (role === 'Admin') {
        if (!exemptFromStockGrant) {
          await expireStaleStockGrants(supabaseAdmin);
          const grant = await findActiveGrantForRequester(supabaseAdmin, currentUser.id);
          if (!grant) {
            return NextResponse.json(
              { error: 'Tiada sesi lulusan aktif untuk edit stok. Minta Main Admin meluluskan.' },
              { status: 403 }
            );
          }
          if (grant.change_count >= STOCK_GRANT_MAX_CHANGES_PER_SESSION) {
            return NextResponse.json(
              { error: `Had ${STOCK_GRANT_MAX_CHANGES_PER_SESSION} ubahan stok bagi sesi ini telah dicapai.` },
              { status: 403 }
            );
          }
          if (reasonTrim.length < STOCK_GRANT_MIN_REASON_LENGTH) {
            return NextResponse.json(
              {
                error: `Sebab penyesuaian wajib (min ${STOCK_GRANT_MIN_REASON_LENGTH} aksara)`,
              },
              { status: 400 }
            );
          }
          activeGrantId = grant.id;
        }
      } else if (role === 'Main Admin') {
        // optional reason; default below for audit
      }
    }

    // Update product
    let updateQuery = supabaseAdmin
      .from('products')
      .update(updatePayload)
      .eq('id', productId);
    if (role !== 'Main Admin' && userBranch) updateQuery = updateQuery.eq('branch', userBranch);
    const { error: updateError } = await updateQuery;

    if (updateError) {
      if (isMissingBranchColumnError(updateError)) {
        return NextResponse.json({ error: 'Products branch isolation is not configured. Run migration 20260410_products_branch_isolation.sql' }, { status: 500 });
      }
      console.error('Error updating product:', updateError);
      return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
    }

    if (stockChanged) {
      const auditReason =
        reasonTrim ||
        (role === 'Main Admin' ? 'Penyesuaian Main Admin' : reasonTrim) ||
        (exemptFromStockGrant ? `Konteks: ${ctxRaw}` : '');

      await logAuditEvent({
        request,
        module: 'inventory',
        action: 'stock_adjust',
        entityType: 'product',
        entityId: productId,
        branch: userBranch || normalizeBranch(currentUser.branch) || undefined,
        reason: auditReason || undefined,
        referenceNo: activeGrantId ?? undefined,
        metadata: {
          product_name: product.name ?? null,
          stock_adjust_context: ctxRaw || null,
          grant_id: activeGrantId,
          delta: newStock - oldStock,
        },
        changes: [
          {
            field: 'current_stock',
            oldValue: oldStock,
            newValue: newStock,
          },
        ],
      });

      if (!exemptFromStockGrant) {
        const delta = newStock - oldStock;
        const branchLabel =
          (typeof product.branch === 'string' && product.branch.trim()) ||
          userBranch ||
          normalizeBranch(currentUser.branch) ||
          'HQ';
        await supabaseAdmin.from('inventory_movements').insert({
          branch: branchLabel,
          actor_id: currentUser.id,
          actor_name: currentUser.name || currentUser.username || null,
          movement_type: 'adjustment',
          product_id: productId,
          product_name: product.name ?? null,
          qty: Math.abs(delta),
          from_bucket: 'freezer',
          to_bucket: 'freezer',
          notes:
            auditReason ||
            `Penyesuaian stok freezer (${delta >= 0 ? '+' : ''}${delta})`,
          source_ref: activeGrantId || null,
          movement_date: new Date().toISOString(),
        });
      }

      if (activeGrantId) {
        await incrementGrantChangeCount(supabaseAdmin, activeGrantId);
      }
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
    const userBranch = normalizeBranch(currentUser.branch);
    if (role !== 'Main Admin' && !userBranch) {
      return NextResponse.json({ error: 'Branch assignment required for this account' }, { status: 403 });
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
    let fetchProductQuery = supabaseAdmin
      .from('products')
      .select('*')
      .eq('id', productId);
    if (role !== 'Main Admin' && userBranch) fetchProductQuery = fetchProductQuery.eq('branch', userBranch);
    const { data: product, error: fetchError } = await fetchProductQuery.single();

    if (fetchError || !product) {
      if (isMissingBranchColumnError(fetchError)) {
        return NextResponse.json({ error: 'Products branch isolation is not configured. Run migration 20260410_products_branch_isolation.sql' }, { status: 500 });
      }
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Soft delete product with schema fallbacks
    let deleteError: any = null;

    // Preferred: is_active + updated_at
    let firstAttemptQuery = supabaseAdmin
      .from('products')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', productId);
    if (role !== 'Main Admin' && userBranch) firstAttemptQuery = firstAttemptQuery.eq('branch', userBranch);
    const firstAttempt = await firstAttemptQuery;

    deleteError = firstAttempt.error;

    // Fallback 1: older schema without updated_at
    if (deleteError) {
      let secondAttemptQuery = supabaseAdmin
        .from('products')
        .update({ is_active: false })
        .eq('id', productId);
      if (role !== 'Main Admin' && userBranch) secondAttemptQuery = secondAttemptQuery.eq('branch', userBranch);
      const secondAttempt = await secondAttemptQuery;
      deleteError = secondAttempt.error;
    }

    // Fallback 2: very old schema without is_active -> hard delete
    if (deleteError) {
      let thirdAttemptQuery = supabaseAdmin
        .from('products')
        .delete()
        .eq('id', productId);
      if (role !== 'Main Admin' && userBranch) thirdAttemptQuery = thirdAttemptQuery.eq('branch', userBranch);
      const thirdAttempt = await thirdAttemptQuery;
      deleteError = thirdAttempt.error;
    }

    if (deleteError) {
      if (isMissingBranchColumnError(deleteError)) {
        return NextResponse.json({ error: 'Products branch isolation is not configured. Run migration 20260410_products_branch_isolation.sql' }, { status: 500 });
      }
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

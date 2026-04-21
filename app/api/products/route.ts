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
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    const session = getSessionData(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    const branchParam = searchParams.get('branch');

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

      if (session.role !== 'Main Admin' && product.branch !== session.branch) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 403 }
        );
      }

      return NextResponse.json(product);
    }

    // Get all products
    let query = supabaseAdmin
      .from('products')
      .select('*')
      .eq('is_active', true);

    if (session.role !== 'Main Admin') {
      query = query.eq('branch', session.branch);
    } else if (branchParam && branchParam !== 'all') {
      query = query.eq('branch', branchParam);
    }

    const { data: products, error } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch products' },
        { status: 500 }
      );
    }

    return NextResponse.json(products || []);

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
    const session = getSessionData(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
    const branchToSet = session.role === 'Main Admin'
      ? body.branch || session.branch
      : session.branch;

    // Create product
    const { data, error } = await supabaseAdmin
      .from('products')
      .insert([
        {
          id: body.id || `prod_${Date.now()}`,
          name: validatedData.name,
          code: validatedData.code || validatedData.sku,
          price: validatedData.price,
          unit: validatedData.unit,
          branch: branchToSet,
          is_active: validatedData.isActive,
        },
      ])
      .select();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to create product' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: 'Product created successfully',
        productId: data?.[0]?.id,
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
    const session = getSessionData(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    if (session.role !== 'Admin' && session.role !== 'Main Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const needsMainAdminPassword =
      body.name !== undefined ||
      body.sku !== undefined ||
      body.price !== undefined ||
      body.unit !== undefined ||
      body.category !== undefined ||
      body.description !== undefined ||
      body.branch !== undefined ||
      body.is_active !== undefined;

    if (needsMainAdminPassword) {
      if (session.role !== 'Main Admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }

      if (!body.password) {
        return NextResponse.json({ error: 'Password required for product edit' }, { status: 400 });
      }

      const { data: user, error: userError } = await supabaseAdmin
        .from('users')
        .select('password')
        .eq('id', session.id)
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

    if (session.role !== 'Main Admin' && product.branch !== session.branch) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const branchToSet = session.role === 'Main Admin'
      ? body.branch ?? product.branch
      : session.branch;

    // Update product
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (body.stock !== undefined) {
      updatePayload.stock = body.stock;
    }
    if (body.current_stock !== undefined) {
      updatePayload.current_stock = body.current_stock;
    }

    if (needsMainAdminPassword) {
      updatePayload.name = body.name;
      updatePayload.sku = body.sku;
      updatePayload.price = body.price;
      updatePayload.cost = body.cost;
      updatePayload.unit = body.unit;
      updatePayload.category = body.category;
      updatePayload.description = body.description;
      updatePayload.branch = branchToSet;
      updatePayload.is_active = body.is_active ?? true;
    }

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
    const session = getSessionData(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    if (session.role !== 'Main Admin' && product.branch !== session.branch) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Soft delete product
    const { error: deleteError } = await supabaseAdmin
      .from('products')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', productId);

    if (deleteError) {
      console.error('Error deleting product:', deleteError);
      return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
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

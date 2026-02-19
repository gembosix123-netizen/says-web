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

// ============================================================================
// GET HANDLER
// ============================================================================

export async function GET(request: NextRequest) {
  try {
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
      return NextResponse.json(product);
    }

    // Get all products
    const { data: products, error } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('is_active', true);

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
    // TODO: Implement authentication check for Admin+ role
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

    // Update product
    const { error: updateError } = await supabaseAdmin
      .from('products')
      .update({
        name: body.name,
        sku: body.sku,
        price: body.price,
        cost: body.cost,
        stock: body.stock,
        unit: body.unit,
        category: body.category,
        description: body.description,
        is_active: body.is_active ?? true,
        updated_at: new Date().toISOString(),
      })
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
    // TODO: Implement authentication check for Main Admin only
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

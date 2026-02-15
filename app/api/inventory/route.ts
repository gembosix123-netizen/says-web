/**
 * Inventory API Endpoint
 * ======================
 * 
 * GET  /api/inventory     - Get all inventory items
 * POST /api/inventory     - Create inventory item
 * PUT  /api/inventory/:id - Update inventory item
 * DELETE /api/inventory/:id - Delete inventory item
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getInventory,
  getInventoryItem,
  getInventoryByBranch,
  getInventoryByProduct,
  getLowStockItems,
  getOutOfStockItems,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  toApiResponse,
  InventoryItem,
} from '@/lib/firestore-service';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function validateInventoryData(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.productId || typeof data.productId !== 'string') {
    errors.push('Product ID is required');
  }

  if (!data.branch || typeof data.branch !== 'string') {
    errors.push('Branch is required');
  }

  if (data.quantity === undefined || typeof data.quantity !== 'number' || data.quantity < 0) {
    errors.push('Valid quantity is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// GET HANDLER
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const branch = searchParams.get('branch');
    const productId = searchParams.get('productId');
    const status = searchParams.get('status');
    const id = searchParams.get('id');

    // Get single inventory item
    if (id) {
      const item = await getInventoryItem(id);
      if (!item) {
        return NextResponse.json(
          { error: 'Inventory item not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(toApiResponse(item));
    }

    // Get inventory by branch
    if (branch) {
      const items = await getInventoryByBranch(branch);
      return NextResponse.json(toApiResponse(items));
    }

    // Get inventory by product
    if (productId) {
      const items = await getInventoryByProduct(productId);
      return NextResponse.json(toApiResponse(items));
    }

    // Get low stock items
    if (status === 'low-stock') {
      const items = await getLowStockItems();
      return NextResponse.json(toApiResponse(items));
    }

    // Get out of stock items
    if (status === 'out-of-stock') {
      const items = await getOutOfStockItems();
      return NextResponse.json(toApiResponse(items));
    }

    // Get all inventory
    const inventory = await getInventory();
    return NextResponse.json(toApiResponse(inventory));

  } catch (error) {
    console.error('Error fetching inventory:', error);
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
    // TODO: Implement authentication check for Admin+ role
    const body = await request.json();

    // Validate inventory data
    const validation = validateInventoryData(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 400 }
      );
    }

    // Create inventory item
    const inventoryId = await createInventoryItem({
      productId: body.productId,
      branch: body.branch,
      quantity: body.quantity,
      reservedQuantity: body.reservedQuantity || 0,
      availableQuantity: (body.quantity || 0) - (body.reservedQuantity || 0),
      lastRestockDate: body.lastRestockDate,
      lastCountDate: body.lastCountDate,
      status: body.quantity === 0 ? 'out-of-stock' : body.quantity < 10 ? 'low-stock' : 'in-stock',
      batchNumbers: body.batchNumbers || [],
    });

    return NextResponse.json(
      {
        message: 'Inventory item created successfully',
        inventoryId,
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Error creating inventory item:', error);
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
    const inventoryId = body.id || body.inventoryId;

    if (!inventoryId) {
      return NextResponse.json(
        { error: 'Inventory ID is required' },
        { status: 400 }
      );
    }

    // Check inventory item exists
    const item = await getInventoryItem(inventoryId);
    if (!item) {
      return NextResponse.json(
        { error: 'Inventory item not found' },
        { status: 404 }
      );
    }

    // Update inventory item
    await updateInventoryItem(inventoryId, body);

    return NextResponse.json(
      { message: 'Inventory item updated successfully' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error updating inventory item:', error);
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
    // TODO: Implement authentication check for Admin+ role
    const searchParams = request.nextUrl.searchParams;
    const inventoryId = searchParams.get('id');

    if (!inventoryId) {
      return NextResponse.json(
        { error: 'Inventory ID is required' },
        { status: 400 }
      );
    }

    // Check inventory item exists
    const item = await getInventoryItem(inventoryId);
    if (!item) {
      return NextResponse.json(
        { error: 'Inventory item not found' },
        { status: 404 }
      );
    }

    // Delete inventory item
    await deleteInventoryItem(inventoryId);

    return NextResponse.json(
      { message: 'Inventory item deleted successfully' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error deleting inventory item:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

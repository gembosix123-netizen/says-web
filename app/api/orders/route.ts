/**
 * Orders/Transactions API Endpoint
 * ================================
 * 
 * GET  /api/orders     - Get all transactions (orders)
 * POST /api/orders     - Create transaction (order)
 * PUT  /api/orders/:id - Update transaction
 * DELETE /api/orders/:id - Delete transaction
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getTransactions,
  getTransaction,
  getTransactionsByUser,
  getTransactionsByBranch,
  getTransactionsByCustomer,
  getTransactionsByStatus,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  toApiResponse,
} from '@/lib/firestore-service';
import { createOrderSchema } from '@/lib/validations';
import { requireAuth } from '@/lib/auth-check';
import { logAuditEvent } from '@/lib/audit';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// ============================================================================
// GET HANDLER
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const branch = searchParams.get('branch');
    const customerId = searchParams.get('customerId');
    const status = searchParams.get('status');
    const id = searchParams.get('id');

    // Get single transaction
    if (id) {
      const transaction = await getTransaction(id);
      if (!transaction) {
        return NextResponse.json(
          { error: 'Transaction not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(toApiResponse(transaction));
    }

    // Get transactions by user
    if (userId) {
      const transactions = await getTransactionsByUser(userId);
      return NextResponse.json(toApiResponse(transactions));
    }

    // Get transactions by branch
    if (branch) {
      const transactions = await getTransactionsByBranch(branch);
      return NextResponse.json(toApiResponse(transactions));
    }

    // Get transactions by customer
    if (customerId) {
      const transactions = await getTransactionsByCustomer(customerId);
      return NextResponse.json(toApiResponse(transactions));
    }

    // Get transactions by status
    if (status) {
      const transactions = await getTransactionsByStatus(status);
      return NextResponse.json(toApiResponse(transactions));
    }

    // Get all transactions
    const transactions = await getTransactions();
    return NextResponse.json(toApiResponse(transactions));

  } catch (error) {
    console.error('Error fetching transactions:', error);
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
    // Check authentication - Sales role or higher can create orders
    const { user, error } = await requireAuth(request, 'Sales');
    if (error) return error;

    const body = await request.json();

    // Validate transaction data with Zod
    const validation = createOrderSchema.safeParse(body);
    if (!validation.success) {
      const errors = validation.error.issues.map((err) => `${err.path.join('.')}: ${err.message}`);
      return NextResponse.json(
        { error: 'Ralat pengesahan', details: errors },
        { status: 400 }
      );
    }

    const validatedData = validation.data;

    // Map order type to transaction type
    const orderType = validatedData.orderType || 'sale';
    let transactionType: 'sale' | 'return' | 'restock' | 'adjustment' | 'commission' = 'sale';
    if (orderType === 'purchase' || orderType === 'transfer') {
      transactionType = 'restock';
    } else if (orderType === 'return') {
      transactionType = 'return';
    }

    // Map order status to transaction status  
    const orderStatus = validatedData.status || 'pending';
    let transactionStatus: 'pending' | 'completed' | 'cancelled' = 'pending';
    if (orderStatus === 'completed') {
      transactionStatus = 'completed';
    } else if (orderStatus === 'cancelled' || orderStatus === 'failed') {
      transactionStatus = 'cancelled';
    }

    // Transform items to transaction format
    const transactionItems = validatedData.items.map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.price,
      totalPrice: item.subtotal
    }));

    // Create transaction
    const transactionId = await createTransaction({
      type: transactionType,
      status: transactionStatus,
      userId: validatedData.createdBy || body.userId || '',
      branch: validatedData.branch,
      amount: validatedData.totalAmount,
      items: transactionItems,
      customerId: validatedData.customerId || '',
      paymentMethod: body.paymentMethod || 'cash',
      reference: body.reference || '',
      notes: validatedData.notes || '',
      metadata: body.metadata || {},
    });

    await logAuditEvent({
      request,
      actor: user,
      module: 'orders',
      action: 'create_order',
      entityType: 'transaction',
      entityId: transactionId,
      branch: validatedData.branch,
      status: 'success',
      sourceSystem: 'firestore',
      metadata: {
        orderType: validatedData.orderType,
        totalAmount: validatedData.totalAmount,
        itemCount: validatedData.items.length,
      },
    });

    return NextResponse.json(
      {
        message: 'Transaction created successfully',
        transactionId,
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Error creating transaction:', error);
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
    // Check authentication - Admin role or higher can update orders
    const { user, error } = await requireAuth(request, 'Admin');
    if (error) return error;

    const body = await request.json();
    const transactionId = body.id || body.transactionId;

    if (!transactionId) {
      return NextResponse.json(
        { error: 'Transaction ID is required' },
        { status: 400 }
      );
    }

    // Check transaction exists
    const transaction = await getTransaction(transactionId);
    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Update transaction
    await updateTransaction(transactionId, body);

    await logAuditEvent({
      request,
      actor: user,
      module: 'orders',
      action: 'update_order',
      entityType: 'transaction',
      entityId: transactionId,
      branch: transaction.branch,
      status: 'success',
      sourceSystem: 'firestore',
      metadata: {
        updatedFields: Object.keys(body || {}),
      },
    });

    return NextResponse.json(
      { message: 'Transaction updated successfully' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error updating transaction:', error);
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
    // Check authentication - Main Admin only can delete orders
    const { user, error } = await requireAuth(request, 'Main Admin');
    if (error) return error;

    const searchParams = request.nextUrl.searchParams;
    const transactionId = searchParams.get('id');
    const reason = searchParams.get('reason');
    const referenceNo = searchParams.get('referenceNo');

    if (!transactionId) {
      return NextResponse.json(
        { error: 'Transaction ID is required' },
        { status: 400 }
      );
    }

    if (!reason || !reason.trim()) {
      return NextResponse.json(
        { error: 'Reason is required for delete action' },
        { status: 400 }
      );
    }

    // Check transaction exists
    const transaction = await getTransaction(transactionId);
    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Delete transaction
    await deleteTransaction(transactionId);

    await logAuditEvent({
      request,
      actor: user,
      module: 'orders',
      action: 'delete_order',
      entityType: 'transaction',
      entityId: transactionId,
      branch: transaction.branch,
      status: 'success',
      reason,
      referenceNo: referenceNo || undefined,
      sourceSystem: 'firestore',
      changes: [
        {
          field: 'deleted_transaction',
          oldValue: {
            id: transaction.transactionId,
            status: transaction.status,
            amount: transaction.amount,
          },
          newValue: null,
        },
      ],
    });

    return NextResponse.json(
      { message: 'Transaction deleted successfully' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error deleting transaction:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

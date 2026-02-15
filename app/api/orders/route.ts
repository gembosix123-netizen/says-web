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
  Transaction,
} from '@/lib/firestore-service';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function validateTransactionData(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.userId || typeof data.userId !== 'string') {
    errors.push('User ID is required');
  }

  if (!data.branch || typeof data.branch !== 'string') {
    errors.push('Branch is required');
  }

  if (!Array.isArray(data.items) || data.items.length === 0) {
    errors.push('Transaction must have at least one item');
  }

  if (data.amount === undefined || typeof data.amount !== 'number' || data.amount < 0) {
    errors.push('Valid transaction amount is required');
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
    // TODO: Implement authentication check for Sales+ role
    const body = await request.json();

    // Validate transaction data
    const validation = validateTransactionData(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 400 }
      );
    }

    // Create transaction
    const transactionId = await createTransaction({
      type: body.type || 'sale',
      status: body.status || 'pending',
      userId: body.userId,
      branch: body.branch,
      amount: body.amount,
      items: body.items,
      customerId: body.customerId || '',
      paymentMethod: body.paymentMethod || 'cash',
      reference: body.reference || '',
      notes: body.notes || '',
      metadata: body.metadata || {},
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
    // TODO: Implement authentication check
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
    // TODO: Implement authentication check for Main Admin only
    const searchParams = request.nextUrl.searchParams;
    const transactionId = searchParams.get('id');

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

    // Delete transaction
    await deleteTransaction(transactionId);

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

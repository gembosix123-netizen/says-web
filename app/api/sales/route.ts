import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Transaction } from '@/types';

export async function GET() {
  const transactions = await db.transactions.getAll();
  // Sort by createdAt desc
  const sorted = transactions.sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : (a.checkInTime ? new Date(a.checkInTime).getTime() : 0);
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : (b.checkInTime ? new Date(b.checkInTime).getTime() : 0);
    return timeB - timeA;
  });
  return NextResponse.json(sorted);
}

export async function POST(request: Request) {
  try {
    const session = (request as any).cookies.get('session');
    let userId = '';
    if (session) {
      try {
        userId = JSON.parse(session.value).id;
      } catch (e) {}
    }

    const data = await request.json();
    const newTransaction: Transaction = {
        ...data,
        id: Date.now().toString(),
        salesmanId: userId,
        status: 'Completed',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    
    // 1. Validate and Deduct Van Stock
    if (userId) {
        let vanInv = await db.vanInventories.getById(userId);
        if (!vanInv) {
             return NextResponse.json({ error: 'Van inventory not found for user' }, { status: 400 });
        }

        // Verify stock availability
        for (const item of newTransaction.items) {
            const invItem = vanInv.items.find(i => i.productId === item.id);
            if (!invItem || invItem.quantity < item.quantity) {
                return NextResponse.json({ 
                    error: `Insufficient van stock for product ID: ${item.id}. Available: ${invItem?.quantity || 0}` 
                }, { status: 400 });
            }
        }

        // Deduct Sales Items
        for (const item of newTransaction.items) {
            const invItem = vanInv.items.find(i => i.productId === item.id);
            if (invItem) {
                invItem.quantity -= item.quantity;
            }
        }
        
        // Deduct Exchange Items (Replaced with new stock from van)
        if (newTransaction.exchangeItems) {
            for (const item of newTransaction.exchangeItems) {
                const invItem = vanInv.items.find(i => i.productId === item.productId);
                // Exchange deduction logic:
                // If we give a new item in exchange, we deduct from van.
                // If we receive a bad item, we ideally add it to a "Bad Stock" inventory, 
                // but for now, we just deduct the replacement given.
                if (invItem) {
                    if (invItem.quantity < item.quantity) {
                         return NextResponse.json({ 
                            error: `Insufficient van stock for exchange item ID: ${item.productId}` 
                        }, { status: 400 });
                    }
                    invItem.quantity -= item.quantity;
                } else {
                     return NextResponse.json({ 
                        error: `Exchange item not found in van: ${item.productId}` 
                    }, { status: 400 });
                }
            }
        }

        vanInv.updatedAt = new Date().toISOString();
        await db.vanInventories.save(vanInv);
    }

    // 2. Save Transaction
    await db.transactions.save(newTransaction);

    // 3. Update Customer Outstanding Balance (If credit/bill-to-bill or partial payment)
    if (newTransaction.customer) {
        const customer = await db.customers.getById(newTransaction.customer.id);
        if (customer) {
            // Logic: Outstanding += Total - PaidAmount
            // Assuming 'payment.method' handles logic elsewhere, but here we can track debt
            // For simplicity, if payment method is NOT cash, or if there's logic, adjust here.
            // Current requirement: "Payment Mode: Tambah pilihan cara bayaran: Cash atau Bill-to-Bill (Invois)."
            
            // If Bill-to-Bill (Credit), add to outstanding
            // If Cash, assume paid in full unless partial logic exists (not in current scope detail)
            // But let's assume 'credit' method means full debt.
            
            if (newTransaction.payment.method === 'credit') {
                customer.outstandingBalance += newTransaction.total;
                await db.customers.save(customer);
            }
        }
    }

    return NextResponse.json({ success: true, id: newTransaction.id });
  } catch (error) {
    console.error("Sales Error:", error);
    return NextResponse.json({ error: 'Failed to save transaction' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
    try {
        const data = await request.json();
        const { id, ...updates } = data;
        
        if (!id) {
            return NextResponse.json({ error: 'ID required' }, { status: 400 });
        }

        const existing = await db.transactions.getById(id);
        if (!existing) {
             return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
        }

        const updated = {
            ...existing,
            ...updates,
            updatedAt: new Date().toISOString()
        };

        await db.transactions.save(updated);
        return NextResponse.json({ success: true, data: updated });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 });
    }
}

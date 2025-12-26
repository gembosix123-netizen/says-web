import { kv } from '@vercel/kv';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

const IS_PROD = process.env.NODE_ENV === 'production';

export class DB<T extends { id: string }> {
  private filePath: string;
  private keyName: string;

  constructor(filename: string) {
    this.filePath = path.join(DATA_DIR, filename);
    this.keyName = filename.replace('.json', '');
  }

  async getAll(): Promise<T[]> {
    if (IS_PROD) {
      try {
        const data = await kv.get<T[]>(this.keyName);
        return data || [];
      } catch (error) {
        console.error(`KV Error reading ${this.keyName}:`, error);
        return [];
      }
    } else {
      // Local fallback
      if (!fs.existsSync(this.filePath)) return [];
      try {
        const data = fs.readFileSync(this.filePath, 'utf8');
        return JSON.parse(data) as T[];
      } catch (error) {
        return [];
      }
    }
  }

  async getById(id: string): Promise<T | undefined> {
    const items = await this.getAll();
    return items.find((item) => item.id === id);
  }

  async save(item: T): Promise<T> {
    const items = await this.getAll();
    const index = items.findIndex((i) => i.id === item.id);
    
    const newItems = [...items];
    if (index >= 0) {
      newItems[index] = { ...newItems[index], ...item };
    } else {
      newItems.push(item);
    }
    
    if (IS_PROD) {
      await kv.set(this.keyName, newItems);
    } else {
      fs.writeFileSync(this.filePath, JSON.stringify(newItems, null, 2));
    }
    
    return item;
  }

  async delete(id: string): Promise<boolean> {
    const items = await this.getAll();
    const newItems = items.filter((item) => item.id !== id);
    
    if (items.length === newItems.length) return false;
    
    if (IS_PROD) {
      await kv.set(this.keyName, newItems);
    } else {
      fs.writeFileSync(this.filePath, JSON.stringify(newItems, null, 2));
    }

    return true;
  }
}

import { Customer, Product, User, Order, Transaction, StockAudit } from '@/types';

// We need to export instances. 
// Note: methods are now async, so we need to update usage in API routes.
export const db = {
  customers: new DB<Customer>('customers.json'),
  products: new DB<Product>('products.json'),
  users: new DB<User>('users.json'),
  orders: new DB<Order>('orders.json'),
  transactions: new DB<Transaction>('transactions.json'),
  stockAudits: new DB<StockAudit>('stock_audits.json'),
};

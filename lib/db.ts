import { Redis } from '@upstash/redis';
import fs from 'fs';
import path from 'path';

// Initialize Redis client explicitly with connection check logging
// Prioritize KV_ (Vercel) but fallback to UPSTASH_ (Direct)
const redisUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = new Redis({
  url: redisUrl || '',
  token: redisToken || '',
});

if (process.env.NODE_ENV === 'production') {
  console.log('[DB] Initializing Redis connection...');
  if (!redisUrl || !redisToken) {
    console.error('[DB] CRITICAL: Redis credentials missing! Check KV_REST_API_URL or UPSTASH_REDIS_REST_URL.');
  } else {
    console.log('[DB] Redis credentials found.');
  }
}

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
      let data: T[] | null = null;
      try {
        data = await redis.get<T[]>(this.keyName);
      } catch (error: any) {
        // Handle WRONGTYPE error (e.g. key exists but is not a JSON string)
        if (error?.message?.includes('WRONGTYPE')) {
          console.warn(`[DB] Detected WRONGTYPE for ${this.keyName}. resetting key...`);
          await redis.del(this.keyName);
          data = null; // Allow fall-through to seeding logic
        } else {
          console.error(`KV Error reading ${this.keyName}:`, error);
          return [];
        }
      }

      if (data && Array.isArray(data) && data.length > 0) {
        return data;
      }

      // KV is empty or was reset. Try to seed from JSON file.
      console.log(`[DB] KV empty/reset for ${this.keyName}, attempting to seed...`);
      let initialData: T[] = [];

      try {
        if (fs.existsSync(this.filePath)) {
          const fileContent = fs.readFileSync(this.filePath, 'utf8');
          initialData = JSON.parse(fileContent);
        }
      } catch (e) {
        console.warn(`[DB] Failed to read seed file for ${this.keyName}:`, e);
      }

      // If file read failed or empty, and this is 'users', provide default admin
      if (initialData.length === 0 && this.keyName === 'users') {
        console.log('[DB] Seeding default admin user (Hardcoded).');
        initialData = [
          { id: "u1", username: "Admin1", password: "password1", role: "Admin", name: "System Admin" } as any,
          { id: "u2", username: "sales1", password: "password", role: "Sales", name: "Sales Ali" } as any
        ];
      }

      if (initialData.length > 0) {
        console.log(`[DB] Seeding ${this.keyName} with ${initialData.length} items...`);
        // FORCE RESET: Always overwrite users key to ensure new password takes effect
        if (this.keyName === 'users') {
             console.log('[DB] Force resetting users key with new credentials.');
             await redis.del(this.keyName);
        }
        await redis.set(this.keyName, initialData);
        return initialData;
      }

      return [];
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
      await redis.set(this.keyName, newItems);
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
      await redis.set(this.keyName, newItems);
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

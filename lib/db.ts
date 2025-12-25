import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

export class DB<T extends { id: string }> {
  private filePath: string;
  private cache: T[] | null = null;
  private lastModified: number = 0;

  constructor(filename: string) {
    this.filePath = path.join(DATA_DIR, filename);
  }

  getAll(): T[] {
    if (!fs.existsSync(this.filePath)) return [];
    
    try {
      const stats = fs.statSync(this.filePath);
      // If cache exists and file hasn't changed, return cache
      if (this.cache && stats.mtimeMs === this.lastModified) {
        return this.cache;
      }

      const data = fs.readFileSync(this.filePath, 'utf8');
      this.cache = JSON.parse(data) as T[];
      this.lastModified = stats.mtimeMs;
      return this.cache;
    } catch (error) {
      console.error(`Error reading ${this.filePath}:`, error);
      return [];
    }
  }

  getById(id: string): T | undefined {
    const items = this.getAll();
    return items.find((item) => item.id === id);
  }

  save(item: T): T {
    const items = this.getAll();
    const index = items.findIndex((i) => i.id === item.id);
    
    // Update in-memory first
    const newItems = [...items];
    if (index >= 0) {
      newItems[index] = { ...newItems[index], ...item };
    } else {
      newItems.push(item);
    }
    
    this.writeToFile(newItems);
    
    // Update cache immediately
    this.cache = newItems;
    // Update lastModified to match the file we just wrote
    try {
        const stats = fs.statSync(this.filePath);
        this.lastModified = stats.mtimeMs;
    } catch (e) {
        // If stat fails, force reload next time
        this.lastModified = 0;
    }
    
    return item;
  }

  delete(id: string): boolean {
    const items = this.getAll();
    const newItems = items.filter((item) => item.id !== id);
    
    if (items.length === newItems.length) return false;
    
    this.writeToFile(newItems);
    
    // Update cache
    this.cache = newItems;
    try {
        const stats = fs.statSync(this.filePath);
        this.lastModified = stats.mtimeMs;
    } catch (e) {
        this.lastModified = 0;
    }

    return true;
  }

  private writeToFile(data: T[]) {
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
  }
}

import { Customer, Product, User, Order, Transaction, StockAudit } from '@/types';

export const db = {
  customers: new DB<Customer>('customers.json'),
  products: new DB<Product>('products.json'),
  users: new DB<User>('users.json'),
  orders: new DB<Order>('orders.json'),
  transactions: new DB<Transaction>('transactions.json'),
  stockAudits: new DB<StockAudit>('stock_audits.json'),
};

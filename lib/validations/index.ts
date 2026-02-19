// Export all validation schemas
export * from './userSchema';
export * from './productSchema';
export * from './customerSchema';
export * from './salesSchema';
export * from './inventorySchema';
export * from './orderSchema';

// Re-export Zod for convenience
export { z } from 'zod';
export type { ZodError, ZodIssue } from 'zod';

// Utility function to format Zod errors
export function formatZodError(error: any): string[] {
  if (!error.errors || !Array.isArray(error.errors)) {
    return ['Ralat pengesahan data'];
  }
  
  return error.errors.map((err: any) => {
    const path = err.path.join('.');
    return `${path}: ${err.message}`;
  });
}

// Utility function to create error response
export function createValidationErrorResponse(error: any) {
  return {
    error: 'Ralat pengesahan',
    details: formatZodError(error)
  };
}

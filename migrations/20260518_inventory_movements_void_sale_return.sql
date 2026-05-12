-- Allow logging stock returned to van when an invoice is voided (admin void).
-- Run on Supabase after deploy.

ALTER TABLE public.inventory_movements
  DROP CONSTRAINT IF EXISTS inventory_movements_movement_type_check;

ALTER TABLE public.inventory_movements
  ADD CONSTRAINT inventory_movements_movement_type_check
  CHECK (movement_type IN (
    'sale_deduct',
    'return_approved',
    'carry_forward',
    'freezer_in',
    'freezer_to_van',
    'van_to_freezer',
    'damage_write_off',
    'adjustment',
    'void_sale_return'
  ));

COMMENT ON CONSTRAINT inventory_movements_movement_type_check ON public.inventory_movements IS
  'Includes void_sale_return: qty returned to salesman van after admin void.';

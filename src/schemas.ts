import {z} from 'zod';

export const drinkItemSchema = z.object({
  id: z.string(),
  type: z.string(),
  label: z.string(),
  quantity: z.number().int().positive(),
  milk: z.enum(['normal', 'zero', 'vegetal']),
  notes: z.string(),
  price: z.number().nonnegative(),
});

export const createOrderSchema = z.object({
  customerName: z.string().min(1, 'customerName é obrigatório'),
  items: z.array(drinkItemSchema).min(1, 'O pedido precisa de ao menos 1 item'),
});

export const updateStatusSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'completed']),
});

export const newDrinkSchema = z.object({
  label: z.string().min(1, 'label é obrigatório'),
  price: z.number().nonnegative(),
  hasMilk: z.boolean(),
});

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

const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato YYYY-MM-DD');

export const summaryQuerySchema = z.object({
  period: z.enum(['today', '7d', '30d']).default('today'),
});

export const ordersByDayQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7),
});

const historyFiltersShape = {
  from: dateKeySchema.optional(),
  to: dateKeySchema.optional(),
  status: z.enum(['pending', 'in_progress', 'completed']).optional(),
  drink: z.string().min(1).optional(),
  search: z.string().trim().max(100).optional(),
};

const validRange = (v: {from?: string; to?: string}) => !v.from || !v.to || v.from <= v.to;
const rangeError = {message: 'from não pode ser depois de to', path: ['from']};

export const historyFiltersSchema = z.object(historyFiltersShape).refine(validRange, rangeError);

export const historyQuerySchema = z
  .object({
    ...historyFiltersShape,
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .refine(validRange, rangeError);

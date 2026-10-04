import {randomUUID} from 'node:crypto';
import {db} from '../../src/db/client';
import {orderItems, orders} from '../../src/db/schema';

export interface SeedItem {
  type: string;
  label: string;
  quantity: number;
  price: number;
  milk?: string;
}

export interface SeedOrder {
  customerName: string;
  createdAt: number;
  status?: string;
  total?: number;
  items?: SeedItem[];
}

const defaultItems: SeedItem[] = [{type: 'espresso', label: 'Espresso', quantity: 1, price: 8}];

// Insere um pedido direto no banco (sem passar pela API) para poder
// controlar createdAt e status — necessário pra testar relatórios por período.
export async function seedOrder(input: SeedOrder): Promise<number> {
  const items = input.items ?? defaultItems;
  const total = input.total ?? items.reduce((sum, item) => sum + item.price, 0);

  const [row] = await db
    .insert(orders)
    .values({
      customerName: input.customerName,
      status: input.status ?? 'completed',
      total,
      createdAt: input.createdAt,
    })
    .returning();

  await db.insert(orderItems).values(
    items.map(item => ({
      id: randomUUID(),
      orderId: row.seq,
      type: item.type,
      label: item.label,
      quantity: item.quantity,
      milk: item.milk ?? 'normal',
      notes: '',
      price: item.price,
    })),
  );
  return row.seq;
}

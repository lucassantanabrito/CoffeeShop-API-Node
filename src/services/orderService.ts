import {eq, asc} from 'drizzle-orm';
import {randomUUID} from 'node:crypto';
import {db} from '../db/client';
import {orders, orderItems} from '../db/schema';
import type {Order, CreateOrderDTO, OrderStatus, MilkType} from '../types';

function idToSeq(id: string): number {
  const seq = parseInt(id, 10);
  if (Number.isNaN(seq)) {
    throw new Error(`Id de pedido inválido: ${id}`);
  }
  return seq;
}

export function toOrder(
  orderRow: typeof orders.$inferSelect,
  itemRows: (typeof orderItems.$inferSelect)[],
): Order {
  return {
    id: String(orderRow.seq).padStart(3, '0'),
    customerName: orderRow.customerName,
    status: orderRow.status as OrderStatus,
    total: orderRow.total,
    createdAt: orderRow.createdAt,
    items: itemRows.map(item => ({
      id: item.id,
      type: item.type,
      label: item.label,
      quantity: item.quantity,
      milk: item.milk as MilkType,
      notes: item.notes,
      price: item.price,
    })),
  };
}

async function loadOrder(seq: number): Promise<Order | null> {
  const [orderRow] = await db.select().from(orders).where(eq(orders.seq, seq));
  if (!orderRow) {
    return null;
  }
  const itemRows = await db.select().from(orderItems).where(eq(orderItems.orderId, seq));
  return toOrder(orderRow, itemRows);
}

function computeTotal(items: CreateOrderDTO['items']): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}

export const orderService = {
  async getOrders(): Promise<Order[]> {
    const orderRows = await db.select().from(orders).orderBy(asc(orders.seq));
    const result: Order[] = [];
    for (const row of orderRows) {
      const order = await loadOrder(row.seq);
      if (order) {
        result.push(order);
      }
    }
    return result;
  },

  async getOrderById(id: string): Promise<Order | null> {
    return loadOrder(idToSeq(id));
  },

  async createOrder(data: CreateOrderDTO): Promise<Order> {
    const [inserted] = await db
      .insert(orders)
      .values({
        customerName: data.customerName,
        status: 'pending',
        total: computeTotal(data.items),
        createdAt: Date.now(),
      })
      .returning();

    if (data.items.length > 0) {
      await db.insert(orderItems).values(
        data.items.map(item => ({
          id: randomUUID(),
          orderId: inserted.seq,
          type: item.type,
          label: item.label,
          quantity: item.quantity,
          milk: item.milk,
          notes: item.notes,
          price: item.price,
        })),
      );
    }

    const order = await loadOrder(inserted.seq);
    if (!order) {
      throw new Error('Falha ao criar pedido');
    }
    return order;
  },

  async updateOrder(id: string, data: CreateOrderDTO): Promise<Order> {
    const seq = idToSeq(id);
    const existing = await loadOrder(seq);
    if (!existing) {
      const error = new Error(`Pedido ${id} não encontrado`) as Error & {code?: string};
      error.code = 'NOT_FOUND';
      throw error;
    }

    await db
      .update(orders)
      .set({customerName: data.customerName, total: computeTotal(data.items)})
      .where(eq(orders.seq, seq));

    await db.delete(orderItems).where(eq(orderItems.orderId, seq));

    if (data.items.length > 0) {
      await db.insert(orderItems).values(
        data.items.map(item => ({
          id: randomUUID(),
          orderId: seq,
          type: item.type,
          label: item.label,
          quantity: item.quantity,
          milk: item.milk,
          notes: item.notes,
          price: item.price,
        })),
      );
    }

    const order = await loadOrder(seq);
    if (!order) {
      throw new Error('Falha ao atualizar pedido');
    }
    return order;
  },

  async updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
    const seq = idToSeq(id);
    const existing = await loadOrder(seq);
    if (!existing) {
      const error = new Error(`Pedido ${id} não encontrado`) as Error & {code?: string};
      error.code = 'NOT_FOUND';
      throw error;
    }
    await db.update(orders).set({status}).where(eq(orders.seq, seq));
    const order = await loadOrder(seq);
    if (!order) {
      throw new Error('Falha ao atualizar status do pedido');
    }
    return order;
  },

  async deleteOrder(id: string): Promise<void> {
    const seq = idToSeq(id);
    const existing = await loadOrder(seq);
    if (!existing) {
      const error = new Error(`Pedido ${id} não encontrado`) as Error & {code?: string};
      error.code = 'NOT_FOUND';
      throw error;
    }
    await db.delete(orders).where(eq(orders.seq, seq));
  },
};

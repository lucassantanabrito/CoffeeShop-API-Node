import {and, asc, desc, eq, gte, inArray, lt, or, sql} from 'drizzle-orm';
import type {SQL} from 'drizzle-orm';
import {db} from '../db/client';
import {orderItems, orders} from '../db/schema';
import {
  addDays,
  dayKey,
  formatDate,
  formatTime,
  resolvePeriod,
  startOfDayFromKey,
} from '../businessTime';
import {toCsv} from '../csv';
import {toOrder} from './orderService';
import type {
  DailyOrders,
  MetricComparison,
  Order,
  OrderStatus,
  OrdersFilters,
  OrdersPage,
  ReportPeriod,
  SummaryReport,
  TopDrink,
} from '../types';

const MAX_EXPORT_ROWS = 10_000;

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Pendente',
  in_progress: 'Em preparo',
  completed: 'Concluído',
};

const round2 = (n: number) => Math.round(n * 100) / 100;

interface OrderStat {
  createdAt: number;
  status: string;
  total: number;
}

// Pedidos contam todos os status; receita e ticket médio só os concluídos.
function computeStats(rows: OrderStat[]) {
  const completed = rows.filter(row => row.status === 'completed');
  const revenue = round2(completed.reduce((sum, row) => sum + row.total, 0));
  return {
    orders: rows.length,
    revenue,
    averageTicket: completed.length > 0 ? round2(revenue / completed.length) : 0,
  };
}

function compare(value: number, previous: number): MetricComparison {
  return {
    value,
    previous,
    deltaPct: previous === 0 ? null : Math.round(((value - previous) / previous) * 1000) / 10,
  };
}

function buildWhere(filters: OrdersFilters): SQL | undefined {
  const conditions: SQL[] = [];

  if (filters.from) {
    conditions.push(gte(orders.createdAt, startOfDayFromKey(filters.from)));
  }
  if (filters.to) {
    conditions.push(lt(orders.createdAt, addDays(startOfDayFromKey(filters.to), 1)));
  }
  if (filters.status) {
    conditions.push(eq(orders.status, filters.status));
  }
  if (filters.drink) {
    conditions.push(
      sql`exists (select 1 from ${orderItems} where ${orderItems.orderId} = ${orders.seq} and ${orderItems.type} = ${filters.drink})`,
    );
  }
  if (filters.search) {
    const escaped = filters.search.replace(/[\\%_]/g, match => `\\${match}`);
    const byName = sql`${orders.customerName} like ${`%${escaped}%`} escape '\\'`;
    const seq = /^#?(\d+)$/.exec(filters.search);
    const bySeq = seq ? eq(orders.seq, Number(seq[1])) : undefined;
    conditions.push((bySeq ? or(byName, bySeq) : byName) as SQL);
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

async function queryOrders(
  filters: OrdersFilters,
  limit: number,
  offset: number,
): Promise<{data: Order[]; total: number}> {
  const where = buildWhere(filters);

  const [{count}] = await db
    .select({count: sql<number>`count(*)`})
    .from(orders)
    .where(where);

  const orderRows = await db
    .select()
    .from(orders)
    .where(where)
    .orderBy(desc(orders.createdAt), desc(orders.seq))
    .limit(limit)
    .offset(offset);

  const itemRows =
    orderRows.length > 0
      ? await db
          .select()
          .from(orderItems)
          .where(
            inArray(
              orderItems.orderId,
              orderRows.map(row => row.seq),
            ),
          )
      : [];

  const itemsByOrder = new Map<number, typeof itemRows>();
  for (const item of itemRows) {
    const list = itemsByOrder.get(item.orderId) ?? [];
    list.push(item);
    itemsByOrder.set(item.orderId, list);
  }

  return {
    data: orderRows.map(row => toOrder(row, itemsByOrder.get(row.seq) ?? [])),
    total: Number(count),
  };
}

function describeItems(order: Order): string {
  return order.items
    .map(item => {
      const milk = item.milk === 'normal' ? '' : ` (leite ${item.milk})`;
      return `${item.quantity}x ${item.label}${milk}`;
    })
    .join(', ');
}

export const reportService = {
  async getSummary(period: ReportPeriod, now: number = Date.now()): Promise<SummaryReport> {
    const range = resolvePeriod(period, now);

    const rows = await db
      .select({createdAt: orders.createdAt, status: orders.status, total: orders.total})
      .from(orders)
      .where(and(gte(orders.createdAt, range.previousFrom), lt(orders.createdAt, range.to)));

    const current = computeStats(rows.filter(row => row.createdAt >= range.from));
    const previous = computeStats(rows.filter(row => row.createdAt < range.from));

    const quantity = sql<number>`sum(${orderItems.quantity})`;
    const label = sql<string>`max(${orderItems.label})`;
    const [top] = await db
      .select({type: orderItems.type, label, quantity})
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.seq))
      .where(and(gte(orders.createdAt, range.from), lt(orders.createdAt, range.to)))
      .groupBy(orderItems.type)
      .orderBy(desc(quantity), asc(label))
      .limit(1);

    const topDrink: TopDrink | null = top
      ? {type: top.type, label: top.label, quantity: Number(top.quantity)}
      : null;

    return {
      period,
      from: range.from,
      to: range.to,
      orders: compare(current.orders, previous.orders),
      revenue: compare(current.revenue, previous.revenue),
      averageTicket: compare(current.averageTicket, previous.averageTicket),
      topDrink,
    };
  },

  // Um item por dia local (incluindo dias sem pedidos), do mais antigo ao mais recente.
  async getOrdersByDay(days: number, now: number = Date.now()): Promise<DailyOrders[]> {
    const from = addDays(now, -(days - 1));
    const to = addDays(now, 1);

    const rows = await db
      .select({createdAt: orders.createdAt, status: orders.status, total: orders.total})
      .from(orders)
      .where(and(gte(orders.createdAt, from), lt(orders.createdAt, to)));

    const buckets = new Map<string, DailyOrders>();
    for (let i = 0; i < days; i++) {
      const date = dayKey(addDays(from, i));
      buckets.set(date, {date, orders: 0, revenue: 0});
    }
    for (const row of rows) {
      const bucket = buckets.get(dayKey(row.createdAt));
      if (!bucket) {
        continue;
      }
      bucket.orders += 1;
      if (row.status === 'completed') {
        bucket.revenue = round2(bucket.revenue + row.total);
      }
    }
    return [...buckets.values()];
  },

  async listOrders(filters: OrdersFilters, page: number, pageSize: number): Promise<OrdersPage> {
    const {data, total} = await queryOrders(filters, pageSize, (page - 1) * pageSize);
    return {data, page, pageSize, total, totalPages: Math.ceil(total / pageSize)};
  },

  async exportOrdersCsv(filters: OrdersFilters): Promise<string> {
    const {data} = await queryOrders(filters, MAX_EXPORT_ROWS, 0);
    const header = ['Pedido', 'Cliente', 'Itens', 'Total', 'Status', 'Data', 'Hora'];
    const lines = data.map(order => [
      order.id,
      order.customerName,
      describeItems(order),
      order.total.toFixed(2).replace('.', ','),
      STATUS_LABEL[order.status],
      formatDate(order.createdAt),
      formatTime(order.createdAt),
    ]);
    return toCsv([header, ...lines]);
  },
};

import {sqliteTable, text, real, integer} from 'drizzle-orm/sqlite-core';

export const drinkOptions = sqliteTable('drink_options', {
  type: text('type').primaryKey(),
  label: text('label').notNull(),
  price: real('price').notNull(),
  hasMilk: integer('has_milk', {mode: 'boolean'}).notNull().default(false),
});

export const orders = sqliteTable('orders', {
  seq: integer('seq').primaryKey({autoIncrement: true}),
  customerName: text('customer_name').notNull(),
  status: text('status').notNull().default('pending'),
  total: real('total').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const orderItems = sqliteTable('order_items', {
  id: text('id').primaryKey(),
  orderId: integer('order_id')
    .notNull()
    .references(() => orders.seq, {onDelete: 'cascade'}),
  type: text('type').notNull(),
  label: text('label').notNull(),
  quantity: integer('quantity').notNull(),
  milk: text('milk').notNull(),
  notes: text('notes').notNull(),
  price: real('price').notNull(),
});

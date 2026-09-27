import {orderService} from '../../src/services/orderService';
import {runMigrations, clearAllTables} from '../helpers/testDb';
import type {CreateOrderDTO} from '../../src/types';

const sampleOrder: CreateOrderDTO = {
  customerName: 'Lucas',
  items: [
    {id: '1', type: 'espresso', label: 'Espresso', quantity: 1, milk: 'normal', notes: '', price: 8},
    {id: '2', type: 'latte', label: 'Latte', quantity: 2, milk: 'vegetal', notes: 'sem açúcar', price: 22},
  ],
};

beforeAll(() => {
  runMigrations();
});

beforeEach(() => {
  clearAllTables();
});

describe('orderService.createOrder', () => {
  it('computa o total somando o price de cada item', async () => {
    const order = await orderService.createOrder(sampleOrder);
    expect(order.total).toBe(8 + 22);
    expect(order.status).toBe('pending');
    expect(order.items).toHaveLength(2);
  });

  it('gera um id sequencial com 3 dígitos', async () => {
    const first = await orderService.createOrder(sampleOrder);
    const second = await orderService.createOrder(sampleOrder);
    expect(first.id).toMatch(/^\d{3}$/);
    expect(second.id).toBe(String(Number(first.id) + 1).padStart(3, '0'));
  });
});

describe('orderService.getOrderById', () => {
  it('retorna null para um id que não existe', async () => {
    const order = await orderService.getOrderById('999');
    expect(order).toBeNull();
  });

  it('lança um erro legível para um id que não é numérico', async () => {
    await expect(orderService.getOrderById('abc')).rejects.toThrow('Id de pedido inválido');
  });
});

describe('orderService.updateOrderStatus', () => {
  it('atualiza o status de um pedido existente', async () => {
    const created = await orderService.createOrder(sampleOrder);
    const updated = await orderService.updateOrderStatus(created.id, 'in_progress');
    expect(updated.status).toBe('in_progress');
  });

  it('lança NOT_FOUND para um pedido inexistente', async () => {
    await expect(orderService.updateOrderStatus('999', 'in_progress')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('orderService.deleteOrder', () => {
  it('remove o pedido e ele deixa de aparecer em getOrders', async () => {
    const created = await orderService.createOrder(sampleOrder);
    await orderService.deleteOrder(created.id);
    const orders = await orderService.getOrders();
    expect(orders.find(o => o.id === created.id)).toBeUndefined();
  });

  it('lança NOT_FOUND ao tentar apagar um pedido que não existe', async () => {
    await expect(orderService.deleteOrder('999')).rejects.toMatchObject({code: 'NOT_FOUND'});
  });
});

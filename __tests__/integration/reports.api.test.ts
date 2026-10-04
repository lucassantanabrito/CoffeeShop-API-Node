import request from 'supertest';
import {createApp} from '../../src/app';
import {runMigrations, clearAllTables} from '../helpers/testDb';
import {seedOrder} from '../helpers/seedOrders';

const {app} = createApp();

beforeAll(() => {
  runMigrations();
});

beforeEach(() => {
  clearAllTables();
});

describe('GET /reports/summary', () => {
  it('usa period=today por padrão e devolve a estrutura completa', async () => {
    await seedOrder({customerName: 'Lucas', createdAt: Date.now(), total: 20});

    const res = await request(app).get('/reports/summary');
    expect(res.status).toBe(200);
    expect(res.body.period).toBe('today');
    expect(res.body.orders).toEqual({value: 1, previous: 0, deltaPct: null});
    expect(res.body.revenue.value).toBe(20);
    expect(res.body.topDrink).toMatchObject({type: 'espresso', quantity: 1});
  });

  it('aceita 7d e 30d', async () => {
    for (const period of ['7d', '30d']) {
      const res = await request(app).get('/reports/summary').query({period});
      expect(res.status).toBe(200);
      expect(res.body.period).toBe(period);
    }
  });

  it('retorna 400 para período inválido', async () => {
    const res = await request(app).get('/reports/summary?period=ano');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Dados inválidos');
  });
});

describe('GET /reports/orders-by-day', () => {
  it('devolve 7 dias por padrão, com o último sendo hoje', async () => {
    await seedOrder({customerName: 'Lucas', createdAt: Date.now(), total: 20});

    const res = await request(app).get('/reports/orders-by-day');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(7);
    expect(res.body[6]).toMatchObject({orders: 1, revenue: 20});
    expect(res.body[0].orders).toBe(0);
  });

  it('respeita ?days e valida os limites', async () => {
    const ok = await request(app).get('/reports/orders-by-day?days=3');
    expect(ok.body).toHaveLength(3);

    expect((await request(app).get('/reports/orders-by-day?days=0')).status).toBe(400);
    expect((await request(app).get('/reports/orders-by-day?days=91')).status).toBe(400);
    expect((await request(app).get('/reports/orders-by-day?days=abc')).status).toBe(400);
  });
});

describe('GET /reports/orders', () => {
  it('devolve a página no formato { data, page, pageSize, total, totalPages }', async () => {
    for (let i = 0; i < 3; i++) {
      await seedOrder({customerName: `Cliente ${i}`, createdAt: Date.now() - i * 1000});
    }

    const res = await request(app).get('/reports/orders?pageSize=2&page=2');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({page: 2, pageSize: 2, total: 3, totalPages: 2});
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].items).toHaveLength(1);
  });

  it('filtra por status, bebida e busca', async () => {
    await seedOrder({customerName: 'Ana', createdAt: Date.now(), status: 'pending'});
    await seedOrder({customerName: 'Bruno', createdAt: Date.now(), status: 'completed'});

    const byStatus = await request(app).get('/reports/orders?status=pending');
    expect(byStatus.body.data.map((o: {customerName: string}) => o.customerName)).toEqual(['Ana']);

    const bySearch = await request(app).get('/reports/orders?search=bru');
    expect(bySearch.body.total).toBe(1);

    const byDrink = await request(app).get('/reports/orders?drink=nao-existe');
    expect(byDrink.body.total).toBe(0);
  });

  it('ignora filtros vazios enviados por formulários (status=&search=)', async () => {
    await seedOrder({customerName: 'Ana', createdAt: Date.now()});

    const res = await request(app).get('/reports/orders?status=&search=&drink=&from=&to=');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
  });

  it('retorna 400 para parâmetros inválidos', async () => {
    for (const query of [
      'page=0',
      'pageSize=101',
      'status=cancelado',
      'from=15/10/2026',
      'from=2026-10-20&to=2026-10-10',
    ]) {
      const res = await request(app).get(`/reports/orders?${query}`);
      expect([query, res.status]).toEqual([query, 400]);
    }
  });

  it('não conflita com GET /orders/:id', async () => {
    const res = await request(app).get('/orders/001');
    expect(res.status).toBe(404);
  });
});

describe('GET /reports/orders.csv', () => {
  it('responde como download CSV com BOM e as linhas dos pedidos', async () => {
    await seedOrder({customerName: 'Ana', createdAt: Date.now(), status: 'completed'});

    const res = await request(app).get('/reports/orders.csv').buffer(true).parse((r, cb) => {
      let data = '';
      r.setEncoding('utf8');
      r.on('data', chunk => (data += chunk));
      r.on('end', () => cb(null, data));
    });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toMatch(/^attachment; filename="pedidos-\d{4}-\d{2}-\d{2}\.csv"$/);
    const body = res.body as string;
    expect(body.startsWith('﻿Pedido;Cliente;Itens;Total;Status;Data;Hora')).toBe(true);
    expect(body).toContain(';Ana;1x Espresso;8,00;Concluído;');
  });

  it('aplica os filtros e valida parâmetros inválidos', async () => {
    const bad = await request(app).get('/reports/orders.csv?status=xyz');
    expect(bad.status).toBe(400);
  });
});

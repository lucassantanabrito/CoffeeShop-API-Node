import request from 'supertest';
import {createApp} from '../../src/app';
import {runMigrations, clearAllTables} from '../helpers/testDb';

const {app} = createApp();

const validOrderPayload = {
  customerName: 'Lucas',
  items: [{id: '1', type: 'espresso', label: 'Espresso', quantity: 1, milk: 'normal', notes: '', price: 8}],
};

beforeAll(() => {
  runMigrations();
});

beforeEach(() => {
  clearAllTables();
});

describe('GET /orders', () => {
  it('começa vazio', async () => {
    const res = await request(app).get('/orders');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('POST /orders', () => {
  it('cria um pedido válido e retorna 201', async () => {
    const res = await request(app).post('/orders').send(validOrderPayload);
    expect(res.status).toBe(201);
    expect(res.body.customerName).toBe('Lucas');
    expect(res.body.total).toBe(8);
    expect(res.body.status).toBe('pending');
  });

  it('retorna 400 com detalhes do zod quando falta customerName', async () => {
    const res = await request(app)
      .post('/orders')
      .send({items: validOrderPayload.items});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Dados inválidos');
    expect(res.body.details).toBeDefined();
  });

  it('retorna 400 quando o pedido não tem nenhum item', async () => {
    const res = await request(app).post('/orders').send({customerName: 'Lucas', items: []});
    expect(res.status).toBe(400);
  });
});

describe('GET /orders/:id', () => {
  it('retorna 404 para um pedido que não existe', async () => {
    const res = await request(app).get('/orders/999');
    expect(res.status).toBe(404);
  });

  it('retorna 400 para um id que não é numérico', async () => {
    const res = await request(app).get('/orders/abc');
    expect(res.status).toBe(400);
  });
});

describe('PATCH /orders/:id/status', () => {
  it('atualiza o status de um pedido existente', async () => {
    const created = await request(app).post('/orders').send(validOrderPayload);
    const res = await request(app)
      .patch(`/orders/${created.body.id}/status`)
      .send({status: 'in_progress'});
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('in_progress');
  });

  it('retorna 400 para um status fora do enum', async () => {
    const created = await request(app).post('/orders').send(validOrderPayload);
    const res = await request(app)
      .patch(`/orders/${created.body.id}/status`)
      .send({status: 'servido'});
    expect(res.status).toBe(400);
  });

  it('retorna 404 ao atualizar o status de um pedido inexistente', async () => {
    const res = await request(app).patch('/orders/999/status').send({status: 'in_progress'});
    expect(res.status).toBe(404);
  });
});

describe('DELETE /orders/:id', () => {
  it('apaga o pedido (204) e ele some do GET /orders', async () => {
    const created = await request(app).post('/orders').send(validOrderPayload);
    const del = await request(app).delete(`/orders/${created.body.id}`);
    expect(del.status).toBe(204);

    const list = await request(app).get('/orders');
    expect(list.body.find((o: {id: string}) => o.id === created.body.id)).toBeUndefined();
  });
});

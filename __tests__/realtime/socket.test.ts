import type {AddressInfo} from 'net';
import request from 'supertest';
import {io as ioClient, Socket as ClientSocket} from 'socket.io-client';
import {createApp} from '../../src/app';
import {runMigrations, clearAllTables} from '../helpers/testDb';
import type {Order, DrinkOption} from '../../src/types';

const {app, httpServer} = createApp();
let baseUrl: string;
let clientSocket: ClientSocket;

const orderPayload = {
  customerName: 'Lucas',
  items: [{id: '1', type: 'espresso', label: 'Espresso', quantity: 1, milk: 'normal', notes: '', price: 8}],
};

beforeAll(async () => {
  runMigrations();
  await new Promise<void>(resolve => httpServer.listen(0, resolve));
  const {port} = httpServer.address() as AddressInfo;
  baseUrl = `http://localhost:${port}`;
});

afterAll(() => {
  return new Promise<void>(resolve => httpServer.close(() => resolve()));
});

beforeEach(async () => {
  clearAllTables();
  clientSocket = ioClient(baseUrl, {transports: ['websocket']});
  await new Promise<void>(resolve => clientSocket.on('connect', resolve));
});

afterEach(() => {
  return new Promise<void>(resolve => {
    if (!clientSocket.connected) {
      resolve();
      return;
    }
    clientSocket.once('disconnect', () => resolve());
    clientSocket.disconnect();
  });
});

function waitForEvent<T>(event: string): Promise<T> {
  return new Promise(resolve => clientSocket.once(event, resolve));
}

describe('sincronização em tempo real (Socket.io)', () => {
  it('emite order:created quando um pedido é criado via REST', async () => {
    const eventPromise = waitForEvent<Order>('order:created');

    const res = await request(app).post('/orders').send(orderPayload);
    expect(res.status).toBe(201);

    const payload = await eventPromise;
    expect(payload.customerName).toBe('Lucas');
    expect(payload.id).toBe(res.body.id);
  });

  it('emite order:updated quando o status de um pedido muda', async () => {
    const created = await request(app).post('/orders').send(orderPayload);

    const eventPromise = waitForEvent<Order>('order:updated');
    await request(app).patch(`/orders/${created.body.id}/status`).send({status: 'in_progress'});

    const payload = await eventPromise;
    expect(payload.status).toBe('in_progress');
  });

  it('emite order:deleted com o id do pedido removido', async () => {
    const created = await request(app).post('/orders').send(orderPayload);

    const eventPromise = waitForEvent<{id: string}>('order:deleted');
    await request(app).delete(`/orders/${created.body.id}`);

    const payload = await eventPromise;
    expect(payload.id).toBe(created.body.id);
  });

  it('emite drink:updated e drink:deleted pras rotas novas de editar/apagar bebida', async () => {
    const created = await request(app)
      .post('/drinks')
      .send({label: 'Chai', price: 15, hasMilk: true});

    const updatedPromise = waitForEvent<DrinkOption>('drink:updated');
    await request(app)
      .put(`/drinks/${created.body.type}`)
      .send({label: 'Chai Editado', price: 19.9, hasMilk: true});
    const updated = await updatedPromise;
    expect(updated.label).toBe('Chai Editado');

    const deletedPromise = waitForEvent<{type: string}>('drink:deleted');
    await request(app).delete(`/drinks/${created.body.type}`);
    const deleted = await deletedPromise;
    expect(deleted.type).toBe(created.body.type);
  });
});

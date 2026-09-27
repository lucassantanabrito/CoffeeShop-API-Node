import request from 'supertest';
import {createApp} from '../../src/app';
import {runMigrations, clearAllTables} from '../helpers/testDb';

const {app} = createApp();

beforeAll(() => {
  runMigrations();
});

beforeEach(() => {
  clearAllTables();
});

describe('GET /drinks', () => {
  it('começa vazio (sem seed automático)', async () => {
    const res = await request(app).get('/drinks');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('GET /drinks/milk-options', () => {
  it('retorna as 3 opções fixas de leite', async () => {
    const res = await request(app).get('/drinks/milk-options');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(res.body.map((m: {type: string}) => m.type).sort()).toEqual(['normal', 'vegetal', 'zero']);
  });
});

describe('POST /drinks', () => {
  it('cria uma bebida e ignora um type enviado pelo cliente', async () => {
    const res = await request(app)
      .post('/drinks')
      .send({type: 'latte', label: 'Latte', price: 18, hasMilk: true});
    expect(res.status).toBe(201);
    expect(res.body.type).toMatch(/^custom-/);
    expect(res.body.label).toBe('Latte');
  });

  it('retorna 400 quando falta o label', async () => {
    const res = await request(app).post('/drinks').send({price: 18, hasMilk: true});
    expect(res.status).toBe(400);
  });
});

describe('PUT /drinks/:type', () => {
  it('edita uma bebida existente', async () => {
    const created = await request(app)
      .post('/drinks')
      .send({label: 'Chai', price: 15, hasMilk: true});

    const res = await request(app)
      .put(`/drinks/${created.body.type}`)
      .send({label: 'Chai Editado', price: 19.9, hasMilk: false});

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({label: 'Chai Editado', price: 19.9, hasMilk: false});
  });

  it('retorna 404 ao editar uma bebida que não existe', async () => {
    const res = await request(app)
      .put('/drinks/nao-existe')
      .send({label: 'X', price: 1, hasMilk: false});
    expect(res.status).toBe(404);
  });
});

describe('DELETE /drinks/:type', () => {
  it('apaga a bebida (204) e ela some do GET /drinks', async () => {
    const created = await request(app)
      .post('/drinks')
      .send({label: 'Chai', price: 15, hasMilk: true});

    const del = await request(app).delete(`/drinks/${created.body.type}`);
    expect(del.status).toBe(204);

    const list = await request(app).get('/drinks');
    expect(list.body.find((d: {type: string}) => d.type === created.body.type)).toBeUndefined();
  });

  it('retorna 404 ao apagar uma bebida que não existe', async () => {
    const res = await request(app).delete('/drinks/nao-existe');
    expect(res.status).toBe(404);
  });
});

import {reportService} from '../../src/services/reportService';
import {runMigrations, clearAllTables} from '../helpers/testDb';
import {seedOrder} from '../helpers/seedOrders';

// Quinta, 15/10/2026 12:00 em Brasília
const NOW = Date.UTC(2026, 9, 15, 15, 0);
const local = (day: number, hour: number, minute = 0) =>
  Date.UTC(2026, 9, day, hour + 3, minute);

const latte = (quantity: number, price: number) => ({
  type: 'latte',
  label: 'Latte',
  quantity,
  price,
  milk: 'vegetal',
});
const espresso = (quantity: number, price: number) => ({
  type: 'espresso',
  label: 'Espresso',
  quantity,
  price,
});

beforeAll(() => {
  runMigrations();
});

beforeEach(() => {
  clearAllTables();
});

describe('reportService.getSummary', () => {
  it('zera tudo e devolve topDrink null sem pedidos', async () => {
    const summary = await reportService.getSummary('today', NOW);
    expect(summary.orders).toEqual({value: 0, previous: 0, deltaPct: null});
    expect(summary.revenue).toEqual({value: 0, previous: 0, deltaPct: null});
    expect(summary.averageTicket).toEqual({value: 0, previous: 0, deltaPct: null});
    expect(summary.topDrink).toBeNull();
  });

  it('conta todos os pedidos mas só soma receita/ticket dos concluídos', async () => {
    await seedOrder({customerName: 'A', createdAt: local(15, 10), status: 'completed', items: [latte(2, 36), espresso(1, 10)]});
    await seedOrder({customerName: 'B', createdAt: local(15, 11), status: 'completed', items: [espresso(1, 20)]});
    await seedOrder({customerName: 'C', createdAt: local(15, 11, 30), status: 'pending', items: [latte(1, 18)]});
    await seedOrder({customerName: 'D', createdAt: local(15, 11, 45), status: 'in_progress', items: [latte(1, 18)]});

    const summary = await reportService.getSummary('today', NOW);
    expect(summary.orders.value).toBe(4);
    expect(summary.revenue.value).toBe(66);
    expect(summary.averageTicket.value).toBe(33);
  });

  it('compara com o período anterior e arredonda a variação em 1 casa', async () => {
    await seedOrder({customerName: 'hoje', createdAt: local(15, 10), total: 46});
    await seedOrder({customerName: 'ontem', createdAt: local(14, 15), total: 30});

    const summary = await reportService.getSummary('today', NOW);
    expect(summary.orders).toEqual({value: 1, previous: 1, deltaPct: 0});
    expect(summary.revenue).toEqual({value: 46, previous: 30, deltaPct: 53.3});
  });

  it('respeita a fronteira da meia-noite local (e não a UTC)', async () => {
    await seedOrder({customerName: 'meia-noite', createdAt: local(15, 0, 0)});
    await seedOrder({customerName: 'um segundo antes', createdAt: local(15, 0, 0) - 1000});

    const summary = await reportService.getSummary('today', NOW);
    expect(summary.orders.value).toBe(1);
    expect(summary.orders.previous).toBe(1);
  });

  it('ignora pedidos fora do período e anteriores à janela de comparação', async () => {
    await seedOrder({customerName: 'antigo', createdAt: local(1, 10)});
    await seedOrder({customerName: 'agora', createdAt: local(15, 10)});

    const summary = await reportService.getSummary('7d', NOW);
    expect(summary.orders).toEqual({value: 1, previous: 0, deltaPct: null});
  });

  it('escolhe a bebida mais vendida por quantidade, com desempate por nome', async () => {
    await seedOrder({customerName: 'A', createdAt: local(15, 9), items: [latte(2, 36), espresso(1, 8)]});
    await seedOrder({customerName: 'B', createdAt: local(15, 10), items: [latte(1, 18), espresso(2, 16)]});
    await seedOrder({customerName: 'C', createdAt: local(14, 10), items: [espresso(10, 80)]});

    const summary = await reportService.getSummary('today', NOW);
    // Latte 3 x Espresso 3 hoje -> empate resolvido pelo nome (Espresso < Latte)
    expect(summary.topDrink).toEqual({type: 'espresso', label: 'Espresso', quantity: 3});
  });
});

describe('reportService.getOrdersByDay', () => {
  it('devolve um item por dia, inclusive sem pedidos, do mais antigo ao mais recente', async () => {
    await seedOrder({customerName: 'A', createdAt: local(14, 10), total: 30});
    await seedOrder({customerName: 'B', createdAt: local(15, 9), total: 46});
    await seedOrder({customerName: 'C', createdAt: local(15, 10), status: 'pending', total: 18});

    const days = await reportService.getOrdersByDay(3, NOW);
    expect(days).toEqual([
      {date: '2026-10-13', orders: 0, revenue: 0},
      {date: '2026-10-14', orders: 1, revenue: 30},
      {date: '2026-10-15', orders: 2, revenue: 46},
    ]);
  });

  it('agrupa pelo dia local: 23h30 em Brasília conta no dia anterior', async () => {
    await seedOrder({customerName: 'noite', createdAt: local(14, 23, 30), total: 10});

    const days = await reportService.getOrdersByDay(2, NOW);
    expect(days[0]).toEqual({date: '2026-10-14', orders: 1, revenue: 10});
    expect(days[1]).toEqual({date: '2026-10-15', orders: 0, revenue: 0});
  });
});

describe('reportService.listOrders', () => {
  beforeEach(async () => {
    await seedOrder({customerName: 'João Pedro', createdAt: local(13, 9), status: 'completed', items: [espresso(3, 24)]});
    await seedOrder({customerName: 'Mariana Silva', createdAt: local(14, 9), status: 'pending', items: [latte(2, 36)]});
    await seedOrder({customerName: 'lucas', createdAt: local(15, 9), status: 'in_progress', items: [latte(1, 18), espresso(1, 8)]});
  });

  it('ordena do mais recente para o mais antigo e devolve itens e total', async () => {
    const page = await reportService.listOrders({}, 1, 20);
    expect(page.total).toBe(3);
    expect(page.totalPages).toBe(1);
    expect(page.data.map(o => o.customerName)).toEqual(['lucas', 'Mariana Silva', 'João Pedro']);
    expect(page.data[0].items).toHaveLength(2);
    expect(page.data[0].id).toMatch(/^\d{3}$/);
  });

  it('pagina e informa o total de páginas', async () => {
    const second = await reportService.listOrders({}, 2, 2);
    expect(second.total).toBe(3);
    expect(second.totalPages).toBe(2);
    expect(second.data.map(o => o.customerName)).toEqual(['João Pedro']);
  });

  it('filtra por status', async () => {
    const page = await reportService.listOrders({status: 'pending'}, 1, 20);
    expect(page.data.map(o => o.customerName)).toEqual(['Mariana Silva']);
  });

  it('filtra por bebida (pedidos que contêm o item)', async () => {
    const page = await reportService.listOrders({drink: 'latte'}, 1, 20);
    expect(page.data.map(o => o.customerName)).toEqual(['lucas', 'Mariana Silva']);
    // Os itens devolvidos continuam sendo todos os do pedido, não só o filtrado
    expect(page.data[0].items).toHaveLength(2);
  });

  it('filtra por período com datas inclusivas no fuso local', async () => {
    const page = await reportService.listOrders({from: '2026-10-14', to: '2026-10-14'}, 1, 20);
    expect(page.data.map(o => o.customerName)).toEqual(['Mariana Silva']);

    const fromOnly = await reportService.listOrders({from: '2026-10-14'}, 1, 20);
    expect(fromOnly.total).toBe(2);
    const toOnly = await reportService.listOrders({to: '2026-10-13'}, 1, 20);
    expect(toOnly.data.map(o => o.customerName)).toEqual(['João Pedro']);
  });

  it('busca por trecho do nome sem diferenciar maiúsculas (ASCII)', async () => {
    const page = await reportService.listOrders({search: 'LUC'}, 1, 20);
    expect(page.data.map(o => o.customerName)).toEqual(['lucas']);
  });

  it('busca pelo número do pedido, com ou sem #', async () => {
    const all = await reportService.listOrders({}, 1, 20);
    const target = all.data[1];
    const byNumber = await reportService.listOrders({search: String(Number(target.id))}, 1, 20);
    expect(byNumber.data.map(o => o.id)).toContain(target.id);
    const withHash = await reportService.listOrders({search: `#${Number(target.id)}`}, 1, 20);
    expect(withHash.data.map(o => o.id)).toContain(target.id);
  });

  it('trata % e _ da busca como texto literal', async () => {
    expect((await reportService.listOrders({search: '%'}, 1, 20)).total).toBe(0);
    expect((await reportService.listOrders({search: '_'}, 1, 20)).total).toBe(0);
  });

  it('combina filtros com AND', async () => {
    const page = await reportService.listOrders({drink: 'latte', status: 'in_progress'}, 1, 20);
    expect(page.data.map(o => o.customerName)).toEqual(['lucas']);
  });

  it('devolve página vazia com totalPages 0 quando nada bate', async () => {
    const page = await reportService.listOrders({search: 'ninguém'}, 1, 20);
    expect(page).toMatchObject({data: [], total: 0, totalPages: 0});
  });
});

describe('reportService.exportOrdersCsv', () => {
  it('gera CSV com BOM, cabeçalho em pt-BR e data/hora no fuso local', async () => {
    await seedOrder({
      customerName: 'Mariana Silva',
      createdAt: local(15, 9, 41),
      status: 'in_progress',
      items: [latte(2, 36), espresso(1, 10)],
    });

    const csv = await reportService.exportOrdersCsv({});
    expect(csv.startsWith('﻿')).toBe(true);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[0]).toBe('Pedido;Cliente;Itens;Total;Status;Data;Hora');
    expect(lines[1]).toMatch(
      /^\d{3};Mariana Silva;2x Latte \(leite vegetal\), 1x Espresso;46,00;Em preparo;15\/10\/2026;09:41$/,
    );
    expect(lines[2]).toBe('');
  });

  it('escapa aspas/separadores e neutraliza fórmulas no nome do cliente', async () => {
    await seedOrder({customerName: '=HYPERLINK("http://x")', createdAt: local(15, 9)});
    await seedOrder({customerName: 'Silva; "Zé"', createdAt: local(15, 10)});

    const csv = await reportService.exportOrdersCsv({});
    expect(csv).toContain(`;"Silva; ""Zé""";`);
    expect(csv).toContain(`;"'=HYPERLINK(""http://x"")";`);
  });

  it('respeita os mesmos filtros do histórico', async () => {
    await seedOrder({customerName: 'Concluído', createdAt: local(15, 9), status: 'completed'});
    await seedOrder({customerName: 'Pendente', createdAt: local(15, 10), status: 'pending'});

    const csv = await reportService.exportOrdersCsv({status: 'pending'});
    expect(csv).toContain('Pendente');
    expect(csv).not.toContain('Concluído;');
  });
});

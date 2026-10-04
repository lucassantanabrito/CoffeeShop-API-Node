import 'dotenv/config';
import {randomUUID} from 'node:crypto';
import {db, sqlite} from './client';
import {drinkOptions, orderItems, orders} from './schema';
import {addDays, dayKey, startOfDay} from '../businessTime';
import {MILK_OPTIONS} from '../types';
import type {MilkType} from '../types';

// Dados FICTÍCIOS só para testar o painel web (dashboard e histórico):
// ~65 dias de pedidos (dá para comparar 30d com os 30d anteriores) com volume maior nos fins de semana e pico de manhã e
// à tarde. Determinístico (mesma semente = mesmos pedidos relativos a "hoje").
// Recusa rodar se já houver pedidos, para nunca misturar com dados reais.
const DAYS = 65;
const MINUTE_MS = 60 * 1000;

const CUSTOMERS = [
  'Mariana Silva', 'Carlos Souza', 'Ana Paula', 'João Pedro', 'Fernanda Lima',
  'Rafael Costa', 'Juliana Alves', 'Bruno Teixeira', 'Camila Rocha', 'Lucas Martins',
  'Beatriz Nunes', 'Gabriel Ferreira', 'Larissa Gomes', 'Thiago Ribeiro', 'Patrícia Dias',
  'Felipe Araújo', 'Aline Barbosa', 'Diego Carvalho', 'Renata Moreira', 'Vinícius Pires',
  'Isabela Cardoso', 'Rodrigo Mendes', 'Letícia Freitas', 'Eduardo Castro', 'Natália Campos',
  'Marcelo Duarte', 'Vanessa Monteiro', 'André Lopes', 'Priscila Ramos', 'Henrique Barros',
];

// Pesos de popularidade por tipo de bebida (os não listados valem 1).
const DRINK_WEIGHTS: Record<string, number> = {latte: 5, cappuccino: 4, espresso: 4, mocha: 2};
const MILK_WEIGHTS: Array<[MilkType, number]> = [['normal', 6], ['zero', 2], ['vegetal', 2]];
// Peso por hora do dia (8h–18h): pico no começo da manhã e à tarde.
const HOUR_WEIGHTS = [5, 6, 4, 2, 2, 3, 5, 5, 3, 2, 1];

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20261015);
const between = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

function pickWeighted<T>(items: T[], weightOf: (item: T) => number): T {
  const total = items.reduce((sum, item) => sum + weightOf(item), 0);
  let roll = rand() * total;
  for (const item of items) {
    roll -= weightOf(item);
    if (roll < 0) {
      return item;
    }
  }
  return items[items.length - 1];
}

interface Draft {
  customerName: string;
  createdAt: number;
  items: Array<{
    type: string;
    label: string;
    quantity: number;
    milk: MilkType;
    price: number;
  }>;
}

async function main() {
  const catalog = await db.select().from(drinkOptions);
  if (catalog.length === 0) {
    throw new Error('Catálogo de bebidas vazio. Rode `npm run db:seed` antes.');
  }
  const existing = sqlite.prepare('select count(*) as n from orders').get() as {n: number};
  if (existing.n > 0) {
    throw new Error(
      `Já existem ${existing.n} pedidos neste banco; o seed demo só roda em banco sem pedidos.`,
    );
  }

  const now = Date.now();
  const drafts: Draft[] = [];

  for (let offset = DAYS - 1; offset >= 0; offset--) {
    const dayStart = addDays(now, -offset);
    const weekday = new Date(dayStart + 12 * 60 * MINUTE_MS).getUTCDay();
    const weekend = weekday === 0 || weekday === 6;
    const count = offset === 0 ? between(6, 9) : weekend ? between(9, 15) : between(4, 10);

    for (let i = 0; i < count; i++) {
      // Hoje: simula a fila do barista (1 pendente, 2 em preparo, resto concluído)
      // independente da hora em que o seed rodar.
      const todayAgeMinutes = [between(2, 8), between(12, 22), between(14, 24)][i] ?? between(30, 360);
      const hour = 8 + pickWeighted([...HOUR_WEIGHTS.keys()], idx => HOUR_WEIGHTS[idx]);
      const createdAt =
        offset === 0
          ? Math.max(dayStart, now - todayAgeMinutes * MINUTE_MS)
          : dayStart + hour * 60 * MINUTE_MS + between(0, 59) * MINUTE_MS;

      const lines = between(1, 3);
      const items: Draft['items'] = [];
      for (let l = 0; l < lines; l++) {
        const drink = pickWeighted(catalog, d => DRINK_WEIGHTS[d.type] ?? 1);
        const milk: MilkType = drink.hasMilk ? pickWeighted(MILK_WEIGHTS, m => m[1])[0] : 'normal';
        const priceAdd = MILK_OPTIONS.find(m => m.type === milk)?.priceAdd ?? 0;
        const quantity = rand() < 0.75 ? 1 : 2;
        items.push({
          type: drink.type,
          label: drink.label,
          quantity,
          milk,
          price: (drink.price + priceAdd) * quantity,
        });
      }
      drafts.push({
        customerName: CUSTOMERS[between(0, CUSTOMERS.length - 1)],
        createdAt,
        items,
      });
    }
  }

  drafts.sort((a, b) => a.createdAt - b.createdAt);

  // Pedidos antigos estão todos concluídos; os de agora simulam a fila do barista.
  const statusFor = (createdAt: number) => {
    const ageMinutes = (now - createdAt) / MINUTE_MS;
    if (ageMinutes < 10) return 'pending';
    if (ageMinutes < 25) return 'in_progress';
    return 'completed';
  };

  db.transaction(tx => {
    for (const draft of drafts) {
      const total = draft.items.reduce((sum, item) => sum + item.price, 0);
      const row = tx
        .insert(orders)
        .values({
          customerName: draft.customerName,
          status: statusFor(draft.createdAt),
          total,
          createdAt: draft.createdAt,
        })
        .returning()
        .get();
      tx.insert(orderItems)
        .values(
          draft.items.map(item => ({
            id: randomUUID(),
            orderId: row.seq,
            notes: '',
            ...item,
          })),
        )
        .run();
    }
  });

  const first = dayKey(startOfDay(drafts[0].createdAt));
  const last = dayKey(drafts[drafts.length - 1].createdAt);
  console.log(`Seed demo concluído: ${drafts.length} pedidos fictícios (${first} a ${last}).`);
}

main()
  .catch(e => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => {
    sqlite.close();
  });

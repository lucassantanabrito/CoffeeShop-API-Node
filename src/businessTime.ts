// Fuso horário do estabelecimento. "Hoje", "últimos 7 dias" e o agrupamento
// por dia dependem dele (createdAt é epoch em ms, UTC). Configurável por
// BUSINESS_TIMEZONE (nome IANA); o padrão é o horário de Brasília.
const DEFAULT_TIMEZONE = 'America/Sao_Paulo';
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export function getBusinessTimezone(): string {
  return process.env.BUSINESS_TIMEZONE || DEFAULT_TIMEZONE;
}

interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timezone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timezone, formatter);
  }
  return formatter;
}

function localParts(ts: number, timezone: string): LocalParts {
  const values: Record<string, number> = {};
  for (const part of formatterFor(timezone).formatToParts(new Date(ts))) {
    if (part.type !== 'literal') {
      values[part.type] = Number(part.value);
    }
  }
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function offsetMs(ts: number, timezone: string): number {
  const p = localParts(ts, timezone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(ts / 1000) * 1000;
}

// Instante (epoch ms) em que começa o dia local de `ts`.
export function startOfDay(ts: number, timezone = getBusinessTimezone()): number {
  const p = localParts(ts, timezone);
  const localMidnightAsUtc = Date.UTC(p.year, p.month - 1, p.day);
  const guess = localMidnightAsUtc - offsetMs(localMidnightAsUtc, timezone);
  return localMidnightAsUtc - offsetMs(guess, timezone);
}

// Início do dia local `days` dias depois (ou antes, se negativo) de `ts`.
// Parte do meio-dia para não errar em dias de 23h/25h (horário de verão).
export function addDays(ts: number, days: number, timezone = getBusinessTimezone()): number {
  return startOfDay(startOfDay(ts, timezone) + days * DAY_MS + DAY_MS / 2, timezone);
}

const pad = (n: number, size = 2) => String(n).padStart(size, '0');

// 'YYYY-MM-DD' do dia local de `ts`.
export function dayKey(ts: number, timezone = getBusinessTimezone()): string {
  const p = localParts(ts, timezone);
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}`;
}

// Inverso de dayKey: início do dia local descrito por 'YYYY-MM-DD'.
export function startOfDayFromKey(key: string, timezone = getBusinessTimezone()): number {
  const [year, month, day] = key.split('-').map(Number);
  return startOfDay(Date.UTC(year, month - 1, day, 12), timezone);
}

export function formatDate(ts: number, timezone = getBusinessTimezone()): string {
  const p = localParts(ts, timezone);
  return `${pad(p.day)}/${pad(p.month)}/${pad(p.year, 4)}`;
}

export function formatTime(ts: number, timezone = getBusinessTimezone()): string {
  const p = localParts(ts, timezone);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

export type Period = 'today' | '7d' | '30d';

const PERIOD_DAYS: Record<Period, number> = {today: 1, '7d': 7, '30d': 30};

export interface PeriodRange {
  days: number;
  from: number;
  to: number;
  previousFrom: number;
}

// Janela [from, to) do período (terminando no fim do dia de `now`) e o início
// da janela imediatamente anterior, de mesmo tamanho, usada nas comparações.
export function resolvePeriod(
  period: Period,
  now: number,
  timezone = getBusinessTimezone(),
): PeriodRange {
  const days = PERIOD_DAYS[period];
  const to = addDays(now, 1, timezone);
  const from = addDays(now, -(days - 1), timezone);
  const previousFrom = addDays(from, -days, timezone);
  return {days, from, to, previousFrom};
}

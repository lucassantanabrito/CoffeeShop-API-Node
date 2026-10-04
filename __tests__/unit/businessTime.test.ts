import {
  addDays,
  dayKey,
  formatDate,
  formatTime,
  resolvePeriod,
  startOfDay,
  startOfDayFromKey,
} from '../../src/businessTime';

const SP = 'America/Sao_Paulo';

describe('businessTime (America/Sao_Paulo, UTC-3)', () => {
  it('usa o dia local, não o dia UTC, para agrupar', () => {
    // 15/10 02:30 UTC = 14/10 23:30 em Brasília
    const ts = Date.UTC(2026, 9, 15, 2, 30);
    expect(dayKey(ts, SP)).toBe('2026-10-14');
    expect(startOfDay(ts, SP)).toBe(Date.UTC(2026, 9, 14, 3, 0));
  });

  it('startOfDayFromKey é o inverso de dayKey', () => {
    const start = startOfDayFromKey('2026-10-15', SP);
    expect(start).toBe(Date.UTC(2026, 9, 15, 3, 0));
    expect(dayKey(start, SP)).toBe('2026-10-15');
    expect(dayKey(start - 1, SP)).toBe('2026-10-14');
  });

  it('addDays anda em dias locais, para frente e para trás', () => {
    const ts = Date.UTC(2026, 9, 15, 15, 0);
    expect(addDays(ts, 1, SP)).toBe(Date.UTC(2026, 9, 16, 3, 0));
    expect(addDays(ts, -2, SP)).toBe(Date.UTC(2026, 9, 13, 3, 0));
    expect(addDays(ts, 0, SP)).toBe(Date.UTC(2026, 9, 15, 3, 0));
  });

  it('não erra em dia de horário de verão (fuso com DST)', () => {
    const ny = 'America/New_York';
    const beforeDst = Date.UTC(2026, 2, 8, 12, 0);
    expect(startOfDay(beforeDst, ny)).toBe(Date.UTC(2026, 2, 8, 5, 0));
    // O dia 08/03 tem 23h: o início do dia seguinte já é em EDT (UTC-4)
    expect(addDays(beforeDst, 1, ny)).toBe(Date.UTC(2026, 2, 9, 4, 0));
  });

  it('formata data e hora locais', () => {
    const ts = Date.UTC(2026, 9, 15, 12, 41);
    expect(formatDate(ts, SP)).toBe('15/10/2026');
    expect(formatTime(ts, SP)).toBe('09:41');
  });

  it('resolvePeriod devolve janelas [from, to) e a janela anterior de mesmo tamanho', () => {
    const now = Date.UTC(2026, 9, 15, 15, 0);
    const endOfToday = Date.UTC(2026, 9, 16, 3, 0);

    expect(resolvePeriod('today', now, SP)).toEqual({
      days: 1,
      from: Date.UTC(2026, 9, 15, 3, 0),
      to: endOfToday,
      previousFrom: Date.UTC(2026, 9, 14, 3, 0),
    });
    expect(resolvePeriod('7d', now, SP)).toEqual({
      days: 7,
      from: Date.UTC(2026, 9, 9, 3, 0),
      to: endOfToday,
      previousFrom: Date.UTC(2026, 9, 2, 3, 0),
    });
    expect(resolvePeriod('30d', now, SP).from).toBe(Date.UTC(2026, 8, 16, 3, 0));
  });
});

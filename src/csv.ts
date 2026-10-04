// CSV pensado para abrir direto no Excel em pt-BR: separador ';', fim de
// linha CRLF e BOM UTF-8 (sem ele os acentos quebram).
const SEPARATOR = ';';
const BOM = '﻿';

// Células que começam com estes caracteres podem ser lidas como fórmula
// pelo Excel/Sheets (CSV injection), e o nome do cliente é texto livre.
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

function escapeCell(value: string): string {
  const safe = FORMULA_PREFIX.test(value) ? `'${value}` : value;
  if (/[";\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function toCsv(rows: string[][]): string {
  return BOM + rows.map(row => row.map(escapeCell).join(SEPARATOR)).join('\r\n') + '\r\n';
}

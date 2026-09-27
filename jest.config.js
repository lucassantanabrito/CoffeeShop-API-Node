/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Só arquivos *.test.ts contam como suíte — isso deixa os helpers em
  // __tests__/helpers/ livres pra serem importados sem o Jest tentar
  // rodá-los como teste (o padrão do Jest trata QUALQUER .ts dentro de
  // uma pasta __tests__ como suíte, o que quebraria com um arquivo de
  // helper sem nenhum `it()`/`describe()`).
  testMatch: ['<rootDir>/__tests__/**/*.test.ts'],
  setupFiles: ['<rootDir>/__tests__/helpers/jest.setup.ts'],
  clearMocks: true,
};

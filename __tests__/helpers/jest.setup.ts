// Roda antes de qualquer import do código-fonte em cada arquivo de teste,
// garantindo que src/db/client.ts (que lê DB_FILE na primeira importação)
// sempre abra um SQLite em memória durante os testes — nunca o dev.db real.
process.env.DB_FILE = ':memory:';
process.env.NODE_ENV = 'test';
process.env.BUSINESS_TIMEZONE = 'America/Sao_Paulo';

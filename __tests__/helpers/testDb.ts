import {migrate} from 'drizzle-orm/better-sqlite3/migrator';
import {db, sqlite} from '../../src/db/client';

// Aplica as mesmas migrações do drizzle-kit no banco em memória do teste.
// Idempotente (o drizzle guarda o histórico numa tabela própria), então
// pode ser chamado em beforeAll sem problema.
export function runMigrations(): void {
  migrate(db, {migrationsFolder: './drizzle'});
}

// Limpa as tabelas entre testes, já que o client do SQLite é um singleton
// (mesma instância reaproveitada por todos os testes de um mesmo arquivo).
export function clearAllTables(): void {
  sqlite.exec(`
    DELETE FROM order_items;
    DELETE FROM orders;
    DELETE FROM drink_options;
  `);
}

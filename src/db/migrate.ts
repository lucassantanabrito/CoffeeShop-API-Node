import 'dotenv/config';
import {migrate} from 'drizzle-orm/better-sqlite3/migrator';
import {db, sqlite} from './client';

migrate(db, {migrationsFolder: './drizzle'});
console.log('Migrações aplicadas com sucesso.');
sqlite.close();

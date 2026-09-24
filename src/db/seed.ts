import 'dotenv/config';
import {db, sqlite} from './client';
import {drinkOptions} from './schema';

const INITIAL_DRINKS = [
  {type: 'espresso', label: 'Espresso', price: 8.0, hasMilk: false},
  {type: 'latte', label: 'Latte', price: 18.0, hasMilk: true},
  {type: 'v60', label: 'V60', price: 15.0, hasMilk: false},
  {type: 'mocha', label: 'Mocha', price: 20.0, hasMilk: true},
  {type: 'chocolate_quente', label: 'Chocolate Quente', price: 14.0, hasMilk: true},
  {type: 'cappuccino', label: 'Cappuccino', price: 16.0, hasMilk: true},
];

async function main() {
  for (const drink of INITIAL_DRINKS) {
    await db.insert(drinkOptions).values(drink).onConflictDoNothing();
  }
  console.log(`Seed concluído: ${INITIAL_DRINKS.length} bebidas no catálogo.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    sqlite.close();
  });

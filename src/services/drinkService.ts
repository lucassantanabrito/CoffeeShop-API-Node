import {eq, asc} from 'drizzle-orm';
import {db} from '../db/client';
import {drinkOptions} from '../db/schema';
import {MILK_OPTIONS} from '../types';
import type {DrinkOption, MilkOption, NewDrinkInput, DrinkType, MilkType} from '../types';

export const drinkService = {
  async getDrinkOptions(): Promise<DrinkOption[]> {
    return db.select().from(drinkOptions).orderBy(asc(drinkOptions.label));
  },

  getMilkOptions(): MilkOption[] {
    return MILK_OPTIONS;
  },

  async getDrinkPrice(type: DrinkType, milk: MilkType): Promise<number> {
    const [drink] = await db.select().from(drinkOptions).where(eq(drinkOptions.type, type));
    const basePrice = drink?.price ?? 0;
    const milkAdd = drink?.hasMilk
      ? MILK_OPTIONS.find(m => m.type === milk)?.priceAdd ?? 0
      : 0;
    return basePrice + milkAdd;
  },

  async addDrink(input: NewDrinkInput): Promise<DrinkOption> {
    const type = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const [drink] = await db
      .insert(drinkOptions)
      .values({
        type,
        label: input.label,
        price: input.price,
        hasMilk: input.hasMilk,
      })
      .returning();
    return drink;
  },
};

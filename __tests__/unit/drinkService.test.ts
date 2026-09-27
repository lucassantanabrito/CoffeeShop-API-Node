import {drinkService} from '../../src/services/drinkService';
import {runMigrations, clearAllTables} from '../helpers/testDb';

beforeAll(() => {
  runMigrations();
});

beforeEach(() => {
  clearAllTables();
});

describe('drinkService.addDrink', () => {
  it('gera um type único prefixado com custom-, ignorando o que vier no input', async () => {
    const drink = await drinkService.addDrink({label: 'Chai Latte', price: 17.5, hasMilk: true});
    expect(drink.type).toMatch(/^custom-/);
    expect(drink.label).toBe('Chai Latte');
  });

  it('nunca gera o mesmo type duas vezes seguidas', async () => {
    const a = await drinkService.addDrink({label: 'A', price: 10, hasMilk: false});
    const b = await drinkService.addDrink({label: 'B', price: 10, hasMilk: false});
    expect(a.type).not.toBe(b.type);
  });
});

describe('drinkService.getDrinkOptions', () => {
  it('retorna as bebidas ordenadas por label', async () => {
    await drinkService.addDrink({label: 'Zebra Latte', price: 10, hasMilk: false});
    await drinkService.addDrink({label: 'Affogato', price: 10, hasMilk: false});
    const drinks = await drinkService.getDrinkOptions();
    expect(drinks.map(d => d.label)).toEqual(['Affogato', 'Zebra Latte']);
  });
});

describe('drinkService.updateDrink', () => {
  it('atualiza label/price/hasMilk de uma bebida existente', async () => {
    const created = await drinkService.addDrink({label: 'Chai', price: 15, hasMilk: true});
    const updated = await drinkService.updateDrink(created.type, {
      label: 'Chai Editado',
      price: 19.9,
      hasMilk: false,
    });
    expect(updated).toMatchObject({label: 'Chai Editado', price: 19.9, hasMilk: false});
  });

  it('lança NOT_FOUND ao tentar editar uma bebida que não existe', async () => {
    await expect(
      drinkService.updateDrink('nao-existe', {label: 'X', price: 1, hasMilk: false}),
    ).rejects.toMatchObject({code: 'NOT_FOUND'});
  });
});

describe('drinkService.deleteDrink', () => {
  it('remove a bebida do catálogo', async () => {
    const created = await drinkService.addDrink({label: 'Chai', price: 15, hasMilk: true});
    await drinkService.deleteDrink(created.type);
    const drinks = await drinkService.getDrinkOptions();
    expect(drinks.find(d => d.type === created.type)).toBeUndefined();
  });

  it('lança NOT_FOUND ao tentar apagar uma bebida que não existe', async () => {
    await expect(drinkService.deleteDrink('nao-existe')).rejects.toMatchObject({code: 'NOT_FOUND'});
  });
});

describe('drinkService.getDrinkPrice', () => {
  it('soma o adicional de leite só quando a bebida tem leite', async () => {
    const withMilk = await drinkService.addDrink({label: 'Latte', price: 18, hasMilk: true});
    const withoutMilk = await drinkService.addDrink({label: 'V60', price: 15, hasMilk: false});

    await expect(drinkService.getDrinkPrice(withMilk.type, 'vegetal')).resolves.toBeCloseTo(18 + 4);
    await expect(drinkService.getDrinkPrice(withoutMilk.type, 'vegetal')).resolves.toBeCloseTo(15);
  });

  it('retorna 0 para um type que não existe', async () => {
    await expect(drinkService.getDrinkPrice('nao-existe', 'normal')).resolves.toBe(0);
  });
});
